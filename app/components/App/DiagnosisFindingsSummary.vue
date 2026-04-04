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
  <div class="bg-card flex h-[calc(100vh-8rem)] flex-col rounded-3xl border-gray-100 p-6">
    <h1 class="text-foreground text-2xl font-bold">Clinical Findings</h1>

    <div class="custom-scrollbar flex-1 overflow-y-auto pr-2">
      <div class="my-4">
        <AppDonutChart
          :data="chartData"
          :size="140"
          :stroke-width="22"
        />
      </div>

      <div class="flex flex-col gap-4">
        <p class="text-foreground text-lg font-semibold">
          Accuracy: <span class="text-foreground ml-2 font-normal">{{ accuracy }}%</span>
        </p>

        <div class="flex flex-col leading-6">
          <div class="group flex items-center gap-1">
            <p class="text-md text-foreground font-semibold">
              Patient Name:
              <span
                v-if="!isEditingName"
                class="text-foreground ml-2 cursor-pointer rounded px-1 font-normal transition-colors hover:bg-gray-50"
                @click="toggleEditName"
              >
                {{ userName || 'Guest User' }}
              </span>
              <input
                v-else
                ref="nameInput"
                v-model="tempUserName"
                class="border-primary text-foreground ml-2 border-b bg-transparent px-1 font-normal outline-none"
                list="recent-names"
                @keyup.enter="toggleEditName"
                @blur="toggleEditName"
              />
              <datalist id="recent-names">
                <option
                  v-if="authUserName"
                  :value="authUserName"
                />
                <option value="Guest User" />
                <option
                  v-for="name in recentNames"
                  :key="name"
                  :value="name"
                />
              </datalist>
            </p>
            <button
              @click="toggleEditName"
              class="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Icon
                :name="
                  isEditingName
                    ? 'material-symbols:check-rounded'
                    : 'material-symbols:edit-square-outline-rounded'
                "
                class="text-primary text-lg"
              />
            </button>
          </div>

          <p class="text-md text-foreground font-semibold">
            Age: <span class="text-foreground ml-2 font-normal">--</span>
          </p>
          <p class="text-md text-foreground font-semibold">
            Gender: <span class="text-foreground ml-2 font-normal">--</span>
          </p>
          <p class="text-md text-foreground font-semibold">
            Date:
            <span class="text-foreground ml-2 font-normal">{{
              new Date().toLocaleDateString()
            }}</span>
          </p>
        </div>

        <div>
          <p class="text-md text-foreground font-semibold">Prescription</p>
          <p class="text-md text-foreground font-normal whitespace-pre-line">{{ prescription }}</p>
        </div>
        <!-- temporary data -->
        <div>
          <p class="text-md text-foreground mb-1 font-semibold">Treatment Guidelines</p>
          <ul class="text-md text-foreground list-disc space-y-1 pl-5 font-normal">
            <li
              v-for="(guideline, i) in treatmentGuidelines"
              :key="i"
            >
              {{ guideline }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="mt-2 flex justify-between">
      <button
        class="bg-primary text-card flex w-fit items-center justify-center rounded-full p-3 font-bold transition-all hover:scale-[1.02] hover:opacity-90 active:scale-95"
      >
        <Icon
          name="iconamoon:trash-light"
          class="text-4xl"
        />
      </button>
      <button
        @click="isDetailedModalOpen = true"
        class="bg-primary text-card h-14 w-fit rounded-full px-10 py-3 text-2xl font-bold transition-all hover:scale-[1.02] hover:opacity-90 active:scale-95"
      >
        Proceed
      </button>
    </div>
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="isDetailedModalOpen"
          class="fixed inset-0 z-999 flex items-center justify-center p-4"
          style="background: rgba(0, 0, 0, 0.4)"
          @click.self="isDetailedModalOpen = false"
        >
          <div
            class="modal-container bg-card relative max-h-[90vh] w-[90vw] overflow-hidden rounded-4xl shadow-2xl"
          >
            <button
              @click="isDetailedModalOpen = false"
              class="absolute top-4 right-4 z-10 rounded-full p-2 transition-colors hover:bg-gray-100"
            >
              <Icon
                name="material-symbols:close-rounded"
                class="text-2xl text-gray-400"
              />
            </button>
            <AppModalDiagnosisFindingsDetailed @close="isDetailedModalOpen = false" />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
