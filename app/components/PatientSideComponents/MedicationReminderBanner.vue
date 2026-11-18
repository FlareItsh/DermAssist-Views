<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
  import {
    usePrescriptions,
    type PendingTodayMedication,
    type PendingTodayPrescriptionGroup
  } from '~/composables/usePrescriptions'

  const { role: authRole } = useAuth()
  const userRole = computed(() => authRole.value || useCookie('user_role').value || '')
  const { allAppointments } = useAppointments()

  const {
    pendingTodayGroups,
    pendingTodayMedications,
    fetchPrescriptionsAndLogs,
    isMedicationUpdating,
    setMedicationStatus,
    dismissAllPendingForToday
  } = usePrescriptions()

  const isOpen = ref(false)
  const isPinned = ref(false)
  const currentPrescriptionIndex = ref(0)
  const currentMedIndex = ref(0)
  const medTouchStartX = ref(0)
  const bannerRef = ref<HTMLElement | null>(null)

  watch(
    () => pendingTodayGroups.value.length,
    newLen => {
      if (newLen === 0) {
        currentPrescriptionIndex.value = 0
        currentMedIndex.value = 0
        isPinned.value = false
        isOpen.value = false
      } else if (currentPrescriptionIndex.value >= newLen) {
        currentPrescriptionIndex.value = Math.max(0, newLen - 1)
      }
    }
  )

  const activePrescriptionGroup = computed<PendingTodayPrescriptionGroup | null>(() => {
    return pendingTodayGroups.value[currentPrescriptionIndex.value] || null
  })

  watch(
    () => activePrescriptionGroup.value?.prescriptionKey,
    (newKey, oldKey) => {
      if (newKey !== oldKey) {
        currentMedIndex.value = 0
      }
    }
  )

  watch(
    () => activePrescriptionGroup.value?.entries.length ?? 0,
    newLen => {
      if (newLen === 0) {
        currentMedIndex.value = 0
      } else if (currentMedIndex.value >= newLen) {
        currentMedIndex.value = Math.max(0, newLen - 1)
      }
    }
  )

  const activeMedEntry = computed<PendingTodayMedication | null>(() => {
    return activePrescriptionGroup.value?.entries[currentMedIndex.value] || null
  })

  const MAX_VISIBLE_DOTS = 5

  const visibleMedDots = computed(() => {
    const entries = activePrescriptionGroup.value?.entries ?? []
    const total = entries.length
    if (total <= 1) return []

    const activeIdx = currentMedIndex.value
    const start =
      total <= MAX_VISIBLE_DOTS ? 0 : Math.min(Math.max(0, activeIdx - 2), total - MAX_VISIBLE_DOTS)
    const end = Math.min(total, start + MAX_VISIBLE_DOTS)

    return entries.slice(start, end).map((medEntry, offset) => {
      const realIndex = start + offset
      const isLeftEdgeOverflow = offset === 0 && start > 0
      const isRightEdgeOverflow = offset === end - start - 1 && end < total
      return {
        index: realIndex,
        key: medEntry.item.key,
        isActive: realIndex === activeIdx,
        isEdgeOverflow: (isLeftEdgeOverflow || isRightEdgeOverflow) && realIndex !== activeIdx
      }
    })
  })

  const pinBannerOpen = () => {
    isPinned.value = true
    isOpen.value = true
  }

  const handlePrevPrescription = () => {
    pinBannerOpen()
    if (currentPrescriptionIndex.value > 0) {
      currentPrescriptionIndex.value -= 1
      currentMedIndex.value = 0
    }
  }

  const handleNextPrescription = () => {
    pinBannerOpen()
    if (currentPrescriptionIndex.value < pendingTodayGroups.value.length - 1) {
      currentPrescriptionIndex.value += 1
      currentMedIndex.value = 0
    }
  }

  const handlePrevMed = () => {
    pinBannerOpen()
    if (currentMedIndex.value > 0) {
      currentMedIndex.value -= 1
    }
  }

  const handleNextMed = () => {
    pinBannerOpen()
    const total = activePrescriptionGroup.value?.entries.length ?? 0
    if (currentMedIndex.value < total - 1) {
      currentMedIndex.value += 1
    }
  }

  const handleSelectMed = (idx: number) => {
    pinBannerOpen()
    currentMedIndex.value = idx
  }

  const handleMedTouchStart = (e: TouchEvent) => {
    medTouchStartX.value = e.touches[0]?.clientX ?? 0
  }

  const handleMedTouchEnd = (e: TouchEvent) => {
    const endX = e.changedTouches[0]?.clientX ?? 0
    const deltaX = medTouchStartX.value - endX
    if (Math.abs(deltaX) > 36) {
      if (deltaX > 0) {
        handleNextMed()
      } else {
        handlePrevMed()
      }
    }
  }

  const handleMouseEnter = () => {
    isOpen.value = true
  }

  const handleMouseLeave = () => {
    if (!isPinned.value) {
      isOpen.value = false
    }
  }

  const handleHeaderClick = () => {
    if (isPinned.value) {
      isPinned.value = false
      isOpen.value = false
    } else {
      isPinned.value = true
      isOpen.value = true
    }
  }

  const handleClickOutsideBanner = (event: MouseEvent | TouchEvent) => {
    if (!isOpen.value && !isPinned.value) return
    const target = event.target as Node | null
    if (!target || !target.isConnected) return
    if (bannerRef.value && !bannerRef.value.contains(target)) {
      isPinned.value = false
      isOpen.value = false
    }
  }

  onMounted(() => {
    if (userRole.value === 'patient') {
      fetchPrescriptionsAndLogs()
    }
    document.addEventListener('mousedown', handleClickOutsideBanner)
    document.addEventListener('touchstart', handleClickOutsideBanner, { passive: true })
  })

  onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutsideBanner)
    document.removeEventListener('touchstart', handleClickOutsideBanner)
  })

  watch(
    () => allAppointments.value.length,
    () => {
      if (userRole.value === 'patient') {
        fetchPrescriptionsAndLogs(true)
      }
    }
  )

  const formatDurationLabel = (duration?: string | null): string => {
    if (!duration) return ''
    const trimmed = duration.trim()
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed)
      return `${n} ${n === 1 ? 'day' : 'days'}`
    }
    return trimmed
  }

  const handleMarkTaken = async (entry: PendingTodayMedication) => {
    pinBannerOpen()
    await setMedicationStatus(entry.prescriptionKey, entry.item.key, 'taken', entry.item.medication)
  }

  const handleDismissBanner = async () => {
    if (pendingTodayMedications.value.length === 0) return
    await dismissAllPendingForToday(pendingTodayMedications.value)
  }
