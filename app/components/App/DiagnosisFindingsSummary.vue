<script setup lang="ts">
  import type { DonutEntry } from './DonutChart.vue'
  import { DISEASE_DATABASE } from '~/composables/useDiagnosis'
  import { datasetService } from '~/api/dataset/DatasetService'
  import { diagnosisService } from '~/api/diagnosis/DiagnosisService'
  import { userService } from '~/api/user/UserService'

  interface Props {
    role?: 'patient' | 'doctor'
  }

  const props = withDefaults(defineProps<Props>(), {
    role: 'patient'
  })

  const { currentDiagnosis, isScanned, qualityError, isHealthyState, chartData, resetScanner, patientUuid, isProceededToResults, saveActiveDiagnosisState } =
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

  const canProceed = computed(() => {
    const hasPatient = props.role === 'patient' || !!patientUuid.value || !!assignedName.value
    return !!currentDiagnosis.value && isScanned.value && !isHealthyState.value && hasPatient
  })

  const handleProceed = async () => {
    if (canProceed.value) {
      if (props.role === 'doctor') {
        try {
          if ((currentDiagnosis.value as any).uuid || currentDiagnosis.value.id) {
            const uuid = (currentDiagnosis.value as any).uuid || currentDiagnosis.value.id;
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

  // Fetch doctor-registered patients
  const doctorRegisteredPatients = ref<any[]>([])
  const loadDoctorPatients = async () => {
    if (props.role !== 'doctor') return
    try {
      const res = await userService.listDoctorPatients()
      doctorRegisteredPatients.value = (res?.data ?? res ?? []).map((p: any) => ({
        ...p,
        _source: 'registered'
      }))
    } catch {
      // silent fail
    }
  }
  if (props.role === 'doctor') {
    loadDoctorPatients()
  }

  const uniquePatients = computed(() => {
    const patientsMap = new Map()
    const allAppointments = [...appointments.value, ...pendingAppointments.value]
    
    for (const appt of allAppointments) {
      if (appt.patient && appt.patient_uuid) {
        if (!patientsMap.has(appt.patient_uuid)) {
          patientsMap.set(appt.patient_uuid, {
            ...appt.patient,
            latest_appointment_date: appt.date || appt.created_at,
            _source: 'appointment'
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
    
    // Merge doctor-registered patients (avoid duplicates)
    for (const p of doctorRegisteredPatients.value) {
      if (!patientsMap.has(p.uuid)) {
        patientsMap.set(p.uuid, p)
      }
    }
    
    return Array.from(patientsMap.values())
  })

  // Tracks patient explicitly assigned for this scan (not the global cookie)
  const assignedName = ref('')

  const selectedPatientName = computed(() => {
    if (patientUuid.value) {
      const patient = uniquePatients.value.find(p => p.uuid === patientUuid.value)
      if (patient) return `${patient.first_name} ${patient.last_name}`
    }
    return assignedName.value
  })

  // Add Patient Name State
  const isAddingPatient = ref(false)
  const newPatientNameInput = ref('')

  const handleAddPatientName = () => {
    const trimmed = newPatientNameInput.value.trim()
    if (!trimmed) return
    assignedName.value = trimmed
    userName.value = trimmed
    patientUuid.value = null
    const history = [...(recentNames.value || [])]
    const filtered = history.filter(n => n !== trimmed)
    recentNames.value = [trimmed, ...filtered].slice(0, 5)
    newPatientNameInput.value = ''
    isAddingPatient.value = false
    isPatientModalOpen.value = false
  }

  const selectExistingPatient = (patient: any) => {
    patientUuid.value = patient.uuid
    assignedName.value = `${patient.first_name} ${patient.last_name}`
    userName.value = assignedName.value
    isPatientModalOpen.value = false
  }
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
              <div v-if="selectedPatientName" class="flex items-center justify-between border border-gray-100 rounded-2xl p-3 bg-gray-50/50">
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

              <AppModal v-model="isPatientModalOpen" title="Assign Patient" description="Select or add a patient for this clinical scan." size="lg">
                <div class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                  
                  <div v-if="!isAddingPatient">
                    <div v-if="uniquePatients.length === 0" class="text-center py-6 text-gray-400">
                      <Icon name="material-symbols:inbox-outline" class="text-4xl opacity-50 mb-2" />
                      <p class="text-sm">No recent appointment patients</p>
                    </div>
                    <button
                      v-for="patient in uniquePatients"
                      :key="patient.uuid"
                      @click="selectExistingPatient(patient)"
                      class="flex items-center gap-4 p-4 rounded-2xl border transition-all text-left w-full mb-2"
                      :class="patientUuid === patient.uuid ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'"
                    >
                      <img
                        :src="patient.avatar_path ? getStorageUrl(patient.avatar_path) : `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.first_name + '+' + patient.last_name)}&background=7B5EF5&color=fff&size=128`"
                        class="h-12 w-12 rounded-full object-cover shrink-0"
                      />
                      <div class="flex-1">
                        <p class="font-bold text-gray-900">{{ patient.first_name }} {{ patient.last_name }}</p>
                        <div class="flex items-center gap-2 mt-0.5">
                          <span
                            v-if="patient._source === 'registered'"
                            class="inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary"
                          >Registered</span>
                          <p class="text-xs text-gray-500">
                            {{ patient._source === 'registered' ? (patient.account_status === 'active' ? 'Active' : 'Disabled') : (patient.latest_appointment_date ? new Date(patient.latest_appointment_date).toLocaleDateString() : 'N/A') }}
                          </p>
                        </div>
                      </div>
                      <div v-if="patientUuid === patient.uuid" class="bg-primary text-white h-6 w-6 rounded-full flex items-center justify-center shadow-sm">
                        <Icon name="material-symbols:check-small-rounded" class="text-xl" />
                      </div>
                    </button>
                    
                    <AppButton variant="outline" class="w-full mt-3 border-dashed rounded-2xl py-5 hover:bg-gray-50" @click="isAddingPatient = true">
                      <span class="flex items-center gap-2 font-bold text-gray-600">
                        <Icon name="material-symbols:add-circle-outline" class="text-xl text-primary" />
                        Add Patient
                      </span>
                    </AppButton>
                  </div>
                  
                  <div v-else class="flex flex-col gap-4 p-2">
                    <div class="flex items-center justify-between">
                      <h3 class="font-bold text-base text-gray-900">Add Patient Name</h3>
                      <button @click="isAddingPatient = false" class="text-gray-400 hover:text-gray-600">
                        <Icon name="material-symbols:close-rounded" class="text-xl" />
                      </button>
                    </div>
                    
                    <div>
                      <label class="text-xs font-bold text-gray-500 mb-1.5 block">Patient Full Name</label>
                      <input 
                        v-model="newPatientNameInput" 
                        type="text" 
                        class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:border-primary focus:ring-1 focus:ring-primary outline-none" 
                        placeholder="e.g. John Doe"
                        @keyup.enter="handleAddPatientName"
                        autoFocus
                      />
                    </div>
                    
                    <div class="flex items-center gap-2 mt-2">
                      <AppButton class="flex-1 rounded-xl py-2.5 font-bold" @click="handleAddPatientName" :disabled="!newPatientNameInput.trim()">
                        Add Patient
                      </AppButton>
                      <AppButton variant="ghost" class="rounded-xl py-2.5 font-bold text-gray-500" @click="isAddingPatient = false">
                        Cancel
                      </AppButton>
                    </div>
                  </div>
                  
                </div>
                <template #footer>
                  <AppButton variant="outline" @click="patientUuid = null; assignedName = ''; isPatientModalOpen = false" class="rounded-xl px-6 font-bold" v-if="selectedPatientName && !isAddingPatient">
                    Clear Selection
                  </AppButton>
                  <AppButton variant="ghost" @click="isPatientModalOpen = false; isAddingPatient = false" class="rounded-xl px-6 font-bold text-gray-500">
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
            :class="[isHealthyState ? 'text-gray-500' : 'text-primary']"
          >
            {{ isHealthyState ? 'No skin disease detected' : currentDiagnosis?.label || 'Waiting...' }}
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
          :disabled="!canProceed"
          :class="{ 'cursor-not-allowed opacity-40 grayscale': !canProceed }"
          class="bg-primary text-card h-14 w-fit rounded-full px-10 py-3 text-2xl font-bold transition-all hover:opacity-90 active:scale-95"
        >
          Proceed
        </AppButton>
      </div>
    </div>
  </div>
</template>
