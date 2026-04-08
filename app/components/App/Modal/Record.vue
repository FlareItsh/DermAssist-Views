<script setup lang="ts">
  import { computed, ref, watchEffect } from 'vue'
  import type { DonutEntry } from '../DonutChart.vue'

  const emit = defineEmits(['close'])

  const age = useCookie('age')
  const date = useCookie('date')

  const props = defineProps<{
    record: {
      id: number
      title: string
      time: string
    }
  }>()

  const userName = useCookie('user_name')

  // ── Disease database (Synced from DiagnosisFindingsDetailed) ─────────────────
  const diseases = {
    Eczema: {
      description:
        'also known as atopic dermatitis, is a chronic skin condition characterized by patches of skin that become inflamed, itchy, cracked, and rough. It is not contagious, but it can be persistent and often flares up periodically.',
      symptoms: [
        'Intense Itching: Often the most burdensome symptom, which can lead to sleep disruption.',
        'Dry, Sensitive Skin: The skin may feel tight or look scaly.',
        'Discoloration: On lighter skin, it often appears red or pink. On darker skin, it may look brown, purple, or gray.',
        'Texture Changes: Small, raised bumps may leak fluid when scratched, or the skin may thicken and become leathery.'
      ],
      causes: [
        'Genetics: It often runs in families, especially those with a history of asthma or hay fever.',
        'Immune System: An overactive immune response to small triggers.',
        'Environmental Triggers: Things like harsh soaps, detergents, stress, weather changes, or certain fabrics like wool.'
      ],
      color: '#7B5EF5'
    },
    Acne: {
      description:
        'is a common skin condition that occurs when hair follicles become clogged with oil and dead skin cells. It causes whiteheads, blackheads, or pimples and is most common among teenagers, though it affects people of all ages.',
      symptoms: [
        'Whiteheads: Closed clogged pores that appear as small white bumps on the skin.',
        'Blackheads: Open clogged pores that turn dark due to oxidation on the surface.',
        'Papules: Small, red, tender bumps that signal inflammation or infection.',
        'Nodules and Cysts: Large, solid, painful lumps deep in the skin that can cause scarring.'
      ],
      causes: [
        'Excess Oil Production: Sebaceous glands producing too much sebum can clog pores.',
        'Bacteria: Propionibacterium acnes bacteria on the skin can trigger inflammation.',
        'Hormonal Changes: Androgens that increase during puberty, pregnancy, or stress can enlarge sebaceous glands.'
      ],
      color: '#E53935'
    },
    Herpes: {
      description:
        'HSV (Herpes Simplex Virus) is a common viral infection that causes sores on the mouth or genitals. HSV-1 typically causes oral herpes while HSV-2 causes genital herpes. The virus remains dormant in the body and can reactivate periodically.',
      symptoms: [
        'Cold Sores or Blisters: Fluid-filled blisters around the mouth, lips, or genitals that can break and crust over.',
        'Pain and Itching: Tingling, itching, or burning sensations often precede the appearance of sores.',
        'Flu-like Symptoms: During the first outbreak, fever, swollen lymph nodes, and body aches may occur.',
        'Recurrent Outbreaks: The virus reactivates periodically, often triggered by stress, illness, or sun exposure.'
      ],
      causes: [
        'HSV-1 Transmission: Spread through oral contact such as kissing or sharing utensils with an infected person.',
        'HSV-2 Transmission: Primarily spread through sexual contact with an infected individual.',
        'Reactivation Triggers: Stress, weakened immune system, fever, or prolonged sun exposure can trigger outbreaks.'
      ],
      color: '#4FC3F7'
    }
  }

  type DiseaseName = keyof typeof diseases

  const defaultChartData: DonutEntry[] = [
    { label: 'Herpes', value: 3, color: '#4FC3F7' },
    { label: 'Acne', value: 22, color: '#E53935' },
    { label: 'Eczema', value: 75, color: '#7B5EF5' }
  ]

  const activeDisease = ref<DiseaseName>('Eczema')

  watchEffect(() => {
    if (props.record.title.includes('Acne')) activeDisease.value = 'Acne'
    else if (props.record.title.includes('Herpes')) activeDisease.value = 'Herpes'
    else activeDisease.value = 'Eczema'
  })

  const currentDisease = computed(() => diseases[activeDisease.value])
</script>

