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
        doctorBlockedDates.value = doctorBlockedSlots.value
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

  /** True when the doctor is blocked for the entire day. */
  const isUnavailable = (day: number): boolean => {
    const dateStr = dateStringFor(day)
    return doctorBlockedDates.value.includes(dateStr)
  }

  /** Get duty slots for a specific date string */
  const getDutyForDate = (dateStr: string) => {
    return doctorDutySlots.value.filter((s: any) => s.available_date?.slice(0, 10) === dateStr)
  }

  /** True when the doctor has active clinic duty hours on this date. */
  const isDoctorOnDuty = (day: number): boolean => {
    return getDutyForDate(dateStringFor(day)).length > 0
  }

  /** True if the doctor has defined duty schedules anywhere in the calendar */
  const hasAnyDutyConfigured = computed(() => doctorDutySlots.value.length > 0)

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

  /** Human readable duty schedule text for tooltip */
  const dutyScheduleLabel = (day: number): string => {
    const duties = getDutyForDate(dateStringFor(day))
    if (!duties.length) return ''
    return duties
      .map((d: any) => {
        const clinic = d.clinic?.name || d.location_name || 'Clinic Duty'
        return `${formatTime12H(d.start_time)} – ${formatTime12H(d.end_time)} (${clinic})`
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
    label: string
    isAvailable: boolean
    isCurrentApptTime?: boolean
    clinicName?: string
  }

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

    // Utility: 'HH:mm' to total minutes
    const toMins = (t: string) => {
      if (!t) return 0
      const [h, m] = t.slice(0, 5).split(':').map(Number)
      return (h || 0) * 60 + (m || 0)
    }

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
          const isCurrent = isCurrentSlot(time24)
          const isAvail = !isCurrent && !isSlotBlocked(m) && !isSlotBooked(m)

          slots.push({
            time24,
            label: formatTime12H(time24),
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
        const isCurrent = isCurrentSlot(time24)
        const isAvail = !isCurrent && !isSlotBlocked(m) && !isSlotBooked(m)

        slots.push({
          time24,
          label: formatTime12H(time24),
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
        class="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto p-4 bg-black/50"
        @click.self="emit('close')"
      >
        <div
          class="bg-card border-border my-auto flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border shadow-2xl"
        >
          <!-- Header -->
          <div class="from-primary shrink-0 bg-gradient-to-br to-indigo-700 px-6 py-5">
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
          <div class="border-border shrink-0 border-b px-6 pt-4 pb-3">
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
          </div>

          <!-- Scrollable body -->
          <div
            ref="scrollContainer"
            class="custom-scrollbar flex-1 overflow-y-auto px-6 py-4"
          >
            <!-- Loading skeleton -->
            <div
              v-if="isLoading"
              class="flex animate-pulse flex-col gap-3"
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

            <template v-else>
              <!-- Step 1: Date Selection -->
              <div class="mb-5">
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

                <!-- Day-of-week headers -->
                <div class="mb-1 grid grid-cols-7 gap-y-2 text-center">
                  <div
                    v-for="day in daysOfWeek"
                    :key="day"
                    class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase"
                  >
                    {{ day }}
                  </div>

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
                        class="pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-2 w-52 -translate-x-1/2 rounded-xl border border-red-700/60 bg-red-900/95 p-2.5 text-left text-xs text-white shadow-2xl backdrop-blur-md"
                      >
                        <div
                          class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-red-700/60 bg-red-900/95"
                        />
                        <div class="mb-0.5 flex items-center gap-1.5">
                          <Icon
                            name="lucide:x-circle"
                            class="shrink-0 text-sm text-red-300"
                          />
                          <p class="text-xs font-bold text-red-100">Unavailable</p>
                        </div>
                        <p class="text-[10px] leading-tight font-medium text-red-200">
                          Doctor is blocked or unavailable on this date.
                        </p>
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
                        class="pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-2 w-56 -translate-x-1/2 rounded-xl border border-indigo-700/60 bg-indigo-950/95 p-2.5 text-left text-xs text-white shadow-2xl backdrop-blur-md"
                      >
                        <div
                          class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-indigo-700/60 bg-indigo-950/95"
                        />
                        <div class="mb-0.5 flex items-center gap-1.5">
                          <Icon
                            name="lucide:calendar-clock"
                            class="shrink-0 text-sm text-indigo-400"
                          />
                          <p class="text-xs font-bold text-indigo-100">Current Appointment Date</p>
                        </div>
                        <p class="text-[10px] leading-tight font-medium text-indigo-200">
                          Click to pick a different time slot on this date.
                        </p>
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
                        class="pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-2 w-56 -translate-x-1/2 rounded-xl border border-emerald-700/60 bg-emerald-950/95 p-2.5 text-left text-xs text-white shadow-2xl backdrop-blur-md"
                      >
                        <div
                          class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-emerald-700/60 bg-emerald-950/95"
                        />
                        <div class="mb-0.5 flex items-center gap-1.5">
                          <Icon
                            name="lucide:check-circle"
                            class="shrink-0 text-sm text-emerald-400"
                          />
                          <p class="text-xs font-bold text-emerald-100">Doctor Available</p>
                        </div>
                        <p class="text-[10px] leading-tight font-medium text-emerald-200">
                          {{ dutyScheduleLabel(date) }}
                        </p>
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
                        class="pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-2 w-48 -translate-x-1/2 rounded-xl border border-slate-700/60 bg-slate-900/95 p-2.5 text-left text-xs text-white shadow-2xl backdrop-blur-md"
                      >
                        <div
                          class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-slate-700/60 bg-slate-900/95"
                        />
                        <div class="mb-0.5 flex items-center gap-1.5">
                          <Icon
                            name="lucide:clock"
                            class="shrink-0 text-sm text-slate-400"
                          />
                          <p class="text-xs font-bold text-slate-100">Off-Duty</p>
                        </div>
                        <p class="text-[10px] leading-tight font-medium text-slate-300">
                          No clinic duty hours scheduled on this date.
                        </p>
                      </div>
                    </Transition>
                  </div>
                </div>

                <!-- Legend -->
                <div
                  class="text-muted-foreground border-border/60 mt-3 flex flex-wrap items-center gap-3 border-t pt-2.5 text-[11px]"
                >
                  <div
                    v-if="currentApptDate"
                    class="flex items-center gap-1.5"
                  >
                    <div
                      class="h-2.5 w-2.5 rounded-full bg-indigo-100 ring-1 ring-indigo-300"
                    ></div>
                    <span class="font-medium text-indigo-700">Current Appt Date</span>
                  </div>
                  <div
                    v-if="hasAnyDutyConfigured"
                    class="flex items-center gap-1.5"
                  >
                    <div
                      class="h-2.5 w-2.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300"
                    ></div>
                    <span class="font-medium text-emerald-700">Doctor Available</span>
                  </div>
                  <div
                    v-if="hasAnyDutyConfigured"
                    class="flex items-center gap-1.5"
                  >
                    <div class="h-2.5 w-2.5 rounded-full bg-gray-100 ring-1 ring-gray-200"></div>
                    <span>Off-Duty</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div class="h-2.5 w-2.5 rounded-full bg-red-100 ring-1 ring-red-300"></div>
                    <span>Unavailable</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div class="bg-secondary h-2.5 w-2.5 rounded-full"></div>
                    <span>Your selection</span>
                  </div>
                </div>
              </div>

              <!-- Step 2: Preferred Time Slot Selection -->
              <Transition name="slide-up">
                <div
                  ref="timeSlotsSection"
                  v-if="selectedDate"
                  class="border-border mt-4 border-t pt-4"
                >
                  <div class="mb-3 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <Icon
                        name="lucide:clock"
                        class="text-primary text-base"
                      />
                      <h4 class="text-foreground text-xs font-bold tracking-wider uppercase">
                        Select Preferred Time
                      </h4>
                    </div>
                    <span
                      v-if="availableTimeSlots.length > 0"
                      class="text-muted-foreground text-[11px]"
                    >
                      {{ availableTimeSlots.filter(s => s.isAvailable).length }} available
                    </span>
                  </div>

                  <!-- Time slots grid -->
                  <div
                    v-if="availableTimeSlots.length > 0"
                    class="grid grid-cols-3 gap-2 sm:grid-cols-4"
                  >
                    <button
                      v-for="slot in availableTimeSlots"
                      :key="slot.time24"
                      type="button"
                      :disabled="!slot.isAvailable || slot.isCurrentApptTime"
                      @click="selectTimeSlot(slot)"
                      class="relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all"
                      :class="[
                        slot.isCurrentApptTime
                          ? 'cursor-not-allowed border border-amber-300/80 bg-amber-500/10 text-amber-800 opacity-90'
                          : !slot.isAvailable
                            ? 'bg-muted/40 text-muted-foreground/40 cursor-not-allowed border border-transparent line-through'
                            : selectedTime === slot.time24
                              ? 'bg-secondary ring-secondary/30 scale-102 font-bold text-white shadow-md ring-2'
                              : 'bg-foreground/5 text-foreground hover:bg-primary/10 hover:text-primary border-border/70 cursor-pointer border active:scale-95'
                      ]"
                    >
                      <span class="flex items-center gap-1">{{ slot.label }}</span>
                      <span
                        v-if="slot.isCurrentApptTime"
                        class="mt-0.5 rounded-full border border-amber-300/70 bg-amber-100 px-1.5 py-0.5 text-[9px] leading-none font-bold text-amber-800"
                      >
                        Current Time
                      </span>
                      <span
                        v-else-if="slot.clinicName"
                        class="max-w-full truncate text-[9px] font-normal opacity-75"
                        >{{ slot.clinicName }}</span
                      >
                    </button>
                  </div>

                  <!-- Empty state for time slots -->
                  <div
                    v-else
                    class="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-center text-xs text-amber-700"
                  >
                    <Icon
                      name="lucide:alert-circle"
                      class="mx-auto mb-1 text-base"
                    />
                    <p class="font-medium">No available time slots found for this date.</p>
                  </div>
                </div>
              </Transition>
            </template>
          </div>

          <!-- Selection summary pill -->
          <Transition name="slide-up">
            <div
              v-if="selectedDate"
              class="bg-primary/5 border-primary/15 mx-6 mb-3 flex shrink-0 items-center justify-between gap-3 rounded-2xl border px-4 py-3"
            >
              <div class="flex items-center gap-3">
                <div
                  class="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                >
                  <Icon
                    name="lucide:calendar-check"
                    class="text-primary text-lg"
                  />
                </div>
                <div>
                  <p class="text-primary text-[10px] font-bold tracking-wide uppercase">
                    Preferred Reschedule
                  </p>
                  <p class="text-foreground text-xs leading-tight font-bold">
                    {{ selectedDateLabel }}
                  </p>
                  <p
                    v-if="selectedTime"
                    class="text-primary mt-0.5 text-xs font-semibold"
                  >
                    at {{ formatTime12H(selectedTime) }}
                  </p>
                  <p
                    v-else
                    class="text-muted-foreground mt-0.5 text-[11px] italic"
                  >
                    Please pick a time slot above
                  </p>
                </div>
              </div>
            </div>
          </Transition>

          <!-- Footer actions -->
          <div class="border-border/40 flex shrink-0 flex-col gap-2 border-t px-6 pt-1 pb-5">
            <AppButton
              variant="solid"
              size="md"
              block
              :loading="isSubmitting"
              :disabled="!selectedDate || !selectedTime || isSubmitting"
              @click="submitReschedule"
            >
              <Icon
                name="lucide:send"
                class="mr-1.5 text-sm"
              />
              Send Reschedule Request
            </AppButton>
            <AppButton
              variant="ghost"
              size="md"
              block
              :disabled="isSubmitting"
              @click="emit('close')"
            >
              Cancel
            </AppButton>
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
