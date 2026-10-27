<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
  import { toast } from 'vue-sonner'
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'
  import { diagnosisService } from '~/api/diagnosis/DiagnosisService'
  import { parseAppointmentDateTime } from '~/composables/useAppointments'

  const props = withDefaults(
    defineProps<{
      modelValue: boolean
      doctor: any | null
      diagnosisUuid?: string
      inline?: boolean
    }>(),
    {
      modelValue: false,
      doctor: null,
      diagnosisUuid: '',
      inline: false
    }
  )

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'booked', appointment: any): void
  }>()

  const { getStorageUrl } = useStorage()

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

  // ── State ────────────────────────────────────────────────────────────────────
  const isSubmitting = ref(false)
  const isLoading = ref(true)
  const doctorDutySlots = ref<any[]>([])
  const doctorBlockedSlots = ref<any[]>([])
  const doctorBlockedDates = ref<string[]>([])
  const doctorAppointmentsList = ref<any[]>([])

  const diagnosisData = ref<any | null>(null)
  const isLoadingDiagnosis = ref(false)

  const selectedDate = ref<string>('')
  const selectedTime = ref<string>('')
  const purpose = ref<string>('General Dermatological Consultation')

  const presetPurposes = [
    'General Dermatological Consultation',
    'Acne & Blemish Check',
    'Eczema & Rash Assessment',
    'Suspicious Mole / Lesion Review',
    'Follow-up Consultation'
  ]

  const setPurposePreset = (preset: string) => {
    purpose.value = preset
  }

  // ── Doctor details helpers ───────────────────────────────────────────────────
  const doctorDisplayName = computed(() => {
    if (!props.doctor) return 'Doctor'
    if (props.doctor.first_name || props.doctor.last_name) {
      return `Dr. ${props.doctor.first_name || ''} ${props.doctor.last_name || ''}`.trim()
    }
    return props.doctor.name || 'Doctor'
  })

  const doctorLocation = computed(() => {
    if (!props.doctor) return ''
    if (props.doctor.city && props.doctor.province) {
      return `${props.doctor.city}, ${props.doctor.province}`
    }
    return props.doctor.city || props.doctor.province || 'Clinic Practice'
  })

  const doctorAvatar = computed(() => {
    if (!props.doctor) return ''
    if (props.doctor.avatar_path) return getStorageUrl(props.doctor.avatar_path)
    if (props.doctor.doctor_verification?.id_photo_path) {
      return getStorageUrl(props.doctor.doctor_verification.id_photo_path)
    }
    return ''
  })

  // ── Load diagnosis details ───────────────────────────────────────────────────
  const fetchDiagnosis = async () => {
    if (!props.diagnosisUuid) {
      diagnosisData.value = null
      return
    }
    isLoadingDiagnosis.value = true
    try {
      const res = await diagnosisService.show(props.diagnosisUuid)
      const diag = (res as any)?.data ?? res
      diagnosisData.value = diag
      if (diag?.label) {
        purpose.value = `AI Scan Assessment: ${diag.label}`
      }
    } catch (e) {
      console.error('Failed to load diagnosis details:', e)
    } finally {
      isLoadingDiagnosis.value = false
    }
  }

  // ── Calendar logic ───────────────────────────────────────────────────────────
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

  const toMins = (t: string): number => {
    if (!t) return 0
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

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

  const getDutyForDate = (dateStr: string) => {
    return doctorDutySlots.value.filter((s: any) => s.available_date?.slice(0, 10) === dateStr)
  }

  const getBlockedForDate = (dateStr: string) => {
    return doctorBlockedSlots.value.filter((s: any) => s.available_date?.slice(0, 10) === dateStr)
  }

  const isDoctorOnDuty = (day: number): boolean => {
    return getDutyForDate(dateStringFor(day)).length > 0
  }

  const hasAnyDutyConfigured = computed(() => doctorDutySlots.value.length > 0)

  const hasAvailableSlotOnDate = (day: number): boolean => {
    const dateStr = dateStringFor(day)
    const dayDuties = getDutyForDate(dateStr)
    if (!dayDuties.length) return false

    const dayBlocked = getBlockedForDate(dateStr)
    const DURATION_MINS = 60

    const dayBookedAppts = doctorAppointmentsList.value.filter((a: any) => {
      const apptDate = a.date || a.raw_scheduled_at?.slice(0, 10)
      return apptDate === dateStr && a.status !== 'declined'
    })

    const now = new Date()
    const currentM = now.getHours() * 60 + now.getMinutes()
    const isTodayDate = dateStr === today
    const isDateInPast = dateStr < today

    for (const duty of dayDuties) {
      const dutyStart = toMins(duty.start_time)
      const dutyEnd = toMins(duty.end_time)

      for (let m = dutyStart; m + DURATION_MINS <= dutyEnd; m += 30) {
        if (isDateInPast) continue
        if (isTodayDate && m <= currentM) continue

        const endM = m + DURATION_MINS

        const isBlocked = dayBlocked.some((b: any) => {
          const bStart = toMins(b.start_time)
          const bEnd = toMins(b.end_time)
          return m < bEnd && endM > bStart
        })
        if (isBlocked) continue

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

        return true
      }
    }

    return false
  }

  const isUnavailable = (day: number): boolean => {
    const dateStr = dateStringFor(day)
    if (doctorBlockedDates.value.includes(dateStr)) {
      return true
    }
    if (isDoctorOnDuty(day)) {
      return !hasAvailableSlotOnDate(day)
    }
    return false
  }

  const isDateSelectable = (day: number): boolean => {
    if (isPast(day)) return false
    if (isUnavailable(day)) return false
    if (hasAnyDutyConfigured.value && !isDoctorOnDuty(day)) return false
    return true
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

  const timeSlotsSection = ref<HTMLElement | null>(null)
  const scrollContainer = ref<HTMLElement | null>(null)

  const selectDate = async (day: number) => {
    if (!isDateSelectable(day)) return
    const dateStr = dateStringFor(day)
    if (selectedDate.value !== dateStr) {
      selectedDate.value = dateStr
      selectedTime.value = ''
    }

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

  // ── Load Availability & Appointments ─────────────────────────────────────────
  const fetchAvailabilityAndAppointments = async () => {
    if (!props.doctor) return
    isLoading.value = true
    try {
      const docIdentifier = props.doctor.uuid || props.doctor.id
      if (docIdentifier) {
        const res = await doctorAvailabilityService.listForDoctor(docIdentifier)
        const list = (res as any)?.data ?? (Array.isArray(res) ? res : [])

        doctorBlockedSlots.value = list.filter(
          (s: any) => Number(s.is_available) === 0 || s.is_available === false
        )
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

        const apptRes = await appointmentService.list({ doctor_uuid: docIdentifier })
        const apptList = (apptRes as any)?.data ?? (Array.isArray(apptRes) ? apptRes : [])
        doctorAppointmentsList.value = apptList
      }

      // Automatically default to the earliest selectable date (e.g. tomorrow or nearest duty date)
      if (!selectedDate.value) {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        for (let i = 0; i < 30; i++) {
          const testDay = d.getDate()
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const dayStr = `${y}-${m}-${String(testDay).padStart(2, '0')}`
          const isDuty = getDutyForDate(dayStr).length > 0
          const isBlocked = doctorBlockedDates.value.includes(dayStr)

          if ((!hasAnyDutyConfigured.value || isDuty) && !isBlocked) {
            selectedDate.value = dayStr
            currentDate.value = new Date(d)
            break
          }
          d.setDate(d.getDate() + 1)
        }
      }
    } catch (e) {
      console.error('Failed to load doctor availability:', e)
    } finally {
      isLoading.value = false
    }
  }

  watch(
    [() => props.doctor, () => props.modelValue],
    ([newDoc, isOpen]) => {
      if (isOpen && newDoc) {
        selectedTime.value = ''
        fetchAvailabilityAndAppointments()
        if (props.diagnosisUuid) {
          fetchDiagnosis()
        }
      }
    },
    { immediate: true }
  )

  // ── Time Slots Generation (30-Minute Interval Scope) ─────────────────────────
  interface TimeSlotOption {
    time24: string
    endTime24: string
    label: string
    endLabel: string
    durationLabel: string
    isAvailable: boolean
    isPassed?: boolean
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
      return apptDate === dateStr && a.status !== 'declined'
    })

    const DURATION_MINS = 60 // 1-hour consultation standard

    const now = new Date()
    const currentM = now.getHours() * 60 + now.getMinutes()
    const isTodayDate = dateStr === today
    const isDateInPast = dateStr < today

    const isSlotPassed = (startM: number) => {
      if (isDateInPast) return true
      if (isTodayDate && startM <= currentM) return true
      return false
    }

    const isSlotBlocked = (startM: number) => {
      const endM = startM + DURATION_MINS
      return dayBlocked.some((b: any) => {
        const bStart = toMins(b.start_time)
        const bEnd = toMins(b.end_time)
        return startM < bEnd && endM > bStart
      })
    }

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

    const slots: TimeSlotOption[] = []

    if (dayDuties.length > 0) {
      dayDuties.forEach((duty: any) => {
        const dutyStart = toMins(duty.start_time)
        const dutyEnd = toMins(duty.end_time)
        const clinicName = duty.clinic?.name || duty.location_name || 'Clinic Duty'

        // 30-minute scope interval
        for (let m = dutyStart; m + DURATION_MINS <= dutyEnd; m += 30) {
          const hh = String(Math.floor(m / 60)).padStart(2, '0')
          const mm = String(m % 60).padStart(2, '0')
          const time24 = `${hh}:${mm}`

          const endM = m + DURATION_MINS
          const endHh = String(Math.floor(endM / 60)).padStart(2, '0')
          const endMm = String(endM % 60).padStart(2, '0')
          const endTime24 = `${endHh}:${endMm}`

          const passed = isSlotPassed(m)
          const isAvail = !passed && !isSlotBlocked(m) && !isSlotBooked(m)

          slots.push({
            time24,
            endTime24,
            label: formatTime12H(time24),
            endLabel: formatTime12H(endTime24),
            durationLabel: '1 hr',
            isAvailable: isAvail,
            isPassed: passed,
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

        const passed = isSlotPassed(m)
        const isAvail = !passed && !isSlotBlocked(m) && !isSlotBooked(m)

        slots.push({
          time24,
          endTime24,
          label: formatTime12H(time24),
          endLabel: formatTime12H(endTime24),
          durationLabel: '1 hr',
          isAvailable: isAvail,
          isPassed: passed
        })
      }
    }

    return slots
  })

  watch([selectedDate, availableTimeSlots], () => {
    if (selectedTime.value) {
      const current = availableTimeSlots.value.find(s => s.time24 === selectedTime.value)
      if (!current || !current.isAvailable) {
        selectedTime.value = ''
      }
    }
  })

  const selectTimeSlot = (slot: TimeSlotOption) => {
    if (!slot.isAvailable) return
    selectedTime.value = slot.time24
  }

  const closeModal = () => {
    if (isSubmitting.value) return
    emit('update:modelValue', false)
  }

  // ── Submit Request ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!props.doctor) return
    if (!selectedDate.value) {
      toast.error('Please select an appointment date.')
      return
    }
    const day = Number(selectedDate.value.slice(8, 10))
    if (!isDateSelectable(day)) {
      toast.error('Please select an available date within the doctor duty schedule.')
      return
    }
    if (!selectedTime.value) {
      toast.error('Please select an available consultation time slot.')
      return
    }
    const chosenSlot = availableTimeSlots.value.find(s => s.time24 === selectedTime.value)
    if (!chosenSlot || !chosenSlot.isAvailable) {
      toast.error('The selected time slot is no longer available or has already passed.')
      return
    }

    isSubmitting.value = true
    try {
      const [hStr, mStr] = selectedTime.value.split(':')
      const h = parseInt(hStr, 10)
      const m = parseInt(mStr, 10)
      const endH = (h + 1) % 24
      const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`

      const scheduledAt = `${selectedDate.value} ${selectedTime.value}:00`
      const scheduledEndAt = `${selectedDate.value} ${endTime}:00`
      const resolvedLocation =
        selectedDateClinic.value?.name || doctorLocation.value || 'Clinic Duty'

      const docId = props.doctor.id || props.doctor.uuid
      const effectivePurpose = props.diagnosisUuid
        ? diagnosisData.value?.label
          ? `AI Scan Assessment: ${diagnosisData.value.label}`
          : 'AI Scan Assessment'
        : purpose.value || 'General Dermatological Consultation'

      const payload: any = {
        doctor_id: docId,
        scheduled_at: scheduledAt,
        scheduled_end_at: scheduledEndAt,
        purpose: effectivePurpose,
        source: props.diagnosisUuid ? 'scan' : 'direct',
        location: resolvedLocation
      }

      if (props.diagnosisUuid) {
        payload.diagnosis_uuid = props.diagnosisUuid
      }

      const res = await appointmentService.create(payload)
      toast.success('Appointment request submitted successfully!')

      const bookedData = {
        ...(res?.appointment || res || {}),
        conversation_uuid: res?.conversation_uuid || res?.appointment?.conversation_uuid
      }
      emit('booked', bookedData)
      emit('update:modelValue', false)
    } catch (e: any) {
      console.error('Failed to submit appointment request:', e)
      const errorMsg =
        e?.data?.message ||
        e?.response?._data?.message ||
        e?.message ||
        'Failed to request appointment. The slot may be unavailable.'
      toast.error(errorMsg)
    } finally {
      isSubmitting.value = false
    }
  }
</script>

<template>
  <div v-if="modelValue">
    <!-- Mobile View Mode: Full-window component covering screen with back button -->
    <div
      v-if="isInlineMode"
      class="bg-card fixed inset-0 z-[1000] flex h-full w-full flex-col overflow-hidden"
    >
      <!-- Mobile Top Header with Back Button and Identity -->
      <div
        class="border-border bg-card sticky top-0 z-40 flex items-center justify-between border-b px-3 py-3 shadow-sm"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <!-- Back Button -->
          <button
            type="button"
            @click="closeModal"
            class="text-foreground/70 hover:text-foreground hover:bg-foreground/5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95"
            aria-label="Back"
          >
            <Icon
              name="heroicons:arrow-left-20-solid"
              class="text-2xl"
            />
          </button>

          <!-- Doctor Avatar & Name -->
          <div class="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              class="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full"
            >
              <img
                v-if="doctorAvatar"
                :src="doctorAvatar"
                :alt="doctorDisplayName"
                class="h-full w-full object-cover"
              />
              <Icon
                v-else
                name="lucide:stethoscope"
                class="text-primary text-base"
              />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-foreground truncate text-sm font-bold">
                {{ doctorDisplayName }}
              </h2>
              <p class="truncate text-[11px] font-semibold text-indigo-600">Request Consultation</p>
            </div>
          </div>
        </div>

        <!-- Action badge -->
        <span
          class="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700"
        >
          Consultation
        </span>
      </div>

      <!-- Scrollable content -->
      <div class="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-24">
        <!-- Diagnosis context if available -->
        <div
          v-if="diagnosisData"
          class="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3.5"
        >
          <img
            v-if="diagnosisData.image_path"
            :src="getStorageUrl(diagnosisData.image_path)"
            class="h-12 w-12 rounded-xl object-cover"
            alt="Scan thumbnail"
          />
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-black tracking-wider text-indigo-600 uppercase">
              Referral Scan
            </p>
            <p class="truncate text-xs font-black text-indigo-950">
              {{ diagnosisData.label || 'AI Skin Scan' }}
            </p>
          </div>
        </div>

        <!-- Calendar Selection Card -->
        <div class="border-border bg-card rounded-2xl border p-4 shadow-sm">
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
                  isPrevMonthDisabled ? 'cursor-not-allowed opacity-25' : 'hover:bg-primary/10'
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
            <div
              v-for="empty in startingDayOffset"
              :key="'m-empty-' + empty"
            ></div>

            <div
              v-for="date in daysInMonth"
              :key="'m-date-' + date"
              @click="selectDate(date)"
              class="relative flex h-8 w-8 items-center justify-center place-self-center rounded-full text-[13px] font-semibold transition-all select-none"
              :class="[
                isPast(date)
                  ? 'text-muted-foreground/40 pointer-events-none cursor-not-allowed line-through'
                  : selectedDate === dateStringFor(date)
                    ? 'bg-secondary z-10 scale-110 cursor-pointer font-bold text-white shadow-md'
                    : isUnavailable(date)
                      ? 'cursor-not-allowed bg-red-50 text-red-400 opacity-80 ring-1 ring-red-200'
                      : isDoctorOnDuty(date)
                        ? 'cursor-pointer bg-emerald-50 font-bold text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-100'
                        : hasAnyDutyConfigured
                          ? 'text-muted-foreground/40 cursor-not-allowed bg-gray-50/60 ring-1 ring-gray-100'
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
                v-else-if="isDoctorOnDuty(date) && !isPast(date)"
                class="absolute -bottom-0.5 h-1 w-1 rounded-full bg-emerald-500"
              />
            </div>
          </div>

          <!-- Legend -->
          <div
            class="border-border mt-3 flex flex-wrap items-center justify-center gap-3 border-t pt-2.5 text-[10px] font-medium text-slate-500"
          >
            <span class="flex items-center gap-1">
              <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
              Doctor Available
            </span>
            <span class="flex items-center gap-1">
              <span class="h-2 w-2 rounded-full bg-gray-300"></span>
              Off-Duty
            </span>
            <span class="flex items-center gap-1">
              <span class="h-2 w-2 rounded-full bg-red-400"></span>
              Unavailable
            </span>
          </div>
        </div>

        <!-- Preferred Time Slot section -->
        <div
          v-if="selectedDate"
          class="border-border bg-card rounded-2xl border p-4 shadow-sm"
        >
          <!-- Clinic Location for selected date -->
          <div
            v-if="selectedDateClinic"
            class="border-primary/20 bg-primary/5 mb-3 rounded-xl border p-3"
          >
            <p class="text-[10px] font-bold text-indigo-600 uppercase">Practice Location</p>
            <p class="text-foreground text-xs font-bold">{{ selectedDateClinic.name }}</p>
            <p
              v-if="selectedDateClinic.dutyHours"
              class="text-muted-foreground mt-0.5 text-[10px]"
            >
              Hours: {{ selectedDateClinic.dutyHours }}
            </p>
          </div>

          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-foreground text-xs font-bold tracking-wider uppercase">
              Choose Time Slot (:30 min Scope)
            </h3>
            <span
              v-if="availableTimeSlots.length"
              class="text-muted-foreground text-[10px]"
            >
              {{ availableTimeSlots.filter(s => s.isAvailable).length }} slots
            </span>
          </div>

          <div
            v-if="availableTimeSlots.length"
            class="grid grid-cols-2 gap-2"
          >
            <button
              v-for="slot in availableTimeSlots"
              :key="slot.time24"
              type="button"
              :disabled="!slot.isAvailable"
              @click="selectTimeSlot(slot)"
              class="relative flex flex-col items-start rounded-xl p-2.5 text-left transition-all"
              :class="[
                !slot.isAvailable
                  ? 'bg-muted/40 text-muted-foreground/40 cursor-not-allowed line-through'
                  : selectedTime === slot.time24
                    ? 'bg-secondary ring-secondary/30 scale-[1.02] font-bold text-white shadow-md ring-2'
                    : 'bg-card text-foreground hover:bg-primary/10 border-border/70 border shadow-xs'
              ]"
            >
              <div class="flex w-full items-center justify-between">
                <span class="text-xs font-bold">{{ slot.label }}</span>
                <span class="text-[9px] opacity-75">1 hr</span>
              </div>
              <span
                class="text-[9px]"
                :class="selectedTime === slot.time24 ? 'text-white/80' : 'text-muted-foreground'"
              >
                {{ slot.isPassed ? 'Passed' : `until ${slot.endLabel}` }}
              </span>
            </button>
          </div>
          <div
            v-else
            class="text-muted-foreground py-4 text-center text-xs"
          >
            No slots available on this date.
          </div>
        </div>

        <!-- Consultation Notes & Presets -->
        <div class="border-border bg-card rounded-2xl border p-4 shadow-sm">
          <label class="text-foreground mb-1 block text-xs font-bold">
            Consultation Reason / Notes
          </label>
          <input
            v-model="purpose"
            type="text"
            placeholder="e.g. General consultation or skin check"
            class="border-border bg-background text-foreground mb-2 w-full rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="preset in presetPurposes"
              :key="preset"
              type="button"
              @click="setPurposePreset(preset)"
              class="rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all active:scale-95"
              :class="
                purpose === preset
                  ? 'bg-primary/10 text-primary border-primary/30 font-bold'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted border-border'
              "
            >
              {{ preset }}
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Bottom Footer -->
      <div
        class="border-border bg-card fixed right-0 bottom-0 left-0 z-50 flex items-center justify-between border-t p-3 shadow-lg"
      >
        <div class="min-w-0 flex-1 pr-3">
          <p class="text-muted-foreground text-[10px]">Preferred Consultation</p>
          <p class="text-foreground truncate text-xs font-bold">
            <span v-if="selectedDate">
              {{ selectedDate }}
              <span v-if="selectedTime">at {{ formatTime12H(selectedTime) }}</span>
            </span>
            <span
              v-else
              class="text-muted-foreground font-normal"
            >
              Pick date &amp; time
            </span>
          </p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            @click="closeModal"
            class="border-border text-foreground rounded-xl border px-3 py-2 text-xs font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            :disabled="!selectedDate || !selectedTime || isSubmitting"
            @click="handleSubmit"
            class="bg-primary flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md disabled:opacity-50"
          >
            <Icon
              v-if="isSubmitting"
              name="svg-spinners:ring-resize"
              class="text-sm"
            />
            <Icon
              v-else
              name="solar:calendar-add-bold"
              class="text-sm"
            />
            <span>Send Request</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Desktop Modal Mode (teleports to body) -->
    <Teleport
      v-else
      to="body"
    >
      <Transition name="modal">
        <div
          class="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          @click.self="closeModal"
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
                      name="lucide:calendar-plus"
                      class="text-lg text-white"
                    />
                  </div>
                  <div>
                    <p
                      class="text-[10px] font-bold tracking-widest text-white uppercase opacity-80"
                    >
                      Book Consultation
                    </p>
                    <h3 class="text-base leading-tight font-black text-white">
                      Request Consultation
                    </h3>
                  </div>
                </div>
                <AppButton
                  variant="unstyled"
                  size="unstyled"
                  rounded="unstyled"
                  class="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-all hover:bg-white/15 hover:text-white"
                  @click="closeModal"
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
                    class="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full"
                  >
                    <img
                      v-if="doctorAvatar"
                      :src="doctorAvatar"
                      :alt="doctorDisplayName"
                      class="h-full w-full object-cover"
                    />
                    <Icon
                      v-else
                      name="lucide:stethoscope"
                      class="text-primary text-sm"
                    />
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <p class="text-foreground text-sm font-bold">{{ doctorDisplayName }}</p>
                      <span
                        v-if="doctor.doctor_verification?.verified_at"
                        class="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-300"
                      >
                        verified
                      </span>
                    </div>
                    <p class="text-muted-foreground text-xs">
                      {{ doctorLocation }}
                    </p>
                  </div>
                </div>
                <span class="text-muted-foreground hidden text-xs font-medium sm:inline-block">
                  Standard Consultation:
                  <strong class="text-foreground font-semibold">1 hour</strong>
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
                      class="relative flex h-8 w-8 items-center justify-center place-self-center rounded-full text-[13px] font-semibold transition-all select-none"
                      :class="[
                        isPast(date)
                          ? 'text-muted-foreground/40 pointer-events-none cursor-not-allowed line-through'
                          : selectedDate === dateStringFor(date)
                            ? 'bg-secondary z-10 scale-110 cursor-pointer text-white shadow-md'
                            : isUnavailable(date)
                              ? 'cursor-not-allowed bg-red-50 text-red-400 opacity-80 ring-1 ring-red-200'
                              : isDoctorOnDuty(date)
                                ? 'cursor-pointer bg-emerald-50 font-bold text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-100'
                                : hasAnyDutyConfigured
                                  ? 'text-muted-foreground/40 cursor-not-allowed bg-gray-50/60 ring-1 ring-gray-100'
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
                        v-else-if="isDoctorOnDuty(date) && !isPast(date)"
                        class="absolute -bottom-0.5 h-1 w-1 rounded-full bg-emerald-500"
                      />

                      <!-- Tooltips -->
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
                          <p class="text-xs font-bold text-red-100">Unavailable</p>
                        </div>
                      </Transition>

                      <Transition name="fade-scale">
                        <div
                          v-if="
                            hoveredDate === dateStringFor(date) &&
                            isDoctorOnDuty(date) &&
                            !isUnavailable(date) &&
                            !isPast(date)
                          "
                          class="pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-2 -translate-x-1/2 rounded-xl border border-emerald-700/60 bg-emerald-950/95 px-2.5 py-1.5 text-center text-xs whitespace-nowrap text-white shadow-2xl backdrop-blur-md"
                        >
                          <div
                            class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-emerald-700/60 bg-emerald-950/95"
                          />
                          <p class="text-xs font-bold text-emerald-100">Doctor Available</p>
                        </div>
                      </Transition>
                    </div>
                  </div>

                  <!-- Legend -->
                  <div
                    class="border-border mt-4 flex flex-wrap items-center justify-center gap-3 border-t pt-3 text-[11px] font-medium text-slate-600 dark:text-slate-400"
                  >
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

              <!-- Right Pane: Clinic Location & 30-Minute Slots & Notes -->
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
                        <span
                          class="bg-primary/15 text-primary rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        >
                          Doctor Practice Location
                        </span>
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

                  <!-- Referral Diagnosis details if available -->
                  <div
                    v-if="diagnosisData"
                    class="mb-4 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3.5"
                  >
                    <img
                      v-if="diagnosisData.image_path"
                      :src="getStorageUrl(diagnosisData.image_path)"
                      class="h-12 w-12 rounded-xl object-cover shadow-xs"
                      alt="Scan thumbnail"
                    />
                    <div class="min-w-0 flex-1">
                      <p class="text-[10px] font-black tracking-wider text-indigo-600 uppercase">
                        Attached Clinical Scan
                      </p>
                      <h4 class="truncate text-sm font-black text-indigo-950">
                        {{ diagnosisData.label || 'AI Skin Assessment' }}
                      </h4>
                      <p class="text-muted-foreground text-[11px]">
                        Scan from {{ diagnosisData.date || 'Recent assessment' }}
                      </p>
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
                        Select Preferred Time Slot (:30 min Scope)
                      </h4>
                    </div>
                    <span
                      v-if="availableTimeSlots.length > 0"
                      class="text-muted-foreground text-[11px] font-medium"
                    >
                      {{ availableTimeSlots.filter(s => s.isAvailable).length }} slots available
                    </span>
                  </div>

                  <!-- Time slots grid (30-minute intervals) -->
                  <div
                    v-if="availableTimeSlots.length > 0"
                    class="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
                  >
                    <button
                      v-for="slot in availableTimeSlots"
                      :key="slot.time24"
                      type="button"
                      :disabled="!slot.isAvailable"
                      @click="selectTimeSlot(slot)"
                      class="relative flex flex-col items-start justify-center gap-1 rounded-xl p-3 text-left transition-all"
                      :class="[
                        !slot.isAvailable
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
                        {{ slot.isPassed ? 'Passed' : `until ${slot.endLabel}` }}
                      </span>
                    </button>
                  </div>

                  <div
                    v-else
                    class="my-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-center text-xs text-amber-700"
                  >
                    <Icon
                      name="lucide:alert-circle"
                      class="mx-auto mb-2 text-xl"
                    />
                    <p class="font-bold">No Available Time Slots</p>
                    <p class="mt-1 text-[11px] opacity-80">
                      All consultation hours for this date are fully booked or blocked. Please
                      select another date.
                    </p>
                  </div>

                  <!-- Reason / Notes Input & Presets -->
                  <div class="mt-5 border-t pt-4">
                    <label class="text-foreground mb-1 block text-xs font-bold">
                      Consultation Reason / Notes
                    </label>
                    <input
                      v-model="purpose"
                      type="text"
                      placeholder="e.g. General consultation, rash review..."
                      class="border-border bg-background text-foreground mb-2 w-full rounded-xl border px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div class="flex flex-wrap gap-1.5">
                      <button
                        v-for="preset in presetPurposes"
                        :key="preset"
                        type="button"
                        @click="setPurposePreset(preset)"
                        class="rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95"
                        :class="
                          purpose === preset
                            ? 'bg-primary/10 text-primary border-primary/30 font-bold'
                            : 'bg-card text-muted-foreground hover:bg-muted border-border/70'
                        "
                      >
                        {{ preset }}
                      </button>
                    </div>
                  </div>
                </template>

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
              <div class="flex items-center gap-2.5">
                <div
                  class="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                >
                  <Icon
                    name="lucide:calendar-clock"
                    class="text-primary text-sm"
                  />
                </div>
                <div>
                  <p class="text-muted-foreground text-[10px] font-bold uppercase">
                    Selected Schedule
                  </p>
                  <p class="text-foreground text-xs font-bold">
                    <span v-if="selectedDate">
                      {{ selectedDateLabel }}
                      <span
                        v-if="selectedTime"
                        class="text-primary"
                      >
                        at {{ formatTime12H(selectedTime) }}
                      </span>
                    </span>
                    <span
                      v-else
                      class="text-muted-foreground font-normal"
                    >
                      Please pick a date &amp; time slot above
                    </span>
                  </p>
                </div>
              </div>

              <div class="flex w-full items-center justify-end gap-2 sm:w-auto">
                <AppButton
                  variant="unstyled"
                  size="unstyled"
                  rounded="unstyled"
                  class="border-border text-foreground/70 hover:text-foreground hover:bg-foreground/5 cursor-pointer rounded-xl border px-4 py-2 text-xs font-bold transition-all active:scale-95"
                  @click="closeModal"
                >
                  Cancel
                </AppButton>

                <AppButton
                  variant="unstyled"
                  size="unstyled"
                  rounded="unstyled"
                  :disabled="!selectedDate || !selectedTime || isSubmitting"
                  class="bg-primary flex cursor-pointer items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-md transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                  @click="handleSubmit"
                >
                  <Icon
                    v-if="isSubmitting"
                    name="svg-spinners:ring-resize"
                    class="text-sm"
                  />
                  <Icon
                    v-else
                    name="solar:calendar-add-bold"
                    class="text-sm"
                  />
                  <span>{{ isSubmitting ? 'Submitting...' : 'Send Appointment Request' }}</span>
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.08);
    border-radius: 9999px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.15);
  }

  .fade-scale-enter-active,
  .fade-scale-leave-active {
    transition: all 0.15s ease;
  }
  .fade-scale-enter-from,
  .fade-scale-leave-to {
    opacity: 0;
    transform: translate(-50%, 4px) scale(0.95);
  }

  .modal-enter-active,
  .modal-leave-active {
    transition: all 0.25s ease-out;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
    transform: scale(0.96);
  }
</style>
