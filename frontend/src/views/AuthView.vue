<script setup>
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { login, register } from '@/composables/useAuth'

const router = useRouter()

const activeTab = ref('login')
const loading   = ref(false)
const errorMsg  = ref('')
const email     = ref('')
const username  = ref('')
const password  = ref('')

let mounted = true
onUnmounted(() => { mounted = false })

const switchTab = (tab) => {
  activeTab.value = tab
  errorMsg.value  = ''
}

const submit = async () => {
  if (!mounted) return
  errorMsg.value = ''
  loading.value  = true

  try {
    if (activeTab.value === 'login') {
      await login(email.value.trim(), password.value)
      router.push('/')
    } else {
      if (!username.value.trim()) {
        errorMsg.value = 'Please enter a username'
        loading.value = false
        return
      }
      await register(email.value.trim(), username.value.trim(), password.value)
      router.push('/plan')
    }
  } catch (err) {
    if (mounted) errorMsg.value = err.message || 'Something went wrong'
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

        <!-- Tabs -->
        <div class="flex border-b border-white/8">
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

        <!-- Form -->
        <form class="p-8 flex flex-col gap-4" @submit.prevent="submit">

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-white/50 uppercase tracking-wider">Email</label>
            <input
              v-model="email"
              type="email"
              placeholder="you@example.com"
              required
              autocomplete="email"
              class="auth-input"
            >
          </div>

          <div v-if="activeTab === 'register'" class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-white/50 uppercase tracking-wider">Username</label>
            <input
              v-model="username"
              type="text"
              placeholder="Your display name"
              autocomplete="username"
              class="auth-input"
            >
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-white/50 uppercase tracking-wider">Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="Min. 6 characters"
              required
              autocomplete="current-password"
              class="auth-input"
            >
          </div>

          <!-- Error -->
          <div v-if="errorMsg" class="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <i class="fa-solid fa-circle-exclamation flex-shrink-0"></i>
            <span>{{ errorMsg }}</span>
          </div>

          <!-- Submit -->
          <button
            type="submit"
            class="btn-primary w-full mt-2 flex items-center justify-center gap-2"
            :disabled="loading"
          >
            <i v-if="loading" class="fa-solid fa-circle-notch fa-spin text-sm"></i>
            <span>{{ loading ? 'Please wait…' : activeTab === 'login' ? 'Sign In' : 'Create Account' }}</span>
          </button>

          <!-- Switch hint -->
          <p class="text-center text-white/35 text-xs mt-1">
            <span v-if="activeTab === 'login'">
              No account yet?
              <button type="button" class="text-purple-400 hover:text-purple-300 font-medium ml-1" @click="switchTab('register')">Create one</button>
            </span>
            <span v-else>
              Already have an account?
              <button type="button" class="text-purple-400 hover:text-purple-300 font-medium ml-1" @click="switchTab('login')">Sign in</button>
            </span>
          </p>

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
