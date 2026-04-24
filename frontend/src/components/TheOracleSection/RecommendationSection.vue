<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOracleState } from '@/composables/useOracleState'
import { useUserLibrary } from '@/composables/useUserLibrary'
import { useGoDetail } from '@/composables/useGoDetail'
import { useUserPreferences } from '@/composables/useUserPreferences'
import { useI18n } from '@/composables/useI18n'
import { apiUrl } from '@/config/api'

const router = useRouter()
const { selections, recommendations, loading, error, noResult, page, appendRecommendations, removeRecommendation } = useOracleState()
const { isInWatchlist, isWatched, isLiked, toggleWatchlist, toggleWatched, toggleLike } = useUserLibrary()
const { recordLikedMood, recordSkippedSet, recordDisliked, isDisliked, prefs } = useUserPreferences()
const { t, lang } = useI18n()

const TMDB_KEY  = import.meta.env.VITE_TMDB_API_KEY
const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE  = 'https://image.tmdb.org/t/p/w500'

const verifyInTMDB = async (suggestion, contentType) => {
  try {
    const type = (contentType === 'Movies' || suggestion.mediaType === 'movie') ? 'movie' : 'tv'
    const yearParam = suggestion.year ? `&year=${suggestion.year}` : ''
    const url = `${TMDB_BASE}/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(suggestion.title)}${yearParam}`
    const res = await fetch(url)
    const data = await res.json()
    let result = data.results?.[0]
    if (!result && suggestion.year) {
      const res2 = await fetch(`${TMDB_BASE}/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(suggestion.title)}`)
      const data2 = await res2.json()
      result = data2.results?.[0]
    }
    if (!result) return null
    return {
      id:     result.id,
      type,
      title:  result.title || result.name,
      year:   (result.release_date || result.first_air_date || '').split('-')[0],
      poster: result.poster_path ? `${IMG_BASE}${result.poster_path}` : null,
      rating: result.vote_average?.toFixed(1),
      reason: suggestion.reason,
    }
  } catch {
    return null
  }
}

const fetchRecommendations = async (isMore = false) => {
  if (!selections.value || loading.value) return

  if (isMore) {
    page.value++
    const sel = selections.value
    if (sel?.selectedMood) recordSkippedSet(sel.selectedMood.id, sel.selectedSubMood?.id)
  }

  loading.value  = true
  error.value    = null
  noResult.value = false

  try {
    // Send already-shown titles so GPT doesn't repeat them
    const excludeTitles = recommendations.value.map(r => r.title)
    // Send disliked titles for context so GPT avoids similar ones
    const dislikedTitles = prefs.value.dislikedItems.slice(0, 30).map(d => d.title).filter(Boolean)

    const res = await fetch(apiUrl('/api/recommend'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...selections.value,
        page: page.value,
        excludeTitles,
        dislikedTitles,
        language: lang.value,   // 'en' or 'fr'
      }),
    })
    if (!res.ok) throw new Error('Server error')

    const suggestions = await res.json()

    const existingIds = new Set(recommendations.value.map(r => `${r.type}-${r.id}`))
    const results = await Promise.all(
      suggestions.map(s => verifyInTMDB(s, selections.value?.selectedContent))
    )
    const valid = results.filter(r => r && !isDisliked(r) && !existingIds.has(`${r.type}-${r.id}`))

    if (!valid.length && !isMore) noResult.value = true
    else appendRecommendations(valid)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// Action helpers — use String() to avoid id type mismatches
const makeItem = (rec) => ({
  id:     rec.id,
  type:   rec.type,
  title:  rec.title,
  poster: rec.poster,
  year:   rec.year,
})

const handleLike = (rec) => {
  toggleLike(makeItem(rec))
  if (selections.value?.selectedMood) recordLikedMood(selections.value.selectedMood.id)
}

const handleDislike = (rec) => {
  recordDisliked(makeItem(rec))
  removeRecommendation(makeItem(rec))
}

const { goDetail } = useGoDetail()

onMounted(() => {
  if (recommendations.value.length === 0) fetchRecommendations()
})
</script>

