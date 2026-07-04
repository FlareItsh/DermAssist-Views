<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    value: number
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
      icon: 'bg-blue-50 text-blue-600',
      glow: 'bg-blue-200'
    },
    emerald: {
      accent: 'from-primary to-primary-light',
      icon: 'bg-emerald-50 text-emerald-600',
      glow: 'bg-emerald-200'
    },
    amber: {
      accent: 'from-primary to-primary-light',
      icon: 'bg-amber-50 text-amber-600',
      glow: 'bg-amber-200'
    },
    rose: {
      accent: 'from-primary to-primary-light',
      icon: 'bg-rose-50 text-rose-600',
      glow: 'bg-rose-200'
    }
  }

  return tones[props.tone]
})

const formattedValue = computed(() => new Intl.NumberFormat('en').format(props.value))
const cardComponent = computed(() => props.to ? resolveComponent('NuxtLink') : 'section')
</script>

<template>
  <component
    :is="cardComponent"
    :to="to"
    class="metric-card relative block h-full min-h-40 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    :class="to ? 'cursor-pointer' : ''"
  >
    <div class="absolute -top-10 -right-8 h-28 w-28 rounded-full opacity-40 blur-2xl" :class="toneClasses.glow" />
    <div class="relative flex h-full flex-col items-start justify-between p-5">
      <div class="flex w-full justify-between gap-4">
        <div>
          <p class="text-xs font-bold tracking-wider text-gray-400 uppercase">{{ label }}</p>
          <div v-if="loading" class="mt-3 h-8 w-20 animate-pulse rounded-lg bg-gray-100" />
          <p v-else class="mt-2 text-3xl font-black text-gray-950">
            {{ formattedValue }}
          </p>
        </div>

        <div class="flex h-12 w-12 items-center justify-center rounded-2xl" :class="toneClasses.icon">
          <Icon :name="icon" class="text-2xl" />
        </div>
      </div>

      <div class="mt-5">
        <p class="text-sm font-medium text-gray-500">{{ detail }}</p>
        <div class="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100">
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
