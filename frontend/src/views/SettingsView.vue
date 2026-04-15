<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'
import { useUserLibrary } from '@/composables/useUserLibrary'
import { useUserPreferences } from '@/composables/useUserPreferences'
import { useWatcherTitle } from '@/composables/useWatcherTitle'

const router = useRouter()
const { user, isPremium, logout, apiFetch, updateUser } = useAuth()
const { t, lang, setLang } = useI18n()
const { liked, watchlist, watched, history } = useUserLibrary()
const { prefs, getTopMoods, interactionCount } = useUserPreferences()
const { watcherTitle, watcherLevel, loadTitle, syncLevel } = useWatcherTitle()

const AVATARS = ['T','🎭','🎥','🍿','🎞️','🦁','🌙','🔥','🎃','🌊','🐉','🌺','⭐','🎸','🌴','🏔️','🦋','🎯','🌌','🎨','🧠','👁️','🦅','🐺']

const editing = ref(false)
const saveLoading = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

const editForm = ref({
  username: '',
  email: '',
  avatar: '',
  bio: '',
  is_discoverable: true,
  privacy_liked: 'public',
  privacy_watchlist: 'public',
  privacy_watched: 'public',
})

const startEdit = () => {
  editForm.value = {
    username: user.value?.username || '',
    email: user.value?.email || '',
    avatar: user.value?.avatar || 'T',
    bio: user.value?.bio || '',
    is_discoverable: !isPremium.value ? true : (user.value?.is_discoverable !== 0),
    privacy_liked: user.value?.privacy_liked || 'public',
    privacy_watchlist: user.value?.privacy_watchlist || 'public',
    privacy_watched: user.value?.privacy_watched || 'public',
  }
  editing.value = true
  saveError.value = ''
  saveSuccess.value = false
}

const cancelEdit = () => {
  editing.value = false
  saveError.value = ''
}

const saveProfile = async () => {
  saveLoading.value = true
  saveError.value = ''
  try {
    const data = await apiFetch('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(editForm.value),
    })
    updateUser(data.user)
    editing.value = false
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (err) {
    saveError.value = err.message || 'Failed to save account details'
  } finally {
    saveLoading.value = false
  }
}

const pwForm = ref({ current: '', newPw: '' })
const pwLoading = ref(false)
const pwError = ref('')
const pwSuccess = ref(false)

const changePassword = async () => {
  pwLoading.value = true
  pwError.value = ''
  pwSuccess.value = false
  try {
    await apiFetch('/api/user/password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: pwForm.value.current,
        newPassword: pwForm.value.newPw,
      }),
    })
    pwForm.value = { current: '', newPw: '' }
    pwSuccess.value = true
    setTimeout(() => { pwSuccess.value = false }, 3000)
  } catch (err) {
    pwError.value = err.message || 'Failed to update password'
  } finally {
    pwLoading.value = false
  }
}

const title = ref(null)
const titleLoading = ref(false)
const titleError = ref('')
const titleCached = ref(null)

const hasActivity = computed(() =>
  liked.value.length + watched.value.length + watchlist.value.length >= 1 ||
  interactionCount() >= 1
)

const generateTitle = async () => {
  titleLoading.value = true
  titleError.value = ''
  try {
    const result = await apiFetch('/api/user/generate-title', {
      method: 'POST',
      body: JSON.stringify({
        topMoods: getTopMoods(5),
        likedTitles: liked.value.map((i) => i.title).filter(Boolean),
        watchedCount: watched.value.length,
        watchlistCount: watchlist.value.length,
        dislikedCount: (prefs.value.dislikedItems || []).length,
        sessionMoods: prefs.value.sessionMoods || [],
        language: lang.value,
      }),
    })
    title.value = result
    titleCached.value = result
  } catch (err) {
    titleError.value = err.message || 'Could not generate your title'
  } finally {
    titleLoading.value = false
  }
}

const stats = computed(() => [
  { label: t.value.myLikes, count: liked.value.length, icon: 'fa-heart', color: '#db2777' },
  { label: t.value.myWatchlist, count: watchlist.value.length, icon: 'fa-bookmark', color: '#7c3aed' },
  { label: t.value.myWatched, count: watched.value.length, icon: 'fa-check-circle', color: '#059669' },
  { label: t.value.myHistory, count: history.value.length, icon: 'fa-clock-rotate-left', color: '#6b7280' },
])

