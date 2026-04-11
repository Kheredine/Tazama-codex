<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useAuth } from '@/composables/useAuth'
import { useRouter, useRoute } from 'vue-router'

defineEmits(['toggle-sidebar'])

const { t, lang, toggleLang } = useI18n()
const { user, isPremium, apiFetch } = useAuth()
const router = useRouter()
const route  = useRoute()

const TMDB_KEY  = import.meta.env.VITE_TMDB_API_KEY
const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE  = 'https://image.tmdb.org/t/p/w92'

let isMounted = true
onUnmounted(() => { isMounted = false })

// ── Scroll shadow ─────────────────────────────────────────────────────────────
const scrolled = ref(false)
const onScroll = () => { scrolled.value = window.scrollY > 20 }
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))

// ── Search state ──────────────────────────────────────────────────────────────
const query        = ref('')
const searchActive = ref(false)
const movieResults = ref([])
const userResults  = ref([])
const searching    = ref(false)
const wrapperRef   = ref(null)

// v-show on the dropdown (never removed from DOM = no insertBefore/nextSibling crash)
const dropdownVisible = computed(
  () => searchActive.value && query.value.trim().length >= 2
)

const hasMovies  = computed(() => movieResults.value.length > 0)
const hasUsers   = computed(() => userResults.value.length > 0)
const hasAny     = computed(() => hasMovies.value || hasUsers.value)
const showEmpty  = computed(() => !searching.value && !hasAny.value && dropdownVisible.value)
const showSearch = computed(() => searching.value && dropdownVisible.value)

// ── Debounced search ──────────────────────────────────────────────────────────
let debounceTimer = null

watch(query, (q) => {
  clearTimeout(debounceTimer)
  if (q.trim().length < 2) {
    movieResults.value = []
    userResults.value  = []
    return
  }
  debounceTimer = setTimeout(() => runSearch(q.trim()), 380)
})

const runSearch = async (q) => {
  if (!isMounted) return
  searching.value = true
  try {
    const [tmdbData, userRes] = await Promise.all([
      fetch(`${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`)
        .then(r => r.json()).catch(() => ({ results: [] })),
      apiFetch(`/api/social/search?q=${encodeURIComponent(q)}`).catch(() => ({ users: [] })),
    ])
    if (!isMounted) return

    movieResults.value = (tmdbData.results || [])
      .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
      .slice(0, 5)
      .map(r => ({
        id:     r.id,
        type:   r.media_type,
        title:  r.title || r.name,
        year:   (r.release_date || r.first_air_date || '').split('-')[0],
        poster: r.poster_path ? `${IMG_BASE}${r.poster_path}` : null,
      }))

    userResults.value = userRes ? (userRes.users || []) : []
  } catch { /* fail silently */ }
  finally { if (isMounted) searching.value = false }
}

// ── Open / close ──────────────────────────────────────────────────────────────
const closeSearch = () => {
  searchActive.value = false
  query.value        = ''
  movieResults.value = []
  userResults.value  = []
}

// click outside — 80 ms delay so result clicks can fire their own handler first
let closeTimer = null
const onPointerDown = (e) => {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    clearTimeout(closeTimer)
    closeTimer = setTimeout(() => { if (isMounted) searchActive.value = false }, 80)
  }
}
onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  clearTimeout(closeTimer)
  clearTimeout(debounceTimer)
})

// Close on navigation
watch(() => route.path, closeSearch)

// ── Result navigation ─────────────────────────────────────────────────────────
const goToTitle = (item) => {
  closeSearch()
  router.push({ name: 'detail', params: { type: item.type, id: item.id } })
}
const goToUser = (u) => {
  closeSearch()
  router.push({ name: 'user-profile', params: { id: u.id } })
}

// ── Notification count ────────────────────────────────────────────────────────
const unreadCount = ref(0)
let unreadTimer   = null

const loadUnread = async () => {
  if (!isMounted) return
  try {
    const data = await apiFetch('/api/social/unread-count')
    if (isMounted) unreadCount.value = data.count || 0
  } catch { /* ignore */ }
}
onMounted(() => {
  if (user.value) {
    loadUnread()
    unreadTimer = setInterval(() => { if (isMounted && user.value) loadUnread() }, 60000)
  }
})
onUnmounted(() => clearInterval(unreadTimer))
</script>

