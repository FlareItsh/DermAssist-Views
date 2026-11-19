<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

  const props = withDefaults(
    defineProps<{
      isOpen?: boolean
      modelValue?: boolean
      record: any
      role?: 'doctor' | 'patient'
    }>(),
    {
      isOpen: true,
      modelValue: true
    }
  )

  const emit = defineEmits(['close', 'update:modelValue', 'update:isOpen'])

  const isModalOpen = computed(() => {
    return props.isOpen !== undefined ? props.isOpen : props.modelValue
  })

  // Retain record in memory so content remains fully visible during closing transition
  const activeRecord = ref(props.record)
  watch(
    () => props.record,
    newRecord => {
      if (newRecord) {
        activeRecord.value = newRecord
      }
    },
    { immediate: true }
  )

  const handleClose = () => {
    emit('close')
    emit('update:modelValue', false)
    emit('update:isOpen', false)
  }

  const formattedDate = computed(() => {
    const raw = activeRecord.value?.created_at || activeRecord.value?.date
    if (!raw) return 'Clinical Record'
    const d = new Date(raw)
    return isNaN(d.getTime())
      ? 'Clinical Record'
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  })

  const recordTitle = computed(() => {
    if (activeRecord.value?.title) return activeRecord.value.title
    if (activeRecord.value?.patient) {
      return `${activeRecord.value.patient.first_name} ${activeRecord.value.patient.last_name}`
    }
    return activeRecord.value?.type === 'doctor_diagnosis' ? "Doctor's Diagnosis" : 'AI Scan Result'
  })

  const isUrgent = computed(() =>
    Boolean(activeRecord.value?.isUrgent || activeRecord.value?.is_urgent)
  )

  onMounted(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown)
    })
  })
</script>

