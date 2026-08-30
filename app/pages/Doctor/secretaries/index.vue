<script setup lang="ts">
import { doctorSecretaryService } from '~/api/doctorSecretary/DoctorSecretaryService'

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const { getStorageUrl } = useStorage()

// Fetch doctor's secretaries list
const { data: response, refresh, pending } = doctorSecretaryService.useList()

const secretaries = computed(() => {
  const res = response.value as any
  return res?.data ?? (Array.isArray(res) ? res : [])
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
    successMessage.value = 'Secretary account registered successfully.'
    await refresh()
    setTimeout(() => {
      showAddModal.value = false
    }, 1200)
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to create secretary account.'
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
    showDeleteModal.value = false
    selectedSecretary.value = null
    await refresh()
  } catch (err: any) {
    deleteError.value = err.message || 'Failed to remove secretary.'
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
        <h1 class="text-2xl font-bold text-foreground">Manage Secretaries</h1>
        <p class="text-sm text-muted-foreground">Register and manage secretary accounts linked to your clinic.</p>
      </div>

      <div class="flex items-center gap-3">
        <div class="relative shrink-0">
          <AppSearch v-model="searchValue" rounded="rounded-full shadow-sm overflow-hidden" text="text-secondary" width="w-fit" />
        </div>
        <button
          @click="openAddModal"
          class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm cursor-pointer"
        >
          <Icon name="heroicons:user-plus" class="w-4 h-4" />
          <span>Add Secretary</span>
        </button>
      </div>
    </div>

    <!-- Divider -->
    <div class="h-px w-full bg-border/60"></div>

    <!-- Loading State -->
    <div v-if="pending" class="flex justify-center items-center p-12 text-muted-foreground">
      <Icon name="svg-spinners:180-ring-with-bg" class="text-3xl" />
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredSecretaries.length === 0" class="text-muted-foreground p-12 text-center border border-dashed rounded-2xl bg-card/50">
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
              <button
                type="button"
                @click="showAddModal = false"
                class="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isSubmitting"
                class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50"
              >
                <Icon v-if="isSubmitting" name="svg-spinners:180-ring-with-bg" class="w-3.5 h-3.5" />
                <span>{{ isSubmitting ? 'Registering...' : 'Register Secretary' }}</span>
              </button>
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
