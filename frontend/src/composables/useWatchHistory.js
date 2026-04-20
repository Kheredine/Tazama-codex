import { ref } from 'vue'
import { apiUrl } from '@/config/api'

const STORAGE_KEY = 'tazama_stream_history'
const MAX_ITEMS = 20

const getToken = () => localStorage.getItem('tazama_token')

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

// Module-level — persists across navigation
const streamHistory = ref(load())
let dbLoaded = false

// Fire-and-forget POST to save a single item to the DB
const pushToDb = (item) => {
  const token = getToken()
  if (!token) return
  fetch(apiUrl('/api/user/watch-history'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ item }),
  }).catch(() => {})
}

// Load history from DB once per session (replaces localStorage data if DB has records)
const loadFromDb = async () => {
  if (dbLoaded) return
  dbLoaded = true
  const token = getToken()
  if (!token) return
  try {
    const res = await fetch(apiUrl('/api/user/watch-history'), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const data = await res.json()
    if (data.history?.length) {
      streamHistory.value = data.history
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.history))
    }
  } catch { /* ignore */ }
}

const saveToStreamHistory = (item) => {
  const idx = streamHistory.value.findIndex(
    (h) => String(h.id) === String(item.id) && h.type === item.type,
  )
  if (idx !== -1) streamHistory.value.splice(idx, 1)
  const entry = { ...item, watchedAt: Date.now() }
  streamHistory.value.unshift(entry)
  if (streamHistory.value.length > MAX_ITEMS) {
    streamHistory.value = streamHistory.value.slice(0, MAX_ITEMS)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(streamHistory.value))
  pushToDb(entry)
}

const removeFromStreamHistory = (id, type) => {
  streamHistory.value = streamHistory.value.filter(
    (h) => !(String(h.id) === String(id) && h.type === type),
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(streamHistory.value))
}

const clearStreamHistory = async () => {
  streamHistory.value = []
  localStorage.removeItem(STORAGE_KEY)
  const token = getToken()
  if (!token) return
  fetch(apiUrl('/api/user/watch-history'), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}

export function useWatchHistory() {
  loadFromDb()
  return { streamHistory, saveToStreamHistory, removeFromStreamHistory, clearStreamHistory }
}
