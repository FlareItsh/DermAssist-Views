<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    value: number | string
    detail: string
    icon: string
    to?: string
    loading?: boolean
    tone?: 'blue' | 'emerald' | 'amber' | 'rose'
  }>(),
  {
    loading: false,
    tone: 'blue'
  }
)

const toneClasses = computed(() => {
  const tones = {
    blue: {
      accent: 'from-primary to-primary-light',
      icon: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
      glow: 'bg-blue-200 dark:bg-blue-900/20'
    },
    emerald: {
      accent: 'from-primary to-primary-light',
      icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
      glow: 'bg-emerald-200 dark:bg-emerald-900/20'
    },
    amber: {
      accent: 'from-primary to-primary-light',
      icon: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
      glow: 'bg-amber-200 dark:bg-amber-900/20'
    },
    rose: {
      accent: 'from-primary to-primary-light',
      icon: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
      glow: 'bg-rose-200 dark:bg-rose-900/20'
    }
  }

  return tones[props.tone]
})

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return new Intl.NumberFormat('en').format(props.value)
  }
  return props.value
})
const cardComponent = computed(() => props.to ? resolveComponent('NuxtLink') : 'section')
</script>

<template>
  <component
    :is="cardComponent"
    :to="to"
    class="metric-card relative block h-full min-h-40 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    :class="to ? 'cursor-pointer' : ''"
  >
    <div class="absolute -top-10 -right-8 h-28 w-28 rounded-full opacity-40 blur-2xl" :class="toneClasses.glow" />
    <div class="relative flex h-full flex-col items-start justify-between p-5">
      <div class="flex w-full justify-between gap-4">
        <div>
          <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">{{ label }}</p>
          <div v-if="loading" class="mt-3 h-8 w-20 animate-pulse rounded-lg bg-muted" />
          <p v-else class="mt-2 text-3xl font-black text-foreground">
            {{ formattedValue }}
          </p>
        </div>

        <div class="flex h-12 w-12 items-center justify-center rounded-2xl" :class="toneClasses.icon">
          <Icon :name="icon" class="text-2xl" />
        </div>
      </div>

      <div class="mt-5 w-full">
        <p class="text-sm font-medium text-muted-foreground">{{ detail }}</p>
        <div class="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            class="metric-progress h-full w-1/3 rounded-full bg-gradient-to-r transition-all duration-500 ease-out"
            :class="toneClasses.accent"
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
