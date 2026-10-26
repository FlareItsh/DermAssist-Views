<script setup lang="ts">
  import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'
  import {
    doctorSubscriptionService,
    type DoctorSubscription,
    type DoctorPlan
  } from '~/api/subscription/DoctorSubscriptionService'
  import { userService } from '~/api/user/UserService'
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  // Doctors might have verification data
  const { data: response, refresh } = userService.useShow(useCookie('user_uuid').value as string, {
    key: `userProfile-${useCookie('user_uuid').value}`
  })
  // Laravel JsonResource wraps single resources under `data` — unwrap at source
  const user = computed(() => (response.value as any)?.data ?? response.value)

  const { getStorageUrl } = useStorage()
  const { missingDoctorFields, refreshProfile } = useAppNotifications()

  const form = reactive({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    contact_number: '',
    street: '',
    barangay: '',
    city: '',
    province: '',
    country: 'Philippines',
    latitude: null as number | null,
    longitude: null as number | null,
    date_of_birth: '',
    age: '',
    gender: '',
    affiliation: '',
    prcNumber: '',
    ptrNumber: '',
    tinNumber: '',
    s2Number: '',
    signature: null as string | null,
    signatureUrl: null as string | null,
    idPhoto: null as string | null
  })

  const middleInitial = computed(() => {
    const m = form.middle_name?.trim()
    if (!m) return ''
    return `${m.charAt(0).toUpperCase()}.`
  })

  // Subscription state
  const mySubscription = ref<DoctorSubscription | null>(null)
  const allDoctorPlans = ref<DoctorPlan[]>([])
  const isSubLoading = ref(false)
  const isSubInherited = ref(false)
  const subAssociateCoverage = ref<any | null>(null)

  const fetchSubscriptionInfo = async () => {
    isSubLoading.value = true
    try {
      const [subRes, plansRes] = await Promise.all([
        doctorSubscriptionService.getMySubscription(),
        doctorSubscriptionService.getPlans()
      ])
      mySubscription.value = subRes.data?.subscription || null
      isSubInherited.value = Boolean(subRes.data?.is_inherited)
      subAssociateCoverage.value = subRes.data?.associate_coverage || null
      allDoctorPlans.value = plansRes.data || []
    } catch (e) {
      console.error('Failed to load subscription info in profile:', e)
    } finally {
      isSubLoading.value = false
    }
  }

  onMounted(async () => {
    await Promise.all([
      fetchAvailabilities(),
      fetchClinics(true),
      fetchClinicDoctors(true),
      fetchSubscriptionInfo()
    ])
  })

  const doctorUuid = useCookie('user_uuid').value
  const isUploadingAvatar = ref(false)
  const avatarInputRef = ref<HTMLInputElement | null>(null)
  const showCropModal = ref(false)
  const rawAvatarSrc = ref('')

  const triggerAvatarUpload = () => {
    avatarInputRef.value?.click()
  }

  const handleAvatarFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, or WebP).')
      input.value = ''
      return
    }

    const maxSizeInBytes = 10 * 1024 * 1024
    if (file.size > maxSizeInBytes) {
      toast.error('Image size exceeds 10MB limit. Please choose a smaller image.')
      input.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = e => {
      const base64Data = e.target?.result as string
      if (!base64Data) return
      rawAvatarSrc.value = base64Data
      showCropModal.value = true
      input.value = ''
    }
    reader.onerror = () => {
      toast.error('Error reading the image file.')
      input.value = ''
    }
    reader.readAsDataURL(file)
  }

  const handleApplyCroppedAvatar = async (croppedBase64: string) => {
    isUploadingAvatar.value = true
    try {
      await userService.update(doctorUuid as string, {
        avatar: croppedBase64
      })
      toast.success('Profile picture updated successfully.')
      showCropModal.value = false
      rawAvatarSrc.value = ''
      await Promise.all([refresh(), refreshNuxtData(`userProfile-${doctorUuid}`)])
    } catch (err: any) {
      console.error('Failed to upload avatar:', err)
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to update profile picture.'
      )
    } finally {
      isUploadingAvatar.value = false
    }
  }

  // PRC ID Photo Document Upload
  const prcFileInputRef = ref<HTMLInputElement | null>(null)
  const prcUploadedFileName = ref('')
  const prcUploadedFileSize = ref('')
  const isPrcDragging = ref(false)

  const triggerPrcUpload = () => {
    prcFileInputRef.value?.click()
  }

  const handlePrcFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, or WebP).')
      target.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size exceeds 10MB limit. Please choose a smaller image.')
      target.value = ''
      return
    }

    prcUploadedFileName.value = file.name
    prcUploadedFileSize.value = `${(file.size / (1024 * 1024)).toFixed(2)} MB`

    const reader = new FileReader()
    reader.onload = (event: ProgressEvent<FileReader>) => {
      form.idPhoto = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handlePrcDrop = (e: DragEvent) => {
    isPrcDragging.value = false
    const file = e.dataTransfer?.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, or WebP).')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size exceeds 10MB limit. Please choose a smaller image.')
      return
    }

    prcUploadedFileName.value = file.name
    prcUploadedFileSize.value = `${(file.size / (1024 * 1024)).toFixed(2)} MB`

    const reader = new FileReader()
    reader.onload = (event: ProgressEvent<FileReader>) => {
      form.idPhoto = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const removePrcPhoto = () => {
    form.idPhoto = null
    prcUploadedFileName.value = ''
    prcUploadedFileSize.value = ''
    if (prcFileInputRef.value) {
      prcFileInputRef.value.value = ''
    }
  }

  const availabilities = ref<any[]>([])
  const isAvailLoading = ref(false)
  const isAddLoading = ref(false)
  const scheduleViewMode = ref<'cards' | 'timetable'>('cards')

  // Sorted availabilities with the newest date on top
  const sortedAvailabilities = computed(() => {
    return [...(availabilities.value || [])].sort((a, b) => {
      const dateA = (a.available_date || '').slice(0, 10)
      const dateB = (b.available_date || '').slice(0, 10)
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA) // Descending: newest date at top!
      }
      return (b.start_time || '').localeCompare(a.start_time || '')
    })
  })

  // Edit slot modal state for List Cards view
  const showEditSlotModal = ref(false)
  const slotToEdit = ref<any>(null)

  const openEditSlotModal = (slot: any) => {
    slotToEdit.value = slot
    showEditSlotModal.value = true
  }

  const handleEditSlotSaved = async () => {
    showEditSlotModal.value = false
    slotToEdit.value = null
    await fetchAvailabilities()
    await fetchBlockedSlots()
  }

  // Inner Sidebar Tabs
  type SettingsTab = 'profile' | 'clinics' | 'schedule' | 'subscription' | 'security'
  const activeTab = ref<SettingsTab>('profile')

  const navTabs = computed(() => [
    {
      id: 'profile' as SettingsTab,
      label: 'Profile & Credentials',
      desc: 'Personal details & PRC license',
      icon: 'heroicons:user-circle'
    },
    {
      id: 'clinics' as SettingsTab,
      label: 'Clinics & Doctor Team',
      desc: isOwner.value
        ? 'Clinic locations & associate doctor seats'
        : 'Clinic locations & affiliated doctors',
      icon: 'heroicons:building-office-2'
    },
    {
      id: 'schedule' as SettingsTab,
      label: 'Schedule & Availability',
      desc: 'Duty hours, blocked dates & timetable',
      icon: 'heroicons:calendar-days'
    },
    {
      id: 'subscription' as SettingsTab,
      label: 'Subscription & Plan',
      desc: isSubInherited.value
        ? 'Clinic tier & sponsored access'
        : 'Plan status, quotas & billing',
      icon: 'heroicons:credit-card'
    },
    {
      id: 'security' as SettingsTab,
      label: 'Account & Security',
      desc: 'Password, 2FA & session security',
      icon: 'heroicons:shield-check'
    }
  ])

  const route = useRoute()
  watch(
    () => route.query.tab,
    newTab => {
      if (newTab && typeof newTab === 'string') {
        activeTab.value = newTab as SettingsTab
      }
    },
    { immediate: true }
  )

  watch(
    () => route.hash,
    hash => {
      if (hash === '#blocked-dates') {
        activeTab.value = 'schedule'
      } else if (hash === '#seats') {
        activeTab.value = 'clinics'
      }
    },
    { immediate: true }
  )

  // Prescription Signature Modal
  const showSignatureModal = ref(false)
  const handleSignatureSaved = (data: any) => {
    if (data.ptr_number) form.ptrNumber = data.ptr_number
    if (data.tin_number) form.tinNumber = data.tin_number
    if (data.s2_number) form.s2Number = data.s2_number
    if (data.signature_url) form.signatureUrl = data.signature_url
    refresh()
  }

  // Clinic Management
  const { clinics, fetchClinics, addClinic, updateClinic, removeClinic } = useDoctorClinics()
  const showAddClinicModal = ref(false)
  const isClinicSubmitting = ref(false)
  const clinicForm = reactive({
    name: '',
    address: '',
    phone: '',
    email: '',
    logo: '',
    logoPreview: ''
  })
  const clinicError = ref('')

  // Edit Clinic State & Handlers
  const showEditClinicModal = ref(false)
  const isEditClinicSubmitting = ref(false)
  const editingClinic = ref<any>(null)
  const editClinicError = ref('')
  const editClinicForm = reactive({
    name: '',
    address: '',
    phone: '',
    email: '',
    is_active: true,
    logo: '',
    logoPreview: ''
  })

  const handleClinicLogoUpload = (e: Event, isEdit: boolean) => {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, or WebP).')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Clinic logo must be under 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = ev => {
      const base64 = ev.target?.result as string
      if (isEdit) {
        editClinicForm.logo = base64
        editClinicForm.logoPreview = base64
      } else {
        clinicForm.logo = base64
        clinicForm.logoPreview = base64
      }
    }
    reader.readAsDataURL(file)
  }

  const openEditClinicModal = (clinic: any) => {
    editingClinic.value = clinic
    editClinicForm.name = clinic.name || ''
    editClinicForm.address = clinic.address || ''
    editClinicForm.phone = clinic.phone || ''
    editClinicForm.email = clinic.email || ''
    editClinicForm.is_active = clinic.is_active !== false
    editClinicForm.logo = ''
    editClinicForm.logoPreview = clinic.logo_url || clinic.logo_path || ''
    editClinicError.value = ''
    showEditClinicModal.value = true
  }

  const closeEditClinicModal = () => {
    showEditClinicModal.value = false
    editingClinic.value = null
    editClinicError.value = ''
  }

  const handleUpdateClinic = async () => {
    if (!editClinicForm.name.trim()) {
      editClinicError.value = 'Clinic name is required.'
      return
    }
    if (!editingClinic.value) return

    isEditClinicSubmitting.value = true
    editClinicError.value = ''
    try {
      const targetUuid = editingClinic.value.uuid || editingClinic.value.id
      const updatePayload: Record<string, any> = {
        name: editClinicForm.name.trim(),
        address: editClinicForm.address.trim() || null,
        phone: editClinicForm.phone.trim() || null,
        email: editClinicForm.email.trim() || null,
        is_active: editClinicForm.is_active
      }
      if (editClinicForm.logo) {
        updatePayload.logo = editClinicForm.logo
      } else if (!editClinicForm.logoPreview && editingClinic.value.logo_path) {
        updatePayload.logo = null
      }
      await updateClinic(targetUuid, updatePayload)
      toast.success(`Clinic "${editClinicForm.name.trim()}" updated successfully.`)
      closeEditClinicModal()
    } catch (err: any) {
      editClinicError.value = err.data?.message || err.message || 'Failed to update clinic branch.'
      toast.error(editClinicError.value)
    } finally {
      isEditClinicSubmitting.value = false
    }
  }

  const clinicToDelete = ref<any>(null)
  const showDeleteClinicModal = ref(false)
  const isDeletingClinic = ref(false)

  const handleCreateClinic = async () => {
    if (!clinicForm.name.trim()) {
      clinicError.value = 'Clinic name is required.'
      return
    }
    isClinicSubmitting.value = true
    clinicError.value = ''
    try {
      await addClinic({
        name: clinicForm.name.trim(),
        address: clinicForm.address.trim() || null,
        phone: clinicForm.phone.trim() || null,
        email: clinicForm.email.trim() || null,
        logo: clinicForm.logo || null
      })
      toast.success(`Clinic "${clinicForm.name.trim()}" added successfully.`)
      showAddClinicModal.value = false
      clinicForm.name = ''
      clinicForm.address = ''
      clinicForm.phone = ''
      clinicForm.email = ''
      clinicForm.logo = ''
      clinicForm.logoPreview = ''
    } catch (err: any) {
      clinicError.value = err.data?.message || err.message || 'Failed to add clinic branch.'
      toast.error(clinicError.value)
    } finally {
      isClinicSubmitting.value = false
    }
  }

  const confirmDeleteClinic = (clinic: any) => {
    clinicToDelete.value = clinic
    showDeleteClinicModal.value = true
  }

  const executeDeleteClinic = async () => {
    if (!clinicToDelete.value) return
    isDeletingClinic.value = true
    try {
      await removeClinic(clinicToDelete.value.uuid || clinicToDelete.value.id)
      toast.success('Clinic location removed successfully.')
      showDeleteClinicModal.value = false
      clinicToDelete.value = null
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to delete clinic branch.')
    } finally {
      isDeletingClinic.value = false
    }
  }

  // Multi-Doctor Clinic Seat Management
  const {
    clinicDoctors,
    seatUsage,
    isOwner,
    clinicOwner,
    sponsoringClinic,
    fetchClinicDoctors,
    searchCandidates,
    assignDoctor,
    removeDoctor
  } = useDoctorClinicDoctors()

  const showAssignDoctorModal = ref(false)
  const isAssigningDoctor = ref(false)
  const assignDoctorError = ref('')
  const doctorSearchQuery = ref('')
  const doctorSearchResults = ref<any[]>([])
  const isSearchingDoctors = ref(false)
  const selectedCandidate = ref<any | null>(null)

  const assignDoctorForm = reactive({
    clinic_id: null as number | null,
    role: 'associate'
  })

  let searchTimeout: any = null
  const handleDoctorSearch = (val: string) => {
    doctorSearchQuery.value = val
    clearTimeout(searchTimeout)
    if (!val || val.trim().length < 2) {
      doctorSearchResults.value = []
      return
    }
    isSearchingDoctors.value = true
    searchTimeout = setTimeout(async () => {
      try {
        doctorSearchResults.value = await searchCandidates(val)
      } finally {
        isSearchingDoctors.value = false
      }
    }, 300)
  }

  const selectCandidateDoctor = (cand: any) => {
    selectedCandidate.value = cand
    doctorSearchQuery.value = cand.full_name
    doctorSearchResults.value = []
  }

  const clearCandidateDoctor = () => {
    selectedCandidate.value = null
    doctorSearchQuery.value = ''
    doctorSearchResults.value = []
  }

  const openAssignDoctorModal = () => {
    assignDoctorError.value = ''
    selectedCandidate.value = null
    doctorSearchQuery.value = ''
    doctorSearchResults.value = []
    assignDoctorForm.role = 'associate'
    assignDoctorForm.clinic_id = clinics.value.length > 0 ? (clinics.value[0].id as number) : null
    showAssignDoctorModal.value = true
  }

  const handleAssignDoctor = async () => {
    if (!assignDoctorForm.clinic_id) {
      assignDoctorError.value = 'Please select a clinic branch.'
      return
    }
    if (!selectedCandidate.value && !doctorSearchQuery.value.trim()) {
      assignDoctorError.value = 'Please search and select a doctor or enter doctor email.'
      return
    }

    isAssigningDoctor.value = true
    assignDoctorError.value = ''
    try {
      const payload: any = {
        clinic_id: assignDoctorForm.clinic_id,
        role: assignDoctorForm.role
      }
      if (selectedCandidate.value) {
        payload.doctor_id = selectedCandidate.value.id
      } else {
        payload.email = doctorSearchQuery.value.trim()
      }
      const res = await assignDoctor(payload)
      toast.success(res?.message || 'Invitation sent to doctor successfully.')
      showAssignDoctorModal.value = false
      clearCandidateDoctor()
    } catch (err: any) {
      assignDoctorError.value =
        err.data?.message || err.message || 'Failed to assign doctor to clinic seat.'
      toast.error(assignDoctorError.value)
    } finally {
      isAssigningDoctor.value = false
    }
  }

  const doctorSeatToRevoke = ref<{ pivotId: number; name: string } | null>(null)
  const showRevokeSeatModal = ref(false)
  const isRevokingSeat = ref(false)

  const confirmRevokeDoctorSeat = (pivotId: number, doctorName: string) => {
    doctorSeatToRevoke.value = { pivotId, name: doctorName }
    showRevokeSeatModal.value = true
  }

  const executeRevokeDoctorSeat = async () => {
    if (!doctorSeatToRevoke.value) return
    isRevokingSeat.value = true
    try {
      await removeDoctor(doctorSeatToRevoke.value.pivotId)
      toast.success(`Doctor seat for Dr. ${doctorSeatToRevoke.value.name} has been revoked.`)
      showRevokeSeatModal.value = false
      doctorSeatToRevoke.value = null
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to remove doctor seat.')
    } finally {
      isRevokingSeat.value = false
    }
  }

  // Schedule Availability Form
  const scheduleType = ref<'duty' | 'away'>('duty') // 'duty' for clinic schedule, 'away' for blocked
  const selectedClinicId = ref<number | null>(null)
  const customLocation = ref('')
  const availForm = reactive({
    available_date: '',
    start_time: '09:00',
    end_time: '17:00'
  })
  const blockWholeDay = ref(false)
  const availSuccessMsg = ref('')
  const availErrorMsg = ref('')

  // Present/Future Date Guard
  const todayDateStr = computed(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })

  const formatReadableDate = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Multi-day / Recurring Schedule State
  const scheduleMode = ref<'single' | 'recurring'>('single')
  const recurringDays = ref<number[]>([1, 3, 5]) // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun (default MWF)
  const recurringStartDate = ref('')
  const recurringEndDate = ref('')

  const weekdayOptions = [
    { label: 'Sun', day: 0 },
    { label: 'Mon', day: 1 },
    { label: 'Tue', day: 2 },
    { label: 'Wed', day: 3 },
    { label: 'Thu', day: 4 },
    { label: 'Fri', day: 5 },
    { label: 'Sat', day: 6 }
  ]

  const getWeekDateForDay = (day: number) => {
    const baseStr = recurringStartDate.value || todayDateStr.value
    const base = new Date(baseStr + 'T00:00:00')
    const baseDay = isNaN(base.getTime()) ? 0 : base.getDay() // 0=Sun, 1=Mon... 6=Sat

    // Sunday of the week containing base date
    const sunday = new Date(base)
    sunday.setDate(base.getDate() - baseDay)

    // Target date for specified weekday (0=Sun to 6=Sat)
    const target = new Date(sunday)
    target.setDate(sunday.getDate() + day)

    const y = target.getFullYear()
    const m = String(target.getMonth() + 1).padStart(2, '0')
    const d = String(target.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    const isPast = dateStr < todayDateStr.value

    return {
      dateStr,
      dateNum: target.getDate(),
      monthName: target.toLocaleDateString(undefined, { month: 'short' }),
      isPast
    }
  }

  const recurringStartDayOfWeek = computed(() => {
    if (!recurringStartDate.value) return null
    try {
      const d = new Date(recurringStartDate.value + 'T00:00:00')
      return isNaN(d.getTime()) ? null : d.getDay()
    } catch {
      return null
    }
  })

  const recurringStartWeekdayName = computed(() => {
    if (!recurringStartDate.value) return ''
    try {
      const d = new Date(recurringStartDate.value + 'T00:00:00')
      if (isNaN(d.getTime())) return ''
      return d.toLocaleDateString(undefined, { weekday: 'long' })
    } catch {
      return ''
    }
  })

  const isStartWeekday = (day: number): boolean => {
    return recurringStartDayOfWeek.value === day
  }

  // Recalculate range dynamically to stay strictly within that whole week (never spills into next week)
  const updateDynamicUntilDate = () => {
    if (!recurringStartDate.value || recurringStartDate.value < todayDateStr.value) {
      recurringStartDate.value = todayDateStr.value
    }
    if (!recurringDays.value.length) {
      recurringEndDate.value = recurringStartDate.value
      return
    }

    const start = new Date(recurringStartDate.value + 'T00:00:00')
    const startDayOfWeek = start.getDay() // 0=Sun, 1=Mon... 6=Sat

    // Find Sunday of this selected week
    const sunday = new Date(start)
    sunday.setDate(start.getDate() - startDayOfWeek)

    const maxDay = Math.max(...recurringDays.value)
    const targetEnd = new Date(sunday)
    targetEnd.setDate(sunday.getDate() + maxDay)

    // Format end date strictly within this week's bounds (never +7 into next week)
    const yEnd = targetEnd.getFullYear()
    const mEnd = String(targetEnd.getMonth() + 1).padStart(2, '0')
    const dEnd = String(targetEnd.getDate()).padStart(2, '0')
    let computedEndStr = `${yEnd}-${mEnd}-${dEnd}`

    // Ensure Until Date is at least From Date
    if (computedEndStr < recurringStartDate.value) {
      computedEndStr = recurringStartDate.value
    }
    recurringEndDate.value = computedEndStr
  }

  const setWeekdayPreset = (preset: 'weekdays' | 'mwf' | 'tths' | 'everyday' | 'clear') => {
    let days: number[] = []
    if (preset === 'weekdays') days = [1, 2, 3, 4, 5]
    else if (preset === 'mwf') days = [1, 3, 5]
    else if (preset === 'tths') days = [2, 4, 6]
    else if (preset === 'everyday') days = [0, 1, 2, 3, 4, 5, 6]
    else if (preset === 'clear') days = []

    // Strictly disallow past days in repeat on days
    recurringDays.value = days.filter(d => !getWeekDateForDay(d).isPast)
    updateDynamicUntilDate()
  }

  const toggleRecurringDay = (dayNum: number) => {
    if (getWeekDateForDay(dayNum).isPast) {
      toast.error('Cannot set schedule for past dates.')
      return
    }
    if (recurringDays.value.includes(dayNum)) {
      recurringDays.value = recurringDays.value.filter(d => d !== dayNum)
    } else {
      recurringDays.value = [...recurringDays.value, dayNum]
    }
    updateDynamicUntilDate()
  }

  watch(recurringStartDate, () => {
    updateDynamicUntilDate()
  })

  watch(scheduleMode, mode => {
    if (mode === 'recurring') {
      updateDynamicUntilDate()
    }
  })

  watch(blockWholeDay, val => {
    if (val) {
      availForm.start_time = '00:00'
      availForm.end_time = '23:59'
    }
  })

  const { fetchBlockedSlots } = useBlockedDates()

  const fetchAvailabilities = async () => {
    if (!doctorUuid) return
    isAvailLoading.value = true
    try {
      const res = await doctorAvailabilityService.listForDoctor(doctorUuid)
      availabilities.value = res ?? []
      // Keep shared blocked-dates state in sync
      await fetchBlockedSlots()
    } catch (e: any) {
      console.error('Failed to fetch availabilities:', e)
    } finally {
      isAvailLoading.value = false
    }
  }

  const showConflictModal = ref(false)
  const conflictData = ref<{
    message?: string
    overlapping_slots?: any[]
    affected_appointments?: any[]
  } | null>(null)
  const pendingAvailabilityPayload = ref<any>(null)
  const isOverwriting = ref(false)

  const confirmOverwriteSchedule = async () => {
    if (!pendingAvailabilityPayload.value || !doctorUuid) return
    isOverwriting.value = true
    try {
      await doctorAvailabilityService.createForDoctor(doctorUuid, {
        ...pendingAvailabilityPayload.value,
        overwrite: true
      })
      toast.success('Schedule updated! Conflicting hours were overwritten.')
      showConflictModal.value = false
      conflictData.value = null
      pendingAvailabilityPayload.value = null
      availForm.available_date = ''
      availForm.start_time = '09:00'
      availForm.end_time = '17:00'
      blockWholeDay.value = false
      await fetchAvailabilities()
      await fetchBlockedSlots()
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to overwrite schedule.')
    } finally {
      isOverwriting.value = false
    }
  }

  // ─── Recurring Schedule Blocked Dates & Redundancy State ────────
  const showRecurringBlockedModal = ref(false)
  const isResolvingRecurringConflict = ref(false)
  const selectedBlockedResolutionOption = ref<'keep_blocked' | 'override_blocked' | null>(null)
  const pendingRecurringDutyData = ref<{
    targetDates: string[]
    redundantDates: string[]
    conflictingBlockedDates: string[]
    startTime: string
    endTime: string
    locName: string | null
    clinicId: number | null
  } | null>(null)

  const selectKeepBlockedOption = () => {
    selectedBlockedResolutionOption.value = 'keep_blocked'
  }

  const selectOverrideBlockedOption = () => {
    selectedBlockedResolutionOption.value = 'override_blocked'
  }

  const handleProceedRecurringResolution = async () => {
    if (!selectedBlockedResolutionOption.value) return
    if (selectedBlockedResolutionOption.value === 'keep_blocked') {
      await executeRecurringKeepBlocked()
    } else if (selectedBlockedResolutionOption.value === 'override_blocked') {
      await executeRecurringOverrideBlocked()
    }
  }

  const isSlotIdenticalToForm = (
    slot: any,
    dateStr: string,
    startTime: string,
    endTime: string,
    clinicId: number | null
  ) => {
    const sDate = (slot.available_date || '').slice(0, 10)
    if (sDate !== dateStr) return false
    const isDuty = Number(slot.is_available) === 1 || slot.is_available === true
    if (!isDuty) return false
    const sStart = (slot.start_time || '').slice(0, 5)
    const sEnd = (slot.end_time || '').slice(0, 5)
    if (sStart !== startTime || sEnd !== endTime) return false
    if (clinicId && slot.clinic_id && slot.clinic_id !== clinicId) return false
    return true
  }

  const isSlotBlockedOnDate = (slot: any, dateStr: string) => {
    const sDate = (slot.available_date || '').slice(0, 10)
    if (sDate !== dateStr) return false
    return Number(slot.is_available) === 0 || slot.is_available === false
  }

  const closeRecurringBlockedModal = () => {
    showRecurringBlockedModal.value = false
    selectedBlockedResolutionOption.value = null
    pendingRecurringDutyData.value = null
  }

  const executeRecurringKeepBlocked = async () => {
    if (!pendingRecurringDutyData.value || !doctorUuid) return
    const {
      targetDates,
      conflictingBlockedDates,
      redundantDates,
      startTime,
      endTime,
      locName,
      clinicId
    } = pendingRecurringDutyData.value

    const datesToCreate = targetDates.filter(
      d => !conflictingBlockedDates.includes(d) && !redundantDates.includes(d)
    )

    if (!datesToCreate.length) {
      toast.info(
        'All selected days are currently marked as time-off or already have this schedule. No new duty hours were added.'
      )
      closeRecurringBlockedModal()
      return
    }

    isResolvingRecurringConflict.value = true
    try {
      let successCount = 0
      for (const dateStr of datesToCreate) {
        try {
          await doctorAvailabilityService.createForDoctor(doctorUuid, {
            available_date: dateStr,
            start_time: startTime,
            end_time: endTime,
            is_available: 1,
            clinic_id: clinicId,
            location_name: locName,
            overwrite: false
          })
          successCount++
        } catch (slotErr) {
          console.error(`Failed to create slot for ${dateStr}:`, slotErr)
        }
      }

      if (successCount > 0) {
        toast.success(
          `Schedule set for ${successCount} day${successCount === 1 ? '' : 's'}! Your ${conflictingBlockedDates.length} blocked day${conflictingBlockedDates.length === 1 ? '' : 's'} remain protected.`
        )
      }
      if (redundantDates.length > 0) {
        toast.info(
          `${redundantDates.length} day${redundantDates.length === 1 ? '' : 's'} already had this exact schedule and were skipped to avoid duplicates.`
        )
      }

      closeRecurringBlockedModal()
      await fetchAvailabilities()
      await fetchBlockedSlots()
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to save schedule.')
    } finally {
      isResolvingRecurringConflict.value = false
    }
  }

  const executeRecurringOverrideBlocked = async () => {
    if (!pendingRecurringDutyData.value || !doctorUuid) return
    const {
      targetDates,
      conflictingBlockedDates,
      redundantDates,
      startTime,
      endTime,
      locName,
      clinicId
    } = pendingRecurringDutyData.value

    const datesToCreate = targetDates.filter(d => !redundantDates.includes(d))

    if (!datesToCreate.length) {
      toast.info('All selected days already have this exact schedule. No duplicates were added.')
      closeRecurringBlockedModal()
      return
    }

    isResolvingRecurringConflict.value = true
    try {
      let successCount = 0
      for (const dateStr of datesToCreate) {
        try {
          await doctorAvailabilityService.createForDoctor(doctorUuid, {
            available_date: dateStr,
            start_time: startTime,
            end_time: endTime,
            is_available: 1,
            clinic_id: clinicId,
            location_name: locName,
            overwrite: true
          })
          successCount++
        } catch (slotErr) {
          console.error(`Failed to create slot for ${dateStr}:`, slotErr)
        }
      }

      if (successCount > 0) {
        toast.success(
          `Clinic hours scheduled across all ${successCount} day${successCount === 1 ? '' : 's'}! Previous time-off on conflicting dates was cancelled.`
        )
      }
      if (redundantDates.length > 0) {
        toast.info(
          `${redundantDates.length} day${redundantDates.length === 1 ? '' : 's'} already had this exact schedule and were skipped to avoid duplicates.`
        )
      }

      closeRecurringBlockedModal()
      await fetchAvailabilities()
      await fetchBlockedSlots()
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to override schedule.')
    } finally {
      isResolvingRecurringConflict.value = false
    }
  }

  const getBlockedInfoForWeekday = (dayNum: number) => {
    const slots = availabilities.value || []
    const results: Array<{
      date: string
      formattedDate: string
      title: string
      time: string
    }> = []

    const startStr = recurringStartDate.value || todayDateStr.value
    const endStr = recurringEndDate.value || recurringStartDate.value || todayDateStr.value
    if (!startStr) return results

    const startD = new Date(startStr + 'T00:00:00')
    const endD = new Date(endStr + 'T00:00:00')
    if (startD > endD) return results

    const curr = new Date(startD)
    while (curr <= endD) {
      if (curr.getDay() === dayNum) {
        const y = curr.getFullYear()
        const m = String(curr.getMonth() + 1).padStart(2, '0')
        const d = String(curr.getDate()).padStart(2, '0')
        const dateIso = `${y}-${m}-${d}`

        const blockedSlotsOnDate = slots.filter(s => {
          const sDate = (s.available_date || '').slice(0, 10)
          return sDate === dateIso && (Number(s.is_available) === 0 || s.is_available === false)
        })

        for (const b of blockedSlotsOnDate) {
          const isAllDay =
            (!b.start_time || b.start_time.slice(0, 5) <= '00:01') &&
            (!b.end_time || b.end_time.slice(0, 5) >= '23:58')

          results.push({
            date: dateIso,
            formattedDate: formatReadableDate(dateIso),
            title: b.location_name || 'Time-Off / Blocked',
            time: isAllDay
              ? 'All Day Off'
              : `${formatTime(b.start_time)} - ${formatTime(b.end_time)}`
          })
        }
      }
      curr.setDate(curr.getDate() + 1)
    }

    return results
  }

  const addAvailability = async () => {
    if (!doctorUuid) {
      availErrorMsg.value = 'Unable to identify your doctor profile. Please sign in again.'
      return
    }

    const startTime = (
      scheduleType.value === 'away' && blockWholeDay.value
        ? '00:00'
        : availForm.start_time || '00:00'
    ).slice(0, 5)
    const endTime = (
      scheduleType.value === 'away' && blockWholeDay.value ? '23:59' : availForm.end_time || '23:59'
    ).slice(0, 5)

    if (startTime >= endTime) {
      availErrorMsg.value = 'Start time must be before end time.'
      return
    }

    const isAvailable = scheduleType.value === 'duty'
    let locName: string | null = null
    if (isAvailable) {
      const matched = clinics.value.find(c => c.id === selectedClinicId.value)
      locName = matched ? matched.name : customLocation.value.trim() || 'Clinic Duty'
    } else {
      locName = 'Blocked / Away Period'
    }

    // ─── Mode A: Single Date ─────────────────────────────────────────
    if (scheduleMode.value === 'single') {
      if (!availForm.available_date) {
        availErrorMsg.value = 'Please select a date.'
        return
      }
      if (availForm.available_date < todayDateStr.value) {
        availErrorMsg.value =
          'Cannot set schedule for a past date. Please choose today or a future date.'
        return
      }

      // Redundancy check: Prevent duplicate identical slot
      if (isAvailable) {
        const isAlreadyIdentical = (availabilities.value || []).some(s =>
          isSlotIdenticalToForm(
            s,
            availForm.available_date,
            startTime,
            endTime,
            selectedClinicId.value
          )
        )
        if (isAlreadyIdentical) {
          toast.info(
            'This exact clinic duty schedule is already set for this date. No duplicate was created.'
          )
          return
        }
      }

      isAddLoading.value = true
      availErrorMsg.value = ''
      availSuccessMsg.value = ''
      try {
        const payload = {
          available_date: availForm.available_date,
          start_time: startTime,
          end_time: endTime,
          is_available: isAvailable ? 1 : 0,
          clinic_id: isAvailable ? selectedClinicId.value : null,
          location_name: locName
        }

        await doctorAvailabilityService.createForDoctor(doctorUuid, payload)
        availSuccessMsg.value = isAvailable
          ? 'Clinic Duty Schedule added successfully!'
          : 'Blocked / Away period added successfully!'
        toast.success(availSuccessMsg.value)
        availForm.available_date = ''
        availForm.start_time = '09:00'
        availForm.end_time = '17:00'
        blockWholeDay.value = false
        await fetchAvailabilities()
        await fetchBlockedSlots()
        setTimeout(() => {
          availSuccessMsg.value = ''
        }, 3000)
      } catch (e: any) {
        console.error('Failed to add availability:', e)
        const errStatus = e.status || e.statusCode || e.response?.status
        if (errStatus === 409 || e.data?.conflict) {
          conflictData.value = e.data || {}
          pendingAvailabilityPayload.value = {
            available_date: availForm.available_date,
            start_time: startTime,
            end_time: endTime,
            is_available: isAvailable ? 1 : 0,
            clinic_id: isAvailable ? selectedClinicId.value : null,
            location_name: locName
          }
          showConflictModal.value = true
        } else {
          availErrorMsg.value =
            e.data?.message || e.message || 'Failed to add schedule. Please check the times.'
          toast.error(availErrorMsg.value)
        }
      } finally {
        isAddLoading.value = false
      }
      return
    }

    // ─── Mode B: Recurring Multi-Day Allocation ──────────────────────
    if (!recurringDays.value.length) {
      availErrorMsg.value = 'Please select at least one day of the week.'
      return
    }
    if (!recurringStartDate.value || !recurringEndDate.value) {
      availErrorMsg.value = 'Please select a valid date range.'
      return
    }
    if (recurringStartDate.value < todayDateStr.value) {
      availErrorMsg.value =
        'Starting date cannot be in the past. Please select today or a future date.'
      return
    }

    const start = new Date(recurringStartDate.value + 'T00:00:00')
    const startDayOfWeek = isNaN(start.getTime()) ? 0 : start.getDay()
    const sunday = new Date(start)
    sunday.setDate(start.getDate() - startDayOfWeek)

    const targetDates: string[] = []
    for (const dayNum of recurringDays.value) {
      const target = new Date(sunday)
      target.setDate(sunday.getDate() + dayNum)
      const y = target.getFullYear()
      const m = String(target.getMonth() + 1).padStart(2, '0')
      const d = String(target.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`
      if (dateStr >= todayDateStr.value && !targetDates.includes(dateStr)) {
        targetDates.push(dateStr)
      }
    }
    targetDates.sort()

    if (!targetDates.length) {
      availErrorMsg.value = 'No matching weekdays found in the selected date range.'
      return
    }

    // If duty schedule, check for redundancies and blocked date conflicts
    if (isAvailable) {
      const allDoctorSlots = availabilities.value || []

      // 1. Redundancy check (exact same clinic duty and hours already exist)
      const redundantDates = targetDates.filter(d =>
        allDoctorSlots.some(s =>
          isSlotIdenticalToForm(s, d, startTime, endTime, selectedClinicId.value)
        )
      )

      if (redundantDates.length === targetDates.length) {
        toast.info(
          'All selected days already have this exact schedule in place. No duplicate entries needed.'
        )
        return
      }

      // 2. Blocked dates check
      const conflictingBlockedDates = targetDates.filter(d =>
        allDoctorSlots.some(s => isSlotBlockedOnDate(s, d))
      )

      if (conflictingBlockedDates.length > 0) {
        pendingRecurringDutyData.value = {
          targetDates,
          redundantDates,
          conflictingBlockedDates,
          startTime,
          endTime,
          locName,
          clinicId: selectedClinicId.value
        }
        selectedBlockedResolutionOption.value = null
        showRecurringBlockedModal.value = true
        return
      }

      // If no blocked conflicts, create non-redundant dates
      const datesToCreate = targetDates.filter(d => !redundantDates.includes(d))

      isAddLoading.value = true
      availErrorMsg.value = ''
      availSuccessMsg.value = ''

      try {
        let successCount = 0
        let conflictCount = 0
        for (const dateStr of datesToCreate) {
          try {
            await doctorAvailabilityService.createForDoctor(doctorUuid, {
              available_date: dateStr,
              start_time: startTime,
              end_time: endTime,
              is_available: 1,
              clinic_id: selectedClinicId.value,
              location_name: locName,
              overwrite: false
            })
            successCount++
          } catch (slotErr: any) {
            const sErrStatus = slotErr.status || slotErr.statusCode || slotErr.response?.status
            if (sErrStatus === 409 || slotErr.data?.conflict) {
              conflictCount++
            }
            console.error(`Failed to create slot for ${dateStr}:`, slotErr)
          }
        }

        if (successCount > 0) {
          toast.success(
            `Successfully added schedule across ${successCount} day${successCount === 1 ? '' : 's'}!`
          )
          availSuccessMsg.value = `Schedule applied to ${successCount} day(s).`
        }
        if (redundantDates.length > 0) {
          toast.info(
            `${redundantDates.length} day${redundantDates.length === 1 ? '' : 's'} already had this exact schedule and were preserved.`
          )
        }
        if (conflictCount > 0) {
          toast.warning(
            `${conflictCount} date(s) had conflicting schedules and were preserved intact.`
          )
        }

        await fetchAvailabilities()
        await fetchBlockedSlots()
        setTimeout(() => {
          availSuccessMsg.value = ''
        }, 3000)
      } catch (err: any) {
        availErrorMsg.value =
          err.data?.message || err.message || 'Failed to add recurring schedule.'
        toast.error(availErrorMsg.value)
      } finally {
        isAddLoading.value = false
      }
      return
    }

    // Otherwise, scheduleType === 'away' (blocked periods)
    isAddLoading.value = true
    availErrorMsg.value = ''
    availSuccessMsg.value = ''

    try {
      let successCount = 0
      let conflictCount = 0
      for (const dateStr of targetDates) {
        try {
          await doctorAvailabilityService.createForDoctor(doctorUuid, {
            available_date: dateStr,
            start_time: startTime,
            end_time: endTime,
            is_available: 0,
            clinic_id: null,
            location_name: locName,
            overwrite: false
          })
          successCount++
        } catch (slotErr: any) {
          const sErrStatus = slotErr.status || slotErr.statusCode || slotErr.response?.status
          if (sErrStatus === 409 || slotErr.data?.conflict) {
            conflictCount++
          }
          console.error(`Failed to create slot for ${dateStr}:`, slotErr)
        }
      }

      if (successCount > 0) {
        toast.success(
          `Successfully added blocked periods across ${successCount} day${successCount === 1 ? '' : 's'}!`
        )
        availSuccessMsg.value = `Blocked periods applied to ${successCount} day(s).`
      }
      if (conflictCount > 0) {
        toast.warning(
          `${conflictCount} date(s) had conflicting schedules and were preserved intact.`
        )
      }

      await fetchAvailabilities()
      await fetchBlockedSlots()
      setTimeout(() => {
        availSuccessMsg.value = ''
      }, 3000)
    } catch (err: any) {
      availErrorMsg.value = err.data?.message || err.message || 'Failed to add recurring schedule.'
      toast.error(availErrorMsg.value)
    } finally {
      isAddLoading.value = false
    }
  }

  const deleteAvailability = async (uuid: string) => {
    try {
      await doctorAvailabilityService.delete(uuid)
      await fetchAvailabilities()
      await fetchBlockedSlots()
    } catch (e: any) {
      console.error('Failed to delete availability:', e)
      availErrorMsg.value = e.data?.message || e.message || 'Failed to delete availability.'
    }
  }

  const formatTime = (time: string) => {
    if (!time) return ''
    const parts = time.split(':')
    if (parts.length < 2) return time
    let hours = parseInt(parts[0], 10)
    const minutes = parts[1]
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    return `${hours}:${minutes} ${ampm}`
  }

  const initialFormState = ref<string>('')
  const hasFormChanges = computed(() => {
    if (!initialFormState.value) return false
    return JSON.stringify(form) !== initialFormState.value
  })

  const formattedCoordinates = computed(() => {
    if (
      form.latitude === null ||
      form.latitude === undefined ||
      form.longitude === null ||
      form.longitude === undefined
    ) {
      return null
    }
    const lat = Number(form.latitude)
    const lon = Number(form.longitude)
    if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
      return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`
    }
    return null
  })

  const loaded = ref(false)
  const {
    sanitizeName,
    blockNameKey,
    sanitizeAge,
    blockAgeKey,
    validateName,
    validateAge,
    normalizeGender,
    calculateAge,
    validateDateOfBirth,
    todayIsoDate,
    splitFullPhoneNumber,
    validatePhoneNumber
  } = useFormSanitizer()

  watch(
    user,
    newVal => {
      if (newVal && !loaded.value) {
        const userData = newVal
        form.first_name = sanitizeName(userData.first_name || '')
        form.middle_name = sanitizeName(userData.middle_name || '')
        form.last_name = sanitizeName(userData.last_name || '')
        form.email = userData.email || ''
        form.contact_number = userData.contact_number || userData.phone || ''
        form.street = userData.street || ''
        form.barangay = userData.barangay || ''
        form.city = userData.city || ''
        form.province = userData.province || ''
        form.country = userData.country || 'Philippines'
        form.latitude =
          userData.latitude !== null && userData.latitude !== undefined && userData.latitude !== ''
            ? Number(userData.latitude)
            : null
        form.longitude =
          userData.longitude !== null &&
          userData.longitude !== undefined &&
          userData.longitude !== ''
            ? Number(userData.longitude)
            : null
        form.date_of_birth = userData.date_of_birth || ''
        form.age = sanitizeAge(userData.age)
        form.gender = normalizeGender(userData.gender)
        form.prcNumber =
          userData.prcNumber ||
          userData.prc_number ||
          userData.doctor_verification?.prcNumber ||
          userData.doctor_verification?.prc_number ||
          ''
        form.ptrNumber = userData.ptr_number || userData.ptrNumber || ''
        form.tinNumber = userData.tin_number || userData.tinNumber || ''
        form.s2Number = userData.s2_number || userData.s2Number || ''
        form.signatureUrl = userData.signature_url || null

        loaded.value = true
        initialFormState.value = JSON.stringify(form)
      }
    },
    { immediate: true, deep: true }
  )

  const errors = reactive({
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    age: '',
    contact_number: '',
    prcNumber: ''
  })

  const calculatedDoctorAge = computed(() => calculateAge(form.date_of_birth))

  const validateContactNumberField = () => {
    if (!form.contact_number) {
      errors.contact_number = ''
      return true
    }
    const parts = splitFullPhoneNumber(form.contact_number)
    const res = validatePhoneNumber(parts.national, parts.dialCode)
    errors.contact_number = res.valid ? '' : res.error
    return res.valid
  }

  const validateFirstName = () => {
    const res = validateName(form.first_name, 'First Name', 2, 50, true)
    errors.first_name = res.valid ? '' : res.error
    return res.valid
  }

  const validateLastName = () => {
    const res = validateName(form.last_name, 'Last Name', 2, 50, true)
    errors.last_name = res.valid ? '' : res.error
    return res.valid
  }

  const validateMiddleName = () => {
    if (form.middle_name) {
      const res = validateName(form.middle_name, 'Middle Name', 1, 50, false)
      errors.middle_name = res.valid ? '' : res.error
      return res.valid
    }
    errors.middle_name = ''
    return true
  }

  const validateDateOfBirthField = () => {
    if (
      form.date_of_birth !== '' &&
      form.date_of_birth !== null &&
      form.date_of_birth !== undefined
    ) {
      const res = validateDateOfBirth(form.date_of_birth, false)
      errors.date_of_birth = res.valid ? '' : res.error
      return res.valid
    }
    errors.date_of_birth = ''
    return true
  }

  // Real-time input watchers to strip numbers from names and invalid characters from age
  watch(
    () => form.first_name,
    newVal => {
      const sanitized = sanitizeName(newVal)
      if (sanitized !== newVal) form.first_name = sanitized
      validateFirstName()
    }
  )
  watch(
    () => form.middle_name,
    newVal => {
      const sanitized = sanitizeName(newVal)
      if (sanitized !== newVal) form.middle_name = sanitized
      validateMiddleName()
    }
  )
  watch(
    () => form.last_name,
    newVal => {
      const sanitized = sanitizeName(newVal)
      if (sanitized !== newVal) form.last_name = sanitized
      validateLastName()
    }
  )
  watch(
    () => form.date_of_birth,
    () => {
      validateDateOfBirthField()
    }
  )

  const validatePrcNumber = () => {
    if (user.value?.doctor_verification?.status === 'verified') {
      errors.prcNumber = ''
      return true
    }
    if (form.prcNumber && !/^\d{7}$/.test(form.prcNumber)) {
      errors.prcNumber = 'PRC License Number must be exactly 7 digits.'
      return false
    }
    errors.prcNumber = ''
    return true
  }

  watch(
    () => form.prcNumber,
    newVal => {
      if (newVal) {
        const sanitized = newVal.replace(/\D/g, '').slice(0, 7)
        if (sanitized !== newVal) form.prcNumber = sanitized
      }
      if (errors.prcNumber) validatePrcNumber()
    }
  )

  const isLoading = ref(false)
  const isGeoLoading = ref(false)
  const isSuccess = ref(false)
  const isLogoutModalOpen = ref(false)

  const geocodeAddress = async () => {
    if (!form.city || !form.province) return

    isGeoLoading.value = true
    try {
      // Step 1: Specific Search
      let query = `${form.street}, ${form.barangay}, ${form.city}, ${form.province}, ${form.country}`
      let response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        {
          headers: { 'User-Agent': 'DermAssist/1.0 (contact@dermassist.com)' }
        }
      )
      let data = await response.json()

      // Step 2: Fallback to City level if specific fails
      if (!data || data.length === 0) {
        query = `${form.city}, ${form.province}, ${form.country}`
        response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
          {
            headers: { 'User-Agent': 'DermAssist/1.0 (contact@dermassist.com)' }
          }
        )
        data = await response.json()
      }

      if (data && data.length > 0) {
        form.latitude = parseFloat(data[0].lat)
        form.longitude = parseFloat(data[0].lon)
      }
    } catch (error) {
      console.error('Geocoding failed:', error)
    } finally {
      isGeoLoading.value = false
    }
  }

  const submitProfile = async () => {
    // Client-side validation matching registration standards (0-130 age, letters-only names)
    const isFnValid = validateFirstName()
    const isLnValid = validateLastName()
    const isMnValid = validateMiddleName()
    const isDobValid = validateDateOfBirthField()
    const isPhoneValid = validateContactNumberField()
    const isPrcValid = validatePrcNumber()

    if (!isFnValid || !isLnValid || !isMnValid || !isDobValid || !isPhoneValid || !isPrcValid) {
      const firstError =
        errors.first_name ||
        errors.last_name ||
        errors.middle_name ||
        errors.date_of_birth ||
        errors.contact_number ||
        errors.prcNumber
      toast.error(firstError || 'Please fix the errors in the form before saving.')
      return
    }

    isLoading.value = true
    try {
      // Auto-geocode before saving if coordinates are empty
      if (!form.latitude || !form.longitude) {
        await geocodeAddress()
      }

      await userService.update(useCookie('user_uuid').value as string, form)
      form.idPhoto = null
      prcUploadedFileName.value = ''
      prcUploadedFileSize.value = ''
      if (prcFileInputRef.value) {
        prcFileInputRef.value.value = ''
      }
      initialFormState.value = JSON.stringify(form)
      isSuccess.value = true
      toast.success('Doctor profile updated successfully.')
      await Promise.all([refresh(), refreshProfile(), refreshNuxtData(`userProfile-${doctorUuid}`)])

      // Update name cookies so UI reflects the change (keep Dr. prefix if needed but cookies usually store raw name)
      const userName = useCookie('user_name')
      const authName = useCookie('auth_user_name')
      const fullDisplayName = [form.first_name, middleInitial.value, form.last_name]
        .filter(Boolean)
        .join(' ')
      userName.value = fullDisplayName
      authName.value = fullDisplayName

      setTimeout(() => {
        isSuccess.value = false
      }, 3500)
    } catch (error: any) {
      console.error('Failed to update profile:', error)
      toast.error(
        error?.response?.data?.message || error?.message || 'Failed to update doctor profile.'
      )
    } finally {
      isLoading.value = false
    }
  }

  const logout = () => {
    isLogoutModalOpen.value = false
    useCookie('auth_token').value = null
    useCookie('user_role').value = null
    useCookie('user_uuid').value = null
    useCookie('user_name').value = null
    useCookie('auth_user_name').value = null
    navigateTo('/auth/login')
  }
