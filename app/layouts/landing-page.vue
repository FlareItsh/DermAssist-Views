<template>
  <div
    class="from-primary via-secondary md:bg-background selection:text-secondary relative flex min-h-screen flex-col overflow-x-clip overscroll-y-none bg-gradient-to-b to-white selection:bg-white md:bg-none"
  >
    <!-- Subtle Modern Backdrop Elements for Mobile Blue Background -->
    <div
      class="pointer-events-none absolute inset-0 -z-0 overflow-hidden md:hidden"
      aria-hidden="true"
    >
      <!-- Layer 1: Ambient Luminous Radial Mesh -->
      <div
        class="absolute inset-0 [background:radial-gradient(circle_at_20%_15%,rgba(191,219,254,0.18)_0%,transparent_50%),radial-gradient(circle_at_85%_40%,rgba(56,189,248,0.14)_0%,transparent_50%),radial-gradient(circle_at_50%_70%,rgba(96,165,250,0.12)_0%,transparent_60%)]"
      ></div>

      <!-- Layer 2: Precision Architectural Tech Grid with Random Lightish Blue Tiles -->
      <svg
        class="absolute inset-0 h-full w-full [mask-image:radial-gradient(ellipse_at_50%_35%,black_65%,transparent_95%)]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="mobile-blue-grid"
            width="288"
            height="288"
            patternUnits="userSpaceOnUse"
          >
            <!-- Grid Lines -->
            <path
              d="M 36 0 V 288 M 72 0 V 288 M 108 0 V 288 M 144 0 V 288 M 180 0 V 288 M 216 0 V 288 M 252 0 V 288 M 0 36 H 288 M 0 72 H 288 M 0 108 H 288 M 0 144 H 288 M 0 180 H 288 M 0 216 H 288 M 0 252 H 288"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              stroke-width="1"
            />
            <!-- Outer Boundary Lines -->
            <path
              d="M 0 0 H 288 V 288 H 0 Z"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              stroke-width="1"
            />

            <!-- Random Scattered Illuminated Lightish Blue Tiles (Dispersed, Not in Order) -->
            <rect
              x="36.5"
              y="0.5"
              width="35"
              height="35"
              rx="3"
              fill="rgba(96, 165, 250, 0.28)"
            />
            <rect
              x="180.5"
              y="36.5"
              width="35"
              height="35"
              rx="3"
              fill="rgba(56, 189, 248, 0.26)"
            />
            <rect
              x="0.5"
              y="108.5"
              width="35"
              height="35"
              rx="3"
              fill="rgba(147, 197, 253, 0.24)"
            />
            <rect
              x="216.5"
              y="108.5"
              width="35"
              height="35"
              rx="3"
              fill="rgba(96, 165, 250, 0.30)"
            />
            <rect
              x="108.5"
              y="144.5"
              width="35"
              height="35"
              rx="3"
              fill="rgba(56, 189, 248, 0.28)"
            />
            <rect
              x="252.5"
              y="180.5"
              width="35"
              height="35"
              rx="3"
              fill="rgba(147, 197, 253, 0.22)"
            />
            <rect
              x="72.5"
              y="216.5"
              width="35"
              height="35"
              rx="3"
              fill="rgba(96, 165, 250, 0.26)"
            />
            <rect
              x="144.5"
              y="252.5"
              width="35"
              height="35"
              rx="3"
              fill="rgba(56, 189, 248, 0.30)"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#mobile-blue-grid)"
        />
      </svg>
    </div>

    <!-- Desktop Modern Dot Matrix Grid Background (Matching Hero Cover) -->
    <div
      class="pointer-events-none absolute inset-0 -z-0 hidden overflow-hidden md:block"
      aria-hidden="true"
    >
      <!-- Layer 1: Ambient Mesh Aura for subtle depth -->
      <div
        class="absolute inset-0 [background:radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.06)_0%,transparent_50%),radial-gradient(circle_at_10%_45%,rgba(56,189,248,0.05)_0%,transparent_45%)]"
      ></div>

      <!-- Layer 2: Precision Dot Matrix Grid (Matching HeroCover dots) -->
      <div
        class="absolute inset-0 [background-image:radial-gradient(oklch(0.55_0.22_258.275/0.28)_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-70"
      ></div>
    </div>

    <LandingPageNavbar />
    <div class="relative z-10 flex-1">
      <slot />
    </div>
    <LandingPageFooter />
  </div>
</template>

<script setup lang="ts">
  useHead({
    bodyAttrs: {
      class: 'overscroll-y-none'
    },
    link: [
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com'
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: ''
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800;900&family=Playfair+Display:ital,wght@1,400;1,500;1,600;1,700&display=swap'
      }
    ]
  })
</script>
