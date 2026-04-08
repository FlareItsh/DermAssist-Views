<script setup lang="ts">
  import { computed } from 'vue'
  import { NuxtLink } from '#components'

  type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'soft' | 'link' | 'destructive' | 'unstyled'
  type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'unstyled'
  type ButtonRounded = 'both' | 'left' | 'right' | 'none' | 'full' | 'unstyled'

  interface Props {
    variant?: ButtonVariant
    size?: ButtonSize
    rounded?: ButtonRounded
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    to?: string | object
    href?: string
    target?: string
    block?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    variant: 'solid',
    size: 'md',
    rounded: 'both',
    type: 'button',
    disabled: false,
    loading: false,
    block: false
  })

  const isLink = computed(() => !!props.to || !!props.href)

  const resolvedComponent = computed(() => {
    if (props.to) return NuxtLink
    if (props.href) return 'a'
    return 'button'
  })

  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap'

  const roundedClasses: Record<ButtonRounded, string> = {
    both: 'rounded-2xl',
    left: 'rounded-l-2xl rounded-r-none',
    right: 'rounded-r-2xl rounded-l-none',
    none: 'rounded-none',
    full: 'rounded-full',
    unstyled: ''
  }

  const variantClasses: Record<ButtonVariant, string> = {
    solid:
      'bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20 focus:ring-primary',
    outline: 'border-2 border-primary text-primary hover:bg-primary/10 focus:ring-primary',
    ghost: 'text-foreground hover:bg-muted hover:text-foreground focus:ring-muted',
    soft: 'bg-primary/10 text-primary hover:bg-primary/20 focus:ring-primary',
    link: 'text-primary hover:underline focus:ring-primary !p-0 !min-h-0 !h-auto',
    destructive:
      'bg-destructive text-white hover:opacity-90 shadow-lg shadow-destructive/20 focus:ring-destructive',
    unstyled: ''
  }

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm h-8',
    md: 'px-5 py-2.5 text-base h-11',
    lg: 'px-6 py-3 text-lg h-14',
    icon: 'p-2 w-11 h-11', // Square for icons
    unstyled: ''
  }

  const buttonClasses = computed(() => {
    return [
      baseClasses,
      roundedClasses[props.rounded],
      variantClasses[props.variant],
      props.variant !== 'link' ? sizeClasses[props.size] : '',
      props.block ? 'w-full flex' : '',
      props.loading ? 'cursor-wait opacity-80' : ''
    ]
      .filter(Boolean)
      .join(' ')
  })
</script>

<template>
  <component
    :is="resolvedComponent"
    :to="to"
    :href="href"
    :target="target"
    :type="!isLink ? type : undefined"
    :disabled="disabled || loading"
    :class="buttonClasses"
  >
    <!-- Loading Spinner -->
    <template v-if="loading">
      <svg
        class="mr-2 -ml-1 h-4 w-4 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        v-if="!$slots.loading"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <slot
        name="loading"
        v-else
      />
    </template>

    <!-- Leading Icon -->
    <span
      v-if="$slots.leading && !loading"
      class="mr-2 inline-flex"
    >
      <slot name="leading" />
    </span>

    <!-- Default Slot / Text -->
    <slot />

    <!-- Trailing Icon -->
    <span
      v-if="$slots.trailing"
      class="ml-2 inline-flex"
    >
      <slot name="trailing" />
    </span>
  </component>
</template>
