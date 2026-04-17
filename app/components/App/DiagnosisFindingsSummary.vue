<script setup lang="ts">
  import type { DonutEntry } from './DonutChart.vue'

  interface Props {
    role?: 'patient' | 'doctor'
  }

  const props = withDefaults(defineProps<Props>(), {
    role: 'patient'
  })

  const { currentDiagnosis, qualityError } = useDiagnosis()

  const userName = useCookie('user_name')
  const authUserName = useCookie('auth_user_name')
  const recentNames = useCookie<string[]>('recent_names', { default: () => [] })

  // Disease Information Map
  const DISEASE_INFO: Record<string, { description: string, prescription: string, guidelines: string[] }> = {
    'Acne': {
      description: 'Acne is a condition that occurs when hair follicles are plugged with oil and dead skin cells.',
      prescription: 'Benzoyl peroxide 5% gel once daily',
      guidelines: ['Wash twice daily', 'Avoid picking', 'Use gentle cleansers']
    },
    'Eczema': {
      description: 'Eczema is a condition that causes itchy and inflamed skin.',
      prescription: 'Hydrocortisone 1% cream twice daily',
      guidelines: ['Moisturize frequently', 'Avoid triggers', 'Short lukewarm baths']
    },
    'Herpes': {
      description: 'A viral infection causing sores, usually around the mouth or genitals.',
      prescription: 'Acyclovir 400 mg tablets 3x daily',
      guidelines: ['Keep area clean', 'Avoid contact', 'Wash hands frequently']
    },
    'Clear': {
      description: 'No significant skin irregularities detected. The skin appears healthy.',
      prescription: 'No medical prescription required.',
      guidelines: ['Maintain current skincare routine', 'Use daily sunscreen', 'Stay hydrated']
    },
    'None': {
      description: 'The skin appears clear and healthy with no significant irregularities detected.',
      prescription: 'No medical prescription required. Keep up your current skincare routine!',
      guidelines: ['Use daily sunscreen', 'Stay hydrated', 'Maintain a healthy diet']
    }
  }

  // Color Map for Diseases (Serious Palette)
  const COLOR_MAP: Record<string, string> = {
    'Acne': '#ef4444',
    'Eczema': '#d97706',
    'Herpes': '#4c0516',
    'Clear': '#22c55e',
    'None': '#22c55e'
  }

  // Smart Detection Thresholds
  const isHealthyState = computed(() => {
    if (!currentDiagnosis.value) return false
    // If confidence in any disease is below 50%, we consider it a Healthy result
    return currentDiagnosis.value.confidence < 0.50
  })

  const chartData = computed(() => {
    if (!currentDiagnosis.value) {
      return [{ label: 'Normal', value: 100, color: '#f3f4f6' }]
    }
    
    if (isHealthyState.value) {
      return [{ label: 'Healthy', value: 100, color: COLOR_MAP['Clear'] }]
    }

    // Only show significant findings (> 5%)
    return Object.entries(currentDiagnosis.value.all_probabilities)
      .filter(([label, value]) => value > 0.05)
      .map(([label, value]) => ({
        label,
        value: Math.round(value * 100),
        color: COLOR_MAP[label] || '#475569'
      }))
  })

  const info = computed(() => {
    if (!currentDiagnosis.value) {
      return {
        description: 'Perform a scan for clinical description.',
        prescription: 'No findings yet.',
        guidelines: ['Waiting for scan...']
      }
    }
    const label = isHealthyState.value ? 'Clear' : currentDiagnosis.value.label
    return DISEASE_INFO[label] || DISEASE_INFO['Clear']
  })

  const accuracy = computed(() => {
    if (!currentDiagnosis.value) return 0
    return Math.round(currentDiagnosis.value.confidence * 100)
  })

  const isDetailedModalOpen = ref(false)
  const showScanReminder = ref(false)
  
  const errorMessage = computed(() => {
    if (showScanReminder.value) return 'Scan required to proceed'
    return null
  })

  const handleProceed = () => {
    if (currentDiagnosis.value) {
      isDetailedModalOpen.value = true
    } else {
      showScanReminder.value = true
      setTimeout(() => { showScanReminder.value = false }, 3000)
    }
  }

  const isEditingName = ref(false)
  const tempUserName = ref(userName.value || 'Guest User')
  const nameInput = ref<HTMLInputElement | null>(null)

  const toggleEditName = () => {
    if (isEditingName.value) {
      const newName = tempUserName.value.trim()
      if (newName) {
        userName.value = newName
        const history = [...(recentNames.value || [])]
        const filtered = history.filter(n => n !== newName)
        recentNames.value = [newName, ...filtered].slice(0, 5)
      }
      isEditingName.value = false
    } else {
      tempUserName.value = userName.value || 'Guest User'
      isEditingName.value = true
      nextTick(() => { nameInput.value?.focus() })
    }
  }
