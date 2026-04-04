<script setup lang="ts">
  defineProps<{
    title: string
    description: string
    time: string
    icon: string
    color: string
  }>()
</script>

<template>
  <div
    class="hover:bg-secondary/50 border-border/30 group cursor-pointer border-b p-4 transition-colors last:border-0"
  >
    <div class="flex gap-4">
      <div
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors"
        :class="color + ' bg-opacity-10 group-hover:bg-opacity-20 bg-current'"
      >
        <Icon
          :name="icon"
          class="text-2xl"
        />
      </div>
      <div class="min-w-0 flex-1">
        <div class="mb-0.5 flex items-start justify-between">
          <h4 class="text-foreground truncate text-sm font-bold">{{ title }}</h4>
          <span
            class="text-muted-foreground shrink-0 text-[10px] font-semibold tracking-wider uppercase"
            >{{ time }}</span
          >
        </div>
        <p class="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
          {{ description }}
        </p>
      </div>
    </div>
  </div>
</template>
