<!--
  Tazama Logo — "Tazama" means "look / watch" in Swahili
  Design: Stylized Africa continent with a golden oracle eye at its heart,
          set on a deep purple rounded square. Stars echo the night sky
          and the cinema experience.
-->
<script setup>
defineProps({
  size: { type: Number, default: 36 },
  /** Unique ID suffix to avoid SVG gradient ID collisions when used multiple times */
  uid: { type: String, default: 'a' },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    :aria-label="'Tazama logo'"
    role="img"
  >
    <defs>
      <linearGradient :id="`tlbg-${uid}`" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stop-color="#120520"/>
        <stop offset="100%" stop-color="#3b0764"/>
      </linearGradient>
      <linearGradient :id="`tlaf-${uid}`" x1="22" y1="10" x2="42" y2="56" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stop-color="rgba(255,255,255,0.97)"/>
        <stop offset="100%" stop-color="rgba(216,180,254,0.88)"/>
      </linearGradient>
      <radialGradient :id="`tlglow-${uid}`" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stop-color="rgba(139,92,246,0.35)"/>
        <stop offset="100%" stop-color="rgba(139,92,246,0)"/>
      </radialGradient>
    </defs>

    <!-- Background rounded square -->
    <rect width="64" height="64" rx="15" :fill="`url(#tlbg-${uid})`"/>

    <!-- Subtle inner glow ring -->
    <rect width="62" height="62" x="1" y="1" rx="14.5" fill="none"
          stroke="rgba(139,92,246,0.25)" stroke-width="1"/>

    <!-- Inner radial glow -->
    <ellipse cx="32" cy="32" rx="28" ry="28" :fill="`url(#tlglow-${uid})`"/>

    <!--
      Africa silhouette — simplified but recognizable:
      Wide north coast, Horn of Africa jutting right at mid-height,
      narrowing to Cape of Good Hope at the bottom,
      Gulf of Guinea slight indentation on the west coast.
    -->
    <path
      :fill="`url(#tlaf-${uid})`"
      d="
        M 22 11
        C 27  9  35  9  40 12
        L 44 15
        C 47 19  48 24  47 28
        C 50 29  52 32  50 35
        C 49 37  46 37  44 35
        C 44 40  44 46  42 50
        C 40 54  36 57  32 57
        C 28 57  24 54  22 50
        C 20 46  19 40  20 35
        C 17 30  15 24  17 18
        C 19 14  21 12  22 11
        Z
      "
    />

    <!-- ── Oracle Eye — heart of Africa ─────────────────────────────────── -->
    <!-- Eyelid shape (dark oval) -->
    <ellipse cx="32" cy="33" rx="8"   ry="5"   fill="#0d0520"/>
    <!-- Iris (purple) -->
    <ellipse cx="32" cy="33" rx="5.5" ry="3.5" fill="#7c3aed"/>
    <!-- Pupil -->
    <circle  cx="32" cy="33" r="2.2" fill="#120520"/>
    <!-- Inner iris ring -->
    <circle  cx="32" cy="33" r="3.8" fill="none" stroke="rgba(167,139,250,0.5)" stroke-width="0.6"/>
    <!-- Eye highlight -->
    <ellipse cx="30.5" cy="31.8" rx="1" ry="0.65" fill="rgba(255,255,255,0.75)"/>

    <!-- ── Stars / cinema sparkles ────────────────────────────────────────── -->
    <!-- Top-right cluster -->
    <circle cx="51" cy="11" r="1.8" fill="rgba(250,204,21,0.92)"/>
    <circle cx="54" cy="8"  r="1"   fill="rgba(250,204,21,0.65)"/>
    <circle cx="48" cy="8"  r="0.7" fill="rgba(250,204,21,0.55)"/>

    <!-- Bottom-left accent -->
    <circle cx="11" cy="52" r="1.2" fill="rgba(250,204,21,0.55)"/>
    <circle cx="9"  cy="49" r="0.7" fill="rgba(250,204,21,0.40)"/>

    <!-- Tiny dot top-left -->
    <circle cx="13" cy="12" r="0.8" fill="rgba(255,255,255,0.25)"/>
  </svg>
</template>
