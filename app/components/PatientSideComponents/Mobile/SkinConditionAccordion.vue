<script setup lang="ts">
import { ref } from 'vue'

const skinConditions = [
  {
    id: 'acne',
    title: 'Acne',
    icon: '/images/acne-icon.png',
    desc: 'Common skin condition involving clogged pores, inflammation, and pimples. Common in adolescence.'
  },
  {
    id: 'eczema',
    title: 'Eczema',
    icon: '/images/eczema-icon.png',
    desc: 'Inflammatory condition causing dry, itchy skin, often linked to genetics and immune triggers.'
  },
  {
    id: 'hsv',
    title: 'HSV',
    icon: '/images/hsv-icon.png',
    desc: 'Viral infection causing cold sores (type 1) or genital sores (type 2). Periods of dormancy.'
  }
]

const expandedCondition = ref<string | null>('acne')
</script>

<template>
  <div class="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
    <div class="flex items-center gap-2 mb-4">
      <div class="bg-secondary h-5 w-1 shrink-0 rounded-full"></div>
      <h3 class="text-foreground text-base font-bold">Skin Conditions Information</h3>
    </div>
    <div class="flex flex-col gap-2">
      <div
        v-for="cond in skinConditions"
        :key="cond.id"
        class="rounded-2xl overflow-hidden border border-gray-100"
      >
        <!-- Accordion header -->
        <button
          @click="expandedCondition = expandedCondition === cond.id ? null : cond.id"
          class="w-full flex items-center justify-between px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors"
        >
          <div class="flex items-center gap-3">
            <div
              class="h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-colors"
              :class="expandedCondition === cond.id ? 'bg-primary' : 'bg-gray-200'"
            >
              <Icon
                name="heroicons:check-20-solid"
                size="14"
                :class="expandedCondition === cond.id ? 'text-white' : 'text-gray-400'"
              />
            </div>
            <span class="text-sm font-bold text-foreground">{{ cond.title }}</span>
          </div>
          <Icon
            name="heroicons:chevron-down-20-solid"
            size="18"
            class="text-gray-400 transition-transform duration-300"
            :class="{ 'rotate-180': expandedCondition === cond.id }"
          />
        </button>
        <!-- Accordion body -->
        <div
          class="grid transition-all duration-300 ease-in-out"
          :class="expandedCondition === cond.id ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
        >
          <div class="overflow-hidden">
            <p class="px-4 py-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
              {{ cond.desc }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
