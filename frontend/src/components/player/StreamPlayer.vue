<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  ALL_SERVERS, PROVIDER_CATEGORIES, getEmbedUrl, getServerIndex,
  VIDSRC_SERVERS, EMBED_SERVERS, LYNX_SERVERS, DIRECT_SERVERS, MULTI_SERVERS, ANIME_FR_SERVERS,
} from '@/utils/servers'
import { useWatchHistory } from '@/composables/useWatchHistory'

const props = defineProps({
  type:          { type: String, required: true },
  id:            { type: [String, Number], required: true },
  title:         { type: String, default: '' },
  poster:        { type: String, default: '' },
  resumeSeason:  { type: Number, default: null },
  resumeEpisode: { type: Number, default: null },
  resumeTime:    { type: Number, default: 0 },
})

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY
const IMG_BASE  = 'https://image.tmdb.org/t/p/'

// ── Server state ───────────────────────────────────────────────────────────────
const DEFAULT_SERVER = getServerIndex('vidsrc-to') // VidSrc To has better TMDB coverage than Pro
const serverIndex    = ref(parseInt(localStorage.getItem('tazama_server') ?? String(DEFAULT_SERVER)))
const audioFilter    = ref(localStorage.getItem('tazama_audio_filter') || 'all') // 'all' | 'vf' | 'vostfr'
const autoFallback   = ref(localStorage.getItem('tazama_auto_fallback') !== 'false')
const showServerPanel = ref(false)

// ── Collapsible category state ────────────────────────────────────────────────
const COLLAPSED_BY_DEFAULT = new Set(['lynx', 'direct', 'multi'])
const openCats = ref(Object.fromEntries(
  PROVIDER_CATEGORIES.map(c => [c.id, !COLLAPSED_BY_DEFAULT.has(c.id)])
))
const toggleCat = (id) => { openCats.value[id] = !openCats.value[id] }

// ── iframe state ───────────────────────────────────────────────────────────────
const iframeLoading      = ref(true)
const iframeError        = ref(false)
const iframeKey          = ref(0)
const isFullscreen       = ref(false)
const shareToast         = ref(false)
const fallbackToast      = ref(false)
const showResumeOverlay  = ref(false)

