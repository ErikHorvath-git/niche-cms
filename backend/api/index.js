require('dotenv').config(); // load backend-specific env vars

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const supabaseUrl =
  process.env.SAAS_PLATFORM_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SAAS_PLATFORM_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials for the SaaS backend');
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

const supabase = createClient(supabaseUrl, supabaseKey);

const contentTable = 'client_content';

app.get('/api/obsah/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const { data, error } = await supabase
    .from(contentTable)
    .select('*')
    .eq('client_id', clientId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/obsah/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const payload = {
    ...req.body,
    client_id: clientId
  };

  const { data, error } = await supabase
    .from(contentTable)
    .insert([payload])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.delete('/api/obsah/:clientId/:id', async (req, res) => {
  const { clientId, id } = req.params;
  const { error } = await supabase
    .from(contentTable)
    .delete()
    .eq('client_id', clientId)
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Zmazané' });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Backend beží lokálne na http://localhost:${PORT}`);
    console.log(`📡 Povolené origins: ${allowedOrigins.join(', ')}`);
  });
}

module.exports = app;
