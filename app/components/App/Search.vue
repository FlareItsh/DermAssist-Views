<script setup lang="ts">
  defineProps<{
    modelValue?: string
    placeholder?: string
    rounded?: string
    size?: string
    bg?: string
    text?: string
    inputBg?: string
    width?: string
  }>()

  defineEmits(['update:modelValue'])
</script>

<template>
  <div class="group relative flex items-center">
    <div
      class="pointer-events-none absolute left-2.5 z-10 flex h-9 items-center justify-center rounded-full transition-all duration-200"
      :class="[bg && bg.startsWith('bg-') ? bg : 'bg-transparent', width || 'w-full']"
    >
      <Icon
        name="lets-icons:search-light"
        :class="[size || 'text-2xl', text]"
      />
    </div>

    <input
      type="text"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      :placeholder="placeholder || 'Search...'"
      class="focus:ring-primary/20 focus:border-primary/30 h-13 w-full border border-transparent p-5 pl-13 transition-all outline-none focus:ring-2"
      :class="[rounded || 'rounded-full', inputBg || 'bg-card']"
    />
  </div>
</template>
