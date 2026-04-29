<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  appointmentUuid: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'scheduled'): void
}>()

const selectedDate = ref('')
const scheduleTime = ref('09:00')
const scheduleLocation = ref('')
const isScheduling = ref(false)

const handleDateSelected = (date: string) => {
  selectedDate.value = date
}

const confirmSchedule = async () => {
  if (!selectedDate.value || !scheduleTime.value || !scheduleLocation.value) return
  isScheduling.value = true
  try {
    const dateTime = `${selectedDate.value} ${scheduleTime.value}:00`
    await $api(`appointments/${props.appointmentUuid}`, {
      method: 'PUT',
      body: {
        status: 'scheduled',
        scheduled_at: dateTime,
        location: scheduleLocation.value
      }
    })
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
            <PatientSideComponentsCalendar @date-selected="handleDateSelected" />
          </div>

          <!-- Right side: Time & Location -->
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
                :disabled="!selectedDate || !scheduleTime || !scheduleLocation || isScheduling"
                @click="confirmSchedule"
              >
                {{ isScheduling ? 'Scheduling...' : 'Confirm Schedule' }}
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
