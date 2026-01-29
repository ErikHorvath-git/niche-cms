<template>
  <div id="admin-panel">
    <h1>💎 SaaS Platform Admin</h1>
    
    <div class="card form">
      <h3>Pridať novú položku</h3>
      <input v-model="newItem.titulok" placeholder="Názov (napr. Boxerský tréning)" />
      <input v-model="newItem.podtitulok" placeholder="Popis" />
      <input v-model="newItem.cena" placeholder="Cena" />
      <button @click="saveData" :disabled="loading">Pridať</button>
    </div>

    <hr />

    <div class="list">
      <h3>Aktuálny obsah</h3>
      <div v-for="item in items" :key="item.id" class="item-row">
        <div>
          <strong>{{ item.titulok }}</strong> - {{ item.cena }}
        </div>
        <button @click="deleteItem(item.id)" class="delete-btn">Zmazať</button>
      </div>
    </div>

    <p v-if="status" class="status">{{ status }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const parseClientId = () => {
  const searchParams =
    typeof window === 'undefined'
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  return (
    searchParams.get('clientId') ||
    import.meta.env.VITE_SAAS_CLIENT_ID ||
    import.meta.env.VITE_CLIENT_ID ||
    import.meta.env.VITE_APP_CLIENT_ID ||
    'saas-default-client'
  );
};

const backendBase =
  (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const clientId = parseClientId();
const clientEndpoint = `${backendBase}/obsah/${clientId}`;

const items = ref([]);
const loading = ref(false);
const status = ref('');
const newItem = ref({
  client_id: clientId,
  typ: 'cennik',
  titulok: '',
  podtitulok: '',
  cena: ''
});

const fetchItems = async () => {
  loading.value = true;
  status.value = '';
  try {
    const res = await axios.get(clientEndpoint);
    items.value = res.data;
  } catch (error) {
    status.value =
      error.response?.data?.error || error.message || 'Chyba pri načítaní dát';
  } finally {
    loading.value = false;
  }
};

const saveData = async () => {
  if (!newItem.value.titulok) return;
  loading.value = true;
  status.value = '';
  try {
    await axios.post(clientEndpoint, {
      ...newItem.value,
      client_id: clientId
    });
    newItem.value.titulok = '';
    newItem.value.podtitulok = '';
    newItem.value.cena = '';
    newItem.value.client_id = clientId;
    await fetchItems();
  } catch (error) {
    status.value =
      error.response?.data?.error || error.message || 'Chyba pri ukladaní';
  } finally {
    loading.value = false;
  }
};

const deleteItem = async (id) => {
  if (!confirm('Naozaj zmazať?')) return;
  loading.value = true;
  status.value = '';
  try {
    await axios.delete(`${clientEndpoint}/${id}`);
    await fetchItems();
  } catch (error) {
    status.value =
      error.response?.data?.error || error.message || 'Chyba pri mazaní';
  } finally {
    loading.value = false;
  }
};

onMounted(fetchItems);
</script>

<style>
#admin-panel { font-family: 'Inter', sans-serif; max-width: 500px; margin: 40px auto; color: white; background: #1a1a1a; padding: 20px; border-radius: 15px; }
.card { background: #252525; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
input { display: block; width: 100%; margin-bottom: 10px; padding: 10px; background: #333; border: 1px solid #444; color: white; box-sizing: border-box; }
button { background: #f3ca33; border: none; padding: 10px; cursor: pointer; width: 100%; font-weight: bold; border-radius: 5px; }
.item-row { display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #333; }
.delete-btn { width: auto; background: #ff4444; font-size: 0.8rem; padding: 5px 10px; }
.status { color: #f3ca33; text-align: center; }
</style>
