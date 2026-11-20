<script setup lang="ts">
  import { useDoctorSubscription } from '~/composables/useDoctorSubscription'

  interface Props {
    modelValue: boolean
  }

  defineProps<Props>()

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
  }>()

  const { planName, isSecretary, attendingDoctorName } = useDoctorSubscription()

  const handleClose = () => {
    emit('update:modelValue', false)
  }

  const goToSubscription = () => {
    emit('update:modelValue', false)
    navigateTo('/doctor/subscription')
  }
</script>

<template>
  <AppModal
    :model-value="modelValue"
    size="md"
    compact
    hide-close-button
    @update:model-value="emit('update:modelValue', $event)"
    @close="handleClose"
  >
    <!-- Modal Content Card -->
    <div class="relative -m-4 sm:-m-6 bg-white p-5 sm:p-7 text-gray-900">
      <!-- Close Button -->
      <button
        type="button"
        @click="handleClose"
        class="absolute top-4 right-4 sm:top-5 sm:right-5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        aria-label="Close modal"
      >
        <Icon
          name="heroicons:x-mark"
          class="h-5 w-5"
        />
      </button>

      <!-- Header Section -->
      <div class="flex items-start gap-3.5 pr-7">
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 shadow-xs"
        >
          <Icon
            name="solar:document-medicine-bold"
            class="h-6 w-6 text-primary"
          />
        </div>
        <div class="min-w-0 flex-1">
          <div
            class="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase"
          >
            <Icon
              name="lucide:sparkles"
              class="h-3 w-3 text-primary"
            />
            <span>Pro Feature</span>
          </div>
          <h3 class="mt-1 text-base font-bold leading-tight text-gray-900 sm:text-lg">
            Unlock PDF Clinical Reports
          </h3>
          <p
            v-if="isSecretary"
            class="mt-1 text-xs leading-relaxed text-gray-600"
          >
            Clinical PDF report exports are not included in your attending physician's current
            subscription. Your doctor needs to upgrade their plan to unlock PDF exports.
          </p>
          <p
            v-else
            class="mt-1 text-xs leading-relaxed text-gray-600"
          >
            Clinical PDF report exports are reserved for upgraded plans. Upgrade to generate,
            download, and print official documentation.
          </p>
        </div>
      </div>

      <!-- Feature Value Highlights -->
      <div class="mt-5 space-y-2.5">
        <div
          class="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3 transition-colors hover:bg-gray-50"
        >
          <div
            class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100/70 text-indigo-700"
          >
            <Icon
              name="solar:clipboard-check-bold"
              class="h-4 w-4"
            />
          </div>
          <div class="min-w-0 flex-1">
            <h4 class="text-xs font-bold text-gray-900">Complete Clinical Assessment</h4>
            <p class="mt-0.5 text-[11px] leading-relaxed text-gray-600">
              Detailed AI differential diagnosis, probability breakdown, doctor notes, and care
              guidelines in hospital A4 layout.
            </p>
          </div>
        </div>

        <div
          class="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3 transition-colors hover:bg-gray-50"
        >
          <div
            class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100/70 text-emerald-700"
          >
            <Icon
              name="solar:shield-check-bold"
              class="h-4 w-4"
            />
          </div>
          <div class="min-w-0 flex-1">
            <h4 class="text-xs font-bold text-gray-900">Physician Verification & Letterhead</h4>
            <p class="mt-0.5 text-[11px] leading-relaxed text-gray-600">
              Features clinic branding, PTR number, digital physician signature, and structured
              pharmacy prescription tables.
            </p>
          </div>
        </div>

        <div
          class="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3 transition-colors hover:bg-gray-50"
        >
          <div
            class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100/70 text-blue-700"
          >
            <Icon
              name="solar:printer-bold"
              class="h-4 w-4"
            />
          </div>
          <div class="min-w-0 flex-1">
            <h4 class="text-xs font-bold text-gray-900">Archival & Patient Portability</h4>
            <p class="mt-0.5 text-[11px] leading-relaxed text-gray-600">
              Provide patients with verifiable medical printouts or save digital PDF records to
              your clinical archive.
            </p>
          </div>
        </div>
      </div>

      <!-- Current Plan Status Row -->
      <div
        class="mt-4 flex items-center justify-between rounded-xl border border-gray-200/80 bg-gray-50/90 px-3.5 py-2.5 text-xs"
      >
        <div class="flex min-w-0 items-center gap-2">
          <span class="shrink-0 font-medium text-gray-500">
            {{ isSecretary ? "Doctor's Plan:" : 'Current Plan:' }}
          </span>
          <span class="truncate font-bold text-gray-900">
            {{
              isSecretary && attendingDoctorName
                ? `${attendingDoctorName} (${planName || 'Basic'})`
                : planName || 'Free / Unsubscribed'
            }}
          </span>
        </div>
        <span
          v-if="isSecretary"
          class="shrink-0 text-[10px] font-bold text-gray-400 uppercase tracking-wide"
        >
          Upgrade Required
        </span>
        <NuxtLink
          v-else
          to="/doctor/subscription"
          @click="handleClose"
          class="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-primary hover:underline"
        >
          <span>Compare plans</span>
          <Icon
            name="lucide:arrow-right"
            class="h-3 w-3"
          />
        </NuxtLink>
      </div>

      <!-- Footer Buttons -->
      <div class="mt-6 flex items-center justify-end gap-2.5 border-t border-gray-100 pt-3.5">
        <template v-if="isSecretary">
          <button
            type="button"
            @click="handleClose"
            class="bg-primary hover:bg-primary/90 shadow-primary/20 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all active:scale-95"
          >
            <Icon
              name="lucide:check"
              class="h-4 w-4 text-white"
            />
            <span>Understood</span>
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            @click="handleClose"
            class="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
          >
            Maybe Later
          </button>

          <button
            type="button"
            @click="goToSubscription"
            class="bg-primary hover:bg-primary/90 shadow-primary/20 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all active:scale-95"
          >
            <Icon
              name="lucide:sparkles"
              class="h-4 w-4 text-white"
            />
            <span>View Subscription Plans</span>
          </button>
        </template>
      </div>
    </div>
  </AppModal>
</template>
