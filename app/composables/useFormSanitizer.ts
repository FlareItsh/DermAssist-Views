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
export const sanitizeName = (val: string | null | undefined): string => {
  if (!val) return ''
  return val.replace(/[0-9]/g, '')
}

/**
 * Keyboard event handler for name inputs to prevent typing numbers.
 */
export const blockNameKey = (event: KeyboardEvent): void => {
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
export const sanitizeAge = (val: string | number | null | undefined, max = 130): string => {
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
export const blockAgeKey = (event: KeyboardEvent): void => {
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
export const validateName = (
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
export const validateAge = (
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
export const normalizeGender = (val: string | null | undefined): string => {
  if (!val) return ''
  const trimmed = String(val).trim().toLowerCase()
  if (trimmed === 'female') return 'Female'
  if (trimmed === 'male') return 'Male'
  if (trimmed === 'other') return 'Other'
  if (trimmed === 'prefer_not_to_say' || trimmed === 'prefer not to say') return 'Prefer not to say'
  if (['not set', 'not_set', 'n/a', 'none', 'unset'].includes(trimmed)) return ''
  return val.charAt(0).toUpperCase() + val.slice(1)
}

/**
 * Calculates dynamic age from a date of birth.
 * Handles string (YYYY-MM-DD or ISO) and Date objects.
 * Returns exact integer years, or null if invalid or in the future.
 */
export const calculateAge = (dob: string | Date | null | undefined): number | null => {
  if (!dob) return null
  // If it's a date string like 'YYYY-MM-DD', parse parts to avoid timezone shift
  if (typeof dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) {
    const [year, month, day] = dob.trim().split('-').map(Number)
    const birthDate = new Date(year, month - 1, day)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age >= 0 ? age : null
  }

  const birthDate = typeof dob === 'string' ? new Date(dob) : dob
  if (isNaN(birthDate.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age >= 0 ? age : null
}

/**
 * Formats age for UI display (e.g. "28 yrs").
 * Prioritizes date of birth calculation, then falls back to provided age.
 */
export const formatAge = (
  dob: string | Date | null | undefined,
  fallbackAge?: number | string | null
): string => {
  const calculated = calculateAge(dob)
  if (calculated !== null) return `${calculated} yrs`
  if (
    fallbackAge !== null &&
    fallbackAge !== undefined &&
    fallbackAge !== '' &&
    fallbackAge !== 'N/A'
  ) {
    return `${fallbackAge} yrs`
  }
  return 'Age N/A'
}

/**
 * Validates date of birth string (YYYY-MM-DD format).
 * Ensures not future date and not older than 130 years.
 */
export const validateDateOfBirth = (
  dob: string | null | undefined,
  required = false
): { valid: boolean; error: string } => {
  if (!dob || String(dob).trim() === '') {
    return required
      ? { valid: false, error: 'Date of birth is required.' }
      : { valid: true, error: '' }
  }

  const birthDate =
    typeof dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dob.trim())
      ? new Date(Number(dob.slice(0, 4)), Number(dob.slice(5, 7)) - 1, Number(dob.slice(8, 10)))
      : new Date(dob)

  if (isNaN(birthDate.getTime())) {
    return { valid: false, error: 'Please enter a valid date of birth.' }
  }

  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (birthDate > today) {
    return { valid: false, error: 'Date of birth cannot be in the future.' }
  }

  const calculated = calculateAge(birthDate)
  if (calculated !== null && calculated > 130) {
    return { valid: false, error: 'Date of birth cannot exceed 130 years ago.' }
  }

  return { valid: true, error: '' }
}

/**
 * Current date in YYYY-MM-DD format for HTML5 date input :max attribute.
 */
export const todayIsoDate = (() => {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
})()

export const useFormSanitizer = () => ({
  sanitizeName,
  blockNameKey,
  sanitizeAge,
  blockAgeKey,
  validateName,
  validateAge,
  normalizeGender,
  calculateAge,
  formatAge,
  validateDateOfBirth,
  todayIsoDate,
  // Phone & Geolocation Utilities
  COUNTRY_DIAL_CODES,
  detectUserCountry,
  blockPhoneKey,
  sanitizePhoneNumber,
  formatDisplayPhone,
  splitFullPhoneNumber,
  buildFullPhoneNumber,
  validatePhoneNumber
})

export interface CountryDialCode {
  iso: string
  name: string
  dial: string
  flag: string
  placeholder: string
  digits: number[]
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  {
    iso: 'PH',
    name: 'Philippines',
    dial: '+63',
    flag: '🇵🇭',
    placeholder: '917 123 4567',
    digits: [10]
  },
  {
    iso: 'US',
    name: 'United States',
    dial: '+1',
    flag: '🇺🇸',
    placeholder: '202 555 0123',
    digits: [10]
  },
  { iso: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦', placeholder: '416 555 0192', digits: [10] },
  { iso: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬', placeholder: '8123 4567', digits: [8] },
  {
    iso: 'GB',
    name: 'United Kingdom',
    dial: '+44',
    flag: '🇬🇧',
    placeholder: '7911 123456',
    digits: [10, 11]
  },
  {
    iso: 'AU',
    name: 'Australia',
    dial: '+61',
    flag: '🇦🇺',
    placeholder: '412 345 678',
    digits: [9]
  },
  { iso: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵', placeholder: '90 1234 5678', digits: [10] },
  {
    iso: 'AE',
    name: 'United Arab Emirates',
    dial: '+971',
    flag: '🇦🇪',
    placeholder: '50 123 4567',
    digits: [9]
  },
  {
    iso: 'SA',
    name: 'Saudi Arabia',
    dial: '+966',
    flag: '🇸🇦',
    placeholder: '50 123 4567',
    digits: [9]
  },
  { iso: 'QA', name: 'Qatar', dial: '+974', flag: '🇶🇦', placeholder: '3312 3456', digits: [8] },
  { iso: 'KW', name: 'Kuwait', dial: '+965', flag: '🇰🇼', placeholder: '9123 4567', digits: [8] },
  { iso: 'HK', name: 'Hong Kong', dial: '+852', flag: '🇭🇰', placeholder: '9123 4567', digits: [8] },
  {
    iso: 'MY',
    name: 'Malaysia',
    dial: '+60',
    flag: '🇲🇾',
    placeholder: '12 345 6789',
    digits: [9, 10]
  },
  {
    iso: 'NZ',
    name: 'New Zealand',
    dial: '+64',
    flag: '🇳🇿',
    placeholder: '21 123 4567',
    digits: [8, 9, 10]
  },
  {
    iso: 'DE',
    name: 'Germany',
    dial: '+49',
    flag: '🇩🇪',
    placeholder: '151 12345678',
    digits: [10, 11]
  },
  { iso: 'FR', name: 'France', dial: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78', digits: [9] },
  { iso: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹', placeholder: '312 345 6789', digits: [10] },
  { iso: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸', placeholder: '612 345 678', digits: [9] },
  { iso: 'IN', name: 'India', dial: '+91', flag: '🇮🇳', placeholder: '98765 43210', digits: [10] },
  {
    iso: 'KR',
    name: 'South Korea',
    dial: '+82',
    flag: '🇰🇷',
    placeholder: '10 1234 5678',
    digits: [9, 10]
  }
]

export const detectUserCountry = (): CountryDialCode => {
  if (typeof window === 'undefined') {
    return COUNTRY_DIAL_CODES[0]
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const tzLower = tz.toLowerCase()

    if (tzLower.includes('manila') || tzLower.includes('philippine')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'PH') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.startsWith('america/') || tzLower.startsWith('us/')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'US') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.startsWith('canada/')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'CA') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('singapore')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'SG') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('london')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'GB') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.startsWith('australia/')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'AU') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('tokyo')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'JP') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('dubai')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'AE') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('riyadh')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'SA') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('qatar')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'QA') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('kuwait')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'KW') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('hong_kong')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'HK') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('kuala_lumpur')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'MY') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('auckland')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'NZ') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('berlin')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'DE') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('paris')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'FR') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('rome')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'IT') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('madrid')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'ES') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('kolkata')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'IN') || COUNTRY_DIAL_CODES[0]
    }
    if (tzLower.includes('seoul')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'KR') || COUNTRY_DIAL_CODES[0]
    }

    const lang = (navigator.language || '').toLowerCase()
    if (lang.endsWith('-ph')) {
      return COUNTRY_DIAL_CODES.find(c => c.iso === 'PH') || COUNTRY_DIAL_CODES[0]
    }
  } catch (e) {
    // Fall back to PH
  }

  return COUNTRY_DIAL_CODES[0]
}

