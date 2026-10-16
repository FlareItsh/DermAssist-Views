<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue'
  import { toast } from 'vue-sonner'
  import { userService } from '~/api/user/UserService'
  import {
    evaluatePasswordCriteria,
    isPasswordStrong as checkPasswordStrong
  } from '~/composables/useFormSanitizer'

  interface Props {
    userUuid: string
    title?: string
    subtitle?: string
    idPrefix?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    title: 'Change Password',
    subtitle: 'Ensure your account is using a long, secure password to protect clinical records.',
    idPrefix: 'pwd'
  })

  const passwordForm = reactive({
    current_password: '',
    new_password: '',
    new_password_confirmation: ''
  })

  const touched = reactive({
    current_password: false,
    new_password: false,
    new_password_confirmation: false
  })

  const errors = reactive({
    current_password: '',
    new_password: '',
    new_password_confirmation: ''
  })

  const showCurrentPassword = ref(false)
  const showNewPassword = ref(false)
  const showConfirmPassword = ref(false)
  const isChangingPassword = ref(false)
  const generalPasswordError = ref<string | null>(null)

  const passwordCriteria = computed(() => evaluatePasswordCriteria(passwordForm.new_password))
  const isPasswordStrong = computed(() => checkPasswordStrong(passwordForm.new_password))

  const markTouched = (
    field: 'current_password' | 'new_password' | 'new_password_confirmation'
  ) => {
    touched[field] = true
    validateField(field)
  }

  const validateField = (
    field: 'current_password' | 'new_password' | 'new_password_confirmation'
  ) => {
    if (!touched[field]) return

    switch (field) {
      case 'current_password':
        if (!passwordForm.current_password) {
          errors.current_password = 'Please enter your current password.'
        } else {
          errors.current_password = ''
        }
        break
      case 'new_password':
        if (!passwordForm.new_password) {
          errors.new_password = 'New password is required.'
        } else if (passwordForm.new_password.length < 8) {
          errors.new_password = 'Minimum 8 characters.'
        } else if (!isPasswordStrong.value) {
          errors.new_password = 'Must meet all password criteria below.'
        } else {
          errors.new_password = ''
        }
        if (touched.new_password_confirmation) {
          validateField('new_password_confirmation')
        }
        break
      case 'new_password_confirmation':
        if (!passwordForm.new_password_confirmation) {
          errors.new_password_confirmation = 'Please confirm your new password.'
        } else if (passwordForm.new_password_confirmation !== passwordForm.new_password) {
          errors.new_password_confirmation = 'Passwords do not match.'
        } else {
          errors.new_password_confirmation = ''
        }
        break
    }
  }

  // Real-time watchers for dynamic validation
  watch(
    () => passwordForm.current_password,
    () => {
      generalPasswordError.value = null
      if (touched.current_password) validateField('current_password')
    }
  )

  watch(
    () => passwordForm.new_password,
    () => {
      generalPasswordError.value = null
      if (touched.new_password) validateField('new_password')
    }
  )

  watch(
    () => passwordForm.new_password_confirmation,
    () => {
      generalPasswordError.value = null
      if (touched.new_password_confirmation) validateField('new_password_confirmation')
    }
  )

  const canSubmit = computed(() => {
    return (
      Boolean(passwordForm.current_password) &&
      Boolean(passwordForm.new_password) &&
      Boolean(passwordForm.new_password_confirmation) &&
      isPasswordStrong.value &&
      passwordForm.new_password === passwordForm.new_password_confirmation &&
      !errors.current_password &&
      !errors.new_password &&
      !errors.new_password_confirmation &&
      !isChangingPassword.value
    )
  })

  const handlePasswordChange = async () => {
    generalPasswordError.value = null
    touched.current_password = true
    touched.new_password = true
    touched.new_password_confirmation = true

    validateField('current_password')
    validateField('new_password')
    validateField('new_password_confirmation')

    if (errors.current_password || errors.new_password || errors.new_password_confirmation) {
      toast.error('Please resolve the errors in the form before submitting.')
      return
    }

    if (!isPasswordStrong.value) {
      toast.error('New password must satisfy all security requirements.')
      return
    }

    isChangingPassword.value = true
    try {
      await userService.update(props.userUuid, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        new_password_confirmation: passwordForm.new_password_confirmation
      })

      toast.success('Password updated successfully!')

      // Reset form and states
      passwordForm.current_password = ''
      passwordForm.new_password = ''
      passwordForm.new_password_confirmation = ''
      touched.current_password = false
      touched.new_password = false
      touched.new_password_confirmation = false
      errors.current_password = ''
      errors.new_password = ''
      errors.new_password_confirmation = ''
      generalPasswordError.value = null
    } catch (err: any) {
      const apiErrors = err?.response?.data?.errors || err?.data?.errors
      let msg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to update password.'

      if (apiErrors && typeof apiErrors === 'object') {
        if (apiErrors.current_password?.[0]) {
          errors.current_password = apiErrors.current_password[0]
          touched.current_password = true
          msg = apiErrors.current_password[0]
        }
        if (apiErrors.new_password?.[0]) {
          errors.new_password = apiErrors.new_password[0]
          touched.new_password = true
          msg = apiErrors.new_password[0]
        }
        if (apiErrors.new_password_confirmation?.[0]) {
          errors.new_password_confirmation = apiErrors.new_password_confirmation[0]
          touched.new_password_confirmation = true
          msg = apiErrors.new_password_confirmation[0]
        }
      }

      generalPasswordError.value = msg
      toast.error(msg)
    } finally {
      isChangingPassword.value = false
    }
  }
