<template>
  <div class="auth-shell">
    <div class="auth-card">
      <h1>Skontrolujte svoj email</h1>
      <p>Success! Please check your inbox and click the confirmation link to activate your account.</p>
      <router-link to="/login" class="primary-link">Späť na prihlásenie</router-link>
    </div>
  </div>
</template>

<script setup></script>

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
  width: min(440px, 90vw);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  color: #eee;
  text-align: center;
}

h1 {
  margin-bottom: 1rem;
}

.primary-link {
  margin-top: 1.5rem;
  display: inline-block;
  padding: 0.85rem 1.5rem;
  border-radius: 10px;
  background: #f3ca33;
  color: #111;
  font-weight: 700;
  text-decoration: none;
}
</style>
