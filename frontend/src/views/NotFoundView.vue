<script setup>
// No logic needed — static 404 page
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center px-6 text-center"
    style="background: #0a0615; background-image: radial-gradient(900px at 50% 30%, rgba(124,58,237,0.12), transparent);"
  >
    <!-- Glowing number -->
    <div class="relative mb-6 select-none">
      <p
        class="text-[9rem] sm:text-[12rem] font-black leading-none tracking-tighter"
        style="color: rgba(124,58,237,0.25); user-select: none;"
      >404</p>
      <p
        class="absolute inset-0 text-[9rem] sm:text-[12rem] font-black leading-none tracking-tighter text-transparent"
        style="background: linear-gradient(135deg, #7c3aed, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: blur(30px); opacity: 0.5;"
      >404</p>
    </div>

    <div class="mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-white mb-3">Page Not Found</h1>
      <p class="text-white/40 text-base max-w-sm mx-auto leading-relaxed">
        This page doesn't exist or was moved. Head back home to keep watching.
      </p>
    </div>

    <a
      href="https://tazama-codex.vercel.app"
      class="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-white font-semibold text-base transition-all duration-200 hover:scale-105"
      style="background: linear-gradient(135deg, #5b21b6, #7c3aed); box-shadow: 0 8px 28px rgba(124,58,237,0.4);"
    >
      <i class="fa-solid fa-house text-sm"></i>
      Go Home
    </a>

    <p class="mt-10 text-white/15 text-xs">Tazama · Powered by Oracle AI</p>
  </div>
</template>
