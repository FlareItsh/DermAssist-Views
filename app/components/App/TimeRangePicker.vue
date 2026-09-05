<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    startTime: string // e.g. "09:00"
    endTime: string // e.g. "10:00"
    minTime?: string // default "07:00"
    maxTime?: string // default "20:00"
    stepMinutes?: number // default 30
    disabled?: boolean
    label?: string
    blockedSlots?: Array<{ start_time: string; end_time: string }>
    existingAppointments?: Array<{ start_time: string; end_time: string; label?: string }>
    dutySlots?: Array<{ start_time: string; end_time: string; location_name?: string }>
  }>(),
  {
    minTime: '07:00',
    maxTime: '20:00',
    stepMinutes: 30,
    disabled: false,
    label: '',
    blockedSlots: () => [],
    existingAppointments: () => [],
    dutySlots: undefined
  }
)

const emit = defineEmits<{
  (e: 'update:startTime', value: string): void
  (e: 'update:endTime', value: string): void
  (e: 'change', payload: { startTime: string; endTime: string }): void
}>()

// ─── Helpers: Time <-> Minutes ──────────────────────────────────────────────

const timeToMinutes = (t: string): number => {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const minutesToTime = (mins: number): string => {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, mins))
  const h = Math.floor(clamped / 60)
  const m = Math.round(clamped % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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

const snapToStep = (mins: number, step = 30): number => {
  return Math.round(mins / step) * step
}

// ─── Bounds Computation ──────────────────────────────────────────────────────

const effectiveMinMins = computed(() => {
  const propMin = timeToMinutes(props.minTime)
  const curStart = timeToMinutes(props.startTime)
  return Math.min(propMin, Math.floor(curStart / 60) * 60)
})

const effectiveMaxMins = computed(() => {
  const propMax = timeToMinutes(props.maxTime)
  const curEnd = timeToMinutes(props.endTime)
  return Math.max(propMax, Math.ceil(curEnd / 60) * 60)
})

const totalRangeMins = computed(() => Math.max(60, effectiveMaxMins.value - effectiveMinMins.value))

// Generate hourly ticks along the timeline
const ticks = computed(() => {
  const result: { mins: number; label: string; percent: number }[] = []
  const step = 60 // Hourly major ticks
  for (let m = effectiveMinMins.value; m <= effectiveMaxMins.value; m += step) {
    const pct = ((m - effectiveMinMins.value) / totalRangeMins.value) * 100
    const h = Math.floor(m / 60)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    const label = `${hour12} ${ampm}`
    result.push({ mins: m, label, percent: pct })
  }
  return result
})

// ─── Current Selection Range State ───────────────────────────────────────────

const startMins = computed(() => timeToMinutes(props.startTime))
const endMins = computed(() => timeToMinutes(props.endTime))

const startPercent = computed(() => {
  const p = ((startMins.value - effectiveMinMins.value) / totalRangeMins.value) * 100
  return Math.max(0, Math.min(100, p))
})

const endPercent = computed(() => {
  const p = ((endMins.value - effectiveMinMins.value) / totalRangeMins.value) * 100
  return Math.max(0, Math.min(100, p))
})

const durationText = computed(() => {
  const diff = endMins.value - startMins.value
  if (diff <= 0) return 'Invalid range'
  const hours = Math.floor(diff / 60)
  const mins = diff % 60
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
  if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''}`
  return `${mins} mins`
})

// ─── Blocked Slots & Existing Appointments Visual Overlays & Conflict Detection ──────────

const blockedVisualRanges = computed(() => {
  if (!props.blockedSlots || !props.blockedSlots.length) return []
  return props.blockedSlots
    .map((slot) => {
      const sMins = Math.max(effectiveMinMins.value, timeToMinutes(slot.start_time.slice(0, 5)))
      const eMins = Math.min(effectiveMaxMins.value, timeToMinutes(slot.end_time.slice(0, 5)))
      if (eMins <= sMins) return null
      const leftPct = ((sMins - effectiveMinMins.value) / totalRangeMins.value) * 100
      const rightPct = 100 - (((eMins - effectiveMinMins.value) / totalRangeMins.value) * 100)
      return {
        leftPct: Math.max(0, Math.min(100, leftPct)),
        rightPct: Math.max(0, Math.min(100, rightPct)),
        label: `${format12H(slot.start_time)} – ${format12H(slot.end_time)}`
      }
    })
    .filter(Boolean) as { leftPct: number; rightPct: number; label: string }[]
})

const appointmentVisualRanges = computed(() => {
  if (!props.existingAppointments || !props.existingAppointments.length) return []
  return props.existingAppointments
    .map((slot) => {
      const sMins = Math.max(effectiveMinMins.value, timeToMinutes(slot.start_time.slice(0, 5)))
      const eMins = Math.min(effectiveMaxMins.value, timeToMinutes(slot.end_time.slice(0, 5)))
      if (eMins <= sMins) return null
      const leftPct = ((sMins - effectiveMinMins.value) / totalRangeMins.value) * 100
      const rightPct = 100 - (((eMins - effectiveMinMins.value) / totalRangeMins.value) * 100)
      return {
        leftPct: Math.max(0, Math.min(100, leftPct)),
        rightPct: Math.max(0, Math.min(100, rightPct)),
        label: `${format12H(slot.start_time)} – ${format12H(slot.end_time)}${slot.label ? ' (' + slot.label + ')' : ''}`
      }
    })
    .filter(Boolean) as { leftPct: number; rightPct: number; label: string }[]
})

const dutyVisualRanges = computed(() => {
  if (!props.dutySlots || !props.dutySlots.length) return []
  return props.dutySlots
    .map((slot) => {
      const sMins = Math.max(effectiveMinMins.value, timeToMinutes(slot.start_time.slice(0, 5)))
      const eMins = Math.min(effectiveMaxMins.value, timeToMinutes(slot.end_time.slice(0, 5)))
      if (eMins <= sMins) return null
      const leftPct = ((sMins - effectiveMinMins.value) / totalRangeMins.value) * 100
      const rightPct = 100 - (((eMins - effectiveMinMins.value) / totalRangeMins.value) * 100)
      return {
        leftPct: Math.max(0, Math.min(100, leftPct)),
        rightPct: Math.max(0, Math.min(100, rightPct)),
        label: `${format12H(slot.start_time)} – ${format12H(slot.end_time)}${slot.location_name ? ' (' + slot.location_name + ')' : ''}`
      }
    })
    .filter(Boolean) as { leftPct: number; rightPct: number; label: string }[]
})

const isInsideDuty = computed(() => {
  if (props.dutySlots === undefined) return true
  if (!props.dutySlots.length) return false
  const curStart = startMins.value
  const curEnd = endMins.value
  return props.dutySlots.some((slot) => {
    const dStart = timeToMinutes(slot.start_time.slice(0, 5))
    const dEnd = timeToMinutes(slot.end_time.slice(0, 5))
    return curStart >= dStart && curEnd <= dEnd
  })
})

const hasDutyConflict = computed(() => props.dutySlots !== undefined && !isInsideDuty.value)

const hasBlockedConflict = computed(() => {
  if (!props.blockedSlots || !props.blockedSlots.length) return false
  const curStart = startMins.value
  const curEnd = endMins.value
  return props.blockedSlots.some((slot) => {
    const bStart = timeToMinutes(slot.start_time.slice(0, 5))
    const bEnd = timeToMinutes(slot.end_time.slice(0, 5))
    return curStart < bEnd && curEnd > bStart
  })
})

const hasApptConflict = computed(() => {
  if (!props.existingAppointments || !props.existingAppointments.length) return false
  const curStart = startMins.value
  const curEnd = endMins.value
  return props.existingAppointments.some((slot) => {
    const aStart = timeToMinutes(slot.start_time.slice(0, 5))
    const aEnd = timeToMinutes(slot.end_time.slice(0, 5))
    return curStart < aEnd && curEnd > aStart
  })
})

const conflictReason = computed(() => {
  if (hasDutyConflict.value) {
    if (props.dutySlots && props.dutySlots.length === 0) {
      return 'Off-Duty (No Duty Hours)'
    }
    return 'Outside Duty Hours'
  }
  if (hasBlockedConflict.value) return 'Overlaps Blocked Hours'
  if (hasApptConflict.value) return 'Overlaps Booked Appointment'
  return ''
})

const hasConflict = computed(() => hasBlockedConflict.value || hasApptConflict.value || hasDutyConflict.value)

// ─── Custom Time Inputs (Two-Way Binding) ────────────────────────────────────

const localStart = ref(props.startTime)
const localEnd = ref(props.endTime)

watch(
  () => props.startTime,
  (val) => {
    if (val !== localStart.value) localStart.value = val
  }
)
watch(
  () => props.endTime,
  (val) => {
    if (val !== localEnd.value) localEnd.value = val
  }
)

const handleInputStartChange = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  localStart.value = val
  emit('update:startTime', val)
  emit('change', { startTime: val, endTime: props.endTime })
}

const handleInputEndChange = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  localEnd.value = val
  emit('update:endTime', val)
  emit('change', { startTime: props.startTime, endTime: val })
}

// ─── Quick Presets ────────────────────────────────────────────────────────────

const applyDurationPreset = (minutesDuration: number) => {
  if (props.disabled) return
  let newStart = startMins.value
  let newEnd = newStart + minutesDuration
  if (newEnd > effectiveMaxMins.value) {
    newEnd = effectiveMaxMins.value
    newStart = Math.max(effectiveMinMins.value, newEnd - minutesDuration)
  }
  const sStr = minutesToTime(newStart)
  const eStr = minutesToTime(newEnd)
  localStart.value = sStr
  localEnd.value = eStr
  emit('update:startTime', sStr)
  emit('update:endTime', eStr)
  emit('change', { startTime: sStr, endTime: eStr })
}

const applyFullDayPreset = () => {
  if (props.disabled) return
  const sStr = '00:00'
  const eStr = '23:59'
  localStart.value = sStr
  localEnd.value = eStr
  emit('update:startTime', sStr)
  emit('update:endTime', eStr)
  emit('change', { startTime: sStr, endTime: eStr })
}

// ─── Drag & Pointer Interaction Engine ───────────────────────────────────────

const trackRef = ref<HTMLElement | null>(null)
const activeDrag = ref<'start' | 'end' | 'middle' | null>(null)
const dragStartMouseX = ref(0)
const initialStartMins = ref(0)
const initialEndMins = ref(0)
const activeTooltipTime = ref<string | null>(null)

const getMinsFromEvent = (e: PointerEvent): number => {
  if (!trackRef.value) return effectiveMinMins.value
  const rect = trackRef.value.getBoundingClientRect()
  const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const ratio = offsetX / rect.width
  const rawMins = effectiveMinMins.value + ratio * totalRangeMins.value
  const snapped = snapToStep(rawMins, props.stepMinutes)
  return Math.max(effectiveMinMins.value, Math.min(effectiveMaxMins.value, snapped))
}

const onPointerDownStartHandle = (e: PointerEvent) => {
  if (props.disabled) return
  e.stopPropagation()
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  activeDrag.value = 'start'
  activeTooltipTime.value = props.startTime
}

const onPointerDownEndHandle = (e: PointerEvent) => {
  if (props.disabled) return
  e.stopPropagation()
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  activeDrag.value = 'end'
  activeTooltipTime.value = props.endTime
}

const onPointerDownMiddle = (e: PointerEvent) => {
  if (props.disabled) return
  e.stopPropagation()
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  activeDrag.value = 'middle'
  dragStartMouseX.value = e.clientX
  initialStartMins.value = startMins.value
  initialEndMins.value = endMins.value
  activeTooltipTime.value = `${props.startTime} - ${props.endTime}`
}

const onTrackClick = (e: PointerEvent) => {
  if (props.disabled || activeDrag.value) return
  const clickedMins = getMinsFromEvent(e)
  const duration = Math.max(props.stepMinutes, endMins.value - startMins.value)
  
  // Decide whether to move start or end handle, or center range on click
  let newStart = clickedMins
  let newEnd = clickedMins + duration
  if (newEnd > effectiveMaxMins.value) {
    newEnd = effectiveMaxMins.value
    newStart = Math.max(effectiveMinMins.value, newEnd - duration)
  }
  
  const sStr = minutesToTime(newStart)
  const eStr = minutesToTime(newEnd)
  localStart.value = sStr
  localEnd.value = eStr
  emit('update:startTime', sStr)
  emit('update:endTime', eStr)
  emit('change', { startTime: sStr, endTime: eStr })
}

const onPointerMove = (e: PointerEvent) => {
  if (!activeDrag.value || !trackRef.value) return

  if (activeDrag.value === 'start') {
    const newMins = getMinsFromEvent(e)
    // Start must be before end by at least stepMinutes
    const maxAllowedStart = endMins.value - props.stepMinutes
    const clampedStart = Math.min(newMins, maxAllowedStart)
    const sStr = minutesToTime(clampedStart)
    localStart.value = sStr
    activeTooltipTime.value = format12H(sStr)
    emit('update:startTime', sStr)
    emit('change', { startTime: sStr, endTime: props.endTime })
  } else if (activeDrag.value === 'end') {
    const newMins = getMinsFromEvent(e)
    // End must be after start by at least stepMinutes
    const minAllowedEnd = startMins.value + props.stepMinutes
    const clampedEnd = Math.max(newMins, minAllowedEnd)
    const eStr = minutesToTime(clampedEnd)
    localEnd.value = eStr
    activeTooltipTime.value = format12H(eStr)
    emit('update:endTime', eStr)
    emit('change', { startTime: props.startTime, endTime: eStr })
  } else if (activeDrag.value === 'middle') {
    const rect = trackRef.value.getBoundingClientRect()
    const deltaX = e.clientX - dragStartMouseX.value
    const deltaMinsRaw = (deltaX / rect.width) * totalRangeMins.value
    const deltaMins = snapToStep(deltaMinsRaw, props.stepMinutes)
    const duration = initialEndMins.value - initialStartMins.value

    let newStart = initialStartMins.value + deltaMins
    let newEnd = initialEndMins.value + deltaMins

    if (newStart < effectiveMinMins.value) {
      newStart = effectiveMinMins.value
      newEnd = newStart + duration
    }
    if (newEnd > effectiveMaxMins.value) {
      newEnd = effectiveMaxMins.value
      newStart = newEnd - duration
    }

    const sStr = minutesToTime(newStart)
    const eStr = minutesToTime(newEnd)
    localStart.value = sStr
    localEnd.value = eStr
    activeTooltipTime.value = `${format12H(sStr)} – ${format12H(eStr)}`
    emit('update:startTime', sStr)
    emit('update:endTime', eStr)
    emit('change', { startTime: sStr, endTime: eStr })
  }
}

const onPointerUp = (e: PointerEvent) => {
  if (activeDrag.value) {
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
    activeDrag.value = null
    activeTooltipTime.value = null
  }
}
</script>

<template>
  <div
    class="time-range-picker flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/50 to-white p-4 shadow-sm"
    :class="{ 'opacity-60 pointer-events-none': disabled }"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Icon name="material-symbols:schedule-rounded" class="text-indigo-600 text-lg shrink-0" />
        <span class="text-xs font-extrabold uppercase tracking-wider text-gray-700">
          {{ label || 'Time Range Selection' }}
        </span>
        <span
          class="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 shadow-xs"
        >
          {{ durationText }}
        </span>
      </div>

      <!-- Quick Preset Buttons (30m, 1h, 2h, Full Day) -->
      <div class="flex items-center gap-1">
        <button
          type="button"
          @click="applyDurationPreset(30)"
          class="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 transition-all hover:bg-indigo-50 active:scale-95 cursor-pointer"
        >
          30m
        </button>
        <button
          type="button"
          @click="applyDurationPreset(60)"
          class="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 transition-all hover:bg-indigo-50 active:scale-95 cursor-pointer"
        >
          1h
        </button>
        <button
          type="button"
          @click="applyDurationPreset(120)"
          class="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 transition-all hover:bg-indigo-50 active:scale-95 cursor-pointer"
        >
          2h
        </button>
        <button
          type="button"
          @click="applyFullDayPreset"
          class="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 transition-all hover:bg-indigo-50 active:scale-95 cursor-pointer"
          title="Select full day range"
        >
          Full Day
        </button>
      </div>
    </div>

    <!-- Custom Time Input Fields (Allows manual custom time entry) -->
    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-bold uppercase tracking-wider text-gray-500">Start Time</label>
        <div class="relative flex items-center">
          <input
            type="time"
            :value="localStart"
            @input="handleInputStartChange"
            :disabled="disabled"
            class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs cursor-text hover:cursor-text"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-bold uppercase tracking-wider text-gray-500">End Time</label>
        <div class="relative flex items-center">
          <input
            type="time"
            :value="localEnd"
            @input="handleInputEndChange"
            :disabled="disabled"
            class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs cursor-text hover:cursor-text"
          />
        </div>
      </div>
    </div>

    <!-- Visual Interactive Timeline Range Drag Bar -->
    <div class="mt-2 flex flex-col gap-1 select-none">
      <!-- Time Ticks Header -->
      <div class="relative h-5 w-full text-[10px] font-semibold text-gray-400">
        <div
          v-for="tick in ticks"
          :key="tick.mins"
          class="absolute top-0 -translate-x-1/2 flex flex-col items-center"
          :style="{ left: `${tick.percent}%` }"
        >
          <span>{{ tick.label }}</span>
          <div class="h-1.5 w-0.5 bg-gray-300 rounded-full mt-0.5"></div>
        </div>
      </div>

      <!-- Main Slider Track -->
      <div
        ref="trackRef"
        class="relative h-12 w-full rounded-2xl overflow-hidden bg-gray-200/80 border border-gray-300/50 shadow-inner cursor-pointer touch-none"
        @pointerdown="onTrackClick"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      >
        <!-- 30-min Sub-tick guides inside track -->
        <div class="absolute inset-0 flex items-center pointer-events-none overflow-hidden rounded-2xl">
          <div
            v-for="m in Math.floor(totalRangeMins / stepMinutes)"
            :key="m"
            class="h-full border-r border-gray-300/30"
            :style="{ width: `${(stepMinutes / totalRangeMins) * 100}%` }"
          ></div>
        </div>

        <!-- Visually Rendered Active Doctor Duty Windows (Subtle Emerald Tint) -->
        <div
          v-for="(d, idx) in dutyVisualRanges"
          :key="'duty-' + idx"
          class="absolute top-0 bottom-0 z-5 pointer-events-none rounded-2xl overflow-hidden border border-emerald-500/30 bg-emerald-500/10"
          :style="{ left: `${d.leftPct}%`, right: `${d.rightPct}%` }"
          :title="`Duty Hours: ${d.label}`"
        >
          <div class="absolute top-1 left-2 text-[9px] font-black uppercase tracking-wider text-emerald-700/70 pointer-events-none">
            Duty Shift
          </div>
        </div>

        <!-- Visually Rendered Blocked Slots (Red Striped Overlays on Track) -->
        <div
          v-for="(b, idx) in blockedVisualRanges"
          :key="'block-' + idx"
          class="absolute top-0 bottom-0 z-10 pointer-events-none rounded-2xl overflow-hidden border border-red-500/40"
          :style="{ left: `${b.leftPct}%`, right: `${b.rightPct}%` }"
          :title="`Blocked: ${b.label}`"
        >
          <div class="w-full h-full bg-red-500/20 bg-[linear-gradient(45deg,rgba(239,68,68,0.25)_25%,transparent_25%,transparent_50%,rgba(239,68,68,0.25)_50%,rgba(239,68,68,0.25)_75%,transparent_75%,transparent)] bg-[length:10px_10px]"></div>
        </div>

        <!-- Visually Rendered Existing Booked Appointments (Amber Striped Overlays on Track) -->
        <div
          v-for="(a, idx) in appointmentVisualRanges"
          :key="'appt-' + idx"
          class="absolute top-0 bottom-0 z-10 pointer-events-none rounded-2xl overflow-hidden border border-amber-500/50"
          :style="{ left: `${a.leftPct}%`, right: `${a.rightPct}%` }"
          :title="`Booked Appointment: ${a.label}`"
        >
          <div class="w-full h-full bg-amber-500/20 bg-[linear-gradient(45deg,rgba(245,158,11,0.25)_25%,transparent_25%,transparent_50%,rgba(245,158,11,0.25)_50%,rgba(245,158,11,0.25)_75%,transparent_75%,transparent)] bg-[length:10px_10px]"></div>
        </div>

        <!-- Draggable Selection Band (Active Range) -->
        <div
          class="absolute top-1 bottom-1 z-20 rounded-xl shadow-md flex items-center justify-between border cursor-grab active:cursor-grabbing transition-all group"
          :class="
            hasConflict
              ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600 border-red-500 ring-2 ring-red-400/50'
              : 'bg-gradient-to-r from-indigo-600 via-blue-500 to-indigo-600 border-indigo-400/40'
          "
          :style="{ left: `${startPercent}%`, right: `${100 - endPercent}%` }"
          @pointerdown="onPointerDownMiddle"
        >

          <div
            class="absolute -left-2 top-1/2 -translate-y-1/2 z-30 h-8 w-3 rounded-md bg-white border-2 shadow-md flex items-center justify-center cursor-ew-resize hover:scale-110 active:scale-95 transition-transform"
            :class="hasConflict ? 'border-red-600 text-red-600' : 'border-indigo-600 text-indigo-600'"
            title="Drag to change Start Time (30-min steps)"
            @pointerdown="onPointerDownStartHandle"
          >
            <div class="w-0.5 h-3.5 bg-current rounded-full"></div>
          </div>

          <div class="w-full text-center px-2 truncate pointer-events-none flex items-center justify-center gap-1.5">
            <Icon v-if="hasConflict" name="material-symbols:block-rounded" class="text-white text-sm shrink-0 animate-pulse" />
            <span class="text-[11px] font-extrabold text-white tracking-wide drop-shadow-sm">
              {{ format12H(localStart) }} – {{ format12H(localEnd) }}
            </span>
            <span v-if="hasConflict && conflictReason" class="text-[9px] font-extrabold bg-black/40 px-1.5 py-0.5 rounded-full text-red-100 uppercase tracking-tight">
              {{ conflictReason }}
            </span>
          </div>

          <div
            class="absolute -right-2 top-1/2 -translate-y-1/2 z-30 h-8 w-3 rounded-md bg-white border-2 shadow-md flex items-center justify-center cursor-ew-resize hover:scale-110 active:scale-95 transition-transform"
            :class="hasConflict ? 'border-red-600 text-red-600' : 'border-indigo-600 text-indigo-600'"
            title="Drag to change End Time (30-min steps)"
            @pointerdown="onPointerDownEndHandle"
          >
            <div class="w-0.5 h-3.5 bg-current rounded-full"></div>
          </div>
        </div>

        <!-- Floating Tooltip when Dragging -->
        <Transition name="fade">
          <div
            v-if="activeTooltipTime"
            class="absolute -top-10 left-1/2 -translate-x-1/2 z-40 rounded-xl px-3 py-1 text-xs font-bold text-white shadow-xl flex items-center gap-1.5 border pointer-events-none whitespace-nowrap"
            :class="hasConflict ? 'bg-red-950 border-red-700' : 'bg-gray-900 border-gray-700'"
          >
            <Icon name="material-symbols:drag-pan-rounded" :class="hasConflict ? 'text-red-400' : 'text-indigo-400'" class="text-sm" />
            <span>{{ activeTooltipTime }}</span>
            <span v-if="hasConflict && conflictReason" class="text-[10px] text-red-300 font-semibold">({{ conflictReason }})</span>
          </div>
        </Transition>
      </div>

      <div class="flex flex-col gap-1 mt-1 px-1">

        <div class="flex items-center justify-between text-[10px] font-semibold text-gray-400">
          <span>Drag handles or middle band to snap 30 mins</span>
          <span>Snaps: :00, :30</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
input[type='time']::-webkit-calendar-picker-indicator,
input[type='time']::-webkit-inner-spin-button,
input[type='time']::-webkit-clear-button {
  display: none !important;
  -webkit-appearance: none !important;
}
input[type='time'] {
  cursor: text !important;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px);
}
</style>
