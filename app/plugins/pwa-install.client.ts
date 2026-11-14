import { defineNuxtPlugin } from '#imports'
import { ref } from 'vue'

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export const globalDeferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
export const globalCanInstall = ref(false)

export default defineNuxtPlugin(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Prevent browser default mini-infobar and save deferred event
      e.preventDefault()
      globalDeferredPrompt.value = e as BeforeInstallPromptEvent
      globalCanInstall.value = true
    })

    window.addEventListener('appinstalled', () => {
      globalCanInstall.value = false
      globalDeferredPrompt.value = null
    })
  }
})