<template>
<header
  class="fixed top-0 left-0 md:left-64 right-0 z-40 flex items-center py-3 px-4 md:px-6 gap-3 font-body text-white transition-all duration-300"
  :class="scrolled ? 'backdrop-blur-2xl bg-[#0a0615]/80 border-b border-white/5' : 'bg-transparent'"
>
  <!-- Left: hamburger -->
  <div class="flex items-center gap-2 shrink-0">
    <button
      type="button"
      class="md:hidden flex items-center justify-center w-11 h-11 rounded-xl bg-[#7C3AED]/20 text-white/70 hover:text-white transition"
      @click="$emit('toggle-sidebar')"
    >
      <i class="fa-solid fa-bars text-base"></i>
    </button>

    <button
      type="button"
      class="hidden md:flex items-center gap-1.5 px-3 h-11 rounded-xl bg-[#7C3AED]/20 backdrop-blur-md text-white/70 hover:text-white text-sm font-semibold transition"
      @click="toggleLang"
      :title="lang === 'en' ? 'Passer en français' : 'Switch to English'"
    >
      <i class="fa-solid fa-globe text-xs"></i>
      <span>{{ lang === 'en' ? 'FR' : 'EN' }}</span>
    </button>
  </div>

  <!-- Center: search -->
  <div ref="wrapperRef" class="flex-1 flex justify-center">
    <div class="w-full max-w-2xl" style="position: relative;">

      <!-- Input bar -->
      <div
        class="flex items-center gap-2.5 px-4 h-11 rounded-xl bg-[#7C3AED]/20 backdrop-blur-md transition-all"
        :style="searchActive ? 'box-shadow: 0 0 0 1px rgba(124,58,237,0.45);' : ''"
      >
        <i class="fa-solid fa-magnifying-glass text-white/35 text-sm shrink-0"></i>

        <input
          v-model="query"
          type="search"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          name="tazama-q"
          :placeholder="t.searchPlaceholder"
          class="bg-transparent focus:outline-none w-full text-sm text-white/80 placeholder:text-white/30"
          @focus="searchActive = true"
          @keydown.escape.stop="closeSearch"
        >

        <!-- Spinner (absolutely positioned inside bar so it doesn't shift layout) -->
        <i
          class="fa-solid fa-circle-notch fa-spin text-white/35 text-xs shrink-0 transition-opacity"
          :style="searching ? 'opacity:1' : 'opacity:0; pointer-events:none'"
        ></i>

        <!-- Clear button -->
        <button
          type="button"
          class="shrink-0 text-white/30 hover:text-white/70 transition"
          :style="query ? 'opacity:1' : 'opacity:0; pointer-events:none'"
          @pointerdown.stop
          @click.stop="closeSearch"
        >
          <i class="fa-solid fa-xmark text-sm"></i>
        </button>
      </div>

      <!--
        Dropdown — v-show so the node is ALWAYS in the DOM.
        Internal sections also use v-show (not v-if) so Vue never inserts/removes
        nodes during parent re-renders → no nextSibling / insertBefore crash.
      -->
      <div
        v-show="dropdownVisible"
        class="absolute left-0 right-0 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        style="top: calc(100% + 8px); background:#13111f; max-height:430px; overflow-y:auto; z-index:9999;"
        @pointerdown.stop
      >
        <!-- Loading row — v-show, not v-if -->
        <div
          v-show="showSearch"
          class="flex items-center justify-center gap-2 py-5 text-white/30 text-sm"
        >
          <i class="fa-solid fa-circle-notch fa-spin text-xs"></i>
          {{ lang === 'fr' ? 'Recherche…' : 'Searching…' }}
        </div>

        <!-- Empty row — v-show, not v-if -->
        <div
          v-show="showEmpty"
          class="py-8 text-center"
        >
          <i class="fa-solid fa-face-frown-open text-white/15 text-2xl block mb-2"></i>
          <p class="text-white/30 text-sm">{{ t.searchNoResults }}</p>
        </div>

        <!-- Titles section — v-show, not v-if -->
        <div v-show="hasMovies && !showSearch">
          <div class="px-4 pt-3 pb-1.5">
            <span class="text-[10px] font-bold uppercase tracking-widest text-white/25">
              <i class="fa-solid fa-film mr-1 text-purple-400/50"></i>{{ t.searchMovies }}
            </span>
          </div>
          <button
            v-for="item in movieResults"
            :key="`m-${item.type}-${item.id}`"
            type="button"
            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition text-left"
            @click.stop="goToTitle(item)"
          >
            <div class="w-9 h-13 rounded-lg overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
              <img v-if="item.poster" :src="item.poster" :alt="item.title" class="w-full h-full object-cover" />
              <i v-else class="fa-solid fa-film text-white/15 text-xs"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-white text-sm font-medium truncate">{{ item.title }}</p>
              <p class="text-white/35 text-xs mt-0.5">
                {{ item.year }}
                <span class="mx-1 opacity-30">·</span>
                <span :class="item.type === 'movie' ? 'text-purple-400/60' : 'text-blue-400/60'">
                  {{ item.type === 'movie'
                      ? (lang === 'fr' ? 'Film' : 'Movie')
                      : (lang === 'fr' ? 'Série' : 'Series') }}
                </span>
              </p>
            </div>
            <i class="fa-solid fa-arrow-right text-[10px] text-white/15 shrink-0"></i>
          </button>
        </div>

        <!-- Divider — v-show, not v-if -->
        <div
          v-show="hasMovies && hasUsers && !showSearch"
          class="h-px bg-white/6 mx-4 my-1"
        ></div>

        <!-- People section — v-show, not v-if -->
        <div v-show="hasUsers && !showSearch">
          <div class="px-4 pt-3 pb-1.5">
            <span class="text-[10px] font-bold uppercase tracking-widest text-white/25">
              <i class="fa-solid fa-users mr-1 text-purple-400/50"></i>{{ t.searchUsers }}
            </span>
          </div>
          <button
            v-for="u in userResults"
            :key="`u-${u.id}`"
            type="button"
            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition text-left"
            @click.stop="goToUser(u)"
          >
            <div
              class="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-lg"
              style="background: rgba(124,58,237,0.4);"
            >{{ u.avatar || '🎬' }}</div>
            <div class="flex-1 min-w-0">
              <p class="text-white text-sm font-medium truncate">{{ u.username }}</p>
              <p class="text-white/35 text-xs mt-0.5">{{ u.plan === 'premium' ? '✦ Premium' : 'Standard' }}</p>
            </div>
            <i class="fa-solid fa-arrow-right text-[10px] text-white/15 shrink-0"></i>
          </button>
        </div>

        <!-- Bottom spacer — always present, keeps dropdown height stable -->
        <div class="h-2"></div>
      </div>

    </div>
  </div>

  <!-- Right: bell + profile -->
  <div class="flex items-center gap-2 shrink-0">

    <!-- Notification bell -->
    <button
      type="button"
      class="relative hidden md:flex items-center justify-center w-11 h-11 rounded-xl bg-[#7C3AED]/20 text-white/60 hover:text-white transition"
      @click="router.push('/notifications')"
    >
      <i class="fa-solid fa-bell text-base"></i>
      <!-- badge: opacity toggle avoids DOM insert/remove -->
      <span
        class="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 rounded-full text-[9px] font-bold flex items-center justify-center px-1 transition-opacity"
        style="background:#ef4444; color:white;"
        :style="unreadCount > 0 ? 'opacity:1' : 'opacity:0; pointer-events:none'"
      >{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
    </button>

    <!-- Profile pill — ONLY this element keeps the premium amber colour -->
    <button
      type="button"
      class="flex items-center gap-2.5 px-3.5 h-11 rounded-xl backdrop-blur-md cursor-pointer transition-all hover:opacity-85"
      :style="isPremium
        ? 'background: rgba(217,119,6,0.18);'
        : 'background: rgba(124,58,237,0.2);'"
      @click="router.push('/settings')"
    >
      <div
        class="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
        :style="isPremium
          ? 'background: linear-gradient(135deg,#d97706,#f59e0b);'
          : 'background: rgba(124,58,237,0.55);'"
      >
        <span v-if="user?.avatar">{{ user.avatar }}</span>
        <span v-else class="text-white font-bold">{{ user?.username?.[0]?.toUpperCase() || '?' }}</span>
      </div>

      <div class="hidden sm:flex flex-col leading-tight">
        <span class="text-sm font-semibold text-white">{{ user?.username || 'Account' }}</span>
        <span
          class="text-[10px] flex items-center gap-1"
          :style="isPremium ? 'color:#fbbf24' : 'color:#a78bfa'"
        >
          <i v-if="isPremium" class="fa-solid fa-crown text-[8px]"></i>
          {{ isPremium ? 'Premium' : 'Standard' }}
        </span>
      </div>
      <i class="fa-solid fa-chevron-right text-xs text-white/25 hidden sm:block"></i>
    </button>

  </div>
</header>
</template>
