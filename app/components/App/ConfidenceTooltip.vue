<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useDiagnosis } from '~/composables/useDiagnosis'
  import type { DonutEntry } from '~/components/App/DonutChart.vue'

  interface Props {
    align?: 'auto' | 'left' | 'right' | 'center' | 'start' | 'end'
    iconClass?: string
    buttonClass?: string
    chartData?: DonutEntry[]
    confidence?: number
  }

  const props = withDefaults(defineProps<Props>(), {
    align: 'end',
    iconClass: 'text-base',
    buttonClass: '',
    chartData: undefined,
    confidence: undefined
  })

  const activeTab = ref<'overview' | 'formulas'>('overview')

  const { chartData: globalChartData } = useDiagnosis()

  const activeChartEntries = computed<DonutEntry[]>(() => {
    if (props.chartData && props.chartData.length > 0) {
      return props.chartData
    }
    if (globalChartData.value && globalChartData.value.length > 0) {
      return globalChartData.value
    }
    return []
  })

  const hasRealScanData = computed(() => {
    return activeChartEntries.value.length > 0 && activeChartEntries.value.some(e => e.value > 0)
  })

  const totalCalculatedPercentage = computed(() => {
    if (!hasRealScanData.value) return 100
    return activeChartEntries.value.reduce((sum, item) => sum + item.value, 0)
  })
</script>