export const blockPhoneKey = (event: KeyboardEvent): void => {
  const allowed = [
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
  if (allowed.includes(event.key) || event.ctrlKey || event.metaKey) {
    return
  }
  // Allow digits 0-9 and space
  if (/^[0-9\s]$/.test(event.key)) {
    return
  }
  event.preventDefault()
}

export const sanitizePhoneNumber = (val: string | null | undefined, dialCode = '+63'): string => {
  if (!val) return ''
  let digits = val.replace(/\D/g, '')
  // If Philippines (+63) and user typed leading 0 (e.g. 0917), strip the leading 0
  if (dialCode === '+63' && digits.startsWith('0')) {
    digits = digits.substring(1)
  }
  return digits
}

export const formatDisplayPhone = (nationalNumber: string, dialCode = '+63'): string => {
  const digits = nationalNumber.replace(/\D/g, '')
  if (!digits) return ''
  if (dialCode === '+63') {
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`
  }
  if (dialCode === '+1') {
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`
  }
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

export const splitFullPhoneNumber = (
  fullNumber: string | null | undefined
): { dialCode: string; nationalNumber: string } => {
  if (!fullNumber || !fullNumber.trim()) {
    const detected = detectUserCountry()
    return { dialCode: detected.dial, nationalNumber: '' }
  }
  const clean = fullNumber.trim()
  const sortedCodes = [...COUNTRY_DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length)
  for (const c of sortedCodes) {
    if (clean.startsWith(c.dial)) {
      const rest = clean.substring(c.dial.length).trim()
      return { dialCode: c.dial, nationalNumber: formatDisplayPhone(rest, c.dial) }
    }
  }
  return { dialCode: '+63', nationalNumber: formatDisplayPhone(clean, '+63') }
}

export const buildFullPhoneNumber = (dialCode: string, nationalNumber: string): string => {
  const digits = nationalNumber.replace(/\D/g, '')
  if (!digits) return ''
  return `${dialCode} ${formatDisplayPhone(digits, dialCode)}`.trim()
}

export const validatePhoneNumber = (
  nationalNumber: string | null | undefined,
  dialCode = '+63',
  required = false
): { valid: boolean; error: string } => {
  const digits = (nationalNumber || '').replace(/\D/g, '')
  if (!digits) {
    return required
      ? { valid: false, error: 'Contact number is required.' }
      : { valid: true, error: '' }
  }

  const country = COUNTRY_DIAL_CODES.find(c => c.dial === dialCode) || COUNTRY_DIAL_CODES[0]
  if (dialCode === '+63') {
    if (digits.length !== 10) {
      return {
        valid: false,
        error: 'Philippine mobile number must be exactly 10 digits (e.g. 917 123 4567).'
      }
    }
    if (!['9', '2', '8'].includes(digits[0])) {
      return { valid: false, error: 'Mobile number should start with 9 (or landline 2/8).' }
    }
    return { valid: true, error: '' }
  }

  if (country.digits && !country.digits.includes(digits.length)) {
    return {
      valid: false,
      error: `Invalid length for ${country.name} (expects ${country.digits.join(' or ')} digits).`
    }
  }

  if (digits.length < 7 || digits.length > 15) {
    return { valid: false, error: 'Please enter a valid phone number.' }
  }

  return { valid: true, error: '' }
}
