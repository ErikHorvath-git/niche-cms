<template>
  <div class="dashboard-shell">
    <header class="dashboard-header">
      <div>
        <p class="badge">Admin Dashboard</p>
        <h1>Vitaj, {{ user?.fullName }}</h1>
        <p class="client-info">
          Client:
          <strong>{{ user?.clientName || user?.slug || 'Neznámy' }}</strong>
        </p>
      </div>
      <button class="logout-btn" @click="handleLogout">Odhlásiť sa</button>
    </header>

    <section class="card form">
      <h3>Pridať novú položku</h3>
      <input v-model="newItem.titulok" placeholder="Názov (napr. Boxerský tréning)" />
      <input v-model="newItem.podtitulok" placeholder="Popis" />
      <input v-model="newItem.cena" placeholder="Cena" />
      <button @click="saveData" :disabled="loading">Pridať</button>
    </section>

    <section class="list">
      <h3>Aktuálny obsah</h3>
      <div v-for="item in items" :key="item.id" class="item-row">
        <div>
          <strong>{{ item.titulok }}</strong> - {{ item.cena }}
        </div>
        <button @click="deleteItem(item.id)" class="delete-btn">Zmazať</button>
      </div>
    </section>

    <p v-if="status" class="status">{{ status }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '../api';
import { logout, user } from '../store/auth';

const router = useRouter();
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

const clientSlug = computed(() => user.value?.slug || parseClientId());
const clientEndpoint = computed(() => `/obsah/${clientSlug.value}`);

const items = ref([]);
const loading = ref(false);
const status = ref('');
const newItem = ref({
  client_id: clientSlug.value,
  typ: 'cennik',
  titulok: '',
  podtitulok: '',
  cena: ''
});

const handleLogout = async () => {
  logout();
  await router.push({ name: 'Login' });
};

const fetchItems = async () => {
  loading.value = true;
  status.value = '';
  try {
    const res = await apiClient.get(clientEndpoint.value);
    items.value = res.data;
  } catch (err) {
    status.value =
      err.response?.data?.error || err.message || 'Chyba pri načítaní dát';
  } finally {
    loading.value = false;
  }
};

const saveData = async () => {
  if (!newItem.value.titulok) return;
  loading.value = true;
  status.value = '';
  try {
    await apiClient.post(clientEndpoint.value, {
      ...newItem.value,
      client_id: clientSlug.value
    });
    newItem.value.titulok = '';
    newItem.value.podtitulok = '';
    newItem.value.cena = '';
    newItem.value.client_id = clientSlug.value;
    await fetchItems();
  } catch (err) {
    status.value =
      err.response?.data?.error || err.message || 'Chyba pri ukladaní';
  } finally {
    loading.value = false;
  }
};

const deleteItem = async (id) => {
  if (!confirm('Naozaj zmazať?')) return;
  loading.value = true;
  status.value = '';
  try {
    await apiClient.delete(`${clientEndpoint.value}/${id}`);
    await fetchItems();
  } catch (err) {
    status.value =
      err.response?.data?.error || err.message || 'Chyba pri mazaní';
  } finally {
    loading.value = false;
  }
};

onMounted(fetchItems);

</script>

<style scoped>
.dashboard-shell {
  min-height: 100vh;
  padding: 2rem;
  background: #0f0f0f;
  color: #f5f5f5;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.badge {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  color: #f3ca33;
}

.dashboard-header h1 {
  margin: 0.2rem 0;
  font-size: 2rem;
}

.client-info {
  color: #f3ca33;
  margin: 0;
}

.logout-btn {
  background: transparent;
  color: #f3ca33;
  border: 1px solid #f3ca33;
  padding: 0.9rem 1.5rem;
  border-radius: 999px;
  font-weight: 700;
}

.card {
  background: #141414;
  border-radius: 20px;
  padding: 1.5rem;
  margin-bottom: 1.25rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.card.form input,
.card.form button {
  width: 100%;
}

.card.form input {
  margin-bottom: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  border: 1px solid #333;
  background: #1c1c1c;
  color: #fff;
}

.card.form button {
  background: #f3ca33;
  color: #111;
  border-radius: 10px;
  font-weight: 700;
  border: none;
  padding: 0.9rem;
}

.list {
  background: #141414;
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.9rem 0;
  border-bottom: 1px solid #222;
}

.item-row:last-child {
  border-bottom: none;
}

.delete-btn {
  background: #ff4444;
  border: none;
  color: #fff;
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
}

.status {
  margin-top: 1rem;
  color: #f08080;
  text-align: center;
}
</style>
