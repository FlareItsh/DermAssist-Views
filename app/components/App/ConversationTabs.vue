<script setup lang="ts">
  const props = defineProps<{
    tabs: string[]
    activeTab: string
  }>()

  defineEmits(['update:activeTab'])
</script>

<template>
  <div class="flex justify-around gap-2 p-2">
    <button
      v-for="tab in tabs"
      :key="tab"
      @click="$emit('update:activeTab', tab)"
      class="px-4 py-1 text-lg font-semibold transition-all"
      :class="[
        activeTab === tab
          ? 'text-primary border-primary border-b-2'
          : 'text-foreground/40 hover:text-foreground/60'
      ]"
    >
      {{ tab }}
    </button>
  </div>
</template>
