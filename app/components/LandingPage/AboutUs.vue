<template>
  <section
    id="about"
    class="relative my-3 scroll-mt-20 py-3 md:my-0 md:py-2"
  >
    <!-- Ambient Atmospheric Glow -->
    <div
      class="from-secondary/15 via-primary/10 pointer-events-none absolute -top-14 left-1/2 -z-10 h-64 w-full max-w-4xl -translate-x-1/2 rounded-full bg-gradient-to-tr to-amber-400/10 blur-3xl"
    ></div>

    <!-- Header Section (Matching Reference Typography & Accent Tag) -->
    <div
      class="mx-auto mb-6 flex max-w-3xl flex-col items-center text-center md:mb-10 md:max-w-none"
    >
      <p class="md:text-secondary text-sm font-medium text-blue-200 md:text-4xl md:font-thin">
        About Us
      </p>

      <h2
        class="md:text-secondary mt-0 text-base font-bold tracking-tight text-white md:text-5xl md:font-semibold"
      >
        Smarter skin care, made easy &amp; accessible
      </h2>
    </div>

    <!-- Folder-Tabbed Cards Grid (Responsive: Mobile Stack, Desktop 3-Col) -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-7 lg:gap-8">
      <div
        v-for="(card, index) in advantageCards"
        :key="card.title"
        class="group relative pt-8 transition duration-300 hover:-translate-y-1 hover:drop-shadow-lg"
      >
        <!-- The Folder Tab -->
        <div
          class="bg-card absolute top-0 left-0 z-10 flex h-8 items-center gap-2.5 rounded-tl-2xl rounded-tr-xl px-4 md:px-5"
        >
          <!-- Tab Icon Badge -->
          <Icon
            :name="card.tabIcon"
            class="text-secondary h-5 w-5 transition-transform duration-300 group-hover:scale-110 md:h-5.5 md:w-5.5"
          />
          <span class="text-foreground/80 w-15 text-xs font-semibold tracking-wide md:w-20"> </span>

          <!-- Smooth Inverted Concave Fillet (Connecting Tab to Card Shoulder) -->
          <div
            class="pointer-events-none absolute bottom-0 left-[calc(100%-1px)] h-4 w-[17px] overflow-hidden"
          >
            <svg
              viewBox="0 0 17 16"
              class="fill-card h-4 w-[17px]"
            >
              <path d="M 1,0 C 1,8.837 8.163,16 17,16 L 0,16 L 0,0 Z" />
            </svg>
          </div>

          <!-- Bottom Mask (Seals Top Border Under Tab) -->
          <div class="bg-card absolute right-0 -bottom-[1px] left-0 h-[2px]"></div>
        </div>

        <!-- Folder Card Body -->
        <div
          class="bg-card relative flex h-full flex-col justify-between rounded-tl-none rounded-tr-3xl rounded-b-3xl px-4 py-5 sm:px-5 sm:py-6 md:min-h-[270px] md:p-8 lg:min-h-[290px] lg:p-9"
        >
          <div>
            <h3 class="text-foreground text-base font-bold sm:text-lg md:text-2xl">
              {{ card.title }}
            </h3>
            <p
              class="text-muted-foreground mt-2 text-xs leading-relaxed sm:text-sm md:mt-3 md:text-base"
            >
              {{ card.description }}
            </p>
          </div>

          <!-- Bottom Metric / Feature Highlight Pill -->
          <div
            class="border-border/50 mt-4 -mb-1 flex items-center justify-between border-t pt-3 md:mt-6 md:pt-4"
          >
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium md:px-3.5 md:py-1.5 md:text-xs"
              :class="card.pillClass"
            >
              <Icon
                :name="card.iconName"
                class="h-3.5 w-3.5 md:h-4 md:w-4"
              />
              {{ card.highlight }}
            </span>

            <span
              class="text-secondary/80 group-hover:text-secondary flex items-center gap-0.5 text-xs font-semibold md:text-sm"
            >
              0{{ index + 1 }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Trust Stats Bar / Summary Strip -->
    <div
      class="md:border-border/60 md:bg-card/60 mt-6 flex flex-wrap items-center justify-around gap-6 rounded-2xl border border-white bg-white/10 p-5 backdrop-blur-md md:mt-8 md:p-6"
    >
      <div class="flex items-center gap-3">
        <div
          class="md:bg-primary/10 md:text-primary flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white"
        >
          <Icon
            name="lucide:sparkles"
            class="h-5 w-5"
          />
        </div>
        <div>
          <p class="md:text-foreground text-lg font-bold text-white md:text-2xl">Core Conditions</p>
          <p class="md:text-muted-foreground text-[11px] text-blue-100">
            Classified with Deep Learning
          </p>
        </div>
      </div>

      <div class="md:bg-border/80 hidden h-8 w-px bg-white/20 md:block"></div>

      <div class="flex items-center gap-3">
        <div
          class="md:bg-secondary/10 md:text-secondary flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white"
        >
          <Icon
            name="lucide:user-check"
            class="h-5 w-5"
          />
        </div>
        <div>
          <p class="md:text-foreground text-lg font-bold text-white md:text-2xl">Real Doctors</p>
          <p class="md:text-muted-foreground text-[11px] text-blue-100">
            Licensed Board Dermatologists
          </p>
        </div>
      </div>

      <div class="md:bg-border/80 hidden h-8 w-px bg-white/20 md:block"></div>

      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white md:bg-amber-500/10 md:text-amber-600 dark:md:text-amber-400"
        >
          <Icon
            name="lucide:shield-check"
            class="h-5 w-5"
          />
        </div>
        <div>
          <p class="md:text-foreground text-lg font-bold text-white md:text-2xl">
            Instant &amp; Private
          </p>
          <p class="md:text-muted-foreground text-[11px] text-blue-100">Encrypted Patient Data</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  interface AdvantageCard {
    title: string
    description: string
    tabIcon: string
    tabLabel: string
    highlight: string
    iconName: string
    pillClass: string
  }

  const advantageCards: AdvantageCard[] = [
    {
      title: 'AI-Powered Detection',
      description:
        'Advanced computer vision models screen skin images in seconds. No fake claims—our algorithms provide objective visual probability scores across core skin conditions.',
      tabIcon: 'lucide:scan-search',
      tabLabel: 'Smart Screening',
      highlight: 'Instant Scan Results',
      iconName: 'lucide:zap',
      pillClass: 'bg-primary/10 text-primary'
    },
    {
      title: 'Verified Medical Doctors',
      description:
        'AI screening is just the beginning. Connect directly with board-certified dermatologists to review findings, get clear diagnoses, and receive medical treatment advice.',
      tabIcon: 'lucide:stethoscope',
      tabLabel: 'Doctor Backed',
      highlight: 'Licensed Dermatologists',
      iconName: 'lucide:stethoscope',
      pillClass: 'bg-secondary/10 text-secondary'
    },
    {
      title: 'Ready in Minutes',
      description:
        'Skip weeks-long waiting rooms and referral queues. Take a photo with your phone or webcam and start your skin wellness journey from anywhere.',
      tabIcon: 'lucide:rocket',
      tabLabel: 'Fast Access',
      highlight: 'Zero Waitlists',
      iconName: 'lucide:clock',
      pillClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
    }
  ]
</script>