const mateCount = ref(0)
const mates = ref([])
const showMatesList = ref(false)

const loadMates = async () => {
  try {
    const data = await apiFetch('/api/social/mates')
    mateCount.value = data.count || 0
    mates.value = data.mates || []
  } catch {
    mateCount.value = 0
    mates.value = []
  }
}

const handleLogout = async () => {
  await logout()
  router.replace('/auth')
}

const confirmReset = ref(false)
const resetPrefs = () => {
  localStorage.removeItem('tazama_prefs')
  localStorage.removeItem('tazama_watchlist')
  localStorage.removeItem('tazama_liked')
  localStorage.removeItem('tazama_watched')
  localStorage.removeItem('tazama_history')
  title.value = null
  confirmReset.value = false
  window.location.reload()
}

const memberSince = computed(() => {
  if (!user.value?.created_at) return 'Recently'
  return new Date(user.value.created_at * 1000).toLocaleDateString(
    lang.value === 'fr' ? 'fr-FR' : 'en-US',
    { month: 'long', year: 'numeric' },
  )
})

onMounted(async () => {
  if (user.value) {
    await loadMates()
    await loadTitle()
    await syncLevel()
  }

  if (isPremium.value && hasActivity.value && !titleCached.value) {
    generateTitle()
  } else if (titleCached.value) {
    title.value = titleCached.value
  }
})
</script>

