import { ref, computed } from 'vue'

export interface ImageQuality {
  is_blurry: boolean
  is_dark: boolean
  is_overexposed: boolean
  is_low_contrast: boolean
  sharpness_score: number
  brightness_score: number
  contrast_score: number
  status: string
  feedback_message: string
}

export interface DiagnosisResult {
  id?: string
  label: string
  confidence: number
  all_probabilities: Record<string, number>
  image_quality?: ImageQuality
}

export interface DiseaseInfo {
  description: string
  prescription?: string
  guidelines: string[]
  symptoms: string[]
  causes: string[]
  color: string
}

export const COLOR_MAP: Record<string, string> = {
  'Acne': '#ef4444',
  'Eczema': '#d97706',
  'Herpes': '#4c0516',
  'Clear': '#6b7280',
  'None': '#6b7280'
}

export const DISEASE_DATABASE: Record<string, DiseaseInfo> = {
  'Acne': {
    description: 'Acne is a common skin condition that occurs when hair follicles become clogged with oil and dead skin cells. It causes whiteheads, blackheads, or pimples.',
    guidelines: ['Wash twice daily with gentle cleanser', 'Avoid picking or squeezing pimples', 'Use non-comedogenic products'],
    symptoms: [
      'Whiteheads (closed clogged pores)',
      'Blackheads (open clogged pores)',
      'Small red, tender bumps (papules)',
      'Pimples (pustules), which are papules with pus at their tips'
    ],
    causes: [
      'Excess oil (sebum) production',
      'Hair follicles clogged by oil and dead skin cells',
      'Bacteria',
      'Inflammation'
    ],
    color: COLOR_MAP['Acne']
  },
  'Eczema': {
    description: 'Eczema is a condition that causes itchy, inflamed, and cracked patches of skin. It is often chronic and can flare up periodically.',
    guidelines: ['Moisturize at least twice a day', 'Identify and avoid triggers', 'Take shorter, lukewarm baths'],
    symptoms: [
      'Dry, sensitive skin',
      'Intense itching',
      'Red to brownish-gray patches',
      'Small, raised bumps which may leak fluid'
    ],
    causes: [
      'Overactive immune system',
      'Genetics',
      'Environmental triggers',
      'Skin barrier defects'
    ],
    color: COLOR_MAP['Eczema']
  },
  'Herpes': {
    description: 'A viral infection caused by the herpes simplex virus (HSV), typically resulting in sores around the mouth or genitals.',
    guidelines: ['Keep the area clean and dry', 'Avoid touching the sores', 'Wash hands frequently'],
    symptoms: [
      'Pain or itching in the affected area',
      'Small red bumps or tiny white blisters',
      'Ulcers that form when blisters rupture',
      'Scabs that form as ulcers heal'
    ],
    causes: [
      'Herpes Simplex Virus Type 1 (HSV-1)',
      'Herpes Simplex Virus Type 2 (HSV-2)',
      'Contact with infected skin or bodily fluids'
    ],
    color: COLOR_MAP['Herpes']
  },
  'Clear': {
    description: 'No significant skin irregularities detected. The skin appears healthy and maintains its natural barrier.',
    guidelines: ['Maintain current skincare routine', 'Use daily sunscreen (SPF 30+)', 'Stay hydrated'],
    symptoms: [
      'Natural elasticity',
      'Even texture',
      'Hydrated appearance',
      'Consistent color'
    ],
    causes: [
      'Consistent skincare',
      'Proper hydration',
      'Sun protection',
      'Healthy diet'
    ],
    color: COLOR_MAP['Clear']
  },
  'None': {
    description: 'The skin appears clear and healthy with no significant irregularities detected.',
    guidelines: ['Use daily sunscreen', 'Stay hydrated', 'Maintain a healthy diet'],
    symptoms: [
      'Healthy skin surface',
      'No inflammation',
      'Natural barrier function',
      'Uniform tone'
    ],
    causes: [
      'Proper hydration',
      'Effective skincare',
      'UV defense',
      'Good overall health'
    ],
    color: COLOR_MAP['None']
  }
}

const currentDiagnosis = ref<DiagnosisResult | null>(null)
const isScanning = ref(false)
const isScanned = ref(false)
const isProceededToResults = ref(false)
const qualityError = ref<string | null>(null)
const previewImage = ref<string | null>(null)
const selectedFile = ref<File | null>(null)
const patientUuid = ref<string | null>(null)

// Restore active diagnosis state from localStorage on client side init
if (import.meta.client) {
  try {
    const rawState = localStorage.getItem('dermassist_active_diagnosis')
    if (rawState) {
      const parsed = JSON.parse(rawState)
      if (parsed.currentDiagnosis) currentDiagnosis.value = parsed.currentDiagnosis
      if (typeof parsed.isScanned === 'boolean') isScanned.value = parsed.isScanned
      if (typeof parsed.isProceededToResults === 'boolean') isProceededToResults.value = parsed.isProceededToResults
      if (parsed.previewImage) previewImage.value = parsed.previewImage
      if (parsed.patientUuid) patientUuid.value = parsed.patientUuid
    }
  } catch (e) {
    console.error('Failed to restore active diagnosis state', e)
  }
}

const saveActiveDiagnosisState = () => {
  if (!import.meta.client) return
  try {
    if (currentDiagnosis.value || isScanned.value || previewImage.value || patientUuid.value) {
      localStorage.setItem('dermassist_active_diagnosis', JSON.stringify({
        currentDiagnosis: currentDiagnosis.value,
        isScanned: isScanned.value,
        isProceededToResults: isProceededToResults.value,
        previewImage: previewImage.value,
        patientUuid: patientUuid.value
      }))
    } else {
      localStorage.removeItem('dermassist_active_diagnosis')
    }
  } catch (e) {
    console.error('Failed to save active diagnosis state', e)
  }
}

export const useDiagnosis = () => {
  const isHealthyState = computed(() => {
    if (!currentDiagnosis.value) return false
    return currentDiagnosis.value.confidence < 0.35 || currentDiagnosis.value.label === 'None'
  })

  const chartData = computed(() => {
    if (!currentDiagnosis.value) {
      return [{ label: 'Normal', value: 100, color: '#f3f4f6' }]
    }

    if (isHealthyState.value) {
      return [{ label: 'No skin disease detected', value: 100, color: COLOR_MAP['Clear'] }]
    }

    return Object.entries(currentDiagnosis.value.all_probabilities)
      .filter(([label, value]) => value > 0.05)
      .map(([label, value]) => ({
        label,
        value: Math.round(value * 100),
        color: COLOR_MAP[label] || '#475569'
      }))
  })

  const setDiagnosis = (data: DiagnosisResult) => {
    currentDiagnosis.value = data
    isScanned.value = true
    isProceededToResults.value = false
    saveActiveDiagnosisState()
  }

  const clearDiagnosis = () => {
    currentDiagnosis.value = null
    isScanned.value = false
    isProceededToResults.value = false
    saveActiveDiagnosisState()
  }

  const resetScanner = () => {
    previewImage.value = null
    selectedFile.value = null
    isScanned.value = false
    patientUuid.value = null
    clearDiagnosis()
  }

  return {
    currentDiagnosis,
    isScanning,
    isScanned,
    isProceededToResults,
    qualityError,
    previewImage,
    selectedFile,
    patientUuid,
    isHealthyState,
    chartData,
    setDiagnosis,
    clearDiagnosis,
    resetScanner,
    saveActiveDiagnosisState
  }
}
