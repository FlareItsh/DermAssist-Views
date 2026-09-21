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
        class="mb-3 flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800"
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

      <!-- Match Explanation Card (Layman's terms) -->
      <div
        class="border-primary/10 bg-primary/5 dark:border-primary/20 dark:bg-primary/10 mb-3 rounded-xl border p-3"
      >
        <div class="mb-1 flex items-center gap-2">
          <Icon
            name="material-symbols:fact-check-outline-rounded"
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
      <div class="space-y-2.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
        <div class="flex items-start gap-2">
          <span
            class="bg-primary/10 text-primary mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          >
            1
          </span>
          <p>
            <strong class="text-gray-900 dark:text-white">Examining Visual Signs:</strong>
            The AI inspects key visual traits in the photo, such as color variation, edges, shape,
            and skin texture.
          </p>
        </div>

        <div class="flex items-start gap-2">
          <span
            class="bg-primary/10 text-primary mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          >
            2
          </span>
          <p>
            <strong class="text-gray-900 dark:text-white">Comparing with Medical Cases:</strong>
            It compares these patterns against thousands of clinical dermatology images confirmed by
            medical specialists.
          </p>
        </div>

        <div class="flex items-start gap-2">
          <span
            class="bg-primary/10 text-primary mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          >
            3
          </span>
          <p>
            <strong class="text-gray-900 dark:text-white">Finding the Closest Match:</strong>
            The condition with the highest similarity percentage is displayed as your primary
            result.
          </p>
        </div>
      </div>

      <!-- Interpretation Tip -->
      <div
        class="mt-3 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-2 text-[10px] text-gray-500 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-400"
      >
        <span>Higher % = Stronger visual match</span>
        <span class="font-medium text-gray-700 dark:text-gray-300">Total adds to 100%</span>
      </div>

      <!-- Friendly Medical Disclaimer Footer -->
      <div
        class="mt-2.5 flex items-start gap-1.5 rounded-lg border border-amber-200/50 bg-amber-50/80 p-2 text-[10px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
      >
        <Icon
          name="material-symbols:medical-services-outline-rounded"
          class="mt-0.5 shrink-0 text-xs text-amber-600 dark:text-amber-400"
        />
        <span
          >This is an AI screening estimate, not a final medical diagnosis. Always consult your
          doctor.</span
        >
      </div>
    </template>
  </AppTooltip>
</template>
