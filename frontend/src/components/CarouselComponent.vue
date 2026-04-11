<script setup>
import caroussel_1 from '@/assets/images/caroussel-1.jpg'
import caroussel_2 from '@/assets/images/carousel-2.jfif'
import caroussel_3 from '@/assets/images/carousel-3.avif'
import { reactive, onMounted, onUnmounted, ref } from 'vue';

// ─── POSITION CLASSES ───────────────────────────────────────────────
// Each position name maps to a set of Tailwind classes.
// These replace the inline left/top/z_index/height values you had before.
const positionClasses = {
  front:  'h-[500px] top-0       left-0        z-30 opacity-100',
  middle: 'h-[460px] top-[26px]  left-[90px]   z-20 opacity-100',
  back:   'h-[420px] top-[52px]  left-[180px]  z-10 opacity-100',
  exit:   'pos-exit',   // defined in your CSS already
  enter:  'pos-enter',  // defined in your CSS already
}

// ─── DATA ────────────────────────────────────────────────────────────
// Added a `position` field to each item.
// Removed left/top/z_index/height — the position class handles that now.
const carouselItems = reactive([
  {
    id: 1,
    title: "How to train your dragon",
    info: ["1h 56min", "Action", "Movie", "2025", "6+"],
    trailerDuration: "2:30",
    trailerUrl: caroussel_1,
    position: 'front',   // ← starts as the main card
  },
  {
    id: 2,
    title: "Inception",
    info: ["2h 10min", "Sci-Fi", "Movie", "2024", "PG"],
    trailerDuration: "3:00",
    trailerUrl: caroussel_2,
    position: 'middle',  // ← starts as the second card
  },
  {
    id: 3,
    title: "Demon Slayer",
    info: ["1h 45min", "Action", "Movie", "2023", "13+"],
    trailerDuration: "2:45",
    trailerUrl: caroussel_3,
    position: 'back',    // ← starts as the third card
  },
])

// ─── ANIMATION LOGIC ─────────────────────────────────────────────────
let interval = null

const paused = ref(false)

function nextStep() {
  if (paused.value) return

  // Find who is currently in each position
  const front  = carouselItems.find(c => c.position === 'front')
  const middle = carouselItems.find(c => c.position === 'middle')
  const back   = carouselItems.find(c => c.position === 'back')

  // STEP 1 — Slide the front card off to the left
  front.position = 'exit'

  // STEP 2 — Promote middle → front
  middle.position = 'front'

  // STEP 3 — Promote back → middle
  back.position = 'middle'

  // STEP 4 — After the exit animation finishes (700ms),
  // reset the exited card to off-screen right (enter),
  // then after 50ms move it to the back position.
  // This way the same 3 cards keep cycling forever.
  setTimeout(() => {
    front.position = 'enter'
    setTimeout(() => {
      front.position = 'back'
    }, 50)
  }, 700)
}

function pause() {
  paused.value = true
}

function resume() {
  paused.value = false
}

onMounted(() => {
  interval = setInterval(nextStep, 3000)
})

onUnmounted(() => {
  clearInterval(interval)
})
</script>

<template>
  <div class="carousels overflow-hidden relative w-[900px] h-[500px]" @mouseenter="pause" @mouseleave="resume">
    <div
      class="carousel-card"
      v-for="carouselItem in carouselItems"
      :key="carouselItem.id"
      :class="positionClasses[carouselItem.position]"
      :style="{ backgroundImage: `url(${carouselItem.trailerUrl})` }"
    >
      <div class="badges flex gap-2">
        <span class="badge" v-for="(badge, i) in carouselItem.info" :key="i">
          {{ badge }}
        </span>
      </div>

      <div class="overlay absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent rounded-2xl"></div>

      <div class="trailer_info flex mt-auto items-center text-white z-10">
        <div class="flex gap-2 cursor-pointer items-center">
          <i class="fa-solid fa-circle-play text-4xl"></i>
          <div class="trailer_info text-base font-light">
            <p>{{ carouselItem.title }}</p>
            <span class="text-sm">Play trailer {{ carouselItem.trailerDuration }}</span>
          </div>
        </div>

        <!-- Watch Later button only shows on the front card -->
        <div
          class="watch_later_btn group ml-auto relative"
          v-if="carouselItem.position === 'front'"
        >
          <i class="fa-solid fa-clock cursor-pointer text-4xl ml-auto"></i>
          <div class="absolute right-0 mt-2 whitespace-nowrap bg-[#7C3AED]/60 text-white text-xs px-3 py-1 rounded-md
                      opacity-0 group-hover:opacity-100 transition pointer-events-none">
            Add to Watch Later
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style></style>
