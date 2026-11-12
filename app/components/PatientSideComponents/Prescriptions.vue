<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { toast } from 'vue-sonner'
  import { $api } from '~/composables/useApi'
  import {
    usePrescriptions,
    type ParsedMedicationItem,
    type PrescriptionRecordEntry
  } from '~/composables/usePrescriptions'

  interface Props {
    compactEmpty?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    compactEmpty: false
  })

  const { allAppointments } = useAppointments()
  const {
    prescriptionsList,
    isLoading,
    fetchPrescriptionsAndLogs,
    getMedicationStatus,
    isMedicationUpdating,
    setMedicationStatus
  } = usePrescriptions()

  const currentIndex = ref(0)
  const showPatientEducation = ref(false)
  const showPrescriptionPadModal = ref(false)
  const isDownloadingPdf = ref(false)

  onMounted(() => {
    fetchPrescriptionsAndLogs()
  })

  watch(
    () => allAppointments.value.length,
    () => {
      fetchPrescriptionsAndLogs(true)
    }
  )

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

  // Shows the blue shadow when there is an active prescription with at least one medication
  // not yet marked "taken" today (persists even when X / dismissed is clicked on the top banner).
  const hasUntakenMedicationsToday = computed<boolean>(() => {
    if (!activePrescription.value) return false
    const rxKey = activePrescription.value.key
    const activeItems = activePrescription.value.items.filter(item => !item.isExpired)
    if (activeItems.length === 0) return false
    return activeItems.some(item => getMedicationStatus(rxKey, item.key) !== 'taken')
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

  const handleToggleMedicationTaken = async (item: ParsedMedicationItem) => {
    if (!activePrescription.value) return
    const rxKey = activePrescription.value.key
    const currentStatus = getMedicationStatus(rxKey, item.key)
    const nextStatus = currentStatus === 'taken' ? 'pending' : 'taken'
    await setMedicationStatus(rxKey, item.key, nextStatus, item.medication)
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
    class="bg-card flex flex-col justify-between rounded-3xl border p-4 transition-all duration-300 sm:p-5"
    :class="
      hasUntakenMedicationsToday
        ? 'border-primary/60 ring-primary/25 shadow-[0_0_25px_rgba(37,99,235,0.45)] ring-2'
        : 'border-border shadow-xs'
    "
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
      <div class="custom-scrollbar flex max-h-64 flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
        <div
          v-for="(item, idx) in activePrescription.items"
          :key="item.key || idx"
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

          <!-- Row 4: Daily Adherence Status & Editable Toggle -->
          <div
            class="border-border/60 mt-2.5 flex items-center justify-between gap-2 border-t pt-2"
          >
            <template v-if="getMedicationStatus(activePrescription.key, item.key) === 'taken'">
              <AppBadge
                color="success"
                variant="subtle"
                size="xs"
                :uppercase="false"
              >
                <template #leading>
                  <Icon
                    name="lucide:check-circle-2"
                    class="text-xs"
                  />
                </template>
                Taken Today
              </AppBadge>

              <button
                type="button"
                :disabled="isMedicationUpdating(activePrescription.key, item.key)"
                @click="handleToggleMedicationTaken(item)"
                class="text-muted-foreground hover:text-foreground cursor-pointer text-[11px] font-semibold underline-offset-2 hover:underline disabled:opacity-50"
              >
                Undo
              </button>
            </template>

            <template v-else>
              <div class="flex min-w-0 items-center gap-1.5">
                <AppBadge
                  v-if="item.isExpired"
                  color="gray"
                  variant="subtle"
                  size="xs"
                  :uppercase="false"
                >
                  Duration Completed
                </AppBadge>
                <span
                  v-else-if="getMedicationStatus(activePrescription.key, item.key) === 'dismissed'"
                  class="text-muted-foreground truncate text-[11px] font-medium"
                >
                  Reminder dismissed today
                </span>
                <span
                  v-else
                  class="text-muted-foreground truncate text-[11px] font-medium"
                >
                  Not taken yet today
                </span>
              </div>

              <AppButton
                variant="soft"
                size="sm"
                :loading="isMedicationUpdating(activePrescription.key, item.key)"
                @click="handleToggleMedicationTaken(item)"
              >
                <Icon
                  v-if="!isMedicationUpdating(activePrescription.key, item.key)"
                  name="lucide:check"
                  class="text-xs"
                />
                <span>Taken</span>
              </AppButton>
            </template>
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