const formatResumeTime = (s) => {
  if (!s || s < 10) return null
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

let resumeOverlayTimer = null

// ── Fullscreen (native API) ────────────────────────────────────────────────────
// We fullscreen only the video wrapper div so header/UI stays outside.
const videoWrap = ref(null)

const toggleFullscreen = () => {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement
  if (fsEl) {
    ;(document.exitFullscreen || document.webkitExitFullscreen).call(document)
  } else {
    const el = videoWrap.value
    if (!el) return
    ;(el.requestFullscreen || el.webkitRequestFullscreen).call(el)
  }
}

const onFullscreenChange = () => {
  isFullscreen.value = !!(document.fullscreenElement || document.webkitFullscreenElement)
}

// ── TV state ───────────────────────────────────────────────────────────────────
const season          = ref(props.resumeSeason  || 1)
const episode         = ref(props.resumeEpisode || 1)
const tvSeasons       = ref([])
const episodes        = ref([])
const episodesLoading = ref(false)
const showEpisodes    = ref(true)

const { saveToStreamHistory } = useWatchHistory()

// ── Derived ────────────────────────────────────────────────────────────────────
const currentServer  = computed(() => ALL_SERVERS[serverIndex.value] || ALL_SERVERS[0])
const currentEpisode = computed(() => episodes.value.find(e => e.episode_number === episode.value))
const episodeTitle   = computed(() => currentEpisode.value?.name || `Episode ${episode.value}`)

const langParam = computed(() => audioFilter.value === 'all' ? 'en' : 'fr')

const embedUrl = computed(() =>
  getEmbedUrl(currentServer.value, props.type, props.id, season.value, episode.value, langParam.value)
)

// ── Filtered server list per category ─────────────────────────────────────────
const filteredByAudio = (servers) => {
  if (audioFilter.value === 'all') return servers
  return servers.filter(s =>
    s.audioMode === audioFilter.value || s.audioMode === 'multi'
  )
}

const catServers = (categoryId) => {
  const map = {
    vidsrc: VIDSRC_SERVERS,
    embed:  EMBED_SERVERS,
    lynx:   LYNX_SERVERS,
    direct: DIRECT_SERVERS,
    multi:  MULTI_SERVERS,
    anime:  ANIME_FR_SERVERS,
  }
  return filteredByAudio(map[categoryId] || [])
}

const globalIndexOf = (server) => ALL_SERVERS.indexOf(server)

// ── TV data ────────────────────────────────────────────────────────────────────
const fetchTvDetails = async () => {
  if (props.type !== 'tv') return
  try {
    const res  = await fetch(`https://api.themoviedb.org/3/tv/${props.id}?api_key=${TMDB_KEY}`)
    const data = await res.json()
    tvSeasons.value = (data.seasons || []).filter(s => s.season_number > 0)
    await fetchEpisodes(season.value)
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

// ── Server switching ───────────────────────────────────────────────────────────
const switchServer = (idx) => {
  serverIndex.value = idx
  localStorage.setItem('tazama_server', String(idx))
  reloadIframe()
  showServerPanel.value = false
}

const tryNextServer = () => {
  const next = serverIndex.value + 1
  if (next < ALL_SERVERS.length) {
    serverIndex.value = next
    localStorage.setItem('tazama_server', String(next))
    fallbackToast.value = true
    setTimeout(() => { fallbackToast.value = false }, 3000)
    reloadIframe()
  }
}

const setAudioFilter = (val) => {
  audioFilter.value = val
  localStorage.setItem('tazama_audio_filter', val)
}

const toggleAutoFallback = () => {
  autoFallback.value = !autoFallback.value
  localStorage.setItem('tazama_auto_fallback', String(autoFallback.value))
}

// ── Elapsed watch-time tracking ────────────────────────────────────────────────
// The player is a cross-origin iframe so we can't read video.currentTime.
// We measure wall-clock seconds while the tab is visible and the iframe is
// loaded, then store that as the resume offset.
const trackingStart = ref(null)              // Date.now() of the current segment
const trackingAcc   = ref(props.resumeTime)  // seed from saved position so elapsed continues correctly

const getElapsedSeconds = () => {
  let s = trackingAcc.value
  if (trackingStart.value) s += Math.floor((Date.now() - trackingStart.value) / 1000)
  return s
}
const startTracking = () => {
  if (!trackingStart.value) trackingStart.value = Date.now()
}
const pauseTracking = () => {
  if (!trackingStart.value) return
  trackingAcc.value += Math.floor((Date.now() - trackingStart.value) / 1000)
  trackingStart.value = null
}
const resetTracking = () => {
  trackingStart.value = null
  trackingAcc.value   = 0
}
const onVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    pauseTracking()
    persistHistory()
  } else if (!iframeLoading.value && !iframeError.value) {
    startTracking()
  }
}

let autosaveTimer = null
const startAutosave = () => {
  clearInterval(autosaveTimer)
  autosaveTimer = setInterval(() => {
    if (!iframeLoading.value && !iframeError.value) persistHistory()
  }, 30_000)
}

// ── iframe lifecycle ───────────────────────────────────────────────────────────
const reloadIframe = () => {
  resetTracking()
  clearTimeout(resumeOverlayTimer)
  showResumeOverlay.value = false
  iframeLoading.value = true
  iframeError.value   = false
  iframeKey.value++
}

let loadTimer = null
const onIframeLoad = () => {
  clearTimeout(loadTimer)
  iframeLoading.value = false
  if (props.resumeTime > 10 && !showResumeOverlay.value) {
    showResumeOverlay.value = true
    resumeOverlayTimer = setTimeout(() => { showResumeOverlay.value = false }, 9000)
  }
  startTracking()
  startAutosave()
  persistHistory()
}
const startLoadTimer = () => {
  clearTimeout(loadTimer)
  // After 15 s without a load event, treat as a soft error
  loadTimer = setTimeout(() => {
    iframeLoading.value = false
    if (autoFallback.value) tryNextServer()
  }, 15000)
}

const onIframeError = () => {
  clearTimeout(loadTimer)
  iframeLoading.value = false
  iframeError.value   = true
  if (autoFallback.value) tryNextServer()
}

// ── Episode controls ───────────────────────────────────────────────────────────
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

// ── Sharing ────────────────────────────────────────────────────────────────────
const copyLink = () => {
  navigator.clipboard?.writeText(window.location.href).then(() => {
    shareToast.value = true
    setTimeout(() => { shareToast.value = false }, 2500)
  })
}

// ── History ────────────────────────────────────────────────────────────────────
const persistHistory = () => {
  saveToStreamHistory({
    id:          Number(props.id),
    type:        props.type,
    title:       props.title,
    poster:      props.poster,
    season:      season.value,
    episode:     episode.value,
    serverIndex: serverIndex.value,
    resumeTime:  getElapsedSeconds(),
  })
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────
const onKey = (e) => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
  if (e.key === 'ArrowLeft'  && props.type === 'tv') { prevEpisode(); e.preventDefault() }
  if (e.key === 'ArrowRight' && props.type === 'tv') { nextEpisode(); e.preventDefault() }
  if (e.key === 's' || e.key === 'S') showServerPanel.value = !showServerPanel.value
  if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); e.preventDefault() }
}

