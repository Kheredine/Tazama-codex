<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserLibrary } from '@/composables/useUserLibrary'
import { useWatchHistory } from '@/composables/useWatchHistory'
import { useI18n } from '@/composables/useI18n'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { watchlist, watched, liked, history, toggleWatchlist, toggleWatched, toggleLike, addHistory } = useUserLibrary()
const { streamHistory, removeFromStreamHistory, clearStreamHistory } = useWatchHistory()
const { t } = useI18n()
const { apiFetch } = useAuth()

const activeTab = ref('liked')

const tabs = [
  { id: 'liked',     icon: 'fa-heart',              labelKey: 'myLikes'     },
  { id: 'watchlist', icon: 'fa-bookmark',            labelKey: 'myWatchlist' },
  { id: 'watched',   icon: 'fa-check',               labelKey: 'myWatched'   },
  { id: 'history',   icon: 'fa-clock-rotate-left',   labelKey: 'myHistory'   },
  { id: 'streaming', icon: 'fa-play-circle',          labelKey: 'myStreaming'  },
  { id: 'playlists', icon: 'fa-list',                labelKey: 'myPlaylists' },
]

const currentList = computed(() => {
  if (activeTab.value === 'liked')     return liked.value
  if (activeTab.value === 'watchlist') return watchlist.value
  if (activeTab.value === 'watched')   return watched.value
  if (activeTab.value === 'history')   return history.value
  return []
})

const countFor = (tabId) => {
  if (tabId === 'liked')     return liked.value.length
  if (tabId === 'watchlist') return watchlist.value.length
  if (tabId === 'watched')   return watched.value.length
  if (tabId === 'history')   return history.value.length
  if (tabId === 'streaming') return streamHistory.value.length
  if (tabId === 'playlists') return playlists.value.length
  return 0
}

const goDetail = (item) => {
  router.push({ name: 'detail', params: { type: item.type, id: item.id } })
}

// Import streaming history
const showImport = ref(false)
const importText = ref('')

const handleImport = () => {
  const lines = importText.value.split('\n').filter(Boolean)
  lines.forEach(line => {
    const [title, platform] = line.split('|').map(s => s.trim())
    if (title) addHistory({ title, platform: platform || 'Unknown', type: 'movie', id: Date.now() + Math.random() })
  })
  importText.value = ''
  showImport.value = false
  activeTab.value  = 'history'
}

// ── Playlists ──────────────────────────────────────────────────────────────
const playlists       = ref([])
const loadingPlaylists = ref(false)
const showCreateForm   = ref(false)
const expandedPlaylist = ref(null) // { id, title, items, tags }

const newPlaylist = ref({ title: '', tagType: 'emotion', tagsInput: '', description: '' })
const creating    = ref(false)
const createError = ref('')

const EMOTION_SUGGESTIONS = ['joyful', 'melancholic', 'tense', 'romantic', 'nostalgic', 'inspiring', 'dark', 'adventurous']
const GENRE_SUGGESTIONS   = ['action', 'drama', 'comedy', 'sci-fi', 'horror', 'thriller', 'fantasy', 'documentary']

const tagSuggestions = computed(() =>
  newPlaylist.value.tagType === 'emotion' ? EMOTION_SUGGESTIONS : GENRE_SUGGESTIONS
)

const loadPlaylists = async () => {
  loadingPlaylists.value = true
  try {
    const data = await apiFetch('/api/playlists')
    playlists.value = data.playlists || []
  } catch { /* ignore */ }
  finally { loadingPlaylists.value = false }
}

const createPlaylist = async () => {
  if (!newPlaylist.value.title.trim()) { createError.value = 'Please enter a title'; return }
  creating.value    = true
  createError.value = ''
  try {
    const tags = newPlaylist.value.tagsInput
      .split(',').map(t => t.trim()).filter(Boolean)
    const autoDesc = tags.length
      ? `A collection of ${newPlaylist.value.tagType === 'emotion' ? 'emotionally ' : ''}${tags.slice(0, 3).join(', ')} titles.`
      : ''
    const data = await apiFetch('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({
        title:       newPlaylist.value.title.trim(),
        description: newPlaylist.value.description || autoDesc,
        tags,
      }),
    })
    playlists.value.unshift(data.playlist)
    newPlaylist.value = { title: '', tagType: 'emotion', tagsInput: '', description: '' }
    showCreateForm.value = false
  } catch (err) { createError.value = err.message || 'Failed to create playlist' }
  finally { creating.value = false }
}

