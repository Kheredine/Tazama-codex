import { ref } from 'vue'
import { apiUrl } from '@/config/api'

const load = (key, def) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? def } catch { return def }
}
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val))

// Module-level state
const prefs = ref(load('tazama_prefs', {
  likedMoods:     {},   // mood id → count
  dislikedItems:  [],   // { id, type, title }
  skippedSets:    [],   // array of moods+submoods where user clicked "show more" on first results
  sessionMoods:   [],   // { hour, moodId } — time-of-day mood pattern
}))

// ── DB Sync ────────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('tazama_token')

const pushPreferencesToDB = async () => {
  const token = getToken()
  if (!token) return
  try {
    await fetch(apiUrl('/api/user/preferences/sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        likedMoods:    prefs.value.likedMoods,
        dislikedItems: prefs.value.dislikedItems,
        sessionMoods:  prefs.value.sessionMoods,
      }),
    })
  } catch (e) {
    console.warn('Preferences DB sync failed:', e.message)
  }
}

export function useUserPreferences() {
  const _save = () => {
    save('tazama_prefs', prefs.value)
    pushPreferencesToDB()
  }

  // Call when user likes or watches a recommendation
  const recordLikedMood = (moodId) => {
    prefs.value.likedMoods[moodId] = (prefs.value.likedMoods[moodId] || 0) + 1
    _save()
  }

  // Call when "show more" is clicked after first batch — implies partial dissatisfaction
  const recordSkippedSet = (moodId, subMoodId) => {
    prefs.value.skippedSets.push({ moodId, subMoodId, at: Date.now() })
    if (prefs.value.skippedSets.length > 100) prefs.value.skippedSets.shift()
    _save()
  }

  // Call when user dislikes a card — stores id, type and title for backend context
  const recordDisliked = (item) => {
    if (!prefs.value.dislikedItems.find(x => String(x.id) === String(item.id) && x.type === item.type)) {
      prefs.value.dislikedItems.push({ id: item.id, type: item.type, title: item.title || '' })
      if (prefs.value.dislikedItems.length > 200) prefs.value.dislikedItems.shift()
      _save()
    }
  }

  // Record the mood selected at this hour of day
  const recordSessionMood = (moodId) => {
    const hour = new Date().getHours()
    prefs.value.sessionMoods.push({ hour, moodId, at: Date.now() })
    if (prefs.value.sessionMoods.length > 200) prefs.value.sessionMoods.shift()
    _save()
  }

  // Return top mood for a given hour range (±2 hours)
  const getMoodForHour = (hour) => {
    const range = prefs.value.sessionMoods.filter(s => Math.abs(s.hour - hour) <= 2)
    if (!range.length) return null
    const counts = {}
    range.forEach(s => { counts[s.moodId] = (counts[s.moodId] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  }

  // Top N liked moods
  const getTopMoods = (n = 3) => {
    return Object.entries(prefs.value.likedMoods)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([id]) => id)
  }

  const isDisliked = (item) =>
    prefs.value.dislikedItems.some(x => String(x.id) === String(item.id) && x.type === item.type)

  // How many total interactions the user has had (for threshold checks)
  const interactionCount = () =>
    Object.values(prefs.value.likedMoods).reduce((s, v) => s + v, 0) +
    prefs.value.sessionMoods.length

  // ── Sync from DB on login ──────────────────────────────────────────────
  const syncPreferencesFromDB = async () => {
    const token = getToken()
    if (!token) return
    try {
      const res  = await fetch(apiUrl('/api/user/preferences'), {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      const p    = data.preferences || {}

      // Merge DB data (DB wins for likedMoods counts)
      if (Object.keys(p.likedMoods || {}).length) {
        prefs.value.likedMoods = p.likedMoods
      }
      if (p.dislikedItems?.length) {
        prefs.value.dislikedItems = p.dislikedItems
      }
      if (p.sessionMoods?.length) {
        prefs.value.sessionMoods = p.sessionMoods
      }
      save('tazama_prefs', prefs.value)
    } catch (e) {
      console.warn('syncPreferencesFromDB failed:', e.message)
    }
  }

  return {
    prefs,
    recordLikedMood,
    recordSkippedSet,
    recordDisliked,
    recordSessionMood,
    getMoodForHour,
    getTopMoods,
    isDisliked,
    interactionCount,
    syncPreferencesFromDB,
  }
}
