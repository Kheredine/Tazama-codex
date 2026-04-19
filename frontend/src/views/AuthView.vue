<script setup>
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { login, register } from '@/composables/useAuth'

const router = useRouter()

// ── Shared state ───────────────────────────────────────────────────────────
const activeTab = ref('login')   // 'login' | 'register'
const loading   = ref(false)
const errorMsg  = ref('')

// ── Login state ────────────────────────────────────────────────────────────
const loginUsername = ref('')
const loginPasscode = ref('')

// ── Register state (multi-step) ────────────────────────────────────────────
const regStep      = ref(1)   // 1 = enter name, 2 = show passcode, 3 = verify
const regUsername  = ref('')
const genPasscode  = ref('')  // passcode returned by backend
const verifyInput  = ref('')
const copied       = ref(false)

let mounted = true
onUnmounted(() => { mounted = false })

// ── Tab switching ──────────────────────────────────────────────────────────
const switchTab = (tab) => {
  activeTab.value  = tab
  errorMsg.value   = ''
  loginUsername.value = ''
  loginPasscode.value = ''
  regStep.value    = 1
  regUsername.value  = ''
  genPasscode.value  = ''
  verifyInput.value  = ''
  copied.value       = false
}

// ── Login submit ───────────────────────────────────────────────────────────
const submitLogin = async () => {
  if (!mounted) return
  if (!loginUsername.value.trim() || !loginPasscode.value) {
    errorMsg.value = 'Username and passcode are required'
    return
  }
  errorMsg.value = ''
  loading.value  = true
  try {
    await login(loginUsername.value.trim(), loginPasscode.value)
    router.push('/')
  } catch (err) {
    if (mounted) errorMsg.value = err.message || 'Something went wrong'
  } finally {
    if (mounted) loading.value = false
  }
}

// ── Register step 1: request passcode ─────────────────────────────────────
const submitRegister = async () => {
  if (!mounted) return
  if (!regUsername.value.trim()) {
    errorMsg.value = 'Please enter your name'
    return
  }
  errorMsg.value = ''
  loading.value  = true
  try {
    const data = await register(regUsername.value.trim())
    genPasscode.value = data.passcode
    regStep.value     = 2
  } catch (err) {
    if (mounted) errorMsg.value = err.message || 'Something went wrong'
  } finally {
    if (mounted) loading.value = false
  }
}

// ── Register step 2: user copies → continue ───────────────────────────────
const copyPasscode = async () => {
  try {
    await navigator.clipboard.writeText(genPasscode.value)
    copied.value = true
    setTimeout(() => { if (mounted) copied.value = false }, 2500)
  } catch {
    // Fallback: just show it was "copied"
    copied.value = true
    setTimeout(() => { if (mounted) copied.value = false }, 2500)
  }
}

const continueToVerify = () => {
  verifyInput.value = ''
  errorMsg.value    = ''
  regStep.value     = 3
}

