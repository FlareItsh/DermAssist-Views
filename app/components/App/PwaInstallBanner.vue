<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { toast } from 'vue-sonner'
  import { usePwaInstall } from '~/composables/usePwaInstall'
  import { useHaptics } from '~/composables/useHaptics'

  const { canInstall, isInstalled, isDismissed, promptInstall, dismissPrompt } = usePwaInstall()
  const { tap, success } = useHaptics()

  const isInstalling = ref(false)

  const showBanner = computed(() => {
    return canInstall.value && !isInstalled.value && !isDismissed.value
  })

  const handleInstall = async () => {
    tap()
    isInstalling.value = true
    try {
      const res = await promptInstall()
      if (res.success) {
        success()
      } else if (res.method === 'instruction' && res.instruction) {
        toast.info(res.instruction, {
          duration: 7000
        })
      }
    } finally {
      isInstalling.value = false
    }
  }

  const handleDismiss = () => {
    tap()
    dismissPrompt()
  }
</script>

<template>
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
      class="fixed right-4 bottom-6 left-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3.5 rounded-2xl border border-zinc-200/90 bg-white/95 p-3.5 shadow-2xl backdrop-blur-md sm:right-6 sm:bottom-6 sm:left-auto sm:w-[420px] dark:border-zinc-800/90 dark:bg-zinc-900/95"
    >
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="relative size-11 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-xs dark:border-zinc-700 dark:bg-zinc-800"
        >
          <img
            src="/icons/pwa-192x192.png"
            alt="DermAssist App Icon"
            class="h-full w-full object-contain"
          />
        </div>
        <div class="min-w-0">
          <h4 class="truncate text-sm font-semibold text-zinc-900 dark:text-white">
            Install DermAssist App
          </h4>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          :disabled="isInstalling"
          class="inline-flex cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-500 active:scale-95 disabled:opacity-50"
          @click="handleInstall"
        >
          {{ isInstalling ? 'Installing...' : 'Install' }}
        </button>

        <button
          type="button"
          aria-label="Dismiss install prompt"
          class="flex size-7 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          @click="handleDismiss"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>
