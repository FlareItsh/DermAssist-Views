<template>
  <AppModalConfirmation
    :model-value="show"
    :title="title"
    :description="message"
    :confirm-text="confirmText"
    :cancel-text="cancelText"
    :confirm-variant="variant === 'danger' ? 'destructive' : 'solid'"
    :icon="variant === 'danger' ? 'lucide:alert-triangle' : 'lucide:check-circle'"
    :icon-color="variant === 'danger' ? 'danger' : 'primary'"
    @update:model-value="(val) => !val && $emit('cancel')"
    @confirm="$emit('confirm')"
    @cancel="$emit('cancel')"
  />
</template>

<script setup lang="ts">
  withDefaults(
    defineProps<{
      show: boolean
      title?: string
      message: string
      confirmText?: string
      cancelText?: string
      variant?: 'danger' | 'primary'
    }>(),
    {
      title: 'Confirm Action',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      variant: 'danger'
    }
  )

  defineEmits(['confirm', 'cancel'])
</script>