</script>

<template>
  <div class="space-y-6">
    <!-- Header (Mobile Only, Desktop uses AppNavbar) -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center md:hidden">
      <div>
        <h1 class="text-foreground text-2xl font-bold sm:text-3xl">Settings</h1>
        <p class="text-foreground/60 mt-1 text-sm">
          Manage your professional profile, clinic branches, schedule, and subscription.
        </p>
      </div>

      <div
        v-if="user?.doctor_verification?.status === 'verified'"
        class="bg-primary/10 text-primary border-primary/20 inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-1.5"
      >
        <Icon
          name="heroicons:shield-check-20-solid"
          size="18"
        />
        <span class="text-xs font-bold tracking-wider uppercase">Verified Professional</span>
      </div>
    </div>

    <!-- Profile Completion Alert -->
    <AppAlert
      v-if="missingDoctorFields.length > 0"
      title="Profile Setup Required"
      type="error"
    >
      Your profile is incomplete. Please fill out the following fields:
      <span class="font-bold underline">{{ missingDoctorFields.join(', ') }}</span
      >.
    </AppAlert>

    <!-- Inner Sidebar Layout Container -->
    <div class="flex flex-col items-start gap-6 lg:flex-row">
      <!-- Left Inner Sidebar (Compact & Sleek) -->
      <aside
        class="lg:scrollbar-none w-full shrink-0 space-y-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-5rem)] lg:w-64 lg:self-start lg:overflow-y-auto"
      >
        <!-- Doctor Quick Identity Card -->
        <div class="bg-card border-border rounded-2xl border p-4 text-center shadow-xs">
          <div class="relative mx-auto mb-3 h-16 w-16">
            <div
              class="from-primary/20 to-primary/5 border-primary/20 relative h-full w-full overflow-hidden rounded-full border bg-linear-to-br p-0.5 shadow-xs"
            >
              <NuxtImg
                v-if="user?.avatar_path"
                :src="getStorageUrl(user.avatar_path)"
                class="h-full w-full rounded-full object-cover"
                placeholder
              />
              <div
                v-else
                class="bg-sidebar/60 text-primary flex h-full w-full items-center justify-center rounded-full text-base font-bold tracking-tight"
              >
                Dr. {{ form.last_name?.charAt(0) || 'D' }}
              </div>
            </div>
            <button
              type="button"
              @click="triggerAvatarUpload"
              :disabled="isUploadingAvatar"
              title="Upload profile picture"
              class="bg-primary hover:bg-primary/90 border-background focus:ring-primary/30 absolute -right-1 -bottom-1 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 text-white shadow-md transition hover:scale-110 focus:ring-2 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
            >
              <Icon
                v-if="!isUploadingAvatar"
                name="heroicons:camera-20-solid"
                size="12"
              />
              <Icon
                v-else
                name="heroicons:arrow-path-20-solid"
                class="animate-spin"
                size="12"
              />
            </button>
            <input
              ref="avatarInputRef"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              class="hidden"
              @change="handleAvatarFileChange"
            />
          </div>
          <h2 class="text-foreground truncate text-sm font-bold">
            Dr. {{ form.first_name }} {{ middleInitial ? middleInitial + ' ' : ''
            }}{{ form.last_name }}
          </h2>
          <p class="text-muted-foreground truncate text-[11px] italic">{{ form.email }}</p>
          <p
            v-if="form.contact_number"
            class="text-muted-foreground mt-0.5 flex items-center justify-center gap-1 truncate text-[11px]"
          >
            <Icon
              name="heroicons:phone-20-solid"
              size="11"
              class="text-primary/70 shrink-0"
            />
            <span>{{ form.contact_number }}</span>
          </p>

          <div
            class="border-border/60 mt-3 flex items-center justify-between border-t pt-3 text-[11px]"
          >
            <span class="text-muted-foreground font-medium">Verification</span>
            <AppProfileStatusBadge
              :is-complete="user?.doctor_verification?.status === 'verified'"
              :is-declined="user?.doctor_verification?.status === 'declined'"
              :is-pending="user?.doctor_verification?.status === 'pending'"
            />
          </div>
        </div>

        <!-- Inner Navigation Menu -->
        <div class="bg-card border-border space-y-1 rounded-2xl border p-2 shadow-xs">
          <button
            v-for="tab in navTabs"
            :key="tab.id"
            type="button"
            @click="activeTab = tab.id"
            class="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all"
            :class="
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                : 'hover:bg-foreground/5 text-foreground/70 hover:text-foreground font-medium'
            "
          >
            <div
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
              :class="
                activeTab === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-foreground/5 text-foreground/60 group-hover:bg-foreground/10 group-hover:text-foreground'
              "
            >
              <Icon
                :name="tab.icon"
                class="h-3.5 w-3.5"
              />
            </div>
            <div class="min-w-0 flex-1">
              <span class="block truncate text-xs leading-tight">{{ tab.label }}</span>
            </div>
            <Icon
              name="heroicons:chevron-right"
              class="h-3.5 w-3.5 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5"
              :class="activeTab === tab.id ? 'opacity-100' : ''"
            />
          </button>
        </div>
      </aside>

      <!-- Right Main Content Panel (Expanded) -->
      <main class="min-w-0 flex-1">
        <!-- 1. PROFILE & BIO TAB (2-Column Cards Architecture) -->
        <div
          v-if="activeTab === 'profile'"
          class="animate-in fade-in space-y-6 duration-300"
        >
          <form
            @submit.prevent="submitProfile"
            class="space-y-6"
          >
            <!-- 2-Column Cards Grid -->
            <div class="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
              <!-- Card 1: Doctor Identity & Medical Credentials -->
              <div
                class="bg-card border-border flex flex-col justify-between space-y-6 rounded-3xl border p-6 shadow-xs sm:p-7"
              >
                <div>
                  <!-- Card Header -->
                  <div class="mb-5 flex items-start gap-3.5">
                    <div
                      class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                    >
                      <Icon
                        name="heroicons:identification-20-solid"
                        size="22"
                      />
                    </div>
                    <div>
                      <h2 class="text-foreground text-base font-bold sm:text-lg">
                        Identity & Credentials
                      </h2>
                      <p class="text-muted-foreground mt-0.5 text-xs">
                        Your professional identification, contact details, and license.
                      </p>
                    </div>
                  </div>

                  <div class="bg-border/60 mb-5 h-px"></div>

                  <!-- Card 1 Fields -->
                  <div class="space-y-4">
                    <!-- First, Middle & Last Name -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div class="flex flex-col gap-1.5">
                        <label
                          class="text-foreground/70 flex items-center gap-1 text-xs font-bold tracking-wider uppercase"
                        >
                          First Name
                          <span class="font-bold text-rose-500">*</span>
                        </label>
                        <input
                          v-model="form.first_name"
                          type="text"
                          @keydown="blockNameKey"
                          :class="
                            errors.first_name
                              ? 'border-rose-400 focus:border-rose-500'
                              : 'border-border focus:border-primary'
                          "
                          class="bg-foreground/5 w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                          placeholder="Enter first name"
                        />
                        <p
                          v-if="errors.first_name"
                          class="mt-1 text-xs font-medium text-rose-500"
                        >
                          {{ errors.first_name }}
                        </p>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                          >Middle Name</label
                        >
                        <input
                          v-model="form.middle_name"
                          type="text"
                          @keydown="blockNameKey"
                          :class="
                            errors.middle_name
                              ? 'border-rose-400 focus:border-rose-500'
                              : 'border-border focus:border-primary'
                          "
                          class="bg-foreground/5 w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                          placeholder="Enter middle name (optional)"
                        />
                        <p
                          v-if="errors.middle_name"
                          class="mt-1 text-xs font-medium text-rose-500"
                        >
                          {{ errors.middle_name }}
                        </p>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label
                          class="text-foreground/70 flex items-center gap-1 text-xs font-bold tracking-wider uppercase"
                        >
                          Last Name
                          <span class="font-bold text-rose-500">*</span>
                        </label>
                        <input
                          v-model="form.last_name"
                          type="text"
                          @keydown="blockNameKey"
                          :class="
                            errors.last_name
                              ? 'border-rose-400 focus:border-rose-500'
                              : 'border-border focus:border-primary'
                          "
                          class="bg-foreground/5 w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                          placeholder="Enter last name"
                        />
                        <p
                          v-if="errors.last_name"
                          class="mt-1 text-xs font-medium text-rose-500"
                        >
                          {{ errors.last_name }}
                        </p>
                      </div>
                    </div>

                    <!-- Email Address -->
                    <div class="text-foreground flex flex-col gap-1.5">
                      <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                        >Email Address</label
                      >
                      <div class="relative">
                        <input
                          v-model="form.email"
                          type="email"
                          disabled
                          class="bg-foreground/5 border-border w-full cursor-not-allowed rounded-2xl border px-4 py-3 pr-9 text-sm font-medium opacity-60 outline-none"
                        />
                        <Icon
                          name="heroicons:lock-closed-20-solid"
                          class="text-muted-foreground/60 absolute top-1/2 right-3 -translate-y-1/2"
                          size="16"
                        />
                      </div>
                    </div>

                    <!-- PRC License Number (Below Email) -->
                    <div class="flex flex-col gap-1.5">
                      <div class="flex items-center justify-between">
                        <label
                          class="text-foreground/70 flex items-center gap-1 text-xs font-bold tracking-wider uppercase"
                        >
                          PRC License Number
                          <span
                            v-if="user?.doctor_verification?.status !== 'verified'"
                            class="font-bold text-rose-500"
                            >*</span
                          >
                        </label>
                        <span
                          v-if="user?.doctor_verification?.status === 'verified'"
                          class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-600 uppercase"
                        >
                          <Icon
                            name="heroicons:check-badge-20-solid"
                            size="12"
                          />
                          Verified
                        </span>
                        <span
                          v-else-if="user?.doctor_verification?.status === 'pending'"
                          class="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-600 uppercase"
                        >
                          <Icon
                            name="heroicons:clock-20-solid"
                            size="12"
                          />
                          Pending Review
                        </span>
                        <span
                          v-else-if="user?.doctor_verification?.status === 'declined'"
                          class="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-rose-600 uppercase"
                        >
                          <Icon
                            name="heroicons:x-circle-20-solid"
                            size="12"
                          />
                          Declined
                        </span>
                        <span
                          v-else
                          class="bg-muted/60 text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                        >
                          <Icon
                            name="heroicons:shield-exclamation-20-solid"
                            size="12"
                          />
                          Unverified
                        </span>
                      </div>
                      <div class="relative">
                        <input
                          v-model="form.prcNumber"
                          type="text"
                          maxlength="7"
                          :disabled="user?.doctor_verification?.status === 'verified'"
                          :class="[
                            user?.doctor_verification?.status === 'verified'
                              ? 'bg-foreground/5 text-muted-foreground border-border cursor-not-allowed opacity-70'
                              : errors.prcNumber
                                ? 'bg-foreground/5 border-rose-400 focus:border-rose-500'
                                : 'border-border focus:border-primary bg-foreground/5'
                          ]"
                          class="w-full rounded-2xl border px-4 py-3 pr-12 text-sm font-medium transition-all outline-none"
                          placeholder="Enter 7-digit PRC License Number"
                        />
                        <span
                          class="text-muted-foreground/60 absolute top-1/2 right-3 -translate-y-1/2 text-xs"
                        >
                          <Icon
                            v-if="user?.doctor_verification?.status === 'verified'"
                            name="heroicons:lock-closed-20-solid"
                            size="16"
                          />
                          <span
                            v-else
                            class="font-mono text-[10px] font-medium"
                            >{{ form.prcNumber ? form.prcNumber.length : 0 }}/7</span
                          >
                        </span>
                      </div>
                      <p
                        v-if="errors.prcNumber"
                        class="text-xs font-medium text-rose-500"
                      >
                        {{ errors.prcNumber }}
                      </p>
                      <p
                        v-else-if="user?.doctor_verification?.status === 'verified'"
                        class="text-muted-foreground/70 text-[11px] leading-tight"
                      >
                        PRC license number is officially verified and cannot be changed directly.
                      </p>
                      <p
                        v-else
                        class="text-muted-foreground/70 text-[11px] leading-tight"
                      >
                        Enter your official 7-digit PRC license number for verification.
                      </p>
                    </div>

                    <!-- PRC ID Document Photo Upload -->
                    <div class="flex flex-col gap-2">
                      <div class="flex items-center justify-between">
                        <label
                          class="text-foreground/70 flex items-center gap-1 text-xs font-bold tracking-wider uppercase"
                        >
                          PRC License ID Document / Card
                          <span
                            v-if="user?.doctor_verification?.status !== 'verified'"
                            class="font-bold text-rose-500"
                            >*</span
                          >
                        </label>
                        <span
                          v-if="
                            form.idPhoto ||
                            user?.doctor_verification?.id_photo_url ||
                            user?.doctor_verification?.id_photo_path
                          "
                          class="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                        >
                          <Icon
                            name="heroicons:document-check-20-solid"
                            size="14"
                          />
                          Document Attached
                        </span>
                      </div>

                      <!-- Hidden File Input -->
                      <input
                        ref="prcFileInputRef"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        class="hidden"
                        @change="handlePrcFileChange"
                      />

                      <!-- Rejection Notice if declined -->
                      <div
                        v-if="
                          user?.doctor_verification?.status === 'declined' &&
                          user?.doctor_verification?.rejection_reason
                        "
                        class="flex items-start gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300"
                      >
                        <Icon
                          name="heroicons:exclamation-triangle-20-solid"
                          class="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
                        />
                        <div class="space-y-0.5">
                          <span class="font-bold">Verification Note from Admin:</span>
                          <p class="text-rose-600/90 dark:text-rose-300/90">
                            {{ user.doctor_verification.rejection_reason }}
                          </p>
                          <p class="text-muted-foreground mt-1 text-[11px]">
                            Please re-upload a clear photo of your PRC ID card and update your
                            profile to resubmit.
                          </p>
                        </div>
                      </div>

                      <!-- State A: Newly selected photo in form -->
                      <div
                        v-if="form.idPhoto"
                        class="border-border bg-card flex items-center gap-4 rounded-2xl border p-3.5 shadow-xs"
                      >
                        <div
                          class="bg-muted/40 border-border/50 h-16 w-24 shrink-0 overflow-hidden rounded-xl border"
                        >
                          <img
                            :src="form.idPhoto"
                            alt="PRC ID Preview"
                            class="h-full w-full object-cover"
                          />
                        </div>
                        <div class="min-w-0 flex-1">
                          <p class="text-foreground truncate text-xs font-bold">
                            {{ prcUploadedFileName || 'PRC_ID_Document.png' }}
                          </p>
                          <p class="text-foreground/50 mt-0.5 text-[11px]">
                            {{ prcUploadedFileSize || 'Ready to submit with profile' }}
                          </p>
                          <div
                            class="mt-1 flex items-center gap-2"
                            v-if="user?.doctor_verification?.status !== 'verified'"
                          >
                            <button
                              type="button"
                              @click="triggerPrcUpload"
                              class="text-primary cursor-pointer text-[11px] font-semibold hover:underline"
                            >
                              Replace Photo
                            </button>
                            <span class="text-foreground/20 text-xs">•</span>
                            <button
                              type="button"
                              @click="removePrcPhoto"
                              class="text-destructive cursor-pointer text-[11px] font-semibold hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>

                      <!-- State B: Existing photo on server (when no new photo selected) -->
                      <div
                        v-else-if="
                          user?.doctor_verification?.id_photo_url ||
                          user?.doctor_verification?.id_photo_path
                        "
                        class="border-border bg-card flex items-center gap-4 rounded-2xl border p-3.5 shadow-xs"
                      >
                        <div
                          class="bg-muted/40 border-border/50 h-16 w-24 shrink-0 overflow-hidden rounded-xl border"
                        >
                          <img
                            :src="
                              user?.doctor_verification?.id_photo_url ||
                              getStorageUrl(user.doctor_verification.id_photo_path)
                            "
                            alt="Uploaded PRC ID"
                            class="h-full w-full object-cover"
                          />
                        </div>
                        <div class="min-w-0 flex-1">
                          <p class="text-foreground truncate text-xs font-bold">
                            Current Uploaded PRC ID
                          </p>
                          <p class="text-muted-foreground mt-0.5 text-[11px]">
                            Stored document for verification
                          </p>
                          <div
                            class="mt-1 flex items-center gap-2"
                            v-if="user?.doctor_verification?.status !== 'verified'"
                          >
                            <button
                              type="button"
                              @click="triggerPrcUpload"
                              class="text-primary flex cursor-pointer items-center gap-1 text-[11px] font-semibold hover:underline"
                            >
                              <Icon
                                name="heroicons:arrow-up-tray-20-solid"
                                size="12"
                              />
                              Upload Replacement
                            </button>
                          </div>
                        </div>
                      </div>

                      <!-- State C: No photo yet (Dropzone) -->
                      <div
                        v-else-if="user?.doctor_verification?.status !== 'verified'"
                        @click="triggerPrcUpload"
                        @dragover.prevent="isPrcDragging = true"
                        @dragleave.prevent="isPrcDragging = false"
                        @drop.prevent="handlePrcDrop"
                        :class="[
                          isPrcDragging
                            ? 'border-primary bg-primary/5'
                            : 'border-border/80 bg-foreground/2 hover:bg-foreground/5 hover:border-primary/50'
                        ]"
                        class="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition-all"
                      >
                        <div
                          class="bg-foreground/5 text-foreground/70 group-hover:bg-primary/10 group-hover:text-primary mb-2 flex h-10 w-10 items-center justify-center rounded-xl transition-all"
                        >
                          <Icon
                            name="heroicons:arrow-up-tray-20-solid"
                            class="h-5 w-5"
                          />
                        </div>
                        <p class="text-foreground text-xs font-semibold">
                          Click to browse or drag & drop PRC ID photo
                        </p>
                        <p class="text-muted-foreground mt-0.5 text-[11px]">
                          Supports JPG, PNG, WebP (up to 10MB)
                        </p>
                      </div>
                    </div>

                    <!-- Prescription Credentials & Digital Signature -->
                    <div class="col-span-full rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 sm:p-5 flex flex-col gap-4">
                      <div class="flex items-center justify-between border-b border-indigo-100/80 pb-2.5">
                        <div class="flex items-center gap-2">
                          <Icon name="material-symbols:prescriptions-outline-rounded" class="text-xl text-indigo-600" />
                          <div>
                            <h4 class="text-xs font-bold uppercase tracking-wider text-indigo-950">Prescription Credentials & Signature</h4>
                            <p class="text-[11px] text-gray-500">Required on official Rx slips (Philippine FDA / BIR regulations)</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          @click="showSignatureModal = true"
                          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-white border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors shadow-2xs"
                        >
                          <Icon name="lucide:pen-tool" class="text-xs" />
                          <span>{{ form.signatureUrl ? 'Update Signature' : 'Sign / Upload' }}</span>
                        </button>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div class="flex flex-col gap-1">
                          <label class="text-[10px] font-bold uppercase tracking-wider text-gray-700">PTR Number</label>
                          <input
                            v-model="form.ptrNumber"
                            type="text"
                            placeholder="e.g. PTR-1234567"
                            class="border-border bg-white focus:border-indigo-500 w-full rounded-xl border px-3 py-2 text-xs outline-none"
                          />
                          <span class="text-[9px] text-gray-400">Professional Tax Receipt</span>
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-[10px] font-bold uppercase tracking-wider text-gray-700">TIN Number</label>
                          <input
                            v-model="form.tinNumber"
                            type="text"
                            placeholder="e.g. 123-456-789-000"
                            class="border-border bg-white focus:border-indigo-500 w-full rounded-xl border px-3 py-2 text-xs outline-none"
                          />
                          <span class="text-[9px] text-gray-400">Tax Identification Number</span>
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-[10px] font-bold uppercase tracking-wider text-gray-700">PDEA S2 License</label>
                          <input
                            v-model="form.s2Number"
                            type="text"
                            placeholder="Optional (leave blank if none)"
                            class="border-border bg-white focus:border-indigo-500 w-full rounded-xl border px-3 py-2 text-xs outline-none"
                          />
                          <span class="text-[9px] text-gray-400">Dangerous Drugs License</span>
                        </div>
                      </div>

                      <!-- Signature Preview Box -->
                      <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                        <div class="flex items-center gap-3">
                          <div class="w-24 h-12 border border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden p-1">
                            <img v-if="form.signatureUrl" :src="form.signatureUrl" class="max-h-full max-w-full object-contain" alt="Signature preview" />
                            <span v-else class="text-[10px] text-gray-400 font-semibold italic">No signature</span>
                          </div>
                          <div>
                            <span class="text-xs font-bold text-gray-800 block">Digital Prescription Signature</span>
                            <span class="text-[11px] text-gray-500">
                              {{ form.signatureUrl ? 'Configured & active on all Rx printouts' : 'Draw or upload to authenticate electronic prescriptions' }}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          @click="showSignatureModal = true"
                          class="text-xs font-semibold text-indigo-600 hover:underline"
                        >
                          {{ form.signatureUrl ? 'Change Signature' : 'Set Signature' }}
                        </button>
                      </div>
                    </div>

                    <!-- Date of Birth & Gender -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div class="flex flex-col gap-1.5">
                        <div class="flex items-center justify-between">
                          <label
                            class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                            >Date of Birth</label
                          >
                          <span
                            v-if="calculatedDoctorAge !== null"
                            class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          >
                            <Icon
                              name="heroicons:cake-20-solid"
                              size="12"
                            />
                            {{ calculatedDoctorAge }} yrs old
                          </span>
                        </div>
                        <input
                          v-model="form.date_of_birth"
                          type="date"
                          :max="todayIsoDate"
                          :class="
                            errors.date_of_birth
                              ? 'border-rose-400 focus:border-rose-500'
                              : 'border-border focus:border-primary'
                          "
                          class="bg-foreground/5 w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                        />
                        <p
                          v-if="errors.date_of_birth"
                          class="mt-1 text-xs font-medium text-rose-500"
                        >
                          {{ errors.date_of_birth }}
                        </p>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                          >Gender</label
                        >
                        <select
                          v-model="form.gender"
                          class="bg-foreground/5 border-border focus:border-primary w-full cursor-pointer appearance-none rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                        >
                          <option value="">Not Set</option>
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                          <option value="Other">Other</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>
                    </div>

                    <!-- Contact Number -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div class="flex flex-col gap-1.5">
                        <AppPhoneInput
                          v-model="form.contact_number"
                          label="Mobile / Contact Number"
                          :error="errors.contact_number"
                          placeholder="917 123 4567"
                          @blur="validateContactNumberField"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Card 2: Practice Location & Primary Clinic Address -->
              <AppLocationCascade
                v-model:province="form.province"
                v-model:city="form.city"
                v-model:barangay="form.barangay"
                v-model:street="form.street"
                :coordinates="formattedCoordinates"
                title="Practice & Clinic Location"
                subtitle="Where patients will locate your consultation practice."
                street-label="Street Address / Practice Location"
                street-placeholder="House No., Street Name, Clinic/Hospital Room"
                icon="heroicons:map-pin-20-solid"
                @change="geocodeAddress"
              />
            </div>

            <!-- Unified Bottom Action Bar -->
            <div
              class="bg-card border-border flex flex-col items-center justify-between gap-4 rounded-3xl border p-4 shadow-xs sm:flex-row sm:px-6"
            >
              <div class="flex items-center gap-3">
                <div
                  v-if="isSuccess"
                  class="animate-in fade-in flex items-center gap-2 text-sm font-bold text-emerald-600 duration-200"
                >
                  <Icon
                    name="heroicons:check-circle-20-solid"
                    size="20"
                  />
                  <span>Doctor profile updated successfully!</span>
                </div>
                <div
                  v-else-if="formattedCoordinates"
                  class="text-muted-foreground flex items-center gap-1.5 text-xs font-medium"
                >
                  <Icon
                    name="heroicons:map-pin"
                    class="text-emerald-500"
                    size="16"
                  />
                  <span>Practice coordinates are mapped for patient discovery</span>
                </div>
                <div
                  v-else
                  class="text-muted-foreground text-xs"
                >
                  Modify any field above to update your professional information.
                </div>
              </div>

              <AppButton
                type="submit"
                :loading="isLoading"
                :disabled="isLoading || !hasFormChanges"
                class="w-full min-w-[140px] sm:w-auto"
              >
                Save Profile
              </AppButton>
            </div>
          </form>
        </div>

        <!-- 2. CLINIC BRANCHES TAB -->
        <div
          v-else-if="activeTab === 'clinics'"
          class="bg-card border-border animate-in fade-in space-y-6 rounded-3xl border p-6 shadow-xs duration-300 sm:p-8"
        >
          <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 class="text-foreground text-xl font-bold">Clinics & Doctor Team</h2>
              <p class="text-muted-foreground mt-1 text-xs">
                {{
                  isOwner
                    ? 'Manage your registered clinic locations and allocate associate doctor seats.'
                    : 'View your clinic locations, head doctor, and affiliated medical staff.'
                }}
              </p>
            </div>
            <AppButton
              v-if="isOwner"
              variant="solid"
              size="sm"
              @click="showAddClinicModal = true"
            >
              <Icon
                name="heroicons:plus"
                class="mr-1 h-4 w-4"
              />
              <span>Add Clinic</span>
            </AppButton>
          </div>

          <div class="bg-border h-px"></div>

          <!-- Clinics List -->
          <div
            v-if="!clinics.length"
            class="border-border bg-foreground/[0.02] rounded-2xl border border-dashed p-10 text-center"
          >
            <Icon
              name="heroicons:building-office-2"
              class="text-foreground/30 mx-auto mb-3 text-5xl"
            />
            <h4 class="text-foreground text-sm font-bold">No clinics registered yet</h4>
            <p class="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
              Click "Add Clinic" above to register your first clinic or hospital location.
            </p>
          </div>

          <div
            v-else
            class="grid gap-4 sm:grid-cols-2"
          >
            <div
              v-for="clinic in clinics"
              :key="clinic.uuid || clinic.id"
              class="border-border bg-foreground/[0.02] hover:border-primary/40 group flex flex-col justify-between gap-4 rounded-2xl border p-5 shadow-2xs transition"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 items-start gap-3">
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                    :class="
                      clinic.is_owner !== false
                        ? 'bg-primary/10 text-primary'
                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    "
                  >
                    <Icon
                      :name="
                        clinic.is_owner !== false
                          ? 'heroicons:building-office-2'
                          : 'heroicons:building-library'
                      "
                      class="h-5 w-5"
                    />
                  </div>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h4 class="text-foreground line-clamp-1 text-sm font-bold">
                        {{ clinic.name }}
                      </h4>
                      <span
                        v-if="clinic.is_owner !== false"
                        class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600"
                      >
                        Owned Clinic
                      </span>
                      <span
                        v-else
                        class="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400"
                      >
                        Affiliated Clinic
                      </span>
                    </div>
                    <p
                      v-if="clinic.address"
                      class="text-muted-foreground mt-0.5 line-clamp-1 text-xs"
                    >
                      {{ clinic.address }}
                    </p>
                    <p
                      v-if="clinic.is_owner === false && clinic.owner_doctor"
                      class="text-muted-foreground mt-0.5 text-[11px]"
                    >
                      Head Doctor:
                      <strong class="text-foreground"
                        >Dr. {{ clinic.owner_doctor.full_name }}</strong
                      >
                    </p>
                  </div>
                </div>

                <!-- Actions: Edit & Delete Clinic (ONLY FOR OWNER) -->
                <div
                  v-if="clinic.is_owner !== false"
                  class="flex shrink-0 items-center gap-1"
                >
                  <button
                    type="button"
                    @click="openEditClinicModal(clinic)"
                    class="text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer rounded-xl p-1.5 transition"
                    title="Edit Clinic Details"
                  >
                    <Icon
                      name="heroicons:pencil-square"
                      class="h-4 w-4"
                    />
                  </button>
                  <button
                    type="button"
                    @click="confirmDeleteClinic(clinic)"
                    class="text-muted-foreground shrink-0 cursor-pointer rounded-xl p-1.5 transition hover:bg-red-500/10 hover:text-red-500"
                    title="Remove Clinic"
                  >
                    <Icon
                      name="heroicons:trash"
                      class="h-4 w-4"
                    />
                  </button>
                </div>
                <span
                  v-else
                  class="shrink-0 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-indigo-600 uppercase dark:text-indigo-400"
                >
                  Affiliated
                </span>
              </div>

              <div
                class="text-muted-foreground border-border/60 flex items-center justify-between border-t pt-3 text-xs"
              >
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span class="inline-flex items-center gap-1.5">
                    <Icon
                      name="heroicons:phone"
                      class="text-primary h-3.5 w-3.5"
                    />
                    {{ clinic.phone || 'No phone set' }}
                  </span>
                  <span
                    v-if="clinic.email"
                    class="inline-flex items-center gap-1.5"
                  >
                    <Icon
                      name="heroicons:envelope"
                      class="text-primary h-3.5 w-3.5"
                    />
                    {{ clinic.email }}
                  </span>
                </div>
                <span
                  v-if="clinic.is_active !== false"
                  class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
                >
                  Active
                </span>
                <span
                  v-else
                  class="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400"
                >
                  Inactive
                </span>
              </div>
            </div>
          </div>

          <!-- DOCTOR SEATS & ASSOCIATE DOCTORS SECTION -->
          <div
            id="seats"
            class="border-border space-y-6 border-t pt-6"
          >
            <!-- A. ASSOCIATE DOCTOR VIEW: Practice Head Sponsor + Colleague Associate Doctors -->
            <div
              v-if="!isOwner"
              class="space-y-6"
            >
              <!-- Header -->
              <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="text-foreground text-lg font-bold">Doctor Team & Affiliations</h3>
                    <span
                      class="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400"
                    >
                      Associate Doctor
                    </span>
                  </div>
                  <p class="text-muted-foreground mt-1 text-xs">
                    You are affiliated with
                    <strong class="text-foreground">{{
                      sponsoringClinic?.name || 'Clinic Location'
                    }}</strong>
                    under
                    <strong class="text-foreground"
                      >Dr. {{ clinicOwner?.full_name || 'Head Doctor' }}</strong
                    >'s Clinic Group Plan.
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <span
                    class="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:border-indigo-800/50 dark:bg-indigo-950/50 dark:text-indigo-300"
                  >
                    <Icon
                      name="lucide:shield-check"
                      class="h-4 w-4 text-indigo-600 dark:text-indigo-400"
                    />
                    <span>Active Clinic Sponsorship</span>
                  </span>
                </div>
              </div>

              <!-- Head Doctor / Clinic Owner Card -->
              <div
                class="via-card to-card rounded-3xl border border-indigo-500/20 bg-linear-to-r from-indigo-50/50 p-6 shadow-xs dark:from-indigo-950/20"
              >
                <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div class="flex items-start gap-4 sm:items-center">
                    <div
                      class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white uppercase shadow-sm"
                    >
                      {{
                        (clinicOwner?.first_name?.[0] || 'D') + (clinicOwner?.last_name?.[0] || 'R')
                      }}
                    </div>
                    <div>
                      <div class="flex flex-wrap items-center gap-2">
                        <h4 class="text-foreground text-base font-bold">
                          Dr. {{ clinicOwner?.full_name }}
                        </h4>
                        <span
                          class="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs"
                        >
                          Clinic Owner / Head Doctor
                        </span>
                      </div>
                      <p class="text-muted-foreground mt-0.5 text-xs">{{ clinicOwner?.email }}</p>
                      <div
                        class="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-4 text-xs"
                      >
                        <span
                          v-if="clinicOwner?.prc_number"
                          class="text-foreground/80 font-mono font-medium"
                        >
                          PRC: {{ clinicOwner.prc_number }}
                        </span>
                        <span
                          v-if="clinicOwner?.affiliation"
                          class="inline-flex items-center gap-1"
                        >
                          <Icon
                            name="lucide:hospital"
                            class="h-3.5 w-3.5 text-indigo-500"
                          />
                          {{ clinicOwner.affiliation }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    class="border-border/60 shrink-0 border-t pt-3 sm:border-t-0 sm:pt-0 sm:text-right"
                  >
                    <span
                      class="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase"
                      >Clinic Subscription Tier</span
                    >
                    <span class="text-foreground mt-0.5 block text-sm font-bold">
                      {{ clinicOwner?.plan_name || 'Clinic Group Plan' }}
                    </span>
                    <span class="mt-0.5 block text-[11px] font-semibold text-emerald-600">
                      {{ seatUsage?.used_seats ?? 1 }} / {{ seatUsage?.max_doctors ?? 10 }} Doctor
                      Seats Used
                    </span>
                  </div>
                </div>
              </div>

              <!-- Associate Doctors in this Clinic -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <h4
                    class="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase"
                  >
                    <Icon
                      name="lucide:users"
                      class="text-primary h-4 w-4"
                    />
                    <span>Associate Doctors ({{ clinicDoctors.length }})</span>
                  </h4>
                </div>

                <div
                  v-if="!clinicDoctors.length"
                  class="border-border text-muted-foreground rounded-2xl border border-dashed p-6 text-center text-xs"
                >
                  No other associate doctors assigned in this clinic group yet.
                </div>

                <div
                  v-else
                  class="grid gap-4 sm:grid-cols-2"
                >
                  <div
                    v-for="assoc in clinicDoctors"
                    :key="assoc.pivot_id"
                    class="flex flex-col justify-between gap-4 rounded-2xl border p-5 shadow-2xs transition"
                    :class="
                      assoc.doctor.email === user?.email
                        ? 'border-indigo-500/50 bg-indigo-50/20 ring-2 ring-indigo-500/10 dark:bg-indigo-950/10'
                        : 'border-border bg-foreground/[0.02] hover:border-border/80'
                    "
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex min-w-0 items-center gap-3">
                        <div
                          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold uppercase"
                          :class="
                            assoc.doctor.email === user?.email
                              ? 'bg-indigo-600 text-white'
                              : 'bg-primary/10 text-primary'
                          "
                        >
                          {{
                            (assoc.doctor.first_name?.[0] || 'D') +
                            (assoc.doctor.last_name?.[0] || 'R')
                          }}
                        </div>
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-1.5">
                            <h4 class="text-foreground truncate text-sm font-bold">
                              Dr. {{ assoc.doctor.full_name }}
                            </h4>
                            <span
                              v-if="assoc.doctor.email === user?.email"
                              class="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase"
                            >
                              You
                            </span>
                          </div>
                          <p class="text-muted-foreground truncate text-xs">
                            {{ assoc.doctor.email }}
                          </p>
                          <p
                            v-if="assoc.doctor.prc_number"
                            class="text-foreground/60 mt-0.5 font-mono text-[11px]"
                          >
                            PRC: {{ assoc.doctor.prc_number }}
                          </p>
                        </div>
                      </div>

                      <span
                        class="bg-foreground/10 text-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize"
                      >
                        {{ assoc.role }}
                      </span>
                    </div>

                    <div
                      class="text-muted-foreground border-border/60 flex items-center justify-between border-t pt-3 text-xs"
                    >
                      <span
                        class="text-foreground inline-flex max-w-[65%] items-center gap-1.5 truncate font-medium"
                      >
                        <Icon
                          name="lucide:building-2"
                          class="text-primary h-3.5 w-3.5 shrink-0"
                        />
                        {{ assoc.clinic.name }}
                      </span>
                      <span
                        v-if="assoc.status === 'pending'"
                        class="border-warning-border bg-warning-subtle text-warning-text shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold"
                      >
                        Invitation Pending
                      </span>
                      <span
                        v-else
                        class="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600"
                      >
                        Active Associate
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- B. CLINIC OWNER VIEW: Full Management with Pool Progress, Assign Modal & Revoke Seat -->
            <div
              v-else
              class="space-y-6"
            >
              <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="text-foreground text-lg font-bold">Doctor Team & Seat Allocation</h3>
                    <span
                      v-if="seatUsage?.max_doctors && seatUsage.max_doctors > 1"
                      class="bg-primary/10 text-primary border-primary/20 rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                    >
                      Multi-Doctor Plan
                    </span>
                  </div>
                  <p class="text-muted-foreground mt-1 text-xs">
                    Assign licensed dermatologists to your clinic seats to share AI scans,
                    consultations, and practice features.
                  </p>
                </div>

                <AppButton
                  variant="solid"
                  size="sm"
                  :disabled="!clinics.length || (seatUsage && !seatUsage.can_add)"
                  @click="openAssignDoctorModal"
                >
                  <Icon
                    name="lucide:user-plus"
                    class="mr-1 h-4 w-4"
                  />
                  <span>Assign Associate Doctor</span>
                </AppButton>
              </div>

              <!-- Seat Quota Banner -->
              <div
                class="border-border bg-foreground/[0.02] flex flex-col justify-between gap-4 rounded-2xl border p-5 md:flex-row md:items-center"
              >
                <div class="flex-1 space-y-1.5">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-foreground flex items-center gap-2 font-bold">
                      <Icon
                        name="lucide:users"
                        class="text-primary h-4 w-4"
                      />
                      Doctor Seat Allocation
                    </span>
                    <span class="text-primary font-bold">
                      {{ seatUsage?.used_seats ?? 1 }} /
                      {{ seatUsage?.max_doctors ?? (mySubscription?.plan?.max_doctors || '1') }}
                      Seats Used
                    </span>
                  </div>
                  <!-- Progress Bar -->
                  <div class="bg-foreground/10 h-2.5 w-full overflow-hidden rounded-full">
                    <div
                      class="bg-primary h-full rounded-full transition-all duration-500"
                      :style="{
                        width: seatUsage?.max_doctors
                          ? `${Math.min(100, Math.round(((seatUsage.used_seats || 1) / seatUsage.max_doctors) * 100))}%`
                          : '10%'
                      }"
                    ></div>
                  </div>
                  <div class="text-muted-foreground flex items-center justify-between text-[11px]">
                    <span
                      >1 Owner (You) + {{ (seatUsage?.used_seats || 1) - 1 }} Associate{{
                        (seatUsage?.used_seats || 1) - 1 === 1 ? '' : 's'
                      }}</span
                    >
                    <span
                      v-if="seatUsage?.available_seats !== null"
                      class="font-semibold text-emerald-600"
                    >
                      {{ seatUsage?.available_seats }} seat{{
                        seatUsage?.available_seats === 1 ? '' : 's'
                      }}
                      available
                    </span>
                    <span
                      v-else
                      class="font-semibold text-emerald-600"
                      >Unlimited seats available</span
                    >
                  </div>
                </div>
              </div>

              <!-- Warning if single doctor plan -->
              <div
                v-if="seatUsage && seatUsage.max_doctors === 1"
                class="border-warning-border bg-warning-subtle text-warning-text flex items-center justify-between gap-3 rounded-2xl border p-4 text-xs shadow-2xs"
              >
                <div class="flex items-center gap-2.5">
                  <Icon
                    name="lucide:info"
                    class="text-warning h-5 w-5 shrink-0"
                  />
                  <span
                    >Your current plan only supports 1 doctor seat. Upgrade to the
                    <strong>Clinic Group Plan</strong> to add up to 10 doctors.</span
                  >
                </div>
                <NuxtLink
                  to="/doctor/subscription"
                  class="bg-warning shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-95"
                >
                  Upgrade Plan
                </NuxtLink>
              </div>

              <!-- Warning if no clinics registered yet -->
              <div
                v-else-if="!clinics.length"
                class="flex items-center gap-2.5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs text-blue-700 dark:text-blue-400"
              >
                <Icon
                  name="lucide:info"
                  class="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
                />
                <span
                  >Please add at least one clinic branch above before assigning associate doctors to
                  clinic seats.</span
                >
              </div>

              <!-- Associate Doctors List -->
              <div
                v-if="!clinicDoctors.length"
                class="border-border bg-foreground/[0.01] rounded-2xl border border-dashed p-8 text-center"
              >
                <Icon
                  name="lucide:users"
                  class="text-foreground/30 mx-auto mb-2 text-4xl"
                />
                <h4 class="text-foreground text-sm font-bold">No associate doctors added yet</h4>
                <p class="text-muted-foreground mx-auto mt-1 max-w-md text-xs">
                  Invite associate dermatologists or resident doctors to join your clinic branch.
                  They will automatically inherit your subscription features.
                </p>
              </div>

              <div
                v-else
                class="grid gap-4 sm:grid-cols-2"
              >
                <div
                  v-for="assoc in clinicDoctors"
                  :key="assoc.pivot_id"
                  class="border-border bg-foreground/[0.02] hover:border-primary/40 flex flex-col justify-between gap-4 rounded-2xl border p-5 shadow-2xs transition"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex min-w-0 items-center gap-3">
                      <div
                        class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold uppercase"
                      >
                        {{
                          (assoc.doctor.first_name?.[0] || 'D') +
                          (assoc.doctor.last_name?.[0] || 'R')
                        }}
                      </div>
                      <div class="min-w-0">
                        <h4 class="text-foreground truncate text-sm font-bold">
                          Dr. {{ assoc.doctor.full_name }}
                        </h4>
                        <p class="text-muted-foreground truncate text-xs">
                          {{ assoc.doctor.email }}
                        </p>
                        <p
                          v-if="assoc.doctor.prc_number"
                          class="text-foreground/60 mt-0.5 font-mono text-[11px]"
                        >
                          PRC: {{ assoc.doctor.prc_number }}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      @click="confirmRevokeDoctorSeat(assoc.pivot_id, assoc.doctor.full_name)"
                      class="text-muted-foreground shrink-0 cursor-pointer rounded-xl p-1.5 transition hover:bg-red-500/10 hover:text-red-500"
                      title="Revoke Doctor Seat"
                    >
                      <Icon
                        name="lucide:trash-2"
                        class="h-4 w-4"
                      />
                    </button>
                  </div>

                  <div
                    class="text-muted-foreground border-border/60 flex items-center justify-between border-t pt-3 text-xs"
                  >
                    <span
                      class="text-foreground inline-flex max-w-[60%] items-center gap-1.5 truncate font-medium"
                    >
                      <Icon
                        name="lucide:building-2"
                        class="text-primary h-3.5 w-3.5 shrink-0"
                      />
                      {{ assoc.clinic.name }}
                    </span>
                    <div class="flex shrink-0 items-center gap-2">
                      <span
                        class="bg-foreground/10 text-foreground rounded-full px-2 py-0.5 text-[10px] font-bold capitalize"
                      >
                        {{ assoc.role }}
                      </span>
                      <span
                        v-if="assoc.status === 'pending'"
                        class="border-warning-border bg-warning-subtle text-warning-text rounded-full border px-2 py-0.5 text-[10px] font-bold"
                      >
                        Invitation Pending
                      </span>
                      <span
                        v-else
                        class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600"
                      >
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. DUTY & AWAY PRESETS TAB -->
        <div
          v-else-if="activeTab === 'schedule'"
          id="blocked-dates"
          class="bg-card border-border animate-in fade-in space-y-6 rounded-3xl border p-6 shadow-xs duration-300 sm:p-8"
        >
          <div>
            <h2 class="text-foreground text-xl font-bold">Schedule & Availability</h2>
            <p class="text-muted-foreground mt-1 text-xs">
              Preset the clinic locations where you are on duty on specific dates, or set
              blocked/away periods.
            </p>
          </div>

          <div class="bg-border h-px"></div>

          <!-- Add Schedule / Availability Form -->
          <form
            @submit.prevent="addAvailability"
            class="flex flex-col gap-5"
          >
            <!-- Schedule Type Tabs -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="scheduleType = 'duty'"
                class="flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all"
                :class="
                  scheduleType === 'duty'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-2xs'
                    : 'bg-foreground/5 text-foreground/60 hover:text-foreground border-transparent'
                "
              >
                <Icon
                  name="heroicons:building-office-2"
                  class="h-4 w-4 text-emerald-600"
                />
                <span>Clinic Duty Hours</span>
              </button>

              <button
                type="button"
                @click="scheduleType = 'away'"
                class="flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all"
                :class="
                  scheduleType === 'away'
                    ? 'border-rose-300 bg-rose-50 text-rose-800 shadow-2xs'
                    : 'bg-foreground/5 text-foreground/60 hover:text-foreground border-transparent'
                "
              >
                <Icon
                  name="heroicons:no-symbol"
                  class="h-4 w-4 text-rose-600"
                />
                <span>Blocked / Away Period</span>
              </button>
            </div>

            <!-- Clinic Selector (Shown for Duty hours) -->
            <div
              v-if="scheduleType === 'duty'"
              class="space-y-1.5"
            >
              <label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
                >Select Clinic Location *</label
              >
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="relative w-full">
                  <select
                    v-if="clinics.length > 0"
                    v-model="selectedClinicId"
                    class="border-border bg-foreground/5 focus:border-primary w-full cursor-pointer appearance-none rounded-2xl border px-4 py-3 pr-10 text-sm font-semibold transition-all outline-none"
                  >
                    <option
                      :value="null"
                      disabled
                    >
                      -- Choose a registered clinic branch --
                    </option>
                    <option
                      v-for="c in clinics"
                      :key="c.id"
                      :value="c.id"
                    >
                      {{ c.name }} {{ c.address ? `(${c.address})` : '' }}
                    </option>
                  </select>
                  <div
                    v-if="clinics.length > 0"
                    class="text-muted-foreground/60 pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5"
                  >
                    <Icon
                      name="heroicons:chevron-down-20-solid"
                      class="h-4 w-4"
                    />
                  </div>
                </div>

                <input
                  v-if="clinics.length === 0 || !selectedClinicId"
                  v-model="customLocation"
                  type="text"
                  placeholder="Or type clinic name / room..."
                  class="border-border bg-foreground/5 focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium outline-none"
                />
              </div>
            </div>

            <!-- Schedule Mode Toggle (Single Date vs Repeat on Days of Week) -->
            <div
              class="border-border/60 flex flex-col justify-between gap-3 border-b pt-1 pb-3 sm:flex-row sm:items-center"
            >
              <div>
                <span class="text-foreground text-xs font-bold">Schedule Frequency</span>
                <p class="text-muted-foreground text-[11px]">
                  Apply schedule for a single date or recurring days of the week
                </p>
              </div>
              <div
                class="border-border/60 bg-foreground/5 inline-flex self-start rounded-xl border p-1 sm:self-auto"
              >
                <button
                  type="button"
                  @click="scheduleMode = 'single'"
                  class="cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition-all"
                  :class="
                    scheduleMode === 'single'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                >
                  Single Date
                </button>
                <button
                  type="button"
                  @click="scheduleMode = 'recurring'"
                  class="cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition-all"
                  :class="
                    scheduleMode === 'recurring'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                >
                  Repeat on Days
                </button>
              </div>
            </div>

            <!-- Recurring Weekdays Selection (Shown in Recurring Mode) -->
            <div
              v-if="scheduleMode === 'recurring'"
              class="border-border/70 bg-foreground/[0.02] space-y-3 rounded-2xl border p-4"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Select Days of Week *
                  </span>
                  <span
                    v-if="recurringStartWeekdayName"
                    class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  >
                    <span class="bg-primary h-1.5 w-1.5 animate-pulse rounded-full"></span>
                    {{ recurringStartWeekdayName }} (Start)
                  </span>
                </div>
                <div
                  class="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold"
                >
                  <span class="text-foreground/40">Presets:</span>
                  <button
                    type="button"
                    @click="setWeekdayPreset('weekdays')"
                    class="bg-foreground/5 hover:bg-foreground/10 hover:text-foreground cursor-pointer rounded-md px-2 py-0.5 transition"
                  >
                    Weekdays
                  </button>
                  <button
                    type="button"
                    @click="setWeekdayPreset('mwf')"
                    class="bg-foreground/5 hover:bg-foreground/10 hover:text-foreground cursor-pointer rounded-md px-2 py-0.5 transition"
                  >
                    MWF
                  </button>
                  <button
                    type="button"
                    @click="setWeekdayPreset('tths')"
                    class="bg-foreground/5 hover:bg-foreground/10 hover:text-foreground cursor-pointer rounded-md px-2 py-0.5 transition"
                  >
                    TThS
                  </button>
                  <button
                    type="button"
                    @click="setWeekdayPreset('clear')"
                    class="bg-foreground/5 hover:bg-foreground/10 hover:text-foreground cursor-pointer rounded-md px-2 py-0.5 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <!-- Day Pill Buttons -->
              <div class="grid grid-cols-7 gap-1.5 sm:gap-2">
                <div
                  v-for="opt in weekdayOptions"
                  :key="opt.day"
                  class="group/day relative"
                >
                  <button
                    type="button"
                    :disabled="getWeekDateForDay(opt.day).isPast"
                    @click="toggleRecurringDay(opt.day)"
                    class="relative flex min-h-[46px] w-full flex-col items-center justify-center rounded-xl border py-2 text-xs font-bold transition-all"
                    :class="[
                      getWeekDateForDay(opt.day).isPast
                        ? 'border-border/40 bg-foreground/[0.02] text-muted-foreground/35 cursor-not-allowed opacity-50'
                        : recurringDays.includes(opt.day)
                          ? 'border-primary bg-primary text-primary-foreground cursor-pointer shadow-2xs'
                          : 'border-border/60 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground cursor-pointer',
                      getBlockedInfoForWeekday(opt.day).length > 0 &&
                      !recurringDays.includes(opt.day) &&
                      !getWeekDateForDay(opt.day).isPast
                        ? 'border-rose-400/50 dark:border-rose-500/40'
                        : '',
                      isStartWeekday(opt.day) &&
                      !recurringDays.includes(opt.day) &&
                      !getWeekDateForDay(opt.day).isPast
                        ? 'border-primary/60 ring-primary/30 ring-2'
                        : ''
                    ]"
                    :title="
                      getWeekDateForDay(opt.day).isPast
                        ? `Cannot schedule past date (${getWeekDateForDay(opt.day).dateStr})`
                        : undefined
                    "
                  >
                    <!-- Day Label + Date Number beside it -->
                    <div class="flex items-center gap-1 leading-none">
                      <span>{{ opt.label }}</span>
                      <span
                        class="text-[11px] font-extrabold"
                        :class="
                          getWeekDateForDay(opt.day).isPast
                            ? 'opacity-40'
                            : recurringDays.includes(opt.day)
                              ? 'text-primary-foreground/90'
                              : 'text-foreground/70'
                        "
                      >
                        {{ getWeekDateForDay(opt.day).dateNum }}
                      </span>
                    </div>

                    <!-- Dot indicator for selected From Date -->
                    <span
                      v-if="isStartWeekday(opt.day) && !getWeekDateForDay(opt.day).isPast"
                      class="mt-1 flex h-1.5 w-1.5 items-center justify-center"
                      :title="`Date Selected (${formatReadableDate(recurringStartDate)}) is on ${opt.label}`"
                    >
                      <span
                        class="h-1.5 w-1.5 rounded-full transition-all"
                        :class="
                          recurringDays.includes(opt.day)
                            ? 'bg-white shadow-xs'
                            : 'bg-primary ring-primary/20 ring-2'
                        "
                      ></span>
                    </span>
                    <span
                      v-else-if="getWeekDateForDay(opt.day).isPast"
                      class="text-muted-foreground/50 mt-0.5 text-[8px] font-semibold tracking-wider uppercase"
                    >
                      Past
                    </span>
                    <span
                      v-else
                      class="mt-1 h-1.5 w-1.5 opacity-0"
                    ></span>

                    <!-- Blocked Indicator Pill / Dot (Only shown if not past) -->
                    <span
                      v-if="
                        getBlockedInfoForWeekday(opt.day).length > 0 &&
                        !getWeekDateForDay(opt.day).isPast
                      "
                      class="absolute -top-1.5 -right-1 flex h-4 items-center gap-0.5 rounded-full px-1 text-[8px] font-extrabold shadow-xs transition-transform group-hover/day:scale-110"
                      :class="
                        recurringDays.includes(opt.day)
                          ? 'ring-primary bg-rose-500 text-white ring-2'
                          : 'ring-card bg-rose-500 text-white ring-2'
                      "
                      title="Blocked date on this day"
                    >
                      <span class="h-1 w-1 animate-pulse rounded-full bg-white"></span>
                      <span>Off</span>
                    </span>
                  </button>

                  <!-- Tooltip / Popover on Hover showing what's in there -->
                  <div
                    v-if="getBlockedInfoForWeekday(opt.day).length > 0"
                    class="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-48 -translate-x-1/2 translate-y-1 opacity-0 transition-all duration-150 group-hover/day:translate-y-0 group-hover/day:opacity-100 sm:w-56"
                  >
                    <div
                      class="border-border/90 bg-popover text-popover-foreground rounded-2xl border p-2.5 text-left shadow-xl"
                    >
                      <div
                        class="border-border/60 mb-1.5 flex items-center gap-1.5 border-b pb-1.5"
                      >
                        <Icon
                          name="heroicons:no-symbol-20-solid"
                          class="h-3.5 w-3.5 shrink-0 text-rose-500"
                        />
                        <span class="text-foreground text-[11px] font-bold">
                          Time Off on {{ opt.label }}
                        </span>
                      </div>

                      <div class="max-h-32 space-y-1.5 overflow-y-auto">
                        <div
                          v-for="(item, idx) in getBlockedInfoForWeekday(opt.day)"
                          :key="idx"
                          class="rounded-lg border border-rose-500/20 bg-rose-500/10 p-1.5 text-[10px]"
                        >
                          <div
                            class="flex items-center justify-between font-bold text-rose-600 dark:text-rose-400"
                          >
                            <span>{{ item.formattedDate }}</span>
                            <span class="text-[9px] opacity-80">{{ item.time }}</span>
                          </div>
                          <p class="text-foreground/80 mt-0.5 truncate text-[10px] font-medium">
                            {{ item.title }}
                          </p>
                        </div>
                      </div>

                      <p class="text-muted-foreground mt-1.5 text-[9px] leading-tight">
                        Selecting this day will let you choose to keep or override your time off.
                      </p>

                      <!-- Tooltip arrow -->
                      <div
                        class="border-border/90 bg-popover absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Date Range -->
              <div class="grid gap-3 pt-1 sm:grid-cols-2">
                <div class="space-y-1">
                  <div class="flex items-center justify-between">
                    <label
                      class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase"
                    >
                      From Date *
                    </label>
                    <span
                      v-if="recurringStartWeekdayName"
                      class="text-primary inline-flex items-center gap-1 text-[10px] font-bold"
                    >
                      <span class="bg-primary h-1.5 w-1.5 rounded-full"></span>
                      {{ recurringStartWeekdayName }}
                    </span>
                  </div>
                  <input
                    v-model="recurringStartDate"
                    type="date"
                    :min="todayDateStr"
                    required
                    class="border-border bg-card focus:border-primary w-full rounded-xl border px-3.5 py-2 text-sm font-medium outline-none"
                  />
                  <p
                    v-if="recurringStartDate"
                    class="text-muted-foreground flex items-center gap-1 text-[10px]"
                  >
                    <span class="bg-primary inline-block h-1 w-1 rounded-full"></span>
                    Starts on {{ formatReadableDate(recurringStartDate) }} ({{
                      recurringStartWeekdayName
                    }})
                  </p>
                </div>
                <div class="space-y-1">
                  <div class="flex items-center justify-between">
                    <label
                      class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase"
                    >
                      Until Date
                    </label>
                    <span
                      class="text-muted-foreground/70 inline-flex items-center gap-1 text-[10px] font-semibold"
                    >
                      <Icon
                        name="heroicons:lock-closed"
                        class="h-3 w-3"
                      />
                      Auto-calculated
                    </span>
                  </div>
                  <input
                    v-model="recurringEndDate"
                    type="date"
                    readonly
                    disabled
                    tabindex="-1"
                    class="border-border bg-foreground/[0.04] text-muted-foreground w-full cursor-not-allowed rounded-xl border px-3.5 py-2 text-sm font-medium opacity-80 outline-none select-none"
                  />
                  <p
                    v-if="recurringEndDate"
                    class="text-muted-foreground text-[10px]"
                  >
                    Ends on {{ formatReadableDate(recurringEndDate) }} based on selected days
                  </p>
                </div>
              </div>
            </div>

            <!-- Date and Times Row -->
            <div
              class="grid gap-4"
              :class="scheduleMode === 'single' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'"
            >
              <div
                v-if="scheduleMode === 'single'"
                class="space-y-1.5"
              >
                <label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >Date *</label
                >
                <input
                  v-model="availForm.available_date"
                  type="date"
                  :min="todayDateStr"
                  required
                  class="border-border bg-foreground/5 focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium outline-none"
                />
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >Start Time</label
                >
                <input
                  v-model="availForm.start_time"
                  type="time"
                  :disabled="scheduleType === 'away' && blockWholeDay"
                  class="border-border bg-foreground/5 focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium outline-none disabled:opacity-50"
                />
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >End Time</label
                >
                <input
                  v-model="availForm.end_time"
                  type="time"
                  :disabled="scheduleType === 'away' && blockWholeDay"
                  class="border-border bg-foreground/5 focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <!-- Block whole day checkbox (Away only) -->
            <div
              v-if="scheduleType === 'away'"
              class="flex items-center gap-2"
            >
              <input
                id="block-whole-day"
                v-model="blockWholeDay"
                type="checkbox"
                class="text-primary focus:ring-primary h-4 w-4 cursor-pointer rounded"
              />
              <label
                for="block-whole-day"
                class="text-foreground/80 cursor-pointer text-xs font-bold select-none"
              >
                Block out the entire day (Unavailable all day)
              </label>
            </div>

            <!-- Status / Alert Messages -->
            <div
              v-if="availSuccessMsg"
              class="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700"
            >
              <Icon
                name="heroicons:check-circle"
                class="h-4 w-4"
              />
              <span>{{ availSuccessMsg }}</span>
            </div>

            <div
              v-if="availErrorMsg"
              class="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-600"
            >
              <Icon
                name="heroicons:exclamation-circle"
                class="h-4 w-4"
              />
              <span>{{ availErrorMsg }}</span>
            </div>

            <div class="flex items-center justify-between pt-2">
              <div></div>
              <AppButton
                type="submit"
                :loading="isAddLoading"
                class="min-w-[150px]"
              >
                {{ scheduleType === 'duty' ? 'Add Duty Schedule' : 'Block Out Date' }}
              </AppButton>
            </div>
          </form>

          <!-- Divider -->
          <div class="bg-border h-px"></div>

          <!-- Existing Slots & Timetable Preview -->
          <div>
            <div class="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h3 class="text-md text-foreground font-bold">Your Preset Schedules & Timetable</h3>

              <div
                class="bg-foreground/5 border-border flex items-center gap-1 rounded-xl border p-1"
              >
                <button
                  type="button"
                  @click="scheduleViewMode = 'cards'"
                  class="flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold transition-all"
                  :class="
                    scheduleViewMode === 'cards'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                >
                  <Icon
                    name="lucide:layout-list"
                    class="h-3.5 w-3.5"
                  />
                  List Cards
                </button>
                <button
                  type="button"
                  @click="scheduleViewMode = 'timetable'"
                  class="flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold transition-all"
                  :class="
                    scheduleViewMode === 'timetable'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                >
                  <Icon
                    name="lucide:calendar-range"
                    class="h-3.5 w-3.5"
                  />
                  Weekly Timetable
                </button>
              </div>
            </div>

            <!-- Timetable Mode -->
            <div
              v-if="scheduleViewMode === 'timetable'"
              class="border-border overflow-hidden rounded-2xl border"
            >
              <AppWeeklyTimetable />
            </div>

            <!-- Cards Mode -->
            <template v-else>
              <div
                v-if="isAvailLoading"
                class="flex flex-col gap-3"
              >
                <div
                  v-for="i in 2"
                  :key="i"
                  class="bg-foreground/5 h-16 w-full animate-pulse rounded-2xl"
                ></div>
              </div>

              <div
                v-else-if="!availabilities.length"
                class="border-border bg-foreground/[0.02] rounded-2xl border border-dashed p-8 text-center"
              >
                <Icon
                  name="heroicons:calendar-days"
                  class="text-foreground/30 mx-auto mb-2 text-4xl"
                />
                <p class="text-muted-foreground text-sm">
                  No schedule presets set. You are currently marked as available every day for new
                  patient referrals.
                </p>
              </div>

              <div
                v-else
                class="flex max-h-[350px] flex-col gap-3 overflow-y-auto pr-1"
              >
                <div
                  v-for="slot in sortedAvailabilities"
                  :key="slot.uuid"
                  class="border-border bg-foreground/[0.02] hover:bg-foreground/[0.04] flex items-center justify-between rounded-2xl border p-4 transition-all"
                >
                  <div class="flex items-center gap-4">
                    <div
                      class="shrink-0 rounded-xl p-2.5"
                      :class="
                        slot.is_available
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-red-500/10 text-red-500'
                      "
                    >
                      <Icon
                        :name="
                          slot.is_available ? 'heroicons:building-office-2' : 'heroicons:calendar'
                        "
                        size="20"
                      />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <p class="text-foreground text-sm font-bold">
                          {{
                            new Date(slot.available_date).toLocaleDateString(undefined, {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })
                          }}
                        </p>
                        <span
                          class="rounded-full border px-2 py-0.5 text-[11px] font-bold"
                          :class="
                            slot.is_available
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-red-200 bg-red-50 text-red-700'
                          "
                        >
                          {{
                            slot.is_available
                              ? slot.clinic?.name || slot.location_name || 'Clinic Duty'
                              : 'Blocked / Away'
                          }}
                        </span>
                      </div>
                      <p class="text-foreground/60 mt-0.5 text-xs">
                        {{ formatTime(slot.start_time) }} - {{ formatTime(slot.end_time) }}
                        <span
                          v-if="slot.clinic?.address"
                          class="text-foreground/40 ml-1"
                          >• {{ slot.clinic.address }}</span
                        >
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      @click="openEditSlotModal(slot)"
                      class="text-foreground/40 hover:bg-primary/10 hover:text-primary cursor-pointer rounded-xl p-2 transition-all"
                      title="Edit Schedule Period"
                    >
                      <Icon
                        name="heroicons:pencil-square"
                        size="18"
                      />
                    </button>
                    <button
                      type="button"
                      @click="deleteAvailability(slot.uuid)"
                      class="text-foreground/40 cursor-pointer rounded-xl p-2 transition-all hover:bg-red-500/10 hover:text-red-500"
                      title="Remove Period"
                    >
                      <Icon
                        name="heroicons:trash"
                        size="18"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- 4. SUBSCRIPTION & LIMITS TAB -->
        <div
          v-else-if="activeTab === 'subscription'"
          class="bg-card border-border animate-in fade-in space-y-6 rounded-3xl border p-6 shadow-xs duration-300 sm:p-8"
        >
          <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 class="text-foreground text-xl font-bold">
                {{ isSubInherited ? 'Plan & Clinic Sponsorship' : 'Subscription & Plan Limits' }}
              </h2>
              <p class="text-muted-foreground mt-1 text-xs">
                {{
                  isSubInherited
                    ? 'Review your clinic group tier, sponsored capabilities, and practice quotas.'
                    : 'Review your active subscription plan, doctor seats, and practice capacity limits.'
                }}
              </p>
            </div>

            <AppButton
              to="/Doctor/subscription"
              variant="solid"
              size="sm"
            >
              <span>Manage Plans</span>
              <Icon
                name="heroicons:arrow-right"
                size="14"
                class="ml-1.5"
              />
            </AppButton>
          </div>

          <div class="bg-border h-px"></div>

          <!-- Loading State -->
          <div
            v-if="isSubLoading"
            class="space-y-4"
          >
            <div class="bg-foreground/5 h-32 animate-pulse rounded-2xl"></div>
            <div class="bg-foreground/5 h-44 animate-pulse rounded-2xl"></div>
          </div>

          <div
            v-else
            class="space-y-6"
          >
            <!-- Current Plan Card -->
            <div
              class="rounded-3xl border p-6 transition-all"
              :class="
                mySubscription?.status === 'active'
                  ? 'border-emerald-200/80 bg-emerald-50/40 shadow-2xs'
                  : 'bg-foreground/[0.02] border-border'
              "
            >
              <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div class="flex items-center gap-3.5">
                  <div
                    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-xs"
                    :class="
                      mySubscription?.status === 'active'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-foreground/10 text-foreground/70'
                    "
                  >
                    <Icon
                      :name="
                        mySubscription?.status === 'active'
                          ? 'heroicons:shield-check'
                          : 'heroicons:credit-card'
                      "
                      class="h-6 w-6"
                    />
                  </div>
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="text-foreground text-base font-bold sm:text-lg">
                        {{ mySubscription?.plan?.name || 'No Active Subscription' }}
                      </h3>
                      <span
                        v-if="isSubInherited"
                        class="rounded-full border border-indigo-300 bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-indigo-800 uppercase dark:border-indigo-800/50 dark:bg-indigo-950/50 dark:text-indigo-300"
                      >
                        Sponsored Access
                      </span>
                      <span
                        v-else
                        class="rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                        :class="
                          mySubscription?.status === 'active'
                            ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                            : 'border-gray-300 bg-gray-100 text-gray-700'
                        "
                      >
                        {{ mySubscription?.status || 'Inactive' }}
                      </span>
                      <span
                        v-if="
                          !isSubInherited &&
                          mySubscription?.status === 'active' &&
                          mySubscription?.auto_renew
                        "
                        class="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-800 uppercase dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-300"
                      >
                        Auto-Renew On
                      </span>
                      <span
                        v-else-if="
                          !isSubInherited &&
                          mySubscription?.status === 'active' &&
                          !mySubscription?.auto_renew
                        "
                        class="border-warning-border bg-warning-subtle text-warning-text rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                      >
                        Auto-Renew Off
                      </span>
                    </div>
                    <p class="text-muted-foreground mt-0.5 text-xs">
                      <template v-if="isSubInherited">
                        Active via Clinic Seat Membership at
                        <strong class="text-foreground">{{
                          subAssociateCoverage?.clinic_name || 'Clinic Location'
                        }}</strong>
                        • Head Doctor:
                        <strong class="text-foreground"
                          >Dr. {{ subAssociateCoverage?.owner_name }}</strong
                        >
                      </template>
                      <template v-else-if="mySubscription?.status === 'active'">
                        Billed {{ mySubscription.billing_cycle }} •
                        {{
                          mySubscription.is_pending_cancellation
                            ? 'Expires on'
                            : 'Renews / Valid through'
                        }}
                        {{
                          new Date(mySubscription.ends_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        }}
                      </template>
                      <template v-else>
                        Subscribe to an official doctor plan to unlock scanning & practice features.
                      </template>
                    </p>
                  </div>
                </div>

                <div
                  v-if="isSubInherited"
                  class="shrink-0 text-left sm:text-right"
                >
                  <span
                    class="text-muted-foreground block text-xs font-bold tracking-wider uppercase"
                    >Billing</span
                  >
                  <span
                    class="mt-0.5 block text-sm font-extrabold text-indigo-600 dark:text-indigo-400"
                  >
                    Covered by Clinic
                  </span>
                  <span class="text-muted-foreground block text-[11px] font-medium">
                    Sponsored by Dr. {{ subAssociateCoverage?.owner_name }}
                  </span>
                </div>
                <div
                  v-else-if="mySubscription?.status === 'active'"
                  class="shrink-0 text-right"
                >
                  <span
                    class="text-muted-foreground block text-xs font-bold tracking-wider uppercase"
                    >Rate</span
                  >
                  <span class="text-foreground text-lg font-extrabold">
                    ₱{{
                      (mySubscription.billing_cycle === 'annual'
                        ? mySubscription.plan?.price_annual
                        : mySubscription.plan?.price_monthly
                      )?.toLocaleString()
                    }}
                  </span>
                  <span class="text-muted-foreground text-xs font-medium">
                    / {{ mySubscription.billing_cycle === 'annual' ? 'yr' : 'mo' }}</span
                  >
                </div>
              </div>

              <!-- Plan Quotas & Capabilities Grid -->
              <div
                class="border-border/60 mt-6 grid grid-cols-2 gap-3 border-t pt-5 sm:grid-cols-4"
              >
                <div class="bg-card border-border/80 rounded-2xl border p-3 text-center">
                  <span
                    class="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase"
                    >Clinic Branches</span
                  >
                  <span class="text-foreground mt-0.5 block text-sm font-bold">
                    {{ mySubscription?.plan?.max_clinics ?? 1 }} Branch{{
                      (mySubscription?.plan?.max_clinics ?? 1) > 1 ? 'es' : ''
                    }}
                  </span>
                </div>

                <div class="bg-card border-border/80 rounded-2xl border p-3 text-center">
                  <span
                    class="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase"
                    >Doctor Seats</span
                  >
                  <span class="text-foreground mt-0.5 block text-sm font-bold">
                    {{ mySubscription?.plan?.max_doctors ?? 1 }} Seat{{
                      (mySubscription?.plan?.max_doctors ?? 1) > 1 ? 's' : ''
                    }}
                  </span>
                </div>

                <div class="bg-card border-border/80 rounded-2xl border p-3 text-center">
                  <span
                    class="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase"
                    >Secretaries</span
                  >
                  <span class="text-foreground mt-0.5 block text-sm font-bold">
                    {{
                      mySubscription?.plan?.max_secretaries
                        ? `${mySubscription.plan.max_secretaries} Seats`
                        : 'None'
                    }}
                  </span>
                </div>

                <div class="bg-card border-border/80 rounded-2xl border p-3 text-center">
                  <span
                    class="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase"
                    >AI Diagnostics</span
                  >
                  <span class="mt-0.5 block text-sm font-bold text-emerald-600">
                    {{
                      mySubscription?.effective_daily_scan_limit !== undefined &&
                      mySubscription?.effective_daily_scan_limit !== null
                        ? `${mySubscription.effective_daily_scan_limit} / Day`
                        : mySubscription?.plan?.daily_scan_limit
                          ? `${mySubscription.plan.daily_scan_limit} / Day`
                          : 'Unlimited'
                    }}
                  </span>
                </div>
              </div>
            </div>

            <!-- ASSOCIATE VIEW: Clinic Sponsorship Card -->
            <div
              v-if="isSubInherited"
              class="relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-900 via-indigo-950 to-slate-950 p-6 text-white shadow-xl sm:p-7"
            >
              <div
                class="pointer-events-none absolute top-0 right-0 -mt-8 -mr-8 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl"
              ></div>

              <div class="relative z-10 space-y-4">
                <div
                  class="flex items-center gap-2 text-xs font-bold tracking-wider text-indigo-300 uppercase"
                >
                  <Icon
                    name="heroicons:sparkles"
                    class="h-4 w-4 text-indigo-400"
                  />
                  <span>Clinic Group Membership Active</span>
                </div>

                <div>
                  <h3 class="text-xl leading-tight font-black text-white sm:text-2xl">
                    Affiliated with Dr. {{ subAssociateCoverage?.owner_name }}'s Clinic Group Plan
                  </h3>
                  <p class="mt-1 max-w-xl text-xs leading-relaxed text-indigo-200/80 sm:text-sm">
                    Your account has unlocked multi-doctor features, live AI diagnostic scans, and
                    clinical report exports sponsored by your head doctor at
                    {{ subAssociateCoverage?.clinic_name || 'your assigned clinic' }}.
                  </p>
                </div>

                <!-- Feature Highlights -->
                <div class="grid gap-3 pt-2 sm:grid-cols-3">
                  <div
                    class="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-xs"
                  >
                    <Icon
                      name="heroicons:shield-check"
                      class="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
                    />
                    <div>
                      <h5 class="text-xs font-bold text-white">Fully Sponsored</h5>
                      <p class="mt-0.5 text-[11px] text-indigo-200/70">
                        Billing is covered by the clinic owner.
                      </p>
                    </div>
                  </div>

                  <div
                    class="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-xs"
                  >
                    <Icon
                      name="heroicons:sparkles"
                      class="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
                    />
                    <div>
                      <h5 class="text-xs font-bold text-white">AI Diagnostics</h5>
                      <p class="mt-0.5 text-[11px] text-indigo-200/70">
                        Unlimited scans & clinical insights.
                      </p>
                    </div>
                  </div>

                  <div
                    class="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-xs"
                  >
                    <Icon
                      name="heroicons:user-group"
                      class="mt-0.5 h-4 w-4 shrink-0 text-indigo-300"
                    />
                    <div>
                      <h5 class="text-xs font-bold text-white">Multi-Doctor Team</h5>
                      <p class="mt-0.5 text-[11px] text-indigo-200/70">
                        Collaborative clinical coverage.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex flex-wrap items-center justify-between gap-3 pt-3">
                  <span class="text-xs text-indigo-300/80"
                    >Need your own independent practice subscription?</span
                  >

                  <div class="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      @click="activeTab = 'clinics'"
                      class="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                    >
                      <Icon
                        name="lucide:users"
                        class="h-4 w-4"
                      />
                      <span>View Doctor Team</span>
                    </button>

                    <AppButton
                      to="/Doctor/subscription"
                      variant="solid"
                      size="sm"
                      class="font-bold shadow-md"
                    >
                      <span>Explore Solo Plans</span>
                      <Icon
                        name="heroicons:arrow-right"
                        class="ml-1.5 h-4 w-4"
                      />
                    </AppButton>
                  </div>
                </div>
              </div>
            </div>

            <!-- OWNER / SOLO VIEW: Upgrade Recommendation Card -->
            <div
              v-else
              class="relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-900 via-indigo-950 to-slate-950 p-6 text-white shadow-xl sm:p-7"
            >
              <div
                class="pointer-events-none absolute top-0 right-0 -mt-8 -mr-8 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl"
              ></div>

              <div class="relative z-10 space-y-4">
                <div
                  class="flex items-center gap-2 text-xs font-bold tracking-wider text-indigo-300 uppercase"
                >
                  <Icon
                    name="heroicons:sparkles"
                    class="h-4 w-4 text-amber-400"
                  />
                  <span>Expand Your Clinical Practice</span>
                </div>

                <div>
                  <h3 class="text-xl leading-tight font-black text-white sm:text-2xl">
                    Upgrade to Team & Multi-Clinic Plans
                  </h3>
                  <p class="mt-1 max-w-xl text-xs leading-relaxed text-indigo-200/80 sm:text-sm">
                    Scale your clinical operations by delegating appointment queues to secretaries
                    and inviting associate dermatologists to collaborate under your clinic license.
                  </p>
                </div>

                <!-- Feature Highlights -->
                <div class="grid gap-3 pt-2 sm:grid-cols-3">
                  <div
                    class="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-xs"
                  >
                    <Icon
                      name="heroicons:user-group"
                      class="mt-0.5 h-4 w-4 shrink-0 text-indigo-300"
                    />
                    <div>
                      <h5 class="text-xs font-bold text-white">Multi-Doctor Pool</h5>
                      <p class="mt-0.5 text-[11px] text-indigo-200/70">
                        Share plan quota with colleague doctors.
                      </p>
                    </div>
                  </div>

                  <div
                    class="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-xs"
                  >
                    <Icon
                      name="heroicons:user-plus"
                      class="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
                    />
                    <div>
                      <h5 class="text-xs font-bold text-white">Clinic Secretary</h5>
                      <p class="mt-0.5 text-[11px] text-indigo-200/70">
                        Delegate intake & queue management.
                      </p>
                    </div>
                  </div>

                  <div
                    class="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-xs"
                  >
                    <Icon
                      name="heroicons:building-office-2"
                      class="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
                    />
                    <div>
                      <h5 class="text-xs font-bold text-white">Multi-Branch</h5>
                      <p class="mt-0.5 text-[11px] text-indigo-200/70">
                        Practice across multiple hospitals.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Action Button -->
                <div class="flex items-center justify-between pt-3">
                  <span class="text-xs text-indigo-300/80"
                    >Automated activation via PayMongo & GCash/Cards.</span
                  >

                  <AppButton
                    to="/Doctor/subscription"
                    variant="solid"
                    size="md"
                    class="font-bold shadow-lg"
                  >
                    <span>View Upgrade Plans</span>
                    <Icon
                      name="heroicons:arrow-right"
                      class="ml-1.5 h-4 w-4"
                    />
                  </AppButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. ACCOUNT & SECURITY TAB -->
        <div
          v-else-if="activeTab === 'security'"
          class="bg-card border-border animate-in fade-in space-y-6 rounded-3xl border p-6 shadow-xs duration-300 sm:p-8"
        >
          <div>
            <h2 class="text-foreground text-xl font-bold">Account & Security</h2>
            <p class="text-muted-foreground mt-1 text-xs">
              Manage your credentials, professional verification, and active session.
            </p>
          </div>

          <div class="bg-border h-px"></div>

          <div class="space-y-6">
            <!-- Verification Card -->
            <div
              class="border-border bg-foreground/[0.02] flex items-center justify-between gap-4 rounded-2xl border p-5"
            >
              <div class="flex items-center gap-3">
                <div
                  class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                >
                  <Icon
                    name="heroicons:shield-check"
                    class="h-5 w-5"
                  />
                </div>
                <div>
                  <h4 class="text-foreground text-sm font-bold">Medical Board Verification</h4>
                  <p class="text-muted-foreground mt-0.5 text-xs">
                    PRC:
                    <span class="font-mono font-bold">{{
                      user?.prcNumber || user?.doctor_verification?.prcNumber || 'Not submitted'
                    }}</span>
                  </p>
                </div>
              </div>
              <AppProfileStatusBadge
                :is-complete="user?.doctor_verification?.status === 'verified'"
                :is-declined="user?.doctor_verification?.status === 'declined'"
                :is-pending="user?.doctor_verification?.status === 'pending'"
              />
            </div>

            <!-- Security Cards Grid (Side-by-side on xl, stacked on mobile/tablet) -->
            <div class="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
              <!-- Card 1: Change Password Card -->
              <AppChangePasswordCard
                :user-uuid="doctorUuid || ''"
                id-prefix="doctor"
                subtitle="Ensure your account is using a long, secure password to protect clinical records."
              />

              <!-- Card 2: Two-Factor Authentication (2FA) Card -->
              <AppTwoFactorCard
                :enabled="user?.two_factor_enabled"
                @updated="refresh"
              />
            </div>

            <!-- Sign Out Row -->
            <div
              class="border-destructive/20 bg-destructive/5 flex items-center justify-between gap-4 rounded-2xl border p-5"
            >
              <div>
                <h4 class="text-destructive text-sm font-bold">Sign Out</h4>
                <p class="text-muted-foreground mt-0.5 text-xs">
                  Terminate your current doctor session on this device.
                </p>
              </div>

              <button
                type="button"
                @click="isLogoutModalOpen = true"
                class="bg-destructive/10 text-destructive hover:bg-destructive border-destructive/20 cursor-pointer rounded-2xl border px-4 py-2 text-xs font-bold transition-all hover:text-white"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Add Clinic Modal -->
    <Teleport to="body">
      <div
        v-if="showAddClinicModal"
        @click.self="showAddClinicModal = false"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      >
        <div
          class="bg-card border-border animate-in fade-in zoom-in-95 w-full max-w-lg space-y-5 rounded-3xl border p-6 shadow-2xl sm:p-8"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl"
              >
                <Icon
                  name="heroicons:building-office-2"
                  class="h-5 w-5"
                />
              </div>
              <div>
                <h3 class="text-foreground text-lg font-bold">Add Clinic Branch</h3>
                <p class="text-muted-foreground text-xs">
                  Register a new clinic location where you practice.
                </p>
              </div>
            </div>
            <button
              @click="showAddClinicModal = false"
              class="text-muted-foreground hover:text-foreground cursor-pointer rounded-xl p-1"
            >
              <Icon
                name="heroicons:x-mark"
                class="h-5 w-5"
              />
            </button>
          </div>

          <form
            @submit.prevent="handleCreateClinic"
            class="space-y-4"
          >
            <div
              v-if="clinicError"
              class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600"
            >
              {{ clinicError }}
            </div>

            <div class="space-y-1.5">
              <label class="text-foreground text-xs font-bold">Clinic / Hospital Name *</label>
              <input
                v-model="clinicForm.name"
                type="text"
                required
                placeholder="e.g. St. Luke's Medical Center - Rm 402"
                class="border-border bg-foreground/5 focus:border-primary w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-foreground text-xs font-bold">Address / Floor & Room</label>
              <input
                v-model="clinicForm.address"
                type="text"
                placeholder="e.g. 32nd St, Bonifacio Global City, Taguig"
                class="border-border bg-foreground/5 focus:border-primary w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              />
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="space-y-1.5">
                <label class="text-foreground text-xs font-bold">Contact Phone</label>
                <input
                  v-model="clinicForm.phone"
                  type="text"
                  placeholder="e.g. +63 917 123 4567"
                  class="border-border bg-foreground/5 focus:border-primary w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-foreground text-xs font-bold">Clinic Email</label>
                <input
                  v-model="clinicForm.email"
                  type="email"
                  placeholder="e.g. clinic@derma.com"
                  class="border-border bg-foreground/5 focus:border-primary w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                />
              </div>
            </div>

            <!-- Clinic Logo Upload (for Prescriptions) -->
            <div class="space-y-1.5">
              <label class="text-foreground text-xs font-bold">Clinic Logo (for Prescription Pad Header)</label>
              <div class="flex items-center gap-3">
                <div v-if="clinicForm.logoPreview" class="relative w-12 h-12 rounded-xl border border-border bg-card overflow-hidden flex items-center justify-center p-1">
                  <img :src="clinicForm.logoPreview" class="max-h-full max-w-full object-contain" alt="Clinic Logo" />
                  <button type="button" @click="clinicForm.logo = ''; clinicForm.logoPreview = ''" class="absolute top-0 right-0 p-0.5 bg-rose-500 text-white rounded-bl-lg">
                    <Icon name="lucide:x" class="text-[10px]" />
                  </button>
                </div>
                <label class="flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-dashed border-border hover:border-primary rounded-xl cursor-pointer bg-foreground/5 hover:bg-foreground/10 transition-colors">
                  <Icon name="lucide:image" class="text-sm text-primary" />
                  <span>{{ clinicForm.logoPreview ? 'Change Clinic Logo' : 'Upload Clinic Logo (PNG/JPG)' }}</span>
                  <input type="file" accept="image/png, image/jpeg, image/webp" class="hidden" @change="handleClinicLogoUpload($event, false)" />
                </label>
              </div>
              <p class="text-[10px] text-muted-foreground">Appears at top-left of prescription slips. If empty, DermAssist logo is used by default.</p>
            </div>

            <div class="flex items-center justify-end gap-3 pt-2">
              <AppButton
                type="button"
                variant="ghost"
                size="sm"
                @click="showAddClinicModal = false"
              >
                Cancel
              </AppButton>
              <AppButton
                type="submit"
                variant="solid"
                size="sm"
                :loading="isClinicSubmitting"
              >
                Save Clinic
              </AppButton>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Edit Clinic Modal -->
    <Teleport to="body">
      <div
        v-if="showEditClinicModal"
        @click.self="closeEditClinicModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      >
        <div
          class="bg-card border-border animate-in fade-in zoom-in-95 w-full max-w-lg space-y-5 rounded-3xl border p-6 shadow-2xl sm:p-8"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl"
              >
                <Icon
                  name="heroicons:pencil-square"
                  class="h-5 w-5"
                />
              </div>
              <div>
                <h3 class="text-foreground text-lg font-bold">Edit Clinic Branch</h3>
                <p class="text-muted-foreground text-xs">
                  Update location and contact information for this clinic.
                </p>
              </div>
            </div>
            <button
              type="button"
              @click="closeEditClinicModal"
              class="text-muted-foreground hover:text-foreground cursor-pointer rounded-xl p-1"
            >
              <Icon
                name="heroicons:x-mark"
                class="h-5 w-5"
              />
            </button>
          </div>

          <form
            @submit.prevent="handleUpdateClinic"
            class="space-y-4"
          >
            <div
              v-if="editClinicError"
              class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
            >
              {{ editClinicError }}
            </div>

            <div class="space-y-1.5">
              <label class="text-foreground text-xs font-bold">Clinic / Hospital Name *</label>
              <input
                v-model="editClinicForm.name"
                type="text"
                required
                placeholder="e.g. St. Luke's Medical Center - Rm 402"
                class="border-border bg-foreground/5 focus:border-primary text-foreground w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-foreground text-xs font-bold">Address / Floor & Room</label>
              <input
                v-model="editClinicForm.address"
                type="text"
                placeholder="e.g. 32nd St, Bonifacio Global City, Taguig"
                class="border-border bg-foreground/5 focus:border-primary text-foreground w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              />
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="space-y-1.5">
                <label class="text-foreground text-xs font-bold">Contact Phone</label>
                <input
                  v-model="editClinicForm.phone"
                  type="text"
                  placeholder="e.g. +63 917 123 4567"
                  class="border-border bg-foreground/5 focus:border-primary text-foreground w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-foreground text-xs font-bold">Clinic Email</label>
                <input
                  v-model="editClinicForm.email"
                  type="email"
                  placeholder="e.g. clinic@derma.com"
                  class="border-border bg-foreground/5 focus:border-primary text-foreground w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                />
              </div>
            </div>

            <!-- Clinic Logo Upload (for Prescriptions) -->
            <div class="space-y-1.5">
              <label class="text-foreground text-xs font-bold">Clinic Logo (for Prescription Pad Header)</label>
              <div class="flex items-center gap-3">
                <div v-if="editClinicForm.logoPreview" class="relative w-12 h-12 rounded-xl border border-border bg-card overflow-hidden flex items-center justify-center p-1">
                  <img :src="editClinicForm.logoPreview" class="max-h-full max-w-full object-contain" alt="Clinic Logo" />
                  <button type="button" @click="editClinicForm.logo = ''; editClinicForm.logoPreview = ''" class="absolute top-0 right-0 p-0.5 bg-rose-500 text-white rounded-bl-lg">
                    <Icon name="lucide:x" class="text-[10px]" />
                  </button>
                </div>
                <label class="flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-dashed border-border hover:border-primary rounded-xl cursor-pointer bg-foreground/5 hover:bg-foreground/10 transition-colors">
                  <Icon name="lucide:image" class="text-sm text-primary" />
                  <span>{{ editClinicForm.logoPreview ? 'Change Clinic Logo' : 'Upload Clinic Logo (PNG/JPG)' }}</span>
                  <input type="file" accept="image/png, image/jpeg, image/webp" class="hidden" @change="handleClinicLogoUpload($event, true)" />
                </label>
              </div>
              <p class="text-[10px] text-muted-foreground">Appears at top-left of prescription slips. If empty, DermAssist logo is used by default.</p>
            </div>

            <!-- Active Status Toggle -->
            <div
              class="border-border/60 bg-foreground/[0.02] flex items-center justify-between rounded-xl border p-3.5"
            >
              <div>
                <div class="text-foreground text-xs font-bold">Active Practice Branch</div>
                <div class="text-muted-foreground text-[11px]">
                  Allow patient bookings and duty schedule allocation at this branch
                </div>
              </div>
              <label class="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  v-model="editClinicForm.is_active"
                  class="peer sr-only"
                />
                <div
                  class="peer bg-muted-foreground/20 after:border-border/40 peer-checked:bg-primary h-6 w-11 rounded-full transition-colors peer-focus:outline-hidden after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
                ></div>
              </label>
            </div>

            <div class="flex items-center justify-end gap-3 pt-2">
              <AppButton
                type="button"
                variant="ghost"
                size="sm"
                @click="closeEditClinicModal"
              >
                Cancel
              </AppButton>
              <AppButton
                type="submit"
                variant="solid"
                size="sm"
                :loading="isEditClinicSubmitting"
              >
                Update Clinic
              </AppButton>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Assign Doctor to Seat Modal -->
    <Teleport to="body">
      <div
        v-if="showAssignDoctorModal"
        @click.self="showAssignDoctorModal = false"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      >
        <div
          class="bg-card border-border animate-in fade-in zoom-in-95 w-full max-w-lg space-y-5 rounded-3xl border p-6 shadow-2xl sm:p-8"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl"
              >
                <Icon
                  name="lucide:user-plus"
                  class="h-5 w-5"
                />
              </div>
              <div>
                <h3 class="text-foreground text-lg font-bold">Assign Associate Doctor</h3>
                <p class="text-muted-foreground text-xs">
                  Add a doctor to your clinic subscription seat pool.
                </p>
              </div>
            </div>
            <button
              @click="showAssignDoctorModal = false"
              class="text-muted-foreground hover:text-foreground cursor-pointer rounded-xl p-1"
            >
              <Icon
                name="lucide:x"
                class="h-5 w-5"
              />
            </button>
          </div>

          <form
            @submit.prevent="handleAssignDoctor"
            class="space-y-4"
          >
            <div
              v-if="assignDoctorError"
              class="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-600 dark:text-red-400"
            >
              {{ assignDoctorError }}
            </div>

            <!-- Clinic Branch Selection -->
            <div class="space-y-1.5">
              <label class="text-foreground text-xs font-bold">Select Clinic Branch *</label>
              <select
                v-model="assignDoctorForm.clinic_id"
                required
                class="border-border bg-foreground/5 focus:border-primary text-foreground w-full cursor-pointer rounded-xl border px-3.5 py-2.5 text-sm font-semibold outline-none"
              >
                <option
                  :value="null"
                  disabled
                >
                  -- Choose clinic branch --
                </option>
                <option
                  v-for="c in clinics"
                  :key="c.id"
                  :value="c.id"
                >
                  {{ c.name }} {{ c.address ? `(${c.address})` : '' }}
                </option>
              </select>
            </div>

            <!-- Doctor Search / Selection -->
            <div class="space-y-1.5">
              <label class="text-foreground text-xs font-bold"
                >Find Doctor (by Name, Email, or PRC Number) *</label
              >

              <!-- If doctor selected -->
              <div
                v-if="selectedCandidate"
                class="border-primary/40 bg-primary/5 flex items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div class="flex min-w-0 items-center gap-2.5">
                  <div
                    class="bg-primary/20 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase"
                  >
                    {{ selectedCandidate.full_name?.[0] || 'D' }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-foreground truncate text-xs font-bold">
                      Dr. {{ selectedCandidate.full_name }}
                    </p>
                    <p class="text-muted-foreground truncate text-[11px]">
                      {{ selectedCandidate.email }}
                      {{
                        selectedCandidate.prc_number ? `• PRC: ${selectedCandidate.prc_number}` : ''
                      }}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  @click="clearCandidateDoctor"
                  class="text-muted-foreground hover:text-foreground hover:bg-foreground/10 cursor-pointer rounded-lg p-1"
                  title="Change doctor"
                >
                  <Icon
                    name="lucide:x"
                    class="h-4 w-4"
                  />
                </button>
              </div>

              <!-- Search input if not selected -->
              <div
                v-else
                class="relative"
              >
                <div class="relative">
                  <input
                    :value="doctorSearchQuery"
                    @input="handleDoctorSearch(($event.target as HTMLInputElement).value)"
                    type="text"
                    placeholder="Type name, email, or PRC license..."
                    class="border-border bg-foreground/5 focus:border-primary text-foreground w-full rounded-xl border py-2.5 pr-4 pl-9 text-sm outline-none"
                  />
                  <Icon
                    name="lucide:search"
                    class="text-muted-foreground absolute top-3 left-3 h-4 w-4"
                  />
                  <Icon
                    v-if="isSearchingDoctors"
                    name="lucide:loader-2"
                    class="text-primary absolute top-3 right-3 h-4 w-4 animate-spin"
                  />
                </div>

                <!-- Autocomplete Dropdown -->
                <div
                  v-if="doctorSearchResults.length > 0"
                  class="bg-card border-border divide-border/60 absolute top-full right-0 left-0 z-20 mt-1.5 max-h-48 divide-y overflow-y-auto rounded-2xl border shadow-xl"
                >
                  <button
                    v-for="cand in doctorSearchResults"
                    :key="cand.id"
                    type="button"
                    @click="selectCandidateDoctor(cand)"
                    class="hover:bg-foreground/5 flex w-full cursor-pointer items-center justify-between gap-3 p-3 text-left transition"
                  >
                    <div class="min-w-0">
                      <p class="text-foreground truncate text-xs font-bold">
                        Dr. {{ cand.full_name }}
                      </p>
                      <p class="text-muted-foreground truncate text-[11px]">{{ cand.email }}</p>
                    </div>
                    <span
                      v-if="cand.prc_number"
                      class="bg-foreground/5 text-foreground/70 shrink-0 rounded px-2 py-0.5 font-mono text-[10px]"
                    >
                      {{ cand.prc_number }}
                    </span>
                  </button>
                </div>

                <div
                  v-else-if="
                    doctorSearchQuery.length >= 2 &&
                    !isSearchingDoctors &&
                    doctorSearchResults.length === 0
                  "
                  class="text-muted-foreground mt-1 text-[11px]"
                >
                  No registered doctor found. You can enter their full email address to assign them
                  directly.
                </div>
              </div>
            </div>

            <!-- Role Selector -->
            <div class="space-y-1.5">
              <label class="text-foreground text-xs font-bold">Clinic Seat Role</label>
              <select
                v-model="assignDoctorForm.role"
                class="border-border bg-foreground/5 focus:border-primary text-foreground w-full cursor-pointer rounded-xl border px-3.5 py-2.5 text-sm font-semibold outline-none"
              >
                <option value="associate">Associate Dermatologist</option>
                <option value="resident">Resident Physician</option>
                <option value="consultant">Consultant Specialist</option>
              </select>
            </div>

            <div
              class="bg-primary/5 border-primary/10 text-foreground/80 flex items-start gap-2 rounded-xl border p-3 text-[11px]"
            >
              <Icon
                name="lucide:sparkles"
                class="text-primary mt-0.5 h-4 w-4 shrink-0"
              />
              <span
                >An invitation will be sent to the doctor. Upon acceptance, they will inherit full
                AI scanning, teleconsultation, and clinical documentation privileges under your
                active subscription plan.</span
              >
            </div>

            <div class="flex items-center justify-end gap-3 pt-2">
              <AppButton
                type="button"
                variant="ghost"
                size="sm"
                @click="showAssignDoctorModal = false"
              >
                Cancel
              </AppButton>
              <AppButton
                type="submit"
                variant="solid"
                size="sm"
                :loading="isAssigningDoctor"
              >
                Send Invitation
              </AppButton>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Confirmation Modal: Delete Clinic Location -->
    <AppModalConfirmation
      v-model="showDeleteClinicModal"
      title="Delete Clinic Location?"
      :description="`Are you sure you want to remove &quot;${clinicToDelete?.name || 'this clinic'}&quot;? Doctors and schedules associated with this location will be unlinked.`"
      icon="lucide:trash-2"
      icon-color="danger"
      confirm-text="Yes, Delete Clinic"
      cancel-text="Keep Clinic"
      confirm-variant="destructive"
      :loading="isDeletingClinic"
      @confirm="executeDeleteClinic"
    />

    <!-- Confirmation Modal: Revoke Doctor Seat -->
    <AppModalConfirmation
      v-model="showRevokeSeatModal"
      title="Revoke Doctor Seat?"
      :description="`Are you sure you want to revoke the doctor seat for Dr. ${doctorSeatToRevoke?.name || 'this doctor'}? Their multi-doctor access will be unlinked, but their past records and history will remain intact.`"
      icon="lucide:user-x"
      icon-color="danger"
      confirm-text="Revoke Seat"
      cancel-text="Cancel"
      confirm-variant="destructive"
      :loading="isRevokingSeat"
      @confirm="executeRevokeDoctorSeat"
    />

    <!-- Schedule Conflict Confirmation Modal -->
    <AppModalConfirmation
      v-model="showConflictModal"
      title="Schedule Conflict Detected"
      confirm-text="Overwrite Conflicting Schedule"
      cancel-text="Cancel & Adjust"
      confirm-variant="solid"
      icon="lucide:alert-triangle"
      icon-color="warning"
      :loading="isOverwriting"
      @confirm="confirmOverwriteSchedule"
      @cancel="showConflictModal = false"
    >
      <div class="mt-4 space-y-3 text-left">
        <p class="text-muted-foreground text-xs leading-relaxed">
          The proposed hours overlap with existing duty or blocked periods on this date:
        </p>

        <!-- Overlapping slots list -->
        <div
          v-if="conflictData?.overlapping_slots?.length"
          class="border-border bg-foreground/[0.03] space-y-2 rounded-2xl border p-3 text-xs"
        >
          <div
            v-for="(slot, idx) in conflictData.overlapping_slots"
            :key="idx"
            class="flex items-center justify-between"
          >
            <span class="flex items-center gap-2">
              <span
                class="h-2 w-2 rounded-full"
                :class="slot.is_available ? 'bg-emerald-500' : 'bg-rose-500'"
              ></span>
              <strong class="text-foreground font-semibold">{{ slot.clinic_name }}</strong>
            </span>
            <span class="text-muted-foreground font-mono font-medium">
              {{ slot.start_time?.slice(0, 5) }} – {{ slot.end_time?.slice(0, 5) }}
            </span>
          </div>
        </div>

        <!-- Warning if patient appointments exist in window -->
        <div
          v-if="conflictData?.affected_appointments?.length"
          class="border-warning-border bg-warning-subtle text-warning-text flex items-start gap-2.5 rounded-2xl border p-3 text-xs shadow-2xs"
        >
          <Icon
            name="lucide:alert-circle"
            class="mt-0.5 h-4 w-4 shrink-0"
          />
          <div>
            <p class="font-bold">
              {{ conflictData.affected_appointments.length }} Patient Appointment{{
                conflictData.affected_appointments.length > 1 ? 's' : ''
              }}
              Booked
            </p>
            <p class="text-[11px] opacity-90">
              Overwriting will slice/adjust duty hours around these existing bookings.
            </p>
          </div>
        </div>

        <p class="text-muted-foreground text-[11px] leading-relaxed">
          Would you like to overwrite the conflicting hours, or cancel and adjust your times?
        </p>
      </div>
    </AppModalConfirmation>

    <!-- Recurring Schedule Blocked Dates Conflict Modal (Layman Terms) -->
    <Teleport to="body">
      <div
        v-if="showRecurringBlockedModal && pendingRecurringDutyData"
        @click.self="closeRecurringBlockedModal"
        class="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs duration-200"
      >
        <div
          class="border-border bg-card text-foreground relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border p-6 shadow-2xl"
        >
          <!-- Warning Icon & Headline -->
          <div class="flex items-start gap-4">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-4 ring-amber-500/10"
            >
              <Icon
                name="heroicons:exclamation-triangle-20-solid"
                class="h-6 w-6"
              />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-foreground text-lg font-bold">Time-Off Conflict Detected</h3>
              <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
                You are setting a repeating clinic schedule, but
                <span class="text-foreground font-bold">
                  {{ pendingRecurringDutyData.conflictingBlockedDates.length }} day{{
                    pendingRecurringDutyData.conflictingBlockedDates.length === 1 ? '' : 's'
                  }}
                </span>
                during this period are already marked as your
                <span class="font-semibold text-rose-500">Time-Off (Blocked)</span>.
              </p>
            </div>
          </div>

          <!-- List of Conflicting Blocked Dates -->
          <div class="mt-4 space-y-2">
            <p class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
              Affected Time-Off Dates
            </p>
            <div
              class="border-border bg-foreground/[0.02] divide-border max-h-36 divide-y overflow-y-auto rounded-2xl border"
            >
              <div
                v-for="dateStr in pendingRecurringDutyData.conflictingBlockedDates"
                :key="dateStr"
                class="flex items-center justify-between p-2.5 text-xs"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="heroicons:calendar-days"
                    class="text-muted-foreground h-4 w-4"
                  />
                  <span class="text-foreground font-semibold">
                    {{ formatReadableDate(dateStr) }}
                  </span>
                </div>
                <span
                  class="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-500"
                >
                  Time Off / Blocked
                </span>
              </div>
            </div>
          </div>

          <!-- Redundant notice if some days are identical -->
          <div
            v-if="pendingRecurringDutyData.redundantDates.length > 0"
            class="mt-3 flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 p-2.5 text-[11px] text-sky-700 dark:text-sky-300"
          >
            <Icon
              name="heroicons:information-circle-20-solid"
              class="h-4 w-4 shrink-0"
            />
            <span>
              {{ pendingRecurringDutyData.redundantDates.length }} of the days already have this
              exact clinic schedule and will not be duplicated.
            </span>
          </div>

          <!-- Layman Decision Prompt -->
          <div class="mt-4">
            <p class="text-foreground text-xs font-bold">
              Choose how you would like to handle your scheduled time-off:
            </p>
            <p class="text-muted-foreground mt-0.5 text-[11px]">
              Select an option below to proceed. You must choose an option before confirming.
            </p>
          </div>

          <!-- Selectable Options List -->
          <div class="mt-3 space-y-2.5">
            <!-- Option 1: Keep Time Off (Blocked Overrides) -->
            <div
              role="button"
              tabindex="0"
              @click="selectKeepBlockedOption"
              class="group relative w-full cursor-pointer rounded-2xl border p-3.5 text-left transition-all outline-none"
              :class="[
                selectedBlockedResolutionOption === 'keep_blocked'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-xs ring-2 ring-emerald-500/30'
                  : 'border-border bg-card hover:border-emerald-500/50 hover:bg-emerald-500/[0.03]'
              ]"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 flex-1 items-start gap-3">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105"
                    :class="
                      selectedBlockedResolutionOption === 'keep_blocked'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-emerald-500/10 text-emerald-600'
                    "
                  >
                    <Icon
                      name="heroicons:shield-check-20-solid"
                      class="h-5 w-5"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <p class="text-foreground text-xs font-bold">
                        Keep My Time Off (Skip Blocked Days)
                      </p>
                      <span
                        class="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600"
                      >
                        Recommended
                      </span>
                    </div>
                    <p class="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                      Leave your time-off untouched. Clinic hours will only be scheduled on your
                      free, unblocked days ({{
                        pendingRecurringDutyData.targetDates.filter(
                          d =>
                            !pendingRecurringDutyData.conflictingBlockedDates.includes(d) &&
                            !pendingRecurringDutyData.redundantDates.includes(d)
                        ).length
                      }}
                      open day{{
                        pendingRecurringDutyData.targetDates.filter(
                          d =>
                            !pendingRecurringDutyData.conflictingBlockedDates.includes(d) &&
                            !pendingRecurringDutyData.redundantDates.includes(d)
                        ).length === 1
                          ? ''
                          : 's'
                      }}).
                    </p>
                  </div>
                </div>

                <!-- Radio Check Indicator -->
                <div class="shrink-0 pt-0.5">
                  <div
                    class="flex h-5 w-5 items-center justify-center rounded-full transition-all"
                    :class="
                      selectedBlockedResolutionOption === 'keep_blocked'
                        ? 'bg-emerald-500 text-white shadow-2xs'
                        : 'border-border/80 border-2 group-hover:border-emerald-500/60'
                    "
                  >
                    <Icon
                      v-if="selectedBlockedResolutionOption === 'keep_blocked'"
                      name="heroicons:check-20-solid"
                      class="h-3.5 w-3.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Option 2: Schedule Overrides (Open Clinic on All Days) -->
            <div
              role="button"
              tabindex="0"
              @click="selectOverrideBlockedOption"
              class="group relative w-full cursor-pointer rounded-2xl border p-3.5 text-left transition-all outline-none"
              :class="[
                selectedBlockedResolutionOption === 'override_blocked'
                  ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-2 ring-amber-500/30'
                  : 'border-border bg-card hover:border-amber-500/50 hover:bg-amber-500/[0.03]'
              ]"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 flex-1 items-start gap-3">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105"
                    :class="
                      selectedBlockedResolutionOption === 'override_blocked'
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-500/10 text-amber-600'
                    "
                  >
                    <Icon
                      name="heroicons:arrow-path-rounded-square-20-solid"
                      class="h-5 w-5"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-foreground text-xs font-bold">
                      Open Clinic on All Days (Cancel Time Off)
                    </p>
                    <p class="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                      Cancel your time-off on those days. Clinic hours will be scheduled across all
                      selected dates.
                    </p>
                  </div>
                </div>

                <!-- Radio Check Indicator -->
                <div class="shrink-0 pt-0.5">
                  <div
                    class="flex h-5 w-5 items-center justify-center rounded-full transition-all"
                    :class="
                      selectedBlockedResolutionOption === 'override_blocked'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'border-border/80 border-2 group-hover:border-amber-500/60'
                    "
                  >
                    <Icon
                      v-if="selectedBlockedResolutionOption === 'override_blocked'"
                      name="heroicons:check-20-solid"
                      class="h-3.5 w-3.5"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="border-border/60 mt-5 flex items-center justify-between border-t pt-3.5">
            <button
              type="button"
              :disabled="isResolvingRecurringConflict"
              @click="closeRecurringBlockedModal"
              class="text-muted-foreground hover:text-foreground cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold transition"
            >
              Cancel & Review
            </button>

            <button
              type="button"
              :disabled="!selectedBlockedResolutionOption || isResolvingRecurringConflict"
              @click="handleProceedRecurringResolution"
              class="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all"
              :class="[
                !selectedBlockedResolutionOption || isResolvingRecurringConflict
                  ? 'bg-foreground/10 text-muted-foreground/60 cursor-not-allowed opacity-60'
                  : selectedBlockedResolutionOption === 'keep_blocked'
                    ? 'cursor-pointer bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                    : 'cursor-pointer bg-amber-600 text-white shadow-sm hover:bg-amber-700'
              ]"
            >
              <Icon
                v-if="isResolvingRecurringConflict"
                name="lucide:loader-2"
                class="h-3.5 w-3.5 animate-spin"
              />
              <span>
                {{
                  selectedBlockedResolutionOption === 'keep_blocked'
                    ? 'Confirm (Keep My Time Off)'
                    : selectedBlockedResolutionOption === 'override_blocked'
                      ? 'Confirm (Open Clinic on All Days)'
                      : 'Choose an Option to Proceed'
                }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Logout Modal -->
    <AppModalConfirmation
      v-if="isLogoutModalOpen"
      title="Confirm Sign Out"
      description="Are you sure you want to log out of your doctor account?"
      icon="ic:round-log-out"
      confirm-text="Log Out"
      confirm-variant="destructive"
      @confirm="logout"
      @cancel="isLogoutModalOpen = false"
    />

    <!-- Image Cropping Modal -->
    <AppModalCropImage
      v-model="showCropModal"
      :image-src="rawAvatarSrc"
      :loading="isUploadingAvatar"
      @crop="handleApplyCroppedAvatar"
      @cancel="rawAvatarSrc = ''"
    />

    <!-- Edit Availability Slot Modal (List Cards View) -->
    <AppModalEditAvailability
      v-model="showEditSlotModal"
      :slot-data="slotToEdit"
      :clinics="clinics"
      @saved="handleEditSlotSaved"
    />

    <!-- Doctor Prescription Signature Modal -->
    <AppPrescriptionDoctorSignatureModal
      v-model="showSignatureModal"
      :initial-ptr="form.ptrNumber"
      :initial-tin="form.tinNumber"
      :initial-s2="form.s2Number"
      :initial-signature-url="form.signatureUrl"
      @saved="handleSignatureSaved"
    />
  </div>
</template>

<style scoped>
  select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 1.5em;
  }
</style>
