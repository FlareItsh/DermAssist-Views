<script setup lang="ts">
import { ref, computed } from 'vue'

const { appointments, selectedDate } = useAppointments()
const baseDate = ref(new Date())

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
  <div class="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
    
    <p class="text-primary text-[10px] font-black uppercase tracking-wider mb-3">Appointment</p>

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
          <span class="text-[9px] font-bold uppercase" :class="selectedDate === day.dateStr ? 'text-primary' : 'text-gray-400'">{{ day.label }}</span>
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all"
            :class="[
              day.hasAppt ? 'bg-primary text-white shadow-md shadow-primary/30' : '',
              day.isToday && !day.hasAppt ? 'border-2 border-primary text-primary' : '',
              !day.hasAppt && !day.isToday && selectedDate === day.dateStr ? 'bg-gray-100 text-gray-700' : '',
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
  </div>
</template>
