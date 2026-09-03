<script setup lang="ts">
import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'
import { doctorSubscriptionService, type DoctorSubscription, type DoctorPlan } from '~/api/subscription/DoctorSubscriptionService'
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
  regions, provinces, cities, barangays,
  fetchRegions, fetchProvinces, fetchCities, fetchBarangays,
  findProvinceByName, findCityByName, findBarangayByName
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

const fetchSubscriptionInfo = async () => {
  isSubLoading.value = true
  try {
    const [subRes, plansRes] = await Promise.all([
      doctorSubscriptionService.getMySubscription(),
      doctorSubscriptionService.getPlans()
    ])
    mySubscription.value = subRes.data?.subscription || null
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

const navTabs = [
  { id: 'profile' as SettingsTab, label: 'Profile & Bio', desc: 'Personal info & practice address', icon: 'heroicons:user-circle' },
  { id: 'clinics' as SettingsTab, label: 'Clinic Branches', desc: 'Locations & hospital clinics', icon: 'heroicons:building-office-2' },
  { id: 'schedule' as SettingsTab, label: 'Duty & Away Presets', desc: 'Working hours & blockouts', icon: 'heroicons:calendar-days' },
  { id: 'subscription' as SettingsTab, label: 'Subscription & Limits', desc: 'Plan status, seats & billing', icon: 'heroicons:credit-card' },
  { id: 'security' as SettingsTab, label: 'Account & Security', desc: 'Verification & session', icon: 'heroicons:shield-check' }
]

const route = useRoute()
watch(() => route.query.tab, (newTab) => {
  if (newTab && typeof newTab === 'string') {
    activeTab.value = newTab as SettingsTab
  }
}, { immediate: true })

watch(() => route.hash, (hash) => {
  if (hash === '#blocked-dates') {
    activeTab.value = 'schedule'
  } else if (hash === '#seats') {
    activeTab.value = 'clinics'
  }
}, { immediate: true })

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
    assignDoctorError.value = err.data?.message || err.message || 'Failed to assign doctor to clinic seat.'
  } finally {
    isAssigningDoctor.value = false
  }
}

