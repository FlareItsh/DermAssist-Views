<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  compact?: boolean
  showControls?: boolean
}>(), {
  compact: false,
  showControls: true
})

const emit = defineEmits<{
  (e: 'select-appointment', appointment: any): void
}>()

const { appointments } = useAppointments()
const { allSlots, fetchBlockedSlots } = useBlockedDates()
const { clinics, fetchClinics } = useDoctorClinics()
const { getStorageUrl } = useStorage()

onMounted(async () => {
  await Promise.all([
    fetchBlockedSlots(),
    fetchClinics()
  ])
})

// Current week reference date
const weekOffset = ref(0)
const selectedClinicId = ref<number | 'all'>('all')

const startOfWeek = computed(() => {
  const now = new Date()
  const day = now.getDay() // 0 = Sunday, 1 = Monday...
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday as start of week
  const monday = new Date(now.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() + (weekOffset.value * 7))
  return monday
})

const weekDays = computed(() => {
  const days = []
  const start = new Date(startOfWeek.value)
  const todayStr = new Date().toISOString().split('T')[0]

  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
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
  const lastStr = last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${firstStr} – ${lastStr}`
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
  const totalMins = (h * 60) + (m || 0)
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
      const matchClinic = selectedClinicId.value === 'all' || s.clinic_id === selectedClinicId.value
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
  return appointments.value
    .filter(a => {
      const matchDate = (a.date || '').slice(0, 10) === dateStr
      const isScheduled = a.status === 'scheduled' || a.raw_scheduled_at
      return matchDate && isScheduled
    })
    .map(a => {
      let startTime = '09:00'
      let endTime = '10:00'

      if (a.raw_scheduled_at) {
        const d = new Date(a.raw_scheduled_at.replace(/Z|(\+\d{2}:\d{2})$/i, ''))
        startTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }
      if (a.raw_scheduled_end_at) {
        const d = new Date(a.raw_scheduled_end_at.replace(/Z|(\+\d{2}:\d{2})$/i, ''))
        endTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      } else {
        const [h, m] = startTime.split(':').map(Number)
        endTime = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }

      const topMins = timeToMinutesFromStart(startTime)
      const durationMins = Math.max(30, timeToMinutesFromStart(endTime) - topMins)
      const topPct = (topMins / totalDayMinutes) * 100
      const heightPct = (durationMins / totalDayMinutes) * 100

      return {
        ...a,
        startTime,
        endTime,
        topPct,
        heightPct,
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
  if (appt.conversation_uuid) {
    navigateTo(`/Doctor/Messages/${appt.conversation_uuid}`)
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-card rounded-3xl border border-border overflow-hidden shadow-xs">
    <!-- Timetable Controls Header -->
    <div v-if="showControls" class="p-4 sm:p-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/10">
      <!-- Left: Week Navigation -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1 bg-card border border-border rounded-2xl p-1 shadow-2xs">
          <button
            @click="prevWeek"
            class="p-1.5 rounded-xl hover:bg-muted/40 text-foreground/70 hover:text-foreground transition cursor-pointer"
            title="Previous Week"
          >
            <Icon name="heroicons:chevron-left" class="w-4 h-4" />
          </button>
          <button
            @click="goToToday"
            class="px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
            :class="weekOffset === 0 ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-foreground/70 hover:bg-muted/40'"
          >
            Today
          </button>
          <button
            @click="nextWeek"
            class="p-1.5 rounded-xl hover:bg-muted/40 text-foreground/70 hover:text-foreground transition cursor-pointer"
            title="Next Week"
          >
            <Icon name="heroicons:chevron-right" class="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 class="text-sm sm:text-base font-bold text-foreground">{{ weekRangeLabel }}</h3>
        </div>
      </div>

      <!-- Right: Legend & Clinic Filter -->
      <div class="flex flex-wrap items-center gap-3 sm:gap-4">
        <!-- Legend Pills -->
        <div class="flex items-center gap-2 text-xs">
          <span class="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px]">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Duty Hours
          </span>
          <span class="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full text-[11px]">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            Booked Patient
          </span>
          <span class="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-[11px]">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Away / Blocked
          </span>
        </div>

        <!-- Clinic Filter Dropdown -->
        <select
          v-if="clinics.length > 0"
          v-model="selectedClinicId"
          class="bg-card border border-border text-foreground text-xs font-semibold px-3 py-1.5 rounded-xl outline-none focus:border-primary shadow-2xs cursor-pointer"
        >
          <option value="all">All Clinic Branches</option>
          <option v-for="c in clinics" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Timetable Grid Container -->
    <div class="flex-1 overflow-x-auto overflow-y-auto">
      <div class="min-w-[800px] flex flex-col h-full">
        <!-- Weekdays Header Row -->
        <div class="grid grid-cols-[70px_repeat(7,1fr)] border-b border-border sticky top-0 bg-card z-20 shadow-2xs">
          <div class="p-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center border-r border-border/60">
            Time
          </div>
          <div
            v-for="day in weekDays"
            :key="day.dateStr"
            class="p-2.5 sm:p-3 text-center border-r last:border-r-0 border-border/60 transition-colors"
            :class="day.isToday ? 'bg-primary/5' : ''"
          >
            <span class="text-[11px] font-bold uppercase tracking-wider block" :class="day.isToday ? 'text-primary' : 'text-muted-foreground'">
              {{ day.dayName }}
            </span>
            <span
              class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mt-0.5"
              :class="day.isToday ? 'bg-primary text-primary-foreground shadow-xs' : 'text-foreground'"
            >
              {{ day.dayNumber }}
            </span>
          </div>
        </div>

        <!-- Timetable Body Rows -->
        <div class="relative grid grid-cols-[70px_repeat(7,1fr)] flex-1 min-h-[700px]">
          <!-- Left Time Column -->
          <div class="border-r border-border/60 bg-muted/5 flex flex-col">
            <div
              v-for="h in hours"
              :key="h"
              class="h-14 sm:h-16 border-b border-border/40 px-1 text-[11px] font-medium text-muted-foreground text-right pr-2 pt-1 select-none"
            >
              {{ formatHour(h) }}
            </div>
          </div>

          <!-- 7 Day Columns with Slots -->
          <div
            v-for="day in weekDays"
            :key="day.dateStr"
            class="relative border-r last:border-r-0 border-border/40"
            :class="day.isToday ? 'bg-primary/[0.02]' : ''"
          >
            <!-- Background Hourly Grid Lines -->
            <div
              v-for="h in hours"
              :key="h"
              class="h-14 sm:h-16 border-b border-border/40"
            ></div>

            <!-- Layer 1: Duty Shifts (Green zone) -->
            <div
              v-for="duty in getDutySlotsForDay(day.dateStr)"
              :key="duty.uuid"
              class="absolute left-1 right-1 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 p-2 shadow-2xs z-5 overflow-hidden transition hover:shadow-xs"
              :style="{ top: `${duty.topPct}%`, height: `${duty.heightPct}%` }"
            >
              <div class="flex items-center gap-1.5 text-emerald-800">
                <Icon name="heroicons:building-office-2" class="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span class="text-[11px] font-bold truncate leading-tight">
                  {{ duty.clinic?.name || duty.location_name || 'Clinic Duty' }}
                </span>
              </div>
              <p class="text-[10px] text-emerald-700 font-medium truncate mt-0.5">
                {{ duty.formattedTime }}
              </p>
            </div>

            <!-- Layer 2: Blocked / Away Slots (Red / Pattern zone) -->
            <div
              v-for="blocked in getBlockedSlotsForDay(day.dateStr)"
              :key="blocked.uuid"
              class="absolute left-1 right-1 rounded-2xl bg-rose-50/90 border border-rose-200/90 p-2 shadow-2xs z-6 overflow-hidden"
              :style="{ top: `${blocked.topPct}%`, height: `${blocked.heightPct}%` }"
            >
              <div class="flex items-center gap-1.5 text-rose-800">
                <Icon name="heroicons:no-symbol" class="w-3.5 h-3.5 shrink-0 text-rose-600" />
                <span class="text-[11px] font-bold truncate leading-tight">
                  {{ blocked.location_name || 'Blocked / Away' }}
                </span>
              </div>
              <p class="text-[10px] text-rose-700 font-medium truncate mt-0.5">
                {{ blocked.isAllDay ? 'All Day Off-Duty' : blocked.formattedTime }}
              </p>
            </div>

            <!-- Layer 3: Booked Patient Appointments (Indigo card) -->
            <div
              v-for="appt in getAppointmentsForDay(day.dateStr)"
              :key="appt.id || appt.uuid"
              @click="handleApptClick(appt)"
              class="absolute left-1.5 right-1.5 rounded-2xl bg-indigo-600 text-white p-2.5 shadow-md z-10 overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:bg-indigo-700"
              :style="{ top: `${appt.topPct}%`, height: `${appt.heightPct}%` }"
            >
              <div class="flex items-center justify-between gap-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  <div class="w-5 h-5 rounded-full bg-white/20 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {{ (appt.patientName || 'P')[0] }}
                  </div>
                  <span class="text-xs font-bold truncate leading-tight">
                    {{ appt.patientName }}
                  </span>
                </div>
                <Icon name="heroicons:chat-bubble-left-right" class="w-3.5 h-3.5 opacity-80 shrink-0" />
              </div>

              <div class="flex items-center justify-between text-[10px] text-indigo-100 font-medium mt-1">
                <span>{{ appt.startTime }} - {{ appt.endTime }}</span>
                <span v-if="appt.location" class="truncate opacity-90 max-w-[80px]">📍 {{ appt.location }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
