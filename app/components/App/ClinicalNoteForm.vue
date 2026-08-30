<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { clinicalNoteService, type ClinicalNote } from '~/api/clinicalNote/ClinicalNoteService'
  import { userService } from '~/api/user/UserService'

  const props = defineProps<{
    appointmentUuid?: string
    diagnosisId?: number | null
    diagnosisUuid?: string | null
    skipLoad?: boolean
    isFinishMode?: boolean
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

  const noFollowUp = ref(false)
  const followUpDateOnly = ref('')
  const followUpTimeOnly = ref('09:00')
  const followUpEndTimeOnly = ref('10:00')
  const followUpError = ref<string | null>(null)
  const followUpSectionRef = ref<HTMLElement | null>(null)

  watch(followUpTimeOnly, (newStart) => {
    if (!newStart) return
    const [h, m] = newStart.split(':').map(Number)
    const endHour = (h + 1) % 24
    followUpEndTimeOnly.value = `${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  })

  const parseFollowUpDate = (val: string) => {
    if (!val) {
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
          noFollowUp.value = parsed.noFollowUp
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
        if (note.value.follow_up_date) {
          parseFollowUpDate(note.value.follow_up_date)
        }
      } else {
        noFollowUp.value = false
        followUpDateOnly.value = ''
      }
    } catch (e) {
      console.error('Failed to parse draft from localStorage', e)
    }
  }

  onMounted(async () => {
    if (props.skipLoad) {
      loadDraftIfExists()
      isLoaded.value = true
      return
    }

    try {
      if (props.appointmentUuid) {
        const existing = await clinicalNoteService.getByAppointment(props.appointmentUuid)
        if (existing && (existing.history_of_present_illness || existing.final_diagnosis || existing.prescription)) {
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
    [note, noFollowUp, followUpDateOnly, followUpTimeOnly, followUpEndTimeOnly],
    () => {
      if (!isLoaded.value) return
      try {
        const draftData = {
          note: note.value,
          noFollowUp: noFollowUp.value,
          followUpDateOnly: followUpDateOnly.value,
          followUpTimeOnly: followUpTimeOnly.value,
          followUpEndTimeOnly: followUpEndTimeOnly.value
        }
        localStorage.setItem(storageKey.value, JSON.stringify(draftData))
      } catch (e) {
        console.error('Failed to save draft to localStorage', e)
      }
    },
    { deep: true }
  )

  const { blockedSlots, isTimeBlockedOnDate, isTimeRangeBlockedOnDate, isWholeDayBlocked, getBlockedTimesForDate } = useBlockedDates()
  const { appointments, fetchAppointments, isApptTimeConflicting } = useAppointments()
  const scheduledFollowUpUuid = ref<string | undefined>()

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

  const dateExistingAppts = computed(() => {
    if (!followUpDateOnly.value) return []
    return appointments.value
      .filter((appt) => appt.date === followUpDateOnly.value && appt.id !== (scheduledFollowUpUuid.value || props.appointmentUuid) && appt.raw_scheduled_at)
      .map((appt) => {
        const startObj = new Date(appt.raw_scheduled_at!.replace(/Z|(\+\d{2}:\d{2})$/i, ''))
        const startH = String(startObj.getHours()).padStart(2, '0')
        const startM = String(startObj.getMinutes()).padStart(2, '0')

        let endH = String((startObj.getHours() + 1) % 24).padStart(2, '0')
        let endM = startM
        if (appt.raw_scheduled_end_at) {
          const endObj = new Date(appt.raw_scheduled_end_at.replace(/Z|(\+\d{2}:\d{2})$/i, ''))
          endH = String(endObj.getHours()).padStart(2, '0')
          endM = String(endObj.getMinutes()).padStart(2, '0')
        }

        return {
          start_time: `${startH}:${startM}`,
          end_time: `${endH}:${endM}`,
          label: appt.doctor || 'Booked Appointment'
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
    if (typeof value.uuid === 'string' && (value.scheduled_at || value.scheduled_end_at || value.conversation_uuid)) return value
    if (typeof value.id === 'string' && (value.scheduled_at || value.scheduled_end_at || value.conversation_uuid)) return value
    for (const nested of Object.values(value)) {
      const found = findScheduledAppointment(nested)
      if (found) return found
    }
    return undefined
  }

  const isSameScheduledTime = (rawDateTime: string | undefined, date: string, time: string) => {
    if (!rawDateTime) return false
    return rawDateTime.replace('T', ' ').replace(/Z|(\+\d{2}:\d{2})$/i, '').slice(0, 16) === `${date} ${time}`
  }

  const findScheduledFollowUpFromList = () => {
    if (!followUpDateOnly.value || !followUpTimeOnly.value || !patientUuid.value) return undefined
    return appointments.value.find(appt => {
      const apptPatientUuid = (appt as any).patient_uuid || (appt as any).patient?.uuid
      return apptPatientUuid === patientUuid.value
        && isSameScheduledTime(appt.raw_scheduled_at, followUpDateOnly.value, followUpTimeOnly.value)
    })
  }

  const existingSelectedFollowUp = computed(() => findScheduledFollowUpFromList())

  const saveNote = async () => {
    followUpError.value = null
    if (!noFollowUp.value && !followUpDateOnly.value) {
      followUpError.value = "Please select a follow-up appointment date & time, or check 'No follow-up appointment required'."
      if (followUpSectionRef.value) {
        followUpSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    if (!noFollowUp.value && followUpDateOnly.value && followUpEndTimeOnly.value <= followUpTimeOnly.value) {
      followUpError.value = "Follow-up appointment end time must be after the start time."
      if (followUpSectionRef.value) {
        followUpSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    if (!noFollowUp.value && isFollowUpConflict.value) {
      if (existingSelectedFollowUp.value) {
        scheduledFollowUpUuid.value = existingSelectedFollowUp.value.id
      } else {
        followUpError.value = "An appointment is already scheduled during this time slot. Please choose a different time."
        if (followUpSectionRef.value) {
          followUpSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return
      }
    }

    if (!noFollowUp.value && followUpDateOnly.value && isTimeRangeBlockedOnDate(followUpDateOnly.value, followUpTimeOnly.value, followUpEndTimeOnly.value)) {
      followUpError.value = "The selected time slot is marked as unavailable on your schedule. Please select another time or date, or check 'No follow-up appointment required'."
      if (followUpSectionRef.value) {
        followUpSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    if (!noFollowUp.value && followUpDateOnly.value && !patientUuid.value && !props.appointmentUuid) {
      followUpError.value = "A registered patient account is required to schedule a follow-up appointment. Please click 'Create Patient Account' above to register the patient, or check 'No follow-up appointment required'."
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
        (note.value as any).diagnosis_uuid = props.diagnosisUuid
      }
      
      if (props.appointmentUuid) {
        const saved = await clinicalNoteService.save(props.appointmentUuid, note.value)
        note.value = { ...note.value, ...saved }
      } else if (props.diagnosisUuid) {
        const saved = await clinicalNoteService.saveForDiagnosis(props.diagnosisUuid, note.value)
        note.value = { ...note.value, ...saved }
      } else {
        throw new Error('Neither appointmentUuid nor diagnosisUuid provided for saving clinical note.')
      }

      // Schedule follow-up appointment if patient account exists
      if (alreadyScheduledFollowUp) {
        didScheduleFollowUp = true
        scheduledFollowUpUuid.value = alreadyScheduledFollowUp.id
        scheduledConversationUuid = alreadyScheduledFollowUp.conversation_uuid
        hasSavedFollowUp.value = true
      } else if (isExplicitSaveRequested.value && !noFollowUp.value && followUpDateOnly.value && patientUuid.value) {
        try {
          const scheduled = await userService.scheduleAppointmentForPatient(patientUuid.value, {
            scheduled_at: `${followUpDateOnly.value} ${followUpTimeOnly.value}:00`,
            scheduled_end_at: `${followUpDateOnly.value} ${followUpEndTimeOnly.value}:00`,
            location: 'Doctor Clinic',
            purpose: note.value.follow_up_instructions || 'Follow-up appointment for diagnosis assessment'
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
          followUpError.value = err.data?.message || err.message || 'Conflict detected: Failed to schedule appointment.'
          if (followUpSectionRef.value) {
            followUpSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          isSaving.value = false
          return
          }
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
      emit('saved', { conversationUuid: scheduledConversationUuid, followUpScheduled: didScheduleFollowUp })
      
      setTimeout(() => {
        showSuccess.value = false
      }, 3000)
    } catch (e) {
      console.error('Failed to save clinical note', e)
      alert('Failed to save clinical note. Please try again.')
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
    isExplicitSaveRequested.value = true
    try {
      await saveNote()
    } finally {
      isExplicitSaveRequested.value = false
    }
  }
</script>

<template>
  <div v-if="!isLoaded" class="flex items-center justify-center py-20">
    <Icon name="svg-spinners:180-ring-with-bg" class="text-6xl text-primary opacity-50" />
  </div>
  <div v-else class="space-y-10 rounded-[2.5rem] bg-white/70 backdrop-blur-xl border border-white/50 py-8 px-0 sm:py-10 sm:px-0 relative overflow-hidden">
    <div class="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
    
    <div class="flex items-center justify-between border-b border-gray-100/50 pb-6 relative z-10">
      <div class="flex items-center gap-4">
        <div class="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center">
           <Icon name="material-symbols:edit-document-outline-rounded" class="text-primary text-2xl" />
        </div>
        <div>
          <h2 class="text-2xl font-black text-gray-900 tracking-tight">Clinical SOAP Note</h2>
          <p class="text-sm font-medium text-gray-500 mt-0.5">Official medical documentation and assessment.</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <AppButton type="button" :loading="isSaving" @click="handleSaveClick" :class="[showSuccess ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20' : 'bg-primary hover:bg-primary/90 shadow-primary/20', 'text-white font-bold px-8 py-3 rounded-2xl shadow-lg transition-all hover:shadow-xl active:scale-95 flex items-center gap-2']">
          <Icon v-if="showSuccess" name="material-symbols:check-circle-rounded" class="text-xl" />
          <Icon v-else-if="!isSaving" name="material-symbols:save-outline-rounded" class="text-xl" />
          {{ showSuccess ? 'Saved!' : (isSaving ? 'Saving...' : (isFinishMode ? 'Finish Diagnosis & Save' : 'Save Note')) }}
        </AppButton>
      </div>
    </div>

    <div class="space-y-10 relative z-10">
      <!-- Subjective -->
      <section class="group">
        <h3 class="mb-5 flex items-center gap-3 text-xl font-bold text-gray-900">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-600 shadow-sm border border-indigo-100">S</span>
          Subjective
        </h3>
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">History of Present Illness</label>
            <textarea
              v-model="note.history_of_present_illness"
              rows="3"
              placeholder="Duration, symptoms, triggers..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all outline-none resize-none"
            ></textarea>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Systemic Symptoms</label>
            <textarea
              v-model="note.systemic_symptoms"
              rows="3"
              placeholder="Fever, fatigue, other affected areas..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all outline-none resize-none"
            ></textarea>
          </div>
        </div>
      </section>

      <!-- Objective -->
      <section class="group">
        <h3 class="mb-5 flex items-center gap-3 text-xl font-bold text-gray-900">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-600 shadow-sm border border-blue-100">O</span>
          Objective
        </h3>
        <div class="flex flex-col gap-2">
          <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Physical Exam Findings</label>
          <textarea
            v-model="note.physical_exam"
            rows="3"
            placeholder="Visual inspection details, lesion description..."
            class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-all outline-none resize-none"
          ></textarea>
        </div>
      </section>

      <!-- Assessment -->
      <section class="group">
        <h3 class="mb-5 flex items-center gap-3 text-xl font-bold text-gray-900">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-sm font-black text-emerald-600 shadow-sm border border-emerald-100">A</span>
          Assessment
        </h3>
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Differential Diagnosis</label>
            <textarea
              v-model="note.differential_diagnosis"
              rows="2"
              placeholder="Alternative possible diagnoses..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-emerald-500 transition-all outline-none resize-none"
            ></textarea>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Final Diagnosis</label>
            <input
              type="text"
              v-model="note.final_diagnosis"
              placeholder="Primary diagnosis..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-emerald-500 transition-all outline-none"
            />
          </div>
        </div>
      </section>

      <!-- Plan -->
      <section class="group">
        <h3 class="mb-5 flex items-center gap-3 text-xl font-bold text-gray-900">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-sm font-black text-amber-600 shadow-sm border border-amber-100">P</span>
          Plan
        </h3>
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Prescriptions</label>
            <textarea
              v-model="note.prescription"
              rows="4"
              placeholder="Medication name, dosage, frequency, duration..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-amber-500 transition-all outline-none resize-none"
            ></textarea>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Patient Education & Instructions</label>
            <textarea
              v-model="note.patient_education"
              rows="4"
              placeholder="Skin care routines, triggers to avoid..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-amber-500 transition-all outline-none resize-none"
            ></textarea>
          </div>

          <div ref="followUpSectionRef" class="flex flex-col gap-2.5 sm:col-span-2 p-5 rounded-2xl border transition-all" :class="followUpError ? 'bg-red-50/40 border-red-300 ring-2 ring-red-200' : 'bg-gray-50/50 border-gray-100'">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label class="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                <Icon name="material-symbols:calendar-clock-outline" class="text-primary text-base" />
                Set Next Appointment Date & Time
              </label>
              <label class="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-xs">
                <input
                  type="checkbox"
                  v-model="noFollowUp"
                  class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <span>No follow-up appointment required</span>
              </label>
            </div>

            <!-- Date & Time Selection -->
            <div v-if="!noFollowUp" class="grid gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-xs mt-1 overflow-visible xl:grid-cols-[400px_minmax(260px,1fr)]">
              <div class="relative z-30 flex w-full justify-center overflow-visible xl:block">
                <PatientSideComponentsCalendar
                  :min-date="getTodayStr()"
                  :blocked-slots="blockedSlots"
                  :show-manage-blocks-link="true"
                  :show-appointment-details-panel="false"
                  @date-selected="handleFollowUpDateSelected"
                />
              </div>

              <div class="flex min-w-0 flex-col justify-center gap-4 rounded-2xl bg-gray-50/80 p-4 border border-gray-100">
                <div>
                  <label class="mb-2 block text-sm font-bold text-gray-500">Selected Date</label>
                  <div class="rounded-xl border border-gray-200 bg-white p-3 font-semibold text-indigo-600">
                    {{ followUpDateOnly || 'Please select a date from the calendar' }}
                  </div>
                </div>

                <div class="my-2">
                  <AppTimeRangePicker
                    v-model:start-time="followUpTimeOnly"
                    v-model:end-time="followUpEndTimeOnly"
                    :blocked-slots="dateBlockedSlots"
                    :existing-appointments="dateExistingAppts"
                    label="Follow-Up Appointment Time"
                  />
                </div>

                <Transition name="fade-scale">
                  <div
                    v-if="followUpEndTimeOnly <= followUpTimeOnly"
                    class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
                  >
                    <Icon name="material-symbols:warning-rounded" class="mt-0.5 shrink-0 text-sm" />
                    <p class="font-bold">End time must be after start time.</p>
                  </div>
                </Transition>

                <Transition name="fade-scale">
                  <div
                    v-if="!showSuccess && isFollowUpConflict"
                    class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600"
                  >
                    <Icon name="material-symbols:warning-rounded" class="mt-0.5 shrink-0 text-sm" />
                    <div>
                      <p class="font-bold">Conflicting Appointment</p>
                      <p class="text-red-500 mt-0.5">An appointment is already scheduled during this time slot. Please choose a different time.</p>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Blocked date / away notice -->
            <div v-if="!noFollowUp && dateBlockedSlots.length > 0" class="mt-1 text-xs font-bold text-amber-900 bg-amber-50/90 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2 shadow-2xs">
              <Icon name="material-symbols:warning-outline-rounded" class="text-base text-amber-600 shrink-0 mt-0.5" />
              <div class="flex flex-col gap-0.5">
                <span>
                  {{ isSelectedDateFullyBlocked ? 'Full Day Marked as Away / Unavailable on your schedule' : 'Away / Unavailable schedule set on this date:' }}
                </span>
                <span v-if="!isSelectedDateFullyBlocked" class="text-[11px] text-amber-700 font-semibold">
                  Blocked ranges: 
                  <template v-for="(slot, idx) in dateBlockedSlots" :key="idx">
                    {{ idx > 0 ? ', ' : '' }}{{ slot.start_time.slice(0, 5) }} - {{ slot.end_time.slice(0, 5) }}
                  </template>
                </span>
              </div>
            </div>
            <div v-else-if="noFollowUp" class="p-3 bg-white/60 rounded-xl border border-dashed border-gray-200 text-xs font-semibold text-gray-400 italic">
              No follow-up date will be scheduled for this assessment.
            </div>

            <!-- Follow up validation error -->
            <div v-if="followUpError" class="mt-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div class="flex items-center gap-2">
                <Icon name="material-symbols:warning-outline-rounded" class="text-base text-red-500 shrink-0" />
                <span>{{ followUpError }}</span>
              </div>
              <button
                v-if="!patientUuid"
                type="button"
                @click="saveWithoutAccount"
                class="shrink-0 bg-red-600 text-white hover:bg-red-700 font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Save Diagnosis (No Account Required)
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2 sm:col-span-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Follow-up Instructions</label>
            <input
              type="text"
              v-model="note.follow_up_instructions"
              placeholder="When to return, what to monitor..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-amber-500 transition-all outline-none"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