// ── Watchers & lifecycle ───────────────────────────────────────────────────────
watch(season, async (s) => {
  await fetchEpisodes(s)
  episode.value = 1
  reloadIframe()
})

watch(embedUrl, () => { startLoadTimer() })

onMounted(() => {
  fetchTvDetails()
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisibilityChange)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  startLoadTimer()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    ;(document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
  }
  clearTimeout(loadTimer)
  clearTimeout(resumeOverlayTimer)
  clearInterval(autosaveTimer)
  pauseTracking()
  persistHistory()
})
</script>

<template>
  <div class="stream-player overflow-hidden rounded-2xl border border-[#7c3aed]/20 shadow-player">

    <!-- ── Player Header ─────────────────────────────────────────────────────── -->
    <div class="player-header flex items-center gap-2 px-4 py-3 border-b border-white/8">

      <div class="flex-1 min-w-0">
        <p class="text-white/90 font-semibold text-sm leading-tight truncate">{{ title }}</p>
        <p v-if="type === 'tv'" class="text-[#a78bfa]/50 text-[11px] mt-0.5 truncate">
          S{{ season }} &middot; E{{ episode }} &middot; {{ episodeTitle }}
        </p>
      </div>

      <div class="flex items-center gap-1 shrink-0">

        <!-- Server selector -->
        <button
          class="ctrl-btn"
          :class="showServerPanel ? 'ctrl-btn--active' : 'ctrl-btn--idle'"
          @click="showServerPanel = !showServerPanel"
          title="Switch Server (S)"
        >
          <i class="fa-solid fa-server text-[10px]"></i>
          <span class="hidden sm:inline max-w-[80px] truncate">{{ currentServer.name }}</span>
        </button>

        <!-- Share -->
        <button class="icon-btn" @click="copyLink" title="Copy link">
          <i class="fa-solid fa-link text-[10px]"></i>
        </button>

        <!-- Fullscreen -->
        <button
          class="icon-btn"
          @click="toggleFullscreen"
          :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
        >
          <i :class="isFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'" class="text-[10px]"></i>
        </button>

      </div>
    </div>

    <!-- ── Server Panel ──────────────────────────────────────────────────────── -->
    <Transition name="slide-down">
      <div v-if="showServerPanel" class="panel border-b border-white/8 px-4 py-4 space-y-4">

        <!-- Top row: hint + controls -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-[11px] text-white/30">Having issues? Try a different server below.</p>

          <!-- Auto-fallback toggle -->
          <button
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition"
            :class="autoFallback
              ? 'bg-purple-500/15 border-purple-500/35 text-purple-300'
              : 'bg-white/4 border-white/10 text-white/40'"
            @click="toggleAutoFallback"
            title="When enabled, automatically tries the next server if the current one fails"
          >
            <i class="fa-solid fa-rotate text-[9px]"></i>
            Auto-fallback {{ autoFallback ? 'ON' : 'OFF' }}
          </button>
        </div>

        <!-- Audio / Language filter -->
        <div>
          <p class="panel-label mb-2">Audio / Subtitles</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="opt in [
                { val: 'all',    label: 'All Sources' },
                { val: 'vf',     label: '🇫🇷 VF (Doublé)' },
                { val: 'vostfr', label: '🇫🇷 VOSTFR' },
              ]"
              :key="opt.val"
              class="pill"
              :class="audioFilter === opt.val ? 'pill--active' : 'pill--idle'"
              @click="setAudioFilter(opt.val)"
            >{{ opt.label }}</button>
          </div>
        </div>

        <!-- Category sections -->
        <div
          v-for="cat in PROVIDER_CATEGORIES"
          :key="cat.id"
          class="space-y-2"
        >
          <!-- Category header (collapsible) -->
          <button
            class="w-full flex items-center justify-between group"
            @click="toggleCat(cat.id)"
          >
            <div class="flex items-center gap-2">
              <i :class="`fa-solid ${cat.icon}`" class="text-[10px] text-white/30"></i>
              <span class="panel-label">{{ cat.label }}</span>
              <span class="text-[9px] text-white/20 ml-1">{{ catServers(cat.id).length }}</span>
            </div>
            <i
              :class="openCats[cat.id] ? 'fa-chevron-up' : 'fa-chevron-down'"
              class="fa-solid text-[9px] text-white/20 group-hover:text-white/50 transition-colors"
            ></i>
          </button>

          <!-- Server pills -->
          <Transition name="slide-down">
            <div v-if="openCats[cat.id]" class="flex flex-wrap gap-1.5">
              <template v-if="catServers(cat.id).length">
                <button
                  v-for="srv in catServers(cat.id)"
                  :key="srv.id"
                  class="pill relative"
                  :class="serverIndex === globalIndexOf(srv) ? 'pill--active' : 'pill--idle'"
                  @click="switchServer(globalIndexOf(srv))"
                  :title="srv.requiresFileId ? `${srv.name} — may require direct file ID` : `Stream via ${srv.name}`"
                >
                  {{ srv.name }}
                  <!-- dot indicator for active server -->
                  <span
                    v-if="serverIndex === globalIndexOf(srv)"
                    class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-purple-400"
                  ></span>
                  <!-- warning dot for requiresFileId providers -->
                  <span
                    v-else-if="srv.requiresFileId"
                    class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500/60"
                    title="May need direct file ID"
                  ></span>
                </button>
              </template>
              <p v-else class="text-[11px] text-white/20 italic">
                No servers match current filter.
              </p>
            </div>
          </Transition>
        </div>

        <!-- Legend -->
        <div class="flex flex-wrap items-center gap-4 pt-1 border-t border-white/5">
          <div class="flex items-center gap-1.5 text-[10px] text-white/25">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block"></span>
            Currently active
          </div>
          <div class="flex items-center gap-1.5 text-[10px] text-white/25">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500/60 inline-block"></span>
            May require direct link
          </div>
        </div>

      </div>
    </Transition>

    <!-- ── iframe Area ───────────────────────────────────────────────────────── -->
    <div ref="videoWrap" class="video-wrap relative w-full bg-black" style="padding-top: 56.25%">

      <!-- Loading overlay -->
      <Transition name="fade">
        <div v-if="iframeLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-[#06040f] z-10 gap-4">
          <div class="spinner"></div>
          <p class="text-white/25 text-xs tracking-widest uppercase">Loading {{ currentServer.name }}</p>
        </div>
      </Transition>

      <!-- Error overlay -->
      <div v-if="iframeError && !iframeLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-[#06040f] z-10 gap-5 px-6 text-center">
        <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
          <i class="fa-solid fa-triangle-exclamation text-amber-400/70 text-xl"></i>
        </div>
        <div class="space-y-1">
          <p class="text-white/70 font-semibold text-sm">Server unavailable</p>
          <p class="text-white/30 text-xs">{{ currentServer.name }} could not load. Switch to another source.</p>
        </div>
        <div class="flex gap-2">
          <button
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7c3aed]/20 border border-[#7c3aed]/35 text-[#a78bfa] text-sm font-medium hover:bg-[#7c3aed]/30 transition-all"
            @click="tryNextServer"
          >
            <i class="fa-solid fa-forward-step text-xs"></i> Try Next
          </button>
          <button
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-medium hover:bg-white/8 transition-all"
            @click="showServerPanel = true; iframeError = false"
          >
            <i class="fa-solid fa-server text-xs"></i> Pick Server
          </button>
        </div>
      </div>

      <iframe
        :key="iframeKey"
        :src="embedUrl"
        class="absolute inset-0 w-full h-full border-0"
        allowfullscreen
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        referrerpolicy="origin"
        @load="onIframeLoad"
        @error="onIframeError"
      ></iframe>

      <!-- Resume-position overlay -->
      <Transition name="fade">
        <div
          v-if="showResumeOverlay && formatResumeTime(props.resumeTime)"
          class="absolute bottom-4 left-4 z-20 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/90 select-none"
          style="background: rgba(10,6,21,0.88); backdrop-filter: blur(8px);"
        >
          <i class="fa-solid fa-rotate-right text-purple-400 text-xs shrink-0"></i>
          <span>Last watched at <strong class="text-white">{{ formatResumeTime(props.resumeTime) }}</strong> — seek to resume</span>
          <button
            class="ml-1 shrink-0 text-white/35 hover:text-white/80 transition"
            @click="showResumeOverlay = false"
          >
            <i class="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>
      </Transition>

      <!-- Fullscreen overlay button (always reachable above the iframe) -->
      <button
        v-if="!iframeLoading && !iframeError"
        class="video-fs-btn absolute bottom-3 right-3 z-20 w-9 h-9 flex items-center justify-center rounded-lg transition-all"
        @click.stop="toggleFullscreen"
        :title="isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'"
      >
        <i :class="isFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'" class="text-white text-sm"></i>
      </button>
    </div>

    <!-- ── "Not loading?" helper bar ──────────────────────────────────────────── -->
    <div
      v-if="!iframeLoading && !iframeError"
      class="flex items-center justify-between gap-3 px-4 py-2 bg-[#080613] border-t border-white/5"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span v-if="currentServer.requiresFileId" class="flex items-center gap-1.5 text-[10px] text-amber-400/60">
          <i class="fa-solid fa-triangle-exclamation text-[9px]"></i>
          <span class="truncate">{{ currentServer.name }} may need a direct file link — try another server if it shows an error.</span>
        </span>
        <span v-else class="text-[10px] text-white/20">Seeing a 404 or blank screen? Switch to another server.</span>
      </div>
      <button
        class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/4 border border-white/8 text-white/40 hover:text-white/80 hover:bg-[#7c3aed]/10 hover:border-[#7c3aed]/25 text-[11px] font-medium transition-all"
        @click="tryNextServer"
      >
        <i class="fa-solid fa-forward-step text-[9px]"></i>
        Try Next
      </button>
    </div>

    <!-- ── Controls Bar (TV) ─────────────────────────────────────────────────── -->
    <div v-if="type === 'tv'" class="flex items-center justify-between gap-3 px-4 py-3 bg-[#0d0a1a] border-t border-white/8">
      <button
        class="nav-btn disabled:opacity-25 disabled:cursor-not-allowed"
        :disabled="season === 1 && episode === 1"
        @click="prevEpisode"
      >
        <i class="fa-solid fa-backward-step text-xs"></i>
        <span class="hidden sm:inline">Previous</span>
      </button>

      <select v-model="season" class="season-select">
        <option
          v-for="s in tvSeasons"
          :key="s.season_number"
          :value="s.season_number"
          class="bg-[#0d0a1a]"
        >Season {{ s.season_number }}</option>
      </select>

      <button class="nav-btn" @click="nextEpisode">
        <span class="hidden sm:inline">Next</span>
        <i class="fa-solid fa-forward-step text-xs"></i>
      </button>
    </div>

    <!-- ── TV Episode List ───────────────────────────────────────────────────── -->
    <div v-if="type === 'tv'" class="bg-[#0a0812] border-t border-white/8">

      <button
        class="w-full flex items-center justify-between px-4 py-3 text-white/40 hover:text-white/70 transition-colors"
        @click="showEpisodes = !showEpisodes"
      >
        <span class="text-[10px] font-bold uppercase tracking-widest">Season {{ season }} · Episodes</span>
        <i :class="showEpisodes ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" class="text-[10px]"></i>
      </button>

      <Transition name="slide-down">
        <div v-if="showEpisodes" class="max-h-72 overflow-y-auto custom-scroll">

          <div v-if="episodesLoading" class="flex justify-center py-8">
            <div class="spinner spinner--sm"></div>
          </div>

          <div
            v-for="ep in episodes"
            :key="ep.id"
            class="ep-row"
            :class="ep.episode_number === episode ? 'ep-row--active' : ''"
            @click="selectEpisode(season, ep.episode_number)"
          >
            <div class="ep-thumb">
              <img
                v-if="ep.still_path"
                :src="`${IMG_BASE}w300${ep.still_path}`"
                :alt="ep.name"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <i class="fa-solid fa-film text-white/15 text-sm"></i>
              </div>
              <div
                v-if="ep.episode_number === episode"
                class="absolute inset-0 flex items-center justify-center bg-black/50"
              >
                <i class="fa-solid fa-play text-[#a78bfa] text-xs drop-shadow"></i>
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-2 mb-0.5">
                <span class="text-[10px] text-white/25 font-mono shrink-0">{{ String(ep.episode_number).padStart(2, '0') }}</span>
                <p class="text-sm text-white/75 font-medium truncate leading-tight">{{ ep.name }}</p>
                <span v-if="ep.episode_number === episode" class="now-playing-badge shrink-0">▶ Now Playing</span>
              </div>
              <p class="text-[11px] text-white/25 line-clamp-2 leading-relaxed">{{ ep.overview }}</p>
            </div>
          </div>

        </div>
      </Transition>
    </div>

    <!-- ── Share Toast ───────────────────────────────────────────────────────── -->
    <Transition name="toast">
      <div
        v-if="shareToast"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#130f24] border border-[#7c3aed]/30 shadow-toast text-sm text-white/85 whitespace-nowrap"
      >
        <i class="fa-solid fa-check text-[#a78bfa] text-xs"></i>
        Link copied to clipboard
      </div>
    </Transition>

    <!-- ── Fallback Toast ─────────────────────────────────────────────────────── -->
    <Transition name="toast">
      <div
        v-if="fallbackToast"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#130f24] border border-amber-500/30 shadow-toast text-sm text-amber-200/80 whitespace-nowrap"
      >
        <i class="fa-solid fa-rotate text-amber-400 text-xs"></i>
        Switching to {{ currentServer.name }}…
      </div>
    </Transition>

    <!-- ── Disclaimer ────────────────────────────────────────────────────────── -->
    <p class="text-[10px] text-white/15 text-center px-4 py-2 bg-[#0d0a1a] border-t border-white/5">
      Tazama does not host any files. Content is embedded from third-party services.
    </p>

  </div>
</template>

<style scoped>
/* ── Player shell ──────────────────────────────────────────────────────────── */
.shadow-player {
  box-shadow:
    0 0 0 1px rgba(124, 58, 237, 0.12),
    0 8px 40px rgba(0, 0, 0, 0.6),
    0 0 60px rgba(124, 58, 237, 0.04);
}
.shadow-toast {
  box-shadow: 0 8px 32px rgba(124, 58, 237, 0.25), 0 2px 8px rgba(0,0,0,0.5);
}

/* ── Header background ───────────────────────────────────────────────────── */
.player-header {
  background: linear-gradient(135deg, #0e0b1c 0%, #110d20 100%);
}

/* ── Panels ──────────────────────────────────────────────────────────────── */
.panel { background: #0c0918; }
.panel-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.28);
}

/* ── Control buttons ─────────────────────────────────────────────────────── */
.ctrl-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid transparent;
  transition: all 0.15s ease;
  cursor: pointer;
  white-space: nowrap;
}
.ctrl-btn--idle  { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); color: rgba(255,255,255,0.45); }
.ctrl-btn--idle:hover { background: rgba(124,58,237,0.1); border-color: rgba(124,58,237,0.25); color: rgba(255,255,255,0.85); }
.ctrl-btn--active { background: rgba(124,58,237,0.18); border-color: rgba(124,58,237,0.4); color: #a78bfa; }

/* ── Icon buttons ────────────────────────────────────────────────────────── */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px; height: 30px;
  border-radius: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.35);
  transition: all 0.15s ease;
  cursor: pointer;
  flex-shrink: 0;
}
.icon-btn:hover { background: rgba(124,58,237,0.1); border-color: rgba(124,58,237,0.25); color: rgba(255,255,255,0.85); }

