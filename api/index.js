const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Napojenie na tvoj .env
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_ANON_KEY
);

// Trasa pre získanie dát pre Diamond Gym
app.get('/api/obsah/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const { data, error } = await supabase
    .from('diamond_obsah')
    .select('*')
    .eq('client_id', clientId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Trasa pre ukladanie nových dát z Admina
app.post('/api/obsah', async (req, res) => {
  const { data, error } = await supabase
    .from('diamond_obsah')
    .insert([req.body])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = app;