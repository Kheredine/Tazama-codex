<script setup>
const props = defineProps({
  title: String,
  items: Array,
  modelValue: [String, Object, null],
  lang: { type: String, default: 'en' },
})

defineEmits(["update:modelValue"])

// Get display label based on current language
const label = (item) => {
  if (typeof item === 'string') return item
  if (props.lang === 'fr') {
    return item.submood_fr || item.mood_fr || item.submood || item.mood || item
  }
  return item.submood || item.mood || item
}

const isActive = (item) =>
  typeof item === 'string'
    ? props.modelValue === item
    : props.modelValue?.id === item?.id
</script>

<template>
  <div>
    <h2 class="uppercase text-[11px] tracking-[0.18em] mb-5 font-semibold" style="color: rgba(255,255,255,0.40)">
      {{ title }}
    </h2>

    <div class="flex flex-wrap gap-3">
      <button
        v-for="item in items"
        :key="item.id || item"
        class="btn-time-pill"
        :class="{ pill_active: isActive(item) }"
        @click="$emit('update:modelValue', item)"
      >
        <span v-if="item.emoji" class="mr-1.5">{{ item.emoji }}</span>
        {{ label(item) }}
      </button>
    </div>
  </div>
</template>
