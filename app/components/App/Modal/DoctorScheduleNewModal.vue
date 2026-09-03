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

const getTodayStr = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const selectedDate = ref('')
const scheduleTime = ref('09:00')
const scheduleEndTime = ref('10:00')
const scheduleLocation = ref('')
const customLocationInput = ref('')
const schedulePurpose = ref('')
const isScheduling = ref(false)
const scheduleError = ref('')
const wasAutofilled = ref(false)

const { clinics, fetchClinics } = useDoctorClinics()

onMounted(async () => {
  await fetchClinics()
})

watch(scheduleTime, (newStart) => {
  if (!newStart) return
  const [h, m] = newStart.split(':').map(Number)
  const endHour = (h + 1) % 24
  scheduleEndTime.value = `${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

// ─── Blocked dates & Duty Presets ───────────────────────────────────────────

const { blockedSlots, isTimeRangeBlockedOnDate, getBlockedTimesForDate, getDutyClinicForDateAndTime } = useBlockedDates()

// Smart autofill clinic location from duty preset when date & time change
watch([selectedDate, scheduleTime, scheduleEndTime], ([date, start, end]) => {
  if (!date || !start) return
  const matchedDuty = getDutyClinicForDateAndTime(date, start, end)
  if (matchedDuty) {
    const loc = matchedDuty.clinic?.name || matchedDuty.location_name
    if (loc) {
      scheduleLocation.value = loc
      customLocationInput.value = ''
      wasAutofilled.value = true
      return
    }
  }

  // If no duty schedule found and scheduleLocation was previously autofilled or empty
  if (wasAutofilled.value || !scheduleLocation.value) {
    if (clinics.value.length > 0) {
      scheduleLocation.value = clinics.value[0].name
      customLocationInput.value = ''
    }
    wasAutofilled.value = false
  }
}, { immediate: true })

const blockedSlotsForDate = computed(() => {
  if (!selectedDate.value) return []
  return getBlockedTimesForDate(selectedDate.value)
})

const existingApptSlotsForDate = computed(() => {
  if (!selectedDate.value) return []
  return appointments.value
    .filter((appt) => appt.date === selectedDate.value && appt.raw_scheduled_at)
    .map((appt) => {
      const startObj = new Date(appt.raw_scheduled_at!.replace(/Z|(\+\d{2}:\d{2})$/i, ''))
      const startH = String(startObj.getHours()).padStart(2, '0')
      const startM = String(startObj.getMinutes()).padStart(2, '0')

      let endH = String((startObj.getHours() + 1) % 24).padStart(2, '0')
      let endM = startM
      if (appt.raw_scheduled_end_at) {
        const endObj = new Date(appt.raw_scheduled_end_at.replace(/Z|(\+\d{2}:\d{2})$/i, ''))
        endH = String(endObj.getHours()).padStart(2, '0')
        endM = String(endObj.getMinutes()).padStart(2, '0')
      }

      return {
        start_time: `${startH}:${startM}`,
        end_time: `${endH}:${endM}`,
        label: appt.doctor || 'Booked Appointment'
      }
    })
})

/**
 * True when the currently selected date+time range overlaps a blocked slot.
 */
const isSelectedTimeBlocked = computed(() => {
  if (!selectedDate.value || !scheduleTime.value || !scheduleEndTime.value) return false
  return isTimeRangeBlockedOnDate(selectedDate.value, scheduleTime.value, scheduleEndTime.value)
})

const isTimeRangeInvalid = computed(() => {
  if (!scheduleTime.value || !scheduleEndTime.value) return false
  return scheduleEndTime.value <= scheduleTime.value
})

/**
 * Human-readable label for blocked ranges on the selected date.
 */
const blockedRangesLabel = computed(() => {
  if (!selectedDate.value) return ''
  const slots = getBlockedTimesForDate(selectedDate.value)
  if (!slots.length) return ''
  return slots
    .map((s) => {
      const fmt = (t: string) => {
        const [h, m] = t.split(':').map(Number)
        const ampm = h >= 12 ? 'PM' : 'AM'
        const hour = h % 12 || 12
        return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
      }
      if (s.start_time <= '00:01' && s.end_time >= '23:58') return 'All day'
      return `${fmt(s.start_time)} – ${fmt(s.end_time)}`
    })
    .join(', ')
})

const resetForm = () => {
  selectedDate.value = ''
  scheduleTime.value = '09:00'
  scheduleEndTime.value = '10:00'
  scheduleLocation.value = ''
  schedulePurpose.value = ''
  scheduleError.value = ''
}

const handleDateSelected = (date: string) => {
  selectedDate.value = date
}

const effectiveLocation = computed(() => {
  if (scheduleLocation.value === '__custom__') {
    return customLocationInput.value.trim()
  }
  return scheduleLocation.value.trim()
})

const isFormValid = computed(
  () =>
    !!selectedDate.value &&
    !!scheduleTime.value &&
    !!scheduleEndTime.value &&
    !!effectiveLocation.value &&
    !!schedulePurpose.value &&
    !isSelectedTimeBlocked.value &&
    !isTimeRangeInvalid.value
)

const confirmSchedule = async () => {
  if (!isFormValid.value || !selectedPatient.value) return
  isScheduling.value = true
  scheduleError.value = ''
  try {
    const dateTime = `${selectedDate.value} ${scheduleTime.value}:00`
    const endDateTime = `${selectedDate.value} ${scheduleEndTime.value}:00`
    await appointmentService.scheduleForPatient({
      patient_id: selectedPatient.value.patient_id,
      scheduled_at: dateTime,
      scheduled_end_at: endDateTime,
      location: effectiveLocation.value,
      purpose: schedulePurpose.value,
    })
    await fetchAppointments()
    emit('scheduled')
    emit('close')
  } catch (e: any) {
    scheduleError.value = e?.data?.message ?? e?.message ?? 'Something went wrong. Please try again.'
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
        <div class="bg-card border-border flex max-h-[90vh] max-w-5xl flex-col overflow-y-auto rounded-3xl border shadow-2xl lg:flex-row">

          <!-- ── Step 1: Patient Picker ──────────────────────────────── -->
          <template v-if="step === 1">
            <div class="flex flex-col p-8 w-[95vw] sm:w-[550px] lg:w-[34rem]">
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
            <div class="flex flex-col p-8 w-[95vw] sm:w-[600px] lg:w-[36rem]">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-2xl font-bold">Schedule Appointment</h3>
                  <p class="text-xs text-indigo-600 font-bold mt-0.5" v-if="selectedPatient">
                    Patient: {{ selectedPatient.doctor }}
                  </p>
                </div>
                <button @click="backToPatients" class="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full">
                  <Icon name="material-symbols:close-rounded" class="text-xl" />
                </button>
              </div>

              <!-- Direct Date Picker Input -->
              <div class="mb-4">
                <label class="mb-1.5 block text-xs font-bold text-gray-500 uppercase tracking-wider">Select Date</label>
                <input
                  type="date"
                  v-model="selectedDate"
                  :min="getTodayStr()"
                  class="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm font-bold text-gray-800 outline-none focus:border-indigo-500 cursor-pointer"
                />
              </div>

              <!-- Start & End Time Fields (Range Drag & Custom Time Input) -->
              <div class="mb-4">
                <AppTimeRangePicker
                  v-model:start-time="scheduleTime"
                  v-model:end-time="scheduleEndTime"
                  :blocked-slots="blockedSlotsForDate"
                  :existing-appointments="existingApptSlotsForDate"
                  label="Appointment Time"
                />

                <!-- Time range invalid warning -->
                <div v-if="isTimeRangeInvalid" class="mt-2 text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                  End time must be after start time.
                </div>

                <!-- Blocked time warning -->
                <Transition name="fade-scale">
                  <div
                    v-if="isSelectedTimeBlocked"
                    class="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
                  >
                    <Icon name="material-symbols:block-rounded" class="mt-0.5 shrink-0 text-sm" />
                    <div>
                      <p class="font-bold">This time is blocked</p>
                      <p class="text-red-500 mt-0.5">
                        Blocked on this date: <strong>{{ blockedRangesLabel }}</strong>.
                      </p>
                    </div>
                  </div>
                </Transition>
              </div>

              <!-- Clinic / Location Selector -->
              <div class="mb-4">
                <div class="flex items-center justify-between mb-1.5">
                  <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Clinic / Location</label>
                  <span v-if="wasAutofilled" class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Icon name="heroicons:sparkles" class="w-3 h-3 text-emerald-600" />
                    Autofilled from Duty Preset
                  </span>
                </div>

                <div class="space-y-2">
                  <select
                    v-if="clinics.length > 0"
                    v-model="scheduleLocation"
                    class="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-indigo-500 font-medium text-foreground cursor-pointer"
                  >
                    <option value="" disabled>-- Select a Clinic Location --</option>
                    <option v-for="c in clinics" :key="c.id" :value="c.name">
                      {{ c.name }} {{ c.address ? `(${c.address})` : '' }}
                    </option>
                    <option value="__custom__">+ Other / Custom Location</option>
                  </select>

                  <input
                    v-if="clinics.length === 0 || scheduleLocation === '__custom__'"
                    type="text"
                    v-model="customLocationInput"
                    placeholder="e.g. SkinCare Clinic, Rm 302"
                    class="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div class="mb-6">
                <label class="mb-1.5 block text-xs font-bold text-gray-500 uppercase tracking-wider">Purpose of Appointment</label>
                <textarea
                  v-model="schedulePurpose"
                  rows="2"
                  placeholder="e.g. Follow-up on eczema treatment…"
                  class="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <p v-if="scheduleError" class="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-600">
                {{ scheduleError }}
              </p>

              <div class="mt-auto flex flex-col gap-3">
                <AppButton
                  variant="solid"
                  class="bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 font-bold py-3.5 rounded-2xl shadow-lg"
                  :disabled="!isFormValid || isScheduling"
                  @click="confirmSchedule"
                >
                  {{ isScheduling ? 'Scheduling...' : 'Confirm Schedule' }}
                </AppButton>
                <AppButton
                  variant="unstyled"
                  class="bg-gray-100 text-gray-700 font-bold transition-all hover:bg-gray-200 py-3 rounded-2xl"
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
