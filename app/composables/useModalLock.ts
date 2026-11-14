import { ref, computed, watch, onUnmounted, type Ref } from 'vue'

const activeModalCount = ref(0)

export const useModalLock = () => {
  const isAnyModalOpen = computed(() => activeModalCount.value > 0)

  const registerModal = (isOpenRef: Ref<boolean | undefined>) => {
    let wasLocked = false

    const lock = () => {
      if (wasLocked) return
      wasLocked = true
      activeModalCount.value++
      if (import.meta.client) {
        document.body.style.overflow = 'hidden'
        document.body.classList.add('modal-open')
        document.body.setAttribute('data-modal-open', 'true')
      }
    }

    const unlock = () => {
      if (!wasLocked) return
      wasLocked = false
      activeModalCount.value = Math.max(0, activeModalCount.value - 1)
      if (import.meta.client && activeModalCount.value === 0) {
        document.body.style.overflow = ''
        document.body.classList.remove('modal-open')
        document.body.removeAttribute('data-modal-open')
      }
    }

    watch(
      isOpenRef,
      (open) => {
        if (open) {
          lock()
        } else {
          unlock()
        }
      },
      { immediate: true }
    )

    onUnmounted(() => {
      unlock()
    })
  }

  return {
    activeModalCount,
    isAnyModalOpen,
    registerModal
  }
}
