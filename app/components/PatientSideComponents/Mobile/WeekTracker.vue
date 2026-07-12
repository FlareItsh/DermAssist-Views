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
</script>

<template>
  <div class="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
    
    <p class="text-primary text-[10px] font-black uppercase tracking-wider mb-3">Appointment</p>

    <!-- Week Day Tracker -->
    <div class="flex items-center justify-between gap-1">
      <!-- Prev week chevron button -->
      <button @click="prevWeek" class="text-gray-400 hover:text-primary transition-colors shrink-0 p-1">
        <Icon name="heroicons:chevron-left-20-solid" size="18" />
      </button>

      <!-- Scrollable row of 7 days -->
      <div class="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory flex-1 justify-between">
        <div
          v-for="day in weekDays"
          :key="day.dateStr"
          @click="toggleSelectDate(day.dateStr)"
          class="flex flex-col items-center gap-1 shrink-0 w-11 snap-start cursor-pointer"
        >
          <span class="text-[9px] font-bold uppercase" :class="selectedDate === day.dateStr ? 'text-primary' : 'text-gray-400'">{{ day.label }}</span>
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all"
            :class="[
              selectedDate === day.dateStr ? 'bg-primary text-white shadow-md shadow-primary/30' : '',
              day.hasAppt && selectedDate !== day.dateStr ? 'bg-primary/10 text-primary font-black' : '',
              day.isToday && selectedDate !== day.dateStr ? 'border-2 border-primary text-primary' : '',
              !day.hasAppt && !day.isToday && selectedDate !== day.dateStr ? 'text-gray-500' : ''
            ]"
          >
            {{ day.num }}
          </div>
          <!-- Dot for today -->
          <div
            class="h-1 w-1 rounded-full"
            :class="day.isToday ? 'bg-primary' : 'bg-transparent'"
          ></div>
        </div>
      </div>

      <!-- Next week chevron button -->
      <button @click="nextWeek" class="text-gray-400 hover:text-primary transition-colors shrink-0 p-1">
        <Icon name="heroicons:chevron-right-20-solid" size="18" />
      </button>
    </div>
  </div>
</template>
