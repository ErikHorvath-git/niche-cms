import { computed, ref } from 'vue';

const TOKEN_KEY = 'supabase_token';
const USER_KEY = 'supabase_user';

const isBrowser = typeof window !== 'undefined';

const storedToken = isBrowser ? window.localStorage.getItem(TOKEN_KEY) : null;
const storedUser = isBrowser ? window.localStorage.getItem(USER_KEY) : null;

const token = ref(storedToken);
const user = ref(storedUser ? JSON.parse(storedUser) : null);

const persistState = () => {
  if (!isBrowser) return;

  if (token.value) {
    window.localStorage.setItem(TOKEN_KEY, token.value);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }

  if (user.value) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user.value));
  } else {
    window.localStorage.removeItem(USER_KEY);
  }
};

function login(payload) {
  if (!payload?.token || !payload?.user) {
    throw new Error('login requires a token and user object');
  }

  token.value = payload.token;
  user.value = payload.user;
  persistState();
  return { token: token.value, user: user.value };
}

function logout() {
  token.value = null;
  user.value = null;
  if (!isBrowser) return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

const isAuthenticated = computed(() => Boolean(token.value));

export {
  login,
  logout,
  token,
  user,
  isAuthenticated,
  TOKEN_KEY,
  USER_KEY
};

export default function useAuth() {
  return {
    login,
    logout,
    token,
    user,
    isAuthenticated
  };
}
