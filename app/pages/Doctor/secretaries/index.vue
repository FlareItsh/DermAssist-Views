<script setup lang="ts">
import { doctorSecretaryService } from '~/api/doctorSecretary/DoctorSecretaryService'
import { toast } from 'vue-sonner'

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const { getStorageUrl } = useStorage()
const { isSubscribed, hasFeature, subscription, currentSubscription, canHaveSecretary: subscriptionCanHaveSecretary, maxSecretaries: subscriptionMaxSecretaries, isLoadingSubscription, fetchSubscription } = useDoctorSubscription()

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
  return Boolean(features?.can_have_secretary) || hasFeature('can_have_secretary') || plan.max_secretaries === null || (plan.max_secretaries !== undefined && plan.max_secretaries > 0)
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
    toast.error(`You have reached your plan limit of ${maxSecretaries.value} secretary account(s). Please upgrade to add more.`)
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
  <div class="flex flex-col h-full gap-4 pb-8">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-2xl font-bold text-foreground">Manage Secretaries</h1>
          <!-- Quota Badge -->
          <span 
            v-if="canHaveSecretary"
            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border"
            :class="isLimitReached ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="isLimitReached ? 'bg-amber-500' : 'bg-emerald-500'"></span>
            {{ secretaries.length }} / {{ maxSecretaries !== null ? maxSecretaries : '∞' }} Seats Used
          </span>
        </div>
        <p class="text-sm text-muted-foreground mt-0.5">Register and manage secretary accounts linked to your clinic.</p>
      </div>

      <div class="flex items-center gap-3">
        <div class="relative shrink-0">
          <AppSearch v-model="searchValue" rounded="rounded-full shadow-sm overflow-hidden" text="text-secondary" width="w-fit" />
        </div>
        <AppButton
          v-if="canHaveSecretary || filteredSecretaries.length > 0"
          variant="solid"
          size="md"
          @click="openAddModal"
        >
          <Icon :name="canHaveSecretary ? 'heroicons:user-plus' : 'lucide:arrow-up-right'" class="w-4 h-4 mr-1" />
          <span>{{ canHaveSecretary ? 'Add Secretary' : 'Upgrade Plan' }}</span>
        </AppButton>
      </div>
    </div>

    <!-- Upgrade Feature Banner (Only when doctor has existing secretaries from past plan but is now expired/unsubscribed) -->
    <div v-if="!canHaveSecretary && filteredSecretaries.length > 0 && !pending" class="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div class="flex items-center gap-3">
        <Icon name="lucide:shield-alert" class="w-5 h-5 text-amber-600 shrink-0" />
        <div>
          <p class="text-xs font-bold">Secretary Management Inactive</p>
          <p class="text-xs text-amber-800">Your current plan does not include active secretary account access. Upgrade to re-enable secretary management.</p>
        </div>
      </div>
      <NuxtLink to="/doctor/subscription?required=secretary" class="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs">
        <Icon name="lucide:arrow-up-right" class="w-3.5 h-3.5" />
        <span>Upgrade Subscription</span>
      </NuxtLink>
    </div>

    <!-- Limit Reached Notice Banner -->
    <div v-else-if="canHaveSecretary && isLimitReached && !pending" class="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div class="flex items-center gap-3">
        <Icon name="lucide:info" class="w-5 h-5 text-blue-600 shrink-0" />
        <div>
          <p class="text-xs font-bold">Secretary Seat Quota Reached</p>
          <p class="text-xs text-blue-800">You are currently using all {{ maxSecretaries }} of {{ maxSecretaries }} secretary seats allowed on your plan.</p>
        </div>
      </div>
      <NuxtLink to="/doctor/subscription" class="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs">
        <Icon name="lucide:arrow-up-right" class="w-3.5 h-3.5" />
        <span>Expand Seats</span>
      </NuxtLink>
    </div>

    <!-- Divider -->
    <div class="h-px w-full bg-border/60"></div>

    <!-- Loading State -->
    <div v-if="pending || isLoadingSubscription" class="flex justify-center items-center p-12 text-muted-foreground">
      <Icon name="svg-spinners:180-ring-with-bg" class="text-3xl" />
    </div>

    <!-- Premium Feature Locked / Paywall Showcase (When Doctor lacks Secretary plan and has 0 secretaries) -->
    <div 
      v-else-if="!canHaveSecretary && filteredSecretaries.length === 0" 
      class="rounded-3xl border border-border/80 bg-card p-8 md:p-12 shadow-xs text-center flex flex-col items-center justify-center max-w-3xl mx-auto my-auto"
    >
      <div class="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 text-primary shadow-xs">
        <Icon name="lucide:users-round" class="w-8 h-8" />
      </div>

      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 mb-3">
        <Icon name="lucide:sparkles" class="w-3.5 h-3.5" />
        Individual Doctor (with Secretary) Feature
      </span>

      <h2 class="text-2xl font-bold tracking-tight text-foreground mb-2">
        Unlock Dedicated Secretary Management
      </h2>
      <p class="text-sm text-muted-foreground max-w-xl mb-8 leading-relaxed">
        Streamline your clinic operations by delegating appointment bookings, patient queues, and schedule management to a dedicated secretary account.
      </p>

      <!-- Benefit Highlights Cards -->
      <div class="grid sm:grid-cols-3 gap-4 w-full text-left mb-8">
        <div class="p-4 rounded-2xl border border-sidebar-border bg-muted/10 space-y-1.5">
          <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2">
            <Icon name="lucide:shield-check" class="w-4 h-4" />
          </div>
          <h4 class="text-xs font-bold text-foreground">Dedicated Staff Login</h4>
          <p class="text-[11px] text-muted-foreground leading-normal">
            Secure, role-restricted credentials created specifically for clinic front-desk staff.
          </p>
        </div>

        <div class="p-4 rounded-2xl border border-sidebar-border bg-muted/10 space-y-1.5">
          <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2">
            <Icon name="lucide:calendar-check" class="w-4 h-4" />
          </div>
          <h4 class="text-xs font-bold text-foreground">Queue & Bookings</h4>
          <p class="text-[11px] text-muted-foreground leading-normal">
            Allow your secretary to schedule, reschedule, and manage patient appointments in real time.
          </p>
        </div>

        <div class="p-4 rounded-2xl border border-sidebar-border bg-muted/10 space-y-1.5">
          <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2">
            <Icon name="lucide:folder-heart" class="w-4 h-4" />
          </div>
          <h4 class="text-xs font-bold text-foreground">Patient Coordination</h4>
          <p class="text-[11px] text-muted-foreground leading-normal">
            Effortlessly look up patient consultation history and incoming appointment requests.
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
        <NuxtLink
          to="/doctor/subscription?required=secretary"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-xl text-sm font-bold shadow-xs transition cursor-pointer"
        >
          <Icon name="lucide:arrow-up-right" class="w-4 h-4" />
          <span>Upgrade to Secretary Plan (₱1,499/mo)</span>
        </NuxtLink>

        <NuxtLink
          to="/doctor/subscription"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-border bg-card hover:bg-muted/20 px-5 py-3 rounded-xl text-sm font-bold text-foreground transition cursor-pointer"
        >
          <span>View All Plans</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Empty State (When Doctor HAS permission but has not added any secretaries yet) -->
    <div v-else-if="filteredSecretaries.length === 0" class="text-muted-foreground p-12 text-center border border-dashed border-border rounded-2xl bg-card/50">
      <Icon name="heroicons:user-group" class="mx-auto mb-3 text-5xl opacity-30" />
      <h3 class="text-base font-semibold text-foreground mb-1">No Secretaries Found</h3>
      <p class="text-sm text-muted-foreground mb-4">
        {{ searchValue ? `No secretaries matching "${searchValue}"` : "You haven't registered any secretaries yet." }}
      </p>
      <button
        v-if="!searchValue"
        @click="openAddModal"
        class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer"
      >
        <Icon name="heroicons:user-plus" class="w-4 h-4" />
        <span>Register First Secretary</span>
      </button>
    </div>

    <!-- Secretaries Grid -->
    <div v-else class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="secretary in filteredSecretaries"
        :key="secretary.uuid || secretary.id"
        class="bg-card border border-border/80 hover:border-border rounded-2xl p-5 shadow-sm transition flex flex-col justify-between"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full overflow-hidden bg-primary/10 border border-primary/20 shrink-0 flex items-center justify-center">
              <img
                v-if="secretary.avatar_path"
                :src="getStorageUrl(secretary.avatar_path)"
                :alt="`${secretary.first_name} ${secretary.last_name}`"
                class="w-full h-full object-cover"
              />
              <span v-else class="text-base font-bold text-primary">
                {{ (secretary.first_name || 'S')[0] }}{{ (secretary.last_name || '')[0] }}
              </span>
            </div>
            <div>
              <h3 class="font-semibold text-foreground">
                {{ secretary.first_name }} {{ secretary.middle_name ? secretary.middle_name + ' ' : '' }}{{ secretary.last_name }}
              </h3>
              <p class="text-xs text-muted-foreground truncate max-w-[180px] sm:max-w-[220px]">
                {{ secretary.email }}
              </p>
            </div>
          </div>

          <span class="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs px-2.5 py-1 rounded-full font-medium shrink-0">
            Secretary
          </span>
        </div>

        <div class="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
          <span class="text-xs text-muted-foreground">
            Added {{ secretary.created_at ? new Date(secretary.created_at).toLocaleDateString() : 'Recently' }}
          </span>

          <button
            @click="confirmDelete(secretary)"
            class="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition cursor-pointer"
          >
            <Icon name="heroicons:trash" class="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Register Secretary Modal -->
    <Teleport to="body">
      <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
        <div class="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in duration-200">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-foreground">Register Secretary</h2>
            <button @click="showAddModal = false" class="text-muted-foreground hover:text-foreground cursor-pointer">
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>

          <div v-if="errorMessage" class="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs">
            {{ errorMessage }}
          </div>

          <div v-if="successMessage" class="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 rounded-xl text-xs">
            {{ successMessage }}
          </div>

          <form @submit.prevent="handleCreateSecretary" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1">First Name *</label>
                <input
                  v-model="form.firstName"
                  type="text"
                  required
                  placeholder="First name"
                  class="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1">Last Name *</label>
                <input
                  v-model="form.lastName"
                  type="text"
                  required
                  placeholder="Last name"
                  class="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1">Middle Name (Optional)</label>
              <input
                v-model="form.middleName"
                type="text"
                placeholder="Middle name"
                class="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1">Email Address *</label>
              <input
                v-model="form.email"
                type="email"
                required
                placeholder="secretary@clinic.com"
                class="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1">Password *</label>
              <input
                v-model="form.password"
                type="password"
                required
                placeholder="At least 8 characters"
                class="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1">Confirm Password *</label>
              <input
                v-model="form.confirmPassword"
                type="password"
                required
                placeholder="Re-enter password"
                class="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div class="pt-3 flex items-center justify-end gap-2">
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
      <div v-if="showDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
        <div class="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-xl relative animate-in fade-in zoom-in duration-200 text-center">
          <div class="w-12 h-12 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-3">
            <Icon name="heroicons:exclamation-triangle" class="text-2xl" />
          </div>

          <h2 class="text-base font-bold text-foreground mb-1">Remove Secretary?</h2>
          <p class="text-xs text-muted-foreground mb-4">
            Are you sure you want to remove
            <strong class="text-foreground">{{ selectedSecretary?.first_name }} {{ selectedSecretary?.last_name }}</strong>?
            They will no longer have access to manage your schedules.
          </p>

          <div v-if="deleteError" class="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs">
            {{ deleteError }}
          </div>

          <div class="flex items-center justify-center gap-3">
            <button
              @click="showDeleteModal = false"
              class="px-4 py-2 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              @click="handleDeleteSecretary"
              :disabled="isDeleting"
              class="inline-flex items-center gap-2 bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              <Icon v-if="isDeleting" name="svg-spinners:180-ring-with-bg" class="w-3.5 h-3.5" />
              <span>{{ isDeleting ? 'Removing...' : 'Remove' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
