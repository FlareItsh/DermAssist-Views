<script setup lang="ts">
import { ref, computed } from 'vue'

const { appointments, selectedDate } = useAppointments()

// ── Stable "today" reference ─────────────────────────────────────────────────
const todayDate = new Date()
todayDate.setHours(0, 0, 0, 0)

// ── Week navigation offset (in full weeks) ────────────────────────────────────
const weekOffset = ref(0)

const prevWeek = () => {
  weekOffset.value--
  selectedDate.value = null
}
const nextWeek = () => {
  weekOffset.value++
  selectedDate.value = null
}

const selectDay = (d: Date) => {
  const key = toKey(d)
  if (selectedDate.value === key) {
    selectedDate.value = null // Toggle off
  } else {
    selectedDate.value = key
  }
}

// ── Build the 14-day window centered on today + offset ────────────────────────
const { searchQuery } = useSearch()

const days = computed(() => {
  const result: Date[] = []
  // Original UI shows 14 days
  for (let i = -2; i < 12; i++) {
    const d = new Date(todayDate)
    d.setDate(todayDate.getDate() + weekOffset.value * 7 + i)
    result.push(d)
  }

  // Search filtering logic (Only if input is a number)
  if (searchQuery.value && !isNaN(Number(searchQuery.value))) {
    const searchNum = parseInt(searchQuery.value)
    const filtered = result.filter(d => d.getDate() === searchNum)
    return filtered.length > 0 ? filtered : result
  }

  return result
})

// ── Range label shown in the header ─────────────────────────────────────────
const rangeLabel = computed(() => {
  const first = days.value.at(0)
  const last = days.value.at(-1)
  if (!first || !last) return ''
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(first)} – ${fmt(last)}, ${last.getFullYear()}`
})

// ── Convert date → YYYY-MM-DD key ────────────────────────────────────────────
const toKey = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Count appointments per date from real data ───────────────────────────────
const appointmentCountMap = computed(() => {
  const map: Record<string, number> = {}
  for (const appt of appointments.value) {
    if (!appt.date) continue
    map[appt.date] = (map[appt.date] ?? 0) + 1
  }
  return map
})

const getCount = (d: Date) => appointmentCountMap.value[toKey(d)] ?? 0
const isToday = (d: Date) => toKey(d) === toKey(todayDate)
const isSelected = (d: Date) => toKey(d) === selectedDate.value
const dayName = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
const dayNum = (d: Date) => d.getDate()
const aheadCount = computed(() => {
  const last = days.value.at(-1)
  if (!last) return 0
  const lastKey = toKey(last)
  return appointments.value.filter(a => a.date && a.date > lastKey).length
})

const behindCount = computed(() => {
  const first = days.value.at(0)
  if (!first) return 0
  const firstKey = toKey(first)
  return appointments.value.filter(a => a.date && a.date < firstKey).length
})
</script>

<template>
  <div class="appointment-schedule bg-navy rounded-3xl px-6 py-5 flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <div class="flex flex-col gap-0.5">
        <h2 class="text-white text-xl font-bold">Patients Appointment Schedule</h2>
        <span class="text-white/40 text-xs font-medium">{{ rangeLabel }}</span>
      </div>
      <div class="flex gap-1.5 items-center">
        <!-- Prev Button with Badge -->
        <div class="relative">
          <button @click="prevWeek"
            class="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 active:scale-90">
            <Icon name="material-symbols:chevron-left-rounded" class="text-2xl" />
          </button>
          <div v-if="behindCount > 0" 
            class="absolute -top-1 -left-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white shadow-lg pointer-events-none animate-pulse">
            {{ behindCount }}
          </div>
        </div>

        <div class="relative">
          <button @click="nextWeek"
            class="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 active:scale-90">
            <Icon name="material-symbols:chevron-right-rounded" class="text-2xl" />
          </button>
          <div v-if="aheadCount > 0" 
            class="absolute -top-1 p-2 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white shadow-lg pointer-events-none">
            {{ aheadCount }}
          </div>
        </div>
      </div>
    </div>


    <div class="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
      <div v-for="d in days" :key="d.toDateString()"
        @click="selectDay(d)"
        class="day-card relative flex flex-col items-center justify-between cursor-pointer rounded-2xl px-1 pt-3 pb-2.5 min-h-[105px] transition-all duration-200 select-none"
        :class="[
          days.length === 1 ? 'w-[92px] shrink-0' : 'flex-1 min-w-0',
          isSelected(d)
            ? 'bg-secondary border-[5px] border-white/20 scale-105 shadow-xl z-10'
            : getCount(d) > 0
              ? 'bg-primary border-[5px] border-navy/90'
              : isToday(d)
                ? 'bg-navy/90 border-[5px] border-primary/50'
                : 'bg-[#0a1e33]/50 border border-transparent hover:bg-[#0a1e33]'
        ]">
        <!-- Day name -->
        <span class="text-[13px] font-bold"
          :class="[
            isSelected(d) ? 'text-white' : 
            getCount(d) > 0 ? 'text-navy/60' : 
            isToday(d) ? 'text-card/50' : 'text-card/30'
          ]">
          {{ dayName(d) }}
        </span>

        <!-- Day number -->
        <span class="text-3xl font-bold"
          :class="[
            isSelected(d) ? 'text-white' :
            getCount(d) > 0 ? 'text-card' : 
            isToday(d) ? 'text-card' : 'text-card/70'
          ]">
          {{ dayNum(d) }}
        </span>

        <!-- Indicator -->
        <div class="flex items-center justify-center w-full px-0.5">
          <div v-if="getCount(d) > 0"
            class="flex h-5 w-full items-center justify-center rounded-full text-sm font-bold shadow-sm"
            :class="isSelected(d) ? 'bg-white text-secondary' : 'bg-[#ff4d4d] text-white'">
            {{ getCount(d) }}
          </div>
          <span v-else class="block h-1.5 w-1.5 rounded-full bg-white opacity-80" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.day-pill {
  padding: 4px 6px 12px;
}
</style>
