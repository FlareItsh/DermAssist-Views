import { toast } from 'vue-sonner'

export interface PasswordNameSource {
  firstName?: string
  lastName?: string
}

export type PasswordSource = string | PasswordNameSource

/**
 * Normalizes text by removing diacritics/accents, stripping non-alphanumeric characters,
 * and converting words to PascalCase.
 * Example: "mary jane" -> "MaryJane", "dela cruz" -> "DelaCruz", "Peña" -> "Pena"
 */
export const sanitizeNameToPascalCase = (name?: string): string => {
  if (!name || typeof name !== 'string') return ''

  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-zA-Z0-9\s]/g, '') // keep letters, numbers, spaces
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

/**
 * Builds the prefix string from either a string prefix (e.g. 'Patient' or 'Secretary')
 * or a { firstName, lastName } object.
 */
export const formatPasswordPrefix = (source?: PasswordSource, fallback = 'Patient'): string => {
  if (!source) return fallback

  if (typeof source === 'string') {
    const cleaned = sanitizeNameToPascalCase(source)
    return cleaned || fallback
  }

  const firstCleaned = sanitizeNameToPascalCase(source.firstName)
  const lastCleaned = sanitizeNameToPascalCase(source.lastName)

  if (firstCleaned && lastCleaned) {
    return `${firstCleaned}${lastCleaned}`
  }

  if (firstCleaned) {
    return firstCleaned
  }

  if (lastCleaned) {
    return lastCleaned
  }

  return fallback
}

export const usePasswordGenerator = () => {
  const generatePin = (): number => {
    return Math.floor(1000 + Math.random() * 9000)
  }

  const generateTemporaryPassword = (
    source?: PasswordSource,
    existingPin?: number | string,
    fallback = 'Patient'
  ): string => {
    const prefix = formatPasswordPrefix(source, fallback)
    let pinStr = existingPin ? String(existingPin) : String(generatePin())

    // Enforce minimum password length >= 8 characters (required by backend)
    // Format is `${prefix}@${pinStr}`
    const baseLength = prefix.length + 1 + pinStr.length
    if (baseLength < 8) {
      const neededDigits = 8 - (prefix.length + 1)
      while (pinStr.length < neededDigits) {
        pinStr += Math.floor(Math.random() * 10).toString()
      }
    }

    return `${prefix}@${pinStr}`
  }

  const copyToClipboard = async (text: string, label = 'Password'): Promise<boolean> => {
    if (!text) return false
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-https or restricted environments
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }
      toast.success(`${label} copied to clipboard!`)
      return true
    } catch (err) {
      console.error('Failed to copy text:', err)
      toast.error('Failed to copy to clipboard.')
      return false
    }
  }

  return {
    generatePin,
    generateTemporaryPassword,
    formatPasswordPrefix,
    sanitizeNameToPascalCase,
    copyToClipboard
  }
}
