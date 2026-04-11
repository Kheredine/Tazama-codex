<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useUserPreferences } from '@/composables/useUserPreferences'
import { useUserLibrary } from '@/composables/useUserLibrary'

const { isPremium } = useAuth()
const router = useRouter()
const { prefs, getTopMoods, interactionCount } = useUserPreferences()
const { liked, watchlist, watched, history } = useUserLibrary()

// ── Top Moods bar chart ────────────────────────────────────────────────────
const moodEntries = computed(() => {
  const entries = Object.entries(prefs.value.likedMoods || {})
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
  const max = entries[0]?.count || 1
  return entries.map(e => ({ ...e, pct: Math.round((e.count / max) * 100) }))
})

const MOOD_COLORS = {
  'need-escape':        '#7c3aed',
  'feel-something':     '#db2777',
  'chill':              '#0891b2',
  'laugh':              '#d97706',
  'grow':               '#059669',
  'discover':           '#7c3aed',
  'social':             '#dc2626',
  'inspired':           '#ea580c',
}

const moodColor = (id) => MOOD_COLORS[id] || '#7c3aed'

// ── Time-of-day breakdown ──────────────────────────────────────────────────
const timeSlots = [
  { label: 'Morning',   hours: [6,7,8,9,10,11],  icon: 'fa-sun' },
  { label: 'Afternoon', hours: [12,13,14,15,16,17], icon: 'fa-cloud-sun' },
  { label: 'Evening',   hours: [18,19,20,21],    icon: 'fa-moon' },
  { label: 'Late Night',hours: [22,23,0,1,2,3,4,5], icon: 'fa-star' },
]

const timeBreakdown = computed(() => {
  return timeSlots.map(slot => {
    const sessions = (prefs.value.sessionMoods || []).filter(s => slot.hours.includes(s.hour))
    const topMoodId = sessions.length
      ? Object.entries(
          sessions.reduce((acc, s) => { acc[s.moodId] = (acc[s.moodId] || 0) + 1; return acc }, {})
        ).sort((a, b) => b[1] - a[1])[0]?.[0]
      : null
    return { ...slot, count: sessions.length, topMoodId }
  })
})

// ── Library stats ──────────────────────────────────────────────────────────
const stats = computed(() => [
  { label: 'Liked',     count: liked.value.length,     icon: 'fa-heart',        color: '#db2777' },
  { label: 'Watchlist', count: watchlist.value.length, icon: 'fa-bookmark',     color: '#7c3aed' },
  { label: 'Watched',   count: watched.value.length,   icon: 'fa-check-circle', color: '#059669' },
  { label: 'Disliked',  count: (prefs.value.dislikedItems || []).length, icon: 'fa-thumbs-down', color: '#64748b' },
])

const totalInteractions = computed(() => interactionCount())

// ── Disliked items ─────────────────────────────────────────────────────────
const recentDislikes = computed(() =>
  (prefs.value.dislikedItems || []).slice(-5).reverse()
)

const hasData = computed(() =>
  moodEntries.value.length > 0 || liked.value.length > 0 || watched.value.length > 0
)
</script>

<template>
  <div class="py-4 max-w-3xl mx-auto">

    <!-- ── Premium gate ──────────────────────────────────────────────────── -->
    <div v-if="!isPremium" class="flex flex-col items-center justify-center min-h-96 gap-5 text-center px-4">
      <div class="w-20 h-20 rounded-2xl flex items-center justify-center" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);">
        <i class="fa-solid fa-chart-bar text-3xl text-white/30"></i>
      </div>
      <div>
        <h2 class="text-xl font-bold text-white mb-2">Analytics is Premium</h2>
        <p class="text-white/40 text-sm max-w-xs">See your full taste profile — top moods, viewing patterns, and library insights.</p>
      </div>
      <button class="btn-primary" @click="router.push('/plan')">
        <i class="fa-solid fa-crown mr-2"></i>Unlock Premium
      </button>
    </div>

    <!-- ── Analytics ─────────────────────────────────────────────────────── -->
    <template v-else>

      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl md:text-3xl font-bold text-white font-logo mb-1">My Taste Profile</h1>
        <p class="text-white/40 text-sm">Based on your activity · {{ totalInteractions }} total interactions</p>
      </div>

      <!-- Empty state -->
      <div v-if="!hasData" class="text-center py-20">
        <i class="fa-solid fa-seedling text-4xl text-white/20 mb-4"></i>
        <p class="text-white/40">Start using Oracle and liking content to build your taste profile.</p>
      </div>

      <div v-else class="flex flex-col gap-8">

        <!-- Library Stats Grid -->
        <section>
          <h2 class="section-title">Library Overview</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div v-for="s in stats" :key="s.label" class="stat-card">
              <i :class="`fa-solid ${s.icon}`" :style="`color: ${s.color}`" class="text-xl mb-2"></i>
              <div class="text-2xl font-bold text-white">{{ s.count }}</div>
              <div class="text-xs text-white/40">{{ s.label }}</div>
            </div>
          </div>
        </section>

        <!-- Top Moods -->
        <section v-if="moodEntries.length > 0">
          <h2 class="section-title">Top Moods</h2>
          <div class="flex flex-col gap-3 p-5 rounded-2xl border border-white/8" style="background: rgba(255,255,255,0.03);">
            <div v-for="entry in moodEntries" :key="entry.id" class="flex items-center gap-3">
              <div class="text-xs text-white/50 w-24 capitalize truncate flex-shrink-0">{{ entry.id.replace(/-/g,' ') }}</div>
              <div class="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-700"
                  :style="{ width: entry.pct + '%', background: moodColor(entry.id) }"
                ></div>
              </div>
              <div class="text-xs text-white/40 w-8 text-right flex-shrink-0">{{ entry.count }}</div>
            </div>
          </div>
        </section>

        <!-- Time of Day -->
        <section>
          <h2 class="section-title">Viewing Patterns</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div v-for="slot in timeBreakdown" :key="slot.label" class="stat-card">
              <i :class="`fa-solid ${slot.icon} text-xl mb-2 text-white/40`"></i>
              <div class="text-sm font-semibold text-white">{{ slot.label }}</div>
              <div class="text-xs text-white/30 mt-1">{{ slot.count }} sessions</div>
              <div v-if="slot.topMoodId" class="text-[11px] text-purple-400 mt-1 capitalize">
                {{ slot.topMoodId.replace(/-/g,' ') }}
              </div>
              <div v-else class="text-[11px] text-white/20 mt-1">No data yet</div>
            </div>
          </div>
        </section>

        <!-- Recent Dislikes -->
        <section v-if="recentDislikes.length > 0">
          <h2 class="section-title">Recently Passed On</h2>
          <div class="flex flex-wrap gap-2 p-4 rounded-2xl border border-white/8" style="background: rgba(255,255,255,0.03);">
            <span
              v-for="item in recentDislikes"
              :key="item.id"
              class="px-3 py-1.5 rounded-lg text-xs text-white/50 border border-white/8"
              style="background: rgba(255,255,255,0.04);"
            >
              {{ item.title || `Item #${item.id}` }}
            </span>
          </div>
        </section>

      </div>
    </template>
  </div>
</template>

<style scoped>
.section-title {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 16px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03);
  text-align: center;
}
</style>
