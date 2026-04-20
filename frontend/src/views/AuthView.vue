<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { login, register } from '@/composables/useAuth'
import { apiUrl } from '@/config/api'

const router = useRouter()

// ── Page language (independent of global i18n — user not logged in yet) ────────
const pageLang = ref(localStorage.getItem('tazama_lang') || 'en')
const togglePageLang = () => {
  pageLang.value = pageLang.value === 'en' ? 'fr' : 'en'
  localStorage.setItem('tazama_lang', pageLang.value)
}

const T = computed(() => pageLang.value === 'fr' ? FR : EN)

const EN = {
  signIn:          'Sign In',
  createAccount:   'Create Account',
  username:        'Username',
  passcode:        'Passcode',
  usernamePh:      'Your username',
  passcodePh:      '4-digit passcode',
  signingIn:       'Signing in…',
  noAccount:       'No account yet?',
  createOne:       'Create one',
  forgotCode:      'Forgot your code?',
  // forgot flow
  forgotTitle:     'Recover Access',
  forgotDesc:      'Enter your username to generate a new passcode. Your old code will be replaced immediately.',
  forgotWarning:   'Anyone who knows your username can reset your code. Keep your username private.',
  forgotSubmit:    'Generate New Code',
  forgotGenerating:'Generating…',
  backToSignIn:    'Back to sign in',
  // register step 1
  reg1Desc:        "Choose a username. We'll generate a secure 4-digit passcode for you.",
  generatePasscode:'Generate Passcode',
  generating:      'Generating…',
  alreadyAccount:  'Already have an account?',
  signInLink:      'Sign in',
  // register step 2
  yourPasscode:    'Your Passcode',
  shownOnce:       'This is shown only once.',
  saveWarning:     'You MUST memorise or save this code. Without it you will not be able to sign in — there is no email recovery.',
  copyPasscode:    'Copy Passcode',
  copied:          'Copied!',
  iSavedIt:        "I've saved it — continue",
  // register step 3
  confirmDesc:     'Enter your 4-digit passcode to confirm.',
  confirmPasscode: 'Confirm Passcode',
  confirmSubmit:   'Confirm & Sign In',
  back:            'Back',
  // new passcode display (forgot flow)
  newPasscodeTitle:'New Passcode Generated',
  newPasscodeDesc: 'Your old code has been replaced. Save this new code now — it will not be shown again.',
  continueSignIn:  'Continue to Sign In',
  // errors
  requiredFields:  'Username and passcode are required',
  enterName:       'Please enter a username',
  enterPasscode:   'Please enter your passcode',
  enterUsername:   'Please enter your username',
  somethingWrong:  'Something went wrong',
  incorrectPasscode: 'Incorrect passcode — please try again',
  // footer
  poweredBy:       'Powered by Oracle AI · TMDB',
  switchLang:      'Passer en français',
}

