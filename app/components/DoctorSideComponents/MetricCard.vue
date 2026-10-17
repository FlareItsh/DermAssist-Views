<script setup lang="ts">
  interface TrendConfig {
    value: string | number
    direction?: 'up' | 'down' | 'neutral'
    label?: string
  }

  type BadgeTone = 'neutral' | 'primary' | 'amber' | 'rose' | 'emerald' | 'blue' | 'indigo'
  type ValueTone = 'default' | 'amber' | 'rose' | 'emerald' | 'primary'
  type ActiveTone = 'primary' | 'amber' | 'emerald' | 'rose' | 'blue'

  const props = withDefaults(
    defineProps<{
      label: string
      value: number | string
      unit?: string
      detail?: string
      to?: string
      loading?: boolean
      badge?: string
      badgeTone?: BadgeTone
      valueTone?: ValueTone
      trend?: TrendConfig
      active?: boolean
      activeTone?: ActiveTone
      clickable?: boolean
    }>(),
    {
      unit: '',
      detail: '',
      to: '',
      loading: false,
      badge: '',
      badgeTone: 'neutral',
      valueTone: 'default',
      trend: undefined,
      active: false,
      activeTone: 'primary',
      clickable: false
    }
  )

  const emit = defineEmits<{
    (e: 'click', event: MouseEvent): void
  }>()

  const attrs = useAttrs()

  const isInteractive = computed(() => {
    return Boolean(props.to || props.clickable || props.active !== undefined || attrs.onClick)
  })

  const cardComponent = computed(() => {
    if (props.to) return resolveComponent('NuxtLink')
    if (isInteractive.value) return 'button'
    return 'div'
  })

  const formattedValue = computed(() => {
    if (typeof props.value === 'number') {
      return new Intl.NumberFormat('en').format(props.value)
    }
    return props.value
  })

  const valueSizeClass = computed(() => {
    const str = String(props.value ?? '')
    if (str.length > 15) return 'text-lg sm:text-xl md:text-2xl'
    if (str.length > 9) return 'text-xl sm:text-2xl md:text-3xl'
    if (str.length > 5) return 'text-3xl sm:text-4xl'
    return 'text-4xl sm:text-5xl'
  })

  const valueToneClass = computed(() => {
    switch (props.valueTone) {
      case 'amber':
        return 'text-amber-600'
      case 'rose':
        return 'text-rose-600'
      case 'emerald':
        return 'text-emerald-600'
      case 'primary':
        return 'text-primary'
      case 'default':
      default:
        return 'text-gray-900'
    }
  })

  const activeIndicatorClass = computed(() => {
    switch (props.activeTone) {
      case 'amber':
        return 'bg-amber-500'
      case 'emerald':
        return 'bg-emerald-600'
      case 'rose':
        return 'bg-rose-600'
      case 'blue':
      case 'primary':
      default:
        return 'bg-primary'
    }
  })

  const activeContainerClass = computed(() => {
    if (!props.active) {
      return 'border-gray-200/80 bg-white shadow-2xs hover:border-gray-300 hover:shadow-xs hover:-translate-y-0.5'
    }

    switch (props.activeTone) {
      case 'amber':
        return 'border-amber-500/90 bg-white ring-1 ring-amber-500/30 shadow-xs'
      case 'emerald':
        return 'border-emerald-600/90 bg-white ring-1 ring-emerald-600/30 shadow-xs'
      case 'rose':
        return 'border-rose-600/90 bg-white ring-1 ring-rose-600/30 shadow-xs'
      case 'blue':
      case 'primary':
      default:
        return 'border-primary/90 bg-white ring-1 ring-primary/30 shadow-xs'
    }
  })

  const badgeColorClass = computed(() => {
    if (props.active && props.badgeTone === 'neutral') {
      return 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/25'
    }

    switch (props.badgeTone) {
      case 'primary':
      case 'blue':
      case 'indigo':
        return 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/25'
      case 'amber':
        return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20'
      case 'rose':
        return 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20'
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
      case 'neutral':
      default:
        return 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/10'
    }
  })

  const trendColorClass = computed(() => {
    if (!props.trend) return ''
    if (props.trend.direction === 'up') {
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
    }
    if (props.trend.direction === 'down') {
      return 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20'
    }
    return 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/10'
  })

  const handleClick = (e: MouseEvent) => {
    emit('click', e)
  }
</script>

<template>
  <component
    :is="cardComponent"
    :to="to || undefined"
    :type="cardComponent === 'button' ? 'button' : undefined"
    class="group relative flex h-full flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 sm:p-5"
    :class="[
      activeContainerClass,
      isInteractive
        ? 'focus-visible:ring-primary cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
        : ''
    ]"
    @click="handleClick"
  >
    <!-- Header Row: Label with optional active dot (left) & Pill Badge (right) -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-1.5">
        <span
          v-if="active"
          class="h-1.5 w-1.5 shrink-0 rounded-full transition-transform duration-200"
          :class="activeIndicatorClass"
        />
        <span
          class="truncate text-xs font-semibold tracking-wider uppercase transition-colors"
          :class="
            active
              ? 'dark:text-foreground font-bold text-gray-900'
              : 'dark:text-muted-foreground text-gray-500'
          "
        >
          {{ label }}
        </span>
      </div>

      <!-- Top-Right Badge: Trend badge has precedence over static badge -->
      <div
        v-if="trend"
        class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
        :class="trendColorClass"
      >
        <Icon
          v-if="trend.direction === 'up'"
          name="lucide:trending-up"
          class="h-3 w-3 shrink-0"
        />
        <Icon
          v-else-if="trend.direction === 'down'"
          name="lucide:trending-down"
          class="h-3 w-3 shrink-0"
        />
        <span>{{ trend.value }}</span>
        <span
          v-if="trend.label"
          class="font-normal opacity-75"
        >
          {{ trend.label }}
        </span>
      </div>

      <span
        v-else-if="badge"
        class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors"
        :class="badgeColorClass"
      >
        {{ badge }}
      </span>
    </div>

    <!-- Center Hero: Dominant, Bold, Centered Metric Value -->
    <div class="my-auto flex flex-col items-center justify-center py-3.5 text-center sm:py-4">
      <div
        v-if="loading"
        class="h-10 w-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
      />
      <div
        v-else
        class="flex max-w-full flex-wrap items-baseline justify-center gap-1.5"
      >
        <span
          class="font-black tracking-tight tabular-nums transition-colors"
          :class="[valueSizeClass, valueToneClass]"
        >
          {{ formattedValue }}
        </span>
        <span
          v-if="unit"
          class="dark:text-muted-foreground text-xs font-medium text-gray-400 sm:text-sm"
        >
          {{ unit }}
        </span>
      </div>
    </div>

    <!-- Bottom Caption: Clean, Subtle Description -->
    <div class="text-center">
      <p
        v-if="detail"
        class="dark:text-muted-foreground line-clamp-2 text-xs font-medium text-gray-500 transition-colors"
        :class="active ? 'text-gray-700 dark:text-gray-300' : ''"
      >
        {{ detail }}
      </p>
    </div>
  </component>
</template>
