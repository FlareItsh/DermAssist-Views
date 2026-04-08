<script setup lang="ts">
  const route = useRoute()
  const router = useRouter()
  const { getStorageUrl } = useStorage()

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  interface User {
    id: number
    uuid: string
    first_name: string
    middle_name: string | null
    last_name: string
    email: string
    role: string
    created_at: string
    updated_at: string
  }

  interface Verification {
    id: number
    uuid: string
    prc_number: string
    id_photo_path: string
    status: 'pending' | 'approved' | 'rejected'
    user: User
    created_at: string
    updated_at: string
  }

  const { data: response, refresh, pending } = await useApi<{ data: Verification }>(
    `verifications/${route.params.uuid}`
  )

  const verification = computed(() => response.value?.data)

  const isUpdating = ref(false)

  const updateStatus = async (status: 'approved' | 'rejected') => {
    try {
      isUpdating.value = true
      await useApi(`verifications/${route.params.uuid}`, {
        method: 'PUT',
        body: { status }
      })
      await refresh()
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      isUpdating.value = false
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'approved':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'rejected':
        return 'bg-rose-100 text-rose-700 border-rose-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const fullName = computed(() => {
    if (!verification.value) return ''
    const { first_name, middle_name, last_name } = verification.value.user
    return `${first_name} ${middle_name ? middle_name + ' ' : ''}${last_name}`
  })
</script>

<template>
  <div class="min-h-screen bg-gray-50/50 px-6 py-8">
    <!-- Header -->
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-4">
        <AppButton
          variant="ghost"
          size="icon"
          @click="router.back()"
          class="rounded-full bg-white shadow-sm ring-1 ring-gray-200"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </AppButton>
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Verification Details</h1>
          <p class="text-gray-500">Review doctor credentials and supporting documents.</p>
        </div>
      </div>

      <div
        v-if="verification && verification.status === 'pending'"
        class="flex items-center gap-3"
      >
        <AppButton
          variant="destructive"
          :loading="isUpdating"
          @click="updateStatus('rejected')"
        >
          Reject Application
        </AppButton>
        <AppButton
          variant="solid"
          :loading="isUpdating"
          @click="updateStatus('approved')"
        >
          Approve Doctor
        </AppButton>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="pending"
      class="flex h-[60vh] flex-col items-center justify-center space-y-4"
    >
      <div class="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
      <p class="font-medium text-gray-500">Loading verification details...</p>
    </div>

    <!-- Main Content -->
    <div
      v-else-if="verification"
      class="grid grid-cols-1 gap-8 lg:grid-cols-3"
    >
      <!-- Left Column: User Info & Details -->
      <div class="space-y-6 lg:col-span-1">
        <!-- User Profile Card -->
        <div class="overflow-hidden rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <div class="mb-6 flex flex-col items-center text-center">
            <div
              class="mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 ring-4 ring-indigo-50/50"
            >
              <span class="text-4xl font-bold uppercase">
                {{ verification.user.first_name[0] }}{{ verification.user.last_name[0] }}
              </span>
            </div>
            <h2 class="text-2xl font-bold text-gray-900">{{ fullName }}</h2>
            <p class="text-indigo-600 font-medium uppercase text-xs tracking-widest">{{ verification.user.role }}</p>
          </div>

          <div class="space-y-4 border-t border-gray-100 pt-6">
            <div class="flex flex-col">
              <span class="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Email Address</span>
              <span class="text-gray-900 font-medium">{{ verification.user.email }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Application Date</span>
              <span class="text-gray-900 font-medium">{{ formatDate(verification.created_at) }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Current Status</span>
              <div class="mt-1">
                <span
                  :class="[
                    'rounded-full border px-3 py-1 text-xs font-bold tracking-wide uppercase',
                    getStatusColor(verification.status)
                  ]"
                >
                  {{ verification.status }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- License Info -->
        <div class="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h3 class="mb-4 text-lg font-bold text-gray-900">Professional Credentials</h3>
          <div class="space-y-4">
            <div class="flex flex-col rounded-2xl bg-gray-50 p-4">
              <span class="text-[10px] font-bold tracking-widest text-gray-400 uppercase">PRC License Number</span>
              <span class="mt-1 font-mono text-lg font-bold text-indigo-700">{{ verification.prc_number }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Document Preview -->
      <div class="lg:col-span-2">
        <div class="flex h-full flex-col rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div class="flex items-center justify-between border-b border-gray-100 px-8 py-4">
            <h3 class="text-lg font-bold text-gray-900">ID Verification Photo</h3>
            <a
              :href="getStorageUrl(verification.id_photo_path)"
              target="_blank"
              class="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Open in new tab
            </a>
          </div>
          <div class="flex-1 bg-gray-900/5 p-8 flex items-center justify-center">
            <div class="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 shadow-2xl bg-white">
              <NuxtImg
                :src="getStorageUrl(verification.id_photo_path)"
                class="w-full object-contain"
                placeholder
              />
            </div>
          </div>
          <div class="px-8 py-6 bg-gray-50 border-t border-gray-100 text-center">
            <p class="text-sm text-gray-500">
              Ensure the name on the ID matches the user's profile and the PRC License Number is legible.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Not Found State -->
    <div
      v-else
      class="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 py-32 text-center"
    >
      <h3 class="text-xl font-bold text-gray-900">Verification record not found</h3>
      <p class="mt-2 text-gray-500">The verification request you're looking for might have been deleted or moved.</p>
      <AppButton
        variant="outline"
        class="mt-6"
        @click="router.push('/Admin/Moderation/Verification')"
      >
        Back to Verifications
      </AppButton>
    </div>
  </div>
</template>
