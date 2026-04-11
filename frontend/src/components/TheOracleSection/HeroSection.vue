<script setup>
import { useTimeOfDay } from '@/composables/useTimeOfDay'
import { useI18n } from '@/composables/useI18n'

const { day, timeOfDay } = useTimeOfDay()
const { t } = useI18n()
</script>

<template>
  <div class="opacity-0 animate-fadeUp">
    <p class="uppercase text-xs tracking-[0.2em] font-semibold mb-4" style="color: rgba(255,255,255,0.38)">
      {{ day }} · {{ timeOfDay }}
    </p>

    <h1 class="text-3xl sm:text-4xl md:text-5xl font-heroTitle uppercase text-white leading-tight mb-5">
      {{ t.oracleTitle }}
    </h1>

    <p class="text-base md:text-lg max-w-xl leading-relaxed" style="color: rgba(255,255,255,0.5)">
      {{ t.oracleSubtitle }}
    </p>
  </div>
</template>
