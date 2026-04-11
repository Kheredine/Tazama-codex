import { ref, computed } from 'vue'
import { apiUrl } from '@/config/api'

// ── Module-level singleton ─────────────────────────────────────────────────
const user  = ref(null)
const token = ref(localStorage.getItem('tazama_token') || null)

export const isAuthenticated = computed(() => !!user.value)
export const isPremium       = computed(() => user.value?.plan === 'premium')

// ── Helpers ────────────────────────────────────────────────────────────────
const apiFetch = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token.value) headers['Authorization'] = `Bearer ${token.value}`

  const res = await fetch(apiUrl(path), { ...options, headers })

  // Guard: if server returned HTML (e.g. 404 page) instead of JSON
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Server error (${res.status}) — please restart the backend server`)
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

const applyTheme = (plan) => {
  document.documentElement.setAttribute('data-plan', plan || 'standard')
}

const storeToken = (t) => {
  token.value = t
  if (t) localStorage.setItem('tazama_token', t)
  else   localStorage.removeItem('tazama_token')
}

// ── initAuth — called once in main.js before app mount ─────────────────────
export const initAuth = async () => {
  if (!token.value) return

  try {
    const data = await apiFetch('/api/auth/me')
    user.value = data.user
    applyTheme(data.user.plan)
    // Sync library from DB after verifying auth
    await syncLibraryOnLogin()
  } catch {
    // Token invalid or expired — clear it
    storeToken(null)
    user.value = null
    applyTheme('standard')
  }
}

// Lazy-import to avoid circular deps
const syncLibraryOnLogin = async () => {
  try {
    const { useUserLibrary } = await import('./useUserLibrary.js')
    const lib = useUserLibrary()
    await lib.syncLibraryFromDB()
  } catch (e) {
    console.warn('Library sync failed:', e.message)
  }
}

// ── login ──────────────────────────────────────────────────────────────────
export const login = async (email, password) => {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  storeToken(data.token)
  user.value = data.user
  applyTheme(data.user.plan)
  await syncLibraryOnLogin()
  return data
}

// ── register ───────────────────────────────────────────────────────────────
export const register = async (email, username, password) => {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  })
  storeToken(data.token)
  user.value = data.user
  applyTheme(data.user.plan)
  return data
}

// ── logout ─────────────────────────────────────────────────────────────────
export const logout = async () => {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
  storeToken(null)
  user.value = null
  applyTheme('standard')
  // Clear local library state
  try {
    const { useUserLibrary } = await import('./useUserLibrary.js')
    const lib = useUserLibrary()
    lib.clearLibrary()
  } catch { /* ignore */ }
}

// ── unlockPremium ──────────────────────────────────────────────────────────
export const unlockPremium = async (answers) => {
  const data = await apiFetch('/api/auth/unlock-premium', {
    method: 'POST',
    body: JSON.stringify({ answers }),
  })
  storeToken(data.token)
  user.value = data.user
  applyTheme('premium')
  return data
}

// ── updateUser — refresh local user state after profile update ─────────────
export const updateUser = (newData) => {
  if (user.value) {
    user.value = { ...user.value, ...newData }
    applyTheme(user.value.plan)
  }
}

// ── Composable export ──────────────────────────────────────────────────────
export function useAuth() {
  return {
    user,
    token,
    isAuthenticated,
    isPremium,
    initAuth,
    login,
    register,
    logout,
    unlockPremium,
    updateUser,
    apiFetch,
  }
}
