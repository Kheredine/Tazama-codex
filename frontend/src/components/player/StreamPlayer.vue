<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ALL_SERVERS, PRIMARY_SERVERS, BACKUP_SERVERS, getEmbedUrl } from '@/utils/servers'
import { SUBTITLE_LANGUAGES } from '@/utils/subtitles'
import { useWatchHistory } from '@/composables/useWatchHistory'

const props = defineProps({
  type:   { type: String, required: true },
  id:     { type: [String, Number], required: true },
  title:  { type: String, default: '' },
  poster: { type: String, default: '' },
})

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY
const IMG_BASE  = 'https://image.tmdb.org/t/p/'

const serverIndex  = ref(parseInt(localStorage.getItem('tazama_server') || '0'))
const subtitleLang = ref(localStorage.getItem('tazama_sub_lang') || 'en')

const showLangPanel   = ref(false)
const showServerPanel = ref(false)
const iframeLoading   = ref(true)
const iframeError     = ref(false)
const iframeKey       = ref(0)
const isFullscreen    = ref(false)
const shareToast      = ref(false)

const season          = ref(1)
const episode         = ref(1)
const tvSeasons       = ref([])
const episodes        = ref([])
const episodesLoading = ref(false)
const showEpisodes    = ref(true)

const { saveToStreamHistory } = useWatchHistory()

const currentServer  = computed(() => ALL_SERVERS[serverIndex.value] || ALL_SERVERS[0])
const currentEpisode = computed(() => episodes.value.find(e => e.episode_number === episode.value))
const episodeTitle   = computed(() => currentEpisode.value?.name || `Episode ${episode.value}`)
const subtitleLabel  = computed(() => SUBTITLE_LANGUAGES.find(l => l.code === subtitleLang.value)?.name || 'English')

const embedUrl = computed(() =>
  getEmbedUrl(currentServer.value, props.type, props.id, season.value, episode.value, subtitleLang.value)
)

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

const copyLink = () => {
  const url = window.location.href
  navigator.clipboard?.writeText(url).then(() => {
    shareToast.value = true
    setTimeout(() => { shareToast.value = false }, 2500)
  })
}

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

