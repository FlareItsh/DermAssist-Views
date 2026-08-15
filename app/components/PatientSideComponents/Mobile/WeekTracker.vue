<script setup lang="ts">
import { ref, computed } from 'vue'
import { onClickOutside } from '@vueuse/core'

const { appointments, selectedDate } = useAppointments()
const baseDate = ref(new Date())
const trackerRef = ref<HTMLElement | null>(null)
const router = useRouter()

onClickOutside(trackerRef, () => {
  selectedDate.value = null
})

const prevWeek = () => {
  const d = new Date(baseDate.value)
  d.setDate(d.getDate() - 7)
  baseDate.value = d
}

const nextWeek = () => {
  const d = new Date(baseDate.value)
  d.setDate(d.getDate() + 7)
  baseDate.value = d
}

const toggleSelectDate = (dateStr: string) => {
  if (selectedDate.value === dateStr) {
    selectedDate.value = null
  } else {
    selectedDate.value = dateStr
  }
}

const closePanel = () => {
  selectedDate.value = null
}

const selectedDayAppointments = computed(() => {
  if (!selectedDate.value) return []
  return appointments.value.filter(a => a.date === selectedDate.value)
})

const selectedDayLabel = computed(() => {
  if (!selectedDate.value) return ''
  const d = new Date(selectedDate.value + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
})

const goToChat = (conversationUuid: string | undefined) => {
  if (!conversationUuid) return
  selectedDate.value = null
  router.push(`/Patient/Messages/${conversationUuid}`)
}

const weekDays = computed(() => {
  const today = new Date()
  const targetBase = baseDate.value
  const dow = targetBase.getDay()
  const start = new Date(targetBase)
  start.setDate(targetBase.getDate() + (dow === 0 ? -6 : 1 - dow))

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    return {
      label: labels[i],
      num: d.getDate(),
      dateStr,
      isToday: d.toDateString() === today.toDateString(),
      hasAppt: appointments.value.some(a => a.date === dateStr)
    }
  })
})
const visibleWeekStart = computed(() => {
  if (weekDays.value.length === 0) return new Date()
  const firstDay = new Date(weekDays.value[0].dateStr)
  firstDay.setHours(0, 0, 0, 0)
  return firstDay
})

const visibleWeekEnd = computed(() => {
  if (weekDays.value.length === 0) return new Date()
  const lastDay = new Date(weekDays.value[6].dateStr)
  lastDay.setHours(23, 59, 59, 999)
  return lastDay
})

const hasApptsBefore = computed(() => {
  const start = visibleWeekStart.value
  return appointments.value.some(appt => {
    if (!appt.date) return false
    const apptDate = new Date(appt.date)
    return apptDate < start
  })
})

const hasApptsAfter = computed(() => {
  const end = visibleWeekEnd.value
  return appointments.value.some(appt => {
    if (!appt.date) return false
    const apptDate = new Date(appt.date)
    return apptDate > end
  })
})
</script>

