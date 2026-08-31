<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { onClickOutside } from '@vueuse/core'

  import { appointmentService } from '~/api/appointment/AppointmentService'
  import type { BlockedSlot } from '~/composables/useBlockedDates'

  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const props = withDefaults(defineProps<{
    /** Earliest selectable date in YYYY-MM-DD format. Defaults to today. */
    minDate?: string
    /** Blocked/away slots for the logged-in doctor. When provided, blocked dates are visually marked and disabled. */
    blockedSlots?: BlockedSlot[]
    /** When true, renders a "Manage Blocked Dates" link that navigates to the doctor profile page. */
    showManageBlocksLink?: boolean
    /** When false, clicking appointment dates only selects the date and appointment details stay hover-only. */
    showAppointmentDetailsPanel?: boolean
  }>(), {
    minDate: () => {
      const d = new Date()
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },
    blockedSlots: () => [],
    showManageBlocksLink: false,
    showAppointmentDetailsPanel: true,
  })

  const { appointments, fetchAppointments } = useAppointments()

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

  const getAppointmentsForDate = (dateStr: string) => {
    return appointments.value.filter(a => a.date === dateStr)
  }

  const formatAppointmentTimeRange = (appt: any): string => {
    const formatRawTime = (raw?: string) => {
      if (!raw) return ''
      const localDateTimeStr = raw.replace(/Z|(\+\d{2}:\d{2})$/i, '')
      const date = new Date(localDateTimeStr)
      if (Number.isNaN(date.getTime())) return ''
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const start = appt.time || formatRawTime(appt.raw_scheduled_at)
    const end = formatRawTime(appt.raw_scheduled_end_at)
    return end ? `${start} - ${end}` : start
  }

  // ── Blocked date helpers ─────────────────────────────────────────────────────

  /**
   * Returns all blocked slots for a given YYYY-MM-DD date.
   */
  const getBlockedSlotsForDate = (dateStr: string): BlockedSlot[] => {
    if (!props.blockedSlots?.length) return []
    return props.blockedSlots.filter(
      (slot) => slot.available_date?.slice(0, 10) === dateStr
    )
  }

  /** Returns true if the date has any blocked period. */
  const isDateBlocked = (day: number): boolean => {
    return getBlockedSlotsForDate(dateStringFor(day)).length > 0
  }

  /** Returns true if the whole day is blocked (00:00–23:59 slot). */
  const isWholeDayBlocked = (day: number): boolean => {
    return getBlockedSlotsForDate(dateStringFor(day)).some(
      (slot) => slot.start_time <= '00:01' && slot.end_time >= '23:58'
    )
  }

  /** Human-readable label for blocked time ranges on a date. */
  const blockedRangeLabel = (day: number): string => {
    const slots = getBlockedSlotsForDate(dateStringFor(day))
    if (!slots.length) return ''
    return slots
      .map((s) => {
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

  const selectedDay = ref<string | null>(null)
  const hoveredDate = ref<string | null>(null)

  const appointmentsForDay = computed(() => {
    if (!selectedDay.value) return []
    return appointments.value.filter(a => a.date === selectedDay.value)
  })

  const selectedDayLabel = computed(() => {
    if (!selectedDay.value) return ''
    const d = new Date(selectedDay.value + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  })

  const router = useRouter()
  const calendarRef = ref<HTMLElement | null>(null)

  onClickOutside(calendarRef, () => {
    if (!props.showAppointmentDetailsPanel) return
    selectedDay.value = null
  })

  const selectDate = (day: number) => {
    const dateStr = dateStringFor(day)
    if (isPast(day)) return
    // Whole-day blocked dates cannot be selected
    if (isWholeDayBlocked(day)) return
    if (props.showAppointmentDetailsPanel) {
      if (selectedDay.value === dateStr) {
        selectedDay.value = null
      } else {
        selectedDay.value = dateStr
      }
    } else {
      selectedDay.value = dateStr
    }
    emit('dateSelected', dateStr)
  }

  const goToManageBlocks = () => {
    router.push('/Doctor/profile#blocked-dates')
  }

  const goToChat = (conversationUuid: string) => {
    router.push(`/Patient/Messages/${conversationUuid}`)
  }

  const requestReschedule = async (apptId: string) => {
    try {
      await appointmentService.update(apptId, { status: 'reschedule_requested' })
      await fetchAppointments()
    } catch (e) {
      console.error(e)
    }
  }
</script>

<template>
  <div ref="calendarRef" class="relative z-30">
    <!-- Appointment Detail Panel — overlaps content to the left, does NOT push layout -->
    <Transition name="slide-left">
      <div
        v-if="showAppointmentDetailsPanel && selectedDay && appointmentsForDay.length > 0"
        class="absolute right-[calc(100%+12px)] top-0 w-72 z-50 pointer-events-auto"
      >
        <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          <!-- Header -->
          <div class="bg-gradient-to-br from-primary to-indigo-700 px-4 py-4">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <Icon name="material-symbols:calendar-today-rounded" class="text-white/80 text-base" />
                <p class="text-white text-xs font-bold uppercase tracking-wide">Appointment Details</p>
              </div>
              <button @click="selectedDay = null" class="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                <Icon name="material-symbols:close-rounded" class="text-base" />
              </button>
            </div>
            <p class="text-white text-lg font-black leading-tight">{{ selectedDayLabel }}</p>
          </div>

          <!-- Appointment cards -->
          <div class="p-3 flex flex-col gap-2 max-h-72 overflow-y-auto custom-scrollbar">
            <div
              v-for="appt in appointmentsForDay"
              :key="appt.id"
              class="rounded-2xl bg-indigo-50/70 border border-indigo-100/80 p-3 flex flex-col gap-2"
            >
              <div class="flex items-start gap-2.5">
                <div class="bg-indigo-600 rounded-full p-2 text-white shrink-0 shadow-sm">
                  <Icon name="material-symbols:stethoscope-rounded" class="text-base" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-gray-900 text-sm font-bold truncate">{{ appt.doctor }}</p>
                  <p class="text-indigo-600 text-[11px] font-bold uppercase tracking-wide truncate">{{ appt.info }}</p>
                </div>
              </div>

              <!-- Meta info: Time & Location -->
              <div class="flex flex-col gap-1.5 bg-white rounded-xl p-2.5 border border-indigo-100/60 text-xs">
                <div v-if="appt.time" class="flex items-center gap-2 text-gray-700 font-semibold">
                  <Icon name="material-symbols:schedule-rounded" class="text-indigo-600 text-sm shrink-0" />
                  <span>Time: <strong class="text-gray-900">{{ appt.time }}</strong></span>
                </div>
                <div v-if="appt.location" class="flex items-center gap-2 text-gray-700 font-semibold">
                  <Icon name="material-symbols:location-on-rounded" class="text-indigo-600 text-sm shrink-0" />
                  <span class="truncate">Location: <strong class="text-gray-900">{{ appt.location }}</strong></span>
                </div>
              </div>

              <!-- Go to chat & Request Reschedule -->
              <div class="flex flex-col gap-1.5 mt-1">
                <button
                  v-if="appt.conversation_uuid"
                  @click="goToChat(appt.conversation_uuid)"
                  class="w-full bg-indigo-500 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl py-2 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Icon name="material-symbols:chat-rounded" class="text-sm" />
                  Go to Chat
                </button>
                <button
                  v-if="appt.status === 'scheduled'"
                  @click="requestReschedule(appt.id)"
                  class="w-full bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl py-1.5 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Icon name="material-symbols:edit-calendar-rounded" class="text-sm" />
                  Request Reschedule
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Pointer tail pointing right at calendar -->
        <div class="absolute right-[-8px] top-8 w-0 h-0
          border-t-[8px] border-t-transparent
          border-b-[8px] border-b-transparent
          border-l-[8px] border-l-white">
        </div>
      </div>
    </Transition>

    <!-- Calendar card -->
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
          @mouseenter="hoveredDate = dateStringFor(date)"
          @mouseleave="hoveredDate = null"
          class="relative flex h-8 w-8 items-center justify-center place-self-center rounded-full text-[15px] font-semibold transition-colors"
          :class="[
            isPast(date)
              ? 'pointer-events-none text-gray-300 line-through'
              : isWholeDayBlocked(date)
                ? 'cursor-not-allowed bg-red-50 text-red-300 ring-1 ring-red-200'
                : selectedDay === dateStringFor(date)
                  ? 'bg-secondary text-white cursor-pointer shadow-md'
                  : isDateBlocked(date)
                    ? 'cursor-pointer text-foreground hover:bg-primary/10 ring-1 ring-red-300'
                    : isToday(date)
                      ? 'cursor-pointer text-primary ring-2 ring-primary/40 hover:bg-primary/10'
                      : 'text-foreground cursor-pointer hover:bg-primary/10'
          ]"
        >
          {{ date }}

          <!-- Blocked indicator dot (partial block) -->
          <div
            v-if="isDateBlocked(date) && !isWholeDayBlocked(date) && !isPast(date)"
            class="absolute -bottom-1 h-1 w-1 rounded-full bg-red-400"
          />

          <!-- Appointment indicator dot -->
          <div
            v-if="hasAppointment(date) && !isPast(date) && !isWholeDayBlocked(date)"
            class="absolute -bottom-1 h-1 w-1 rounded-full"
            :class="selectedDay === dateStringFor(date) ? 'bg-white' : 'bg-secondary'"
          />

          <!-- Blocked date tooltip -->
          <Transition name="fade-scale">
            <div
              v-if="hoveredDate === dateStringFor(date) && isDateBlocked(date) && !isPast(date)"
              class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none w-52 bg-red-900/95 text-white p-2.5 rounded-xl shadow-2xl border border-red-700/60 backdrop-blur-md text-left text-xs"
            >
              <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-900/95 rotate-45 border-r border-b border-red-700/60" />
              <div class="flex items-center gap-1.5 mb-1">
                <Icon name="material-symbols:block-rounded" class="text-red-300 text-sm shrink-0" />
                <p class="font-bold text-red-100 text-xs">Blocked / Away</p>
              </div>
              <p class="text-red-200 text-[10px] font-semibold">
                {{ isWholeDayBlocked(date) ? 'Entire day blocked' : blockedRangeLabel(date) }}
              </p>
            </div>
          </Transition>

          <!-- Appointment hover tooltip (only if not blocked) -->
          <Transition name="fade-scale">
            <div
              v-if="hoveredDate === dateStringFor(date) && hasAppointment(date) && !isPast(date) && (!isDateBlocked(date) || !showAppointmentDetailsPanel)"
              class="absolute left-1/2 -translate-x-1/2 z-[9999] pointer-events-none w-48 bg-slate-900/95 text-white p-2.5 rounded-xl shadow-2xl border border-slate-700/60 backdrop-blur-md text-left text-xs"
              :class="isDateBlocked(date) ? 'top-full mt-2' : 'bottom-full mb-2'"
            >
              <div
                class="absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900/95 rotate-45 border-slate-700/60"
                :class="isDateBlocked(date) ? '-top-1 border-l border-t' : '-bottom-1 border-r border-b'"
              />

              <div
                v-for="appt in getAppointmentsForDate(dateStringFor(date))"
                :key="appt.id"
                class="flex flex-col gap-1"
              >
                <div class="flex items-center gap-1.5">
                  <Icon name="material-symbols:event-available-rounded" class="text-secondary text-sm shrink-0" />
                  <p class="font-bold text-white text-xs truncate">{{ appt.doctor }}</p>
                </div>
                <p v-if="appt.info" class="text-white/60 text-[10px] font-semibold uppercase truncate">{{ appt.info }}</p>
                <div class="flex items-center gap-2 mt-0.5 text-[10px] text-gray-300">
                  <span v-if="appt.time" class="flex items-center gap-0.5">
                    <Icon name="material-symbols:schedule-rounded" class="text-indigo-400 text-xs shrink-0" />
                    {{ formatAppointmentTimeRange(appt) }}
                  </span>
                  <span v-if="appt.location" class="flex items-center gap-0.5 truncate">
                    <Icon name="material-symbols:location-on-rounded" class="text-indigo-400 text-xs shrink-0" />
                    {{ appt.location }}
                  </span>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Manage Blocked Dates link — only shown when explicitly enabled (doctor context) -->
      <div v-if="showManageBlocksLink" class="mt-4 pt-3 border-t border-gray-100">
        <button
          @click="goToManageBlocks"
          class="flex w-full items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 active:scale-95"
        >
          <Icon name="material-symbols:block-rounded" class="text-sm shrink-0" />
          Manage Blocked Dates
          <Icon name="material-symbols:arrow-forward-rounded" class="text-sm shrink-0" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.25s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.slide-left-enter-from,
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(12px) scale(0.96);
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.15s ease-out;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px) scale(0.95);
}
</style>


