<template>
  <div class="relative block w-full md:hidden">
    <!-- Stable Spacer in normal flow: keeps document scroll height accurate and syncs with blue content -->
    <div
      class="pointer-events-none w-full"
      :style="{ height: `${spacerHeight}px` }"
    ></div>

    <!-- Fixed Morphing White Header Canvas (Slow, silky shrink on left & right, stops at navbar height) -->
    <div
      class="text-foreground via-card fixed top-0 z-40 flex flex-col overflow-hidden bg-gradient-to-b from-[#f0f6ff] to-[#edf4fc]"
      :style="{
        left: `${heroInset}px`,
        right: `${heroInset}px`,
        height: `${heroHeight}px`,
        borderRadius: `0 0 ${heroRadius}px ${heroRadius}px`,
        boxShadow: heroShadow
      }"
    >
      <!-- Modern Minimalist Designer Backdrop Elements -->
      <div
        class="pointer-events-none absolute inset-0 -z-0 overflow-hidden transition-opacity duration-150"
        :style="{
          opacity: contentOpacity,
          visibility: contentOpacity <= 0 ? 'hidden' : 'visible'
        }"
      >
        <!-- Layer 1: Ambient Mesh Aura Orbs (Barely Visible) -->
        <div
          class="from-secondary/8 via-primary/4 absolute -top-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-bl to-transparent blur-3xl"
        ></div>
        <div
          class="via-primary/4 absolute top-[65%] -left-28 h-88 w-88 -translate-y-1/2 rounded-full bg-gradient-to-tr from-sky-400/8 to-transparent blur-3xl"
        ></div>

        <!-- Layer 2: Precision Dot Matrix Grid (Crisp & Visible) -->
        <div
          class="absolute inset-0 [background-image:radial-gradient(oklch(0.55_0.22_258.275/0.45)_1.5px,transparent_1.5px)] [mask-image:radial-gradient(ellipse_at_50%_45%,black_45%,transparent_85%)] [background-size:24px_24px] opacity-75"
        ></div>

        <!-- Layer 4: Designer Crosshair Markers (+) in Corners -->
        <div class="text-secondary/40 absolute top-20 left-7 font-mono text-xs font-semibold">
          +
        </div>
        <div class="text-secondary/40 absolute top-20 right-7 font-mono text-xs font-semibold">
          +
        </div>
        <div class="text-secondary/40 absolute bottom-32 left-7 font-mono text-xs font-semibold">
          +
        </div>
        <div class="text-secondary/40 absolute right-7 bottom-32 font-mono text-xs font-semibold">
          +
        </div>
      </div>

      <!-- Center Welcoming Content (Gradually translates and fades out over slow scroll) -->
      <main
        class="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pt-[clamp(3.5rem,7vh,5rem)] pb-[clamp(2.5rem,5vh,3.5rem)] text-center"
        :style="{
          opacity: contentOpacity,
          transform: `translateY(-${contentTranslateY}px)`,
          pointerEvents: contentOpacity < 0.1 ? 'none' : 'auto',
          visibility: contentOpacity <= 0 ? 'hidden' : 'visible'
        }"
      >
        <!-- Eyebrow Website Brand Name -->
        <p
          class="text-secondary mb-[clamp(0.5rem,1.5vh,0.75rem)] text-[11px] font-bold tracking-[0.2em] uppercase sm:text-xs"
        >
          DermAssist
        </p>

        <!-- Main Editorial Welcoming Typography -->
        <h1
          class="text-foreground max-w-4xl text-5xl leading-[0.92] font-bold tracking-tight sm:text-5xl sm:leading-[0.95] md:text-6xl lg:text-7xl"
        >
          AI-Powered <br />
          <span
            class="inline-block font-serif text-black italic"
            style="
              font-family: 'Playfair Display', serif !important;
              font-style: italic !important;
              font-weight: 400;
              font-size: 1.05em;
              line-height: 0.6;
            "
          >
            Skin Condition
          </span>
          <br />
          Recognition <br />System
        </h1>

        <!-- Subtitle Copy -->
        <p
          class="text-muted-foreground mt-[clamp(0.625rem,1.8vh,0.875rem)] max-w-md text-[12px] sm:text-base md:mt-4"
        >
          AI-powered skin analysis for smarter, healthier skin.
        </p>

        <!-- 3-Row Infinite Marquee Carousel (Scrolling Right, Zero CPU lag, GPU accelerated) -->
        <div
          class="mask-fade-edges relative mt-[clamp(1.75rem,5vh,3.75rem)] flex w-full max-w-xl flex-col gap-3.5 overflow-hidden py-1.5"
        >
          <!-- Row 1 -->
          <div
            class="marquee-track animate-marquee-right-1 flex shrink-0 items-center gap-3.5"
            :style="{ animationPlayState: contentOpacity < 0.05 ? 'paused' : 'running' }"
          >
            <!-- Original pills set -->
            <div class="flex shrink-0 items-center gap-3.5">
              <!-- Pill 1: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:microscope"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Instant Skin Analysis
                </span>
              </div>
              <!-- Pill 2: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:activity"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Track Skin Changes
                </span>
              </div>
              <!-- Pill 3: LIGHT BLUE 1 -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-sky-300/80 bg-sky-100 shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:zap"
                    class="h-4.5 w-4.5 text-sky-800 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-sky-300/80 bg-sky-100 px-4 py-2 text-xs font-semibold text-sky-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  5-Second Detection
                </span>
              </div>
              <!-- Pill 4: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:sparkles"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Smart Diagnosis
                </span>
              </div>
            </div>
            <!-- Duplicated pills set for infinite seamless loop -->
            <div
              class="flex shrink-0 items-center gap-3.5"
              aria-hidden="true"
            >
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:microscope"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Instant Skin Analysis
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:activity"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Track Skin Changes
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-sky-300/80 bg-sky-100 shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:zap"
                    class="h-4.5 w-4.5 text-sky-800 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-sky-300/80 bg-sky-100 px-4 py-2 text-xs font-semibold text-sky-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  5-Second Detection
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:sparkles"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Smart Diagnosis
                </span>
              </div>
            </div>
          </div>

          <!-- Row 2 -->
          <div
            class="marquee-track animate-marquee-right-2 flex shrink-0 items-center gap-3.5"
            :style="{ animationPlayState: contentOpacity < 0.05 ? 'paused' : 'running' }"
          >
            <!-- Original pills set -->
            <div class="flex shrink-0 items-center gap-3.5">
              <!-- Pill 1: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:stethoscope"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Licensed Dermatologists
                </span>
              </div>
              <!-- Pill 2: LIGHT BLUE 2 -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-sky-300/80 bg-sky-100 shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:dna"
                    class="h-4.5 w-4.5 text-sky-800 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-sky-300/80 bg-sky-100 px-4 py-2 text-xs font-semibold text-sky-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  40+ Conditions
                </span>
              </div>
              <!-- Pill 3: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:shield-check"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Encrypted &amp; Private
                </span>
              </div>
              <!-- Pill 4: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:pill"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Clinical Advice
                </span>
              </div>
            </div>
            <!-- Duplicated pills set for infinite seamless loop -->
            <div
              class="flex shrink-0 items-center gap-3.5"
              aria-hidden="true"
            >
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:stethoscope"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Licensed Dermatologists
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-sky-300/80 bg-sky-100 shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:dna"
                    class="h-4.5 w-4.5 text-sky-800 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-sky-300/80 bg-sky-100 px-4 py-2 text-xs font-semibold text-sky-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  40+ Conditions
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:shield-check"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Encrypted &amp; Private
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:pill"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Clinical Advice
                </span>
              </div>
            </div>
          </div>

          <!-- Row 3 -->
          <div
            class="marquee-track animate-marquee-right-3 flex shrink-0 items-center gap-3.5"
            :style="{ animationPlayState: contentOpacity < 0.05 ? 'paused' : 'running' }"
          >
            <!-- Original pills set -->
            <div class="flex shrink-0 items-center gap-3.5">
              <!-- Pill 1: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:camera"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Mobile Camera Scans
                </span>
              </div>
              <!-- Pill 2: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:badge-check"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Clinical Accuracy
                </span>
              </div>
              <!-- Pill 3: LIGHT BLUE 3 -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-sky-300/80 bg-sky-100 shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:clock"
                    class="h-4.5 w-4.5 text-sky-800 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-sky-300/80 bg-sky-100 px-4 py-2 text-xs font-semibold text-sky-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  24/7 Availability
                </span>
              </div>
              <!-- Pill 4: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:trending-up"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Real-Time Tracking
                </span>
              </div>
            </div>
            <!-- Duplicated pills set for infinite seamless loop -->
            <div
              class="flex shrink-0 items-center gap-3.5"
              aria-hidden="true"
            >
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:camera"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Mobile Camera Scans
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:badge-check"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Clinical Accuracy
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-sky-300/80 bg-sky-100 shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:clock"
                    class="h-4.5 w-4.5 text-sky-800 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-sky-300/80 bg-sky-100 px-4 py-2 text-xs font-semibold text-sky-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  24/7 Availability
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200/90 bg-white shadow-2xs sm:h-10 sm:w-10"
                >
                  <Icon
                    name="lucide:trending-up"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-200/90 bg-white px-4 py-2 text-xs font-semibold text-blue-950 shadow-2xs sm:px-4.5 sm:py-2.5 sm:text-sm"
                >
                  Real-Time Tracking
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Primary & Secondary CTA Actions (Stacked Vertically on Mobile) -->
        <div
          class="mt-[clamp(2rem,7vh,5rem)] flex w-full max-w-[360px] flex-col items-center gap-[clamp(0.625rem,1.5vh,0.75rem)] px-3 sm:max-w-md"
        >
          <!-- Get Started (Top, Solid Primary) -->
          <NuxtLink
            to="/auth/register"
            class="bg-secondary hover:bg-primary flex h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-98 sm:h-13 sm:text-base"
          >
            Get Started
          </NuxtLink>

          <!-- Login (Below, Solid White Background) -->
          <NuxtLink
            to="/auth/login"
            class="border-border/80 flex h-12 w-full items-center justify-center rounded-full border bg-white px-6 text-sm font-semibold text-black shadow-2xs transition-all hover:bg-white/90 active:scale-98 sm:h-13 sm:text-base"
          >
            Login
          </NuxtLink>
        </div>
      </main>

      <!-- Bottom Scroll Arrow Indicator (static, pinned low, clickable to auto-scroll) -->
      <button
        type="button"
        aria-label="Scroll down"
        class="text-muted-foreground absolute right-0 bottom-1 left-0 flex cursor-pointer items-center justify-center py-1 transition-opacity duration-150"
        :style="{
          opacity: footerOpacity,
          pointerEvents: footerOpacity < 0.2 ? 'none' : 'auto',
          visibility: footerOpacity <= 0 ? 'hidden' : 'visible'
        }"
        @click="scrollToDock"
      >
        <Icon
          name="lucide:chevron-down"
          class="h-5 w-5"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'

  useHead({
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

  const windowH = ref(800)
  const spacerHeight = ref(800)
  const heroHeight = ref(800)
  const heroInset = ref(0)
  const heroRadius = ref(0)
  const heroShadow = ref('none')
  const contentOpacity = ref(1)
  const contentTranslateY = ref(0)
  const footerOpacity = ref(1)

  const minNavbarHeight = 56 // Compact navbar pill height with sleek, snug bottom padding
  const slowShrinkDistance = 300 // Slow, comfortable distance for left & right shrink

  let ticking = false
  let isAutoScrolling = false
  let autoScrollTimeout: ReturnType<typeof setTimeout> | null = null
  let lastScrollY = 0
  let touchStartY = 0

  const getTargetY = () => {
    const H = windowH.value || (typeof window !== 'undefined' ? window.innerHeight : 800)
    return Math.max(0, H - minNavbarHeight)
  }

  const scrollToDock = () => {
    if (typeof window === 'undefined') return
    const targetY = getTargetY()
    isAutoScrolling = true
    if (autoScrollTimeout) clearTimeout(autoScrollTimeout)
    window.scrollTo({
      top: targetY,
      behavior: 'smooth'
    })
    autoScrollTimeout = setTimeout(() => {
      isAutoScrolling = false
    }, 850)
  }

  const scrollToTop = () => {
    if (typeof window === 'undefined') return
    isAutoScrolling = true
    if (autoScrollTimeout) clearTimeout(autoScrollTimeout)
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
    autoScrollTimeout = setTimeout(() => {
      isAutoScrolling = false
    }, 850)
  }

  const updateDimensions = () => {
    if (typeof window !== 'undefined') {
      const h = window.innerHeight || 800
      windowH.value = h
      spacerHeight.value = h
    }
  }

  const updateScrollState = () => {
    if (typeof window === 'undefined') return

    if (window.innerWidth >= 768) {
      heroHeight.value = 0
      heroInset.value = 0
      heroRadius.value = 0
      heroShadow.value = 'none'
      contentOpacity.value = 1
      contentTranslateY.value = 0
      footerOpacity.value = 1
      ticking = false
      return
    }

    const y = window.scrollY
    const clampedY = Math.max(0, y)
    const H = windowH.value
    const targetY = getTargetY()

    // 1. Natural 1:1 scroll synchronization: collapses until minNavbarHeight (68px), then locks permanently
    const currentH = Math.min(H, Math.max(minNavbarHeight, H - clampedY))
    heroHeight.value = currentH

    // 2. Slow and graceful shrink animation on left and right (0px -> 14px) over 300px of scroll
    const shrinkProgress = Math.min(clampedY / slowShrinkDistance, 1)
    heroInset.value = shrinkProgress * 14

    // 3. Bottom corners round gracefully to 24px matching navbar roundness
    heroRadius.value = shrinkProgress * 24

    // 4. Soft bottom shadow gently blooms
    if (shrinkProgress > 0.05) {
      const alpha1 = (0.06 + shrinkProgress * 0.16).toFixed(3)
      const alpha2 = (0.03 + shrinkProgress * 0.09).toFixed(3)
      heroShadow.value = `0 10px 25px -5px rgba(0, 0, 0, ${alpha1}), 0 8px 12px -6px rgba(0, 0, 0, ${alpha2})`
    } else {
      heroShadow.value = 'none'
    }

    // 5. Scroll prompt fades out gently over 100px
    footerOpacity.value = Math.max(0, 1 - clampedY / 100)

    // 6. Welcoming typography & tags translate up and fade out smoothly over 240px
    contentOpacity.value = Math.max(0, 1 - clampedY / 240)
    contentTranslateY.value = Math.min(clampedY * 0.25, 60)

    lastScrollY = clampedY
    ticking = false
  }

  const onScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(updateScrollState)
      ticking = true
    }
  }

  const onResize = () => {
    updateDimensions()
    onScroll()
  }

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartY = e.touches[0].clientY
    }
  }

  const onTouchEnd = (e: TouchEvent) => {
    if (window.innerWidth >= 768 || isAutoScrolling) return
    if (e.changedTouches.length === 0) return

    const touchEndY = e.changedTouches[0].clientY
    const deltaY = touchStartY - touchEndY // positive = swiped up (scroll down intent)
    const y = window.scrollY
    const targetY = getTargetY()

    if (deltaY > 25 && y < targetY - 40) {
      scrollToDock()
    } else if (deltaY < -25 && y > 0 && y <= targetY + 30) {
      scrollToTop()
    }
  }

  onMounted(() => {
    updateDimensions()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    updateScrollState()
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchend', onTouchEnd)
    if (autoScrollTimeout) clearTimeout(autoScrollTimeout)
  })
</script>

<style scoped>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800;900&family=Playfair+Display:ital,wght@1,400;1,500;1,600;1,700&display=swap');

  .font-cursive {
    font-family: 'Playfair Display', serif !important;
    font-style: italic !important;
  }

  @keyframes marquee-scroll-right {
    0% {
      transform: translate3d(-50%, 0, 0);
    }
    100% {
      transform: translate3d(0%, 0, 0);
    }
  }

  .animate-marquee-right-1 {
    animation: marquee-scroll-right 24s linear infinite;
    will-change: transform;
  }

  .animate-marquee-right-2 {
    animation: marquee-scroll-right 30s linear infinite;
    will-change: transform;
  }

  .animate-marquee-right-3 {
    animation: marquee-scroll-right 20s linear infinite;
    will-change: transform;
  }

  .mask-fade-edges {
    mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
    -webkit-mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
  }
</style>
