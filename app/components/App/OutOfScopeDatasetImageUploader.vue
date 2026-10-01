<script setup lang="ts">
  import DatasetImageUploader from '~/components/App/DatasetImageUploader.vue'

  interface Props {
    defaultCategory?: string
    inline?: boolean
  }

  defineProps<Props>()

  defineEmits<{
    (e: 'uploaded', count: number): void
    (e: 'close'): void
  }>()
</script>

<template>
  <DatasetImageUploader
    mode="out_of_scope"
    :default-category="defaultCategory"
    :inline="inline"
    @uploaded="(count: number) => $emit('uploaded', count)"
    @close="() => $emit('close')"
  />
</template>