</script>

<template>
  <Transition name="med-banner">
    <div
      v-if="userRole === 'patient' && pendingTodayMedications.length > 0"
      class="pointer-events-none fixed top-4 right-0 left-0 z-[60] hidden justify-center px-6 md:flex"
    >
      <div
        ref="bannerRef"
        class="bg-card border-border pointer-events-auto relative w-full max-w-lg rounded-2xl border px-4 py-2.5 shadow-lg"
        role="region"
        aria-label="Daily Medication Reminder"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <!-- Header (Always Visible — Shows Red Dot When Shrunk) -->
        <div
          class="flex cursor-pointer items-center justify-between gap-3 select-none"
          @click="handleHeaderClick"
        >
          <div class="flex min-w-0 items-center gap-2.5">
            <!-- Attention Red Dot (Pulses when shrunk) -->
            <span class="relative flex h-2.5 w-2.5 shrink-0">
              <span
                v-if="!isOpen"
                class="bg-destructive absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              />
              <span class="bg-destructive relative inline-flex h-2.5 w-2.5 rounded-full" />
            </span>

            <h3 class="text-foreground truncate text-xs font-semibold tracking-tight">
              Daily Medication Reminder
            </h3>
            <span class="text-muted-foreground shrink-0 text-xs">
              &middot; {{ pendingTodayMedications.length }} due today
            </span>
          </div>

          <div class="flex shrink-0 items-center gap-1">
            <Icon
              name="lucide:chevron-down"
              class="text-muted-foreground text-xs transition-transform duration-200"
              :class="isOpen ? 'rotate-180' : ''"
            />
            <button
              type="button"
              @click.stop="handleDismissBanner"
              class="text-muted-foreground hover:text-foreground hover:bg-muted -mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
              title="Dismiss reminder for today"
              aria-label="Dismiss reminder for today"
            >
              <Icon
                name="lucide:x"
                class="text-xs"
              />
            </button>
          </div>
        </div>

        <!-- Smooth Normal Collapsible Body -->
        <div
          class="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
          :class="isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
          @mousedown.stop
          @touchstart.stop
        >
          <div
            v-if="activePrescriptionGroup"
            class="overflow-hidden"
          >
            <!-- Compact Prescription Sub-Header & Pager -->
            <div
              class="border-border/60 mt-2.5 flex items-center justify-between gap-2 border-t pt-2.5 pb-2"
            >
              <div class="min-w-0">
                <p class="text-foreground truncate text-xs font-semibold">
                  Prescribed by {{ activePrescriptionGroup.doctorName }}
                </p>
                <p class="text-muted-foreground truncate text-[10px]">
                  Issued {{ activePrescriptionGroup.dateFormatted }} &middot;
                  {{ activePrescriptionGroup.prescriptionNumber }}
                </p>
              </div>

              <div class="flex shrink-0 items-center gap-1.5">
                <span
                  v-if="activePrescriptionGroup.conditionLabel"
                  class="bg-muted text-muted-foreground max-w-[110px] shrink-0 truncate rounded-md px-2 py-0.5 text-[10px] font-medium"
                >
                  {{ activePrescriptionGroup.conditionLabel }}
                </span>

                <div
                  v-if="pendingTodayGroups.length > 1"
                  class="flex shrink-0 items-center gap-1"
                >
                  <AppButton
                    variant="ghost"
                    size="unstyled"
                    rounded="full"
                    :disabled="currentPrescriptionIndex === 0"
                    @click.stop="handlePrevPrescription"
                    class="flex h-6 w-6 items-center justify-center"
                    aria-label="Newer prescription"
                  >
                    <Icon
                      name="lucide:chevron-left"
                      class="text-sm"
                    />
                  </AppButton>
                  <span class="text-muted-foreground text-[11px] font-semibold">
                    {{ currentPrescriptionIndex + 1 }}/{{ pendingTodayGroups.length }}
                  </span>
                  <AppButton
                    variant="ghost"
                    size="unstyled"
                    rounded="full"
                    :disabled="currentPrescriptionIndex >= pendingTodayGroups.length - 1"
                    @click.stop="handleNextPrescription"
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
            </div>

            <div
              class="border-border/60 border-t pt-2.5"
              @touchstart.passive="handleMedTouchStart"
              @touchend.passive="handleMedTouchEnd"
            >
              <Transition
                name="med-slide"
                mode="out-in"
              >
                <div
                  v-if="activeMedEntry"
                  :key="`${activeMedEntry.prescriptionKey}-${activeMedEntry.item.key}`"
                  class="flex flex-col"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p class="text-foreground text-sm leading-snug font-bold">
                          {{ activeMedEntry.item.medication }}
                        </p>
                        <span
                          v-if="activeMedEntry.item.quantity"
                          class="text-muted-foreground text-xs font-medium"
                        >
                          {{ activeMedEntry.item.quantity }}
                        </span>
                      </div>

                      <p
                        v-if="activeMedEntry.item.frequency || activeMedEntry.item.duration"
                        class="text-muted-foreground mt-0.5 text-xs leading-snug"
                      >
                        <span v-if="activeMedEntry.item.frequency">{{
                          activeMedEntry.item.frequency
                        }}</span>
                        <span v-if="activeMedEntry.item.frequency && activeMedEntry.item.duration">
                          &middot;
                        </span>
                        <span v-if="activeMedEntry.item.duration">{{
                          formatDurationLabel(activeMedEntry.item.duration)
                        }}</span>
                      </p>
                    </div>

                    <div class="flex shrink-0 items-center">
                      <AppButton
                        variant="solid"
                        size="sm"
                        :loading="
                          isMedicationUpdating(
                            activeMedEntry.prescriptionKey,
                            activeMedEntry.item.key
                          )
                        "
                        @click.stop="handleMarkTaken(activeMedEntry)"
                        class="!h-8 !rounded-lg !px-3 !text-xs"
                      >
                        <span>Mark as taken</span>
                      </AppButton>
                    </div>
                  </div>

                  <div
                    v-if="activeMedEntry.item.instructions"
                    class="border-primary bg-muted/60 mt-2 w-full rounded-r-md border-l-2 px-2.5 py-1.5"
                  >
                    <div class="custom-scrollbar max-h-16 overflow-x-hidden overflow-y-auto pr-1">
                      <p class="text-foreground text-xs leading-snug font-medium break-words">
                        <span class="text-primary font-semibold">Doctor's instruction:</span>
                        {{ activeMedEntry.item.instructions }}
                      </p>
                    </div>
                  </div>
                </div>
              </Transition>

              <!-- Medicine Dot Pagination (Hidden when only 1 medicine remains in this prescription) -->
              <div
                v-if="activePrescriptionGroup.entries.length > 1"
                class="mt-2.5 flex items-center justify-center gap-2 pt-0.5"
              >
                <button
                  type="button"
                  :disabled="currentMedIndex === 0"
                  @click.stop="handlePrevMed"
                  class="text-muted-foreground hover:text-foreground flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-30"
                  aria-label="Previous medicine"
                >
                  <Icon
                    name="lucide:chevron-left"
                    class="text-xs"
                  />
                </button>

                <div class="flex items-center gap-1.5">
                  <button
                    v-for="dot in visibleMedDots"
                    :key="dot.key"
                    type="button"
                    @click.stop="handleSelectMed(dot.index)"
                    :aria-label="`Go to medicine ${dot.index + 1}`"
                    class="cursor-pointer rounded-full transition-all duration-200"
                    :class="
                      dot.isActive
                        ? 'bg-primary h-2 w-2 scale-110'
                        : dot.isEdgeOverflow
                          ? 'bg-muted-foreground/25 hover:bg-muted-foreground/45 h-1.5 w-1.5'
                          : 'bg-muted-foreground/30 hover:bg-muted-foreground/50 h-2 w-2'
                    "
                  />
                </div>

                <button
                  type="button"
                  :disabled="currentMedIndex >= activePrescriptionGroup.entries.length - 1"
                  @click.stop="handleNextMed"
                  class="text-muted-foreground hover:text-foreground flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-30"
                  aria-label="Next medicine"
                >
                  <Icon
                    name="lucide:chevron-right"
                    class="text-xs"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
  .med-banner-enter-active,
  .med-banner-leave-active {
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .med-banner-enter-from,
  .med-banner-leave-to {
    opacity: 0;
    transform: translateY(-12px) scale(0.98);
  }

  .med-slide-enter-active,
  .med-slide-leave-active {
    transition:
      opacity 0.16s ease,
      transform 0.16s ease;
  }

  .med-slide-enter-from {
    opacity: 0;
    transform: translateX(8px);
  }

  .med-slide-leave-to {
    opacity: 0;
    transform: translateX(-8px);
  }
</style>
