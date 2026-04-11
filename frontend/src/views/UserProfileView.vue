<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'

const route = useRoute()
const router = useRouter()
const { apiFetch, user: me } = useAuth()
const { t, lang } = useI18n()

const profile = ref(null)
const loading = ref(true)
const error = ref(null)
const actionLoading = ref(false)
const connectionStatus = ref('none')
const pendingRequestId = ref(null)
const mateCount = ref(0)

const IMG_BASE = 'https://image.tmdb.org/t/p/w185'

const isMe = computed(() => me.value?.id === profile.value?.user?.id)

const memberSince = computed(() => {
  const ts = profile.value?.user?.memberSince
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString(
    lang.value === 'fr' ? 'fr-FR' : 'en-US',
    { month: 'long', year: 'numeric' },
  )
})

const loadProfile = async () => {
  loading.value = true
  error.value = null
  try {
    const data = await apiFetch(`/api/user/public/${route.params.id}`)
    profile.value = data
    mateCount.value = data.mateCount || 0
  } catch (err) {
    error.value = err.message || 'Profile not found'
    profile.value = null
  } finally {
    loading.value = false
  }
}

const loadStatus = async () => {
  if (!profile.value || isMe.value) return
  try {
    const data = await apiFetch(`/api/social/status/${route.params.id}`)
    connectionStatus.value = data.connectionStatus
    pendingRequestId.value = data.requestId
    mateCount.value = data.mateCount ?? mateCount.value
  } catch {
    connectionStatus.value = 'none'
  }
}

const reloadProfilePage = async () => {
  await loadProfile()
  if (!isMe.value) await loadStatus()
}

onMounted(reloadProfilePage)
watch(() => route.params.id, reloadProfilePage)

const sendRequest = async () => {
  if (actionLoading.value) return
  actionLoading.value = true
  try {
    await apiFetch(`/api/social/request/${route.params.id}`, { method: 'POST' })
    connectionStatus.value = 'pending_sent'
  } finally {
    actionLoading.value = false
  }
}

const acceptRequest = async () => {
  if (actionLoading.value || !pendingRequestId.value) return
  actionLoading.value = true
  try {
    await apiFetch(`/api/social/request/${pendingRequestId.value}/accept`, { method: 'PUT' })
    connectionStatus.value = 'connected'
    mateCount.value += 1
  } finally {
    actionLoading.value = false
  }
}

const refuseRequest = async () => {
  if (actionLoading.value || !pendingRequestId.value) return
  actionLoading.value = true
  try {
    await apiFetch(`/api/social/request/${pendingRequestId.value}/refuse`, { method: 'PUT' })
    connectionStatus.value = 'none'
    pendingRequestId.value = null
  } finally {
    actionLoading.value = false
  }
}

const disconnect = async () => {
  if (actionLoading.value) return
  actionLoading.value = true
  try {
    await apiFetch(`/api/social/connect/${route.params.id}`, { method: 'DELETE' })
    connectionStatus.value = 'none'
    mateCount.value = Math.max(0, mateCount.value - 1)
  } finally {
    actionLoading.value = false
  }
}

