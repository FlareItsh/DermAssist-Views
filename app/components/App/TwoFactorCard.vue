<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { toast } from 'vue-sonner'
  import { useTwoFactor } from '~/composables/useTwoFactor'

  interface Props {
    enabled?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    enabled: false
  })

  const emit = defineEmits<{
    (e: 'updated'): void
  }>()

  const {
    isEnrolling,
    isVerifying,
    isDisabling,
    isLoading,
    secretKey,
    qrCodeSvg,
    recoveryCodes,
    startEnrollment,
    confirmEnrollment,
    disableTwoFactor,
    regenerateRecoveryCodes
  } = useTwoFactor()

  // Modal display states
  const showSetupModal = ref(false)
  const setupStep = ref<'verify' | 'recovery'>('verify')
  const verificationCode = ref('')
  const isCopiedKey = ref(false)

  // Disable modal state
  const showDisableModal = ref(false)
  const disablePassword = ref('')

  // Regenerate codes modal state
  const showRegenModal = ref(false)
  const regenPassword = ref('')
  const showFreshCodesModal = ref(false)

  // Copy helper
  const copySecretKey = async () => {
    if (!secretKey.value) return
    try {
      await navigator.clipboard.writeText(secretKey.value)
      isCopiedKey.value = true
      toast.success('2FA secret key copied to clipboard!')
      setTimeout(() => {
        isCopiedKey.value = false
      }, 2000)
    } catch {
      toast.error('Failed to copy secret key.')
    }
  }

  const copyAllRecoveryCodes = async () => {
    if (!recoveryCodes.value.length) return
    try {
      await navigator.clipboard.writeText(recoveryCodes.value.join('\n'))
      toast.success('All recovery codes copied to clipboard!')
    } catch {
      toast.error('Failed to copy recovery codes.')
    }
  }

  const downloadRecoveryCodes = () => {
    if (!recoveryCodes.value.length) return
    const textContent =
      `DermAssist Two-Factor Authentication Recovery Codes\n` +
      `Generated: ${new Date().toISOString()}\n\n` +
      `Keep these codes safe. Each recovery code can be used once if you lose access to your authenticator app:\n\n` +
      recoveryCodes.value.map((code, index) => `${index + 1}. ${code}`).join('\n') +
      `\n`

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dermassist-2fa-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Recovery codes downloaded.')
  }

  // Setup modal handlers
  const handleOpenSetupModal = async () => {
    verificationCode.value = ''
    setupStep.value = 'verify'
    const success = await startEnrollment()
    if (success) {
      showSetupModal.value = true
    }
  }

  const handleCloseSetupModal = () => {
    showSetupModal.value = false
    verificationCode.value = ''
    setupStep.value = 'verify'
  }

  const handleVerifyAndActivate = async () => {
    const success = await confirmEnrollment(verificationCode.value)
    if (success) {
      setupStep.value = 'recovery'
      emit('updated')
    }
  }

  const handleFinishSetup = () => {
    showSetupModal.value = false
    setupStep.value = 'verify'
    verificationCode.value = ''
    emit('updated')
  }

  // Disable modal handlers
  const handleOpenDisableModal = () => {
    disablePassword.value = ''
    showDisableModal.value = true
  }

  const handleCloseDisableModal = () => {
    showDisableModal.value = false
    disablePassword.value = ''
  }

  const handleConfirmDisable = async () => {
    const success = await disableTwoFactor(disablePassword.value)
    if (success) {
      showDisableModal.value = false
      disablePassword.value = ''
      emit('updated')
    }
  }

  // Regenerate codes modal handlers
  const handleOpenRegenModal = () => {
    regenPassword.value = ''
    showRegenModal.value = true
  }

  const handleCloseRegenModal = () => {
    showRegenModal.value = false
    regenPassword.value = ''
  }

  const handleConfirmRegenerate = async () => {
    const success = await regenerateRecoveryCodes(regenPassword.value)
    if (success) {
      showRegenModal.value = false
      regenPassword.value = ''
      showFreshCodesModal.value = true
    }
  }

  const handleCloseFreshCodesModal = () => {
    showFreshCodesModal.value = false
  }
</script>

