export const useHaptics = () => {
  const isSupported = (): boolean => {
    return typeof window !== 'undefined' && 'vibrate' in navigator
  }

  const vibrate = (pattern: number | number[]) => {
    if (isSupported()) {
      try {
        navigator.vibrate(pattern)
      } catch {
        // Silently skip if vibration is not permitted by user agent
      }
    }
  }

  const tap = () => vibrate(15)
  const success = () => vibrate([30, 40, 30])
  const error = () => vibrate([50, 60, 50])
  const scanCapture = () => vibrate(40)

  return {
    isSupported,
    vibrate,
    tap,
    success,
    error,
    scanCapture
  }
}
