<script setup lang="ts">
  import { ref, computed } from 'vue'

  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const props = withDefaults(defineProps<{
    /** Earliest selectable date in YYYY-MM-DD format. Defaults to today. */
    minDate?: string
  }>(), {
    minDate: () => {
      const d = new Date()
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  })

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

  /** Returns the YYYY-MM-DD string for a given day in the currently displayed month. */
  const dateStringFor = (day: number): string => {
    const year = currentDate.value.getFullYear()
    const month = String(currentDate.value.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}-${String(day).padStart(2, '0')}`
  }

  /** True when the displayed day is before the minDate. */
  const isPast = (day: number): boolean => dateStringFor(day) < props.minDate

  /** True when the displayed day is today exactly. */
  const isToday = (day: number): boolean => dateStringFor(day) === props.minDate

  /** Whether the "prev month" button should be disabled (can't go before the min month). */
  const isPrevMonthDisabled = computed(() => {
    const min = new Date(props.minDate)
    return (
      currentDate.value.getFullYear() < min.getFullYear() ||
      (currentDate.value.getFullYear() === min.getFullYear() &&
        currentDate.value.getMonth() <= min.getMonth())
    )
  })

  const hasAppointment = (day: number) => appointmentsMap.value.includes(dateStringFor(day))

  const prevMonth = () => {
    if (isPrevMonthDisabled.value) return
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

  const emit = defineEmits(['dateSelected'])

  const selectDate = (day: number) => {
    if (isPast(day)) return
    emit('dateSelected', dateStringFor(day))
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
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          @click="prevMonth"
          :disabled="isPrevMonthDisabled"
          class="flex h-8 w-8 items-center justify-center rounded-full transition-colors active:scale-95"
          :class="isPrevMonthDisabled ? 'cursor-not-allowed opacity-25' : 'hover:bg-primary/10'"
        >
          <Icon
            name="material-symbols:chevron-left-rounded"
            class="text-2xl"
          />
        </AppButton>
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          @click="nextMonth"
          class="hover:bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full transition-colors active:scale-95"
        >
          <Icon
            name="material-symbols:chevron-right-rounded"
            class="text-2xl"
          />
        </AppButton>
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
        @click="selectDate(date)"
        class="relative flex h-8 w-8 items-center justify-center place-self-center rounded-full text-[15px] font-semibold transition-colors"
        :class="[
          isPast(date)
            ? 'pointer-events-none text-gray-300 line-through'
            : isToday(date)
              ? 'cursor-pointer text-primary ring-2 ring-primary/40 hover:bg-primary/10'
              : 'text-foreground cursor-pointer hover:bg-primary/10'
        ]"
      >
        {{ date }}

        <div
          v-if="hasAppointment(date) && !isPast(date)"
          class="bg-secondary absolute -bottom-1 h-1 w-1 rounded-full"
        ></div>
      </div>
    </div>
  </div>
</template>
