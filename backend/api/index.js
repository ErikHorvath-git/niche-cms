const path = require('path');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const createAuthMiddleware = require('./middleware/auth');

const app = express();

// --- SUPABASE CONFIG ---
const supabaseUrl = process.env.SAAS_PLATFORM_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SAAS_PLATFORM_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SAAS_PLATFORM_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
const requireAuth = createAuthMiddleware(supabaseAdmin);

// --- TABLES ---
const contentTable = 'client_content';
const clientsTable = 'clients';
const userProfilesTable = 'user_profiles';
const siteStructureTable = 'site_elements';

// --- CORS CONFIG ---
const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:8080'
];

const allowedOrigins = envOrigins.length > 0 ? envOrigins : defaultOrigins;
const allowAnyOrigin = allowedOrigins.includes('*');

app.use(express.json());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowAnyOrigin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true
  })
);

// --- STATIC FILES (FIX PRE CORB & WIDGET LOADING) ---
// Podľa tvojho Docker výpisu skáčeme z /app/backend/api o 2 úrovne hore
const publicPath = path.resolve(__dirname, '..', '..', 'public');
const distPath = path.join(publicPath, 'dist');

const setDistHeaders = (res, filePath) => {
  if (filePath.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
};

app.use('/dist', express.static(distPath, { setHeaders: setDistHeaders }));
app.use(express.static(publicPath, { setHeaders: setDistHeaders }));

// --- HELPERS ---
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => uuidRegex.test(value);
const normalizePayloadValue = (value) => (value === undefined || value === null ? '' : value.toString());

async function resolveClientUuid(identifier) {
  if (!identifier) return null;
  if (isUuid(identifier)) return identifier;

  const { data: client, error } = await supabaseAdmin
    .from(clientsTable)
    .select('id')
    .eq('slug', identifier)
    .maybeSingle();

  if (error) throw new Error(error.message || 'Client lookup failed');
  return client?.id ?? null;
}

// --- API ROUTES ---

// Get content (Widget Read)
app.get('/api/obsah/:clientId', async (req, res) => {
  const { clientId } = req.params;
  try {
    const resolvedClientId = await resolveClientUuid(clientId);
    if (!resolvedClientId) return res.status(404).json({ error: 'Client not found.' });

    const { data, error } = await supabase.from(contentTable).select('*').eq('client_id', resolvedClientId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password, fullName, clientName, clientSlug } = req.body;
  if (!email || !password || !fullName || !clientName || !clientSlug) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError || !signUpData?.user) throw signUpError;
    const user = signUpData.user;

    const { data: clientData, error: clientError } = await supabaseAdmin
      .from(clientsTable).insert({ name: clientName, slug: clientSlug }).select().maybeSingle();
    if (clientError) throw clientError;

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from(userProfilesTable).insert({ 
        user_id: user.id, 
        client_id: clientData.id, 
        full_name: fullName 
      }).select().maybeSingle();
    if (profileError) throw profileError;

    res.status(201).json({ message: 'Registration successful', profile: profileData });
  } catch (error) {
    console.error('Registration failed', error);
    res.status(500).json({ error: error.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) return res.status(401).json({ error: 'Invalid credentials.' });

    const { data: profileData } = await supabaseAdmin.from(userProfilesTable).select('*').eq('user_id', loginData.user.id).maybeSingle();
    const { data: clientData } = await supabaseAdmin.from(clientsTable).select('slug, name').eq('id', profileData.client_id).maybeSingle();

    res.json({
      token: loginData.session.access_token,
      user: { ...profileData, slug: clientData.slug, clientName: clientData.name }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sync Site Structure (Fixnutý Upsert)
app.post('/api/site-elements/sync', async (req, res) => {
  try {
    const { clientId, elements } = req.body;
    if (!clientId || !Array.isArray(elements)) return res.status(400).json({ error: 'Invalid payload.' });

    const resolvedClientId = await resolveClientUuid(clientId);
    if (!resolvedClientId) return res.status(404).json({ error: 'Client not found.' });

    const elementsToUpsert = elements
      .map(el => ({
        client_id: resolvedClientId,
        element_id: (el.elementId || el.element_id || '').trim(),
        tag_name: (el.tagName || el.tag_name || '').trim(),
        original_value: normalizePayloadValue(el.originalValue || el.original_value || el.currentValue || el.current_value),
        current_value: normalizePayloadValue(el.currentValue || el.current_value)
      }))
      .filter(el => el.element_id);

    console.log(`[SiteElements] Syncing ${elementsToUpsert.length} elements for client ${resolvedClientId}`);

    if (elementsToUpsert.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from(siteStructureTable)
        .upsert(elementsToUpsert, { onConflict: 'client_id,element_id' });

      if (upsertError) throw upsertError;
    }

    const { data: savedData } = await supabaseAdmin.from(siteStructureTable).select('*').eq('client_id', resolvedClientId);
    res.json({ elements: savedData });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message || 'Sync failed.' });
  }
});

// Dashboard Routes
app.get('/api/site-structure/:clientId', async (req, res) => {
  try {
    const resolvedClientId = await resolveClientUuid(req.params.clientId);
    if (!resolvedClientId) return res.status(404).json({ error: 'Client not found.' });
    const { data } = await supabaseAdmin.from(siteStructureTable).select('*').eq('client_id', resolvedClientId);
    res.json({ elements: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/site-structure', async (req, res) => {
  const { clientId, elementId, currentValue } = req.body;
  try {
    const resolvedClientId = await resolveClientUuid(clientId);
    const { data, error } = await supabaseAdmin
      .from(siteStructureTable)
      .update({ current_value: currentValue })
      .eq('client_id', resolvedClientId)
      .eq('element_id', elementId)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    res.json({ element: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend beží na porte ${PORT}`);
  console.log(`📂 Servujem static z: ${publicPath}`);
});

module.exports = app;