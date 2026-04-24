<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserLibrary } from '@/composables/useUserLibrary'
import { useUserPreferences } from '@/composables/useUserPreferences'
import { useGoDetail } from '@/composables/useGoDetail'
import { useI18n } from '@/composables/useI18n'
import { useWatchHistory } from '@/composables/useWatchHistory'
import { apiUrl } from '@/config/api'

const router = useRouter()
const { liked, watchlist, watched } = useUserLibrary()
const { getTopMoods, getMoodForHour, interactionCount } = useUserPreferences()
const { t, lang } = useI18n()
const { streamHistory } = useWatchHistory()

const formatResumeTime = (seconds) => {
  if (!seconds || seconds < 10) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

const TMDB_KEY  = import.meta.env.VITE_TMDB_API_KEY
const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE  = 'https://image.tmdb.org/t/p/w342'

// ── Module-level cache — persists across navigation (back button) ─────
const _personalized  = ref([])
const _trending      = ref([])
const _films         = ref([])
const _series        = ref([])
const _anime         = ref([])
const _tvShows       = ref([])
const _docs          = ref([])
const _comingSoon    = ref([])
const _rowsLoaded    = ref(false)
const _personalLoaded = ref(false)

// Local refs pointing to cache
const personalized  = _personalized
const trending      = _trending
const films         = _films
const series        = _series
const anime         = _anime
const tvShows       = _tvShows
const docs          = _docs
const comingSoon    = _comingSoon

const loadingPersonal = ref(false)

// ── TMDB helper ────────────────────────────────────────────────────────
const tmdb = async (path, params = {}) => {
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', TMDB_KEY)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url)
  return res.json()
}

const grab15 = (data) => (data.results || []).slice(0, 15)

const formatComingSoonDate = (dateStr) => {
  if (!dateStr) return ''
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(dateStr))
}

// Threshold: user needs at least 3 library items OR 2 oracle sessions to get personalized recs
const hasEnoughData = computed(() =>
  (liked.value.length + watchlist.value.length + watched.value.length) >= 3 ||
  interactionCount() >= 4
)

// Recent date cutoff — 2 years back
const recentDate = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 2)
  return d.toISOString().split('T')[0]   // e.g. "2023-04-10"
}

// ── Fetch all rows ─────────────────────────────────────────────────────
const fetchAllRows = async () => {
  const since     = recentDate()
  const today     = new Date().toISOString().split('T')[0]
  const endOfYear = `${new Date().getFullYear()}-12-31`

  const [
    trendingData,
    filmsData,
    seriesData,
    animeData,
    tvData,
    docsData,
    upcomingMoviesData,
    upcomingTvData,
  ] = await Promise.all([
    tmdb('/trending/all/week'),
    tmdb('/discover/movie', { sort_by: 'popularity.desc', 'primary_release_date.gte': since, 'vote_count.gte': '100' }),
    tmdb('/discover/tv',    { sort_by: 'popularity.desc', without_genres: '16', 'first_air_date.gte': since, 'vote_count.gte': '50' }),
    tmdb('/discover/tv',    { sort_by: 'popularity.desc', with_genres: '16', with_original_language: 'ja', 'vote_count.gte': '100' }),
    tmdb('/discover/tv',    { sort_by: 'popularity.desc', with_genres: '10764', 'first_air_date.gte': since }),
    tmdb('/discover/movie', { sort_by: 'popularity.desc', with_genres: '99', 'primary_release_date.gte': since }),
    tmdb('/movie/upcoming', { region: 'FR', language: 'fr-FR' }),
    tmdb('/discover/tv',    { sort_by: 'first_air_date.asc', 'first_air_date.gte': today, 'first_air_date.lte': endOfYear, 'vote_count.gte': '5' }),
  ])

  trending.value = grab15(trendingData) // already has media_type from TMDB
  films.value    = grab15(filmsData).map(i => ({ ...i, media_type: 'movie' }))
  series.value   = grab15(seriesData).map(i => ({ ...i, media_type: 'tv' }))
  anime.value    = grab15(animeData).map(i => ({ ...i, media_type: 'tv' }))
  tvShows.value  = grab15(tvData).map(i => ({ ...i, media_type: 'tv' }))
  docs.value     = grab15(docsData).map(i => ({ ...i, media_type: 'movie' }))

  const soonMovies = (upcomingMoviesData.results || []).map(m => ({ ...m, _type: 'movie', _releaseDate: m.release_date }))
  const soonTv     = (upcomingTvData.results    || []).map(t => ({ ...t, _type: 'tv',    _releaseDate: t.first_air_date }))
  comingSoon.value = [...soonMovies, ...soonTv]
    .filter(i => i._releaseDate)
    .sort((a, b) => new Date(a._releaseDate) - new Date(b._releaseDate))
    .slice(0, 15)
}

