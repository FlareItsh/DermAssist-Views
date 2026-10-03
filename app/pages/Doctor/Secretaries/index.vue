<script setup lang="ts">
  import { doctorSecretaryService } from '~/api/doctorSecretary/DoctorSecretaryService'
  import { toast } from 'vue-sonner'
  import { usePasswordGenerator } from '~/composables/usePasswordGenerator'
  import { useFormSanitizer } from '~/composables/useFormSanitizer'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const { getStorageUrl } = useStorage()
  const { generateTemporaryPassword, copyToClipboard } = usePasswordGenerator()
  const {
    blockNameKey,
    sanitizeName,
    validateName,
    blockAgeKey,
    sanitizeAge,
    validateAge,
    normalizeGender
  } = useFormSanitizer()

  const {
    isSubscribed,
    hasFeature,
    subscription,
    currentSubscription,
    canHaveSecretary: subscriptionCanHaveSecretary,
    maxSecretaries: subscriptionMaxSecretaries,
    isLoadingSubscription,
    fetchSubscription
  } = useDoctorSubscription()

  onMounted(async () => {
    await fetchSubscription(true)
  })

  // Fetch doctor's secretaries list
  const { data: response, refresh, pending } = doctorSecretaryService.useList()

  const secretaries = computed(() => {
    const res = response.value as any
    return res?.data ?? (Array.isArray(res) ? res : [])
  })

  const canHaveSecretary = computed(() => {
    if (subscriptionCanHaveSecretary.value) return true
    if (!isSubscribed.value) return false
    const plan = currentSubscription.value?.plan || subscription.value?.plan
    if (!plan) return false
    const features = (plan.features || {}) as Record<string, any>
    return (
      Boolean(features?.can_have_secretary) ||
      hasFeature('can_have_secretary') ||
      plan.max_secretaries === null ||
      (plan.max_secretaries !== undefined && plan.max_secretaries > 0)
    )
  })

  const maxSecretaries = computed(() => {
    if (!isSubscribed.value) return 0
    const plan = currentSubscription.value?.plan || subscription.value?.plan
    return plan?.max_secretaries ?? subscriptionMaxSecretaries.value ?? null
  })

  const isLimitReached = computed(() => {
    if (!canHaveSecretary.value) return true
    if (maxSecretaries.value === null) return false
    return secretaries.value.length >= maxSecretaries.value
  })

  // Search functionality
  const searchValue = ref('')
  const filteredSecretaries = computed(() => {
    let list = secretaries.value
    if (searchValue.value) {
      const query = searchValue.value.toLowerCase()
      list = list.filter((s: any) => {
        const name = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase()
        const email = (s.email || '').toLowerCase()
        const affiliation = (s.affiliation || '').toLowerCase()
        return name.includes(query) || email.includes(query) || affiliation.includes(query)
      })
    }
    return list
  })

  // Add Secretary Modal State
  const showAddModal = ref(false)
  const form = reactive({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const isSubmitting = ref(false)
  const errorMessage = ref('')
  const successMessage = ref('')
  const showAddPassword = ref(false)

  const openAddModal = () => {
    if (!canHaveSecretary.value) {
      navigateTo('/doctor/subscription?required=secretary')
      return
    }
    if (isLimitReached.value) {
      toast.error(
        `You have reached your plan limit of ${maxSecretaries.value} secretary account(s). Please upgrade to add more.`
      )
      return
    }
    const tempPass = generateTemporaryPassword('Secretary')
    form.firstName = ''
    form.middleName = ''
    form.lastName = ''
    form.email = ''
    form.password = tempPass
    form.confirmPassword = tempPass
    showAddPassword.value = false
    errorMessage.value = ''
    successMessage.value = ''
    showAddModal.value = true
  }

  const regenerateAddPassword = () => {
    const tempPass = generateTemporaryPassword('Secretary')
    form.password = tempPass
    form.confirmPassword = tempPass
    toast.success('Generated new temporary password.')
  }

  const handleCreateSecretary = async () => {
    errorMessage.value = ''
    successMessage.value = ''

    // Validate Names
    const fnVal = validateName(form.firstName, 'First name', 2, 50, true)
    if (!fnVal.valid) {
      errorMessage.value = fnVal.error
      return
    }

    const lnVal = validateName(form.lastName, 'Last name', 2, 50, true)
    if (!lnVal.valid) {
      errorMessage.value = lnVal.error
      return
    }

    if (form.middleName) {
      const mnVal = validateName(form.middleName, 'Middle name', 1, 50, false)
      if (!mnVal.valid) {
        errorMessage.value = mnVal.error
        return
      }
    }

    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errorMessage.value = 'Please provide a valid email address.'
      return
    }

    if (!form.password || form.password.length < 8) {
      errorMessage.value = 'Password must be at least 8 characters long.'
      return
    }

    if (form.password !== form.confirmPassword) {
      errorMessage.value = 'Passwords do not match.'
      return
    }

    try {
      isSubmitting.value = true
      await doctorSecretaryService.create({
        firstName: form.firstName.trim(),
        middleName: form.middleName ? form.middleName.trim() : undefined,
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password
      })
      toast.success('Secretary account registered successfully.')
      await refresh()
      showAddModal.value = false
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to create secretary account.'
      toast.error(err.message || 'Failed to create secretary account.')
    } finally {
      isSubmitting.value = false
    }
  }

  // View & Edit Secretary Modal State
  const showEditModal = ref(false)
  const editingSecretary = ref<any>(null)
  const editForm = reactive({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    affiliation: '',
    age: '',
    gender: '',
    password: ''
  })
  const enablePasswordReset = ref(false)
  const showResetPassword = ref(false)
  const isSavingEdit = ref(false)
  const editErrorMessage = ref('')

  const openEditModal = (secretary: any) => {
    editingSecretary.value = secretary
    editForm.firstName = secretary.first_name || ''
    editForm.middleName = secretary.middle_name || ''
    editForm.lastName = secretary.last_name || ''
    editForm.email = secretary.email || ''
    editForm.affiliation = secretary.affiliation || ''
    editForm.age =
      secretary.age !== null && secretary.age !== undefined ? String(secretary.age) : ''
    editForm.gender = normalizeGender(secretary.gender)
    editForm.password = ''
    enablePasswordReset.value = false
    showResetPassword.value = false
    editErrorMessage.value = ''
    showEditModal.value = true
  }

  const togglePasswordReset = () => {
    enablePasswordReset.value = !enablePasswordReset.value
    if (enablePasswordReset.value) {
      editForm.password = generateTemporaryPassword('Secretary')
      showResetPassword.value = true
    } else {
      editForm.password = ''
      showResetPassword.value = false
    }
  }

  const regenerateResetPassword = () => {
    editForm.password = generateTemporaryPassword('Secretary')
    toast.success('Generated new temporary password.')
  }

  const handleSaveEdit = async () => {
    editErrorMessage.value = ''

    // Validate Names
    const fnVal = validateName(editForm.firstName, 'First name', 2, 50, true)
    if (!fnVal.valid) {
      editErrorMessage.value = fnVal.error
      return
    }

    const lnVal = validateName(editForm.lastName, 'Last name', 2, 50, true)
    if (!lnVal.valid) {
      editErrorMessage.value = lnVal.error
      return
    }

    if (editForm.middleName) {
      const mnVal = validateName(editForm.middleName, 'Middle name', 1, 50, false)
      if (!mnVal.valid) {
        editErrorMessage.value = mnVal.error
        return
      }
    }

    // Validate Email
    if (!editForm.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
      editErrorMessage.value = 'Please provide a valid email address.'
      return
    }

    // Validate Age
    if (editForm.age) {
      const ageVal = validateAge(editForm.age, 0, 130, false)
      if (!ageVal.valid) {
        editErrorMessage.value = ageVal.error
        return
      }
    }

    // Validate Password if reset is enabled
    if (enablePasswordReset.value) {
      if (!editForm.password || editForm.password.length < 8) {
        editErrorMessage.value = 'Password must be at least 8 characters long.'
        return
      }
    }

    try {
      isSavingEdit.value = true
      const payload: any = {
        firstName: editForm.firstName.trim(),
        middleName: editForm.middleName ? editForm.middleName.trim() : null,
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        affiliation: editForm.affiliation ? editForm.affiliation.trim() : null,
        age: editForm.age !== '' ? parseInt(editForm.age, 10) : null,
        gender: editForm.gender ? editForm.gender : null
      }

      if (enablePasswordReset.value && editForm.password) {
        payload.password = editForm.password
      }

      await doctorSecretaryService.update(editingSecretary.value.uuid, payload)
      toast.success('Secretary details updated successfully.')
      if (enablePasswordReset.value && editForm.password) {
        toast.info('New temporary password applied. Active sessions were revoked.')
      }
      await refresh()
      showEditModal.value = false
      editingSecretary.value = null
    } catch (err: any) {
      editErrorMessage.value = err.message || 'Failed to update secretary details.'
      toast.error(err.message || 'Failed to update secretary details.')
    } finally {
      isSavingEdit.value = false
    }
  }

  // Delete / Remove Secretary Confirmation Modal State
  const showDeleteModal = ref(false)
  const selectedSecretary = ref<any>(null)
  const isDeleting = ref(false)
  const deleteError = ref('')

  const confirmDelete = (secretary: any) => {
    selectedSecretary.value = secretary
    deleteError.value = ''
    showDeleteModal.value = true
  }

  const handleRemoveFromEditModal = () => {
    showEditModal.value = false
    if (editingSecretary.value) {
      confirmDelete(editingSecretary.value)
    }
  }

  const handleDeleteSecretary = async () => {
    if (!selectedSecretary.value) return

    try {
      isDeleting.value = true
      deleteError.value = ''
      await doctorSecretaryService.delete(selectedSecretary.value.uuid)
      toast.success('Secretary account removed successfully.')
      showDeleteModal.value = false
      selectedSecretary.value = null
      await refresh()
    } catch (err: any) {
      deleteError.value = err.message || 'Failed to remove secretary.'
      toast.error(err.message || 'Failed to remove secretary.')
    } finally {
      isDeleting.value = false
    }
  }
</script>

<template>
  <div class="flex h-full flex-col gap-4 pb-8">
    <!-- Header Section -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-foreground text-2xl font-bold">Manage Secretaries</h1>
          <!-- Quota Badge -->
          <span
            v-if="canHaveSecretary"
            class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold"
            :class="
              isLimitReached
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            "
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :class="isLimitReached ? 'bg-amber-500' : 'bg-emerald-500'"
            ></span>
            {{ secretaries.length }} / {{ maxSecretaries !== null ? maxSecretaries : '∞' }} Seats
            Used
          </span>
        </div>
        <p class="text-muted-foreground mt-0.5 text-sm">
          Register and manage secretary accounts linked to your clinic.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <div class="relative shrink-0">
          <AppSearch
            v-model="searchValue"
            rounded="rounded-full shadow-sm overflow-hidden"
            text="text-secondary"
            width="w-fit"
          />
        </div>
        <AppButton
          v-if="canHaveSecretary || filteredSecretaries.length > 0"
          variant="solid"
          size="md"
          @click="openAddModal"
        >
          <Icon
            :name="canHaveSecretary ? 'heroicons:user-plus' : 'lucide:arrow-up-right'"
            class="mr-1 h-4 w-4"
          />
          <span>{{ canHaveSecretary ? 'Add Secretary' : 'Upgrade Plan' }}</span>
        </AppButton>
      </div>
    </div>

    <!-- Upgrade Feature Banner (Only when doctor has existing secretaries from past plan but is now expired/unsubscribed) -->
    <div
      v-if="!canHaveSecretary && filteredSecretaries.length > 0 && !pending"
      class="flex flex-col justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 shadow-xs sm:flex-row sm:items-center"
    >
      <div class="flex items-center gap-3">
        <Icon
          name="lucide:shield-alert"
          class="h-5 w-5 shrink-0 text-amber-600"
        />
        <div>
          <p class="text-xs font-bold">Secretary Management Inactive</p>
          <p class="text-xs text-amber-800">
            Your current plan does not include active secretary account access. Upgrade to re-enable
            secretary management.
          </p>
        </div>
      </div>
      <NuxtLink
        to="/doctor/subscription?required=secretary"
        class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700"
      >
        <Icon
          name="lucide:arrow-up-right"
          class="h-3.5 w-3.5"
        />
        <span>Upgrade Subscription</span>
      </NuxtLink>
    </div>

    <!-- Limit Reached Notice Banner -->
    <div
      v-else-if="canHaveSecretary && isLimitReached && !pending"
      class="flex flex-col justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-blue-900 shadow-xs sm:flex-row sm:items-center"
    >
      <div class="flex items-center gap-3">
        <Icon
          name="lucide:info"
          class="h-5 w-5 shrink-0 text-blue-600"
        />
        <div>
          <p class="text-xs font-bold">Secretary Seat Quota Reached</p>
          <p class="text-xs text-blue-800">
            You are currently using all {{ maxSecretaries }} of {{ maxSecretaries }} secretary seats
            allowed on your plan.
          </p>
        </div>
      </div>
      <NuxtLink
        to="/doctor/subscription"
        class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
      >
        <Icon
          name="lucide:arrow-up-right"
          class="h-3.5 w-3.5"
        />
        <span>Expand Seats</span>
      </NuxtLink>
    </div>

    <!-- Divider -->
    <div class="bg-border/60 h-px w-full"></div>

    <!-- Loading State -->
    <div
      v-if="pending || isLoadingSubscription"
      class="text-muted-foreground flex items-center justify-center p-12"
    >
      <Icon
        name="svg-spinners:180-ring-with-bg"
        class="text-3xl"
      />
    </div>

    <!-- Premium Feature Locked / Paywall Showcase (When Doctor lacks Secretary plan and has 0 secretaries) -->
    <div
      v-else-if="!canHaveSecretary && filteredSecretaries.length === 0"
      class="border-border/80 bg-card mx-auto my-auto flex max-w-3xl flex-col items-center justify-center rounded-3xl border p-8 text-center shadow-xs md:p-12"
    >
      <div
        class="bg-primary/10 border-primary/20 text-primary mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-xs"
      >
        <Icon
          name="lucide:users-round"
          class="h-8 w-8"
        />
      </div>

      <span
        class="bg-primary/10 text-primary border-primary/20 mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
      >
        <Icon
          name="lucide:sparkles"
          class="h-3.5 w-3.5"
        />
        Individual Doctor (with Secretary) Feature
      </span>

      <h2 class="text-foreground mb-2 text-2xl font-bold tracking-tight">
        Unlock Dedicated Secretary Management
      </h2>
      <p class="text-muted-foreground mb-8 max-w-xl text-sm leading-relaxed">
        Streamline your clinic operations by delegating appointment bookings, patient queues, and
        schedule management to a dedicated secretary account.
      </p>

      <!-- Benefit Highlights Cards -->
      <div class="mb-8 grid w-full gap-4 text-left sm:grid-cols-3">
        <div class="border-sidebar-border bg-muted/10 space-y-1.5 rounded-2xl border p-4">
          <div
            class="bg-primary/10 text-primary mb-2 flex h-8 w-8 items-center justify-center rounded-xl"
          >
            <Icon
              name="lucide:shield-check"
              class="h-4 w-4"
            />
          </div>
          <h4 class="text-foreground text-xs font-bold">Dedicated Staff Login</h4>
          <p class="text-muted-foreground text-[11px] leading-normal">
            Secure, role-restricted credentials created specifically for clinic front-desk staff.
          </p>
        </div>

        <div class="border-sidebar-border bg-muted/10 space-y-1.5 rounded-2xl border p-4">
          <div
            class="bg-primary/10 text-primary mb-2 flex h-8 w-8 items-center justify-center rounded-xl"
          >
            <Icon
              name="lucide:calendar-check"
              class="h-4 w-4"
            />
          </div>
          <h4 class="text-foreground text-xs font-bold">Queue & Bookings</h4>
          <p class="text-muted-foreground text-[11px] leading-normal">
            Allow your secretary to schedule, reschedule, and manage patient appointments in real
            time.
          </p>
        </div>

        <div class="border-sidebar-border bg-muted/10 space-y-1.5 rounded-2xl border p-4">
          <div
            class="bg-primary/10 text-primary mb-2 flex h-8 w-8 items-center justify-center rounded-xl"
          >
            <Icon
              name="lucide:folder-heart"
              class="h-4 w-4"
            />
          </div>
          <h4 class="text-foreground text-xs font-bold">Patient Coordination</h4>
          <p class="text-muted-foreground text-[11px] leading-normal">
            Effortlessly look up patient consultation history and incoming appointment requests.
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
        <NuxtLink
          to="/doctor/subscription?required=secretary"
          class="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold shadow-xs transition sm:w-auto"
        >
          <Icon
            name="lucide:arrow-up-right"
            class="h-4 w-4"
          />
          <span>Upgrade to Secretary Plan (₱1,499/mo)</span>
        </NuxtLink>

        <NuxtLink
          to="/doctor/subscription"
          class="border-border bg-card hover:bg-muted/20 text-foreground inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition sm:w-auto"
        >
          <span>View All Plans</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Empty State (When Doctor HAS permission but has not added any secretaries yet) -->
    <div
      v-else-if="filteredSecretaries.length === 0"
      class="text-muted-foreground border-border bg-card/50 rounded-2xl border border-dashed p-12 text-center"
    >
      <Icon
        name="heroicons:user-group"
        class="mx-auto mb-3 text-5xl opacity-30"
      />
      <h3 class="text-foreground mb-1 text-base font-semibold">No Secretaries Found</h3>
      <p class="text-muted-foreground mb-4 text-sm">
        {{
          searchValue
            ? `No secretaries matching "${searchValue}"`
            : "You haven't registered any secretaries yet."
        }}
      </p>
      <button
        v-if="!searchValue"
        @click="openAddModal"
        class="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition"
      >
        <Icon
          name="heroicons:user-plus"
          class="h-4 w-4"
        />
        <span>Register First Secretary</span>
      </button>
    </div>

    <!-- Secretaries Grid -->
    <div
      v-else
      class="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
    >
      <div
        v-for="secretary in filteredSecretaries"
        :key="secretary.uuid || secretary.id"
        class="bg-card border-border/80 hover:border-border flex flex-col justify-between rounded-2xl border p-5 shadow-sm transition"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div
              class="bg-primary/10 border-primary/20 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border"
            >
              <img
                v-if="secretary.avatar_path"
                :src="getStorageUrl(secretary.avatar_path)"
                :alt="`${secretary.first_name} ${secretary.last_name}`"
                class="h-full w-full object-cover"
              />
              <span
                v-else
                class="text-primary text-base font-bold"
              >
                {{ (secretary.first_name || 'S')[0] }}{{ (secretary.last_name || '')[0] }}
              </span>
            </div>
            <div>
              <h3 class="text-foreground font-semibold">
                {{ secretary.first_name }}
                {{ secretary.middle_name ? secretary.middle_name + ' ' : ''
                }}{{ secretary.last_name }}
              </h3>
              <p class="text-muted-foreground max-w-[180px] truncate text-xs sm:max-w-[220px]">
                {{ secretary.email }}
              </p>
              <p
                v-if="secretary.affiliation"
                class="text-muted-foreground mt-0.5 flex max-w-[180px] items-center gap-1 truncate text-[11px] sm:max-w-[220px]"
              >
                <Icon
                  name="heroicons:building-office"
                  class="h-3 w-3 shrink-0"
                />
                <span class="truncate">{{ secretary.affiliation }}</span>
              </p>
            </div>
          </div>

          <span
            class="shrink-0 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400"
          >
            Secretary
          </span>
        </div>

        <!-- Secretary Attributes Badges -->
        <div
          v-if="secretary.age || secretary.gender"
          class="mt-3 flex flex-wrap items-center gap-1.5"
        >
          <span
            v-if="secretary.age !== null && secretary.age !== undefined && secretary.age !== ''"
            class="border-border/60 bg-muted/40 text-muted-foreground inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
          >
            {{ secretary.age }} yrs old
          </span>
          <span
            v-if="secretary.gender"
            class="border-border/60 bg-muted/40 text-muted-foreground inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
          >
            {{ secretary.gender }}
          </span>
        </div>

        <div class="border-border/50 mt-5 flex items-center justify-between border-t pt-4">
          <span class="text-muted-foreground text-xs">
            Added
            {{
              secretary.created_at
                ? new Date(secretary.created_at).toLocaleDateString()
                : 'Recently'
            }}
          </span>

          <div class="flex items-center gap-2">
            <button
              @click="openEditModal(secretary)"
              class="border-border/80 bg-background hover:bg-muted text-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition"
              title="View and edit secretary profile"
            >
              <Icon
                name="heroicons:pencil-square"
                class="text-muted-foreground h-3.5 w-3.5"
              />
              <span>View & Edit</span>
            </button>

            <button
              @click="confirmDelete(secretary)"
              class="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              title="Remove secretary account"
            >
              <Icon
                name="heroicons:trash"
                class="h-3.5 w-3.5"
              />
              <span>Remove</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Register Secretary Modal -->
    <Teleport to="body">
      <div
        v-if="showAddModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div
          class="bg-card border-border animate-in fade-in zoom-in relative w-full max-w-md rounded-2xl border p-6 shadow-xl duration-200"
        >
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-foreground text-lg font-bold">Register Secretary</h2>
            <button
              @click="showAddModal = false"
              class="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Icon
                name="heroicons:x-mark"
                class="h-5 w-5"
              />
            </button>
          </div>

          <div
            v-if="errorMessage"
            class="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400"
          >
            {{ errorMessage }}
          </div>

          <div
            v-if="successMessage"
            class="mb-4 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-xs text-green-600 dark:text-green-400"
          >
            {{ successMessage }}
          </div>

          <form
            @submit.prevent="handleCreateSecretary"
            class="space-y-3"
          >
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-muted-foreground mb-1 block text-xs font-medium"
                  >First Name *</label
                >
                <input
                  v-model="form.firstName"
                  type="text"
                  required
                  @keydown="blockNameKey"
                  @blur="form.firstName = sanitizeName(form.firstName)"
                  placeholder="First name"
                  class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label class="text-muted-foreground mb-1 block text-xs font-medium"
                  >Last Name *</label
                >
                <input
                  v-model="form.lastName"
                  type="text"
                  required
                  @keydown="blockNameKey"
                  @blur="form.lastName = sanitizeName(form.lastName)"
                  placeholder="Last name"
                  class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label class="text-muted-foreground mb-1 block text-xs font-medium"
                >Middle Name (Optional)</label
              >
              <input
                v-model="form.middleName"
                type="text"
                @keydown="blockNameKey"
                @blur="form.middleName = sanitizeName(form.middleName)"
                placeholder="Middle name"
                class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>

            <div>
              <label class="text-muted-foreground mb-1 block text-xs font-medium"
                >Email Address *</label
              >
              <input
                v-model="form.email"
                type="email"
                required
                placeholder="secretary@clinic.com"
                class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>

            <!-- Password Field with Generator -->
            <div>
              <div class="mb-1 flex items-center justify-between">
                <label class="text-muted-foreground text-xs font-medium"
                  >Temporary Password *</label
                >
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    @click="copyToClipboard(form.password, 'Password')"
                    class="text-primary hover:text-primary/80 inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold transition"
                    title="Copy password to clipboard"
                  >
                    <Icon
                      name="heroicons:clipboard-document"
                      class="h-3.5 w-3.5"
                    />
                    <span>Copy</span>
                  </button>
                  <span class="text-border">|</span>
                  <button
                    type="button"
                    @click="regenerateAddPassword"
                    class="text-primary hover:text-primary/80 inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold transition"
                    title="Generate new temporary password"
                  >
                    <Icon
                      name="heroicons:arrow-path"
                      class="h-3.5 w-3.5"
                    />
                    <span>Regenerate</span>
                  </button>
                </div>
              </div>
              <div class="relative">
                <input
                  v-model="form.password"
                  :type="showAddPassword ? 'text' : 'password'"
                  required
                  placeholder="At least 8 characters"
                  class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 pr-10 font-mono text-xs focus:ring-2 focus:outline-none"
                />
                <button
                  type="button"
                  @click="showAddPassword = !showAddPassword"
                  class="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                  title="Toggle password visibility"
                >
                  <Icon
                    :name="showAddPassword ? 'heroicons:eye-slash' : 'heroicons:eye'"
                    class="h-4 w-4"
                  />
                </button>
              </div>
            </div>

            <div>
              <label class="text-muted-foreground mb-1 block text-xs font-medium"
                >Confirm Password *</label
              >
              <input
                v-model="form.confirmPassword"
                :type="showAddPassword ? 'text' : 'password'"
                required
                placeholder="Re-enter password"
                class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 font-mono text-xs focus:ring-2 focus:outline-none"
              />
            </div>

            <div class="flex items-center justify-end gap-2 pt-3">
              <AppButton
                type="button"
                variant="ghost"
                size="sm"
                @click="showAddModal = false"
              >
                Cancel
              </AppButton>
              <AppButton
                type="submit"
                variant="solid"
                size="sm"
                :loading="isSubmitting"
                :disabled="isSubmitting"
              >
                <span>{{ isSubmitting ? 'Registering...' : 'Register Secretary' }}</span>
              </AppButton>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- View & Edit Secretary Modal -->
    <Teleport to="body">
      <div
        v-if="showEditModal && editingSecretary"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs"
      >
        <div
          class="bg-card border-border animate-in fade-in zoom-in relative my-8 w-full max-w-lg rounded-2xl border p-6 shadow-2xl duration-200"
        >
          <!-- Header -->
          <div class="border-border/60 mb-5 flex items-start justify-between gap-3 border-b pb-4">
            <div class="flex items-center gap-3">
              <div
                class="bg-primary/10 border-primary/20 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border"
              >
                <img
                  v-if="editingSecretary.avatar_path"
                  :src="getStorageUrl(editingSecretary.avatar_path)"
                  :alt="`${editingSecretary.first_name} ${editingSecretary.last_name}`"
                  class="h-full w-full object-cover"
                />
                <span
                  v-else
                  class="text-primary text-base font-bold"
                >
                  {{ (editingSecretary.first_name || 'S')[0]
                  }}{{ (editingSecretary.last_name || '')[0] }}
                </span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-foreground text-lg font-bold">
                    {{ editingSecretary.first_name }} {{ editingSecretary.last_name }}
                  </h2>
                  <span
                    class="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400"
                  >
                    Secretary
                  </span>
                </div>
                <p class="text-muted-foreground text-xs">
                  {{ editingSecretary.email }}
                </p>
              </div>
            </div>

            <button
              @click="showEditModal = false"
              class="text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-1 transition"
            >
              <Icon
                name="heroicons:x-mark"
                class="h-5 w-5"
              />
            </button>
          </div>

          <!-- Error Alert -->
          <div
            v-if="editErrorMessage"
            class="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400"
          >
            {{ editErrorMessage }}
          </div>

          <!-- Edit Form -->
          <form
            @submit.prevent="handleSaveEdit"
            class="space-y-4"
          >
            <!-- Personal Information Section -->
            <div class="space-y-3">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label class="text-muted-foreground mb-1 block text-xs font-medium">
                    First Name *
                  </label>
                  <input
                    v-model="editForm.firstName"
                    type="text"
                    required
                    @keydown="blockNameKey"
                    @blur="editForm.firstName = sanitizeName(editForm.firstName)"
                    placeholder="First name"
                    class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="text-muted-foreground mb-1 block text-xs font-medium">
                    Last Name *
                  </label>
                  <input
                    v-model="editForm.lastName"
                    type="text"
                    required
                    @keydown="blockNameKey"
                    @blur="editForm.lastName = sanitizeName(editForm.lastName)"
                    placeholder="Last name"
                    class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label class="text-muted-foreground mb-1 block text-xs font-medium">
                    Middle Name (Optional)
                  </label>
                  <input
                    v-model="editForm.middleName"
                    type="text"
                    @keydown="blockNameKey"
                    @blur="editForm.middleName = sanitizeName(editForm.middleName)"
                    placeholder="Middle name"
                    class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="text-muted-foreground mb-1 block text-xs font-medium">
                    Email Address *
                  </label>
                  <input
                    v-model="editForm.email"
                    type="email"
                    required
                    placeholder="secretary@clinic.com"
                    class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label class="text-muted-foreground mb-1 block text-xs font-medium">
                  Clinic Affiliation (Optional)
                </label>
                <div class="relative">
                  <input
                    v-model="editForm.affiliation"
                    type="text"
                    placeholder="e.g. Metro Skin & Dermatology Clinic"
                    class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 pl-8 text-sm focus:ring-2 focus:outline-none"
                  />
                  <Icon
                    name="heroicons:building-office"
                    class="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label class="text-muted-foreground mb-1 block text-xs font-medium"> Age </label>
                  <input
                    v-model="editForm.age"
                    type="text"
                    inputmode="numeric"
                    @keydown="blockAgeKey"
                    @blur="editForm.age = sanitizeAge(editForm.age)"
                    placeholder="e.g. 28"
                    class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="text-muted-foreground mb-1 block text-xs font-medium">
                    Gender
                  </label>
                  <select
                    v-model="editForm.gender"
                    class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
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

            <!-- Password Reset Section Card -->
            <div class="border-border/80 bg-muted/20 space-y-3 rounded-xl border p-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div
                    class="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-lg"
                  >
                    <Icon
                      name="heroicons:key"
                      class="h-4 w-4"
                    />
                  </div>
                  <div>
                    <h4 class="text-foreground text-xs font-bold">Password & Access</h4>
                    <p class="text-muted-foreground text-[11px]">
                      {{
                        enablePasswordReset
                          ? 'Generate a temporary password'
                          : 'Keep current secretary password'
                      }}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  @click="togglePasswordReset"
                  class="border-border bg-card text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition"
                >
                  <Icon
                    :name="enablePasswordReset ? 'heroicons:x-mark' : 'heroicons:arrow-path'"
                    class="text-primary h-3.5 w-3.5"
                  />
                  <span>{{ enablePasswordReset ? 'Cancel Reset' : 'Reset Password' }}</span>
                </button>
              </div>

              <!-- When password reset is enabled -->
              <div
                v-if="enablePasswordReset"
                class="border-border/50 space-y-2.5 border-t pt-2"
              >
                <div class="flex items-center justify-between text-xs">
                  <span class="text-muted-foreground font-medium">Temporary Password</span>
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      @click="copyToClipboard(editForm.password, 'Password')"
                      class="text-primary hover:text-primary/80 inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold transition"
                      title="Copy to clipboard"
                    >
                      <Icon
                        name="heroicons:clipboard-document"
                        class="h-3.5 w-3.5"
                      />
                      <span>Copy</span>
                    </button>
                    <span class="text-border">|</span>
                    <button
                      type="button"
                      @click="regenerateResetPassword"
                      class="text-primary hover:text-primary/80 inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold transition"
                      title="Generate new temporary password"
                    >
                      <Icon
                        name="heroicons:arrow-path"
                        class="h-3.5 w-3.5"
                      />
                      <span>Regenerate</span>
                    </button>
                  </div>
                </div>

                <div class="relative">
                  <input
                    v-model="editForm.password"
                    :type="showResetPassword ? 'text' : 'password'"
                    placeholder="Min. 8 characters"
                    required
                    class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 pr-10 font-mono text-xs focus:ring-2 focus:outline-none"
                  />
                  <button
                    type="button"
                    @click="showResetPassword = !showResetPassword"
                    class="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                    title="Toggle password visibility"
                  >
                    <Icon
                      :name="showResetPassword ? 'heroicons:eye-slash' : 'heroicons:eye'"
                      class="h-4 w-4"
                    />
                  </button>
                </div>

                <div
                  class="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-400"
                >
                  <Icon
                    name="heroicons:information-circle"
                    class="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span
                    >Saving a new password will revoke any currently active login sessions for this
                    secretary.</span
                  >
                </div>
              </div>
            </div>

            <!-- Footer actions -->
            <div class="border-border/60 flex items-center justify-between border-t pt-2">
              <button
                type="button"
                @click="handleRemoveFromEditModal"
                class="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-red-600 transition hover:text-red-700 dark:text-red-400"
              >
                <Icon
                  name="heroicons:trash"
                  class="h-3.5 w-3.5"
                />
                <span>Remove Secretary</span>
              </button>

              <div class="flex items-center gap-2">
                <AppButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  @click="showEditModal = false"
                >
                  Cancel
                </AppButton>
                <AppButton
                  type="submit"
                  variant="solid"
                  size="sm"
                  :loading="isSavingEdit"
                  :disabled="isSavingEdit"
                >
                  <span>{{ isSavingEdit ? 'Saving...' : 'Save Changes' }}</span>
                </AppButton>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div
          class="bg-card border-border animate-in fade-in zoom-in relative w-full max-w-sm rounded-2xl border p-6 text-center shadow-xl duration-200"
        >
          <div
            class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400"
          >
            <Icon
              name="heroicons:exclamation-triangle"
              class="text-2xl"
            />
          </div>

          <h2 class="text-foreground mb-1 text-base font-bold">Remove Secretary?</h2>
          <p class="text-muted-foreground mb-4 text-xs">
            Are you sure you want to remove
            <strong class="text-foreground"
              >{{ selectedSecretary?.first_name }} {{ selectedSecretary?.last_name }}</strong
            >? They will no longer have access to manage your schedules.
          </p>

          <div
            v-if="deleteError"
            class="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400"
          >
            {{ deleteError }}
          </div>

          <div class="flex items-center justify-center gap-3">
            <button
              @click="showDeleteModal = false"
              class="bg-secondary text-secondary-foreground hover:bg-secondary/80 cursor-pointer rounded-xl px-4 py-2 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              @click="handleDeleteSecretary"
              :disabled="isDeleting"
              class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              <Icon
                v-if="isDeleting"
                name="svg-spinners:180-ring-with-bg"
                class="h-3.5 w-3.5"
              />
              <span>{{ isDeleting ? 'Removing...' : 'Remove' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
