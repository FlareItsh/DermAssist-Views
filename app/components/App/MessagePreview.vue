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
  <div
    class="hover:bg-foreground/10 border-border/30 group cursor-pointer border-b p-4 transition-colors last:border-0"
  >
    <div class="flex gap-4">
      <div class="relative">
        <div
          class="bg-card group-hover:ring-primary/30 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-transparent transition-all"
        >
          <Icon
            :name="avatar"
            class="text-foreground/20 text-4xl"
          />
        </div>
        <span
          v-if="status === 'online'"
          class="absolute right-0 bottom-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500"
        ></span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="mb-0.5 flex items-start justify-between">
          <h4 class="text-foreground truncate text-sm font-bold">{{ sender }}</h4>
          <span
            class="text-muted-foreground shrink-0 text-[10px] font-semibold tracking-wider uppercase"
            >{{ time }}</span
          >
        </div>
        <p
          class="text-muted-foreground line-clamp-1 text-xs leading-relaxed transition-all group-hover:not-italic"
        >
          "{{ preview }}"
        </p>
      </div>
    </div>
  </div>
</template>
