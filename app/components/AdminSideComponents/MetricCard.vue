<script setup lang="ts">
  const props = withDefaults(
    defineProps<{
      label: string
      value: number | string
      detail?: string
      icon?: string
      to?: string
      loading?: boolean
      tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo'
      badge?: string
    }>(),
    {
      loading: false,
      tone: 'blue'
    }
  )

  const toneConfig = computed(() => {
    const tones = {
      blue: {
        number: 'text-gray-900',
        badge: 'bg-secondary/10 text-secondary ring-1 ring-secondary/20',
        hoverBorder: 'hover:border-secondary/40',
        line: 'bg-secondary',
        ambientBg: 'bg-gradient-to-br from-secondary/10 via-secondary/5 to-transparent'
      },
      emerald: {
        number: 'text-gray-900',
        badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60',
        hoverBorder: 'hover:border-emerald-300',
        line: 'bg-emerald-500',
        ambientBg: 'bg-gradient-to-br from-emerald-50/60 via-emerald-50/20 to-transparent'
      },
      amber: {
        number: 'text-gray-900',
        badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60',
        hoverBorder: 'hover:border-amber-300',
        line: 'bg-amber-500',
        ambientBg: 'bg-gradient-to-br from-amber-50/60 via-amber-50/20 to-transparent'
      },
      rose: {
        number: 'text-gray-900',
        badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/60',
        hoverBorder: 'hover:border-rose-300',
        line: 'bg-rose-500',
        ambientBg: 'bg-gradient-to-br from-rose-50/60 via-rose-50/20 to-transparent'
      },
      indigo: {
        number: 'text-gray-900',
        badge: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60',
        hoverBorder: 'hover:border-indigo-300',
        line: 'bg-indigo-500',
        ambientBg: 'bg-gradient-to-br from-indigo-50/60 via-indigo-50/20 to-transparent'
      }
    }

    return tones[props.tone] || tones.blue
  })

  const formattedValue = computed(() => {
    if (typeof props.value === 'number') {
      return new Intl.NumberFormat('en').format(props.value)
    }
    return props.value
  })

  const cardComponent = computed(() => (props.to ? resolveComponent('NuxtLink') : 'div'))
</script>

<template>
  <component
    :is="cardComponent"
    :to="to"
    class="metric-card group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-4 shadow-2xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xs"
    :class="[to ? 'cursor-pointer' : '', toneConfig.hoverBorder]"
  >
    <!-- Subtle Ambient Hover Background Animation -->
    <div
      class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
      :class="toneConfig.ambientBg"
    />

    <!-- Card Content Layer (z-10) -->
    <div class="relative z-10 flex h-full flex-col justify-between">
      <div>
        <!-- Top Row: Label & Status Pill Badge -->
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
            {{ label }}
          </span>
          <span
            v-if="badge"
            class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold"
            :class="toneConfig.badge"
          >
            {{ badge }}
          </span>
        </div>

        <!-- Middle Row: Authoritative Metric Hero Number -->
        <div class="mt-3 flex items-baseline gap-2">
          <div
            v-if="loading"
            class="h-8 w-20 animate-pulse rounded-lg bg-gray-100 sm:h-9"
          />
          <span
            v-else
            class="text-3xl font-black tracking-tight tabular-nums sm:text-4xl"
            :class="toneConfig.number"
          >
            {{ formattedValue }}
          </span>
        </div>

        <!-- Bottom Row: Context Description / Caption -->
        <p
          v-if="detail"
          class="mt-1 text-xs font-medium text-gray-500"
        >
          {{ detail }}
        </p>
      </div>

      <!-- Animated Bottom Accent Line on Hover -->
      <div class="mt-3.5 w-full">
        <div class="h-1 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            class="metric-progress h-full w-1/4 rounded-full transition-all duration-500 ease-out group-hover:w-full"
            :class="toneConfig.line"
          />
        </div>
      </div>
    </div>
  </component>
</template>

<style scoped>
  .metric-card:hover .metric-progress {
    width: 100%;
  }
</style>
