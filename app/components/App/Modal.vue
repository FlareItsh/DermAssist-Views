<script setup lang="ts">
  interface Props {
    modelValue: boolean
    title?: string
    description?: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl'
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    size: 'md'
  })

  const emit = defineEmits(['update:modelValue', 'close'])

  const close = () => {
    emit('update:modelValue', false)
    emit('close')
  }

  const sizeClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl'
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6"
        @click.self="close"
      >
        <!-- Overlay -->
        <div class="fixed inset-0 bg-black/60 transition-opacity"></div>

        <!-- Modal Container -->
        <div
          class="modal-container relative w-full overflow-hidden rounded-[2.5rem] bg-white shadow-2xl transition-all"
          :class="sizeClasses[size]"
        >
          <!-- Close Button -->
          <AppButton
            variant="ghost"
            size="icon"
            class="absolute top-6 right-6 z-10 rounded-full hover:bg-gray-100"
            @click="close"
          >
            <Icon
              name="material-symbols:close-rounded"
              class="text-2xl text-gray-400"
            />
          </AppButton>

          <!-- Content -->
          <div class="p-8 sm:p-10">
            <div
              v-if="title || description"
              class="mb-8"
            >
              <h3
                v-if="title"
                class="text-2xl font-bold text-gray-900"
              >
                {{ title }}
              </h3>
              <p
                v-if="description"
                class="mt-2 text-gray-500"
              >
                {{ description }}
              </p>
            </div>

            <div class="relative">
              <slot />
            </div>

            <div
              v-if="$slots.footer"
              class="mt-10 flex items-center justify-end gap-3"
            >
              <slot name="footer" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .modal-enter-active .modal-container {
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .modal-leave-active .modal-container {
    transition: all 0.2s ease-in;
  }

  .modal-enter-from .modal-container {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }

  .modal-leave-to .modal-container {
    opacity: 0;
    transform: scale(0.95);
  }
</style>
