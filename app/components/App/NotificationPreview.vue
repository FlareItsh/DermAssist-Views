<script setup lang="ts">
  const props = defineProps<{
    title: string
    description: string
    time: string
    icon: string
    color: string
    to?: string
  }>()

  const componentType = computed(() => props.to ? 'NuxtLink' : 'div')
  
  defineEmits(['delete'])
</script>

<template>
  <component
    :is="componentType"
    :to="to"
    class="hover:bg-secondary/50 border-border/30 group block cursor-pointer border-b p-4 transition-colors last:border-0"
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
          <h4 class="text-foreground truncate text-sm font-bold pr-2">{{ title }}</h4>
          <div class="flex items-center gap-2">
            <span
              class="text-muted-foreground shrink-0 text-[10px] font-semibold tracking-wider uppercase"
              >{{ time }}</span
            >
            <button @click.prevent.stop="$emit('delete')" class="text-foreground/30 hover:text-red-500 transition-colors cursor-pointer rounded-full p-0.5 hover:bg-red-500/10">
              <Icon name="heroicons:x-mark-20-solid" size="14" />
            </button>
          </div>
        </div>
        <p class="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
          {{ description }}
        </p>
      </div>
    </div>
  </component>
</template>
