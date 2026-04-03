<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="bg-primary flex flex-col justify-between rounded-3xl px-8 py-7">
    <h1 class="text-card text-3xl font-bold">{{ title }}</h1>

    <div class="mt-3">
      <slot />
    </div>
  </div>
</template>
