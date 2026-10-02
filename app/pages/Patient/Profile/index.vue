<script setup lang="ts">
  import { userService } from '~/api/user/UserService'
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const userUuid = useCookie('user_uuid').value as string
  const { data: response, refresh } = userService.useShow(userUuid, {
    key: `userProfile-${userUuid}`
  })
  // Laravel JsonResource wraps single resources under `data` — unwrap at source
  const user = computed(() => (response.value as any)?.data ?? response.value)

  const isUploadingAvatar = ref(false)
  const avatarInputRef = ref<HTMLInputElement | null>(null)

  const triggerAvatarUpload = () => {
    avatarInputRef.value?.click()
  }

  const handleAvatarFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, or WebP).')
      input.value = ''
      return
    }

    const maxSizeInBytes = 5 * 1024 * 1024
    if (file.size > maxSizeInBytes) {
      toast.error('Image size exceeds 5MB limit. Please choose a smaller image.')
      input.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = async e => {
      const base64Data = e.target?.result as string
      if (!base64Data) return

      isUploadingAvatar.value = true
      try {
        await userService.update(userUuid, {
          avatar: base64Data
        })
        toast.success('Profile picture updated successfully.')
        await Promise.all([refresh(), refreshProfile(), refreshNuxtData(`userProfile-${userUuid}`)])
      } catch (err: any) {
        console.error('Failed to upload avatar:', err)
        toast.error(
          err?.response?.data?.message || err?.message || 'Failed to update profile picture.'
        )
      } finally {
        isUploadingAvatar.value = false
        input.value = ''
      }
    }
    reader.onerror = () => {
      toast.error('Error reading the image file.')
      input.value = ''
    }
    reader.readAsDataURL(file)
  }

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
  const { missingPatientFields, refreshProfile } = useAppNotifications()

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
    consent_dataset: false
  })

  onMounted(async () => {
    await fetchRegions()
  })

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

  const initialFormState = ref<string>('')
  const hasFormChanges = computed(() => {
    if (!initialFormState.value) return false
    return JSON.stringify(form) !== initialFormState.value
  })

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
        form.consent_dataset = Boolean(userData.consent_dataset)

        initDropdowns()
        loaded.value = true
        initialFormState.value = JSON.stringify(form)
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
      // Always re-geocode before saving to ensure coordinates match the current address
      await geocodeAddress()

      await userService.update(useCookie('user_uuid').value as string, form)
      initialFormState.value = JSON.stringify(form)
      isSuccess.value = true
      toast.success('Profile updated successfully.')
      await Promise.all([refresh(), refreshProfile(), refreshNuxtData(`userProfile-${userUuid}`)])

      // Update name cookies
      const userName = useCookie('user_name')
      const authName = useCookie('auth_user_name')
      userName.value = `${form.first_name} ${form.last_name}`
      authName.value = `${form.first_name} ${form.last_name}`

      setTimeout(() => {
        isSuccess.value = false
      }, 3500)
    } catch (error: any) {
      console.error('Failed to update profile:', error)
      toast.error(
        error?.response?.data?.message || error?.message || 'Failed to update patient profile.'
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
  <div class="mt-4 max-w-5xl pb-24 md:pb-0">
    <div class="mb-8">
      <h1 class="text-3xl font-bold">Account Settings</h1>
      <p class="text-foreground/60 mt-2">Manage your personal information and profile settings.</p>
    </div>

    <!-- Profile Completion Alert -->
    <AppAlert
      v-if="missingPatientFields.length > 0"
      title="Profile Setup Required"
      type="error"
    >
      Your profile is incomplete. Please fill out the following fields to complete registration:
      <span class="font-bold underline">{{ missingPatientFields.join(', ') }}</span
      >.
    </AppAlert>

    <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <!-- Left: Profile Preview -->
      <div class="lg:col-span-1">
        <div
          class="bg-sidebar/40 border-sidebar-border rounded-3xl border p-6 text-center shadow-sm backdrop-blur-sm"
        >
          <div class="relative mx-auto mb-4 h-32 w-32">
            <div
              class="from-primary/20 to-primary/5 border-primary/20 relative h-full w-full overflow-hidden rounded-full border-2 bg-linear-to-br p-1"
            >
              <NuxtImg
                v-if="user?.avatar_path"
                :src="getStorageUrl(user.avatar_path)"
                class="h-full w-full rounded-full object-cover"
                placeholder
              />
              <div
                v-else
                class="bg-sidebar/60 text-primary flex h-full w-full items-center justify-center rounded-full text-4xl font-bold"
              >
                {{ form.first_name?.charAt(0) }}{{ form.last_name?.charAt(0) }}
              </div>
            </div>
            <button
              type="button"
              @click="triggerAvatarUpload"
              :disabled="isUploadingAvatar"
              title="Upload profile picture"
              class="bg-primary hover:bg-primary-hover border-background focus:ring-primary/30 absolute right-0 bottom-0 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 text-white shadow-lg transition-transform hover:scale-110 focus:ring-2 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
            >
              <Icon
                v-if="!isUploadingAvatar"
                name="heroicons:camera-20-solid"
                size="16"
              />
              <Icon
                v-else
                name="heroicons:arrow-path-20-solid"
                class="animate-spin"
                size="16"
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
          <h2 class="text-xl font-bold">{{ form.first_name }} {{ form.last_name }}</h2>
          <p class="text-foreground/60 text-sm italic">{{ form.email }}</p>

          <div class="mt-6 flex flex-col gap-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-foreground/50">Account Status</span>
              <AppProfileStatusBadge
                :is-complete="!!(user?.city && user?.province && user?.age && user?.gender)"
              />
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

            <div class="flex flex-col gap-1.5">
              <label class="text-foreground/70 ml-1 text-sm font-medium">Email Address</label>
              <input
                v-model="form.email"
                type="email"
                disabled
                class="bg-foreground/5 border-sidebar-border w-full cursor-not-allowed rounded-2xl border px-4 py-3 opacity-60 transition-all outline-none"
                placeholder="email@example.com"
              />
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
                  <option value="prefer_not_to_say">Prefer not to say</option>
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
              <label class="text-foreground/70 ml-1 text-sm font-medium">Street Address</label>
              <input
                v-model="form.street"
                type="text"
                class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 transition-all outline-none"
                placeholder="House No., Street Name"
              />
            </div>

            <!-- Data Privacy & AI Research Settings -->
            <div class="border-border bg-foreground/[0.02] mt-2 rounded-2xl border p-4">
              <div class="flex items-start justify-between gap-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <Icon
                      name="lucide:shield-check"
                      class="text-primary h-4 w-4"
                    />
                    <h4 class="text-foreground text-sm font-bold">
                      AI Retraining Dataset Contribution
                    </h4>
                  </div>
                  <p class="text-muted-foreground text-xs leading-relaxed">
                    Allow anonymized skin scan images from doctor consultations to be contributed to
                    the DermAssist AI research dataset. Your identity and personal information are
                    strictly removed. You can change this anytime.
                  </p>
                </div>
                <label class="relative mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    v-model="form.consent_dataset"
                    class="peer sr-only"
                  />
                  <div
                    class="bg-foreground/20 peer peer-checked:bg-primary h-6 w-11 rounded-full peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
                  ></div>
                </label>
              </div>
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
                <span class="text-sm font-medium">Profile updated successfully!</span>
              </div>
              <div v-else></div>

              <AppButton
                type="submit"
                :loading="isLoading"
                :disabled="isLoading || !hasFormChanges"
                class="min-w-[140px]"
              >
                Save Changes
              </AppButton>
            </div>
          </form>
        </div>
      </div>
    </div>
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
