import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'

export interface BlockedSlot {
  uuid: string
  available_date: string
  start_time: string
  end_time: string
  is_available: boolean | number
}

/**
 * Composable for the logged-in doctor's own blocked/away availability slots.
 *
 * State is shared globally via `useState` so multiple components stay in sync.
 */
export const useBlockedDates = () => {
  const userUuid = useCookie('user_uuid')
  const userRole = useCookie('user_role')

  const blockedSlots = useState<BlockedSlot[]>('doctor_blocked_slots', () => [])
  const isFetchingBlocked = ref(false)

  const fetchBlockedSlots = async () => {
    if (!userUuid.value || userRole.value !== 'doctor') return
    isFetchingBlocked.value = true
    try {
      const res = await doctorAvailabilityService.listForDoctor(userUuid.value)
      blockedSlots.value = (res ?? []).filter(
        (slot: BlockedSlot) => Number(slot.is_available) === 0 || slot.is_available === false
      )
    } catch (e) {
      console.error('Failed to fetch blocked slots:', e)
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
  const getBlockedTimesForDate = (dateStr: string): BlockedSlot[] => {
    return blockedSlots.value.filter(
      (slot) => normaliseDateStr(slot.available_date) === dateStr
    )
  }

  /**
   * Returns true when a date has any blocked period (partial or full day).
   */
  const hasBlockedTime = (dateStr: string): boolean => {
    return getBlockedTimesForDate(dateStr).length > 0
  }

  /**
   * Returns true when the whole day is effectively blocked
   * (a slot spanning 00:00–23:59, or start_time = '00:00' and end_time = '23:59').
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

  if (import.meta.client) {
    fetchBlockedSlots()
  }

  return {
    blockedSlots,
    isFetchingBlocked,
    fetchBlockedSlots,
    getBlockedTimesForDate,
    hasBlockedTime,
    isWholeDayBlocked,
    isTimeBlockedOnDate,
    isTimeRangeBlockedOnDate,
  }
}
