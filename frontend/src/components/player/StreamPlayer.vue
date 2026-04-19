<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ALL_SERVERS, PRIMARY_SERVERS, BACKUP_SERVERS, getEmbedUrl } from '@/utils/servers'
import { SUBTITLE_LANGUAGES } from '@/utils/subtitles'
import { useWatchHistory } from '@/composables/useWatchHistory'

const props = defineProps({
  type:   { type: String, required: true },        // 'movie' | 'tv'
  id:     { type: [String, Number], required: true },
  title:  { type: String, default: '' },
  poster: { type: String, default: '' },
})

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY
const IMG_BASE  = 'https://image.tmdb.org/t/p/'

// ── Persistent prefs ────────────────────────────────────────────────────────
const serverIndex  = ref(parseInt(localStorage.getItem('tazama_server') || '0'))
const subtitleLang = ref(localStorage.getItem('tazama_sub_lang') || 'en')

// ── UI state ─────────────────────────────────────────────────────────────────
const showLangPanel   = ref(false)
const showServerPanel = ref(false)
const iframeLoading   = ref(true)
const iframeError     = ref(false)
const iframeKey       = ref(0)
const isFullscreen    = ref(false)
const shareToast      = ref(false)

// ── TV state ─────────────────────────────────────────────────────────────────
const season          = ref(1)
const episode         = ref(1)
const tvSeasons       = ref([])
const episodes        = ref([])
const episodesLoading = ref(false)
const showEpisodes    = ref(true)

const { saveToStreamHistory } = useWatchHistory()

// ── Derived ───────────────────────────────────────────────────────────────────
const currentServer  = computed(() => ALL_SERVERS[serverIndex.value] || ALL_SERVERS[0])
const currentEpisode = computed(() => episodes.value.find(e => e.episode_number === episode.value))
const episodeTitle   = computed(() => currentEpisode.value?.name || `Episode ${episode.value}`)
const subtitleLabel  = computed(() => SUBTITLE_LANGUAGES.find(l => l.code === subtitleLang.value)?.name || 'English')

const embedUrl = computed(() =>
  getEmbedUrl(currentServer.value, props.type, props.id, season.value, episode.value, subtitleLang.value)
)

// ── TMDB: fetch TV seasons ────────────────────────────────────────────────────
const fetchTvDetails = async () => {
  if (props.type !== 'tv') return
  try {
    const res  = await fetch(`https://api.themoviedb.org/3/tv/${props.id}?api_key=${TMDB_KEY}`)
    const data = await res.json()
    tvSeasons.value = (data.seasons || []).filter(s => s.season_number > 0)
    await fetchEpisodes(1)
  } catch { /* fail silently */ }
}

const fetchEpisodes = async (seasonNum) => {
  episodesLoading.value = true
  try {
    const res  = await fetch(`https://api.themoviedb.org/3/tv/${props.id}/season/${seasonNum}?api_key=${TMDB_KEY}`)
    const data = await res.json()
    episodes.value = data.episodes || []
  } catch {
    episodes.value = []
  } finally {
    episodesLoading.value = false
  }
}

// ── Server / lang helpers ─────────────────────────────────────────────────────
const switchServer = (idx) => {
  serverIndex.value = idx
  localStorage.setItem('tazama_server', String(idx))
  reloadIframe()
  showServerPanel.value = false
}

const setLanguage = (code) => {
  subtitleLang.value = code
  localStorage.setItem('tazama_sub_lang', code)
  reloadIframe()
  showLangPanel.value = false
}

const reloadIframe = () => {
  iframeLoading.value = true
  iframeError.value   = false
  iframeKey.value++
}

// ── Episode navigation ────────────────────────────────────────────────────────
const selectEpisode = (s, e) => {
  season.value  = s
  episode.value = e
  reloadIframe()
  persistHistory()
}

const prevEpisode = async () => {
  if (episode.value > 1) {
    episode.value--
  } else if (season.value > 1) {
    season.value--
    await fetchEpisodes(season.value)
    episode.value = episodes.value.length || 1
  }
  reloadIframe()
  persistHistory()
}

const nextEpisode = async () => {
  const maxEp = episodes.value.length
  if (episode.value < maxEp) {
    episode.value++
  } else if (season.value < tvSeasons.value.length) {
    season.value++
    await fetchEpisodes(season.value)
    episode.value = 1
  }
  reloadIframe()
  persistHistory()
}

// ── Share ─────────────────────────────────────────────────────────────────────
const copyLink = () => {
  const url = window.location.href
  navigator.clipboard?.writeText(url).then(() => {
    shareToast.value = true
    setTimeout(() => { shareToast.value = false }, 2500)
  })
}

// ── Watch history ─────────────────────────────────────────────────────────────
const persistHistory = () => {
  saveToStreamHistory({
    id:          Number(props.id),
    type:        props.type,
    title:       props.title,
    poster:      props.poster,
    season:      season.value,
    episode:     episode.value,
    serverIndex: serverIndex.value,
  })
}