const handleRemoveDoctorSeat = async (pivotId: number, doctorName: string) => {
  if (!confirm(`Are you sure you want to revoke the doctor seat for ${doctorName}? Their access will be unlinked, but their past records will remain intact.`)) return
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

watch(blockWholeDay, (val) => {
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

  const startTime = (scheduleType.value === 'away' && blockWholeDay.value ? '00:00' : (availForm.start_time || '00:00')).slice(0, 5)
  const endTime = (scheduleType.value === 'away' && blockWholeDay.value ? '23:59' : (availForm.end_time || '23:59')).slice(0, 5)

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
      locName = matched ? matched.name : (customLocation.value.trim() || 'Clinic Duty')
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
    availSuccessMsg.value = isAvailable ? 'Clinic Duty Schedule added successfully!' : 'Blocked / Away period added successfully!'
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
watch(() => codes.region, async (newVal) => {
  if (newVal) {
    codes.province = ''
    codes.city = ''
    codes.barangay = ''
    const region = regions.value.find(r => r.code === newVal)
    if (region) form.province = region.name
    await fetchProvinces(newVal)
  }
})

watch(() => codes.province, async (newVal) => {
  if (newVal) {
    codes.city = ''
    codes.barangay = ''
    const prov = provinces.value.find(p => p.code === newVal)
    if (prov) form.province = prov.name
    await fetchCities(newVal)
  }
})

watch(() => codes.city, async (newVal) => {
  if (newVal) {
    codes.barangay = ''
    const city = cities.value.find(c => c.code === newVal)
    if (city) form.city = city.name
    await fetchBarangays(newVal)
  }
})

watch(() => codes.barangay, (newVal) => {
  if (newVal) {
    const brgy = barangays.value.find(b => b.code === newVal)
    if (brgy) form.barangay = brgy.name
  }
})

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
watch(user, (newVal) => {
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
}, { immediate: true, deep: true })

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
    let response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
      headers: { 'User-Agent': 'DermAssist/1.0 (contact@dermassist.com)' }
    })
    let data = await response.json()

    // Step 2: Fallback to City level if specific fails
    if (!data || data.length === 0) {
      query = `${form.city}, ${form.province}, ${form.country}`
      response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
        headers: { 'User-Agent': 'DermAssist/1.0 (contact@dermassist.com)' }
      })
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
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-foreground">Doctor Settings</h1>
        <p class="text-foreground/60 text-sm mt-1">Manage your professional profile, clinic branches, schedule presets, and subscription.</p>
      </div>

      <div v-if="user?.doctor_verification?.status === 'verified'"
        class="inline-flex items-center gap-2 bg-primary/10 text-primary px-3.5 py-1.5 rounded-2xl border border-primary/20 shrink-0">
        <Icon name="heroicons:shield-check-20-solid" size="18" />
        <span class="text-xs font-bold uppercase tracking-wider">Verified Professional</span>
      </div>
    </div>

    <!-- Profile Completion Alert -->
    <AppAlert
      v-if="missingDoctorFields.length > 0"
      title="Profile Setup Required"
      type="error"
    >
      Your profile is incomplete. Please fill out the following fields: 
      <span class="font-bold underline">{{ missingDoctorFields.join(', ') }}</span>.
    </AppAlert>

    <!-- Inner Sidebar Layout Container -->
    <div class="flex flex-col lg:flex-row gap-6 items-start">
      <!-- Left Inner Sidebar (Compact & Sleek) -->
      <aside class="w-full lg:w-64 shrink-0 space-y-3">
        <!-- Doctor Quick Identity Card -->
        <div class="bg-card border border-border rounded-2xl p-4 text-center shadow-xs">
          <div class="relative mx-auto mb-3 h-16 w-16 overflow-hidden rounded-full bg-linear-to-br from-primary/20 to-primary/5 p-0.5 border border-primary/20">
            <template v-if="user?.avatar_path">
              <NuxtImg :src="getStorageUrl(user.avatar_path)" class="h-full w-full rounded-full object-cover" placeholder />
            </template>
            <div v-else class="flex h-full w-full items-center justify-center rounded-full bg-sidebar/60 text-xl font-bold text-primary">
              Dr. {{ form.last_name?.charAt(0) }}
            </div>
            <button class="absolute bottom-0 right-0 z-10 bg-primary p-1 rounded-full text-white shadow-md hover:bg-primary/90 transition cursor-pointer">
              <Icon name="heroicons:camera-20-solid" size="11" />
            </button>
          </div>
          <h2 class="text-sm font-bold text-foreground truncate">Dr. {{ form.first_name }} {{ form.last_name }}</h2>
          <p class="text-muted-foreground text-[11px] italic truncate">{{ form.email }}</p>

          <div class="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-[11px]">
            <span class="text-muted-foreground font-medium">Verification</span>
            <AppProfileStatusBadge
              :is-complete="user?.doctor_verification?.status === 'verified'"
              :is-declined="user?.doctor_verification?.status === 'declined'"
              :is-pending="user?.doctor_verification?.status === 'pending'" />
          </div>
        </div>

        <!-- Inner Navigation Menu -->
        <div class="bg-card border border-border rounded-2xl p-2 shadow-xs space-y-1">
          <button
            v-for="tab in navTabs"
            :key="tab.id"
            type="button"
            @click="activeTab = tab.id"
            class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group"
            :class="activeTab === tab.id 
              ? 'bg-primary text-primary-foreground font-bold shadow-2xs' 
              : 'hover:bg-foreground/5 text-foreground/70 hover:text-foreground font-medium'"
          >
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
              :class="activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-foreground/5 text-foreground/60 group-hover:bg-foreground/10 group-hover:text-foreground'"
            >
              <Icon :name="tab.icon" class="w-3.5 h-3.5" />
            </div>
            <div class="min-w-0 flex-1">
              <span class="text-xs block leading-tight truncate">{{ tab.label }}</span>
            </div>
            <Icon 
              name="heroicons:chevron-right" 
              class="w-3.5 h-3.5 shrink-0 transition-transform opacity-40 group-hover:translate-x-0.5" 
              :class="activeTab === tab.id ? 'opacity-100' : ''"
            />
          </button>
        </div>
      </aside>

      <!-- Right Main Content Panel (Expanded) -->
      <main class="flex-1 min-w-0">
        <!-- 1. PROFILE & BIO TAB -->
        <div v-if="activeTab === 'profile'" class="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in duration-300">
          <div>
            <h2 class="text-xl font-bold text-foreground">Doctor Profile Information</h2>
            <p class="text-muted-foreground text-xs mt-1">Update your professional profile details, affiliation, and clinical practice address.</p>
          </div>

          <div class="h-px bg-border"></div>

          <form @submit.prevent="submitProfile" class="flex flex-col gap-6">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold uppercase tracking-wider">First Name</label>
                <input v-model="form.first_name" type="text"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none text-sm font-medium transition-all"
                  placeholder="Enter first name" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold uppercase tracking-wider">Last Name</label>
                <input v-model="form.last_name" type="text"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none text-sm font-medium transition-all"
                  placeholder="Enter last name" />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5 text-foreground">
                <label class="text-foreground/70 text-xs font-bold uppercase tracking-wider">Email Address</label>
                <input v-model="form.email" type="email" disabled
                  class="bg-foreground/5 border-border w-full rounded-2xl border px-4 py-3 outline-none text-sm font-medium opacity-60 cursor-not-allowed" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold uppercase tracking-wider">Affiliation</label>
                <input v-model="form.affiliation" type="text"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none text-sm font-medium transition-all"
                  placeholder="e.g. Philippine Dermatological Society" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold uppercase tracking-wider">PRC License Number</label>
                <input v-model="form.prcNumber" type="text"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none text-sm font-medium transition-all"
                  placeholder="Enter PRC license number" />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold uppercase tracking-wider">Age</label>
                <input v-model="form.age" type="number"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none text-sm font-medium transition-all"
                  placeholder="Your age" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold uppercase tracking-wider">Gender</label>
                <select v-model="form.gender"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none text-sm font-medium transition-all appearance-none cursor-pointer">
                  <option value="" disabled>Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold uppercase tracking-wider">Region</label>
                <select v-model="codes.region"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none text-sm font-medium transition-all appearance-none cursor-pointer">
                  <option value="" disabled>Select Region</option>
                  <option v-for="r in regions" :key="r.code" :value="r.code">{{ r.name }}</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold uppercase tracking-wider">Province</label>
                <select v-model="codes.province" :disabled="!provinces.length"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none text-sm font-medium transition-all appearance-none disabled:opacity-50 cursor-pointer">
                  <option value="" disabled>{{ provinces.length ? 'Select Province' : 'N/A' }}</option>
                  <option v-for="p in provinces" :key="p.code" :value="p.code">{{ p.name }}</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold uppercase tracking-wider">City / Municipality</label>
                <select v-model="codes.city" :disabled="!cities.length"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none text-sm font-medium transition-all appearance-none disabled:opacity-50 cursor-pointer">
                  <option value="" disabled>Select City</option>
                  <option v-for="c in cities" :key="c.code" :value="c.code">{{ c.name }}</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 text-xs font-bold uppercase tracking-wider">Barangay</label>
                <select v-model="codes.barangay" :disabled="!barangays.length"
                  class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none text-sm font-medium transition-all appearance-none disabled:opacity-50 cursor-pointer">
                  <option value="" disabled>Select Barangay</option>
                  <option v-for="b in barangays" :key="b.code" :value="b.code">{{ b.name }}</option>
                </select>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-foreground/70 text-xs font-bold uppercase tracking-wider">Street Address / Practice Location</label>
              <input v-model="form.street" type="text"
                class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none text-sm font-medium transition-all"
                placeholder="House No., Street Name, Clinic/Hospital Rm" />
            </div>

            <div class="mt-4 flex items-center justify-between pt-2 border-t border-border">
              <div v-if="isSuccess" class="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                <Icon name="heroicons:check-circle" size="20" />
                <span>Doctor profile updated successfully!</span>
              </div>
              <div v-else></div>

              <AppButton type="submit" :loading="isLoading" class="min-w-[140px]">
                Save Profile
              </AppButton>
            </div>
          </form>
        </div>

        <!-- 2. CLINIC BRANCHES TAB -->
        <div v-else-if="activeTab === 'clinics'" class="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in duration-300">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-bold text-foreground">My Clinic Branches</h2>
              <p class="text-muted-foreground text-xs mt-1">Register and manage physical clinics and hospitals where you practice.</p>
            </div>
            <button
              type="button"
              @click="showAddClinicModal = true"
              class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
            >
              <Icon name="heroicons:plus" class="w-4 h-4" />
              <span>Add Clinic Branch</span>
            </button>
          </div>

          <div class="h-px bg-border"></div>

          <!-- Clinics List -->
          <div v-if="!clinics.length" class="border border-dashed border-border rounded-2xl p-10 text-center bg-foreground/[0.02]">
            <Icon name="heroicons:building-office-2" class="text-foreground/30 text-5xl mb-3 mx-auto" />
            <h4 class="text-sm font-bold text-foreground">No clinic branches registered yet</h4>
            <p class="text-muted-foreground text-xs mt-1 max-w-sm mx-auto">Click "Add Clinic Branch" above to register your first clinic or hospital location.</p>
          </div>

          <div v-else class="grid gap-4 sm:grid-cols-2">
            <div
              v-for="clinic in clinics"
              :key="clinic.uuid || clinic.id"
              class="p-5 rounded-2xl border border-border bg-foreground/[0.02] hover:border-primary/40 transition flex flex-col justify-between gap-4 shadow-2xs group"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon name="heroicons:building-office-2" class="w-5 h-5" />
                  </div>
                  <div>
                    <h4 class="text-sm font-bold text-foreground line-clamp-1">{{ clinic.name }}</h4>
                    <p v-if="clinic.address" class="text-xs text-muted-foreground line-clamp-1 mt-0.5">{{ clinic.address }}</p>
                  </div>
                </div>
                <button
                  type="button"
                  @click="handleDeleteClinic(clinic.uuid)"
                  class="text-muted-foreground hover:text-red-500 p-1.5 rounded-xl hover:bg-red-500/10 transition cursor-pointer shrink-0"
                  title="Remove Clinic"
                >
                  <Icon name="heroicons:trash" class="w-4 h-4" />
                </button>
              </div>

              <div class="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/60">
                <span class="inline-flex items-center gap-1.5">
                  <Icon name="heroicons:phone" class="w-3.5 h-3.5 text-primary" />
                  {{ clinic.phone || 'No phone set' }}
                </span>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              </div>
            </div>
          </div>

          <!-- DOCTOR SEATS & ASSOCIATE DOCTORS SECTION -->
          <div id="seats" class="pt-6 border-t border-border space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-lg font-bold text-foreground">Doctor Seats & Clinic Associates</h3>
                  <span
                    v-if="seatUsage?.max_doctors && seatUsage.max_doctors > 1"
                    class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20"
                  >
                    Multi-Doctor Plan
                  </span>
                </div>
                <p class="text-muted-foreground text-xs mt-1">
                  Assign licensed dermatologists to your clinic seats to share AI scans, consultations, and practice features.
                </p>
              </div>

              <button
                type="button"
                @click="openAssignDoctorModal"
                :disabled="!clinics.length || (seatUsage && !seatUsage.can_add)"
                class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
              >
                <Icon name="lucide:user-plus" class="w-4 h-4" />
                <span>Assign Associate Doctor</span>
              </button>
            </div>

            <!-- Seat Quota Banner -->
            <div class="p-5 rounded-2xl border border-border bg-foreground/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="space-y-1.5 flex-1">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-foreground flex items-center gap-2">
                    <Icon name="lucide:users" class="w-4 h-4 text-primary" />
                    Doctor Seat Pool Allocation
                  </span>
                  <span class="font-bold text-primary">
                    {{ seatUsage?.used_seats ?? 1 }} / {{ seatUsage?.max_doctors ?? (mySubscription?.plan?.max_doctors || '1') }} Seats Used
                  </span>
                </div>
                <!-- Progress Bar -->
                <div class="w-full h-2.5 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    class="h-full bg-primary rounded-full transition-all duration-500"
                    :style="{
                      width: seatUsage?.max_doctors
                        ? `${Math.min(100, Math.round(((seatUsage.used_seats || 1) / seatUsage.max_doctors) * 100))}%`
                        : '10%'
                    }"
                  ></div>
                </div>
                <div class="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>1 Owner (You) + {{ (seatUsage?.used_seats || 1) - 1 }} Associate{{ (seatUsage?.used_seats || 1) - 1 === 1 ? '' : 's' }}</span>
                  <span v-if="seatUsage?.available_seats !== null" class="font-semibold text-emerald-600">
                    {{ seatUsage?.available_seats }} seat{{ seatUsage?.available_seats === 1 ? '' : 's' }} available
                  </span>
                  <span v-else class="font-semibold text-emerald-600">Unlimited seats available</span>
                </div>
              </div>
            </div>

            <!-- Warning if single doctor plan -->
            <div
              v-if="seatUsage && seatUsage.max_doctors === 1"
              class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between gap-3"
            >
              <div class="flex items-center gap-2.5">
                <Icon name="lucide:info" class="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Your current plan only supports 1 doctor seat. Upgrade to the <strong>Clinic Group Plan</strong> to add up to 10 doctors.</span>
              </div>
              <NuxtLink
                to="/doctor/subscription"
                class="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition shrink-0"
              >
                Upgrade Plan
              </NuxtLink>
            </div>

            <!-- Warning if no clinics registered yet -->
            <div
              v-else-if="!clinics.length"
              class="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs flex items-center gap-2.5"
            >
              <Icon name="lucide:info" class="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>Please add at least one clinic branch above before assigning associate doctors to clinic seats.</span>
            </div>

            <!-- Associate Doctors List -->
            <div v-if="!clinicDoctors.length" class="border border-dashed border-border rounded-2xl p-8 text-center bg-foreground/[0.01]">
              <Icon name="lucide:users" class="text-foreground/30 text-4xl mb-2 mx-auto" />
              <h4 class="text-sm font-bold text-foreground">No associate doctors added yet</h4>
              <p class="text-muted-foreground text-xs mt-1 max-w-md mx-auto">
                Invite associate dermatologists or resident doctors to join your clinic branch. They will automatically inherit your subscription features.
              </p>
            </div>

            <div v-else class="grid gap-4 sm:grid-cols-2">
              <div
                v-for="assoc in clinicDoctors"
                :key="assoc.pivot_id"
                class="p-5 rounded-2xl border border-border bg-foreground/[0.02] hover:border-primary/40 transition flex flex-col justify-between gap-4 shadow-2xs"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                      {{ (assoc.doctor.first_name?.[0] || 'D') + (assoc.doctor.last_name?.[0] || 'R') }}
                    </div>
                    <div class="min-w-0">
                      <h4 class="text-sm font-bold text-foreground truncate">
                        Dr. {{ assoc.doctor.full_name }}
                      </h4>
                      <p class="text-xs text-muted-foreground truncate">{{ assoc.doctor.email }}</p>
                      <p v-if="assoc.doctor.prc_number" class="text-[11px] font-mono text-foreground/60 mt-0.5">
                        PRC: {{ assoc.doctor.prc_number }}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    @click="handleRemoveDoctorSeat(assoc.pivot_id, assoc.doctor.full_name)"
                    class="text-muted-foreground hover:text-red-500 p-1.5 rounded-xl hover:bg-red-500/10 transition cursor-pointer shrink-0"
                    title="Revoke Doctor Seat"
                  >
                    <Icon name="lucide:trash-2" class="w-4 h-4" />
                  </button>
                </div>

                <div class="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/60">
                  <span class="inline-flex items-center gap-1.5 font-medium text-foreground truncate max-w-[60%]">
                    <Icon name="lucide:building-2" class="w-3.5 h-3.5 text-primary shrink-0" />
                    {{ assoc.clinic.name }}
                  </span>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-foreground/10 text-foreground capitalize">
                      {{ assoc.role }}
                    </span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. DUTY & AWAY PRESETS TAB -->
        <div v-else-if="activeTab === 'schedule'" id="blocked-dates" class="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in duration-300">
          <div>
            <h2 class="text-xl font-bold text-foreground">Duty Schedule & Away Presets</h2>
            <p class="text-muted-foreground text-xs mt-1">Preset the clinic locations where you are on duty on specific dates, or set blocked/away periods.</p>
          </div>

          <div class="h-px bg-border"></div>

          <!-- Add Schedule / Availability Form -->
          <form @submit.prevent="addAvailability" class="flex flex-col gap-5">
            <!-- Schedule Type Tabs -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="scheduleType = 'duty'"
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border"
                :class="scheduleType === 'duty' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs' 
                  : 'bg-foreground/5 border-transparent text-foreground/60 hover:text-foreground'"
              >
                <Icon name="heroicons:building-office-2" class="w-4 h-4 text-emerald-600" />
                <span>🏥 Clinic Duty Hours</span>
              </button>

              <button
                type="button"
                @click="scheduleType = 'away'"
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border"
                :class="scheduleType === 'away' 
                  ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs' 
                  : 'bg-foreground/5 border-transparent text-foreground/60 hover:text-foreground'"
              >
                <Icon name="heroicons:no-symbol" class="w-4 h-4 text-rose-600" />
                <span>🚫 Blocked / Away Period</span>
              </button>
            </div>

            <!-- Clinic Selector (Shown for Duty hours) -->
            <div v-if="scheduleType === 'duty'" class="space-y-1.5">
              <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Select Clinic Location *</label>
              <div class="grid sm:grid-cols-2 gap-3">
                <select
                  v-if="clinics.length > 0"
                  v-model="selectedClinicId"
                  class="w-full rounded-2xl border border-border bg-foreground/5 px-4 py-3 text-sm font-semibold outline-none focus:border-primary cursor-pointer"
                >
                  <option :value="null" disabled>-- Choose a registered clinic branch --</option>
                  <option v-for="c in clinics" :key="c.id" :value="c.id">
                    {{ c.name }} {{ c.address ? `(${c.address})` : '' }}
                  </option>
                </select>

                <input
                  v-if="clinics.length === 0 || !selectedClinicId"
                  v-model="customLocation"
                  type="text"
                  placeholder="Or type clinic name / room..."
                  class="w-full rounded-2xl border border-border bg-foreground/5 px-4 py-3 text-sm outline-none focus:border-primary font-medium"
                />
              </div>
            </div>

            <!-- Date and Times Row -->
            <div class="grid sm:grid-cols-3 gap-4">
              <div class="space-y-1.5">
                <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Date *</label>
                <input
                  v-model="availForm.available_date"
                  type="date"
                  required
                  class="w-full rounded-2xl border border-border bg-foreground/5 px-4 py-3 text-sm outline-none focus:border-primary font-medium"
                />
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Start Time</label>
                <input
                  v-model="availForm.start_time"
                  type="time"
                  :disabled="scheduleType === 'away' && blockWholeDay"
                  class="w-full rounded-2xl border border-border bg-foreground/5 px-4 py-3 text-sm outline-none focus:border-primary font-medium disabled:opacity-50"
                />
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-bold uppercase tracking-wider text-gray-500">End Time</label>
                <input
                  v-model="availForm.end_time"
                  type="time"
                  :disabled="scheduleType === 'away' && blockWholeDay"
                  class="w-full rounded-2xl border border-border bg-foreground/5 px-4 py-3 text-sm outline-none focus:border-primary font-medium disabled:opacity-50"
                />
              </div>
            </div>

            <!-- Block whole day checkbox (Away only) -->
            <div v-if="scheduleType === 'away'" class="flex items-center gap-2">
              <input
                id="block-whole-day"
                v-model="blockWholeDay"
                type="checkbox"
                class="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
              />
              <label for="block-whole-day" class="text-xs font-bold text-foreground/80 cursor-pointer select-none">
                Block out the entire day (Unavailable all day)
              </label>
            </div>

            <!-- Status / Alert Messages -->
            <div v-if="availSuccessMsg" class="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-4 h-4" />
              <span>{{ availSuccessMsg }}</span>
            </div>

            <div v-if="availErrorMsg" class="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-600 flex items-center gap-2">
              <Icon name="heroicons:exclamation-circle" class="w-4 h-4" />
              <span>{{ availErrorMsg }}</span>
            </div>

            <div class="flex items-center justify-between pt-2">
              <div></div>
              <AppButton type="submit" :loading="isAddLoading" class="min-w-[150px]">
                {{ scheduleType === 'duty' ? 'Add Duty Schedule' : 'Block Out Date' }}
              </AppButton>
            </div>
          </form>

          <!-- Divider -->
          <div class="h-px bg-border"></div>

          <!-- Existing Slots & Timetable Preview -->
          <div>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 class="text-md font-bold text-foreground">Your Preset Schedules & Timetable</h3>
              
              <div class="flex items-center gap-1 bg-foreground/5 p-1 rounded-xl border border-border">
                <button
                  type="button"
                  @click="scheduleViewMode = 'cards'"
                  class="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer"
                  :class="scheduleViewMode === 'cards' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'"
                >
                  <Icon name="lucide:layout-list" class="w-3.5 h-3.5" />
                  List Cards
                </button>
                <button
                  type="button"
                  @click="scheduleViewMode = 'timetable'"
                  class="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer"
                  :class="scheduleViewMode === 'timetable' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'"
                >
                  <Icon name="lucide:calendar-range" class="w-3.5 h-3.5" />
                  Weekly Timetable
                </button>
              </div>
            </div>

            <!-- Timetable Mode -->
            <div v-if="scheduleViewMode === 'timetable'" class="rounded-2xl overflow-hidden border border-border">
              <AppWeeklyTimetable />
            </div>

            <!-- Cards Mode -->
            <template v-else>
              <div v-if="isAvailLoading" class="flex flex-col gap-3">
                <div v-for="i in 2" :key="i" class="h-16 w-full rounded-2xl bg-foreground/5 animate-pulse"></div>
              </div>

              <div v-else-if="!availabilities.length" 
                class="border border-dashed border-border rounded-2xl p-8 text-center bg-foreground/[0.02]">
                <Icon name="heroicons:calendar-days" class="text-foreground/30 text-4xl mb-2 mx-auto" />
                <p class="text-muted-foreground text-sm">No schedule presets set. You are currently marked as available every day for new patient referrals.</p>
              </div>

              <div v-else class="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                <div v-for="slot in availabilities" :key="slot.uuid"
                  class="flex items-center justify-between p-4 rounded-2xl border border-border bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-all">
                  <div class="flex items-center gap-4">
                    <div 
                      class="p-2.5 rounded-xl shrink-0"
                      :class="slot.is_available ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'"
                    >
                      <Icon :name="slot.is_available ? 'heroicons:building-office-2' : 'heroicons:calendar'" size="20" />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-bold text-foreground">
                          {{ new Date(slot.available_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
                        </p>
                        <span 
                          class="text-[11px] font-bold px-2 py-0.5 rounded-full border"
                          :class="slot.is_available ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'"
                        >
                          {{ slot.is_available ? (slot.clinic?.name || slot.location_name || 'Clinic Duty') : 'Blocked / Away' }}
                        </span>
                      </div>
                      <p class="text-xs text-foreground/60 mt-0.5">
                        {{ formatTime(slot.start_time) }} - {{ formatTime(slot.end_time) }}
                        <span v-if="slot.clinic?.address" class="text-foreground/40 ml-1">• {{ slot.clinic.address }}</span>
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-3">
                    <button @click="deleteAvailability(slot.uuid)"
                      class="text-foreground/40 hover:text-red-500 p-2 rounded-xl hover:bg-red-500/5 transition-all cursor-pointer"
                      title="Remove Period">
                      <Icon name="heroicons:trash" size="18" />
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- 4. SUBSCRIPTION & LIMITS TAB -->
        <div v-else-if="activeTab === 'subscription'" class="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in duration-300">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-bold text-foreground">Subscription & Practice Plan</h2>
              <p class="text-muted-foreground text-xs mt-1">Review your active subscription plan, seat quotas, and capacity limits.</p>
            </div>

            <AppButton
              to="/Doctor/subscription"
              variant="solid"
              size="sm"
            >
              <span>Manage Plans</span>
              <Icon name="heroicons:arrow-right" size="14" class="ml-1.5" />
            </AppButton>
          </div>

          <div class="h-px bg-border"></div>

          <!-- Loading State -->
          <div v-if="isSubLoading" class="space-y-4">
            <div class="h-32 rounded-2xl bg-foreground/5 animate-pulse"></div>
            <div class="h-44 rounded-2xl bg-foreground/5 animate-pulse"></div>
          </div>

          <div v-else class="space-y-6">
            <!-- Current Plan Card -->
            <div 
              class="p-6 rounded-3xl border transition-all"
              :class="mySubscription?.status === 'active' 
                ? 'bg-emerald-50/40 border-emerald-200/80 shadow-2xs' 
                : 'bg-foreground/[0.02] border-border'"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3.5">
                  <div 
                    class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                    :class="mySubscription?.status === 'active' ? 'bg-emerald-600 text-white' : 'bg-foreground/10 text-foreground/70'"
                  >
                    <Icon :name="mySubscription?.status === 'active' ? 'heroicons:shield-check' : 'heroicons:credit-card'" class="w-6 h-6" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="text-base sm:text-lg font-bold text-foreground">
                        {{ mySubscription?.plan?.name || 'No Active Subscription' }}
                      </h3>
                      <span 
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                        :class="mySubscription?.status === 'active' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                          : 'bg-gray-100 text-gray-700 border-gray-300'"
                      >
                        {{ mySubscription?.status || 'Inactive' }}
                      </span>
                    </div>
                    <p class="text-xs text-muted-foreground mt-0.5">
                      <template v-if="mySubscription?.status === 'active'">
                        Billed {{ mySubscription.billing_cycle }} • Valid through {{ new Date(mySubscription.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
                      </template>
                      <template v-else>
                        Subscribe to an official doctor plan to unlock scanning & practice features.
                      </template>
                    </p>
                  </div>
                </div>

                <div v-if="mySubscription?.status === 'active'" class="text-right shrink-0">
                  <span class="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Rate</span>
                  <span class="text-lg font-extrabold text-foreground">
                    ₱{{ (mySubscription.billing_cycle === 'annual' ? mySubscription.plan?.price_annual : mySubscription.plan?.price_monthly)?.toLocaleString() }}
                  </span>
                  <span class="text-xs text-muted-foreground font-medium"> / {{ mySubscription.billing_cycle === 'annual' ? 'yr' : 'mo' }}</span>
                </div>
              </div>

              <!-- Plan Quotas & Capabilities Grid -->
              <div class="mt-6 pt-5 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="p-3 rounded-2xl bg-card border border-border/80 text-center">
                  <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Clinic Branches</span>
                  <span class="text-sm font-bold text-foreground mt-0.5 block">
                    {{ mySubscription?.plan?.max_clinics ?? 1 }} Branch{{ (mySubscription?.plan?.max_clinics ?? 1) > 1 ? 'es' : '' }}
                  </span>
                </div>

                <div class="p-3 rounded-2xl bg-card border border-border/80 text-center">
                  <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Doctor Seats</span>
                  <span class="text-sm font-bold text-foreground mt-0.5 block">
                    {{ mySubscription?.plan?.max_doctors ?? 1 }} Seat{{ (mySubscription?.plan?.max_doctors ?? 1) > 1 ? 's' : '' }}
                  </span>
                </div>

                <div class="p-3 rounded-2xl bg-card border border-border/80 text-center">
                  <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Secretaries</span>
                  <span class="text-sm font-bold text-foreground mt-0.5 block">
                    {{ mySubscription?.plan?.max_secretaries ? `${mySubscription.plan.max_secretaries} Seats` : 'None' }}
                  </span>
                </div>

                <div class="p-3 rounded-2xl bg-card border border-border/80 text-center">
                  <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">AI Diagnostics</span>
                  <span class="text-sm font-bold text-emerald-600 mt-0.5 block">
                    Included
                  </span>
                </div>
              </div>
            </div>

            <!-- Upgrade Recommendation Card -->
            <div class="p-6 sm:p-7 rounded-3xl bg-linear-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white shadow-xl relative overflow-hidden">
              <div class="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
              
              <div class="relative z-10 space-y-4">
                <div class="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                  <Icon name="heroicons:sparkles" class="w-4 h-4 text-amber-400" />
                  <span>Expand Your Clinical Practice</span>
                </div>

                <div>
                  <h3 class="text-xl sm:text-2xl font-black text-white leading-tight">
                    Upgrade to Team & Multi-Clinic Plans
                  </h3>
                  <p class="text-indigo-200/80 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
                    Scale your clinical operations by delegating appointment queues to secretaries and inviting associate dermatologists to collaborate under your clinic license.
                  </p>
                </div>

                <!-- Feature Highlights -->
                <div class="grid sm:grid-cols-3 gap-3 pt-2">
                  <div class="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10 flex items-start gap-2.5">
                    <Icon name="heroicons:user-group" class="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />
                    <div>
                      <h5 class="text-xs font-bold text-white">Multi-Doctor Pool</h5>
                      <p class="text-[11px] text-indigo-200/70 mt-0.5">Share plan quota with colleague doctors.</p>
                    </div>
                  </div>

                  <div class="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10 flex items-start gap-2.5">
                    <Icon name="heroicons:user-plus" class="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <div>
                      <h5 class="text-xs font-bold text-white">Clinic Secretary</h5>
                      <p class="text-[11px] text-indigo-200/70 mt-0.5">Delegate intake & queue management.</p>
                    </div>
                  </div>

                  <div class="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10 flex items-start gap-2.5">
                    <Icon name="heroicons:building-office-2" class="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                    <div>
                      <h5 class="text-xs font-bold text-white">Multi-Branch</h5>
                      <p class="text-[11px] text-indigo-200/70 mt-0.5">Practice across multiple hospitals.</p>
                    </div>
                  </div>
                </div>

                <!-- Action Button -->
                <div class="pt-3 flex items-center justify-between">
                  <span class="text-xs text-indigo-300/80">Automated activation via PayMongo & GCash/Cards.</span>
                  
                  <AppButton
                    to="/Doctor/subscription"
                    variant="solid"
                    class="bg-white text-indigo-950 hover:bg-indigo-50 font-extrabold px-5 py-2.5 rounded-2xl shadow-lg cursor-pointer"
                  >
                    <span>View Upgrade Plans</span>
                    <Icon name="heroicons:arrow-right" class="w-4 h-4 ml-1.5" />
                  </AppButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. ACCOUNT & SECURITY TAB -->
        <div v-else-if="activeTab === 'security'" class="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in duration-300">
          <div>
            <h2 class="text-xl font-bold text-foreground">Account & Security</h2>
            <p class="text-muted-foreground text-xs mt-1">Manage your credentials, professional verification, and active session.</p>
          </div>

          <div class="h-px bg-border"></div>

          <div class="space-y-4">
            <!-- Verification Card -->
            <div class="p-5 rounded-2xl border border-border bg-foreground/[0.02] flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name="heroicons:shield-check" class="w-5 h-5" />
                </div>
                <div>
                  <h4 class="text-sm font-bold text-foreground">Medical Board Verification</h4>
                  <p class="text-xs text-muted-foreground mt-0.5">PRC: <span class="font-mono font-bold">{{ user?.prcNumber || user?.doctor_verification?.prcNumber || 'Not submitted' }}</span></p>
                </div>
              </div>
              <AppProfileStatusBadge
                :is-complete="user?.doctor_verification?.status === 'verified'"
                :is-declined="user?.doctor_verification?.status === 'declined'"
                :is-pending="user?.doctor_verification?.status === 'pending'" />
            </div>

            <!-- Sign Out Row -->
            <div class="p-5 rounded-2xl border border-red-200/60 bg-red-50/40 flex items-center justify-between gap-4">
              <div>
                <h4 class="text-sm font-bold text-red-900">Sign Out</h4>
                <p class="text-xs text-red-600/80 mt-0.5">Terminate your current session on this device.</p>
              </div>

              <button
                type="button"
                @click="isLogoutModalOpen = true"
                class="px-4 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-100 hover:bg-red-200 transition cursor-pointer"
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
      <div v-if="showAddClinicModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <div class="bg-card border border-border rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon name="heroicons:building-office-2" class="w-5 h-5" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-foreground">Add Clinic Branch</h3>
                <p class="text-xs text-muted-foreground">Register a new clinic location where you practice.</p>
              </div>
            </div>
            <button @click="showAddClinicModal = false" class="text-muted-foreground hover:text-foreground p-1 rounded-xl cursor-pointer">
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>

          <form @submit.prevent="handleCreateClinic" class="space-y-4">
            <div v-if="clinicError" class="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
              {{ clinicError }}
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-foreground">Clinic / Hospital Name *</label>
              <input
                v-model="clinicForm.name"
                type="text"
                required
                placeholder="e.g. St. Luke's Medical Center - Rm 402"
                class="w-full rounded-xl border border-border bg-foreground/5 px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-foreground">Address / Floor & Room</label>
              <input
                v-model="clinicForm.address"
                type="text"
                placeholder="e.g. 32nd St, Bonifacio Global City, Taguig"
                class="w-full rounded-xl border border-border bg-foreground/5 px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>

            <div class="grid sm:grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label class="text-xs font-bold text-foreground">Contact Phone</label>
                <input
                  v-model="clinicForm.phone"
                  type="text"
                  placeholder="e.g. +63 917 123 4567"
                  class="w-full rounded-xl border border-border bg-foreground/5 px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-bold text-foreground">Clinic Email</label>
                <input
                  v-model="clinicForm.email"
                  type="email"
                  placeholder="e.g. clinic@derma.com"
                  class="w-full rounded-xl border border-border bg-foreground/5 px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>

            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                @click="showAddClinicModal = false"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-foreground/70 hover:bg-foreground/5 cursor-pointer"
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
      <div v-if="showAssignDoctorModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <div class="bg-card border border-border rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon name="lucide:user-plus" class="w-5 h-5" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-foreground">Assign Associate Doctor</h3>
                <p class="text-xs text-muted-foreground">Add a doctor to your clinic subscription seat pool.</p>
              </div>
            </div>
            <button @click="showAssignDoctorModal = false" class="text-muted-foreground hover:text-foreground p-1 rounded-xl cursor-pointer">
              <Icon name="lucide:x" class="w-5 h-5" />
            </button>
          </div>

          <form @submit.prevent="handleAssignDoctor" class="space-y-4">
            <div v-if="assignDoctorError" class="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400">
              {{ assignDoctorError }}
            </div>

            <!-- Clinic Branch Selection -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-foreground">Select Clinic Branch *</label>
              <select
                v-model="assignDoctorForm.clinic_id"
                required
                class="w-full rounded-xl border border-border bg-foreground/5 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-primary cursor-pointer text-foreground"
              >
                <option :value="null" disabled>-- Choose clinic branch --</option>
                <option v-for="c in clinics" :key="c.id" :value="c.id">
                  {{ c.name }} {{ c.address ? `(${c.address})` : '' }}
                </option>
              </select>
            </div>

            <!-- Doctor Search / Selection -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-foreground">Find Doctor (by Name, Email, or PRC Number) *</label>
              
              <!-- If doctor selected -->
              <div v-if="selectedCandidate" class="p-3 rounded-xl border border-primary/40 bg-primary/5 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                    {{ (selectedCandidate.full_name?.[0] || 'D') }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-foreground truncate">Dr. {{ selectedCandidate.full_name }}</p>
                    <p class="text-[11px] text-muted-foreground truncate">{{ selectedCandidate.email }} {{ selectedCandidate.prc_number ? `• PRC: ${selectedCandidate.prc_number}` : '' }}</p>
                  </div>
                </div>
                <button
                  type="button"
                  @click="clearCandidateDoctor"
                  class="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-foreground/10 cursor-pointer"
                  title="Change doctor"
                >
                  <Icon name="lucide:x" class="w-4 h-4" />
                </button>
              </div>

              <!-- Search input if not selected -->
              <div v-else class="relative">
                <div class="relative">
                  <input
                    :value="doctorSearchQuery"
                    @input="handleDoctorSearch(($event.target as HTMLInputElement).value)"
                    type="text"
                    placeholder="Type name, email, or PRC license..."
                    class="w-full rounded-xl border border-border bg-foreground/5 pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary text-foreground"
                  />
                  <Icon name="lucide:search" class="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Icon v-if="isSearchingDoctors" name="lucide:loader-2" class="w-4 h-4 absolute right-3 top-3 animate-spin text-primary" />
                </div>

                <!-- Autocomplete Dropdown -->
                <div
                  v-if="doctorSearchResults.length > 0"
                  class="absolute left-0 right-0 top-full mt-1.5 z-20 bg-card border border-border rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-border/60"
                >
                  <button
                    v-for="cand in doctorSearchResults"
                    :key="cand.id"
                    type="button"
                    @click="selectCandidateDoctor(cand)"
                    class="w-full p-3 text-left hover:bg-foreground/5 transition flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div class="min-w-0">
                      <p class="text-xs font-bold text-foreground truncate">Dr. {{ cand.full_name }}</p>
                      <p class="text-[11px] text-muted-foreground truncate">{{ cand.email }}</p>
                    </div>
                    <span v-if="cand.prc_number" class="text-[10px] font-mono px-2 py-0.5 rounded bg-foreground/5 text-foreground/70 shrink-0">
                      {{ cand.prc_number }}
                    </span>
                  </button>
                </div>

                <div v-else-if="doctorSearchQuery.length >= 2 && !isSearchingDoctors && doctorSearchResults.length === 0" class="mt-1 text-[11px] text-muted-foreground">
                  No registered doctor found. You can enter their full email address to assign them directly.
                </div>
              </div>
            </div>

            <!-- Role Selector -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-foreground">Clinic Seat Role</label>
              <select
                v-model="assignDoctorForm.role"
                class="w-full rounded-xl border border-border bg-foreground/5 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-primary cursor-pointer text-foreground"
              >
                <option value="associate">Associate Dermatologist</option>
                <option value="resident">Resident Physician</option>
                <option value="consultant">Consultant Specialist</option>
              </select>
            </div>

            <div class="p-3 rounded-xl bg-primary/5 border border-primary/10 text-[11px] text-foreground/80 flex items-start gap-2">
              <Icon name="lucide:sparkles" class="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>Assigned doctors will immediately inherit full AI scanning, teleconsultation, and clinical report generation privileges under your active subscription plan.</span>
            </div>

            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                @click="showAssignDoctorModal = false"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-foreground/70 hover:bg-foreground/5 cursor-pointer"
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
