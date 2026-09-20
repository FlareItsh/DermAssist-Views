<script setup lang="ts">
  interface Props {
    align?: 'auto' | 'left' | 'right' | 'center'
    iconClass?: string
    buttonClass?: string
  }

  withDefaults(defineProps<Props>(), {
    align: 'auto',
    iconClass: 'text-base',
    buttonClass: ''
  })
</script>

<template>
  <AppTooltip
    placement="auto"
    :align="align"
    width="w-[340px] max-w-[calc(100vw-24px)]"
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
              name="material-symbols:psychology-rounded"
              class="text-xs"
            />
            AI Probability
          </span>
          <h4 class="text-xs font-bold text-gray-900 dark:text-gray-100">Confidence Calculation</h4>
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

      <!-- Formula Card -->
      <div
        class="mb-3 rounded-xl border border-gray-100 bg-gray-50/80 p-2.5 dark:border-gray-800 dark:bg-gray-800/60"
      >
        <div
          class="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400"
        >
          <span>Softmax Normalization</span>
          <span class="text-primary font-mono text-[10px]">Σ P(c) = 100%</span>
        </div>
        <div
          class="rounded-lg border border-gray-100 bg-white/80 py-1 text-center font-mono text-xs font-bold text-gray-800 dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-200"
        >
          Confidence(c<sub class="text-[9px]">i</sub>) = e<sup class="text-[9px]"
            >z<sub class="text-[8px]">i</sub></sup
          >
          / Σ e<sup class="text-[9px]">z<sub class="text-[8px]">j</sub></sup>
        </div>
      </div>

      <!-- Step Explanations -->
      <div class="space-y-2 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
        <div class="flex items-start gap-2">
          <span
            class="bg-primary/10 text-primary mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          >
            1
          </span>
          <p>
            <strong class="text-gray-900 dark:text-white">Feature Extraction:</strong>
            Deep CNN evaluates lesion pigment, border regularity, and surface morphology into raw
            prediction logits.
          </p>
        </div>

        <div class="flex items-start gap-2">
          <span
            class="bg-primary/10 text-primary mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          >
            2
          </span>
          <p>
            <strong class="text-gray-900 dark:text-white">Probability Mapping:</strong>
            Softmax normalizes logits across all candidate skin conditions so the differential
            breakdown sums to 100%.
          </p>
        </div>

        <div class="flex items-start gap-2">
          <span
            class="bg-primary/10 text-primary mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          >
            3
          </span>
          <p>
            <strong class="text-gray-900 dark:text-white">Ranking:</strong>
            The top statistical probability is shown as the primary confidence, with secondary
            findings displayed in the chart.
          </p>
        </div>
      </div>

      <!-- Clinical Disclaimer Footer -->
      <div
        class="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200/50 bg-amber-50/80 p-2 text-[10px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
      >
        <Icon
          name="material-symbols:info-outline-rounded"
          class="mt-0.5 shrink-0 text-xs"
        />
        <span>Algorithmic decision support only. Not a definitive clinical diagnosis.</span>
      </div>
    </template>
  </AppTooltip>
</template>