/* ── Pills ───────────────────────────────────────────────────────────────── */
.pill {
  position: relative;
  padding: 5px 11px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid transparent;
  transition: all 0.15s ease;
  cursor: pointer;
}
.pill--idle  { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.07); color: rgba(255,255,255,0.45); }
.pill--idle:hover { background: rgba(124,58,237,0.1); border-color: rgba(124,58,237,0.25); color: rgba(255,255,255,0.85); }
.pill--active { background: rgba(124,58,237,0.2); border-color: rgba(124,58,237,0.42); color: #a78bfa; }

/* ── Spinner ─────────────────────────────────────────────────────────────── */
.spinner {
  width: 36px; height: 36px;
  border: 2px solid rgba(124, 58, 237, 0.15);
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}
.spinner--sm { width: 20px; height: 20px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Nav buttons ─────────────────────────────────────────────────────────── */
.nav-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  color: rgba(255,255,255,0.5);
  transition: all 0.15s ease;
  cursor: pointer;
}
.nav-btn:not(:disabled):hover { background: rgba(124,58,237,0.12); border-color: rgba(124,58,237,0.28); color: rgba(255,255,255,0.9); }

/* ── Season select ───────────────────────────────────────────────────────── */
.season-select {
  padding: 7px 14px;
  border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  color: rgba(255,255,255,0.7);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s ease;
  appearance: none;
  text-align: center;
}
.season-select:focus { outline: none; border-color: rgba(124,58,237,0.45); }

/* ── Episode rows ────────────────────────────────────────────────────────── */
.ep-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.12s ease;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.ep-row:last-child { border-bottom: none; }
.ep-row:not(.ep-row--active):hover { background: rgba(255,255,255,0.025); }
.ep-row--active { background: rgba(124,58,237,0.07); border-left: 2px solid rgba(124,58,237,0.5); padding-left: 14px; }

.ep-thumb {
  flex-shrink: 0;
  width: 80px; height: 48px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255,255,255,0.05);
  position: relative;
}

.now-playing-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #a78bfa;
  opacity: 0.9;
}

/* ── Scrollbar ───────────────────────────────────────────────────────────── */
.custom-scroll::-webkit-scrollbar { width: 3px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.3); border-radius: 99px; }
.custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.55); }

/* ── Transitions ─────────────────────────────────────────────────────────── */
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.2s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-6px); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.toast-enter-active, .toast-leave-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }

/* ── Fullscreen overlay button ───────────────────────────────────────────── */
.video-fs-btn {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.12);
  opacity: 0.55;
  backdrop-filter: blur(4px);
}
.video-fs-btn:hover {
  opacity: 1;
  background: rgba(124, 58, 237, 0.55);
  border-color: rgba(124, 58, 237, 0.6);
}

/* ── Native fullscreen: video wrapper fills the entire screen ─────────────── */
.video-wrap:fullscreen,
.video-wrap:-webkit-full-screen {
  padding-top: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  background: #000 !important;
}
</style>
