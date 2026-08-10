<script setup lang="ts">
import { appointmentService } from '~/api/appointment/AppointmentService'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'scheduled'): void
}>()

// ─── Data ───────────────────────────────────────────────────────────────────

const { completedAppointments, fetchAppointments } = useAppointments()

/**
 * Deduplicate completed patients — keep only the most recent appointment per patient.
 */
const completedPatients = computed(() => {
  const seen = new Map<number, any>()
  const sorted = [...completedAppointments.value].sort(
    (a, b) =>
      new Date(b.completed_at ?? b.date ?? 0).getTime() -
      new Date(a.completed_at ?? a.date ?? 0).getTime()
  )
  for (const appt of sorted) {
    if (!seen.has(appt.patient_id)) {
      seen.set(appt.patient_id, appt)
    }
  }
  return Array.from(seen.values())
})

// ─── Step management ────────────────────────────────────────────────────────

const step = ref<1 | 2>(1)
const selectedPatient = ref<any>(null)

const selectPatient = (appt: any) => {
  selectedPatient.value = appt
  step.value = 2
}

const backToPatients = () => {
  step.value = 1
  selectedPatient.value = null
  resetForm()
}

// ─── Step 2 form ────────────────────────────────────────────────────────────

const selectedDate = ref('')
const scheduleTime = ref('09:00')
const scheduleLocation = ref('')
const schedulePurpose = ref('')
const isScheduling = ref(false)
const scheduleError = ref('')

const resetForm = () => {
  selectedDate.value = ''
  scheduleTime.value = '09:00'
  scheduleLocation.value = ''
  schedulePurpose.value = ''
  scheduleError.value = ''
}

const handleDateSelected = (date: string) => {
  selectedDate.value = date
}

const isFormValid = computed(
  () => !!selectedDate.value && !!scheduleTime.value && !!scheduleLocation.value && !!schedulePurpose.value
)

const confirmSchedule = async () => {
  if (!isFormValid.value || !selectedPatient.value) return
  isScheduling.value = true
  scheduleError.value = ''
  try {
    const dateTime = `${selectedDate.value} ${scheduleTime.value}:00`
    await appointmentService.scheduleForPatient({
      patient_id: selectedPatient.value.patient_id,
      scheduled_at: dateTime,
      location: scheduleLocation.value,
      purpose: schedulePurpose.value,
    })
    await fetchAppointments()
    emit('scheduled')
    emit('close')
  } catch (e: any) {
    scheduleError.value = e?.message ?? 'Something went wrong. Please try again.'
  } finally {
    isScheduling.value = false
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatLastDate = (appt: any): string => {
  const raw = appt.completed_at ?? appt.date
  if (!raw) return 'Unknown'
  return new Date(raw).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const getInitials = (name: string): string => {
  if (!name) return ''
  const cleanName = name.replace(/^Dr\.\s+/i, '')
  const parts = cleanName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        class="bg-foreground/40 fixed inset-0 z-[1000] flex items-center justify-center p-4"
        @click.self="emit('close')"
      >
        <div class="bg-card border-border flex max-h-[90vh] max-w-4xl flex-col overflow-y-auto rounded-3xl border shadow-2xl lg:flex-row">

          <!-- ── Step 1: Patient Picker ──────────────────────────────── -->
          <template v-if="step === 1">
            <div class="flex flex-col p-8 w-[90vw] sm:w-[500px] lg:w-[32rem]">
              <h3 class="mb-2 text-2xl font-bold">New Schedule</h3>
              <p class="mb-6 text-sm text-gray-500">Select a patient to schedule a follow-up</p>

              <div
                v-if="completedPatients.length === 0"
                class="flex h-48 flex-col items-center justify-center gap-3 text-gray-400"
              >
                <Icon name="lucide:users" class="text-5xl opacity-30" />
                <p class="text-sm font-bold">No completed appointments yet.</p>
              </div>

              <div v-else class="flex flex-col gap-3">
                <button
                  v-for="appt in completedPatients"
                  :key="appt.patient_id"
                  @click="selectPatient(appt)"
                  class="group flex w-full items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm active:scale-[0.99]"
                >
                  <div class="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-sm">
                    {{ getInitials(appt.doctor) }}
                  </div>
                  <div class="flex flex-1 flex-col min-w-0">
                    <span class="font-bold text-sm truncate">{{ appt.doctor }}</span>
                    <span class="text-xs text-gray-500 mt-0.5">
                      Last appointment: <span class="font-semibold">{{ formatLastDate(appt) }}</span>
                    </span>
                    <span class="text-xs font-medium mt-0.5 truncate text-red-500">{{ appt.info }}</span>
                  </div>
                  <Icon
                    name="lucide:chevron-right"
                    class="shrink-0 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-indigo-500"
                  />
                </button>
              </div>

              <div class="mt-6">
                <AppButton
                  variant="unstyled"
                  class="bg-foreground/5 text-foreground/70 font-bold transition-all hover:bg-foreground/10 w-full"
                  @click="emit('close')"
                >
                  Cancel
                </AppButton>
              </div>
            </div>
          </template>

          <!-- ── Step 2: Schedule Details ───────────────────────────── -->
          <template v-else>
            <div class="p-6">
              <PatientSideComponentsCalendar @date-selected="handleDateSelected" />
            </div>

            <div class="bg-foreground/5 flex flex-col justify-center p-8 lg:w-80">
              <h3 class="mb-6 text-2xl font-bold">Schedule Appointment</h3>

              <div class="mb-4">
                <label class="mb-2 block text-sm font-bold text-gray-500">Selected Date</label>
                <div class="rounded-xl border border-gray-200 bg-white p-3 font-semibold text-indigo-600">
                  {{ selectedDate || 'Please select a date from the calendar' }}
                </div>
              </div>

              <div class="mb-4">
                <label class="mb-2 block text-sm font-bold text-gray-500">Time</label>
                <input
                  type="time"
                  v-model="scheduleTime"
                  class="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-indigo-500"
                />
              </div>

              <div class="mb-4">
                <label class="mb-2 block text-sm font-bold text-gray-500">Clinic / Location</label>
                <input
                  type="text"
                  v-model="scheduleLocation"
                  placeholder="e.g. SkinCare Clinic, Rm 302"
                  class="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-indigo-500"
                />
              </div>

              <div class="mb-8">
                <label class="mb-2 block text-sm font-bold text-gray-500">Purpose of Appointment</label>
                <textarea
                  v-model="schedulePurpose"
                  rows="3"
                  placeholder="e.g. Follow-up on eczema treatment…"
                  class="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-indigo-500"
                />
              </div>

              <p v-if="scheduleError" class="mb-4 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-500">
                {{ scheduleError }}
              </p>

              <div class="mt-auto flex flex-col gap-3">
                <AppButton
                  variant="solid"
                  class="bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
                  :disabled="!isFormValid || isScheduling"
                  @click="confirmSchedule"
                >
                  {{ isScheduling ? 'Scheduling...' : 'Confirm Schedule' }}
                </AppButton>
                <AppButton
                  variant="unstyled"
                  class="bg-foreground/5 text-foreground/70 font-bold transition-all hover:bg-foreground/10"
                  @click="backToPatients"
                >
                  Back
                </AppButton>
              </div>
            </div>
          </template>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>
