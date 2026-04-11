<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuth } from '@/composables/useAuth'

const { apiFetch, user } = useAuth()

// ── State ─────────────────────────────────────────────────────────────────
const conversations   = ref([])
const activeUserId    = ref(null)
const messages        = ref([])
const otherUser       = ref(null)
const newMessage      = ref('')
const loadingConvs    = ref(true)
const loadingThread   = ref(false)
const sending         = ref(false)
const threadEl        = ref(null)
let   pollTimer       = null

// ── Load conversations ────────────────────────────────────────────────────
const loadConversations = async () => {
  try {
    const data = await apiFetch('/api/messages/conversations')
    conversations.value = data.conversations || []
  } catch { /* ignore */ }
  finally { loadingConvs.value = false }
}

// ── Open a thread ─────────────────────────────────────────────────────────
const openThread = async (userId) => {
  activeUserId.value  = userId
  loadingThread.value = true
  messages.value      = []
  otherUser.value     = null
  try {
    const data = await apiFetch(`/api/messages/${userId}`)
    messages.value  = data.messages  || []
    otherUser.value = data.otherUser || null
    await apiFetch(`/api/messages/${userId}/read`, { method: 'PUT' }).catch(() => {})
    const conv = conversations.value.find(c => c.userId === userId)
    if (conv) conv.unread = 0
    scrollToBottom()
  } catch { /* ignore */ }
  finally { loadingThread.value = false }
}

// ── Poll for new messages ─────────────────────────────────────────────────
const pollMessages = async () => {
  if (!activeUserId.value) return
  try {
    const data = await apiFetch(`/api/messages/${activeUserId.value}`)
    const newMsgs = data.messages || []
    if (newMsgs.length > messages.value.length) {
      messages.value = newMsgs
      await nextTick()
      scrollToBottom()
      await apiFetch(`/api/messages/${activeUserId.value}/read`, { method: 'PUT' }).catch(() => {})
    }
  } catch { /* ignore */ }
  loadConversations()
}

