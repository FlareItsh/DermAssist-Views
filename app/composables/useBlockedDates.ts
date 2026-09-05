import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'

export interface AvailabilitySlot {
  uuid: string
  available_date: string
  start_time: string
  end_time: string
  is_available: boolean | number
  clinic_id?: number | null
  location_name?: string | null
  clinic?: {
    id: number
    uuid: string
    name: string
    address?: string | null
    phone?: string | null
  } | null
}

export type BlockedSlot = AvailabilitySlot

/**
 * Composable for the logged-in doctor's availability slots, duty clinic locations, and blocked dates.
 *
 * State is shared globally via `useState` so multiple components stay in sync.
 */
export const useBlockedDates = () => {
  const userUuid = useCookie('user_uuid')
  const userRole = useCookie('user_role')

  const allSlots = useState<AvailabilitySlot[]>('doctor_all_avail_slots', () => [])
  const isFetchingBlocked = ref(false)

  const blockedSlots = computed(() => {
    return allSlots.value.filter(
      (slot) => Number(slot.is_available) === 0 || slot.is_available === false
    )
  })

  const dutySlots = computed(() => {
    return allSlots.value.filter(
      (slot) => Number(slot.is_available) === 1 || slot.is_available === true
    )
  })

  const fetchBlockedSlots = async () => {
    if (!userUuid.value) return
    const role = (userRole.value || '').toString().toLowerCase()
    if (!['doctor', 'secretary'].includes(role)) return

    isFetchingBlocked.value = true
    try {
      let targetUuid = userUuid.value
      if (role === 'secretary') {
        const authUser = useCookie<any>('auth_user')
        if (authUser.value?.doctor?.uuid) {
          targetUuid = authUser.value.doctor.uuid
        }
      }
      const res = await doctorAvailabilityService.listForDoctor(targetUuid)
      const list = (res as any)?.data ?? (Array.isArray(res) ? res : [])
      allSlots.value = list
    } catch (e) {
      console.error('Failed to fetch availability slots:', e)
    } finally {
      isFetchingBlocked.value = false
    }
  }

  const fetchBlockedSlotsForDoctor = async (targetDoctorUuid: string) => {
    if (!targetDoctorUuid) return
    isFetchingBlocked.value = true
    try {
      const res = await doctorAvailabilityService.listForDoctor(targetDoctorUuid)
      const list = (res as any)?.data ?? (Array.isArray(res) ? res : [])
      allSlots.value = list
    } catch (e) {
      console.error('Failed to fetch availability slots for doctor:', e)
    } finally {
      isFetchingBlocked.value = false
    }
  }

  /**
   * Normalise a date value to a YYYY-MM-DD string for consistent comparison.
   */
  const normaliseDateStr = (raw: string): string => {
    if (!raw) return ''
    return raw.slice(0, 10)
  }

  /**
   * Returns all blocked time ranges for a given date (YYYY-MM-DD).
   */
  const getBlockedTimesForDate = (dateStr: string): AvailabilitySlot[] => {
    return blockedSlots.value.filter(
      (slot) => normaliseDateStr(slot.available_date) === dateStr
    )
  }

  /**
   * Returns all active duty clinic schedules for a given date (YYYY-MM-DD).
   */
  const getDutySlotsForDate = (dateStr: string): AvailabilitySlot[] => {
    return dutySlots.value.filter(
      (slot) => normaliseDateStr(slot.available_date) === dateStr
    )
  }

  /**
   * Find matching duty clinic for a selected date and time range.
   */
  const getDutyClinicForDateAndTime = (dateStr: string, startTime: string, endTime?: string): AvailabilitySlot | null => {
    if (!dateStr || !startTime) return null
    const sStart = startTime.slice(0, 5)
    const sEnd = (endTime || startTime).slice(0, 5)

    const dayDutySlots = getDutySlotsForDate(dateStr)
    
    // First try exact overlap
    const matchingSlot = dayDutySlots.find((slot) => {
      const dStart = slot.start_time.slice(0, 5)
      const dEnd = slot.end_time.slice(0, 5)
      return sStart < dEnd && sEnd > dStart
    })

    if (matchingSlot) return matchingSlot

    // If only 1 duty slot exists on this day, fallback to that clinic
    if (dayDutySlots.length === 1) {
      return dayDutySlots[0]
    }

    return null
  }

  /**
   * Returns true when a date has any blocked period (partial or full day).
   */
  const hasBlockedTime = (dateStr: string): boolean => {
    return getBlockedTimesForDate(dateStr).length > 0
  }

  /**
   * Returns true when the whole day is effectively blocked.
   */
  const isWholeDayBlocked = (dateStr: string): boolean => {
    return getBlockedTimesForDate(dateStr).some(
      (slot) => slot.start_time <= '00:01' && slot.end_time >= '23:58'
    )
  }

  /**
   * Returns true if a specific HH:MM time falls inside any blocked range on the given date.
   */
  const isTimeBlockedOnDate = (dateStr: string, timeStr: string): boolean => {
    if (!dateStr || !timeStr) return false
    return getBlockedTimesForDate(dateStr).some(
      (slot) => timeStr >= slot.start_time.slice(0, 5) && timeStr <= slot.end_time.slice(0, 5)
    )
  }

  /**
   * Returns true if a time range [startTime, endTime] overlaps with any blocked range on the given date.
   */
  const isTimeRangeBlockedOnDate = (dateStr: string, startTime: string, endTime: string): boolean => {
    if (!dateStr || !startTime || !endTime) return false
    const sStart = startTime.slice(0, 5)
    const sEnd = endTime.slice(0, 5)
    return getBlockedTimesForDate(dateStr).some((slot) => {
      const bStart = slot.start_time.slice(0, 5)
      const bEnd = slot.end_time.slice(0, 5)
      return sStart < bEnd && sEnd > bStart
    })
  }

  /**
   * Returns true if a doctor has at least one active duty slot on the given date.
   */
  const hasDutyOnDate = (dateStr: string): boolean => {
    if (!dateStr) return false
    return getDutySlotsForDate(dateStr).length > 0
  }

  /**
   * Returns true only if the entire time range [startTime, endTime] is strictly
   * contained within a single active duty slot on that date.
   */
  const isTimeRangeWithinDutyHours = (dateStr: string, startTime: string, endTime: string): boolean => {
    if (!dateStr || !startTime || !endTime) return false
    const sStart = startTime.slice(0, 5)
    const sEnd = endTime.slice(0, 5)
    const dayDutySlots = getDutySlotsForDate(dateStr)
    if (!dayDutySlots.length) return false

    return dayDutySlots.some((slot) => {
      const dStart = slot.start_time.slice(0, 5)
      const dEnd = slot.end_time.slice(0, 5)
      return sStart >= dStart && sEnd <= dEnd
    })
  }

  /**
   * Formats 24h HH:MM to 12h representation.
   */
  const formatTime12H = (t: string): string => {
    if (!t) return ''
    const [hStr, mStr] = t.split(':')
    const h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10)
    if (isNaN(h)) return ''
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  /**
   * Human-readable label for doctor's duty hours on the selected date.
   */
  const getDutyRangesLabel = (dateStr: string): string => {
    if (!dateStr) return ''
    const slots = getDutySlotsForDate(dateStr)
    if (!slots.length) return 'Off-Duty (No duty hours)'
    return slots
      .map((s) => `${formatTime12H(s.start_time)} – ${formatTime12H(s.end_time)}`)
      .join(', ')
  }

  /**
   * Find the earliest conflict-free slot on the date that is:
   * 1. Completely within active duty hours
   * 2. Not overlapping any blocked hours (e.g. lunch break)
   * 3. Not overlapping any existing booked appointments
   */
  const findEarliestAvailableSlot = (
    dateStr: string,
    durationMinutes: number = 60,
    existingAppts: Array<{ start_time: string; end_time: string }> = []
  ): { start: string; end: string } | null => {
    if (!dateStr) return null
    const dayDutySlots = getDutySlotsForDate(dateStr)
    if (!dayDutySlots.length) return null

    const dayBlockedSlots = getBlockedTimesForDate(dateStr)

    const timeToMins = (t: string): number => {
      const [h, m] = t.slice(0, 5).split(':').map(Number)
      return (h || 0) * 60 + (m || 0)
    }

    const minsToTime = (mins: number): string => {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }

    // Iterate through duty slots in chronological order
    for (const duty of dayDutySlots) {
      const dStartMins = timeToMins(duty.start_time)
      const dEndMins = timeToMins(duty.end_time)

      // Step by 30-minute intervals
      for (let candStart = dStartMins; candStart + durationMinutes <= dEndMins; candStart += 30) {
        const candEnd = candStart + durationMinutes

        // Check blocked slot overlaps
        const hasBlocked = dayBlockedSlots.some((slot) => {
          const bStart = timeToMins(slot.start_time)
          const bEnd = timeToMins(slot.end_time)
          return candStart < bEnd && candEnd > bStart
        })
        if (hasBlocked) continue

        // Check existing appointment overlaps
        const hasAppt = existingAppts.some((appt) => {
          const aStart = timeToMins(appt.start_time)
          const aEnd = timeToMins(appt.end_time)
          return candStart < aEnd && candEnd > aStart
        })
        if (hasAppt) continue

        // Found valid earliest slot!
        return {
          start: minsToTime(candStart),
          end: minsToTime(candEnd)
        }
      }
    }

    return null
  }

  if (import.meta.client) {
    fetchBlockedSlots()
  }

  return {
    allSlots,
    blockedSlots,
    dutySlots,
    isFetchingBlocked,
    fetchBlockedSlots,
    fetchBlockedSlotsForDoctor,
    getBlockedTimesForDate,
    getDutySlotsForDate,
    getDutyClinicForDateAndTime,
    hasBlockedTime,
    isWholeDayBlocked,
    isTimeBlockedOnDate,
    isTimeRangeBlockedOnDate,
    hasDutyOnDate,
    isTimeRangeWithinDutyHours,
    getDutyRangesLabel,
    findEarliestAvailableSlot,
  }
}
