<script setup lang="ts">
  defineProps<{
    title: string
  }>()
</script>

<template>
  <div class="bg-primary flex flex-col justify-between rounded-3xl px-6 py-6 sm:px-8 sm:py-7">
    <h1 class="text-card text-2xl font-bold sm:text-3xl">{{ title }}</h1>

    <div class="mt-3 w-full min-w-0">
      <slot />
    </div>
  </div>
</template>
