<script setup lang="ts">
  import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

  interface Props {
    modelValue?: boolean
    initialTab?: 'terms' | 'privacy' | 'cookies'
    mandatory?: boolean
    isSubmitting?: boolean
    userRole?: string
    initialConsentDataset?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    initialTab: 'terms',
    mandatory: false,
    isSubmitting: false,
    userRole: '',
    initialConsentDataset: false
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'close'): void
    (e: 'accept', payload?: { consent_dataset: boolean }): void
    (e: 'decline'): void
  }>()

  const activeTab = ref<'terms' | 'privacy' | 'cookies'>(props.initialTab)
  const localConsentDataset = ref<boolean>(props.initialConsentDataset)
  const scrollContainerRef = ref<HTMLElement | null>(null)
  const termsRead = ref(false)
  const privacyRead = ref(false)
  const cookiesRead = ref(false)
  const canScrollMore = ref(false)
  const minContentHeightPx = ref(0)

  let resizeObserver: ResizeObserver | null = null
  let scrollCheckTimer: ReturnType<typeof setTimeout> | null = null
  let isSwitchingTab = false

  const scrollWrapperStyle = computed(() => {
    if (!props.mandatory || minContentHeightPx.value <= 0) return undefined
    return { minHeight: `${minContentHeightPx.value}px` }
  })

  const syncMinContentHeight = () => {
    const el = scrollContainerRef.value
    if (!el || !props.mandatory || el.clientHeight <= 0) return false
    const desiredMinHeight = el.clientHeight + 160
    if (Math.abs(minContentHeightPx.value - desiredMinHeight) > 4) {
      minContentHeightPx.value = desiredMinHeight
      return true
    }
    return false
  }

  const evaluateScrollPosition = () => {
    if (isSwitchingTab) return
    const el = scrollContainerRef.value
    if (!el || el.clientHeight <= 0 || el.scrollHeight <= 0) return
    if (syncMinContentHeight()) {
      void nextTick(evaluateScrollPosition)
      return
    }
    const hasOverflow = el.scrollHeight > el.clientHeight + 12
    const remaining = el.scrollHeight - (el.scrollTop + el.clientHeight)
    const atBottom = remaining <= 12
    const didScroll = hasOverflow ? el.scrollTop > 16 : true
    canScrollMore.value = !atBottom

    if (atBottom && didScroll) {
      if (activeTab.value === 'terms') {
        termsRead.value = true
      } else if (activeTab.value === 'privacy') {
        privacyRead.value = true
      } else if (activeTab.value === 'cookies') {
        cookiesRead.value = true
      }
    }
  }

  const scheduleScrollCheck = async (resetToTop = false) => {
    if (resetToTop) {
      isSwitchingTab = true
      if (scrollContainerRef.value) {
        scrollContainerRef.value.scrollTop = 0
      }
    }
    await nextTick()
    syncMinContentHeight()
    await nextTick()
    if (resetToTop && scrollContainerRef.value) {
      scrollContainerRef.value.scrollTop = 0
    }
    if (scrollCheckTimer) clearTimeout(scrollCheckTimer)
    scrollCheckTimer = setTimeout(() => {
      if (resetToTop && scrollContainerRef.value) {
        scrollContainerRef.value.scrollTop = 0
      }
      syncMinContentHeight()
      isSwitchingTab = false
      void nextTick(evaluateScrollPosition)
    }, 60)
  }

  const isTabUnlocked = (tab: 'terms' | 'privacy' | 'cookies') => {
    if (!props.mandatory) return true
    if (tab === 'terms') return true
    if (tab === 'privacy') return termsRead.value
    return termsRead.value && privacyRead.value
  }

  const isTabCompleted = (tab: 'terms' | 'privacy' | 'cookies') => {
    if (tab === 'terms') return termsRead.value
    if (tab === 'privacy') return privacyRead.value
    return cookiesRead.value
  }

  const isCurrentTabRead = computed(() => isTabCompleted(activeTab.value))

  const showScrollIndicator = computed(() => {
    return Boolean(props.mandatory && canScrollMore.value && !isCurrentTabRead.value)
  })

  const selectTab = async (tab: 'terms' | 'privacy' | 'cookies') => {
    if (!isTabUnlocked(tab)) return
    isSwitchingTab = true
    if (scrollContainerRef.value) {
      scrollContainerRef.value.scrollTop = 0
    }
    activeTab.value = tab
    await scheduleScrollCheck(true)
  }

  const handleNextTab = async () => {
    if (activeTab.value === 'terms' && termsRead.value) {
      await selectTab('privacy')
    } else if (activeTab.value === 'privacy' && privacyRead.value) {
      await selectTab('cookies')
    }
  }

  const scrollDownStep = () => {
    const el = scrollContainerRef.value
    if (!el) return
    const targetTop = Math.min(
      el.scrollTop + Math.max(el.clientHeight * 0.75, 220),
      el.scrollHeight
    )
    el.scrollTo({ top: targetTop, behavior: 'smooth' })
  }

  const cleanupObservers = () => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (scrollCheckTimer) {
      clearTimeout(scrollCheckTimer)
      scrollCheckTimer = null
    }
  }

  watch(
    () => props.initialTab,
    newTab => {
      if (!props.mandatory) {
        activeTab.value = newTab
      }
    }
  )

  watch(
    () => props.initialConsentDataset,
    newVal => {
      localConsentDataset.value = Boolean(newVal)
    }
  )

  watch(scrollContainerRef, el => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (el && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        evaluateScrollPosition()
      })
      resizeObserver.observe(el)
    }
  })

  watch(
    () => props.modelValue,
    val => {
      if (val) {
        localConsentDataset.value = Boolean(props.initialConsentDataset)
        isSwitchingTab = true
        if (props.mandatory) {
          activeTab.value = 'terms'
          termsRead.value = false
          privacyRead.value = false
          cookiesRead.value = false
          canScrollMore.value = false
        }
        scheduleScrollCheck(true)
      } else {
        isSwitchingTab = false
        minContentHeightPx.value = 0
        cleanupObservers()
      }
      if (import.meta.client) {
        document.body.style.overflow = val ? 'hidden' : ''
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    cleanupObservers()
    if (import.meta.client) {
      document.body.style.overflow = ''
    }
  })

  const close = () => {
    if (props.mandatory) return
    emit('update:modelValue', false)
    emit('close')
  }

  const handleBackdropClick = () => {
    if (props.mandatory) return
    close()
  }

  const decline = () => {
    if (props.isSubmitting) return
    emit('decline')
  }

  const accept = () => {
    if (props.isSubmitting) return
    if (props.mandatory && (!termsRead.value || !privacyRead.value || !cookiesRead.value)) {
      return
    }
    emit('accept', { consent_dataset: localConsentDataset.value })
    if (!props.mandatory) {
      emit('update:modelValue', false)
    }
  }
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
        aria-modal="true"
        role="dialog"
        @keydown.esc.prevent
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 transition-opacity"
          :class="mandatory ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/40'"
          @click="handleBackdropClick"
        ></div>

        <!-- Dialog Card -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform scale-95 opacity-0 translate-y-4"
          enter-to-class="transform scale-100 opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="transform scale-100 opacity-100 translate-y-0"
          leave-to-class="transform scale-95 opacity-0 translate-y-4"
        >
          <div
            class="bg-card border-border/80 relative z-10 flex h-[92vh] max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border shadow-2xl"
          >
            <!-- Header Bar -->
            <div
              class="border-border/50 bg-muted/20 flex items-center justify-between border-b px-6 py-4"
            >
              <div class="flex items-center gap-3">
                <div
                  class="bg-primary/10 text-primary ring-primary/5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-4"
                >
                  <Icon
                    :name="
                      activeTab === 'terms'
                        ? 'lucide:file-text'
                        : activeTab === 'privacy'
                          ? 'lucide:shield-check'
                          : 'lucide:cookie'
                    "
                    class="h-5 w-5"
                  />
                </div>
                <div>
                  <h3 class="text-foreground text-lg leading-tight font-bold">
                    User Agreement & Consent
                  </h3>
                  <p class="text-muted-foreground text-xs">
                    {{
                      mandatory
                        ? 'Please review and agree to our Terms & Privacy Policy before proceeding to your dashboard'
                        : 'Please review our terms of service, privacy practices, and cookie policies'
                    }}
                  </p>
                </div>
              </div>

              <button
                v-if="!mandatory"
                type="button"
                @click="close"
                class="text-muted-foreground hover:text-foreground hover:bg-foreground/5 cursor-pointer rounded-full p-2 transition-colors"
                aria-label="Close modal"
              >
                <Icon
                  name="lucide:x"
                  class="text-lg"
                />
              </button>
            </div>

            <!-- Tab Switcher -->
            <div class="border-border/40 bg-muted/10 flex gap-2 overflow-x-auto border-b px-6 pt-2">
              <button
                type="button"
                class="relative inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all"
                :class="[
                  activeTab === 'terms'
                    ? 'text-primary border-primary cursor-pointer border-b-2 font-bold'
                    : 'text-muted-foreground hover:text-foreground cursor-pointer'
                ]"
                @click="selectTab('terms')"
              >
                <Icon
                  v-if="mandatory && termsRead"
                  name="lucide:check-circle-2"
                  class="h-3.5 w-3.5 text-emerald-500"
                />
                <span>Terms & Conditions</span>
              </button>
              <button
                type="button"
                :disabled="mandatory && !isTabUnlocked('privacy')"
                class="relative inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all"
                :class="[
                  mandatory && !isTabUnlocked('privacy')
                    ? 'text-muted-foreground/45 cursor-not-allowed'
                    : activeTab === 'privacy'
                      ? 'text-primary border-primary cursor-pointer border-b-2 font-bold'
                      : 'text-muted-foreground hover:text-foreground cursor-pointer'
                ]"
                @click="selectTab('privacy')"
              >
                <Icon
                  v-if="mandatory && privacyRead"
                  name="lucide:check-circle-2"
                  class="h-3.5 w-3.5 text-emerald-500"
                />
                <Icon
                  v-else-if="mandatory && !isTabUnlocked('privacy')"
                  name="lucide:lock"
                  class="h-3 w-3"
                />
                <span>Privacy Policy & Health Data</span>
              </button>
              <button
                type="button"
                :disabled="mandatory && !isTabUnlocked('cookies')"
                class="relative inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all"
                :class="[
                  mandatory && !isTabUnlocked('cookies')
                    ? 'text-muted-foreground/45 cursor-not-allowed'
                    : activeTab === 'cookies'
                      ? 'text-primary border-primary cursor-pointer border-b-2 font-bold'
                      : 'text-muted-foreground hover:text-foreground cursor-pointer'
                ]"
                @click="selectTab('cookies')"
              >
                <Icon
                  v-if="mandatory && cookiesRead"
                  name="lucide:check-circle-2"
                  class="h-3.5 w-3.5 text-emerald-500"
                />
                <Icon
                  v-else-if="mandatory && !isTabUnlocked('cookies')"
                  name="lucide:lock"
                  class="h-3 w-3"
                />
                <span>Cookie & Device Security</span>
              </button>
            </div>

            <!-- Scrollable Content Wrapper with Minimalist Scroll Indicator -->
            <div class="relative flex min-h-0 flex-1 flex-col">
              <!-- Scrollable Content Body -->
              <div
                ref="scrollContainerRef"
                class="custom-scrollbar text-foreground/85 flex-1 overflow-y-auto p-6 text-sm leading-relaxed"
                @scroll="evaluateScrollPosition"
              >
                <div
                  :class="mandatory ? 'flex flex-col justify-between gap-6' : 'space-y-4'"
                  :style="scrollWrapperStyle"
                >
                  <!-- Terms & Conditions Tab -->
                  <template v-if="activeTab === 'terms'">
                    <div class="space-y-5 text-xs sm:text-sm">
                      <div class="border-primary/20 bg-primary/5 rounded-xl border p-3.5">
                        <p class="text-primary flex items-center gap-1.5 font-semibold">
                          <Icon
                            name="lucide:info"
                            class="h-4 w-4 shrink-0"
                          />
                          Important Medical Disclaimer
                        </p>
                        <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
                          DermAssist provides assistive skin evaluation tools and teleconsultation
                          management. AI-generated insights are decision-support indicators and do
                          not constitute a definitive medical diagnosis. Always seek direct
                          consultation with a licensed dermatologist.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">1. Acceptance of Terms</h4>
                        <p class="text-muted-foreground mt-1">
                          By registering an account with DermAssist, you agree to comply with and be
                          bound by these Terms and Conditions. If you do not agree, you must not use
                          or access the service.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">2. Description of Service</h4>
                        <p class="text-muted-foreground mt-1">
                          DermAssist facilitates communication between patients and licensed
                          healthcare professionals, enables appointment management, and offers
                          assistive skin condition image screening.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">
                          3. User Responsibilities & Account Security
                        </h4>
                        <p class="text-muted-foreground mt-1">
                          You are responsible for maintaining the confidentiality of your account
                          credentials. You agree to provide true, accurate, current, and complete
                          information during registration and health assessments.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">
                          4. Telemedicine & Professional Standards
                        </h4>
                        <p class="text-muted-foreground mt-1">
                          Healthcare providers using DermAssist represent and warrant that they
                          possess valid, unencumbered Professional Regulation Commission (PRC)
                          licenses and comply with all applicable medical ethics and teledermatology
                          regulations.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">
                          5. Fees, Subscriptions & Strict No-Refund Policy
                        </h4>
                        <p class="text-muted-foreground mt-1">
                          All fees and transactions processed on DermAssist—including doctor
                          professional subscription plans, appointments, feature add-ons, and AI
                          scan quota purchases—are strictly final, non-refundable, and
                          non-creditable. Due to the immediate provisioning of clinical AI services,
                          cloud computational resources, and doctor time allocations:
                        </p>
                        <ul class="text-muted-foreground mt-2 list-disc space-y-1.5 pl-5">
                          <li>
                            <strong class="text-foreground font-semibold"
                              >Doctor Subscriptions:</strong
                            >
                            Subscription plans are billed automatically in advance (monthly or
                            annually). You may cancel your auto-renewal at any time to prevent
                            subsequent billing cycles; however, charges for the current active
                            billing cycle are strictly non-refundable and will not be prorated.
                          </li>
                          <li>
                            <strong class="text-foreground font-semibold"
                              >Consultations & Telehealth Appointments:</strong
                            >
                            Fees paid for completed, in-progress, or missed appointments (patient
                            no-shows) are non-refundable. Rescheduling requests must adhere to
                            clinic and attending physician availability rules.
                          </li>
                          <li>
                            <strong class="text-foreground font-semibold"
                              >AI Scan Quotas & Digital Credits:</strong
                            >
                            AI diagnostic quotas and digital credits are provisioned instantaneously
                            upon payment confirmation. Allocated, used, or expired quota credits
                            cannot be refunded, transferred, or exchanged for cash.
                          </li>
                        </ul>
                      </div>

                      <div class="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5">
                        <p
                          class="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400"
                        >
                          <Icon
                            name="lucide:alert-circle"
                            class="h-4 w-4 shrink-0"
                          />
                          Summary of No-Refund Commitment
                        </p>
                        <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
                          By proceeding with any subscription or appointment booking on DermAssist,
                          you explicitly acknowledge and accept this strict no-refund policy. Please
                          verify plan tier selections and appointment details prior to completing
                          any transaction.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">6. Limitation of Liability</h4>
                        <p class="text-muted-foreground mt-1">
                          DermAssist shall not be liable for any indirect, incidental, or
                          consequential damages resulting from the use or inability to use the
                          platform or any emergency medical conditions that require urgent in-person
                          medical care.
                        </p>
                      </div>
                    </div>
                  </template>

                  <!-- Privacy Policy Tab -->
                  <template v-else-if="activeTab === 'privacy'">
                    <div class="space-y-5 text-xs sm:text-sm">
                      <div class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                        <p
                          class="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400"
                        >
                          <Icon
                            name="lucide:lock"
                            class="h-4 w-4 shrink-0"
                          />
                          Data Privacy Act of 2012 Compliance
                        </p>
                        <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
                          Your personal and sensitive medical information is processed in strict
                          compliance with the Philippine Data Privacy Act of 2012 (RA 10173) and
                          medical confidentiality standards.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">1. Information We Collect</h4>
                        <p class="text-muted-foreground mt-1">
                          We collect basic personal information (name, email, contact details),
                          professional licensing credentials (for doctors), and sensitive health
                          data including dermatological photos and consultation notes submitted
                          during assessments.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">2. Purpose of Data Processing</h4>
                        <p class="text-muted-foreground mt-1">
                          Collected data is used exclusively to facilitate teleconsultation
                          services, schedule appointments, generate assistive AI triage findings for
                          review by your doctor, and maintain your digital medical records.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">3. Security & Image Storage</h4>
                        <p class="text-muted-foreground mt-1">
                          All clinical images and health records are securely stored using
                          industry-standard encryption protocols. Access is restricted strictly to
                          authorized medical personnel and the patient.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">4. Patient Rights</h4>
                        <p class="text-muted-foreground mt-1">
                          As a data subject, you retain the right to access, rectify, or request
                          deletion of your personal data, subject to statutory medical record
                          retention requirements.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">5. Cookies & Security Identifiers</h4>
                        <p class="text-muted-foreground mt-1">
                          We utilize essential session and device verification cookies to maintain
                          secure authentication and protect clinical communications from
                          unauthorized automated bots.
                        </p>
                      </div>
                    </div>
                  </template>

                  <!-- Cookie & Device Security Tab -->
                  <template v-else-if="activeTab === 'cookies'">
                    <div class="space-y-5 text-xs sm:text-sm">
                      <div class="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
                        <p
                          class="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400"
                        >
                          <Icon
                            name="lucide:cookie"
                            class="h-4 w-4 shrink-0"
                          />
                          Essential Cookies & Device Security Policy
                        </p>
                        <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
                          DermAssist utilizes essential security cookies and persistent device
                          identifiers exclusively to protect accounts, prevent spam registrations,
                          and safeguard sensitive clinical data.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">1. What Are Security Cookies?</h4>
                        <p class="text-muted-foreground mt-1">
                          Cookies are small, encrypted text tokens stored in your browser.
                          DermAssist uses essential cookies strictly necessary to maintain your
                          authenticated session and protect communications between you and your
                          healthcare providers.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">
                          2. Device Verification & Anti-Spam Protection
                        </h4>
                        <p class="text-muted-foreground mt-1">
                          To prevent automated dummy accounts and fraudulent activity, our system
                          associates a unique cryptographic device identifier with active sessions.
                          This protects legitimate patients and clinic personnel from unauthorized
                          intrusions.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">
                          3. Temporary Accounts & Verification Deadlines
                        </h4>
                        <p class="text-muted-foreground mt-1">
                          When cookies are declined, self-registered accounts are created under
                          temporary status with a designated deadline to verify identity. Completing
                          verification permanently activates the account. Overdue unverified
                          accounts are automatically deactivated to maintain data integrity.
                        </p>
                      </div>

                      <div>
                        <h4 class="text-foreground font-bold">4. Managing Preferences</h4>
                        <p class="text-muted-foreground mt-1">
                          You may adjust your browser cookie settings at any time. Declining
                          non-essential cookies will not hinder your clinical consultations or
                          access to doctor appointments once your account is verified.
                        </p>
                      </div>
                    </div>
                  </template>

                  <!-- Bottom Scroll Confirmation Anchor (guarantees full-section review) -->
                  <div
                    v-if="mandatory"
                    class="border-border/50 bg-muted/20 text-muted-foreground mt-2 flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-center text-xs"
                  >
                    <Icon
                      :name="isCurrentTabRead ? 'lucide:check-circle-2' : 'lucide:chevrons-down'"
                      class="h-4 w-4 shrink-0 transition-colors"
                      :class="isCurrentTabRead ? 'text-emerald-500' : 'text-primary'"
                    />
                    <span>
                      {{
                        activeTab === 'terms'
                          ? 'End of Terms & Conditions'
                          : activeTab === 'privacy'
                            ? 'End of Privacy Policy & Health Data'
                            : 'End of Cookie & Device Security'
                      }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Minimalist Scroll-Down Indicator Arrow -->
              <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 translate-y-2"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 translate-y-2"
              >
                <div
                  v-if="showScrollIndicator"
                  class="from-card via-card/75 pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center justify-end bg-gradient-to-t to-transparent pt-8 pb-3"
                >
                  <button
                    type="button"
                    class="border-border/70 bg-card/95 text-foreground/85 hover:text-primary pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold shadow-md backdrop-blur-md transition-colors"
                    @click="scrollDownStep"
                  >
                    <span>Scroll down to continue</span>
                    <Icon
                      name="lucide:arrow-down"
                      class="text-primary h-3.5 w-3.5 animate-bounce"
                    />
                  </button>
                </div>
              </Transition>
            </div>

            <!-- Optional AI Retraining Dataset Contribution (Patients in Mandatory Gate) -->
            <div
              v-if="mandatory && userRole === 'patient'"
              class="border-border/40 bg-muted/10 shrink-0 border-t px-6 py-3.5"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="space-y-0.5">
                  <h4
                    class="text-foreground flex items-center gap-1.5 text-xs font-bold sm:text-sm"
                  >
                    <Icon
                      name="lucide:database"
                      class="text-primary h-3.5 w-3.5 shrink-0"
                    />
                    AI Retraining Dataset Contribution
                    <span
                      class="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium"
                    >
                      Optional
                    </span>
                  </h4>
                  <p class="text-muted-foreground text-[11px] leading-relaxed sm:text-xs">
                    Allow anonymized skin scan images from doctor consultations to be contributed to
                    the DermAssist AI research dataset. Your identity and personal information are
                    strictly removed. You can modify this consent anytime.
                  </p>
                </div>
                <label class="relative mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
                  <input
                    v-model="localConsentDataset"
                    type="checkbox"
                    class="peer sr-only"
                  />
                  <div
                    class="bg-foreground/20 peer peer-checked:bg-primary h-6 w-11 rounded-full peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
                  ></div>
                </label>
              </div>
            </div>

            <!-- Modal Footer -->
            <div
              class="border-border/40 bg-muted/20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3.5 sm:px-6 sm:py-4"
            >
              <span class="text-muted-foreground hidden text-xs sm:inline">
                Last updated: October 2026
              </span>
              <div class="flex w-full items-center justify-end gap-2 sm:w-auto">
                <AppButton
                  v-if="!mandatory"
                  variant="ghost"
                  size="sm"
                  @click="close"
                >
                  Close
                </AppButton>
                <AppButton
                  v-else
                  variant="ghost"
                  size="sm"
                  :disabled="isSubmitting"
                  class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  @click="decline"
                >
                  <Icon
                    name="lucide:log-out"
                    class="mr-1 h-4 w-4"
                  />
                  Decline & Sign Out
                </AppButton>

                <AppButton
                  v-if="!mandatory"
                  size="sm"
                  :disabled="isSubmitting"
                  @click="accept"
                >
                  <Icon
                    name="lucide:check"
                    class="mr-1 h-4 w-4"
                  />
                  I Accept & Agree
                </AppButton>
                <AppButton
                  v-else-if="activeTab === 'terms'"
                  size="sm"
                  :disabled="!termsRead"
                  @click="handleNextTab"
                >
                  <span>Next: Privacy Policy</span>
                  <Icon
                    name="lucide:arrow-right"
                    class="ml-1 h-4 w-4"
                  />
                </AppButton>
                <AppButton
                  v-else-if="activeTab === 'privacy'"
                  size="sm"
                  :disabled="!privacyRead"
                  @click="handleNextTab"
                >
                  <span>Next: Cookies & Security</span>
                  <Icon
                    name="lucide:arrow-right"
                    class="ml-1 h-4 w-4"
                  />
                </AppButton>
                <AppButton
                  v-else
                  size="sm"
                  :disabled="isSubmitting || !cookiesRead"
                  @click="accept"
                >
                  <Icon
                    :name="isSubmitting ? 'lucide:loader-2' : 'lucide:check'"
                    class="mr-1 h-4 w-4"
                    :class="isSubmitting ? 'animate-spin' : ''"
                  />
                  {{ isSubmitting ? 'Saving...' : 'I Accept & Agree' }}
                </AppButton>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(150, 150, 150, 0.2);
    border-radius: 9999px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(150, 150, 150, 0.4);
  }
</style>
