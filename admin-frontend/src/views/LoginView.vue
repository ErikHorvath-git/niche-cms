<template>
  <div class="auth-shell">
    <div class="auth-card">
      <h1>Prihlásiť sa</h1>
      <form @submit.prevent="handleLogin">
        <input v-model="form.email" type="email" placeholder="Email" required />
        <input v-model="form.password" type="password" placeholder="Heslo" required />
        <button type="submit" :disabled="loading">{{ loading ? 'Prihlasujem...' : 'Prihlásiť sa' }}</button>
      </form>
      <p v-if="status" class="status">{{ status }}</p>
      <p class="auth-switch">
        Nemáš účet?
        <router-link to="/register">Registrovať</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '../api';
import { login } from '../store/auth';

const router = useRouter();
const loading = ref(false);
const status = ref('');
const form = ref({
  email: '',
  password: ''
});

const handleLogin = async () => {
  loading.value = true;
  status.value = '';
  try {
    const { data } = await apiClient.post('/auth/login', {
      email: form.value.email,
      password: form.value.password
    });
    login({ token: data.token, user: data.user });
    await router.push({ name: 'Dashboard' });
  } catch (error) {
    status.value =
      error.response?.data?.error ||
      error.message ||
      'Prihlásenie zlyhalo. Skús znova.';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.auth-shell {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: radial-gradient(circle at top, #1f1c2c, #191919);
}

.auth-card {
  background: #111;
  border-radius: 16px;
  padding: 2rem;
  width: min(420px, 90vw);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  color: #eee;
}

h1 {
  margin-bottom: 1rem;
  font-size: 2rem;
  text-align: center;
}

form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

input {
  padding: 0.8rem 1rem;
  border-radius: 10px;
  border: 1px solid #333;
  background: #1b1b1b;
  color: #fff;
  font-size: 1rem;
}

button {
  padding: 0.9rem;
  border: none;
  border-radius: 10px;
  background: #f3ca33;
  color: #111;
  font-weight: 700;
}

.status {
  margin-top: 1rem;
  color: #f08080;
  text-align: center;
}

.auth-switch {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  text-align: center;
}
</style>
