import { ref } from 'vue'
import { apiUrl } from '@/config/api'

const load = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

const save = (key, val) => localStorage.setItem(key, JSON.stringify(val))

// Module-level — persist across navigation
const watchlist = ref(load('tazama_watchlist'))
const watched   = ref(load('tazama_watched'))
const liked     = ref(load('tazama_liked'))
const history   = ref(load('tazama_history'))

const same = (a, b) => String(a.id) === String(b.id) && a.type === b.type

// ── DB Sync helpers ────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('tazama_token')

const pushLibraryToDB = async () => {
  const token = getToken()
  if (!token) return
  try {
    await fetch(apiUrl('/api/user/library/sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        liked:     liked.value,
        watchlist: watchlist.value,
        watched:   watched.value,
        history:   history.value,
      }),
    })
  } catch (e) {
    console.warn('Library DB sync failed:', e.message)
  }
}

export function useUserLibrary() {
  const isInWatchlist = (item) => watchlist.value.some(x => same(x, item))
  const isWatched     = (item) => watched.value.some(x => same(x, item))
  const isLiked       = (item) => liked.value.some(x => same(x, item))

  const toggle = (listRef, key, item) => {
    const idx = listRef.value.findIndex(x => same(x, item))
    if (idx >= 0) listRef.value.splice(idx, 1)
    else          listRef.value.unshift(item)
    save(key, listRef.value)
    pushLibraryToDB()
  }

  const toggleWatchlist = (item) => toggle(watchlist, 'tazama_watchlist', item)
  const toggleWatched   = (item) => toggle(watched,   'tazama_watched',   item)
  const toggleLike      = (item) => toggle(liked,     'tazama_liked',     item)

  const addHistory = (entry) => {
    history.value.unshift({ ...entry, addedAt: Date.now() })
    save('tazama_history', history.value)
    pushLibraryToDB()
  }

  // ── Called on login to load DB data into local state ──────────────────
  const syncLibraryFromDB = async () => {
    const token = getToken()
    if (!token) return
    try {
      const res  = await fetch(apiUrl('/api/user/library'), {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      const lib  = data.library || {}

      if (lib.liked?.length)     { liked.value     = lib.liked;     save('tazama_liked',     lib.liked) }
      if (lib.watchlist?.length) { watchlist.value = lib.watchlist; save('tazama_watchlist', lib.watchlist) }
      if (lib.watched?.length)   { watched.value   = lib.watched;   save('tazama_watched',   lib.watched) }
      if (lib.history?.length)   { history.value   = lib.history;   save('tazama_history',   lib.history) }
    } catch (e) {
      console.warn('syncLibraryFromDB failed:', e.message)
    }
  }

  // ── Called on logout to reset in-memory state ─────────────────────────
  const clearLibrary = () => {
    watchlist.value = []
    watched.value   = []
    liked.value     = []
    history.value   = []
    localStorage.removeItem('tazama_watchlist')
    localStorage.removeItem('tazama_watched')
    localStorage.removeItem('tazama_liked')
    localStorage.removeItem('tazama_history')
  }

  return {
    watchlist,
    watched,
    liked,
    history,
    isInWatchlist,
    isWatched,
    isLiked,
    toggleWatchlist,
    toggleWatched,
    toggleLike,
    addHistory,
    syncLibraryFromDB,
    clearLibrary,
  }
}
