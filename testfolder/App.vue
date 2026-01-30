<template>
  <main class="widget-demo">
    <div class="test-content">
      <h1>Arben Gym Test</h1>
      <p>Tento text musí widget zachytiť a poslať do DB.</p>
    </div>

    <div 
      id="niche-cms-widget" 
      data-client-id="1f5d576a-1733-4b4f-8965-df8f27d54327"
      class="widget-placeholder"
    ></div>
  </main>
</template>

<script setup>
import { onMounted } from 'vue';

const clientId = '1f5d576a-1733-4b4f-8965-df8f27d54327';

onMounted(() => {
  // 1. Najprv poistka: Ak by Vue prepísalo atribúty, nastavíme ich znova
  const host = document.getElementById('niche-cms-widget');
  if (host) {
    host.setAttribute('data-client-id', clientId);
  }

  // 2. Načítame script s malým oneskorením, aby sme mali istotu, že DOM je stabilný
  setTimeout(() => {
    console.log('🚀 Pripravujem načítanie widgetu...');
    const script = document.createElement('script');
    script.id = 'niche-cms-widget-loader';
    script.src = 'http://localhost:3000/widget.js';
    script.async = true;
    // Dôležité pre tvoj widget.js, aby vedel kam sa pripojiť
    script.dataset.backendUrl = 'http://localhost:3000';
    
    document.head.appendChild(script);
    console.log('✅ Script pridaný do head');
  }, 500); // 500ms stačí na to, aby sa Vue úplne "usadilo"
});
</script>

<style scoped>
.widget-demo {
  min-height: 100vh;
  padding: 2rem;
  background: #0a0a0a;
  color: #fff;
  font-family: 'Inter', sans-serif;
}
.test-content { margin-bottom: 2rem; border-bottom: 1px solid #333; padding-bottom: 1rem; }
.widget-placeholder {
  min-height: 200px;
  border: 2px dashed #444;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111;
}
</style>