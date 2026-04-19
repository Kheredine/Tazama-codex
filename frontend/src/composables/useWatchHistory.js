import { ref } from 'vue'

const STORAGE_KEY = 'tazama_stream_history'
const MAX_ITEMS = 20

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

// Module-level — persists across navigation
const streamHistory = ref(load())

const saveToStreamHistory = (item) => {
  const idx = streamHistory.value.findIndex(
    (h) => String(h.id) === String(item.id) && h.type === item.type,
  )
  if (idx !== -1) streamHistory.value.splice(idx, 1)
  streamHistory.value.unshift({ ...item, watchedAt: Date.now() })
  if (streamHistory.value.length > MAX_ITEMS) {
    streamHistory.value = streamHistory.value.slice(0, MAX_ITEMS)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(streamHistory.value))
}

const removeFromStreamHistory = (id, type) => {
  streamHistory.value = streamHistory.value.filter(
    (h) => !(String(h.id) === String(id) && h.type === type),
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(streamHistory.value))
}

const clearStreamHistory = () => {
  streamHistory.value = []
  localStorage.removeItem(STORAGE_KEY)
}

export function useWatchHistory() {
  return { streamHistory, saveToStreamHistory, removeFromStreamHistory, clearStreamHistory }
}