// ── Personalized "For You" ─────────────────────────────────────────────
const fetchPersonalized = async () => {
  loadingPersonal.value = true
  try {
    const topMoods    = getTopMoods(3)
    const hour        = new Date().getHours()
    const moodForNow  = getMoodForHour(hour)
    const likedTitles = liked.value.slice(0, 10).map(i => i.title).filter(Boolean)

    const res = await fetch(apiUrl('/api/discover'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topMoods: moodForNow ? [moodForNow, ...topMoods] : topMoods,
        currentHour: hour,
        likedTitles,
      }),
    })
    if (!res.ok) throw new Error()
    const suggestions = await res.json()

    const results = await Promise.all(
      suggestions.map(async (s) => {
        const type = s.mediaType === 'tv' ? 'tv' : 'movie'
        const r = await tmdb(`/search/${type}`, { query: s.title })
        const item = r.results?.[0]
        if (!item) return null
        return {
          id:     item.id,
          type,
          title:  item.title || item.name,
          year:   (item.release_date || item.first_air_date || '').split('-')[0],
          poster: item.poster_path ? `${IMG_BASE}${item.poster_path}` : null,
          rating: item.vote_average?.toFixed(1),
          reason: s.reason,
        }
      })
    )
    personalized.value = results.filter(Boolean)
  } catch {
    personalized.value = []
  } finally {
    loadingPersonal.value = false
  }
}

// ── Navigation ─────────────────────────────────────────────────────────
const { goDetail } = useGoDetail()

const posterUrl = (item) =>
  item.poster_path ? `${IMG_BASE}${item.poster_path}` : (item.poster || null)

const itemTitle = (item) => item.title || item.name || ''
const itemYear  = (item) => (item.release_date || item.first_air_date || '').split('-')[0]

onMounted(() => {
  // Only fetch if data hasn't been loaded yet — prevents refetch on back navigation
  if (!_rowsLoaded.value) {
    fetchAllRows()
    _rowsLoaded.value = true
  }
  if (!_personalLoaded.value && hasEnoughData.value) {
    fetchPersonalized()
    _personalLoaded.value = true
  } else if (!_personalLoaded.value && !hasEnoughData.value) {
    // Nothing to load, mark so we don't keep checking
    loadingPersonal.value = false
  }
})
</script>

