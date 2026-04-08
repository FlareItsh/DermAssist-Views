<script setup lang="ts">
import { ref, computed } from 'vue'

// ── Real appointment data ────────────────────────────────────────────────────
const { appointments } = useAppointments()

// ── Stable "today" reference ─────────────────────────────────────────────────
const todayDate = new Date()
todayDate.setHours(0, 0, 0, 0)

// ── Week navigation offset (in full weeks) ────────────────────────────────────
const weekOffset = ref(0)

const prevWeek = () => weekOffset.value--
const nextWeek = () => weekOffset.value++

// ── Build the 14-day window centered on today + offset ────────────────────────
const { searchQuery } = useSearch()

const days = computed(() => {
  const result: Date[] = []
  for (let i = -2; i < 12; i++) {
    const d = new Date(todayDate)
    d.setDate(todayDate.getDate() + weekOffset.value * 7 + i)
    result.push(d)
  }

  // Search filtering logic (Only if input is a number)
  if (searchQuery.value && !isNaN(Number(searchQuery.value))) {
    const searchNum = parseInt(searchQuery.value)
    // Filter to days that match the number AND have appointments
    const filtered = result.filter(d => d.getDate() === searchNum && getCount(d) > 0)
    // If a match is found, show only that, otherwise show all
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
    const parts = appt.date.split('-')
    const [y, mo = '01', d = '01'] = parts
    const key = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
    map[key] = (map[key] ?? 0) + 1
  }
  return map
})

const getCount = (d: Date) => appointmentCountMap.value[toKey(d)] ?? 0
const isToday = (d: Date) => toKey(d) === toKey(todayDate)
const dayName = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
const dayNum = (d: Date) => d.getDate()
</script>

<template>
  <div class="appointment-schedule bg-navy rounded-3xl px-6 py-5 flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <div class="flex flex-col gap-0.5">
        <h2 class="text-white text-xl font-bold">Patients Appointment Schedule</h2>
        <span class="text-white/40 text-xs font-medium">{{ rangeLabel }}</span>
      </div>
      <div class="flex gap-1">
        <button @click="prevWeek"
          class="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 active:scale-90">
          <Icon name="material-symbols:chevron-left-rounded" class="text-2xl" />
        </button>
        <button @click="nextWeek"
          class="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 active:scale-90">
          <Icon name="material-symbols:chevron-right-rounded" class="text-2xl" />
        </button>
      </div>
    </div>

    <div class="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
      <div v-for="d in days" :key="d.toDateString()"
        class="day-card relative flex flex-col items-center justify-between cursor-pointer rounded-2xl px-1 pt-3 pb-2.5 min-h-[105px] transition-all duration-200 select-none"
        :class="[
          days.length === 1 ? 'w-[92px] shrink-0' : 'flex-1 min-w-0',
          getCount(d) > 0
            ? 'bg-primary border-[5px] border-navy/90'
            : isToday(d)
              ? 'bg-navy/90 border-[5px] border-primary/50'
              : 'bg-[#0a1e33]/50 border border-transparent'
        ]">
        <!-- Day name -->
        <span class="text-[13px] font-bold"
          :class="getCount(d) > 0 ? 'text-navy/60' : isToday(d) ? 'text-card/50' : 'text-card/30'">
          {{ dayName(d) }}
        </span>

        <!-- Day number -->
        <span class="text-3xl font-bold"
          :class="getCount(d) > 0 ? 'text-card' : isToday(d) ? 'text-card' : 'text-card/70'">
          {{ dayNum(d) }}
        </span>

        <!-- Indicator -->
        <div class="flex items-center justify-center w-full px-0.5">
          <div v-if="getCount(d) > 0"
            class="flex h-5 w-full items-center justify-center rounded-full bg-[#ff4d4d] text-sm font-bold text-white shadow-sm">
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
