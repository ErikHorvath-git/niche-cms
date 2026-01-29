require('dotenv').config(); // load backend-specific env vars

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const createAuthMiddleware = require('./middleware/auth');

const app = express();

const supabaseUrl =
  process.env.SAAS_PLATFORM_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.SAAS_PLATFORM_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  process.env.SAAS_PLATFORM_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials for the SaaS backend');
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    'Missing Supabase service role key for secure backend operations'
  );
}

const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];
const allowedOrigins =
  envOrigins.length > 0 ? envOrigins : defaultOrigins;
const allowAnyOrigin = allowedOrigins.includes('*');

app.use(express.json());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowAnyOrigin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true
  })
);

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
const requireAuth = createAuthMiddleware(supabaseAdmin);

const contentTable = 'client_content';
const clientsTable = 'clients';
const userProfilesTable = 'user_profiles';

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => uuidRegex.test(value);

async function resolveClientUuid(identifier) {
  if (!identifier) return null;
  if (isUuid(identifier)) {
    return identifier;
  }

  const { data: client, error } = await supabaseAdmin
    .from(clientsTable)
    .select('id')
    .eq('slug', identifier)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Client lookup failed');
  }

  return client?.id ?? null;
}

app.get('/api/obsah/:clientId', async (req, res) => {
  const { clientId } = req.params;

  let resolvedClientId;
  try {
    resolvedClientId = await resolveClientUuid(clientId);
  } catch (error) {
    console.error('Client lookup failed for read route', error);
    return res.status(500).json({ error: 'Unable to resolve client identifier.' });
  }

  if (!resolvedClientId) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  const { data, error } = await supabase
    .from(contentTable)
    .select('*')
    .eq('client_id', resolvedClientId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, fullName, clientName, clientSlug } = req.body;

  if (!email || !password || !fullName || !clientName || !clientSlug) {
    return res
      .status(400)
      .json({ error: 'Email, password, full name, and client details are required.' });
  }

  let user;
  let clientRecord;

  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpError || !signUpData?.user) {
      console.error('Supabase signUp failed', signUpError);
      return res
        .status(400)
        .json({ error: 'Unable to register with provided credentials.' });
    }

    user = signUpData.user;

    const { data: clientData, error: clientError } = await supabaseAdmin
      .from(clientsTable)
      .insert({ name: clientName, slug: clientSlug })
      .select()
      .maybeSingle();

    if (clientError || !clientData) {
      throw clientError ?? new Error('Client creation failed');
    }
    clientRecord = clientData;

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from(userProfilesTable)
      .insert({
        user_id: user.id,
        client_id: clientRecord.id,
        full_name: fullName
      })
      .select()
      .maybeSingle();

    if (profileError || !profileData) {
      throw profileError ?? new Error('User profile creation failed');
    }

    return res.status(201).json({
      message: 'Registration successful',
      profile: {
        id: profileData.id,
        userId: profileData.user_id,
        fullName: profileData.full_name,
        clientId: profileData.client_id,
        role: profileData.role
      }
    });
  } catch (error) {
    console.error('Registration flow failed', error);
    console.error('Registration Error Details:', error);

    if (clientRecord?.id) {
      const { error: cleanupClientError } = await supabaseAdmin
        .from(clientsTable)
        .delete()
        .eq('id', clientRecord.id);
      if (cleanupClientError) {
        console.error('Unable to cleanup client after registration failure', cleanupClientError);
      }
    }

    if (user?.id) {
      const { error: cleanupUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (cleanupUserError) {
        console.error('Unable to cleanup Supabase user after registration failure', cleanupUserError);
      }
    }

    return res.status(500).json({ error: 'Registration failed, please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: 'Email and password are required.' });
  }

  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (loginError || !loginData?.session || !loginData?.user) {
    console.error('Supabase login failed', loginError);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const { session, user } = loginData;

  const { data: profileData, error: profileError } = await supabaseAdmin
    .from(userProfilesTable)
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Failed to load user profile after login', profileError);
    return res.status(500).json({ error: 'Unable to load profile.' });
  }

  if (!profileData) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  const { data: clientData, error: clientError } = await supabaseAdmin
    .from(clientsTable)
    .select('slug, name')
    .eq('id', profileData.client_id)
    .maybeSingle();

  if (clientError || !clientData) {
    console.error('Failed to load client details', clientError);
    return res.status(500).json({ error: 'Unable to load client information.' });
  }

  return res.json({
    token: session.access_token,
    user: {
      id: profileData.id,
      fullName: profileData.full_name,
      clientId: profileData.client_id,
      slug: clientData.slug,
      clientName: clientData.name,
      role: profileData.role
    }
  });
});

app.post('/api/obsah/:clientId', requireAuth, async (req, res) => {
  const { clientId } = req.params;

  let resolvedClientId;
  try {
    resolvedClientId = await resolveClientUuid(clientId);
  } catch (error) {
    console.error('Client lookup failed for write route', error);
    return res.status(500).json({ error: 'Unable to resolve client identifier.' });
  }

  if (!resolvedClientId) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  if (req.user.clientId !== resolvedClientId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const payload = {
    ...req.body,
    client_id: resolvedClientId
  };

  const { data, error } = await supabaseAdmin
    .from(contentTable)
    .insert([payload])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.delete('/api/obsah/:clientId/:id', requireAuth, async (req, res) => {
  const { clientId, id } = req.params;

  let resolvedClientId;
  try {
    resolvedClientId = await resolveClientUuid(clientId);
  } catch (error) {
    console.error('Client lookup failed for delete route', error);
    return res.status(500).json({ error: 'Unable to resolve client identifier.' });
  }

  if (!resolvedClientId) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  if (req.user.clientId !== resolvedClientId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { error } = await supabaseAdmin
    .from(contentTable)
    .delete()
    .eq('client_id', resolvedClientId)
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Deleted' });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Backend beží lokálne na http://localhost:${PORT}`);
    console.log(`📡 Povolené origins: ${allowedOrigins.join(', ')}`);
  });
}

module.exports = app;
