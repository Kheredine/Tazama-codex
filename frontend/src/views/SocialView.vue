<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'

const router = useRouter()
const { apiFetch } = useAuth()
const { lang } = useI18n()

const sharedPlaylists = ref([])
const pendingRequests = ref([])
const loadingFeed = ref(true)
const loadingRequests = ref(true)
const actionLoading = ref({})

const loadFeed = async () => {
  loadingFeed.value = true
  try {
    const data = await apiFetch('/api/playlists/shared')
    sharedPlaylists.value = data.playlists || []
  } catch {
    sharedPlaylists.value = []
  } finally {
    loadingFeed.value = false
  }
}

const loadPendingRequests = async () => {
  try {
    const data = await apiFetch('/api/social/pending-requests')
    pendingRequests.value = data.requests || []
  } catch {
    pendingRequests.value = []
  } finally {
    loadingRequests.value = false
  }
}

const acceptRequest = async (req) => {
  actionLoading.value[req.id] = true
  try {
    await apiFetch(`/api/social/request/${req.id}/accept`, { method: 'PUT' })
    pendingRequests.value = pendingRequests.value.filter((r) => r.id !== req.id)
    await loadFeed()
  } catch {
    // keep current state on failure
  } finally {
    delete actionLoading.value[req.id]
  }
}

const refuseRequest = async (req) => {
  actionLoading.value[req.id] = true
  try {
    await apiFetch(`/api/social/request/${req.id}/refuse`, { method: 'PUT' })
    pendingRequests.value = pendingRequests.value.filter((r) => r.id !== req.id)
  } catch {
    // keep current state on failure
  } finally {
    delete actionLoading.value[req.id]
  }
}

const formatDate = (ts) => {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString(
    lang.value === 'fr' ? 'fr-FR' : 'en-US',
    { month: 'short', day: 'numeric' },
  )
}

onMounted(() => {
  loadFeed()
  loadPendingRequests()
})
</script>

<template>
  <div class="flex flex-col gap-8 pb-12 max-w-2xl">
    <div class="pt-2">
      <h1 class="text-2xl font-bold text-white flex items-center gap-2">
        <i class="fa-solid fa-users text-purple-400 text-xl"></i>
        Social Feed
      </h1>
      <p class="text-white/40 text-sm mt-1">Shared playlist posts from the Tazama community</p>
    </div>

    <section v-show="!loadingRequests && pendingRequests.length > 0">
      <h2 class="text-xs uppercase tracking-widest text-white/40 font-semibold mb-3">
        <i class="fa-solid fa-film mr-1.5 text-purple-400/60"></i>
        Reel Mate Requests
        <span
          class="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style="background: rgba(124,58,237,0.3); color: #a78bfa;"
        >
          {{ pendingRequests.length }}
        </span>
      </h2>

      <div class="flex flex-col gap-3">
        <div
          v-for="req in pendingRequests"
          :key="req.id"
          class="flex items-center gap-4 p-4 rounded-2xl border border-purple-500/20"
          style="background: rgba(124,58,237,0.06);"
        >
          <div
            class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            :style="req.plan === 'premium'
              ? 'background: linear-gradient(135deg, #d97706, #f59e0b);'
              : 'background: linear-gradient(135deg, #5b21b6, #7c3aed);'"
          >
            {{ req.avatar || 'T' }}
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-white font-semibold text-sm">{{ req.username }}</p>
            <p class="text-white/40 text-xs mt-0.5">Wants to be your Reel Mate.</p>
          </div>

          <div class="flex gap-2 shrink-0">
            <button
              type="button"
              class="px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-1.5"
              style="background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.3);"
              :disabled="actionLoading[req.id]"
              @click="acceptRequest(req)"
            >
              <i v-show="actionLoading[req.id]" class="fa-solid fa-circle-notch fa-spin text-xs"></i>
              <i v-show="!actionLoading[req.id]" class="fa-solid fa-check text-xs"></i>
              Accept
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1.5"
              style="background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.1);"
              :disabled="actionLoading[req.id]"
              @click="refuseRequest(req)"
            >
              <i class="fa-solid fa-xmark text-xs"></i>
              Decline
            </button>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div v-show="loadingFeed" class="flex justify-center py-16">
        <div class="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
      </div>

      <div
        v-show="!loadingFeed && sharedPlaylists.length === 0"
        class="flex flex-col items-center gap-5 py-20 text-center"
      >
        <div
          class="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
          style="background: rgba(124,58,237,0.1); border: 1px solid rgba(124,58,237,0.2);"
        >
          T
        </div>
        <div>
          <p class="text-white/50 font-semibold mb-1">Nothing in the feed yet</p>
          <p class="text-white/30 text-sm max-w-xs">
            When people share playlists, they appear here as posts for everyone to explore.
            <br><span class="text-purple-400/60 text-xs mt-1 block">Search for users in the top bar to discover profiles and posts.</span>
          </p>
        </div>
        <button
          type="button"
          class="px-5 py-2.5 rounded-xl text-sm font-semibold transition"
          style="background: rgba(124,58,237,0.2); color: #a78bfa; border: 1px solid rgba(124,58,237,0.3);"
          @click="router.push('/discover')"
        >
          <i class="fa-solid fa-compass mr-2"></i>Explore instead
        </button>
      </div>

      <div v-show="!loadingFeed && sharedPlaylists.length > 0" class="flex flex-col gap-4">
        <div
          v-for="pl in sharedPlaylists"
          :key="pl.id"
          class="rounded-2xl border border-white/10 overflow-hidden"
          style="background: rgba(255,255,255,0.03);"
        >
          <div class="flex items-center gap-3 px-5 py-4 border-b border-white/6">
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              :style="pl.plan === 'premium'
                ? 'background: linear-gradient(135deg, #d97706, #f59e0b);'
                : 'background: linear-gradient(135deg, #5b21b6, #7c3aed);'"
            >
              {{ pl.avatar || 'T' }}
            </div>
            <div class="flex-1 min-w-0">
              <button
                type="button"
                class="text-white text-sm font-semibold hover:text-purple-300 transition"
                @click="router.push(`/profile/${pl.user_id}`)"
              >
                {{ pl.username }}
              </button>
              <p class="text-white/30 text-xs mt-0.5">shared a playlist post · {{ formatDate(pl.created_at) }}</p>
            </div>
          </div>

          <div class="p-5">
            <h3 class="text-white font-bold text-base mb-1">{{ pl.title }}</h3>
            <p v-if="pl.description" class="text-white/45 text-sm mb-3">{{ pl.description }}</p>

            <div class="flex flex-wrap gap-1.5 mb-4">
              <span
                v-for="tag in pl.tags.slice(0, 5)"
                :key="tag"
                class="text-[11px] px-2.5 py-1 rounded-full"
                style="background: rgba(124,58,237,0.18); color: #a78bfa; border: 1px solid rgba(124,58,237,0.25);"
              >{{ tag }}</span>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-white/30 text-sm">
                <i class="fa-solid fa-film text-purple-400/50 mr-1.5"></i>
                {{ pl.item_count }} title{{ pl.item_count !== 1 ? 's' : '' }}
              </span>
              <button
                type="button"
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
                style="background: rgba(124,58,237,0.2); color: #a78bfa; border: 1px solid rgba(124,58,237,0.3);"
                @click="router.push(`/profile/${pl.user_id}`)"
              >
                <i class="fa-solid fa-arrow-right text-xs"></i>
                View Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
