<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  trailerKey: { type: String, default: '' },
  title:      { type: String, default: '' },
})

const emit = defineEmits(['close'])

const onKey = (e) => {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center px-4" @click.self="emit('close')">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')"></div>

      <!-- Modal -->
      <div class="relative w-full max-w-3xl rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#0d0a1a]">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <div class="flex items-center gap-2">
            <i class="fa-brands fa-youtube text-red-500"></i>
            <span class="text-white font-semibold text-sm">{{ title }} — Trailer</span>
          </div>
          <button
            class="w-8 h-8 rounded-lg bg-white/5 text-white/50 hover:text-white transition flex items-center justify-center"
            @click="emit('close')"
          >
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <!-- YouTube iframe -->
        <template v-if="trailerKey">
          <div class="relative w-full" style="padding-top: 56.25%">
            <iframe
              class="absolute inset-0 w-full h-full border-0"
              :src="`https://www.youtube.com/embed/${trailerKey}?autoplay=1`"
              allow="autoplay; encrypted-media"
              allowfullscreen
            ></iframe>
          </div>
        </template>

        <!-- No trailer fallback -->
        <template v-else>
          <div class="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
            <div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
              <i class="fa-brands fa-youtube text-white/20 text-2xl"></i>
            </div>
            <p class="text-white/50 text-sm">No trailer available for this title.</p>
            <a
              :href="`https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' trailer')}`"
              target="_blank"
              rel="noopener"
              class="text-xs text-red-400 hover:text-red-300 transition border border-red-500/30 px-4 py-2 rounded-xl hover:bg-red-500/10"
            >
              <i class="fa-brands fa-youtube mr-1.5"></i>Search on YouTube
            </a>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
