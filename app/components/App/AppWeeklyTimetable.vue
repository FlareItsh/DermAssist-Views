<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import { parseAppointmentDateTime } from '~/composables/useAppointments'
  import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'
  import { toast } from 'vue-sonner'

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
    window.addEventListener('keydown', handleWindowKeyDown)
    await Promise.all([fetchBlockedSlots(), fetchClinics()])
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleWindowKeyDown)
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

  // Convert "HH:MM" 24h format to 12-hour AM/PM format (e.g. 09:00 -> 9:00 AM, 17:00 -> 5:00 PM)
  const format12Hour = (timeStr: string) => {
    if (!timeStr) return ''
    const [hStr, mStr] = timeStr.slice(0, 5).split(':')
    let h = Number(hStr)
    const m = mStr || '00'
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return `${h}:${m} ${ampm}`
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
          formattedTime: `${format12Hour(s.start_time)} – ${format12Hour(s.end_time)}`
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
          formattedTime: `${format12Hour(s.start_time)} – ${format12Hour(s.end_time)}`
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

  const getDayDutySlots = (dateStr: string) => {
    return allSlots.value.filter(s => {
      const slotDate = (s.available_date || '').slice(0, 10)
      return slotDate === dateStr && s.is_available
    })
  }

  const hasDutySlots = (dateStr: string) => {
    return getDayDutySlots(dateStr).length > 0
  }

  // Copy Schedule Modal State & Handlers
  const showCopyModal = ref(false)
  const sourceDay = ref<any>(null)
  const sourceSlots = ref<any[]>([])
  const selectedTargetDays = ref<string[]>([])
  const repeatOption = ref<'this_week' | 'next_2_weeks' | 'next_4_weeks'>('this_week')
  const isCopying = ref(false)

  // Drag-to-Copy State & Handlers
  const draggedDuty = ref<any>(null)
  const draggedFromDate = ref<string | null>(null)
  const dragOverDate = ref<string | null>(null)
  const dragOverConflict = ref<{
    hasConflict: boolean
    reason?: string
    type?: 'duty' | 'away' | 'appointment' | null
  } | null>(null)

  // Drag-to-Copy Confirmation Modal State & Editable Hours
  const showConfirmDropModal = ref(false)
  const pendingDropDuty = ref<any>(null)
  const pendingDropTargetDate = ref<string | null>(null)
  const pendingDropDayLabel = ref<string>('')
  const pendingStartTime = ref('09:00')
  const pendingEndTime = ref('17:00')
  const isConfirmDropLoading = ref(false)

  // Enforce strictly non-upside-down times (time in must be strictly earlier than time out)
  const isTimeRangeInvalid = computed(() => {
    if (!pendingStartTime.value || !pendingEndTime.value) return true
    return pendingStartTime.value >= pendingEndTime.value
  })

  // Live conflict check on the newly edited times for target date
  const pendingTimeConflict = computed(() => {
    if (!pendingDropTargetDate.value || isTimeRangeInvalid.value) return null
    return checkDayConflict(
      pendingDropTargetDate.value,
      pendingStartTime.value,
      pendingEndTime.value
    )
  })

  // Check if a target date has any conflict with a given duty time range
  const checkDayConflict = (targetDateStr: string, startTime: string, endTime: string) => {
    const normStart = (startTime || '').slice(0, 5)
    const normEnd = (endTime || '').slice(0, 5)

    // 1. Check existing duty slots on target date
    const dutyConflict = allSlots.value.find(s => {
      const sDate = (s.available_date || '').slice(0, 10)
      const isDuty = Number(s.is_available) === 1 || s.is_available === true
      if (sDate !== targetDateStr || !isDuty) return false
      const sStart = (s.start_time || '').slice(0, 5)
      const sEnd = (s.end_time || '').slice(0, 5)
      return sStart < normEnd && sEnd > normStart
    })

    if (dutyConflict) {
      const loc = dutyConflict.clinic?.name || dutyConflict.location_name || 'Clinic Duty'
      return {
        hasConflict: true,
        type: 'duty' as const,
        reason: `Overlaps with existing duty shift (${loc}, ${(dutyConflict.start_time || '').slice(0, 5)} - ${(dutyConflict.end_time || '').slice(0, 5)})`
      }
    }

    // 2. Check existing blocked / away slots on target date
    const awayConflict = allSlots.value.find(s => {
      const sDate = (s.available_date || '').slice(0, 10)
      const isAway = Number(s.is_available) === 0 || s.is_available === false
      if (sDate !== targetDateStr || !isAway) return false
      const sStart = (s.start_time || '').slice(0, 5)
      const sEnd = (s.end_time || '').slice(0, 5)
      if (sStart <= '00:01' && sEnd >= '23:58') return true
      return sStart < normEnd && sEnd > normStart
    })

    if (awayConflict) {
      const label = awayConflict.location_name || 'Blocked / Away Period'
      return {
        hasConflict: true,
        type: 'away' as const,
        reason: `Conflicts with a blocked/away period (${label})`
      }
    }

    // 3. Check booked patient appointments on target date
    const targetAppts = getAppointmentsForDay(targetDateStr)
    const apptConflict = targetAppts.find(a => {
      return a.startTime < normEnd && a.endTime > normStart
    })

    if (apptConflict) {
      return {
        hasConflict: true,
        type: 'appointment' as const,
        reason: `Overlaps with a scheduled patient consultation (${apptConflict.startTime} - ${apptConflict.endTime})`
      }
    }

    return { hasConflict: false, type: null, reason: '' }
  }

  const isHoveringCancelZone = ref(false)

  const handleDutyDragStart = (e: DragEvent, duty: any, sourceDateStr: string) => {
    draggedDuty.value = duty
    draggedFromDate.value = sourceDateStr
    dragOverDate.value = null
    dragOverConflict.value = null
    isHoveringCancelZone.value = false
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setData(
        'text/plain',
        JSON.stringify({
          uuid: duty.uuid,
          clinic_id: duty.clinic_id,
          start_time: duty.start_time,
          end_time: duty.end_time,
          sourceDate: sourceDateStr
        })
      )
    }
  }

  const handleDutyDragEnd = () => {
    draggedDuty.value = null
    draggedFromDate.value = null
    dragOverDate.value = null
    dragOverConflict.value = null
    isHoveringCancelZone.value = false
  }

  const cancelActiveDrag = () => {
    if (draggedDuty.value) {
      toast.info('Schedule copy cancelled.')
      handleDutyDragEnd()
    }
  }

  const handleCancelZoneDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'none'
    }
    isHoveringCancelZone.value = true
  }

  const handleCancelZoneDragLeave = () => {
    isHoveringCancelZone.value = false
  }

  const handleCancelZoneDrop = (e: DragEvent) => {
    e.preventDefault()
    isHoveringCancelZone.value = false
    cancelActiveDrag()
  }

  const handleWindowKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && draggedDuty.value) {
      cancelActiveDrag()
    }
  }

  const handleDayDragOver = (e: DragEvent, dateStr: string) => {
    if (!draggedDuty.value) return
    e.preventDefault()

    // Dragging over the same day
    if (draggedFromDate.value === dateStr) {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
      dragOverDate.value = dateStr
      dragOverConflict.value = {
        hasConflict: true,
        reason: 'Cannot copy to the same day'
      }
      return
    }

    const conflict = checkDayConflict(
      dateStr,
      draggedDuty.value.start_time,
      draggedDuty.value.end_time
    )

    dragOverDate.value = dateStr
    dragOverConflict.value = conflict

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = conflict.hasConflict ? 'none' : 'copy'
    }
  }

  const handleDayDragLeave = (_e: DragEvent, dateStr: string) => {
    if (dragOverDate.value === dateStr) {
      dragOverDate.value = null
      dragOverConflict.value = null
    }
  }

  const handleDayDrop = (e: DragEvent, targetDateStr: string) => {
    e.preventDefault()
    const dutyToCopy = draggedDuty.value
    const fromDate = draggedFromDate.value

    dragOverDate.value = null
    dragOverConflict.value = null

    if (!dutyToCopy || !fromDate) return

    // Dropping on same day -> cancel silently
    if (fromDate === targetDateStr) {
      handleDutyDragEnd()
      return
    }

    const targetDayObj = weekDays.value.find(d => d.dateStr === targetDateStr)
    const targetDayLabel = targetDayObj
      ? `${targetDayObj.dayName} (${targetDayObj.monthName} ${targetDayObj.dayNumber})`
      : targetDateStr

    const conflict = checkDayConflict(targetDateStr, dutyToCopy.start_time, dutyToCopy.end_time)

    // Overlap conflict detected: block action, do not compromise backend, and notify
    if (conflict.hasConflict) {
      toast.error(
        `Cannot copy schedule to ${targetDayLabel}: ${conflict.reason}. Action cancelled.`
      )
      handleDutyDragEnd()
      return
    }

    // Safe: open confirmation modal before touching backend
    pendingDropDuty.value = dutyToCopy
    pendingDropTargetDate.value = targetDateStr
    pendingDropDayLabel.value = targetDayLabel
    pendingStartTime.value = (dutyToCopy.start_time || '09:00').slice(0, 5)
    pendingEndTime.value = (dutyToCopy.end_time || '17:00').slice(0, 5)
    showConfirmDropModal.value = true

    draggedDuty.value = null
    draggedFromDate.value = null
  }

  const closeConfirmDropModal = () => {
    showConfirmDropModal.value = false
    pendingDropDuty.value = null
    pendingDropTargetDate.value = null
    pendingDropDayLabel.value = ''
    pendingStartTime.value = '09:00'
    pendingEndTime.value = '17:00'
  }

  const executeConfirmDrop = async () => {
    if (!pendingDropDuty.value || !pendingDropTargetDate.value) return

    if (isTimeRangeInvalid.value) {
      toast.error('Time in must be strictly earlier than Time out.')
      return
    }

    if (pendingTimeConflict.value?.hasConflict) {
      toast.error(`Cannot copy: ${pendingTimeConflict.value.reason}`)
      return
    }

    const doctorUuid = useCookie('user_uuid').value
    if (!doctorUuid) {
      toast.error('Doctor profile session not found.')
      return
    }

    const dutyToCopy = pendingDropDuty.value
    const targetDateStr = pendingDropTargetDate.value
    const targetDayLabel = pendingDropDayLabel.value

    isConfirmDropLoading.value = true
    try {
      // Strictly overwrite: false to never overwrite or compromise existing slots
      await doctorAvailabilityService.createForDoctor(doctorUuid as string, {
        available_date: targetDateStr,
        start_time: pendingStartTime.value,
        end_time: pendingEndTime.value,
        is_available: 1,
        clinic_id: dutyToCopy.clinic_id || dutyToCopy.clinic?.id || null,
        location_name: dutyToCopy.location_name || dutyToCopy.clinic?.name || 'Clinic Duty',
        overwrite: false
      })

      toast.success(`Schedule copied to ${targetDayLabel}!`)
      await fetchBlockedSlots()
      closeConfirmDropModal()
    } catch (err: any) {
      if (err.statusCode === 409 || err.status === 409 || err.response?.status === 409) {
        toast.error(
          err.data?.message || 'Cannot copy: A conflicting schedule was detected on this date.'
        )
      } else {
        toast.error(err.data?.message || err.message || 'Failed to copy schedule.')
      }
    } finally {
      isConfirmDropLoading.value = false
    }
  }

  // Edit & Delete Individual Slot State
  const showEditSlotModal = ref(false)
  const slotToEdit = ref<any>(null)
  const showDeleteSlotModal = ref(false)
  const slotToDelete = ref<any>(null)
  const isDeletingSlot = ref(false)

  const formatReadableDate = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
    if (!y || !m || !d) return dateStr
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const openEditSlotModal = (slot: any, dateStr?: string) => {
    slotToEdit.value = {
      ...slot,
      available_date: (slot.available_date || dateStr || '').slice(0, 10)
    }
    showEditSlotModal.value = true
  }

  const handleEditSlotSaved = async () => {
    showEditSlotModal.value = false
    slotToEdit.value = null
    await fetchBlockedSlots()
  }

  const confirmDeleteSlot = (slot: any) => {
    slotToDelete.value = slot
    showDeleteSlotModal.value = true
  }

  const executeDeleteSlot = async () => {
    if (!slotToDelete.value?.uuid) return
    isDeletingSlot.value = true
    try {
      await doctorAvailabilityService.delete(slotToDelete.value.uuid)
      toast.success(
        slotToDelete.value.is_available
          ? 'Clinic duty shift removed successfully.'
          : 'Blocked period removed successfully.'
      )
      showDeleteSlotModal.value = false
      slotToDelete.value = null
      await fetchBlockedSlots()
    } catch (err: any) {
      console.error('Failed to delete slot:', err)
      toast.error(err.data?.message || err.message || 'Failed to remove schedule slot.')
    } finally {
      isDeletingSlot.value = false
    }
  }

  const openCopySlotModal = (duty: any, day: any) => {
    sourceDay.value = day
    sourceSlots.value = [duty]
    selectedTargetDays.value = []
    repeatOption.value = 'this_week'
    showCopyModal.value = true
  }

  const openCopyDayModal = (day: any) => {
    sourceDay.value = day
    sourceSlots.value = getDayDutySlots(day.dateStr)
    selectedTargetDays.value = []
    repeatOption.value = 'this_week'
    showCopyModal.value = true
  }

  const closeCopyModal = () => {
    showCopyModal.value = false
    sourceDay.value = null
    sourceSlots.value = []
    selectedTargetDays.value = []
  }

  const toggleTargetDate = (dateStr: string) => {
    if (selectedTargetDays.value.includes(dateStr)) {
      selectedTargetDays.value = selectedTargetDays.value.filter(d => d !== dateStr)
    } else {
      selectedTargetDays.value = [...selectedTargetDays.value, dateStr]
    }
  }

  const selectAllTargetDays = () => {
    if (!sourceDay.value) return
    selectedTargetDays.value = weekDays.value
      .filter(d => d.dateStr !== sourceDay.value.dateStr)
      .map(d => d.dateStr)
  }

  const selectWeekdayTargets = () => {
    if (!sourceDay.value) return
    selectedTargetDays.value = weekDays.value
      .filter(d => {
        const dayOfWeek = d.dateObj.getDay()
        return d.dateStr !== sourceDay.value.dateStr && dayOfWeek >= 1 && dayOfWeek <= 5
      })
      .map(d => d.dateStr)
  }

  const clearTargetDays = () => {
    selectedTargetDays.value = []
  }

  const executePasteSchedule = async () => {
    const doctorUuid = useCookie('user_uuid').value
    if (!doctorUuid) {
      toast.error('Doctor profile session not found.')
      return
    }
    if (!selectedTargetDays.value.length) {
      toast.error('Please select at least one day to paste schedule into.')
      return
    }
    if (!sourceSlots.value.length) {
      toast.error('No duty hours found to copy.')
      return
    }

    isCopying.value = true
    try {
      const allTargetDates = new Set<string>(selectedTargetDays.value)

      let additionalWeeks = 0
      if (repeatOption.value === 'next_2_weeks') additionalWeeks = 2
      if (repeatOption.value === 'next_4_weeks') additionalWeeks = 4

      if (additionalWeeks > 0) {
        for (const baseDateStr of selectedTargetDays.value) {
          const baseDate = new Date(baseDateStr + 'T00:00:00')
          for (let w = 1; w <= additionalWeeks; w++) {
            const extDate = new Date(baseDate)
            extDate.setDate(baseDate.getDate() + w * 7)
            const y = extDate.getFullYear()
            const m = String(extDate.getMonth() + 1).padStart(2, '0')
            const d = String(extDate.getDate()).padStart(2, '0')
            allTargetDates.add(`${y}-${m}-${d}`)
          }
        }
      }

      let copiedCount = 0
      let conflictCount = 0
      for (const targetDateStr of allTargetDates) {
        for (const slot of sourceSlots.value) {
          try {
            await doctorAvailabilityService.createForDoctor(doctorUuid as string, {
              available_date: targetDateStr,
              start_time: (slot.start_time || '').slice(0, 5),
              end_time: (slot.end_time || '').slice(0, 5),
              is_available: 1,
              clinic_id: slot.clinic_id || slot.clinic?.id || null,
              location_name: slot.location_name || slot.clinic?.name || 'Clinic Duty',
              overwrite: false
            })
            copiedCount++
          } catch (slotErr: any) {
            if (
              slotErr.status === 409 ||
              slotErr.statusCode === 409 ||
              slotErr.response?.status === 409
            ) {
              conflictCount++
            }
            console.error(`Failed to paste slot to ${targetDateStr}:`, slotErr)
          }
        }
      }

      if (copiedCount > 0) {
        toast.success(
          `Successfully copied schedule across ${copiedCount} slot${copiedCount === 1 ? '' : 's'}!`
        )
      }
      if (conflictCount > 0) {
        toast.warning(
          `${conflictCount} slot(s) were skipped due to schedule conflicts to protect existing hours.`
        )
      }

      toast.success(
        `Successfully copied schedule across ${allTargetDates.size} day${allTargetDates.size === 1 ? '' : 's'}!`
      )
      await fetchBlockedSlots()
      closeCopyModal()
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to copy schedule.')
    } finally {
      isCopying.value = false
    }
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
            class="group/day border-border/60 relative border-r p-2 text-center transition-colors last:border-r-0 sm:p-2.5"
            :class="day.isToday ? 'bg-primary/5' : ''"
          >
            <div class="flex items-center justify-between gap-1 px-1">
              <span
                class="block text-[11px] font-bold tracking-wider uppercase"
                :class="day.isToday ? 'text-primary' : 'text-muted-foreground'"
              >
                {{ day.dayName }}
              </span>
              <button
                v-if="hasDutySlots(day.dateStr)"
                type="button"
                @click="openCopyDayModal(day)"
                class="text-muted-foreground/50 hover:bg-primary/10 hover:text-primary cursor-pointer rounded-lg p-1 opacity-0 transition group-hover/day:opacity-100 focus:opacity-100"
                title="Copy day's schedule to other days"
              >
                <Icon
                  name="heroicons:document-duplicate"
                  class="h-3.5 w-3.5"
                />
              </button>
            </div>
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
            @dragover.prevent="handleDayDragOver($event, day.dateStr)"
            @dragleave="handleDayDragLeave($event, day.dateStr)"
            @drop.prevent="handleDayDrop($event, day.dateStr)"
            class="border-border/40 relative border-r transition-colors last:border-r-0"
            :class="[
              day.isToday ? 'bg-primary/[0.02]' : '',
              dragOverDate === day.dateStr && draggedFromDate !== day.dateStr
                ? dragOverConflict?.hasConflict
                  ? 'cursor-not-allowed bg-rose-500/10 ring-2 ring-rose-500 ring-inset'
                  : 'cursor-copy bg-emerald-500/15 ring-2 ring-emerald-500 ring-inset'
                : ''
            ]"
          >
            <!-- Drop Indicator Overlay -->
            <div
              v-if="dragOverDate === day.dateStr && draggedFromDate !== day.dateStr"
              class="animate-in fade-in zoom-in-95 pointer-events-none absolute inset-x-2 top-2 z-30 flex items-center justify-center gap-1.5 rounded-xl border py-1.5 text-xs font-bold shadow-lg backdrop-blur-xs"
              :class="
                dragOverConflict?.hasConflict
                  ? 'border-rose-400 bg-rose-600/95 text-white'
                  : 'border-emerald-400 bg-emerald-600/90 text-white'
              "
            >
              <Icon
                :name="
                  dragOverConflict?.hasConflict ? 'heroicons:no-symbol' : 'heroicons:plus-circle'
                "
                class="h-4 w-4 shrink-0"
              />
              <span class="truncate px-1">
                {{
                  dragOverConflict?.hasConflict ? 'Overlap — Not Allowed' : 'Drop to copy schedule'
                }}
              </span>
            </div>

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
              class="group/duty absolute right-1 left-1 z-5 overflow-hidden rounded-2xl border border-emerald-200/90 bg-emerald-50/90 p-2 shadow-2xs transition hover:border-emerald-300"
              :class="draggedDuty?.uuid === duty.uuid ? 'opacity-40 ring-2 ring-emerald-500' : ''"
              :style="{ top: `${duty.topPct}%`, height: `${duty.heightPct}%` }"
            >
              <!-- Top Bar: Left building icon/indicator & Right 3 Action buttons (Edit, Delete, Drag-Copy) -->
              <div class="flex items-center justify-between gap-1">
                <div class="flex items-center gap-1 text-emerald-800">
                  <Icon
                    name="heroicons:building-office-2"
                    class="h-3.5 w-3.5 shrink-0 text-emerald-600"
                  />
                </div>
                <!-- Action Buttons: 1) Edit, 2) Delete, 3) Drag Copy Paste (Last) -->
                <div class="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    @click.stop="openEditSlotModal(duty, day.dateStr)"
                    class="shrink-0 cursor-pointer rounded-lg p-1 text-emerald-700/80 transition-all hover:scale-105 hover:bg-emerald-200/80 hover:text-emerald-950"
                    title="Edit shift hours or clinic"
                  >
                    <Icon
                      name="heroicons:pencil-square"
                      class="h-3.5 w-3.5"
                    />
                  </button>
                  <button
                    type="button"
                    @click.stop="confirmDeleteSlot(duty)"
                    class="shrink-0 cursor-pointer rounded-lg p-1 text-emerald-700/80 transition-all hover:scale-105 hover:bg-rose-200/80 hover:text-rose-700"
                    title="Delete this shift"
                  >
                    <Icon
                      name="heroicons:trash"
                      class="h-3.5 w-3.5"
                    />
                  </button>
                  <button
                    type="button"
                    draggable="true"
                    @dragstart.stop="handleDutyDragStart($event, duty, day.dateStr)"
                    @dragend.stop="handleDutyDragEnd"
                    @click.stop="openCopySlotModal(duty, day)"
                    class="shrink-0 cursor-grab rounded-lg p-1 text-emerald-700/80 transition-all hover:scale-105 hover:bg-emerald-200/80 hover:text-emerald-950 active:cursor-grabbing"
                    title="Drag to copy to another day, or click to copy to multiple days"
                  >
                    <Icon
                      name="lucide:copy"
                      class="h-3.5 w-3.5"
                    />
                  </button>
                </div>
              </div>
              <!-- Text moved downward below top bar so it doesn't get overlapped by the buttons -->
              <div class="mt-1 min-w-0">
                <p class="truncate text-[11px] leading-tight font-bold text-emerald-900">
                  {{ duty.clinic?.name || duty.location_name || 'Clinic Duty' }}
                </p>
                <p class="mt-0.5 truncate text-[10px] font-medium text-emerald-700">
                  {{ duty.formattedTime }}
                </p>
              </div>
            </div>

            <!-- Layer 2: Blocked / Away Slots (Red / Pattern zone) -->
            <div
              v-for="blocked in getBlockedSlotsForDay(day.dateStr)"
              :key="blocked.uuid"
              class="absolute right-1 left-1 z-6 overflow-hidden rounded-2xl border border-rose-200/90 bg-rose-50/90 p-2 shadow-2xs"
              :style="{ top: `${blocked.topPct}%`, height: `${blocked.heightPct}%` }"
            >
              <!-- Top Bar: Left no-symbol icon & Right Action buttons (Edit, Delete) -->
              <div class="flex items-center justify-between gap-1">
                <div class="flex items-center gap-1 text-rose-800">
                  <Icon
                    name="heroicons:no-symbol"
                    class="h-3.5 w-3.5 shrink-0 text-rose-600"
                  />
                </div>
                <div class="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    @click.stop="openEditSlotModal(blocked, day.dateStr)"
                    class="shrink-0 cursor-pointer rounded-lg p-1 text-rose-700/80 transition-all hover:scale-105 hover:bg-rose-200/80 hover:text-rose-950"
                    title="Edit blocked period"
                  >
                    <Icon
                      name="heroicons:pencil-square"
                      class="h-3.5 w-3.5"
                    />
                  </button>
                  <button
                    type="button"
                    @click.stop="confirmDeleteSlot(blocked)"
                    class="shrink-0 cursor-pointer rounded-lg p-1 text-rose-700/80 transition-all hover:scale-105 hover:bg-rose-200/80 hover:text-rose-950"
                    title="Remove blocked period"
                  >
                    <Icon
                      name="heroicons:trash"
                      class="h-3.5 w-3.5"
                    />
                  </button>
                </div>
              </div>
              <!-- Text moved downward below top bar so it doesn't get overlapped by the buttons -->
              <div class="mt-1 min-w-0">
                <p class="truncate text-[11px] leading-tight font-bold text-rose-900">
                  {{ blocked.location_name || 'Blocked / Away' }}
                </p>
                <p class="mt-0.5 truncate text-[10px] font-medium text-rose-700">
                  {{ blocked.isAllDay ? 'All Day Off-Duty' : blocked.formattedTime }}
                </p>
              </div>
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
                <span>{{ format12Hour(appt.startTime) }} – {{ format12Hour(appt.endTime) }}</span>
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

    <!-- Copy Schedule Modal -->
    <Teleport to="body">
      <div
        v-if="showCopyModal"
        @click.self="closeCopyModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      >
        <div
          class="bg-card border-border animate-in fade-in zoom-in-95 w-full max-w-md space-y-4 rounded-3xl border p-6 shadow-2xl"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl"
              >
                <Icon
                  name="heroicons:document-duplicate"
                  class="h-5 w-5"
                />
              </div>
              <div>
                <h3 class="text-foreground text-base font-bold">Copy Day's Schedule</h3>
                <p class="text-muted-foreground text-xs">
                  Replicate duty hours to other days of the week.
                </p>
              </div>
            </div>
            <button
              type="button"
              @click="closeCopyModal"
              class="text-muted-foreground hover:text-foreground cursor-pointer rounded-xl p-1"
            >
              <Icon
                name="heroicons:x-mark"
                class="h-5 w-5"
              />
            </button>
          </div>

          <!-- Source Schedule Preview Card -->
          <div class="border-primary/20 bg-primary/[0.04] space-y-1.5 rounded-2xl border p-3.5">
            <div class="flex items-center justify-between">
              <span class="text-primary text-xs font-bold">
                {{ sourceDay?.dayName }}, {{ sourceDay?.monthName }} {{ sourceDay?.dayNumber }}
              </span>
              <span
                class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold"
              >
                Source Day
              </span>
            </div>
            <div
              v-for="slot in sourceSlots"
              :key="slot.id"
              class="text-foreground flex items-center gap-2 text-xs font-semibold"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span>
                {{ (slot.start_time || '').slice(0, 5) }} -
                {{ (slot.end_time || '').slice(0, 5) }}
              </span>
              <span class="text-muted-foreground font-normal">
                · {{ slot.clinic?.name || slot.location_name || 'Clinic Duty' }}
              </span>
            </div>
          </div>

          <!-- Target Days Selection -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                Paste Schedule To:
              </label>
              <div
                class="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold"
              >
                <button
                  type="button"
                  @click="selectWeekdayTargets"
                  class="bg-foreground/5 hover:bg-foreground/10 hover:text-foreground cursor-pointer rounded-md px-2 py-0.5 transition"
                >
                  Weekdays
                </button>
                <button
                  type="button"
                  @click="selectAllTargetDays"
                  class="bg-foreground/5 hover:bg-foreground/10 hover:text-foreground cursor-pointer rounded-md px-2 py-0.5 transition"
                >
                  All
                </button>
                <button
                  type="button"
                  @click="clearTargetDays"
                  class="bg-foreground/5 hover:bg-foreground/10 hover:text-foreground cursor-pointer rounded-md px-2 py-0.5 transition"
                >
                  Clear
                </button>
              </div>
            </div>

            <!-- Target Day Grid -->
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="d in weekDays.filter(day => day.dateStr !== sourceDay?.dateStr)"
                :key="d.dateStr"
                type="button"
                @click="toggleTargetDate(d.dateStr)"
                class="flex cursor-pointer flex-col items-center justify-center rounded-xl border p-2 text-xs font-bold transition-all"
                :class="
                  selectedTargetDays.includes(d.dateStr)
                    ? 'border-primary bg-primary text-primary-foreground shadow-2xs'
                    : 'border-border/60 bg-foreground/[0.02] text-muted-foreground hover:border-primary/40 hover:text-foreground'
                "
              >
                <span>{{ d.dayName }}</span>
                <span class="text-[10px] font-medium opacity-80"
                  >{{ d.monthName }} {{ d.dayNumber }}</span
                >
              </button>
            </div>
          </div>

          <!-- Repeat Duration Range -->
          <div class="space-y-1.5 pt-1">
            <label class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
              Repeat Duration:
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                @click="repeatOption = 'this_week'"
                class="cursor-pointer rounded-xl border py-2 text-center text-xs font-semibold transition"
                :class="
                  repeatOption === 'this_week'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border/60 bg-card text-muted-foreground hover:text-foreground'
                "
              >
                This Week
              </button>
              <button
                type="button"
                @click="repeatOption = 'next_2_weeks'"
                class="cursor-pointer rounded-xl border py-2 text-center text-xs font-semibold transition"
                :class="
                  repeatOption === 'next_2_weeks'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border/60 bg-card text-muted-foreground hover:text-foreground'
                "
              >
                +2 Weeks
              </button>
              <button
                type="button"
                @click="repeatOption = 'next_4_weeks'"
                class="cursor-pointer rounded-xl border py-2 text-center text-xs font-semibold transition"
                :class="
                  repeatOption === 'next_4_weeks'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border/60 bg-card text-muted-foreground hover:text-foreground'
                "
              >
                +4 Weeks
              </button>
            </div>
          </div>

          <!-- Modal Footer Actions -->
          <div class="flex items-center justify-end gap-2.5 pt-2">
            <AppButton
              type="button"
              variant="ghost"
              size="sm"
              @click="closeCopyModal"
            >
              Cancel
            </AppButton>
            <AppButton
              type="button"
              variant="solid"
              size="sm"
              :loading="isCopying"
              :disabled="!selectedTargetDays.length"
              @click="executePasteSchedule"
            >
              Paste Schedule
            </AppButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Interactive X-Circle Cancel Drop Zone (Pops up when something is being dragged) -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="draggedDuty"
          class="pointer-events-auto fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center"
        >
          <div
            @dragover.prevent="handleCancelZoneDragOver"
            @dragleave="handleCancelZoneDragLeave"
            @drop.prevent="handleCancelZoneDrop"
            @click="cancelActiveDrag"
            class="group/cancel flex cursor-pointer items-center gap-3 rounded-full border px-5 py-3 shadow-2xl transition-all duration-200 select-none"
            :class="
              isHoveringCancelZone
                ? 'scale-110 border-rose-500 bg-rose-600 text-white ring-4 shadow-rose-500/30 ring-rose-400/50'
                : 'bg-card/95 dark:bg-card/95 border-rose-300/80 text-rose-700 shadow-xl backdrop-blur-md hover:border-rose-400 dark:border-rose-800/80 dark:text-rose-400'
            "
            title="Drop here or click to cancel dragging"
          >
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full transition-transform"
              :class="
                isHoveringCancelZone ? 'scale-110 bg-white/20' : 'bg-rose-100 dark:bg-rose-950/60'
              "
            >
              <Icon
                name="heroicons:x-circle"
                class="h-6 w-6 transition-colors"
                :class="isHoveringCancelZone ? 'text-white' : 'text-rose-600 dark:text-rose-400'"
              />
            </div>
            <div class="text-left">
              <p
                class="text-xs leading-tight font-bold"
                :class="isHoveringCancelZone ? 'text-white' : 'text-foreground'"
              >
                {{ isHoveringCancelZone ? 'Release to Cancel Copy' : 'Drop Here to Cancel' }}
              </p>
              <p
                class="text-[10px] font-medium"
                :class="isHoveringCancelZone ? 'text-white/80' : 'text-muted-foreground'"
              >
                Dragging {{ format12Hour(draggedDuty.start_time) }} –
                {{ format12Hour(draggedDuty.end_time) }} • Esc to cancel
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Confirmation Modal for Drag-to-Copy Schedule -->
    <AppModalConfirmation
      v-model="showConfirmDropModal"
      title="Confirm Schedule Copy"
      confirm-text="Copy Schedule"
      cancel-text="Cancel"
      confirm-variant="solid"
      icon="heroicons:document-duplicate"
      icon-color="primary"
      :confirm-disabled="isTimeRangeInvalid || Boolean(pendingTimeConflict?.hasConflict)"
      :loading="isConfirmDropLoading"
      @confirm="executeConfirmDrop"
      @cancel="closeConfirmDropModal"
    >
      <div
        v-if="pendingDropDuty"
        class="space-y-3 text-left"
      >
        <p class="text-muted-foreground text-center text-xs">
          Confirm or customize the hours to copy to
          <strong class="text-foreground">{{ pendingDropDayLabel }}</strong
          >:
        </p>

        <div class="border-border/80 bg-foreground/[0.02] space-y-3 rounded-2xl border p-4">
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground font-medium">Clinic Location:</span>
            <span class="text-foreground font-bold">
              {{ pendingDropDuty.clinic?.name || pendingDropDuty.location_name || 'Clinic Duty' }}
            </span>
          </div>

          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground font-medium">Destination Date:</span>
            <span class="text-foreground font-bold">
              {{ pendingDropDayLabel }}
            </span>
          </div>

          <div class="border-border/60 space-y-2 border-t pt-2.5">
            <div class="flex items-center justify-between">
              <span class="text-foreground text-xs font-bold">Duty Hours (Editable):</span>
              <span
                v-if="!isTimeRangeInvalid"
                class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
              >
                {{ format12Hour(pendingStartTime) }} – {{ format12Hour(pendingEndTime) }}
              </span>
            </div>

            <!-- Editable Time In and Time Out Inputs (12-hour AM/PM Preview) -->
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Time In (Start) *
                </label>
                <input
                  v-model="pendingStartTime"
                  type="time"
                  required
                  class="w-full rounded-xl border px-3 py-2 text-xs font-bold transition-all outline-none"
                  :class="
                    isTimeRangeInvalid
                      ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-500'
                      : 'border-border bg-card text-foreground focus:border-primary'
                  "
                />
                <p class="text-muted-foreground text-[10px] font-semibold">
                  {{ format12Hour(pendingStartTime) }}
                </p>
              </div>

              <div class="space-y-1">
                <label class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Time Out (End) *
                </label>
                <input
                  v-model="pendingEndTime"
                  type="time"
                  required
                  :min="pendingStartTime"
                  class="w-full rounded-xl border px-3 py-2 text-xs font-bold transition-all outline-none"
                  :class="
                    isTimeRangeInvalid
                      ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-500'
                      : 'border-border bg-card text-foreground focus:border-primary'
                  "
                />
                <p class="text-muted-foreground text-[10px] font-semibold">
                  {{ format12Hour(pendingEndTime) }}
                </p>
              </div>
            </div>

            <!-- Inline Non-Upside-Down Error Alert -->
            <div
              v-if="isTimeRangeInvalid"
              class="flex items-center gap-1.5 rounded-xl p-2 text-[11px] font-bold text-rose-700"
            >
              <Icon
                name="heroicons:exclamation-circle"
                class="h-4 w-4 shrink-0"
              />
              <span>Time in cannot be later than or equal to Time out.</span>
            </div>

            <!-- Conflict Warning if newly edited hours overlap -->
            <div
              v-else-if="pendingTimeConflict?.hasConflict"
              class="border-warning-border bg-warning-subtle text-warning-text flex items-center gap-1.5 rounded-xl border p-2 text-[11px] font-bold"
            >
              <Icon
                name="heroicons:exclamation-triangle"
                class="h-4 w-4 shrink-0"
              />
              <span>{{ pendingTimeConflict.reason }}</span>
            </div>
          </div>
        </div>

        <p class="text-muted-foreground/80 text-center text-[11px]">
          Existing schedules and appointments on other days will remain completely unaffected.
        </p>
      </div>
    </AppModalConfirmation>

    <!-- Edit Availability Slot Modal -->
    <AppModalEditAvailability
      v-model="showEditSlotModal"
      :slot-data="slotToEdit"
      :clinics="clinics"
      @saved="handleEditSlotSaved"
    />

    <!-- Delete Slot Confirmation Modal -->
    <AppModalConfirmation
      v-model="showDeleteSlotModal"
      title="Remove Schedule Period?"
      :description="
        slotToDelete
          ? `Are you sure you want to remove this ${
              slotToDelete.is_available ? 'clinic duty shift' : 'blocked period'
            } (${formatReadableDate(slotToDelete.available_date)}, ${format12Hour(
              slotToDelete.start_time
            )} - ${format12Hour(slotToDelete.end_time)})?`
          : ''
      "
      confirm-text="Yes, Remove"
      confirm-variant="destructive"
      icon="lucide:trash-2"
      icon-color="danger"
      :loading="isDeletingSlot"
      @confirm="executeDeleteSlot"
      @cancel="showDeleteSlotModal = false"
    />
  </div>
</template>
