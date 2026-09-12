<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
    <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl space-y-4">
      <div class="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 class="text-lg font-black text-gray-950">{{ title }}</h3>
        <button @click="$emit('cancel')" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <Icon name="lucide:x" class="text-lg" />
        </button>
      </div>

      <p class="text-sm font-medium text-gray-600">{{ message }}</p>

      <div class="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
        <button 
          type="button" 
          @click="$emit('cancel')" 
          class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
        >
          {{ cancelText }}
        </button>
        <button 
          type="button" 
          @click="$emit('confirm')" 
          class="rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition"
          :class="variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary hover:bg-primary-dark'"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
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
