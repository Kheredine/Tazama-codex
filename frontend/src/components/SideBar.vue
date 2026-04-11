<script setup>
import { RouterLink } from 'vue-router'
import { useI18n } from '@/composables/useI18n'
import { useAuth } from '@/composables/useAuth'

defineProps({ open: Boolean })
defineEmits(['close'])

const { t, lang, toggleLang } = useI18n()
const { isPremium } = useAuth()
</script>

<template>
  <aside
    class="sideBar w-64 flex flex-col fixed left-0 top-0 h-screen z-50 transition-transform duration-300"
    :class="open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
    style="background: #0d0d18; border-right: 1px solid rgba(255,255,255,0.07);"
  >
    <!-- Brand -->
    <div class="px-6 pt-7 pb-5">
      <div class="flex items-center justify-between gap-3">
        <RouterLink to="/" class="flex items-center gap-3 min-w-0" @click="$emit('close')">
          <img src="/logo_tazama.png" alt="Tazama Logo" class="w-8 h-8">
          <span class="font-logo text-2xl font-bold text-white tracking-tight">Tazama</span>
        </RouterLink>

        <button
          type="button"
          class="md:hidden flex items-center gap-1.5 px-3 h-10 rounded-xl bg-[#7C3AED]/20 text-white/70 hover:text-white text-sm font-semibold transition shrink-0"
          @click="toggleLang"
          :title="lang === 'en' ? 'Passer en franÃ§ais' : 'Switch to English'"
        >
          <i class="fa-solid fa-globe text-xs"></i>
          <span>{{ lang === 'en' ? 'FR' : 'EN' }}</span>
        </button>
      </div>
    </div>

    <!-- Nav -->
    <nav class="flex flex-col flex-1 px-4 gap-0.5 overflow-y-auto">

      <!-- Main links -->
      <RouterLink to="/" exact-active-class="sidebar-active" class="sidebar-link" @click="$emit('close')">
        <i class="fa-solid fa-wand-magic-sparkles text-base w-5 text-center"></i>
        <span>{{ t.navOracle }}</span>
      </RouterLink>

      <RouterLink to="/discover" active-class="sidebar-active" class="sidebar-link" @click="$emit('close')">
        <i class="fa-solid fa-compass text-base w-5 text-center"></i>
        <span>{{ t.navDiscover }}</span>
      </RouterLink>

      <RouterLink to="/library" active-class="sidebar-active" class="sidebar-link" @click="$emit('close')">
        <i class="fa-solid fa-bookmark text-base w-5 text-center"></i>
        <span>{{ t.navLibrary }}</span>
      </RouterLink>

      <RouterLink to="/social" active-class="sidebar-active" class="sidebar-link" @click="$emit('close')">
        <i class="fa-solid fa-users text-base w-5 text-center"></i>
        <span>{{ t.navSocial }}</span>
      </RouterLink>

      <RouterLink to="/notifications" active-class="sidebar-active" class="sidebar-link md:hidden" @click="$emit('close')">
        <i class="fa-solid fa-bell text-base w-5 text-center"></i>
        <span>Notifications</span>
      </RouterLink>

      <!-- Divider -->
      <div class="h-px bg-white/6 my-2 mx-1"></div>

      <!-- Premium section -->
      <div class="px-2 pb-1">
        <span class="text-[10px] font-bold uppercase tracking-widest"
              :class="isPremium ? 'text-amber-400/60' : 'text-white/20'">
          Premium
        </span>
      </div>

      <RouterLink
        to="/oracle-chat"
        active-class="sidebar-active"
        class="sidebar-link"
        :class="!isPremium && 'sidebar-link--locked'"
        @click="$emit('close')"
      >
        <i class="fa-solid fa-comment-dots text-base w-5 text-center"
           :class="isPremium ? 'text-amber-400' : 'text-white/25'"></i>
        <span :class="!isPremium ? 'text-white/35' : ''">Oracle Chat</span>
        <i v-if="!isPremium" class="fa-solid fa-lock text-[10px] text-white/25 ml-auto"></i>
      </RouterLink>

      <RouterLink
        to="/analytics"
        active-class="sidebar-active"
        class="sidebar-link"
        :class="!isPremium && 'sidebar-link--locked'"
        @click="$emit('close')"
      >
        <i class="fa-solid fa-chart-bar text-base w-5 text-center"
           :class="isPremium ? 'text-amber-400' : 'text-white/25'"></i>
        <span :class="!isPremium ? 'text-white/35' : ''">My Analytics</span>
        <i v-if="!isPremium" class="fa-solid fa-lock text-[10px] text-white/25 ml-auto"></i>
      </RouterLink>

      <!-- Bottom links -->
      <div class="mt-auto flex flex-col gap-0.5 pb-5">
        <div class="h-px bg-white/6 mb-2 mx-1"></div>

        <!-- Site settings (gear icon) -->
        <RouterLink to="/site-settings" active-class="sidebar-active" class="sidebar-link" @click="$emit('close')">
          <i class="fa-solid fa-gear text-base w-5 text-center"></i>
          <span>{{ t.navSettings }}</span>
        </RouterLink>

        <RouterLink to="/messages" active-class="sidebar-active" class="sidebar-link" @click="$emit('close')">
          <i class="fa-solid fa-comment-alt text-base w-5 text-center"></i>
          <span>{{ t.navMessages }}</span>
        </RouterLink>

        <RouterLink to="/help" active-class="sidebar-active" class="sidebar-link" @click="$emit('close')">
          <i class="fa-solid fa-circle-question text-base w-5 text-center"></i>
          <span>{{ t.navHelp }}</span>
        </RouterLink>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 14.5px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
  border: none;
  background: none;
}

.sidebar-link:hover {
  background: var(--accent-bg, rgba(124,58,237,0.15));
  color: #ffffff;
}

.sidebar-active {
  background: var(--accent-bg, rgba(124,58,237,0.22)) !important;
  color: #ffffff !important;
  border: 1px solid var(--accent-border, rgba(124,58,237,0.35));
}

.sidebar-link--locked { cursor: default; }
.sidebar-link--locked:hover {
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.35);
}
</style>
