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
  const cardComponent = computed(() => (props.to ? resolveComponent('NuxtLink') : 'section'))
</script>

<template>
  <component
    :is="cardComponent"
    :to="to"
    class="metric-card border-border bg-card text-card-foreground hover:border-primary/30 relative block h-full overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:min-h-40"
    :class="to ? 'cursor-pointer' : ''"
  >
    <div
      class="absolute -top-10 -right-8 h-28 w-28 rounded-full opacity-40 blur-2xl"
      :class="toneClasses.glow"
    />
    <div class="relative flex h-full flex-col items-start justify-between p-3.5 md:p-5">
      <div class="flex w-full justify-between gap-2 md:gap-4">
        <div>
          <p class="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            {{ label }}
          </p>
          <div
            v-if="loading"
            class="bg-muted mt-3 h-8 w-20 animate-pulse rounded-lg"
          />
          <p
            v-else
            class="text-foreground mt-1 text-2xl font-black md:mt-2 md:text-3xl"
          >
            {{ formattedValue }}
          </p>
        </div>

        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl md:h-12 md:w-12 md:rounded-2xl"
          :class="toneClasses.icon"
        >
          <Icon
            :name="icon"
            class="text-2xl"
          />
        </div>
      </div>

      <div class="mt-2.5 w-full md:mt-5">
        <p class="text-muted-foreground hidden text-sm font-medium sm:block">{{ detail }}</p>
        <div class="bg-muted mt-1 h-1.5 overflow-hidden rounded-full sm:mt-4">
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