// ── Register step 3: verify passcode ──────────────────────────────────────
const submitVerify = async () => {
  if (!mounted) return
  if (!verifyInput.value) {
    errorMsg.value = 'Please enter your passcode'
    return
  }
  errorMsg.value = ''
  loading.value  = true
  try {
    await login(regUsername.value.trim(), verifyInput.value)
    router.push('/')
  } catch (err) {
    if (mounted) errorMsg.value = err.message || 'Incorrect passcode — please try again'
  } finally {
    if (mounted) loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-12"
       style="background: #0a0615; background-image: radial-gradient(1200px at 30% 20%, rgba(124,58,237,0.15), transparent), radial-gradient(800px at 80% 80%, rgba(88,28,255,0.10), transparent);">

    <div class="w-full max-w-md">

      <!-- Brand -->
      <div class="flex flex-col items-center gap-3 mb-10">
        <div class="shadow-2xl shadow-purple-900/50 rounded-2xl">
          <img src="@/assets/images/logo_tazama.png" alt="Tazama Logo" class="w-40 h-40">
        </div>
        <h1 class="font-logo text-3xl font-bold text-white tracking-tight">Tazama</h1>
        <p class="text-white/40 text-sm">Your mood-based entertainment oracle</p>
      </div>

      <!-- Card -->
      <div class="rounded-2xl border border-white/8 overflow-hidden"
           style="background: rgba(255,255,255,0.04); backdrop-filter: blur(24px);">

        <!-- Tabs — only shown on step 1 or login -->
        <div v-if="activeTab === 'login' || regStep === 1" class="flex border-b border-white/8">
          <button
            class="flex-1 py-4 text-sm font-semibold transition-colors"
            :class="activeTab === 'login'
              ? 'text-white border-b-2 border-purple-500 bg-purple-500/5'
              : 'text-white/40 hover:text-white/70'"
            @click="switchTab('login')"
          >Sign In</button>
          <button
            class="flex-1 py-4 text-sm font-semibold transition-colors"
            :class="activeTab === 'register'
              ? 'text-white border-b-2 border-purple-500 bg-purple-500/5'
              : 'text-white/40 hover:text-white/70'"
            @click="switchTab('register')"
          >Create Account</button>
        </div>

        <!-- ── LOGIN FORM ───────────────────────────────────────────────── -->
        <form v-if="activeTab === 'login'" class="p-8 flex flex-col gap-4" @submit.prevent="submitLogin">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-white/50 uppercase tracking-wider">Username</label>
            <input
              v-model="loginUsername"
              type="text"
              placeholder="Your username"
              required
              autocomplete="username"
              class="auth-input"
            >
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-white/50 uppercase tracking-wider">Passcode</label>
            <input
              v-model="loginPasscode"
              type="password"
              placeholder="4-digit passcode"
              required
              autocomplete="current-password"
              maxlength="4"
              inputmode="numeric"
              class="auth-input tracking-[0.4em]"
            >
          </div>

          <div v-if="errorMsg" class="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <i class="fa-solid fa-circle-exclamation shrink-0"></i>
            <span>{{ errorMsg }}</span>
          </div>

          <button type="submit" class="btn-primary w-full mt-2 flex items-center justify-center gap-2" :disabled="loading">
            <i v-if="loading" class="fa-solid fa-circle-notch fa-spin text-sm"></i>
            <span>{{ loading ? 'Signing in…' : 'Sign In' }}</span>
          </button>

          <p class="text-center text-white/35 text-xs mt-1">
            No account yet?
            <button type="button" class="text-purple-400 hover:text-purple-300 font-medium ml-1" @click="switchTab('register')">Create one</button>
          </p>
        </form>

        <!-- ── REGISTER: STEP 1 — enter name ───────────────────────────── -->
        <form v-else-if="activeTab === 'register' && regStep === 1" class="p-8 flex flex-col gap-4" @submit.prevent="submitRegister">
          <div class="text-center mb-2">
            <p class="text-white/60 text-sm leading-relaxed">Choose a username. We'll generate a secure<br>4-digit passcode for you.</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-white/50 uppercase tracking-wider">Username</label>
            <input
              v-model="regUsername"
              type="text"
              placeholder="Your display name"
              required
              autocomplete="off"
              class="auth-input"
            >
          </div>

          <div v-if="errorMsg" class="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <i class="fa-solid fa-circle-exclamation shrink-0"></i>
            <span>{{ errorMsg }}</span>
          </div>

          <button type="submit" class="btn-primary w-full flex items-center justify-center gap-2" :disabled="loading">
            <i v-if="loading" class="fa-solid fa-circle-notch fa-spin text-sm"></i>
            <span>{{ loading ? 'Generating…' : 'Generate Passcode' }}</span>
          </button>

          <p class="text-center text-white/35 text-xs">
            Already have an account?
            <button type="button" class="text-purple-400 hover:text-purple-300 font-medium ml-1" @click="switchTab('login')">Sign in</button>
          </p>
        </form>

        <!-- ── REGISTER: STEP 2 — show passcode ────────────────────────── -->
        <div v-else-if="activeTab === 'register' && regStep === 2" class="p-8 flex flex-col gap-5">
          <div class="text-center">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                 style="background: rgba(124,58,237,0.25); border: 1px solid rgba(124,58,237,0.4);">
              <i class="fa-solid fa-key text-purple-400 text-2xl"></i>
            </div>
            <h2 class="text-white font-bold text-xl mb-1">Your Passcode</h2>
            <p class="text-white/40 text-sm">This is shown once. Copy and keep it safe.</p>
          </div>

          <!-- Passcode display -->
          <div class="flex justify-center gap-3 my-2">
            <div
              v-for="digit in genPasscode.split('')"
              :key="digit + Math.random()"
              class="w-14 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold text-white"
              style="background: rgba(124,58,237,0.2); border: 2px solid rgba(124,58,237,0.5);"
            >{{ digit }}</div>
          </div>

          <!-- Copy button -->
          <button
            type="button"
            class="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition border"
            :style="copied
              ? 'background: rgba(16,185,129,0.2); color: #34d399; border-color: rgba(16,185,129,0.4);'
              : 'background: rgba(124,58,237,0.15); color: #c4b5fd; border-color: rgba(124,58,237,0.3);'"
            @click="copyPasscode"
          >
            <i :class="copied ? 'fa-solid fa-check' : 'fa-solid fa-copy'" class="text-xs"></i>
            {{ copied ? 'Copied!' : 'Copy Passcode' }}
          </button>

          <button
            type="button"
            class="btn-primary w-full flex items-center justify-center gap-2"
            @click="continueToVerify"
          >
            I've saved it
            <i class="fa-solid fa-arrow-right text-xs"></i>
          </button>
        </div>

        <!-- ── REGISTER: STEP 3 — verify passcode ──────────────────────── -->
        <form v-else-if="activeTab === 'register' && regStep === 3" class="p-8 flex flex-col gap-4" @submit.prevent="submitVerify">
          <div class="text-center mb-2">
            <p class="text-white/60 text-sm">Enter your 4-digit passcode to confirm.</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-white/50 uppercase tracking-wider">Confirm Passcode</label>
            <input
              v-model="verifyInput"
              type="password"
              placeholder="• • • •"
              required
              autocomplete="new-password"
              maxlength="4"
              inputmode="numeric"
              class="auth-input tracking-[0.5em] text-center text-xl"
            >
          </div>

          <div v-if="errorMsg" class="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <i class="fa-solid fa-circle-exclamation shrink-0"></i>
            <span>{{ errorMsg }}</span>
          </div>

          <button type="submit" class="btn-primary w-full flex items-center justify-center gap-2" :disabled="loading">
            <i v-if="loading" class="fa-solid fa-circle-notch fa-spin text-sm"></i>
            <span>{{ loading ? 'Signing in…' : 'Confirm & Sign In' }}</span>
          </button>

          <button type="button" class="text-center text-white/30 text-xs hover:text-white/60 transition" @click="regStep = 2">
            <i class="fa-solid fa-arrow-left mr-1"></i>Back
          </button>
        </form>

      </div>

      <p class="text-center text-white/20 text-xs mt-6">
        Powered by Oracle AI · TMDB
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 12px;
  padding: 13px 16px;
  color: white;
  font-size: 15px;
  width: 100%;
  transition: border-color 0.15s;
  outline: none;
}
.auth-input::placeholder { color: rgba(255,255,255,0.25); }
.auth-input:focus { border-color: rgba(124, 58, 237, 0.6); }
</style>
