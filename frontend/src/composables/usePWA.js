import { ref, computed } from 'vue'

const STORAGE_KEY = 'tazama_pwa_dismissed'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

// ── Module-level singletons – survive component remounts ─────────────────────
let _prompt = null
const _installable = ref(false)
const _installed = ref(false)
const _dismissed = ref(_readDismissed())
let _listening = false

function _readDismissed() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return !!d && Date.now() - d.ts < DISMISS_MS
  } catch {
    return false
  }
}

function _isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

// iOS without Chrome/Firefox-iOS (those don't support beforeinstallprompt)
function _isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent)
  )
}

function _attach() {
  if (_listening) return
  _listening = true

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    _prompt = e
    _installable.value = true
  })

  window.addEventListener('appinstalled', () => {
    _prompt = null
    _installable.value = false
    _installed.value = true
    _dismissed.value = true
  })
}

// ── Public composable ────────────────────────────────────────────────────────
export function usePWA() {
  _attach()

  const isIOS = _isIOS()

  const showBanner = computed(
    () =>
      !_isStandalone() &&
      !_dismissed.value &&
      !_installed.value &&
      (_installable.value || isIOS),
  )

  async function install() {
    if (!_prompt) return
    _prompt.prompt()
    const { outcome } = await _prompt.userChoice
    _prompt = null
    _installable.value = false
    if (outcome === 'accepted') _installed.value = true
  }

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now() }))
    } catch { /* storage unavailable */ }
    _dismissed.value = true
  }

  return { showBanner, isIOS, install, dismiss }
}
