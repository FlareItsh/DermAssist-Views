<script setup lang="ts">
  interface TrendConfig {
    value: string | number
    direction?: 'up' | 'down' | 'neutral'
    label?: string
  }

  type ToneType = 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'violet' | 'slate'

  const props = withDefaults(
    defineProps<{
      label: string
      value: number | string
      unit?: string
      detail?: string
      to?: string
      loading?: boolean
      tone?: ToneType
      badge?: string
      trend?: TrendConfig
    }>(),
    {
      loading: false,
      tone: 'blue',
      unit: '',
      detail: '',
      to: '',
      badge: '',
      trend: undefined
    }
  )

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

  const cardComponent = computed(() => (props.to ? resolveComponent('NuxtLink') : 'div'))
</script>

<template>
  <component
    :is="cardComponent"
    :to="to || undefined"
    class="group dark:border-border/60 dark:bg-card dark:hover:border-border relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-blue-100/90 bg-gradient-to-br from-white via-white to-blue-100/45 p-4 shadow-2xs transition-all duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-blue-500/25 before:to-transparent hover:border-blue-200 hover:shadow-xs sm:p-5"
    :class="[to ? 'cursor-pointer' : '']"
  >
    <!-- Ambient Corner Glow (Harmonizes with Primary Accents) -->
    <div
      class="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-blue-500/10 blur-xl transition-all duration-300 group-hover:scale-125 group-hover:bg-blue-500/20"
    />

    <!-- Header Row: Clean Label (left) & Single High-Craft Pill Badge (right) -->
    <div class="relative z-10 flex items-center justify-between gap-2">
      <span
        class="dark:text-muted-foreground truncate text-xs font-semibold tracking-wider text-gray-500 uppercase"
      >
        {{ label }}
      </span>

      <!-- Single Top-Right Badge: Trend badge has precedence over static badge -->
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
        class="dark:bg-muted dark:text-muted-foreground inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset"
      >
        {{ badge }}
      </span>
    </div>

    <!-- Center Hero: Dominant, Bold, Centered Metric Value -->
    <div class="relative z-10 my-auto flex flex-col items-center justify-center py-4 text-center">
      <div
        v-if="loading"
        class="h-10 w-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
      />
      <div
        v-else
        class="flex max-w-full flex-wrap items-baseline justify-center gap-1.5"
      >
        <span
          class="dark:text-foreground font-black tracking-tight text-gray-900 tabular-nums"
          :class="valueSizeClass"
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
    <div class="relative z-10 text-center">
      <p
        v-if="detail"
        class="dark:text-muted-foreground line-clamp-2 text-xs font-medium text-gray-500"
      >
        {{ detail }}
      </p>
    </div>
  </component>
</template>
