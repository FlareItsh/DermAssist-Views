<script setup lang="ts">
  type BadgeVariant = 'solid' | 'subtle' | 'outline'
  type BadgeColor = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray'
  type BadgeSize = 'xs' | 'sm' | 'md'
  type BadgeRounded = 'full' | 'lg' | 'none'

  interface Props {
    variant?: BadgeVariant
    color?: BadgeColor
    size?: BadgeSize
    rounded?: BadgeRounded
    uppercase?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    variant: 'subtle',
    color: 'gray',
    size: 'sm',
    rounded: 'full',
    uppercase: true
  })

  const baseClasses = 'inline-flex items-center font-bold tracking-wide transition-colors duration-200'

  const sizeClasses: Record<BadgeSize, string> = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-3 py-1 text-[11px]',
    md: 'px-4 py-1.5 text-xs'
  }

  const roundedClasses: Record<BadgeRounded, string> = {
    full: 'rounded-full',
    lg: 'rounded-xl',
    none: 'rounded-none'
  }

  const colorVariants: Record<BadgeColor, Record<BadgeVariant, string>> = {
    primary: {
      solid: 'bg-primary text-primary-foreground',
      subtle: 'bg-primary/10 text-primary border border-primary/20',
      outline: 'bg-transparent text-primary border-2 border-primary/30'
    },
    success: {
      solid: 'bg-emerald-600 text-white',
      subtle: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      outline: 'bg-transparent text-emerald-600 border-2 border-emerald-200'
    },
    warning: {
      solid: 'bg-amber-500 text-white',
      subtle: 'bg-amber-100 text-amber-700 border border-amber-200',
      outline: 'bg-transparent text-amber-600 border-2 border-amber-200'
    },
    danger: {
      solid: 'bg-rose-600 text-white',
      subtle: 'bg-rose-100 text-rose-700 border border-rose-200',
      outline: 'bg-transparent text-rose-600 border-2 border-rose-200'
    },
    info: {
      solid: 'bg-blue-600 text-white',
      subtle: 'bg-blue-100 text-blue-700 border border-blue-200',
      outline: 'bg-transparent text-blue-600 border-2 border-blue-200'
    },
    gray: {
      solid: 'bg-gray-600 text-white',
      subtle: 'bg-gray-100 text-gray-700 border border-gray-200',
      outline: 'bg-transparent text-gray-600 border-2 border-gray-200'
    }
  }

  const badgeClasses = computed(() => {
    return [
      baseClasses,
      sizeClasses[props.size],
      roundedClasses[props.rounded],
      colorVariants[props.color][props.variant],
      props.uppercase ? 'uppercase' : ''
    ].join(' ')
  })
</script>

<template>
  <span :class="badgeClasses">
    <!-- Leading Icon -->
    <span
      v-if="$slots.leading"
      class="mr-1.5 inline-flex"
    >
      <slot name="leading" />
    </span>

    <!-- Content -->
    <slot />

    <!-- Trailing Icon -->
    <span
      v-if="$slots.trailing"
      class="ml-1.5 inline-flex"
    >
      <slot name="trailing" />
    </span>
  </span>
</template>
