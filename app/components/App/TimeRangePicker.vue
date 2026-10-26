<script setup lang="ts">
  import { computed } from 'vue'

  export interface TimeSlotOption {
    time24: string
    endTime24: string
    label: string
    endLabel: string
    durationLabel: string
    isAvailable: boolean
    isCurrentApptTime?: boolean
    isPassed?: boolean
    clinicName?: string
  }

  const props = withDefaults(
    defineProps<{
      startTime: string // e.g. "09:00"
      endTime?: string // e.g. "10:00"
      date?: string // e.g. "2026-10-20"
      minTime?: string // default "08:00"
      maxTime?: string // default "18:00"
      stepMinutes?: number // default 30
      durationMinutes?: number // default 60
      disabled?: boolean
      label?: string
      blockedSlots?: Array<{ start_time: string; end_time: string }>
      existingAppointments?: Array<{ start_time: string; end_time: string; label?: string }>
      dutySlots?: Array<{ start_time: string; end_time: string; location_name?: string }>
      currentStartTime?: string
    }>(),
    {
      endTime: '',
      date: undefined,
      minTime: '08:00',
      maxTime: '18:00',
      stepMinutes: 30,
      durationMinutes: 60,
      disabled: false,
      label: '',
      blockedSlots: () => [],
      existingAppointments: () => [],
      dutySlots: undefined,
      currentStartTime: undefined
    }
  )

  const emit = defineEmits<{
    (e: 'update:startTime', value: string): void
    (e: 'update:endTime', value: string): void
    (e: 'change', payload: { startTime: string; endTime: string }): void
  }>()

  // ─── Helpers: Time <-> Minutes ──────────────────────────────────────────────

  const getTodayStr = (): string => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const timeToMinutes = (t: string): number => {
    if (!t) return 0
    const [h, m] = t.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  const format12H = (t: string): string => {
    if (!t) return ''
    const [hStr, mStr] = t.split(':')
    const h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10)
    if (isNaN(h)) return ''
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const normalizedStartTime = computed(() => (props.startTime || '').slice(0, 5))

  const formattedDateLabel = computed(() => {
    if (!props.date) return ''
    try {
      const [y, m, d] = props.date.split('-').map(Number)
      if (!y || !m || !d) return props.date
      const obj = new Date(y, m - 1, d)
      return obj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return props.date
    }
  })

  // ─── Available Time Slots Computation ─────────────────────────────────────────

  const isSlotPassed = (startM: number): boolean => {
    if (!props.date) return false
    const todayStr = getTodayStr()
    if (props.date < todayStr) return true
    if (props.date === todayStr) {
      const now = new Date()
      const currentM = now.getHours() * 60 + now.getMinutes()
      return startM <= currentM
    }
    return false
  }

  const availableTimeSlots = computed<TimeSlotOption[]>(() => {
    const duration = props.durationMinutes || 60
    const step = props.stepMinutes || 30
    const durationLabel = duration >= 60 ? `${Math.floor(duration / 60)} hr` : `${duration} mins`

    const isSlotBlocked = (startM: number) => {
      const endM = startM + duration
      return (props.blockedSlots || []).some((b: any) => {
        const bStart = timeToMinutes(b.start_time)
        let bEnd = timeToMinutes(b.end_time)
        if (bEnd <= bStart) {
          bEnd = 24 * 60
        }
        return startM < bEnd && endM > bStart
      })
    }

    const isSlotBooked = (startM: number) => {
      const endM = startM + duration
      return (props.existingAppointments || []).some((a: any) => {
        const aStart = timeToMinutes(a.start_time)
        let aEnd = timeToMinutes(a.end_time)
        if (aEnd <= aStart) {
          aEnd = aStart + duration
        }
        return startM < aEnd && endM > aStart
      })
    }

    const slots: TimeSlotOption[] = []
    const seenTimes = new Set<string>()

    if (props.dutySlots && props.dutySlots.length > 0) {
      props.dutySlots.forEach((duty: any) => {
        const dutyStart = timeToMinutes(duty.start_time)
        const dutyEnd = timeToMinutes(duty.end_time)
        const clinicName = duty.clinic?.name || duty.location_name || 'Clinic Duty'

        for (let m = dutyStart; m + duration <= dutyEnd; m += step) {
          const hh = String(Math.floor(m / 60)).padStart(2, '0')
          const mm = String(m % 60).padStart(2, '0')
          const time24 = `${hh}:${mm}`

          if (seenTimes.has(time24)) continue
          seenTimes.add(time24)

          const endM = m + duration
          const endHh = String(Math.floor(endM / 60)).padStart(2, '0')
          const endMm = String(endM % 60).padStart(2, '0')
          const endTime24 = `${endHh}:${endMm}`

          const passed = isSlotPassed(m)
          const isCurrent = props.currentStartTime
            ? time24 === props.currentStartTime.slice(0, 5)
            : false
          const isAvail = !passed && !isCurrent && !isSlotBlocked(m) && !isSlotBooked(m)

          slots.push({
            time24,
            endTime24,
            label: format12H(time24),
            endLabel: format12H(endTime24),
            durationLabel,
            isAvailable: isAvail,
            isCurrentApptTime: isCurrent,
            isPassed: passed,
            clinicName
          })
        }
      })
    } else {
      const startBound = timeToMinutes(props.minTime || '08:00')
      const endBound = timeToMinutes(props.maxTime || '18:00')

      for (let m = startBound; m + duration <= endBound; m += step) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0')
        const mm = String(m % 60).padStart(2, '0')
        const time24 = `${hh}:${mm}`

        if (seenTimes.has(time24)) continue
        seenTimes.add(time24)

        const endM = m + duration
        const endHh = String(Math.floor(endM / 60)).padStart(2, '0')
        const endMm = String(endM % 60).padStart(2, '0')
        const endTime24 = `${endHh}:${endMm}`

        const passed = isSlotPassed(m)
        const isCurrent = props.currentStartTime
          ? time24 === props.currentStartTime.slice(0, 5)
          : false
        const isAvail = !passed && !isCurrent && !isSlotBlocked(m) && !isSlotBooked(m)

        slots.push({
          time24,
          endTime24,
          label: format12H(time24),
          endLabel: format12H(endTime24),
          durationLabel,
          isAvailable: isAvail,
          isCurrentApptTime: isCurrent,
          isPassed: passed
        })
      }
    }

    return slots.sort((a, b) => timeToMinutes(a.time24) - timeToMinutes(b.time24))
  })

  const isSlotSelected = (slot: TimeSlotOption) => {
    return normalizedStartTime.value === slot.time24
  }

  const selectedSlotInfo = computed(() => {
    if (!normalizedStartTime.value) return null
    const found = availableTimeSlots.value.find(s => s.time24 === normalizedStartTime.value)
    if (!found || !found.isAvailable) return null
    return found
  })

  const selectTimeSlot = (slot: TimeSlotOption) => {
    if (props.disabled || !slot.isAvailable || slot.isCurrentApptTime) return
    emit('update:startTime', slot.time24)
    emit('update:endTime', slot.endTime24)
    emit('change', { startTime: slot.time24, endTime: slot.endTime24 })
  }