<template>
  <div ref="trackerRef" class="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
    
    <div class="flex items-center justify-between">
      <p class="text-primary text-[10px] font-black uppercase tracking-wider">Appointment Schedule</p>
      <span v-if="selectedDate" class="text-xs font-bold text-gray-500">{{ selectedDayLabel }}</span>
    </div>

    <!-- Week Day Tracker -->
    <div class="flex items-center justify-between gap-1">
      <!-- Prev week chevron button -->
      <button @click="prevWeek" class="text-gray-400 hover:text-primary transition-colors shrink-0 p-1 relative">
        <Icon name="heroicons:chevron-left-20-solid" size="18" />
        <span v-if="hasApptsBefore" class="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
      </button>

      <!-- Row of 7 days (non-scrollable, fits on screen) -->
      <div class="flex items-center gap-1.5 overflow-hidden flex-1 justify-between">
        <div
          v-for="day in weekDays"
          :key="day.dateStr"
          @click="toggleSelectDate(day.dateStr)"
          class="flex flex-col items-center gap-1 shrink-0 w-8 cursor-pointer"
        >
          <span class="text-[9px] font-bold uppercase" :class="selectedDate === day.dateStr ? 'text-primary font-black' : 'text-gray-400'">{{ day.label }}</span>
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all"
            :class="[
              day.hasAppt ? 'bg-primary text-white shadow-md shadow-primary/30' : '',
              day.isToday && !day.hasAppt ? 'border-2 border-primary text-primary' : '',
              !day.hasAppt && !day.isToday && selectedDate === day.dateStr ? 'bg-gray-100 text-gray-700 ring-2 ring-primary/30' : '',
              !day.hasAppt && !day.isToday && selectedDate !== day.dateStr ? 'text-gray-500' : ''
            ]"
          >
            {{ day.num }}
          </div>
          <!-- Indicator dots -->
          <div class="flex gap-0.5 h-1.5 items-center justify-center">
            <div
              v-if="day.isToday"
              class="h-1 w-1 rounded-full bg-primary"
            ></div>
            <div
              v-if="day.hasAppt"
              class="h-1 w-1 rounded-full bg-amber-500"
            ></div>
          </div>
        </div>
      </div>

      <!-- Next week chevron button -->
      <button @click="nextWeek" class="text-gray-400 hover:text-primary transition-colors shrink-0 p-1 relative">
        <Icon name="heroicons:chevron-right-20-solid" size="18" />
        <span v-if="hasApptsAfter" class="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
      </button>
    </div>

    <!-- Inline Expanded Section — extends downward when a date is selected -->
    <Transition name="expand-down">
      <div v-if="selectedDate" class="border-t border-gray-100 pt-3 mt-1 flex flex-col gap-2">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5 text-xs font-bold text-gray-700">
            <Icon name="material-symbols:event-available-rounded" class="text-primary text-base" />
            <span>{{ selectedDayLabel }}</span>
          </div>
          <button @click="closePanel" class="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
            <Icon name="material-symbols:close-rounded" class="text-base" />
          </button>
        </div>

        <div v-if="selectedDayAppointments.length === 0" class="py-3 text-center text-xs text-gray-400 font-semibold bg-gray-50 rounded-2xl border border-gray-100">
          No appointments for this date
        </div>

        <div v-else class="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
          <div
            v-for="appt in selectedDayAppointments"
            :key="appt.id"
            @click="goToChat(appt.conversation_uuid)"
            class="flex flex-col gap-2 p-3 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] rounded-2xl border border-primary/10 transition-all cursor-pointer"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <div class="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name="material-symbols:stethoscope-rounded" class="text-sm" />
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-bold text-gray-900 truncate">{{ appt.doctor }}</p>
                  <p class="text-[10px] font-semibold text-primary uppercase tracking-wide truncate">{{ appt.info }}</p>
                </div>
              </div>
              <Icon name="material-symbols:arrow-forward-rounded" class="text-gray-400 text-sm shrink-0" />
            </div>

            <div class="flex flex-wrap gap-2 text-[11px] font-medium text-gray-600 bg-white/70 rounded-xl p-2 border border-gray-100">
              <div v-if="appt.time" class="flex items-center gap-1">
                <Icon name="material-symbols:schedule-rounded" class="text-primary text-xs shrink-0" />
                <span>{{ appt.time }}</span>
              </div>
              <div v-if="appt.location" class="flex items-center gap-1 truncate">
                <Icon name="material-symbols:location-on-rounded" class="text-primary text-xs shrink-0" />
                <span class="truncate">{{ appt.location }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.expand-down-enter-active,
.expand-down-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.expand-down-enter-from,
.expand-down-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-4px);
}

.expand-down-enter-to,
.expand-down-leave-from {
  opacity: 1;
  max-height: 300px;
}
</style>

