<template>
  <section class="price-section">
    <header class="price-section__header">
      <h2>Cenník klienta</h2>
      <p v-if="error" class="price-section__error">{{ error }}</p>
    </header>

    <div v-if="loading" class="price-section__loader">Načítavam cenník…</div>

    <div v-else class="price-section__grid">
      <article v-for="item in cards" :key="item.id" class="price-card">
        <h3>{{ item.titulok }}</h3>
        <p class="price-card__subtitle" v-if="item.podtitulok">{{ item.podtitulok }}</p>
        <span class="price-card__price">{{ item.cena || 'Cena čoskoro' }}</span>
      </article>
      <p v-if="!cards.length && !loading" class="price-section__empty">
        Žiadne ceny zatiaľ nie sú k dispozícii.
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const cards = ref([]);
const loading = ref(false);
const error = ref('');

const backendBase =
  (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const resolveClientId = () => {
  const params =
    typeof window === 'undefined'
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  return (
    params.get('clientId') ||
    import.meta.env.VITE_SAAS_CLIENT_ID ||
    import.meta.env.VITE_CLIENT_ID ||
    import.meta.env.VITE_APP_CLIENT_ID ||
    'saas-default-client'
  );
};
const clientId = resolveClientId();
const clientEndpoint = `${backendBase}/obsah/${clientId}`;

const fetchPrices = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await axios.get(clientEndpoint);
    cards.value = response.data || [];
  } catch (err) {
    error.value =
      err.response?.data?.error || err.message || 'Nepodarilo sa načítať cenník.';
  } finally {
    loading.value = false;
  }
};

onMounted(fetchPrices);
</script>

<style scoped>
.price-section {
  font-family: 'Inter', system-ui, sans-serif;
  color: #fff;
  background: #050505;
  padding: 2rem;
  border-radius: 18px;
}

.price-section__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
}

.price-section__error {
  color: #ff7a7a;
  font-size: 0.9rem;
}

.price-section__loader {
  text-align: center;
  color: #f3ca33;
}

.price-section__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.price-card {
  background: #111;
  border: 1px solid #222;
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
}

.price-card h3 {
  margin: 0;
  letter-spacing: 0.05em;
}

.price-card__subtitle {
  color: #ccc;
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
}

.price-card__price {
  display: block;
  margin-top: 1rem;
  font-size: 1.4rem;
  font-weight: 700;
  color: #f3ca33;
}

.price-section__empty {
  grid-column: 1 / -1;
  text-align: center;
  color: #888;
  margin-top: 1rem;
}
</style>
