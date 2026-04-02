<script setup lang="ts">
  const props = defineProps({
    title: String
  })
</script>

<template>
  <nav class="flex items-center justify-between p-4">
    <div class="flex items-center gap-10">
      <NuxtLink to="/">
        <NuxtImg
          src="/DA_Logo.png"
          class="h-20"
        />
      </NuxtLink>

      <h2 class="text-3xl font-semibold">{{ title }}</h2>
    </div>

    <!-- if you want to add more items in the navbar aside from the title use the slot here-->
    <div class="flex items-center gap-5">
      <slot />
    </div>
  </nav>
</template>
