<script setup>
import { ref, computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import SideBar from './components/SideBar.vue'
import TopBar from './components/TopBar.vue'

const sidebarOpen = ref(false)
const route = useRoute()

const isPublicRoute = computed(() => route.meta?.public)
</script>

<template>
  <div class="flex min-h-screen">

    <!-- ── Authenticated layout ──────────────────────────────────────────── -->
    <template v-if="!isPublicRoute">
      <!-- Mobile overlay -->
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-40 bg-black/70 md:hidden"
        @click="sidebarOpen = false"
      />

      <SideBar :open="sidebarOpen" @close="sidebarOpen = false" />

      <div class="flex-1 flex flex-col min-w-0 md:ml-64">
        <TopBar @toggle-sidebar="sidebarOpen = !sidebarOpen" />

        <main class="flex-1 pt-20 px-4 md:px-8 pb-10">
          <div class="max-w-7xl mx-auto w-full">
            <!--
              No <Transition> here — the mode="out-in" + insertBefore(null) crash
              was caused by Vue patching the outgoing/incoming components at the same
              time as reactive updates from TopBar (search focus, sidebar toggle).
              Plain RouterView is crash-free and still fast enough.
            -->
            <RouterView :key="route.path" />
          </div>
        </main>
      </div>
    </template>

    <!-- ── Public layout (auth page etc.) ───────────────────────────────── -->
    <template v-else>
      <div class="flex-1">
        <RouterView :key="route.path" />
      </div>
    </template>

  </div>
</template>
