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
      <label class="file-input">
        <span>{{ imageUploading ? 'Nahrávam obrázok...' : 'Vybrať obrázok' }}</span>
        <input type="file" accept="image/*" @change="handleImageChange" />
      </label>
      <div class="image-preview" v-if="imagePreview">
        <img :src="imagePreview" alt="Náhľad obrázka" />
      </div>
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

    <WidgetGenerator :items="items" />

    <section class="card site-elements">
      <div class="flex items-center justify-between gap-2">
        <h3 class="m-0">Zachytené prvky stránky</h3>
        <span
          class="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-500 text-black"
          >Automatické cesty</span
        >
      </div>
      <div v-if="siteElements.length" class="overflow-x-auto mt-4">
        <table class="min-w-full text-left table-auto border-separate border-spacing-y-2">
          <thead>
            <tr class="text-xs uppercase text-gray-400">
              <th class="px-3 py-2 font-semibold">Element ID</th>
              <th class="px-3 py-2 font-semibold">Tag</th>
              <th class="px-3 py-2 font-semibold">Pôvodný text</th>
              <th class="px-3 py-2 font-semibold">Aktuálna hodnota</th>
              <th class="px-3 py-2 font-semibold">Akcie</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="element in siteElements"
              :key="element.element_id"
              :class="{
                'border-l-4 border-yellow-400 bg-white/5': element.current_value !== element.original_value
              }"
              class="bg-[#0f0f0f] border border-gray-800 rounded-lg"
            >
              <td class="px-3 py-3 align-top">
                <p class="text-sm font-mono text-gray-100 break-words">
                  {{ element.element_id }}
                </p>
                <p
                  v-if="element.current_value !== element.original_value"
                  class="text-xxs text-yellow-400 mt-1"
                >
                  Zmenené
                </p>
              </td>
              <td class="px-3 py-3 align-top">
                <span
                  class="inline-flex items-center px-2 py-0.5 text-xs font-semibold tracking-wide text-gray-900 bg-gray-200 rounded-full"
                >
                  {{ element.tag_name || '—' }}
                </span>
              </td>
              <td class="px-3 py-3 align-top">
                <p class="text-sm text-gray-300 whitespace-pre-line">
                  {{ element.original_value || 'žiadna hodnota' }}
                </p>
              </td>
              <td class="px-3 py-3 align-top">
                <textarea
                  v-model="element.current_value"
                  @input="element.dirty = true"
                  rows="2"
                  class="w-full text-sm text-white bg-[#121212] border border-gray-800 rounded-md px-2 py-1 focus:outline-none focus:border-yellow-400"
                  placeholder="Text, ktorý sa sa zobrazí na stránke"
                ></textarea>
              </td>
              <td class="px-3 py-3 align-top flex flex-col gap-2">
                <button
                  class="px-3 py-1 text-sm font-semibold text-black bg-yellow-400 rounded-full disabled:bg-gray-600"
                  :disabled="element.saving || !element.element_id"
                  @click="saveSiteElement(element)"
                >
                  {{ element.saving ? 'Ukladám…' : 'Uložiť' }}
                </button>
                <span class="text-xxs text-gray-500">
                  {{ element.tag_name?.toUpperCase() || '—' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="mt-4 text-sm text-gray-400">
        Widget ešte nenaskenoval žiadne prvky. Otvorte vašu stránku s nasadeným
        widgetom.
      </p>
    </section>

    <p v-if="status" class="status">{{ status }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '../api';
import { logout, user } from '../store/auth';
import WidgetGenerator from '../components/WidgetGenerator.vue';
import { uploadImage } from '../utils/storage';

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

const sanitizeClientParam = (value) =>
  (value || '')
    .toString()
    .split(':')[0]
    .trim();

const clientSlug = computed(
  () => sanitizeClientParam(user.value?.slug) || sanitizeClientParam(parseClientId())
);
const clientEndpoint = computed(() => `/obsah/${clientSlug.value}`);
const siteEndpoint = computed(() => `/site-structure/${clientSlug.value}`);

const items = ref([]);
const loading = ref(false);
const status = ref('');
const newItem = ref({
  client_id: clientSlug.value,
  typ: 'cennik',
  titulok: '',
  podtitulok: '',
  cena: '',
  image_url: ''
});
const imageUploading = ref(false);
const imagePreview = ref('');
const siteElements = ref([]);

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
    newItem.value.image_url = '';
    imagePreview.value = '';
    newItem.value.client_id = clientSlug.value;
    await fetchItems();
  } catch (err) {
    status.value =
      err.response?.data?.error || err.message || 'Chyba pri ukladaní';
  } finally {
    loading.value = false;
  }
};

const handleImageChange = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  imageUploading.value = true;
  status.value = '';
  try {
    const url = await uploadImage(file, clientSlug.value);
    newItem.value.image_url = url;
    imagePreview.value = url;
  } catch (error) {
    status.value = error?.message || 'Chyba pri nahrávaní obrázka.';
  } finally {
    imageUploading.value = false;
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

const normalizeElementText = (value) =>
  value === undefined || value === null ? '' : value.toString();

const fetchSiteElements = async () => {
  try {
    status.value = '';
    const res = await apiClient.get(siteEndpoint.value);
    siteElements.value = (res.data?.elements || []).map((element) => ({
      ...element,
      current_value: normalizeElementText(element.current_value),
      original_value:
        normalizeElementText(element.original_value) ||
        normalizeElementText(element.default_value),
      dirty: false,
      saving: false
    }));
  } catch (err) {
    const networkError =
      err?.code === 'ERR_NETWORK' || /network error/i.test(err?.message || '');
    status.value = networkError
      ? 'Sieťová chyba: backend môže ešte reštartovať, skúste načítať o chvíľu.'
      : err.response?.data?.error || err.message || 'Chyba pri načítaní prvkov';
    console.error('Unable to load site elements', err);
    siteElements.value = [];
  }
};

let siteElementsPoll = null;
const startSiteElementsPolling = () => {
  if (siteElementsPoll) {
    return;
  }
  siteElementsPoll = setInterval(() => {
    fetchSiteElements().catch((err) => {
      console.error('Auto-refresh failed', err);
    });
  }, 15000);
};
const stopSiteElementsPolling = () => {
  if (!siteElementsPoll) {
    return;
  }
  clearInterval(siteElementsPoll);
  siteElementsPoll = null;
};

const saveSiteElement = async (element) => {
  if (!element.element_id) return;
  element.saving = true;
  try {
    await apiClient.post('/site-structure', {
      clientId: clientSlug.value,
      elementId: element.element_id,
      currentValue: element.current_value
    });
    element.dirty = false;
  } catch (err) {
    status.value =
      err.response?.data?.error || err.message || 'Chyba pri ukladaní elementu';
  } finally {
    element.saving = false;
  }
};

onMounted(() => {
  fetchItems();
  fetchSiteElements();
  startSiteElementsPolling();
});

onBeforeUnmount(() => {
  stopSiteElementsPolling();
});

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

.file-input {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  color: #f3ca33;
  font-weight: 600;
}

.file-input input {
  cursor: pointer;
  color: #f3ca33;
}

.image-preview {
  margin-bottom: 0.75rem;
}

.image-preview img {
  max-width: 120px;
  border-radius: 12px;
  border: 1px solid #2c2c2c;
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

.site-elements {
  background: #181818;
  border-radius: 18px;
  padding: 1.5rem;
  margin-top: 1.25rem;
}

.site-element {
  border: 1px solid #2c2c2c;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  background: #111;
}

.site-element__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
  color: #c7c7c7;
}

.site-element input {
  width: 100%;
  padding: 0.65rem 0.8rem;
  border-radius: 8px;
  background: #1b1b1b;
  border: 1px solid #333;
  color: #fff;
}

.site-element__save {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: 1px solid #f3ca33;
  background: transparent;
  color: #f3ca33;
  font-weight: 600;
  cursor: pointer;
}

.site-element__save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
