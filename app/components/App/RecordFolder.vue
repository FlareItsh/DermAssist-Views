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
    class="group flex w-full cursor-pointer flex-col transition-all duration-300 hover:-translate-y-4"
  >
    <div class="flex h-16 shrink-0 translate-y-px items-end">
      <div
        class="bg-primary flex h-full w-[520px] flex-col justify-center rounded-t-3xl border-x border-t border-white/10 px-8"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex flex-col min-w-0">
            <span 
              class="block text-[13px] uppercase truncate"
              :class="isUrgent ? 'text-red-500 font-medium' : 'text-white/50 font-bold'"
            >
              {{ time }}
            </span>
            <h3 class="mt-1 truncate text-lg font-bold text-white">{{ title }}</h3>
          </div>
          <slot name="actions" />
        </div>
      </div>

      <div class="-ml-px h-16 w-16">
        <svg
          viewBox="0 0 110 100"
          preserveAspectRatio="none"
          class="fill-primary h-full w-40"
        >
          <path d="M0,30 Q0,105 35,100 L0,100 Z" />
        </svg>
      </div>
    </div>

    <!-- Folder Body -->
    <div
      class="bg-primary relative z-10 flex min-h-64 flex-1 flex-col overflow-hidden rounded-tr-3xl rounded-b-3xl p-8"
    >
      <!-- Subtle Paper Inside look -->
      <div
        class="bg-background/50 group-hover:bg-primary/30 pointer-events-none absolute inset-x-5 top-7 bottom-7 rounded-2xl transition-colors"
      ></div>

      <!-- Texture/Reflection -->
      <div
        class="pointer-events-none absolute inset-0 bg-linear-to-tr from-white/5 to-transparent"
      ></div>
    </div>
  </div>
</template>
