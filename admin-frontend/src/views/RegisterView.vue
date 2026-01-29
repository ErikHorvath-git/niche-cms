<template>
  <div class="auth-shell">
    <div class="auth-card">
      <h1>Registrovať</h1>
      <form @submit.prevent="handleRegister">
        <input v-model="form.email" type="email" placeholder="Email" required />
        <input v-model="form.password" type="password" placeholder="Heslo" required />
        <input v-model="form.fullName" type="text" placeholder="Meno a priezvisko" required />
        <input v-model="form.clientName" type="text" placeholder="Názov klienta" required />
        <input v-model="form.clientSlug" type="text" placeholder="Slug klienta" required />
        <button type="submit" :disabled="loading">{{ loading ? 'Registrujem...' : 'Registrovať sa' }}</button>
      </form>
      <p v-if="status" class="status">{{ status }}</p>
      <p class="auth-switch">
        Už máš účet?
        <router-link to="/login">Prihlásiť sa</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '../api';

const router = useRouter();
const loading = ref(false);
const status = ref('');
const form = ref({
  email: '',
  password: '',
  fullName: '',
  clientName: '',
  clientSlug: ''
});

const handleRegister = async () => {
  loading.value = true;
  status.value = '';
  try {
    await apiClient.post('/auth/register', {
      email: form.value.email,
      password: form.value.password,
      fullName: form.value.fullName,
      clientName: form.value.clientName,
      clientSlug: form.value.clientSlug
    });
    status.value = 'Registrácia prebehla. Over si email.';
    await router.push({ name: 'VerifyEmail' });
  } catch (error) {
    status.value =
      error.response?.data?.error ||
      error.message ||
      'Registrácia zlyhala. Skús znova.';
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