const FR = {
  signIn:          'Se connecter',
  createAccount:   'Créer un compte',
  username:        "Nom d'utilisateur",
  passcode:        'Code secret',
  usernamePh:      "Votre nom d'utilisateur",
  passcodePh:      'Code à 4 chiffres',
  signingIn:       'Connexion…',
  noAccount:       'Pas encore de compte ?',
  createOne:       'En créer un',
  forgotCode:      'Code oublié ?',
  // forgot flow
  forgotTitle:     'Récupérer l\'accès',
  forgotDesc:      'Entrez votre nom d\'utilisateur pour générer un nouveau code. L\'ancien sera remplacé immédiatement.',
  forgotWarning:   'Toute personne connaissant votre nom d\'utilisateur peut réinitialiser votre code. Gardez-le confidentiel.',
  forgotSubmit:    'Générer un nouveau code',
  forgotGenerating:'Génération…',
  backToSignIn:    'Retour à la connexion',
  // register step 1
  reg1Desc:        "Choisissez un nom d'utilisateur. Nous générerons un code secret à 4 chiffres.",
  generatePasscode:'Générer le code',
  generating:      'Génération…',
  alreadyAccount:  'Vous avez déjà un compte ?',
  signInLink:      'Se connecter',
  // register step 2
  yourPasscode:    'Votre code secret',
  shownOnce:       'Ce code est affiché une seule fois.',
  saveWarning:     'Vous DEVEZ mémoriser ou sauvegarder ce code. Sans lui, vous ne pourrez pas vous connecter — il n\'y a pas de récupération par e-mail.',
  copyPasscode:    'Copier le code',
  copied:          'Copié !',
  iSavedIt:        "Je l'ai sauvegardé — continuer",
  // register step 3
  confirmDesc:     'Saisissez votre code à 4 chiffres pour confirmer.',
  confirmPasscode: 'Confirmer le code',
  confirmSubmit:   'Confirmer et se connecter',
  back:            'Retour',
  // new passcode display
  newPasscodeTitle:'Nouveau code généré',
  newPasscodeDesc: 'Votre ancien code a été remplacé. Sauvegardez ce nouveau code maintenant — il ne sera plus affiché.',
  continueSignIn:  'Continuer vers la connexion',
  // errors
  requiredFields:  "Nom d'utilisateur et code requis",
  enterName:       "Veuillez saisir un nom d'utilisateur",
  enterPasscode:   'Veuillez saisir votre code',
  enterUsername:   "Veuillez saisir votre nom d'utilisateur",
  somethingWrong:  'Une erreur est survenue',
  incorrectPasscode: 'Code incorrect — veuillez réessayer',
  // footer
  poweredBy:       'Propulsé par Oracle IA · TMDB',
  switchLang:      'Switch to English',
}

// ── Shared state ───────────────────────────────────────────────────────────────
const activeTab = ref('login')   // 'login' | 'register' | 'forgot'
const loading   = ref(false)
const errorMsg  = ref('')

// ── Login state ────────────────────────────────────────────────────────────────
const loginUsername = ref('')
const loginPasscode = ref('')

// ── Register state (multi-step) ────────────────────────────────────────────────
const regStep     = ref(1)
const regUsername = ref('')
const genPasscode = ref('')
const verifyInput = ref('')
const copied      = ref(false)

// ── Forgot-code state ──────────────────────────────────────────────────────────
const forgotUsername    = ref('')
const forgotNewPasscode = ref('')
const forgotCopied      = ref(false)
const forgotStep        = ref(1)  // 1 = form, 2 = show new code

let mounted = true
onUnmounted(() => { mounted = false })

// ── Tab switching ──────────────────────────────────────────────────────────────
const switchTab = (tab) => {
  activeTab.value      = tab
  errorMsg.value       = ''
  loginUsername.value  = ''
  loginPasscode.value  = ''
  regStep.value        = 1
  regUsername.value    = ''
  genPasscode.value    = ''
  verifyInput.value    = ''
  copied.value         = false
  forgotUsername.value = ''
  forgotNewPasscode.value = ''
  forgotCopied.value   = false
  forgotStep.value     = 1
}

// ── Login ──────────────────────────────────────────────────────────────────────
const submitLogin = async () => {
  if (!mounted) return
  if (!loginUsername.value.trim() || !loginPasscode.value) {
    errorMsg.value = T.value.requiredFields
    return
  }
  errorMsg.value = ''
  loading.value  = true
  try {
    await login(loginUsername.value.trim(), loginPasscode.value)
    router.push('/')
  } catch (err) {
    if (mounted) errorMsg.value = err.message || T.value.somethingWrong
  } finally {
    if (mounted) loading.value = false
  }
}

// ── Register step 1 ────────────────────────────────────────────────────────────
const submitRegister = async () => {
  if (!mounted) return
  if (!regUsername.value.trim()) { errorMsg.value = T.value.enterName; return }
  errorMsg.value = ''
  loading.value  = true
  try {
    const data = await register(regUsername.value.trim())
    genPasscode.value = data.passcode
    regStep.value     = 2
  } catch (err) {
    if (mounted) errorMsg.value = err.message || T.value.somethingWrong
  } finally {
    if (mounted) loading.value = false
  }
}

