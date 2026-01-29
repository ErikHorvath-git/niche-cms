import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import './store/auth'; // ensure store rehydration before router guards
import router from './router';

const app = createApp(App);
app.use(router);

router.isReady().then(() => {
  app.mount('#app');
});
