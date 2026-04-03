<script setup lang="ts">
import type { DonutEntry } from './DonutChart.vue'

interface Props {
  diagnosisData?: DonutEntry[]
  accuracy?: number
  prescription?: string
  treatmentGuidelines?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  accuracy: 90,
  prescription: 'Acyclovir 400 mg tablets \nTake 1 tablet orally three times daily for 7–10 days',
  treatmentGuidelines: () => [
    'Keep affected area clean and dry',
    'Avoid skin-to-skin contact during active lesions',
    'Wash hands frequently',
    'Avoid sharing personal items',
    'Return for follow-up if symptoms worsen'
  ]
})

const userName = useCookie('user_name')
const authUserName = useCookie('auth_user_name')
const recentNames = useCookie<string[]>('recent_names', { default: () => [] })

if (!authUserName.value && userName.value && userName.value !== 'Guest User') {
  authUserName.value = userName.value
}


// temporary
const defaultChartData: DonutEntry[] = [
  { label: 'Aids', value: 65, color: '#7B5EF5' },
  { label: 'Kagid', value: 22, color: '#E53935' },
  { label: 'COVID', value: 13, color: '#4FC3F7' }
]

const chartData = computed(() => props.diagnosisData ?? defaultChartData)
const isDetailedModalOpen = ref(false)

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
    nextTick(() => {
      nameInput.value?.focus()
    })
  }
}

</script>

<template>
  <div class="bg-card h-[calc(100vh-8rem)] rounded-3xl p-6 border-gray-100 flex flex-col">
    <h1 class="text-foreground text-2xl font-bold">Clinical Findings</h1>

    <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">
      <div class="my-4">
        <AppDonutChart :data="chartData" :size="140" :stroke-width="22" />
      </div>

      <div class="flex flex-col gap-4">
        <p class="text-foreground text-lg font-semibold">Accuracy: <span class="text-foreground font-normal ml-2">{{
          accuracy }}%</span></p>

        <div class="flex flex-col leading-6">
          <div class="flex items-center gap-1 group">
            <p class="text-md font-semibold text-foreground">Patient Name:
              <span v-if="!isEditingName" class="text-foreground font-normal ml-2 hover:bg-gray-50 px-1 rounded cursor-pointer transition-colors" @click="toggleEditName">
                {{ userName || 'Guest User' }}
              </span>
              <input v-else ref="nameInput" v-model="tempUserName"
                class="bg-transparent border-b border-primary text-foreground font-normal outline-none px-1 ml-2"
                list="recent-names"
                @keyup.enter="toggleEditName" @blur="toggleEditName" />
              <datalist id="recent-names">
                <option v-if="authUserName" :value="authUserName" />
                <option value="Guest User" />
                <option v-for="name in recentNames" :key="name" :value="name" />
              </datalist>

            </p>
            <button @click="toggleEditName" class="opacity-0 group-hover:opacity-100 transition-opacity ml-1">
              <Icon :name="isEditingName ? 'material-symbols:check-rounded' : 'material-symbols:edit-square-outline-rounded'"
                class="text-primary text-lg" />
            </button>
          </div>

          <p class="text-md font-semibold text-foreground">Age: <span class="text-foreground font-normal ml-2">--</span>
          </p>
          <p class="text-md font-semibold text-foreground">Gender: <span
              class="text-foreground font-normal ml-2">--</span>
          </p>
          <p class="text-md font-semibold text-foreground">Date: <span class="text-foreground font-normal ml-2">{{ new
            Date().toLocaleDateString() }}</span></p>
        </div>

        <div>
          <p class="text-md font-semibold text-foreground">Prescription</p>
          <p class="text-md font-normal text-foreground whitespace-pre-line">{{ prescription }}</p>
        </div>
        <!-- temporary data -->
        <div>
          <p class="text-md font-semibold text-foreground mb-1">Treatment Guidelines</p>
          <ul class="text-md font-normal text-foreground list-disc pl-5 space-y-1">
            <li v-for="(guideline, i) in treatmentGuidelines" :key="i">{{ guideline }}</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="flex justify-between mt-2">
      <button
        class="bg-primary flex items-center justify-center w-fit text-card rounded-full p-3 font-bold transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95">
        <Icon name="iconamoon:trash-light" class="text-4xl" />
      </button>
      <button @click="isDetailedModalOpen = true"
        class="bg-primary w-fit h-14 px-10 text-card rounded-full py-3 text-2xl font-bold transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95">
        Proceed
      </button>
    </div>
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="isDetailedModalOpen" class="fixed inset-0 z-999 flex items-center justify-center"
          style="background: rgba(0,0,0,0.4)" @click.self="isDetailedModalOpen = false">
          <div class="bg-card rounded-3xl w-[90vw] max-h-[90vh] overflow-hidden shadow-2xl relative">
            <button @click="isDetailedModalOpen = false"
              class="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 transition-colors">
              <Icon name="material-symbols:close" class="text-2xl text-gray-500" />
            </button>
            <AppModalDiagnosisFindingsDetailed @close="isDetailedModalOpen = false" />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
