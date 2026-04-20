<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiUrl } from '@/config/api'

const props = defineProps({
  type:     { type: String, required: true },
  id:       { type: [String, Number], required: true },
  title:    { type: String, default: '' },
  year:     { type: String, default: '' },
  genres:   { type: Array,  default: () => [] },
  overview: { type: String, default: '' },
})

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY
const IMG_BASE = 'https://image.tmdb.org/t/p/'
const router   = useRouter()

const similar      = ref([])
const loading      = ref(true)
const aiError      = ref(false)
const activeReason = ref(null)   // id of card showing AI reason tooltip

// Simple session-level cache keyed by tmdbId so we don't re-call AI on re-render
const cache = new Map()

const fetchSimilar = async () => {
  loading.value  = true
  aiError.value  = false
  similar.value  = []

  const cacheKey = `${props.type}-${props.id}`
  if (cache.has(cacheKey)) {
    similar.value = cache.get(cacheKey)
    loading.value = false
    return
  }

  try {
    // 1 ── Ask backend AI for similar title suggestions
    const aiRes = await fetch(apiUrl('/api/similar'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:    props.title,
        year:     props.year,
        type:     props.type,
        genres:   props.genres.map(g => g.name || g),
        overview: props.overview,
      }),
    })

    if (!aiRes.ok) throw new Error('AI unavailable')
    const suggestions = await aiRes.json()
    if (!Array.isArray(suggestions) || !suggestions.length) throw new Error('Empty response')

    // 2 ── Resolve each suggestion to TMDB data (parallel)
    const resolved = await Promise.all(
      suggestions.map(async (s) => {
        try {
          const searchType = s.mediaType === 'tv' ? 'tv' : 'movie'
          const q = encodeURIComponent(s.title)
          const url = `https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_KEY}&query=${q}&year=${s.year}`
          const r    = await fetch(url)
          const data = await r.json()
          const hit  = (data.results || []).find(item => item.poster_path)
          if (!hit) return null
          return {
            ...hit,
            mediaType: searchType,
            aiReason:  s.reason,
          }
        } catch {
          return null
        }
      })
    )

    const results = resolved.filter(Boolean).slice(0, 16)
    cache.set(cacheKey, results)
    similar.value = results

  } catch {
    // AI failed — fall back to TMDB /similar endpoint
    aiError.value = true
    await fetchTmdbFallback()
  } finally {
    loading.value = false
  }
}

const fetchTmdbFallback = async () => {
  try {
    const res  = await fetch(`https://api.themoviedb.org/3/${props.type}/${props.id}/similar?api_key=${TMDB_KEY}&page=1`)
    const data = await res.json()
    similar.value = (data.results || []).filter(i => i.poster_path).slice(0, 16)
  } catch {
    similar.value = []
  }
}

const goDetail = (item) => {
  activeReason.value = null
  router.push({ name: 'detail', params: { type: item.mediaType || props.type, id: item.id } })
}

const titleOf  = (item) => item.title || item.name || ''
const yearOf   = (item) => (item.release_date || item.first_air_date || '').split('-')[0]
const ratingOf = (item) => item.vote_average?.toFixed(1)

const toggleReason = (id) => {
  activeReason.value = activeReason.value === id ? null : id
}

onMounted(fetchSimilar)
watch(() => props.id, fetchSimilar)
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xs uppercase tracking-widest text-white/40 font-medium">
        {{ type === 'movie' ? 'Similar Movies' : type === 'tv' ? 'Similar Series' : 'Similar Titles' }}
      </h2>
      <!-- AI badge -->
      <span
        v-if="!aiError && !loading && similar.length"
        class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
        style="background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);color:#a78bfa;"
        title="Recommendations curated by Oracle AI based on themes, tone & style"
      >
        <i class="fa-solid fa-wand-magic-sparkles text-[8px]"></i>
        AI Curated
      </span>
      <span
        v-else-if="aiError && similar.length"
        class="text-[9px] text-white/20 italic"
      >TMDB fallback</span>
    </div>

    <!-- Loading skeletons -->
    <div v-if="loading" class="flex gap-4 overflow-x-auto pb-2">
      <div
        v-for="n in 8"
        :key="n"
        class="shrink-0 w-32 rounded-xl overflow-hidden bg-white/5 animate-pulse"
      >
        <div class="w-full aspect-[2/3] bg-white/8"></div>
        <div class="p-2 space-y-1.5">
          <div class="h-2.5 bg-white/8 rounded w-3/4"></div>
          <div class="h-2 bg-white/5 rounded w-1/2"></div>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div
      v-else-if="similar.length"
      class="flex gap-4 overflow-x-auto pb-2"
      style="scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.1) transparent;"
    >
      <div
        v-for="item in similar"
        :key="item.id"
        class="shrink-0 w-32 group cursor-pointer"
      >
        <!-- Poster -->
        <div
          class="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-white/5 mb-2"
          @click="goDetail(item)"
        >
          <img
            :src="`${IMG_BASE}w185${item.poster_path}`"
            :alt="titleOf(item)"
            class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />

          <!-- Hover play overlay -->
          <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <div class="w-10 h-10 rounded-full bg-[#7c3aed]/90 flex items-center justify-center">
              <i class="fa-solid fa-play text-white text-sm ml-0.5"></i>
            </div>
          </div>

          <!-- Rating badge -->
          <div
            v-if="ratingOf(item)"
            class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-yellow-400 text-[10px] font-semibold"
          >⭐ {{ ratingOf(item) }}</div>

          <!-- Media type badge -->
          <div
            v-if="item.mediaType && item.mediaType !== props.type"
            class="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-white/50 text-[9px] uppercase font-bold"
          >{{ item.mediaType === 'tv' ? 'Series' : 'Film' }}</div>

          <!-- AI reason button (only when reason available) -->
          <button
            v-if="item.aiReason"
            class="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition"
            style="background:rgba(124,58,237,0.85);"
            @click.stop="toggleReason(item.id)"
            title="Why this is similar"
          >
            <i class="fa-solid fa-sparkles text-white text-[8px]"></i>
          </button>
        </div>

        <!-- AI reason tooltip (shown below card) -->
        <Transition name="fade">
          <div
            v-if="item.aiReason && activeReason === item.id"
            class="mb-2 px-2.5 py-2 rounded-xl text-[10px] leading-relaxed text-white/65"
            style="background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.25);"
          >
            <i class="fa-solid fa-wand-magic-sparkles text-purple-400/60 mr-1 text-[8px]"></i>
            {{ item.aiReason }}
          </div>
        </Transition>

        <!-- Title & year -->
        <p
          class="text-white/80 text-xs font-medium leading-tight line-clamp-2 cursor-pointer hover:text-white transition"
          @click="goDetail(item)"
        >{{ titleOf(item) }}</p>
        <p v-if="yearOf(item)" class="text-white/35 text-[10px] mt-0.5">{{ yearOf(item) }}</p>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="flex items-center gap-3 py-6 text-white/30">
      <i class="fa-solid fa-film text-2xl"></i>
      <p class="text-sm">No similar titles found.</p>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