let loadTimer = null
const onIframeLoad = () => {
  clearTimeout(loadTimer)
  iframeLoading.value = false
}
const startLoadTimer = () => {
  clearTimeout(loadTimer)
  loadTimer = setTimeout(() => { iframeLoading.value = false }, 8000)
}

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
  <div
    class="stream-player overflow-hidden rounded-2xl"
    :class="isFullscreen
      ? 'fixed inset-0 z-50 rounded-none border-0 bg-black'
      : 'border border-[#7c3aed]/20 shadow-player'"
  >

    <!-- ── Player Header ──────────────────────────────────────────────────────── -->
    <div class="player-header flex items-center gap-2 px-4 py-3 border-b border-white/8">

      <!-- Title block — always gets remaining space -->
      <div class="flex-1 min-w-0">
        <p class="text-white/90 font-semibold text-sm leading-tight truncate">{{ title }}</p>
        <p v-if="type === 'tv'" class="text-[#a78bfa]/50 text-[11px] mt-0.5 truncate">
          S{{ season }} &middot; E{{ episode }} &middot; {{ episodeTitle }}
        </p>
      </div>

      <!-- Action buttons — icon-only on mobile, icon + label on sm+ -->
      <div class="flex items-center gap-1 shrink-0">

        <!-- Subtitle / Language -->
        <button
          class="ctrl-btn"
          :class="showLangPanel ? 'ctrl-btn--active' : 'ctrl-btn--idle'"
          @click="showLangPanel = !showLangPanel; showServerPanel = false"
          title="Subtitles & Language (L)"
        >
          <i class="fa-solid fa-globe text-[10px]"></i>
          <span class="hidden sm:inline max-w-[72px] truncate">{{ subtitleLabel }}</span>
        </button>

        <!-- Server -->
        <button
          class="ctrl-btn"
          :class="showServerPanel ? 'ctrl-btn--active' : 'ctrl-btn--idle'"
          @click="showServerPanel = !showServerPanel; showLangPanel = false"
          title="Switch Server (S)"
        >
          <i class="fa-solid fa-server text-[10px]"></i>
          <span class="hidden sm:inline max-w-[80px] truncate">{{ currentServer.name }}</span>
        </button>

        <!-- Share -->
        <button
          class="icon-btn"
          @click="copyLink"
          title="Copy link"
        >
          <i class="fa-solid fa-link text-[10px]"></i>
        </button>

        <!-- Fullscreen -->
        <button
          class="icon-btn"
          @click="isFullscreen = !isFullscreen"
          :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
        >
          <i :class="isFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'" class="text-[10px]"></i>
        </button>

      </div>
    </div>

    <!-- ── Subtitle / Language Panel ─────────────────────────────────────────── -->
    <Transition name="slide-down">
      <div v-if="showLangPanel" class="panel border-b border-white/8 px-4 py-4 space-y-3">

        <!-- Info note -->
        <div class="rounded-xl bg-white/3 border border-white/7 px-3 py-2.5 space-y-1.5 text-[11px] leading-relaxed">
          <p class="text-white/55">
            <span class="text-white/75 font-semibold">Sous-titres</span> — transmis via URL.
            Fonctionne de manière fiable avec <span class="text-[#a78bfa]">VidSrc To</span> (<code class="text-white/40">ds_lang</code>),
            <span class="text-[#a78bfa]">VidSrc Me</span> &amp; <span class="text-[#a78bfa]">MovieAPI</span> (<code class="text-white/40">sub_lang</code>).
          </p>
          <p class="text-white/35">
            <span class="text-white/55 font-semibold">Audio (VF)</span> — impossible à forcer depuis l'extérieur.
            Utilisez le sélecteur de piste audio intégré au lecteur si une version doublée est disponible.
          </p>
        </div>

        <!-- Warning when current server has no subtitle param -->
        <div
          v-if="!currentServer.subParam"
          class="flex items-start gap-2 rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-2.5"
        >
          <i class="fa-solid fa-triangle-exclamation text-amber-400/70 text-xs mt-0.5 shrink-0"></i>
          <p class="text-[11px] text-amber-200/55 leading-relaxed">
            <span class="font-semibold text-amber-200/75">{{ currentServer.name }}</span> ne prend pas en charge les sous-titres via URL.
            Passez sur VidSrc To ou VidSrc Me pour les sous-titres français.
          </p>
        </div>

        <p class="panel-label">Langue des sous-titres</p>
        <div class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 custom-scroll">
          <button
            v-for="lang in SUBTITLE_LANGUAGES"
            :key="lang.code"
            class="pill"
            :class="subtitleLang === lang.code ? 'pill--active' : 'pill--idle'"
            @click="setLanguage(lang.code)"
          >
            {{ lang.name }}
          </button>
        </div>

      </div>
    </Transition>

    <!-- ── Server Panel ───────────────────────────────────────────────────────── -->
    <Transition name="slide-down">
      <div v-if="showServerPanel" class="panel border-b border-white/8 px-4 py-4">
        <p class="text-[11px] text-white/25 mb-4">Having issues? Try switching servers below.</p>

        <p class="panel-label mb-2">Primary</p>
        <div class="flex flex-wrap gap-1.5 mb-4">
          <button
            v-for="(srv, idx) in PRIMARY_SERVERS"
            :key="srv.id"
            class="pill"
            :class="serverIndex === idx ? 'pill--active' : 'pill--idle'"
            @click="switchServer(idx)"
            :title="`Stream via ${srv.name}`"
          >
            {{ srv.name }}
          </button>
        </div>

        <p class="panel-label mb-2">Backup</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="(srv, idx) in BACKUP_SERVERS"
            :key="srv.id"
            class="pill"
            :class="serverIndex === PRIMARY_SERVERS.length + idx ? 'pill--active' : 'pill--idle'"
            @click="switchServer(PRIMARY_SERVERS.length + idx)"
            :title="`Stream via ${srv.name}`"
          >
            {{ srv.name }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- ── iframe Area ────────────────────────────────────────────────────────── -->
    <div class="relative w-full bg-black" style="padding-top: 56.25%">

      <!-- Loading overlay -->
      <Transition name="fade">
        <div v-if="iframeLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-[#06040f] z-10 gap-4">
          <div class="spinner"></div>
          <p class="text-white/25 text-xs tracking-widest uppercase">Loading {{ currentServer.name }}</p>
        </div>
      </Transition>

      <!-- Error overlay -->
      <div v-if="iframeError" class="absolute inset-0 flex flex-col items-center justify-center bg-[#06040f] z-10 gap-5 px-6 text-center">
        <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
          <i class="fa-solid fa-triangle-exclamation text-amber-400/70 text-xl"></i>
        </div>
        <div class="space-y-1">
          <p class="text-white/70 font-semibold text-sm">Server unavailable</p>
          <p class="text-white/30 text-xs">Switch to another source to continue watching.</p>
        </div>
        <button
          class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7c3aed]/20 border border-[#7c3aed]/35 text-[#a78bfa] text-sm font-medium hover:bg-[#7c3aed]/30 transition-all"
          @click="showServerPanel = true; iframeError = false"
        >
          <i class="fa-solid fa-server text-xs"></i> Switch Server
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

    <!-- ── Controls Bar (TV) ──────────────────────────────────────────────────── -->
    <div v-if="type === 'tv'" class="flex items-center justify-between gap-3 px-4 py-3 bg-[#0d0a1a] border-t border-white/8">
      <button
        class="nav-btn disabled:opacity-25 disabled:cursor-not-allowed"
        :disabled="season === 1 && episode === 1"
        @click="prevEpisode"
      >
        <i class="fa-solid fa-backward-step text-xs"></i>
        <span class="hidden sm:inline">Previous</span>
      </button>

      <select
        v-model="season"
        class="season-select"
      >
        <option
          v-for="s in tvSeasons"
          :key="s.season_number"
          :value="s.season_number"
          class="bg-[#0d0a1a]"
        >
          Season {{ s.season_number }}
        </option>
      </select>

      <button
        class="nav-btn"
        @click="nextEpisode"
      >
        <span class="hidden sm:inline">Next</span>
        <i class="fa-solid fa-forward-step text-xs"></i>
      </button>
    </div>

    <!-- ── TV Episode List ────────────────────────────────────────────────────── -->
    <div v-if="type === 'tv'" class="bg-[#0a0812] border-t border-white/8">

      <!-- Collapse toggle -->
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
            <!-- Thumbnail -->
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

            <!-- Episode info -->
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

    <!-- ── Share Toast ────────────────────────────────────────────────────────── -->
    <Transition name="toast">
      <div
        v-if="shareToast"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#130f24] border border-[#7c3aed]/30 shadow-toast text-sm text-white/85 whitespace-nowrap"
      >
        <i class="fa-solid fa-check text-[#a78bfa] text-xs"></i>
        Link copied to clipboard
      </div>
    </Transition>

    <!-- ── Disclaimer ─────────────────────────────────────────────────────────── -->
    <p class="text-[10px] text-white/15 text-center px-4 py-2 bg-[#0d0a1a] border-t border-white/5">
      Tazama does not host any files. Content is embedded from third-party services.
    </p>

  </div>
</template>

<style scoped>
/* ── Player shell ─────────────────────────────────────────────────────────── */
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
.panel {
  background: #0c0918;
}
.panel-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.28);
}

