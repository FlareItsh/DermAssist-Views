<script setup lang="ts">
const props = defineProps({
  title: String
})

const token = useCookie('auth_token')
const isLoggedIn = computed(() => !!token.value)

</script>

<template>
  <nav class="flex items-center justify-between bg-transparent px-4 py-2">
    <div class="flex items-center gap-10 w-full">
      <NuxtLink v-if="!isLoggedIn" to="/">
        <NuxtImg src="/DA_Logo.png" class="h-20" />
      </NuxtLink>
      <div v-else class="flex items-center">
        <NuxtImg src="/DA_Logo.png" class="h-20 cursor-default" />
      </div>
      <div class="flex justify-between items-center w-full">
        <h2 class="text-3xl font-semibold">{{ title }}</h2>
        <AppUtilityBar />
      </div>

    </div>

    <!-- if you want to add more items in the navbar aside from the title use the slot here-->
    <div class="flex items-center gap-5">
      <slot />
    </div>
  </nav>
</template>
