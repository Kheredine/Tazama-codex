<script setup>
import { usePWA } from '@/composables/usePWA'
import { useI18n } from '@/composables/useI18n'

const { showBanner, isIOS, install, dismiss } = usePWA()
const { t } = useI18n()
</script>

<template>
  <Transition name="pwa-banner">
    <div
      v-if="showBanner"
      role="banner"
      aria-label="Install Tazama"
      class="pwa-banner"
    >
      <!-- App identity -->
      <div class="flex items-start gap-3.5">
        <img
          src="/pwa-icons/icon-96x96.png"
          alt="Tazama"
          class="w-14 h-14 rounded-2xl shrink-0 shadow-lg"
        />

        <div class="flex-1 min-w-0">
          <p class="text-white font-semibold text-sm tracking-tight">{{ t.pwaTitle }}</p>

          <!-- Chrome / Edge / Android: native prompt -->
          <template v-if="!isIOS">
            <p class="text-white/50 text-xs mt-1 leading-relaxed">{{ t.pwaDesc }}</p>
            <div class="flex items-center gap-2 mt-3.5">
              <button class="pwa-btn-install" @click="install">
                <i class="fa-solid fa-download text-[11px]"></i>
                {{ t.pwaInstallBtn }}
              </button>
              <button class="pwa-btn-dismiss" @click="dismiss">
                {{ t.pwaDismissBtn }}
              </button>
            </div>
          </template>

          <!-- iOS Safari: manual "Add to Home Screen" steps -->
          <template v-else>
            <p class="text-white/50 text-xs mt-1 leading-relaxed">
              {{ t.pwaIOSDesc }}
              <span class="inline-flex items-center gap-1 text-white/75 font-medium mx-0.5">
                <i class="fa-solid fa-arrow-up-from-bracket text-[10px]"></i>
                {{ t.pwaIOSShare }}
              </span>
              {{ t.pwaIOSStep }}
            </p>
            <button class="pwa-btn-install mt-3.5" @click="dismiss">
              {{ t.pwaIOSGot }}
            </button>
          </template>
        </div>

        <!-- Close / X -->
        <button
          class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition -mt-0.5"
          aria-label="Dismiss"
          @click="dismiss"
        >
          <i class="fa-solid fa-xmark text-sm"></i>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ── Banner shell ─────────────────────────────────────────────────────────── */
.pwa-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 70;
  padding: 16px;
  background: #13111f;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.55);
}

@media (min-width: 640px) {
  .pwa-banner {
    bottom: 24px;
    left: auto;
    right: 24px;
    width: 380px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(124, 58, 237, 0.12);
  }
}

/* ── Buttons ──────────────────────────────────────────────────────────────── */
.pwa-btn-install {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 10px;
  background: #7c3aed;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.pwa-btn-install:hover  { opacity: 0.88; }
.pwa-btn-install:active { transform: scale(0.97); }

.pwa-btn-dismiss {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.pwa-btn-dismiss:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }

/* ── Slide-up / slide-down transition ────────────────────────────────────── */
.pwa-banner-enter-active,
.pwa-banner-leave-active {
  transition: transform 0.35s cubic-bezier(0.34, 1.12, 0.64, 1), opacity 0.3s ease;
}
.pwa-banner-enter-from,
.pwa-banner-leave-to {
  transform: translateY(110%);
  opacity: 0;
}
</style>
