<script setup>
import { ref, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'
import { useSitePrefs } from '@/composables/useSitePrefs'

const { apiFetch } = useAuth()
const { t } = useI18n()
const { sitePrefs, load, save, addFavActor, removeFavActor, addExcludedTag, removeExcludedTag } = useSitePrefs()

const saving    = ref(false)
const saved     = ref(false)
const saveError = ref('')

const newActor = ref('')
const newTag   = ref('')

onMounted(() => load(apiFetch))

const handleAddActor = () => {
  if (newActor.value.trim()) {
    addFavActor(newActor.value.trim())
    newActor.value = ''
  }
}

const handleAddTag = () => {
  if (newTag.value.trim()) {
    addExcludedTag(newTag.value.trim())
    newTag.value = ''
  }
}

const handleSave = async () => {
  saving.value    = true
  saveError.value = ''
  try {
    await save(apiFetch)
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (err) {
    saveError.value = err.message || 'Failed to save settings'
  } finally {
    saving.value = false
  }
}

const AUTOPLAY_OPTIONS = [
  { value: 'hover',  icon: 'fa-hand-pointer',   labelKey: 'autoplayHover'  },
  { value: 'click',  icon: 'fa-computer-mouse',  labelKey: 'autoplayClick'  },
  { value: 'never',  icon: 'fa-ban',             labelKey: 'autoplayNever'  },
]

const nichePercent = (val) => Math.round(val)
</script>

<template>
  <div class="max-w-2xl mx-auto py-4 flex flex-col gap-6">

    <div class="flex items-center gap-3 mb-2">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(124,58,237,0.2);">
        <i class="fa-solid fa-sliders text-purple-400 text-base"></i>
      </div>
      <div>
        <h1 class="text-xl font-bold text-white">{{ t.siteSettingsTitle }}</h1>
        <p class="text-white/40 text-xs">Personalize how Tazama works for you</p>
      </div>
    </div>

    <!-- ── Favorite Actors & Directors ───────────────────────────────────── -->
    <section class="settings-card">
      <div>
        <h2 class="settings-label">{{ t.favActors }}</h2>
        <p class="text-white/35 text-xs mt-1">{{ t.favActorsDesc }}</p>
      </div>

      <!-- Tag list -->
      <div v-if="sitePrefs.favActors.length" class="flex flex-wrap gap-2">
        <span
          v-for="actor in sitePrefs.favActors"
          :key="actor"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/80 border border-purple-500/30"
          style="background: rgba(124,58,237,0.12);"
        >
          <i class="fa-solid fa-person-chalkboard text-purple-400/60 text-xs"></i>
          {{ actor }}
          <button class="text-white/30 hover:text-red-400 transition ml-1" @click="removeFavActor(actor)">
            <i class="fa-solid fa-xmark text-[10px]"></i>
          </button>
        </span>
      </div>
      <p v-else class="text-white/25 text-sm italic">No favorites added yet</p>

      <!-- Add input -->
      <div class="flex gap-2">
        <input
          v-model="newActor"
          type="text"
          :placeholder="t.favActorsPlaceholder"
          class="settings-input flex-1"
          @keydown.enter="handleAddActor"
        />
        <button
          class="px-4 py-2 rounded-xl text-sm font-semibold transition border border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
          @click="handleAddActor"
        >
          <i class="fa-solid fa-plus text-xs mr-1"></i>{{ t.add }}
        </button>
      </div>
    </section>

    <!-- ── Excluded Keywords / Tags ──────────────────────────────────────── -->
    <section class="settings-card">
      <div>
        <h2 class="settings-label">{{ t.excludedTags }}</h2>
        <p class="text-white/35 text-xs mt-1">{{ t.excludedTagsDesc }}</p>
      </div>

      <div v-if="sitePrefs.excludedTags.length" class="flex flex-wrap gap-2">
        <span
          v-for="tag in sitePrefs.excludedTags"
          :key="tag"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/80 border border-red-500/30"
          style="background: rgba(239,68,68,0.08);"
        >
          <i class="fa-solid fa-ban text-red-400/60 text-xs"></i>
          {{ tag }}
          <button class="text-white/30 hover:text-red-400 transition ml-1" @click="removeExcludedTag(tag)">
            <i class="fa-solid fa-xmark text-[10px]"></i>
          </button>
        </span>
      </div>
      <p v-else class="text-white/25 text-sm italic">No keywords blocked yet</p>

      <div class="flex gap-2">
        <input
          v-model="newTag"
          type="text"
          :placeholder="t.excludedTagsPlaceholder"
          class="settings-input flex-1"
          @keydown.enter="handleAddTag"
        />
        <button
          class="px-4 py-2 rounded-xl text-sm font-semibold transition border border-red-500/30 text-red-400 hover:bg-red-500/10"
          @click="handleAddTag"
        >
          <i class="fa-solid fa-plus text-xs mr-1"></i>{{ t.add }}
        </button>
      </div>
    </section>

    <!-- ── Trending vs Niche Balance ─────────────────────────────────────── -->
    <section class="settings-card">
      <div>
        <h2 class="settings-label">{{ t.nicheBalance }}</h2>
        <p class="text-white/35 text-xs mt-1">{{ t.nicheBalanceDesc }}</p>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex justify-between text-xs text-white/50">
          <span class="flex items-center gap-1.5">
            <i class="fa-solid fa-gem text-purple-400 text-xs"></i>{{ t.niche_label }}
          </span>
          <span class="flex items-center gap-1.5">
            {{ t.trending_label }}<i class="fa-solid fa-fire text-orange-400 text-xs"></i>
          </span>
        </div>
        <input
          v-model.number="sitePrefs.nicheBalance"
          type="range"
          min="0"
          max="100"
          class="slider w-full"
        />
        <div class="flex justify-center">
          <div class="px-4 py-1.5 rounded-full text-xs font-semibold"
               :style="sitePrefs.nicheBalance < 35
                 ? 'background: rgba(124,58,237,0.2); color: #a78bfa;'
                 : sitePrefs.nicheBalance > 65
                 ? 'background: rgba(234,88,12,0.2); color: #fb923c;'
                 : 'background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.5);'">
            {{ sitePrefs.nicheBalance < 35 ? '🔍 Niche Explorer' : sitePrefs.nicheBalance > 65 ? '🔥 Mainstream Fan' : '⚖️ Balanced' }}
          </div>
        </div>
      </div>
    </section>

    <!-- ── Trailer Autoplay ───────────────────────────────────────────────── -->
    <section class="settings-card">
      <div>
        <h2 class="settings-label">{{ t.trailerAutoplay }}</h2>
        <p class="text-white/35 text-xs mt-1">{{ t.trailerAutoplayDesc }}</p>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="opt in AUTOPLAY_OPTIONS"
          :key="opt.value"
          class="flex flex-col items-center gap-2 py-3 px-2 rounded-xl border transition"
          :class="sitePrefs.trailerAutoplay === opt.value
            ? 'border-purple-500/50 bg-purple-500/15 text-white'
            : 'border-white/8 bg-white/3 text-white/40 hover:text-white/70 hover:border-white/15'"
          @click="sitePrefs.trailerAutoplay = opt.value"
        >
          <i :class="`fa-solid ${opt.icon} text-base`"></i>
          <span class="text-xs font-medium">{{ t[opt.labelKey] }}</span>
        </button>
      </div>
    </section>

    <!-- ── Content Preferences ───────────────────────────────────────────── -->
    <section class="settings-card">
      <div>
        <h2 class="settings-label">Additional Preferences</h2>
        <p class="text-white/35 text-xs mt-1">More ways to fine-tune your experience</p>
      </div>

      <div class="flex flex-col gap-3">
        <!-- Quality vs Quantity -->
        <div class="p-3 rounded-xl bg-white/4 border border-white/8 flex items-center justify-between">
          <div>
            <p class="text-sm text-white/80 font-medium">🏆 Critically acclaimed only</p>
            <p class="text-xs text-white/35 mt-0.5">Prefer highly rated titles (7+ on TMDB)</p>
          </div>
          <span class="text-xs text-purple-400/60 italic">Coming soon</span>
        </div>

        <!-- Subtitle preference -->
        <div class="p-3 rounded-xl bg-white/4 border border-white/8 flex items-center justify-between">
          <div>
            <p class="text-sm text-white/80 font-medium">🌐 Include international titles</p>
            <p class="text-xs text-white/35 mt-0.5">Recommend content from all countries</p>
          </div>
          <span class="text-xs text-purple-400/60 italic">Coming soon</span>
        </div>

        <!-- Spoiler protection -->
        <div class="p-3 rounded-xl bg-white/4 border border-white/8 flex items-center justify-between">
          <div>
            <p class="text-sm text-white/80 font-medium">🛡️ Spoiler protection</p>
            <p class="text-xs text-white/35 mt-0.5">Blur descriptions for unreleased seasons</p>
          </div>
          <span class="text-xs text-purple-400/60 italic">Coming soon</span>
        </div>
      </div>
    </section>

    <!-- ── Save button ───────────────────────────────────────────────────── -->
    <div v-if="saveError" class="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
      {{ saveError }}
    </div>

    <button
      class="w-full py-3 rounded-xl text-sm font-bold transition"
      style="background: linear-gradient(135deg,#5b21b6,#7c3aed); color: white;"
      :disabled="saving"
      @click="handleSave"
    >
      <i v-if="saving" class="fa-solid fa-circle-notch fa-spin mr-2"></i>
      <i v-else-if="saved" class="fa-solid fa-check mr-2"></i>
      {{ saved ? t.settingsSaved : (saving ? 'Saving…' : t.saveSettings) }}
    </button>

    <p class="text-center text-white/15 text-xs pb-4">Tazama · Site Preferences</p>

  </div>
</template>

<style scoped>
.settings-card {
  padding: 20px 22px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.025);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.settings-label {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.settings-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
  padding: 11px 14px;
  color: white;
  font-size: 14px;
  width: 100%;
  transition: border-color 0.15s;
  outline: none;
}
.settings-input::placeholder { color: rgba(255,255,255,0.25); }
.settings-input:focus { border-color: rgba(124,58,237,0.6); }

/* Slider styling */
.slider {
  -webkit-appearance: none;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(to right, #7c3aed, #d97706);
  outline: none;
  cursor: pointer;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  border: 2px solid rgba(124,58,237,0.8);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  border: 2px solid rgba(124,58,237,0.8);
  cursor: pointer;
}
</style>
