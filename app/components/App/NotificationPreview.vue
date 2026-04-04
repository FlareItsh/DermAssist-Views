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
  <div class="p-4 hover:bg-secondary/50 cursor-pointer transition-colors border-b border-border/30 last:border-0 group">
    <div class="flex gap-4">
      <div class="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
        :class="color + ' bg-opacity-10 bg-current group-hover:bg-opacity-20'">
        <Icon :name="icon" class="text-2xl" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-start mb-0.5">
          <h4 class="font-bold text-sm text-foreground truncate">{{ title }}</h4>
          <span class="text-[10px] text-muted-foreground shrink-0 uppercase tracking-wider font-semibold">{{ time }}</span>
        </div>
        <p class="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {{ description }}
        </p>
      </div>
    </div>
  </div>
</template>
