<script setup lang="ts">
  import { onUnmounted, watch } from 'vue'

  interface Props {
    modelValue: boolean
    title?: string
    description?: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl' | '6xl'
    hideScrollbar?: boolean
    compact?: boolean
    hideCloseButton?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    size: 'md',
    hideScrollbar: false,
    compact: false,
    hideCloseButton: false
  })

  const emit = defineEmits(['update:modelValue', 'close'])

  const close = () => {
    emit('update:modelValue', false)
    emit('close')
  }

  // Prevent background scrolling and egress mobile nav when modal is active
  useModalLock().registerModal(toRef(props, 'modelValue'))

  const sizeClasses: Record<string, string> = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    '4xl': 'sm:max-w-4xl',
    '5xl': 'sm:max-w-5xl',
    '6xl': 'sm:max-w-6xl'
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6"
        @click.self="close"
        @keydown.esc="close"
      >
        <!-- Overlay -->
        <div
          class="fixed inset-0 bg-black/55 transition-opacity"
          @click="close"
        ></div>

        <!-- Modal Container: Native Bottom Sheet on Mobile, Centered Dialog on Desktop -->
        <div
          class="modal-container bg-card border-border/80 relative flex max-h-[92dvh] sm:max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] md:rounded-[2.5rem] border shadow-2xl transition-all"
          :class="sizeClasses[size]"
        >
          <!-- Sticky Header if title, description, or header slot provided -->
          <div
            v-if="title || description || $slots.header"
            class="border-border/60 bg-card sticky top-0 z-20 flex shrink-0 flex-col border-b"
          >
            <!-- Mobile Sheet Drag Handle Pill -->
            <div class="sm:hidden flex w-full items-center justify-center pt-3 pb-1 shrink-0">
              <div class="h-1.5 w-11 rounded-full bg-muted-foreground/30"></div>
            </div>

            <div class="flex items-start justify-between px-5 pt-1.5 pb-4 sm:px-7 sm:py-5">
              <div class="min-w-0 flex-1 pr-3">
                <slot name="header">
                  <h3
                    v-if="title"
                    class="text-foreground text-base font-bold tracking-tight sm:text-xl truncate"
                  >
                    {{ title }}
                  </h3>
                  <p
                    v-if="description"
                    class="text-muted-foreground mt-1 line-clamp-2 text-xs sm:text-sm leading-relaxed"
                  >
                    {{ description }}
                  </p>
                </slot>
              </div>

              <!-- Header Close Button -->
              <button
                v-if="!hideCloseButton"
                type="button"
                class="text-muted-foreground hover:bg-muted hover:text-foreground flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl p-2 transition active:scale-95"
                title="Close modal"
                @click="close"
              >
                <Icon
                  name="heroicons:x-mark"
                  class="h-5 w-5"
                />
              </button>
            </div>
          </div>

          <!-- Mobile Sheet Drag Handle Pill (if no header) -->
          <div
            v-if="!title && !description && !$slots.header"
            class="sm:hidden flex w-full items-center justify-center pt-3 pb-1 shrink-0 bg-card"
          >
            <div class="h-1.5 w-11 rounded-full bg-muted-foreground/30"></div>
          </div>

          <!-- Absolute Floating Close Button if no header -->
          <button
            v-if="!title && !description && !$slots.header && !hideCloseButton"
            type="button"
            class="hover:bg-muted text-muted-foreground hover:text-foreground absolute top-3.5 right-3.5 sm:top-5 sm:right-5 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl p-2 transition active:scale-95"
            title="Close modal"
            @click="close"
          >
            <Icon
              name="heroicons:x-mark"
              class="h-5 w-5"
            />
          </button>

          <!-- Scrollable Body -->
          <div
            class="custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
            :class="[
              hideScrollbar ? 'scrollbar-none' : '',
              compact ? 'p-4 sm:p-6' : 'p-4 sm:p-7 md:p-8'
            ]"
          >
            <slot />
          </div>

          <!-- Sticky Footer: Always thumb-reachable on mobile, respects safe areas -->
          <div
            v-if="$slots.footer"
            class="border-border/60 bg-card sticky bottom-0 z-20 flex shrink-0 items-center justify-end gap-2.5 border-t px-4 py-3 sm:px-7 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <slot name="footer" />
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
    transition: opacity 0.25s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .modal-enter-active .modal-container {
    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-leave-active .modal-container {
    transition: all 0.2s ease-in;
  }

  .modal-enter-from .modal-container {
    opacity: 0;
    transform: translateY(24px);
  }

  @media (min-width: 640px) {
    .modal-enter-from .modal-container {
      transform: scale(0.95) translateY(0);
    }
  }

  .modal-leave-to .modal-container {
    opacity: 0;
    transform: translateY(20px);
  }

  @media (min-width: 640px) {
    .modal-leave-to .modal-container {
      transform: scale(0.97);
    }
  }
</style>
