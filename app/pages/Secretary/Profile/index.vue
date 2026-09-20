<script setup lang="ts">
  import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'
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

  onMounted(async () => {
    await fetchRegions()
    await fetchAvailabilities()
  })

  const doctorUuid = useCookie('user_uuid').value
  const availabilities = ref<any[]>([])
  const isAvailLoading = ref(false)
  const isAddLoading = ref(false)
  const availForm = reactive({
    available_date: '',
    start_time: '09:00',
    end_time: '17:00',
    is_available: false
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

  const fetchAvailabilities = async () => {
    if (!doctorUuid) return
    isAvailLoading.value = true
    try {
      const res = await doctorAvailabilityService.listForDoctor(doctorUuid)
      availabilities.value = res ?? []
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
      availForm.is_available = false
      blockWholeDay.value = false
      await fetchAvailabilities()
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to overwrite schedule.')
    } finally {
      isOverwriting.value = false
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

    const startTime = (blockWholeDay.value ? '00:00' : availForm.start_time || '00:00').slice(0, 5)
    const endTime = (blockWholeDay.value ? '23:59' : availForm.end_time || '23:59').slice(0, 5)

    if (!blockWholeDay.value && startTime >= endTime) {
      availErrorMsg.value = 'Start time must be before end time.'
      return
    }

    isAddLoading.value = true
    availErrorMsg.value = ''
    availSuccessMsg.value = ''
    try {
      const payload = {
        available_date: availForm.available_date,
        start_time: startTime,
        end_time: endTime,
        is_available: 0 // Explicitly 0 to mark as Blocked / Away!
      }

      await doctorAvailabilityService.createForDoctor(doctorUuid, payload)
      availSuccessMsg.value = 'Blocked/Away period added successfully!'
      availForm.available_date = ''
      availForm.start_time = '09:00'
      availForm.end_time = '17:00'
      availForm.is_available = false
      blockWholeDay.value = false
      await fetchAvailabilities()
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
          is_available: 0
        }
        showConflictModal.value = true
        return
      }
      availErrorMsg.value = e.data?.message || e.message || 'Failed to add availability.'
    } finally {
      isAddLoading.value = false
    }
  }

  const deleteAvailability = async (uuid: string) => {
    try {
      await doctorAvailabilityService.delete(uuid)
      await fetchAvailabilities()
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
        navigateTo('/secretary')
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
  <div class="max-w-5xl">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Secretary Profile</h1>
        <p class="text-foreground/60 mt-2">Manage your professional and personal information.</p>
      </div>
      <div
        v-if="user?.doctor_verification?.status === 'verified'"
        class="bg-primary/10 text-primary border-primary/20 flex items-center gap-2 rounded-2xl border px-4 py-2"
      >
        <Icon
          name="heroicons:shield-check-20-solid"
          size="20"
        />
        <span class="text-sm font-bold tracking-wider uppercase">Verified Professional</span>
      </div>
    </div>

    <!-- Profile Completion Alert -->
    <AppAlert
      v-if="missingDoctorFields.length > 0"
      title="Profile Setup Required"
      type="error"
    >
      Your profile is incomplete. Please fill out the following fields to complete registration:
      <span class="font-bold underline">{{ missingDoctorFields.join(', ') }}</span
      >.
    </AppAlert>

    <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <!-- Left: Profile Preview -->
      <div class="lg:col-span-1">
        <div
          class="bg-sidebar/40 border-sidebar-border rounded-3xl border p-6 text-center shadow-sm backdrop-blur-sm"
        >
          <div
            class="from-primary/20 to-primary/5 border-primary/20 relative mx-auto mb-4 h-32 w-32 overflow-hidden rounded-full border-2 bg-linear-to-br p-1"
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
              class="bg-sidebar/60 text-primary flex h-full w-full items-center justify-center rounded-full text-4xl font-bold"
            >
              Dr. {{ form.last_name?.charAt(0) }}
            </div>
            <button
              class="bg-primary hover:bg-primary-hover absolute right-0 bottom-0 z-10 rounded-full p-2 text-white shadow-lg transition-colors"
            >
              <Icon
                name="heroicons:camera-20-solid"
                size="16"
              />
            </button>
          </div>
          <h2 class="text-xl font-bold">Dr. {{ form.first_name }} {{ form.last_name }}</h2>
          <p class="text-foreground/60 text-sm italic">{{ form.email }}</p>

          <div class="mt-6 flex flex-col gap-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-foreground/50">Profile Setup</span>
              <AppProfileStatusBadge
                :is-complete="user?.doctor_verification?.status === 'verified'"
                :is-declined="user?.doctor_verification?.status === 'declined'"
                :is-pending="user?.doctor_verification?.status === 'pending'"
              />
            </div>
            <div
              v-if="user?.prcNumber || user?.doctor_verification"
              class="bg-foreground/5 rounded-xl p-3 text-left"
            >
              <span class="text-foreground/40 mb-1 block text-[10px] font-bold uppercase"
                >PRC License No.</span
              >
              <span class="font-mono text-sm">{{
                user?.prcNumber || user?.doctor_verification?.prcNumber
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Form -->
      <div class="lg:col-span-2">
        <div class="bg-sidebar border-sidebar-border rounded-3xl border p-8 shadow-sm">
          <form
            @submit.prevent="submitProfile"
            class="flex flex-col gap-6"
          >
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">First Name</label>
                <input
                  v-model="form.first_name"
                  type="text"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 transition-all outline-none"
                  placeholder="Enter first name"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">Last Name</label>
                <input
                  v-model="form.last_name"
                  type="text"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 transition-all outline-none"
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="text-foreground flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">Email Address</label>
                <input
                  v-model="form.email"
                  type="email"
                  disabled
                  class="bg-foreground/5 border-sidebar-border w-full cursor-not-allowed rounded-2xl border px-4 py-3 opacity-60 transition-all outline-none"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">Affiliation</label>
                <input
                  v-model="form.affiliation"
                  type="text"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 transition-all outline-none"
                  placeholder="Enter affiliation"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">PRC Number</label>
                <input
                  v-model="form.prcNumber"
                  type="text"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 transition-all outline-none"
                  placeholder="Enter PRC license number"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">Age</label>
                <input
                  v-model="form.age"
                  type="number"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 transition-all outline-none"
                  placeholder="Your age"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">Gender</label>
                <select
                  v-model="form.gender"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full appearance-none rounded-2xl border px-4 py-3 transition-all outline-none"
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
                <label class="text-foreground/70 ml-1 text-sm font-medium">Region</label>
                <select
                  v-model="codes.region"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full appearance-none rounded-2xl border px-4 py-3 transition-all outline-none"
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
                <label class="text-foreground/70 ml-1 text-sm font-medium">Province</label>
                <select
                  v-model="codes.province"
                  :disabled="!provinces.length"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full appearance-none rounded-2xl border px-4 py-3 transition-all outline-none disabled:opacity-50"
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
                <label class="text-foreground/70 ml-1 text-sm font-medium"
                  >City / Municipality</label
                >
                <select
                  v-model="codes.city"
                  :disabled="!cities.length"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full appearance-none rounded-2xl border px-4 py-3 transition-all outline-none disabled:opacity-50"
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
                <label class="text-foreground/70 ml-1 text-sm font-medium">Barangay</label>
                <select
                  v-model="codes.barangay"
                  :disabled="!barangays.length"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full appearance-none rounded-2xl border px-4 py-3 transition-all outline-none disabled:opacity-50"
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
              <label class="text-foreground/70 ml-1 text-sm font-medium"
                >Street Address / Clinic Name</label
              >
              <input
                v-model="form.street"
                type="text"
                class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 transition-all outline-none"
                placeholder="House No., Street Name, Clinic/Hospital"
              />
            </div>

            <div class="mt-4 flex items-center justify-between">
              <div
                v-if="isSuccess"
                class="flex items-center gap-2 text-green-500"
              >
                <Icon
                  name="heroicons:check-circle"
                  size="20"
                />
                <span class="text-sm font-medium">Doctor profile updated!</span>
              </div>
              <div v-if="!isSuccess"></div>

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

        <!-- Availability Section -->
        <div
          class="bg-sidebar border-sidebar-border animate-in fade-in mt-8 rounded-xl border p-8 shadow-sm duration-500"
        >
          <div>
            <h2 class="text-xl font-bold">Clinic Hours & Away Settings</h2>
            <p class="text-foreground/60 mt-1 text-sm">
              By default, you are available every day. Set specific dates and times you will be
              away/unavailable below.
            </p>
          </div>

          <!-- Divider -->
          <div class="bg-sidebar-border my-6 h-px"></div>

          <!-- Add Availability Form -->
          <form
            @submit.prevent="addAvailability"
            class="flex flex-col gap-4"
          >
            <h3 class="text-md text-foreground/80 font-semibold">Add Blocked / Away Period</h3>

            <!-- Block whole day toggle -->
            <label class="group flex w-fit cursor-pointer items-center gap-3">
              <div
                @click="blockWholeDay = !blockWholeDay"
                class="relative h-5 w-9 rounded-full transition-colors duration-200"
                :class="blockWholeDay ? 'bg-red-500' : 'bg-foreground/20'"
              >
                <span
                  class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                  :class="blockWholeDay ? 'translate-x-4' : 'translate-x-0'"
                />
              </div>
              <span
                class="text-foreground/70 group-hover:text-foreground text-sm font-medium transition-colors"
              >
                Block entire day
              </span>
              <span
                v-if="blockWholeDay"
                class="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-500"
              >
                All day (00:00 – 23:59)
              </span>
            </label>

            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">Date</label>
                <input
                  v-model="availForm.available_date"
                  type="date"
                  :min="new Date().toISOString().split('T')[0]"
                  required
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm transition-all outline-none"
                />
              </div>
              <div class="mt-2">
                <AppTimeRangePicker
                  v-model:start-time="availForm.start_time"
                  v-model:end-time="availForm.end_time"
                  label="Blockout Hours Range"
                  :disabled="blockWholeDay"
                />
              </div>
            </div>

            <div class="mt-2 flex items-center justify-between">
              <div>
                <p
                  v-if="availSuccessMsg"
                  class="animate-in slide-in-from-top-1 flex items-center gap-1.5 text-sm font-medium text-green-500"
                >
                  <Icon
                    name="heroicons:check-circle"
                    size="18"
                  />
                  {{ availSuccessMsg }}
                </p>
                <p
                  v-if="availErrorMsg"
                  class="animate-in slide-in-from-top-1 flex items-center gap-1.5 text-sm font-medium text-red-500"
                >
                  <Icon
                    name="heroicons:exclamation-circle"
                    size="18"
                  />
                  {{ availErrorMsg }}
                </p>
              </div>

              <AppButton
                type="submit"
                :loading="isAddLoading"
                class="min-w-[140px]"
              >
                Block Out Date
              </AppButton>
            </div>
          </form>

          <!-- Divider -->
          <div class="bg-sidebar-border my-6 h-px"></div>

          <!-- Existing Slots -->
          <div>
            <h3 class="text-md text-foreground/80 mb-4 font-semibold">Your Blocked / Away Dates</h3>

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
              class="border-sidebar-border bg-foreground/[0.02] rounded-2xl border border-dashed p-8 text-center"
            >
              <Icon
                name="heroicons:calendar-days"
                class="text-foreground/30 mb-2 text-4xl"
              />
              <p class="text-foreground/50 text-sm">
                No blocked dates set. You are currently marked as available every day for new
                patient referrals.
              </p>
            </div>

            <div
              v-else
              class="flex max-h-[300px] flex-col gap-3 overflow-y-auto pr-1"
            >
              <div
                v-for="slot in availabilities"
                :key="slot.uuid"
                class="border-sidebar-border bg-foreground/[0.02] hover:bg-foreground/[0.04] flex items-center justify-between rounded-2xl border p-4 transition-all"
              >
                <div class="flex items-center gap-4">
                  <div class="rounded-xl bg-red-500/10 p-2.5 text-red-500">
                    <Icon
                      name="heroicons:calendar"
                      size="20"
                    />
                  </div>
                  <div>
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
                    <p class="text-foreground/60 mt-0.5 text-xs">
                      {{ formatTime(slot.start_time) }} - {{ formatTime(slot.end_time) }}
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <span
                    class="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500"
                  >
                    Blocked / Away
                  </span>

                  <button
                    @click="deleteAvailability(slot.uuid)"
                    class="text-foreground/40 cursor-pointer rounded-xl p-2 transition-all hover:bg-red-500/5 hover:text-red-500"
                    title="Remove Blocked Period"
                  >
                    <Icon
                      name="heroicons:trash"
                      size="18"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

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
          The proposed blocked period overlaps with existing duty or blocked periods for this
          doctor:
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
          class="flex items-start gap-2.5 rounded-2xl border border-amber-300/80 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300"
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
