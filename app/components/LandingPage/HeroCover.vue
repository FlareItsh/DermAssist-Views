<template>
  <div class="relative block w-full md:hidden">
    <!-- Stable Spacer in normal flow: keeps document scroll height accurate and syncs with blue content -->
    <div
      class="hero-spacer pointer-events-none w-full"
      :style="{ height: isCollapsed ? `${minNavbarHeight}px` : `${windowH}px` }"
    ></div>

    <!-- Fixed Morphing White Header Canvas (Collapses smoothly to docked top navbar via GPU transition) -->
    <div
      class="hero-canvas text-foreground via-card fixed top-0 z-40 flex flex-col overflow-hidden bg-gradient-to-b from-[#f0f6ff] to-[#edf4fc]"
      :class="[
        isCollapsed
          ? 'right-3.5 left-3.5 rounded-b-3xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.12),0_8px_12px_-6px_rgba(0,0,0,0.06)]'
          : 'inset-x-0 rounded-none shadow-none'
      ]"
      :style="{
        height: isCollapsed ? `${minNavbarHeight}px` : `${windowH}px`
      }"
    >
      <!-- Modern Minimalist Designer Backdrop Elements -->
      <div
        class="hero-content pointer-events-none absolute inset-0 -z-0 overflow-hidden"
        :class="[isCollapsed ? 'invisible opacity-0' : 'visible opacity-100']"
      >
        <!-- Layer 1: Ambient Mesh Aura (Native GPU Radial Gradient - Zero Blur Filter Overhead) -->
        <div
          class="absolute inset-0 [background:radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.08)_0%,transparent_50%),radial-gradient(circle_at_10%_65%,rgba(56,189,248,0.07)_0%,transparent_45%)]"
        ></div>

        <!-- Layer 2: Precision Dot Matrix Grid (Subtle & Soft) -->
        <div
          class="absolute inset-0 [background-image:radial-gradient(oklch(0.55_0.22_258.275/0.35)_1.2px,transparent_1.2px)] [mask-image:radial-gradient(ellipse_at_50%_45%,black_45%,transparent_90%)] [background-size:24px_24px] opacity-60"
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

      <!-- Center Welcoming Content -->
      <main
        class="hero-content relative z-10 flex flex-1 flex-col items-center justify-center px-5 pt-[clamp(4.25rem,8vh,5.5rem)] pb-[clamp(2rem,4vh,3rem)] text-center"
        :class="[
          isCollapsed
            ? 'pointer-events-none invisible -translate-y-4 opacity-0'
            : 'pointer-events-auto visible translate-y-0 opacity-100'
        ]"
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
            :style="{
              animationPlayState: isCollapsed ? 'paused' : 'running'
            }"
          >
            <!-- Original pills set -->
            <div class="flex shrink-0 items-center gap-3.5">
              <!-- Pill 1: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:microscope"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
                >
                  Instant Skin Analysis
                </span>
              </div>
              <!-- Pill 2: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:activity"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
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
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:sparkles"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
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
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:microscope"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
                >
                  Instant Skin Analysis
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:activity"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
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
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:sparkles"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
                >
                  Smart Diagnosis
                </span>
              </div>
            </div>
          </div>

          <!-- Row 2 -->
          <div
            class="marquee-track animate-marquee-right-2 flex shrink-0 items-center gap-3.5"
            :style="{
              animationPlayState: isCollapsed ? 'paused' : 'running'
            }"
          >
            <!-- Original pills set -->
            <div class="flex shrink-0 items-center gap-3.5">
              <!-- Pill 1: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:stethoscope"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
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
                  Core Conditions
                </span>
              </div>
              <!-- Pill 3: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:shield-check"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
                >
                  Encrypted &amp; Private
                </span>
              </div>
              <!-- Pill 4: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:pill"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
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
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:stethoscope"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
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
                  Core Conditions
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:shield-check"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
                >
                  Encrypted &amp; Private
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:pill"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
                >
                  Clinical Advice
                </span>
              </div>
            </div>
          </div>

          <!-- Row 3 -->
          <div
            class="marquee-track animate-marquee-right-3 flex shrink-0 items-center gap-3.5"
            :style="{
              animationPlayState: isCollapsed ? 'paused' : 'running'
            }"
          >
            <!-- Original pills set -->
            <div class="flex shrink-0 items-center gap-3.5">
              <!-- Pill 1: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:camera"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
                >
                  Mobile Camera Scans
                </span>
              </div>
              <!-- Pill 2: White -->
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:badge-check"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
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
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:trending-up"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
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
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:camera"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
                >
                  Mobile Camera Scans
                </span>
              </div>
              <div class="inline-flex shrink-0 items-center gap-1.5">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:badge-check"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
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
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-400 bg-white shadow-2xs sm:h-11 sm:w-11"
                >
                  <Icon
                    name="lucide:trending-up"
                    class="h-4.5 w-4.5 text-blue-700 sm:h-5 sm:w-5"
                  />
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full border border-dashed border-blue-400 bg-white px-4.5 py-2.5 text-xs font-semibold text-blue-950 shadow-2xs sm:px-5 sm:py-3 sm:text-sm"
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

      <!-- Bottom Scroll Arrow Indicator -->
      <button
        type="button"
        aria-label="Scroll down"
        class="hero-content text-muted-foreground absolute right-0 bottom-1 left-0 flex cursor-pointer items-center justify-center py-1"
        :class="[
          isCollapsed
            ? 'pointer-events-none invisible opacity-0'
            : 'pointer-events-auto visible opacity-100'
        ]"
        @click="collapseHero"
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
  const minNavbarHeight = 56
  const isCollapsed = useState<boolean>('hero_cover_is_collapsed', () => false)
  const isFullyOpened = useState<boolean>('hero_cover_is_fully_opened', () => true)
  const isAnimating = ref(false)
  let animTimer: ReturnType<typeof setTimeout> | null = null
  let hasScrolledDown = false

  let touchStartY = 0

  const collapseHero = () => {
    if (isCollapsed.value || isAnimating.value) return
    isAnimating.value = true
    isFullyOpened.value = false
    isCollapsed.value = true
    hasScrolledDown = false

    if (animTimer) clearTimeout(animTimer)
    animTimer = setTimeout(() => {
      isAnimating.value = false
    }, 380)
  }

  const expandHero = () => {
    if (!isCollapsed.value || isAnimating.value) return
    isAnimating.value = true
    isFullyOpened.value = false

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }

    isCollapsed.value = false
    hasScrolledDown = false

    if (animTimer) clearTimeout(animTimer)
    animTimer = setTimeout(() => {
      isAnimating.value = false
      isFullyOpened.value = true
    }, 400)
  }

  const updateDimensions = () => {
    if (typeof window !== 'undefined') {
      windowH.value = window.innerHeight || 800
    }
  }

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartY = e.touches[0].clientY
    }
  }

  const onTouchEnd = (e: TouchEvent) => {
    if (window.innerWidth >= 768) return
    if (isAnimating.value) return
    if (e.changedTouches.length === 0) return

    const touchEndY = e.changedTouches[0].clientY
    const deltaY = touchStartY - touchEndY // positive = swiped up, negative = swiped down

    if (!isCollapsed.value) {
      // If expanded: ANY slight upward swipe (>15px) immediately collapses it!
      if (deltaY > 15) {
        collapseHero()
      }
    } else {
      // If collapsed and user reaches top (scrollY <= 5 or swiping down near top): auto-expand!
      if (window.scrollY <= 5 || (window.scrollY <= 50 && deltaY < -20)) {
        expandHero()
      }
    }
  }

  const onWheel = (e: WheelEvent) => {
    if (window.innerWidth >= 768) return
    if (isAnimating.value) return

    if (!isCollapsed.value && e.deltaY > 6) {
      collapseHero()
    } else if (isCollapsed.value && window.scrollY <= 10 && e.deltaY < -6) {
      expandHero()
    }
  }

  const onScroll = () => {
    if (window.innerWidth >= 768) return
    if (isAnimating.value) return

    const y = window.scrollY

    if (!isCollapsed.value) {
      if (y > 30) {
        collapseHero()
      }
    } else {
      if (y > 35) {
        hasScrolledDown = true
      } else if (y <= 2 && hasScrolledDown) {
        // User scrolled all the way back to the top end: auto-open without pull-to-refresh!
        expandHero()
      }
    }
  }

  onMounted(() => {
    updateDimensions()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('resize', updateDimensions, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('resize', updateDimensions)
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchend', onTouchEnd)
    if (animTimer) clearTimeout(animTimer)
  })
</script>

<style scoped>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800;900&family=Playfair+Display:ital,wght@1,400;1,500;1,600;1,700&display=swap');

  .font-cursive {
    font-family: 'Playfair Display', serif !important;
    font-style: italic !important;
  }

  .hero-canvas {
    transition:
      height 0.35s cubic-bezier(0.16, 1, 0.3, 1),
      left 0.35s cubic-bezier(0.16, 1, 0.3, 1),
      right 0.35s cubic-bezier(0.16, 1, 0.3, 1),
      border-radius 0.35s cubic-bezier(0.16, 1, 0.3, 1),
      box-shadow 0.35s ease;
    will-change: height, left, right;
    transform: translateZ(0);
  }

  .hero-spacer {
    transition: height 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    will-change: height;
  }

  .hero-content {
    transition:
      opacity 0.25s ease,
      transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
      visibility 0.25s ease;
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
