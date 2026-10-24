<template>
  <!-- Backdrop click interceptor to close dropdown on outside tap -->
  <div
    v-if="isMenuOpen && isCollapsed"
    class="fixed inset-0 z-40 md:hidden"
    @click="closeMenu"
  ></div>

  <nav
    class="md:bg-card fixed top-2.5 right-4 left-4 z-50 flex items-center justify-between rounded-full border-transparent bg-transparent px-3 py-1 text-center shadow-none md:relative md:top-auto md:right-auto md:left-auto md:m-5 md:px-7 md:py-1 md:shadow-none"
  >
    <!-- Desktop links (hidden md:flex) -->
    <div class="hidden space-x-6 text-[14px] font-semibold md:flex">
      <a
        href="#about"
        class="hover:text-secondary cursor-pointer transition-colors"
        @click="scrollToSection($event, 'about')"
        >About</a
      >
      <a
        href="#features"
        class="hover:text-secondary cursor-pointer transition-colors"
        @click="scrollToSection($event, 'features')"
        >Features</a
      >
      <a
        href="#contact"
        class="hover:text-secondary cursor-pointer transition-colors"
        @click="scrollToSection($event, 'contact')"
        >Contact Us</a
      >
    </div>

    <!-- Brand / Center Logo + Shrunken Mobile 3-Line Menu Icon -->
    <div
      class="mr-2 flex items-center space-x-1.5 md:mr-3 md:space-x-2"
      :class="[isCollapsed ? 'cursor-pointer transition-transform active:scale-95' : '']"
      @click="handleLogoClick"
    >
      <NuxtImg
        src="/images/DA_Icon.png"
        class="mx-auto mb-0.5 h-7 w-auto md:mb-2 md:h-15"
        alt="Logo"
      />
      <h1 class="font-barlow mt-0.5 hidden text-lg font-light md:mt-2 md:block md:text-5xl">
        DermAssist
      </h1>

      <!-- Mobile 3-Line Menu Icon (Visible strictly when hero cover is collapsed) -->
      <button
        type="button"
        aria-label="Toggle navigation menu"
        class="text-foreground flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-black/5 active:scale-95 md:hidden"
        :class="[
          isCollapsed
            ? 'pointer-events-auto scale-100 opacity-100'
            : 'pointer-events-none scale-75 opacity-0'
        ]"
        @click.stop="toggleMenu"
      >
        <Icon
          :name="isMenuOpen ? 'lucide:x' : 'lucide:menu'"
          class="h-4 w-4 transition-transform duration-200"
        />
      </button>
    </div>

    <!-- Mobile Quick Links (Middle: ONLY visible when hero cover is fully opened and NOT collapsed) -->
    <div
      class="absolute top-1/2 left-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 text-[11px] font-semibold transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden"
      :class="[
        isFullyOpened && !isCollapsed
          ? 'text-foreground pointer-events-auto scale-100 opacity-100'
          : 'pointer-events-none scale-75 opacity-0'
      ]"
    >
      <a
        href="#about"
        class="hover:text-secondary cursor-pointer px-2 py-1 transition-colors active:scale-95"
        @click="scrollToSection($event, 'about')"
      >
        About
      </a>
      <a
        href="#features"
        class="hover:text-secondary cursor-pointer px-2 py-1 transition-colors active:scale-95"
        @click="scrollToSection($event, 'features')"
      >
        Features
      </a>
      <a
        href="#contact"
        class="hover:text-secondary cursor-pointer px-2 py-1 transition-colors active:scale-95"
        @click="scrollToSection($event, 'contact')"
      >
        Contact
      </a>
    </div>

    <!-- Actions (On mobile: visible strictly when hero cover is collapsed) -->
    <div
      class="flex items-center space-x-1.5 transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] md:pointer-events-auto md:translate-x-0 md:space-x-6 md:opacity-100"
      :class="[
        isCollapsed
          ? 'pointer-events-auto translate-x-0 opacity-100'
          : 'pointer-events-none translate-x-2 opacity-0'
      ]"
    >
      <NuxtLink
        to="/auth/login"
        class="cursor-pointer px-1.5 py-1 text-[10.5px] font-semibold text-black transition-colors hover:text-black/75 md:text-lg"
      >
        Login
      </NuxtLink>
      <NuxtLink
        to="/auth/register"
        class="bg-secondary hover:bg-primary cursor-pointer rounded-full px-4 py-1.5 text-[11px] font-semibold text-white shadow-xs transition-all hover:shadow-md md:px-9 md:py-3 md:text-lg"
      >
        Get Started
      </NuxtLink>
    </div>

    <!-- Floating Mobile Dropdown Menu (Opened by the 3-line icon in collapsed mode) -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-2 scale-95"
    >
      <div
        v-if="isMenuOpen && isCollapsed"
        class="bg-card/95 border-border/80 absolute top-[calc(100%+8px)] left-0 z-50 flex w-44 flex-col gap-1 rounded-2xl border p-2 text-left shadow-xl backdrop-blur-md md:hidden"
      >
        <a
          href="#about"
          class="hover:bg-accent/15 text-foreground hover:text-secondary flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
          @click="scrollToSection($event, 'about')"
        >
          <Icon
            name="lucide:info"
            class="text-muted-foreground h-3.5 w-3.5"
          />
          About
        </a>
        <a
          href="#features"
          class="hover:bg-accent/15 text-foreground hover:text-secondary flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
          @click="scrollToSection($event, 'features')"
        >
          <Icon
            name="lucide:sparkles"
            class="text-muted-foreground h-3.5 w-3.5"
          />
          Features
        </a>
        <a
          href="#contact"
          class="hover:bg-accent/15 text-foreground hover:text-secondary flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
          @click="scrollToSection($event, 'contact')"
        >
          <Icon
            name="lucide:mail"
            class="text-muted-foreground h-3.5 w-3.5"
          />
          Contact Us
        </a>
      </div>
    </Transition>
  </nav>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'

  const isCollapsed = useState<boolean>('hero_cover_is_collapsed', () => false)
  const isFullyOpened = useState<boolean>('hero_cover_is_fully_opened', () => true)
  const isMenuOpen = ref(false)

  const toggleMenu = () => {
    isMenuOpen.value = !isMenuOpen.value
  }

  const closeMenu = () => {
    isMenuOpen.value = false
  }

  watch(isCollapsed, collapsed => {
    if (!collapsed) {
      closeMenu()
    }
  })

  const handleLogoClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && isCollapsed.value) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      isCollapsed.value = false
      setTimeout(() => {
        isFullyOpened.value = true
      }, 400)
    }
  }

  const scrollToSection = (e: MouseEvent, sectionId: string) => {
    e.preventDefault()
    closeMenu()

    const element = document.getElementById(sectionId)
    if (!element) return

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    const navOffset = isMobile ? 70 : 80

    if (isMobile && !isCollapsed.value) {
      // When hero cover is open on mobile, hero-spacer height is window.innerHeight.
      // Once collapsed, it shrinks to 56px (minNavbarHeight).
      // We subtract this shrinkage so the scroll target accurately lands at the top of the section.
      const rawPosition = element.getBoundingClientRect().top + window.scrollY
      const shrinkAmount = window.innerHeight - 56
      const finalTarget = Math.max(0, rawPosition - shrinkAmount - navOffset)

      isCollapsed.value = true
      isFullyOpened.value = false

      setTimeout(() => {
        window.scrollTo({
          top: finalTarget,
          behavior: 'smooth'
        })
      }, 50)
    } else {
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      window.scrollTo({
        top: Math.max(0, elementPosition - navOffset),
        behavior: 'smooth'
      })
    }
  }
</script>
