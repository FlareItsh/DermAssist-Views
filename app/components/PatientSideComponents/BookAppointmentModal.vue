<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { toast } from 'vue-sonner'
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'
  import { diagnosisService } from '~/api/diagnosis/DiagnosisService'

  const props = withDefaults(
    defineProps<{
      modelValue: boolean
      doctor: any | null
      diagnosisUuid?: string
    }>(),
    {
      modelValue: false,
      doctor: null,
      diagnosisUuid: ''
    }
  )

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'booked', appointment: any): void
  }>()

  const { getStorageUrl } = useStorage()

  const isSubmitting = ref(false)
  const isLoadingAvailability = ref(false)
  const dutySlots = ref<any[]>([])
  const blockedSlots = ref<any[]>([])
  const bookedAppointments = ref<any[]>([])
  const isLoadingBookedAppointments = ref(false)
  const diagnosisData = ref<any | null>(null)
  const isLoadingDiagnosis = ref(false)

  // Date selection (defaults to tomorrow)
  const getInitialDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const minDate = computed(() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })

  const selectedDate = ref<string>(getInitialDate())
  const selectedTime = ref<string>('09:00')
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

  // Doctor details helpers
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

  // Load diagnosis details if booking from a scan
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

  // Load doctor booked appointments to verify calendar conflicts
  const fetchDoctorAppointments = async () => {
    if (!props.doctor?.uuid && !props.doctor?.id) {
      bookedAppointments.value = []
      return
    }
    isLoadingBookedAppointments.value = true
    try {
      const docIdentifier = props.doctor.uuid || props.doctor.id
      const res = await appointmentService.list({ doctor_uuid: docIdentifier })
      const list = (res as any)?.data ?? (Array.isArray(res) ? res : [])
      bookedAppointments.value = list
      syncInitialTimeSlot()
    } catch (e) {
      console.error('Failed to load doctor appointments:', e)
    } finally {
      isLoadingBookedAppointments.value = false
    }
  }

  // Load doctor availability when doctor changes
  const fetchAvailability = async () => {
    if (!props.doctor?.uuid) return
    isLoadingAvailability.value = true
    try {
      const res = await doctorAvailabilityService.listForDoctor(props.doctor.uuid)
      const list = (res as any)?.data ?? (Array.isArray(res) ? res : [])
      dutySlots.value = list.filter(
        (s: any) => Number(s.is_available) === 1 || s.is_available === true
      )
      blockedSlots.value = list.filter(
        (s: any) => Number(s.is_available) === 0 || s.is_available === false
      )
      await fetchDoctorAppointments()
      syncInitialTimeSlot()
    } catch (e) {
      console.error('Failed to load doctor availability:', e)
    } finally {
      isLoadingAvailability.value = false
    }
  }

  watch(
    () => props.doctor,
    newDoc => {
      if (newDoc && props.modelValue) {
        fetchAvailability()
        fetchDoctorAppointments()
      }
    },
    { immediate: true }
  )

  watch(
    () => props.diagnosisUuid,
    newUuid => {
      if (newUuid && props.modelValue) {
        fetchDiagnosis()
      } else if (!newUuid) {
        diagnosisData.value = null
        purpose.value = 'General Dermatological Consultation'
      }
    },
    { immediate: true }
  )

  watch(
    () => props.modelValue,
    isOpen => {
      if (isOpen && props.doctor) {
        selectedDate.value = getInitialDate()
        selectedTime.value = ''
        fetchAvailability()
        fetchDoctorAppointments()
        if (props.diagnosisUuid) {
          fetchDiagnosis()
        }
      }
    }
  )

  // Availability for selected date
  const hasDutyRoster = computed(() => dutySlots.value.length > 0)

  const dutySlotsForDate = computed(() => {
    if (!selectedDate.value) return []
    return dutySlots.value.filter(s => s.available_date?.slice(0, 10) === selectedDate.value)
  })

  const blockedSlotsForDate = computed(() => {
    if (!selectedDate.value) return []
    return blockedSlots.value.filter(s => s.available_date?.slice(0, 10) === selectedDate.value)
  })

  const isDateWholeDayBlocked = computed(() => {
    if (!selectedDate.value) return false
    return blockedSlotsForDate.value.some(
      s =>
        (s.start_time <= '00:01' || s.start_time <= '00:01:00') &&
        (s.end_time >= '23:58' || s.end_time >= '23:58:00')
    )
  })

  const isDateOffDuty = computed(() => {
    if (!selectedDate.value) return false
    if (isDateWholeDayBlocked.value) return false
    return hasDutyRoster.value && dutySlotsForDate.value.length === 0
  })

  const isSlotBlocked = (slotTime: string): boolean => {
    if (!selectedDate.value || !slotTime) return false
    if (isDateWholeDayBlocked.value) return true
    const [hStr, mStr] = slotTime.split(':')
    const startH = parseInt(hStr, 10)
    const endH = (startH + 1) % 24
    const startTime = `${String(startH).padStart(2, '0')}:${mStr || '00'}:00`
    const endTime = `${String(endH).padStart(2, '0')}:${mStr || '00'}:00`

    return blockedSlotsForDate.value.some(s => {
      const bStart = (s.start_time || '00:00:00').slice(0, 8)
      const bEnd = (s.end_time || '23:59:59').slice(0, 8)
      return startTime < bEnd && endTime > bStart
    })
  }

  const parseDateTimeToMs = (str: string): number => {
    if (!str) return 0
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
    if (match) {
      const [, y, m, d, h, min] = match
      return new Date(
        parseInt(y, 10),
        parseInt(m, 10) - 1,
        parseInt(d, 10),
        parseInt(h, 10),
        parseInt(min, 10)
      ).getTime()
    }
    return new Date(str).getTime()
  }

  const isSlotBooked = (slotTime: string): boolean => {
    if (!selectedDate.value || !slotTime || !bookedAppointments.value.length) return false
    const [yearStr, monthStr, dayStr] = selectedDate.value.split('-')
    const [hStr, mStr] = slotTime.split(':')
    const y = parseInt(yearStr, 10)
    const mo = parseInt(monthStr, 10) - 1
    const d = parseInt(dayStr, 10)
    const startH = parseInt(hStr, 10)
    const startM = parseInt(mStr || '0', 10)

    const slotStart = new Date(y, mo, d, startH, startM).getTime()
    const slotEnd = new Date(y, mo, d, startH + 1, startM).getTime()

    return bookedAppointments.value.some((appt: any) => {
      if (!appt.scheduled_at) return false
      const activeStatuses = [
        'confirmed',
        'scheduled',
        'checked_in',
        'in_consultation',
        'reschedule_proposed'
      ]
      if (!activeStatuses.includes((appt.status || '').toLowerCase())) return false

      const apptStart = parseDateTimeToMs(appt.scheduled_at)
      if (!apptStart) return false
      const apptEnd = appt.scheduled_end_at
        ? parseDateTimeToMs(appt.scheduled_end_at)
        : apptStart + 3600000

      return slotStart < apptEnd && slotEnd > apptStart
    })
  }

  // Generate 1-hour time slots
  const availableTimeSlots = computed(() => {
    // If doctor is away for whole day or off-duty, no slots available
    if (isDateWholeDayBlocked.value || isDateOffDuty.value) {
      return []
    }

    // If doctor has explicit duty slots on this date, generate intervals within duty slots
    if (dutySlotsForDate.value.length > 0) {
      const slots: string[] = []
      dutySlotsForDate.value.forEach(shift => {
        const startH = parseInt(shift.start_time?.slice(0, 2) || '9', 10)
        const endH = parseInt(shift.end_time?.slice(0, 2) || '17', 10)
        for (let h = startH; h < endH; h++) {
          slots.push(`${String(h).padStart(2, '0')}:00`)
        }
      })
      return Array.from(new Set(slots)).sort()
    }

    // If doctor does not maintain a scheduled duty roster, fallback to standard clinic hours: 09:00 - 17:00
    const defaultSlots: string[] = []
    for (let h = 9; h <= 16; h++) {
      defaultSlots.push(`${String(h).padStart(2, '0')}:00`)
    }
    return defaultSlots
  })

  const dutyRangesLabel = computed(() => {
    if (!dutySlotsForDate.value.length) return ''
    return dutySlotsForDate.value
      .map(
        s =>
          `${formatTimeSlotDisplay(s.start_time.slice(0, 5))} – ${formatTimeSlotDisplay(s.end_time.slice(0, 5))}`
      )
      .join(', ')
  })

  const syncInitialTimeSlot = () => {
    if (availableTimeSlots.value.length === 0) {
      selectedTime.value = ''
      return
    }
    if (
      !selectedTime.value ||
      !availableTimeSlots.value.includes(selectedTime.value) ||
      isSlotBlocked(selectedTime.value) ||
      isSlotBooked(selectedTime.value)
    ) {
      const firstAvailable = availableTimeSlots.value.find(
        slot => !isSlotBlocked(slot) && !isSlotBooked(slot)
      )
      selectedTime.value = firstAvailable || ''
    }
  }

  watch(
    () => selectedDate.value,
    () => {
      syncInitialTimeSlot()
    }
  )

  const selectTimeSlot = (slot: string) => {
    if (isSlotBlocked(slot) || isSlotBooked(slot)) return
    selectedTime.value = slot
  }

  const formatTimeSlotDisplay = (time24: string): string => {
    const [hStr, mStr] = time24.split(':')
    const h = parseInt(hStr, 10)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${mStr} ${ampm}`
  }

  const closeModal = () => {
    if (isSubmitting.value) return
    emit('update:modelValue', false)
  }

  const handleSubmit = async () => {
    if (!props.doctor) return
    if (!selectedDate.value) {
      toast.error('Please select an appointment date.')
      return
    }
    if (isDateWholeDayBlocked.value) {
      toast.error('The doctor is away on this date. Please select another date.')
      return
    }
    if (isDateOffDuty.value) {
      toast.error('The doctor has no scheduled clinic duty hours on this date.')
      return
    }
    if (!selectedTime.value) {
      toast.error('Please select an available consultation time slot.')
      return
    }
    if (isSlotBlocked(selectedTime.value)) {
      toast.error(
        'The selected time slot overlaps with a doctor break or away period. Please select another slot.'
      )
      return
    }
    if (isSlotBooked(selectedTime.value)) {
      toast.error(
        'The selected time slot has already been booked. Please choose an available time slot.'
      )
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

      const activeDutyShift = dutySlotsForDate.value.find(shift => {
        const sStart = shift.start_time.slice(0, 5)
        const sEnd = shift.end_time.slice(0, 5)
        return selectedTime.value >= sStart && selectedTime.value < sEnd
      })
      const resolvedLocation =
        activeDutyShift?.clinic?.name ||
        activeDutyShift?.location_name ||
        doctorLocation.value ||
        undefined

      const docId = props.doctor.id || props.doctor.uuid
      const effectivePurpose = props.diagnosisUuid
        ? diagnosisData.value?.label
          ? `AI Scan Assessment: ${diagnosisData.value.label}`
          : 'AI Scan Assessment'
        : purpose.value || 'General Consultation'

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
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue && doctor"
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/50 backdrop-blur-xs"
          @click="closeModal"
        ></div>

        <!-- Modal Card -->
        <div
          class="bg-card relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-gray-100 shadow-2xl transition-all"
        >
          <!-- Header -->
          <div
            class="from-primary to-primary/90 flex items-center justify-between border-b bg-gradient-to-r px-5 py-4 text-white"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-xs backdrop-blur-xs"
              >
                <Icon
                  name="material-symbols:calendar-add-on-rounded"
                  class="text-2xl text-white"
                />
              </div>
              <div>
                <h3 class="text-base font-bold text-white">Request Consultation</h3>
                <p class="text-xs text-white/80">Choose your preferred consultation schedule</p>
              </div>
            </div>

            <button
              type="button"
              @click="closeModal"
              class="rounded-full p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              <Icon
                name="material-symbols:close-rounded"
                class="text-xl"
              />
            </button>
          </div>

          <!-- Doctor Banner -->
          <div class="border-b border-gray-200 bg-gray-50/80 p-4">
            <div class="flex items-center gap-3.5">
              <div
                class="relative h-13 w-13 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs"
              >
                <img
                  v-if="doctorAvatar"
                  :src="doctorAvatar"
                  :alt="doctorDisplayName"
                  class="h-full w-full object-cover"
                />
                <div
                  v-else
                  class="from-primary/10 to-primary/20 text-primary flex h-full w-full items-center justify-center bg-gradient-to-br"
                >
                  <Icon
                    name="solar:user-bold-duotone"
                    class="text-2xl"
                  />
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="truncate text-base font-bold text-gray-900">
                    {{ doctorDisplayName }}
                  </h4>
                  <span
                    class="inline-flex shrink-0 items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/20"
                  >
                    Verified
                  </span>
                </div>
                <p class="truncate text-xs font-medium text-gray-600">
                  {{ doctorLocation }}
                </p>
              </div>
            </div>
          </div>

          <!-- Body Form -->
          <div class="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
            <!-- Whole day blocked notice -->
            <div
              v-if="isDateWholeDayBlocked"
              class="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs font-medium text-amber-950 shadow-2xs"
            >
              <Icon
                name="material-symbols:warning-rounded"
                class="shrink-0 text-base text-amber-600"
              />
              <p>
                Dr. {{ doctor?.last_name || 'Doctor' }} is not available on this date. Please pick
                another date.
              </p>
            </div>

            <!-- Off-duty notice -->
            <div
              v-else-if="isDateOffDuty"
              class="flex items-start gap-2.5 rounded-2xl border border-dashed border-gray-300 bg-gray-50/90 p-3.5 text-xs font-medium text-gray-700 shadow-2xs"
            >
              <Icon
                name="material-symbols:calendar-today-outline"
                class="shrink-0 text-base text-gray-400"
              />
              <p>
                Dr. {{ doctor?.last_name || 'Doctor' }} has no scheduled clinic duty hours on this
                date. Please select an active duty date.
              </p>
            </div>

            <!-- Date Picker -->
            <div>
              <label class="mb-1.5 block text-xs font-bold tracking-wider text-gray-900 uppercase">
                Preferred Date
              </label>
              <div class="relative">
                <input
                  v-model="selectedDate"
                  type="date"
                  :min="minDate"
                  class="focus:border-primary focus:ring-primary/20 w-full rounded-2xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-2xs transition-colors focus:ring-2 focus:outline-none"
                />
              </div>
            </div>

            <!-- Time Slot Selection -->
            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <label class="block text-xs font-bold tracking-wider text-gray-900 uppercase">
                  Select Time Slot
                </label>
                <span
                  v-if="dutySlotsForDate.length > 0"
                  class="text-[11px] font-bold text-emerald-600"
                >
                  Doctor on duty {{ dutyRangesLabel ? `(${dutyRangesLabel})` : '' }}
                </span>
                <span
                  v-else-if="!isDateWholeDayBlocked && !isDateOffDuty"
                  class="text-[11px] font-semibold text-gray-500"
                >
                  Standard consultation hours
                </span>
              </div>

              <!-- Case 1: Whole day blocked -->
              <div
                v-if="isDateWholeDayBlocked"
                class="flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-center"
              >
                <Icon
                  name="material-symbols:event-busy-rounded"
                  class="mb-1 text-2xl text-amber-600"
                />
                <p class="text-xs font-bold text-amber-900">
                  Doctor is Away / Blocked on this date
                </p>
                <p class="mt-0.5 text-[11px] text-amber-700">
                  Please pick another date from the calendar to view available consultation slots.
                </p>
              </div>

              <!-- Case 2: Off-duty date -->
              <div
                v-else-if="isDateOffDuty"
                class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-4 text-center"
              >
                <Icon
                  name="material-symbols:calendar-today-outline"
                  class="mb-1 text-2xl text-gray-400"
                />
                <p class="text-xs font-bold text-gray-800">Doctor is Off-Duty on this date</p>
                <p class="mt-0.5 text-[11px] text-gray-500">
                  No clinic duty hours scheduled for Dr. {{ doctor?.last_name || 'Doctor' }} on this
                  date.
                </p>
              </div>

              <!-- Case 3: Available time slots grid -->
              <div
                v-else-if="availableTimeSlots.length > 0"
                class="grid grid-cols-3 gap-2 sm:grid-cols-4"
              >
                <button
                  v-for="timeSlot in availableTimeSlots"
                  :key="timeSlot"
                  type="button"
                  :disabled="isSlotBlocked(timeSlot) || isSlotBooked(timeSlot)"
                  @click="selectTimeSlot(timeSlot)"
                  class="relative flex flex-col items-center justify-center rounded-xl border py-2 text-xs font-bold shadow-2xs transition-all active:scale-95 disabled:pointer-events-none"
                  :class="[
                    isSlotBooked(timeSlot)
                      ? 'cursor-not-allowed border-rose-200 bg-rose-50/80 text-rose-500 opacity-70'
                      : isSlotBlocked(timeSlot)
                        ? 'cursor-not-allowed border-gray-200 bg-gray-100/90 text-gray-400 opacity-60'
                        : selectedTime === timeSlot
                          ? 'border-primary bg-primary text-white shadow-xs'
                          : 'hover:border-primary hover:bg-primary/5 hover:text-primary border-gray-300 bg-white text-gray-800'
                  ]"
                >
                  <span>{{ formatTimeSlotDisplay(timeSlot) }}</span>
                  <span
                    v-if="isSlotBooked(timeSlot)"
                    class="mt-0.5 text-[9px] font-bold tracking-tight text-rose-600 uppercase"
                  >
                    Booked
                  </span>
                  <span
                    v-else-if="isSlotBlocked(timeSlot)"
                    class="mt-0.5 text-[9px] font-bold tracking-tight text-amber-600 uppercase"
                  >
                    Unavailable
                  </span>
                </button>
              </div>

              <!-- Case 4: No slots available -->
              <div
                v-else
                class="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500"
              >
                No consultation slots available on this date.
              </div>
            </div>

            <!-- Attached AI Scan Result Card (When Booking From Scan) -->
            <div
              v-if="props.diagnosisUuid"
              class="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-blue-50/40 p-4 shadow-2xs"
            >
              <div class="mb-2.5 flex items-center justify-between">
                <span class="text-[11px] font-bold tracking-wider text-blue-900 uppercase">
                  Attached AI Scan Result
                </span>
                <span
                  class="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 ring-1 ring-blue-700/10"
                >
                  Home Self-Assessment
                </span>
              </div>

              <div
                v-if="isLoadingDiagnosis"
                class="flex items-center justify-center py-4 text-xs text-gray-500"
              >
                <Icon
                  name="svg-spinners:ring-resize"
                  class="text-primary mr-2 text-base"
                />
                Loading scan details...
              </div>

              <div
                v-else
                class="flex items-center gap-3.5"
              >
                <div
                  class="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs"
                >
                  <img
                    v-if="diagnosisData?.image_path"
                    :src="getStorageUrl(diagnosisData.image_path)"
                    :alt="diagnosisData?.label || 'Scan Image'"
                    class="h-full w-full object-cover"
                  />
                  <div
                    v-else
                    class="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400"
                  >
                    <Icon
                      name="material-symbols:image-outline"
                      class="text-xl"
                    />
                  </div>
                </div>

                <div class="min-w-0 flex-1">
                  <h5 class="truncate text-sm font-bold text-gray-900">
                    {{ diagnosisData?.label || 'Skin Assessment' }}
                  </h5>
                  <div class="mt-1 flex items-center gap-2">
                    <span
                      v-if="diagnosisData?.confidence_score || diagnosisData?.confidence"
                      class="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/20"
                    >
                      {{
                        (
                          Number(diagnosisData.confidence_score || diagnosisData.confidence || 0) *
                          100
                        ).toFixed(1)
                      }}% Confidence
                    </span>
                    <span class="truncate text-[11px] text-gray-500">
                      {{
                        diagnosisData?.created_at
                          ? new Date(diagnosisData.created_at).toLocaleDateString()
                          : 'Recent Scan'
                      }}
                    </span>
                  </div>
                  <p class="mt-1 text-[11px] text-gray-600">
                    This image and analysis will be shared directly with the doctor.
                  </p>
                </div>
              </div>
            </div>

            <!-- Consultation Purpose (Shown ONLY for Direct Booking, NOT from Scan) -->
            <div v-else>
              <label class="mb-1.5 block text-xs font-bold tracking-wider text-gray-900 uppercase">
                Consultation Reason / Notes
              </label>
              <input
                v-model="purpose"
                type="text"
                placeholder="e.g. Skin checkup, acne evaluation..."
                class="focus:border-primary focus:ring-primary/20 w-full rounded-2xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 shadow-2xs transition-colors placeholder:text-gray-400 focus:ring-2 focus:outline-none"
              />

              <!-- Quick presets -->
              <div class="mt-2 flex flex-wrap gap-1.5">
                <button
                  v-for="preset in presetPurposes"
                  :key="preset"
                  type="button"
                  @click="setPurposePreset(preset)"
                  class="rounded-xl border px-2.5 py-1 text-xs font-semibold shadow-2xs transition-all active:scale-95"
                  :class="[
                    purpose === preset
                      ? 'border-primary bg-primary text-white shadow-xs'
                      : 'hover:border-primary hover:bg-primary/10 hover:text-primary border-gray-300 bg-gray-100 text-gray-800'
                  ]"
                >
                  {{ preset }}
                </button>
              </div>
            </div>

            <!-- Booking Notice -->
            <div
              class="flex items-start gap-2.5 rounded-2xl border border-blue-200 bg-blue-50/90 p-3.5 text-xs font-medium text-blue-950 shadow-2xs"
            >
              <Icon
                name="material-symbols:info-outline-rounded"
                class="mt-0.5 shrink-0 text-base text-blue-600"
              />
              <p class="leading-relaxed text-blue-950">
                <template v-if="props.diagnosisUuid">
                  This request will be sent to Dr. {{ doctor?.last_name || 'Doctor' }} along with
                  your AI scan image and self-assessment results for clinical confirmation. You will
                  be notified once the doctor accepts or suggests another schedule.
                </template>
                <template v-else>
                  This request will be sent to the doctor for confirmation. You will be notified
                  once the doctor accepts your appointment slot.
                </template>
              </p>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-end gap-2.5 border-t border-gray-100 bg-white p-4">
            <button
              type="button"
              @click="closeModal"
              :disabled="isSubmitting"
              class="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-2xs transition hover:bg-gray-100 hover:text-gray-900 active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleSubmit"
              :disabled="
                isSubmitting ||
                isDateWholeDayBlocked ||
                isDateOffDuty ||
                !selectedTime ||
                isSlotBlocked(selectedTime) ||
                isSlotBooked(selectedTime)
              "
              class="bg-primary hover:bg-primary/90 flex items-center justify-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              <Icon
                v-if="isSubmitting"
                name="svg-spinners:ring-resize"
                class="text-sm"
              />
              <Icon
                v-else
                name="material-symbols:send-rounded"
                class="text-sm"
              />
              <span>{{ isSubmitting ? 'Sending Request...' : 'Send Appointment Request' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
