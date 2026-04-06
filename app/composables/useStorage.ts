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

    // Return as-is if it's already a full external URL
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }

    // Clean leading slash for consistency
    const cleanPath = path.startsWith('/') ? path.slice(1) : path

    return `${storageBase}/${cleanPath}`
  }

  return {
    getStorageUrl
  }
}
