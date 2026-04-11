<script setup>
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'

const router = useRouter()
const { user, isPremium } = useAuth()
const { t } = useI18n()

const standardFeatures = [
  { icon: 'fa-wand-magic-sparkles', label: 'Oracle Mood Recommendations — AI picks based on your vibe' },
  { icon: 'fa-compass',             label: 'Discover Page — Trending, Top Films, Series & Anime' },
  { icon: 'fa-bookmark',            label: 'Personal Library (liked, watchlist, watched, history)' },
  { icon: 'fa-list',                label: 'Playlists — create and share curated collections' },
  { icon: 'fa-users',               label: 'Social — Reel Mates connections & messaging' },
  { icon: 'fa-globe',               label: 'EN / FR language support' },
  { icon: 'fa-cloud',               label: 'Cross-device sync via account' },
  { icon: 'fa-magnifying-glass',    label: 'Search movies, series and other users' },
]

const premiumFeatures = [
  { icon: 'fa-comment-dots', label: 'Oracle Chat — unlimited AI entertainment expert sessions' },
  { icon: 'fa-chart-bar',    label: 'Taste Analytics — deep dive into your mood & genre profile' },
  { icon: 'fa-scroll',       label: 'Watcher Title — your AI-generated cinephile persona' },
  { icon: 'fa-sliders',      label: 'Privacy Controls — choose who sees your library' },
  { icon: 'fa-eye-slash',    label: 'Discoverability toggle — appear or vanish from search' },
  { icon: 'fa-lock-open',    label: 'All Standard features included' },
]
</script>

<template>
  <div class="py-8 max-w-3xl mx-auto">

    <!-- Header -->
    <div class="text-center mb-10">
      <h1 class="text-3xl md:text-4xl font-bold text-white font-logo mb-3">Choose Your Experience</h1>
      <p class="text-white/50">{{ isPremium ? 'You\'re already on Premium — enjoy the full Oracle experience.' : 'Unlock more with a short riddle from the developer.' }}</p>
    </div>

    <!-- Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <!-- Standard -->
      <div
        class="plan-card"
        :class="!isPremium ? 'ring-1 ring-purple-500/50' : 'opacity-80'"
      >
        <div class="flex items-center justify-between mb-1">
          <h2 class="text-xl font-bold text-white">Standard</h2>
          <span class="plan-badge plan-badge--standard">
            {{ !isPremium ? 'Current Plan' : 'Free' }}
          </span>
        </div>
        <!-- Pricing -->
        <div class="flex items-baseline gap-2 mb-2">
          <span class="text-3xl font-bold text-white">$0</span>
          <span class="text-white/40 text-sm">/ forever</span>
        </div>
        <p class="text-purple-400/70 text-xs italic mb-4">Zero. Zilch. Nada. Free as in "we checked the price three times and it's still zero." 🤷</p>

        <ul class="flex flex-col gap-3 flex-1">
          <li v-for="f in standardFeatures" :key="f.label" class="feature-item">
            <i :class="`fa-solid ${f.icon}`" class="text-purple-400 w-5 text-center flex-shrink-0"></i>
            <span class="text-white/80 text-sm">{{ f.label }}</span>
          </li>
        </ul>

        <div class="mt-8">
          <div v-if="!isPremium" class="text-center text-white/30 text-xs py-2">✓ Active</div>
          <button v-else class="btn-secondary-1 w-full opacity-50 cursor-not-allowed" disabled>Standard Plan</button>
        </div>
      </div>

      <!-- Premium -->
      <div
        class="plan-card premium-card"
        :class="isPremium ? 'ring-1 ring-amber-500/60' : ''"
      >
        <!-- Glow accent -->
        <div class="absolute -top-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"></div>

        <div class="flex items-center justify-between mb-1">
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-crown text-amber-400 text-base"></i>
            Premium
          </h2>
          <span class="plan-badge plan-badge--premium">
            {{ isPremium ? 'Active' : 'Unlock' }}
          </span>
        </div>
        <!-- Pricing -->
        <div class="flex items-baseline gap-2 mb-2">
          <span class="text-3xl font-bold" style="color: #fbbf24;">3</span>
          <span class="text-amber-400/70 text-sm">correct answers</span>
        </div>
        <p class="text-amber-400/60 text-xs italic mb-4">Not euros. Not dollars. Just your brain cells. Answer 3 of the Oracle's riddles correctly and transcend. 🎬</p>

        <ul class="flex flex-col gap-3 flex-1">
          <li v-for="f in premiumFeatures" :key="f.label" class="feature-item">
            <i :class="`fa-solid ${f.icon}`" class="text-amber-400 w-5 text-center flex-shrink-0"></i>
            <span class="text-white/80 text-sm">{{ f.label }}</span>
          </li>
        </ul>

        <div class="mt-8">
          <div v-if="isPremium" class="flex items-center justify-center gap-2 text-amber-400 text-sm font-semibold py-2">
            <i class="fa-solid fa-crown"></i> Premium Active
          </div>
          <button
            v-else
            class="w-full py-3 rounded-xl font-semibold text-sm transition cursor-pointer flex items-center justify-center gap-2"
            style="background: linear-gradient(135deg, #d97706, #f59e0b); color: #0a0615;"
            @click="router.push('/premium-unlock')"
          >
            <i class="fa-solid fa-lock-open text-xs"></i>
            Unlock Premium
          </button>
        </div>
      </div>

    </div>

    <!-- Nav hint -->
    <div class="text-center mt-8">
      <button class="text-white/30 hover:text-white/60 text-sm transition" @click="router.push('/')">
        <i class="fa-solid fa-arrow-left mr-2 text-xs"></i>
        Continue with Standard
      </button>
    </div>

  </div>
</template>

<style scoped>
.plan-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  padding: 28px;
  transition: border-color 0.2s;
}

.premium-card {
  border-color: rgba(217,119,6,0.25);
  background: linear-gradient(160deg, rgba(217,119,6,0.06), rgba(255,255,255,0.03));
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.plan-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.plan-badge--standard {
  background: rgba(124,58,237,0.25);
  color: #a78bfa;
  border: 1px solid rgba(124,58,237,0.35);
}
.plan-badge--premium {
  background: rgba(217,119,6,0.25);
  color: #fbbf24;
  border: 1px solid rgba(217,119,6,0.40);
}
</style>
