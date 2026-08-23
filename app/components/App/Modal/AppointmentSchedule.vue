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

const selectedDate = ref('')
const scheduleTime = ref('09:00')
const scheduleLocation = ref('')
const isScheduling = ref(false)

// ─── Blocked dates ───────────────────────────────────────────────────────────

const { blockedSlots, isTimeBlockedOnDate, isWholeDayBlocked: checkWholeDayBlocked, getBlockedTimesForDate } = useBlockedDates()

const handleDateSelected = (date: string) => {
  selectedDate.value = date
}

/**
 * True when the currently selected date+time falls inside a blocked slot.
 */
const isSelectedTimeBlocked = computed(() => {
  if (!selectedDate.value || !scheduleTime.value) return false
  return isTimeBlockedOnDate(selectedDate.value, scheduleTime.value)
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
  if (!selectedDate.value || !scheduleTime.value || !scheduleLocation.value) return
  if (isSelectedTimeBlocked.value) return
  isScheduling.value = true
  try {
    const dateTime = `${selectedDate.value} ${scheduleTime.value}:00`

    if (props.mode === 'reschedule') {
      await appointmentService.proposeReschedule(props.appointmentUuid, {
        scheduled_at: dateTime,
        location: scheduleLocation.value
      })
    } else {
      await appointmentService.update(props.appointmentUuid, {
        status: 'scheduled',
        scheduled_at: dateTime,
        location: scheduleLocation.value
      })
    }

    emit('scheduled')
    emit('close')
  } catch (e) {
    console.error(e)
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
              @date-selected="handleDateSelected"
            />
          </div>

          <!-- Right side: Time & Location -->
          <div class="bg-foreground/5 flex flex-col justify-center p-8 lg:w-80">
            <h3 class="mb-6 text-2xl font-bold">
              {{ props.mode === 'reschedule' ? 'Reschedule Appointment' : 'Schedule Appointment' }}
            </h3>

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
                class="w-full rounded-xl border p-3 outline-none transition-all focus:border-indigo-500"
                :class="isSelectedTimeBlocked ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'"
              />

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
                :disabled="!selectedDate || !scheduleTime || !scheduleLocation || isScheduling || isSelectedTimeBlocked"
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