<template>
  <div class="bg-card flex h-[90vh] overflow-hidden rounded-2xl">
    <!-- Left Column -->
    <div class="custom-scrollbar flex flex-1 flex-col overflow-y-auto p-8 pr-6">
      <h1 class="text-foreground mb-6 text-4xl font-black">{{ activeDisease }}</h1>

      <div class="mb-8 flex flex-col gap-1">
        <p class="text-base">
          <span class="font-bold">Patient Name:</span>
          <span class="ml-2">{{ userName || 'Guest User' }}</span>
        </p>
        <p class="text-base">
          <span class="font-bold">Age:</span>
          <span class="ml-2">{{ age || '--' }}</span>
        </p>
        <p class="text-base">
          <span class="font-bold">Date:</span>
          <span class="ml-2">{{ date || new Date().toLocaleDateString() }}</span>
        </p>
      </div>

      <div class="mb-6">
        <p class="text-foreground text-base leading-relaxed">
          <span class="mr-1 inline-flex items-center gap-2">
            <span
              class="inline-block h-3 w-3 shrink-0 rounded-full"
              :style="{ backgroundColor: currentDisease.color }"
            ></span>
            <strong>{{ activeDisease }}</strong>
          </span>
          {{ currentDisease.description }}
        </p>
      </div>

      <div class="mb-6">
        <p class="mb-2 font-semibold">Common Symptoms</p>
        <p class="mb-2 text-sm text-gray-600">
          The appearance can vary significantly depending on skin tone and severity:
        </p>
        <ul class="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li
            v-for="(symptom, i) in currentDisease.symptoms"
            :key="i"
          >
            {{ symptom }}
          </li>
        </ul>
      </div>

      <div class="mb-4">
        <p class="mb-2 font-semibold">What Causes It?</p>
        <p class="mb-2 text-sm text-gray-600">Generally believed to be a combination of factors:</p>
        <ol class="list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li
            v-for="(cause, i) in currentDisease.causes"
            :key="i"
          >
            {{ cause }}
          </li>
        </ol>
      </div>
    </div>

    <!-- Right Column -->
    <div
      class="bg-background/50 custom-scrollbar flex w-[450px] shrink-0 flex-col gap-6 overflow-y-auto p-8 pl-6 lg:w-[300px]"
    >
      <div class="flex w-full flex-col items-center">
        <h2 class="mb-8 text-center text-2xl font-bold">Findings</h2>
        <div class="flex w-full flex-col items-center gap-8">
          <AppDonutChart
            :data="defaultChartData"
            :size="200"
            :stroke-width="35"
          />

          <div class="flex w-full max-w-[240px] flex-col gap-3">
            <div
              v-for="(entry, i) in defaultChartData"
              :key="i"
              class="hover:bg-background group hover:border-border flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-transparent p-3 transition-all"
              @click="activeDisease = entry.label as DiseaseName"
            >
              <div class="flex items-center gap-3">
                <span
                  class="h-3 w-3 shrink-0 rounded-full"
                  :style="{ backgroundColor: entry.color }"
                ></span>
                <span
                  class="text-sm font-bold transition-colors"
                  :class="activeDisease === entry.label ? 'text-primary' : 'text-foreground/60'"
                >
                  {{ entry.value }}% {{ entry.label }}
                </span>
              </div>
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-all"
                :class="
                  activeDisease === entry.label
                    ? 'bg-primary text-white'
                    : 'bg-background text-foreground/20 group-hover:text-foreground/40'
                "
              >
                <Icon
                  :name="
                    activeDisease === entry.label
                      ? 'material-symbols:check-rounded'
                      : 'material-symbols:search-rounded'
                  "
                  class="text-base"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-auto space-y-4">
        <div class="flex gap-4">
          <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
            class="bg-foreground text-card flex flex-1 items-center justify-center gap-3 rounded-2xl py-4 text-sm font-bold transition-all hover:opacity-90 active:scale-95"
          >
            <Icon name="solar:printer-bold" />
            Print Medical PDF
          </AppButton>
          <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
            class="bg-primary text-foreground flex w-14 items-center justify-center rounded-2xl font-bold transition-all hover:bg-gray-200 active:scale-95"
          >
            <Icon
              name="solar:share-bold"
              class="text-lg"
            />
          </AppButton>
        </div>
        <p class="text-center font-mono text-[10px] tracking-[0.2em] text-gray-400 uppercase">
          Record generated by DermAssist Engine
        </p>
      </div>
    </div>
  </div>
</template>
