<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserLibrary } from '@/composables/useUserLibrary'
import { useUserPreferences } from '@/composables/useUserPreferences'
import { useI18n } from '@/composables/useI18n'
import { useAuth } from '@/composables/useAuth'
import StreamPlayer from '@/components/player/StreamPlayer.vue'
import TrailerModal from '@/components/player/TrailerModal.vue'
import SimilarTitles from '@/components/player/SimilarTitles.vue'

const route  = useRoute()
const router = useRouter()
const { isInWatchlist, isWatched, isLiked, toggleWatchlist, toggleWatched, toggleLike } = useUserLibrary()
const { recordDisliked, isDisliked } = useUserPreferences()
const { t, lang } = useI18n()
const { apiFetch } = useAuth()

const TMDB_KEY  = import.meta.env.VITE_TMDB_API_KEY
const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE  = 'https://image.tmdb.org/t/p/'

const media    = ref(null)
const loading  = ref(true)
const error    = ref(null)
const activeTab = ref('stream')
const notForMeConfirm = ref(false)
const notForMeDone    = ref(false)
const showPlaylistModal = ref(false)
const showTrailerModal  = ref(false)
const playlists = ref([])
const playlistsLoading = ref(false)
const playlistsLoaded = ref(false)
const playlistActionLoading = ref(false)
const playlistCreateLoading = ref(false)
const playlistFeedback = ref(null)
const playlistCreateFormVisible = ref(false)
const playlistCreateError = ref('')
const newPlaylist = ref({
  title: '',
  description: '',
  tagsInput: '',
})

const type = route.params.type   // 'movie' | 'tv'
const id   = route.params.id

// Direct platform URLs by TMDB provider_id
const PLATFORM_URLS = {
  8:   (t) => `https://www.netflix.com/search?q=${encodeURIComponent(t)}`,
  9:   (t) => `https://www.amazon.com/gp/video/search?phrase=${encodeURIComponent(t)}`,
  10:  (t) => `https://www.amazon.com/gp/video/search?phrase=${encodeURIComponent(t)}`,
  337: (t) => `https://www.disneyplus.com/search/${encodeURIComponent(t)}`,
  283: (t) => `https://www.crunchyroll.com/search?q=${encodeURIComponent(t)}`,
  384: (t) => `https://www.max.com/search?q=${encodeURIComponent(t)}`,
  350: (t) => `https://tv.apple.com/search?term=${encodeURIComponent(t)}`,
  531: (t) => `https://www.paramountplus.com/search/?query=${encodeURIComponent(t)}`,
  386: (t) => `https://www.peacocktv.com/search?q=${encodeURIComponent(t)}`,
  387: (t) => `https://www.hulu.com/search?q=${encodeURIComponent(t)}`,
}

const getPlatformUrl = (provider, titleStr, fallbackLink) => {
  const fn = PLATFORM_URLS[provider.provider_id]
  return fn ? fn(titleStr) : (fallbackLink || `https://www.justwatch.com/us/search?q=${encodeURIComponent(titleStr)}`)
}

