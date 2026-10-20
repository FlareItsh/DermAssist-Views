<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-4"
    >
      <div
        class="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:p-6"
      >
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 class="text-base font-black text-gray-950 sm:text-lg">{{ title }}</h3>
          <button
            @click="$emit('cancel')"
            class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <Icon
              name="lucide:x"
              class="text-lg"
            />
          </button>
        </div>

        <p class="text-xs font-medium text-gray-600 sm:text-sm">{{ message }}</p>

        <div
          class="flex flex-col-reverse items-stretch justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center"
        >
          <button
            type="button"
            @click="$emit('cancel')"
            class="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-center text-xs font-bold text-gray-700 transition hover:bg-gray-50 sm:w-auto sm:py-2"
          >
            {{ cancelText }}
          </button>
          <button
            type="button"
            @click="$emit('confirm')"
            class="w-full rounded-xl px-4 py-2.5 text-center text-xs font-bold text-white shadow-sm transition sm:w-auto sm:py-2"
            :class="
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-primary hover:bg-primary-dark'
            "
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
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
