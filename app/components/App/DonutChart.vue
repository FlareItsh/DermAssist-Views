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
    showLegend?: boolean
    showPercentage?: boolean
    badgeStyle?: 'pill' | 'inline'
    skeuomorphic?: boolean
    interactive?: boolean
    isInconclusive?: boolean
    highlightTop?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    size: 180,
    strokeWidth: 28,
    showLegend: true,
    showPercentage: true,
    badgeStyle: 'pill',
    skeuomorphic: true,
    interactive: true,
    isInconclusive: false,
    highlightTop: true
  })

  const instanceId = useId()
  const radius = computed(() => props.size / 2 - props.strokeWidth / 2 - 3)
  const center = computed(() => props.size / 2)
  const circumference = computed(() => 2 * Math.PI * radius.value)

  const total = computed(() => props.data.reduce((sum, d) => sum + d.value, 0))

  const highlightedLabels = computed<string[]>(() => {
    if (!props.highlightTop || !props.data.length) return []
    const validEntries = props.data.filter(d => typeof d.value === 'number')
    if (!validEntries.length) return []

    // Sort descending by value
    const sorted = [...validEntries].sort((a, b) => b.value - a.value)
    const maxVal = sorted[0].value

    // If inconclusive, highlight top 2 entries (or all matching top 2 thresholds)
    if (props.isInconclusive) {
      if (sorted.length <= 2) {
        return sorted.map(d => d.label)
      }
      const secondVal = sorted[1].value
      return sorted.filter(d => d.value >= secondVal).map(d => d.label)
    }

    // Single highest (or tied highest)
    return sorted.filter(d => d.value === maxVal).map(d => d.label)
  })

  const segments = computed(() => {
    let offset = 0
    return props.data.map(entry => {
      const pct = total.value > 0 ? entry.value / total.value : 0
      const dashLength = pct * circumference.value
      const dashOffset = -offset
      offset += dashLength
      const isHighlighted = highlightedLabels.value.includes(entry.label)
      return {
        ...entry,
        pct,
        dashArray: `${dashLength} ${circumference.value - dashLength}`,
        dashOffset,
        isHighlighted
      }
    })
  })
</script>

