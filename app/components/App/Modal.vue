<script setup lang="ts">
  import { onUnmounted, watch } from 'vue'

  interface Props {
    modelValue: boolean
    title?: string
    description?: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl' | '6xl'
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

  // Prevent background window/body scrolling when modal is active
  watch(
    () => props.modelValue,
    val => {
      if (import.meta.client) {
        if (val) {
          document.body.style.overflow = 'hidden'
        } else {
          document.body.style.overflow = ''
        }
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    if (import.meta.client) {
      document.body.style.overflow = ''
    }
  })

  const sizeClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl'
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
        <div
          class="fixed inset-0 bg-black/50 transition-opacity"
          @click="close"
        ></div>

        <!-- Modal Container -->
        <div
          class="modal-container relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all sm:rounded-[2rem] md:rounded-[2.5rem]"
          :class="sizeClasses[size]"
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

          <!-- Scrollable Body with Internal Page-Consistent Custom Scrollbar -->
          <div
            class="custom-scrollbar my-3 mr-1.5 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain sm:mr-2.5"
            :class="[
              hideScrollbar ? 'scrollbar-none' : '',
              compact ? 'p-4 sm:p-6 md:p-7' : 'p-4 sm:p-6 md:p-10'
            ]"
          >
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
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
    margin-top: 20px;
    margin-bottom: 20px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 9999px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

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
