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
      await userService.update(userUuid, {
        avatar: croppedBase64
      })
      toast.success('Profile picture updated successfully.')
      showCropModal.value = false
      rawAvatarSrc.value = ''
      await Promise.all([refresh(), refreshProfile(), refreshNuxtData(`userProfile-${userUuid}`)])
    } catch (err: any) {
      console.error('Failed to upload avatar:', err)
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to update profile picture.'
      )
    } finally {
      isUploadingAvatar.value = false
    }
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
    middle_name: '',
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

  // Inner Sidebar Tabs
  type SettingsTab = 'profile' | 'security'
  const activeTab = ref<SettingsTab>('profile')

  const navTabs = computed(() => [
    {
      id: 'profile' as SettingsTab,
      label: 'Personal Profile',
      desc: 'Identity, contact & address',
      icon: 'heroicons:user-circle'
    },
    {
      id: 'security' as SettingsTab,
      label: 'Account & Security',
      desc: 'Password & two-factor authentication',
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

  // Change Password State
  const passwordForm = reactive({
    current_password: '',
    new_password: '',
    new_password_confirmation: ''
  })
  const isChangingPassword = ref(false)
  const showCurrentPassword = ref(false)
  const showNewPassword = ref(false)
  const showConfirmPassword = ref(false)
  const passwordError = ref<string | null>(null)

  // Clear password error on tab switch
  watch(activeTab, () => {
    passwordError.value = null
  })

  const handlePasswordChange = async () => {
    passwordError.value = null
    if (!passwordForm.current_password) {
      passwordError.value = 'Please enter your current password.'
      return
    }
    if (passwordForm.new_password.length < 8) {
      passwordError.value = 'New password must be at least 8 characters long.'
      return
    }
    if (passwordForm.new_password !== passwordForm.new_password_confirmation) {
      passwordError.value = 'The new password confirmation does not match.'
      return
    }

    isChangingPassword.value = true
    try {
      await userService.update(userUuid, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        new_password_confirmation: passwordForm.new_password_confirmation
      })
      toast.success('Password updated successfully!')
      passwordForm.current_password = ''
      passwordForm.new_password = ''
      passwordForm.new_password_confirmation = ''
    } catch (err: any) {
      const errors = err?.response?.data?.errors || err?.data?.errors
      let msg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to update password.'
      if (errors && typeof errors === 'object') {
        const firstKey = Object.keys(errors)[0]
        if (firstKey && errors[firstKey]?.[0]) {
          msg = errors[firstKey][0]
        }
      }
      passwordError.value = msg
      toast.error(msg)
    } finally {
      isChangingPassword.value = false
    }
  }

  // Two-Factor Authentication (2FA) Preview State
  const show2FAModal = ref(false)
  const twoFACode = ref('')
  const is2FALoading = ref(false)
  const isCopiedKey = ref(false)
  const mock2FASecret = 'DERM-A7X9-4K2M-90LP'

  const close2FAModal = () => {
    show2FAModal.value = false
    twoFACode.value = ''
  }

  const copySecretKey = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(mock2FASecret)
      isCopiedKey.value = true
      toast.success('2FA secret key copied to clipboard!')
      setTimeout(() => {
        isCopiedKey.value = false
      }, 2000)
    }
  }

  const handleSimulate2FA = () => {
    if (!twoFACode.value || twoFACode.value.length < 6) {
      toast.error('Please enter a valid 6-digit verification code.')
      return
    }
    is2FALoading.value = true
    setTimeout(() => {
      is2FALoading.value = false
      show2FAModal.value = false
      twoFACode.value = ''
      toast.info(
        'Two-Factor Authentication is in preview mode. Backend verification service will be activated soon!'
      )
    }, 600)
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
        form.middle_name = userData.middle_name || ''
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
      const fullDisplayName = [form.first_name, form.middle_name, form.last_name]
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
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-foreground text-2xl font-bold sm:text-3xl">Settings</h1>
        <p class="text-foreground/60 mt-1 text-sm">
          Manage your personal information and profile settings.
        </p>
      </div>

      <div
        v-if="user?.city && user?.province && user?.age && user?.gender"
        class="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-emerald-600"
      >
        <Icon
          name="heroicons:check-badge-20-solid"
          size="18"
        />
        <span class="text-xs font-bold tracking-wider uppercase">Profile Complete</span>
      </div>
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

    <!-- Inner Sidebar Layout Container -->
    <div class="flex flex-col items-start gap-6 lg:flex-row">
      <!-- Left Inner Sidebar (Compact & Sleek) -->
      <aside class="w-full shrink-0 space-y-3 lg:w-64">
        <!-- Patient Quick Identity Card -->
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
                {{ form.first_name?.charAt(0) || 'P' }}{{ form.last_name?.charAt(0) || '' }}
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
            {{ form.first_name }} {{ form.last_name }}
          </h2>
          <p class="text-muted-foreground truncate text-[11px] italic">{{ form.email }}</p>

          <div
            class="border-border/60 mt-3 flex items-center justify-between border-t pt-3 text-[11px]"
          >
            <span class="text-muted-foreground font-medium">Account Status</span>
            <AppProfileStatusBadge
              :is-complete="!!(user?.city && user?.province && user?.age && user?.gender)"
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
        <!-- 1. PERSONAL PROFILE TAB (2-Column Cards Architecture) -->
        <div
          v-if="activeTab === 'profile'"
          class="animate-in fade-in space-y-6 duration-300"
        >
          <!-- Main Profile Settings Form -->
          <form
            @submit.prevent="submitProfile"
            class="space-y-6"
          >
            <div class="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
              <!-- Column 1: Personal Details & Privacy -->
              <div class="flex flex-col gap-6">
                <!-- Card 1: Personal Information -->
                <div class="bg-card border-border rounded-3xl border p-6 shadow-xs">
                  <div class="mb-5 flex items-center gap-3">
                    <div
                      class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                    >
                      <Icon
                        name="heroicons:user-circle-20-solid"
                        size="22"
                      />
                    </div>
                    <div>
                      <h2 class="text-foreground text-base font-bold sm:text-lg">
                        Personal Information
                      </h2>
                      <p class="text-muted-foreground mt-0.5 text-xs">
                        Your basic legal identity and contact details.
                      </p>
                    </div>
                  </div>

                  <div class="bg-border/60 mb-5 h-px"></div>

                  <div class="space-y-4">
                    <!-- First, Middle & Last Name -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div class="flex flex-col gap-1.5">
                        <label
                          class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                        >
                          First Name
                        </label>
                        <input
                          v-model="form.first_name"
                          type="text"
                          class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                          placeholder="Enter first name"
                        />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label
                          class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                        >
                          Middle Name
                        </label>
                        <input
                          v-model="form.middle_name"
                          type="text"
                          class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                          placeholder="Enter middle name (optional)"
                        />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label
                          class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                        >
                          Last Name
                        </label>
                        <input
                          v-model="form.last_name"
                          type="text"
                          class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>

                    <!-- Email Address (read-only) -->
                    <div class="text-foreground flex flex-col gap-1.5">
                      <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase">
                        Email Address
                      </label>
                      <div class="relative">
                        <input
                          v-model="form.email"
                          type="email"
                          disabled
                          class="bg-foreground/5 border-border w-full cursor-not-allowed rounded-2xl border px-4 py-3 pr-9 text-sm font-medium opacity-60 outline-none"
                          placeholder="email@example.com"
                        />
                        <Icon
                          name="heroicons:lock-closed-20-solid"
                          class="text-muted-foreground/60 absolute top-1/2 right-3 -translate-y-1/2"
                          size="16"
                        />
                      </div>
                    </div>

                    <!-- Age & Gender -->
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div class="flex flex-col gap-1.5">
                        <label
                          class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                        >
                          Age
                        </label>
                        <input
                          v-model="form.age"
                          type="number"
                          class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                          placeholder="Your age"
                        />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label
                          class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                        >
                          Gender
                        </label>
                        <select
                          v-model="form.gender"
                          class="bg-foreground/5 border-border focus:border-primary w-full appearance-none rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
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
                  </div>
                </div>

                <!-- Card 2: Data Privacy & AI Research Settings -->
                <div class="bg-card border-border rounded-3xl border p-6 shadow-xs">
                  <div class="mb-4 flex items-center gap-3">
                    <div
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600"
                    >
                      <Icon
                        name="heroicons:shield-check-20-solid"
                        size="22"
                      />
                    </div>
                    <div>
                      <h3 class="text-foreground text-base font-bold sm:text-lg">
                        AI Retraining Dataset Contribution
                      </h3>
                      <p class="text-muted-foreground mt-0.5 text-xs">
                        Help improve clinical dermatological diagnostics anonymously.
                      </p>
                    </div>
                  </div>

                  <div class="bg-border/60 mb-4 h-px"></div>

                  <div class="border-border bg-foreground/[0.02] rounded-2xl border p-4">
                    <div class="flex items-start justify-between gap-4">
                      <p class="text-muted-foreground text-xs leading-relaxed">
                        Allow anonymized skin scan images from doctor consultations to be
                        contributed to the DermAssist AI research dataset. Your identity and
                        personal information are strictly removed. You can modify this consent
                        anytime.
                      </p>
                      <label
                        class="relative mt-0.5 inline-flex shrink-0 cursor-pointer items-center"
                      >
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
                </div>
              </div>

              <!-- Column 2: Residential Address -->
              <div class="flex flex-col">
                <div
                  class="bg-card border-border flex h-full flex-col justify-between rounded-3xl border p-6 shadow-xs"
                >
                  <div>
                    <div class="mb-5 flex items-center justify-between gap-3">
                      <div class="flex items-center gap-3">
                        <div
                          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600"
                        >
                          <Icon
                            name="heroicons:map-pin-20-solid"
                            size="22"
                          />
                        </div>
                        <div>
                          <h2 class="text-foreground text-base font-bold sm:text-lg">
                            Residential Address
                          </h2>
                          <p class="text-muted-foreground mt-0.5 text-xs">
                            Your home address for localized dermatologist discovery.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div class="bg-border/60 mb-5 h-px"></div>

                    <div class="space-y-4">
                      <!-- Region & Province -->
                      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div class="flex flex-col gap-1.5">
                          <label
                            class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                          >
                            Region
                          </label>
                          <select
                            v-model="codes.region"
                            class="bg-foreground/5 border-border focus:border-primary w-full appearance-none rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
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
                          <label
                            class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                          >
                            Province
                          </label>
                          <select
                            v-model="codes.province"
                            :disabled="!provinces.length"
                            class="bg-foreground/5 border-border focus:border-primary w-full appearance-none rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none disabled:opacity-50"
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

                      <!-- City & Barangay -->
                      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div class="flex flex-col gap-1.5">
                          <label
                            class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                          >
                            City / Municipality
                          </label>
                          <select
                            v-model="codes.city"
                            :disabled="!cities.length"
                            class="bg-foreground/5 border-border focus:border-primary w-full appearance-none rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none disabled:opacity-50"
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
                          <label
                            class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                          >
                            Barangay
                          </label>
                          <select
                            v-model="codes.barangay"
                            :disabled="!barangays.length"
                            class="bg-foreground/5 border-border focus:border-primary w-full appearance-none rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none disabled:opacity-50"
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

                      <!-- Street Address -->
                      <div class="flex flex-col gap-1.5">
                        <label
                          class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
                        >
                          Street Address
                        </label>
                        <input
                          v-model="form.street"
                          type="text"
                          class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                          placeholder="House No., Building, Street Name"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- Clinic Proximity Info Pill -->
                  <div class="bg-primary/5 border-primary/20 mt-6 rounded-2xl border p-4">
                    <div class="flex items-start gap-3">
                      <Icon
                        name="heroicons:information-circle-20-solid"
                        class="text-primary mt-0.5 shrink-0"
                        size="18"
                      />
                      <p class="text-muted-foreground text-xs leading-relaxed">
                        Your address helps DermAssist prioritize dermatologists and clinical clinics
                        nearest to your location when scheduling appointments.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Unified Bottom Action Bar -->
            <div class="bg-card border-border rounded-2xl border p-4 shadow-xs">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div
                    v-if="isSuccess"
                    class="inline-flex items-center gap-2 text-emerald-600"
                  >
                    <Icon
                      name="heroicons:check-circle-20-solid"
                      size="18"
                    />
                    <span class="text-xs font-bold">Profile updated successfully!</span>
                  </div>
                  <p
                    v-else
                    class="text-muted-foreground text-xs"
                  >
                    Changes are saved locally until you submit.
                  </p>
                </div>

                <AppButton
                  type="submit"
                  :loading="isLoading"
                  :disabled="isLoading || !hasFormChanges"
                  class="w-full min-w-[140px] sm:w-auto"
                >
                  Save Changes
                </AppButton>
              </div>
            </div>
          </form>
        </div>

        <!-- 2. ACCOUNT & SECURITY TAB -->
        <div
          v-else-if="activeTab === 'security'"
          class="animate-in fade-in space-y-6 duration-300"
        >
          <!-- Security Header Card -->
          <div class="bg-card border-border rounded-3xl border p-6 shadow-xs">
            <div class="flex items-center gap-3.5">
              <div
                class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              >
                <Icon
                  name="heroicons:shield-check-20-solid"
                  size="22"
                />
              </div>
              <div>
                <h2 class="text-foreground text-base font-bold sm:text-lg">Account & Security</h2>
                <p class="text-muted-foreground mt-0.5 text-xs">
                  Manage your credentials, password security, and active sessions.
                </p>
              </div>
            </div>
          </div>

          <!-- Security Cards Grid (Side-by-side on xl, stacked on mobile/tablet) -->
          <div class="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
            <!-- Card 1: Change Password Card -->
            <div
              class="bg-card border-border flex flex-col justify-between rounded-3xl border p-6 shadow-xs sm:p-7"
            >
              <div>
                <div class="mb-5 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                    >
                      <Icon
                        name="heroicons:key-20-solid"
                        size="22"
                      />
                    </div>
                    <div>
                      <h3 class="text-foreground text-base font-bold sm:text-lg">
                        Change Password
                      </h3>
                      <p class="text-muted-foreground mt-0.5 text-xs">
                        Ensure your account is using a long, secure password to protect your
                        records.
                      </p>
                    </div>
                  </div>
                </div>

                <div class="bg-border/60 mb-6 h-px"></div>

                <form
                  @submit.prevent="handlePasswordChange"
                  class="space-y-4"
                >
                  <div
                    v-if="passwordError"
                    class="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-2xl border p-3.5 text-xs font-semibold"
                  >
                    <Icon
                      name="heroicons:exclamation-circle-20-solid"
                      size="16"
                      class="shrink-0"
                    />
                    <span>{{ passwordError }}</span>
                  </div>

                  <!-- Current Password -->
                  <div class="flex flex-col gap-1.5">
                    <label
                      for="patient_current_password"
                      class="text-foreground/70 cursor-pointer text-xs font-bold tracking-wider uppercase"
                    >
                      Current Password
                    </label>
                    <div class="relative">
                      <input
                        id="patient_current_password"
                        v-model="passwordForm.current_password"
                        :type="showCurrentPassword ? 'text' : 'password'"
                        autocomplete="current-password"
                        class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 pr-11 text-sm font-medium transition-all outline-none"
                        placeholder="Enter current password"
                        required
                      />
                      <button
                        type="button"
                        :aria-label="
                          showCurrentPassword ? 'Hide current password' : 'Show current password'
                        "
                        :aria-pressed="showCurrentPassword"
                        @click="showCurrentPassword = !showCurrentPassword"
                        class="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer p-1"
                      >
                        <Icon
                          :name="
                            showCurrentPassword
                              ? 'heroicons:eye-slash-20-solid'
                              : 'heroicons:eye-20-solid'
                          "
                          size="18"
                        />
                      </button>
                    </div>
                  </div>

                  <!-- New Password -->
                  <div class="flex flex-col gap-1.5">
                    <div class="flex items-center justify-between">
                      <label
                        for="patient_new_password"
                        class="text-foreground/70 cursor-pointer text-xs font-bold tracking-wider uppercase"
                      >
                        New Password
                      </label>
                      <span class="text-muted-foreground text-[11px]">Min. 8 characters</span>
                    </div>
                    <div class="relative">
                      <input
                        id="patient_new_password"
                        v-model="passwordForm.new_password"
                        :type="showNewPassword ? 'text' : 'password'"
                        autocomplete="new-password"
                        class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 pr-11 text-sm font-medium transition-all outline-none"
                        placeholder="Enter new password"
                        required
                      />
                      <button
                        type="button"
                        :aria-label="showNewPassword ? 'Hide new password' : 'Show new password'"
                        :aria-pressed="showNewPassword"
                        @click="showNewPassword = !showNewPassword"
                        class="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer p-1"
                      >
                        <Icon
                          :name="
                            showNewPassword
                              ? 'heroicons:eye-slash-20-solid'
                              : 'heroicons:eye-20-solid'
                          "
                          size="18"
                        />
                      </button>
                    </div>
                  </div>

                  <!-- Confirm New Password -->
                  <div class="flex flex-col gap-1.5">
                    <label
                      for="patient_confirm_password"
                      class="text-foreground/70 cursor-pointer text-xs font-bold tracking-wider uppercase"
                    >
                      Confirm New Password
                    </label>
                    <div class="relative">
                      <input
                        id="patient_confirm_password"
                        v-model="passwordForm.new_password_confirmation"
                        :type="showConfirmPassword ? 'text' : 'password'"
                        autocomplete="new-password"
                        class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 pr-11 text-sm font-medium transition-all outline-none"
                        placeholder="Confirm new password"
                        required
                      />
                      <button
                        type="button"
                        :aria-label="
                          showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                        "
                        :aria-pressed="showConfirmPassword"
                        @click="showConfirmPassword = !showConfirmPassword"
                        class="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer p-1"
                      >
                        <Icon
                          :name="
                            showConfirmPassword
                              ? 'heroicons:eye-slash-20-solid'
                              : 'heroicons:eye-20-solid'
                          "
                          size="18"
                        />
                      </button>
                    </div>
                  </div>

                  <div class="pt-2">
                    <AppButton
                      type="submit"
                      :loading="isChangingPassword"
                      :disabled="
                        isChangingPassword ||
                        !passwordForm.current_password ||
                        !passwordForm.new_password
                      "
                      class="min-w-[150px]"
                    >
                      Update Password
                    </AppButton>
                  </div>
                </form>
              </div>
            </div>

            <!-- Card 2: Two-Factor Authentication (2FA) Card -->
            <div
              class="bg-card border-border flex flex-col justify-between rounded-3xl border p-6 shadow-xs sm:p-7"
            >
              <div>
                <div class="mb-5 flex items-start justify-between gap-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600"
                    >
                      <Icon
                        name="heroicons:device-phone-mobile-20-solid"
                        size="22"
                      />
                    </div>
                    <div>
                      <h3 class="text-foreground text-base font-bold sm:text-lg">
                        Two-Factor Authentication (2FA)
                      </h3>
                      <p class="text-muted-foreground mt-0.5 text-xs">
                        Strengthen account security by requiring a verification code when signing
                        in.
                      </p>
                    </div>
                  </div>

                  <div
                    class="bg-foreground/5 text-muted-foreground border-border inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
                  >
                    <span class="h-2 w-2 rounded-full bg-amber-500"></span>
                    <span>Disabled</span>
                  </div>
                </div>

                <div class="bg-border/60 mb-5 h-px"></div>

                <div class="space-y-4">
                  <!-- Benefits Callout -->
                  <div class="border-border bg-foreground/[0.02] space-y-3 rounded-2xl border p-4">
                    <h4 class="text-foreground text-sm font-bold">Why enable 2FA?</h4>
                    <p class="text-muted-foreground text-xs leading-relaxed">
                      Two-Factor Authentication prevents unauthorized access to your diagnostic
                      history and personal records, even if your password becomes compromised.
                    </p>
                    <div class="text-muted-foreground space-y-2 pt-1 text-xs">
                      <div class="flex items-center gap-2">
                        <Icon
                          name="heroicons:check-circle"
                          class="text-primary h-4 w-4 shrink-0"
                        />
                        <span>Generates temporary time-based passcodes (TOTP)</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <Icon
                          name="heroicons:check-circle"
                          class="text-primary h-4 w-4 shrink-0"
                        />
                        <span>Compatible with Google Authenticator, Authy, Microsoft</span>
                      </div>
                    </div>
                  </div>

                  <!-- Authenticator application CTA box -->
                  <div
                    class="border-border bg-foreground/[0.02] flex flex-col items-start justify-between gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center"
                  >
                    <div class="space-y-1">
                      <h4 class="text-foreground text-sm font-bold">Authenticator Application</h4>
                      <p class="text-muted-foreground text-xs leading-relaxed">
                        Pair your device to start generating one-time passcodes.
                      </p>
                    </div>
                    <AppButton
                      type="button"
                      variant="outline"
                      @click="show2FAModal = true"
                      class="shrink-0"
                    >
                      <Icon
                        name="heroicons:qr-code-20-solid"
                        size="16"
                        class="mr-1.5"
                      />
                      Configure 2FA
                    </AppButton>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Long Bar Card: Active Session & Logout -->
          <div class="border-destructive/20 bg-destructive/5 rounded-3xl border p-6 shadow-xs">
            <div
              class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
            >
              <div>
                <h3 class="text-destructive text-base font-bold">Sign Out of Session</h3>
                <p class="text-muted-foreground mt-0.5 text-xs">
                  Terminate your active authentication session on this device.
                </p>
              </div>

              <button
                type="button"
                @click="isLogoutModalOpen = true"
                class="bg-destructive/10 text-destructive hover:bg-destructive border-destructive/20 cursor-pointer rounded-2xl border px-4 py-2.5 text-xs font-bold transition-all hover:text-white"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- 2FA Setup Preview Modal -->
    <Teleport to="body">
      <div
        v-if="show2FAModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      >
        <div
          class="bg-card border-border animate-in fade-in zoom-in-95 w-full max-w-md space-y-5 rounded-3xl border p-6 shadow-2xl sm:p-7"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600"
              >
                <Icon
                  name="heroicons:qr-code-20-solid"
                  size="22"
                />
              </div>
              <div>
                <h3 class="text-foreground text-lg font-bold">Configure 2FA</h3>
                <p class="text-muted-foreground text-xs">Scan code with your authenticator app</p>
              </div>
            </div>
            <button
              @click="close2FAModal"
              class="text-muted-foreground hover:text-foreground cursor-pointer rounded-xl p-1"
            >
              <Icon
                name="heroicons:x-mark-20-solid"
                size="20"
              />
            </button>
          </div>

          <!-- Preview Badge -->
          <div
            class="bg-primary/10 border-primary/20 text-primary flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs"
          >
            <Icon
              name="heroicons:information-circle-20-solid"
              size="18"
              class="mt-0.5 shrink-0"
            />
            <p class="leading-relaxed">
              <strong>Preview Mode:</strong> You can preview the setup process below. Automated 2FA
              login verification will be activated in an upcoming release.
            </p>
          </div>

          <!-- Step 1: Scan QR Code -->
          <div class="space-y-2 text-center">
            <div
              class="border-border bg-foreground/[0.03] mx-auto flex h-40 w-40 items-center justify-center rounded-2xl border p-3"
            >
              <div class="text-muted-foreground flex flex-col items-center justify-center gap-1.5">
                <Icon
                  name="heroicons:qr-code-20-solid"
                  size="64"
                  class="text-foreground/70"
                />
                <span class="text-[10px] font-semibold tracking-wider uppercase"
                  >Mock Authenticator QR</span
                >
              </div>
            </div>
            <div class="flex items-center justify-center gap-2 pt-1">
              <span class="text-foreground font-mono text-xs font-bold">{{ mock2FASecret }}</span>
              <button
                type="button"
                @click="copySecretKey"
                class="text-primary hover:text-primary-hover cursor-pointer p-1 text-xs"
                title="Copy secret key"
              >
                <Icon
                  :name="
                    isCopiedKey
                      ? 'heroicons:check-20-solid'
                      : 'heroicons:clipboard-document-20-solid'
                  "
                  size="16"
                />
              </button>
            </div>
          </div>

          <!-- Step 2: Code Input -->
          <div class="space-y-2">
            <label
              for="patient_2fa_code"
              class="text-foreground/70 cursor-pointer text-xs font-bold tracking-wider uppercase"
            >
              Enter 6-Digit Code
            </label>
            <input
              id="patient_2fa_code"
              v-model="twoFACode"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="one-time-code"
              maxlength="6"
              class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-center font-mono text-lg font-bold tracking-widest transition-all outline-none"
              placeholder="000000"
            />
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 pt-2">
            <AppButton
              variant="outline"
              type="button"
              @click="close2FAModal"
            >
              Close
            </AppButton>
            <AppButton
              type="button"
              :loading="is2FALoading"
              @click="handleSimulate2FA"
            >
              Verify & Activate
            </AppButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Logout Confirmation Modal -->
    <AppModalConfirmation
      v-model="isLogoutModalOpen"
      title="Sign Out Confirmation"
      description="Are you sure you want to sign out of your DermAssist session?"
      confirm-text="Log Out"
      confirm-variant="danger"
      @confirm="logout"
    />

    <!-- Crop Avatar Modal -->
    <AppModalCropImage
      v-model="showCropModal"
      :image-src="rawAvatarSrc"
      :loading="isUploadingAvatar"
      @crop="handleApplyCroppedAvatar"
      @cancel="rawAvatarSrc = ''"
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
