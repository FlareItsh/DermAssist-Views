<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { toast } from 'vue-sonner'
  import { $api } from '~/composables/useApi'
  import { recordService } from '~/api/record/RecordService'

  interface Props {
    compactEmpty?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    compactEmpty: false
  })

  export interface ParsedMedicationItem {
    medication: string
    quantity: string | null
    frequency: string | null
    duration: string | null
    instructions: string | null
  }

  export interface PrescriptionRecordEntry {
    key: string
    noteId?: number | null
    diagnosisUuid: string | null
    prescriptionNumber: string
    conditionLabel: string
    doctorName: string
    dateFormatted: string
    timestamp: number
    rawPrescription: string
    patientEducation: string | null
    items: ParsedMedicationItem[]
  }

  const { allAppointments } = useAppointments()

  const isLoading = ref(true)
  const rawRecords = ref<any[]>([])
  const currentIndex = ref(0)
  const showPatientEducation = ref(false)
  const showPrescriptionPadModal = ref(false)
  const isDownloadingPdf = ref(false)

  const parsePrescriptionText = (text: string): ParsedMedicationItem[] => {
    const trimmed = (text || '').trim()
    if (!trimmed) return []

    const lines = trimmed.split(/\r\n|\r|\n/)
    const items: ParsedMedicationItem[] = []
    const freqCodeRegex = /^(OD|BID|TID|QID|QOD|PRN|HS|STAT|Q\d+H|1X|2X|3X|4X)$/i

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      const cleanLine = line.replace(/^[•\-\*\d\.\)\s]+/u, '').trim()
      if (!cleanLine) continue

      let rawMed = cleanLine
      let sigSegment: string | null = null

      if (cleanLine.includes('—')) {
        const parts = cleanLine.split('—')
        rawMed = (parts[0] || '').trim()
        sigSegment = parts.slice(1).join('—').trim()
      } else if (cleanLine.includes(' - ')) {
        const parts = cleanLine.split(' - ')
        rawMed = (parts[0] || '').trim()
        sigSegment = parts.slice(1).join(' - ').trim()
      }

      let quantity: string | null = null
      let cleanMed = rawMed

      const medHashMatch = rawMed.match(/(?:^|\s)#\s*([0-9a-zA-Z\s\(\)\.\/\-]+)$/i)
      const medQtyBracketMatch = rawMed.match(
        /[\(\[]\s*(?:Qty|Dispense|Disp)[\:\s]*([^\)\]]+)[\)\]]/i
      )

      if (medHashMatch && medHashMatch[1]) {
        quantity = `#${medHashMatch[1].trim()}`
        const hashIdx = rawMed.lastIndexOf('#')
        if (hashIdx !== -1) {
          cleanMed = rawMed.slice(0, hashIdx).trim()
        }
      } else if (medQtyBracketMatch && medQtyBracketMatch[1]) {
        quantity = `#${medQtyBracketMatch[1].trim()}`
        cleanMed = rawMed
          .replace(/[\(\[]\s*(?:Qty|Dispense|Disp)[\:\s]*([^\)\]]+)[\)\]]/i, '')
          .trim()
      } else if (sigSegment) {
        const sigHashMatch = sigSegment.match(/(?:^|\s)#\s*([0-9a-zA-Z\s\(\)\.\/\-]+)$/i)
        if (sigHashMatch && sigHashMatch[1]) {
          quantity = `#${sigHashMatch[1].trim()}`
          const hashIdx = sigSegment.lastIndexOf('#')
          if (hashIdx !== -1) {
            sigSegment = sigSegment.slice(0, hashIdx).trim()
          }
        }
      }

      let frequency: string | null = null
      let duration: string | null = null
      let instructions: string | null = null

      if (sigSegment) {
        let rem = sigSegment.trim()

        // Extract trailing parenthetical instructions if not a standard frequency code like (BID)
        const trailingParenMatch = rem.match(/^(.*?)\s*\(([^()]+)\)\s*$/)
        if (trailingParenMatch) {
          const beforeParen = (trailingParenMatch[1] || '').trim()
          const insideParen = (trailingParenMatch[2] || '').trim()
          if (beforeParen && !freqCodeRegex.test(insideParen)) {
            instructions = insideParen
            rem = beforeParen
          }
        }

        // Extract "for <duration>" segment
        const forMatch = rem.match(/^(.*?)\s+for\s+(.+)$/i)
        if (forMatch) {
          frequency = (forMatch[1] || '').trim() || null
          duration = (forMatch[2] || '').trim() || null
        } else {
          frequency = rem || null
        }
      }

      items.push({
        medication: cleanMed,
        quantity,
        frequency,
        duration,
        instructions
      })
    }

    return items
  }

  const formatIssuedDate = (dateStr?: string | null): string => {
    if (!dateStr) return 'Recent Consultation'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Recent Consultation'
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const fetchPatientRecords = async () => {
    isLoading.value = true
    try {
      const res = await recordService.getRecords()
      rawRecords.value = (res as any)?.data || res || []
    } catch (e) {
      console.error('Failed to load patient prescription records:', e)
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    fetchPatientRecords()
  })

  watch(
    () => allAppointments.value.length,
    () => {
      fetchPatientRecords()
    }
  )

  const prescriptionsList = computed<PrescriptionRecordEntry[]>(() => {
    const entries: PrescriptionRecordEntry[] = []
    const seenNoteIds = new Set<number>()
    const seenDiagUuids = new Set<string>()

    // 1. From completed diagnostic records
    for (const rec of rawRecords.value) {
      const rxText = (rec?.clinical_note?.prescription || rec?.prescription || '').trim()
      if (!rxText) continue

      const noteId = rec?.clinical_note?.id || null
      const diagUuid = rec?.uuid || null

      if (noteId && seenNoteIds.has(noteId)) continue
      if (diagUuid && seenDiagUuids.has(diagUuid)) continue

      if (noteId) seenNoteIds.add(noteId)
      if (diagUuid) seenDiagUuids.add(diagUuid)

      const doc = rec?.doctor || rec?.clinical_note?.doctor
      const doctorName = doc
        ? `Dr. ${doc.first_name || ''} ${doc.last_name || ''}`.trim()
        : 'Attending Physician'

      const conditionLabel =
        rec?.clinical_note?.final_diagnosis || rec?.label || 'Clinical Consultation'
      const rawDate = rec?.clinical_note?.updated_at || rec?.created_at || ''
      const timestamp = rawDate ? new Date(rawDate).getTime() : 0

      entries.push({
        key: diagUuid || `note-${noteId || entries.length}`,
        noteId,
        diagnosisUuid: diagUuid,
        prescriptionNumber: diagUuid
          ? `RX-${String(diagUuid).slice(0, 8).toUpperCase()}`
          : 'RX-SLIP',
        conditionLabel,
        doctorName,
        dateFormatted: formatIssuedDate(rawDate),
        timestamp: isNaN(timestamp) ? 0 : timestamp,
        rawPrescription: rxText,
        patientEducation: rec?.clinical_note?.patient_education?.trim() || null,
        items: parsePrescriptionText(rxText)
      })
    }

    // 2. Fallback from appointments with clinical notes
    for (const appt of allAppointments.value) {
      const rawAppt = (appt as any)?.raw
      const note = rawAppt?.clinical_note
      const rxText = (note?.prescription || '').trim()
      if (!rxText) continue

      const noteId = note?.id || null
      const diagUuid =
        appt.diagnosis_uuid || rawAppt?.in_clinic_diagnosis?.uuid || note?.diagnosis?.uuid || null

      if (noteId && seenNoteIds.has(noteId)) continue
      if (diagUuid && seenDiagUuids.has(diagUuid)) continue

      if (noteId) seenNoteIds.add(noteId)
      if (diagUuid) seenDiagUuids.add(diagUuid)

      const doc = rawAppt?.doctor
      const doctorName = doc
        ? `Dr. ${doc.first_name || ''} ${doc.last_name || ''}`.trim()
        : appt.doctor || 'Attending Physician'

      const conditionLabel = note?.final_diagnosis || appt.info || 'Clinical Consultation'
      const rawDate = note?.updated_at || appt.completed_at || appt.raw_scheduled_at || ''
      const timestamp = rawDate ? new Date(rawDate).getTime() : 0

      entries.push({
        key: diagUuid || `appt-${appt.id}`,
        noteId,
        diagnosisUuid: diagUuid,
        prescriptionNumber: diagUuid
          ? `RX-${String(diagUuid).slice(0, 8).toUpperCase()}`
          : 'RX-SLIP',
        conditionLabel,
        doctorName,
        dateFormatted: formatIssuedDate(rawDate),
        timestamp: isNaN(timestamp) ? 0 : timestamp,
        rawPrescription: rxText,
        patientEducation: note?.patient_education?.trim() || null,
        items: parsePrescriptionText(rxText)
      })
    }

    return entries.sort((a, b) => b.timestamp - a.timestamp)
  })

  watch(
    () => prescriptionsList.value.length,
    newLen => {
      if (currentIndex.value >= newLen) {
        currentIndex.value = 0
      }
    }
  )

  const activePrescription = computed<PrescriptionRecordEntry | null>(() => {
    return prescriptionsList.value[currentIndex.value] || null
  })

  const handlePrevPrescription = () => {
    if (currentIndex.value > 0) {
      currentIndex.value -= 1
      showPatientEducation.value = false
    }
  }

  const handleNextPrescription = () => {
    if (currentIndex.value < prescriptionsList.value.length - 1) {
      currentIndex.value += 1
      showPatientEducation.value = false
    }
  }

  const togglePatientEducation = () => {
    showPatientEducation.value = !showPatientEducation.value
  }

  const handleOpenRxPad = () => {
    if (!activePrescription.value?.diagnosisUuid) {
      toast.info('Official prescription pad preview requires a linked diagnosis record.')
      return
    }
    showPrescriptionPadModal.value = true
  }

  const handleDownloadRxPdf = async () => {
    const diagUuid = activePrescription.value?.diagnosisUuid
    if (!diagUuid) {
      toast.info('PDF download requires a linked diagnosis record.')
      return
    }

    isDownloadingPdf.value = true
    try {
      const blob = await $api<Blob>(`/diagnoses/${diagUuid}/prescription/pdf`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `prescription-${String(diagUuid).slice(0, 8)}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Prescription PDF downloaded successfully!')
    } catch (err: any) {
      console.error('Failed to download prescription PDF:', err)
      toast.error('Failed to download prescription PDF.')
    } finally {
      isDownloadingPdf.value = false
    }
  }
</script>

<template>
  <div
    class="bg-card border-border flex flex-col justify-between rounded-3xl border p-4 shadow-xs sm:p-5"
  >
    <!-- Header Row -->
    <div class="mb-3 flex items-center justify-between gap-2 sm:mb-4">
      <div class="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <div class="bg-secondary h-6 w-1 shrink-0 rounded-full sm:h-8"></div>
        <div class="flex min-w-0 items-center gap-2">
          <h1 class="text-foreground truncate text-base font-bold sm:text-2xl">Prescriptions</h1>
          <AppBadge
            v-if="prescriptionsList.length > 0"
            color="primary"
            variant="subtle"
            size="xs"
          >
            {{ activePrescription?.items.length || 0 }}
            {{ (activePrescription?.items.length || 0) === 1 ? 'Med' : 'Meds' }}
          </AppBadge>
        </div>
      </div>

      <!-- Multi-Prescription Pager -->
      <div
        v-if="prescriptionsList.length > 1"
        class="flex shrink-0 items-center gap-1"
      >
        <AppButton
          variant="ghost"
          size="unstyled"
          rounded="full"
          :disabled="currentIndex === 0"
          @click="handlePrevPrescription"
          class="flex h-7 w-7 items-center justify-center"
          aria-label="Newer prescription"
        >
          <Icon
            name="lucide:chevron-left"
            class="text-sm"
          />
        </AppButton>
        <span class="text-muted-foreground text-[11px] font-bold">
          {{ currentIndex + 1 }}/{{ prescriptionsList.length }}
        </span>
        <AppButton
          variant="ghost"
          size="unstyled"
          rounded="full"
          :disabled="currentIndex >= prescriptionsList.length - 1"
          @click="handleNextPrescription"
          class="flex h-7 w-7 items-center justify-center"
          aria-label="Older prescription"
        >
          <Icon
            name="lucide:chevron-right"
            class="text-sm"
          />
        </AppButton>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="isLoading"
      class="flex flex-1 flex-col items-center justify-center gap-2 py-8"
    >
      <Icon
        name="lucide:loader-2"
        class="text-primary animate-spin text-2xl"
      />
      <span class="text-muted-foreground text-xs font-medium">Loading prescriptions...</span>
    </div>

    <!-- Active Prescription Content -->
    <div
      v-else-if="activePrescription"
      class="flex min-h-0 flex-1 flex-col justify-between gap-3"
    >
      <!-- Doctor & Condition Metadata Banner -->
      <div
        class="bg-muted/60 border-border/60 flex items-center justify-between gap-2 rounded-2xl border px-3 py-2"
      >
        <div class="flex min-w-0 items-center gap-2">
          <div
            class="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
          >
            <Icon
              name="lucide:stethoscope"
              class="text-sm"
            />
          </div>
          <div class="min-w-0">
            <p class="text-foreground truncate text-xs font-bold">
              {{ activePrescription.doctorName }}
            </p>
            <p class="text-muted-foreground truncate text-[10px] font-medium">
              Issued {{ activePrescription.dateFormatted }} &bull;
              {{ activePrescription.prescriptionNumber }}
            </p>
          </div>
        </div>

        <AppBadge
          v-if="activePrescription.conditionLabel"
          color="primary"
          variant="subtle"
          size="xs"
          class="max-w-[110px] shrink-0 truncate"
        >
          {{ activePrescription.conditionLabel }}
        </AppBadge>
      </div>

      <!-- Scrollable Structured Medications List -->
      <div class="custom-scrollbar flex max-h-60 flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
        <div
          v-for="(item, idx) in activePrescription.items"
          :key="idx"
          class="bg-background/60 border-border hover:border-primary/30 rounded-2xl border p-3 transition-all"
        >
          <!-- Row 1: Medicine + Dosage & Quantity (#) -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex min-w-0 items-start gap-2">
              <div
                class="bg-primary/10 text-primary mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
              >
                <Icon
                  name="lucide:pill"
                  class="text-xs"
                />
              </div>
              <div class="min-w-0">
                <span class="text-muted-foreground block text-[9px] font-bold uppercase">
                  Medicine &amp; Dosage
                </span>
                <p class="text-foreground text-xs leading-snug font-bold">
                  {{ item.medication }}
                </p>
              </div>
            </div>

            <AppBadge
              v-if="item.quantity"
              color="primary"
              variant="solid"
              size="xs"
              rounded="lg"
              :uppercase="false"
              class="shrink-0 font-mono"
            >
              {{ item.quantity }}
            </AppBadge>
          </div>

          <!-- Row 2: Frequency & Duration Grid (matching ClinicalNoteForm inputs) -->
          <div
            v-if="item.frequency || item.duration"
            class="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2"
          >
            <div
              v-if="item.frequency"
              class="bg-card border-border/70 flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5"
            >
              <Icon
                name="lucide:clock"
                class="text-primary shrink-0 text-xs"
              />
              <div class="min-w-0">
                <span class="text-muted-foreground block text-[9px] font-bold uppercase">
                  Frequency
                </span>
                <p class="text-foreground truncate text-[11px] font-semibold">
                  {{ item.frequency }}
                </p>
              </div>
            </div>

            <div
              v-if="item.duration"
              class="bg-card border-border/70 flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5"
            >
              <Icon
                name="lucide:calendar-clock"
                class="text-primary shrink-0 text-xs"
              />
              <div class="min-w-0">
                <span class="text-muted-foreground block text-[9px] font-bold uppercase">
                  Duration
                </span>
                <p class="text-foreground truncate text-[11px] font-semibold">
                  {{ item.duration }}
                </p>
              </div>
            </div>
          </div>

          <!-- Row 3: Special Instructions / Sig -->
          <div
            v-if="item.instructions"
            class="bg-primary/5 border-primary/15 mt-1.5 flex items-start gap-1.5 rounded-xl border px-2.5 py-1.5"
          >
            <Icon
              name="lucide:info"
              class="text-primary mt-0.5 shrink-0 text-xs"
            />
            <div class="min-w-0">
              <span class="text-primary block text-[9px] font-bold uppercase">
                Instructions / Sig
              </span>
              <p class="text-foreground text-[11px] leading-snug font-medium">
                {{ item.instructions }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Collapsible Patient Education Note (if present) -->
      <div
        v-if="activePrescription.patientEducation"
        class="border-border/70 bg-muted/40 rounded-2xl border px-3 py-2"
      >
        <button
          type="button"
          @click="togglePatientEducation"
          class="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
        >
          <div class="flex items-center gap-1.5">
            <Icon
              name="lucide:book-open"
              class="text-primary text-xs"
            />
            <span class="text-foreground text-[11px] font-bold">
              Doctor's Care &amp; Education Notes
            </span>
          </div>
          <Icon
            :name="showPatientEducation ? 'lucide:chevron-up' : 'lucide:chevron-down'"
            class="text-muted-foreground text-xs"
          />
        </button>
        <p
          v-if="showPatientEducation"
          class="text-muted-foreground mt-1.5 border-t pt-1.5 text-[11px] leading-relaxed"
        >
          {{ activePrescription.patientEducation }}
        </p>
      </div>

      <!-- Footer Quick Actions -->
      <div
        v-if="activePrescription.diagnosisUuid"
        class="border-border/60 flex items-center gap-2 border-t pt-2.5"
      >
        <AppButton
          variant="soft"
          size="sm"
          class="flex-1"
          @click="handleOpenRxPad"
        >
          <Icon
            name="lucide:printer"
            class="text-xs"
          />
          <span>View Rx Pad</span>
        </AppButton>

        <AppButton
          variant="solid"
          size="sm"
          class="flex-1"
          :loading="isDownloadingPdf"
          @click="handleDownloadRxPdf"
        >
          <Icon
            v-if="!isDownloadingPdf"
            name="lucide:download"
            class="text-xs"
          />
          <span>Download PDF</span>
        </AppButton>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center text-center"
      :class="props.compactEmpty ? 'py-3' : 'py-6'"
    >
      <div
        class="bg-primary/10 text-primary mb-2 flex h-10 w-10 items-center justify-center rounded-2xl"
      >
        <Icon
          name="lucide:pill"
          class="text-lg"
        />
      </div>
      <h3 class="text-foreground text-xs font-bold sm:text-sm">No Active Prescriptions</h3>
      <p class="text-muted-foreground mt-0.5 max-w-[230px] text-[11px] leading-relaxed">
        Medications and dosage instructions prescribed by your doctor will appear here after your
        consultation.
      </p>
    </div>

    <!-- Official Prescription Pad Modal -->
    <AppPrescriptionPrescriptionPadModal
      v-model="showPrescriptionPadModal"
      :diagnosis-uuid="activePrescription?.diagnosisUuid"
      :allow-edit-credentials="false"
    />
  </div>
</template>