/* ── Control buttons (with label) ────────────────────────────────────────── */
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
.ctrl-btn--idle {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.45);
}
.ctrl-btn--idle:hover {
  background: rgba(124,58,237,0.1);
  border-color: rgba(124,58,237,0.25);
  color: rgba(255,255,255,0.85);
}
.ctrl-btn--active {
  background: rgba(124,58,237,0.18);
  border-color: rgba(124,58,237,0.4);
  color: #a78bfa;
}

/* ── Icon-only buttons ───────────────────────────────────────────────────── */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.35);
  transition: all 0.15s ease;
  cursor: pointer;
  flex-shrink: 0;
}
.icon-btn:hover {
  background: rgba(124,58,237,0.1);
  border-color: rgba(124,58,237,0.25);
  color: rgba(255,255,255,0.85);
}

/* ── Pill buttons (server / lang selectors) ──────────────────────────────── */
.pill {
  padding: 5px 11px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid transparent;
  transition: all 0.15s ease;
  cursor: pointer;
}
.pill--idle {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.45);
}
.pill--idle:hover {
  background: rgba(124,58,237,0.1);
  border-color: rgba(124,58,237,0.25);
  color: rgba(255,255,255,0.85);
}
.pill--active {
  background: rgba(124,58,237,0.2);
  border-color: rgba(124,58,237,0.42);
  color: #a78bfa;
}

/* ── Loading spinner ─────────────────────────────────────────────────────── */
.spinner {
  width: 36px;
  height: 36px;
  border: 2px solid rgba(124, 58, 237, 0.15);
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}
.spinner--sm {
  width: 20px;
  height: 20px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Nav buttons (prev/next episode) ─────────────────────────────────────── */
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
.nav-btn:not(:disabled):hover {
  background: rgba(124,58,237,0.12);
  border-color: rgba(124,58,237,0.28);
  color: rgba(255,255,255,0.9);
}

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
.season-select:focus {
  outline: none;
  border-color: rgba(124,58,237,0.45);
}

/* ── Episode row ─────────────────────────────────────────────────────────── */
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
.ep-row--active {
  background: rgba(124,58,237,0.07);
  border-left: 2px solid rgba(124,58,237,0.5);
  padding-left: 14px;
}

/* ── Episode thumbnail ───────────────────────────────────────────────────── */
.ep-thumb {
  flex-shrink: 0;
  width: 80px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255,255,255,0.05);
  position: relative;
}

/* ── Now playing badge ───────────────────────────────────────────────────── */
.now-playing-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #a78bfa;
  opacity: 0.9;
}

/* ── Custom scrollbar ────────────────────────────────────────────────────── */
.custom-scroll::-webkit-scrollbar { width: 3px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb {
  background: rgba(124,58,237,0.3);
  border-radius: 99px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(124,58,237,0.55);
}

/* ── Transitions ─────────────────────────────────────────────────────────── */
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.2s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-6px); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.toast-enter-active, .toast-leave-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }
</style>
