<script setup lang="ts">
  import { useDeviceIdentifier } from '~/composables/useDeviceIdentifier'

  const { isAccepted, acceptCookies } = useDeviceIdentifier()
  const isDismissed = ref(false)
  const showTermsModal = ref(false)

  const showBanner = computed(() => {
    return !isAccepted.value && !isDismissed.value
  })

  const handleAccept = () => {
    acceptCookies()
    showTermsModal.value = false
  }

  const handleDismiss = () => {
    isDismissed.value = true
  }
</script>

<template>
  <div>
    <Transition
      enter-active-class="transform transition ease-out duration-300"
      enter-from-class="translate-y-6 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transform transition ease-in duration-200"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="translate-y-6 opacity-0 scale-95"
    >
      <div
        v-if="showBanner"
        class="fixed right-5 bottom-5 z-50 flex max-w-sm items-center gap-3 rounded-full border border-zinc-200/80 bg-white/90 px-4 py-2.5 shadow-xl backdrop-blur-md sm:max-w-md dark:border-zinc-800/80 dark:bg-zinc-900/90"
      >
        <div
          class="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>

        <p class="text-xs leading-tight text-zinc-600 dark:text-zinc-300">
          We use essential cookies to keep your account secure.
          <button
            type="button"
            class="text-primary hover:text-primary/80 ml-1 inline-flex cursor-pointer font-medium underline underline-offset-2 transition-colors"
            @click="showTermsModal = true"
          >
            Terms & Cookies
          </button>
        </p>

        <div class="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            class="bg-primary hover:bg-primary/90 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm transition"
            @click="handleAccept"
          >
            Accept
          </button>
          <button
            type="button"
            class="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Dismiss cookie notice"
            @click="handleDismiss"
          >
            <svg
              class="size-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Terms & Cookies Modal Link -->
    <AppModalTermsModal
      v-model="showTermsModal"
      initial-tab="cookies"
      @accept="handleAccept"
    />
  </div>
</template>
