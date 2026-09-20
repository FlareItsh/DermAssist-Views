<script setup lang="ts">
  import type { DonutEntry } from './DonutChart.vue'
  import { DISEASE_DATABASE } from '~/composables/useDiagnosis'
  import { datasetService } from '~/api/dataset/DatasetService'
  import { diagnosisService } from '~/api/diagnosis/DiagnosisService'
  import { userService } from '~/api/user/UserService'
  import { usePasswordGenerator } from '~/composables/usePasswordGenerator'
  import { parseAppointmentDateTime } from '~/composables/useAppointments'
  import { toast } from 'vue-sonner'

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
  const { appointments, pendingAppointments, fetchAppointments } = useAppointments()

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
            if (patientUuid.value) {
              await diagnosisService.update(uuid, { patient_uuid: patientUuid.value });
            }
          }
        } catch (e) {
          console.error('Failed to update patient on diagnosis', e);
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
  const { generateTemporaryPassword, copyToClipboard } = usePasswordGenerator()

  // ─── Modal State: Mode & Date Filters ─────────────────────────────────────
  const activeModalTab = ref<'appointments' | 'registered' | 'register'>('appointments')
  const patientSearchQuery = ref('')
  const selectedDateFilter = ref<'today' | 'tomorrow' | 'custom' | 'all'>('today')

  const getTodayStr = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getTomorrowStr = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const year = tomorrow.getFullYear()
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const day = String(tomorrow.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const customSelectedDate = ref(getTodayStr())

  // Assigned patient & appointment tracking
  const assignedName = ref('')
  const assignedAppointment = ref<any | null>(null)

  // Fetch doctor-registered patients
  const doctorRegisteredPatients = ref<any[]>([])
  const loadDoctorPatients = async () => {
    if (props.role !== 'doctor') return
    try {
      const res = await userService.listDoctorPatients({ per_page: 100 })
      doctorRegisteredPatients.value = (res?.data ?? res ?? []).map((p: any) => ({
        ...p,
        _source: 'registered'
      }))
    } catch {
      // silent fail
    }
  }

  onMounted(() => {
    if (props.role === 'doctor') {
      loadDoctorPatients()
      fetchAppointments()
    }
  })

  const formatPatientDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // ─── Structured Appointments (Appointment-Centric) ─────────────────────────
  const availableAppointments = computed(() => {
    const all = [...appointments.value, ...pendingAppointments.value]
    const todayStr = getTodayStr()
    const tomorrowStr = getTomorrowStr()

    const list: any[] = []

    for (const appt of all) {
      // Strictly require a scheduled date (never fall back to created_at)
      const rawDateStr = appt.raw_scheduled_at || appt.scheduled_at || appt.date
      if (!rawDateStr) continue

      const pStart = parseAppointmentDateTime(rawDateStr)
      if (!pStart.date) continue

      let endTime = ''
      if (appt.raw_scheduled_end_at || appt.scheduled_end_at) {
        endTime = parseAppointmentDateTime(appt.raw_scheduled_end_at || appt.scheduled_end_at).time
      }

      const patient = appt.patient || {}
      const patientName =
        patient.first_name && patient.last_name
          ? `${patient.first_name} ${patient.last_name}`
          : appt.doctor && props.role === 'doctor'
            ? appt.doctor
            : 'Patient'

      list.push({
        id: appt.id || appt.uuid,
        uuid: appt.uuid || appt.id,
        date: pStart.date,
        time: pStart.time,
        endTime,
        timeRange: endTime ? `${pStart.time} - ${endTime}` : pStart.time,
        raw_scheduled_at: rawDateStr,
        isToday: pStart.date === todayStr,
        isTomorrow: pStart.date === tomorrowStr,
        status: appt.status || 'scheduled',
        purpose: appt.purpose || 'Consultation',
        patient,
        patient_uuid: appt.patient_uuid || patient.uuid,
        patientName,
        patientEmail: patient.email || '',
        patientAge: patient.age || appt.patient_age,
        patientGender: patient.gender || appt.patient_gender,
        avatar_path: patient.avatar_path
      })
    }

    // Sort chronologically by appointment time
    return list.sort((a, b) => {
      const timeA = new Date(a.raw_scheduled_at).getTime()
      const timeB = new Date(b.raw_scheduled_at).getTime()
      return timeA - timeB
    })
  })

  // Counts for pills
  const todayAppointmentsCount = computed(() => availableAppointments.value.filter(a => a.isToday).length)
  const tomorrowAppointmentsCount = computed(() => availableAppointments.value.filter(a => a.isTomorrow).length)
  const allAppointmentsCount = computed(() => availableAppointments.value.length)
  const registeredPatientsCount = computed(() => doctorRegisteredPatients.value.length)

  // Filtered Appointments based on selected date & search query
  const filteredAppointments = computed(() => {
    let list = availableAppointments.value

    if (selectedDateFilter.value === 'today') {
      const todayStr = getTodayStr()
      list = list.filter(a => a.date === todayStr)
    } else if (selectedDateFilter.value === 'tomorrow') {
      const tomorrowStr = getTomorrowStr()
      list = list.filter(a => a.date === tomorrowStr)
    } else if (selectedDateFilter.value === 'custom') {
      if (customSelectedDate.value) {
        list = list.filter(a => a.date === customSelectedDate.value)
      }
    }

    const q = patientSearchQuery.value.trim().toLowerCase()
    if (q) {
      list = list.filter(a => {
        const name = (a.patientName || '').toLowerCase()
        const email = (a.patientEmail || '').toLowerCase()
        const purpose = (a.purpose || '').toLowerCase()
        const time = (a.timeRange || '').toLowerCase()
        const date = (a.date || '').toLowerCase()
        return name.includes(q) || email.includes(q) || purpose.includes(q) || time.includes(q) || date.includes(q)
      })
    }

    return list
  })

  // Filtered Registered Patients (for Walk-Ins)
  const filteredRegisteredPatients = computed(() => {
    let list = doctorRegisteredPatients.value
    const q = patientSearchQuery.value.trim().toLowerCase()
    if (q) {
      list = list.filter((p: any) => {
        const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase()
        const email = (p.email || '').toLowerCase()
        return name.includes(q) || email.includes(q)
      })
    }
    return list
  })

  const selectedPatientName = computed(() => {
    if (assignedName.value) return assignedName.value
    if (patientUuid.value) {
      const reg = doctorRegisteredPatients.value.find(p => p.uuid === patientUuid.value)
      if (reg) return `${reg.first_name} ${reg.last_name}`
      const appt = availableAppointments.value.find(a => a.patient_uuid === patientUuid.value)
      if (appt) return appt.patientName
    }
    return ''
  })

  const selectAppointment = (appt: any) => {
    patientUuid.value = appt.patient_uuid
    assignedName.value = appt.patientName
    userName.value = appt.patientName
    assignedAppointment.value = appt
    isPatientModalOpen.value = false
    toast.success(`Assigned to ${appt.patientName} (${appt.isToday ? 'Today' : formatPatientDate(appt.date)} at ${appt.time})`)
  }

  const selectRegisteredPatient = (patient: any) => {
    patientUuid.value = patient.uuid
    assignedName.value = `${patient.first_name} ${patient.last_name}`
    userName.value = assignedName.value
    assignedAppointment.value = null
    isPatientModalOpen.value = false
    toast.success(`Assigned to ${assignedName.value} (Walk-in)`)
  }

  const clearAssignedPatient = () => {
    patientUuid.value = null
    assignedName.value = ''
    assignedAppointment.value = null
    isPatientModalOpen.value = false
  }

  // Register Patient Form State
  const registerForm = reactive({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: generateTemporaryPassword('Patient'),
    age: '',
    gender: 'Female',
    street: '',
    barangay: '',
    city: '',
    province: ''
  })
  const isSubmittingRegistration = ref(false)
  const registrationError = ref<string | null>(null)

  const openRegistrationForm = () => {
    resetRegisterForm()
    activeModalTab.value = 'register'
  }

  const resetRegisterForm = () => {
    registerForm.firstName = ''
    registerForm.middleName = ''
    registerForm.lastName = ''
    registerForm.email = ''
    registerForm.password = generateTemporaryPassword('Patient')
    registerForm.age = ''
    registerForm.gender = 'Female'
    registerForm.street = ''
    registerForm.barangay = ''
    registerForm.city = ''
    registerForm.province = ''
    registrationError.value = null
  }

  const handleRegisterPatient = async () => {
    if (
      !registerForm.firstName.trim() ||
      !registerForm.lastName.trim() ||
      !registerForm.email.trim() ||
      !registerForm.password
    ) {
      registrationError.value = 'First Name, Last Name, Email, and Password are required.'
      return
    }

    isSubmittingRegistration.value = true
    registrationError.value = null

    try {
      const res = await userService.createDoctorPatient({
        firstName: registerForm.firstName.trim(),
        middleName: registerForm.middleName?.trim() || undefined,
        lastName: registerForm.lastName.trim(),
        email: registerForm.email.trim(),
        password: registerForm.password,
        age: registerForm.age ? parseInt(String(registerForm.age)) : undefined,
        gender: registerForm.gender || undefined,
        street: registerForm.street?.trim() || undefined,
        barangay: registerForm.barangay?.trim() || undefined,
        city: registerForm.city?.trim() || undefined,
        province: registerForm.province?.trim() || undefined
      })

      const createdUser = res?.user?.data ?? res?.user ?? res?.data ?? res
      toast.success(`Patient ${createdUser.first_name} ${createdUser.last_name} registered and assigned!`)

      // Refresh list of doctor patients
      await loadDoctorPatients()

      // Assign to current scan
      patientUuid.value = createdUser.uuid
      assignedName.value = `${createdUser.first_name} ${createdUser.last_name}`
      userName.value = assignedName.value
      assignedAppointment.value = null

      activeModalTab.value = 'appointments'
      isPatientModalOpen.value = false
      resetRegisterForm()
    } catch (e: any) {
      console.error('Registration failed:', e)
      const msg = e?.data?.message || e?.response?._data?.message || 'Failed to register patient.'
      registrationError.value = msg
      toast.error(msg)
    } finally {
      isSubmittingRegistration.value = false
    }
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
                <div class="flex items-center gap-3 min-w-0">
                  <div class="bg-primary/10 text-primary h-10 w-10 flex items-center justify-center rounded-xl shrink-0">
                    <Icon name="material-symbols:person" class="text-xl" />
                  </div>
                  <div class="min-w-0">
                    <p class="font-bold text-sm text-gray-900 truncate">{{ selectedPatientName }}</p>
                    <p class="text-xs text-gray-500 font-medium truncate flex items-center gap-1.5 mt-0.5">
                      <span v-if="assignedAppointment" class="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[10px]">
                        <Icon name="material-symbols:schedule" class="text-xs" />
                        {{ assignedAppointment.isToday ? 'Today' : formatPatientDate(assignedAppointment.date) }} • {{ assignedAppointment.time }}
                      </span>
                      <span v-else class="inline-flex items-center gap-1 text-primary bg-primary/5 px-2 py-0.5 rounded-md font-bold text-[10px]">
                        <Icon name="material-symbols:badge-outline" class="text-xs" />
                        Walk-in Patient
                      </span>
                      <span v-if="assignedAppointment?.purpose" class="text-gray-400 truncate">
                        • {{ assignedAppointment.purpose }}
                      </span>
                    </p>
                  </div>
                </div>
                <AppButton variant="ghost" size="sm" class="text-xs font-bold text-gray-500 hover:text-primary rounded-xl shrink-0" @click="isPatientModalOpen = true">
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

              <AppModal
                v-model="isPatientModalOpen"
                :title="activeModalTab === 'register' ? 'Register Patient Account' : (activeModalTab === 'registered' ? 'Select Walk-In Patient' : 'Assign Appointment Patient')"
                :description="activeModalTab === 'register' ? 'Register a new patient account linked exclusively to your care.' : (activeModalTab === 'registered' ? 'Select a registered patient under your clinic for an unscheduled scan.' : 'Select a scheduled appointment patient for this clinical scan session.')"
                size="2xl"
              >
                <!-- Mode Navigation Tabs -->
                <div class="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-2xl mb-4 text-xs font-bold">
                  <button
                    type="button"
                    @click="activeModalTab = 'appointments'"
                    class="flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    :class="activeModalTab === 'appointments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
                  >
                    <Icon name="material-symbols:calendar-clock-outline" class="text-base text-primary" />
                    <span>Appointments</span>
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                      :class="activeModalTab === 'appointments' ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-600'"
                    >
                      {{ allAppointmentsCount }}
                    </span>
                  </button>

                  <button
                    type="button"
                    @click="activeModalTab = 'registered'"
                    class="flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    :class="activeModalTab === 'registered' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
                  >
                    <Icon name="material-symbols:person-outline-rounded" class="text-base text-indigo-600" />
                    <span>Registered (Walk-In)</span>
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                      :class="activeModalTab === 'registered' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-200 text-gray-600'"
                    >
                      {{ registeredPatientsCount }}
                    </span>
                  </button>

                  <button
                    type="button"
                    @click="openRegistrationForm"
                    class="flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    :class="activeModalTab === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
                  >
                    <Icon name="material-symbols:person-add-outline-rounded" class="text-base text-emerald-600" />
                    <span>+ New Patient</span>
                  </button>
                </div>

                <!-- 1. Appointments View -->
                <div v-if="activeModalTab === 'appointments'" class="flex flex-col gap-3.5">
                  <!-- Search Bar & Date Picker Row -->
                  <div class="flex flex-col sm:flex-row gap-2">
                    <div class="relative flex-1">
                      <Icon name="material-symbols:search-rounded" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                      <input
                        v-model="patientSearchQuery"
                        type="text"
                        placeholder="Search patient by name, email, time, or purpose..."
                        class="w-full h-10 pl-10 pr-9 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <button
                        v-if="patientSearchQuery"
                        type="button"
                        @click="patientSearchQuery = ''"
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <Icon name="material-symbols:close-rounded" class="text-base" />
                      </button>
                    </div>

                    <!-- Custom Date Input -->
                    <div class="relative flex items-center">
                      <input
                        type="date"
                        v-model="customSelectedDate"
                        @change="selectedDateFilter = 'custom'"
                        class="h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                        title="Filter by specific date"
                      />
                    </div>
                  </div>

                  <!-- Date Filter Buttons Row -->
                  <div class="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs font-bold">
                    <button
                      type="button"
                      @click="selectedDateFilter = 'today'"
                      class="px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                      :class="selectedDateFilter === 'today' ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                    >
                      <Icon name="material-symbols:today-outline" class="text-sm" />
                      <span>Today ({{ formatPatientDate(getTodayStr()) }})</span>
                      <span
                        class="text-[10px] px-1.5 py-0.2 rounded-full font-black"
                        :class="selectedDateFilter === 'today' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'"
                      >{{ todayAppointmentsCount }}</span>
                    </button>

                    <button
                      type="button"
                      @click="selectedDateFilter = 'tomorrow'"
                      class="px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                      :class="selectedDateFilter === 'tomorrow' ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                    >
                      <Icon name="material-symbols:event-outline" class="text-sm" />
                      <span>Tomorrow</span>
                      <span
                        class="text-[10px] px-1.5 py-0.2 rounded-full font-black"
                        :class="selectedDateFilter === 'tomorrow' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'"
                      >{{ tomorrowAppointmentsCount }}</span>
                    </button>

                    <button
                      type="button"
                      @click="selectedDateFilter = 'all'"
                      class="px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                      :class="selectedDateFilter === 'all' ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                    >
                      <span>All Dates</span>
                      <span
                        class="text-[10px] px-1.5 py-0.2 rounded-full font-black"
                        :class="selectedDateFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'"
                      >{{ allAppointmentsCount }}</span>
                    </button>
                  </div>

                  <!-- Appointment List -->
                  <div class="flex flex-col gap-2.5 max-h-[46vh] overflow-y-auto custom-scrollbar pr-1">
                    <!-- Empty State -->
                    <div v-if="filteredAppointments.length === 0" class="text-center py-8 px-4 bg-gray-50/70 border border-dashed border-gray-200 rounded-3xl">
                      <div class="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                        <Icon name="material-symbols:event-busy-outline-rounded" class="text-2xl" />
                      </div>
                      <h4 class="text-sm font-bold text-gray-800">
                        {{ selectedDateFilter === 'today' ? `No appointments scheduled for Today (${formatPatientDate(getTodayStr())})` : (selectedDateFilter === 'tomorrow' ? 'No appointments scheduled for Tomorrow' : 'No appointments found on this date') }}
                      </h4>
                      <p class="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        {{ selectedDateFilter === 'today' ? 'There are no active appointments on your schedule for today. You can view upcoming dates or choose from registered walk-in patients.' : 'Try selecting another date or viewing all scheduled appointments.' }}
                      </p>

                      <div class="flex flex-wrap items-center justify-center gap-2 mt-4">
                        <button
                          type="button"
                          v-if="selectedDateFilter === 'today' && tomorrowAppointmentsCount > 0"
                          @click="selectedDateFilter = 'tomorrow'"
                          class="px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-primary text-gray-700 hover:text-primary text-xs font-bold shadow-sm transition-all cursor-pointer"
                        >
                          View Tomorrow ({{ tomorrowAppointmentsCount }})
                        </button>
                        <button
                          type="button"
                          @click="selectedDateFilter = 'all'"
                          class="px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-primary text-gray-700 hover:text-primary text-xs font-bold shadow-sm transition-all cursor-pointer"
                        >
                          View All Dates ({{ allAppointmentsCount }})
                        </button>
                        <button
                          type="button"
                          @click="activeModalTab = 'registered'"
                          class="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all cursor-pointer"
                        >
                          Select Walk-In Patient
                        </button>
                      </div>
                    </div>

                    <!-- Appointment Cards -->
                    <button
                      v-for="appt in filteredAppointments"
                      :key="appt.uuid || appt.id"
                      @click="selectAppointment(appt)"
                      type="button"
                      class="flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all text-left w-full cursor-pointer group"
                      :class="assignedAppointment?.uuid === appt.uuid ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm' : 'border-gray-100 hover:border-primary/40 hover:bg-gray-50/80'"
                    >
                      <img
                        :src="appt.avatar_path ? getStorageUrl(appt.avatar_path) : `https://ui-avatars.com/api/?name=${encodeURIComponent(appt.patientName)}&background=7B5EF5&color=fff&size=128`"
                        class="h-12 w-12 rounded-xl object-cover shrink-0 border border-gray-100"
                        alt="Patient Avatar"
                      />

                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                          <p class="font-bold text-sm text-gray-900 truncate group-hover:text-primary transition-colors">
                            {{ appt.patientName }}
                          </p>

                          <!-- Time & Date Pill -->
                          <div class="shrink-0 flex items-center gap-1.5">
                            <span
                              class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold"
                              :class="appt.isToday ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' : 'bg-primary/10 text-primary border border-primary/20'"
                            >
                              <Icon name="material-symbols:schedule" class="text-xs" />
                              {{ appt.isToday ? 'Today' : formatPatientDate(appt.date) }} • {{ appt.time }}
                            </span>
                          </div>
                        </div>

                        <!-- Demographics & Purpose -->
                        <div class="flex items-center gap-2 text-xs text-gray-500 mt-1 truncate">
                          <span v-if="appt.patientEmail" class="truncate">{{ appt.patientEmail }}</span>
                          <span v-if="appt.patientEmail && (appt.patientGender || appt.patientAge)">•</span>
                          <span v-if="appt.patientGender || appt.patientAge">
                            {{ [appt.patientGender, appt.patientAge ? `${appt.patientAge} yrs` : ''].filter(Boolean).join(', ') }}
                          </span>
                        </div>

                        <div class="flex items-center gap-2 text-[11px] text-gray-500 mt-1">
                          <span class="inline-flex items-center gap-1 text-gray-600 font-medium">
                            <Icon name="material-symbols:medical-information-outline-rounded" class="text-xs text-primary" />
                            Purpose: <strong class="text-gray-800">{{ appt.purpose }}</strong>
                          </span>
                          <span class="text-gray-300">•</span>
                          <span class="capitalize text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {{ appt.status.replace('_', ' ') }}
                          </span>
                        </div>
                      </div>

                      <!-- Selection Checkmark -->
                      <div
                        v-if="assignedAppointment?.uuid === appt.uuid"
                        class="bg-primary text-white h-6 w-6 rounded-full flex items-center justify-center shadow-sm shrink-0"
                      >
                        <Icon name="material-symbols:check-small-rounded" class="text-xl" />
                      </div>
                    </button>
                  </div>
                </div>

                <!-- 2. Registered Patients / Walk-Ins View -->
                <div v-else-if="activeModalTab === 'registered'" class="flex flex-col gap-3.5">
                  <div class="relative">
                    <Icon name="material-symbols:search-rounded" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                    <input
                      v-model="patientSearchQuery"
                      type="text"
                      placeholder="Search registered walk-in patients..."
                      class="w-full h-10 pl-10 pr-9 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <button
                      v-if="patientSearchQuery"
                      type="button"
                      @click="patientSearchQuery = ''"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Icon name="material-symbols:close-rounded" class="text-base" />
                    </button>
                  </div>

                  <p class="text-xs text-gray-400">
                    Patients registered under your clinic. Select any patient to perform an unscheduled scan.
                  </p>

                  <div class="flex flex-col gap-2 max-h-[46vh] overflow-y-auto custom-scrollbar pr-1">
                    <div v-if="filteredRegisteredPatients.length === 0" class="text-center py-10 text-gray-400">
                      <Icon name="material-symbols:person-off-outline" class="text-4xl opacity-40 mb-2" />
                      <p class="text-sm font-medium">No registered patients found.</p>
                      <p class="text-xs text-gray-400 mt-1">Register a new patient account using the button below.</p>
                    </div>

                    <button
                      v-for="patient in filteredRegisteredPatients"
                      :key="patient.uuid"
                      @click="selectRegisteredPatient(patient)"
                      type="button"
                      class="flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all text-left w-full cursor-pointer group"
                      :class="patientUuid === patient.uuid && !assignedAppointment ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm' : 'border-gray-100 hover:border-primary/40 hover:bg-gray-50/80'"
                    >
                      <img
                        :src="patient.avatar_path ? getStorageUrl(patient.avatar_path) : `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.first_name + '+' + patient.last_name)}&background=7B5EF5&color=fff&size=128`"
                        class="h-12 w-12 rounded-xl object-cover shrink-0 border border-gray-100"
                        alt="Patient Avatar"
                      />

                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                          <p class="font-bold text-sm text-gray-900 truncate group-hover:text-primary transition-colors">
                            {{ patient.first_name }} {{ patient.last_name }}
                          </p>
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                            Registered ({{ patient.account_status || 'Active' }})
                          </span>
                        </div>

                        <div class="flex items-center gap-2 text-xs text-gray-500 mt-0.5 truncate">
                          <span v-if="patient.email" class="truncate">{{ patient.email }}</span>
                          <span v-if="patient.email && (patient.gender || patient.age)">•</span>
                          <span v-if="patient.gender || patient.age">
                            {{ [patient.gender, patient.age ? `${patient.age} yrs` : ''].filter(Boolean).join(', ') }}
                          </span>
                        </div>
                      </div>

                      <div
                        v-if="patientUuid === patient.uuid && !assignedAppointment"
                        class="bg-primary text-white h-6 w-6 rounded-full flex items-center justify-center shadow-sm shrink-0"
                      >
                        <Icon name="material-symbols:check-small-rounded" class="text-xl" />
                      </div>
                    </button>
                  </div>
                </div>

                <!-- 3. Register Patient Form View -->
                <div v-else-if="activeModalTab === 'register'" class="flex flex-col gap-4 py-1">
                  <div class="flex items-center justify-between pb-2 border-b border-gray-100">
                    <button
                      type="button"
                      @click="activeModalTab = 'appointments'"
                      class="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-primary transition-colors cursor-pointer"
                    >
                      <Icon name="material-symbols:arrow-back-rounded" class="text-base" />
                      Back to Appointments
                    </button>
                    <span class="text-[11px] font-semibold text-primary/80 bg-primary/5 px-2.5 py-1 rounded-full">
                      Linked to your clinic
                    </span>
                  </div>

                  <div v-if="registrationError" class="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-semibold">
                    <Icon name="material-symbols:error-rounded" class="text-xl text-rose-600 shrink-0" />
                    <p>{{ registrationError }}</p>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label class="block text-xs font-bold text-gray-700 mb-1">First Name <span class="text-rose-500">*</span></label>
                      <input
                        v-model="registerForm.firstName"
                        type="text"
                        placeholder="First Name"
                        required
                        class="w-full h-10 px-3.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-gray-700 mb-1">Last Name <span class="text-rose-500">*</span></label>
                      <input
                        v-model="registerForm.lastName"
                        type="text"
                        placeholder="Last Name"
                        required
                        class="w-full h-10 px-3.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Email Address <span class="text-rose-500">*</span></label>
                    <input
                      v-model="registerForm.email"
                      type="email"
                      placeholder="patient@example.com"
                      required
                      class="w-full h-10 px-3.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <!-- Temporary Password with Auto-Generate and Copy -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="block text-xs font-bold text-gray-700">Temporary Password <span class="text-rose-500">*</span></label>
                      <span class="text-[11px] text-gray-400 font-medium">Auto-generated for easy sharing</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <input
                        v-model="registerForm.password"
                        type="text"
                        required
                        placeholder="Temporary password"
                        class="flex-1 h-10 px-3.5 rounded-xl border border-gray-200 text-xs font-mono font-bold text-primary bg-gray-50/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <button
                        type="button"
                        @click="copyToClipboard(registerForm.password, 'Temporary password')"
                        title="Copy Password"
                        class="h-10 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-primary transition-all flex items-center justify-center gap-1 text-xs font-bold shrink-0 cursor-pointer shadow-sm active:scale-95"
                      >
                        <Icon name="material-symbols:content-copy-outline-rounded" class="text-base" />
                        <span class="hidden sm:inline">Copy</span>
                      </button>
                      <button
                        type="button"
                        @click="registerForm.password = generateTemporaryPassword('Patient')"
                        title="Generate New Password"
                        class="h-10 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-primary transition-all flex items-center justify-center gap-1 text-xs font-bold shrink-0 cursor-pointer shadow-sm active:scale-95"
                      >
                        <Icon name="material-symbols:refresh-rounded" class="text-base" />
                        <span class="hidden sm:inline">Regenerate</span>
                      </button>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label class="block text-xs font-bold text-gray-700 mb-1">Age</label>
                      <input
                        v-model="registerForm.age"
                        type="number"
                        min="0"
                        max="130"
                        placeholder="e.g. 28"
                        class="w-full h-10 px-3.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-gray-700 mb-1">Gender</label>
                      <select
                        v-model="registerForm.gender"
                        class="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all bg-white"
                      >
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label class="block text-xs font-bold text-gray-700 mb-1">City</label>
                      <input
                        v-model="registerForm.city"
                        type="text"
                        placeholder="City"
                        class="w-full h-10 px-3.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-gray-700 mb-1">Province</label>
                      <input
                        v-model="registerForm.province"
                        type="text"
                        placeholder="Province"
                        class="w-full h-10 px-3.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <template #footer>
                  <div v-if="activeModalTab === 'register'" class="flex items-center justify-end gap-2 w-full">
                    <AppButton
                      variant="ghost"
                      @click="activeModalTab = 'appointments'"
                      class="rounded-xl px-5 font-bold text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </AppButton>
                    <AppButton
                      class="rounded-xl px-6 font-bold bg-primary text-white shadow-md hover:bg-primary/90"
                      @click="handleRegisterPatient"
                      :disabled="isSubmittingRegistration"
                    >
                      <Icon v-if="isSubmittingRegistration" name="svg-spinners:ring-resize" class="text-base mr-1.5" />
                      {{ isSubmittingRegistration ? 'Creating Account...' : 'Create & Assign Patient' }}
                    </AppButton>
                  </div>
                  <div v-else class="flex items-center justify-between w-full">
                    <AppButton
                      variant="outline"
                      @click="clearAssignedPatient"
                      class="rounded-xl px-4 font-bold text-xs"
                      v-if="selectedPatientName"
                    >
                      Clear Selection
                    </AppButton>
                    <div v-else></div>
                    <AppButton
                      variant="ghost"
                      @click="isPatientModalOpen = false"
                      class="rounded-xl px-6 font-bold text-gray-500"
                    >
                      Close
                    </AppButton>
                  </div>
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
