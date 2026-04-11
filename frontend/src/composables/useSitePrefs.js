import { ref } from 'vue'

// Module-level state — persists across navigation
const sitePrefs = ref({
  favActors:       [],
  excludedTags:    [],
  nicheBalance:    50,
  trailerAutoplay: 'click',
})

const loaded = ref(false)

export function useSitePrefs() {

  const load = async (apiFetch) => {
    if (loaded.value) return
    try {
      const data = await apiFetch('/api/user/site-settings')
      sitePrefs.value = data.settings
      loaded.value = true
    } catch {
      // Not logged in or error — use defaults
    }
  }

  const save = async (apiFetch) => {
    await apiFetch('/api/user/site-settings', {
      method: 'PUT',
      body: JSON.stringify(sitePrefs.value),
    })
  }

  const addFavActor = (name) => {
    const n = name.trim()
    if (n && !sitePrefs.value.favActors.includes(n)) {
      sitePrefs.value.favActors = [...sitePrefs.value.favActors, n]
    }
  }

  const removeFavActor = (name) => {
    sitePrefs.value.favActors = sitePrefs.value.favActors.filter(a => a !== name)
  }

  const addExcludedTag = (tag) => {
    const t = tag.trim().toLowerCase()
    if (t && !sitePrefs.value.excludedTags.includes(t)) {
      sitePrefs.value.excludedTags = [...sitePrefs.value.excludedTags, t]
    }
  }

  const removeExcludedTag = (tag) => {
    sitePrefs.value.excludedTags = sitePrefs.value.excludedTags.filter(t => t !== tag)
  }

  return {
    sitePrefs,
    loaded,
    load,
    save,
    addFavActor,
    removeFavActor,
    addExcludedTag,
    removeExcludedTag,
  }
}
