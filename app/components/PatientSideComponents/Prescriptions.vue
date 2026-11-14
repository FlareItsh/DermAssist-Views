<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
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

  // Tracks which medication instruction boxes overflow their container height
  const overflowingInstructionKeys = ref<Record<string, boolean>>({})
  const expandedInstructionItem = ref<ParsedMedicationItem | null>(null)
  const expandedOverlayRef = ref<HTMLElement | null>(null)
  const instructionScrollEls = new Map<string, HTMLElement>()
  let instructionResizeObserver: ResizeObserver | null = null

  const checkInstructionOverflows = () => {
    let changed = false
    const nextMap: Record<string, boolean> = { ...overflowingInstructionKeys.value }
    for (const [key, el] of instructionScrollEls.entries()) {
      if (el) {
        const isOverflowing = el.scrollHeight > el.clientHeight + 1
        if (Boolean(nextMap[key]) !== isOverflowing) {
          nextMap[key] = isOverflowing
          changed = true
        }
      }
    }
    if (changed) {
      overflowingInstructionKeys.value = nextMap
    }
  }

  const registerInstructionEl = (key: string, el: HTMLElement | null) => {
    const prev = instructionScrollEls.get(key)
    if (prev === el) return
    if (prev && instructionResizeObserver) {
      instructionResizeObserver.unobserve(prev)
    }
    if (el) {
      instructionScrollEls.set(key, el)
      if (instructionResizeObserver) {
        instructionResizeObserver.observe(el)
      }
      nextTick(checkInstructionOverflows)
    } else {
      instructionScrollEls.delete(key)
    }
  }

  const isInstructionScrollable = (key: string): boolean => {
    return Boolean(overflowingInstructionKeys.value[key])
  }

  const handleInstructionClick = (item: ParsedMedicationItem) => {
    if (!isInstructionScrollable(item.key)) return
    expandedInstructionItem.value = item
  }

  const closeExpandedInstruction = () => {
    expandedInstructionItem.value = null
  }

  const handleClickOutsideInstruction = (event: MouseEvent | TouchEvent) => {
    if (!expandedInstructionItem.value) return
    const target = event.target as Node | null
    if (expandedOverlayRef.value && target && !expandedOverlayRef.value.contains(target)) {
      expandedInstructionItem.value = null
    }
  }

  onMounted(() => {
    fetchPrescriptionsAndLogs()
    if (typeof ResizeObserver !== 'undefined') {
      instructionResizeObserver = new ResizeObserver(() => {
        checkInstructionOverflows()
      })
      for (const el of instructionScrollEls.values()) {
        instructionResizeObserver.observe(el)
      }
    }
    nextTick(checkInstructionOverflows)
    document.addEventListener('mousedown', handleClickOutsideInstruction)
    document.addEventListener('touchstart', handleClickOutsideInstruction, { passive: true })
  })

  onUnmounted(() => {
    if (instructionResizeObserver) {
      instructionResizeObserver.disconnect()
      instructionResizeObserver = null
    }
    instructionScrollEls.clear()
    document.removeEventListener('mousedown', handleClickOutsideInstruction)
    document.removeEventListener('touchstart', handleClickOutsideInstruction)
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

  watch(
    activePrescription,
    () => {
      expandedInstructionItem.value = null
      nextTick(checkInstructionOverflows)
    },
    { deep: true }
  )

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

  const formatDurationLabel = (duration?: string | null): string => {
    if (!duration) return ''
    const trimmed = duration.trim()
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed)
      return `${n} ${n === 1 ? 'day' : 'days'}`
    }
    return trimmed
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
    class="bg-card flex min-h-0 flex-col justify-between overflow-hidden rounded-3xl border p-3.5 transition-all duration-300 sm:p-4"
    :class="
      hasUntakenMedicationsToday
        ? 'border-primary/60 ring-primary/25 shadow-[0_0_25px_rgba(37,99,235,0.45)] ring-2'
        : 'border-border shadow-xs'
    "
  >
    <!-- Header Row -->
    <div class="mb-2 flex shrink-0 items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <div class="bg-secondary h-6 w-1 shrink-0 rounded-full sm:h-7"></div>
        <div class="flex min-w-0 items-baseline gap-2">
          <h1 class="text-foreground truncate text-base font-bold sm:text-xl">Prescriptions</h1>
          <span
            v-if="prescriptionsList.length > 0 && activePrescription"
            class="text-muted-foreground shrink-0 text-xs font-medium"
          >
            {{ activePrescription.items.length }}
            {{ activePrescription.items.length === 1 ? 'medication' : 'medications' }}
          </span>
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
          class="flex h-6 w-6 items-center justify-center"
          aria-label="Newer prescription"
        >
          <Icon
            name="lucide:chevron-left"
            class="text-sm"
          />
        </AppButton>
        <span class="text-muted-foreground text-[11px] font-semibold">
          {{ currentIndex + 1 }}/{{ prescriptionsList.length }}
        </span>
        <AppButton
          variant="ghost"
          size="unstyled"
          rounded="full"
          :disabled="currentIndex >= prescriptionsList.length - 1"
          @click="handleNextPrescription"
          class="flex h-6 w-6 items-center justify-center"
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
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-4"
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
      class="relative flex min-h-0 flex-1 flex-col justify-between gap-2"
    >
      <!-- Prescribing Doctor & Issue Date Metadata -->
      <div class="border-border/70 flex shrink-0 items-center justify-between gap-2 border-b pb-2">
        <div class="min-w-0">
          <p class="text-foreground truncate text-xs font-semibold">
            Prescribed by {{ activePrescription.doctorName }}
          </p>
          <p class="text-muted-foreground truncate text-[10px]">
            Issued {{ activePrescription.dateFormatted }} &middot;
            {{ activePrescription.prescriptionNumber }}
          </p>
        </div>

        <span
          v-if="activePrescription.conditionLabel"
          class="bg-muted text-muted-foreground max-w-[110px] shrink-0 truncate rounded-md px-2 py-0.5 text-[10px] font-medium"
        >
          {{ activePrescription.conditionLabel }}
        </span>
      </div>

      <!-- Medications List (Non-scrollable container; fills whole card, only instruction text scrolls if long) -->
      <div class="divide-border/70 flex min-h-0 flex-1 flex-col divide-y">
        <div
          v-for="(item, idx) in activePrescription.items"
          :key="item.key || idx"
          class="flex min-h-0 flex-1 flex-col py-2 first:pt-1 last:pb-0"
        >
          <!-- Row 1: Medication Name + Quantity & Mark as taken button -->
          <div class="flex shrink-0 items-start justify-between gap-2.5">
            <div class="min-w-0 flex-1">
              <span class="text-muted-foreground block text-[10px] font-semibold uppercase">
                Medication &amp; Dosage
              </span>
              <div class="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p class="text-foreground text-sm leading-snug font-bold break-words">
                  {{ item.medication }}
                </p>
                <span
                  v-if="item.quantity"
                  class="bg-muted text-foreground/80 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                >
                  {{ item.quantity }}
                </span>
              </div>
            </div>

            <!-- Action: Mark as taken / Taken today (padded top-right so red dot is never clipped) -->
            <div class="shrink-0 pt-1 pr-1">
              <button
                v-if="getMedicationStatus(activePrescription.key, item.key) === 'taken'"
                type="button"
                :disabled="isMedicationUpdating(activePrescription.key, item.key)"
                @click="handleToggleMedicationTaken(item)"
                title="Click to undo"
                class="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100/80 disabled:opacity-50"
              >
                <Icon
                  name="lucide:check"
                  class="text-xs"
                />
                <span>Taken today</span>
              </button>

              <div
                v-else
                class="relative inline-flex"
              >
                <AppButton
                  variant="soft"
                  size="sm"
                  :loading="isMedicationUpdating(activePrescription.key, item.key)"
                  @click="handleToggleMedicationTaken(item)"
                  class="!h-7 !rounded-lg !px-2.5 !py-1 !text-[11px]"
                >
                  <span>Mark as taken</span>
                </AppButton>
                <span
                  v-if="!item.isExpired"
                  class="pointer-events-none absolute -top-1 -right-1 flex h-2.5 w-2.5"
                >
                  <span
                    class="bg-destructive absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  />
                  <span
                    class="bg-destructive ring-card relative inline-flex h-2.5 w-2.5 rounded-full ring-2"
                  />
                </span>
              </div>
            </div>
          </div>

          <!-- Row 2: Structured Schedule Summary (Frequency & Duration) -->
          <div
            v-if="item.frequency || item.duration"
            class="border-border/60 bg-muted/30 mt-2.5 grid shrink-0 grid-cols-2 gap-2 rounded-xl border px-3 py-2"
          >
            <div class="min-w-0">
              <span class="text-muted-foreground block text-[10px] font-semibold uppercase">
                Frequency
              </span>
              <p class="text-foreground mt-0.5 text-xs leading-snug font-semibold break-words">
                {{ item.frequency || 'As directed' }}
              </p>
            </div>
            <div class="border-border/60 min-w-0 border-l pl-2.5">
              <span class="text-muted-foreground block text-[10px] font-semibold uppercase">
                Duration
              </span>
              <p class="text-foreground mt-0.5 text-xs leading-snug font-semibold break-words">
                {{ item.duration ? formatDurationLabel(item.duration) : 'As prescribed' }}
              </p>
            </div>
          </div>

          <!-- Row 3: Distinguishable Doctor's Instruction (Expands to fill remaining card space; scrolls only inside text area) -->
          <div
            class="border-primary bg-muted/50 mt-2.5 flex min-h-0 flex-1 flex-col rounded-r-xl border-l-2 px-3 py-2 transition-colors"
            :class="isInstructionScrollable(item.key) ? 'hover:bg-muted/80 cursor-pointer' : ''"
            :title="isInstructionScrollable(item.key) ? 'Click to expand instruction' : undefined"
            @click.stop="handleInstructionClick(item)"
          >
            <div class="flex shrink-0 items-center justify-between gap-2">
              <span class="text-primary text-[10px] font-bold tracking-wide uppercase">
                Doctor's Instruction
              </span>
              <span
                v-if="isInstructionScrollable(item.key)"
                class="text-muted-foreground flex items-center gap-1 text-[10px] font-medium"
              >
                <Icon
                  name="lucide:maximize-2"
                  class="text-[10px]"
                />
              </span>
            </div>
            <div
              :ref="el => registerInstructionEl(item.key, el as HTMLElement | null)"
              class="custom-scrollbar mt-1 max-h-24 min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-1 md:max-h-none"
            >
              <p class="text-foreground text-xs leading-relaxed font-medium break-words">
                {{ item.instructions || 'Follow the prescribed dosage schedule above.' }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Expanded Doctor's Instruction Overlay (Covers Upper Components When Clicked) -->
      <Transition name="instruction-overlay">
        <div
          v-if="expandedInstructionItem"
          ref="expandedOverlayRef"
          class="bg-card border-border/80 absolute inset-0 z-20 flex flex-col rounded-2xl border p-3 shadow-lg"
        >
          <div
            class="border-border/60 flex shrink-0 items-center justify-between gap-2 border-b pb-2"
          >
            <div class="min-w-0">
              <span class="text-primary block text-[10px] font-bold tracking-wide uppercase">
                Doctor's Instruction
              </span>
              <p class="text-foreground truncate text-xs font-bold">
                {{ expandedInstructionItem.medication }}
              </p>
            </div>
            <button
              type="button"
              @click.stop="closeExpandedInstruction"
              class="text-muted-foreground hover:text-foreground hover:bg-muted flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
              title="Collapse instruction"
              aria-label="Collapse instruction"
            >
              <Icon
                name="lucide:minimize-2"
                class="text-xs"
              />
            </button>
          </div>

          <div
            class="border-primary bg-muted/50 mt-2.5 flex min-h-0 flex-1 flex-col rounded-r-xl border-l-2 px-3 py-2.5"
          >
            <div class="custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-1">
              <p class="text-foreground text-xs leading-relaxed font-medium break-words">
                {{
                  expandedInstructionItem.instructions ||
                  'Follow the prescribed dosage schedule above.'
                }}
              </p>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Collapsible Patient Education Note (if present) -->
      <div
        v-if="activePrescription.patientEducation"
        class="border-border/70 bg-muted/30 shrink-0 rounded-xl border px-2.5 py-1.5"
      >
        <button
          type="button"
          @click="togglePatientEducation"
          class="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
        >
          <span class="text-foreground text-[11px] font-semibold">
            Doctor's Care &amp; Education Notes
          </span>
          <Icon
            :name="showPatientEducation ? 'lucide:chevron-up' : 'lucide:chevron-down'"
            class="text-muted-foreground text-xs"
          />
        </button>
        <p
          v-if="showPatientEducation"
          class="text-muted-foreground custom-scrollbar mt-1 max-h-12 overflow-x-hidden overflow-y-auto border-t pt-1 pr-1 text-[11px] leading-relaxed break-words"
        >
          {{ activePrescription.patientEducation }}
        </p>
      </div>

      <!-- Footer Quick Actions -->
      <div
        v-if="activePrescription.diagnosisUuid"
        class="border-border/60 flex shrink-0 items-center gap-2 border-t px-1 pt-2.5 pb-1"
      >
        <AppButton
          variant="soft"
          size="sm"
          class="!h-7 flex-1 !text-[11px]"
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
          class="!h-7 flex-1 !text-[11px]"
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
    <AppPrescriptionPadModal
      v-model="showPrescriptionPadModal"
      :diagnosis-uuid="activePrescription?.diagnosisUuid"
      :allow-edit-credentials="false"
    />
  </div>
</template>

<style scoped>
  .instruction-overlay-enter-active,
  .instruction-overlay-leave-active {
    transform-origin: bottom center;
    transition:
      opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .instruction-overlay-enter-from,
  .instruction-overlay-leave-to {
    opacity: 0;
    transform: translateY(10px) scaleY(0.94);
  }
</style>