<template>
  <div class="max-w-3xl mx-auto py-4 flex flex-col gap-6">
    <section class="settings-card settings-card--hero">
      <div class="flex flex-col sm:flex-row gap-5 sm:items-start">
        <div class="flex justify-center sm:block">
          <div
            class="w-24 h-24 rounded-3xl flex items-center justify-center text-4xl shadow-lg select-none"
            :style="isPremium
              ? 'background: linear-gradient(135deg, #d97706, #f59e0b); box-shadow: 0 10px 28px rgba(217,119,6,0.28);'
              : 'background: linear-gradient(135deg, #5b21b6, #7c3aed); box-shadow: 0 10px 28px rgba(124,58,237,0.28);'"
          >
            {{ user?.avatar || 'T' }}
          </div>
        </div>

        <div class="flex-1 text-center sm:text-left min-w-0">
          <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 class="text-2xl font-bold text-white break-all sm:break-normal">{{ user?.username }}</h1>
            <span
              class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border"
              :style="isPremium
                ? 'background: rgba(217,119,6,0.2); color: #fbbf24; border-color: rgba(217,119,6,0.35);'
                : 'background: rgba(124,58,237,0.2); color: #a78bfa; border-color: rgba(124,58,237,0.3);'"
            >
              {{ isPremium ? 'Premium' : 'Standard' }}
            </span>
          </div>

          <div class="mt-2 flex justify-center sm:justify-start">
            <span
              v-if="watcherLevel >= 1"
              class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1"
              style="background: rgba(124,58,237,0.18); color: #c4b5fd; border: 1px solid rgba(124,58,237,0.3);"
            >
              {{ watcherTitle }}
            </span>
            <span v-else class="text-xs text-white/35 italic">
              Novice Watcher, keep watching to level up.
            </span>
          </div>

          <div class="mt-3 space-y-1">
            <p class="text-white/70 text-sm break-all">{{ user?.email }}</p>
            <p v-if="user?.bio" class="text-white/45 text-sm italic">{{ user?.bio }}</p>
            <p class="text-white/25 text-xs">{{ t.memberSince }} {{ memberSince }}</p>
          </div>
        </div>

        <button
          type="button"
          class="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold transition border"
          :class="editing
            ? 'bg-white/5 text-white/50 border-white/10'
            : 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border-purple-600/25'"
          @click="editing ? cancelEdit() : startEdit()"
        >
          <i class="fa-solid mr-2" :class="editing ? 'fa-xmark' : 'fa-pen-to-square'"></i>
          {{ editing ? t.cancel : 'Edit account details' }}
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="profile-chip">
          <p class="profile-chip__label">Account</p>
          <p class="profile-chip__text">Change username, email, avatar, and bio.</p>
        </div>
        <div class="profile-chip">
          <p class="profile-chip__label">Security</p>
          <p class="profile-chip__text">Update your password anytime below.</p>
        </div>
        <div class="profile-chip">
          <p class="profile-chip__label">{{ t.reelMates }}</p>
          <p class="profile-chip__text">See your connections and open their profiles.</p>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div
        v-for="s in stats"
        :key="s.label"
        class="flex flex-col items-center gap-1.5 py-4 rounded-2xl border border-white/7"
        style="background: rgba(255,255,255,0.03);"
      >
        <i :class="`fa-solid ${s.icon} text-base`" :style="`color: ${s.color}`"></i>
        <span class="text-lg font-bold text-white">{{ s.count }}</span>
        <span class="text-[10px] text-white/35 text-center leading-tight px-1">{{ s.label }}</span>
      </div>
    </div>

    <section class="settings-card" v-if="editing">
      <div class="flex items-center justify-between gap-3">
        <h2 class="settings-label">Account Details</h2>
        <span class="text-xs text-white/30">Change name, email, avatar, and privacy.</span>
      </div>

      <div>
        <p class="text-xs text-white/50 mb-2">{{ t.chooseAvatar }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="av in AVATARS"
            :key="av"
            type="button"
            class="w-10 h-10 rounded-xl text-xl flex items-center justify-center transition border"
            :class="editForm.avatar === av
              ? 'border-purple-500/60 bg-purple-500/20'
              : 'border-white/8 bg-white/5 hover:bg-white/10'"
            @click="editForm.avatar = av"
          >{{ av }}</button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="settings-field-label">{{ t.username }}</label>
          <input v-model="editForm.username" type="text" class="settings-input" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="settings-field-label">{{ t.emailAddress }}</label>
          <input v-model="editForm.email" type="email" class="settings-input" />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="settings-field-label">{{ t.bio }}</label>
        <textarea v-model="editForm.bio" rows="3" class="settings-input resize-none" :placeholder="t.bioPlaceholder"></textarea>
      </div>

      <div class="settings-row">
        <div>
          <p class="text-sm text-white/80 font-medium">{{ t.discoverability }}</p>
          <p class="text-xs text-white/35 mt-0.5">
            <template v-if="!isPremium">Standard users are always discoverable. Upgrade to control this.</template>
            <template v-else>{{ t.discoverabilityDesc }}</template>
          </p>
        </div>

        <button
          type="button"
          class="relative w-12 h-6 rounded-full shrink-0"
          :style="editForm.is_discoverable ? 'background: #7c3aed;' : 'background: rgba(255,255,255,0.15);'"
          :disabled="!isPremium"
          @click.stop="isPremium && (editForm.is_discoverable = !editForm.is_discoverable)"
        >
          <span
            class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
            style="transition: transform 0.2s ease;"
            :style="editForm.is_discoverable ? 'transform: translateX(1.5rem);' : 'transform: translateX(0.125rem);'"
          ></span>
        </button>
      </div>

      <div>
        <div class="flex items-center gap-2 mb-3">
          <p class="text-sm text-white/80 font-medium">{{ t.privacySettings }}</p>
          <span v-if="!isPremium" class="text-[10px] text-amber-400/60">{{ t.premiumOnly }}</span>
        </div>

        <div class="flex flex-col gap-2">
          <div
            v-for="field in [
              { key: 'privacy_liked', label: t.privacyLiked },
              { key: 'privacy_watchlist', label: t.privacyWatchlist },
              { key: 'privacy_watched', label: t.privacyWatched }
            ]"
            :key="field.key"
            class="settings-row rounded-xl bg-white/4 px-3 py-2"
          >
            <span class="text-sm text-white/60">{{ field.label }}</span>
            <div class="flex gap-1.5">
              <button
                v-for="opt in ['public','private']"
                :key="opt"
                type="button"
                class="px-3 py-1 rounded-lg text-xs font-medium transition"
                :class="editForm[field.key] === opt ? 'bg-purple-600/60 text-white' : 'text-white/35 hover:text-white/60'"
                :disabled="!isPremium"
                @click="editForm[field.key] = opt"
              >
                {{ opt === 'public' ? t.public : t.private }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="saveError" class="message message--error">{{ saveError }}</div>

      <div class="flex gap-3">
        <button class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-white/50 hover:bg-white/10 transition" @click="cancelEdit">
          {{ t.cancel }}
        </button>
        <button
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition text-white"
          style="background: linear-gradient(135deg, #5b21b6, #7c3aed);"
          :disabled="saveLoading"
          @click="saveProfile"
        >
          <i v-if="saveLoading" class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>
          {{ t.saveChanges }}
        </button>
      </div>
    </section>

    <Transition name="fade">
      <div
        v-if="saveSuccess"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-2xl z-50"
        style="background: rgba(16,185,129,0.9); backdrop-filter: blur(12px);"
      >
        <i class="fa-solid fa-check mr-2"></i>Account updated successfully.
      </div>
    </Transition>

    <section class="settings-card">
      <h2 class="settings-label">{{ t.changePassword }}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="settings-field-label">{{ t.currentPassword }}</label>
          <input v-model="pwForm.current" type="password" class="settings-input" autocomplete="current-password" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="settings-field-label">{{ t.newPassword }}</label>
          <input v-model="pwForm.newPw" type="password" class="settings-input" autocomplete="new-password" placeholder="Min. 6 characters" />
        </div>
      </div>

      <div v-if="pwError" class="message message--error">{{ pwError }}</div>
      <div v-if="pwSuccess" class="message message--success"><i class="fa-solid fa-check mr-1.5"></i>Password updated successfully.</div>

      <button
        class="py-2.5 rounded-xl text-sm font-semibold transition self-start px-5"
        :class="pwForm.current && pwForm.newPw ? 'bg-purple-600/30 text-purple-300 hover:bg-purple-600/50 border border-purple-600/30' : 'bg-white/5 text-white/25 cursor-not-allowed'"
        :disabled="!pwForm.current || !pwForm.newPw || pwLoading"
        @click="changePassword"
      >
        <i v-if="pwLoading" class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>
        {{ t.changePassword }}
      </button>
    </section>

    <section class="settings-card" style="background: rgba(124,58,237,0.05); border-color: rgba(124,58,237,0.22);">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <i class="fa-solid fa-users text-purple-400/70 text-lg"></i>
          <div>
            <p class="text-white font-bold text-xl leading-none">{{ mateCount }}</p>
            <p class="text-purple-300/70 text-[11px] font-semibold uppercase tracking-wider mt-0.5">{{ t.reelMates }}</p>
          </div>
        </div>
        <button
          type="button"
          class="text-sm font-semibold px-4 py-2 rounded-xl transition border"
          :style="showMatesList
            ? 'background: rgba(124,58,237,0.3); color: #c4b5fd; border-color: rgba(124,58,237,0.5);'
            : 'background: rgba(124,58,237,0.1); color: #a78bfa; border-color: rgba(124,58,237,0.3);'"
          @click="showMatesList = !showMatesList"
        >
          <i class="fa-solid fa-users text-xs mr-1.5"></i>
          {{ showMatesList ? 'Hide' : `View ${t.reelMates}` }}
        </button>
      </div>

      <div v-show="showMatesList" class="flex flex-col gap-2">
        <div v-if="!mates.length" class="text-white/35 text-sm italic text-center py-4">
          No {{ t.reelMates.toLowerCase() }} yet, start connecting.
        </div>
        <button
          v-for="mate in mates"
          :key="mate.id"
          type="button"
          class="flex items-center gap-3 p-3 rounded-xl border border-white/8 text-left hover:border-purple-500/30 transition"
          style="background: rgba(255,255,255,0.03);"
          @click="router.push(`/profile/${mate.id}`)"
        >
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            :style="mate.plan === 'premium'
              ? 'background: linear-gradient(135deg, #d97706, #f59e0b);'
              : 'background: linear-gradient(135deg, #5b21b6, #7c3aed);'"
          >
            {{ mate.avatar }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-white text-sm font-semibold">{{ mate.username }}</p>
            <p v-if="mate.watcher_title" class="text-purple-400/60 text-xs">{{ mate.watcher_title }}</p>
          </div>
          <i class="fa-solid fa-chevron-right text-white/20 text-xs shrink-0"></i>
        </button>
      </div>
    </section>

    <section
      class="rounded-2xl border overflow-hidden"
      :style="isPremium
        ? 'border-color: rgba(217,119,6,0.25); background: linear-gradient(160deg, rgba(217,119,6,0.07), rgba(255,255,255,0.02));'
        : 'border-color: rgba(255,255,255,0.07); background: rgba(255,255,255,0.02);'"
    >
      <div class="flex items-center justify-between px-5 pt-5 pb-3">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-scroll" :class="isPremium ? 'text-amber-400' : 'text-white/25'"></i>
          <h2 class="text-sm font-bold text-white/70 uppercase tracking-wider">Your Watcher Title</h2>
        </div>
        <span v-if="!isPremium" class="text-[11px] text-white/30">Premium</span>
      </div>

      <div v-if="!isPremium" class="px-5 pb-6 text-center">
        <p class="text-white/30 text-sm mb-3">Unlock Premium to discover your unique watcher personality generated by Oracle AI.</p>
        <button class="btn-primary text-xs px-5 py-2" @click="router.push('/plan')">
          <i class="fa-solid fa-crown mr-1.5"></i>Unlock Premium
        </button>
      </div>

      <div v-else-if="!hasActivity" class="px-5 pb-6 text-center">
        <p class="text-white/35 text-sm">Start using the Oracle and building your library, then come back to see your title.</p>
      </div>

      <div v-else-if="titleLoading" class="px-5 pb-8 flex flex-col items-center gap-3">
        <div class="flex gap-1.5 mt-2">
          <div class="w-2 h-2 rounded-full bg-amber-400/60 animate-bounce" style="animation-delay:0ms"></div>
          <div class="w-2 h-2 rounded-full bg-amber-400/60 animate-bounce" style="animation-delay:130ms"></div>
          <div class="w-2 h-2 rounded-full bg-amber-400/60 animate-bounce" style="animation-delay:260ms"></div>
        </div>
        <p class="text-white/30 text-xs">Oracle is analyzing your taste.</p>
      </div>

      <div v-else-if="titleError" class="px-5 pb-5 flex flex-col items-center gap-3 text-center">
        <p class="text-red-400/70 text-sm">{{ titleError }}</p>
        <button class="text-xs text-amber-400 hover:text-amber-300 transition" @click="generateTitle">Try again</button>
      </div>

      <div v-else-if="title" class="px-5 pb-5 flex flex-col gap-4">
        <div class="flex flex-col items-center text-center py-3 px-4 rounded-xl"
             style="background: rgba(217,119,6,0.08); border: 1px solid rgba(217,119,6,0.18);">
          <div class="text-4xl mb-2">{{ title.emoji }}</div>
          <h3 class="text-xl font-bold text-white font-logo mb-1">{{ title.title }}</h3>
          <p class="text-amber-400/80 text-sm italic">{{ title.subtitle }}</p>
        </div>

        <p v-if="title.cinemaType" class="text-white/50 text-sm text-center italic px-2">"{{ title.cinemaType }}"</p>

        <div>
          <p class="text-xs font-semibold text-white/35 uppercase tracking-wider mb-2">Your Traits</p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="trait in title.traits"
              :key="trait"
              class="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300/80"
              style="background: rgba(217,119,6,0.12); border: 1px solid rgba(217,119,6,0.22);"
            >
              {{ trait }}
            </span>
          </div>
        </div>

        <div>
          <p class="text-xs font-semibold text-white/35 uppercase tracking-wider mb-2">Oracle's Observations</p>
          <ul class="flex flex-col gap-2">
            <li v-for="fact in title.funFacts" :key="fact" class="flex items-start gap-2 text-sm text-white/60">
              <i class="fa-solid fa-eye text-amber-400/60 text-xs mt-1 shrink-0"></i>
              {{ fact }}
            </li>
          </ul>
        </div>

        <button class="text-xs text-white/25 hover:text-amber-400 transition flex items-center gap-1.5 self-center mt-1" @click="generateTitle">
          <i class="fa-solid fa-rotate-right text-[10px]"></i>Regenerate title
        </button>
      </div>

      <div v-else class="px-5 pb-5 text-center">
        <button
          class="px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer"
          style="background: linear-gradient(135deg,#d97706,#f59e0b); color: #0a0615;"
          @click="generateTitle"
        >
          <i class="fa-solid fa-wand-magic-sparkles mr-2"></i>Reveal My Title
        </button>
      </div>
    </section>

    <section class="settings-card">
      <h2 class="settings-label">Language / Langue</h2>
      <div class="flex gap-3">
        <button class="settings-option-btn" :class="lang === 'en' ? 'settings-option-btn--active' : ''" @click="setLang('en')">
          English
        </button>
        <button class="settings-option-btn" :class="lang === 'fr' ? 'settings-option-btn--active' : ''" @click="setLang('fr')">
          Francais
        </button>
      </div>
    </section>

    <section class="settings-card">
      <h2 class="settings-label">Your Plan</h2>
      <div class="settings-row">
        <div>
          <p class="text-white font-semibold">{{ isPremium ? 'Premium' : 'Standard' }}</p>
          <p class="text-white/35 text-xs mt-0.5">
            {{ isPremium ? 'Full Oracle access, all premium features unlocked.' : 'Free plan, upgrade for Oracle Chat and Analytics.' }}
          </p>
        </div>
        <button
          v-if="!isPremium"
          class="px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          style="background: linear-gradient(135deg,#d97706,#f59e0b); color: #0a0615;"
          @click="router.push('/plan')"
        >Upgrade</button>
        <button
          v-else
          class="text-xs text-white/30 hover:text-white/60 transition px-4 py-2 rounded-xl border border-white/8"
          @click="router.push('/plan')"
        >View Plans</button>
      </div>
    </section>

    <section class="settings-card border-red-900/20">
      <h2 class="settings-label text-red-400/60">{{ t.dangerZone }}</h2>
      <div class="flex flex-col gap-3">
        <div class="settings-row">
          <div>
            <p class="text-white/70 text-sm font-medium">{{ t.resetData }}</p>
            <p class="text-white/30 text-xs">{{ t.resetDataDesc }}</p>
          </div>
          <button
            v-if="!confirmReset"
            class="px-4 py-2 rounded-xl text-xs font-semibold text-red-400/70 border border-red-500/20 hover:bg-red-500/10 hover:text-red-400 transition"
            @click="confirmReset = true"
          >Reset</button>
          <div v-else class="flex gap-2">
            <button class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600/80 text-white hover:bg-red-600 transition" @click="resetPrefs">Yes, reset</button>
            <button class="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 transition" @click="confirmReset = false">Cancel</button>
          </div>
        </div>

        <div class="h-px bg-white/5"></div>

        <div class="settings-row">
          <div>
            <p class="text-white/70 text-sm font-medium">{{ t.signOut }}</p>
            <p class="text-white/30 text-xs">{{ t.signOutDesc }}</p>
          </div>
          <button
            class="px-4 py-2 rounded-xl text-xs font-semibold text-red-400/70 border border-red-500/20 hover:bg-red-500/10 hover:text-red-400 transition"
            @click="handleLogout"
          >{{ t.signOut }}</button>
        </div>
      </div>
    </section>

    <p class="text-center text-white/15 text-xs pb-4">Tazama · Powered by Oracle AI and TMDB</p>
  </div>
</template>

<style scoped>
.settings-card {
  padding: 20px 22px;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.025);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-card--hero {
  background: linear-gradient(180deg, rgba(124,58,237,0.10), rgba(255,255,255,0.03));
}

.settings-label {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.settings-field-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.45);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.settings-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 14px;
  padding: 11px 14px;
  color: white;
  font-size: 14px;
  width: 100%;
  transition: border-color 0.15s;
  outline: none;
  font-family: inherit;
}

.settings-input::placeholder { color: rgba(255,255,255,0.25); }
.settings-input:focus { border-color: rgba(124,58,237,0.6); }

.settings-option-btn {
  padding: 9px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.50);
  border: 1px solid rgba(255,255,255,0.08);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.settings-option-btn:hover { color: white; }

.settings-option-btn--active {
  background: rgba(124,58,237,0.25);
  color: white;
  border-color: rgba(124,58,237,0.4);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.profile-chip {
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  padding: 14px 16px;
}

.profile-chip__label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.30);
  font-weight: 700;
}

.profile-chip__text {
  color: rgba(255,255,255,0.82);
  font-size: 14px;
  margin-top: 6px;
  line-height: 1.45;
}

.message {
  font-size: 14px;
  border-radius: 14px;
  padding: 12px 16px;
  border: 1px solid transparent;
}

.message--error {
  color: #f87171;
  background: rgba(239,68,68,0.10);
  border-color: rgba(239,68,68,0.20);
}

.message--success {
  color: #4ade80;
  background: rgba(34,197,94,0.10);
  border-color: rgba(34,197,94,0.20);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .settings-card {
    padding: 18px;
    border-radius: 20px;
  }

  .settings-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
