import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { twoFactorService } from '~/api/auth/TwoFactorService'

export const useTwoFactor = () => {
  const isLoading = ref(false)
  const isEnrolling = ref(false)
  const isVerifying = ref(false)
  const isDisabling = ref(false)

  const secretKey = ref('')
  const qrCodeSvg = ref('')
  const otpauthUrl = ref('')
  const recoveryCodes = ref<string[]>([])

  const startEnrollment = async () => {
    isEnrolling.value = true
    try {
      const response = await twoFactorService.enable()
      secretKey.value = response.secret
      qrCodeSvg.value = response.qr_code_svg
      otpauthUrl.value = response.otpauth_url
      return true
    } catch (error: any) {
      toast.error(error?.message || 'Failed to initialize 2FA setup. Please try again.')
      return false
    } finally {
      isEnrolling.value = false
    }
  }

  const confirmEnrollment = async (code: string) => {
    if (!code || code.length !== 6) {
      toast.error('Please enter a valid 6-digit verification code.')
      return false
    }

    isVerifying.value = true
    try {
      const response = await twoFactorService.confirm(code)
      recoveryCodes.value = response.recovery_codes || []
      toast.success('Two-Factor Authentication activated successfully!')
      return true
    } catch (error: any) {
      toast.error(error?.message || 'Invalid verification code. Please check your authenticator.')
      return false
    } finally {
      isVerifying.value = false
    }
  }

  const disableTwoFactor = async (password: string) => {
    if (!password) {
      toast.error('Password is required to disable Two-Factor Authentication.')
      return false
    }

    isDisabling.value = true
    try {
      await twoFactorService.disable(password)
      secretKey.value = ''
      qrCodeSvg.value = ''
      recoveryCodes.value = []
      toast.success('Two-Factor Authentication has been disabled.')
      return true
    } catch (error: any) {
      toast.error(error?.message || 'Failed to disable 2FA. Incorrect password.')
      return false
    } finally {
      isDisabling.value = false
    }
  }

  const regenerateRecoveryCodes = async (password: string) => {
    if (!password) {
      toast.error('Password is required to regenerate recovery codes.')
      return false
    }

    isLoading.value = true
    try {
      const response = await twoFactorService.regenerateRecoveryCodes(password)
      recoveryCodes.value = response.recovery_codes || []
      toast.success('Recovery codes regenerated successfully!')
      return true
    } catch (error: any) {
      toast.error(error?.message || 'Failed to regenerate recovery codes. Incorrect password.')
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    isEnrolling,
    isVerifying,
    isDisabling,
    secretKey,
    qrCodeSvg,
    otpauthUrl,
    recoveryCodes,
    startEnrollment,
    confirmEnrollment,
    disableTwoFactor,
    regenerateRecoveryCodes
  }
}
