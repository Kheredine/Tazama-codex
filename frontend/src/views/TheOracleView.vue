<script setup>
import { ref, nextTick } from 'vue'
import HeroSection from '@/components/TheOracleSection/HeroSection.vue'
import SelectorSection from '@/components/TheOracleSection/SelectorSection.vue'
import RecommendationSection from '@/components/TheOracleSection/RecommendationSection.vue'
import { useOracleState } from '@/composables/useOracleState'
import { useUserPreferences } from '@/composables/useUserPreferences'

const { isSubmitted, setSelections, reset } = useOracleState()
const { recordSessionMood } = useUserPreferences()

const recommendationsRef = ref(null)

const handleRecommend = (data) => {
  if (!data) {
    reset()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  setSelections(data)
  if (data.selectedMood) recordSessionMood(data.selectedMood.id)
  nextTick(() => {
    setTimeout(() => {
      recommendationsRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 200)
  })
}
</script>

<template>
  <div class="flex flex-col gap-12 py-4">

    <!-- Hero -->
    <HeroSection />

    <div class="w-full h-px" style="background: linear-gradient(to right, rgba(124,58,237,0.4), transparent)"></div>

    <!-- Filters -->
    <SelectorSection :isSubmitted="isSubmitted" @recommend="handleRecommend" />

    <!-- Recommendations appear below after submit -->
    <div v-if="isSubmitted" ref="recommendationsRef" class="scroll-section">
      <div class="w-full h-px mb-10" style="background: linear-gradient(to right, rgba(124,58,237,0.4), transparent)"></div>
      <RecommendationSection />
    </div>

  </div>
</template>
