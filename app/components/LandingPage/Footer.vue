<template>
  <footer class="bg-primary relative z-20 mt-auto w-full pb-8 text-white md:pb-12">
    <div
      class="flex flex-col items-start gap-2 px-5 pt-8 md:flex-row md:items-center md:px-12 md:pt-14"
    >
      <h2 class="font-barlow shrink-0 text-lg font-semibold text-white md:text-3xl">
        DermAssist – AI-Powered Skin Detection &amp; Doctor Consultation
      </h2>
      <div
        class="mt-2 hidden h-[4px] flex-1 rounded-full bg-white/40 md:mt-1 md:ml-4 md:block"
      ></div>
    </div>
    <div class="mt-8 px-5 md:mt-12 md:px-12">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="font-barlow leading-tight">
          <p class="text-xs font-medium text-blue-100 sm:text-sm">Contact DermAssist at:</p>
          <a
            href="mailto:dermassist@gmail.com"
            class="mt-0.5 inline-block text-base font-semibold text-white transition-opacity hover:opacity-85 md:text-2xl"
          >
            dermassist@gmail.com
          </a>
        </div>
        <div>
          <div class="font-barlow hidden space-x-4 text-xl font-medium text-white md:flex">
            <a
              href="#about"
              class="cursor-pointer transition-opacity hover:opacity-80"
              @click="scrollToSection($event, 'about')"
            >
              About
            </a>
            <span class="text-white/40">|</span>
            <a
              href="#features"
              class="cursor-pointer transition-opacity hover:opacity-80"
              @click="scrollToSection($event, 'features')"
            >
              Features
            </a>
            <span class="text-white/40">|</span>
            <a
              href="#contact"
              class="cursor-pointer transition-opacity hover:opacity-80"
              @click="scrollToSection($event, 'contact')"
            >
              Contact Us
            </a>
          </div>
        </div>
      </div>
      <div
        class="mt-6 flex items-center justify-start space-x-2 overflow-hidden md:mt-8 md:-ml-3.5 md:space-x-5"
      >
        <NuxtImg
          src="/images/DA_Icon.png"
          class="h-12 w-auto md:h-25"
          alt="Logo"
        />
        <p
          class="font-barlow text-3xl font-light tracking-[8px] text-white select-none md:text-8xl md:tracking-[75px]"
        >
          DERMASSIST
        </p>
      </div>
      <div
        class="mt-6 flex flex-col gap-2.5 border-t border-white/20 pt-4 text-xs text-blue-100 md:mt-8 md:flex-row md:items-center md:justify-between md:text-sm"
      >
        <p>© 2026 DermAssist. All rights reserved.</p>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="cursor-pointer font-medium text-blue-100 transition-colors hover:text-white hover:underline"
            @click="openTermsModal('privacy')"
          >
            Privacy Policy
          </button>
          <span class="text-white/30">•</span>
          <button
            type="button"
            class="cursor-pointer font-medium text-blue-100 transition-colors hover:text-white hover:underline"
            @click="openTermsModal('terms')"
          >
            Terms of Service
          </button>
          <span class="text-white/30">•</span>
          <button
            type="button"
            class="cursor-pointer font-medium text-blue-100 transition-colors hover:text-white hover:underline"
            @click="openTermsModal('cookies')"
          >
            Cookie Preferences
          </button>
        </div>
      </div>
    </div>

    <!-- Interactive Terms, Privacy & Cookies Modal -->
    <AppModalTermsModal
      v-model="showTermsModal"
      :initial-tab="termsModalTab"
    />
  </footer>
</template>

<script setup lang="ts">
  import { ref } from 'vue'

  const showTermsModal = ref(false)
  const termsModalTab = ref<'terms' | 'privacy' | 'cookies'>('terms')

  const openTermsModal = (tab: 'terms' | 'privacy' | 'cookies' = 'terms') => {
    termsModalTab.value = tab
    showTermsModal.value = true
  }

  const scrollToSection = (e: MouseEvent, sectionId: string) => {
    e.preventDefault()
    const element = document.getElementById(sectionId)
    if (element) {
      const navOffset = 80
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      window.scrollTo({
        top: Math.max(0, elementPosition - navOffset),
        behavior: 'smooth'
      })
    }
  }
</script>
