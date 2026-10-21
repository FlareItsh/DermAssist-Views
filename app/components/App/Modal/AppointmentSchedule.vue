<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
  import { toast } from 'vue-sonner'
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { parseAppointmentDateTime } from '~/composables/useAppointments'

  const props = withDefaults(
    defineProps<{
      appointmentUuid?: string
      patient?: any
      patientId?: number | string
      patients?: any[]
      mode?: 'schedule' | 'reschedule'
      prefillDate?: string
      prefillTime?: string
      inline?: boolean
      patientName?: string
      patientAvatar?: string
    }>(),
    {
      appointmentUuid: '',
      patient: null,
      patientId: '',
      patients: () => [],
      mode: 'schedule',
      prefillDate: '',
      prefillTime: '',
      inline: false,
      patientName: '',
      patientAvatar: ''
    }
  )

  const emit = defineEmits<{
    (e: 'close'): void
    (e: 'scheduled'): void
  }>()

  const internalSelectedPatient = ref<any>(props.patient || null)
  watch(
    () => props.patient,
    newVal => {
      if (newVal) internalSelectedPatient.value = newVal
    }
  )

  const displayPatientName = computed(() => {
    if (props.patientName) return props.patientName
    const p = internalSelectedPatient.value || props.patient
    if (!p) return ''
    if (p.name) return p.name
    if (p.doctor && !p.doctor.startsWith('Dr.')) return p.doctor
    const full = [p.first_name || p.firstName, p.last_name || p.lastName].filter(Boolean).join(' ')
    return full || p.email || 'Patient'
  })

  const displayPatientAvatar = computed(() => {
    return (
      props.patientAvatar || internalSelectedPatient.value?.avatar || props.patient?.avatar || ''
    )
  })

  const isMobile = ref(false)
  const updateIsMobile = () => {
    if (typeof window !== 'undefined') {
      isMobile.value = window.innerWidth < 768
    }
  }

  onMounted(() => {
    updateIsMobile()
    window.addEventListener('resize', updateIsMobile)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateIsMobile)
  })

  const isInlineMode = computed(() => Boolean(props.inline || isMobile.value))

  const { getStorageUrl } = useStorage()
  const avatarError = ref(false)

  const userRole = useCookie('user_role')
  const isDoctor = computed(() => userRole.value === 'doctor')

  const getTodayStr = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const selectedDate = ref('')
  const scheduleTime = ref('09:00')
  const scheduleEndTime = ref('10:00')
  const scheduleLocation = ref('')
  const customLocationInput = ref('')
  const isScheduling = ref(false)
  const errorMessage = ref<string | null>(null)
  const wasAutofilled = ref(false)

  const selectedDateFormatted = computed(() => {
    if (!selectedDate.value) return ''
    try {
      const [y, m, d] = selectedDate.value.split('-').map(Number)
      const dateObj = new Date(y, m - 1, d)
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return selectedDate.value
    }
  })

  const { clinics, fetchClinics } = useDoctorClinics()
  const doctorBookedAppts = ref<any[]>([])
  const currentAppointmentData = ref<any>(null)

  // ─── Appointments & Blocked dates ───────────────────────────────────────────

  const {
    blockedSlots,
    dutySlots,
    isTimeRangeBlockedOnDate,
    isWholeDayBlocked: checkWholeDayBlocked,
    getBlockedTimesForDate,
    getDutySlotsForDate,
    getDutyClinicForDateAndTime,
    hasDutyOnDate,
    isTimeRangeWithinDutyHours,
    getDutyRangesLabel,
    findEarliestAvailableSlot,
    fetchBlockedSlotsForDoctor,
    fetchBlockedSlots
  } = useBlockedDates()
  const { appointments, isApptTimeConflicting, fetchAppointmentsForDoctor, fetchAppointments } =
    useAppointments()

  const effectiveAppointmentsList = computed(() => {
    if (doctorBookedAppts.value.length > 0) {
      return doctorBookedAppts.value
    }
    return appointments.value
  })

  const blockedSlotsForDate = computed(() => {
    if (!selectedDate.value) return []
    return getBlockedTimesForDate(selectedDate.value)
  })

  const dutySlotsForDate = computed(() => {
    if (!selectedDate.value) return []
    return getDutySlotsForDate(selectedDate.value)
  })

  const existingApptSlotsForDate = computed(() => {
    if (!selectedDate.value) return []
    return effectiveAppointmentsList.value
      .filter(appt => {
        const p = parseAppointmentDateTime(appt.raw_scheduled_at || appt.scheduled_at || appt.date)
        return (
          p.date === selectedDate.value &&
          appt.id !== props.appointmentUuid &&
          (appt.raw_scheduled_at || appt.scheduled_at)
        )
      })
      .map(appt => {
        const startP = parseAppointmentDateTime(appt.raw_scheduled_at || appt.scheduled_at)
        let endH = String((Number(startP.startH) + 1) % 24).padStart(2, '0')
        let endM = startP.startM
        const rawEnd = appt.raw_scheduled_end_at || appt.scheduled_end_at
        if (rawEnd) {
          const endP = parseAppointmentDateTime(rawEnd)
          endH = endP.startH
          endM = endP.startM
        }

        return {
          start_time: `${startP.startH}:${startP.startM}`,
          end_time: `${endH}:${endM}`,
          label: appt.doctor || 'Booked Patient'
        }
      })
  })

  const handleDateSelected = (date: string) => {
    selectedDate.value = date

    if (!hasDutyOnDate(date)) {
      scheduleTime.value = ''
      scheduleEndTime.value = ''
      return
    }

    // Smart-default to the earliest conflict-free slot on this date:
    // Must be strictly within duty hours, not blocked, and not overlapping existing appointments
    const earliestSlot = findEarliestAvailableSlot(date, 60, existingApptSlotsForDate.value)
    if (earliestSlot) {
      scheduleTime.value = earliestSlot.start
      scheduleEndTime.value = earliestSlot.end
    } else {
      // If no 1-hour slot fits, fallback to earliest duty start time
      const dayDuties = getDutySlotsForDate(date)
      if (dayDuties.length > 0) {
        scheduleTime.value = dayDuties[0].start_time.slice(0, 5)
      }
    }
  }

  onMounted(async () => {
    await fetchClinics()

    if (props.appointmentUuid) {
      try {
        const appt = await appointmentService.show(props.appointmentUuid)
        if (appt) {
          currentAppointmentData.value = appt
          const docUuid = appt.doctor?.uuid
          const docId = appt.doctor_id

          if (docUuid) {
            await fetchBlockedSlotsForDoctor(docUuid)
          }
          if (docId) {
            const docAppts = await fetchAppointmentsForDoctor(docId)
            if (docAppts && docAppts.length > 0) {
              doctorBookedAppts.value = docAppts
            }
          }

          // Pre-fill from patient reschedule request if provided
          if (props.prefillDate) {
            selectedDate.value = props.prefillDate
            if (props.prefillTime) {
              scheduleTime.value = props.prefillTime.slice(0, 5)
              const [h, m] = props.prefillTime.split(':').map(Number)
              const endHour = (h + 1) % 24
              scheduleEndTime.value = `${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
            }
          } else if (appt.scheduled_at) {
            const p = parseAppointmentDateTime(appt.scheduled_at)
            selectedDate.value = p.date
            scheduleTime.value = `${p.startH}:${p.startM}`
            if (appt.scheduled_end_at) {
              const pEnd = parseAppointmentDateTime(appt.scheduled_end_at)
              scheduleEndTime.value = `${pEnd.startH}:${pEnd.startM}`
            } else {
              const endHour = (Number(p.startH) + 1) % 24
              scheduleEndTime.value = `${String(endHour).padStart(2, '0')}:${p.startM}`
            }
            if (appt.location) {
              scheduleLocation.value = appt.location
            }
          } else if (!selectedDate.value) {
            selectedDate.value = getTodayStr()
          }
        }
      } catch (e) {
        console.error('Failed to load target doctor schedule details:', e)
      }
    } else {
      // Direct patient scheduling (e.g. from Patients page)
      try {
        await Promise.all([fetchBlockedSlots(), fetchAppointments()])
        if (props.prefillDate) {
          selectedDate.value = props.prefillDate
        } else if (!selectedDate.value) {
          selectedDate.value = getTodayStr()
        }
      } catch (e) {
        console.error('Failed to initialize doctor schedule slots:', e)
      }
    }

    if (selectedDate.value) {
      if (!props.prefillTime && !currentAppointmentData.value?.scheduled_at) {
        handleDateSelected(selectedDate.value)
      }
    }
  })

  const resetToPatientRequestedSlot = () => {
    if (!currentAppointmentData.value?.scheduled_at) return
    const p = parseAppointmentDateTime(currentAppointmentData.value.scheduled_at)
    selectedDate.value = p.date
    scheduleTime.value = `${p.startH}:${p.startM}`
    if (currentAppointmentData.value.scheduled_end_at) {
      const pEnd = parseAppointmentDateTime(currentAppointmentData.value.scheduled_end_at)
      scheduleEndTime.value = `${pEnd.startH}:${pEnd.startM}`
    } else {
      const endHour = (Number(p.startH) + 1) % 24
      scheduleEndTime.value = `${String(endHour).padStart(2, '0')}:${p.startM}`
    }
    if (currentAppointmentData.value.location) {
      scheduleLocation.value = currentAppointmentData.value.location
    }
    toast.info("Prefilled patient's requested schedule.")
  }

  const patientRequestedScheduleFormatted = computed(() => {
    if (!currentAppointmentData.value?.scheduled_at) return null
    const p = parseAppointmentDateTime(currentAppointmentData.value.scheduled_at)
    let text = `${p.date} at ${p.time}`
    if (currentAppointmentData.value.scheduled_end_at) {
      const pEnd = parseAppointmentDateTime(currentAppointmentData.value.scheduled_end_at)
      text += ` - ${pEnd.time}`
    }
    return text
  })

  watch(scheduleTime, newStart => {
    if (!newStart) return
    const [h, m] = newStart.split(':').map(Number)
    const endHour = (h + 1) % 24
    scheduleEndTime.value = `${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  })

  // Smart autofill clinic location from duty preset when date & time change
  watch(
    [selectedDate, scheduleTime, scheduleEndTime],
    ([date, start, end]) => {
      if (!date || !start) return
      const matchedDuty = getDutyClinicForDateAndTime(date, start, end)
      if (matchedDuty) {
        const loc = matchedDuty.clinic?.name || matchedDuty.location_name
        if (loc) {
          scheduleLocation.value = loc
          customLocationInput.value = ''
          wasAutofilled.value = true
          return
        }
      }

      // If no duty schedule found and scheduleLocation was previously autofilled or empty
      if (wasAutofilled.value || !scheduleLocation.value) {
        if (clinics.value.length > 0) {
          scheduleLocation.value = clinics.value[0].name
          customLocationInput.value = ''
        }
        wasAutofilled.value = false
      }
    },
    { immediate: true }
  )

  /**
   * True when the doctor has no duty hours scheduled on this date.
   */
  const hasNoDutyOnDate = computed(() => {
    if (!selectedDate.value) return false
    return !hasDutyOnDate(selectedDate.value)
  })

  /**
   * True when the selected time range is outside the doctor's duty hours.
   */
  const isOutsideDutyHours = computed(() => {
    if (!selectedDate.value || !scheduleTime.value || !scheduleEndTime.value) return false
    return !isTimeRangeWithinDutyHours(
      selectedDate.value,
      scheduleTime.value,
      scheduleEndTime.value
    )
  })

  /**
   * Human-readable label for doctor's duty hours on the selected date.
   */
  const dutyRangesLabel = computed(() => {
    if (!selectedDate.value) return ''
    return getDutyRangesLabel(selectedDate.value)
  })

  /**
   * True when the currently selected date+time range overlaps a blocked slot.
   */
  const isSelectedTimeBlocked = computed(() => {
    if (!selectedDate.value || !scheduleTime.value || !scheduleEndTime.value) return false
    return isTimeRangeBlockedOnDate(selectedDate.value, scheduleTime.value, scheduleEndTime.value)
  })

  const isApptConflict = computed(() => {
    if (!selectedDate.value || !scheduleTime.value) return false
    return isApptTimeConflicting(
      selectedDate.value,
      scheduleTime.value,
      scheduleEndTime.value,
      props.appointmentUuid,
      effectiveAppointmentsList.value
    )
  })

  const isTimeRangeInvalid = computed(() => {
    if (!scheduleTime.value || !scheduleEndTime.value) return false
    return scheduleEndTime.value <= scheduleTime.value
  })

  /**
   * Human-readable label for blocked ranges on the selected date.
   */
  const blockedRangesLabel = computed(() => {
    if (!selectedDate.value) return ''
    const slots = getBlockedTimesForDate(selectedDate.value)
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
  })

  const effectiveLocation = computed(() => {
    if (scheduleLocation.value === '__custom__') {
      return customLocationInput.value.trim()
    }
    return scheduleLocation.value.trim()
  })

  const confirmSchedule = async () => {
    errorMessage.value = null
    if (
      !selectedDate.value ||
      !scheduleTime.value ||
      !scheduleEndTime.value ||
      !effectiveLocation.value
    )
      return
    if (
      isSelectedTimeBlocked.value ||
      isTimeRangeInvalid.value ||
      isApptConflict.value ||
      isOutsideDutyHours.value ||
      hasNoDutyOnDate.value
    ) {
      return
    }

    const targetPatient = internalSelectedPatient.value || props.patient
    const targetPatientId =
      props.patientId || targetPatient?.patient_id || targetPatient?.user_id || targetPatient?.id

    if (!props.appointmentUuid && !targetPatientId) {
      errorMessage.value = 'Please select a patient for this appointment.'
      return
    }

    isScheduling.value = true
    try {
      const dateTime = `${selectedDate.value} ${scheduleTime.value}:00`
      const endDateTime = `${selectedDate.value} ${scheduleEndTime.value}:00`

      if (props.mode === 'reschedule' && props.appointmentUuid) {
        await appointmentService.proposeReschedule(props.appointmentUuid, {
          scheduled_at: dateTime,
          scheduled_end_at: endDateTime,
          location: effectiveLocation.value
        })
      } else if (props.appointmentUuid) {
        await appointmentService.update(props.appointmentUuid, {
          status: 'scheduled',
          scheduled_at: dateTime,
          scheduled_end_at: endDateTime,
          location: effectiveLocation.value
        })
      } else {
        const targetPatientUuid =
          targetPatient?.uuid ||
          (typeof targetPatientId === 'string' && targetPatientId.includes('-')
            ? targetPatientId
            : undefined) ||
          (typeof targetPatient?.id === 'string' && targetPatient?.id.includes('-')
            ? targetPatient?.id
            : undefined)

        const purpose =
          targetPatient?.latestCondition ||
          targetPatient?.info ||
          targetPatient?.diagnosis ||
          'Clinical Consultation'

        await appointmentService.scheduleForPatient({
          patient_id: targetPatientId,
          patient_uuid: targetPatientUuid,
          scheduled_at: dateTime,
          scheduled_end_at: endDateTime,
          location: effectiveLocation.value,
          purpose
        })
      }

      toast.success(
        props.mode === 'reschedule'
          ? 'Reschedule proposal submitted.'
          : 'Appointment scheduled successfully.'
      )
      emit('scheduled')
      emit('close')
    } catch (e: any) {
      errorMessage.value = e.data?.message || e.message || 'Failed to schedule appointment.'
    } finally {
      isScheduling.value = false
    }
  }
</script>

<template>
  <!-- Mobile View Mode: Full-window component covering chat with back button -->
  <div
    v-if="isInlineMode"
    class="bg-card flex h-full w-full flex-1 flex-col overflow-y-auto"
  >
    <!-- Mobile Top Header with Back Button and Patient Identity -->
    <div
      class="border-border bg-card sticky top-0 z-40 flex items-center justify-between border-b px-3 py-3 shadow-sm"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <!-- Back Button -->
        <button
          type="button"
          @click="emit('close')"
          class="text-foreground/70 hover:text-foreground hover:bg-foreground/5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95"
          aria-label="Back to chat"
        >
          <Icon
            name="heroicons:arrow-left-20-solid"
            class="text-2xl"
          />
        </button>

        <!-- Patient Avatar & Name / Title -->
        <div class="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            v-if="displayPatientAvatar || displayPatientName"
            class="bg-primary/10 h-10 w-10 shrink-0 overflow-hidden rounded-full"
          >
            <img
              v-if="displayPatientAvatar && !avatarError"
              :src="getStorageUrl(displayPatientAvatar)"
              :alt="displayPatientName"
              class="h-full w-full object-cover"
              @error="avatarError = true"
            />
            <div
              v-else
              class="text-primary flex h-full w-full items-center justify-center text-sm font-bold uppercase"
            >
              {{ (displayPatientName || 'P').charAt(0) }}
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-foreground truncate text-sm font-bold">
              {{
                displayPatientName ||
                (props.mode === 'reschedule' ? 'Reschedule Appointment' : 'Schedule Appointment')
              }}
            </h2>
            <p class="truncate text-[11px] font-semibold text-indigo-600">
              {{ props.mode === 'reschedule' ? 'Propose New Schedule' : 'Schedule Appointment' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Action badge -->
      <span
        class="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700"
      >
        {{ props.mode === 'reschedule' ? 'Reschedule' : 'New Schedule' }}
      </span>
    </div>

    <!-- Scrollable configuration body -->
    <div class="flex flex-col gap-4 p-4 pb-28">
      <!-- Patient Requested Schedule Banner (if patient requested a specific slot) -->
      <div
        v-if="patientRequestedScheduleFormatted"
        class="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900 shadow-2xs"
      >
        <div class="flex items-center gap-2">
          <Icon
            name="material-symbols:event-available-rounded"
            class="shrink-0 text-lg text-amber-600"
          />
          <div>
            <span class="font-bold">Patient Requested: </span>
            <span class="font-semibold">{{ patientRequestedScheduleFormatted }}</span>
          </div>
        </div>
        <button
          type="button"
          @click="resetToPatientRequestedSlot"
          class="shrink-0 cursor-pointer rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-amber-700 active:scale-95"
        >
          Reset to Slot
        </button>
      </div>

      <!-- Selected Date Banner -->
      <div class="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-indigo-900">Selected Date</span>
          <span
            v-if="selectedDate"
            class="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase"
          >
            Confirmed
          </span>
          <span
            v-else
            class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"
          >
            Required
          </span>
        </div>
        <p class="mt-1 text-sm font-bold text-indigo-600">
          {{ selectedDateFormatted || 'Please tap a date from the calendar below' }}
        </p>
      </div>

      <!-- Calendar -->
      <div class="flex w-full justify-center">
        <PatientSideComponentsCalendar
          :selected-date="selectedDate"
          :blocked-slots="blockedSlots"
          :duty-slots="dutySlots"
          :show-manage-blocks-link="true"
          :show-appointment-details-panel="!isDoctor"
          @date-selected="handleDateSelected"
        />
      </div>

      <!-- Time Range & Warnings -->
      <div class="border-border bg-card rounded-2xl border p-4 shadow-sm">
        <template v-if="!hasNoDutyOnDate">
          <AppTimeRangePicker
            v-model:start-time="scheduleTime"
            v-model:end-time="scheduleEndTime"
            :date="selectedDate"
            :current-start-time="props.prefillTime"
            :blocked-slots="blockedSlotsForDate"
            :duty-slots="dutySlotsForDate"
            :existing-appointments="existingApptSlotsForDate"
            label="Appointment Time"
          />

          <Transition name="fade-scale">
            <div
              v-if="isApptConflict"
              class="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
            >
              <Icon
                name="material-symbols:warning-rounded"
                class="mt-0.5 shrink-0 text-sm"
              />
              <div>
                <p class="font-bold">Conflicting Appointment</p>
                <p class="mt-0.5 text-red-500">
                  An appointment is already scheduled during this time slot. Please choose a
                  different time.
                </p>
              </div>
            </div>
          </Transition>

          <div
            v-if="errorMessage"
            class="mt-2 flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-bold text-red-600"
          >
            <Icon
              name="material-symbols:warning-rounded"
              class="mt-0.5 shrink-0 text-base text-red-500"
            />
            <span>{{ errorMessage }}</span>
          </div>

          <Transition name="fade-scale">
            <div
              v-if="selectedDate && isOutsideDutyHours"
              class="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
            >
              <Icon
                name="material-symbols:warning-rounded"
                class="mt-0.5 shrink-0 text-sm"
              />
              <div>
                <p class="font-bold">Outside Doctor's Duty Hours</p>
                <p class="mt-0.5 text-red-500">
                  Appointments must be scheduled during active duty hours on this date:
                  <strong>{{ dutyRangesLabel }}</strong
                  >.
                </p>
              </div>
            </div>
          </Transition>

          <Transition name="fade-scale">
            <div
              v-if="isSelectedTimeBlocked"
              class="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
            >
              <Icon
                name="material-symbols:block-rounded"
                class="mt-0.5 shrink-0 text-sm"
              />
              <div>
                <p class="font-bold">This time is blocked</p>
                <p class="mt-0.5 text-red-500">
                  Blocked on this date: <strong>{{ blockedRangesLabel }}</strong
                  >. Please choose a different time.
                </p>
              </div>
            </div>
          </Transition>

          <Transition name="fade-scale">
            <div
              v-if="selectedDate && blockedRangesLabel && !isSelectedTimeBlocked"
              class="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700"
            >
              <Icon
                name="material-symbols:warning-rounded"
                class="mt-0.5 shrink-0 text-sm"
              />
              <p>
                <span class="font-bold">Note:</span>
                This date has blocked periods: <strong>{{ blockedRangesLabel }}</strong
                >.
              </p>
            </div>
          </Transition>
        </template>

        <!-- Off-Duty / Unavailable Placeholder (fills the space when doctor has no duty on this date) -->
        <div
          v-else
          class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200/90 bg-gray-50/60 p-6 text-center"
        >
          <div
            class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200/60 bg-amber-50 text-amber-600 shadow-xs"
          >
            <Icon
              name="material-symbols:event-busy-rounded"
              class="h-6 w-6"
            />
          </div>
          <h4 class="text-sm font-bold text-gray-800">Doctor is Off-Duty on this date</h4>
          <p class="mt-1 max-w-xs text-xs leading-relaxed text-gray-500">
            The doctor has no scheduled duty hours on this date. Please select an available date
            from the calendar.
          </p>
          <div
            class="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-white px-3 py-1 text-[11px] font-semibold text-gray-600 shadow-xs"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            Not Available
          </div>
        </div>
      </div>

      <!-- Clinic / Location Selector -->
      <div class="border-border bg-card rounded-2xl border p-4 shadow-sm">
        <div class="mb-2 flex items-center justify-between">
          <label class="text-foreground/60 block text-xs font-bold tracking-wider uppercase"
            >Clinic / Location</label
          >
          <span
            v-if="wasAutofilled"
            class="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
          >
            <Icon
              name="heroicons:sparkles"
              class="h-3 w-3 text-emerald-600"
            />
            Autofilled
          </span>
        </div>

        <div class="space-y-2">
          <select
            v-if="clinics.length > 0"
            v-model="scheduleLocation"
            class="text-foreground w-full cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-sm font-medium outline-none focus:border-indigo-500"
          >
            <option
              value=""
              disabled
            >
              -- Select a Clinic Location --
            </option>
            <option
              v-for="c in clinics"
              :key="c.id"
              :value="c.name"
            >
              {{ c.name }} {{ c.address ? `(${c.address})` : '' }}
            </option>
            <option value="__custom__">+ Other / Custom Location</option>
          </select>

          <input
            v-if="clinics.length === 0 || scheduleLocation === '__custom__'"
            type="text"
            v-model="customLocationInput"
            placeholder="e.g. SkinCare Clinic, Rm 302"
            class="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-indigo-500"
          />
        </div>
      </div>
    </div>

    <!-- Sticky Bottom Actions Bar -->
    <div
      class="border-border bg-card sticky bottom-0 z-40 flex flex-col gap-2 border-t p-3.5 shadow-lg"
    >
      <AppButton
        variant="solid"
        class="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
        :disabled="
          !selectedDate ||
          !scheduleTime ||
          !scheduleEndTime ||
          !effectiveLocation ||
          isScheduling ||
          isSelectedTimeBlocked ||
          isTimeRangeInvalid ||
          isApptConflict ||
          isOutsideDutyHours ||
          hasNoDutyOnDate ||
          (!props.appointmentUuid &&
            !displayPatientName &&
            !internalSelectedPatient &&
            !props.patientId)
        "
        @click="confirmSchedule"
      >
        <template v-if="isScheduling">
          {{ props.mode === 'reschedule' ? 'Rescheduling...' : 'Scheduling...' }}
        </template>
        <template v-else>
          {{ props.mode === 'reschedule' ? 'Confirm Reschedule' : 'Confirm Schedule' }}
        </template>
      </AppButton>
      <AppButton
        variant="unstyled"
        class="bg-foreground/5 text-foreground/70 hover:bg-foreground/10 w-full rounded-xl py-2 text-xs font-bold transition-all"
        @click="emit('close')"
      >
        Cancel
      </AppButton>
    </div>
  </div>

  <!-- Desktop Modal Mode (teleports to body) -->
  <Teleport
    v-else
    to="body"
  >
    <Transition name="modal">
      <div
        class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs sm:p-6"
        @click.self="emit('close')"
      >
        <div
          class="bg-card border-border relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border shadow-2xl lg:flex-row xl:max-w-6xl"
        >
          <!-- Left side: Calendar -->
          <div
            class="flex flex-col justify-start border-b border-gray-100 bg-white p-4 sm:p-5 lg:w-[380px] lg:shrink-0 lg:border-r lg:border-b-0 xl:w-[400px]"
          >
            <PatientSideComponentsCalendar
              :selected-date="selectedDate"
              :blocked-slots="blockedSlots"
              :duty-slots="dutySlots"
              :show-manage-blocks-link="true"
              :show-appointment-details-panel="!isDoctor"
              @date-selected="handleDateSelected"
            />
          </div>

          <!-- Right side: Time & Location -->
          <div
            class="custom-scrollbar relative flex flex-1 flex-col justify-start overflow-y-auto bg-gray-50/60 p-6 sm:p-8"
          >
            <!-- Header with Title, Patient, and Top-Right Close Button -->
            <div class="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 class="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                  {{
                    props.mode === 'reschedule' ? 'Reschedule Appointment' : 'Schedule Appointment'
                  }}
                </h3>

                <!-- Patient identification / selector -->
                <div
                  v-if="displayPatientName"
                  class="mt-1 flex items-center gap-1.5 text-xs font-bold text-indigo-600"
                >
                  <Icon
                    name="heroicons:user-20-solid"
                    class="h-3.5 w-3.5"
                  />
                  <span>Patient: {{ displayPatientName }}</span>
                </div>
              </div>

              <!-- Close Button -->
              <button
                type="button"
                @click="emit('close')"
                class="cursor-pointer rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-200/60 hover:text-gray-700 active:scale-95"
                title="Close"
              >
                <Icon
                  name="material-symbols:close-rounded"
                  class="text-2xl"
                />
              </button>
            </div>

            <!-- Patient selector (when booking for patient without pre-assigned uuid) -->
            <div
              v-if="!props.appointmentUuid && props.patients && props.patients.length > 0"
              class="mb-5"
            >
              <label class="mb-1 block text-xs font-bold tracking-wider text-gray-500 uppercase">
                Select Patient *
              </label>
              <select
                v-model="internalSelectedPatient"
                class="w-full cursor-pointer rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500"
              >
                <option
                  :value="null"
                  disabled
                >
                  -- Choose a Patient --
                </option>
                <option
                  v-for="pat in props.patients"
                  :key="pat.id || pat.uuid"
                  :value="pat"
                >
                  {{ pat.name || pat.doctor || `${pat.first_name || ''} ${pat.last_name || ''}` }}
                  ({{ pat.email || pat.id }})
                </option>
              </select>
            </div>

            <!-- Patient Requested Schedule Banner -->
            <div
              v-if="patientRequestedScheduleFormatted"
              class="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900 shadow-2xs"
            >
              <div class="flex items-center gap-2">
                <Icon
                  name="material-symbols:event-available-rounded"
                  class="shrink-0 text-lg text-amber-600"
                />
                <div>
                  <div class="font-bold text-amber-800">Patient's Preferred Schedule:</div>
                  <div class="font-semibold text-gray-900">
                    {{ patientRequestedScheduleFormatted }}
                  </div>
                </div>
              </div>
              <button
                type="button"
                @click="resetToPatientRequestedSlot"
                class="shrink-0 cursor-pointer rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700 active:scale-95"
              >
                Reset to Slot
              </button>
            </div>

            <!-- Selected Date Display -->
            <div class="mb-5">
              <label class="mb-1.5 block text-xs font-bold tracking-wider text-gray-500 uppercase">
                Selected Date
              </label>
              <div
                class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-bold text-indigo-600 shadow-2xs"
              >
                <Icon
                  name="lucide:calendar"
                  class="shrink-0 text-base text-indigo-500"
                />
                <span>{{
                  selectedDateFormatted || selectedDate || 'Please select a date from the calendar'
                }}</span>
              </div>
            </div>

            <!-- Start & End Time Fields (Time Slot Selection) -->
            <div class="mb-5">
              <template v-if="!hasNoDutyOnDate">
                <AppTimeRangePicker
                  v-model:start-time="scheduleTime"
                  v-model:end-time="scheduleEndTime"
                  :date="selectedDate"
                  :current-start-time="props.prefillTime"
                  :blocked-slots="blockedSlotsForDate"
                  :duty-slots="dutySlotsForDate"
                  :existing-appointments="existingApptSlotsForDate"
                  label="Appointment Time"
                />

                <!-- Conflicting Appointment Warning -->
                <Transition name="fade-scale">
                  <div
                    v-if="isApptConflict"
                    class="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
                  >
                    <Icon
                      name="material-symbols:warning-rounded"
                      class="mt-0.5 shrink-0 text-sm"
                    />
                    <div>
                      <p class="font-bold">Conflicting Appointment</p>
                      <p class="mt-0.5 text-red-500">
                        An appointment is already scheduled during this time slot. Please choose a
                        different time.
                      </p>
                    </div>
                  </div>
                </Transition>

                <!-- Conflict / Error Alert -->
                <div
                  v-if="errorMessage"
                  class="mt-2 flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-bold text-red-600"
                >
                  <Icon
                    name="material-symbols:warning-rounded"
                    class="mt-0.5 shrink-0 text-base text-red-500"
                  />
                  <span>{{ errorMessage }}</span>
                </div>

                <!-- Outside duty hours warning -->
                <Transition name="fade-scale">
                  <div
                    v-if="selectedDate && isOutsideDutyHours"
                    class="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
                  >
                    <Icon
                      name="material-symbols:warning-rounded"
                      class="mt-0.5 shrink-0 text-sm"
                    />
                    <div>
                      <p class="font-bold">Outside Doctor's Duty Hours</p>
                      <p class="mt-0.5 text-red-500">
                        Appointments must be scheduled during active duty hours on this date:
                        <strong>{{ dutyRangesLabel }}</strong
                        >.
                      </p>
                    </div>
                  </div>
                </Transition>

                <!-- Blocked time warning -->
                <Transition name="fade-scale">
                  <div
                    v-if="isSelectedTimeBlocked"
                    class="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
                  >
                    <Icon
                      name="material-symbols:block-rounded"
                      class="mt-0.5 shrink-0 text-sm"
                    />
                    <div>
                      <p class="font-bold">This time is blocked</p>
                      <p class="mt-0.5 text-red-500">
                        Blocked on this date: <strong>{{ blockedRangesLabel }}</strong
                        >. Please choose a different time.
                      </p>
                    </div>
                  </div>
                </Transition>

                <!-- Partial block info (date has blocks but selected time is fine) -->
                <Transition name="fade-scale">
                  <div
                    v-if="selectedDate && blockedRangesLabel && !isSelectedTimeBlocked"
                    class="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700"
                  >
                    <Icon
                      name="material-symbols:warning-rounded"
                      class="mt-0.5 shrink-0 text-sm"
                    />
                    <p>
                      <span class="font-bold">Note:</span>
                      This date has blocked periods: <strong>{{ blockedRangesLabel }}</strong
                      >.
                    </p>
                  </div>
                </Transition>
              </template>

              <!-- Off-duty empty state filling the space -->
              <div
                v-else
                class="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200/90 bg-gray-50/60 p-8 text-center"
              >
                <div
                  class="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/60 bg-amber-50 text-amber-600 shadow-xs"
                >
                  <Icon
                    name="material-symbols:event-busy-rounded"
                    class="h-7 w-7"
                  />
                </div>
                <h4 class="text-sm font-bold text-gray-800">Doctor is Off-Duty on this date</h4>
                <p class="mt-1.5 max-w-xs text-xs leading-relaxed text-gray-500">
                  The doctor has no scheduled duty hours on this date. Please select an available
                  date from the calendar.
                </p>
                <div
                  class="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-white px-3 py-1 text-[11px] font-semibold text-gray-600 shadow-xs"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  Not Available for Booking
                </div>
              </div>
            </div>

            <!-- Clinic / Location Selector -->
            <div class="mb-6">
              <div class="mb-2 flex items-center justify-between">
                <label class="block text-sm font-bold text-gray-500">Clinic / Location</label>
                <span
                  v-if="wasAutofilled"
                  class="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                >
                  <Icon
                    name="heroicons:sparkles"
                    class="h-3 w-3 text-emerald-600"
                  />
                  Autofilled from Duty Preset
                </span>
              </div>

              <div class="space-y-2">
                <select
                  v-if="clinics.length > 0"
                  v-model="scheduleLocation"
                  class="text-foreground w-full cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-sm font-medium outline-none focus:border-indigo-500"
                >
                  <option
                    value=""
                    disabled
                  >
                    -- Select a Clinic Location --
                  </option>
                  <option
                    v-for="c in clinics"
                    :key="c.id"
                    :value="c.name"
                  >
                    {{ c.name }} {{ c.address ? `(${c.address})` : '' }}
                  </option>
                  <option value="__custom__">+ Other / Custom Location</option>
                </select>

                <input
                  v-if="clinics.length === 0 || scheduleLocation === '__custom__'"
                  type="text"
                  v-model="customLocationInput"
                  placeholder="e.g. SkinCare Clinic, Rm 302"
                  class="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="mt-4 flex flex-col gap-2.5 pb-2">
              <AppButton
                variant="solid"
                class="bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
                :disabled="
                  !selectedDate ||
                  !scheduleTime ||
                  !scheduleEndTime ||
                  !effectiveLocation ||
                  isScheduling ||
                  isSelectedTimeBlocked ||
                  isTimeRangeInvalid ||
                  isApptConflict ||
                  isOutsideDutyHours ||
                  hasNoDutyOnDate ||
                  (!props.appointmentUuid &&
                    !displayPatientName &&
                    !internalSelectedPatient &&
                    !props.patientId)
                "
                @click="confirmSchedule"
              >
                <template v-if="isScheduling">
                  {{ props.mode === 'reschedule' ? 'Rescheduling...' : 'Scheduling...' }}
                </template>
                <template v-else>
                  {{ props.mode === 'reschedule' ? 'Confirm Reschedule' : 'Confirm Schedule' }}
                </template>
              </AppButton>
              <AppButton
                variant="unstyled"
                class="bg-foreground/5 text-foreground/70 hover:bg-foreground/10 font-bold transition-all"
                @click="emit('close')"
              >
                Cancel
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
