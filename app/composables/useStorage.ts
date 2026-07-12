export const useStorage = () => {
  const config = useRuntimeConfig()
  const storageBase = config.public.storageBase

  /**
   * Helper to construct a full storage URL from a relative path.
   * Path: "profile/user1.jpg" -> "http://localhost:8000/storage/profile/user1.jpg"
   */
  const getStorageUrl = (path: string | null | undefined): string => {
    if (!path) {
      return ''
    }

    let cleanPath = path

    // If it's a full URL
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      // If it points to an external service like ui-avatars.com, return as-is
      if (
        !cleanPath.includes('localhost') &&
        !cleanPath.includes('127.0.0.1') &&
        !cleanPath.includes('192.168.') &&
        !cleanPath.includes('DermAssist-API.test') &&
        !cleanPath.includes('ngrok')
      ) {
        return cleanPath
      }

      // Extract path after /storage/
      const storageIndex = cleanPath.indexOf('/storage/')
      if (storageIndex !== -1) {
        cleanPath = cleanPath.substring(storageIndex + 9)
      } else {
        try {
          const urlObj = new URL(cleanPath)
          cleanPath = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname
        } catch (e) {
          // Ignore
        }
      }
    }

    // Clean leading slash or storage/ prefix
    cleanPath = cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath
    if (cleanPath.startsWith('storage/')) {
      cleanPath = cleanPath.substring(8)
    }

    // Always route through the Nuxt proxy endpoint /storage/...
    return `/storage/${cleanPath}`
  }

  return {
    getStorageUrl
  }
}
