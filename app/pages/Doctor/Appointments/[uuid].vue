<script setup lang="ts">
  import { useRoute, useRouter } from 'vue-router'
  import { useAppointments } from '~/composables/useAppointments'
  import { useDiagnosis } from '~/composables/useDiagnosis'
  import { useStorage } from '~/composables/useStorage'
  import { recordService } from '~/api/record/RecordService'
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const route = useRoute()
  const router = useRouter()
  const uuid = route.params.uuid as string

  const { appointments, pendingAppointments, completedAppointments, pending, fetchAppointments } =
    useAppointments()
  const { appointmentUuid, patientUuid, resetScanner, saveActiveDiagnosisState } = useDiagnosis()
  const { getStorageUrl } = useStorage()

  onMounted(() => {
    if (!appointments.value.length && !pendingAppointments.value.length) {
      fetchAppointments()
    }
  })

  const appointment = computed(() => {
    return (
      appointments.value.find(a => a.uuid === uuid || a.id === uuid) ||
      pendingAppointments.value.find(a => a.uuid === uuid || a.id === uuid) ||
      completedAppointments.value.find(a => a.uuid === uuid || a.id === uuid)
    )
  })

  const formattedDate = computed(() => {
    if (!appointment.value?.date) return 'TBD'
    return new Date(appointment.value.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  })

  const getInitials = (name: string): string => {
    if (!name) return ''
    const cleanName = name.replace(/^Dr\.\s+/i, '')
    const parts = cleanName.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const isDownloadingPdf = ref(false)

  const handleExportPdf = async () => {
    const diagIdentifier =
      appointment.value?.in_clinic_diagnosis_id ||
      appointment.value?.diagnosis_uuid ||
      appointment.value?.diagnosis_id
    if (!diagIdentifier) {
      toast.error('No diagnosis attached to this consultation yet.')
      return
    }

    isDownloadingPdf.value = true
    try {
      const blob = await recordService.downloadPdf(String(diagIdentifier))
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `clinical-assessment-appt-${uuid.slice(0, 8)}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Clinical consultation report downloaded successfully')
    } catch (err: any) {
      if (err?.status === 403 || err?.statusCode === 403) {
        toast.error(
          'Plan restriction: PDF exports are not included in your current subscription. Please upgrade to unlock.',
          {
            action: {
              label: 'View Plans',
              onClick: () => navigateTo('/doctor/subscription')
            }
          }
        )
      } else {
        toast.error(err?.message || 'Failed to export clinical report')
      }
    } finally {
      isDownloadingPdf.value = false
    }
  }

  // ── Pending Booking Actions ───────────────────────────────────────────
  const isProcessingBooking = ref(false)
  const handleAcceptBooking = async () => {
    if (!appointment.value?.id || isProcessingBooking.value) return
    isProcessingBooking.value = true
    try {
      await appointmentService.accept(appointment.value.id)
      toast.success('Appointment request accepted.')
      await fetchAppointments()
    } catch (e: any) {
      toast.error(
        e?.response?._data?.message || e?.data?.message || 'Failed to accept appointment.'
      )
    } finally {
      isProcessingBooking.value = false
    }
  }

  const handleDeclineBooking = async () => {
    if (!appointment.value?.id || isProcessingBooking.value) return
    isProcessingBooking.value = true
    try {
      await appointmentService.update(appointment.value.id, { status: 'declined' })
      toast.success('Appointment request declined.')
      await fetchAppointments()
      await router.push('/Doctor/Appointments')
    } catch (e: any) {
      toast.error(
        e?.response?._data?.message || e?.data?.message || 'Failed to decline appointment.'
      )
    } finally {
      isProcessingBooking.value = false
    }
  }

  // ── Consultation Scan Gate State & Actions ───────────────────────────
  const hasInClinicScan = computed(() => {
    return !!(appointment.value?.in_clinic_diagnosis_id || appointment.value?.in_clinic_diagnosis)
  })

  const hasScanException = computed(() => {
    return !!appointment.value?.scan_exception_reason
  })

  const hasHomeContextScan = computed(() => {
    return !!(appointment.value?.diagnosis_id || appointment.value?.diagnosis)
  })

  const isScanRequirementSatisfied = computed(() => {
    return hasInClinicScan.value || hasScanException.value
  })

  const showExceptionModal = ref(false)
  const isSubmittingException = ref(false)
  const exceptionCategory = ref('patient_refusal')
  const exceptionReason = ref('')

  const handleStartInClinicScan = () => {
    resetScanner()
    appointmentUuid.value = uuid
    const pUuid = appointment.value?.patient_uuid || appointment.value?.patient?.uuid
    if (pUuid) {
      patientUuid.value = pUuid
    }
    saveActiveDiagnosisState()
    navigateTo('/Doctor/Scan')
  }

  const handleOpenExceptionModal = () => {
    exceptionCategory.value = 'patient_refusal'
    exceptionReason.value = ''
    showExceptionModal.value = true
  }

  const handleCloseExceptionModal = () => {
    showExceptionModal.value = false
    exceptionReason.value = ''
  }

  const handleSubmitException = async () => {
    if (!exceptionReason.value.trim()) {
      toast.error(
        'Please enter a clinical rationale explaining why the in-clinic scan was omitted.'
      )
      return
    }

    isSubmittingException.value = true
    try {
      await appointmentService.recordScanException(uuid, {
        category: exceptionCategory.value,
        reason: exceptionReason.value.trim()
      })
      toast.success('Clinical scan exception documented successfully.')
      showExceptionModal.value = false
      exceptionReason.value = ''
      await fetchAppointments()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to record scan exception.')
    } finally {
      isSubmittingException.value = false
    }
  }

  const formatExceptionCategory = (cat?: string | null) => {
    if (!cat) return 'Clinical Rationale'
    switch (cat) {
      case 'patient_refusal':
        return 'Patient Refusal / Declined'
      case 'equipment_failure':
        return 'Equipment Malfunction'
      case 'anatomical_restriction':
        return 'Anatomical Restriction'
      case 'clinical_contraindication':
        return 'Clinical Contraindication'
      case 'other':
        return 'Other Medical Rationale'
      default:
        return cat.replace(/_/g, ' ')
    }
  }
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-gray-50/50 p-6">
    <!-- Header -->
    <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <AppButton
          variant="ghost"
          size="icon"
          @click="router.back()"
          class="rounded-full bg-white shadow-sm ring-1 ring-gray-200"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </AppButton>
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-3xl font-bold text-gray-900">Clinical Consultation</h1>
            <AppBadge
              v-if="appointment?.status === 'pending'"
              color="warning"
              size="sm"
            >
              Pending Request
            </AppBadge>
            <AppBadge
              v-else-if="isScanRequirementSatisfied"
              color="success"
              size="sm"
            >
              Scan Gate Satisfied
            </AppBadge>
            <AppBadge
              v-else
              color="danger"
              size="sm"
            >
              In-Clinic Scan Required
            </AppBadge>
          </div>
          <p class="text-gray-500">
            Review patient history, capture in-clinic scans, and record clinical notes.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Accept / Decline for Pending Requests -->
        <AppButton
          v-if="appointment?.status === 'pending'"
          variant="unstyled"
          size="unstyled"
          rounded="unstyled"
          :disabled="isProcessingBooking"
          @click="handleAcceptBooking"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
        >
          <Icon
            :name="
              isProcessingBooking
                ? 'svg-spinners:ring-resize'
                : 'material-symbols:check-circle-rounded'
            "
            class="text-base"
          />
          <span>Accept Request</span>
        </AppButton>
        <AppButton
          v-if="appointment?.status === 'pending'"
          variant="unstyled"
          size="unstyled"
          rounded="unstyled"
          :disabled="isProcessingBooking"
          @click="handleDeclineBooking"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 shadow-2xs transition-all hover:bg-red-100 active:scale-95 disabled:opacity-50"
        >
          <Icon
            name="material-symbols:cancel-rounded"
            class="text-base"
          />
          <span>Decline</span>
        </AppButton>

        <AppButton
          v-if="appointment?.diagnosis_id || appointment?.in_clinic_diagnosis_id"
          variant="unstyled"
          size="unstyled"
          rounded="unstyled"
          :disabled="isDownloadingPdf"
          @click="handleExportPdf"
          class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-800 shadow-2xs transition-all hover:bg-gray-50 active:scale-95 disabled:opacity-50"
        >
          <Icon
            :name="isDownloadingPdf ? 'svg-spinners:ring-resize' : 'solar:document-medicine-bold'"
            class="text-primary text-base"
          />
          <span>{{ isDownloadingPdf ? 'Exporting...' : 'Export Clinical Report (PDF)' }}</span>
        </AppButton>
      </div>
    </div>

    <div
      v-if="pending"
      class="flex flex-1 items-center justify-center"
    >
      <Icon
        name="material-symbols:sync"
        class="animate-spin text-4xl text-indigo-500"
      />
    </div>

    <div
      v-else-if="appointment"
      class="custom-scrollbar flex-1 space-y-6 overflow-y-auto pr-2"
    >
      <!-- Patient Information Card -->
      <div
        class="flex flex-col gap-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-start"
      >
        <div
          v-if="appointment.diagnosis_image"
          class="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-indigo-100 bg-gray-50"
        >
          <img
            :src="getStorageUrl(appointment.diagnosis_image)"
            class="h-full w-full object-cover"
          />
        </div>
        <div
          v-else
          class="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-indigo-50 text-2xl font-bold text-indigo-600"
        >
          {{ getInitials(appointment.doctor) }}
        </div>
        <div class="flex-1 space-y-4">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">{{ appointment.doctor }}</h2>
            <div class="mt-1 flex items-center gap-2">
              <AppBadge color="primary">{{ appointment.time }}</AppBadge>
              <span class="text-gray-400">•</span>
              <span class="text-sm font-medium text-gray-600">{{ formattedDate }}</span>
            </div>
          </div>

          <div
            class="flex flex-wrap gap-4 rounded-2xl border border-indigo-100/50 bg-indigo-50/50 p-4"
          >
            <div class="flex min-w-[140px] flex-1 flex-col">
              <span class="text-[10px] font-bold tracking-widest text-indigo-400 uppercase"
                >Reported Condition</span
              >
              <span class="font-bold text-indigo-900">{{ appointment.info }}</span>
            </div>
            <div
              class="flex min-w-[140px] flex-1 flex-col"
              v-if="appointment.diagnosis_id"
            >
              <span class="text-[10px] font-bold tracking-widest text-emerald-500 uppercase"
                >Pre-Consult Context</span
              >
              <span class="font-mono font-bold text-emerald-700">Available (Self-Scan)</span>
            </div>
            <div class="flex min-w-[140px] flex-1 flex-col">
              <span class="text-[10px] font-bold tracking-widest text-indigo-400 uppercase"
                >Consultation Scan</span
              >
              <span
                class="font-mono font-bold"
                :class="
                  hasInClinicScan
                    ? 'text-emerald-700'
                    : hasScanException
                      ? 'text-amber-700'
                      : 'text-rose-600'
                "
              >
                {{
                  hasInClinicScan
                    ? 'In-Clinic Attached'
                    : hasScanException
                      ? 'Exception Documented'
                      : 'Required'
                }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ═════════════════════════════════════════════════════════════
           Consultation Scan Gate Card: Mandatory In-Clinic Verification
           ═════════════════════════════════════════════════════════════ -->
      <div class="space-y-4">
        <!-- Case A: In-Clinic Scan Attached -->
        <div
          v-if="hasInClinicScan"
          class="relative overflow-hidden rounded-3xl border border-emerald-100 bg-linear-to-br from-emerald-50/70 via-white to-teal-50/30 p-5 shadow-xs transition-all sm:p-6"
        >
          <div class="relative flex items-start gap-3.5 sm:gap-4">
            <div
              v-if="appointment.in_clinic_diagnosis?.image_path"
              class="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-200/80 bg-white shadow-2xs sm:h-16 sm:w-16"
            >
              <img
                :src="getStorageUrl(appointment.in_clinic_diagnosis.image_path)"
                class="h-full w-full object-cover"
              />
            </div>
            <div
              v-else
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/80 bg-emerald-100/80 text-emerald-700 shadow-2xs sm:h-12 sm:w-12"
            >
              <Icon
                name="lucide:check-circle-2"
                class="text-xl sm:text-2xl"
              />
            </div>

            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-bold tracking-tight text-gray-900 sm:text-base">
                  In-Clinic Consultation Scan Verified
                </h3>
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-emerald-700 uppercase"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Official Consultation Scan
                </span>
              </div>

              <p class="text-xs leading-relaxed text-gray-600 sm:text-[13px]">
                Clinical scan captured during face-to-face consultation. Verified diagnosis:
                <strong class="font-bold text-gray-900">{{
                  appointment.in_clinic_diagnosis?.label || appointment.info
                }}</strong
                >.
              </p>

              <div class="pt-1">
                <AppButton
                  variant="unstyled"
                  size="unstyled"
                  rounded="unstyled"
                  class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs transition-all hover:bg-emerald-50 active:scale-95"
                  @click="handleStartInClinicScan"
                >
                  <Icon
                    name="lucide:camera"
                    class="text-sm text-emerald-600"
                  />
                  <span>Capture Additional Scan</span>
                </AppButton>
              </div>
            </div>
          </div>
        </div>

        <!-- Case B: Clinical Scan Exception Documented -->
        <div
          v-else-if="hasScanException"
          class="relative overflow-hidden rounded-3xl border border-amber-100 bg-linear-to-br from-amber-50/70 via-white to-orange-50/30 p-5 shadow-xs transition-all sm:p-6"
        >
          <div class="relative flex items-start gap-3.5 sm:gap-4">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200/80 bg-amber-100/80 text-amber-700 shadow-2xs sm:h-12 sm:w-12"
            >
              <Icon
                name="lucide:shield-alert"
                class="text-xl sm:text-2xl"
              />
            </div>

            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-bold tracking-tight text-gray-900 sm:text-base">
                  Clinical Scan Exception Documented
                </h3>
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-800 uppercase"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  {{ formatExceptionCategory(appointment.scan_exception_category) }}
                </span>
              </div>

              <p class="text-xs leading-relaxed text-gray-700 sm:text-[13px]">
                <span class="font-bold text-gray-900">Authorized Rationale:</span>
                "{{ appointment.scan_exception_reason }}"
              </p>

              <div class="pt-1">
                <AppButton
                  variant="unstyled"
                  size="unstyled"
                  rounded="unstyled"
                  class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-200/90 bg-white px-3.5 py-1.5 text-xs font-bold text-amber-800 shadow-2xs transition-all hover:bg-amber-50 active:scale-95"
                  @click="handleStartInClinicScan"
                >
                  <Icon
                    name="lucide:camera"
                    class="text-sm text-amber-600"
                  />
                  <span>Perform In-Clinic Scan Now</span>
                </AppButton>
              </div>

              <p class="text-[11px] font-medium text-gray-400">
                Exception granted per protocol. Consultation can proceed to completion.
              </p>
            </div>
          </div>
        </div>

        <!-- Case C: Mandatory In-Clinic Scan Required -->
        <div
          v-else
          class="relative overflow-hidden rounded-3xl border border-rose-100 bg-linear-to-br from-rose-50/70 via-white to-amber-50/30 p-5 shadow-xs transition-all sm:p-6"
        >
          <!-- Subtle decorative ambient glow -->
          <div
            class="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-rose-200/20 blur-2xl"
          ></div>

          <div class="relative flex items-start gap-3.5 sm:gap-4">
            <!-- Icon Squircle -->
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-200/80 bg-rose-100/80 text-rose-600 shadow-2xs sm:h-12 sm:w-12"
            >
              <Icon
                name="lucide:scan-face"
                class="text-xl sm:text-2xl"
              />
            </div>

            <div class="min-w-0 flex-1 space-y-2">
              <!-- Header Row -->
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-bold tracking-tight text-gray-900 sm:text-base">
                  In-Clinic Consultation Scan Required
                </h3>
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-rose-700 uppercase"
                >
                  <span class="relative flex h-1.5 w-1.5">
                    <span
                      class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"
                    ></span>
                    <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                  </span>
                  Action Required
                </span>
              </div>

              <!-- Body Description -->
              <p class="text-xs leading-relaxed text-gray-600 sm:text-[13px]">
                Every face-to-face consultation requires a verified in-clinic scan prior to
                completion. Pre-consultation home scans provide historical context only.
              </p>

              <!-- Actions: Positioned naturally under text -->
              <div class="flex flex-wrap items-center gap-2.5 pt-1">
                <AppButton
                  variant="solid"
                  size="sm"
                  class="bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20 flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition-all hover:shadow-md active:scale-95"
                  @click="handleStartInClinicScan"
                >
                  <Icon
                    name="lucide:camera"
                    class="text-sm"
                  />
                  <span>Capture In-Clinic Scan</span>
                </AppButton>

                <AppButton
                  variant="unstyled"
                  size="unstyled"
                  rounded="unstyled"
                  class="flex cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200/90 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-2xs transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 active:scale-95"
                  @click="handleOpenExceptionModal"
                >
                  <Icon
                    name="lucide:file-text"
                    class="text-sm text-gray-500"
                  />
                  <span>Document Exception</span>
                </AppButton>
              </div>

              <p class="text-[11px] font-medium text-gray-400">
                If the patient declines or scanning is clinically infeasible, document an authorized
                exception above.
              </p>
            </div>
          </div>
        </div>

        <!-- Informational Context: Pre-Consultation Home Scan -->
        <div
          v-if="hasHomeContextScan"
          class="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-xs shadow-xs"
        >
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500"
          >
            <Icon
              name="lucide:info"
              size="16"
            />
          </div>
          <div class="space-y-0.5">
            <span class="font-bold text-gray-900"
              >Pre-Consultation Self-Assessment (Context Only)</span
            >
            <p class="text-[11px] text-gray-500">
              The patient captured a home scan prior to this appointment. This is retained in the
              patient's record as historical reference.
            </p>
          </div>
        </div>
      </div>

      <!-- Clinical Note Form -->
      <AppClinicalNoteForm
        :appointment-uuid="uuid"
        :diagnosis-id="appointment.in_clinic_diagnosis_id || appointment.diagnosis_id"
        :diagnosis-uuid="appointment.in_clinic_diagnosis?.uuid || appointment.diagnosis?.uuid"
      />
    </div>

    <div
      v-else
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <h3 class="text-xl font-bold text-gray-900">Appointment not found</h3>
      <p class="mt-2 text-gray-500">The consultation you are looking for does not exist.</p>
    </div>

    <!-- ═════════════════════════════════════════════════════════════
         Modal: Document Clinical Scan Exception
         ═════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div
        v-if="showExceptionModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div class="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
          <div class="flex items-center justify-between border-b border-gray-100 pb-4">
            <div class="flex items-center gap-3">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"
              >
                <Icon
                  name="lucide:shield-alert"
                  size="20"
                />
              </div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Document Scan Exception</h3>
                <p class="text-xs text-gray-500">
                  Provide medical rationale for omitting the in-clinic scan.
                </p>
              </div>
            </div>
            <button
              type="button"
              @click="handleCloseExceptionModal"
              class="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <Icon
                name="lucide:x"
                size="18"
              />
            </button>
          </div>

          <div class="mt-5 space-y-4">
            <div>
              <label class="block text-xs font-bold text-gray-700">Exception Category</label>
              <select
                v-model="exceptionCategory"
                class="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-800 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              >
                <option value="patient_refusal">Patient Refusal / Declined Skin Scan</option>
                <option value="equipment_failure">Camera / Equipment Malfunction</option>
                <option value="anatomical_restriction">
                  Anatomical Restriction / Inaccessible Site
                </option>
                <option value="clinical_contraindication">
                  Clinical Contraindication / Acute Wound
                </option>
                <option value="other">Other Medical Rationale</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-700"
                >Clinical Rationale & Notes</label
              >
              <textarea
                v-model="exceptionReason"
                rows="3"
                placeholder="Detail the clinical justification for proceeding without an in-clinic scan..."
                class="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-800 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div class="rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
              <strong class="font-bold">Protocol note:</strong> Documented exceptions are recorded
              in the medical audit trail and allow the consultation to be marked as completed
              without generating fabricated scans.
            </div>
          </div>

          <div class="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <AppButton
              variant="outline"
              size="sm"
              class="rounded-xl"
              @click="handleCloseExceptionModal"
              :disabled="isSubmittingException"
            >
              Cancel
            </AppButton>
            <AppButton
              variant="solid"
              size="sm"
              class="rounded-xl bg-amber-600 font-bold text-white hover:bg-amber-700"
              @click="handleSubmitException"
              :disabled="isSubmittingException"
            >
              <Icon
                v-if="isSubmittingException"
                name="svg-spinners:ring-resize"
                class="mr-1.5"
                size="14"
              />
              {{ isSubmittingException ? 'Saving Exception...' : 'Save Scan Exception' }}
            </AppButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