<template>
  <div class="flex flex-col gap-12 pb-16">

    <!-- Page header -->
    <div class="pt-2">
      <h1 class="text-3xl font-bold text-white mb-1">{{ t.discoverTitle }}</h1>
      <p style="color:rgba(255,255,255,0.35)" class="text-sm">Browse what's popular right now</p>
    </div>

    <!-- ── For You (Personalized) ──────────────────────────────────── -->
    <section>
      <h2 class="section-title">✨ {{ t.forYou }}</h2>

      <!-- Not enough data yet -->
      <div v-if="!hasEnoughData" class="flex items-start gap-4 p-5 rounded-2xl" style="background:rgba(124,58,237,0.08); border:1px solid rgba(124,58,237,0.2)">
        <i class="fa-solid fa-seedling text-purple-400 text-xl mt-0.5 shrink-0"></i>
        <div>
          <p class="text-white/70 text-sm font-medium mb-1">{{ lang === 'fr' ? 'Utilisez l\'Oracle quelques fois pour débloquer cette section' : 'Use the Oracle a few times to unlock this section' }}</p>
          <p style="color:rgba(255,255,255,0.38)" class="text-xs leading-relaxed">
            {{ lang === 'fr'
              ? 'Aimez, ajoutez à la liste ou marquez comme vus quelques contenus. Tazama apprendra vos goûts et vous proposera des recommandations personnalisées ici.'
              : 'Like, save to watchlist or mark a few titles as watched. Tazama will learn your taste and surface personalized picks here.' }}
          </p>
        </div>
      </div>

      <template v-else>
        <div v-if="loadingPersonal" class="row-loader">
          <div class="spinner"></div><span>Loading...</span>
        </div>

        <div v-else class="scroll-row">
          <div
            v-for="item in personalized"
            :key="`p-${item.id}`"
            class="scroll-card"
            @click="goDetail(item, $event)"
          >
            <div class="poster-wrap">
              <img v-if="item.poster" :src="item.poster" :alt="item.title" class="poster-img" />
              <div v-else class="poster-placeholder"><i class="fa-solid fa-film"></i></div>
              <div class="poster-overlay"></div>
              <span v-if="item.rating" class="rating-badge">⭐ {{ item.rating }}</span>
            </div>
            <p class="card-title">{{ item.title }}</p>
            <p v-if="item.reason" class="card-reason">{{ item.reason }}</p>
          </div>
        </div>
      </template>
    </section>

    <!-- ── Recently Watched ──────────────────────────────────────── -->
    <section v-if="streamHistory.length">
      <h2 class="section-title">▶️ Recently Watched</h2>
      <div class="scroll-row">
        <div
          v-for="item in streamHistory"
          :key="`rw-${item.type}-${item.id}`"
          class="scroll-card"
          @click="goDetail(item, $event)"
        >
          <div class="poster-wrap">
            <img v-if="item.poster" :src="item.poster" :alt="item.title" class="poster-img" />
            <div v-else class="poster-placeholder"><i class="fa-solid fa-play"></i></div>
            <div class="poster-overlay"></div>
            <div class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition">
              <div class="w-9 h-9 rounded-full flex items-center justify-center" style="background: rgba(124,58,237,0.85);">
                <i class="fa-solid fa-play text-white text-xs ml-0.5"></i>
              </div>
            </div>
            <span v-if="item.type === 'tv' && item.episode" class="coming-date-badge">S{{ item.season }}E{{ item.episode }}</span>
            <!-- Resume-time strip at bottom of poster -->
            <div v-if="formatResumeTime(item.resumeTime)" class="absolute bottom-0 left-0 right-0 px-2 pb-1.5 pt-4" style="background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%);">
              <div class="flex items-center gap-1 text-[10px] text-white/80 font-medium">
                <i class="fa-solid fa-rotate-right text-purple-400 text-[9px]"></i>
                <span>{{ formatResumeTime(item.resumeTime) }}</span>
              </div>
            </div>
          </div>
          <p class="card-title">{{ item.title }}</p>
          <p v-if="formatResumeTime(item.resumeTime)" class="card-year" style="color: rgba(167,139,250,0.7);">
            Resume from {{ formatResumeTime(item.resumeTime) }}
          </p>
          <p v-else-if="item.watchedAt" class="card-year">{{ new Date(item.watchedAt).toLocaleDateString() }}</p>
        </div>
      </div>
    </section>

    <!-- ── Trending Now ────────────────────────────────────────────── -->
    <section>
      <h2 class="section-title">🔥 {{ t.trending }}</h2>
      <div class="scroll-row">
        <div
          v-for="(item, i) in trending"
          :key="`tr-${item.id}`"
          class="scroll-card"
          @click="goDetail(item, $event)"
        >
          <div class="poster-wrap">
            <img v-if="posterUrl(item)" :src="posterUrl(item)" :alt="itemTitle(item)" class="poster-img" />
            <div v-else class="poster-placeholder"><i class="fa-solid fa-film"></i></div>
            <div class="poster-overlay"></div>
            <span class="rank-num">{{ i + 1 }}</span>
          </div>
          <p class="card-title">{{ itemTitle(item) }}</p>
          <p class="card-year">{{ itemYear(item) }}</p>
        </div>
      </div>
    </section>

    <!-- ── Coming Soon ──────────────────────────────────────────────── -->
    <section v-if="comingSoon.length">
      <h2 class="section-title">🗓️ Coming Soon</h2>
      <div class="scroll-row">
        <div
          v-for="item in comingSoon"
          :key="`cs-${item._type}-${item.id}`"
          class="scroll-card"
          @click="goDetail({ ...item, media_type: item._type }, $event)"
        >
          <div class="poster-wrap">
            <img v-if="posterUrl(item)" :src="posterUrl(item)" :alt="itemTitle(item)" class="poster-img" />
            <div v-else class="poster-placeholder"><i class="fa-solid fa-calendar"></i></div>
            <div class="poster-overlay"></div>
            <span class="coming-type-pill">{{ item._type === 'movie' ? 'Film' : 'Série' }}</span>
            <span class="coming-date-badge">{{ formatComingSoonDate(item._releaseDate) }}</span>
          </div>
          <p class="card-title">{{ itemTitle(item) }}</p>
        </div>
      </div>
    </section>

    <!-- ── Top Films ───────────────────────────────────────────────── -->
    <section>
      <h2 class="section-title">🎬 Top Films</h2>
      <div class="scroll-row">
        <div
          v-for="(item, i) in films"
          :key="`f-${item.id}`"
          class="scroll-card"
          @click="goDetail(item, $event)"
        >
          <div class="poster-wrap">
            <img v-if="posterUrl(item)" :src="posterUrl(item)" :alt="itemTitle(item)" class="poster-img" />
            <div v-else class="poster-placeholder"><i class="fa-solid fa-film"></i></div>
            <div class="poster-overlay"></div>
            <span class="rank-num">{{ i + 1 }}</span>
          </div>
          <p class="card-title">{{ itemTitle(item) }}</p>
          <p class="card-year">{{ itemYear(item) }}</p>
        </div>
      </div>
    </section>

    <!-- ── Top Series ──────────────────────────────────────────────── -->
    <section>
      <h2 class="section-title">📺 Top Series</h2>
      <div class="scroll-row">
        <div
          v-for="(item, i) in series"
          :key="`s-${item.id}`"
          class="scroll-card"
          @click="goDetail(item, $event)"
        >
          <div class="poster-wrap">
            <img v-if="posterUrl(item)" :src="posterUrl(item)" :alt="itemTitle(item)" class="poster-img" />
            <div v-else class="poster-placeholder"><i class="fa-solid fa-film"></i></div>
            <div class="poster-overlay"></div>
            <span class="rank-num">{{ i + 1 }}</span>
          </div>
          <p class="card-title">{{ itemTitle(item) }}</p>
          <p class="card-year">{{ itemYear(item) }}</p>
        </div>
      </div>
    </section>

    <!-- ── Top Anime ───────────────────────────────────────────────── -->
    <section>
      <h2 class="section-title">⛩️ Top Anime</h2>
      <div class="scroll-row">
        <div
          v-for="(item, i) in anime"
          :key="`a-${item.id}`"
          class="scroll-card"
          @click="goDetail(item, $event)"
        >
          <div class="poster-wrap">
            <img v-if="posterUrl(item)" :src="posterUrl(item)" :alt="itemTitle(item)" class="poster-img" />
            <div v-else class="poster-placeholder"><i class="fa-solid fa-film"></i></div>
            <div class="poster-overlay"></div>
            <span class="rank-num">{{ i + 1 }}</span>
          </div>
          <p class="card-title">{{ itemTitle(item) }}</p>
          <p class="card-year">{{ itemYear(item) }}</p>
        </div>
      </div>
    </section>

    <!-- ── Top TV Shows ────────────────────────────────────────────── -->
    <section>
      <h2 class="section-title">📡 Top TV Shows</h2>
      <div class="scroll-row">
        <div
          v-for="(item, i) in tvShows"
          :key="`tv-${item.id}`"
          class="scroll-card"
          @click="goDetail(item, $event)"
        >
          <div class="poster-wrap">
            <img v-if="posterUrl(item)" :src="posterUrl(item)" :alt="itemTitle(item)" class="poster-img" />
            <div v-else class="poster-placeholder"><i class="fa-solid fa-film"></i></div>
            <div class="poster-overlay"></div>
            <span class="rank-num">{{ i + 1 }}</span>
          </div>
          <p class="card-title">{{ itemTitle(item) }}</p>
          <p class="card-year">{{ itemYear(item) }}</p>
        </div>
      </div>
    </section>

    <!-- ── Top Documentaries ───────────────────────────────────────── -->
    <section>
      <h2 class="section-title">🎙️ Top Documentaries</h2>
      <div class="scroll-row">
        <div
          v-for="(item, i) in docs"
          :key="`d-${item.id}`"
          class="scroll-card"
          @click="goDetail(item, $event)"
        >
          <div class="poster-wrap">
            <img v-if="posterUrl(item)" :src="posterUrl(item)" :alt="itemTitle(item)" class="poster-img" />
            <div v-else class="poster-placeholder"><i class="fa-solid fa-film"></i></div>
            <div class="poster-overlay"></div>
            <span class="rank-num">{{ i + 1 }}</span>
          </div>
          <p class="card-title">{{ itemTitle(item) }}</p>
          <p class="card-year">{{ itemYear(item) }}</p>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
