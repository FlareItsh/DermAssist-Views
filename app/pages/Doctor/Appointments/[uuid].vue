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

  const { appointments, pending } = useAppointments()
  const { getStorageUrl } = useStorage()

  const appointment = computed(() => {
    return appointments.value.find(a => a.uuid === uuid)
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
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </AppButton>
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Clinical Consultation</h1>
        <p class="text-gray-500">Review patient history and record clinical notes.</p>
      </div>
    </div>

    <div v-if="pending" class="flex flex-1 items-center justify-center">
      <Icon name="material-symbols:sync" class="animate-spin text-4xl text-indigo-500" />
    </div>

    <div v-else-if="appointment" class="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
      
      <!-- Patient Information Card -->
      <div class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm flex items-start gap-6">
        <div class="h-24 w-24 rounded-2xl overflow-hidden border-2 border-indigo-100 bg-gray-50 shrink-0">
           <img 
              :src="appointment.diagnosis_image ? getStorageUrl(appointment.diagnosis_image) : 'https://i.pravatar.cc/150?u=' + appointment.id" 
              class="h-full w-full object-cover" 
            />
        </div>
        <div class="flex-1 space-y-4">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">{{ appointment.doctor }}</h2>
            <div class="flex items-center gap-2 mt-1">
              <AppBadge color="primary">{{ appointment.time }}</AppBadge>
              <span class="text-gray-400">•</span>
              <span class="text-sm font-medium text-gray-600">{{ formattedDate }}</span>
            </div>
          </div>
          
          <div class="flex gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
            <div class="flex flex-col flex-1">
               <span class="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">Reported Condition</span>
               <span class="font-bold text-indigo-900">{{ appointment.info }}</span>
            </div>
             <div class="flex flex-col flex-1" v-if="appointment.diagnosis_id">
               <span class="text-[10px] font-bold tracking-widest text-emerald-500 uppercase">AI Inference Reference</span>
               <span class="font-bold text-emerald-700 font-mono">Available</span>
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

    <div v-else class="flex flex-col items-center justify-center py-20 text-center">
      <h3 class="text-xl font-bold text-gray-900">Appointment not found</h3>
      <p class="mt-2 text-gray-500">The consultation you are looking for does not exist.</p>
    </div>
  </div>
</template>