<template>
  <div class="border-border bg-card rounded-3xl border p-6 shadow-sm sm:p-7">
    <div class="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600"
        >
          <Icon
            name="heroicons:device-phone-mobile-20-solid"
            size="22"
          />
        </div>
        <div>
          <h3 class="text-foreground text-base font-bold">Two-Factor Authentication (2FA)</h3>
          <p class="text-muted-foreground mt-0.5 text-xs">
            Strengthen account security by requiring a verification code when signing in.
          </p>
        </div>
      </div>

      <div
        v-if="enabled"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
      >
        <span class="relative flex h-2 w-2">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
          ></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </span>
        <span>Active</span>
      </div>
      <div
        v-else
        class="bg-foreground/5 text-muted-foreground border-border inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
      >
        <span class="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500"></span>
        <span>Disabled</span>
      </div>
    </div>

    <div class="bg-border/60 mb-5 h-px"></div>

    <div class="space-y-4">
      <!-- Benefits Callout -->
      <div class="border-border bg-foreground/[0.02] space-y-3 rounded-2xl border p-4">
        <h4 class="text-foreground text-sm font-bold">Why enable 2FA?</h4>
        <p class="text-muted-foreground text-xs leading-relaxed">
          Two-Factor Authentication prevents unauthorized access to clinical consultations, patient
          health records, and prescription data even if your credentials are leaked.
        </p>
        <div class="text-muted-foreground space-y-2 pt-1 text-xs">
          <div class="flex items-center gap-2">
            <Icon
              name="heroicons:check-circle"
              class="text-primary h-4 w-4 shrink-0"
            />
            <span>Generates temporary time-based passcodes (TOTP)</span>
          </div>
          <div class="flex items-center gap-2">
            <Icon
              name="heroicons:check-circle"
              class="text-primary h-4 w-4 shrink-0"
            />
            <span>Compatible with Google Authenticator, Authy, Microsoft</span>
          </div>
        </div>
      </div>

      <!-- Action box: Disabled State -->
      <div
        v-if="!enabled"
        class="border-border bg-foreground/[0.02] flex flex-col items-start justify-between gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center"
      >
        <div class="space-y-1">
          <h5 class="text-foreground text-xs font-bold">Authenticator Application</h5>
          <p class="text-muted-foreground text-xs">
            Pair your device to start generating one-time passcodes.
          </p>
        </div>

        <AppButton
          type="button"
          :loading="isEnrolling"
          @click="handleOpenSetupModal"
          class="shrink-0"
        >
          <Icon
            name="heroicons:qr-code-20-solid"
            class="mr-1.5 h-4 w-4"
          />
          Configure 2FA
        </AppButton>
      </div>

      <!-- Action box: Active State -->
      <div
        v-else
        class="border-border bg-foreground/[0.02] flex flex-col items-start justify-between gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center"
      >
        <div class="space-y-1">
          <div class="flex items-center gap-1.5">
            <Icon
              name="heroicons:shield-check-solid"
              class="h-4 w-4 text-emerald-500"
            />
            <h5 class="text-foreground text-xs font-bold">Authenticator Linked</h5>
          </div>
          <p class="text-muted-foreground text-xs">
            Your account is guarded with TOTP passcodes during login.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <AppButton
            variant="outline"
            type="button"
            @click="handleOpenRegenModal"
            class="text-xs"
          >
            <Icon
              name="heroicons:key-20-solid"
              class="mr-1.5 h-3.5 w-3.5"
            />
            Recovery Codes
          </AppButton>
          <AppButton
            variant="outline"
            type="button"
            @click="handleOpenDisableModal"
            class="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
          >
            <Icon
              name="heroicons:trash-20-solid"
              class="mr-1.5 h-3.5 w-3.5"
            />
            Disable 2FA
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Teleported Setup Modal -->
    <Teleport to="body">
      <div
        v-if="showSetupModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      >
        <div
          class="bg-card border-border animate-in fade-in zoom-in-95 w-full max-w-md space-y-5 rounded-3xl border p-6 shadow-2xl sm:p-7"
        >
          <!-- Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600"
              >
                <Icon
                  name="heroicons:qr-code-20-solid"
                  size="22"
                />
              </div>
              <div>
                <h3 class="text-foreground text-lg font-bold">
                  {{ setupStep === 'verify' ? 'Configure 2FA' : 'Recovery Codes' }}
                </h3>
                <p class="text-muted-foreground text-xs">
                  {{
                    setupStep === 'verify'
                      ? 'Scan code with your authenticator app'
                      : 'Store these emergency codes in a safe place'
                  }}
                </p>
              </div>
            </div>
            <button
              type="button"
              @click="handleCloseSetupModal"
              class="text-muted-foreground hover:text-foreground cursor-pointer rounded-xl p-1"
            >
              <Icon
                name="heroicons:x-mark-20-solid"
                size="20"
              />
            </button>
          </div>

          <!-- Step 1: Scan and Verify Code -->
          <template v-if="setupStep === 'verify'">
            <!-- QR Display -->
            <div class="space-y-2 text-center">
              <div
                class="border-border mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border bg-white p-3 shadow-xs dark:bg-zinc-950"
              >
                <div
                  v-if="qrCodeSvg"
                  class="flex h-full w-full items-center justify-center [&>svg]:h-full [&>svg]:w-full"
                  v-html="qrCodeSvg"
                />
                <div
                  v-else
                  class="text-muted-foreground flex flex-col items-center justify-center gap-2"
                >
                  <Icon
                    name="lucide:loader-2"
                    class="text-primary h-6 w-6 animate-spin"
                  />
                  <span class="text-xs">Generating code...</span>
                </div>
              </div>

              <!-- Monospace Secret Key -->
              <div class="flex items-center justify-center gap-2 pt-1">
                <span class="text-foreground font-mono text-xs font-bold">{{ secretKey }}</span>
                <button
                  type="button"
                  @click="copySecretKey"
                  class="text-primary hover:text-primary-hover cursor-pointer p-1 text-xs"
                  title="Copy secret key"
                >
                  <Icon
                    :name="
                      isCopiedKey
                        ? 'heroicons:check-20-solid'
                        : 'heroicons:clipboard-document-20-solid'
                    "
                    size="16"
                  />
                </button>
              </div>
            </div>

            <!-- Code Input Form -->
            <div class="space-y-2">
              <label
                for="two_factor_activation_code"
                class="text-foreground/70 cursor-pointer text-xs font-bold tracking-wider uppercase"
              >
                Enter 6-Digit Code
              </label>
              <input
                id="two_factor_activation_code"
                v-model="verificationCode"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="one-time-code"
                maxlength="6"
                class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-center font-mono text-lg font-bold tracking-widest transition-all outline-none"
                placeholder="000000"
                @keyup.enter="handleVerifyAndActivate"
              />
            </div>

            <!-- Modal Action Buttons -->
            <div class="flex items-center justify-end gap-3 pt-2">
              <AppButton
                variant="outline"
                type="button"
                @click="handleCloseSetupModal"
              >
                Cancel
              </AppButton>
              <AppButton
                type="button"
                :loading="isVerifying"
                :disabled="verificationCode.length !== 6"
                @click="handleVerifyAndActivate"
              >
                Verify & Activate
              </AppButton>
            </div>
          </template>

          <!-- Step 2: Recovery Codes Presentation -->
          <template v-else>
            <div
              class="border-warning-border bg-warning-subtle text-warning-text flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs"
            >
              <Icon
                name="heroicons:exclamation-triangle-20-solid"
                size="18"
                class="mt-0.5 shrink-0"
              />
              <p class="leading-relaxed">
                <strong>Important:</strong> If you lose your phone or authenticator app, these
                single-use recovery codes are the only way to regain access. Store them securely.
              </p>
            </div>

            <div
              class="border-border bg-foreground/[0.03] grid grid-cols-2 gap-2 rounded-2xl border p-3.5"
            >
              <div
                v-for="(code, idx) in recoveryCodes"
                :key="idx"
                class="bg-card border-border text-foreground rounded-xl border px-2.5 py-1.5 text-center font-mono text-xs font-bold select-all"
              >
                {{ code }}
              </div>
            </div>

            <div class="flex items-center justify-between gap-2 pt-1">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="copyAllRecoveryCodes"
                  class="text-primary hover:text-primary-hover inline-flex cursor-pointer items-center gap-1 text-xs font-semibold"
                >
                  <Icon
                    name="heroicons:clipboard-document-20-solid"
                    size="15"
                  />
                  Copy All
                </button>
                <span class="text-border">|</span>
                <button
                  type="button"
                  @click="downloadRecoveryCodes"
                  class="text-primary hover:text-primary-hover inline-flex cursor-pointer items-center gap-1 text-xs font-semibold"
                >
                  <Icon
                    name="heroicons:arrow-down-tray-20-solid"
                    size="15"
                  />
                  Download .txt
                </button>
              </div>

              <AppButton
                type="button"
                @click="handleFinishSetup"
              >
                Done
              </AppButton>
            </div>
          </template>
        </div>
      </div>
    </Teleport>

    <!-- Teleported Disable Modal -->
    <Teleport to="body">
      <div
        v-if="showDisableModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      >
        <div
          class="bg-card border-border animate-in fade-in zoom-in-95 w-full max-w-md space-y-5 rounded-3xl border p-6 shadow-2xl sm:p-7"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="bg-destructive/10 text-destructive flex h-10 w-10 items-center justify-center rounded-2xl"
              >
                <Icon
                  name="heroicons:shield-exclamation-20-solid"
                  size="22"
                />
              </div>
              <div>
                <h3 class="text-foreground text-lg font-bold">Disable 2FA</h3>
                <p class="text-muted-foreground text-xs">Confirm with your current password</p>
              </div>
            </div>
            <button
              type="button"
              @click="handleCloseDisableModal"
              class="text-muted-foreground hover:text-foreground cursor-pointer rounded-xl p-1"
            >
              <Icon
                name="heroicons:x-mark-20-solid"
                size="20"
              />
            </button>
          </div>

          <p class="text-muted-foreground text-xs leading-relaxed">
            Disabling Two-Factor Authentication lowers your account protection. Enter your current
            password to proceed.
          </p>

          <div class="space-y-2">
            <label
              for="disable_2fa_password"
              class="text-foreground/70 cursor-pointer text-xs font-bold tracking-wider uppercase"
            >
              Password
            </label>
            <input
              id="disable_2fa_password"
              v-model="disablePassword"
              type="password"
              class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm transition-all outline-none"
              placeholder="Enter current password"
              @keyup.enter="handleConfirmDisable"
            />
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <AppButton
              variant="outline"
              type="button"
              @click="handleCloseDisableModal"
            >
              Cancel
            </AppButton>
            <AppButton
              variant="outline"
              class="border-destructive/30 text-destructive hover:bg-destructive/10"
              type="button"
              :loading="isDisabling"
              :disabled="!disablePassword"
              @click="handleConfirmDisable"
            >
              Disable 2FA
            </AppButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Teleported Regenerate Password Prompt Modal -->
    <Teleport to="body">
      <div
        v-if="showRegenModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      >
        <div
          class="bg-card border-border animate-in fade-in zoom-in-95 w-full max-w-md space-y-5 rounded-3xl border p-6 shadow-2xl sm:p-7"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600"
              >
                <Icon
                  name="heroicons:key-20-solid"
                  size="22"
                />
              </div>
              <div>
                <h3 class="text-foreground text-lg font-bold">Regenerate Recovery Codes</h3>
                <p class="text-muted-foreground text-xs">Confirm with your current password</p>
              </div>
            </div>
            <button
              type="button"
              @click="handleCloseRegenModal"
              class="text-muted-foreground hover:text-foreground cursor-pointer rounded-xl p-1"
            >
              <Icon
                name="heroicons:x-mark-20-solid"
                size="20"
              />
            </button>
          </div>

          <p class="text-muted-foreground text-xs leading-relaxed">
            Regenerating will invalidate your old recovery codes and generate 8 new single-use
            codes. Enter your current password to continue.
          </p>

          <div class="space-y-2">
            <label
              for="regen_2fa_password"
              class="text-foreground/70 cursor-pointer text-xs font-bold tracking-wider uppercase"
            >
              Password
            </label>
            <input
              id="regen_2fa_password"
              v-model="regenPassword"
              type="password"
              class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm transition-all outline-none"
              placeholder="Enter current password"
              @keyup.enter="handleConfirmRegenerate"
            />
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <AppButton
              variant="outline"
              type="button"
              @click="handleCloseRegenModal"
            >
              Cancel
            </AppButton>
            <AppButton
              type="button"
              :loading="isLoading"
              :disabled="!regenPassword"
              @click="handleConfirmRegenerate"
            >
              Regenerate
            </AppButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Teleported Fresh Recovery Codes Display Modal -->
    <Teleport to="body">
      <div
        v-if="showFreshCodesModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      >
        <div
          class="bg-card border-border animate-in fade-in zoom-in-95 w-full max-w-md space-y-5 rounded-3xl border p-6 shadow-2xl sm:p-7"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600"
              >
                <Icon
                  name="heroicons:check-badge-20-solid"
                  size="22"
                />
              </div>
              <div>
                <h3 class="text-foreground text-lg font-bold">New Recovery Codes</h3>
                <p class="text-muted-foreground text-xs">Store these 8 new codes safely</p>
              </div>
            </div>
            <button
              type="button"
              @click="handleCloseFreshCodesModal"
              class="text-muted-foreground hover:text-foreground cursor-pointer rounded-xl p-1"
            >
              <Icon
                name="heroicons:x-mark-20-solid"
                size="20"
              />
            </button>
          </div>

          <div
            class="border-border bg-foreground/[0.03] grid grid-cols-2 gap-2 rounded-2xl border p-3.5"
          >
            <div
              v-for="(code, idx) in recoveryCodes"
              :key="idx"
              class="bg-card border-border text-foreground rounded-xl border px-2.5 py-1.5 text-center font-mono text-xs font-bold select-all"
            >
              {{ code }}
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-1">
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="copyAllRecoveryCodes"
                class="text-primary hover:text-primary-hover inline-flex cursor-pointer items-center gap-1 text-xs font-semibold"
              >
                <Icon
                  name="heroicons:clipboard-document-20-solid"
                  size="15"
                />
                Copy All
              </button>
              <span class="text-border">|</span>
              <button
                type="button"
                @click="downloadRecoveryCodes"
                class="text-primary hover:text-primary-hover inline-flex cursor-pointer items-center gap-1 text-xs font-semibold"
              >
                <Icon
                  name="heroicons:arrow-down-tray-20-solid"
                  size="15"
                />
                Download .txt
              </button>
            </div>

            <AppButton
              type="button"
              @click="handleCloseFreshCodesModal"
            >
              Done
            </AppButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
