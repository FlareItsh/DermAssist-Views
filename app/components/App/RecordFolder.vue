<script setup lang="ts">
  const props = defineProps<{
    time: string
    title: string
    isUrgent?: boolean
  }>()

  defineEmits(['click'])
</script>

<template>
  <!-- feel free na baguhon ni HAHAH-->
  <div
    @click="$emit('click')"
    class="folder-silhouette-shadow group relative flex w-full cursor-pointer flex-col transition-all duration-300 hover:-translate-y-4"
  >
    <div class="relative z-20 flex h-12 shrink-0 translate-y-px items-end sm:h-16">
      <div
        class="bg-primary flex h-full max-w-[75%] flex-col justify-center rounded-t-2xl border-x border-t border-white/20 px-4 shadow-[0_-3px_8px_-1px_rgba(0,0,0,0.08)] sm:w-[520px] sm:max-w-none sm:rounded-t-3xl sm:px-8"
      >
        <div class="flex min-w-0 items-center gap-2.5 sm:gap-4">
          <slot name="image" />
          <div class="flex min-w-0 flex-1 flex-col">
            <span
              class="block truncate text-[10px] tracking-wider uppercase sm:text-xs"
              :class="isUrgent ? 'font-medium text-red-400' : 'font-medium text-white/70'"
            >
              {{ time }}
            </span>
            <h3
              class="mt-0.5 truncate text-xs font-semibold text-white sm:text-base sm:font-bold md:text-lg"
            >
              {{ title }}
            </h3>
          </div>
        </div>
        <slot name="actions" />
      </div>

      <div class="-ml-px h-12 w-12 sm:h-16 sm:w-16">
        <svg
          viewBox="0 0 110 100"
          preserveAspectRatio="none"
          class="fill-primary h-full w-24 sm:w-40"
        >
          <path d="M0,30 Q0,105 35,100 L0,100 Z" />
        </svg>
      </div>
    </div>

    <!-- Folder Body -->
    <div
      class="bg-primary relative z-10 flex min-h-52 flex-1 flex-col overflow-hidden rounded-tr-2xl rounded-b-2xl border-t border-white/10 p-4 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.07)] sm:min-h-64 sm:rounded-tr-3xl sm:rounded-b-3xl sm:p-8"
    >
      <!-- Subtle Paper Inside look -->
      <div
        class="bg-background/50 group-hover:bg-primary/30 pointer-events-none absolute inset-x-3 top-5 bottom-5 rounded-xl transition-colors sm:inset-x-5 sm:top-7 sm:bottom-7 sm:rounded-2xl"
      ></div>

      <!-- Texture/Reflection -->
      <div
        class="pointer-events-none absolute inset-0 bg-linear-to-tr from-white/5 to-transparent"
      ></div>
    </div>
  </div>
</template>

<style scoped>
  .folder-silhouette-shadow {
    filter: drop-shadow(0 -4px 8px rgba(0, 0, 0, 0.08));
  }
</style>
