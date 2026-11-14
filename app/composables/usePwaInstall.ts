import { ref, computed, onMounted } from 'vue'
import {
  globalDeferredPrompt,
  globalCanInstall,
  type BeforeInstallPromptEvent
} from '~/plugins/pwa-install.client'

const isInstalled = ref(false)
const isDismissed = ref(false)

export const usePwaInstall = () => {
  const checkInstalled = () => {
    if (typeof window === 'undefined') return false
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isIosStandalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    return isStandalone || isIosStandalone
  }

  const isBrave = ref(false)
  const isIos = ref(false)

  const canInstall = computed(() => {
    return !isInstalled.value && !isDismissed.value
  })

  const hasNativePrompt = computed(() => {
    return globalCanInstall.value && !!globalDeferredPrompt.value
  })

  const promptInstall = async (): Promise<{
    success: boolean
    method: 'native' | 'instruction'
    instruction?: string
  }> => {
    if (globalDeferredPrompt.value) {
      try {
        await globalDeferredPrompt.value.prompt()
        const choice = await globalDeferredPrompt.value.userChoice
        globalDeferredPrompt.value = null
        globalCanInstall.value = false
        if (choice.outcome === 'accepted') {
          isInstalled.value = true
          return { success: true, method: 'native' }
        }
        return { success: false, method: 'native' }
      } catch {
        // Fall back to instructions if native prompt fails
      }
    }

    if (isIos.value) {
      return {
        success: false,
        method: 'instruction',
        instruction: 'Tap the Share icon at the bottom of Safari, then select "Add to Home Screen".'
      }
    }

    return {
      success: false,
      method: 'instruction',
      instruction:
        'In Brave: Look for the Install icon in the right side of the address bar, or click Menu (☰) -> "Install DermAssist...".'
    }
  }

  const dismissPrompt = () => {
    isDismissed.value = true
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dermassist_pwa_dismissed', 'true')
    }
  }

  onMounted(() => {
    isInstalled.value = checkInstalled()

    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase()
      isIos.value = /iphone|ipad|ipod/.test(ua)
      isBrave.value = (navigator as unknown as { brave?: unknown }).brave !== undefined

      if (sessionStorage.getItem('dermassist_pwa_dismissed') === 'true') {
        isDismissed.value = true
      }

      window.addEventListener('appinstalled', () => {
        isInstalled.value = true
        globalCanInstall.value = false
        globalDeferredPrompt.value = null
      })
    }
  })

  return {
    canInstall,
    hasNativePrompt,
    isInstalled,
    isDismissed,
    isBrave,
    isIos,
    promptInstall,
    dismissPrompt
  }
}