const goToDetail = (item) => {
  router.push({ name: 'detail', params: { type: item.type, id: item.id } })
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-4 flex flex-col gap-6">
    <button
      type="button"
      @click="router.back()"
      class="self-start flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-purple-500/40 transition text-sm"
    >
      <i class="fa-solid fa-arrow-left text-xs"></i>{{ t.backBtn }}
    </button>

    <div v-show="loading" class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
    </div>

    <div v-show="!loading && error" class="text-center py-16 flex flex-col items-center gap-4">
      <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
        <i class="fa-solid fa-user-slash text-white/20 text-2xl"></i>
      </div>
      <p class="text-white/40 text-sm">{{ t.profileNotFound }}</p>
    </div>

    <template v-if="!loading && !error && profile">
      <div
        class="p-6 rounded-2xl border border-white/8 flex flex-col sm:flex-row items-center sm:items-start gap-5"
        style="background: rgba(255,255,255,0.03);"
      >
        <div
          class="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 shadow-lg"
          :style="profile.user.plan === 'premium'
            ? 'background: linear-gradient(135deg, #d97706, #f59e0b); box-shadow: 0 4px 24px rgba(217,119,6,0.3);'
            : 'background: linear-gradient(135deg, #5b21b6, #7c3aed); box-shadow: 0 4px 24px rgba(124,58,237,0.3);'"
        >
          {{ profile.user.avatar || 'T' }}
        </div>

        <div class="flex-1 text-center sm:text-left">
          <div class="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <h1 class="text-2xl font-bold text-white">{{ profile.user.username }}</h1>
            <span
              v-show="profile.user.plan === 'premium'"
              class="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style="background: rgba(217,119,6,0.2); color: #fbbf24; border: 1px solid rgba(217,119,6,0.3);"
            >
              <i class="fa-solid fa-crown text-[9px]"></i> Premium
            </span>
          </div>

          <div v-show="profile.user.watcher_title" class="mt-1.5 flex justify-center sm:justify-start">
            <span
              class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1"
              style="background: rgba(124,58,237,0.18); color: #c4b5fd; border: 1px solid rgba(124,58,237,0.3);"
            >
              {{ profile.user.watcher_title }}
            </span>
          </div>

          <p v-show="profile.user.bio" class="text-white/45 text-sm mt-2 italic">{{ profile.user.bio }}</p>
          <p v-show="memberSince" class="text-white/25 text-xs mt-1">{{ t.memberSince }} {{ memberSince }}</p>

          <div class="flex items-center justify-center sm:justify-start gap-2 mt-3">
            <div class="text-center">
              <p class="text-white font-bold text-lg leading-none">{{ mateCount }}</p>
              <p class="text-white/35 text-xs mt-1">Reel Mates</p>
            </div>
          </div>
        </div>

        <div v-show="!isMe" class="flex-shrink-0 flex flex-col gap-2">
          <button
            v-show="connectionStatus === 'none'"
            type="button"
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition text-white"
            style="background: linear-gradient(135deg, #5b21b6, #7c3aed);"
            :disabled="actionLoading"
            @click="sendRequest"
          >
            <i v-show="actionLoading" class="fa-solid fa-circle-notch fa-spin text-xs"></i>
            <i v-show="!actionLoading" class="fa-solid fa-film text-xs"></i>
            Beam Into Credits
          </button>

          <button
            v-show="connectionStatus === 'pending_sent'"
            type="button"
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border border-white/15 text-white/40 cursor-not-allowed"
            disabled
          >
            <i class="fa-solid fa-clock text-xs"></i>
            Request Sent
          </button>

          <div v-show="connectionStatus === 'pending_received'" class="flex flex-col gap-2">
            <button
              type="button"
              class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition text-white"
              style="background: #059669;"
              :disabled="actionLoading"
              @click="acceptRequest"
            >
              <i v-show="actionLoading" class="fa-solid fa-circle-notch fa-spin text-xs"></i>
              <i v-show="!actionLoading" class="fa-solid fa-check text-xs"></i>
              Accept
            </button>
            <button
              type="button"
              class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition text-white"
              style="background: #dc2626;"
              :disabled="actionLoading"
              @click="refuseRequest"
            >
              <i class="fa-solid fa-xmark text-xs"></i>
              Decline
            </button>
          </div>

          <button
            v-show="connectionStatus === 'connected'"
            type="button"
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition"
            style="border-color: rgba(5,150,105,0.4); color: #34d399; background: rgba(5,150,105,0.08);"
            :disabled="actionLoading"
            @click="disconnect"
          >
            <i v-show="actionLoading" class="fa-solid fa-circle-notch fa-spin text-xs"></i>
            <i v-show="!actionLoading" class="fa-solid fa-check-circle text-xs"></i>
            Reel Mates
          </button>
        </div>
      </div>

      <section class="flex flex-col gap-4">
        <h2 class="text-xs uppercase tracking-widest text-white/40 font-medium flex items-center gap-2">
          <i class="fa-solid fa-bullhorn text-purple-400/60 text-xs"></i>
          Posts ({{ profile.posts?.length || 0 }})
        </h2>

        <div v-if="profile.posts?.length" class="flex flex-col gap-4">
          <article
            v-for="post in profile.posts"
            :key="post.id"
            class="rounded-2xl border border-white/10 p-5"
            style="background: rgba(255,255,255,0.03);"
          >
            <p class="text-white font-semibold">{{ post.title }}</p>
            <p v-if="post.description" class="text-white/45 text-sm mt-2">{{ post.description }}</p>

            <div class="flex flex-wrap gap-1.5 mt-3">
              <span
                v-for="tag in post.tags.slice(0, 5)"
                :key="tag"
                class="text-[11px] px-2.5 py-1 rounded-full"
                style="background: rgba(124,58,237,0.18); color: #a78bfa; border: 1px solid rgba(124,58,237,0.25);"
              >{{ tag }}</span>
            </div>

            <div class="flex items-center justify-between mt-4 text-sm text-white/35">
              <span>{{ post.item_count }} title{{ post.item_count !== 1 ? 's' : '' }}</span>
              <span>{{ new Date(post.created_at * 1000).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US') }}</span>
            </div>
          </article>
        </div>

        <p v-else class="text-white/30 text-sm italic">No shared posts yet.</p>
      </section>

      <section v-show="profile.liked !== null" class="flex flex-col gap-4">
        <h2 class="text-xs uppercase tracking-widest text-white/40 font-medium flex items-center gap-2">
          <i class="fa-solid fa-heart text-pink-500/60 text-xs"></i>
          {{ t.myLikes }} ({{ profile.liked?.length || 0 }})
        </h2>
        <div v-show="profile.liked?.length" class="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <div
            v-for="item in (profile.liked || []).slice(0, 10)"
            :key="`liked-${item.id}`"
            class="cursor-pointer rounded-xl overflow-hidden border border-white/8 hover:border-purple-500/40 transition"
            @click="goToDetail(item)"
          >
            <img v-show="item.poster" :src="`${IMG_BASE}${(item.poster || '').replace(/^.*\/p\/w\d+/,'')}`" :alt="item.title" class="w-full aspect-[2/3] object-cover" />
            <div v-show="!item.poster" class="w-full aspect-[2/3] bg-white/5 flex items-center justify-center">
              <i class="fa-solid fa-film text-white/20"></i>
            </div>
          </div>
        </div>
        <p v-show="!profile.liked?.length" class="text-white/30 text-sm italic">{{ t.empty }}</p>
      </section>
      <div v-show="profile.liked === null" class="p-4 rounded-xl bg-white/3 border border-white/7 text-white/30 text-sm">
        <i class="fa-solid fa-lock mr-2 text-xs"></i>{{ t.libraryPrivate }}
      </div>

      <section v-show="profile.watchlist !== null" class="flex flex-col gap-4">
        <h2 class="text-xs uppercase tracking-widest text-white/40 font-medium flex items-center gap-2">
          <i class="fa-solid fa-bookmark text-blue-400/60 text-xs"></i>
          {{ t.myWatchlist }} ({{ profile.watchlist?.length || 0 }})
        </h2>
        <div v-show="profile.watchlist?.length" class="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <div
            v-for="item in (profile.watchlist || []).slice(0, 10)"
            :key="`wl-${item.id}`"
            class="cursor-pointer rounded-xl overflow-hidden border border-white/8 hover:border-blue-500/40 transition"
            @click="goToDetail(item)"
          >
            <img v-show="item.poster" :src="`${IMG_BASE}${(item.poster || '').replace(/^.*\/p\/w\d+/,'')}`" :alt="item.title" class="w-full aspect-[2/3] object-cover" />
            <div v-show="!item.poster" class="w-full aspect-[2/3] bg-white/5 flex items-center justify-center">
              <i class="fa-solid fa-film text-white/20"></i>
            </div>
          </div>
        </div>
        <p v-show="!profile.watchlist?.length" class="text-white/30 text-sm italic">{{ t.empty }}</p>
      </section>
      <div v-show="profile.watchlist === null" class="p-4 rounded-xl bg-white/3 border border-white/7 text-white/30 text-sm">
        <i class="fa-solid fa-lock mr-2 text-xs"></i>{{ t.libraryPrivate }}
      </div>

      <section v-show="profile.watched !== null" class="flex flex-col gap-4">
        <h2 class="text-xs uppercase tracking-widest text-white/40 font-medium flex items-center gap-2">
          <i class="fa-solid fa-check-circle text-green-400/60 text-xs"></i>
          {{ t.myWatched }} ({{ profile.watched?.length || 0 }})
        </h2>
        <div v-show="profile.watched?.length" class="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <div
            v-for="item in (profile.watched || []).slice(0, 10)"
            :key="`wd-${item.id}`"
            class="cursor-pointer rounded-xl overflow-hidden border border-white/8 hover:border-green-500/40 transition"
            @click="goToDetail(item)"
          >
            <img v-show="item.poster" :src="`${IMG_BASE}${(item.poster || '').replace(/^.*\/p\/w\d+/,'')}`" :alt="item.title" class="w-full aspect-[2/3] object-cover" />
            <div v-show="!item.poster" class="w-full aspect-[2/3] bg-white/5 flex items-center justify-center">
              <i class="fa-solid fa-film text-white/20"></i>
            </div>
          </div>
        </div>
        <p v-show="!profile.watched?.length" class="text-white/30 text-sm italic">{{ t.empty }}</p>
      </section>
      <div v-show="profile.watched === null" class="p-4 rounded-xl bg-white/3 border border-white/7 text-white/30 text-sm">
        <i class="fa-solid fa-lock mr-2 text-xs"></i>{{ t.libraryPrivate }}
      </div>
    </template>
  </div>
</template>
