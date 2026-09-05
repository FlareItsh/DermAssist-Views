<script setup lang="ts">
import { ref, computed } from 'vue'
import { appointmentService } from '~/api/appointment/AppointmentService'

const props = withDefaults(defineProps<{
  appointmentUuid: string
  mode?: 'schedule' | 'reschedule'
}>(), {
  mode: 'schedule'
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'scheduled'): void
}>()

const userRole = useCookie('user_role')
const isDoctor = computed(() => userRole.value === 'doctor')

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
const isScheduling = ref(false)
const errorMessage = ref<string | null>(null)
const wasAutofilled = ref(false)

const { clinics, fetchClinics } = useDoctorClinics()
const doctorBookedAppts = ref<any[]>([])
const currentAppointmentData = ref<any>(null)

// ─── Appointments & Blocked dates ───────────────────────────────────────────

const {
  blockedSlots,
  dutySlots,
  isTimeRangeBlockedOnDate,
  isWholeDayBlocked: checkWholeDayBlocked,
  getBlockedTimesForDate,
  getDutySlotsForDate,
  getDutyClinicForDateAndTime,
  hasDutyOnDate,
  isTimeRangeWithinDutyHours,
  getDutyRangesLabel,
  findEarliestAvailableSlot,
  fetchBlockedSlotsForDoctor,
} = useBlockedDates()
const { appointments, isApptTimeConflicting, fetchAppointmentsForDoctor } = useAppointments()

onMounted(async () => {
  await fetchClinics()

  if (props.appointmentUuid) {
    try {
      const appt = await appointmentService.show(props.appointmentUuid)
      if (appt) {
        currentAppointmentData.value = appt
        const docUuid = appt.doctor?.uuid
        const docId = appt.doctor_id

        if (docUuid) {
          await fetchBlockedSlotsForDoctor(docUuid)
        }
        if (docId) {
          const docAppts = await fetchAppointmentsForDoctor(docId)
          if (docAppts && docAppts.length > 0) {
            doctorBookedAppts.value = docAppts
          }
        }

        if (appt.scheduled_at) {
          const p = parseAppointmentDateTime(appt.scheduled_at)
          selectedDate.value = p.date
        } else if (!selectedDate.value) {
          selectedDate.value = getTodayStr()
        }
      }
    } catch (e) {
      console.error('Failed to load target doctor schedule details:', e)
    }
  }

  if (selectedDate.value) {
    handleDateSelected(selectedDate.value)
  }
})

