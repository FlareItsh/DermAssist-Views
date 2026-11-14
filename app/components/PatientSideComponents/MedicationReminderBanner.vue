<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
  import { usePrescriptions, type PendingTodayMedication } from '~/composables/usePrescriptions'

  const { role: authRole } = useAuth()
  const userRole = computed(() => authRole.value || useCookie('user_role').value || '')
  const { allAppointments } = useAppointments()

  const {
    pendingTodayMedications,
    fetchPrescriptionsAndLogs,
    isMedicationUpdating,
    setMedicationStatus,
    dismissAllPendingForToday
  } = usePrescriptions()

  const isOpen = ref(false)
  const isPinned = ref(false)
  const bannerRef = ref<HTMLElement | null>(null)

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
    if (bannerRef.value && target && !bannerRef.value.contains(target)) {
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
        >
          <div class="overflow-hidden">
            <div
              class="border-border/60 custom-scrollbar divide-border/60 mt-2.5 flex max-h-56 flex-col divide-y overflow-y-auto border-t pt-2.5"
            >
              <div
                v-for="entry in pendingTodayMedications"
                :key="`${entry.prescriptionKey}-${entry.item.key}`"
                class="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p class="text-foreground text-sm font-bold">
                      {{ entry.item.medication }}
                    </p>
                    <span
                      v-if="entry.item.quantity"
                      class="text-muted-foreground text-xs font-medium"
                    >
                      {{ entry.item.quantity }}
                    </span>
                  </div>

                  <p
                    v-if="entry.item.frequency || entry.item.duration"
                    class="text-muted-foreground mt-0.5 text-xs leading-snug"
                  >
                    <span v-if="entry.item.frequency">{{ entry.item.frequency }}</span>
                    <span v-if="entry.item.frequency && entry.item.duration"> &middot; </span>
                    <span v-if="entry.item.duration">{{
                      formatDurationLabel(entry.item.duration)
                    }}</span>
                  </p>

                  <div
                    v-if="entry.item.instructions"
                    class="border-primary bg-muted/60 mt-1.5 rounded-r-md border-l-2 px-2.5 py-1"
                  >
                    <div class="custom-scrollbar max-h-16 overflow-x-hidden overflow-y-auto pr-1">
                      <p class="text-foreground text-xs leading-snug font-medium break-words">
                        <span class="text-primary font-semibold">Doctor's instruction:</span>
                        {{ entry.item.instructions }}
                      </p>
                    </div>
                  </div>

                  <p class="text-muted-foreground mt-1 text-[11px]">
                    Prescribed by {{ entry.doctorName }}
                  </p>
                </div>

                <div class="flex shrink-0 items-center">
                  <AppButton
                    variant="solid"
                    size="sm"
                    :loading="isMedicationUpdating(entry.prescriptionKey, entry.item.key)"
                    @click.stop="handleMarkTaken(entry)"
                    class="!h-8 !rounded-lg !px-3 !text-xs"
                  >
                    <span>Mark as taken</span>
                  </AppButton>
                </div>
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
</style>
