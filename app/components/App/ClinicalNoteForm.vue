<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { clinicalNoteService, type ClinicalNote } from '~/api/clinicalNote/ClinicalNoteService'
  import { datasetService } from '~/api/dataset/DatasetService'
  import { userService } from '~/api/user/UserService'
  import { parseAppointmentDateTime } from '~/composables/useAppointments'
  import { toast } from 'vue-sonner'

  const props = defineProps<{
    appointmentUuid?: string
    diagnosisId?: number | null
    diagnosisUuid?: string | null
    skipLoad?: boolean
    isFinishMode?: boolean
    contributeToDataset?: boolean
  }>()

  const emit = defineEmits<{
    (e: 'saved', payload?: { conversationUuid?: string; followUpScheduled?: boolean }): void
    (e: 'require-patient-account'): void
  }>()
  const { patientUuid } = useDiagnosis()

  const storageKey = computed(() => {
    if (props.diagnosisUuid) return `draft_clinical_note_diag_${props.diagnosisUuid}`
    if (props.appointmentUuid) return `draft_clinical_note_appt_${props.appointmentUuid}`
    return 'draft_clinical_note_active'
  })

  const getTodayStr = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const get7DaysLater = () => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const note = ref<ClinicalNote>({
    history_of_present_illness: '',
    systemic_symptoms: '',
    physical_exam: '',
    differential_diagnosis: '',
    final_diagnosis: '',
    prescription: '',
    patient_education: '',
    follow_up_date: '',
    follow_up_instructions: ''
  })

  const noFollowUp = ref(true)
  const followUpDateOnly = ref('')
  const followUpTimeOnly = ref('09:00')
  const followUpEndTimeOnly = ref('10:00')
  const followUpLocation = ref('')
  const customFollowUpLocation = ref('')
  const wasLocationAutofilled = ref(false)
  const followUpError = ref<string | null>(null)
  const followUpSectionRef = ref<HTMLElement | null>(null)

  const { clinics, fetchClinics } = useDoctorClinics()

  const effectiveFollowUpLocation = computed(() => {
    if (followUpLocation.value === '__custom__') {
      return customFollowUpLocation.value.trim()
    }
    return followUpLocation.value.trim()
  })

  watch(followUpTimeOnly, newStart => {
    if (!newStart) return
    const [h, m] = newStart.split(':').map(Number)
    const endHour = (h + 1) % 24
    followUpEndTimeOnly.value = `${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  })

  const parseFollowUpDate = (val: string) => {
    if (!val) {
      noFollowUp.value = true
      return
    }
    noFollowUp.value = false
    const parts = val.replace('T', ' ').split(' ')
    if (parts[0]) {
      followUpDateOnly.value = parts[0]
    }
    if (parts[1]) {
      const timeParts = parts[1].split(':')
      if (timeParts.length >= 2) {
        followUpTimeOnly.value = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`
      }
    }
  }

  const syncFollowUpDate = () => {
    if (noFollowUp.value) {
      note.value.follow_up_date = ''
    } else if (followUpDateOnly.value) {
      note.value.follow_up_date = `${followUpDateOnly.value} ${followUpTimeOnly.value}:00`
    }
  }

  watch([noFollowUp, followUpDateOnly, followUpTimeOnly, followUpEndTimeOnly], () => {
    followUpError.value = null
    syncFollowUpDate()
  })

  const isSaving = ref(false)
  const isLoaded = ref(false)
  const showSuccess = ref(false)
  const isExplicitSaveRequested = ref(false)
  const hasSavedFollowUp = ref(false)

  const loadDraftIfExists = () => {
    try {
      const raw = localStorage.getItem(storageKey.value)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.note) {
          note.value = { ...note.value, ...parsed.note }
        }
        if (typeof parsed.noFollowUp === 'boolean') {
          // If no follow-up date was selected, ensure it defaults to not required
          if (!parsed.followUpDateOnly && !note.value.follow_up_date) {
            noFollowUp.value = true
          } else {
            noFollowUp.value = parsed.noFollowUp
          }
        } else {
          noFollowUp.value = true
        }
        if (parsed.followUpDateOnly) {
          followUpDateOnly.value = parsed.followUpDateOnly
        }
        if (parsed.followUpTimeOnly) {
          followUpTimeOnly.value = parsed.followUpTimeOnly
        }
        if (parsed.followUpEndTimeOnly) {
          followUpEndTimeOnly.value = parsed.followUpEndTimeOnly
        }
        if (parsed.followUpLocation) {
          followUpLocation.value = parsed.followUpLocation
        }
        if (parsed.customFollowUpLocation) {
          customFollowUpLocation.value = parsed.customFollowUpLocation
        }
        if (note.value.follow_up_date) {
          parseFollowUpDate(note.value.follow_up_date)
        }
      } else {
        noFollowUp.value = true
        followUpDateOnly.value = ''
      }
    } catch (e) {
      console.error('Failed to parse draft from localStorage', e)
    }
  }

  onMounted(async () => {
    await fetchClinics()
    if (props.skipLoad) {
      loadDraftIfExists()
      isLoaded.value = true
      return
    }

    try {
      if (props.appointmentUuid) {
        const existing = await clinicalNoteService.getByAppointment(props.appointmentUuid)
        if (
          existing &&
          (existing.history_of_present_illness || existing.final_diagnosis || existing.prescription)
        ) {
          note.value = { ...note.value, ...existing }
          parseFollowUpDate(note.value.follow_up_date || '')
        } else {
          loadDraftIfExists()
        }
      } else {
        loadDraftIfExists()
      }
    } catch (e) {
      console.error('Failed to load clinical note', e)
      loadDraftIfExists()
    } finally {
      isLoaded.value = true
    }
  })

  // Auto-save draft on note changes
  watch(
    [
      note,
      noFollowUp,
      followUpDateOnly,
      followUpTimeOnly,
      followUpEndTimeOnly,
      followUpLocation,
      customFollowUpLocation
    ],
    () => {
      if (!isLoaded.value) return
      try {
        const draftData = {
          note: note.value,
          noFollowUp: noFollowUp.value,
          followUpDateOnly: followUpDateOnly.value,
          followUpTimeOnly: followUpTimeOnly.value,
          followUpEndTimeOnly: followUpEndTimeOnly.value,
          followUpLocation: followUpLocation.value,
          customFollowUpLocation: customFollowUpLocation.value
        }
        localStorage.setItem(storageKey.value, JSON.stringify(draftData))
      } catch (e) {
        console.error('Failed to save draft to localStorage', e)
      }
    },
    { deep: true }
  )

  const {
    blockedSlots,
    dutySlots,
    isTimeBlockedOnDate,
    isTimeRangeBlockedOnDate,
    isWholeDayBlocked,
    getBlockedTimesForDate,
    getDutySlotsForDate,
    getDutyClinicForDateAndTime,
    hasDutyOnDate,
    isTimeRangeWithinDutyHours,
    getDutyRangesLabel,
    findEarliestAvailableSlot
  } = useBlockedDates()
  const { appointments, fetchAppointments, isApptTimeConflicting } = useAppointments()
  const scheduledFollowUpUuid = ref<string | undefined>()

  // Smart autofill clinic location from duty preset when date & time change
  watch(
    [followUpDateOnly, followUpTimeOnly, followUpEndTimeOnly],
    ([date, start, end]) => {
      if (!date || !start) return
      const matchedDuty = getDutyClinicForDateAndTime(date, start, end)
      if (matchedDuty) {
        const loc = matchedDuty.clinic?.name || matchedDuty.location_name
        if (loc) {
          followUpLocation.value = loc
          customFollowUpLocation.value = ''
          wasLocationAutofilled.value = true
          return
        }
      }

      // If no duty schedule found and followUpLocation was previously autofilled or empty
      if (wasLocationAutofilled.value || !followUpLocation.value) {
        if (clinics.value.length > 0) {
          followUpLocation.value = clinics.value[0].name
          customFollowUpLocation.value = ''
        }
        wasLocationAutofilled.value = false
      }
    },
    { immediate: true }
  )

  const availableTimeSlots = [
    { value: '08:00', label: '08:00 AM' },
    { value: '09:00', label: '09:00 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '11:00', label: '11:00 AM' },
    { value: '12:00', label: '12:00 PM' },
    { value: '13:00', label: '01:00 PM' },
    { value: '14:00', label: '02:00 PM' },
    { value: '15:00', label: '03:00 PM' },
    { value: '16:00', label: '04:00 PM' },
    { value: '17:00', label: '05:00 PM' },
    { value: '18:00', label: '06:00 PM' }
  ]

  const dateBlockedSlots = computed(() => {
    if (!followUpDateOnly.value) return []
    return getBlockedTimesForDate(followUpDateOnly.value)
  })

  const dateDutySlots = computed(() => {
    if (!followUpDateOnly.value) return []
    return getDutySlotsForDate(followUpDateOnly.value)
  })

  const hasNoDutyOnFollowUpDate = computed(() => {
    if (!followUpDateOnly.value) return false
    return !hasDutyOnDate(followUpDateOnly.value)
  })

  const isFollowUpOutsideDutyHours = computed(() => {
    if (!followUpDateOnly.value || !followUpTimeOnly.value || !followUpEndTimeOnly.value)
      return false
    return !isTimeRangeWithinDutyHours(
      followUpDateOnly.value,
      followUpTimeOnly.value,
      followUpEndTimeOnly.value
    )
  })

  const dutyRangesLabel = computed(() => {
    if (!followUpDateOnly.value) return ''
    return getDutyRangesLabel(followUpDateOnly.value)
  })

  const dateExistingAppts = computed(() => {
    if (!followUpDateOnly.value) return []
    return appointments.value
      .filter(appt => {
        const p = parseAppointmentDateTime(appt.raw_scheduled_at || appt.scheduled_at || appt.date)
        return (
          p.date === followUpDateOnly.value &&
          appt.id !== (scheduledFollowUpUuid.value || props.appointmentUuid) &&
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

  const isSelectedDateFullyBlocked = computed(() => {
    if (!followUpDateOnly.value) return false
    return isWholeDayBlocked(followUpDateOnly.value)
  })

  const isFollowUpConflict = computed(() => {
    if (hasSavedFollowUp.value) return false
    if (!followUpDateOnly.value || !followUpTimeOnly.value) return false
    return isApptTimeConflicting(
      followUpDateOnly.value,
      followUpTimeOnly.value,
      followUpEndTimeOnly.value,
      scheduledFollowUpUuid.value || props.appointmentUuid
    )
  })

  const handleFollowUpDateSelected = (date: string) => {
    followUpDateOnly.value = date
    noFollowUp.value = false

    const earliestSlot = findEarliestAvailableSlot(date, 60, dateExistingAppts.value)
    if (earliestSlot) {
      followUpTimeOnly.value = earliestSlot.start
      followUpEndTimeOnly.value = earliestSlot.end
    } else {
      const dayDuties = getDutySlotsForDate(date)
      if (dayDuties.length > 0) {
        followUpTimeOnly.value = dayDuties[0].start_time.slice(0, 5)
      }
    }
  }

  const setQuickInterval = (days: number) => {
    const target = new Date()
    target.setDate(target.getDate() + days)
    const y = target.getFullYear()
    const m = String(target.getMonth() + 1).padStart(2, '0')
    const d = String(target.getDate()).padStart(2, '0')
    handleFollowUpDateSelected(`${y}-${m}-${d}`)
  }

  const formattedSelectedDate = computed(() => {
    if (!followUpDateOnly.value) return null
    try {
      const [y, m, d] = followUpDateOnly.value.split('-').map(Number)
      const dateObj = new Date(y, m - 1, d)
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return followUpDateOnly.value
    }
  })

  const matchedDutyShift = computed(() => {
    if (!followUpDateOnly.value) return null
    return getDutyClinicForDateAndTime(
      followUpDateOnly.value,
      followUpTimeOnly.value,
      followUpEndTimeOnly.value
    )
  })

  const quickInstructions = [
    'Re-evaluate skin lesion and response to treatment',
    'Review laboratory & pathology biopsy results',
    'Evaluate treatment progress & medication tolerance',
    'Routine skin check & healing progress'
  ]

  const applyQuickInstruction = (inst: string) => {
    if (!note.follow_up_instructions) {
      note.follow_up_instructions = inst
    } else {
      note.follow_up_instructions = `${note.follow_up_instructions}; ${inst}`
    }
  }

  const findConversationUuid = (value: any): string | undefined => {
    if (!value || typeof value !== 'object') return undefined
    if (typeof value.conversation_uuid === 'string') return value.conversation_uuid
    for (const nested of Object.values(value)) {
      const found = findConversationUuid(nested)
      if (found) return found
    }
    return undefined
  }

  const findScheduledAppointment = (value: any): any | undefined => {
    if (!value || typeof value !== 'object') return undefined
    if (
      typeof value.uuid === 'string' &&
      (value.scheduled_at || value.scheduled_end_at || value.conversation_uuid)
    )
      return value
    if (
      typeof value.id === 'string' &&
      (value.scheduled_at || value.scheduled_end_at || value.conversation_uuid)
    )
      return value
    for (const nested of Object.values(value)) {
      const found = findScheduledAppointment(nested)
      if (found) return found
    }
    return undefined
  }

  const isSameScheduledTime = (rawDateTime: string | undefined, date: string, time: string) => {
    if (!rawDateTime) return false
    return (
      rawDateTime
        .replace('T', ' ')
        .replace(/Z|(\+\d{2}:\d{2})$/i, '')
        .slice(0, 16) === `${date} ${time}`
    )
  }

  const findScheduledFollowUpFromList = () => {
    if (!followUpDateOnly.value || !followUpTimeOnly.value || !patientUuid.value) return undefined
    return appointments.value.find(appt => {
      const apptPatientUuid = (appt as any).patient_uuid || (appt as any).patient?.uuid
      return (
        apptPatientUuid === patientUuid.value &&
        isSameScheduledTime(appt.raw_scheduled_at, followUpDateOnly.value, followUpTimeOnly.value)
      )
    })
  }

  const existingSelectedFollowUp = computed(() => findScheduledFollowUpFromList())

  const saveNote = async () => {
    followUpError.value = null
    if (!noFollowUp.value && !followUpDateOnly.value) {
      followUpError.value =
        "Please select a follow-up appointment date & time, or check 'No follow-up appointment required'."
      if (followUpSectionRef.value) {
        followUpSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    if (
      !noFollowUp.value &&
      followUpDateOnly.value &&
      followUpEndTimeOnly.value <= followUpTimeOnly.value
    ) {
      followUpError.value = 'Follow-up appointment end time must be after the start time.'
      if (followUpSectionRef.value) {
        followUpSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    if (!noFollowUp.value && isFollowUpConflict.value) {
      if (existingSelectedFollowUp.value) {
        scheduledFollowUpUuid.value = existingSelectedFollowUp.value.id
      } else {
        followUpError.value =
          'An appointment is already scheduled during this time slot. Please choose a different time.'
        if (followUpSectionRef.value) {
          followUpSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return
      }
    }

    if (
      !noFollowUp.value &&
      followUpDateOnly.value &&
      isTimeRangeBlockedOnDate(
        followUpDateOnly.value,
        followUpTimeOnly.value,
        followUpEndTimeOnly.value
      )
    ) {
      followUpError.value =
        "The selected time slot is marked as unavailable on your schedule. Please select another time or date, or check 'No follow-up appointment required'."
      if (followUpSectionRef.value) {
        followUpSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    if (
      !noFollowUp.value &&
      followUpDateOnly.value &&
      !patientUuid.value &&
      !props.appointmentUuid
    ) {
      followUpError.value =
        "A registered patient account is required to schedule a follow-up appointment. Please click 'Create Patient Account' above to register the patient, or check 'No follow-up appointment required'."
      if (followUpSectionRef.value) {
        followUpSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      emit('require-patient-account')
      return
    }

    isSaving.value = true
    showSuccess.value = false
    let scheduledConversationUuid: string | undefined
    let didScheduleFollowUp = false
    const alreadyScheduledFollowUp = existingSelectedFollowUp.value
    try {
      syncFollowUpDate()

      if (props.diagnosisUuid) {
        ;(note.value as any).diagnosis_uuid = props.diagnosisUuid
      }

      if (props.appointmentUuid) {
        const saved = await clinicalNoteService.save(props.appointmentUuid, note.value)
        note.value = { ...note.value, ...saved }
      } else if (props.diagnosisUuid) {
        const saved = await clinicalNoteService.saveForDiagnosis(props.diagnosisUuid, note.value)
        note.value = { ...note.value, ...saved }
      } else {
        throw new Error(
          'Neither appointmentUuid nor diagnosisUuid provided for saving clinical note.'
        )
      }

      // Schedule follow-up appointment if patient account exists
      if (alreadyScheduledFollowUp) {
        didScheduleFollowUp = true
        scheduledFollowUpUuid.value = alreadyScheduledFollowUp.id
        scheduledConversationUuid = alreadyScheduledFollowUp.conversation_uuid
        hasSavedFollowUp.value = true
      } else if (
        isExplicitSaveRequested.value &&
        !noFollowUp.value &&
        followUpDateOnly.value &&
        patientUuid.value
      ) {
        try {
          const scheduled = await userService.scheduleAppointmentForPatient(patientUuid.value, {
            scheduled_at: `${followUpDateOnly.value} ${followUpTimeOnly.value}:00`,
            scheduled_end_at: `${followUpDateOnly.value} ${followUpEndTimeOnly.value}:00`,
            location: effectiveFollowUpLocation.value || 'Doctor Clinic',
            purpose:
              note.value.follow_up_instructions || 'Follow-up appointment for diagnosis assessment'
          })
          didScheduleFollowUp = true
          const scheduledAppointment = findScheduledAppointment(scheduled)
          scheduledFollowUpUuid.value = scheduledAppointment?.uuid || scheduledAppointment?.id
          scheduledConversationUuid = findConversationUuid(scheduled)
          hasSavedFollowUp.value = true
        } catch (err: any) {
          console.error('Failed to auto-schedule follow-up appointment:', err)
          await fetchAppointments()
          const scheduledFromList = findScheduledFollowUpFromList()
          if (scheduledFromList) {
            didScheduleFollowUp = true
            scheduledFollowUpUuid.value = scheduledFromList.id
            scheduledConversationUuid = scheduledFromList.conversation_uuid
            hasSavedFollowUp.value = true
          } else {
            followUpError.value =
              err.data?.message ||
              err.message ||
              'Conflict detected: Failed to schedule appointment.'
            if (followUpSectionRef.value) {
              followUpSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
            isSaving.value = false
            return
          }
        }
      }

      // Save to AI Retraining Dataset only if the doctor has checked the checkbox
      if (props.contributeToDataset === true && props.diagnosisUuid) {
        try {
          await datasetService.saveFromDiagnosis(props.diagnosisUuid)
        } catch (datasetErr) {
          console.error('Failed to save scan to retraining dataset:', datasetErr)
        }
      }

      // Clear draft after successful save
      try {
        localStorage.removeItem(storageKey.value)
      } catch (e) {
        // silent fail
      }

      followUpError.value = null
      showSuccess.value = true
      emit('saved', {
        conversationUuid: scheduledConversationUuid,
        followUpScheduled: didScheduleFollowUp
      })

      setTimeout(() => {
        showSuccess.value = false
      }, 3000)
    } catch (e) {
      console.error('Failed to save clinical note', e)
      toast.error('Failed to save clinical note. Please try again.')
    } finally {
      isSaving.value = false
    }
  }

  const saveWithoutAccount = async () => {
    noFollowUp.value = true
    followUpError.value = null
    isExplicitSaveRequested.value = true
    try {
      await saveNote()
    } finally {
      isExplicitSaveRequested.value = false
    }
  }

  const handleSaveClick = async () => {
    if (!noFollowUp.value && followUpDateOnly.value) {
      if (hasNoDutyOnFollowUpDate.value) {
        toast.error('Cannot schedule follow-up: You have no scheduled duty hours on this date.')
        return
      }
      if (isFollowUpOutsideDutyHours.value) {
        toast.error(
          `Cannot schedule follow-up: Time is outside your duty hours (${dutyRangesLabel.value}).`
        )
        return
      }
      if (isFollowUpConflict.value) {
        toast.error(
          'Cannot schedule follow-up: The selected time conflicts with an existing appointment.'
        )
        return
      }
    }
    isExplicitSaveRequested.value = true
    try {
      await saveNote()
    } finally {
      isExplicitSaveRequested.value = false
    }
  }
</script>

<template>
  <div
    v-if="!isLoaded"
    class="flex items-center justify-center py-20"
  >
    <Icon
      name="svg-spinners:180-ring-with-bg"
      class="text-primary text-6xl opacity-50"
    />
  </div>
  <div
    v-else
    class="relative space-y-10 overflow-hidden rounded-[2.5rem] border border-white/50 bg-white/70 px-0 py-8 backdrop-blur-xl sm:px-0 sm:py-10"
  >
    <div
      class="bg-primary/5 pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full blur-3xl"
    ></div>

    <div class="relative z-10 flex items-center justify-between border-b border-gray-100/50 pb-6">
      <div class="flex items-center gap-4">
        <div class="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-2xl">
          <Icon
            name="material-symbols:edit-document-outline-rounded"
            class="text-primary text-2xl"
          />
        </div>
        <div>
          <h2 class="text-2xl font-black tracking-tight text-gray-900">Clinical SOAP Note</h2>
          <p class="mt-0.5 text-sm font-medium text-gray-500">
            Official medical documentation and assessment.
          </p>
        </div>
      </div>
      <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <AppButton
          type="button"
          :loading="isSaving"
          @click="handleSaveClick"
          :class="[
            showSuccess
              ? 'bg-green-500 shadow-green-500/20 hover:bg-green-600'
              : 'bg-primary hover:bg-primary/90 shadow-primary/20',
            'flex items-center gap-2 rounded-2xl px-8 py-3 font-bold text-white shadow-lg transition-all hover:shadow-xl active:scale-95'
          ]"
        >
          <Icon
            v-if="showSuccess"
            name="material-symbols:check-circle-rounded"
            class="text-xl"
          />
          <Icon
            v-else-if="!isSaving"
            name="material-symbols:save-outline-rounded"
            class="text-xl"
          />
          {{
            showSuccess
              ? 'Saved!'
              : isSaving
                ? 'Saving...'
                : isFinishMode
                  ? 'Finish Diagnosis & Save'
                  : 'Save Note'
          }}
        </AppButton>
      </div>
    </div>

    <div class="relative z-10 space-y-10">
      <!-- Subjective -->
      <section class="group">
        <h3 class="mb-5 flex items-center gap-3 text-xl font-bold text-gray-900">
          <span
            class="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-sm font-black text-indigo-600 shadow-sm"
            >S</span
          >
          Subjective
        </h3>
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
              >History of Present Illness</label
            >
            <textarea
              v-model="note.history_of_present_illness"
              rows="3"
              placeholder="Duration, symptoms, triggers..."
              class="w-full resize-none rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-gray-200/50 transition-all outline-none ring-inset focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
            ></textarea>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
              >Systemic Symptoms</label
            >
            <textarea
              v-model="note.systemic_symptoms"
              rows="3"
              placeholder="Fever, fatigue, other affected areas..."
              class="w-full resize-none rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-gray-200/50 transition-all outline-none ring-inset focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
            ></textarea>
          </div>
        </div>
      </section>

      <!-- Objective -->
      <section class="group">
        <h3 class="mb-5 flex items-center gap-3 text-xl font-bold text-gray-900">
          <span
            class="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-sm font-black text-blue-600 shadow-sm"
            >O</span
          >
          Objective
        </h3>
        <div class="flex flex-col gap-2">
          <label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
            >Physical Exam Findings</label
          >
          <textarea
            v-model="note.physical_exam"
            rows="3"
            placeholder="Visual inspection details, lesion description..."
            class="w-full resize-none rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-gray-200/50 transition-all outline-none ring-inset focus:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-inset"
          ></textarea>
        </div>
      </section>

      <!-- Assessment -->
      <section class="group">
        <h3 class="mb-5 flex items-center gap-3 text-xl font-bold text-gray-900">
          <span
            class="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-sm font-black text-emerald-600 shadow-sm"
            >A</span
          >
          Assessment
        </h3>
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
              >Differential Diagnosis</label
            >
            <textarea
              v-model="note.differential_diagnosis"
              rows="2"
              placeholder="Alternative possible diagnoses..."
              class="w-full resize-none rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-gray-200/50 transition-all outline-none ring-inset focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
            ></textarea>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
              >Final Diagnosis</label
            >
            <input
              type="text"
              v-model="note.final_diagnosis"
              placeholder="Primary diagnosis..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-gray-200/50 transition-all outline-none ring-inset focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
            />
          </div>
        </div>
      </section>

      <!-- Plan -->
      <section class="group">
        <h3 class="mb-5 flex items-center gap-3 text-xl font-bold text-gray-900">
          <span
            class="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-sm font-black text-amber-600 shadow-sm"
            >P</span
          >
          Plan
        </h3>
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
              >Prescriptions</label
            >
            <textarea
              v-model="note.prescription"
              rows="4"
              placeholder="Medication name, dosage, frequency, duration..."
              class="w-full resize-none rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-gray-200/50 transition-all outline-none ring-inset focus:bg-white focus:ring-2 focus:ring-amber-500 focus:ring-inset"
            ></textarea>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold tracking-wider text-gray-500 uppercase"
              >Patient Education & Instructions</label
            >
            <textarea
              v-model="note.patient_education"
              rows="4"
              placeholder="Skin care routines, triggers to avoid..."
              class="w-full resize-none rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-gray-200/50 transition-all outline-none ring-inset focus:bg-white focus:ring-2 focus:ring-amber-500 focus:ring-inset"
            ></textarea>
          </div>

          <div
            ref="followUpSectionRef"
            class="flex flex-col gap-4 rounded-3xl border p-6 shadow-xs transition-all sm:col-span-2"
            :class="
              followUpError
                ? 'border-red-300 bg-red-50/40 ring-2 ring-red-200'
                : 'bg-card border-border/80'
            "
          >
            <!-- Section Header Bar -->
            <div
              class="border-border/60 flex flex-col justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center"
            >
              <div class="flex items-center gap-3">
                <div
                  class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                >
                  <Icon
                    name="heroicons:calendar-days"
                    class="h-5 w-5"
                  />
                </div>
                <div>
                  <h4 class="text-foreground text-sm font-bold">Follow-Up Consultation Schedule</h4>
                  <p class="text-muted-foreground text-xs">
                    Book the patient's next clinical visit and auto-match clinic duty shifts.
                  </p>
                </div>
              </div>

              <!-- Follow-Up Toggle Switch -->
              <div
                class="bg-foreground/5 border-border flex shrink-0 items-center gap-1.5 rounded-2xl border p-1"
              >
                <button
                  type="button"
                  @click="noFollowUp = false"
                  class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
                  :class="
                    !noFollowUp
                      ? 'text-primary bg-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                >
                  <Icon
                    name="heroicons:check-circle"
                    class="h-3.5 w-3.5"
                  />
                  <span>Schedule</span>
                </button>
                <button
                  type="button"
                  @click="noFollowUp = true"
                  class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
                  :class="
                    noFollowUp
                      ? 'text-foreground/80 bg-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                >
                  <Icon
                    name="heroicons:no-symbol"
                    class="h-3.5 w-3.5"
                  />
                  <span>Not Required</span>
                </button>
              </div>
            </div>

            <!-- When Follow-up is Enabled -->
            <template v-if="!noFollowUp">
              <!-- Quick Interval Shortcuts -->
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="text-muted-foreground mr-1 flex items-center gap-1 text-xs font-bold tracking-wider uppercase"
                >
                  <Icon
                    name="heroicons:bolt"
                    class="h-3.5 w-3.5 text-amber-500"
                  />
                  Quick Intervals:
                </span>
                <button
                  v-for="preset in [
                    { label: '+1 Week', days: 7 },
                    { label: '+2 Weeks', days: 14 },
                    { label: '+3 Weeks', days: 21 },
                    { label: '+1 Month', days: 30 },
                    { label: '+2 Months', days: 60 }
                  ]"
                  :key="preset.days"
                  type="button"
                  @click="setQuickInterval(preset.days)"
                  class="bg-foreground/5 hover:bg-primary/10 hover:text-primary border-border/80 cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-bold shadow-2xs transition-all active:scale-95"
                >
                  {{ preset.label }}
                </button>
              </div>

              <!-- Top Row: Calendar (Left) & Date Summary + Clinic Station (Right) -->
              <div
                class="bg-foreground/[0.02] border-border/60 grid items-start gap-5 rounded-2xl border p-4 sm:p-5 lg:grid-cols-12"
              >
                <!-- Left: Calendar (6 cols) -->
                <div
                  class="bg-card border-border/80 flex flex-col justify-center space-y-3 overflow-visible rounded-2xl border p-4 shadow-2xs lg:col-span-6"
                >
                  <div class="border-border/60 flex items-center justify-between border-b pb-2">
                    <span class="text-foreground flex items-center gap-1.5 text-xs font-bold">
                      <Icon
                        name="heroicons:calendar"
                        class="text-primary h-4 w-4"
                      />
                      Select Date
                    </span>
                    <span class="text-muted-foreground text-[11px]">Click a date below</span>
                  </div>
                  <div class="flex justify-center overflow-visible">
                    <PatientSideComponentsCalendar
                      :min-date="getTodayStr()"
                      :selected-date="followUpDateOnly"
                      :blocked-slots="blockedSlots"
                      :duty-slots="dutySlots"
                      :show-manage-blocks-link="true"
                      :show-appointment-details-panel="false"
                      @date-selected="handleFollowUpDateSelected"
                    />
                  </div>
                </div>

                <!-- Right: Date Summary & Clinic Branch Station (6 cols) -->
                <div class="space-y-4 lg:col-span-6">
                  <!-- Selected Date & Duty Station Status Badge -->
                  <div class="bg-card border-border/80 space-y-3 rounded-2xl border p-4 shadow-2xs">
                    <div class="flex items-center justify-between">
                      <span
                        class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase"
                        >Target Consultation Date</span
                      >
                      <span
                        v-if="followUpDateOnly"
                        class="text-primary bg-primary/10 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold"
                      >
                        {{ followUpDateOnly }}
                      </span>
                    </div>

                    <div
                      v-if="formattedSelectedDate"
                      class="text-foreground flex items-center gap-2.5 text-base font-bold"
                    >
                      <Icon
                        name="heroicons:calendar-days"
                        class="text-primary h-5 w-5 shrink-0"
                      />
                      <span>{{ formattedSelectedDate }}</span>
                    </div>
                    <div
                      v-else
                      class="text-muted-foreground flex items-center gap-2 text-xs italic"
                    >
                      <Icon
                        name="heroicons:cursor-arrow-rays"
                        class="text-primary h-4 w-4 shrink-0 animate-bounce"
                      />
                      <span>Pick a date from the calendar or use the quick intervals</span>
                    </div>

                    <!-- Matched Duty Shift Badge -->
                    <div
                      v-if="matchedDutyShift"
                      class="border-border/60 flex items-center gap-2 rounded-xl border border-t border-emerald-200 bg-emerald-50/70 p-2.5 pt-2 text-xs font-semibold text-emerald-700"
                    >
                      <div class="h-2 w-2 shrink-0 rounded-full bg-emerald-500"></div>
                      <span
                        >Duty Shift:
                        <strong>{{
                          matchedDutyShift.clinic?.name || matchedDutyShift.location_name
                        }}</strong>
                        ({{ matchedDutyShift.start_time.slice(0, 5) }} -
                        {{ matchedDutyShift.end_time.slice(0, 5) }})</span
                      >
                    </div>
                  </div>

                  <!-- Clinic / Location Selector -->
                  <div
                    class="bg-card border-border/80 space-y-2.5 rounded-2xl border p-4 shadow-2xs"
                  >
                    <div class="flex items-center justify-between">
                      <label
                        class="text-muted-foreground flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase"
                      >
                        <Icon
                          name="heroicons:building-office-2"
                          class="text-primary h-4 w-4"
                        />
                        Clinic Station / Location
                      </label>
                      <span
                        v-if="wasLocationAutofilled"
                        class="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                      >
                        <Icon
                          name="heroicons:sparkles"
                          class="h-3 w-3 text-emerald-600"
                        />
                        Autofilled from Duty Preset
                      </span>
                    </div>

                    <select
                      v-if="clinics.length > 0"
                      v-model="followUpLocation"
                      class="border-border bg-foreground/[0.03] focus:border-primary text-foreground w-full cursor-pointer rounded-xl border px-3.5 py-2.5 text-xs font-bold outline-none"
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
                      v-if="clinics.length === 0 || followUpLocation === '__custom__'"
                      type="text"
                      v-model="customFollowUpLocation"
                      placeholder="e.g. SkinCare Clinic, Room 402"
                      class="border-border bg-foreground/[0.03] focus:border-primary w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium outline-none"
                    />
                  </div>
                </div>
              </div>

              <!-- Full-Width Bottom Row: Spacious Consultation Time Window -->
              <div
                class="bg-card border-border/80 space-y-3 rounded-2xl border p-5 shadow-2xs sm:p-6"
              >
                <AppTimeRangePicker
                  v-model:start-time="followUpTimeOnly"
                  v-model:end-time="followUpEndTimeOnly"
                  :blocked-slots="dateBlockedSlots"
                  :duty-slots="dateDutySlots"
                  :existing-appointments="dateExistingAppts"
                  label="Consultation Time Window"
                />

                <Transition name="fade-scale">
                  <div
                    v-if="followUpEndTimeOnly <= followUpTimeOnly"
                    class="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
                  >
                    <Icon
                      name="material-symbols:warning-rounded"
                      class="mt-0.5 shrink-0 text-sm"
                    />
                    <p class="font-bold">End time must be after start time.</p>
                  </div>
                </Transition>

                <!-- Off-Duty on date warning -->
                <Transition name="fade-scale">
                  <div
                    v-if="followUpDateOnly && hasNoDutyOnFollowUpDate"
                    class="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
                  >
                    <Icon
                      name="material-symbols:block-rounded"
                      class="mt-0.5 shrink-0 text-sm"
                    />
                    <div>
                      <p class="font-bold">Doctor is Off-Duty on this date</p>
                      <p class="mt-0.5 text-red-500">
                        You have no scheduled duty hours on this date. Please select an available
                        date from the calendar.
                      </p>
                    </div>
                  </div>
                </Transition>

                <!-- Outside Duty Hours warning -->
                <Transition name="fade-scale">
                  <div
                    v-if="
                      followUpDateOnly && !hasNoDutyOnFollowUpDate && isFollowUpOutsideDutyHours
                    "
                    class="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
                  >
                    <Icon
                      name="material-symbols:warning-rounded"
                      class="mt-0.5 shrink-0 text-sm"
                    />
                    <div>
                      <p class="font-bold">Outside Doctor's Duty Hours</p>
                      <p class="mt-0.5 text-red-500">
                        Appointments must be scheduled during your active duty hours on this date:
                        <strong>{{ dutyRangesLabel }}</strong
                        >.
                      </p>
                    </div>
                  </div>
                </Transition>

                <Transition name="fade-scale">
                  <div
                    v-if="!showSuccess && isFollowUpConflict"
                    class="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
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
              </div>

              <!-- Blocked date / away warning banner -->
              <div
                v-if="dateBlockedSlots.length > 0"
                class="flex items-start gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 text-xs font-bold text-amber-900 shadow-2xs"
              >
                <Icon
                  name="material-symbols:warning-outline-rounded"
                  class="mt-0.5 shrink-0 text-lg text-amber-600"
                />
                <div class="flex flex-col gap-0.5">
                  <span>
                    {{
                      isSelectedDateFullyBlocked
                        ? 'Full Day Marked as Away / Unavailable on your schedule'
                        : 'Away / Unavailable schedule set on this date:'
                    }}
                  </span>
                  <span
                    v-if="!isSelectedDateFullyBlocked"
                    class="text-[11px] font-semibold text-amber-700"
                  >
                    Blocked ranges:
                    <template
                      v-for="(slot, idx) in dateBlockedSlots"
                      :key="idx"
                    >
                      {{ idx > 0 ? ', ' : '' }}{{ slot.start_time.slice(0, 5) }} -
                      {{ slot.end_time.slice(0, 5) }}
                    </template>
                  </span>
                </div>
              </div>
            </template>

            <!-- Disabled follow up state -->
            <div
              v-else
              class="bg-foreground/[0.02] border-border space-y-2 rounded-2xl border border-dashed p-6 text-center"
            >
              <Icon
                name="heroicons:calendar-days"
                class="text-muted-foreground mx-auto h-8 w-8 opacity-50"
              />
              <p class="text-muted-foreground text-xs font-semibold">
                No follow-up appointment will be scheduled for this consultation.
              </p>
              <button
                type="button"
                @click="noFollowUp = false"
                class="text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer rounded-xl px-4 py-2 text-xs font-bold transition"
              >
                Enable Follow-Up Scheduling
              </button>
            </div>

            <!-- Follow up validation error -->
            <div
              v-if="followUpError"
              class="flex flex-col items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-600 shadow-2xs sm:flex-row sm:items-center"
            >
              <div class="flex items-center gap-2">
                <Icon
                  name="material-symbols:warning-outline-rounded"
                  class="shrink-0 text-base text-red-500"
                />
                <span>{{ followUpError }}</span>
              </div>
              <button
                v-if="!patientUuid"
                type="button"
                @click="saveWithoutAccount"
                class="shrink-0 cursor-pointer rounded-xl bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition-all hover:bg-red-700 active:scale-95"
              >
                Save Diagnosis (No Account Required)
              </button>
            </div>

            <!-- Follow-up Instructions with Quick Suggestion Chips -->
            <div class="border-border/60 space-y-2 border-t pt-2">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold tracking-wider text-gray-700 uppercase"
                  >Follow-up Instructions & Objectives</label
                >
                <span class="text-muted-foreground text-[11px] italic"
                  >Visible on patient reminder</span
                >
              </div>

              <!-- Suggestion Chips -->
              <div class="flex flex-wrap items-center gap-1.5">
                <button
                  v-for="chip in quickInstructions"
                  :key="chip"
                  type="button"
                  @click="applyQuickInstruction(chip)"
                  class="bg-foreground/5 hover:bg-primary/10 hover:text-primary border-border/60 cursor-pointer rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors"
                >
                  + {{ chip }}
                </button>
              </div>

              <input
                type="text"
                v-model="note.follow_up_instructions"
                placeholder="e.g. When to return, what symptoms to monitor, biopsy review..."
                class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-gray-200/50 transition-all outline-none ring-inset focus:bg-white focus:ring-2 focus:ring-amber-500 focus:ring-inset"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
