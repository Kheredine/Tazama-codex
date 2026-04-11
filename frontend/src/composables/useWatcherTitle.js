import { ref, computed } from 'vue'
import { useAuth } from './useAuth'
import { useUserLibrary } from './useUserLibrary'
import { useUserPreferences } from './useUserPreferences'

// Module-level so it persists across components
const watcherTitle = ref('Novice Watcher')
const watcherLevel = ref(0)

export function useWatcherTitle() {
  const { apiFetch, user } = useAuth()
  const { liked, watched, watchlist } = useUserLibrary()
  const { interactionCount } = useUserPreferences()

  const totalInteractions = computed(() =>
    liked.value.length + watched.value.length + watchlist.value.length + interactionCount()
  )

  // Level thresholds (client-side mirror of backend)
  const getLevel = (count) => {
    if (count >= 500) return { title: "Oracle's Favorite",     level: 6 }
    if (count >= 200) return { title: 'Grand Auteur',          level: 5 }
    if (count >= 100) return { title: "Director's Cut Devotee", level: 4 }
    if (count >= 50)  return { title: 'Reel Philosopher',      level: 3 }
    if (count >= 25)  return { title: 'Scene Chaser',          level: 2 }
    if (count >= 10)  return { title: 'Curious Cinephile',     level: 1 }
    return { title: 'Novice Watcher', level: 0 }
  }

  const syncLevel = async () => {
    if (!user.value) return
    const { title, level } = getLevel(totalInteractions.value)
    if (level !== watcherLevel.value) {
      watcherLevel.value = level
      watcherTitle.value = title
      try {
        await apiFetch('/api/user/update-watcher-level', {
          method: 'POST',
          body: JSON.stringify({ interactionCount: totalInteractions.value })
        })
      } catch { /* ignore */ }
    }
  }

  const loadTitle = async () => {
    if (!user.value) return
    try {
      const data = await apiFetch('/api/user/watcher-title')
      if (data.title) watcherTitle.value = data.title
      if (data.level !== undefined) watcherLevel.value = data.level
    } catch { /* ignore */ }
  }

  return { watcherTitle, watcherLevel, totalInteractions, syncLevel, loadTitle, getLevel }
}
