export const useFormSanitizer = () => {
  const allowedControlKeys = [
    'Backspace',
    'Tab',
    'Enter',
    'Delete',
    'Escape',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End'
  ]

  /**
   * Strips all numeric digits (0-9) from a name string.
   */
  const sanitizeName = (val: string | null | undefined): string => {
    if (!val) return ''
    return val.replace(/[0-9]/g, '')
  }

  /**
   * Keyboard event handler for name inputs to prevent typing numbers.
   */
  const blockNameKey = (event: KeyboardEvent): void => {
    if (allowedControlKeys.includes(event.key) || event.ctrlKey || event.metaKey) {
      return
    }
    // Block numbers 0-9
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault()
    }
  }

  /**
   * Strips all non-digit characters from age input, preventing negative values and symbols.
   * Clamps to specified maximum age.
   */
  const sanitizeAge = (val: string | number | null | undefined, max = 130): string => {
    if (val === null || val === undefined || val === '') return ''
    const cleaned = String(val).replace(/\D/g, '')
    if (!cleaned) return ''
    const parsed = parseInt(cleaned, 10)
    if (isNaN(parsed)) return ''
    if (parsed > max) return String(max)
    return String(parsed)
  }

  /**
   * Keyboard event handler for age inputs to strictly block negative signs,
   * exponential notation, decimals, plus signs, and non-numeric keys.
   */
  const blockAgeKey = (event: KeyboardEvent): void => {
    if (allowedControlKeys.includes(event.key) || event.ctrlKey || event.metaKey) {
      return
    }
    // Strictly block signs, exponential notation, decimals, and letters
    if (['-', '+', 'e', 'E', '.'].includes(event.key) || !/^[0-9]$/.test(event.key)) {
      event.preventDefault()
    }
  }

  /**
   * Validates a name string according to standard registration rules.
   */
  const validateName = (
    val: string | null | undefined,
    fieldName = 'Name',
    min = 2,
    max = 50,
    required = true
  ): { valid: boolean; error: string } => {
    const trimmed = (val || '').trim()
    if (!trimmed) {
      return required
        ? { valid: false, error: `${fieldName} is required.` }
        : { valid: true, error: '' }
    }
    if (/[0-9]/.test(trimmed)) {
      return { valid: false, error: `${fieldName} cannot contain numbers.` }
    }
    if (trimmed.length < min) {
      return {
        valid: false,
        error: `${fieldName} must be at least ${min} characters.`
      }
    }
    if (trimmed.length > max) {
      return {
        valid: false,
        error: `${fieldName} may not exceed ${max} characters.`
      }
    }
    if (!/^[\p{L}\s\-'.]+$/u.test(trimmed)) {
      return {
        valid: false,
        error: `${fieldName} may only contain letters, spaces, hyphens, and apostrophes.`
      }
    }
    return { valid: true, error: '' }
  }

  /**
   * Validates that age is an integer within acceptable bounds.
   */
  const validateAge = (
    val: string | number | null | undefined,
    min = 0,
    max = 130,
    required = false
  ): { valid: boolean; error: string } => {
    if (val === null || val === undefined || val === '') {
      return required ? { valid: false, error: 'Age is required.' } : { valid: true, error: '' }
    }
    const strVal = String(val).trim()
    if (!/^\d+$/.test(strVal)) {
      return { valid: false, error: 'Age must be a valid non-negative number.' }
    }
    const num = parseInt(strVal, 10)
    if (isNaN(num) || num < min || num > max) {
      return { valid: false, error: `Age must be between ${min} and ${max}.` }
    }
    return { valid: true, error: '' }
  }

  /**
   * Normalizes gender values from various inputs (e.g. 'female', 'Female', 'MALE')
   * to canonical values: 'Female', 'Male', 'Other', 'Prefer not to say'.
   * Maps null, undefined, '', 'not set', 'not_set', 'n/a' to empty string '' (which represents Not Set in dropdowns).
   */
  const normalizeGender = (val: string | null | undefined): string => {
    if (!val) return ''
    const trimmed = String(val).trim().toLowerCase()
    if (trimmed === 'female') return 'Female'
    if (trimmed === 'male') return 'Male'
    if (trimmed === 'other') return 'Other'
    if (trimmed === 'prefer_not_to_say' || trimmed === 'prefer not to say')
      return 'Prefer not to say'
    if (['not set', 'not_set', 'n/a', 'none', 'unset'].includes(trimmed)) return ''
    return val.charAt(0).toUpperCase() + val.slice(1)
  }

  return {
    sanitizeName,
    blockNameKey,
    sanitizeAge,
    blockAgeKey,
    validateName,
    validateAge,
    normalizeGender
  }
}
