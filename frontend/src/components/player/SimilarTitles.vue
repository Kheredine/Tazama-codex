<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  type: { type: String, required: true },  // 'movie' | 'tv'
  id:   { type: [String, Number], required: true },
})

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY
const IMG_BASE  = 'https://image.tmdb.org/t/p/'
const router    = useRouter()

const similar  = ref([])
const loading  = ref(true)

const fetchSimilar = async () => {
  loading.value = true
  try {
    // Fetch TMDB recommendations (ML-powered, genre/mood aware) and show details in parallel
    const [recRes, detailRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/${props.type}/${props.id}/recommendations?api_key=${TMDB_KEY}&page=1`),
      fetch(`https://api.themoviedb.org/3/${props.type}/${props.id}?api_key=${TMDB_KEY}`),
    ])
    const [recData, detailData] = await Promise.all([recRes.json(), detailRes.json()])

    let results = (recData.results || []).filter(item => item.poster_path)

    // If recommendations are sparse, supplement with genre + keyword discovery
    if (results.length < 8 && detailData.genres?.length) {
      const genreIds = detailData.genres.map(g => g.id).join(',')
      const discoverRes = await fetch(
        `https://api.themoviedb.org/3/discover/${props.type}?api_key=${TMDB_KEY}` +
        `&with_genres=${genreIds}&sort_by=vote_average.desc&vote_count.gte=100&page=1`
      )
      const discoverData = await discoverRes.json()
      const seen = new Set(results.map(r => r.id))
      seen.add(Number(props.id))
      for (const item of (discoverData.results || [])) {
        if (item.poster_path && !seen.has(item.id)) {
          results.push(item)
          seen.add(item.id)
        }
      }
    }

    similar.value = results.slice(0, 18)
  } catch {
    similar.value = []
  } finally {
    loading.value = false
  }
}

const goDetail = (item, event = null) => {
  const route = router.resolve({ name: 'detail', params: { type: props.type, id: item.id } })
  if (event?.ctrlKey || event?.metaKey) {
    window.open(route.href, '_blank')
  } else {
    router.push(route)
  }
}

const titleOf  = (item) => item.title || item.name || ''
const yearOf   = (item) => (item.release_date || item.first_air_date || '').split('-')[0]
const ratingOf = (item) => item.vote_average?.toFixed(1)

onMounted(fetchSimilar)
watch(() => props.id, fetchSimilar)
</script>

<template>
  <div>
    <h2 class="text-xs uppercase tracking-widest text-white/40 mb-4 font-medium">
      More Like This
    </h2>

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
    <div v-else-if="similar.length" class="flex gap-4 overflow-x-auto pb-2" style="scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;">
      <div
        v-for="item in similar"
        :key="item.id"
        class="shrink-0 w-32 group cursor-pointer"
        @click="goDetail(item, $event)"
      >
        <div class="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-white/5 mb-2">
          <img
            :src="`${IMG_BASE}w185${item.poster_path}`"
            :alt="titleOf(item)"
            class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
          <!-- Hover overlay -->
          <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <div class="w-10 h-10 rounded-full bg-red-500/90 flex items-center justify-center">
              <i class="fa-solid fa-play text-white text-sm ml-0.5"></i>
            </div>
          </div>
          <!-- Rating badge -->
          <div v-if="ratingOf(item)" class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-yellow-400 text-[10px] font-semibold">
            ⭐ {{ ratingOf(item) }}
          </div>
        </div>
        <p class="text-white/80 text-xs font-medium leading-tight line-clamp-2">{{ titleOf(item) }}</p>
        <p v-if="yearOf(item)" class="text-white/35 text-[10px] mt-0.5">{{ yearOf(item) }}</p>
      </div>
    </div>

    <!-- Empty -->
    <div v-else class="flex items-center gap-3 py-6 text-white/30">
      <i class="fa-solid fa-film text-2xl"></i>
      <p class="text-sm">No similar titles found.</p>
    </div>
  </div>
</template>
