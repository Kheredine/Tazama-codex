<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { unlockPremium, isPremium } from '@/composables/useAuth'
import { apiUrl } from '@/config/api'

const router = useRouter()

const questions  = ref([])
const answers    = ref(['', '', ''])
const loading    = ref(false)
const error      = ref('')
const success    = ref(false)
const shaking    = ref(false)

// Track mounted state so async callbacks don't update unmounted component
let mounted = true
let navTimer = null
let shakeTimer = null

onUnmounted(() => {
  mounted = false
  clearTimeout(navTimer)
  clearTimeout(shakeTimer)
})

onMounted(async () => {
  if (isPremium.value) { router.push('/'); return }
  try {
    const res  = await fetch(apiUrl('/api/auth/premium-questions'))
    const data = await res.json()
    if (mounted) questions.value = data
  } catch {
    if (mounted) error.value = 'Could not load questions. Is the server running?'
  }
})

const submit = async () => {
  if (!mounted) return
  error.value = ''
  loading.value = true

  try {
    await unlockPremium(answers.value)
    if (!mounted) return
    success.value = true
    navTimer = setTimeout(() => router.push('/'), 2500)
  } catch (err) {
    if (!mounted) return
    error.value = err.message || 'Incorrect answers — try again'
    shaking.value = true
    shakeTimer = setTimeout(() => { if (mounted) shaking.value = false }, 600)
  } finally {
    if (mounted) loading.value = false
  }
}
</script>

<template>
  <div class="py-8 max-w-lg mx-auto">

    <!-- Success overlay -->
    <Transition name="success-fade">
      <div v-if="success" class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6" style="background: rgba(10,6,21,0.97);">
        <div class="crown-glow flex items-center justify-center w-24 h-24 rounded-full" style="background: rgba(217,119,6,0.15); border: 2px solid rgba(245,158,11,0.4);">
          <i class="fa-solid fa-crown text-4xl text-amber-400"></i>
        </div>
        <div class="text-center">
          <h2 class="text-3xl font-bold text-white font-logo">Premium Unlocked!</h2>
          <p class="text-amber-400/80 mt-2">Welcome to the full Oracle experience.</p>
        </div>
        <div class="flex gap-1.5 mt-2">
          <div class="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style="animation-delay:0ms"></div>
          <div class="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style="animation-delay:120ms"></div>
          <div class="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style="animation-delay:240ms"></div>
        </div>
      </div>
    </Transition>

    <!-- Header -->
    <button class="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-8 transition" @click="router.push('/plan')">
      <i class="fa-solid fa-arrow-left text-xs"></i>
      Back to Plans
    </button>

    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style="background: rgba(217,119,6,0.15); border: 1px solid rgba(245,158,11,0.3);">
        <i class="fa-solid fa-key text-2xl text-amber-400"></i>
      </div>
      <h1 class="text-2xl font-bold text-white font-logo mb-2">Unlock Premium</h1>
      <p class="text-white/40 text-sm">Answer 3 questions about the developer to unlock the full Oracle experience.</p>
    </div>

    <!-- Form -->
    <form
      class="flex flex-col gap-5 p-7 rounded-2xl border border-white/8 transition-all"
      :class="shaking ? 'shake-anim border-red-500/40' : ''"
      style="background: rgba(255,255,255,0.04);"
      @submit.prevent="submit"
    >

      <div v-if="questions.length === 0 && !error" class="text-center text-white/30 py-6">
        <i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Loading questions…
      </div>

      <template v-for="(q, i) in questions" :key="q.id">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-white/70">
            <span class="text-amber-400 mr-2">{{ i + 1 }}.</span>{{ q.question }}
          </label>
          <input
            v-model="answers[i]"
            type="text"
            :placeholder="`Your answer…`"
            required
            class="unlock-input"
          >
        </div>
      </template>

      <!-- Error -->
      <div v-if="error" class="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
        <i class="fa-solid fa-circle-exclamation flex-shrink-0"></i>
        {{ error }}
      </div>

      <!-- Submit -->
      <button
        v-if="questions.length > 0"
        type="submit"
        :disabled="loading"
        class="w-full py-3.5 rounded-xl font-semibold text-sm transition cursor-pointer flex items-center justify-center gap-2 mt-2"
        style="background: linear-gradient(135deg, #d97706, #f59e0b); color: #0a0615;"
      >
        <i v-if="loading" class="fa-solid fa-circle-notch fa-spin text-sm"></i>
        <i v-else class="fa-solid fa-crown text-sm"></i>
        {{ loading ? 'Checking…' : 'Unlock Premium' }}
      </button>

    </form>

    <p class="text-center text-white/20 text-xs mt-6">
      Answers are not case-sensitive
    </p>

  </div>
</template>

<style scoped>
.unlock-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
  padding: 13px 16px;
  color: white;
  font-size: 15px;
  width: 100%;
  outline: none;
  transition: border-color 0.15s;
}
.unlock-input::placeholder { color: rgba(255,255,255,0.25); }
.unlock-input:focus { border-color: rgba(217,119,6,0.5); }

@keyframes shake {
  0%,100% { transform: translateX(0); }
  20%      { transform: translateX(-8px); }
  40%      { transform: translateX(8px); }
  60%      { transform: translateX(-5px); }
  80%      { transform: translateX(5px); }
}
.shake-anim { animation: shake 0.55s ease; }

@keyframes crownPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
  50%     { box-shadow: 0 0 32px 8px rgba(245,158,11,0.25); }
}
.crown-glow { animation: crownPulse 1.8s ease-in-out infinite; }

.success-fade-enter-active { transition: opacity 0.4s ease; }
.success-fade-enter-from   { opacity: 0; }
</style>