onMounted(async () => {
  try {
    const res = await fetch(
      `${TMDB_BASE}/${type}/${id}?api_key=${TMDB_KEY}&append_to_response=credits,videos,watch/providers`
    )
    if (!res.ok) throw new Error('Not found')
    media.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const title     = computed(() => media.value?.title || media.value?.name || '')
const year      = computed(() => (media.value?.release_date || media.value?.first_air_date || '').split('-')[0])

const releaseDate = computed(() => media.value?.release_date || media.value?.first_air_date || null)
const isUpcoming  = computed(() => releaseDate.value ? new Date(releaseDate.value) > new Date() : false)
const formattedReleaseDate = computed(() => {
  if (!releaseDate.value) return ''
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(releaseDate.value))
})
const overview  = computed(() => media.value?.overview || '')
const backdrop  = computed(() => media.value?.backdrop_path ? `${IMG_BASE}w1280${media.value.backdrop_path}` : null)
const poster    = computed(() => media.value?.poster_path   ? `${IMG_BASE}w500${media.value.poster_path}`   : null)
const rating    = computed(() => media.value?.vote_average?.toFixed(1))
const runtime   = computed(() => {
  if (type === 'movie') {
    const m = media.value?.runtime
    return m ? `${Math.floor(m/60)}h ${m%60}m` : ''
  }
  return media.value?.number_of_seasons ? `${media.value.number_of_seasons} season(s)` : ''
})

const director   = computed(() => {
  if (type === 'movie') return media.value?.credits?.crew?.find(c => c.job === 'Director')?.name
  return null
})
const creators   = computed(() => media.value?.created_by?.map(c => c.name).join(', '))
const cast       = computed(() => media.value?.credits?.cast?.slice(0, 8) || [])

const trailer    = computed(() => {
  const vids = media.value?.videos?.results || []
  return vids.find(v => v.type === 'Trailer' && v.site === 'YouTube')
    || vids.find(v => v.site === 'YouTube')
})

// Country of origin
const countries  = computed(() => {
  return (media.value?.production_countries || media.value?.origin_country || [])
    .map(c => typeof c === 'string' ? c : c.name)
    .slice(0, 3)
    .join(', ')
})

// All regions for watch providers (show all, not just US)
const allProviders = computed(() => media.value?.['watch/providers']?.results || {})

// Primary region: user locale → fallback to US → fallback to first available
const userRegion = computed(() => {
  const locale = navigator.language || 'en-US'
  const cc     = locale.split('-')[1] || 'US'
  const results = allProviders.value
  if (results[cc]) return { code: cc, data: results[cc], isLocal: true }
  if (results['US']) return { code: 'US', data: results['US'], isLocal: false }
  const firstKey = Object.keys(results)[0]
  if (firstKey) return { code: firstKey, data: results[firstKey], isLocal: false }
  return null
})

const providers  = computed(() => userRegion.value?.data || {})
const regionCode = computed(() => userRegion.value?.code || 'US')
const isLocalRegion = computed(() => userRegion.value?.isLocal ?? false)
const hasAnyProviders = computed(() => Object.keys(allProviders.value).length > 0)

const streamList = computed(() => providers.value?.flatrate || [])
const rentList   = computed(() => providers.value?.rent     || [])
const buyList    = computed(() => providers.value?.buy      || [])
const jwLink     = computed(() => providers.value?.link     || '')

const libItem = computed(() => ({ id: Number(id), type, title: title.value, poster: poster.value, year: year.value }))
const playlistPayload = computed(() => ({
  tmdb_id: Number(id),
  media_type: type,
  title: title.value,
  poster_path: media.value?.poster_path || null,
  year: year.value || null,
}))

// Not for me
const handleNotForMe = () => {
  if (!notForMeConfirm.value) {
    notForMeConfirm.value = true
    return
  }
  recordDisliked(libItem.value)
  notForMeDone.value   = true
  notForMeConfirm.value = false
  setTimeout(() => router.back(), 1500)
}

const loadPlaylists = async () => {
  playlistsLoading.value = true
  playlistFeedback.value = null
  try {
    const data = await apiFetch('/api/playlists')
    playlists.value = data.playlists || []
    playlistsLoaded.value = true
  } catch (err) {
    playlistFeedback.value = {
      type: 'error',
      message: err.message || 'Could not load your playlists.',
      hint: 'Refresh the page or try again in a moment.',
    }
  } finally {
    playlistsLoading.value = false
  }
}

const openPlaylistModal = async () => {
  showPlaylistModal.value = true
  if (!playlistsLoaded.value) await loadPlaylists()
}

const resetPlaylistCreateForm = () => {
  newPlaylist.value = { title: '', description: '', tagsInput: '' }
  playlistCreateError.value = ''
  playlistCreateFormVisible.value = false
}

const closePlaylistModal = () => {
  showPlaylistModal.value = false
  playlistActionLoading.value = false
  playlistFeedback.value = null
  resetPlaylistCreateForm()
}

const createPlaylistInline = async () => {
  const titleValue = newPlaylist.value.title.trim()
  if (!titleValue) {
    playlistCreateError.value = 'Enter a playlist name to continue.'
    return
  }

  playlistCreateLoading.value = true
  playlistCreateError.value = ''

  try {
    const tags = newPlaylist.value.tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    const data = await apiFetch('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({
        title: titleValue,
        description: newPlaylist.value.description.trim(),
        tags,
      }),
    })

    playlists.value.unshift(data.playlist)
    playlistsLoaded.value = true
    playlistFeedback.value = null
    resetPlaylistCreateForm()
  } catch (err) {
    playlistCreateError.value = err.message || 'Could not create the playlist.'
  } finally {
    playlistCreateLoading.value = false
  }
}