<template>
  <div class="flex flex-col gap-8">

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center gap-4 py-16 text-white/50">
      <div class="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
      <p class="text-sm">{{ t.loading }}</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-red-400 text-sm p-4 rounded-xl bg-red-500/10 border border-red-500/20">
      {{ error }}
      <button class="underline ml-2 hover:text-red-300" @click="fetchRecommendations()">Retry</button>
    </div>

    <!-- No results -->
    <div v-else-if="noResult" class="text-white/40 text-sm p-4">{{ t.noResults }}</div>

    <!-- Cards -->
    <template v-else-if="recommendations.length">
      <h2 class="text-xs uppercase tracking-widest font-semibold" style="color:rgba(255,255,255,0.35)">
        {{ t.recommendationsTitle }}
      </h2>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="rec in recommendations"
          :key="`${rec.type}-${rec.id}`"
          class="rec-card group flex flex-col rounded-2xl overflow-hidden cursor-pointer border transition duration-300"
          style="background: rgba(124,58,237,0.07); border-color: rgba(124,58,237,0.18);"
          @click="goDetail(rec, $event)"
        >
          <!-- Poster -->
          <div class="relative w-full h-64 shrink-0 overflow-hidden" style="background:#12121A">
            <img
              v-if="rec.poster"
              :src="rec.poster"
              :alt="rec.title"
              class="w-full h-full object-cover group-hover:scale-105 transition duration-500"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-white/15">
              <i class="fa-solid fa-film text-4xl"></i>
            </div>

            <!-- Gradient overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>

            <!-- Rating -->
            <span v-if="rec.rating" class="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-yellow-400 text-xs px-2 py-1 rounded-lg font-semibold">
              ⭐ {{ rec.rating }}
            </span>

            <!-- Type badge -->
            <span class="absolute top-3 right-3 bg-purple-600/80 backdrop-blur-sm text-white text-[10px] uppercase px-2 py-1 rounded-lg font-semibold tracking-wide">
              {{ rec.type === 'movie' ? 'Film' : 'Series' }}
            </span>
          </div>

          <!-- Info — full description, no clamp -->
          <div class="flex flex-col gap-2 p-4 flex-1">
            <h3 class="text-white text-base font-bold leading-snug">{{ rec.title }}</h3>
            <span class="text-white/35 text-xs font-medium">{{ rec.year }}</span>
            <p v-if="rec.reason" class="text-white/65 text-sm leading-relaxed mt-1">{{ rec.reason }}</p>
          </div>

          <!-- Action bar — 2×2 on mobile, 4-cols on sm+ -->
          <div
            class="grid grid-cols-2 sm:grid-cols-4 border-t"
            style="border-color:rgba(255,255,255,0.07);"
            @click.stop
          >
            <!-- Like -->
            <button
              class="action-btn border-r border-b sm:border-b-0"
              style="border-color:rgba(255,255,255,0.07);"
              :class="isLiked(makeItem(rec)) ? 'text-red-400 bg-red-500/10' : 'text-white/40 hover:text-red-400 hover:bg-red-500/8'"
              @click="handleLike(rec)"
            >
              <i class="fa-solid fa-heart text-xs"></i>
              <span>{{ isLiked(makeItem(rec)) ? t.liked : t.like }}</span>
            </button>

            <!-- Watchlist -->
            <button
              class="action-btn border-b sm:border-b-0 sm:border-r"
              style="border-color:rgba(255,255,255,0.07);"
              :class="isInWatchlist(makeItem(rec)) ? 'text-blue-400 bg-blue-500/10' : 'text-white/40 hover:text-blue-400 hover:bg-blue-500/8'"
              @click="toggleWatchlist(makeItem(rec))"
            >
              <i class="fa-solid fa-bookmark text-xs"></i>
              <span>{{ isInWatchlist(makeItem(rec)) ? t.inWatchlist : t.addWatchlist }}</span>
            </button>

            <!-- Watched -->
            <button
              class="action-btn border-r"
              style="border-color:rgba(255,255,255,0.07);"
              :class="isWatched(makeItem(rec)) ? 'text-green-400 bg-green-500/10' : 'text-white/40 hover:text-green-400 hover:bg-green-500/8'"
              @click="toggleWatched(makeItem(rec))"
            >
              <i class="fa-solid fa-check text-xs"></i>
              <span>{{ isWatched(makeItem(rec)) ? t.alreadyWatched : t.markWatched }}</span>
            </button>

            <!-- Not for me -->
            <button
              class="action-btn text-white/30 hover:text-orange-400 hover:bg-orange-500/8"
              @click="handleDislike(rec)"
            >
              <i class="fa-solid fa-thumbs-down text-xs"></i>
              <span>{{ t.notForMe }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Show More -->
      <div class="flex justify-center mt-4">
        <button
          class="btn-secondary-1 flex items-center gap-2"
          :disabled="loading"
          @click="fetchRecommendations(true)"
        >
          <i class="fa-solid fa-plus text-xs"></i>
          {{ t.showMore }}
        </button>
      </div>
    </template>

  </div>
</template>

<style scoped>
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 6px;
  font-size: 11px;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
  background: none;
  border-top: none;
  border-bottom: none;
  border-left: none;
}
</style>