// ── Register step 2 ────────────────────────────────────────────────────────────
const copyPasscode = async () => {
  try { await navigator.clipboard.writeText(genPasscode.value) } catch { /* noop */ }
  copied.value = true
  setTimeout(() => { if (mounted) copied.value = false }, 2500)
}

const continueToVerify = () => {
  verifyInput.value = ''
  errorMsg.value    = ''
  regStep.value     = 3
}

// ── Register step 3 ────────────────────────────────────────────────────────────
const submitVerify = async () => {
  if (!mounted) return
  if (!verifyInput.value) { errorMsg.value = T.value.enterPasscode; return }
  errorMsg.value = ''
  loading.value  = true
  try {
    await login(regUsername.value.trim(), verifyInput.value)
    router.push('/')
  } catch (err) {
    if (mounted) errorMsg.value = err.message || T.value.incorrectPasscode
  } finally {
    if (mounted) loading.value = false
  }
}

// ── Forgot code ────────────────────────────────────────────────────────────────
const submitForgot = async () => {
  if (!mounted) return
  if (!forgotUsername.value.trim()) { errorMsg.value = T.value.enterUsername; return }
  errorMsg.value = ''
  loading.value  = true
  try {
    const res = await fetch(apiUrl('/api/auth/reset-passcode'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: forgotUsername.value.trim() }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || T.value.somethingWrong)
    forgotNewPasscode.value = data.passcode
    forgotStep.value        = 2
  } catch (err) {
    if (mounted) errorMsg.value = err.message || T.value.somethingWrong
  } finally {
    if (mounted) loading.value = false
  }
}

const copyForgotPasscode = async () => {
  try { await navigator.clipboard.writeText(forgotNewPasscode.value) } catch { /* noop */ }
  forgotCopied.value = true
  setTimeout(() => { if (mounted) forgotCopied.value = false }, 2500)
}

