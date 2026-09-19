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
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

  // ── Blocked dates (doctor's own away/blocked slots) ──────────────────────────
  const {
    getBlockedTimesForDate,
    hasBlockedTime,
    isWholeDayBlocked: checkWholeDayBlocked
  } = useBlockedDates()

  /** True if a day has any blocked period. */
  const isDayBlocked = (d: Date): boolean => hasBlockedTime(toKey(d))

  /** True if the whole day is blocked (00:00–23:59). */
  const isDayFullyBlocked = (d: Date): boolean => checkWholeDayBlocked(toKey(d))

  /** Human-readable time range label for a day's blocked slots. */
  const blockedLabel = (d: Date): string => {
    const slots = getBlockedTimesForDate(toKey(d))
    if (!slots.length) return ''
    return slots
      .map(s => {
        const fmt = (t: string) => {
          const [h, m] = t.split(':').map(Number)
          const ampm = h >= 12 ? 'PM' : 'AM'
          const hour = h % 12 || 12
          return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
        }
        if (s.start_time <= '00:01' && s.end_time >= '23:58') return 'All day'
        return `${fmt(s.start_time)} – ${fmt(s.end_time)}`
      })
      .join(', ')
  }

  /** Tooltip hover state per day key. */
  const hoveredDayKey = ref<string | null>(null)

  // ── Overdue Appointments Helpers ──────────────────────────────────────────────
  const todayKeyStr = toKey(todayDate)

  const isApptOverdue = (appt: any): boolean => {
    if (!appt.date || appt.status === 'completed' || appt.status === 'declined') return false
    if (appt.date < todayKeyStr) return true
    if (appt.date === todayKeyStr && appt.time) {
      return new Date(`${appt.date}T${appt.time}`) < new Date()
    }
    return false
  }

  const isDayOverdue = (d: Date): boolean => {
    const dateKey = toKey(d)
    return appointments.value.some(a => a.date === dateKey && isApptOverdue(a))
  }

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

  /** Blocked slots for the currently open popover day. */
  const popoverBlockedSlots = computed(() => {
    if (!popoverKey.value) return []
    return getBlockedTimesForDate(popoverKey.value)
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
  <div
    ref="componentRef"
    class="appointment-schedule bg-navy flex flex-col gap-3 rounded-3xl px-6 py-5"
  >
    <div class="flex items-center justify-between">
      <div class="flex flex-col gap-0.5">
        <h2 class="text-xl font-bold text-white">Patients Appointment Schedule</h2>
        <span class="text-xs font-medium text-white/40">{{ rangeLabel }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <!-- Prev Button with Badge -->
        <div class="relative">
          <button
            @click="prevWeek"
            class="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white active:scale-90"
          >
            <Icon
              name="material-symbols:chevron-left-rounded"
              class="text-2xl"
            />
          </button>
          <div
            v-if="behindCount > 0"
            class="bg-destructive pointer-events-none absolute -top-1 -left-1 flex h-4 min-w-[16px] animate-pulse items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-lg"
          >
            {{ behindCount }}
          </div>
        </div>

        <div class="relative">
          <button
            @click="nextWeek"
            class="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white active:scale-90"
          >
            <Icon
              name="material-symbols:chevron-right-rounded"
              class="text-2xl"
            />
          </button>
          <div
            v-if="aheadCount > 0"
            class="bg-destructive pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full p-2 px-1 text-[10px] font-bold text-white shadow-lg"
          >
            {{ aheadCount }}
          </div>
        </div>
      </div>
    </div>

    <div class="custom-scrollbar flex gap-1 overflow-x-auto py-3">
      <div
        v-for="d in days"
        :key="d.toDateString()"
        @click="selectDay(d)"
        @mouseenter="hoveredDayKey = toKey(d)"
        @mouseleave="hoveredDayKey = null"
        class="day-card relative flex min-h-[105px] cursor-pointer flex-col items-center justify-between overflow-visible rounded-2xl px-1 pt-3 pb-2.5 transition-all duration-200 select-none"
        :class="[
          days.length === 1 ? 'w-[92px] shrink-0' : 'min-w-0 flex-1',
          isSelected(d)
            ? 'bg-secondary z-10 scale-105 border-[5px] border-white/20 shadow-xl'
            : isDayFullyBlocked(d)
              ? 'border border-red-900/40 bg-[#0a0f18] opacity-60'
              : isDayOverdue(d)
                ? 'animate-pulse border-2 border-red-500/80 bg-amber-950/40 shadow-lg'
                : isDayBlocked(d)
                  ? 'border border-red-800/30 bg-[#0a1e33]/70'
                  : getCount(d) > 0
                    ? 'bg-primary border-navy/90 border-[5px]'
                    : isToday(d)
                      ? 'bg-navy/90 border-primary/50 border-[5px]'
                      : 'border border-transparent bg-[#0a1e33]/50 hover:bg-[#0a1e33]'
        ]"
      >
        <!-- Day name -->
        <span
          class="text-[13px] font-bold"
          :class="[
            isSelected(d)
              ? 'text-white'
              : isDayFullyBlocked(d)
                ? 'text-red-400/70'
                : isDayOverdue(d)
                  ? 'text-amber-400'
                  : isDayBlocked(d)
                    ? 'text-red-400/50'
                    : getCount(d) > 0
                      ? 'text-navy/60'
                      : isToday(d)
                        ? 'text-card/50'
                        : 'text-card/30'
          ]"
        >
          {{ dayName(d) }}
        </span>

        <!-- Day number -->
        <span
          class="text-3xl font-bold"
          :class="[
            isSelected(d)
              ? 'text-white'
              : isDayFullyBlocked(d)
                ? 'text-red-300/50'
                : isDayOverdue(d)
                  ? 'text-amber-300'
                  : isDayBlocked(d)
                    ? 'text-card/40'
                    : getCount(d) > 0
                      ? 'text-card'
                      : isToday(d)
                        ? 'text-card'
                        : 'text-card/70'
          ]"
        >
          {{ dayNum(d) }}
        </span>

        <!-- Indicator -->
        <div class="flex w-full items-center justify-center px-0.5">
          <div
            v-if="isDayOverdue(d) && !isSelected(d)"
            class="flex h-5 w-full items-center justify-center gap-1 rounded-full bg-red-600 text-[10px] font-bold text-white shadow-md"
          >
            <Icon
              name="material-symbols:warning-rounded"
              class="shrink-0 text-xs"
            />
            <span>Overdue</span>
          </div>
          <div
            v-else-if="getCount(d) > 0"
            class="flex h-5 w-full items-center justify-center rounded-full text-sm font-bold shadow-sm"
            :class="isSelected(d) ? 'text-secondary bg-white' : 'bg-[#ff4d4d] text-white'"
          >
            {{ getCount(d) }}
          </div>
          <span
            v-else
            class="block h-1.5 w-1.5 rounded-full bg-white opacity-80"
          />
        </div>
      </div>
    </div>

    <!-- Inline expanded panel — part of the card, same dark blue bg -->
    <Transition name="expand-down">
      <div
        v-if="popoverKey"
        class="mt-1 border-t border-white/10 pt-3"
      >
        <!-- Panel header -->
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="rounded-full bg-white/10 p-1.5">
              <Icon
                name="material-symbols:calendar-today-rounded"
                class="text-sm text-white/70"
              />
            </div>
            <div>
              <p class="text-xs font-bold text-white">{{ popoverDateLabel }}</p>
              <p class="text-[11px] font-medium text-white/40">
                {{ popoverAppointments.length }} appointment{{
                  popoverAppointments.length !== 1 ? 's' : ''
                }}
              </p>
            </div>
          </div>
          <button
            @click.stop="closePopover"
            class="rounded-full p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon
              name="material-symbols:close-rounded"
              class="text-base"
            />
          </button>
        </div>

        <!-- Patient list -->
        <div class="custom-scrollbar flex max-h-48 flex-col gap-2 overflow-y-auto">
          <!-- No appointments / Blocked notice -->
          <div
            v-if="popoverAppointments.length === 0"
            class="flex flex-col gap-2 py-3"
          >
            <!-- Blocked notice if this day has restrictions -->
            <div
              v-if="popoverBlockedSlots.length > 0"
              class="flex items-start gap-2.5 rounded-xl border border-red-800/40 bg-red-900/30 px-3 py-2.5"
            >
              <Icon
                name="material-symbols:block-rounded"
                class="mt-0.5 shrink-0 text-base text-red-400"
              />
              <div>
                <p class="text-xs font-bold text-red-200">
                  {{
                    isDayFullyBlocked(new Date(popoverKey + 'T00:00:00'))
                      ? 'Fully Blocked / Away'
                      : 'Partially Blocked'
                  }}
                </p>
                <p class="mt-0.5 text-[11px] font-semibold text-red-400/80">
                  {{ blockedLabel(new Date(popoverKey + 'T00:00:00')) }}
                </p>
              </div>
            </div>
            <div class="flex items-center justify-center gap-2 py-2 text-white/30">
              <Icon
                name="material-symbols:person-off-outline-rounded"
                class="text-lg"
              />
              <span class="text-xs font-semibold">No appointments for this day</span>
            </div>
          </div>

          <!-- Patient rows -->
          <div
            v-for="appt in popoverAppointments"
            :key="appt.id"
            @click="
              goToChat(
                appt.conversation_uuid
                  ? isApptOverdue(appt)
                    ? `${appt.conversation_uuid}?resolve=1`
                    : appt.conversation_uuid
                  : undefined
              )
            "
            class="group flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all"
            :class="[
              isApptOverdue(appt)
                ? 'border-red-500/50 bg-red-950/60 shadow-md ring-1 ring-red-500/30 hover:bg-red-900/80'
                : 'border-white/10 bg-white/8 hover:bg-white/15'
            ]"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              :class="
                isApptOverdue(appt) ? 'bg-red-500/20 text-red-400' : 'bg-white/15 text-white/70'
              "
            >
              <Icon
                :name="
                  isApptOverdue(appt)
                    ? 'material-symbols:warning-rounded'
                    : 'material-symbols:person-rounded'
                "
                class="text-base"
              />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="truncate text-xs font-bold text-white">{{ appt.doctor }}</p>
                <span
                  v-if="isApptOverdue(appt)"
                  class="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white uppercase"
                >
                  Overdue
                </span>
              </div>
              <p class="truncate text-[11px] font-semibold text-white/50">{{ appt.info }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <div class="text-right">
                <p class="text-[11px] font-bold text-white/80">{{ appt.time }}</p>
                <p
                  v-if="appt.location"
                  class="max-w-[80px] truncate text-[10px] text-white/40"
                >
                  {{ appt.location }}
                </p>
              </div>
              <Icon
                name="material-symbols:arrow-forward-rounded"
                class="text-base text-white/30 transition-colors group-hover:text-white/70"
              />
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

  .bg-white\/8 {
    background-color: rgba(255, 255, 255, 0.08);
  }
  .bg-white\/12 {
    background-color: rgba(255, 255, 255, 0.12);
  }

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

  .day-tooltip-enter-active,
  .day-tooltip-leave-active {
    transition: all 0.15s ease-out;
  }

  .day-tooltip-enter-from,
  .day-tooltip-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(4px) scale(0.95);
  }
</style>