</script>

<template>
  <div class="bg-card flex h-[calc(100vh-8rem)] flex-col rounded-3xl border-gray-100 p-6">
    <h1 class="text-foreground text-2xl font-bold">Clinical Findings</h1>

    <div class="custom-scrollbar flex-1 overflow-y-auto pr-2">
      <div class="my-4">
        <AppDonutChart :data="chartData" :size="140" :stroke-width="22" />
      </div>

      <div class="flex flex-col gap-4">
        <p class="text-foreground text-lg font-semibold">
          Accuracy: <span class="text-foreground ml-2 font-normal">{{ accuracy }}%</span>
        </p>

        <div class="flex flex-col">
          <div class="group flex items-center gap-1">
            <p class="text-md text-foreground font-semibold">
              Patient Name:
              <span v-if="!isEditingName" class="text-foreground ml-2 cursor-pointer rounded px-1 font-normal transition-colors hover:bg-gray-50" @click="toggleEditName">
                {{ userName || 'Guest User' }}
              </span>
              <input v-else ref="nameInput" v-model="tempUserName" class="border-primary text-foreground ml-2 border-b bg-transparent px-1 font-normal outline-none" list="recent-names" @keyup.enter="toggleEditName" @blur="toggleEditName" />
            </p>
          </div>

          <p class="text-md text-foreground font-semibold">Date: <span class="text-foreground ml-2 font-normal">{{ new Date().toLocaleDateString() }}</span></p>
        </div>

        <div>
          <p class="text-md text-foreground font-semibold">Condition Status</p>
          <p class="text-md font-bold mb-1" :class="[isHealthyState ? 'text-green-500' : 'text-primary']">
            {{ isHealthyState ? 'HEALTHY / NORMAL SKIN' : (currentDiagnosis?.label || 'Waiting...') }}
          </p>
          <p class="text-md text-foreground font-normal mb-3">{{ info.description }}</p>

          <p class="text-md text-foreground font-semibold">Prescription / Advice</p>
          <p class="text-md text-foreground font-normal whitespace-pre-line">{{ info.prescription }}</p>
        </div>
        
        <div>
          <p class="text-md text-foreground mb-1 font-semibold">Guidelines</p>
          <ul class="text-md text-foreground list-disc space-y-1 pl-5 font-normal">
            <li v-for="(guideline, i) in info.guidelines" :key="i">{{ guideline }}</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="mt-2 flex flex-col items-end gap-1">
      <div class="h-6">
        <div v-if="errorMessage" class="text-destructive text-sm font-medium">{{ errorMessage }}</div>
      </div>
      
      <div class="flex w-full justify-between">
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled" class="bg-primary text-card flex w-fit items-center justify-center rounded-full p-3 font-bold transition-all hover:opacity-90 active:scale-95">
          <Icon name="iconamoon:trash-light" class="text-4xl" />
        </AppButton>
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled" @click="handleProceed" :disabled="!currentDiagnosis" :class="{ 'opacity-40 grayscale cursor-not-allowed': !currentDiagnosis }" class="bg-primary text-card h-14 w-fit rounded-full px-10 py-3 text-2xl font-bold transition-all hover:opacity-90 active:scale-95">
          Proceed
        </AppButton>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="isDetailedModalOpen" class="fixed inset-0 z-999 flex items-center justify-center p-4 sm:p-6" @click.self="isDetailedModalOpen = false">
          <div class="fixed inset-0 bg-black/60 transition-opacity"></div>

          <!-- Modal Container -->
          <div class="modal-container relative bg-card max-h-[90vh] w-[90vw] overflow-hidden rounded-[2.5rem] shadow-2xl transition-all">
            <AppButton variant="unstyled" size="unstyled" rounded="unstyled" @click="isDetailedModalOpen = false" class="absolute top-6 right-6 z-10 rounded-full p-2 hover:bg-gray-100">
              <Icon name="material-symbols:close-rounded" class="text-2xl text-gray-400" />
            </AppButton>
            <AppModalDiagnosisFindingsDetailed
              :role="props.role"
              :condition-name="currentDiagnosis?.label === 'None' ? 'None' : (isHealthyState ? 'Clear' : currentDiagnosis?.label)"
              :patient-name="props.role === 'patient' ? userName : ''"
              :diagnosis-data="chartData"
              @close="isDetailedModalOpen = false"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
