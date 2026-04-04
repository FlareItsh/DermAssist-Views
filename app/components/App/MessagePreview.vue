<script setup lang="ts">
defineProps<{
  sender: string
  preview: string
  time: string
  avatar: string
  status?: 'online' | 'offline'
}>()
</script>

<template>
  <div class="p-4 hover:bg-foreground/10 cursor-pointer transition-colors border-b border-border/30 last:border-0 group">
    <div class="flex gap-4">
      <div class="relative">
        <div
          class="h-12 w-12 rounded-full bg-card flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
          <Icon :name="avatar" class="text-4xl text-foreground/20" />
        </div>
        <span v-if="status === 'online'"
          class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-start mb-0.5">
          <h4 class="font-bold text-sm text-foreground truncate">{{ sender }}</h4>
          <span class="text-[10px] text-muted-foreground shrink-0 uppercase tracking-wider font-semibold">{{ time }}</span>
        </div>
        <p class="text-xs text-muted-foreground line-clamp-1 leading-relaxed group-hover:not-italic transition-all">
          "{{ preview }}"
        </p>
      </div>
    </div>
  </div>
</template>
