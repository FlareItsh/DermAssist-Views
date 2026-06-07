<script setup lang="ts">
  import type { DonutEntry } from './DonutChart.vue'
  import { DISEASE_DATABASE } from '~/composables/useDiagnosis'
  import { datasetService } from '~/api/dataset/DatasetService'
  import { diagnosisService } from '~/api/diagnosis/DiagnosisService'

  interface Props {
    role?: 'patient' | 'doctor'
  }

  const props = withDefaults(defineProps<Props>(), {
    role: 'patient'
  })

  const { currentDiagnosis, isScanned, qualityError, isHealthyState, chartData, resetScanner, patientUuid } =
    useDiagnosis()

  const userName = useCookie('user_name')
  const authUserName = useCookie('auth_user_name')
  const recentNames = useCookie<string[]>('recent_names', { default: () => [] })
  const { appointments, pendingAppointments } = useAppointments()

  const hasAnyPendingRequest = computed(() => {
    return pendingAppointments.value.length > 0
  })

  const accuracy = computed(() => {
    if (!currentDiagnosis.value) return 0
    return Math.round(currentDiagnosis.value.confidence * 100)
  })

  const showScanReminder = ref(false)

  const errorMessage = computed(() => {
    if (showScanReminder.value) return 'Scan required to proceed'
    if (!isScanned.value) return 'Please scan the image first'
    return null
  })

  const handleProceed = async () => {
    if (currentDiagnosis.value) {
      if (props.role === 'doctor') {
        try {
          if (currentDiagnosis.value.id || (currentDiagnosis.value as any).uuid) {
            const uuid = currentDiagnosis.value.id || (currentDiagnosis.value as any).uuid;
            await datasetService.saveFromDiagnosis(uuid);
            if (patientUuid.value) {
              await diagnosisService.update(uuid, { patient_uuid: patientUuid.value });
            }
          }
        } catch (e) {
          console.error('Failed to save to dataset', e);
        }
        navigateTo('/Doctor/Scan/Results')
      } else {
        navigateTo('/Patient/Scan/Results')
      }
    } else {
      showScanReminder.value = true
      setTimeout(() => {
        showScanReminder.value = false
      }, 3000)
    }
  }

  const info = computed(() => {
    if (!currentDiagnosis.value) {
      return {
        description: 'Perform a scan for clinical description.',
        prescription: 'No findings yet.',
        guidelines: ['Waiting for scan...']
      }
    }
    const label = isHealthyState.value ? 'Clear' : currentDiagnosis.value.label
    return DISEASE_DATABASE[label] || DISEASE_DATABASE['Clear']
  })

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

  const isPatientModalOpen = ref(false)
  const { getStorageUrl } = useStorage()

  const uniquePatients = computed(() => {
    const patientsMap = new Map()
    const allAppointments = [...appointments.value, ...pendingAppointments.value]
    
    for (const appt of allAppointments) {
      if (appt.patient && appt.patient_uuid) {
        if (!patientsMap.has(appt.patient_uuid)) {
          patientsMap.set(appt.patient_uuid, {
            ...appt.patient,
            latest_appointment_date: appt.date || appt.created_at
          })
        } else {
          const existing = patientsMap.get(appt.patient_uuid)
          const currentDate = new Date(appt.date || appt.created_at)
          const existingDate = new Date(existing.latest_appointment_date)
          if (currentDate > existingDate) {
            existing.latest_appointment_date = appt.date || appt.created_at
          }
        }
      }
    }
    
    return Array.from(patientsMap.values())
  })

  const selectedPatientName = computed(() => {
    if (!patientUuid.value) return ''
    const patient = uniquePatients.value.find(p => p.uuid === patientUuid.value)
    return patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown'
  })
</script>

