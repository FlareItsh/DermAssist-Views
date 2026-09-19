<script setup lang="ts">
  import { ref, computed, onMounted, nextTick } from 'vue'
  import { toast } from 'vue-sonner'
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'
  import { parseAppointmentDateTime, type Appointment } from '~/composables/useAppointments'

  const props = defineProps<{
    appointment: Appointment
  }>()

  const emit = defineEmits<{
    (e: 'close'): void
    (e: 'requested'): void
  }>()

  // ── State ────────────────────────────────────────────────────────────────────

  const selectedDate = ref<string>('')
  const selectedTime = ref<string>('')
  const isSubmitting = ref(false)
  const isLoading = ref(true)

  /** Blocked dates & slot objects for this appointment's doctor. */
  const doctorBlockedDates = ref<string[]>([])
  const doctorBlockedSlots = ref<any[]>([])
  const doctorDutySlots = ref<any[]>([])
  /** Appointment records for this appointment's doctor. */
  const doctorAppointmentsList = ref<any[]>([])

  // ── Current appointment schedule details ─────────────────────────────────────

  const currentApptParsed = computed(() => {
    if (props.appointment?.raw_scheduled_at) {
      return parseAppointmentDateTime(props.appointment.raw_scheduled_at)
    }
    if (props.appointment?.previous_scheduled_at) {
      return parseAppointmentDateTime(props.appointment.previous_scheduled_at)
    }
    if (props.appointment?.date) {
      let startH = '00'
      let startM = '00'
      if (props.appointment.time) {
        const match = props.appointment.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
        if (match) {
          let h = parseInt(match[1], 10)
          const m = match[2]
          const ampm = match[3]?.toUpperCase()
          if (ampm === 'PM' && h < 12) h += 12
          if (ampm === 'AM' && h === 12) h = 0
          startH = String(h).padStart(2, '0')
          startM = m
        }
      }
      return {
        date: props.appointment.date,
        time: props.appointment.time || '',
        startH,
        startM
      }
    }
    return null
  })

  const currentApptDate = computed(() => currentApptParsed.value?.date || '')
  const currentApptTime24 = computed(() => {
    if (!currentApptParsed.value) return ''
    return `${currentApptParsed.value.startH}:${currentApptParsed.value.startM}`
  })

  // ── Calendar nav ──────────────────────────────────────────────────────────────

  const today = (() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()

  const currentDate = ref(new Date())
  const hoveredDate = ref<string | null>(null)
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const { fetchAppointmentsForDoctor } = useAppointments()

  // ── Load doctor availability & duty schedule ──────────────────────────────────

  onMounted(async () => {
    isLoading.value = true
    try {
      const doctorUuid = props.appointment.doctor_uuid
      const doctorId = props.appointment.doctor_id

      if (doctorUuid) {
        const res = await doctorAvailabilityService.listForDoctor(doctorUuid)
        const list = (res as any)?.data ?? (Array.isArray(res) ? res : [])

        doctorBlockedSlots.value = list.filter(
          (s: any) => Number(s.is_available) === 0 || s.is_available === false
        )
        // Only explicit whole-day blocks (00:00 to 23:59) that are not routine rest days count as blocked dates
        doctorBlockedDates.value = doctorBlockedSlots.value
          .filter((s: any) => {
            const isWholeDay =
              (s.start_time <= '00:01:00' || s.start_time <= '00:01') &&
              (s.end_time >= '23:58:00' || s.end_time >= '23:58')
            const loc = (s.location_name || '').toLowerCase()
            const isRestDay =
              loc.includes('rest day') || loc.includes('weekend') || loc.includes('off-duty')
            return isWholeDay && !isRestDay
          })
          .map((s: any) => s.available_date?.slice(0, 10))
          .filter(Boolean)

        doctorDutySlots.value = list.filter(
          (s: any) => Number(s.is_available) === 1 || s.is_available === true
        )
      }

      if (doctorId) {
        const appts = await fetchAppointmentsForDoctor(doctorId)
        if (appts && appts.length > 0) {
          doctorAppointmentsList.value = appts
        }
      }
    } catch (e) {
      console.error('Failed to load doctor availability:', e)
    } finally {
      isLoading.value = false
    }
  })

  // ── Calendar computed ─────────────────────────────────────────────────────────

  const currentMonthName = computed(() =>
    currentDate.value.toLocaleString('default', { month: 'long' })
  )
  const currentYear = computed(() => currentDate.value.getFullYear())

  const daysInMonth = computed(() =>
    new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 0).getDate()
  )

  const startingDayOffset = computed(() =>
    new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 1).getDay()
  )

  const isPrevMonthDisabled = computed(() => {
    const min = new Date(today)
    return (
      currentDate.value.getFullYear() < min.getFullYear() ||
      (currentDate.value.getFullYear() === min.getFullYear() &&
        currentDate.value.getMonth() <= min.getMonth())
    )
  })

  const dateStringFor = (day: number): string => {
    const year = currentDate.value.getFullYear()
    const month = String(currentDate.value.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}-${String(day).padStart(2, '0')}`
  }

  const isPast = (day: number): boolean => dateStringFor(day) < today
  const isToday = (day: number): boolean => dateStringFor(day) === today

  /** Utility: 'HH:mm' or 'HH:mm:ss' to total minutes from midnight */
  const toMins = (t: string): number => {
    if (!t) return 0
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  /** Get duty slots for a specific date string */
  const getDutyForDate = (dateStr: string) => {
    return doctorDutySlots.value.filter((s: any) => s.available_date?.slice(0, 10) === dateStr)
  }

  /** Get blocked slots for a specific date string */
  const getBlockedForDate = (dateStr: string) => {
    return doctorBlockedSlots.value.filter((s: any) => s.available_date?.slice(0, 10) === dateStr)
  }

  /** True when the doctor has active clinic duty hours on this date. */
  const isDoctorOnDuty = (day: number): boolean => {
    return getDutyForDate(dateStringFor(day)).length > 0
  }

  /** True if the doctor has defined duty schedules anywhere in the calendar */
  const hasAnyDutyConfigured = computed(() => doctorDutySlots.value.length > 0)

  /** Check if a date has at least one selectable consultation slot */
  const hasAvailableSlotOnDate = (day: number): boolean => {
    const dateStr = dateStringFor(day)
    const dayDuties = getDutyForDate(dateStr)
    if (!dayDuties.length) return false

    const dayBlocked = getBlockedForDate(dateStr)
    const DURATION_MINS = 60

    const dayBookedAppts = doctorAppointmentsList.value.filter((a: any) => {
      const apptDate = a.date || a.raw_scheduled_at?.slice(0, 10)
      return apptDate === dateStr && a.status !== 'declined' && a.id !== props.appointment.id
    })

    for (const duty of dayDuties) {
      const dutyStart = toMins(duty.start_time)
      const dutyEnd = toMins(duty.end_time)

      for (let m = dutyStart; m + DURATION_MINS <= dutyEnd; m += 30) {
        const endM = m + DURATION_MINS

        // Check if overlaps any blocked slot (e.g. lunch break)
        const isBlocked = dayBlocked.some((b: any) => {
          const bStart = toMins(b.start_time)
          const bEnd = toMins(b.end_time)
          return m < bEnd && endM > bStart
        })
        if (isBlocked) continue

        // Check if overlaps another booked appointment
        const isBooked = dayBookedAppts.some((a: any) => {
          if (a.raw_scheduled_at) {
            const p = parseAppointmentDateTime(a.raw_scheduled_at)
            const apptStart = parseInt(p.startH, 10) * 60 + parseInt(p.startM, 10)
            let apptEnd = apptStart + DURATION_MINS
            if (a.raw_scheduled_end_at) {
              const pEnd = parseAppointmentDateTime(a.raw_scheduled_end_at)
              const parsedEnd = parseInt(pEnd.startH, 10) * 60 + parseInt(pEnd.startM, 10)
              if (parsedEnd > apptStart) apptEnd = parsedEnd
            }
            return m < apptEnd && endM > apptStart
          }
          return false
        })
        if (isBooked) continue

        return true // Found at least one available slot!
      }
    }

    return false
  }

  /**
   * True when the doctor is fully unavailable for the entire day.
   * Partial blocks (such as lunch breaks) only apply to individual time slots and do NOT block the whole date.
   */
  const isUnavailable = (day: number): boolean => {
    const dateStr = dateStringFor(day)

    // Explicit whole-day block (e.g. sick leave, emergency, out of office)
    if (doctorBlockedDates.value.includes(dateStr)) {
      return true
    }

    // If the doctor is scheduled on duty, check if every single slot is blocked or booked
    if (isDoctorOnDuty(day)) {
      return !hasAvailableSlotOnDate(day)
    }

    return false
  }

  /**
   * Strict check: True ONLY if the date is allowed for the patient to pick.
   * - Cannot be past
   * - Cannot be blocked (unavailable)
   * - Must be within active doctor duty schedule, OR be the date already assigned to this appointment
   */
  const isDateSelectable = (day: number): boolean => {
    if (isPast(day)) return false
    if (isUnavailable(day)) return false
    if (dateStringFor(day) === currentApptDate.value) return true
    if (hasAnyDutyConfigured.value && !isDoctorOnDuty(day)) return false
    return true
  }

  /** Format 24h 'HH:mm' or 'HH:mm:ss' to 12h representation 'h:mm A' */
  const formatTime12H = (t: string): string => {
    if (!t) return ''
    const [hStr, mStr] = t.split(':')
    const h = parseInt(hStr, 10)
    const m = parseInt(mStr || '0', 10)
    if (isNaN(h)) return ''
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
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

  const scrollContainer = ref<HTMLElement | null>(null)
  const timeSlotsSection = ref<HTMLElement | null>(null)

  const selectDate = async (day: number) => {
    if (!isDateSelectable(day)) return
    const dateStr = dateStringFor(day)
    if (selectedDate.value !== dateStr) {
      selectedDate.value = dateStr
      selectedTime.value = ''
    }

    // Smoothly scroll down so the available time slots are brought into view
    await nextTick()
    setTimeout(() => {
      if (timeSlotsSection.value) {
        timeSlotsSection.value.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      } else if (scrollContainer.value) {
        scrollContainer.value.scrollTo({
          top: scrollContainer.value.scrollHeight,
          behavior: 'smooth'
        })
      }
    }, 50)
  }

  const selectedDateLabel = computed(() => {
    if (!selectedDate.value) return ''
    const d = new Date(selectedDate.value + 'T00:00:00')
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  })

  // ── Time Slots Generation ─────────────────────────────────────────────────────

  interface TimeSlotOption {
    time24: string
    endTime24: string
    label: string
    endLabel: string
    durationLabel: string
    isAvailable: boolean
    isCurrentApptTime?: boolean
    clinicName?: string
  }

  const selectedDateClinic = computed(() => {
    if (!selectedDate.value) return null
    const duties = getDutyForDate(selectedDate.value)
    if (!duties.length) return null
    const firstDuty = duties[0]
    return {
      name: firstDuty.clinic?.name || firstDuty.location_name || 'Clinic Duty',
      address: firstDuty.clinic?.address || null,
      phone: firstDuty.clinic?.phone || null,
      dutyHours: duties
        .map((d: any) => `${formatTime12H(d.start_time)} – ${formatTime12H(d.end_time)}`)
        .join(', ')
    }
  })

  const availableTimeSlots = computed<TimeSlotOption[]>(() => {
    if (!selectedDate.value) return []

    const dateStr = selectedDate.value
    const dayDuties = doctorDutySlots.value.filter(
      (s: any) => s.available_date?.slice(0, 10) === dateStr
    )
    const dayBlocked = doctorBlockedSlots.value.filter(
      (s: any) => s.available_date?.slice(0, 10) === dateStr
    )
    const dayBookedAppts = doctorAppointmentsList.value.filter((a: any) => {
      const apptDate = a.date || a.raw_scheduled_at?.slice(0, 10)
      return apptDate === dateStr && a.status !== 'declined' && a.id !== props.appointment.id
    })

    const DURATION_MINS = 60 // Standard consultation length (1 hour)

    // True if a 1-hour slot starting at startM overlaps any blocked period
    const isSlotBlocked = (startM: number) => {
      const endM = startM + DURATION_MINS
      return dayBlocked.some((b: any) => {
        const bStart = toMins(b.start_time)
        const bEnd = toMins(b.end_time)
        return startM < bEnd && endM > bStart
      })
    }

    // True if a 1-hour slot starting at startM overlaps another booked appointment
    const isSlotBooked = (startM: number) => {
      const endM = startM + DURATION_MINS
      return dayBookedAppts.some((a: any) => {
        if (a.raw_scheduled_at) {
          const p = parseAppointmentDateTime(a.raw_scheduled_at)
          const apptStart = parseInt(p.startH, 10) * 60 + parseInt(p.startM, 10)
          let apptEnd = apptStart + DURATION_MINS
          if (a.raw_scheduled_end_at) {
            const pEnd = parseAppointmentDateTime(a.raw_scheduled_end_at)
            const parsedEnd = parseInt(pEnd.startH, 10) * 60 + parseInt(pEnd.startM, 10)
            if (parsedEnd > apptStart) apptEnd = parsedEnd
          }
          return startM < apptEnd && endM > apptStart
        }
        return false
      })
    }

    const isCurrentSlot = (time24: string) => {
      return selectedDate.value === currentApptDate.value && time24 === currentApptTime24.value
    }

    const slots: TimeSlotOption[] = []

    if (dayDuties.length > 0) {
      dayDuties.forEach((duty: any) => {
        const dutyStart = toMins(duty.start_time)
        const dutyEnd = toMins(duty.end_time)
        const clinicName = duty.clinic?.name || duty.location_name || 'Clinic Duty'

        // Strictly stop when m + DURATION_MINS > dutyEnd to ensure the appointment does not overshoot duty hours
        for (let m = dutyStart; m + DURATION_MINS <= dutyEnd; m += 30) {
          const hh = String(Math.floor(m / 60)).padStart(2, '0')
          const mm = String(m % 60).padStart(2, '0')
          const time24 = `${hh}:${mm}`

          const endM = m + DURATION_MINS
          const endHh = String(Math.floor(endM / 60)).padStart(2, '0')
          const endMm = String(endM % 60).padStart(2, '0')
          const endTime24 = `${endHh}:${endMm}`

          const isCurrent = isCurrentSlot(time24)
          const isAvail = !isCurrent && !isSlotBlocked(m) && !isSlotBooked(m)

          slots.push({
            time24,
            endTime24,
            label: formatTime12H(time24),
            endLabel: formatTime12H(endTime24),
            durationLabel: '1 hr',
            isAvailable: isAvail,
            isCurrentApptTime: isCurrent,
            clinicName
          })
        }
      })
    } else {
      // Standard 8:00 AM - 6:00 PM if no duty schedule configured
      for (let m = 8 * 60; m + DURATION_MINS <= 18 * 60; m += 30) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0')
        const mm = String(m % 60).padStart(2, '0')
        const time24 = `${hh}:${mm}`

        const endM = m + DURATION_MINS
        const endHh = String(Math.floor(endM / 60)).padStart(2, '0')
        const endMm = String(endM % 60).padStart(2, '0')
        const endTime24 = `${endHh}:${endMm}`

        const isCurrent = isCurrentSlot(time24)
        const isAvail = !isCurrent && !isSlotBlocked(m) && !isSlotBooked(m)

        slots.push({
          time24,
          endTime24,
          label: formatTime12H(time24),
          endLabel: formatTime12H(endTime24),
          durationLabel: '1 hr',
          isAvailable: isAvail,
          isCurrentApptTime: isCurrent
        })
      }
    }

    return slots
  })

  const selectTimeSlot = (slot: TimeSlotOption) => {
    if (!slot.isAvailable || slot.isCurrentApptTime) return
    selectedTime.value = slot.time24
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  const submitReschedule = async () => {
    if (!selectedDate.value || !selectedTime.value || isSubmitting.value) return

    const day = Number(selectedDate.value.slice(8, 10))
    if (!isDateSelectable(day)) {
      toast.error("Please select an available date within your doctor's schedule.")
      return
    }

    isSubmitting.value = true
    try {
      await appointmentService.update(props.appointment.id, {
        status: 'reschedule_requested',
        requested_reschedule_date: selectedDate.value,
        requested_reschedule_time: selectedTime.value
      })
      toast.success('Reschedule request sent to your doctor.')
      emit('requested')
      emit('close')
    } catch (e: any) {
      toast.error(e.data?.message || e.message || 'Failed to send reschedule request.')
    } finally {
      isSubmitting.value = false
    }
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        class="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
        @click.self="emit('close')"
      >
        <div
          class="bg-card border-border my-auto flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border shadow-2xl"
        >
          <!-- Header -->
          <div class="from-primary shrink-0 bg-gradient-to-br to-indigo-700 px-6 py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                  <Icon
                    name="lucide:calendar-clock"
                    class="text-lg text-white"
                  />
                </div>
                <div>
                  <p class="text-[10px] font-bold tracking-widest text-white uppercase opacity-80">
                    Patient Request
                  </p>
                  <h3 class="text-base leading-tight font-black text-white">Request Reschedule</h3>
                </div>
              </div>
              <AppButton
                variant="unstyled"
                size="unstyled"
                rounded="unstyled"
                class="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-all hover:bg-white/15 hover:text-white"
                @click="emit('close')"
              >
                <Icon
                  name="lucide:x"
                  class="text-base"
                />
              </AppButton>
            </div>
          </div>

          <!-- Doctor info strip -->
          <div class="border-border shrink-0 border-b px-6 py-3">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <div
                  class="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                >
                  <Icon
                    name="lucide:stethoscope"
                    class="text-primary text-sm"
                  />
                </div>
                <div>
                  <p class="text-foreground text-sm font-bold">{{ appointment.doctor }}</p>
                  <p class="text-muted-foreground text-xs">{{ appointment.info }}</p>
                </div>
              </div>
              <span class="text-muted-foreground hidden text-xs font-medium sm:inline-block">
                Standard Consultation: <strong class="text-foreground font-semibold">1 hour</strong>
              </span>
            </div>
          </div>

          <!-- Split-Pane Body -->
          <div class="flex flex-1 flex-col overflow-hidden md:flex-row">
            <!-- Left Pane: Calendar Selection -->
            <div
              class="border-border flex flex-col justify-between overflow-y-auto p-5 md:w-[380px] md:shrink-0 md:border-r"
            >
              <!-- Loading skeleton -->
              <div
                v-if="isLoading"
                class="flex animate-pulse flex-col gap-3 py-4"
              >
                <div class="bg-foreground/10 mb-1 h-5 w-44 rounded-lg"></div>
                <div class="grid grid-cols-7 gap-y-3">
                  <div
                    v-for="n in 35"
                    :key="n"
                    class="bg-foreground/5 h-9 w-9 place-self-center rounded-full"
                  ></div>
                </div>
              </div>

              <div v-else>
                <!-- Month navigation -->
                <div class="mb-3 flex items-center justify-between">
                  <h2 class="text-foreground flex items-center gap-2 text-sm font-bold">
                    <Icon
                      name="lucide:calendar"
                      class="text-primary text-base"
                    />
                    {{ currentMonthName }} {{ currentYear }}
                  </h2>
                  <div class="flex gap-1">
                    <AppButton
                      variant="unstyled"
                      size="unstyled"
                      rounded="unstyled"
                      :disabled="isPrevMonthDisabled"
                      class="flex h-7 w-7 items-center justify-center rounded-full transition-colors active:scale-95"
                      :class="
                        isPrevMonthDisabled
                          ? 'cursor-not-allowed opacity-25'
                          : 'hover:bg-primary/10'
                      "
                      @click="prevMonth"
                    >
                      <Icon
                        name="lucide:chevron-left"
                        class="text-base"
                      />
                    </AppButton>
                    <AppButton
                      variant="unstyled"
                      size="unstyled"
                      rounded="unstyled"
                      class="hover:bg-primary/10 flex h-7 w-7 items-center justify-center rounded-full transition-colors active:scale-95"
                      @click="nextMonth"
                    >
                      <Icon
                        name="lucide:chevron-right"
                        class="text-base"
                      />
                    </AppButton>
                  </div>
                </div>

                <!-- Day names header -->
                <div class="mb-1 grid grid-cols-7 text-center">
                  <span
                    v-for="d in daysOfWeek"
                    :key="d"
                    class="text-muted-foreground text-[11px] font-bold"
                  >
                    {{ d }}
                  </span>
                </div>

                <!-- Calendar grid -->
                <div class="grid grid-cols-7 gap-y-1 text-center">
                  <!-- Empty offset cells -->
                  <div
                    v-for="empty in startingDayOffset"
                    :key="'e-' + empty"
                  ></div>

                  <!-- Day cells -->
                  <div
                    v-for="date in daysInMonth"
                    :key="date"
                    @click="selectDate(date)"
                    @mouseenter="hoveredDate = dateStringFor(date)"
                    @mouseleave="hoveredDate = null"
                    class="relative flex h-8 w-8 items-center justify-center place-self-center rounded-full text-[13px] font-semibold transition-all select-none"
                    :class="[
                      isPast(date)
                        ? 'text-muted-foreground/40 pointer-events-none cursor-not-allowed line-through'
                        : selectedDate === dateStringFor(date)
                          ? 'bg-secondary z-10 scale-110 cursor-pointer text-white shadow-md'
                          : isUnavailable(date)
                            ? 'cursor-not-allowed bg-red-50 text-red-400 opacity-80 ring-1 ring-red-200'
                            : dateStringFor(date) === currentApptDate
                              ? 'cursor-pointer bg-indigo-50 font-bold text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-100'
                              : isDoctorOnDuty(date)
                                ? 'cursor-pointer bg-emerald-50 font-bold text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-100'
                                : hasAnyDutyConfigured
                                  ? 'text-muted-foreground/40 cursor-not-allowed bg-gray-50/60 ring-1 ring-gray-100 hover:bg-gray-100/50'
                                  : isToday(date)
                                    ? 'text-primary ring-primary/40 hover:bg-primary/10 cursor-pointer ring-2'
                                    : 'text-foreground hover:bg-primary/10 cursor-pointer'
                    ]"
                  >
                    {{ date }}

                    <!-- Indicator Dots -->
                    <div
                      v-if="selectedDate === dateStringFor(date)"
                      class="absolute -bottom-0.5 h-1 w-1 rounded-full bg-white"
                    />
                    <div
                      v-else-if="isUnavailable(date) && !isPast(date)"
                      class="absolute -bottom-0.5 h-1 w-1 rounded-full bg-red-400"
                    />
                    <div
                      v-else-if="dateStringFor(date) === currentApptDate && !isPast(date)"
                      class="absolute -bottom-0.5 h-1 w-1 rounded-full bg-indigo-500"
                    />
                    <div
                      v-else-if="isDoctorOnDuty(date) && !isPast(date)"
                      class="absolute -bottom-0.5 h-1 w-1 rounded-full bg-emerald-500"
                    />

                    <!-- Tooltip: Unavailable -->
                    <Transition name="fade-scale">
                      <div
                        v-if="
                          hoveredDate === dateStringFor(date) &&
                          isUnavailable(date) &&
                          !isPast(date)
                        "
                        class="pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-2 -translate-x-1/2 rounded-xl border border-red-700/60 bg-red-900/95 px-2.5 py-1.5 text-center text-xs whitespace-nowrap text-white shadow-2xl backdrop-blur-md"
                      >
                        <div
                          class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-red-700/60 bg-red-900/95"
                        />
                        <div class="flex items-center gap-1.5">
                          <Icon
                            name="lucide:x-circle"
                            class="shrink-0 text-sm text-red-300"
                          />
                          <p class="text-xs font-bold text-red-100">Unavailable</p>
                        </div>
                      </div>
                    </Transition>

                    <!-- Tooltip: Current Appointment Date -->
                    <Transition name="fade-scale">
                      <div
                        v-if="
                          hoveredDate === dateStringFor(date) &&
                          dateStringFor(date) === currentApptDate &&
                          !isUnavailable(date) &&
                          !isPast(date)
                        "
                        class="pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-2 -translate-x-1/2 rounded-xl border border-indigo-700/60 bg-indigo-950/95 px-2.5 py-1.5 text-center text-xs whitespace-nowrap text-white shadow-2xl backdrop-blur-md"
                      >
                        <div
                          class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-indigo-700/60 bg-indigo-950/95"
                        />
                        <div class="flex items-center gap-1.5">
                          <Icon
                            name="lucide:calendar-clock"
                            class="shrink-0 text-sm text-indigo-400"
                          />
                          <p class="text-xs font-bold text-indigo-100">Current Appointment Date</p>
                        </div>
                      </div>
                    </Transition>

                    <!-- Tooltip: Doctor Available -->
                    <Transition name="fade-scale">
                      <div
                        v-if="
                          hoveredDate === dateStringFor(date) &&
                          isDoctorOnDuty(date) &&
                          dateStringFor(date) !== currentApptDate &&
                          !isUnavailable(date) &&
                          !isPast(date)
                        "
                        class="pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-2 -translate-x-1/2 rounded-xl border border-emerald-700/60 bg-emerald-950/95 px-2.5 py-1.5 text-center text-xs whitespace-nowrap text-white shadow-2xl backdrop-blur-md"
                      >
                        <div
                          class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-emerald-700/60 bg-emerald-950/95"
                        />
                        <div class="flex items-center gap-1.5">
                          <Icon
                            name="lucide:check-circle"
                            class="shrink-0 text-sm text-emerald-400"
                          />
                          <p class="text-xs font-bold text-emerald-100">Doctor Available</p>
                        </div>
                      </div>
                    </Transition>

                    <!-- Tooltip: Off-Duty -->
                    <Transition name="fade-scale">
                      <div
                        v-if="
                          hoveredDate === dateStringFor(date) &&
                          hasAnyDutyConfigured &&
                          !isDoctorOnDuty(date) &&
                          dateStringFor(date) !== currentApptDate &&
                          !isUnavailable(date) &&
                          !isPast(date)
                        "
                        class="pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-2 -translate-x-1/2 rounded-xl border border-slate-700/60 bg-slate-900/95 px-2.5 py-1.5 text-center text-xs whitespace-nowrap text-white shadow-2xl backdrop-blur-md"
                      >
                        <div
                          class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-slate-700/60 bg-slate-900/95"
                        />
                        <div class="flex items-center gap-1.5">
                          <Icon
                            name="lucide:clock"
                            class="shrink-0 text-sm text-slate-400"
                          />
                          <p class="text-xs font-bold text-slate-100">Off-Duty</p>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>

                <!-- Calendar Legend -->
                <div
                  class="border-border mt-4 flex flex-wrap items-center justify-center gap-3 border-t pt-3 text-[11px] font-medium text-slate-600 dark:text-slate-400"
                >
                  <span class="flex items-center gap-1.5">
                    <span class="h-2 w-2 rounded-full bg-indigo-500"></span>
                    Current Appt Date
                  </span>
                  <span class="flex items-center gap-1.5">
                    <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                    Doctor Available
                  </span>
                  <span class="flex items-center gap-1.5">
                    <span class="h-2 w-2 rounded-full bg-gray-300"></span>
                    Off-Duty
                  </span>
                  <span class="flex items-center gap-1.5">
                    <span class="h-2 w-2 rounded-full bg-red-400"></span>
                    Unavailable
                  </span>
                </div>
              </div>
            </div>

            <!-- Right Pane: Clinic Location Context & Available Time Slots -->
            <div
              ref="timeSlotsSection"
              class="custom-scrollbar bg-muted/10 flex flex-1 flex-col overflow-y-auto p-5"
            >
              <template v-if="selectedDate">
                <!-- Clinic Location Card for Selected Date -->
                <div
                  v-if="selectedDateClinic"
                  class="border-primary/20 bg-primary/5 mb-4 rounded-2xl border p-3.5"
                >
                  <div class="flex items-start gap-3">
                    <div
                      class="bg-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
                    >
                      <Icon
                        name="lucide:building-2"
                        class="text-lg"
                      />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <span
                          class="bg-primary/15 text-primary rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        >
                          Doctor Practice Location
                        </span>
                      </div>
                      <p class="text-foreground mt-0.5 truncate text-xs font-bold">
                        {{ selectedDateClinic.name }}
                      </p>
                      <p
                        v-if="selectedDateClinic.address"
                        class="text-muted-foreground truncate text-[11px]"
                      >
                        {{ selectedDateClinic.address }}
                      </p>
                      <p
                        v-if="selectedDateClinic.dutyHours"
                        class="text-primary mt-1 flex items-center gap-1 text-[10px] font-semibold"
                      >
                        <Icon
                          name="lucide:clock"
                          class="text-xs"
                        />
                        Duty Schedule: {{ selectedDateClinic.dutyHours }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Preferred Time Slot Header -->
                <div class="mb-3 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Icon
                      name="lucide:clock"
                      class="text-primary text-base"
                    />
                    <h4 class="text-foreground text-xs font-bold tracking-wider uppercase">
                      Select Preferred Time Slot
                    </h4>
                  </div>
                  <span
                    v-if="availableTimeSlots.length > 0"
                    class="text-muted-foreground text-[11px] font-medium"
                  >
                    {{ availableTimeSlots.filter(s => s.isAvailable).length }} slots available
                  </span>
                </div>

                <!-- Time slots grid -->
                <div
                  v-if="availableTimeSlots.length > 0"
                  class="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
                >
                  <button
                    v-for="slot in availableTimeSlots"
                    :key="slot.time24"
                    type="button"
                    :disabled="!slot.isAvailable || slot.isCurrentApptTime"
                    @click="selectTimeSlot(slot)"
                    class="relative flex flex-col items-start justify-center gap-1 rounded-xl p-3 text-left transition-all"
                    :class="[
                      slot.isCurrentApptTime
                        ? 'cursor-not-allowed border border-amber-300/80 bg-amber-500/10 text-amber-800 opacity-90'
                        : !slot.isAvailable
                          ? 'bg-muted/40 text-muted-foreground/40 cursor-not-allowed border border-transparent line-through'
                          : selectedTime === slot.time24
                            ? 'bg-secondary ring-secondary/30 scale-[1.02] font-bold text-white shadow-md ring-2'
                            : 'bg-card text-foreground hover:bg-primary/10 hover:text-primary border-border/70 cursor-pointer border shadow-xs active:scale-95'
                    ]"
                  >
                    <div class="flex w-full items-center justify-between">
                      <span class="text-xs font-bold">{{ slot.label }}</span>
                      <span
                        class="rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase"
                        :class="
                          selectedTime === slot.time24
                            ? 'bg-white/20 text-white'
                            : 'bg-muted text-muted-foreground'
                        "
                      >
                        {{ slot.durationLabel }}
                      </span>
                    </div>
                    <span
                      class="text-[10px]"
                      :class="
                        selectedTime === slot.time24 ? 'text-white/80' : 'text-muted-foreground'
                      "
                    >
                      until {{ slot.endLabel }}
                    </span>
                    <span
                      v-if="slot.isCurrentApptTime"
                      class="mt-1 rounded-full border border-amber-300/70 bg-amber-100 px-1.5 py-0.5 text-[9px] leading-none font-bold text-amber-800"
                    >
                      Current Time
                    </span>
                  </button>
                </div>

                <!-- Empty state for time slots on date -->
                <div
                  v-else
                  class="my-auto rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-center text-xs text-amber-700"
                >
                  <Icon
                    name="lucide:alert-circle"
                    class="mx-auto mb-2 text-xl"
                  />
                  <p class="font-bold">No Available Time Slots</p>
                  <p class="mt-1 text-[11px] opacity-80">
                    All consultation hours for this date are fully booked or blocked. Please select
                    another date.
                  </p>
                </div>
              </template>

              <!-- Empty state: No date chosen yet -->
              <div
                v-else
                class="my-auto flex flex-col items-center justify-center p-8 text-center"
              >
                <div
                  class="bg-primary/10 text-primary mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
                >
                  <Icon
                    name="lucide:calendar"
                    class="text-2xl"
                  />
                </div>
                <h4 class="text-foreground text-sm font-bold">Pick a Date to View Slots</h4>
                <p class="text-muted-foreground mt-1 max-w-xs text-xs">
                  Select any available date on the calendar to see doctor clinic duty hours and
                  bookable consultation slots.
                </p>
              </div>
            </div>
          </div>

          <!-- Bottom Footer Bar -->
          <div
            class="border-border/60 bg-card flex shrink-0 flex-col items-center justify-between gap-3 border-t px-6 py-3.5 sm:flex-row"
          >
            <!-- Selected Summary -->
            <div class="flex items-center gap-2.5">
              <div
                class="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              >
                <Icon
                  name="lucide:calendar-check"
                  class="text-primary text-base"
                />
              </div>
              <div class="text-left">
                <p class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Selected Reschedule
                </p>
                <p
                  v-if="selectedDate"
                  class="text-foreground text-xs leading-tight font-bold"
                >
                  {{ selectedDateLabel }}
                  <span
                    v-if="selectedTime"
                    class="text-primary font-semibold"
                  >
                    at {{ formatTime12H(selectedTime) }}
                  </span>
                  <span
                    v-if="selectedDateClinic"
                    class="text-muted-foreground font-normal"
                  >
                    ({{ selectedDateClinic.name }})
                  </span>
                </p>
                <p
                  v-else
                  class="text-muted-foreground text-xs italic"
                >
                  No date selected yet
                </p>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex w-full items-center justify-end gap-2 sm:w-auto">
              <AppButton
                variant="ghost"
                size="sm"
                :disabled="isSubmitting"
                @click="emit('close')"
              >
                Cancel
              </AppButton>
              <AppButton
                variant="solid"
                size="sm"
                :loading="isSubmitting"
                :disabled="!selectedDate || !selectedTime || isSubmitting"
                @click="submitReschedule"
              >
                <Icon
                  name="lucide:send"
                  class="mr-1.5 text-xs"
                />
                Send Request
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .fade-scale-enter-active,
  .fade-scale-leave-active {
    transition: all 0.15s ease-out;
  }
  .fade-scale-enter-from,
  .fade-scale-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(4px) scale(0.95);
  }

  .slide-up-enter-active,
  .slide-up-leave-active {
    transition: all 0.2s cubic-bezier(0.34, 1.4, 0.64, 1);
  }
  .slide-up-enter-from,
  .slide-up-leave-to {
    opacity: 0;
    transform: translateY(8px);
  }
</style>
