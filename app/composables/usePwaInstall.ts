import { ref, onMounted } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const canInstall = ref(false)
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

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt.value) return false

    try {
      await deferredPrompt.value.prompt()
      const choice = await deferredPrompt.value.userChoice
      deferredPrompt.value = null
      canInstall.value = false
      return choice.outcome === 'accepted'
    } catch {
      return false
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
      if (sessionStorage.getItem('dermassist_pwa_dismissed') === 'true') {
        isDismissed.value = true
      }

      window.addEventListener('beforeinstallprompt', (e: Event) => {
        e.preventDefault()
        deferredPrompt.value = e as BeforeInstallPromptEvent
        canInstall.value = true
      })

      window.addEventListener('appinstalled', () => {
        isInstalled.value = true
        canInstall.value = false
        deferredPrompt.value = null
      })
    }
  })

  return {
    canInstall,
    isInstalled,
    isDismissed,
    promptInstall,
    dismissPrompt
  }
}
