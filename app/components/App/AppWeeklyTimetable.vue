<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { parseAppointmentDateTime } from '~/composables/useAppointments'

  const props = withDefaults(
    defineProps<{
      compact?: boolean
      showControls?: boolean
    }>(),
    {
      compact: false,
      showControls: true
    }
  )

  const emit = defineEmits<{
    (e: 'select-appointment', appointment: any): void
  }>()

  const { appointments } = useAppointments()
  const { allSlots, fetchBlockedSlots } = useBlockedDates()
  const { clinics, fetchClinics } = useDoctorClinics()
  const { getStorageUrl } = useStorage()

  onMounted(async () => {
    await Promise.all([fetchBlockedSlots(), fetchClinics()])
  })

  // Current week reference date
  const weekOffset = ref(0)
  const selectedClinicId = ref<number | 'all'>('all')

  // Compute 7 days for the displayed week (Monday to Sunday)
  const weekDays = computed(() => {
    const now = new Date()
    const currentDayOfWeek = now.getDay() // 0 is Sunday, 1 is Monday...
    const distanceToMonday = (currentDayOfWeek + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - distanceToMonday + weekOffset.value * 7)
    monday.setHours(0, 0, 0, 0)

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${day}`

      days.push({
        dateStr,
        dateObj: d,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: d.getDate(),
        monthName: d.toLocaleDateString('en-US', { month: 'short' }),
        isToday: dateStr === todayStr
      })
    }
    return days
  })

  const weekRangeLabel = computed(() => {
    if (!weekDays.value.length) return ''
    const first = weekDays.value[0].dateObj
    const last = weekDays.value[6].dateObj
    const firstStr = first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const lastStr = last.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    return `${firstStr} – ${lastStr}`
  })

  const weekAppointmentsCount = computed(() => {
    const dates = new Set(weekDays.value.map(d => d.dateStr))
    return appointments.value.filter(a => {
      const p = parseAppointmentDateTime(a.raw_scheduled_at || a.scheduled_at || a.date)
      const matchDate = dates.has(p.date) || dates.has((a.date || '').slice(0, 10))
      const isScheduled = a.status === 'scheduled' || a.raw_scheduled_at || a.scheduled_at
      return matchDate && isScheduled
    }).length
  })

  // Hours range: 7:00 AM to 8:00 PM (13 hours)
  const hours = Array.from({ length: 14 }, (_, i) => i + 7) // 7 to 20

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h = hour % 12 || 12
    return `${h}:00 ${ampm}`
  }

  // Convert "HH:MM" to minutes from 7:00 AM (0 to 13 * 60 = 780)
  const timeToMinutesFromStart = (timeStr: string) => {
    if (!timeStr) return 0
    const [h, m] = timeStr.split(':').map(Number)
    const totalMins = h * 60 + (m || 0)
    const startMins = 7 * 60 // 7:00 AM
    return Math.max(0, totalMins - startMins)
  }

  const totalDayMinutes = 14 * 60 // 14 hours = 840 mins

  // Filtered Duty Slots for the week
  const getDutySlotsForDay = (dateStr: string) => {
    return allSlots.value
      .filter(s => {
        const matchDate = (s.available_date || '').slice(0, 10) === dateStr
        const isDuty = Number(s.is_available) === 1 || s.is_available === true
        const matchClinic =
          selectedClinicId.value === 'all' || s.clinic_id === selectedClinicId.value
        return matchDate && isDuty && matchClinic
      })
      .map(s => {
        const topMins = timeToMinutesFromStart(s.start_time)
        const durationMins = Math.max(30, timeToMinutesFromStart(s.end_time) - topMins)
        const topPct = (topMins / totalDayMinutes) * 100
        const heightPct = (durationMins / totalDayMinutes) * 100

        return {
          ...s,
          topPct,
          heightPct,
          formattedTime: `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`
        }
      })
  }

  // Filtered Blocked Slots for the week
  const getBlockedSlotsForDay = (dateStr: string) => {
    return allSlots.value
      .filter(s => {
        const matchDate = (s.available_date || '').slice(0, 10) === dateStr
        const isBlocked = Number(s.is_available) === 0 || s.is_available === false
        return matchDate && isBlocked
      })
      .map(s => {
        const topMins = timeToMinutesFromStart(s.start_time)
        const durationMins = Math.max(30, timeToMinutesFromStart(s.end_time) - topMins)
        const topPct = (topMins / totalDayMinutes) * 100
        const heightPct = (durationMins / totalDayMinutes) * 100

        return {
          ...s,
          topPct,
          heightPct,
          isAllDay: s.start_time <= '00:01' && s.end_time >= '23:58',
          formattedTime: `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`
        }
      })
  }

  // Filtered Appointments for the week
  const getAppointmentsForDay = (dateStr: string) => {
    const dayDuties = getDutySlotsForDay(dateStr)

    return appointments.value
      .filter(a => {
        const p = parseAppointmentDateTime(a.raw_scheduled_at || a.scheduled_at || a.date)
        const matchDate = p.date === dateStr || (a.date || '').slice(0, 10) === dateStr
        const isScheduled = a.status === 'scheduled' || a.raw_scheduled_at || a.scheduled_at
        return matchDate && isScheduled
      })
      .map(a => {
        let startTime = '09:00'
        let endTime = '10:00'

        if (a.raw_scheduled_at || a.scheduled_at) {
          const p = parseAppointmentDateTime(a.raw_scheduled_at || a.scheduled_at)
          startTime = `${p.startH}:${p.startM}`
        }
        if (a.raw_scheduled_end_at || a.scheduled_end_at) {
          const p = parseAppointmentDateTime(a.raw_scheduled_end_at || a.scheduled_end_at)
          endTime = `${p.startH}:${p.startM}`
        } else {
          const [h, m] = startTime.split(':').map(Number)
          endTime = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        }

        const topMins = timeToMinutesFromStart(startTime)
        const durationMins = Math.max(30, timeToMinutesFromStart(endTime) - topMins)
        const topPct = (topMins / totalDayMinutes) * 100
        const heightPct = (durationMins / totalDayMinutes) * 100

        // Check if this appointment falls inside any duty shift on this date
        const matchingDuty = dayDuties.find(d => {
          const dutyStart = timeToMinutesFromStart(d.start_time)
          const dutyEnd = timeToMinutesFromStart(d.end_time)
          return topMins >= dutyStart - 5 && topMins + durationMins <= dutyEnd + 5
        })

        // If it starts at or near the top of the duty shift, inset it slightly so duty header stays visible
        const startsAtDutyTop =
          !!matchingDuty && Math.abs(topMins - timeToMinutesFromStart(matchingDuty.start_time)) < 20

        return {
          ...a,
          startTime,
          endTime,
          topPct,
          heightPct,
          isInsideDuty: !!matchingDuty,
          startsAtDutyTop,
          patientName: a.doctor || 'Patient Consultation'
        }
      })
  }

  const goToToday = () => {
    weekOffset.value = 0
  }

  const prevWeek = () => {
    weekOffset.value--
  }

  const nextWeek = () => {
    weekOffset.value++
  }

  const handleApptClick = (appt: any) => {
    emit('select-appointment', appt)
  }
</script>

<template>
  <div
    class="bg-card border-border flex h-full flex-col overflow-hidden rounded-3xl border shadow-xs"
  >
    <!-- Timetable Controls Header -->
    <div
      v-if="showControls"
      class="border-border bg-muted/10 flex flex-col justify-between gap-4 border-b p-4 sm:p-5 md:flex-row md:items-center"
    >
      <!-- Left: Week Navigation -->
      <div class="flex items-center gap-3">
        <div
          class="bg-card border-border flex items-center gap-1 rounded-2xl border p-1 shadow-2xs"
        >
          <button
            @click="prevWeek"
            class="hover:bg-muted/40 text-foreground/70 hover:text-foreground cursor-pointer rounded-xl p-1.5 transition"
            title="Previous Week"
          >
            <Icon
              name="heroicons:chevron-left"
              class="h-4 w-4"
            />
          </button>
          <button
            @click="goToToday"
            class="cursor-pointer rounded-xl px-3 py-1 text-xs font-bold transition"
            :class="
              weekOffset === 0
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-foreground/70 hover:bg-muted/40'
            "
          >
            Today
          </button>
          <button
            @click="nextWeek"
            class="hover:bg-muted/40 text-foreground/70 hover:text-foreground cursor-pointer rounded-xl p-1.5 transition"
            title="Next Week"
          >
            <Icon
              name="heroicons:chevron-right"
              class="h-4 w-4"
            />
          </button>
        </div>

        <div class="flex items-center gap-2.5">
          <h3 class="text-foreground text-sm font-bold sm:text-base">{{ weekRangeLabel }}</h3>
          <span
            v-if="weekAppointmentsCount > 0"
            class="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 shadow-2xs"
          >
            <Icon
              name="lucide:calendar-check"
              class="text-xs text-indigo-600"
            />
            {{ weekAppointmentsCount }} patient{{ weekAppointmentsCount === 1 ? '' : 's' }} booked
          </span>
        </div>
      </div>

      <!-- Right: Legend & Clinic Filter -->
      <div class="flex flex-wrap items-center gap-3 sm:gap-4">
        <!-- Legend Pills -->
        <div class="flex items-center gap-2 text-xs">
          <span
            class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Duty Hours
          </span>
          <span
            class="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
            Booked Patient
          </span>
          <span
            class="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            Away / Blocked
          </span>
        </div>

        <!-- Clinic Filter Dropdown -->
        <select
          v-if="clinics.length > 0"
          v-model="selectedClinicId"
          class="bg-card border-border text-foreground focus:border-primary cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-2xs outline-none"
        >
          <option value="all">All Clinic Branches</option>
          <option
            v-for="c in clinics"
            :key="c.id"
            :value="c.id"
          >
            {{ c.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Timetable Grid Container -->
    <div class="flex-1 overflow-x-auto overflow-y-auto">
      <div class="flex h-full min-w-[800px] flex-col">
        <!-- Weekdays Header Row -->
        <div
          class="border-border bg-card sticky top-0 z-20 grid grid-cols-[70px_repeat(7,1fr)] border-b shadow-2xs"
        >
          <div
            class="text-muted-foreground border-border/60 border-r p-3 text-center text-[11px] font-bold tracking-wider uppercase"
          >
            Time
          </div>
          <div
            v-for="day in weekDays"
            :key="day.dateStr"
            class="border-border/60 border-r p-2.5 text-center transition-colors last:border-r-0 sm:p-3"
            :class="day.isToday ? 'bg-primary/5' : ''"
          >
            <span
              class="block text-[11px] font-bold tracking-wider uppercase"
              :class="day.isToday ? 'text-primary' : 'text-muted-foreground'"
            >
              {{ day.dayName }}
            </span>
            <span
              class="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              :class="
                day.isToday ? 'bg-primary text-primary-foreground shadow-xs' : 'text-foreground'
              "
            >
              {{ day.dayNumber }}
            </span>
          </div>
        </div>

        <!-- Timetable Body Rows -->
        <div class="relative grid min-h-[700px] flex-1 grid-cols-[70px_repeat(7,1fr)]">
          <!-- Left Time Column -->
          <div class="border-border/60 bg-muted/5 flex flex-col border-r">
            <div
              v-for="h in hours"
              :key="h"
              class="border-border/40 text-muted-foreground h-14 border-b px-1 pt-1 pr-2 text-right text-[11px] font-medium select-none sm:h-16"
            >
              {{ formatHour(h) }}
            </div>
          </div>

          <!-- 7 Day Columns with Slots -->
          <div
            v-for="day in weekDays"
            :key="day.dateStr"
            class="border-border/40 relative border-r last:border-r-0"
            :class="day.isToday ? 'bg-primary/[0.02]' : ''"
          >
            <!-- Background Hourly Grid Lines -->
            <div
              v-for="h in hours"
              :key="h"
              class="border-border/40 h-14 border-b sm:h-16"
            ></div>

            <!-- Layer 1: Duty Shifts (Green zone) -->
            <div
              v-for="duty in getDutySlotsForDay(day.dateStr)"
              :key="duty.uuid"
              class="absolute right-1 left-1 z-5 overflow-hidden rounded-2xl border border-emerald-200/90 bg-emerald-50/90 p-2 shadow-2xs transition hover:shadow-xs"
              :style="{ top: `${duty.topPct}%`, height: `${duty.heightPct}%` }"
            >
              <div class="flex items-center gap-1.5 text-emerald-800">
                <Icon
                  name="heroicons:building-office-2"
                  class="h-3.5 w-3.5 shrink-0 text-emerald-600"
                />
                <span class="truncate text-[11px] leading-tight font-bold">
                  {{ duty.clinic?.name || duty.location_name || 'Clinic Duty' }}
                </span>
              </div>
              <p class="mt-0.5 truncate text-[10px] font-medium text-emerald-700">
                {{ duty.formattedTime }}
              </p>
            </div>

            <!-- Layer 2: Blocked / Away Slots (Red / Pattern zone) -->
            <div
              v-for="blocked in getBlockedSlotsForDay(day.dateStr)"
              :key="blocked.uuid"
              class="absolute right-1 left-1 z-6 overflow-hidden rounded-2xl border border-rose-200/90 bg-rose-50/90 p-2 shadow-2xs"
              :style="{ top: `${blocked.topPct}%`, height: `${blocked.heightPct}%` }"
            >
              <div class="flex items-center gap-1.5 text-rose-800">
                <Icon
                  name="heroicons:no-symbol"
                  class="h-3.5 w-3.5 shrink-0 text-rose-600"
                />
                <span class="truncate text-[11px] leading-tight font-bold">
                  {{ blocked.location_name || 'Blocked / Away' }}
                </span>
              </div>
              <p class="mt-0.5 truncate text-[10px] font-medium text-rose-700">
                {{ blocked.isAllDay ? 'All Day Off-Duty' : blocked.formattedTime }}
              </p>
            </div>

            <!-- Layer 3: Booked Patient Appointments (Rendered inside duty zone) -->
            <div
              v-for="appt in getAppointmentsForDay(day.dateStr)"
              :key="appt.id || appt.uuid"
              @click="handleApptClick(appt)"
              class="absolute z-10 cursor-pointer overflow-hidden rounded-xl border border-indigo-400/50 bg-indigo-600 p-2 text-white shadow-md transition-all hover:scale-[1.02] hover:bg-indigo-700"
              :class="
                appt.isInsideDuty
                  ? 'right-2.5 left-2.5 ring-2 ring-emerald-500/40'
                  : 'right-1.5 left-1.5'
              "
              :style="{
                top: appt.startsAtDutyTop
                  ? `calc(${appt.topPct}% + 28px)`
                  : `calc(${appt.topPct}% + 2px)`,
                height: appt.startsAtDutyTop
                  ? `calc(${appt.heightPct}% - 30px)`
                  : `calc(${appt.heightPct}% - 4px)`,
                minHeight: '36px'
              }"
            >
              <div class="flex items-center justify-between gap-1">
                <div class="flex min-w-0 items-center gap-1.5">
                  <div
                    class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold"
                  >
                    {{ (appt.patientName || 'P')[0] }}
                  </div>
                  <span class="truncate text-[11px] leading-tight font-bold">
                    {{ appt.patientName }}
                  </span>
                </div>
                <Icon
                  name="heroicons:chat-bubble-left-right"
                  class="h-3.5 w-3.5 shrink-0 opacity-80"
                />
              </div>

              <div
                class="mt-0.5 flex items-center justify-between text-[9px] font-medium text-indigo-100"
              >
                <span>{{ appt.startTime }} - {{ appt.endTime }}</span>
                <span
                  v-if="appt.location"
                  class="max-w-[80px] truncate opacity-90"
                  >📍 {{ appt.location }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