<template>
  <AppTooltip
    placement="auto"
    :align="align"
    width="w-[330px] sm:w-[350px] max-w-[calc(100vw-24px)]"
  >
    <template #default="{ isOpen }">
      <button
        type="button"
        class="hover:bg-primary/10 hover:text-primary inline-flex items-center justify-center rounded-full p-1 text-gray-400 transition-colors focus:outline-none"
        :class="[buttonClass, isOpen ? 'bg-primary/10 text-primary' : '']"
        aria-label="How confidence is calculated"
        :title="isOpen ? '' : 'How confidence is calculated'"
      >
        <Icon
          name="material-symbols:info-outline-rounded"
          :class="iconClass"
        />
      </button>
    </template>

    <template #content="{ close, isPinned }">
      <!-- Header -->
      <div
        class="mb-2.5 flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800"
      >
        <div class="flex items-center gap-2">
          <span
            class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold"
          >
            <Icon
              name="material-symbols:lightbulb-outline"
              class="text-xs"
            />
            How It Works
          </span>
          <h4 class="text-xs font-bold text-gray-900 dark:text-gray-100">Confidence Score</h4>
        </div>

        <button
          v-if="isPinned"
          type="button"
          class="rounded-md p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          @click.stop="close"
        >
          <Icon
            name="material-symbols:close-rounded"
            class="text-sm"
          />
        </button>
      </div>

      <!-- Segmented Tab Navigation: Overview vs Formulas -->
      <div class="mb-3 flex items-center rounded-lg bg-gray-100/90 p-0.5 dark:bg-gray-800/90">
        <button
          type="button"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-center text-[11px] font-semibold transition-all"
          :class="
            activeTab === 'overview'
              ? 'bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          "
          @click="activeTab = 'overview'"
        >
          <Icon
            name="material-symbols:fact-check-outline-rounded"
            class="text-xs"
          />
          Overview
        </button>
        <button
          type="button"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-center text-[11px] font-semibold transition-all"
          :class="
            activeTab === 'formulas'
              ? 'bg-white text-blue-600 shadow-xs dark:bg-gray-700 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          "
          @click="activeTab = 'formulas'"
        >
          <Icon
            name="material-symbols:calculate-outline-rounded"
            class="text-xs"
          />
          Formulas &amp; Math
        </button>
      </div>

      <!-- TAB 1: OVERVIEW -->
      <div
        v-if="activeTab === 'overview'"
        class="space-y-2.5"
      >
        <!-- Match Explanation Card (Layman's terms) -->
        <div
          class="border-primary/10 bg-primary/5 dark:border-primary/20 dark:bg-primary/10 rounded-xl border p-2.5"
        >
          <div class="mb-1 flex items-center gap-1.5">
            <Icon
              name="material-symbols:help-outline-rounded"
              class="text-primary shrink-0 text-sm"
            />
            <span class="text-xs font-bold text-gray-900 dark:text-white"
              >What does this percentage mean?</span
            >
          </div>
          <p class="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
            This score represents how closely your skin scan matches verified doctor-diagnosed cases
            in our medical database.
          </p>
        </div>

        <!-- 3-Step Plain Language Explanation -->
        <div class="space-y-2 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
          <div class="flex items-start gap-2">
            <span
              class="bg-primary/10 text-primary mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            >
              1
            </span>
            <p>
              <strong class="text-gray-900 dark:text-white">Examining Visual Signs:</strong>
              The AI inspects traits in the photo such as color, edges, shape, and skin texture.
            </p>
          </div>

          <div class="flex items-start gap-2">
            <span
              class="bg-primary/10 text-primary mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            >
              2
            </span>
            <p>
              <strong class="text-gray-900 dark:text-white">Comparing Medical Cases:</strong>
              It compares these traits against clinical dermatology images verified by doctors.
            </p>
          </div>

          <div class="flex items-start gap-2">
            <span
              class="bg-primary/10 text-primary mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            >
              3
            </span>
            <p>
              <strong class="text-gray-900 dark:text-white">Finding Closest Match:</strong>
              The condition with the highest similarity percentage is displayed as your primary
              result.
            </p>
          </div>
        </div>

        <!-- Interpretation Tip -->
        <div
          class="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-2 text-[10px] text-gray-500 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-400"
        >
          <span>Higher % = Stronger visual match</span>
          <span class="font-medium text-gray-700 dark:text-gray-300">Total adds to 100%</span>
        </div>
      </div>

      <!-- TAB 2: FORMULAS & MATH (Calculation Breakdown) -->
      <div
        v-else-if="activeTab === 'formulas'"
        class="space-y-2"
      >
        <!-- Formula 1: Proportion Percentage -->
        <div
          class="rounded-lg border border-blue-200/70 bg-white/95 p-2 shadow-xs dark:border-blue-800/60 dark:bg-gray-800/90"
        >
          <div
            class="flex items-center justify-between text-[10px] font-semibold text-blue-700 dark:text-blue-300"
          >
            <span>1. Condition Slice Formula</span>
            <span class="text-[9px] text-gray-500 dark:text-gray-400">Proportion</span>
          </div>

          <div
            class="my-1 flex items-center justify-center rounded-md bg-gray-50/90 px-2 py-1 text-center font-mono text-[10.5px] font-bold text-gray-800 dark:bg-gray-900/70 dark:text-gray-200"
          >
            <span>Slice % = (Condition Points ÷ Total Points) × 100</span>
          </div>

          <p class="text-[10px] leading-relaxed text-gray-600 dark:text-gray-300">
            The AI scores visual similarity points for each condition. Dividing each score by the
            total turns it into a percentage share of the circle.
          </p>
        </div>

        <!-- Formula 2: Total 100% Circle Sum -->
        <div
          class="rounded-lg border border-blue-200/70 bg-white/95 p-2 shadow-xs dark:border-blue-800/60 dark:bg-gray-800/90"
        >
          <div
            class="flex items-center justify-between text-[10px] font-semibold text-blue-700 dark:text-blue-300"
          >
            <span>2. Complete 360° Ring Formula</span>
            <span class="text-[9px] font-bold text-emerald-600 dark:text-emerald-400"
              >Sum = 100%</span
            >
          </div>

          <div
            class="my-1 flex items-center justify-center rounded-md bg-gray-50/90 px-2 py-1 text-center font-mono text-[10.5px] font-bold text-gray-800 dark:bg-gray-900/70 dark:text-gray-200"
          >
            <span>Primary Match % + Remaining % = 100%</span>
          </div>

          <p class="text-[10px] leading-relaxed text-gray-600 dark:text-gray-300">
            Every candidate condition is evaluated together so all slices combine to fill the entire
            donut ring with no gaps.
          </p>
        </div>

        <!-- Live Scan Slices or Example Breakdown -->
        <div
          class="rounded-lg border border-dashed border-blue-200/80 bg-white/70 p-2 dark:border-blue-800/60 dark:bg-gray-900/50"
        >
          <div
            class="mb-1 flex items-center justify-between text-[10px] font-semibold text-gray-700 dark:text-gray-300"
          >
            <span class="flex items-center gap-1">
              <Icon
                name="material-symbols:donut-large-rounded"
                class="text-primary text-xs"
              />
              <span v-if="hasRealScanData">Calculated Slices For This Scan:</span>
              <span v-else>Example Slices In The Ring:</span>
            </span>
            <span class="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              Total: {{ totalCalculatedPercentage }}%
            </span>
          </div>

          <div
            v-if="hasRealScanData"
            class="space-y-1"
          >
            <div
              v-for="(entry, idx) in activeChartEntries"
              :key="idx"
              class="flex items-center justify-between text-[10px]"
            >
              <span class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  :style="{ backgroundColor: entry.color }"
                />
                {{ entry.label }}
              </span>
              <span class="font-mono font-semibold text-gray-900 dark:text-gray-100">
                {{ entry.value }}%
              </span>
            </div>
          </div>
          <div
            v-else
            class="space-y-1 text-[10px]"
          >
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span class="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                Primary Condition (e.g. Acne)
              </span>
              <span class="font-mono font-semibold text-gray-900 dark:text-gray-100">85%</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span class="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                Secondary Condition (e.g. Eczema)
              </span>
              <span class="font-mono font-semibold text-gray-900 dark:text-gray-100">10%</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span class="h-2 w-2 shrink-0 rounded-full bg-purple-500" />
                Other Possibilities (e.g. Herpes)
              </span>
              <span class="font-mono font-semibold text-gray-900 dark:text-gray-100">5%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Friendly Medical Disclaimer Footer (Always visible) -->
      <div
        class="mt-2.5 flex items-start gap-1.5 rounded-lg border border-amber-200/50 bg-amber-50/80 p-2 text-[10px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
      >
        <Icon
          name="material-symbols:medical-services-outline-rounded"
          class="mt-0.5 shrink-0 text-xs text-amber-600 dark:text-amber-400"
        />
        <span>
          This is an AI screening estimate, not a final medical diagnosis. Always consult your
          doctor.
        </span>
      </div>
    </template>
  </AppTooltip>
</template>
