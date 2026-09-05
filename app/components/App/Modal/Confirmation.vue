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
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: true,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmVariant: 'destructive',
    icon: 'lucide:alert-triangle',
    iconColor: 'danger',
    loading: false
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

  const iconColorClasses: Record<string, { bg: string; text: string; ring: string }> = {
    danger: {
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      ring: 'ring-destructive/5'
    },
    warning: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-500/5'
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
        class="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"></div>

        <!-- Modal Container -->
        <div
          class="modal-container bg-card border-border relative w-full max-w-md overflow-hidden rounded-[2rem] border p-8 text-center shadow-2xl transition-all"
        >
          <!-- Close button -->
          <AppButton
            variant="ghost"
            size="icon"
            class="hover:bg-foreground/5 text-muted-foreground hover:text-foreground absolute top-5 right-5 z-10 h-8 w-8 rounded-full"
            :disabled="loading"
            @click="close"
          >
            <Icon
              name="lucide:x"
              class="h-4 w-4"
            />
          </AppButton>

          <!-- Icon Badge -->
          <div
            class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-8 transition-all"
            :class="[
              iconColorClasses[iconColor]?.bg,
              iconColorClasses[iconColor]?.text,
              iconColorClasses[iconColor]?.ring
            ]"
          >
            <Icon
              :name="icon"
              class="h-8 w-8"
            />
          </div>

          <!-- Title & Description -->
          <h3 class="text-foreground text-xl font-bold sm:text-2xl">
            {{ title }}
          </h3>
          <p
            v-if="resolvedDescription"
            class="text-muted-foreground mt-2 text-xs leading-relaxed sm:text-sm"
          >
            {{ resolvedDescription }}
          </p>

          <slot />

          <!-- Action Buttons -->
          <div class="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-center">
            <AppButton
              variant="ghost"
              size="md"
              block
              :disabled="loading"
              @click="close"
            >
              {{ cancelText }}
            </AppButton>
            <AppButton
              :variant="resolvedConfirmVariant"
              size="md"
              block
              :loading="loading"
              :disabled="loading"
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
