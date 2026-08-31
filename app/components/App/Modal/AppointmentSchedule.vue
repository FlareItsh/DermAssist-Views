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
const isScheduling = ref(false)
const errorMessage = ref<string | null>(null)

// Auto-sync end time when start time changes if end time <= start time
watch(scheduleTime, (newStart) => {
  if (!newStart) return
  const [h, m] = newStart.split(':').map(Number)
  const endHour = (h + 1) % 24
  scheduleEndTime.value = `${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

// ─── Appointments & Blocked dates ───────────────────────────────────────────

const { blockedSlots, isTimeRangeBlockedOnDate, isWholeDayBlocked: checkWholeDayBlocked, getBlockedTimesForDate } = useBlockedDates()
const { appointments, isApptTimeConflicting } = useAppointments()

const handleDateSelected = (date: string) => {
  selectedDate.value = date
}

const blockedSlotsForDate = computed(() => {
  if (!selectedDate.value) return []
  return getBlockedTimesForDate(selectedDate.value)
})

const existingApptSlotsForDate = computed(() => {
  if (!selectedDate.value) return []
  return appointments.value
    .filter((appt) => appt.date === selectedDate.value && appt.id !== props.appointmentUuid && appt.raw_scheduled_at)
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

const isApptConflict = computed(() => {
  if (!selectedDate.value || !scheduleTime.value) return false
  return isApptTimeConflicting(selectedDate.value, scheduleTime.value, scheduleEndTime.value, props.appointmentUuid)
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

const confirmSchedule = async () => {
  errorMessage.value = null
  if (!selectedDate.value || !scheduleTime.value || !scheduleEndTime.value || !scheduleLocation.value) return
  if (isSelectedTimeBlocked.value || isTimeRangeInvalid.value || isApptConflict.value) return
  isScheduling.value = true
  try {
    const dateTime = `${selectedDate.value} ${scheduleTime.value}:00`
    const endDateTime = `${selectedDate.value} ${scheduleEndTime.value}:00`

    if (props.mode === 'reschedule') {
      await appointmentService.proposeReschedule(props.appointmentUuid, {
        scheduled_at: dateTime,
        scheduled_end_at: endDateTime,
        location: scheduleLocation.value
      })
    } else {
      await appointmentService.update(props.appointmentUuid, {
        status: 'scheduled',
        scheduled_at: dateTime,
        scheduled_end_at: endDateTime,
        location: scheduleLocation.value
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
              :blocked-slots="blockedSlots"
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

            <div class="mb-8">
              <label class="mb-2 block text-sm font-bold text-gray-500">Clinic / Location</label>
              <input
                type="text"
                v-model="scheduleLocation"
                placeholder="e.g. SkinCare Clinic, Rm 302"
                class="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-indigo-500"
              />
            </div>

            <div class="mt-auto flex flex-col gap-3">
              <AppButton
                variant="solid"
                class="bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
                :disabled="!selectedDate || !scheduleTime || !scheduleEndTime || !scheduleLocation || isScheduling || isSelectedTimeBlocked || isTimeRangeInvalid || isApptConflict"
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
