<script setup lang="ts">
  import { doctorSecretaryService } from '~/api/doctorSecretary/DoctorSecretaryService'
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const { getStorageUrl } = useStorage()
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
        return name.includes(query) || email.includes(query)
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
    form.firstName = ''
    form.middleName = ''
    form.lastName = ''
    form.email = ''
    form.password = ''
    form.confirmPassword = ''
    errorMessage.value = ''
    successMessage.value = ''
    showAddModal.value = true
  }

  const handleCreateSecretary = async () => {
    errorMessage.value = ''
    successMessage.value = ''

    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      errorMessage.value = 'Please fill out all required fields.'
      return
    }

    if (form.password.length < 8) {
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
        firstName: form.firstName,
        middleName: form.middleName || undefined,
        lastName: form.lastName,
        email: form.email,
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
            </div>
          </div>

          <span
            class="shrink-0 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400"
          >
            Secretary
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

          <button
            @click="confirmDelete(secretary)"
            class="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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

            <div>
              <label class="text-muted-foreground mb-1 block text-xs font-medium">Password *</label>
              <input
                v-model="form.password"
                type="password"
                required
                placeholder="At least 8 characters"
                class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>

            <div>
              <label class="text-muted-foreground mb-1 block text-xs font-medium"
                >Confirm Password *</label
              >
              <input
                v-model="form.confirmPassword"
                type="password"
                required
                placeholder="Re-enter password"
                class="bg-background border-input focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
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
