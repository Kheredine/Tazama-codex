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
    await syncLibraryOnLogin()
  } catch {
    storeToken(null)
    user.value = null
    applyTheme('standard')
  }
}

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
// Accepts username + 4-digit passcode
export const login = async (username, passcode) => {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: username.trim(), passcode: String(passcode) }),
  })
  storeToken(data.token)
  user.value = data.user
  applyTheme(data.user.plan)
  await syncLibraryOnLogin()
  return data
}

// ── register ───────────────────────────────────────────────────────────────
// Accepts only username. Returns { passcode } — user is NOT signed in yet.
export const register = async (username) => {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: username.trim() }),
  })
  return data
}

// ── logout ─────────────────────────────────────────────────────────────────
export const logout = async () => {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
  storeToken(null)
  user.value = null
  applyTheme('standard')
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

// ── changePasscode ─────────────────────────────────────────────────────────
export const changePasscode = async (currentPasscode, newPasscode) => {
  return apiFetch('/api/user/passcode', {
    method: 'PUT',
    body: JSON.stringify({ currentPasscode: String(currentPasscode), newPasscode: String(newPasscode) }),
  })
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
    changePasscode,
    updateUser,
    apiFetch,
  }
}
