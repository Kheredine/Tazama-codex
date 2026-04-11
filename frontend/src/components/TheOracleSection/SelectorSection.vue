<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import Selections from './Selections.vue'
import FilterOptionsData from '@/data/filterOptions.json'
import { useI18n } from '@/composables/useI18n'

const emit = defineEmits(['recommend'])
defineProps({ isSubmitted: Boolean })

const { t, lang } = useI18n()
const fo = FilterOptionsData.filterOptions
const moods = FilterOptionsData.moods

// Pick the right language arrays for time/content/era
const timeAvailabilities = computed(() =>
  lang.value === 'fr' ? fo.timeAvailabilities_fr : fo.timeAvailabilities
)
const contentTypes = computed(() =>
  lang.value === 'fr' ? fo.contentTypes_fr : fo.contentTypes
)
const eras = computed(() =>
  lang.value === 'fr' ? fo.eras_fr : fo.eras
)

// Defaults: first item of each list
const selectedTime    = ref('Any time')
const selectedContent = ref('Any content')
const selectedEra     = ref('Any era')
const selectedMood    = ref(null)
const selectedSubMood = ref(null)

// Keep default values in sync when language changes
watch(lang, () => {
  selectedTime.value    = timeAvailabilities.value[0]
  selectedContent.value = contentTypes.value[0]
  selectedEra.value     = eras.value[0]
})

const subMoods = computed(() => selectedMood.value?.submoods || [])

// Submood description in the correct language
const subMoodDescription = computed(() => {
  if (!selectedSubMood.value) return ''
  return lang.value === 'fr'
    ? (selectedSubMood.value.description_fr || selectedSubMood.value.description)
    : selectedSubMood.value.description
})

// Scroll refs
const moodRef    = ref(null)
const subMoodRef = ref(null)
const timeRef    = ref(null)
const contentRef = ref(null)
const eraRef     = ref(null)
const buttonsRef = ref(null)

const scrollTo = (el) => {
  if (!el) return
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
}

watch(selectedMood, (val) => {
  selectedSubMood.value = null
  if (val) nextTick(() => scrollTo(subMoodRef.value))
})
watch(selectedSubMood, (val) => {
  if (val) nextTick(() => scrollTo(timeRef.value))
})
watch(selectedTime,    (val) => { if (val) nextTick(() => scrollTo(contentRef.value)) })
watch(selectedContent, (val) => { if (val) nextTick(() => scrollTo(eraRef.value)) })
watch(selectedEra,     (val) => { if (val) nextTick(() => scrollTo(buttonsRef.value)) })

const handleRecommend = () => {
  emit('recommend', {
    selectedMood:    selectedMood.value,
    selectedSubMood: selectedSubMood.value,
    selectedTime:    selectedTime.value,
    selectedContent: selectedContent.value,
    selectedEra:     selectedEra.value,
  })
}

const handleReset = () => {
  selectedMood.value    = null
  selectedSubMood.value = null
  selectedTime.value    = timeAvailabilities.value[0]
  selectedContent.value = contentTypes.value[0]
  selectedEra.value     = eras.value[0]
  emit('recommend', null)
}
</script>

<template>
  <div class="flex flex-col gap-12">

    <template v-if="!isSubmitted">

      <div ref="moodRef" class="scroll-section">
        <Selections :title="t.howIFeel" :items="moods" :lang="lang" v-model="selectedMood" />
      </div>

      <div v-if="selectedMood" ref="subMoodRef" class="scroll-section">
        <Selections :title="t.subMood" :items="subMoods" :lang="lang" v-model="selectedSubMood" />
        <p v-if="selectedSubMood" class="mt-5 text-base leading-relaxed max-w-2xl pl-4 border-l-2 border-purple-500/50" style="color: rgba(255,255,255,0.55)">
          {{ subMoodDescription }}
        </p>
      </div>

      <div ref="timeRef" class="scroll-section">
        <Selections :title="t.howMuchTime" :items="timeAvailabilities" :lang="lang" v-model="selectedTime" />
      </div>

      <div ref="contentRef" class="scroll-section">
        <Selections :title="t.contentType" :items="contentTypes" :lang="lang" v-model="selectedContent" />
      </div>

      <div ref="eraRef" class="scroll-section">
        <Selections :title="t.filterByEra" :items="eras" :lang="lang" v-model="selectedEra" />
      </div>

      <div ref="buttonsRef" class="scroll-section flex flex-wrap gap-4">
        <button class="btn-secondary-2" :disabled="!selectedMood" @click="handleRecommend">
          <i class="fa-solid fa-wand-magic-sparkles mr-2"></i>{{ t.recommendBtn }}
        </button>
        <button class="btn-secondary-1" @click="handleRecommend">
          <i class="fa-solid fa-dice mr-2"></i>{{ t.pickBtn }}
        </button>
      </div>

    </template>

    <template v-else>
      <button class="btn-secondary-1 self-start" @click="handleReset">
        <i class="fa-solid fa-rotate-left mr-2"></i>{{ t.resetBtn }}
      </button>
    </template>

  </div>
</template>
