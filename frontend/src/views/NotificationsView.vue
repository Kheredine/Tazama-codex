<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'
import { useRouter } from 'vue-router'

const { apiFetch } = useAuth()
const { t, lang }  = useI18n()
const router       = useRouter()

const notifications = ref([])
const loading       = ref(true)

onMounted(async () => {
  try {
    const data = await apiFetch('/api/social/notifications')
    notifications.value = data.notifications || []
    // Mark all as read after viewing
    if (notifications.value.some(n => !n.is_read)) {
      await apiFetch('/api/social/notifications/read', { method: 'PUT', body: JSON.stringify({}) })
    }
  } catch { /* ignore */ }
  finally { loading.value = false }
})

const unread = computed(() => notifications.value.filter(n => !n.is_read).length)

const TYPE_ICONS = {
  connect:   { icon: 'fa-user-plus',    color: '#a78bfa' },
  like:      { icon: 'fa-heart',        color: '#f472b6' },
  watchlist: { icon: 'fa-bookmark',     color: '#60a5fa' },
  watched:   { icon: 'fa-check-circle', color: '#34d399' },
  dislike:   { icon: 'fa-thumbs-down',  color: '#fb923c' },
}

const getIcon = (type) => TYPE_ICONS[type] || { icon: 'fa-bell', color: '#a78bfa' }

const timeAgo = (ts) => {
  const diff = Math.floor((Date.now() / 1000) - ts)
  if (diff < 60)      return 'just now'
  if (diff < 3600)    return `${Math.floor(diff/60)}m ago`
  if (diff < 86400)   return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
}

const goToProfile = (fromUserId) => {
  if (fromUserId) router.push({ name: 'user-profile', params: { id: fromUserId } })
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-4 flex flex-col gap-5">

    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(124,58,237,0.2);">
          <i class="fa-solid fa-bell text-purple-400"></i>
        </div>
        <h1 class="text-xl font-bold text-white">{{ t.notificationsTitle }}</h1>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-16">
      <div class="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="!notifications.length"
         class="flex flex-col items-center gap-4 py-20 text-center">
      <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
        <i class="fa-solid fa-bell-slash text-white/20 text-2xl"></i>
      </div>
      <p class="text-white/35 text-sm">{{ t.noNotifications }}</p>
    </div>

    <!-- List -->
    <div v-else class="flex flex-col gap-2">
      <div
        v-for="n in notifications"
        :key="n.id"
        class="flex items-start gap-4 p-4 rounded-xl border transition cursor-pointer"
        :class="n.is_read ? 'border-white/6 bg-white/2 hover:bg-white/4' : 'border-purple-500/25 bg-purple-500/6 hover:bg-purple-500/10'"
        @click="goToProfile(n.from_user_id)"
      >
        <!-- From avatar -->
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
          style="background: rgba(124,58,237,0.25);"
        >
          {{ n.from_avatar || '🎬' }}
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <p class="text-sm text-white/80 leading-snug">{{ n.content }}</p>
          <div class="flex items-center gap-2 mt-1.5">
            <i :class="`fa-solid ${getIcon(n.type).icon} text-[10px]`" :style="`color: ${getIcon(n.type).color}`"></i>
            <span class="text-[11px] text-white/30">{{ timeAgo(n.created_at) }}</span>
          </div>
        </div>

        <!-- Unread dot -->
        <div v-if="!n.is_read" class="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0 mt-1.5"></div>
      </div>
    </div>

  </div>
</template>
