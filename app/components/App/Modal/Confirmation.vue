<script setup lang="ts">
  interface Props {
    modelValue?: boolean
    title: string
    description?: string
    message?: string
    confirmText?: string
    cancelText?: string
    confirmVariant?: 'destructive' | 'solid' | 'outline' | 'danger'
    icon?: string
    iconColor?: 'danger' | 'warning' | 'primary' | 'info'
    loading?: boolean
    confirmDisabled?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: true,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmVariant: 'destructive',
    icon: 'lucide:alert-triangle',
    iconColor: 'danger',
    loading: false,
    confirmDisabled: false
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'confirm'): void
    (e: 'cancel'): void
  }>()

  const resolvedDescription = computed(() => props.description || props.message || '')
  const resolvedConfirmVariant = computed(() =>
    props.confirmVariant === 'danger' ? 'destructive' : props.confirmVariant
  )

  const close = () => {
    if (props.loading) return
    emit('update:modelValue', false)
    emit('cancel')
  }

  const confirm = () => {
    emit('confirm')
  }

  useModalLock().registerModal(toRef(props, 'modelValue'))

  const iconColorClasses: Record<string, { bg: string; text: string; ring: string }> = {
    danger: {
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      ring: 'ring-destructive/5'
    },
    warning: {
      bg: 'border border-warning-border bg-warning-subtle',
      text: 'text-warning-text',
      ring: 'ring-warning/10'
    },
    primary: {
      bg: 'bg-primary/10',
      text: 'text-primary',
      ring: 'ring-primary/5'
    },
    info: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-600 dark:text-blue-400',
      ring: 'ring-blue-500/5'
    }
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-6"
        @click.self="close"
        @keydown.esc="close"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/55 transition-opacity"
          @click="close"
        ></div>

        <!-- Modal Container: Reflows to native bottom sheet on mobile -->
        <div
          class="modal-container bg-card border-border relative w-full max-w-md overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border p-6 sm:p-8 text-center shadow-2xl transition-all pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <!-- Native Mobile Grab Handle Pill -->
          <div
            class="sm:hidden flex w-full items-center justify-center pt-1 pb-3 -mt-2 shrink-0"
            aria-hidden="true"
          >
            <div class="h-1.5 w-11 rounded-full bg-muted-foreground/30"></div>
          </div>
          <!-- Close button -->
          <AppButton
            variant="ghost"
            size="icon"
            class="hover:bg-foreground/5 text-muted-foreground hover:text-foreground absolute top-4 right-4 sm:top-5 sm:right-5 z-10 h-10 w-10 rounded-full"
            :disabled="loading"
            @click="close"
          >
            <Icon
              name="lucide:x"
              class="h-5 w-5"
            />
          </AppButton>

          <!-- Icon Badge -->
          <div
            class="mx-auto mb-4 sm:mb-5 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl ring-8 transition-all"
            :class="[
              iconColorClasses[iconColor]?.bg,
              iconColorClasses[iconColor]?.text,
              iconColorClasses[iconColor]?.ring
            ]"
          >
            <Icon
              :name="icon"
              class="h-7 w-7 sm:h-8 sm:w-8"
            />
          </div>

          <!-- Title & Description -->
          <h3 class="text-foreground text-lg font-bold sm:text-2xl">
            {{ title }}
          </h3>
          <p
            v-if="resolvedDescription"
            class="text-muted-foreground mt-2 text-xs leading-relaxed sm:text-sm"
          >
            {{ resolvedDescription }}
          </p>

          <slot />

          <!-- Action Buttons: >=44px thumb targets -->
          <div class="mt-6 sm:mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-center">
            <AppButton
              variant="ghost"
              size="md"
              block
              class="min-h-[44px] text-xs font-semibold"
              :disabled="loading"
              @click="close"
            >
              {{ cancelText }}
            </AppButton>
            <AppButton
              :variant="resolvedConfirmVariant"
              size="md"
              block
              class="min-h-[44px] text-xs font-bold"
              :loading="loading"
              :disabled="loading || confirmDisabled"
              @click="confirm"
            >
              {{ confirmText }}
            </AppButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
