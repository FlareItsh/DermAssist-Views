<script setup lang="ts">
  defineProps<{
    name: string
    lastMessage: string
    avatar?: string
    active?: boolean
  }>()
</script>

<template>
  <div
    class="hover:bg-foreground/10 mx-2 flex cursor-pointer items-center gap-4 rounded-xl p-3 transition-colors"
    :class="active ? 'bg-secondary/10 border-secondary border-l-4' : ''"
  >
    <div class="bg-muted h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
      <img
        v-if="avatar"
        :src="avatar"
        alt="Doctor"
        class="h-full w-full object-cover"
      />
      <div
        v-else
        class="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-lg font-bold uppercase"
      >
        {{ name.charAt(0) }}
      </div>
    </div>

    <div class="flex min-w-0 flex-1 flex-col">
      <h3 class="text-foreground truncate text-lg font-semibold">{{ name }}</h3>
      <p class="text-foreground/50 truncate text-sm leading-tight">{{ lastMessage }}</p>
    </div>
  </div>
</template>
