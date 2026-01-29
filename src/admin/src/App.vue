<template>
  <div id="admin-panel">
    <h1>💎 Diamond Gym Admin</h1>
    
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

const items = ref([]);
const loading = ref(false);
const status = ref('');
const newItem = ref({ client_id: 'diamond_gym', typ: 'cennik', titulok: '', podtitulok: '', cena: '' });

// Načítanie dát pri štarte
const fetchItems = async () => {
  const res = await axios.get('http://localhost:3000/api/obsah/diamond_gym');
  items.value = res.data;
};

const saveData = async () => {
  if (!newItem.value.titulok) return;
  loading.ref = true;
  await axios.post('http://localhost:3000/api/obsah', newItem.value);
  await fetchItems(); // Obnoviť zoznam
  newItem.value.titulok = ''; newItem.value.podtitulok = ''; newItem.value.cena = '';
  loading.ref = false;
};

const deleteItem = async (id) => {
  if (confirm('Naozaj zmazať?')) {
    await axios.delete(`http://localhost:3000/api/obsah/${id}`);
    await fetchItems();
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