const proceedToSignIn = () => {
  loginUsername.value = forgotUsername.value
  loginPasscode.value = ''
  switchTab('login')
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center px-4 py-12"
    style="background:#0a0615; background-image:radial-gradient(1200px at 30% 20%,rgba(124,58,237,.15),transparent),radial-gradient(800px at 80% 80%,rgba(88,28,255,.10),transparent);"
  >
    <div class="w-full max-w-md">

      <!-- Brand + language toggle -->
      <div class="flex flex-col items-center gap-3 mb-10 relative">
        <!-- Language toggle (top-right) -->
        <button
          class="absolute top-0 right-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/4 text-white/45 text-xs font-medium hover:bg-purple-500/15 hover:border-purple-500/30 hover:text-purple-300 transition"
          @click="togglePageLang"
          :title="T.switchLang"
        >
          <i class="fa-solid fa-globe text-[10px]"></i>
          {{ pageLang === 'en' ? 'FR' : 'EN' }}
        </button>

        <div class="shadow-2xl shadow-purple-900/50 rounded-2xl">
          <img src="@/assets/images/logo_tazama.png" alt="Tazama Logo" class="w-40 h-40">
        </div>
        <h1 class="font-logo text-3xl font-bold text-white tracking-tight">Tazama</h1>
        <p class="text-white/40 text-sm">Your mood-based entertainment oracle</p>
      </div>

      <!-- Card -->
      <div
        class="rounded-2xl border border-white/8 overflow-hidden"
        style="background:rgba(255,255,255,0.04);backdrop-filter:blur(24px);"
      >

        <!-- Tabs — login / register (not shown during forgot flow or later reg steps) -->
        <div
          v-if="(activeTab === 'login' || activeTab === 'register') && regStep === 1"
          class="flex border-b border-white/8"
        >
          <button
            class="flex-1 py-4 text-sm font-semibold transition-colors"
            :class="activeTab === 'login'
              ? 'text-white border-b-2 border-purple-500 bg-purple-500/5'
              : 'text-white/40 hover:text-white/70'"
            @click="switchTab('login')"
          >{{ T.signIn }}</button>
          <button
            class="flex-1 py-4 text-sm font-semibold transition-colors"
            :class="activeTab === 'register'
              ? 'text-white border-b-2 border-purple-500 bg-purple-500/5'
              : 'text-white/40 hover:text-white/70'"
            @click="switchTab('register')"
          >{{ T.createAccount }}</button>
        </div>

        <!-- ═══ LOGIN FORM ═══════════════════════════════════════════════════ -->
        <form
          v-if="activeTab === 'login'"
          class="p-8 flex flex-col gap-4"
          @submit.prevent="submitLogin"
        >
          <div class="flex flex-col gap-1.5">
            <label class="field-label">{{ T.username }}</label>
            <input
              v-model="loginUsername"
              type="text"
              :placeholder="T.usernamePh"
              required autocomplete="username"
              class="auth-input"
            >
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="field-label">{{ T.passcode }}</label>
            <input
              v-model="loginPasscode"
              type="password"
              :placeholder="T.passcodePh"
              required autocomplete="current-password"
              maxlength="4" inputmode="numeric"
              class="auth-input tracking-[0.4em]"
            >
          </div>

          <div v-if="errorMsg" class="err-box">
            <i class="fa-solid fa-circle-exclamation shrink-0"></i>
            <span>{{ errorMsg }}</span>
          </div>

          <button type="submit" class="btn-primary w-full mt-2 flex items-center justify-center gap-2" :disabled="loading">
            <i v-if="loading" class="fa-solid fa-circle-notch fa-spin text-sm"></i>
            <span>{{ loading ? T.signingIn : T.signIn }}</span>
          </button>

          <!-- Forgot code link -->
          <button
            type="button"
            class="text-center text-white/30 text-xs hover:text-purple-400 transition mt-1"
            @click="switchTab('forgot')"
          >
            {{ T.forgotCode }}
          </button>

          <p class="text-center text-white/35 text-xs">
            {{ T.noAccount }}
            <button type="button" class="text-purple-400 hover:text-purple-300 font-medium ml-1" @click="switchTab('register')">
              {{ T.createOne }}
            </button>
          </p>
        </form>

        <!-- ═══ FORGOT CODE — STEP 1: enter username ═════════════════════════ -->
        <div v-else-if="activeTab === 'forgot' && forgotStep === 1" class="p-8 flex flex-col gap-4">
          <div class="text-center mb-1">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                 style="background:rgba(245,158,11,0.18);border:1px solid rgba(245,158,11,0.35);">
              <i class="fa-solid fa-key text-amber-400 text-xl"></i>
            </div>
            <h2 class="text-white font-bold text-lg mb-1">{{ T.forgotTitle }}</h2>
            <p class="text-white/45 text-sm leading-relaxed">{{ T.forgotDesc }}</p>
          </div>

          <!-- Security notice -->
          <div class="flex items-start gap-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-2.5">
            <i class="fa-solid fa-triangle-exclamation text-amber-400/70 text-xs mt-0.5 shrink-0"></i>
            <p class="text-[11px] text-amber-200/55 leading-relaxed">{{ T.forgotWarning }}</p>
          </div>

          <form @submit.prevent="submitForgot" class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="field-label">{{ T.username }}</label>
              <input
                v-model="forgotUsername"
                type="text"
                :placeholder="T.usernamePh"
                required autocomplete="off"
                class="auth-input"
              >
            </div>

            <div v-if="errorMsg" class="err-box">
              <i class="fa-solid fa-circle-exclamation shrink-0"></i>
              <span>{{ errorMsg }}</span>
            </div>

            <button type="submit" class="btn-primary w-full flex items-center justify-center gap-2" :disabled="loading">
              <i v-if="loading" class="fa-solid fa-circle-notch fa-spin text-sm"></i>
              <span>{{ loading ? T.forgotGenerating : T.forgotSubmit }}</span>
            </button>
          </form>

          <button
            type="button"
            class="text-center text-white/30 text-xs hover:text-white/60 transition"
            @click="switchTab('login')"
          >
            <i class="fa-solid fa-arrow-left mr-1"></i>{{ T.backToSignIn }}
          </button>
        </div>

        <!-- ═══ FORGOT CODE — STEP 2: show new code ══════════════════════════ -->
        <div v-else-if="activeTab === 'forgot' && forgotStep === 2" class="p-8 flex flex-col gap-5">
          <div class="text-center">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                 style="background:rgba(124,58,237,0.25);border:1px solid rgba(124,58,237,0.4);">
              <i class="fa-solid fa-key text-purple-400 text-2xl"></i>
            </div>
            <h2 class="text-white font-bold text-xl mb-1">{{ T.newPasscodeTitle }}</h2>
            <p class="text-white/40 text-sm">{{ T.newPasscodeDesc }}</p>
          </div>

          <!-- New passcode digits -->
          <div class="flex justify-center gap-3 my-2">
            <div
              v-for="(digit, i) in forgotNewPasscode.split('')"
              :key="i"
              class="w-14 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold text-white"
              style="background:rgba(124,58,237,0.2);border:2px solid rgba(124,58,237,0.5);"
            >{{ digit }}</div>
          </div>

          <button
            type="button"
            class="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition border"
            :style="forgotCopied
              ? 'background:rgba(16,185,129,0.2);color:#34d399;border-color:rgba(16,185,129,0.4);'
              : 'background:rgba(124,58,237,0.15);color:#c4b5fd;border-color:rgba(124,58,237,0.3);'"
            @click="copyForgotPasscode"
          >
            <i :class="forgotCopied ? 'fa-solid fa-check' : 'fa-solid fa-copy'" class="text-xs"></i>
            {{ forgotCopied ? T.copied : T.copyPasscode }}
          </button>

          <button type="button" class="btn-primary w-full flex items-center justify-center gap-2" @click="proceedToSignIn">
            {{ T.continueSignIn }}
            <i class="fa-solid fa-arrow-right text-xs"></i>
          </button>
        </div>

        <!-- ═══ REGISTER STEP 1 — enter name ═════════════════════════════════ -->
        <form
          v-else-if="activeTab === 'register' && regStep === 1"
          class="p-8 flex flex-col gap-4"
          @submit.prevent="submitRegister"
        >
          <div class="text-center mb-2">
            <p class="text-white/60 text-sm leading-relaxed">{{ T.reg1Desc }}</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="field-label">{{ T.username }}</label>
            <input
              v-model="regUsername"
              type="text"
              :placeholder="T.usernamePh"
              required autocomplete="off"
              class="auth-input"
            >
          </div>

          <div v-if="errorMsg" class="err-box">
            <i class="fa-solid fa-circle-exclamation shrink-0"></i>
            <span>{{ errorMsg }}</span>
          </div>

          <button type="submit" class="btn-primary w-full flex items-center justify-center gap-2" :disabled="loading">
            <i v-if="loading" class="fa-solid fa-circle-notch fa-spin text-sm"></i>
            <span>{{ loading ? T.generating : T.generatePasscode }}</span>
          </button>

          <p class="text-center text-white/35 text-xs">
            {{ T.alreadyAccount }}
            <button type="button" class="text-purple-400 hover:text-purple-300 font-medium ml-1" @click="switchTab('login')">
              {{ T.signInLink }}
            </button>
          </p>
        </form>

        <!-- ═══ REGISTER STEP 2 — show passcode ══════════════════════════════ -->
        <div v-else-if="activeTab === 'register' && regStep === 2" class="p-8 flex flex-col gap-5">
          <div class="text-center">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                 style="background:rgba(124,58,237,0.25);border:1px solid rgba(124,58,237,0.4);">
              <i class="fa-solid fa-key text-purple-400 text-2xl"></i>
            </div>
            <h2 class="text-white font-bold text-xl mb-1">{{ T.yourPasscode }}</h2>
            <p class="text-white/40 text-sm">{{ T.shownOnce }}</p>
          </div>

          <!-- ⚠ Critical save warning -->
          <div class="flex items-start gap-3 rounded-xl border px-4 py-3"
               style="background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.3);">
            <i class="fa-solid fa-triangle-exclamation text-red-400 text-sm mt-0.5 shrink-0"></i>
            <p class="text-[12px] text-red-200/75 leading-relaxed font-medium">
              {{ T.saveWarning }}
            </p>
          </div>

          <!-- Passcode digits -->
          <div class="flex justify-center gap-3 my-1">
            <div
              v-for="digit in genPasscode.split('')"
              :key="digit + Math.random()"
              class="w-14 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold text-white"
              style="background:rgba(124,58,237,0.2);border:2px solid rgba(124,58,237,0.5);"
            >{{ digit }}</div>
          </div>

          <button
            type="button"
            class="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition border"
            :style="copied
              ? 'background:rgba(16,185,129,0.2);color:#34d399;border-color:rgba(16,185,129,0.4);'
              : 'background:rgba(124,58,237,0.15);color:#c4b5fd;border-color:rgba(124,58,237,0.3);'"
            @click="copyPasscode"
          >
            <i :class="copied ? 'fa-solid fa-check' : 'fa-solid fa-copy'" class="text-xs"></i>
            {{ copied ? T.copied : T.copyPasscode }}
          </button>

          <button type="button" class="btn-primary w-full flex items-center justify-center gap-2" @click="continueToVerify">
            {{ T.iSavedIt }}
            <i class="fa-solid fa-arrow-right text-xs"></i>
          </button>
        </div>

        <!-- ═══ REGISTER STEP 3 — verify passcode ════════════════════════════ -->
        <form
          v-else-if="activeTab === 'register' && regStep === 3"
          class="p-8 flex flex-col gap-4"
          @submit.prevent="submitVerify"
        >
          <div class="text-center mb-2">
            <p class="text-white/60 text-sm">{{ T.confirmDesc }}</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="field-label">{{ T.confirmPasscode }}</label>
            <input
              v-model="verifyInput"
              type="password"
              placeholder="• • • •"
              required autocomplete="new-password"
              maxlength="4" inputmode="numeric"
              class="auth-input tracking-[0.5em] text-center text-xl"
            >
          </div>

          <div v-if="errorMsg" class="err-box">
            <i class="fa-solid fa-circle-exclamation shrink-0"></i>
            <span>{{ errorMsg }}</span>
          </div>

          <button type="submit" class="btn-primary w-full flex items-center justify-center gap-2" :disabled="loading">
            <i v-if="loading" class="fa-solid fa-circle-notch fa-spin text-sm"></i>
            <span>{{ loading ? T.signingIn : T.confirmSubmit }}</span>
          </button>

          <button type="button" class="text-center text-white/30 text-xs hover:text-white/60 transition" @click="regStep = 2">
            <i class="fa-solid fa-arrow-left mr-1"></i>{{ T.back }}
          </button>
        </form>

      </div>

      <p class="text-center text-white/20 text-xs mt-6">{{ T.poweredBy }}</p>
    </div>
  </div>
</template>

<style scoped>
.auth-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
  padding: 13px 16px;
  color: white;
  font-size: 15px;
  width: 100%;
  transition: border-color 0.15s;
  outline: none;
}
.auth-input::placeholder { color: rgba(255,255,255,0.25); }
.auth-input:focus { border-color: rgba(124,58,237,0.6); }

.field-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
}

.err-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2);
  color: #f87171;
  font-size: 13px;
}
</style>