// ── Send message ──────────────────────────────────────────────────────────
const sendMessage = async () => {
  const content = newMessage.value.trim()
  if (!content || sending.value || !activeUserId.value) return
  sending.value = true
  newMessage.value = ''
  try {
    const data = await apiFetch(`/api/messages/${activeUserId.value}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
    messages.value.push(data.message)
    await nextTick()
    scrollToBottom()
    const conv = conversations.value.find(c => c.userId === activeUserId.value)
    if (conv) { conv.lastMessage = content; conv.lastAt = Math.floor(Date.now() / 1000) }
  } catch { /* ignore */ }
  finally { sending.value = false }
}

const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (threadEl.value) threadEl.value.scrollTop = threadEl.value.scrollHeight
  })
}

const formatTime = (ts) => {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const activeConv = computed(() => conversations.value.find(c => c.userId === activeUserId.value))

onMounted(async () => {
  await loadConversations()
  pollTimer = setInterval(pollMessages, 15000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4 pb-4" style="height: calc(100vh - 8rem); min-height: 400px;">

    <h1 class="text-2xl font-bold text-white shrink-0">Messages</h1>

    <div class="flex gap-4 flex-1 overflow-hidden">

      <!-- ── Sidebar: conversations list ─────────────────────────────────── -->
      <div class="w-64 shrink-0 flex flex-col rounded-2xl border border-white/8 overflow-hidden"
           style="background: rgba(255,255,255,0.025);">

        <div class="px-4 py-3 border-b border-white/8 shrink-0">
          <p class="text-xs font-semibold text-white/40 uppercase tracking-wider">Reel Mate Chats</p>
        </div>

        <!-- Loading -->
        <div v-show="loadingConvs" class="flex justify-center py-8">
          <div class="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
        </div>

        <!-- Empty state -->
        <div v-show="!loadingConvs && !conversations.length"
             class="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center flex-1">
          <i class="fa-solid fa-film text-3xl text-white/15"></i>
          <p class="text-white/30 text-xs">No Reel Mates yet — connect with someone to start chatting! 🎬</p>
        </div>

        <!-- Conversation list -->
        <div v-show="!loadingConvs && conversations.length" class="flex-1 overflow-y-auto">
          <button
            v-for="conv in conversations"
            :key="conv.userId"
            type="button"
            class="w-full flex items-center gap-3 p-4 text-left transition border-b border-white/5"
            :style="activeUserId === conv.userId
              ? 'background: rgba(124,58,237,0.12);'
              : 'background: transparent;'"
            @click="openThread(conv.userId)"
          >
            <div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                 :style="conv.plan === 'premium'
                   ? 'background: linear-gradient(135deg, #d97706, #f59e0b);'
                   : 'background: linear-gradient(135deg, #5b21b6, #7c3aed);'">
              {{ conv.avatar }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-1">
                <p class="text-white text-sm font-semibold truncate">{{ conv.username }}</p>
                <span v-show="conv.unread > 0"
                      class="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style="background: #7c3aed; color: white;">
                  {{ conv.unread }}
                </span>
              </div>
              <p class="text-white/35 text-xs truncate mt-0.5">
                {{ conv.lastMessage || 'Say hello! 🎬' }}
              </p>
            </div>
          </button>
        </div>
      </div>

      <!-- ── Thread area ──────────────────────────────────────────────────── -->
      <div class="flex-1 flex flex-col rounded-2xl border border-white/8 overflow-hidden"
           style="background: rgba(255,255,255,0.02);">

        <!-- No conversation selected -->
        <div v-show="!activeUserId" class="flex-1 flex flex-col items-center justify-center gap-4 text-white/30">
          <i class="fa-solid fa-comments text-4xl"></i>
          <p class="text-sm">Select a conversation to start chatting</p>
        </div>

        <!-- Active thread -->
        <template v-if="activeUserId">
          <!-- Header -->
          <div class="flex items-center gap-3 px-5 py-3 border-b border-white/8 shrink-0"
               style="background: rgba(255,255,255,0.02);">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                 :style="activeConv?.plan === 'premium'
                   ? 'background: linear-gradient(135deg, #d97706, #f59e0b);'
                   : 'background: linear-gradient(135deg, #5b21b6, #7c3aed);'">
              {{ activeConv?.avatar || '🎬' }}
            </div>
            <div>
              <p class="text-white font-semibold text-sm">{{ otherUser?.username || activeConv?.username }}</p>
              <p class="text-white/35 text-xs">Reel Mate</p>
            </div>
          </div>

          <!-- Messages scroll area -->
          <div ref="threadEl" class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">

            <div v-show="loadingThread" class="flex justify-center py-8">
              <div class="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
            </div>

            <div v-show="!loadingThread && !messages.length"
                 class="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <i class="fa-solid fa-film text-3xl text-white/15"></i>
              <p class="text-white/30 text-sm">No messages yet — say hello! 🎬</p>
            </div>

            <!-- Message bubbles -->
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="flex"
              :style="msg.from_user_id === user?.id ? 'justify-content: flex-end;' : 'justify-content: flex-start;'"
            >
              <div class="flex flex-col"
                   :style="msg.from_user_id === user?.id ? 'align-items: flex-end;' : 'align-items: flex-start;'">
                <div class="max-w-xs px-4 py-2.5 text-sm"
                     :style="msg.from_user_id === user?.id
                       ? 'background: linear-gradient(135deg, #5b21b6, #7c3aed); color: white; border-radius: 18px 18px 4px 18px;'
                       : 'background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); border-radius: 18px 18px 18px 4px;'">
                  {{ msg.content }}
                </div>
                <span class="text-[10px] text-white/25 mt-1 px-1">{{ formatTime(msg.created_at) }}</span>
              </div>
            </div>
          </div>

          <!-- Input area -->
          <div class="flex items-end gap-3 p-4 border-t border-white/8 shrink-0">
            <textarea
              v-model="newMessage"
              rows="1"
              class="flex-1 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none"
              style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.10); color: white; max-height: 100px;"
              placeholder="Type a message…"
              @keydown="handleKeydown"
            ></textarea>
            <button
              type="button"
              class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition"
              :style="newMessage.trim()
                ? 'background: linear-gradient(135deg, #5b21b6, #7c3aed); color: white;'
                : 'background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.25);'"
              :disabled="!newMessage.trim() || sending"
              @click="sendMessage"
            >
              <i v-show="sending" class="fa-solid fa-circle-notch fa-spin text-xs"></i>
              <i v-show="!sending" class="fa-solid fa-paper-plane text-xs"></i>
            </button>
          </div>
        </template>

      </div>
    </div>
  </div>
</template>