<template>
  <div class="flex flex-col items-center">
    <!-- Skeuomorphic Donut Chart Container -->
    <div
      class="relative flex items-center justify-center transition-transform duration-300 ease-out"
      :class="{ 'hover:scale-[1.02]': interactive }"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
      <svg
        :width="size"
        :height="size"
        :viewBox="`0 0 ${size} ${size}`"
        class="overflow-visible"
      >
        <defs>
          <!-- Soft Skeuomorphic Drop Shadow for Tactile Segments -->
          <filter
            :id="`${instanceId}-skeuo-shadow`"
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
          >
            <feDropShadow
              dx="0"
              dy="2.5"
              stdDeviation="2.5"
              flood-color="#0f172a"
              flood-opacity="0.16"
            />
          </filter>

          <!-- Tubular Sheen Overlay (Cylindrical Light & Shadow) -->
          <linearGradient
            :id="`${instanceId}-skeuo-sheen`"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop
              offset="0%"
              stop-color="#ffffff"
              stop-opacity="0.32"
            />
            <stop
              offset="35%"
              stop-color="#ffffff"
              stop-opacity="0.08"
            />
            <stop
              offset="70%"
              stop-color="#000000"
              stop-opacity="0.0"
            />
            <stop
              offset="100%"
              stop-color="#000000"
              stop-opacity="0.22"
            />
          </linearGradient>
        </defs>

        <!-- 1. Recessed Dial Track (Engraved Channel Underlay) -->
        <circle
          v-if="skeuomorphic"
          :cx="center"
          :cy="center"
          :r="radius"
          fill="none"
          class="stroke-gray-100/90 dark:stroke-gray-800/80"
          :stroke-width="strokeWidth"
        />

        <!-- 2. Track Outer & Inner Inset Edges -->
        <template v-if="skeuomorphic">
          <circle
            :cx="center"
            :cy="center"
            :r="radius + strokeWidth / 2"
            fill="none"
            class="stroke-black/[0.04] dark:stroke-white/[0.06]"
            stroke-width="1"
          />
          <circle
            :cx="center"
            :cy="center"
            :r="radius - strokeWidth / 2"
            fill="none"
            class="stroke-black/[0.06] dark:stroke-white/[0.06]"
            stroke-width="1"
          />
        </template>

        <!-- 3. Colored Segments with Tactile Drop Shadow -->
        <g :filter="skeuomorphic ? `url(#${instanceId}-skeuo-shadow)` : undefined">
          <circle
            v-for="(seg, i) in segments"
            :key="'seg-' + i"
            :cx="center"
            :cy="center"
            :r="radius"
            fill="none"
            :stroke="seg.color"
            :stroke-width="strokeWidth"
            :stroke-dasharray="seg.dashArray"
            :stroke-dashoffset="seg.dashOffset"
            stroke-linecap="butt"
            :transform="`rotate(-90 ${center} ${center})`"
            class="transition-all duration-500"
          />
        </g>

        <!-- 4. Soft Skeuomorphic Tubular Curvature Sheen -->
        <circle
          v-if="skeuomorphic"
          :cx="center"
          :cy="center"
          :r="radius"
          fill="none"
          :stroke="`url(#${instanceId}-skeuo-sheen)`"
          :stroke-width="strokeWidth"
          stroke-linecap="butt"
          class="pointer-events-none transition-all duration-500"
          opacity="0.85"
        />

        <!-- 5. Machined Precision Aperture Rim -->
        <circle
          v-if="skeuomorphic"
          :cx="center"
          :cy="center"
          :r="radius - strokeWidth / 2"
          fill="none"
          class="pointer-events-none stroke-black/[0.08] dark:stroke-white/[0.12]"
          stroke-width="1.2"
        />
      </svg>
    </div>

    <!-- Legend with Disease Percentage Badges -->
    <div
      v-if="showLegend"
      class="mt-3.5 flex flex-wrap items-center justify-center gap-2"
    >
      <template v-if="badgeStyle === 'pill'">
        <div
          v-for="(seg, i) in segments"
          :key="i"
          class="inline-flex items-center gap-1.5 rounded-full border transition-all"
          :class="[
            seg.isHighlighted
              ? 'px-3 py-1 font-bold shadow-xs ring-1'
              : 'border-border/60 bg-muted/40 hover:bg-muted/70 text-muted-foreground px-2.5 py-1 text-xs opacity-85'
          ]"
          :style="
            seg.isHighlighted
              ? {
                  backgroundColor: `${seg.color}15`,
                  borderColor: `${seg.color}50`,
                  color: seg.color
                }
              : undefined
          "
        >
          <span
            class="inline-block h-2 w-2 shrink-0 rounded-full"
            :style="{ backgroundColor: seg.color }"
          ></span>
          <span
            :class="seg.isHighlighted ? 'font-bold' : 'text-foreground font-medium'"
            class="text-xs"
          >
            {{ seg.label }}
          </span>
          <span
            v-if="showPercentage && seg.value !== undefined"
            :class="seg.isHighlighted ? 'font-black' : 'text-muted-foreground ml-0.5 font-semibold'"
            class="text-xs"
          >
            {{ seg.value }}%
          </span>
          <span
            v-if="seg.isHighlighted"
            class="py-0.2 rounded-full px-1.5 text-[9px] font-black tracking-wider uppercase"
            :style="{
              backgroundColor: `${seg.color}25`,
              color: seg.color
            }"
          >
            {{ isInconclusive ? 'Contender' : 'Top Match' }}
          </span>
        </div>
      </template>
      <template v-else>
        <div
          v-for="(seg, i) in segments"
          :key="i"
          class="flex items-center gap-1.5"
          :class="{ 'font-bold': seg.isHighlighted }"
        >
          <span
            class="inline-block h-2 w-2 rounded-full"
            :style="{ backgroundColor: seg.color }"
          ></span>
          <span
            class="text-sm"
            :class="
              seg.isHighlighted ? 'text-foreground font-bold' : 'text-foreground/80 font-normal'
            "
          >
            {{ seg.label }}
            <span
              v-if="showPercentage && seg.value !== undefined"
              :class="
                seg.isHighlighted
                  ? 'text-foreground font-black'
                  : 'text-muted-foreground font-medium'
              "
              class="ml-1"
            >
              ({{ seg.value }}%)
            </span>
            <span
              v-if="seg.isHighlighted"
              class="text-primary ml-1 text-[10px] font-bold tracking-wider uppercase"
            >
              [{{ isInconclusive ? 'Contender' : 'Top Match' }}]
            </span>
          </span>
        </div>
      </template>
    </div>
  </div>
</template>
