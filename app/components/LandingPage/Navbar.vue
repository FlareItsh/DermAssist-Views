<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'

  const isMobileMenuOpen = ref(false)

  const toggleMobileMenu = () => {
    isMobileMenuOpen.value = !isMobileMenuOpen.value
  }

  const closeMobileMenu = () => {
    isMobileMenuOpen.value = false
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeMobileMenu()
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
</script>

<template>
  <div class="relative m-3 md:m-5">
    <nav
      class="bg-card/95 relative z-50 flex items-center justify-between rounded-full px-4 py-2 shadow-lg md:px-7 md:py-2.5"
      aria-label="Main Navigation"
    >
      <!-- Desktop Navigation Links -->
      <div class="hidden items-center space-x-6 text-sm font-semibold md:flex">
        <a
          href="#about"
          class="text-foreground/80 hover:text-primary transition-colors"
          >About</a
        >
        <a
          href="#features"
          class="text-foreground/80 hover:text-primary transition-colors"
          >Features</a
        >
        <a
          href="#contact"
          class="text-foreground/80 hover:text-primary transition-colors"
          >Contact Us</a
        >
      </div>

      <!-- Brand Logo & Title -->
      <a
        href="#"
        class="flex items-center space-x-2.5 transition-opacity hover:opacity-90"
        @click="closeMobileMenu"
      >
        <NuxtImg
          src="/images/DA_Icon.png"
          class="h-8 w-auto md:h-12"
          alt="DermAssist Logo"
        />
        <span class="font-barlow text-foreground text-xl font-medium tracking-tight md:text-3xl">
          DermAssist
        </span>
      </a>

      <!-- Desktop Auth CTA -->
      <div class="hidden items-center space-x-4 md:flex">
        <NuxtLink
          to="/auth/login"
          class="text-foreground/80 hover:text-primary text-sm font-semibold transition-colors"
        >
          Login
        </NuxtLink>
        <NuxtLink
          to="/auth/register"
          class="bg-secondary hover:bg-primary inline-flex items-center rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow"
        >
          Get Started
        </NuxtLink>
      </div>

      <!-- Mobile Controls (Quick CTA + Menu Button) -->
      <div class="flex items-center space-x-2 md:hidden">
        <NuxtLink
          to="/auth/register"
          class="bg-secondary hover:bg-primary rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
          @click="closeMobileMenu"
        >
          Get Started
        </NuxtLink>
        <button
          type="button"
          class="text-foreground/80 hover:text-foreground bg-muted/60 hover:bg-muted inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
          :aria-expanded="isMobileMenuOpen"
          aria-label="Toggle navigation menu"
          @click="toggleMobileMenu"
        >
          <Icon
            :name="isMobileMenuOpen ? 'lucide:x' : 'lucide:menu'"
            class="h-5 w-5"
          />
        </button>
      </div>
    </nav>

    <!-- Mobile Dropdown Menu -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <div
        v-if="isMobileMenuOpen"
        class="bg-card/98 border-border/80 absolute top-full right-0 left-0 z-40 mt-2 overflow-hidden rounded-3xl border p-4 shadow-xl md:hidden"
      >
        <div class="flex flex-col space-y-1">
          <a
            href="#about"
            class="text-foreground/80 hover:text-primary hover:bg-muted/50 flex min-h-[44px] items-center rounded-2xl px-4 text-sm font-semibold transition-colors"
            @click="closeMobileMenu"
          >
            About DermAssist
          </a>
          <a
            href="#features"
            class="text-foreground/80 hover:text-primary hover:bg-muted/50 flex min-h-[44px] items-center rounded-2xl px-4 text-sm font-semibold transition-colors"
            @click="closeMobileMenu"
          >
            Features & Services
          </a>
          <a
            href="#contact"
            class="text-foreground/80 hover:text-primary hover:bg-muted/50 flex min-h-[44px] items-center rounded-2xl px-4 text-sm font-semibold transition-colors"
            @click="closeMobileMenu"
          >
            Contact & Support
          </a>

          <div class="border-border/60 my-2 border-t pt-2">
            <NuxtLink
              to="/auth/login"
              class="group border-primary/20 from-primary/10 via-primary/5 to-card hover:border-primary/40 hover:bg-primary/15 relative flex items-center justify-between overflow-hidden rounded-2xl border bg-gradient-to-r p-3 shadow-xs transition-all active:scale-[0.99]"
              @click="closeMobileMenu"
            >
              <div class="flex items-center gap-3">
                <div
                  class="bg-primary flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
                >
                  <Icon
                    name="lucide:log-in"
                    class="size-4.5"
                  />
                </div>
                <div class="text-left">
                  <p
                    class="text-foreground group-hover:text-primary text-xs font-bold transition-colors"
                  >
                    Sign In to Your Account
                  </p>
                  <p class="text-muted-foreground text-[10px] font-medium">
                    Access clinical scans & consultations
                  </p>
                </div>
              </div>
              <div
                class="bg-primary/10 text-primary group-hover:bg-primary flex size-7 shrink-0 items-center justify-center rounded-full transition-all group-hover:text-white"
              >
                <Icon
                  name="lucide:arrow-right"
                  class="size-3.5 transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </NuxtLink>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
