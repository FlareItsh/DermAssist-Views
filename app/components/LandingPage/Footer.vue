<script setup lang="ts">
  import { ref } from 'vue'
  import { toast } from 'vue-sonner'

  const showTermsModal = ref(false)
  const termsTab = ref<'terms' | 'privacy' | 'cookies'>('privacy')

  const openLegalModal = (tab: 'terms' | 'privacy' | 'cookies') => {
    termsTab.value = tab
    showTermsModal.value = true
  }

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const copyEmail = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText('dermassist@gmail.com')
        toast.success('Email copied to clipboard: dermassist@gmail.com')
        return
      }
    } catch {
      // Fallback
    }
    window.location.href = 'mailto:dermassist@gmail.com'
  }
</script>

<template>
  <footer
    class="relative overflow-hidden border-t border-blue-500/20 bg-gradient-to-b from-[#0b1a3a] via-[#07122b] to-[#040a18] text-slate-300"
  >
    <!-- Ambient Blue Radial Glows -->
    <div
      class="pointer-events-none absolute -top-40 left-1/2 h-80 w-full max-w-5xl -translate-x-1/2 rounded-full bg-blue-600/15 blur-[120px]"
    ></div>
    <div
      class="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-blue-500/10 blur-[90px]"
    ></div>

    <div class="relative mx-auto max-w-7xl px-5 pt-12 pb-8 sm:px-8 md:pt-16 lg:px-12">
      <!-- Top Tagline & Back-to-Top Row -->
      <div class="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/15 px-3 py-0.5 text-xs font-semibold text-blue-300 backdrop-blur-sm"
            >
              <span class="size-2 animate-pulse rounded-full bg-emerald-400"></span>
              Clinical AI Triage & Doctor Telehealth
            </span>
          </div>
          <h2
            class="font-barlow text-xl font-bold tracking-tight text-white sm:text-2xl md:text-3xl lg:text-4xl"
          >
            DermAssist — AI-Powered Skin Detection & Doctor Consultation
          </h2>
        </div>

        <button
          type="button"
          class="group inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 backdrop-blur-md transition-all duration-200 hover:border-blue-400/50 hover:bg-blue-500/20 hover:text-white"
          @click="scrollToTop"
        >
          <span>Back to top</span>
          <Icon
            name="lucide:arrow-up"
            class="size-4 transition-transform duration-200 group-hover:-translate-y-0.5"
          />
        </button>
      </div>

      <!-- Subtle Sleek Divider -->
      <div
        class="my-8 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent md:my-10"
      ></div>

      <!-- Main Columns Grid -->
      <div class="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-12">
        <!-- Col 1: Brand Info & Direct Contact Card (Span 5 on LG) -->
        <div class="flex flex-col justify-between sm:col-span-2 lg:col-span-5">
          <div>
            <div class="flex items-center gap-3">
              <NuxtImg
                src="/images/DA_Icon.png"
                class="h-10 w-auto drop-shadow-[0_2px_12px_rgba(30,90,243,0.4)]"
                alt="DermAssist Logo"
              />
              <div>
                <span class="font-barlow text-2xl font-black tracking-wider text-white">
                  DERMASSIST
                </span>
                <p class="text-[11px] font-medium tracking-wide text-blue-300 uppercase">
                  Dermatological Intelligence
                </p>
              </div>
            </div>

            <p class="mt-4 max-w-md text-sm leading-relaxed text-slate-300/90 sm:text-base">
              Empowering proactive healthcare with instant, private AI skin condition analysis and
              seamless virtual consultations with board-certified dermatologists.
            </p>
          </div>

          <!-- Contact Channel Card -->
          <div
            class="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4.5 backdrop-blur-md"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold tracking-wide text-blue-200 uppercase">
                Contact DermAssist Care Team
              </span>
              <span class="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                <span class="size-1.5 rounded-full bg-emerald-400"></span>
                Active Support
              </span>
            </div>

            <div class="mt-2.5 flex flex-wrap items-center justify-between gap-3">
              <a
                href="mailto:dermassist@gmail.com"
                class="group flex items-center gap-2 text-base font-semibold text-white transition hover:text-blue-300 sm:text-lg"
              >
                <div
                  class="flex size-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300 transition group-hover:bg-blue-500 group-hover:text-white"
                >
                  <Icon
                    name="lucide:mail"
                    class="size-4"
                  />
                </div>
                <span class="underline-offset-4 group-hover:underline">dermassist@gmail.com</span>
              </a>

              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
                title="Copy email address"
                @click="copyEmail"
              >
                <Icon
                  name="lucide:copy"
                  class="size-3.5"
                />
                <span>Copy</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Col 2: Navigation (Span 2 on LG) -->
        <div class="lg:col-span-2 lg:col-start-7">
          <h3 class="font-barlow text-sm font-bold tracking-widest text-white uppercase">
            Platform
          </h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li>
              <a
                href="#about"
                class="inline-flex items-center gap-1 text-slate-300 transition-colors hover:text-white"
              >
                About Us
              </a>
            </li>
            <li>
              <a
                href="#features"
                class="inline-flex items-center gap-1 text-slate-300 transition-colors hover:text-white"
              >
                Features
              </a>
            </li>
            <li>
              <a
                href="#features"
                class="inline-flex items-center gap-1 text-slate-300 transition-colors hover:text-white"
              >
                AI Model Accuracy
              </a>
            </li>
            <li>
              <a
                href="#contact"
                class="inline-flex items-center gap-1 text-slate-300 transition-colors hover:text-white"
              >
                Contact & Inquiries
              </a>
            </li>
          </ul>
        </div>

        <!-- Col 3: Portals & Access (Span 2 on LG) -->
        <div class="lg:col-span-2">
          <h3 class="font-barlow text-sm font-bold tracking-widest text-white uppercase">
            Portals
          </h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li>
              <NuxtLink
                to="/auth/login"
                class="inline-flex items-center gap-1 text-slate-300 transition-colors hover:text-white"
              >
                Patient Login
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/auth/login"
                class="inline-flex items-center gap-1 text-slate-300 transition-colors hover:text-white"
              >
                Doctor Portal
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/auth/register"
                class="inline-flex items-center gap-1.5 font-semibold text-blue-300 transition-colors hover:text-blue-200"
              >
                <span>Get Started</span>
                <Icon
                  name="lucide:arrow-right"
                  class="size-3.5"
                />
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Col 4: Trust & Compliance (Span 3 on LG) -->
        <div class="lg:col-span-2">
          <h3 class="font-barlow text-sm font-bold tracking-widest text-white uppercase">
            Trust & Legal
          </h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li>
              <button
                type="button"
                class="cursor-pointer text-left text-slate-300 transition-colors hover:text-white"
                @click="openLegalModal('privacy')"
              >
                Privacy Policy
              </button>
            </li>
            <li>
              <button
                type="button"
                class="cursor-pointer text-left text-slate-300 transition-colors hover:text-white"
                @click="openLegalModal('terms')"
              >
                Terms of Service
              </button>
            </li>
            <li>
              <button
                type="button"
                class="cursor-pointer text-left text-slate-300 transition-colors hover:text-white"
                @click="openLegalModal('cookies')"
              >
                Cookie Preferences
              </button>
            </li>
          </ul>

          <div
            class="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300"
          >
            <Icon
              name="lucide:shield-check"
              class="size-4 shrink-0 text-emerald-400"
            />
            <span class="text-[11px] leading-tight text-slate-300">
              Encrypted & Privacy Protected
            </span>
          </div>
        </div>
      </div>

      <!-- Signature Typographic Brand Banner (Modern, Responsive, Balanced) -->
      <div class="relative mt-12 border-t border-white/10 pt-8 md:mt-16 md:pt-10">
        <div
          class="flex items-center justify-center gap-2.5 px-2 select-none sm:gap-5 md:gap-6"
          aria-hidden="true"
        >
          <NuxtImg
            src="/images/DA_Icon.png"
            class="h-8 w-auto shrink-0 opacity-80 drop-shadow-[0_0_24px_rgba(30,90,243,0.45)] filter sm:h-12 md:h-14 lg:h-18"
            alt=""
          />
          <span
            class="font-barlow mr-[-0.14em] bg-gradient-to-r from-white via-slate-100 to-white/70 bg-clip-text text-3xl font-extrabold tracking-[0.14em] whitespace-nowrap text-transparent sm:mr-[-0.18em] sm:text-5xl sm:tracking-[0.18em] md:mr-[-0.2em] md:text-6xl md:tracking-[0.2em] lg:mr-[-0.22em] lg:text-7xl lg:tracking-[0.22em] xl:mr-[-0.25em] xl:text-8xl xl:tracking-[0.25em]"
          >
            DERMASSIST
          </span>
        </div>
      </div>

      <!-- Bottom Bar: Legal, Medical Notice & Copyright -->
      <div
        class="mt-6 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-slate-400 sm:flex-row md:mt-8"
      >
        <p class="font-barlow tracking-wide text-slate-400">
          © 2026 DermAssist. All rights reserved.
        </p>

        <div class="flex flex-wrap items-center justify-center gap-4 text-xs">
          <button
            type="button"
            class="cursor-pointer transition hover:text-white"
            @click="openLegalModal('privacy')"
          >
            Privacy Policy
          </button>
          <span class="text-white/20">•</span>
          <button
            type="button"
            class="cursor-pointer transition hover:text-white"
            @click="openLegalModal('terms')"
          >
            Terms of Service
          </button>
          <span class="text-white/20">•</span>
          <button
            type="button"
            class="cursor-pointer transition hover:text-white"
            @click="openLegalModal('cookies')"
          >
            Cookies
          </button>
        </div>
      </div>

      <!-- Clinical Safety Note -->
      <div
        class="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-center text-[11px] leading-relaxed text-amber-200/90 sm:text-left"
      >
        <p class="flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:justify-start">
          <span class="inline-flex items-center gap-1 font-semibold text-amber-300">
            <Icon
              name="lucide:alert-circle"
              class="size-3.5 shrink-0"
            />
            Medical Notice:
          </span>
          <span>
            DermAssist is an AI clinical screening aid. In emergencies or severe acute symptoms,
            seek direct hospital care immediately.
          </span>
        </p>
      </div>
    </div>

    <!-- Interactive Terms & Privacy Modal -->
    <AppModalTermsModal
      v-model="showTermsModal"
      :initial-tab="termsTab"
    />
  </footer>
</template>