<template>
  <div class="bg-card flex h-full flex-col rounded-3xl border-gray-100 p-6">
    <h1 class="text-foreground text-2xl font-bold">Scan Results</h1>

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

        <div class="flex flex-col">
          <div class="group flex flex-col gap-1">
            <p class="text-md text-foreground font-semibold">
              Patient / Appointment:
            </p>
            <div v-if="props.role === 'doctor'" class="mt-2">
              <div v-if="patientUuid" class="flex items-center justify-between border border-gray-100 rounded-2xl p-3 bg-gray-50/50">
                <div class="flex items-center gap-3">
                  <div class="bg-primary/10 text-primary h-10 w-10 flex items-center justify-center rounded-xl">
                    <Icon name="material-symbols:person" class="text-xl" />
                  </div>
                  <div>
                    <p class="font-bold text-sm text-gray-900">{{ selectedPatientName }}</p>
                    <p class="text-xs text-gray-500 font-medium">Patient</p>
                  </div>
                </div>
                <AppButton variant="ghost" size="sm" class="text-xs font-bold text-gray-500 hover:text-primary rounded-xl" @click="isPatientModalOpen = true">
                  Change
                </AppButton>
              </div>
              <AppButton v-else variant="outline" class="w-full justify-between rounded-2xl py-6 border-dashed border-2 hover:bg-gray-50 transition-colors" @click="isPatientModalOpen = true">
                <span class="flex items-center gap-3 text-gray-500 font-bold">
                  <Icon name="material-symbols:person-add-outline" class="text-xl" />
                  Assign Patient
                </span>
                <Icon name="material-symbols:chevron-right-rounded" class="text-gray-400 text-xl" />
              </AppButton>

              <AppModal v-model="isPatientModalOpen" title="Assign Patient" description="Select a patient for this clinical scan." size="lg">
                <div class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                  <div v-if="uniquePatients.length === 0" class="text-center py-10 text-gray-400">
                    <Icon name="material-symbols:inbox-outline" class="text-4xl opacity-50 mb-2" />
                    <p>No patients available</p>
                  </div>
                  <button
                    v-for="patient in uniquePatients"
                    :key="patient.uuid"
                    @click="patientUuid = patient.uuid; isPatientModalOpen = false"
                    class="flex items-center gap-4 p-4 rounded-2xl border transition-all text-left w-full"
                    :class="patientUuid === patient.uuid ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'"
                  >
                    <img
                      :src="patient.avatar_path ? getStorageUrl(patient.avatar_path) : `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.first_name + '+' + patient.last_name)}&background=7B5EF5&color=fff&size=128`"
                      class="h-12 w-12 rounded-full object-cover shrink-0"
                    />
                    <div class="flex-1">
                      <p class="font-bold text-gray-900">{{ patient.first_name }} {{ patient.last_name }}</p>
                      <p class="text-xs text-gray-500 mt-0.5">
                        Latest: {{ patient.latest_appointment_date ? new Date(patient.latest_appointment_date).toLocaleDateString() : 'N/A' }}
                      </p>
                    </div>
                    <div v-if="patientUuid === patient.uuid" class="bg-primary text-white h-6 w-6 rounded-full flex items-center justify-center shadow-sm">
                      <Icon name="material-symbols:check-small-rounded" class="text-xl" />
                    </div>
                  </button>
                </div>
                <template #footer>
                  <AppButton variant="outline" @click="patientUuid = null; isPatientModalOpen = false" class="rounded-xl px-6 font-bold" v-if="patientUuid">
                    Clear Selection
                  </AppButton>
                  <AppButton variant="ghost" @click="isPatientModalOpen = false" class="rounded-xl px-6 font-bold text-gray-500">
                    Close
                  </AppButton>
                </template>
              </AppModal>
            </div>
            <div v-else class="flex items-center gap-1">
              <span
                v-if="!isEditingName"
                class="text-foreground cursor-pointer rounded px-1 font-normal transition-colors hover:bg-gray-50"
                @click="toggleEditName"
              >
                {{ userName || 'Guest User' }}
              </span>
              <input
                v-else
                ref="nameInput"
                v-model="tempUserName"
                class="border-primary text-foreground border-b bg-transparent px-1 font-normal outline-none"
                list="recent-names"
                @keyup.enter="toggleEditName"
                @blur="toggleEditName"
              />
            </div>
          </div>

          <p class="text-md text-foreground font-semibold">
            Date:
            <span class="text-foreground ml-2 font-normal">{{
              new Date().toLocaleDateString()
            }}</span>
          </p>
        </div>

        <div>
          <p class="text-md text-foreground font-semibold">Condition Status</p>
          <p
            class="text-md mb-1 font-bold"
            :class="[isHealthyState ? 'text-green-500' : 'text-primary']"
          >
            {{ isHealthyState ? 'HEALTHY / NORMAL SKIN' : currentDiagnosis?.label || 'Waiting...' }}
          </p>
          <p class="text-md text-foreground mb-3 font-normal">{{ info.description }}</p>
        </div>

        <div>
          <p class="text-md text-foreground mb-1 font-semibold">Guidelines</p>
          <ul class="text-md text-foreground list-disc space-y-1 pl-5 font-normal">
            <li
              v-for="(guideline, i) in info.guidelines"
              :key="i"
            >
              {{ guideline }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="mt-2 flex flex-col items-end gap-1">
      <div class="h-6">
        <div
          v-if="errorMessage"
          class="text-destructive text-sm font-medium"
        >
          {{ errorMessage }}
        </div>
      </div>

      <div class="flex w-full justify-between">
        <AppButton
          variant="unstyled"
          size="unstyled"
          rounded="unstyled"
          @click="resetScanner"
          class="bg-primary text-card flex w-fit items-center justify-center rounded-full p-3 font-bold transition-all hover:opacity-90 active:scale-95"
        >
          <Icon
            name="iconamoon:trash-light"
            class="text-4xl"
          />
        </AppButton>
        <AppButton
          variant="unstyled"
          size="unstyled"
          rounded="unstyled"
          @click="handleProceed"
          :disabled="!currentDiagnosis || !isScanned"
          :class="{ 'cursor-not-allowed opacity-40 grayscale': !currentDiagnosis || !isScanned }"
          class="bg-primary text-card h-14 w-fit rounded-full px-10 py-3 text-2xl font-bold transition-all hover:opacity-90 active:scale-95"
        >
          Proceed
        </AppButton>
      </div>
    </div>
  </div>
</template>
