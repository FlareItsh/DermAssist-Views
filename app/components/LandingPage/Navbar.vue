<template>
  <!-- Backdrop click interceptor to close dropdown on outside tap -->
  <div
    v-if="isMenuOpen && isScrolled"
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
        >About</a
      >
      <a
        href="#features"
        class="hover:text-secondary cursor-pointer transition-colors"
        >Features</a
      >
      <a
        href="#contact"
        class="hover:text-secondary cursor-pointer transition-colors"
        >Contact Us</a
      >
    </div>

    <!-- Brand / Center Logo + Shrunken Mobile 3-Line Menu Icon -->
    <div class="mr-2 flex items-center space-x-1.5 md:mr-3 md:space-x-2">
      <NuxtImg
        src="/images/DA_Icon.png"
        class="mx-auto mb-0.5 h-7 w-auto md:mb-2 md:h-15"
        alt="Logo"
      />
      <h1 class="font-barlow mt-0.5 hidden text-lg font-light md:mt-2 md:block md:text-5xl">
        DermAssist
      </h1>

      <!-- Mobile 3-Line Menu Icon (Hidden when at top, smoothly reveals when shrunk down) -->
      <button
        type="button"
        aria-label="Toggle navigation menu"
        class="text-foreground flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-black/5 active:scale-95 md:hidden"
        :class="[
          isScrolled
            ? 'pointer-events-auto scale-100 opacity-100'
            : 'pointer-events-none scale-75 opacity-0'
        ]"
        @click="toggleMenu"
      >
        <Icon
          :name="isMenuOpen ? 'lucide:x' : 'lucide:menu'"
          class="h-4 w-4 transition-transform duration-200"
        />
      </button>
    </div>

    <!-- Mobile Quick Links (Centered when open; smoothly scales and fades out when shrunk down) -->
    <div
      class="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 text-[11px] font-semibold transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden"
      :class="[
        isScrolled
          ? 'scale-75 opacity-0'
          : 'text-foreground pointer-events-auto scale-100 opacity-100'
      ]"
    >
      <a
        href="#about"
        class="hover:text-secondary px-1 py-0.5 transition-colors active:scale-95"
      >
        About
      </a>
      <a
        href="#features"
        class="hover:text-secondary px-1 py-0.5 transition-colors active:scale-95"
      >
        Features
      </a>
      <a
        href="#contact"
        class="hover:text-secondary px-1 py-0.5 transition-colors active:scale-95"
      >
        Contact
      </a>
    </div>

    <!-- Actions (On mobile: hidden when at top, smoothly reveals when transformed into navbar) -->
    <div
      class="flex items-center space-x-1.5 transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] md:pointer-events-auto md:translate-x-0 md:space-x-6 md:opacity-100"
      :class="[
        isScrolled
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

    <!-- Floating Mobile Dropdown Menu (Opened by the 3-line icon in shrunken mode) -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-2 scale-95"
    >
      <div
        v-if="isMenuOpen && isScrolled"
        class="bg-card/95 border-border/80 absolute top-[calc(100%+8px)] left-0 z-50 flex w-44 flex-col gap-1 rounded-2xl border p-2 text-left shadow-xl backdrop-blur-md md:hidden"
      >
        <a
          href="#about"
          class="hover:bg-accent/15 text-foreground hover:text-secondary flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
          @click="closeMenu"
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
          @click="closeMenu"
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
          @click="closeMenu"
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
  import { ref, onMounted, onUnmounted } from 'vue'

  const isScrolled = ref(false)
  const isMenuOpen = ref(false)

  const toggleMenu = () => {
    isMenuOpen.value = !isMenuOpen.value
  }

  const closeMenu = () => {
    isMenuOpen.value = false
  }

  const handleScroll = () => {
    const scrolled = window.scrollY > 35
    if (!scrolled && isMenuOpen.value) {
      isMenuOpen.value = false
    }
    isScrolled.value = scrolled
  }

  onMounted(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
  })
</script>