// ── Loading timeout fallback (some iframes never fire @load cross-origin) ──────
let loadTimer = null
const onIframeLoad = () => {
  clearTimeout(loadTimer)
  iframeLoading.value = false
}
const startLoadTimer = () => {
  clearTimeout(loadTimer)
  loadTimer = setTimeout(() => { iframeLoading.value = false }, 8000)
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
const onKey = (e) => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
  if (e.key === 'ArrowLeft'  && props.type === 'tv') { prevEpisode(); e.preventDefault() }
  if (e.key === 'ArrowRight' && props.type === 'tv') { nextEpisode(); e.preventDefault() }
  if (e.key === 's' || e.key === 'S') showServerPanel.value = !showServerPanel.value
  if (e.key === 'l' || e.key === 'L') showLangPanel.value   = !showLangPanel.value
}

watch(season, async (s) => {
  await fetchEpisodes(s)
  episode.value = 1
  reloadIframe()
})

watch(embedUrl, () => { startLoadTimer() })

onMounted(() => {
  fetchTvDetails()
  persistHistory()
  window.addEventListener('keydown', onKey)
  startLoadTimer()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(loadTimer)
})
</script>

<template>
  <div class="stream-player rounded-2xl overflow-hidden border border-white/10" :class="{ 'fixed inset-0 z-50 rounded-none border-0': isFullscreen }">

    <!-- ── Player Header ────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between gap-3 px-4 py-3 bg-[#0d0a1a] border-b border-white/8">
      <div class="flex-1 min-w-0">
        <p class="text-white font-semibold text-sm truncate">{{ title }}</p>
        <p v-if="type === 'tv'" class="text-white/40 text-xs mt-0.5">
          S{{ season }} E{{ episode }} — {{ episodeTitle }}
        </p>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Language -->
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border"
          :class="showLangPanel ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'"
          @click="showLangPanel = !showLangPanel; showServerPanel = false"
          title="Subtitles & Language (L)"
        >
          🌐 {{ subtitleLabel }}
        </button>

        <!-- Server -->
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border"
          :class="showServerPanel ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'"
          @click="showServerPanel = !showServerPanel; showLangPanel = false"
          title="Switch Server (S)"
        >
          <i class="fa-solid fa-server text-[10px]"></i> {{ currentServer.name }}
        </button>

        <!-- Share -->
        <button
          class="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition flex items-center justify-center"
          @click="copyLink"
          title="Copy link"
        >
          <i class="fa-solid fa-share-nodes text-[11px]"></i>
        </button>

        <!-- Fullscreen toggle -->
        <button
          class="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition flex items-center justify-center"
          @click="isFullscreen = !isFullscreen"
          title="Toggle fullscreen"
        >
          <i :class="isFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'" class="text-[11px]"></i>
        </button>
      </div>
    </div>

    <!-- ── Language Panel ───────────────────────────────────────────────────── -->
    <Transition name="slide-down">
      <div v-if="showLangPanel" class="bg-[#100d1e] border-b border-white/8 px-4 py-4">
        <p class="text-xs text-white/40 uppercase tracking-wider font-medium mb-3">Subtitle Language</p>
        <div class="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
          <button
            v-for="lang in SUBTITLE_LANGUAGES"
            :key="lang.code"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition border"
            :class="subtitleLang === lang.code
              ? 'bg-red-500/20 border-red-500/40 text-red-300'
              : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'"
            @click="setLanguage(lang.code)"
          >
            {{ lang.name }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- ── Server Panel ─────────────────────────────────────────────────────── -->
    <Transition name="slide-down">
      <div v-if="showServerPanel" class="bg-[#100d1e] border-b border-white/8 px-4 py-4">
        <p class="text-[10px] text-white/30 mb-2">Server not working? Try another →</p>

        <p class="text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Primary</p>
        <div class="flex flex-wrap gap-2 mb-4">
          <button
            v-for="(srv, idx) in PRIMARY_SERVERS"
            :key="srv.id"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition border"
            :class="serverIndex === idx
              ? 'bg-red-500/20 border-red-500/40 text-red-300'
              : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'"
            @click="switchServer(idx)"
            :title="`Streaming from ${srv.name} — Switch server if playback issues occur`"
          >
            {{ srv.name }}
          </button>
        </div>

        <p class="text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Backup</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(srv, idx) in BACKUP_SERVERS"
            :key="srv.id"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition border"
            :class="serverIndex === PRIMARY_SERVERS.length + idx
              ? 'bg-red-500/20 border-red-500/40 text-red-300'
              : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'"
            @click="switchServer(PRIMARY_SERVERS.length + idx)"
            :title="`Streaming from ${srv.name} — Switch server if playback issues occur`"
          >
            {{ srv.name }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- ── iframe Area ──────────────────────────────────────────────────────── -->
    <div class="relative w-full bg-black" style="padding-top: 56.25%">
      <!-- Loading overlay -->
      <Transition name="fade">
        <div v-if="iframeLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-[#06040f] z-10">
          <div class="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mb-4"></div>
          <p class="text-white/40 text-sm">Loading {{ currentServer.name }}…</p>
        </div>
      </Transition>

      <!-- Error overlay -->
      <div v-if="iframeError" class="absolute inset-0 flex flex-col items-center justify-center bg-[#06040f] z-10 gap-4 px-6 text-center">
        <div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
          <i class="fa-solid fa-triangle-exclamation text-red-400 text-xl"></i>
        </div>
        <div>
          <p class="text-white/80 font-medium">This server isn't available</p>
          <p class="text-white/40 text-sm mt-1">Try switching to another server below.</p>
        </div>
        <button
          class="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm hover:bg-red-500/30 transition"
          @click="showServerPanel = true; iframeError = false"
        >
          <i class="fa-solid fa-server mr-2 text-xs"></i>Switch Server
        </button>
      </div>

      <iframe
        :key="iframeKey"
        :src="embedUrl"
        class="absolute inset-0 w-full h-full border-0"
        allowfullscreen
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        referrerpolicy="origin"
        @load="onIframeLoad"
      ></iframe>
    </div>

    <!-- ── Controls Bar ─────────────────────────────────────────────────────── -->
    <div v-if="type === 'tv'" class="flex items-center justify-between gap-3 px-4 py-3 bg-[#0d0a1a] border-t border-white/8">
      <button
        class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/20 disabled:opacity-30"
        :disabled="season === 1 && episode === 1"
        @click="prevEpisode"
      >
        <i class="fa-solid fa-backward-step text-xs"></i> Prev Episode
      </button>

      <!-- Season selector -->
      <select
        v-model="season"
        class="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm focus:outline-none focus:border-red-500/50 cursor-pointer"
      >
        <option v-for="s in tvSeasons" :key="s.season_number" :value="s.season_number">
          Season {{ s.season_number }}
        </option>
      </select>

      <button
        class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/20"
        @click="nextEpisode"
      >
        Next Episode <i class="fa-solid fa-forward-step text-xs"></i>
      </button>
    </div>

    <!-- ── TV Episode List ─────────────────────────────────────────────────── -->
    <div v-if="type === 'tv'" class="bg-[#0a0812] border-t border-white/8">
      <button
        class="w-full flex items-center justify-between px-4 py-3 text-sm text-white/60 hover:text-white transition"
        @click="showEpisodes = !showEpisodes"
      >
        <span class="font-medium">Episodes — Season {{ season }}</span>
        <i :class="showEpisodes ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" class="text-xs"></i>
      </button>

      <Transition name="slide-down">
        <div v-if="showEpisodes" class="max-h-72 overflow-y-auto divide-y divide-white/5">
          <div v-if="episodesLoading" class="flex justify-center py-8">
            <div class="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
          </div>

          <div
            v-for="ep in episodes"
            :key="ep.id"
            class="flex items-start gap-3 px-4 py-3 cursor-pointer transition hover:bg-white/3"
            :class="ep.episode_number === episode ? 'bg-red-500/8 border-l-2 border-red-500' : ''"
            @click="selectEpisode(season, ep.episode_number)"
          >
            <!-- Thumbnail -->
            <div class="shrink-0 w-20 h-12 rounded-lg overflow-hidden bg-white/5 relative">
              <img
                v-if="ep.still_path"
                :src="`${IMG_BASE}w300${ep.still_path}`"
                :alt="ep.name"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <i class="fa-solid fa-film text-white/20 text-sm"></i>
              </div>
              <div
                v-if="ep.episode_number === episode"
                class="absolute inset-0 flex items-center justify-center bg-black/40"
              >
                <i class="fa-solid fa-play text-red-400 text-sm"></i>
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xs text-white/40 shrink-0">E{{ ep.episode_number }}</span>
                <p class="text-sm text-white/80 font-medium truncate">{{ ep.name }}</p>
                <span v-if="ep.episode_number === episode" class="text-[10px] text-red-400 shrink-0">▶ Now Playing</span>
              </div>
              <p class="text-xs text-white/35 mt-0.5 line-clamp-2">{{ ep.overview }}</p>
              <p v-if="ep.air_date" class="text-[10px] text-white/25 mt-1">{{ ep.air_date }}</p>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- ── Share Toast ──────────────────────────────────────────────────────── -->
    <Transition name="toast">
      <div
        v-if="shareToast"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a1530] border border-white/15 shadow-xl text-sm text-white/90"
      >
        <i class="fa-solid fa-check text-green-400 text-xs"></i>
        Link copied!
      </div>
    </Transition>

    <!-- ── Disclaimer ───────────────────────────────────────────────────────── -->
    <p class="text-[10px] text-white/20 text-center px-4 py-2 bg-[#0d0a1a] border-t border-white/5">
      Tazama does not host any files. Content is embedded from third-party services.
    </p>
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.2s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-8px); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }
</style>
