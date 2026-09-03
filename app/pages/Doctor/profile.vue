<script setup lang="ts">
  import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'
  import {
    doctorSubscriptionService,
    type DoctorSubscription,
    type DoctorPlan
  } from '~/api/subscription/DoctorSubscriptionService'
  import { userService } from '~/api/user/UserService'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  // Doctors might have verification data
  const { data: response, refresh } = userService.useShow(useCookie('user_uuid').value as string, {
    key: `userProfile-${useCookie('user_uuid').value}`
  })
  // Laravel JsonResource wraps single resources under `data` — unwrap at source
  const user = computed(() => (response.value as any)?.data ?? response.value)

  const {
    regions,
    provinces,
    cities,
    barangays,
    fetchRegions,
    fetchProvinces,
    fetchCities,
    fetchBarangays,
    findProvinceByName,
    findCityByName,
    findBarangayByName
  } = usePhLocations()

  const { getStorageUrl } = useStorage()
  const { missingDoctorFields, refreshProfile } = useAppNotifications()

  const codes = reactive({
    region: '',
    province: '',
    city: '',
    barangay: ''
  })

  const form = reactive({
    first_name: '',
    last_name: '',
    email: '',
    street: '',
    barangay: '',
    city: '',
    province: '',
    country: 'Philippines',
    latitude: null as number | null,
    longitude: null as number | null,
    age: '',
    gender: '',
    affiliation: '',
    prcNumber: ''
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
      fetchRegions(),
      fetchAvailabilities(),
      fetchClinics(true),
      fetchClinicDoctors(true),
      fetchSubscriptionInfo()
    ])
  })

  const doctorUuid = useCookie('user_uuid').value
  const availabilities = ref<any[]>([])
  const isAvailLoading = ref(false)
  const isAddLoading = ref(false)
  const scheduleViewMode = ref<'cards' | 'timetable'>('cards')

  // Inner Sidebar Tabs
  type SettingsTab = 'profile' | 'clinics' | 'schedule' | 'subscription' | 'security'
  const activeTab = ref<SettingsTab>('profile')

  const navTabs = computed(() => [
    {
      id: 'profile' as SettingsTab,
      label: 'Profile & Credentials',
      desc: 'Personal details, affiliation & PRC license',
      icon: 'heroicons:user-circle'
    },
    {
      id: 'clinics' as SettingsTab,
      label: 'Clinics & Doctor Team',
      desc: isOwner.value ? 'Clinic locations & associate doctor seats' : 'Clinic locations & affiliated doctors',
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
      desc: isSubInherited.value ? 'Clinic tier & sponsored access' : 'Plan status, quotas & billing',
      icon: 'heroicons:credit-card'
    },
    {
      id: 'security' as SettingsTab,
      label: 'Account & Security',
      desc: 'Verification & session security',
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

  // Clinic Management
  const { clinics, fetchClinics, addClinic, removeClinic } = useDoctorClinics()
  const showAddClinicModal = ref(false)
  const isClinicSubmitting = ref(false)
  const clinicForm = reactive({
    name: '',
    address: '',
    phone: '',
    email: ''
  })
  const clinicError = ref('')

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
        email: clinicForm.email.trim() || null
      })
      showAddClinicModal.value = false
      clinicForm.name = ''
      clinicForm.address = ''
      clinicForm.phone = ''
      clinicForm.email = ''
    } catch (err: any) {
      clinicError.value = err.data?.message || err.message || 'Failed to add clinic branch.'
    } finally {
      isClinicSubmitting.value = false
    }
  }

  const handleDeleteClinic = async (uuid: string) => {
    if (!confirm('Are you sure you want to remove this clinic branch?')) return
    try {
      await removeClinic(uuid)
    } catch (err: any) {
      alert(err.data?.message || err.message || 'Failed to delete clinic branch.')
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
      await assignDoctor(payload)
      showAssignDoctorModal.value = false
      clearCandidateDoctor()
    } catch (err: any) {
      assignDoctorError.value =
        err.data?.message || err.message || 'Failed to assign doctor to clinic seat.'
    } finally {
      isAssigningDoctor.value = false
    }
  }

  const handleRemoveDoctorSeat = async (pivotId: number, doctorName: string) => {
    if (
      !confirm(
        `Are you sure you want to revoke the doctor seat for ${doctorName}? Their access will be unlinked, but their past records will remain intact.`
      )
    )
      return
    try {
      await removeDoctor(pivotId)
    } catch (err: any) {
      alert(err.data?.message || err.message || 'Failed to remove doctor seat.')
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

  const addAvailability = async () => {
    if (!doctorUuid) {
      availErrorMsg.value = 'Unable to identify your doctor profile. Please sign in again.'
      return
    }

    if (!availForm.available_date) {
      availErrorMsg.value = 'Please select a date.'
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

    isAddLoading.value = true
    availErrorMsg.value = ''
    availSuccessMsg.value = ''
    try {
      const isAvailable = scheduleType.value === 'duty'
      let locName: string | null = null
      if (isAvailable) {
        const matched = clinics.value.find(c => c.id === selectedClinicId.value)
        locName = matched ? matched.name : customLocation.value.trim() || 'Clinic Duty'
      } else {
        locName = 'Blocked / Away Period'
      }

      await doctorAvailabilityService.createForDoctor(doctorUuid, {
        available_date: availForm.available_date,
        start_time: startTime,
        end_time: endTime,
        is_available: isAvailable ? 1 : 0,
        clinic_id: isAvailable ? selectedClinicId.value : null,
        location_name: locName
      })
      availSuccessMsg.value = isAvailable
        ? 'Clinic Duty Schedule added successfully!'
        : 'Blocked / Away period added successfully!'
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
      availErrorMsg.value = e.data?.message || e.message || 'Failed to add availability.'
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

  // Cascading logic
  watch(
    () => codes.region,
    async newVal => {
      if (newVal) {
        codes.province = ''
        codes.city = ''
        codes.barangay = ''
        const region = regions.value.find(r => r.code === newVal)
        if (region) form.province = region.name
        await fetchProvinces(newVal)
      }
    }
  )

  watch(
    () => codes.province,
    async newVal => {
      if (newVal) {
        codes.city = ''
        codes.barangay = ''
        const prov = provinces.value.find(p => p.code === newVal)
        if (prov) form.province = prov.name
        await fetchCities(newVal)
      }
    }
  )

  watch(
    () => codes.city,
    async newVal => {
      if (newVal) {
        codes.barangay = ''
        const city = cities.value.find(c => c.code === newVal)
        if (city) form.city = city.name
        await fetchBarangays(newVal)
      }
    }
  )

  watch(
    () => codes.barangay,
    newVal => {
      if (newVal) {
        const brgy = barangays.value.find(b => b.code === newVal)
        if (brgy) form.barangay = brgy.name
      }
    }
  )

  const initDropdowns = async () => {
    if (form.province) {
      const prov = await findProvinceByName(form.province)
      if (prov) {
        codes.region = prov.regionCode
        await fetchProvinces(prov.regionCode)
        codes.province = prov.code

        if (form.city) {
          const city = await findCityByName(prov.code, form.city)
          if (city) {
            await fetchCities(prov.code)
            codes.city = city.code

            if (form.barangay) {
              const brgy = await findBarangayByName(city.code, form.barangay)
              if (brgy) {
                await fetchBarangays(city.code)
                codes.barangay = brgy.code
              }
            }
          }
        }
      }
    }
  }

  const loaded = ref(false)
  watch(
    user,
    newVal => {
      if (newVal && !loaded.value) {
        const userData = newVal
        form.first_name = userData.first_name || ''
        form.last_name = userData.last_name || ''
        form.email = userData.email || ''
        form.street = userData.street || ''
        form.barangay = userData.barangay || ''
        form.city = userData.city || ''
        form.province = userData.province || ''
        form.country = userData.country || 'Philippines'
        form.latitude = userData.latitude ?? null
        form.longitude = userData.longitude ?? null
        form.age = userData.age || ''
        form.gender = userData.gender || ''
        form.affiliation = userData.affiliation || ''

        form.prcNumber = userData.prcNumber || userData.doctor_verification?.prcNumber || ''

        initDropdowns()
        loaded.value = true
      }
    },
    { immediate: true, deep: true }
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
    isLoading.value = true
    try {
      // Auto-geocode before saving if coordinates are empty
      if (!form.latitude || !form.longitude) {
        await geocodeAddress()
      }

      await userService.update(useCookie('user_uuid').value as string, form)
      isSuccess.value = true
      await refresh()
      await refreshProfile()

      // Update name cookies so UI reflects the change (keep Dr. prefix if needed but cookies usually store raw name)
      const userName = useCookie('user_name')
      const authName = useCookie('auth_user_name')
      userName.value = `${form.first_name} ${form.last_name}`
      authName.value = `${form.first_name} ${form.last_name}`

      setTimeout(() => {
        isSuccess.value = false
        navigateTo('/doctor')
      }, 1500)
    } catch (error) {
      console.error('Failed to update profile:', error)
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
    <!-- Header -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-foreground text-2xl font-bold sm:text-3xl">Doctor Settings</h1>
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
      <aside class="w-full shrink-0 space-y-3 lg:w-64">
        <!-- Doctor Quick Identity Card -->
        <div class="bg-card border-border rounded-2xl border p-4 text-center shadow-xs">
          <div
            class="from-primary/20 to-primary/5 border-primary/20 relative mx-auto mb-3 h-16 w-16 overflow-hidden rounded-full border bg-linear-to-br p-0.5"
          >
            <template v-if="user?.avatar_path">
              <NuxtImg
                :src="getStorageUrl(user.avatar_path)"
                class="h-full w-full rounded-full object-cover"
                placeholder
              />
            </template>
            <div
              v-else
              class="bg-sidebar/60 text-primary flex h-full w-full items-center justify-center rounded-full text-xl font-bold"
            >
              Dr. {{ form.last_name?.charAt(0) }}
            </div>
            <button
              class="bg-primary hover:bg-primary/90 absolute right-0 bottom-0 z-10 cursor-pointer rounded-full p-1 text-white shadow-md transition"
            >
              <Icon
                name="heroicons:camera-20-solid"
                size="11"
              />
            </button>
          </div>
          <h2 class="text-foreground truncate text-sm font-bold">
            Dr. {{ form.first_name }} {{ form.last_name }}
          </h2>
          <p class="text-muted-foreground truncate text-[11px] italic">{{ form.email }}</p>

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
        <!-- 1. PROFILE & BIO TAB -->
        <div
          v-if="activeTab === 'profile'"
          class="bg-card border-border animate-in fade-in space-y-6 rounded-3xl border p-6 shadow-xs duration-300 sm:p-8"
        >
          <div>
            <h2 class="text-foreground text-xl font-bold">Doctor Profile & Credentials</h2>
            <p class="text-muted-foreground mt-1 text-xs">
              Manage your professional credentials, medical affiliation, PRC license, and practice address.
            </p>
          </div>

          <div class="bg-border h-px"></div>

          <form
            @submit.prevent="submitProfile"
            class="flex flex-col gap-6"
          >
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                  >First Name</label
                >
                <input
                  v-model="form.first_name"
                  type="text"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                  placeholder="Enter first name"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                  >Last Name</label
                >
                <input
                  v-model="form.last_name"
                  type="text"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="text-foreground flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                  >Email Address</label
                >
                <input
                  v-model="form.email"
                  type="email"
                  disabled
                  class="bg-foreground/5 border-border w-full cursor-not-allowed rounded-2xl border px-4 py-3 text-sm font-medium opacity-60 outline-none"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                  >Affiliation</label
                >
                <input
                  v-model="form.affiliation"
                  type="text"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                  placeholder="e.g. Philippine Dermatological Society"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                  >PRC License Number</label
                >
                <input
                  v-model="form.prcNumber"
                  type="text"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                  placeholder="Enter PRC license number"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                  >Age</label
                >
                <input
                  v-model="form.age"
                  type="number"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                  placeholder="Your age"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                  >Gender</label
                >
                <select
                  v-model="form.gender"
                  class="bg-foreground/5 border-border focus:border-primary w-full cursor-pointer appearance-none rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                >
                  <option
                    value=""
                    disabled
                  >
                    Select gender
                  </option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                  >Region</label
                >
                <select
                  v-model="codes.region"
                  class="bg-foreground/5 border-border focus:border-primary w-full cursor-pointer appearance-none rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                >
                  <option
                    value=""
                    disabled
                  >
                    Select Region
                  </option>
                  <option
                    v-for="r in regions"
                    :key="r.code"
                    :value="r.code"
                  >
                    {{ r.name }}
                  </option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                  >Province</label
                >
                <select
                  v-model="codes.province"
                  :disabled="!provinces.length"
                  class="bg-foreground/5 border-border focus:border-primary w-full cursor-pointer appearance-none rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none disabled:opacity-50"
                >
                  <option
                    value=""
                    disabled
                  >
                    {{ provinces.length ? 'Select Province' : 'N/A' }}
                  </option>
                  <option
                    v-for="p in provinces"
                    :key="p.code"
                    :value="p.code"
                  >
                    {{ p.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                  >City / Municipality</label
                >
                <select
                  v-model="codes.city"
                  :disabled="!cities.length"
                  class="bg-foreground/5 border-border focus:border-primary w-full cursor-pointer appearance-none rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none disabled:opacity-50"
                >
                  <option
                    value=""
                    disabled
                  >
                    Select City
                  </option>
                  <option
                    v-for="c in cities"
                    :key="c.code"
                    :value="c.code"
                  >
                    {{ c.name }}
                  </option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                  >Barangay</label
                >
                <select
                  v-model="codes.barangay"
                  :disabled="!barangays.length"
                  class="bg-foreground/5 border-border focus:border-primary w-full cursor-pointer appearance-none rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none disabled:opacity-50"
                >
                  <option
                    value=""
                    disabled
                  >
                    Select Barangay
                  </option>
                  <option
                    v-for="b in barangays"
                    :key="b.code"
                    :value="b.code"
                  >
                    {{ b.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                >Street Address / Practice Location</label
              >
              <input
                v-model="form.street"
                type="text"
                class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                placeholder="House No., Street Name, Clinic/Hospital Rm"
              />
            </div>

            <div class="border-border mt-4 flex items-center justify-between border-t pt-2">
              <div
                v-if="isSuccess"
                class="flex items-center gap-2 text-sm font-bold text-emerald-600"
              >
                <Icon
                  name="heroicons:check-circle"
                  size="20"
                />
                <span>Doctor profile updated successfully!</span>
              </div>
              <div v-else></div>

              <AppButton
                type="submit"
                :loading="isLoading"
                class="min-w-[140px]"
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
            <button
              v-if="isOwner"
              type="button"
              @click="showAddClinicModal = true"
              class="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold shadow-xs transition"
            >
              <Icon
                name="heroicons:plus"
                class="h-4 w-4"
              />
              <span>Add Clinic</span>
            </button>
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

                <!-- Delete Clinic Branch (ONLY FOR OWNER) -->
                <button
                  v-if="clinic.is_owner !== false"
                  type="button"
                  @click="handleDeleteClinic(clinic.uuid)"
                  class="text-muted-foreground shrink-0 cursor-pointer rounded-xl p-1.5 transition hover:bg-red-500/10 hover:text-red-500"
                  title="Remove Clinic"
                >
                  <Icon
                    name="heroicons:trash"
                    class="h-4 w-4"
                  />
                </button>
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
                <span class="inline-flex items-center gap-1.5">
                  <Icon
                    name="heroicons:phone"
                    class="text-primary h-3.5 w-3.5"
                  />
                  {{ clinic.phone || 'No phone set' }}
                </span>
                <span
                  class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700"
                >
                  Active
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
                    <h3 class="text-foreground text-lg font-bold">
                      Doctor Team & Affiliations
                    </h3>
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
                    <h3 class="text-foreground text-lg font-bold">
                      Doctor Team & Seat Allocation
                    </h3>
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

                <button
                  type="button"
                  @click="openAssignDoctorModal"
                  :disabled="!clinics.length || (seatUsage && !seatUsage.can_add)"
                  class="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon
                    name="lucide:user-plus"
                    class="h-4 w-4"
                  />
                  <span>Assign Associate Doctor</span>
                </button>
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
                class="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-400"
              >
                <div class="flex items-center gap-2.5">
                  <Icon
                    name="lucide:info"
                    class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                  />
                  <span
                    >Your current plan only supports 1 doctor seat. Upgrade to the
                    <strong>Clinic Group Plan</strong> to add up to 10 doctors.</span
                  >
                </div>
                <NuxtLink
                  to="/doctor/subscription"
                  class="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700"
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
                      @click="handleRemoveDoctorSeat(assoc.pivot_id, assoc.doctor.full_name)"
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
                <select
                  v-if="clinics.length > 0"
                  v-model="selectedClinicId"
                  class="border-border bg-foreground/5 focus:border-primary w-full cursor-pointer rounded-2xl border px-4 py-3 text-sm font-semibold outline-none"
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

                <input
                  v-if="clinics.length === 0 || !selectedClinicId"
                  v-model="customLocation"
                  type="text"
                  placeholder="Or type clinic name / room..."
                  class="border-border bg-foreground/5 focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium outline-none"
                />
              </div>
            </div>

            <!-- Date and Times Row -->
            <div class="grid gap-4 sm:grid-cols-3">
              <div class="space-y-1.5">
                <label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >Date *</label
                >
                <input
                  v-model="availForm.available_date"
                  type="date"
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
                  v-for="slot in availabilities"
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

                  <div class="flex items-center gap-3">
                    <button
                      @click="deleteAvailability(slot.uuid)"
                      class="text-foreground/40 cursor-pointer rounded-xl p-2 transition-all hover:bg-red-500/5 hover:text-red-500"
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
                        Billed {{ mySubscription.billing_cycle }} • Valid through
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
                  <span class="mt-0.5 block text-sm font-bold text-emerald-600"> Included </span>
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

                    <NuxtLink
                      to="/Doctor/subscription"
                      class="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-indigo-950 shadow-md transition hover:bg-indigo-50"
                    >
                      <span>Explore Solo Plans</span>
                      <Icon
                        name="heroicons:arrow-right"
                        class="h-4 w-4"
                      />
                    </NuxtLink>
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
                    class="cursor-pointer rounded-2xl bg-white px-5 py-2.5 font-extrabold text-indigo-950 shadow-lg hover:bg-indigo-50"
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

          <div class="space-y-4">
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

            <!-- Sign Out Row -->
            <div
              class="flex items-center justify-between gap-4 rounded-2xl border border-red-200/60 bg-red-50/40 p-5"
            >
              <div>
                <h4 class="text-sm font-bold text-red-900">Sign Out</h4>
                <p class="mt-0.5 text-xs text-red-600/80">
                  Terminate your current session on this device.
                </p>
              </div>

              <button
                type="button"
                @click="isLogoutModalOpen = true"
                class="cursor-pointer rounded-xl bg-red-100 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-200"
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

            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                @click="showAddClinicModal = false"
                class="text-foreground/70 hover:bg-foreground/5 cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <AppButton
                type="submit"
                :loading="isClinicSubmitting"
                class="px-5 py-2 text-xs font-bold"
              >
                Save Clinic
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
                >Assigned doctors will immediately inherit full AI scanning, teleconsultation, and
                clinical report generation privileges under your active subscription plan.</span
              >
            </div>

            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                @click="showAssignDoctorModal = false"
                class="text-foreground/70 hover:bg-foreground/5 cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <AppButton
                type="submit"
                :loading="isAssigningDoctor"
                class="px-5 py-2 text-xs font-bold"
              >
                Confirm & Assign Seat
              </AppButton>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Logout Modal -->
    <AppModalConfirm
      v-if="isLogoutModalOpen"
      title="Confirm Sign Out"
      message="Are you sure you want to log out of your doctor account?"
      confirm-text="Log Out"
      confirm-variant="danger"
      @confirm="logout"
      @cancel="isLogoutModalOpen = false"
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
