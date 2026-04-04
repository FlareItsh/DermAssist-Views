<script setup lang="ts">
  import { ref, computed } from 'vue'

  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const { appointments } = useAppointments()

  const appointmentsMap = computed(() => appointments.value.map(appt => appt.date))

  const currentDate = ref(new Date())

  const currentMonthName = computed(() =>
    currentDate.value.toLocaleString('default', { month: 'long' })
  )
  const currentYear = computed(() => currentDate.value.getFullYear())

  const daysInMonth = computed(() => {
    return new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 0).getDate()
  })

  const startingDayOffset = computed(() => {
    return new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 1).getDay()
  })

  // Helpers
  const prevMonth = () => {
    currentDate.value = new Date(
      currentDate.value.getFullYear(),
      currentDate.value.getMonth() - 1,
      1
    )
  }

  const nextMonth = () => {
    currentDate.value = new Date(
      currentDate.value.getFullYear(),
      currentDate.value.getMonth() + 1,
      1
    )
  }

  const hasAppointment = (day: number) => {
    const year = currentDate.value.getFullYear()
    const month = String(currentDate.value.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    return appointmentsMap.value.includes(`${year}-${month}-${dayStr}`)
  }
</script>

<template>
  <div class="bg-card w-[400px] rounded-3xl border border-gray-100 p-6">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="bg-secondary h-8 w-1 shrink-0 rounded-full"></div>
        <h1 class="text-foreground text-2xl font-bold">Calendar</h1>
      </div>

      <div class="flex gap-2">
        <button
          @click="prevMonth"
          class="hover:bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full transition-colors active:scale-95"
        >
          <Icon
            name="material-symbols:chevron-left-rounded"
            class="text-2xl"
          />
        </button>
        <button
          @click="nextMonth"
          class="hover:bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full transition-colors active:scale-95"
        >
          <Icon
            name="material-symbols:chevron-right-rounded"
            class="text-2xl"
          />
        </button>
      </div>
    </div>

    <h2 class="text-foreground mb-3 text-lg font-bold">{{ currentMonthName }} {{ currentYear }}</h2>

    <div class="grid grid-cols-7 gap-y-4 text-center">
      <div
        v-for="day in daysOfWeek"
        :key="day"
        class="text-[12px] font-bold tracking-wider text-gray-400 uppercase"
      >
        {{ day }}
      </div>

      <div
        v-for="empty in startingDayOffset"
        :key="'empty-' + empty"
      ></div>

      <div
        v-for="date in daysInMonth"
        :key="date"
        class="text-foreground relative flex items-center justify-center text-[15px] font-semibold"
      >
        {{ date }}

        <div
          v-if="hasAppointment(date)"
          class="bg-secondary absolute -bottom-2.5 h-1.5 w-1.5 rounded-full"
        ></div>
      </div>
    </div>
  </div>
</template>
