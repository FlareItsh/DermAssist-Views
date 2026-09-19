<script setup lang="ts">
  import { userService } from '~/api/user/UserService'
  import { conversationService } from '~/api/conversation/ConversationService'
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  // ─── Composables ─────────────────────────────────────────────────────────────
  const { appointments, completedAppointments, todayAppointments, fetchAppointments } =
    useAppointments()
  const { priorityIds, addToPriority, removeFromPriority, isInPriority } = usePriorityList()
  const { getStorageUrl } = useStorage()
  const { searchQuery } = useSearch()

  // ─── State ───────────────────────────────────────────────────────────────────
  const doctorRegisteredPatients = ref<any[]>([])
  const isLoadingPatients = ref(true)
  const localSearch = ref('')
  const activeTab = ref<'all' | 'priority' | 'registered' | 'recent'>('all')

  // Modals
  const showRegisterModal = ref(false)
  const showScheduleModal = ref(false)
  const selectedPatientForDetail = ref<any | null>(null)

  // Account Management Modals
  const showDisableModal = ref(false)
  const showDeleteModal = ref(false)
  const patientToManage = ref<any | null>(null)
  const isActionLoading = ref(false)

  // Schedule Auto-Action Modal State
  const showScheduleActionModal = ref(false)
  const scheduleActionType = ref<'delete' | 'disable'>('delete')
  const scheduleActionDate = ref('')
  const scheduleActionTime = ref('09:00')
  const scheduleActionError = ref<string | null>(null)

  // ─── Fetch Doctor-Registered Patients ─────────────────────────────────────────
  const fetchRegisteredPatients = async () => {
    try {
      isLoadingPatients.value = true
      const response = await userService.listDoctorPatients({ per_page: 100 })
      doctorRegisteredPatients.value = response.data || []
    } catch (e) {
      console.error('Failed to fetch registered patients:', e)
    } finally {
      isLoadingPatients.value = false
    }
  }

  onMounted(() => {
    fetchRegisteredPatients()
    if (!appointments.value.length) {
      fetchAppointments()
    }
  })

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getTodayStr = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getInitials = (name: string): string => {
    if (!name) return 'PT'
    const cleanName = name.replace(/^Dr\.\s+/i, '').trim()
    const parts = cleanName.split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // ─── Unified Deduplicated Patient List ────────────────────────────────────────
  interface PatientDirectoryItem {
    uuid: string
    id?: number
    name: string
    firstName: string
    lastName: string
    email: string
    age?: number | string
    gender?: string
    location: string
    avatar: string | null
    isRegistered: boolean
    accountStatus: 'active' | 'disabled'
    accountAction?: string | null
    accountActionScheduledAt?: string | null
    totalScans: number
    isPriority: boolean
    appointments: any[]
    latestAppointment: any | null
    lastVisit: string
    latestCondition: string
    conversationUuid?: string
    createdAt?: string
  }

  const unifiedPatients = computed<PatientDirectoryItem[]>(() => {
    const map = new Map<string, PatientDirectoryItem>()

    // 1. Process Doctor-Registered Patients first
    for (const p of doctorRegisteredPatients.value) {
      const key = p.uuid || `reg_${p.id}`
      const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown Patient'
      const address =
        [p.barangay, p.city, p.province].filter(Boolean).join(', ') ||
        p.location ||
        'Cruz Skin Clinic'
      const isPrio = isInPriority(p.uuid) || (p.id ? isInPriority(String(p.id)) : false)

      map.set(key, {
        uuid: p.uuid,
        id: p.id,
        name: fullName,
        firstName: p.first_name || '',
        lastName: p.last_name || '',
        email: p.email || '',
        age: p.age || 'N/A',
        gender: p.gender || 'N/A',
        location: address,
        avatar: p.avatar_path ? getStorageUrl(p.avatar_path) : null,
        isRegistered: true,
        accountStatus: p.account_status || 'active',
        accountAction: p.account_action,
        accountActionScheduledAt: p.account_action_scheduled_at,
        totalScans: p.total_scans || 0,
        isPriority: isPrio,
        appointments: [],
        latestAppointment: null,
        lastVisit: p.created_at ? formatDateTime(p.created_at) : 'Registered',
        latestCondition: 'General Patient Care',
        conversationUuid: undefined,
        createdAt: p.created_at
      })
    }

    // 2. Merge consultation appointments
    for (const appt of appointments.value) {
      const patientObj = (appt as any).raw?.patient || (appt as any).patient
      const patientUuid = (appt as any).patient_uuid || patientObj?.uuid
      const patientId = appt.patient_id || patientObj?.id

      if (!patientUuid && !patientId) continue

      const patientName = patientObj
        ? [patientObj.first_name, patientObj.last_name].filter(Boolean).join(' ')
        : appt.doctor && !appt.doctor.startsWith('Dr.')
          ? appt.doctor
          : 'Patient'

      if (patientName.startsWith('Dr.')) continue

      const key = patientUuid || `id_${patientId}`
      const isPrio =
        (patientUuid && isInPriority(patientUuid)) ||
        (patientId && isInPriority(String(patientId))) ||
        (appt.id && isInPriority(appt.id)) ||
        (appt.uuid && isInPriority(appt.uuid))

      if (map.has(key)) {
        const existing = map.get(key)!
        existing.appointments.push(appt)
        if (appt.conversation_uuid && !existing.conversationUuid) {
          existing.conversationUuid = appt.conversation_uuid
        }
        if (isPrio) existing.isPriority = true
      } else {
        const address = patientObj
          ? [patientObj.barangay, patientObj.city, patientObj.province]
              .filter(Boolean)
              .join(', ') || patientObj.location
          : appt.location || 'Cruz Skin Clinic'

        map.set(key, {
          uuid: patientUuid || `temp_${patientId}`,
          id: patientId,
          name: patientName,
          firstName: patientObj?.first_name || patientName.split(' ')[0] || '',
          lastName: patientObj?.last_name || patientName.split(' ').slice(1).join(' ') || '',
          email: patientObj?.email || '',
          age: patientObj?.age || (appt as any).patient_age || 'N/A',
          gender: patientObj?.gender || (appt as any).patient_gender || 'N/A',
          location: address || 'Cruz Skin Clinic',
          avatar: patientObj?.avatar_path
            ? getStorageUrl(patientObj.avatar_path)
            : appt.diagnosis_image
              ? getStorageUrl(appt.diagnosis_image)
              : null,
          isRegistered: patientObj?.is_doctor_registered || false,
          accountStatus: patientObj?.account_status || 'active',
          accountAction: patientObj?.account_action,
          accountActionScheduledAt: patientObj?.account_action_scheduled_at,
          totalScans: patientObj?.total_scans || 0,
          isPriority: isPrio,
          appointments: [appt],
          latestAppointment: null,
          lastVisit: 'TBD',
          latestCondition: appt.info || 'Consultation',
          conversationUuid: appt.conversation_uuid,
          createdAt: appt.date
        })
      }
    }

    // 3. Normalize latest appointment, visit date, and condition for all patients
    const patientList = Array.from(map.values())
    for (const patient of patientList) {
      if (patient.appointments.length > 0) {
        // Sort appointments newest first
        patient.appointments.sort((a, b) => {
          const timeA = new Date(a.raw_scheduled_at || a.date || 0).getTime()
          const timeB = new Date(b.raw_scheduled_at || b.date || 0).getTime()
          return timeB - timeA
        })
        const latest = patient.appointments[0]
        patient.latestAppointment = latest
        patient.lastVisit = latest.date ? formatDateTime(latest.date) : patient.lastVisit
        if (latest.info && latest.info !== 'General Appointment') {
          patient.latestCondition = latest.info
        }
      }

      // Check priority comprehensively: patient UUID, patient ID, OR any appointment ID / UUID
      if (!patient.isPriority) {
        const hasPrioAppt = patient.appointments.some(
          (a: any) => (a.id && isInPriority(a.id)) || (a.uuid && isInPriority(a.uuid))
        )
        const hasPrioPatient =
          (patient.uuid && isInPriority(patient.uuid)) ||
          (patient.id && isInPriority(String(patient.id)))
        if (hasPrioAppt || hasPrioPatient) {
          patient.isPriority = true
        }
      }
    }

    return patientList
  })

  // ─── Triage Counts ────────────────────────────────────────────────────────────
  const totalPatientsCount = computed(() => unifiedPatients.value.length)
  const priorityPatientsCount = computed(
    () => unifiedPatients.value.filter(p => p.isPriority).length
  )
  const registeredPatientsCount = computed(
    () => unifiedPatients.value.filter(p => p.isRegistered).length
  )
  const recentPatientsCount = computed(() => {
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    return unifiedPatients.value.filter(p => {
      if (!p.latestAppointment) return false
      const apptDate = new Date(p.latestAppointment.raw_scheduled_at || p.latestAppointment.date)
      return apptDate >= fourteenDaysAgo
    }).length
  })

  // ─── Filtered Patients ────────────────────────────────────────────────────────
  const filteredPatients = computed(() => {
    let list = unifiedPatients.value

    // 1. Tab filter
    if (activeTab.value === 'priority') {
      list = list.filter(p => p.isPriority)
    } else if (activeTab.value === 'registered') {
      list = list.filter(p => p.isRegistered)
    } else if (activeTab.value === 'recent') {
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      list = list.filter(p => {
        if (!p.latestAppointment) return false
        const apptDate = new Date(p.latestAppointment.raw_scheduled_at || p.latestAppointment.date)
        return apptDate >= fourteenDaysAgo
      })
    }

    // 2. Search query filter
    const query = (localSearch.value || searchQuery.value || '').trim().toLowerCase()
    if (query) {
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(query) ||
          p.email.toLowerCase().includes(query) ||
          p.latestCondition.toLowerCase().includes(query) ||
          p.location.toLowerCase().includes(query) ||
          String(p.gender).toLowerCase().includes(query)
      )
    }

    // Sort: Priority patients first, then alphabetical
    return [...list].sort((a, b) => {
      if (a.isPriority && !b.isPriority) return -1
      if (!a.isPriority && b.isPriority) return 1
      return a.name.localeCompare(b.name)
    })
  })

  // ─── Pagination ───────────────────────────────────────────────────────────────
  const patientsPerPage = 8
  const currentPage = ref(1)

  const paginatedPatients = computed(() => {
    const start = (currentPage.value - 1) * patientsPerPage
    return filteredPatients.value.slice(start, start + patientsPerPage)
  })

  watch([localSearch, searchQuery, activeTab], () => {
    currentPage.value = 1
  })

  // ─── Priority Toggle ──────────────────────────────────────────────────────────
  const togglePriority = (patient: PatientDirectoryItem) => {
    const key = patient.uuid || (patient.id ? String(patient.id) : '')
    if (!key) return

    if (patient.isPriority) {
      if (patient.uuid) removeFromPriority(patient.uuid)
      if (patient.id) removeFromPriority(String(patient.id))
      patient.appointments.forEach((a: any) => {
        if (a.id) removeFromPriority(a.id)
        if (a.uuid) removeFromPriority(a.uuid)
      })
      patient.isPriority = false
      toast.info(`Removed ${patient.name} from Priority List.`)
    } else {
      addToPriority(key)
      if (patient.uuid && key !== patient.uuid) addToPriority(patient.uuid)
      if (patient.id) addToPriority(String(patient.id))
      patient.appointments.forEach((a: any) => {
        if (a.id) addToPriority(a.id)
        if (a.uuid) addToPriority(a.uuid)
      })
      patient.isPriority = true
      toast.success(`Marked ${patient.name} as High Priority.`)
    }
  }

  // ─── Clinical Navigation Actions ──────────────────────────────────────────────
  const openPatientDetail = (patient: PatientDirectoryItem) => {
    selectedPatientForDetail.value = patient
  }

  const openPatientChat = async (patient: PatientDirectoryItem) => {
    if (patient.conversationUuid) {
      navigateTo(`/Doctor/Messages/${patient.conversationUuid}`)
      return
    }
    if (patient.id) {
      try {
        const res = await conversationService.create({ patient_id: patient.id })
        const convUuid = res?.data?.uuid || res?.uuid
        if (convUuid) {
          navigateTo(`/Doctor/Messages/${convUuid}`)
          return
        }
      } catch (e) {
        console.error('Could not auto-start conversation:', e)
      }
    }
    navigateTo('/Doctor/Messages')
  }

  const goToConsultation = (apptId: string) => {
    if (apptId) navigateTo(`/Doctor/Appointments/${apptId}`)
  }

  // ─── Registered Patient Account Management ────────────────────────────────────
  const promptDisable = (patient: PatientDirectoryItem) => {
    patientToManage.value = patient
    showDisableModal.value = true
  }

  const confirmDisable = async () => {
    if (!patientToManage.value) return
    isActionLoading.value = true
    try {
      await userService.disablePatient(patientToManage.value.uuid)
      toast.success('Patient account deactivated.')
      showDisableModal.value = false
      await fetchRegisteredPatients()
      if (selectedPatientForDetail.value?.uuid === patientToManage.value.uuid) {
        selectedPatientForDetail.value.accountStatus = 'disabled'
      }
      patientToManage.value = null
    } catch (e) {
      console.error(e)
      toast.error('Failed to deactivate patient account.')
    } finally {
      isActionLoading.value = false
    }
  }

  const handleEnable = async (patient: PatientDirectoryItem) => {
    isActionLoading.value = true
    try {
      await userService.enablePatient(patient.uuid)
      toast.success('Patient account activated.')
      await fetchRegisteredPatients()
      if (selectedPatientForDetail.value?.uuid === patient.uuid) {
        selectedPatientForDetail.value.accountStatus = 'active'
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to activate patient account.')
    } finally {
      isActionLoading.value = false
    }
  }

  const promptDelete = (patient: PatientDirectoryItem) => {
    patientToManage.value = patient
    showDeleteModal.value = true
  }

  const confirmDelete = async () => {
    if (!patientToManage.value) return
    isActionLoading.value = true
    try {
      await userService.deleteDoctorPatient(patientToManage.value.uuid)
      toast.success('Patient account deleted.')
      showDeleteModal.value = false
      if (selectedPatientForDetail.value?.uuid === patientToManage.value.uuid) {
        selectedPatientForDetail.value = null
      }
      patientToManage.value = null
      await fetchRegisteredPatients()
    } catch (e) {
      console.error(e)
      toast.error('Failed to delete patient account.')
    } finally {
      isActionLoading.value = false
    }
  }

  // Schedule auto-action
  const promptScheduleAction = (patient: PatientDirectoryItem) => {
    patientToManage.value = patient
    scheduleActionDate.value = getTodayStr()
    scheduleActionTime.value = '09:00'
    scheduleActionType.value = 'delete'
    scheduleActionError.value = null
    showScheduleActionModal.value = true
  }

  const confirmScheduleAction = async () => {
    if (!patientToManage.value || !scheduleActionDate.value) {
      scheduleActionError.value = 'Please select a valid date.'
      return
    }

    const selectedDateTime = new Date(`${scheduleActionDate.value}T${scheduleActionTime.value}:00`)
    if (selectedDateTime <= new Date()) {
      scheduleActionError.value = 'Scheduled date & time must be in the future.'
      return
    }

    scheduleActionError.value = null
    isActionLoading.value = true
    try {
      const dateTimeStr = `${scheduleActionDate.value} ${scheduleActionTime.value}:00`
      await userService.scheduleAccountAction(patientToManage.value.uuid, {
        action: scheduleActionType.value,
        scheduled_at: dateTimeStr
      })
      toast.success('Auto-action scheduled successfully.')
      showScheduleActionModal.value = false
      await fetchRegisteredPatients()
    } catch (e: any) {
      console.error('Failed to schedule action:', e)
      const err =
        e?.data?.message || e?.response?._data?.message || 'Failed to schedule auto-action.'
      scheduleActionError.value = err
      toast.error(err)
    } finally {
      isActionLoading.value = false
    }
  }

  const handleCancelScheduledAction = async (patient: PatientDirectoryItem) => {
    isActionLoading.value = true
    try {
      await userService.cancelScheduledAction(patient.uuid)
      toast.success('Scheduled auto-action canceled.')
      await fetchRegisteredPatients()
    } catch (e) {
      console.error(e)
      toast.error('Failed to cancel scheduled action.')
    } finally {
      isActionLoading.value = false
    }
  }

  // ─── Register Patient Form State ──────────────────────────────────────────────
  const isRegistering = ref(false)
  const registerFormError = ref<string | null>(null)
  const registerForm = reactive({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: '',
    age: '',
    gender: 'Female',
    street: '',
    barangay: '',
    city: '',
    province: ''
  })

  const resetRegisterForm = () => {
    registerForm.firstName = ''
    registerForm.middleName = ''
    registerForm.lastName = ''
    registerForm.email = ''
    registerForm.password = ''
    registerForm.age = ''
    registerForm.gender = 'Female'
    registerForm.street = ''
    registerForm.barangay = ''
    registerForm.city = ''
    registerForm.province = ''
    registerFormError.value = null
  }

  const handleRegisterPatient = async () => {
    if (
      !registerForm.firstName.trim() ||
      !registerForm.lastName.trim() ||
      !registerForm.email.trim() ||
      !registerForm.password
    ) {
      registerFormError.value = 'First Name, Last Name, Email, and Password are required.'
      return
    }

    isRegistering.value = true
    registerFormError.value = null

    try {
      await userService.createDoctorPatient({
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

      toast.success('Patient registered successfully.')
      showRegisterModal.value = false
      resetRegisterForm()
      await fetchRegisteredPatients()
    } catch (e: any) {
      console.error('Registration failed:', e)
      const err = e?.data?.message || e?.response?._data?.message || 'Failed to register patient.'
      registerFormError.value = err
      toast.error(err)
    } finally {
      isRegistering.value = false
    }
  }

  // ─── Available Times for Action Scheduler ─────────────────────────────────────
  const availableTimeOptions = [
    { value: '08:00', label: '08:00 AM' },
    { value: '09:00', label: '09:00 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '11:00', label: '11:00 AM' },
    { value: '12:00', label: '12:00 PM' },
    { value: '13:00', label: '01:00 PM' },
    { value: '14:00', label: '02:00 PM' },
    { value: '15:00', label: '03:00 PM' },
    { value: '16:00', label: '04:00 PM' },
    { value: '17:00', label: '05:00 PM' },
    { value: '18:00', label: '06:00 PM' },
    { value: '23:59', label: '11:59 PM' }
  ]
</script>

<template>
  <div class="flex h-full flex-col gap-5 overflow-hidden p-4 sm:p-6">
    <!-- Header & Quick Actions -->
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">Patients</h1>
        <p class="text-xs text-gray-500 sm:text-sm">
          Comprehensive patient directory, clinical consultation history, and clinic registration.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <AppButton
          variant="solid"
          rounded="both"
          @click="showRegisterModal = true"
          class="inline-flex cursor-pointer items-center justify-center gap-2 bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
        >
          <Icon
            name="lucide:user-plus"
            class="text-base"
          />
          Register Patient
        </AppButton>

        <AppButton
          variant="outline"
          rounded="both"
          @click="showScheduleModal = true"
          class="inline-flex cursor-pointer items-center justify-center gap-2 border-indigo-200 bg-indigo-50/50 px-4 py-2 text-xs font-bold text-indigo-700 shadow-xs transition hover:bg-indigo-100/70 active:scale-95"
        >
          <Icon
            name="lucide:calendar-plus"
            class="text-base"
          />
          New Appointment
        </AppButton>
      </div>
    </div>

    <!-- Clinical Triage KPI Cards -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <!-- Card 1: Total Patients -->
      <button
        type="button"
        @click="activeTab = 'all'"
        class="group flex cursor-pointer flex-col rounded-2xl border p-4 text-left transition-all hover:shadow-md"
        :class="
          activeTab === 'all'
            ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20'
            : 'border-gray-200/80 bg-white hover:border-gray-300'
        "
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold tracking-wider text-gray-500 uppercase">Directory</span>
          <div
            class="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white"
          >
            <Icon
              name="lucide:users"
              class="text-lg"
            />
          </div>
        </div>
        <div class="mt-2 text-2xl font-black text-gray-900">{{ totalPatientsCount }}</div>
        <div class="mt-0.5 text-[11px] font-medium text-gray-500">All unique patients</div>
      </button>

      <!-- Card 2: Priority Attention -->
      <button
        type="button"
        @click="activeTab = 'priority'"
        class="group flex cursor-pointer flex-col rounded-2xl border p-4 text-left transition-all hover:shadow-md"
        :class="
          activeTab === 'priority'
            ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
            : 'border-gray-200/80 bg-white hover:border-gray-300'
        "
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold tracking-wider text-gray-500 uppercase">Priority</span>
          <div
            class="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 transition-colors group-hover:bg-amber-500 group-hover:text-white"
          >
            <Icon
              name="lucide:star"
              class="text-lg"
            />
          </div>
        </div>
        <div class="mt-2 flex items-baseline gap-2">
          <span class="text-2xl font-black text-gray-900">{{ priorityPatientsCount }}</span>
          <span
            v-if="priorityPatientsCount > 0"
            class="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
          >
            High Focus
          </span>
        </div>
        <div class="mt-0.5 text-[11px] font-medium text-gray-500">Priority triage cases</div>
      </button>

      <!-- Card 3: Clinic Registered Patients -->
      <button
        type="button"
        @click="activeTab = 'registered'"
        class="group flex cursor-pointer flex-col rounded-2xl border p-4 text-left transition-all hover:shadow-md"
        :class="
          activeTab === 'registered'
            ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
            : 'border-gray-200/80 bg-white hover:border-gray-300'
        "
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold tracking-wider text-gray-500 uppercase">Registered</span>
          <div
            class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white"
          >
            <Icon
              name="lucide:building-2"
              class="text-lg"
            />
          </div>
        </div>
        <div class="mt-2 text-2xl font-black text-gray-900">{{ registeredPatientsCount }}</div>
        <div class="mt-0.5 text-[11px] font-medium text-gray-500">Clinic-managed accounts</div>
      </button>

      <!-- Card 4: Recent Consultations -->
      <button
        type="button"
        @click="activeTab = 'recent'"
        class="group flex cursor-pointer flex-col rounded-2xl border p-4 text-left transition-all hover:shadow-md"
        :class="
          activeTab === 'recent'
            ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
            : 'border-gray-200/80 bg-white hover:border-gray-300'
        "
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold tracking-wider text-gray-500 uppercase">Recent</span>
          <div
            class="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white"
          >
            <Icon
              name="lucide:calendar-check"
              class="text-lg"
            />
          </div>
        </div>
        <div class="mt-2 text-2xl font-black text-gray-900">{{ recentPatientsCount }}</div>
        <div class="mt-0.5 text-[11px] font-medium text-gray-500">Seen in last 14 days</div>
      </button>
    </div>

    <!-- Controls Bar: Segmented Tabs & Search Input -->
    <div
      class="flex flex-col justify-between gap-3 border-b border-gray-200/70 pb-3 md:flex-row md:items-center"
    >
      <!-- Tabs Navigation -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          @click="activeTab = 'all'"
          class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
          :class="
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          "
        >
          All Patients
          <span
            class="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black"
            :class="
              activeTab === 'all' ? 'bg-white text-indigo-600' : 'bg-indigo-100 text-indigo-700'
            "
          >
            {{ totalPatientsCount }}
          </span>
        </button>

        <button
          type="button"
          @click="activeTab = 'priority'"
          class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
          :class="
            activeTab === 'priority'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          "
        >
          Priority List
          <span
            v-if="priorityPatientsCount > 0"
            class="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black"
            :class="
              activeTab === 'priority' ? 'bg-white text-amber-700' : 'bg-amber-500 text-white'
            "
          >
            {{ priorityPatientsCount }}
          </span>
        </button>

        <button
          type="button"
          @click="activeTab = 'registered'"
          class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
          :class="
            activeTab === 'registered'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          "
        >
          Clinic Registered
          <span
            v-if="registeredPatientsCount > 0"
            class="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black"
            :class="
              activeTab === 'registered'
                ? 'bg-white text-indigo-600'
                : 'bg-indigo-100 text-indigo-700'
            "
          >
            {{ registeredPatientsCount }}
          </span>
        </button>

        <button
          type="button"
          @click="activeTab = 'recent'"
          class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
          :class="
            activeTab === 'recent'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          "
        >
          Recent Consultations
        </button>
      </div>

      <!-- Search Input & Count -->
      <div class="flex items-center gap-3">
        <div class="relative w-full sm:w-64">
          <Icon
            name="lucide:search"
            class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            v-model="localSearch"
            placeholder="Search patient, condition, city..."
            class="h-9 w-full rounded-xl border border-gray-200 bg-white pr-3 pl-9 text-xs font-medium text-gray-800 placeholder-gray-400 shadow-2xs transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            v-if="localSearch"
            type="button"
            @click="localSearch = ''"
            class="absolute top-1/2 right-2.5 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <Icon
              name="lucide:x"
              class="h-3.5 w-3.5"
            />
          </button>
        </div>

        <div class="hidden shrink-0 text-xs font-semibold text-gray-500 sm:block">
          Showing <span class="font-bold text-gray-800">{{ filteredPatients.length }}</span>
          {{ filteredPatients.length === 1 ? 'patient' : 'patients' }}
        </div>
      </div>
    </div>

    <!-- Patients Directory Container -->
    <div class="custom-scrollbar flex-1 overflow-y-auto pr-1">
      <!-- Loading Skeleton State -->
      <div
        v-if="isLoadingPatients"
        class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <div
          v-for="n in 8"
          :key="n"
          class="h-56 w-full animate-pulse rounded-3xl border border-gray-200/70 bg-gray-50/80 p-5 shadow-xs"
        />
      </div>

      <!-- Empty State -->
      <div
        v-else-if="filteredPatients.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
          <Icon
            name="lucide:users-round"
            class="text-3xl text-gray-400"
          />
        </div>
        <h3 class="text-base font-bold text-gray-800">No patients found</h3>
        <p class="mt-1 max-w-sm text-xs text-gray-500">
          <template v-if="localSearch">
            No patient records match "{{ localSearch }}". Try checking the spelling or clearing
            search.
          </template>
          <template v-else-if="activeTab === 'priority'">
            There are currently no patients flagged on your High Priority triage list.
          </template>
          <template v-else-if="activeTab === 'registered'">
            No clinic patients registered yet. Register a patient account directly using the button
            above.
          </template>
          <template v-else> No patient records found in your clinical directory. </template>
        </p>

        <div class="mt-4 flex gap-2">
          <button
            v-if="localSearch"
            type="button"
            @click="localSearch = ''"
            class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50"
          >
            Clear Search
          </button>
          <button
            type="button"
            @click="showRegisterModal = true"
            class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100"
          >
            <Icon
              name="lucide:user-plus"
              class="text-sm"
            />
            Register Patient
          </button>
        </div>
      </div>

      <!-- Patients Grid -->
      <div
        v-else
        class="space-y-4"
      >
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <div
            v-for="patient in paginatedPatients"
            :key="patient.uuid || patient.id"
            class="group relative flex flex-col justify-between rounded-3xl border border-gray-200/80 bg-white p-5 shadow-xs transition-all hover:border-indigo-300 hover:shadow-md"
          >
            <!-- Card Top Header -->
            <div>
              <div class="flex items-start justify-between gap-3">
                <!-- Avatar & Identity -->
                <div class="flex min-w-0 items-center gap-3">
                  <div class="relative shrink-0">
                    <div
                      v-if="patient.avatar"
                      class="h-13 w-13 overflow-hidden rounded-2xl border-2 border-indigo-100 bg-gray-50 shadow-2xs"
                    >
                      <NuxtImg
                        :src="patient.avatar"
                        :alt="patient.name"
                        class="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div
                      v-else
                      class="flex h-13 w-13 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-indigo-50 text-sm font-bold text-indigo-700 shadow-2xs"
                    >
                      {{ getInitials(patient.name) }}
                    </div>

                    <!-- Priority Dot -->
                    <div
                      v-if="patient.isPriority"
                      class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 ring-2 ring-white"
                      title="High Priority"
                    >
                      <Icon
                        name="lucide:star"
                        class="h-2.5 w-2.5 fill-white text-white"
                      />
                    </div>
                  </div>

                  <div class="min-w-0 flex-1">
                    <h3
                      class="truncate text-base font-bold text-gray-900 transition-colors group-hover:text-indigo-600"
                    >
                      {{ patient.name }}
                    </h3>
                    <p class="mt-0.5 text-xs font-semibold text-gray-500">
                      {{ patient.age !== 'N/A' ? `${patient.age} yrs` : 'Age N/A' }}
                      <span class="mx-1 text-gray-300">•</span>
                      {{ patient.gender !== 'N/A' ? patient.gender : 'Gender N/A' }}
                    </p>
                  </div>
                </div>

                <!-- Priority Toggle Star -->
                <button
                  type="button"
                  @click.stop="togglePriority(patient)"
                  class="shrink-0 cursor-pointer rounded-xl p-1.5 transition hover:bg-gray-100 active:scale-95"
                  :title="patient.isPriority ? 'Remove from Priority' : 'Mark as Priority'"
                >
                  <Icon
                    name="lucide:star"
                    class="h-5 w-5 transition-colors"
                    :class="
                      patient.isPriority
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-gray-300 hover:text-amber-400'
                    "
                  />
                </button>
              </div>

              <!-- Tags / Status Pills Row -->
              <div class="mt-3.5 flex flex-wrap items-center gap-1.5">
                <!-- Registration Type -->
                <span
                  v-if="patient.isRegistered"
                  class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700"
                >
                  <Icon
                    name="lucide:building-2"
                    class="text-xs"
                  />
                  Clinic Registered
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600"
                >
                  <Icon
                    name="lucide:calendar"
                    class="text-xs"
                  />
                  Consultation Patient
                </span>

                <!-- Account Status (Registered) -->
                <span
                  v-if="patient.isRegistered"
                  class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold"
                  :class="
                    patient.accountStatus === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  "
                >
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="patient.accountStatus === 'active' ? 'bg-emerald-500' : 'bg-rose-500'"
                  />
                  {{ patient.accountStatus === 'active' ? 'Active' : 'Disabled' }}
                </span>

                <!-- Priority Pill -->
                <span
                  v-if="patient.isPriority"
                  class="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800"
                >
                  <Icon
                    name="lucide:star"
                    class="fill-amber-500 text-xs text-amber-500"
                  />
                  High Priority
                </span>
              </div>

              <!-- Scheduled Auto-Action Warning Banner -->
              <div
                v-if="patient.accountAction"
                class="mt-3 flex items-center justify-between gap-2 rounded-xl border border-orange-200 bg-orange-50 p-2.5 text-xs text-orange-800"
              >
                <div class="flex items-center gap-1.5 truncate">
                  <Icon
                    name="lucide:clock-alert"
                    class="h-4 w-4 shrink-0 text-orange-600"
                  />
                  <span class="truncate text-[11px] font-bold">
                    Auto-{{ patient.accountAction }} on
                    {{ formatDateTime(patient.accountActionScheduledAt || undefined) }}
                  </span>
                </div>
                <button
                  type="button"
                  @click.stop="handleCancelScheduledAction(patient)"
                  class="cursor-pointer rounded-lg bg-orange-200/70 px-2 py-0.5 text-[10px] font-extrabold text-orange-900 transition hover:bg-orange-300"
                >
                  Cancel
                </button>
              </div>

              <!-- Clinical Summary Meta -->
              <div
                class="mt-3.5 space-y-1.5 rounded-2xl border border-gray-100 bg-gray-50/70 p-3 text-xs"
              >
                <!-- Condition / Concern -->
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium text-gray-400">Concern:</span>
                  <span class="truncate text-right font-bold text-gray-800">
                    {{ patient.latestCondition }}
                  </span>
                </div>

                <!-- Last Consultation -->
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium text-gray-400">Last Visit:</span>
                  <span class="font-semibold text-gray-700">
                    {{ patient.lastVisit }}
                  </span>
                </div>

                <!-- Location / Branch -->
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium text-gray-400">Location:</span>
                  <span class="truncate text-right font-semibold text-gray-600">
                    {{ patient.location }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Card Bottom Action Toolbar -->
            <div
              class="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3.5"
            >
              <!-- Profile / Case Review -->
              <button
                type="button"
                @click="openPatientDetail(patient)"
                class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-2xs transition hover:bg-indigo-100 active:scale-95"
              >
                <Icon
                  name="lucide:file-text"
                  class="text-sm"
                />
                Clinical Profile
              </button>

              <!-- Secondary Action Buttons -->
              <div class="flex items-center gap-1">
                <!-- Message Patient -->
                <button
                  type="button"
                  @click="openPatientChat(patient)"
                  class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-2xs transition hover:bg-gray-50 hover:text-gray-900 active:scale-95"
                  title="Message Patient"
                >
                  <Icon
                    name="lucide:message-square"
                    class="text-sm"
                  />
                </button>

                <!-- Book Follow-up -->
                <button
                  type="button"
                  @click="showScheduleModal = true"
                  class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-2xs transition hover:bg-gray-50 hover:text-gray-900 active:scale-95"
                  title="Schedule Appointment"
                >
                  <Icon
                    name="lucide:calendar-plus"
                    class="text-sm"
                  />
                </button>

                <!-- Registered Account Options Menu Button -->
                <button
                  v-if="patient.isRegistered"
                  type="button"
                  @click="openPatientDetail(patient)"
                  class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-2xs transition hover:bg-gray-50 hover:text-gray-900 active:scale-95"
                  title="Manage Account"
                >
                  <Icon
                    name="lucide:settings-2"
                    class="text-sm"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Pagination -->
        <div class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
          <AppPagination
            v-model:currentPage="currentPage"
            :total-items="filteredPatients.length"
            :per-page="patientsPerPage"
            item-label="patients"
          />
        </div>
      </div>
    </div>

    <!-- ───────────────────────────────────────────────────────────────────────── -->
    <!-- MODALS & DIALOGS                                                          -->
    <!-- ───────────────────────────────────────────────────────────────────────── -->

    <!-- 1. Patient Clinical Details Slideover / Modal -->
    <AppModal
      :model-value="!!selectedPatientForDetail"
      size="2xl"
      @close="selectedPatientForDetail = null"
    >
      <div
        v-if="selectedPatientForDetail"
        class="space-y-6"
      >
        <!-- Patient Banner -->
        <div
          class="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex items-center gap-4">
            <div
              v-if="selectedPatientForDetail.avatar"
              class="h-16 w-16 overflow-hidden rounded-2xl border-2 border-indigo-100 bg-gray-50 shadow-sm"
            >
              <NuxtImg
                :src="selectedPatientForDetail.avatar"
                :alt="selectedPatientForDetail.name"
                class="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div
              v-else
              class="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-indigo-50 text-xl font-black text-indigo-700 shadow-sm"
            >
              {{ getInitials(selectedPatientForDetail.name) }}
            </div>

            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-xl font-black text-gray-900">
                  {{ selectedPatientForDetail.name }}
                </h2>
                <button
                  type="button"
                  @click="togglePriority(selectedPatientForDetail)"
                  class="rounded-lg p-1 transition hover:bg-gray-100"
                  :title="selectedPatientForDetail.isPriority ? 'Remove Priority' : 'Mark Priority'"
                >
                  <Icon
                    name="lucide:star"
                    class="h-5 w-5"
                    :class="
                      selectedPatientForDetail.isPriority
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-gray-300'
                    "
                  />
                </button>
              </div>
              <p class="text-xs font-semibold text-gray-500">
                {{
                  selectedPatientForDetail.age !== 'N/A'
                    ? `${selectedPatientForDetail.age} years old`
                    : 'Age N/A'
                }}
                <span class="mx-1">•</span>
                {{ selectedPatientForDetail.gender }}
                <span class="mx-1">•</span>
                {{ selectedPatientForDetail.email || 'No email provided' }}
              </p>
              <p class="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                <Icon
                  name="lucide:map-pin"
                  class="text-xs text-indigo-500"
                />
                {{ selectedPatientForDetail.location }}
              </p>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div class="flex flex-wrap items-center gap-2">
            <AppButton
              variant="solid"
              size="sm"
              @click="openPatientChat(selectedPatientForDetail)"
              class="inline-flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <Icon
                name="lucide:message-square"
                class="text-sm"
              />
              Message
            </AppButton>
            <AppButton
              variant="outline"
              size="sm"
              @click="showScheduleModal = true"
              class="inline-flex items-center gap-1.5 border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <Icon
                name="lucide:calendar-plus"
                class="text-sm"
              />
              Book Appointment
            </AppButton>
          </div>
        </div>

        <!-- Clinical Stats Grid -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 text-center">
            <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >Consultations</span
            >
            <div class="mt-1 text-xl font-black text-gray-900">
              {{ selectedPatientForDetail.appointments.length }}
            </div>
          </div>
          <div class="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 text-center">
            <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >Account Type</span
            >
            <div
              class="mt-1 text-xs font-black"
              :class="selectedPatientForDetail.isRegistered ? 'text-indigo-600' : 'text-gray-700'"
            >
              {{ selectedPatientForDetail.isRegistered ? 'Clinic Account' : 'Platform User' }}
            </div>
          </div>
          <div class="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 text-center">
            <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >Account Status</span
            >
            <div
              class="mt-1 text-xs font-black capitalize"
              :class="
                selectedPatientForDetail.accountStatus === 'active'
                  ? 'text-emerald-600'
                  : 'text-rose-600'
              "
            >
              {{ selectedPatientForDetail.accountStatus }}
            </div>
          </div>
          <div class="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 text-center">
            <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >Priority Triage</span
            >
            <div
              class="mt-1 text-xs font-black"
              :class="selectedPatientForDetail.isPriority ? 'text-amber-600' : 'text-gray-500'"
            >
              {{ selectedPatientForDetail.isPriority ? 'High Attention' : 'Standard' }}
            </div>
          </div>
        </div>

        <!-- Consultation History Timeline -->
        <div>
          <h3 class="text-sm font-bold tracking-wider text-gray-900 uppercase">
            Consultation History & Care Notes
          </h3>
          <p class="mb-3 text-xs text-gray-500">
            Records of clinical appointments and medical consultations with this patient.
          </p>

          <div
            v-if="selectedPatientForDetail.appointments.length === 0"
            class="rounded-2xl border border-gray-200/80 bg-gray-50/50 p-6 text-center text-xs text-gray-500"
          >
            No scheduled or past consultations recorded yet for this patient.
          </div>

          <div
            v-else
            class="custom-scrollbar max-h-64 space-y-2.5 overflow-y-auto pr-1"
          >
            <div
              v-for="appt in selectedPatientForDetail.appointments"
              :key="appt.id"
              class="flex flex-col justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-3.5 shadow-2xs transition hover:border-gray-300 sm:flex-row sm:items-center"
            >
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-gray-900">
                    {{ appt.date ? formatDateTime(appt.date) : 'Upcoming' }}
                  </span>
                  <span class="text-xs text-gray-400">•</span>
                  <span class="text-xs font-semibold text-indigo-700">
                    {{ appt.time || 'TBD' }}
                  </span>
                  <span
                    class="rounded-md px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider uppercase"
                    :class="
                      appt.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700'
                        : appt.status === 'scheduled'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-amber-50 text-amber-700'
                    "
                  >
                    {{ appt.status }}
                  </span>
                </div>
                <p class="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600">
                  <Icon
                    name="lucide:stethoscope"
                    class="text-xs"
                  />
                  {{ appt.info || 'Consultation' }}
                </p>
                <p class="text-[11px] text-gray-500">
                  Branch: {{ appt.clinic_name || appt.location || 'Cruz Skin Clinic' }}
                </p>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="goToConsultation(appt.id)"
                  class="rounded-xl bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                >
                  {{ appt.status === 'completed' ? 'View Note' : 'Open Consultation' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Account Controls (Clinic-Registered Patients Only) -->
        <div
          v-if="selectedPatientForDetail.isRegistered"
          class="space-y-3 rounded-2xl border border-gray-200/80 bg-gray-50/50 p-4"
        >
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-xs font-bold text-gray-900 uppercase">Clinic Account Controls</h4>
              <p class="text-[11px] text-gray-500">
                Manage login privileges, schedule auto-deletion, or delete this patient record.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 pt-1">
            <AppButton
              v-if="selectedPatientForDetail.accountStatus === 'disabled'"
              size="sm"
              variant="solid"
              class="rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
              :disabled="isActionLoading"
              @click="handleEnable(selectedPatientForDetail)"
            >
              Activate Account
            </AppButton>
            <AppButton
              v-else
              size="sm"
              variant="outline"
              class="rounded-xl border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100"
              :disabled="isActionLoading"
              @click="promptDisable(selectedPatientForDetail)"
            >
              Deactivate Account
            </AppButton>

            <AppButton
              size="sm"
              variant="outline"
              class="rounded-xl border-orange-200 text-xs font-bold text-orange-700 hover:bg-orange-50"
              :disabled="isActionLoading"
              @click="promptScheduleAction(selectedPatientForDetail)"
            >
              <Icon
                name="lucide:calendar-clock"
                class="mr-1 text-sm"
              />
              Schedule Auto-Deletion
            </AppButton>

            <AppButton
              size="sm"
              variant="outline"
              class="ml-auto rounded-xl border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50"
              :disabled="isActionLoading"
              @click="promptDelete(selectedPatientForDetail)"
            >
              <Icon
                name="lucide:trash-2"
                class="mr-1 text-sm"
              />
              Delete Account
            </AppButton>
          </div>
        </div>
      </div>
    </AppModal>

    <!-- 2. Register New Patient Modal -->
    <AppModal
      v-model="showRegisterModal"
      title="Register Clinic Patient"
      description="Create a dedicated portal account for a clinic patient. They can view prescriptions, join consultations, and receive messages."
      size="xl"
      @close="resetRegisterForm"
    >
      <form
        @submit.prevent="handleRegisterPatient"
        class="space-y-4"
      >
        <!-- Error Banner -->
        <div
          v-if="registerFormError"
          class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800"
        >
          {{ registerFormError }}
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label class="block text-xs font-bold text-gray-700">First Name *</label>
            <input
              type="text"
              v-model="registerForm.firstName"
              required
              placeholder="e.g. Maria"
              class="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700">Middle Name</label>
            <input
              type="text"
              v-model="registerForm.middleName"
              placeholder="e.g. Santos"
              class="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700">Last Name *</label>
            <input
              type="text"
              v-model="registerForm.lastName"
              required
              placeholder="e.g. Dela Cruz"
              class="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-bold text-gray-700">Email Address *</label>
            <input
              type="email"
              v-model="registerForm.email"
              required
              placeholder="patient@example.com"
              class="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700">Temporary Password *</label>
            <input
              type="password"
              v-model="registerForm.password"
              required
              placeholder="Min. 8 characters"
              class="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-bold text-gray-700">Age</label>
            <input
              type="number"
              v-model="registerForm.age"
              min="0"
              max="130"
              placeholder="e.g. 28"
              class="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700">Gender</label>
            <select
              v-model="registerForm.gender"
              class="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other / Prefer not to say</option>
            </select>
          </div>
        </div>

        <!-- Address fields -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-bold text-gray-700">City / Municipality</label>
            <input
              type="text"
              v-model="registerForm.city"
              placeholder="e.g. Quezon City"
              class="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700">Province</label>
            <input
              type="text"
              v-model="registerForm.province"
              placeholder="e.g. Metro Manila"
              class="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <AppButton
            type="button"
            variant="outline"
            size="sm"
            class="rounded-xl"
            @click="showRegisterModal = false"
          >
            Cancel
          </AppButton>
          <AppButton
            type="submit"
            variant="solid"
            size="sm"
            class="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            :loading="isRegistering"
          >
            Register Patient
          </AppButton>
        </div>
      </form>
    </AppModal>

    <!-- 3. Schedule Auto-Action Modal -->
    <AppModal
      v-model="showScheduleActionModal"
      title="Schedule Automatic Account Action"
      description="Select an automated lifecycle action (such as account deletion) to occur at a future date and time."
      size="md"
    >
      <div class="space-y-4">
        <div
          v-if="scheduleActionError"
          class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800"
        >
          {{ scheduleActionError }}
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-700">Action Type</label>
          <select
            v-model="scheduleActionType"
            class="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-800 outline-none focus:border-indigo-500"
          >
            <option value="delete">Delete Account Permanently</option>
            <option value="disable">Deactivate Account Privileges</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-gray-700">Execution Date</label>
            <input
              type="date"
              v-model="scheduleActionDate"
              :min="getTodayStr()"
              class="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-800 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700">Execution Time</label>
            <select
              v-model="scheduleActionTime"
              class="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-800 outline-none focus:border-indigo-500"
            >
              <option
                v-for="opt in availableTimeOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-3">
          <AppButton
            variant="outline"
            size="sm"
            class="rounded-xl"
            @click="showScheduleActionModal = false"
          >
            Cancel
          </AppButton>
          <AppButton
            variant="solid"
            size="sm"
            class="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            :loading="isActionLoading"
            @click="confirmScheduleAction"
          >
            Confirm Schedule
          </AppButton>
        </div>
      </div>
    </AppModal>

    <!-- 4. Deactivate Account Confirmation Modal -->
    <AppModalConfirmation
      v-model="showDisableModal"
      title="Deactivate Patient Account?"
      :description="`Are you sure you want to deactivate ${patientToManage?.name}'s account? They will be logged out and cannot log in until reactivated.`"
      confirm-text="Yes, Deactivate"
      cancel-text="Keep Active"
      confirm-variant="destructive"
      icon="lucide:ban"
      icon-color="warning"
      :loading="isActionLoading"
      @confirm="confirmDisable"
      @cancel="showDisableModal = false"
    />

    <!-- 5. Delete Account Confirmation Modal -->
    <AppModalConfirmation
      v-model="showDeleteModal"
      title="Delete Patient Account Permanently?"
      :description="`Are you sure you want to permanently delete ${patientToManage?.name}'s account? This action cannot be undone.`"
      confirm-text="Yes, Delete Permanently"
      cancel-text="Cancel"
      confirm-variant="destructive"
      icon="lucide:trash-2"
      icon-color="danger"
      :loading="isActionLoading"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />

    <!-- 6. Schedule New Appointment Modal -->
    <AppModalDoctorScheduleNewModal
      v-if="showScheduleModal"
      @close="showScheduleModal = false"
      @scheduled="
        () => {
          fetchAppointments()
          fetchRegisteredPatients()
        }
      "
    />
  </div>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.08);
    border-radius: 9999px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.15);
  }
</style>
