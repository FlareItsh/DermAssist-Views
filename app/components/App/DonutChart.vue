<script setup lang="ts">
export interface DonutEntry {
  label: string
  value: number
  color: string
}

interface Props {
  data: DonutEntry[]
  size?: number
  strokeWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 180,
  strokeWidth: 28
})

const radius = computed(() => (props.size / 2) - (props.strokeWidth / 2) - 2)
const viewBox = computed(() => `0 0 ${props.size} ${props.size}`)
const center = computed(() => props.size / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

const total = computed(() => props.data.reduce((sum, d) => sum + d.value, 0))

const segments = computed(() => {
  let offset = 0
  return props.data.map((entry) => {
    const pct = total.value > 0 ? entry.value / total.value : 0
    const dashLength = pct * circumference.value
    const dashOffset = -offset
    offset += dashLength
    return {
      ...entry,
      pct,
      dashArray: `${dashLength} ${circumference.value - dashLength}`,
      dashOffset
    }
  })
})
</script>

<template>
  <div class="flex flex-col items-center">
    <svg :width="size" :height="size" :viewBox="viewBox">
      <circle v-for="(seg, i) in segments" :key="i" :cx="center" :cy="center" :r="radius" fill="none"
        :stroke="seg.color" :stroke-width="strokeWidth" :stroke-dasharray="seg.dashArray"
        :stroke-dashoffset="seg.dashOffset" stroke-linecap="butt" :transform="`rotate(-90 ${center} ${center})`"
        class="transition-all duration-500" />
    </svg>
    <div class="flex flex-wrap justify-center gap-4 mt-3">
      <div v-for="(seg, i) in segments" :key="i" class="flex items-center gap-1.5">
        <span class="inline-block w-2 h-2 rounded-full" :style="{ backgroundColor: seg.color }"></span>
        <span class="text-sm text-foreground">{{ seg.label }}</span>
      </div>
    </div>
  </div>
</template>