/* ── Section title ───────────────────────────────────────── */
.section-title {
  font-size: 17px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 16px;
  letter-spacing: -0.01em;
}

/* ── Horizontal scroll row ───────────────────────────────── */
.scroll-row {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding-bottom: 12px;
  /* hide scrollbar but keep scrollability */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scroll-row::-webkit-scrollbar { display: none; }

/* ── Individual card ─────────────────────────────────────── */
.scroll-card {
  flex-shrink: 0;
  width: 120px;
  cursor: pointer;
}

@media (min-width: 380px) {
  .scroll-card { width: 140px; }
  .poster-wrap { height: 210px; }
}

@media (min-width: 640px) {
  .scroll-card { width: 155px; }
}

/* ── Poster container ────────────────────────────────────── */
.poster-wrap {
  position: relative;
  width: 100%;
  height: 180px;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(255,255,255,0.05);
  margin-bottom: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.scroll-card:hover .poster-wrap {
  transform: scale(1.04);
  box-shadow: 0 12px 32px rgba(0,0,0,0.6);
}

.poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.15);
  font-size: 28px;
}

/* subtle dark gradient at bottom (always present, more visible on hover) */
.poster-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%);
}

/* ── Rank number ─────────────────────────────────────────── */
.rank-num {
  position: absolute;
  bottom: 6px;
  left: 9px;
  font-size: 42px;
  font-weight: 900;
  line-height: 1;
  /* Netflix-style outline number */
  color: transparent;
  -webkit-text-stroke: 2px rgba(255,255,255,0.55);
  text-stroke: 2px rgba(255,255,255,0.55);
  user-select: none;
  font-family: 'Impact', 'Arial Black', sans-serif;
}

/* ── Rating badge ────────────────────────────────────────── */
.rating-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  color: #facc15;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 8px;
}

/* ── Card text ───────────────────────────────────────────── */
.card-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 2px;
}

.card-year {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
}

.card-reason {
  font-size: 11px;
  color: rgba(255,255,255,0.38);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 2px;
}

/* ── Loader ──────────────────────────────────────────────── */
.row-loader {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255,255,255,0.35);
  font-size: 13px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(124,58,237,0.3);
  border-top-color: #7C3AED;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Coming Soon badges ──────────────────────────────────── */
.coming-type-pill {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(124, 58, 237, 0.72);
  color: #e9d5ff;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 5px;
  backdrop-filter: blur(4px);
}

.coming-date-badge {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(6px);
  color: rgba(255, 255, 255, 0.88);
  font-size: 10px;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1);
}
</style>
