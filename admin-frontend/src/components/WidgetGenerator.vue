<template>
  <section class="saas-widget-generator">
    <header class="saas-widget-generator__header">
      <div>
        <p class="status-badge">SaaS Content Delivery</p>
        <h2>Generátor embed kódu</h2>
        <p class="description">Vložte tento kód na svoj web pre zobrazenie dynamického obsahu.</p>
      </div>
      <button class="action-btn" @click="copySnippet">
        {{ copyLabel }}
      </button>
    </header>

    <div class="saas-widget-generator__code-block">
      <div class="code-header">
        <span>HTML SNIPPET</span>
      </div>
      <pre><code>{{ snippet }}</code></pre>
    </div>

    <div class="saas-widget-generator__preview">
      <h3>Náhľad komponentu</h3>
      <div class="preview-container" v-if="items && items.length">
        <div class="preview-grid">
          <article v-for="item in previewItems" :key="item.id" class="preview-item">
            <div class="item-content">
              <span class="item-category">{{ item.type || 'Položka' }}</span>
              <h4>{{ item.title || item.titulok }}</h4>
              <p>{{ item.subtitle || item.podtitulok }}</p>
              <div class="item-footer">
                <span class="price-tag">{{ item.price || item.cena }}</span>
              </div>
            </div>
          </article>
        </div>
      </div>
      <p v-else class="empty-notice">
        Žiadne dáta na zobrazenie. Pridajte obsah v sekcii správy dát.
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
// Importujeme priamo 'user'. Ak by tvoj store exportoval default, použi: import user from '...'
import { user } from '../store/auth';

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  }
});

const copyLabel = ref('Kopírovať snippet');

const snippet = computed(() => {
  // Pridaná kontrola .value pre Ref objekty
  const clientId = user?.value?.clientId || user?.clientId || 'CLIENT_ID';
  
  const widgetContainer = `<div id="saas-content-widget" data-client-id="${clientId}"></div>`;
  
  // Unicode fix pre Vite parser: \u003C = < | \u003E = >
  const scriptStart = '\u003Cscript async src="http://localhost:3000/widget.js"\u003E';
  const scriptEnd = '\u003C/script\u003E';
  
  return `${widgetContainer}\n${scriptStart}${scriptEnd}`;
});

const previewItems = computed(() => (props.items || []).slice(0, 3));

const copySnippet = async () => {
  try {
    await navigator.clipboard.writeText(snippet.value);
    copyLabel.value = 'Skopírované!';
    setTimeout(() => {
      copyLabel.value = 'Kopírovať snippet';
    }, 2000);
  } catch (error) {
    copyLabel.value = 'Chyba pri kopírovaní';
    console.error(error);
  }
};
</script>

<style scoped>
.saas-widget-generator {
  background: #111111;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 2rem;
  margin: 1.5rem 0;
  color: #eee;
  font-family: sans-serif;
}

.saas-widget-generator__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.status-badge {
  background: #222;
  color: #00ff88;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 0.5rem;
  display: inline-block;
}

.description {
  color: #888;
  font-size: 0.9rem;
  margin-top: 0.4rem;
}

.saas-widget-generator__code-block {
  background: #050505;
  border-radius: 8px;
  border: 1px solid #444;
  overflow: hidden;
}

.code-header {
  background: #1a1a1a;
  padding: 8px 15px;
  font-size: 0.65rem;
  color: #666;
  border-bottom: 1px solid #333;
}

pre {
  padding: 1.5rem;
  margin: 0;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.85rem;
  color: #50fa7b;
  white-space: pre-wrap;
}

.action-btn {
  background: #ffffff;
  color: #000;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.action-btn:hover {
  opacity: 0.9;
}

.saas-widget-generator__preview {
  margin-top: 2.5rem;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.preview-item {
  background: #181818;
  border: 1px solid #282828;
  border-radius: 10px;
  padding: 1.2rem;
}

.item-category {
  font-size: 0.6rem;
  color: #00ff88;
  text-transform: uppercase;
}

.price-tag {
  color: #ffffff;
  font-weight: bold;
  border-bottom: 2px solid #00ff88;
}

.empty-notice {
  color: #555;
  text-align: center;
  padding: 3rem;
  border: 1px dashed #333;
  border-radius: 8px;
}
</style>