const deletePlaylist = async (pl) => {
  if (!confirm(`Delete playlist "${pl.title}"?`)) return
  try {
    await apiFetch(`/api/playlists/${pl.id}`, { method: 'DELETE' })
    playlists.value = playlists.value.filter(p => p.id !== pl.id)
    if (expandedPlaylist.value?.id === pl.id) expandedPlaylist.value = null
  } catch { /* ignore */ }
}

const toggleShare = async (pl) => {
  try {
    const data = await apiFetch(`/api/playlists/${pl.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_shared: !pl.is_shared }),
    })
    const idx = playlists.value.findIndex(p => p.id === pl.id)
    if (idx !== -1) playlists.value[idx] = { ...playlists.value[idx], is_shared: data.playlist.is_shared }
  } catch { /* ignore */ }
}

const openPlaylist = async (pl) => {
  if (expandedPlaylist.value?.id === pl.id) { expandedPlaylist.value = null; return }
  try {
    const data = await apiFetch(`/api/playlists/${pl.id}`)
    expandedPlaylist.value = { ...data.playlist, items: data.playlist.items || [] }
  } catch { /* ignore */ }
}

const removeFromPlaylist = async (playlistId, tmdbId, mediaType) => {
  try {
    await apiFetch(`/api/playlists/${playlistId}/items/${tmdbId}/${mediaType}`, { method: 'DELETE' })
    if (expandedPlaylist.value?.id === playlistId) {
      expandedPlaylist.value.items = expandedPlaylist.value.items.filter(
        i => !(String(i.tmdb_id) === String(tmdbId) && i.media_type === mediaType)
      )
    }
  } catch { /* ignore */ }
}

const addTagSuggestion = (tag) => {
  const tags = newPlaylist.value.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
  if (!tags.includes(tag)) {
    newPlaylist.value.tagsInput = [...tags, tag].join(', ')
  }
}

onMounted(() => {
  if (activeTab.value === 'playlists') loadPlaylists()
})

const onTabChange = (tabId) => {
  activeTab.value = tabId
  if (tabId === 'playlists' && !playlists.value.length && !loadingPlaylists.value) {
    loadPlaylists()
  }
}
</script>

<template>
  <div class="flex flex-col gap-8 pb-12">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-white">{{ t.libraryTitle }}</h1>

      <button
        v-if="activeTab === 'history'"
        type="button"
        class="btn-secondary-1 text-sm flex items-center gap-2"
        @click="showImport = !showImport"
      >
        <i class="fa-solid fa-file-import text-xs"></i>
        {{ t.importHistory }}
      </button>

      <button
        v-if="activeTab === 'playlists'"
        type="button"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer"
        style="background: linear-gradient(135deg, #5b21b6, #7c3aed); color: white;"
        @click="showCreateForm = !showCreateForm"
      >
        <i class="fa-solid fa-plus text-xs"></i>
        New Playlist
      </button>
    </div>

    <!-- Import panel -->
    <div v-show="showImport && activeTab === 'history'" class="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-3">
      <p class="text-white/60 text-sm">Enter one title per line. Optionally add the platform separated by |</p>
      <p class="text-white/40 text-xs">Example: <code class="bg-white/10 px-1 rounded">Interstellar | Netflix</code></p>
      <textarea
        v-model="importText"
        rows="6"
        class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 focus:outline-none focus:border-purple-500/60 resize-none"
        placeholder="Interstellar | Netflix&#10;Parasite | Prime Video"
      ></textarea>
      <div class="flex gap-3">
        <button type="button" class="btn-secondary-2 text-sm" @click="handleImport">Import</button>
        <button type="button" class="btn-secondary-1 text-sm" @click="showImport = false">Cancel</button>
      </div>
    </div>

    <!-- Create playlist form -->
    <div v-show="showCreateForm && activeTab === 'playlists'"
         class="p-5 rounded-2xl border border-purple-500/25 flex flex-col gap-4"
         style="background: rgba(124,58,237,0.06);">
      <h3 class="text-sm font-bold text-white/70 uppercase tracking-wider">
        <i class="fa-solid fa-list mr-2 text-purple-400"></i>New Playlist
      </h3>

      <!-- Title -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-white/40 uppercase tracking-wider font-semibold">Title</label>
        <input v-model="newPlaylist.title" type="text" placeholder="My Rainy Day Films…"
               class="lib-input" />
      </div>

      <!-- Tag type -->
      <div class="flex flex-col gap-2">
        <label class="text-xs text-white/40 uppercase tracking-wider font-semibold">Tag Type</label>
        <div class="flex gap-2">
          <button
            v-for="type in ['emotion', 'genre']"
            :key="type"
            type="button"
            class="px-4 py-2 rounded-xl text-sm font-medium transition border capitalize"
            :style="newPlaylist.tagType === type
              ? 'background: rgba(124,58,237,0.35); color: white; border-color: rgba(124,58,237,0.5);'
              : 'background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); border-color: rgba(255,255,255,0.1);'"
            @click="newPlaylist.tagType = type"
          >
            {{ type === 'emotion' ? '🎭 Emotion' : '🎬 Genre' }}
          </button>
        </div>
      </div>

      <!-- Tag suggestions -->
      <div class="flex flex-col gap-2">
        <label class="text-xs text-white/40 uppercase tracking-wider font-semibold">Tags</label>
        <div class="flex flex-wrap gap-2 mb-2">
          <button
            v-for="s in tagSuggestions"
            :key="s"
            type="button"
            class="px-3 py-1 rounded-full text-xs transition border"
            :style="newPlaylist.tagsInput.includes(s)
              ? 'background: rgba(124,58,237,0.3); color: #a78bfa; border-color: rgba(124,58,237,0.4);'
              : 'background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.4); border-color: rgba(255,255,255,0.1);'"
            @click="addTagSuggestion(s)"
          >
            {{ s }}
          </button>
        </div>
        <input v-model="newPlaylist.tagsInput" type="text" placeholder="Or type your own, comma-separated…"
               class="lib-input" />
      </div>

      <!-- Description (optional) -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-white/40 uppercase tracking-wider font-semibold">Description <span class="text-white/20">(optional — auto-generated from tags)</span></label>
        <textarea v-model="newPlaylist.description" placeholder="Leave blank to auto-generate…"
                  rows="2" class="lib-input resize-none"></textarea>
      </div>

      <div v-show="createError" class="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
        {{ createError }}
      </div>

      <div class="flex gap-3">
        <button type="button"
                class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                style="background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.5);"
                @click="showCreateForm = false">Cancel</button>
        <button type="button"
                class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                style="background: linear-gradient(135deg, #5b21b6, #7c3aed); color: white;"
                :disabled="creating || !newPlaylist.title.trim()"
                @click="createPlaylist">
          <i v-show="creating" class="fa-solid fa-circle-notch fa-spin text-xs"></i>
          Create Playlist
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 overflow-x-auto border-b border-white/10 pb-1 -mb-1" style="scrollbar-width: none;">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition shrink-0"
        :class="activeTab === tab.id ? 'text-white border-b-2 border-purple-500' : 'text-white/40 hover:text-white/70'"
        @click="onTabChange(tab.id)"
      >
        <i :class="`fa-solid ${tab.icon} text-xs`"></i>
        {{ t[tab.labelKey] || tab.id }}
        <span class="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{{ countFor(tab.id) }}</span>
      </button>
    </div>

    <!-- Content: Library tabs (liked/watchlist/watched) -->
    <div v-show="activeTab !== 'history' && activeTab !== 'playlists' && activeTab !== 'streaming'">
      <div v-show="currentList.length === 0"
           class="flex flex-col items-center gap-4 py-20 text-white/30">
        <i class="fa-solid fa-box-open text-4xl"></i>
        <p class="text-sm">{{ t.empty }}</p>
      </div>

      <div v-show="currentList.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div
          v-for="item in currentList"
          :key="`${item.type}-${item.id}`"
          class="group relative flex flex-col rounded-xl overflow-hidden cursor-pointer bg-white/5 border border-white/10 hover:border-purple-500/40 transition"
          @click="goDetail(item)"
        >
          <div class="relative w-full h-48 overflow-hidden bg-[#12121A]">
            <img v-if="item.poster" :src="item.poster" :alt="item.title" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
            <div v-else class="w-full h-full flex items-center justify-center text-white/20">
              <i class="fa-solid fa-film text-2xl"></i>
            </div>
          </div>
          <div class="p-3 flex flex-col gap-1">
            <p class="text-white/90 text-xs font-semibold line-clamp-2">{{ item.title }}</p>
            <p class="text-white/40 text-[10px]">{{ item.year }}</p>
          </div>
          <div class="flex border-t border-white/5" @click.stop>
            <button
              v-show="activeTab === 'liked'"
              type="button"
              class="flex-1 py-2 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition flex items-center justify-center gap-1"
              @click="toggleLike(item)"
            >
              <i class="fa-solid fa-heart-crack text-[10px]"></i> Remove
            </button>
            <button
              v-show="activeTab === 'watchlist'"
              type="button"
              class="flex-1 py-2 text-xs text-white/40 hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-1"
              @click="toggleWatchlist(item)"
            >
              <i class="fa-solid fa-bookmark-slash text-[10px]"></i> Remove
            </button>
            <button
              v-show="activeTab === 'watched'"
              type="button"
              class="flex-1 py-2 text-xs text-white/40 hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-1"
              @click="toggleWatched(item)"
            >
              <i class="fa-solid fa-xmark text-[10px]"></i> Unmark
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Content: Streaming History -->
    <div v-show="activeTab === 'streaming'" class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <p class="text-white/40 text-sm">Titles you've watched directly in Tazama.</p>
        <button
          v-if="streamHistory.length"
          type="button"
          class="text-xs text-red-400/60 hover:text-red-400 transition border border-red-500/20 hover:border-red-500/40 px-3 py-1.5 rounded-lg"
          @click="clearStreamHistory"
        >
          Clear All
        </button>
      </div>

      <div v-if="!streamHistory.length" class="flex flex-col items-center gap-4 py-20 text-white/30">
        <i class="fa-solid fa-play-circle text-4xl"></i>
        <p class="text-sm">No streams yet — watch something on a detail page!</p>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div
          v-for="item in streamHistory"
          :key="`${item.type}-${item.id}`"
          class="group relative flex flex-col rounded-xl overflow-hidden cursor-pointer bg-white/5 border border-white/10 hover:border-red-500/30 transition"
          @click="router.push({ name: 'detail', params: { type: item.type, id: item.id } })"
        >
          <div class="relative w-full h-48 overflow-hidden bg-[#12121A]">
            <img
              v-if="item.poster"
              :src="item.poster"
              :alt="item.title"
              class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-white/20">
              <i class="fa-solid fa-film text-2xl"></i>
            </div>
            <!-- Play overlay -->
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <div class="w-10 h-10 rounded-full bg-red-500/90 flex items-center justify-center">
                <i class="fa-solid fa-play text-white text-sm ml-0.5"></i>
              </div>
            </div>
            <!-- TV badge -->
            <div v-if="item.type === 'tv' && item.episode" class="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-[10px] text-white/70">
              S{{ item.season }} E{{ item.episode }}
            </div>
          </div>
          <div class="p-3 flex flex-col gap-1 flex-1">
            <p class="text-white/90 text-xs font-semibold line-clamp-2">{{ item.title }}</p>
            <p v-if="item.watchedAt" class="text-white/30 text-[10px] mt-auto">
              {{ new Date(item.watchedAt).toLocaleDateString() }}
            </p>
          </div>
          <!-- Remove button -->
          <button
            type="button"
            class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white/40 hover:text-red-400 transition items-center justify-center opacity-0 group-hover:opacity-100 flex"
            @click.stop="removeFromStreamHistory(item.id, item.type)"
          >
            <i class="fa-solid fa-xmark text-[10px]"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Content: History -->
    <div v-show="activeTab === 'history'" class="flex flex-col gap-2">
      <div v-show="history.length === 0" class="flex flex-col items-center gap-4 py-20 text-white/30">
        <i class="fa-solid fa-box-open text-4xl"></i>
        <p class="text-sm">{{ t.empty }}</p>
      </div>
      <div
        v-for="(entry, i) in history"
        :key="i"
        class="flex items-center gap-4 p-4 rounded-xl bg-white/3 hover:bg-white/5 transition"
      >
        <i class="fa-solid fa-play-circle text-purple-400/60 text-lg shrink-0"></i>
        <div class="flex-1">
          <p class="text-white/80 text-sm font-medium">{{ entry.title }}</p>
          <p v-if="entry.platform" class="text-white/40 text-xs mt-0.5">{{ entry.platform }}</p>
        </div>
        <span v-if="entry.addedAt" class="text-white/30 text-xs shrink-0">
          {{ new Date(entry.addedAt).toLocaleDateString() }}
        </span>
      </div>
    </div>

    <!-- Content: Playlists -->
    <div v-show="activeTab === 'playlists'" class="flex flex-col gap-4">
      <div v-show="loadingPlaylists" class="flex justify-center py-12">
        <div class="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
      </div>

      <div v-show="!loadingPlaylists && playlists.length === 0"
           class="flex flex-col items-center gap-4 py-20 text-white/30">
        <i class="fa-solid fa-list text-4xl"></i>
        <p class="text-sm">No playlists yet</p>
        <p class="text-white/20 text-xs">Create your first curated collection 🎬</p>
      </div>

      <div v-show="!loadingPlaylists && playlists.length > 0" class="flex flex-col gap-3">
        <div
          v-for="pl in playlists"
          :key="pl.id"
          class="rounded-2xl border border-white/10 overflow-hidden transition"
          style="background: rgba(255,255,255,0.03);"
        >
          <!-- Playlist header -->
          <div class="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/3 transition" @click="openPlaylist(pl)">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
                 style="background: rgba(124,58,237,0.2); border: 1px solid rgba(124,58,237,0.3);">
              🎬
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-white font-semibold text-sm">{{ pl.title }}</p>
              <p v-if="pl.description" class="text-white/40 text-xs mt-0.5 truncate">{{ pl.description }}</p>
              <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  v-for="tag in pl.tags.slice(0, 4)"
                  :key="tag"
                  class="text-[10px] px-2 py-0.5 rounded-full"
                  style="background: rgba(124,58,237,0.2); color: #a78bfa; border: 1px solid rgba(124,58,237,0.25);"
                >{{ tag }}</span>
                <span class="text-white/30 text-[10px]">{{ pl.item_count }} title{{ pl.item_count !== 1 ? 's' : '' }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 shrink-0" @click.stop>
              <!-- Share toggle -->
              <button
                type="button"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border"
                :style="pl.is_shared
                  ? 'background: rgba(16,185,129,0.15); color: #34d399; border-color: rgba(16,185,129,0.3);'
                  : 'background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); border-color: rgba(255,255,255,0.1);'"
                @click="toggleShare(pl)"
              >
                <i :class="pl.is_shared ? 'fa-solid fa-share-nodes' : 'fa-solid fa-lock'" class="text-[10px]"></i>
                {{ pl.is_shared ? 'Shared' : 'Private' }}
              </button>

              <!-- Delete -->
              <button
                type="button"
                class="w-8 h-8 rounded-lg flex items-center justify-center text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition"
                @click="deletePlaylist(pl)"
              >
                <i class="fa-solid fa-trash-can text-[11px]"></i>
              </button>

              <i class="fa-solid fa-chevron-down text-white/20 text-xs transition"
                 :style="expandedPlaylist?.id === pl.id ? 'transform: rotate(180deg);' : ''"></i>
            </div>
          </div>

          <!-- Expanded items -->
          <div v-show="expandedPlaylist?.id === pl.id" class="border-t border-white/8">
            <div v-show="!expandedPlaylist?.items?.length" class="py-8 text-center text-white/30 text-sm">
              This playlist is empty — add titles from your library
            </div>
            <div v-show="expandedPlaylist?.items?.length" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 p-4">
              <div
                v-for="item in expandedPlaylist?.items"
                :key="`${item.tmdb_id}-${item.media_type}`"
                class="relative group cursor-pointer rounded-lg overflow-hidden"
                @click="router.push({ name: 'detail', params: { type: item.media_type, id: item.tmdb_id } })"
              >
                <div class="w-full aspect-[2/3] bg-white/5 rounded-lg overflow-hidden">
                  <img v-if="item.poster_path"
                       :src="`https://image.tmdb.org/t/p/w185${item.poster_path.startsWith('/') ? '' : '/'}${item.poster_path}`"
                       :alt="item.title"
                       class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                  <div v-else class="w-full h-full flex items-center justify-center text-white/20">
                    <i class="fa-solid fa-film text-lg"></i>
                  </div>
                </div>
                <!-- Remove overlay -->
                <button
                  type="button"
                  class="absolute top-1 right-1 w-6 h-6 rounded-full items-center justify-center bg-red-500/80 text-white text-[10px] opacity-0 group-hover:opacity-100 transition flex"
                  @click.stop="removeFromPlaylist(pl.id, item.tmdb_id, item.media_type)"
                >
                  <i class="fa-solid fa-xmark"></i>
                </button>
                <p class="text-white/70 text-[10px] mt-1 truncate">{{ item.title }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.lib-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
  padding: 10px 14px;
  color: white;
  font-size: 14px;
  width: 100%;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
}
.lib-input::placeholder { color: rgba(255,255,255,0.25); }
.lib-input:focus { border-color: rgba(124,58,237,0.6); }
</style>
