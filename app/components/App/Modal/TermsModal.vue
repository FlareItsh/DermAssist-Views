<script setup lang="ts">
  import { ref, watch } from 'vue'

  interface Props {
    modelValue?: boolean
    initialTab?: 'terms' | 'privacy' | 'cookies'
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    initialTab: 'terms'
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'close'): void
    (e: 'accept'): void
  }>()

  const activeTab = ref<'terms' | 'privacy' | 'cookies'>(props.initialTab)

  watch(
    () => props.initialTab,
    newTab => {
      activeTab.value = newTab
    }
  )

  const close = () => {
    emit('update:modelValue', false)
    emit('close')
  }

  const accept = () => {
    emit('accept')
    emit('update:modelValue', false)
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
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/50 transition-opacity"
          @click="close"
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
                    Please review our terms of service, privacy practices, and cookie policies
                  </p>
                </div>
              </div>

              <button
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
                class="relative cursor-pointer px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all"
                :class="
                  activeTab === 'terms'
                    ? 'text-primary border-primary border-b-2 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="activeTab = 'terms'"
              >
                Terms & Conditions
              </button>
              <button
                type="button"
                class="relative cursor-pointer px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all"
                :class="
                  activeTab === 'privacy'
                    ? 'text-primary border-primary border-b-2 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="activeTab = 'privacy'"
              >
                Privacy Policy & Health Data
              </button>
              <button
                type="button"
                class="relative cursor-pointer px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all"
                :class="
                  activeTab === 'cookies'
                    ? 'text-primary border-primary border-b-2 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="activeTab = 'cookies'"
              >
                Cookie & Device Security
              </button>
            </div>

            <!-- Scrollable Content Body -->
            <div
              class="custom-scrollbar text-foreground/85 flex-1 space-y-4 overflow-y-auto p-6 text-sm leading-relaxed"
            >
              <!-- Terms & Conditions Tab -->
              <template v-if="activeTab === 'terms'">
                <div class="space-y-4 text-xs sm:text-sm">
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
                      management. AI-generated insights are decision-support indicators and do not
                      constitute a definitive medical diagnosis. Always seek direct consultation
                      with a licensed dermatologist.
                    </p>
                  </div>

                  <div>
                    <h4 class="text-foreground font-bold">1. Acceptance of Terms</h4>
                    <p class="text-muted-foreground mt-1">
                      By registering an account with DermAssist, you agree to comply with and be
                      bound by these Terms and Conditions. If you do not agree, you must not use or
                      access the service.
                    </p>
                  </div>

                  <div>
                    <h4 class="text-foreground font-bold">2. Description of Service</h4>
                    <p class="text-muted-foreground mt-1">
                      DermAssist facilitates communication between patients and licensed healthcare
                      professionals, enables appointment management, and offers assistive skin
                      condition image screening.
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
                      Healthcare providers using DermAssist represent and warrant that they possess
                      valid, unencumbered Professional Regulation Commission (PRC) licenses and
                      comply with all applicable medical ethics and teledermatology regulations.
                    </p>
                  </div>

                  <div>
                    <h4 class="text-foreground font-bold">5. Limitation of Liability</h4>
                    <p class="text-muted-foreground mt-1">
                      DermAssist shall not be liable for any indirect, incidental, or consequential
                      damages resulting from the use or inability to use the platform or any
                      emergency medical conditions that require urgent in-person medical care.
                    </p>
                  </div>
                </div>
              </template>

              <!-- Privacy Policy Tab -->
              <template v-else-if="activeTab === 'privacy'">
                <div class="space-y-4 text-xs sm:text-sm">
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
                      compliance with the Philippine Data Privacy Act of 2012 (RA 10173) and medical
                      confidentiality standards.
                    </p>
                  </div>

                  <div>
                    <h4 class="text-foreground font-bold">1. Information We Collect</h4>
                    <p class="text-muted-foreground mt-1">
                      We collect basic personal information (name, email, contact details),
                      professional licensing credentials (for doctors), and sensitive health data
                      including dermatological photos and consultation notes submitted during
                      assessments.
                    </p>
                  </div>

                  <div>
                    <h4 class="text-foreground font-bold">2. Purpose of Data Processing</h4>
                    <p class="text-muted-foreground mt-1">
                      Collected data is used exclusively to facilitate teleconsultation services,
                      schedule appointments, generate assistive AI triage findings for review by
                      your doctor, and maintain your digital medical records.
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
                      deletion of your personal data, subject to statutory medical record retention
                      requirements.
                    </p>
                  </div>

                  <div>
                    <h4 class="text-foreground font-bold">5. Cookies & Security Identifiers</h4>
                    <p class="text-muted-foreground mt-1">
                      We utilize essential session and device verification cookies to maintain
                      secure authentication and protect clinical communications from unauthorized
                      automated bots.
                    </p>
                  </div>
                </div>
              </template>

              <!-- Cookie & Device Security Tab -->
              <template v-else-if="activeTab === 'cookies'">
                <div class="space-y-4 text-xs sm:text-sm">
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
                      identifiers exclusively to protect accounts, prevent spam registrations, and
                      safeguard sensitive clinical data.
                    </p>
                  </div>

                  <div>
                    <h4 class="text-foreground font-bold">1. What Are Security Cookies?</h4>
                    <p class="text-muted-foreground mt-1">
                      Cookies are small, encrypted text tokens stored in your browser. DermAssist
                      uses essential cookies strictly necessary to maintain your authenticated
                      session and protect communications between you and your healthcare providers.
                    </p>
                  </div>

                  <div>
                    <h4 class="text-foreground font-bold">
                      2. Device Verification & Anti-Spam Protection
                    </h4>
                    <p class="text-muted-foreground mt-1">
                      To prevent automated dummy accounts and fraudulent activity, our system
                      associates a unique cryptographic device identifier with active sessions. This
                      protects legitimate patients and clinic personnel from unauthorized
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
                      verification permanently activates the account. Overdue unverified accounts
                      are automatically deactivated to maintain data integrity.
                    </p>
                  </div>

                  <div>
                    <h4 class="text-foreground font-bold">4. Managing Preferences</h4>
                    <p class="text-muted-foreground mt-1">
                      You may adjust your browser cookie settings at any time. Declining
                      non-essential cookies will not hinder your clinical consultations or access to
                      doctor appointments once your account is verified.
                    </p>
                  </div>
                </div>
              </template>
            </div>

            <!-- Modal Footer -->
            <div
              class="border-border/40 bg-muted/20 flex shrink-0 items-center justify-between border-t px-6 py-4"
            >
              <span class="text-muted-foreground text-xs"> Last updated: September 2026 </span>
              <div class="flex items-center gap-2">
                <AppButton
                  variant="ghost"
                  size="sm"
                  @click="close"
                >
                  Close
                </AppButton>
                <AppButton
                  size="sm"
                  @click="accept"
                >
                  <Icon
                    name="lucide:check"
                    class="mr-1 h-4 w-4"
                  />
                  I Accept & Agree
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