<template>
  <Teleport to="body">
    <Transition
      name="folder-modal"
      appear
    >
      <div
        v-if="isModalOpen && activeRecord"
        class="folder-modal-root fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/65 p-3 backdrop-blur-[2px] sm:p-5 md:p-6"
        @click.self="handleClose"
        role="dialog"
        aria-modal="true"
        aria-label="Clinical Record Folder"
      >
        <!-- 3D Perspective Stage -->
        <div
          class="folder-stage relative my-auto flex w-full max-w-[95vw] flex-col items-center justify-center md:max-w-4xl lg:max-w-5xl"
        >
          <!-- Back Folder Jacket & Tab -->
          <div
            class="folder-back-jacket pointer-events-none absolute -inset-1.5 -top-11 z-0 flex flex-col sm:-inset-3 sm:-top-13"
          >
            <!-- Top Folder Tab -->
            <div class="relative flex h-11 shrink-0 translate-y-px items-end sm:h-13">
              <div
                class="bg-primary flex h-full max-w-[80%] items-center gap-2 rounded-t-2xl border-x border-t border-white/25 px-4 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.12)] sm:max-w-[500px] sm:rounded-t-3xl sm:px-6"
              >
                <Icon
                  :name="
                    activeRecord?.type === 'doctor_diagnosis'
                      ? 'material-symbols:stethoscope-rounded'
                      : 'solar:shield-check-bold-duotone'
                  "
                  class="shrink-0 text-sm text-white/90 sm:text-base"
                />
                <div class="flex min-w-0 flex-1 flex-col">
                  <span
                    class="block truncate text-[9px] tracking-wider uppercase sm:text-[11px]"
                    :class="isUrgent ? 'font-medium text-red-300' : 'font-medium text-white/75'"
                  >
                    {{ formattedDate }}
                  </span>
                  <span class="block truncate text-[11px] font-semibold text-white sm:text-xs">
                    {{ recordTitle }}
                  </span>
                </div>
              </div>

              <!-- Signature Folder Tab Curved Corner -->
              <div class="-ml-px h-11 w-11 sm:h-13 sm:w-14">
                <svg
                  viewBox="0 0 110 100"
                  preserveAspectRatio="none"
                  class="fill-primary h-full w-20 sm:w-28"
                  aria-hidden="true"
                >
                  <path d="M0,30 Q0,105 35,100 L0,100 Z" />
                </svg>
              </div>
            </div>

            <!-- Folder Back Base Body -->
            <div
              class="bg-primary relative flex-1 rounded-tr-3xl rounded-b-3xl border border-white/15 shadow-2xl"
            >
              <!-- Subtle Paper Bed / Inner Pocket Reflection -->
              <div
                class="bg-background/40 pointer-events-none absolute inset-x-2 top-3 bottom-3 rounded-2xl opacity-60 sm:inset-x-4 sm:top-5 sm:bottom-5 sm:rounded-3xl"
              ></div>
            </div>
          </div>

          <!-- White Clinical Document Paper Sheet (Rises out of folder) -->
          <div
            class="folder-paper-sheet relative z-20 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <AppModalRecord
              v-if="activeRecord"
              :record="activeRecord"
              :role="role"
              @close="handleClose"
            />
          </div>

          <!-- 3D Front Folder Flap (Flips open on enter, snaps shut on leave) -->
          <div
            class="folder-front-flap bg-primary pointer-events-none absolute inset-0 z-30 flex flex-col justify-between overflow-hidden rounded-tr-3xl rounded-b-3xl border border-white/20 shadow-2xl"
            aria-hidden="true"
          >
            <!-- Top Subtle Rim Highlight -->
            <div class="h-1.5 w-full bg-white/20"></div>

            <div
              class="pointer-events-none absolute inset-0 bg-linear-to-tr from-white/10 via-transparent to-black/15"
            ></div>

            <!-- Folder Crease Accent at Bottom Hinge -->
            <div class="relative z-10 flex flex-col">
              <div class="h-px w-full bg-white/15"></div>
              <div class="h-2 w-full bg-black/20 shadow-inner"></div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  /* 3D Perspective Stage */
  .folder-stage {
    perspective: 1400px;
    transform-style: preserve-3d;
  }

  /* Base Resting States (When Modal is Fully Open) */
  .folder-back-jacket {
    transform: scale(1) translateY(0);
    opacity: 1;
    will-change: transform, opacity;
  }

  .folder-paper-sheet {
    transform: translateY(0) scale(1);
    opacity: 1;
    will-change: transform, opacity;
  }

  .folder-front-flap {
    transform: rotateX(-85deg) translateY(32px);
    opacity: 0;
    pointer-events: none;
    transform-origin: bottom center;
    backface-visibility: hidden;
    will-change: transform, opacity;
  }

  /* Transition Durations & Easing Curves */
  .folder-modal-enter-active {
    transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .folder-modal-leave-active {
    transition: opacity 0.38s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .folder-modal-enter-active .folder-back-jacket,
  .folder-modal-leave-active .folder-back-jacket {
    transition:
      transform 0.5s cubic-bezier(0.16, 1, 0.3, 1),
      opacity 0.45s ease;
  }

  .folder-modal-enter-active .folder-paper-sheet,
  .folder-modal-leave-active .folder-paper-sheet {
    transition:
      transform 0.52s cubic-bezier(0.16, 1, 0.3, 1),
      opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .folder-modal-enter-active .folder-front-flap,
  .folder-modal-leave-active .folder-front-flap {
    transition:
      transform 0.48s cubic-bezier(0.16, 1, 0.3, 1),
      opacity 0.38s ease;
    transform-origin: bottom center;
  }

  /* --- Enter Starting State (Closed Folder Before Opening) --- */
  .folder-modal-enter-from {
    opacity: 0;
  }

  .folder-modal-enter-from .folder-back-jacket {
    transform: scale(0.88) translateY(44px) !important;
    opacity: 0.3 !important;
  }

  .folder-modal-enter-from .folder-paper-sheet {
    transform: translateY(68px) scale(0.91) !important;
    opacity: 0 !important;
  }

  .folder-modal-enter-from .folder-front-flap {
    transform: rotateX(0deg) !important;
    opacity: 1 !important;
  }

  /* --- Enter Target State (Resting Open) --- */
  .folder-modal-enter-to .folder-back-jacket {
    transform: scale(1) translateY(0);
    opacity: 1;
  }

  .folder-modal-enter-to .folder-paper-sheet {
    transform: translateY(0) scale(1);
    opacity: 1;
  }

  .folder-modal-enter-to .folder-front-flap {
    transform: rotateX(-85deg) translateY(32px);
    opacity: 0;
  }

  /* --- Leave Target State (Closing Folder Back Down) --- */
  .folder-modal-leave-to {
    opacity: 0;
  }

  .folder-modal-leave-to .folder-back-jacket {
    transform: scale(0.9) translateY(32px) !important;
    opacity: 0 !important;
  }

  .folder-modal-leave-to .folder-paper-sheet {
    transform: translateY(48px) scale(0.94) !important;
    opacity: 0 !important;
  }

  .folder-modal-leave-to .folder-front-flap {
    transform: rotateX(0deg) !important;
    opacity: 1 !important;
  }

  /* --- Accessibility: Reduced Motion Override --- */
  @media (prefers-reduced-motion: reduce) {
    .folder-modal-enter-active,
    .folder-modal-leave-active,
    .folder-modal-enter-active .folder-back-jacket,
    .folder-modal-leave-active .folder-back-jacket,
    .folder-modal-enter-active .folder-paper-sheet,
    .folder-modal-leave-active .folder-paper-sheet,
    .folder-modal-enter-active .folder-front-flap,
    .folder-modal-leave-active .folder-front-flap {
      transition: opacity 0.25s ease !important;
      transform: none !important;
    }
  }
</style>
