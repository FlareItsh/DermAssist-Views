<script setup lang="ts">
defineProps<{
  title: string
  icon: string
}>()
</script>

<template>
  <div class="bg-card overflow-hidden rounded-3xl border border-gray-100">
    <div class="bg-primary flex items-center gap-7 px-4 py-3 rounded-b-3xl">
      <div
        class="bg-white/90 flex h-15 w-15 shrink-0 items-center justify-center rounded-full p-1 shadow-[inset_0_0_9px_rgba(0,0,0,0.4),0_0_10px_rgba(0,0,0,0.5)]">
        <NuxtImg class="h-16 w-16 object-contain p-2" :src="icon" :alt="title" />
      </div>
      <h1 class="text-white text-3xl font-bold tracking-tight">{{ title }}</h1>
    </div>

    <div class="px-4 py-3">
      <div class="text-3xl">
        <slot />
      </div>
    </div>

  </div>
</template>