// Auto-sync end time when start time changes if end time <= start time
watch(scheduleTime, (newStart) => {
  if (!newStart) return
  const [h, m] = newStart.split(':').map(Number)
  const endHour = (h + 1) % 24
  scheduleEndTime.value = `${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const effectiveAppointmentsList = computed(() => {
  if (doctorBookedAppts.value.length > 0) {
    return doctorBookedAppts.value
  }
  return appointments.value
})

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

const dutySlotsForDate = computed(() => {
  if (!selectedDate.value) return []
  return getDutySlotsForDate(selectedDate.value)
})

const existingApptSlotsForDate = computed(() => {
  if (!selectedDate.value) return []
  return effectiveAppointmentsList.value
    .filter((appt) => {
      const p = parseAppointmentDateTime(appt.raw_scheduled_at || appt.scheduled_at || appt.date)
      return p.date === selectedDate.value && appt.id !== props.appointmentUuid && (appt.raw_scheduled_at || appt.scheduled_at)
    })
    .map((appt) => {
      const startP = parseAppointmentDateTime(appt.raw_scheduled_at || appt.scheduled_at)
      let endH = String((Number(startP.startH) + 1) % 24).padStart(2, '0')
      let endM = startP.startM
      const rawEnd = appt.raw_scheduled_end_at || appt.scheduled_end_at
      if (rawEnd) {
        const endP = parseAppointmentDateTime(rawEnd)
        endH = endP.startH
        endM = endP.startM
      }

      return {
        start_time: `${startP.startH}:${startP.startM}`,
        end_time: `${endH}:${endM}`,
        label: appt.doctor || 'Booked Patient'
      }
    })
})

const handleDateSelected = (date: string) => {
  selectedDate.value = date

  // Smart-default to the earliest conflict-free slot on this date:
  // Must be strictly within duty hours, not blocked, and not overlapping existing appointments
  const earliestSlot = findEarliestAvailableSlot(date, 60, existingApptSlotsForDate.value)
  if (earliestSlot) {
    scheduleTime.value = earliestSlot.start
    scheduleEndTime.value = earliestSlot.end
  } else {
    // If no 1-hour slot fits, fallback to earliest duty start time
    const dayDuties = getDutySlotsForDate(date)
    if (dayDuties.length > 0) {
      scheduleTime.value = dayDuties[0].start_time.slice(0, 5)
    }
  }
}

/**
 * True when the doctor has no duty hours scheduled on this date.
 */
const hasNoDutyOnDate = computed(() => {
  if (!selectedDate.value) return false
  return !hasDutyOnDate(selectedDate.value)
})

/**
 * True when the selected time range is outside the doctor's duty hours.
 */
const isOutsideDutyHours = computed(() => {
  if (!selectedDate.value || !scheduleTime.value || !scheduleEndTime.value) return false
  return !isTimeRangeWithinDutyHours(selectedDate.value, scheduleTime.value, scheduleEndTime.value)
})

/**
 * Human-readable label for doctor's duty hours on the selected date.
 */
const dutyRangesLabel = computed(() => {
  if (!selectedDate.value) return ''
  return getDutyRangesLabel(selectedDate.value)
})

/**
 * True when the currently selected date+time range overlaps a blocked slot.
 */
const isSelectedTimeBlocked = computed(() => {
  if (!selectedDate.value || !scheduleTime.value || !scheduleEndTime.value) return false
  return isTimeRangeBlockedOnDate(selectedDate.value, scheduleTime.value, scheduleEndTime.value)
})

const isApptConflict = computed(() => {
  if (!selectedDate.value || !scheduleTime.value) return false
  return isApptTimeConflicting(
    selectedDate.value,
    scheduleTime.value,
    scheduleEndTime.value,
    props.appointmentUuid,
    effectiveAppointmentsList.value
  )
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

const effectiveLocation = computed(() => {
  if (scheduleLocation.value === '__custom__') {
    return customLocationInput.value.trim()
  }
  return scheduleLocation.value.trim()
})

const confirmSchedule = async () => {
  errorMessage.value = null
  if (!selectedDate.value || !scheduleTime.value || !scheduleEndTime.value || !effectiveLocation.value) return
  if (isSelectedTimeBlocked.value || isTimeRangeInvalid.value || isApptConflict.value || isOutsideDutyHours.value || hasNoDutyOnDate.value) return
  isScheduling.value = true
  try {
    const dateTime = `${selectedDate.value} ${scheduleTime.value}:00`
    const endDateTime = `${selectedDate.value} ${scheduleEndTime.value}:00`

    if (props.mode === 'reschedule') {
      await appointmentService.proposeReschedule(props.appointmentUuid, {
        scheduled_at: dateTime,
        scheduled_end_at: endDateTime,
        location: effectiveLocation.value
      })
    } else {
      await appointmentService.update(props.appointmentUuid, {
        status: 'scheduled',
        scheduled_at: dateTime,
        scheduled_end_at: endDateTime,
        location: effectiveLocation.value
      })
    }

    emit('scheduled')
    emit('close')
  } catch (e: any) {
    errorMessage.value = e.data?.message || e.message || 'Failed to schedule appointment.'
  } finally {
    isScheduling.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        class="bg-foreground/40 fixed inset-0 z-[1000] flex items-center justify-center p-4"
        @click.self="emit('close')"
      >
        <div class="bg-card border-border flex max-h-[90vh] flex-col overflow-y-auto rounded-3xl border shadow-2xl lg:flex-row">
          <!-- Left side: Calendar -->
          <div class="p-6">
            <PatientSideComponentsCalendar
              :selected-date="selectedDate"
              :blocked-slots="blockedSlots"
              :duty-slots="dutySlots"
              :show-manage-blocks-link="true"
              :show-appointment-details-panel="!isDoctor"
              @date-selected="handleDateSelected"
            />
          </div>

          <!-- Right side: Time & Location -->
          <div class="bg-foreground/5 flex flex-col justify-center p-8 w-[95vw] max-w-2xl lg:w-[34rem]">
            <h3 class="mb-6 text-2xl font-bold">
              {{ props.mode === 'reschedule' ? 'Reschedule Appointment' : 'Schedule Appointment' }}
            </h3>

            <div class="mb-4">
              <label class="mb-2 block text-sm font-bold text-gray-500">Selected Date</label>
              <div class="rounded-xl border border-gray-200 bg-white p-3 font-semibold text-indigo-600">
                {{ selectedDate || 'Please select a date from the calendar' }}
              </div>
            </div>

            <!-- Start & End Time Fields (Range Drag & Custom Time Input) -->
            <div class="mb-4">
              <AppTimeRangePicker
                v-model:start-time="scheduleTime"
                v-model:end-time="scheduleEndTime"
                :blocked-slots="blockedSlotsForDate"
                :duty-slots="dutySlotsForDate"
                :existing-appointments="existingApptSlotsForDate"
                label="Appointment Time"
              />

              <!-- Time range invalid warning -->
              <div v-if="isTimeRangeInvalid" class="mt-2 text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                End time must be after start time.
              </div>

              <!-- Conflicting Appointment Warning -->
              <Transition name="fade-scale">
                <div
                  v-if="isApptConflict"
                  class="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
                >
                  <Icon name="material-symbols:warning-rounded" class="mt-0.5 shrink-0 text-sm" />
                  <div>
                    <p class="font-bold">Conflicting Appointment</p>
                    <p class="text-red-500 mt-0.5">
                      An appointment is already scheduled during this time slot. Please choose a different time.
                    </p>
                  </div>
                </div>
              </Transition>

              <!-- Conflict / Error Alert -->
              <div v-if="errorMessage" class="mt-2 text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200 flex items-start gap-1.5">
                <Icon name="material-symbols:warning-rounded" class="text-base text-red-500 shrink-0 mt-0.5" />
                <span>{{ errorMessage }}</span>
              </div>

              <!-- Off-duty warning (Doctor has no duty hours on this date) -->
              <Transition name="fade-scale">
                <div
                  v-if="selectedDate && hasNoDutyOnDate"
                  class="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
                >
                  <Icon name="material-symbols:block-rounded" class="mt-0.5 shrink-0 text-sm" />
                  <div>
                    <p class="font-bold">Doctor is Off-Duty on this date</p>
                    <p class="text-red-500 mt-0.5">
                      The doctor has no scheduled duty hours on this date. Please select an available date from the calendar.
                    </p>
                  </div>
                </div>
              </Transition>

              <!-- Outside duty hours warning -->
              <Transition name="fade-scale">
                <div
                  v-if="selectedDate && !hasNoDutyOnDate && isOutsideDutyHours"
                  class="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
                >
                  <Icon name="material-symbols:warning-rounded" class="mt-0.5 shrink-0 text-sm" />
                  <div>
                    <p class="font-bold">Outside Doctor's Duty Hours</p>
                    <p class="text-red-500 mt-0.5">
                      Appointments must be scheduled during active duty hours on this date: <strong>{{ dutyRangesLabel }}</strong>.
                    </p>
                  </div>
                </div>
              </Transition>

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
                      Please choose a different time.
                    </p>
                  </div>
                </div>
              </Transition>

              <!-- Partial block info (date has blocks but selected time is fine) -->
              <Transition name="fade-scale">
                <div
                  v-if="selectedDate && blockedRangesLabel && !isSelectedTimeBlocked"
                  class="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700"
                >
                  <Icon name="material-symbols:warning-rounded" class="mt-0.5 shrink-0 text-sm" />
                  <p>
                    <span class="font-bold">Note:</span>
                    This date has blocked periods: <strong>{{ blockedRangesLabel }}</strong>.
                  </p>
                </div>
              </Transition>
            </div>

            <!-- Clinic / Location Selector -->
            <div class="mb-8">
              <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-bold text-gray-500">Clinic / Location</label>
                <span v-if="wasAutofilled" class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Icon name="heroicons:sparkles" class="w-3 h-3 text-emerald-600" />
                  Autofilled from Duty Preset
                </span>
              </div>

              <div class="space-y-2">
                <select
                  v-if="clinics.length > 0"
                  v-model="scheduleLocation"
                  class="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-indigo-500 text-sm font-medium text-foreground cursor-pointer"
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
                  class="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-indigo-500 text-sm"
                />
              </div>
            </div>

            <div class="mt-auto flex flex-col gap-3">
              <AppButton
                variant="solid"
                class="bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
                :disabled="!selectedDate || !scheduleTime || !scheduleEndTime || !effectiveLocation || isScheduling || isSelectedTimeBlocked || isTimeRangeInvalid || isApptConflict || isOutsideDutyHours || hasNoDutyOnDate"
                @click="confirmSchedule"
              >
                <template v-if="isScheduling">
                  {{ props.mode === 'reschedule' ? 'Rescheduling...' : 'Scheduling...' }}
                </template>
                <template v-else>
                  {{ props.mode === 'reschedule' ? 'Confirm Reschedule' : 'Confirm Schedule' }}
                </template>
              </AppButton>
              <AppButton
                variant="unstyled"
                class="bg-foreground/5 text-foreground/70 font-bold transition-all hover:bg-foreground/10"
                @click="emit('close')"
              >
                Cancel
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