</script>

<template>
  <div class="w-full select-none">
    <!-- Header with label & slot counts -->
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Icon
          name="lucide:clock"
          class="text-primary text-base"
        />
        <h4 class="text-foreground text-xs font-bold tracking-wider uppercase">
          {{ label || 'Available Times' }}
        </h4>
      </div>
      <div class="flex items-center gap-2">
        <span
          v-if="formattedDateLabel"
          class="text-muted-foreground hidden text-[11px] font-medium sm:inline"
        >
          {{ formattedDateLabel }}
        </span>
        <span
          v-if="availableTimeSlots.length > 0"
          class="text-muted-foreground text-[11px] font-medium"
        >
          {{ availableTimeSlots.filter(s => s.isAvailable && !s.isCurrentApptTime).length }} slots
          available
        </span>
      </div>
    </div>

    <!-- Empty State: Date is required but not selected -->
    <div
      v-if="date === ''"
      class="border-border text-muted-foreground rounded-2xl border border-dashed p-6 text-center text-xs"
    >
      <Icon
        name="lucide:calendar"
        class="text-muted-foreground/40 mx-auto mb-2 text-2xl"
      />
      <p class="font-bold">Please select a date from the calendar</p>
      <p class="text-muted-foreground/80 mt-1 text-[11px]">
        Available consultation slots will appear here once a date is selected.
      </p>
    </div>

    <!-- Empty State: No slots available on this date -->
    <div
      v-else-if="availableTimeSlots.length === 0"
      class="border-border text-muted-foreground rounded-2xl border border-dashed p-6 text-center text-xs"
    >
      <Icon
        name="lucide:calendar-x"
        class="text-muted-foreground/40 mx-auto mb-2 text-2xl"
      />
      <p class="font-bold">No available time slots on this date.</p>
      <p class="text-muted-foreground/80 mt-1 text-[11px]">
        The doctor does not have available duty hours or all slots are booked.
      </p>
    </div>

    <!-- Time Slots Grid -->
    <div
      v-else
      class="grid max-h-[320px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3"
    >
      <button
        v-for="slot in availableTimeSlots"
        :key="slot.time24"
        type="button"
        :disabled="disabled || !slot.isAvailable || slot.isCurrentApptTime"
        @click="selectTimeSlot(slot)"
        class="relative flex flex-col items-start justify-center gap-1 rounded-xl p-3 text-left transition-all"
        :class="[
          slot.isCurrentApptTime
            ? 'cursor-not-allowed border border-amber-300/80 bg-amber-500/10 text-amber-800 opacity-90'
            : !slot.isAvailable
              ? 'bg-muted/40 text-muted-foreground/40 cursor-not-allowed border border-transparent line-through'
              : isSlotSelected(slot)
                ? 'bg-secondary ring-secondary/30 scale-[1.02] font-bold text-white shadow-md ring-2'
                : 'bg-card text-foreground hover:bg-primary/10 hover:text-primary border-border/70 cursor-pointer border shadow-xs active:scale-95'
        ]"
      >
        <div class="flex w-full items-center justify-between">
          <span class="text-xs font-bold">{{ slot.label }}</span>
          <span
            class="rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase"
            :class="
              isSlotSelected(slot) ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
            "
          >
            {{ slot.durationLabel }}
          </span>
        </div>
        <span
          class="text-[10px]"
          :class="isSlotSelected(slot) ? 'text-white/80' : 'text-muted-foreground'"
        >
          {{ slot.isPassed ? 'Passed' : `until ${slot.endLabel}` }}
        </span>
        <span
          v-if="slot.isCurrentApptTime"
          class="mt-1 rounded-full border border-amber-300/70 bg-amber-100 px-1.5 py-0.5 text-[9px] leading-none font-bold text-amber-800"
        >
          Current Time
        </span>
      </button>
    </div>

    <!-- Selected Slot Feedback Card -->
    <div
      v-if="selectedSlotInfo"
      class="bg-primary/5 border-primary/20 mt-3 flex items-center justify-between rounded-xl border px-3 py-2 text-xs"
    >
      <span class="text-muted-foreground">Selected Window:</span>
      <span class="text-primary font-bold">
        {{ selectedSlotInfo.label }} – {{ selectedSlotInfo.endLabel }} ({{
          selectedSlotInfo.durationLabel
        }})
      </span>
    </div>
  </div>
</template>
