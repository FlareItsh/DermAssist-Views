<script setup lang="ts">
  import { useRoute, useRouter } from 'vue-router'
  import { useAppointments } from '~/composables/useAppointments'
  import { useStorage } from '~/composables/useStorage'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const route = useRoute()
  const router = useRouter()
  const uuid = route.params.uuid as string

  const { appointments, completedAppointments, pending, fetchAppointments } = useAppointments()
  const { getStorageUrl } = useStorage()

  onMounted(() => {
    if (!appointments.value.length) {
      fetchAppointments()
    }
  })

  const appointment = computed(() => {
    return (
      appointments.value.find(a => a.uuid === uuid || a.id === uuid) ||
      completedAppointments.value.find(a => a.uuid === uuid || a.id === uuid)
    )
  })

  const formattedDate = computed(() => {
    if (!appointment.value?.date) return 'TBD'
    return new Date(appointment.value.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  })

  const getInitials = (name: string): string => {
    if (!name) return ''
    const cleanName = name.replace(/^Dr\.\s+/i, '')
    const parts = cleanName.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-gray-50/50 p-6">
    <!-- Header -->
    <div class="mb-8 flex items-center gap-4">
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
        <h1 class="text-3xl font-bold text-gray-900">Clinical Consultation</h1>
        <p class="text-gray-500">Review patient history and record clinical notes.</p>
      </div>
    </div>

    <div
      v-if="pending"
      class="flex flex-1 items-center justify-center"
    >
      <Icon
        name="material-symbols:sync"
        class="animate-spin text-4xl text-indigo-500"
      />
    </div>

    <div
      v-else-if="appointment"
      class="custom-scrollbar flex-1 space-y-6 overflow-y-auto pr-2"
    >
      <!-- Patient Information Card -->
      <div class="flex items-start gap-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div
          v-if="appointment.diagnosis_image"
          class="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-indigo-100 bg-gray-50"
        >
          <img
            :src="getStorageUrl(appointment.diagnosis_image)"
            class="h-full w-full object-cover"
          />
        </div>
        <div
          v-else
          class="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-indigo-50 text-2xl font-bold text-indigo-600"
        >
          {{ getInitials(appointment.doctor) }}
        </div>
        <div class="flex-1 space-y-4">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">{{ appointment.doctor }}</h2>
            <div class="mt-1 flex items-center gap-2">
              <AppBadge color="primary">{{ appointment.time }}</AppBadge>
              <span class="text-gray-400">•</span>
              <span class="text-sm font-medium text-gray-600">{{ formattedDate }}</span>
            </div>
          </div>

          <div class="flex gap-4 rounded-2xl border border-indigo-100/50 bg-indigo-50/50 p-4">
            <div class="flex flex-1 flex-col">
              <span class="text-[10px] font-bold tracking-widest text-indigo-400 uppercase"
                >Reported Condition</span
              >
              <span class="font-bold text-indigo-900">{{ appointment.info }}</span>
            </div>
            <div
              class="flex flex-1 flex-col"
              v-if="appointment.diagnosis_id"
            >
              <span class="text-[10px] font-bold tracking-widest text-emerald-500 uppercase"
                >AI Inference Reference</span
              >
              <span class="font-mono font-bold text-emerald-700">Available</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Clinical Note Form -->
      <AppClinicalNoteForm
        :appointment-uuid="uuid"
        :diagnosis-id="appointment.diagnosis_id"
      />
    </div>

    <div
      v-else
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <h3 class="text-xl font-bold text-gray-900">Appointment not found</h3>
      <p class="mt-2 text-gray-500">The consultation you are looking for does not exist.</p>
    </div>
  </div>
</template>