</script>

<template>
  <div
    class="border-border bg-foreground/[0.01] flex flex-col justify-between rounded-2xl border p-5 sm:p-6"
  >
    <div>
      <!-- Header -->
      <div class="mb-5 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div
            class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
          >
            <Icon
              name="heroicons:key-20-solid"
              size="22"
            />
          </div>
          <div>
            <h3 class="text-foreground text-base font-bold sm:text-lg">
              {{ title }}
            </h3>
            <p class="text-muted-foreground mt-0.5 text-xs">
              {{ subtitle }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-border/60 mb-6 h-px"></div>

      <form
        @submit.prevent="handlePasswordChange"
        class="space-y-4"
      >
        <!-- General Server Error Alert -->
        <div
          v-if="generalPasswordError"
          class="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-2xl border p-3.5 text-xs font-semibold"
        >
          <Icon
            name="heroicons:exclamation-circle-20-solid"
            size="16"
            class="shrink-0"
          />
          <span>{{ generalPasswordError }}</span>
        </div>

        <!-- 1. Current Password Field -->
        <div class="flex flex-col gap-1.5">
          <label
            :for="`${idPrefix}_current_password`"
            class="text-foreground/70 cursor-pointer text-xs font-bold tracking-wider uppercase"
          >
            Current Password
          </label>
          <div class="relative">
            <input
              :id="`${idPrefix}_current_password`"
              v-model="passwordForm.current_password"
              :type="showCurrentPassword ? 'text' : 'password'"
              autocomplete="current-password"
              class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 pr-11 text-sm font-medium transition-all outline-none"
              :class="{
                'border-rose-400 focus:border-rose-500':
                  errors.current_password && touched.current_password
              }"
              placeholder="Enter current password"
              required
              @blur="markTouched('current_password')"
              @input="markTouched('current_password')"
            />
            <button
              type="button"
              :aria-label="showCurrentPassword ? 'Hide current password' : 'Show current password'"
              :aria-pressed="showCurrentPassword"
              @click="showCurrentPassword = !showCurrentPassword"
              class="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer p-1"
            >
              <Icon
                :name="
                  showCurrentPassword ? 'heroicons:eye-slash-20-solid' : 'heroicons:eye-20-solid'
                "
                size="18"
              />
            </button>
          </div>
          <p
            v-if="errors.current_password && touched.current_password"
            class="mt-1 text-xs font-medium text-rose-500"
          >
            {{ errors.current_password }}
          </p>
        </div>

        <!-- 2. New Password Field -->
        <div class="flex flex-col gap-1.5">
          <label
            :for="`${idPrefix}_new_password`"
            class="text-foreground/70 cursor-pointer text-xs font-bold tracking-wider uppercase"
          >
            New Password
          </label>
          <div class="relative">
            <input
              :id="`${idPrefix}_new_password`"
              v-model="passwordForm.new_password"
              :type="showNewPassword ? 'text' : 'password'"
              autocomplete="new-password"
              class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 pr-11 text-sm font-medium transition-all outline-none"
              :class="{
                'border-rose-400 focus:border-rose-500': errors.new_password && touched.new_password
              }"
              placeholder="Enter new password"
              required
              @blur="markTouched('new_password')"
              @input="markTouched('new_password')"
            />
            <button
              type="button"
              :aria-label="showNewPassword ? 'Hide new password' : 'Show new password'"
              :aria-pressed="showNewPassword"
              @click="showNewPassword = !showNewPassword"
              class="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer p-1"
            >
              <Icon
                :name="showNewPassword ? 'heroicons:eye-slash-20-solid' : 'heroicons:eye-20-solid'"
                size="18"
              />
            </button>
          </div>
          <p
            v-if="errors.new_password && touched.new_password"
            class="mt-1 text-xs font-medium text-rose-500"
          >
            {{ errors.new_password }}
          </p>
        </div>

        <!-- Password Requirements Checklist (matching Register page) -->
        <div
          v-if="passwordForm.new_password || touched.new_password"
          class="border-border/50 bg-muted/30 rounded-xl border p-2.5 transition-all"
        >
          <p class="text-foreground/70 mb-1.5 text-[11px] font-medium">Password Requirements:</p>
          <div class="grid grid-cols-2 gap-1.5 text-[11px]">
            <div
              class="flex items-center gap-1.5 transition-colors"
              :class="
                passwordCriteria.minLength
                  ? 'font-medium text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              "
            >
              <Icon
                :name="passwordCriteria.minLength ? 'lucide:check-circle-2' : 'lucide:circle'"
                class="h-3.5 w-3.5 shrink-0"
              />
              <span>At least 8 characters</span>
            </div>
            <div
              class="flex items-center gap-1.5 transition-colors"
              :class="
                passwordCriteria.hasUpper
                  ? 'font-medium text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              "
            >
              <Icon
                :name="passwordCriteria.hasUpper ? 'lucide:check-circle-2' : 'lucide:circle'"
                class="h-3.5 w-3.5 shrink-0"
              />
              <span>One uppercase letter</span>
            </div>
            <div
              class="flex items-center gap-1.5 transition-colors"
              :class="
                passwordCriteria.hasLower
                  ? 'font-medium text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              "
            >
              <Icon
                :name="passwordCriteria.hasLower ? 'lucide:check-circle-2' : 'lucide:circle'"
                class="h-3.5 w-3.5 shrink-0"
              />
              <span>One lowercase letter</span>
            </div>
            <div
              class="flex items-center gap-1.5 transition-colors"
              :class="
                passwordCriteria.hasNumber
                  ? 'font-medium text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              "
            >
              <Icon
                :name="passwordCriteria.hasNumber ? 'lucide:check-circle-2' : 'lucide:circle'"
                class="h-3.5 w-3.5 shrink-0"
              />
              <span>One number (0-9)</span>
            </div>
            <div
              class="col-span-2 flex items-center gap-1.5 transition-colors"
              :class="
                passwordCriteria.hasSpecial
                  ? 'font-medium text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              "
            >
              <Icon
                :name="passwordCriteria.hasSpecial ? 'lucide:check-circle-2' : 'lucide:circle'"
                class="h-3.5 w-3.5 shrink-0"
              />
              <span>One special symbol (!@#$%^&*...)</span>
            </div>
          </div>
        </div>

        <!-- 3. Confirm New Password Field -->
        <div class="flex flex-col gap-1.5">
          <label
            :for="`${idPrefix}_confirm_password`"
            class="text-foreground/70 cursor-pointer text-xs font-bold tracking-wider uppercase"
          >
            Confirm New Password
          </label>
          <div class="relative">
            <input
              :id="`${idPrefix}_confirm_password`"
              v-model="passwordForm.new_password_confirmation"
              :type="showConfirmPassword ? 'text' : 'password'"
              autocomplete="new-password"
              class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 pr-11 text-sm font-medium transition-all outline-none"
              :class="{
                'border-rose-400 focus:border-rose-500':
                  errors.new_password_confirmation && touched.new_password_confirmation
              }"
              placeholder="Confirm new password"
              required
              @blur="markTouched('new_password_confirmation')"
              @input="markTouched('new_password_confirmation')"
            />
            <button
              type="button"
              :aria-label="showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'"
              :aria-pressed="showConfirmPassword"
              @click="showConfirmPassword = !showConfirmPassword"
              class="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer p-1"
            >
              <Icon
                :name="
                  showConfirmPassword ? 'heroicons:eye-slash-20-solid' : 'heroicons:eye-20-solid'
                "
                size="18"
              />
            </button>
          </div>
          <p
            v-if="errors.new_password_confirmation && touched.new_password_confirmation"
            class="mt-1 text-xs font-medium text-rose-500"
          >
            {{ errors.new_password_confirmation }}
          </p>
        </div>

        <!-- Submit Button -->
        <div class="pt-2">
          <AppButton
            type="submit"
            :loading="isChangingPassword"
            :disabled="!canSubmit"
            class="rounded-xl px-5 py-2.5 font-semibold"
          >
            Update Password
          </AppButton>
        </div>
      </form>
    </div>
  </div>
</template>
