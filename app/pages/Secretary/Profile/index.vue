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

  // Avatar Management & Crop Modal
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

  const { getStorageUrl } = useStorage()
  const avatarError = ref(false)
  const handleAvatarError = () => {
    avatarError.value = true
  }
  watch(
    () => user.value?.avatar_path,
    () => {
      avatarError.value = false
    }
  )
  const { missingSecretaryFields, refreshProfile } = useAppNotifications()

  const form = reactive({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    contact_number: '',
    date_of_birth: '',
    age: '',
    gender: ''
  })

  const middleInitial = computed(() => {
    const m = form.middle_name?.trim()
    if (!m) return ''
    return `${m.charAt(0).toUpperCase()}.`
  })

  // Inner Sidebar Tabs
  type SettingsTab = 'profile' | 'security'
  const activeTab = ref<SettingsTab>('profile')

  const navTabs = computed(() => [
    {
      id: 'profile' as SettingsTab,
      label: 'Personal Profile',
      desc: 'Identity, contact & account details',
      icon: 'heroicons:user-circle'
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

  const initialFormState = ref<string>('')
  const hasFormChanges = computed(() => {
    if (!initialFormState.value) return false
    return JSON.stringify(form) !== initialFormState.value
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
        form.date_of_birth = userData.date_of_birth || ''
        form.age = sanitizeAge(userData.age)
        form.gender = normalizeGender(userData.gender)

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
    contact_number: ''
  })

  const calculatedSecretaryAge = computed(() => calculateAge(form.date_of_birth))

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

  const isLoading = ref(false)
  const isSuccess = ref(false)
  const isLogoutModalOpen = ref(false)

  const submitProfile = async () => {
    // Client-side validation matching registration standards (0-130 age, letters-only names)
    const isFnValid = validateFirstName()
    const isLnValid = validateLastName()
    const isMnValid = validateMiddleName()
    const isDobValid = validateDateOfBirthField()
    const isPhoneValid = validateContactNumberField()

    if (!isFnValid || !isLnValid || !isMnValid || !isDobValid || !isPhoneValid) {
      const firstError =
        errors.first_name ||
        errors.last_name ||
        errors.middle_name ||
        errors.date_of_birth ||
        errors.contact_number
      toast.error(firstError || 'Please fix the errors in the form before saving.')
      return
    }

    isLoading.value = true
    try {
      await userService.update(useCookie('user_uuid').value as string, form)
      initialFormState.value = JSON.stringify(form)
      isSuccess.value = true
      toast.success('Profile updated successfully.')
      await Promise.all([refresh(), refreshProfile(), refreshNuxtData(`userProfile-${userUuid}`)])

      // Update name cookies
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
      toast.error(error?.response?.data?.message || error?.message || 'Failed to update profile.')
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
        <h1 class="text-foreground text-2xl font-bold sm:text-3xl">Secretary Settings</h1>
        <p class="text-foreground/60 mt-1 text-sm">
          Manage your personal details and account security.
        </p>
      </div>

      <div
        v-if="(user?.date_of_birth || user?.age) && user?.gender"
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
      v-if="missingSecretaryFields?.length > 0"
      title="Profile Setup Required"
      type="error"
    >
      Your profile is incomplete. Please fill out the following fields to complete registration:
      <span class="font-bold underline">{{ missingSecretaryFields.join(', ') }}</span
      >.
    </AppAlert>

    <!-- Inner Sidebar Layout Container -->
    <div class="flex flex-col items-start gap-6 lg:flex-row">
      <!-- Left Inner Sidebar -->
      <aside
        class="lg:scrollbar-none w-full shrink-0 space-y-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-5rem)] lg:w-64 lg:self-start lg:overflow-y-auto"
      >
        <!-- Secretary Quick Identity Card -->
        <div class="bg-card border-border rounded-2xl border p-4 text-center shadow-xs">
          <div class="relative mx-auto mb-3 h-16 w-16">
            <div
              class="from-primary/20 to-primary/5 border-primary/20 relative h-full w-full overflow-hidden rounded-full border bg-linear-to-br p-0.5 shadow-xs"
            >
              <NuxtImg
                v-if="user?.avatar_path && !avatarError"
                :src="getStorageUrl(user.avatar_path)"
                class="h-full w-full rounded-full object-cover"
                alt="Profile picture"
                placeholder
                @error="handleAvatarError"
              />
              <div
                v-else
                class="bg-sidebar/60 text-primary flex h-full w-full items-center justify-center rounded-full text-base font-bold tracking-tight"
              >
                {{ form.first_name?.charAt(0) || 'S' }}{{ form.last_name?.charAt(0) || '' }}
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
            {{ form.first_name }} {{ middleInitial ? middleInitial + ' ' : '' }}{{ form.last_name }}
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
            <span class="text-muted-foreground font-medium">Account Status</span>
            <AppProfileStatusBadge
              :is-complete="!!((user?.date_of_birth || user?.age) && user?.gender)"
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

      <!-- Right Main Content Panel -->
      <main class="min-w-0 flex-1">
        <!-- 1. PERSONAL PROFILE TAB -->
        <div
          v-if="activeTab === 'profile'"
          class="animate-in fade-in space-y-6 duration-300"
        >
          <form
            @submit.prevent="submitProfile"
            class="space-y-6"
          >
            <!-- Card 1: Identity & Credentials -->
            <div class="bg-card border-border rounded-3xl border p-6 shadow-xs sm:p-7">
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
                    <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase">
                      First Name
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
                    <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase">
                      Middle Name
                    </label>
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
                    <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase">
                      Last Name
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

                <!-- Email & Contact Number -->
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                <!-- Date of Birth & Gender -->
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div class="flex flex-col gap-1.5">
                    <div class="flex items-center justify-between">
                      <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase">
                        Date of Birth
                      </label>
                      <span
                        v-if="calculatedSecretaryAge !== null"
                        class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      >
                        <Icon
                          name="heroicons:cake-20-solid"
                          size="12"
                        />
                        {{ calculatedSecretaryAge }} yrs old
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
                    <label class="text-foreground/70 text-xs font-bold tracking-wider uppercase">
                      Gender
                    </label>
                    <select
                      v-model="form.gender"
                      class="bg-foreground/5 border-border focus:border-primary w-full appearance-none rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
                    >
                      <option value="">Not Set</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sticky Save Bar -->
            <div
              class="bg-card border-border/80 sticky bottom-4 z-20 flex items-center justify-between rounded-2xl border p-4 shadow-lg backdrop-blur-md"
            >
              <div class="flex items-center gap-2">
                <span
                  v-if="hasFormChanges"
                  class="text-warning-text flex items-center gap-1.5 text-xs font-semibold"
                >
                  <span class="bg-warning h-2 w-2 rounded-full"></span>
                  Unsaved changes
                </span>
                <span
                  v-else
                  class="text-muted-foreground text-xs"
                >
                  All profile changes saved
                </span>
              </div>

              <div class="flex items-center gap-3">
                <AppButton
                  type="submit"
                  :loading="isLoading || isGeoLoading"
                  :disabled="isLoading || isGeoLoading || !hasFormChanges"
                  class="min-w-[140px]"
                >
                  Save Profile
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
          <!-- 2-Column Responsive Row: Change Password & 2FA -->
          <div class="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
            <!-- Card 1: Change Password Card -->
            <AppChangePasswordCard
              :user-uuid="userUuid || ''"
              id-prefix="sec"
              subtitle="Update your account credentials to keep access secure."
            />

            <!-- Card 2: Two-Factor Authentication (2FA) Card -->
            <AppTwoFactorCard
              :enabled="user?.two_factor_enabled"
              @updated="refresh"
            />
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

    <!-- Logout Modal -->
    <AppModalConfirmation
      v-if="isLogoutModalOpen"
      title="Confirm Sign Out"
      description="Are you sure you want to log out of your secretary account?"
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