const saveToPlaylist = async (playlist) => {
  playlistActionLoading.value = true
  playlistFeedback.value = null

  try {
    await apiFetch(`/api/playlists/${playlist.id}/items`, {
      method: 'POST',
      body: JSON.stringify(playlistPayload.value),
    })

    playlistFeedback.value = {
      type: 'success',
      message: `"${title.value}" was saved to "${playlist.title}".`,
    }

    setTimeout(() => {
      closePlaylistModal()
    }, 900)
  } catch (err) {
    playlistFeedback.value = {
      type: 'error',
      message: err.message || 'This title was not saved.',
      hint: err.message?.includes('already')
        ? 'Open that playlist in your library if you want to remove the existing copy first.'
        : 'Try again after checking that the playlist still exists.',
    }
  } finally {
    playlistActionLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen text-white">

    <!-- Back button -->
    <div class="mb-5">
      <button
        @click="router.back()"
        class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-purple-500/50 hover:bg-purple-500/10 transition font-medium text-sm"
      >
        <i class="fa-solid fa-arrow-left text-xs"></i>
        {{ t.backBtn }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center py-32">
      <div class="w-10 h-10 border-2 border-purple-500/40 border-t-purple-500 rounded-full animate-spin"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-red-400 p-8">{{ error }}</div>

    <!-- Content -->
    <template v-else-if="media">

      <!-- Backdrop hero -->
      <div class="relative w-full h-56 md:h-80 rounded-2xl overflow-hidden mb-8">
        <img v-if="backdrop" :src="backdrop" :alt="title" class="w-full h-full object-cover" />
        <div v-else class="w-full h-full bg-purple-900/40"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-[#0a0615] via-[#0a0615]/40 to-transparent"></div>
      </div>

      <!-- Main info row -->
      <div class="flex flex-col md:flex-row gap-6 md:gap-8 mb-10 -mt-12 sm:-mt-20 md:-mt-24 relative">
        <!-- Poster -->
        <div class="shrink-0 w-28 sm:w-36 md:w-48 mx-auto md:mx-0">
          <img v-if="poster" :src="poster" :alt="title" class="w-full rounded-xl shadow-2xl" />
          <div v-else class="w-full aspect-[2/3] rounded-xl bg-white/5 flex items-center justify-center">
            <i class="fa-solid fa-film text-white/20 text-4xl"></i>
          </div>
        </div>

        <!-- Details -->
        <div class="flex flex-col gap-4 justify-end pb-2">
          <h1 class="text-2xl md:text-4xl font-bold">{{ title }}</h1>

          <div class="flex flex-wrap items-center gap-3 text-sm text-white/60">
            <span v-if="year">{{ year }}</span>
            <span v-if="rating" class="text-yellow-400 font-medium">⭐ {{ rating }}</span>
            <span v-if="runtime">{{ runtime }}</span>
            <span
              v-for="genre in (media.genres || []).slice(0, 3)"
              :key="genre.id"
              class="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs"
            >{{ genre.name }}</span>
          </div>

          <!-- Release date pill -->
          <div v-if="formattedReleaseDate">
            <span
              v-if="isUpcoming"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7c3aed]/20 border border-[#7c3aed]/35 text-[#a78bfa] text-xs font-medium"
            >
              <i class="fa-solid fa-calendar-plus text-[10px]"></i>
              Sortie le {{ formattedReleaseDate }}
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/8 border border-white/12 text-white/50 text-xs font-medium"
            >
              Sorti le {{ formattedReleaseDate }}
            </span>
          </div>

          <!-- Country of origin -->
          <p v-if="countries" class="text-sm text-white/50">
            {{ t.countryOfOrigin }}: <span class="text-white/80">{{ countries }}</span>
          </p>

          <p v-if="director" class="text-sm text-white/50">
            {{ t.director }}: <span class="text-white/80">{{ director }}</span>
          </p>
          <p v-if="creators" class="text-sm text-white/50">
            {{ t.creator }}: <span class="text-white/80">{{ creators }}</span>
          </p>

          <!-- Action buttons -->
          <div class="flex flex-wrap gap-2 mt-2">
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition bg-white/5 text-white/60 border border-white/10 hover:border-purple-500/40 hover:text-purple-300"
              @click="openPlaylistModal"
            >
              <i class="fa-solid fa-list text-xs"></i>
              Save to playlist
            </button>

            <!-- Like -->
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition"
              :class="isLiked(libItem) ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-white/5 text-white/60 border border-white/10 hover:border-red-500/40 hover:text-red-400'"
              @click="toggleLike(libItem)"
            >
              <i class="fa-solid fa-heart text-xs"></i>
              {{ isLiked(libItem) ? t.liked : t.like }}
            </button>

            <!-- Watchlist -->
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition"
              :class="isInWatchlist(libItem) ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'bg-white/5 text-white/60 border border-white/10 hover:border-blue-500/40 hover:text-blue-400'"
              @click="toggleWatchlist(libItem)"
            >
              <i class="fa-solid fa-bookmark text-xs"></i>
              {{ isInWatchlist(libItem) ? t.inWatchlist : t.addWatchlist }}
            </button>

            <!-- Watched -->
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition"
              :class="isWatched(libItem) ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-white/5 text-white/60 border border-white/10 hover:border-green-500/40 hover:text-green-400'"
              @click="toggleWatched(libItem)"
            >
              <i class="fa-solid fa-check text-xs"></i>
              {{ isWatched(libItem) ? t.alreadyWatched : t.markWatched }}
            </button>

            <!-- Not for me -->
            <Transition name="expand">
              <button
                v-if="!notForMeDone"
                class="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition"
                :class="notForMeConfirm
                  ? 'bg-orange-500/25 text-orange-400 border border-orange-500/50'
                  : 'bg-white/5 text-white/45 border border-white/10 hover:border-orange-500/40 hover:text-orange-400'"
                @click="handleNotForMe"
              >
                <i class="fa-solid fa-thumbs-down text-xs"></i>
                {{ notForMeConfirm ? 'Confirm?' : t.notForMe }}
              </button>
            </Transition>
            <div v-if="notForMeDone"
                 class="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium text-orange-400/60 border border-orange-500/20">
              <i class="fa-solid fa-check text-xs"></i>Removed from suggestions
            </div>
          </div>
        </div>
      </div>

      <!-- Overview -->
      <div v-if="overview" class="mb-10">
        <p class="text-white/70 leading-relaxed max-w-3xl">{{ overview }}</p>
      </div>

      <!-- Cast -->
      <div v-if="cast.length" class="mb-10">
        <h2 class="text-xs uppercase tracking-widest text-white/40 mb-4 font-medium">{{ t.cast }}</h2>
        <div class="flex gap-4 overflow-x-auto pb-2">
          <div
            v-for="actor in cast"
            :key="actor.id"
            class="shrink-0 flex flex-col items-center gap-2 w-16 sm:w-20"
          >
            <img
              v-if="actor.profile_path"
              :src="`${IMG_BASE}w185${actor.profile_path}`"
              :alt="actor.name"
              class="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border border-white/10"
            />
            <div v-else class="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/10 flex items-center justify-center">
              <i class="fa-solid fa-user text-white/30"></i>
            </div>
            <p class="text-white/70 text-[10px] sm:text-[11px] text-center leading-tight truncate w-full">{{ actor.name }}</p>
          </div>
        </div>
      </div>

      <!-- ── Where to Watch ─────────────────────────────────────────────── -->
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <h2 class="text-xs uppercase tracking-widest text-white/40 font-medium">{{ t.whereToWatch }}</h2>
          <span
            v-if="!isLocalRegion && hasAnyProviders"
            class="text-[10px] text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full"
          >
            <i class="fa-solid fa-globe mr-1"></i>Showing region: {{ regionCode }} — {{ t.notAvailable }}
          </span>
        </div>

        <template v-if="hasAnyProviders">
          <!-- Tabs -->
          <div class="flex gap-2 mb-4">
            <button
              v-for="tab in ['stream','rent','buy']"
              :key="tab"
              class="px-4 py-1.5 rounded-lg text-sm font-medium transition"
              :class="activeTab === tab ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/50 hover:text-white'"
              @click="activeTab = tab"
            >
              {{ tab === 'stream' ? t.stream : tab === 'rent' ? t.rent : t.buy }}
            </button>
          </div>

          <!-- Stream -->
          <div v-if="activeTab === 'stream'">
            <div v-if="streamList.length" class="flex flex-wrap gap-3">
              <a v-for="p in streamList" :key="p.provider_id"
                 :href="getPlatformUrl(p, title, jwLink)"
                 target="_blank" rel="noopener"
                 class="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 transition">
                <img :src="`${IMG_BASE}w45${p.logo_path}`" :alt="p.provider_name" class="w-7 h-7 rounded-lg" />
                <span class="text-sm text-white/80">{{ p.provider_name }}</span>
              </a>
            </div>
            <p v-else class="text-white/40 text-sm">
              <i class="fa-solid fa-triangle-exclamation mr-1.5 text-amber-400/60"></i>
              Not available for streaming in region {{ regionCode }}
            </p>
          </div>

          <!-- Rent -->
          <div v-if="activeTab === 'rent'">
            <div v-if="rentList.length" class="flex flex-wrap gap-3">
              <a v-for="p in rentList" :key="p.provider_id"
                 :href="getPlatformUrl(p, title, jwLink)"
                 target="_blank" rel="noopener"
                 class="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 transition">
                <img :src="`${IMG_BASE}w45${p.logo_path}`" :alt="p.provider_name" class="w-7 h-7 rounded-lg" />
                <span class="text-sm text-white/80">{{ p.provider_name }}</span>
              </a>
            </div>
            <p v-else class="text-white/40 text-sm">
              <i class="fa-solid fa-triangle-exclamation mr-1.5 text-amber-400/60"></i>
              Not available to rent in region {{ regionCode }}
            </p>
          </div>

          <!-- Buy -->
          <div v-if="activeTab === 'buy'">
            <div v-if="buyList.length" class="flex flex-wrap gap-3">
              <a v-for="p in buyList" :key="p.provider_id"
                 :href="getPlatformUrl(p, title, jwLink)"
                 target="_blank" rel="noopener"
                 class="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 transition">
                <img :src="`${IMG_BASE}w45${p.logo_path}`" :alt="p.provider_name" class="w-7 h-7 rounded-lg" />
                <span class="text-sm text-white/80">{{ p.provider_name }}</span>
              </a>
            </div>
            <p v-else class="text-white/40 text-sm">
              <i class="fa-solid fa-triangle-exclamation mr-1.5 text-amber-400/60"></i>
              Not available to buy in region {{ regionCode }}
            </p>
          </div>

          <!-- JustWatch link -->
          <a v-if="jwLink" :href="jwLink" target="_blank" rel="noopener"
             class="inline-flex items-center gap-2 mt-4 text-xs text-white/35 hover:text-white/60 transition">
            <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            View all options on JustWatch
          </a>
        </template>

        <!-- No providers at all — still show section with JustWatch fallback -->
        <template v-else>
          <p class="text-white/40 text-sm mb-3">
            <i class="fa-solid fa-triangle-exclamation mr-1.5 text-amber-400/60"></i>
            {{ t.notAvailable }}
          </p>
          <a :href="`https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}`"
             target="_blank" rel="noopener"
             class="inline-flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition border border-purple-500/30 px-4 py-2 rounded-xl hover:bg-purple-500/10">
            <i class="fa-solid fa-magnifying-glass text-xs"></i>
            Search on JustWatch
          </a>
        </template>
      </div>

      <!-- ── Streaming Player ───────────────────────────────────────────────── -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xs uppercase tracking-widest text-white/40 font-medium">Watch Now</h2>
          <!-- Trailer button -->
          <button
            class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition border border-red-500/30 text-red-400 bg-red-500/8 hover:bg-red-500/15 hover:border-red-500/50"
            @click="showTrailerModal = true"
          >
            <i class="fa-brands fa-youtube text-sm"></i>
            Trailer
          </button>
        </div>
        <StreamPlayer :type="type" :id="id" :title="title" :poster="poster" />
      </div>

      <!-- ── Similar Titles ─────────────────────────────────────────────────── -->
      <div class="mb-10">
        <SimilarTitles :type="type" :id="id" />
      </div>

    </template>

    <!-- Trailer modal -->
    <TrailerModal
      v-if="showTrailerModal"
      :trailer-key="trailer?.key || ''"
      :title="title"
      @close="showTrailerModal = false"
    />

    <div
      v-if="showPlaylistModal"
      class="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closePlaylistModal"></div>

      <div class="relative w-full max-w-sm sm:max-w-lg rounded-2xl border border-white/10 bg-[#120f1f] shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h2 class="text-white font-semibold">Save to playlist</h2>
            <p class="text-white/35 text-sm mt-1">{{ title }}</p>
          </div>
          <button
            type="button"
            class="w-9 h-9 rounded-xl bg-white/5 text-white/50 hover:text-white transition"
            @click="closePlaylistModal"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <div
            v-if="playlistFeedback"
            class="rounded-xl px-4 py-3 text-sm border"
            :class="playlistFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
              : 'bg-red-500/10 border-red-500/25 text-red-300'"
          >
            <p>{{ playlistFeedback.message }}</p>
            <p v-if="playlistFeedback.hint" class="text-xs mt-1 opacity-80">{{ playlistFeedback.hint }}</p>
          </div>

          <div v-if="playlistsLoading" class="flex justify-center py-10">
            <div class="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
          </div>

          <template v-else>
            <div class="flex items-center justify-between">
              <p class="text-white/55 text-sm">Choose one of your playlists.</p>
              <button
                type="button"
                class="w-10 h-10 rounded-xl border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition"
                @click="playlistCreateFormVisible = !playlistCreateFormVisible"
              >
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>

            <div
              v-if="playlistCreateFormVisible"
              class="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 flex flex-col gap-3"
            >
              <input
                v-model="newPlaylist.title"
                type="text"
                placeholder="Playlist name"
                class="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/60"
              >
              <textarea
                v-model="newPlaylist.description"
                rows="2"
                placeholder="Description (optional)"
                class="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/60 resize-none"
              ></textarea>
              <input
                v-model="newPlaylist.tagsInput"
                type="text"
                placeholder="Tags, comma separated (optional)"
                class="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/60"
              >

              <div v-if="playlistCreateError" class="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {{ playlistCreateError }}
              </div>

              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:text-white transition"
                  @click="resetPlaylistCreateForm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-700 to-purple-500 disabled:opacity-60"
                  :disabled="playlistCreateLoading"
                  @click="createPlaylistInline"
                >
                  <i v-if="playlistCreateLoading" class="fa-solid fa-circle-notch fa-spin mr-2 text-xs"></i>
                  Create playlist
                </button>
              </div>
            </div>

            <div
              v-if="!playlists.length"
              class="rounded-2xl border border-white/8 bg-white/5 px-5 py-8 text-center"
            >
              <i class="fa-solid fa-list text-3xl text-white/25"></i>
              <p class="text-white/55 font-medium mt-3">No playlists yet</p>
              <p class="text-white/35 text-sm mt-1">Use the plus button above to create your first playlist.</p>
            </div>

            <div v-else class="flex flex-col gap-3">
              <button
                v-for="playlist in playlists"
                :key="playlist.id"
                type="button"
                class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left hover:border-purple-500/40 hover:bg-purple-500/5 transition disabled:opacity-60"
                :disabled="playlistActionLoading"
                @click="saveToPlaylist(playlist)"
              >
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="text-white font-medium">{{ playlist.title }}</p>
                    <p v-if="playlist.description" class="text-white/35 text-sm mt-1">{{ playlist.description }}</p>
                  </div>
                  <span class="text-xs text-white/35 whitespace-nowrap">{{ playlist.item_count }} saved</span>
                </div>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.expand-enter-active, .expand-leave-active { transition: opacity 0.2s, transform 0.2s; }
.expand-enter-from, .expand-leave-to { opacity: 0; transform: scale(0.95); }
</style>
