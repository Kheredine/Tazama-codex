<script setup>
import { useMoods } from '@/composables/useMoods'

const {
  moods,
  selectedMood,
  selectedSubMood,
  currentSubMoods,
  currentExamples,
  selectMood,
  selectSubMood
} = useMoods()
</script>

<template>
  <!-- Mood pills -->

  <div class="mood">
    <h2 class="uppercase text-[11px] tracking-2 mb-4 font-medium text-[#fbffff]">How I want to feel</h2>

    <div class="flex flex-wrap gap-4">
        <button
            v-for="mood in moods"
            :key="mood.id"
            :class="['btn-pill', { pill_active: selectedMood?.id === mood.id }]"
            @click="selectMood(mood)"
            >
            {{ mood.emoji }} {{ mood.mood }}
        </button>
    </div>
    </div>

  <!-- Sub-mood pills (appear after mood is selected) -->

  <div class="sub-mood" v-if="currentSubMoods.length">
    <h2 class="uppercase text-[11px] tracking-2 mb-4 font-medium text-[#fbffff]">Sub Mood</h2>

    <div class="flex flex-wrap gap-4">
        <button
            v-for="sub in currentSubMoods"
            :key="sub.id"
            :class="['btn-sub-pill', { pill_active: selectedSubMood?.id === sub.id }]"
            @click="selectSubMood(sub)"
            >
            {{ sub.label }}
        </button>
  </div>
  </div>
  

  <!-- Description -->
  <p v-if="selectedSubMood" class="text-white/70">
    {{ selectedSubMood.description }}
  </p>

  <!-- Examples -->
  <!-- <div v-if="currentExamples.length" class="examples-grid">
    <div v-for="ex in currentExamples" :key="ex.title" class="example-card">
      <span class="example-type">{{ ex.type }}</span>
      <span class="example-title">{{ ex.title }}</span>
      <span class="example-year">{{ ex.year }}</span>
    </div>
  </div> -->
</template>