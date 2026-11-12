<script setup lang="ts">
  import { onMounted, watch } from 'vue'
  import { usePrescriptions, type PendingTodayMedication } from '~/composables/usePrescriptions'

  const userRole = useCookie('user_role')
  const { allAppointments } = useAppointments()

  const {
    pendingTodayMedications,
    fetchPrescriptionsAndLogs,
    isMedicationUpdating,
    setMedicationStatus,
    dismissAllPendingForToday
  } = usePrescriptions()

  onMounted(() => {
    if (userRole.value === 'patient') {
      fetchPrescriptionsAndLogs()
    }
  })

  watch(
    () => allAppointments.value.length,
    () => {
      if (userRole.value === 'patient') {
        fetchPrescriptionsAndLogs(true)
      }
    }
  )

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
      class="pointer-events-none fixed top-[80px] right-0 left-0 z-[60] flex justify-center px-3 md:top-4 md:px-6"
    >
      <div
        class="bg-card/95 border-primary/25 pointer-events-auto relative w-full max-w-xl overflow-hidden rounded-2xl border p-3.5 shadow-xl backdrop-blur-md sm:p-4"
        role="region"
        aria-label="Daily Medication Reminder"
      >
        <!-- Lowkey X button at the side of the modal -->
        <button
          type="button"
          @click="handleDismissBanner"
          class="text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 absolute top-2.5 right-2.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-colors"
          title="Dismiss reminder for today"
          aria-label="Dismiss reminder for today"
        >
          <Icon
            name="lucide:x"
            class="text-xs"
          />
        </button>

        <!-- Header -->
        <div class="mb-2.5 flex items-center gap-2.5 pr-6">
          <div
            class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          >
            <Icon
              name="lucide:pill"
              class="text-base"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-foreground truncate text-xs font-bold sm:text-sm">
                Daily Medication Reminder
              </h3>
              <AppBadge
                color="primary"
                variant="subtle"
                size="xs"
              >
                {{ pendingTodayMedications.length }}
                {{ pendingTodayMedications.length === 1 ? 'Med Due' : 'Meds Due' }}
              </AppBadge>
            </div>
            <p class="text-muted-foreground truncate text-[11px]">
              Prescribed by {{ pendingTodayMedications[0]?.doctorName }} &bull; Mark once taken
              today
            </p>
          </div>
        </div>

        <!-- Medications Due List -->
        <div class="custom-scrollbar flex max-h-44 flex-col gap-2 overflow-y-auto pr-0.5">
          <div
            v-for="entry in pendingTodayMedications"
            :key="`${entry.prescriptionKey}-${entry.item.key}`"
            class="bg-background/70 border-border/80 flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <p class="text-foreground truncate text-xs font-bold">
                  {{ entry.item.medication }}
                </p>
                <span
                  v-if="entry.item.quantity"
                  class="text-primary shrink-0 font-mono text-[10px] font-bold"
                >
                  {{ entry.item.quantity }}
                </span>
              </div>
              <p
                v-if="entry.item.frequency || entry.item.duration || entry.item.instructions"
                class="text-muted-foreground truncate text-[11px]"
              >
                <span v-if="entry.item.frequency">{{ entry.item.frequency }}</span>
                <span v-if="entry.item.frequency && entry.item.duration"> &bull; </span>
                <span v-if="entry.item.duration">{{ entry.item.duration }}</span>
                <span
                  v-if="(entry.item.frequency || entry.item.duration) && entry.item.instructions"
                >
                  &bull;
                </span>
                <span v-if="entry.item.instructions">{{ entry.item.instructions }}</span>
              </p>
            </div>

            <div class="flex shrink-0 items-center">
              <AppButton
                variant="solid"
                size="sm"
                :loading="isMedicationUpdating(entry.prescriptionKey, entry.item.key)"
                @click="handleMarkTaken(entry)"
              >
                <Icon
                  v-if="!isMedicationUpdating(entry.prescriptionKey, entry.item.key)"
                  name="lucide:check"
                  class="text-xs"
                />
                <span>Taken</span>
              </AppButton>
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
