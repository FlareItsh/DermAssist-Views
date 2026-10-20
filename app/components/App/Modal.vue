<script setup lang="ts">
  interface Props {
    modelValue: boolean
    title?: string
    description?: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl'
    hideScrollbar?: boolean
    compact?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    size: 'md',
    hideScrollbar: false,
    compact: false
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
        class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
        @click.self="close"
      >
        <!-- Overlay -->
        <div class="fixed inset-0 bg-black/50 transition-opacity"></div>

        <!-- Modal Container -->
        <div
          class="modal-container relative max-h-[92vh] w-full rounded-2xl bg-white shadow-2xl transition-all sm:rounded-[2rem] md:rounded-[2.5rem]"
          :class="[
            sizeClasses[size],
            hideScrollbar ? 'scrollbar-none overflow-y-auto' : 'overflow-y-auto'
          ]"
        >
          <!-- Close Button -->
          <AppButton
            variant="ghost"
            size="icon"
            class="absolute top-3.5 right-3.5 z-10 rounded-full hover:bg-gray-100 sm:top-6 sm:right-6"
            @click="close"
          >
            <Icon
              name="material-symbols:close-rounded"
              class="text-2xl text-gray-400"
            />
          </AppButton>

          <!-- Content -->
          <div :class="compact ? 'p-4 sm:p-6 md:p-7' : 'p-4 sm:p-6 md:p-10'">
            <div
              v-if="title || description"
              :class="compact ? 'mb-4 pr-8 sm:mb-5 sm:pr-10' : 'mb-5 pr-8 sm:mb-8 sm:pr-12'"
            >
              <h3
                v-if="title"
                :class="
                  compact
                    ? 'text-lg font-bold text-gray-900 sm:text-xl'
                    : 'text-xl font-bold text-gray-900 sm:text-2xl'
                "
              >
                {{ title }}
              </h3>
              <p
                v-if="description"
                class="mt-1 text-xs text-gray-500 sm:text-sm"
              >
                {{ description }}
              </p>
            </div>

            <div class="relative">
              <slot />
            </div>

            <div
              v-if="$slots.footer"
              :class="
                compact
                  ? 'mt-6 flex flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center sm:gap-3'
                  : 'mt-7 flex flex-col-reverse items-stretch justify-end gap-2.5 sm:mt-10 sm:flex-row sm:items-center sm:gap-3'
              "
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
