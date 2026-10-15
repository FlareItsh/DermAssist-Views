<script setup lang="ts">
  import { computed, ref, onMounted } from 'vue'
  import { toast } from 'vue-sonner'
  import { navigateTo } from '#app'

  interface Props {
    modelValue: boolean
    record: any
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
  }>()

  const canNativeShare = ref(false)

  onMounted(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      canNativeShare.value = true
    }
  })

  const close = () => {
    emit('update:modelValue', false)
  }

  const formattedDate = computed(() => {
    if (!props.record?.created_at) return 'Recent Scan'
    const d = new Date(props.record.created_at)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  })

  const recordUuid = computed(() => {
    return props.record?.uuid || props.record?.id || ''
  })

  const shortId = computed(() => {
    const id = recordUuid.value
    return id ? id.slice(0, 8) : 'N/A'
  })

  const conditionLabel = computed(() => {
    return props.record?.label || props.record?.title || 'Skin Condition'
  })

  const confidenceScore = computed(() => {
    if (typeof props.record?.confidence === 'number') {
      return `${Math.round(props.record.confidence * 100)}% Confidence`
    }
    return ''
  })

  const buildSummaryText = () => {
    return [
      `DermAssist AI Clinical Scan Report`,
      `Record ID: #${shortId.value}`,
      `Primary Detection: ${conditionLabel.value} ${confidenceScore.value ? `(${confidenceScore.value})` : ''}`,
      `Scan Date: ${formattedDate.value}`,
      `Notice: Assistive AI scan for clinical review. Consult a licensed dermatologist for diagnosis.`
    ].join('\n')
  }

  const handleCopySummary = async () => {
    try {
      const text = buildSummaryText()
      await navigator.clipboard.writeText(text)
      toast.success('Clinical scan summary copied to clipboard!')
      close()
    } catch (e) {
      console.error('Failed to copy to clipboard', e)
      toast.error('Could not copy to clipboard. Please grant permission.')
    }
  }

  const handleNativeShare = async () => {
    if (!navigator.share) return
    try {
      await navigator.share({
        title: `DermAssist Scan - #${shortId.value}`,
        text: buildSummaryText(),
        url: window.location.href
      })
      toast.success('Shared successfully')
      close()
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('Native share error', e)
      }
    }
  }

  const handleSendToDoctor = () => {
    close()
    navigateTo('/Patient/Messages')
  }

  const handleBookAppointment = () => {
    close()
    navigateTo('/Patient/Scan/SelectDoctor')
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-999 flex items-center justify-center p-4 sm:p-6"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"></div>

        <!-- Modal Card -->
        <div
          class="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-6 shadow-2xl transition-all sm:p-7"
        >
          <!-- Close Button -->
          <button
            type="button"
            @click="close"
            class="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <Icon
              name="lucide:x"
              class="h-4 w-4"
            />
          </button>

          <!-- Header -->
          <div class="mb-5 flex items-center gap-3.5">
            <div
              class="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            >
              <Icon
                name="solar:share-bold"
                size="24"
              />
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900">Share Scan Findings</h3>
              <p class="text-xs font-semibold text-gray-500">Record Ref: #{{ shortId }}</p>
            </div>
          </div>

          <!-- Mini Summary Preview Pill -->
          <div class="mb-5 rounded-2xl border border-gray-100 bg-gray-50/80 p-3.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-gray-900">{{ conditionLabel }}</span>
                <span
                  v-if="confidenceScore"
                  class="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600 shadow-2xs"
                >
                  {{ confidenceScore }}
                </span>
              </div>
              <span class="text-[11px] font-medium text-gray-400">{{ formattedDate }}</span>
            </div>
          </div>

          <!-- Options Grid / List -->
          <div class="space-y-2.5">
            <!-- 1. Send to Attending Doctor -->
            <button
              type="button"
              @click="handleSendToDoctor"
              class="group flex w-full items-center gap-3.5 rounded-2xl border border-gray-100 bg-white p-3.5 text-left transition-all hover:border-gray-200 hover:bg-gray-50/80 active:scale-98"
            >
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition-colors group-hover:bg-purple-100"
              >
                <Icon
                  name="solar:chat-round-dots-bold-duotone"
                  size="20"
                />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold text-gray-900">Send to Doctor via Chat</p>
                <p class="truncate text-[11px] text-gray-500">
                  Share scan details directly in messages
                </p>
              </div>
              <Icon
                name="lucide:chevron-right"
                class="text-gray-400 group-hover:text-gray-600"
                size="16"
              />
            </button>

            <!-- 2. Book Consultation -->
            <button
              type="button"
              @click="handleBookAppointment"
              class="group flex w-full items-center gap-3.5 rounded-2xl border border-gray-100 bg-white p-3.5 text-left transition-all hover:border-gray-200 hover:bg-gray-50/80 active:scale-98"
            >
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100"
              >
                <Icon
                  name="solar:calendar-date-bold-duotone"
                  size="20"
                />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold text-gray-900">Book Doctor Consultation</p>
                <p class="truncate text-[11px] text-gray-500">
                  Schedule clinic appointment with this scan
                </p>
              </div>
              <Icon
                name="lucide:chevron-right"
                class="text-gray-400 group-hover:text-gray-600"
                size="16"
              />
            </button>

            <!-- 3. Copy Summary -->
            <button
              type="button"
              @click="handleCopySummary"
              class="group flex w-full items-center gap-3.5 rounded-2xl border border-gray-100 bg-white p-3.5 text-left transition-all hover:border-gray-200 hover:bg-gray-50/80 active:scale-98"
            >
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100"
              >
                <Icon
                  name="solar:copy-bold-duotone"
                  size="20"
                />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold text-gray-900">Copy Clinical Summary</p>
                <p class="truncate text-[11px] text-gray-500">
                  Copy formatted details to clipboard
                </p>
              </div>
              <Icon
                name="lucide:copy"
                class="text-gray-400 group-hover:text-gray-600"
                size="16"
              />
            </button>

            <!-- 4. Native Device Share -->
            <button
              v-if="canNativeShare"
              type="button"
              @click="handleNativeShare"
              class="group flex w-full items-center gap-3.5 rounded-2xl border border-gray-100 bg-white p-3.5 text-left transition-all hover:border-gray-200 hover:bg-gray-50/80 active:scale-98"
            >
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100"
              >
                <Icon
                  name="solar:share-circle-bold-duotone"
                  size="20"
                />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold text-gray-900">Share via Apps</p>
                <p class="truncate text-[11px] text-gray-500">AirDrop, WhatsApp, Mail, Messages</p>
              </div>
              <Icon
                name="lucide:share"
                class="text-gray-400 group-hover:text-gray-600"
                size="16"
              />
            </button>
          </div>

          <!-- Footer -->
          <div class="mt-6 flex justify-end border-t border-gray-100 pt-3">
            <button
              type="button"
              @click="close"
              class="rounded-xl px-4 py-2 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
</style>
