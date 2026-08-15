<script setup lang="ts">
import { ref, computed } from 'vue'
import { onClickOutside } from '@vueuse/core'

const { appointments, selectedDate } = useAppointments()

// ── Stable "today" reference ─────────────────────────────────────────────────
const todayDate = new Date()
todayDate.setHours(0, 0, 0, 0)

// ── Week navigation offset (in full weeks) ────────────────────────────────────
const weekOffset = ref(0)

const prevWeek = () => {
  weekOffset.value--
  selectedDate.value = null
  popoverKey.value = null
}
const nextWeek = () => {
  weekOffset.value++
  selectedDate.value = null
  popoverKey.value = null
}

// ── Click outside to close ───────────────────────────────────────────────────
const componentRef = ref<HTMLElement | null>(null)
onClickOutside(componentRef, () => {
  closePopover()
})

// ── Popover state ────────────────────────────────────────────────────────────
const popoverKey = ref<string | null>(null)

const selectDay = (d: Date) => {
  const key = toKey(d)
  if (selectedDate.value === key) {
    selectedDate.value = null
    popoverKey.value = null
  } else {
    selectedDate.value = key
    popoverKey.value = key
  }
}

const closePopover = () => {
  popoverKey.value = null
  selectedDate.value = null
}

const router = useRouter()
const goToChat = (conversationUuid: string | undefined) => {
  if (!conversationUuid) return
  closePopover()
  router.push(`/Doctor/Messages/${conversationUuid}`)
}

// ── Build the 14-day window centered on today + offset ────────────────────────
const { searchQuery } = useSearch()

const days = computed(() => {
  const result: Date[] = []
  for (let i = -2; i < 12; i++) {
    const d = new Date(todayDate)
    d.setDate(todayDate.getDate() + weekOffset.value * 7 + i)
    result.push(d)
  }

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

// ── Patients for the selected popover date ───────────────────────────────────
const popoverAppointments = computed(() => {
  if (!popoverKey.value) return []
  return appointments.value.filter(a => a.date === popoverKey.value)
})

const popoverDateLabel = computed(() => {
  if (!popoverKey.value) return ''
  const d = new Date(popoverKey.value + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
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
  <div ref="componentRef" class="appointment-schedule bg-navy rounded-3xl px-6 py-5 flex flex-col gap-3">
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

    <div class="flex gap-1 overflow-x-auto py-3 custom-scrollbar">
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

    <!-- Inline expanded panel — part of the card, same dark blue bg -->
    <Transition name="expand-down">
      <div v-if="popoverKey" class="border-t border-white/10 pt-3 mt-1">
        <!-- Panel header -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="bg-white/10 rounded-full p-1.5">
              <Icon name="material-symbols:calendar-today-rounded" class="text-white/70 text-sm" />
            </div>
            <div>
              <p class="text-white text-xs font-bold">{{ popoverDateLabel }}</p>
              <p class="text-white/40 text-[11px] font-medium">
                {{ popoverAppointments.length }} appointment{{ popoverAppointments.length !== 1 ? 's' : '' }}
              </p>
            </div>
          </div>
          <button @click.stop="closePopover" class="text-white/40 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
            <Icon name="material-symbols:close-rounded" class="text-base" />
          </button>
        </div>

        <!-- Patient list -->
        <div class="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
          <!-- No appointments -->
          <div v-if="popoverAppointments.length === 0" class="flex items-center justify-center gap-2 py-4 text-white/30">
            <Icon name="material-symbols:person-off-outline-rounded" class="text-lg" />
            <span class="text-xs font-semibold">No appointments for this day</span>
          </div>

          <!-- Patient rows -->
          <div
            v-for="appt in popoverAppointments"
            :key="appt.id"
            @click="goToChat(appt.conversation_uuid)"
            class="flex items-center gap-3 rounded-xl bg-white/8 hover:bg-white/15 active:scale-[0.98] px-3 py-2.5 transition-all border border-white/10 cursor-pointer group"
          >
            <div class="bg-white/15 rounded-full h-8 w-8 flex items-center justify-center shrink-0">
              <Icon name="material-symbols:person-rounded" class="text-white/70 text-base" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-white text-xs font-bold truncate">{{ appt.doctor }}</p>
              <p class="text-white/50 text-[11px] font-semibold truncate">{{ appt.info }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <div class="text-right">
                <p class="text-white/80 text-[11px] font-bold">{{ appt.time }}</p>
                <p v-if="appt.location" class="text-white/40 text-[10px] truncate max-w-[80px]">{{ appt.location }}</p>
              </div>
              <Icon name="material-symbols:arrow-forward-rounded" class="text-white/30 group-hover:text-white/70 text-base transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.day-pill {
  padding: 4px 6px 12px;
}

.bg-white\/8 { background-color: rgba(255,255,255,0.08); }
.bg-white\/12 { background-color: rgba(255,255,255,0.12); }

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
  max-height: 400px;
}
</style>
