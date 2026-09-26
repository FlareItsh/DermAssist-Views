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
  uuid?: string
  label: string
  confidence: number
  all_probabilities: Record<string, number>
  image_quality?: ImageQuality
  is_inconclusive?: boolean
  clinical_feedback?: string
}

export type DiseaseName = 'Acne' | 'Eczema' | 'Herpes' | 'Clear' | 'None' | 'Inconclusive' | 'OutOfScope'

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
  'Clear': '#10b981',
  'None': '#6b7280',
  'Inconclusive': '#f59e0b',
  'OutOfScope': '#8b5cf6'
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
    description: 'The uploaded image was flagged as non-skin or outside the operational scope of our dermatological neural backbones.',
    guidelines: [
      'Upload a well-lit, close-up photograph of human skin',
      'Ensure the affected skin lesion is in focus and centered',
      'Consult a licensed dermatologist for any non-obvious skin concerns'
    ],
    symptoms: [
      'Non-human or non-skin subject detected',
      'Insufficient dermatological surface features',
      'Uncalibrated background or lighting'
    ],
    causes: [
      'Non-skin object or environment',
      'Distant or out-of-focus capture',
      'Extreme lighting or non-medical perspective'
    ],
    color: COLOR_MAP['None']
  },
  'OutOfScope': {
    description: 'This skin condition was detected as an out-of-scope dermatological presentation outside our 3 primary focus conditions (Acne, Eczema, Herpes). It may represent other common conditions such as Psoriasis, Ringworm (Tinea), Vitiligo, Rosacea, Hives, or Melanocytic lesions.',
    guidelines: [
      'Consult a licensed dermatologist for a definitive clinical examination',
      'Do not apply unprescribed acne or eczema topical treatments',
      'Observe and document changes in redness, scaling, or lesion borders'
    ],
    symptoms: [
      'Silvery scales, distinct circular ring borders, or sharp depigmentation',
      'Morphology outside Acne, Eczema, or Herpes patterns',
      'Potential autoimmune, fungal, or vascular dermatological features'
    ],
    causes: [
      'Out-of-scope dermatological conditions (e.g., Psoriasis, Ringworm, Vitiligo, Rosacea, Urticaria)',
      'Non-target skin infection or chronic dermatosis',
      'Condition outside the 3 trained neural classification backbones'
    ],
    color: COLOR_MAP['OutOfScope']
  },
  'Inconclusive': {
    description: 'This skin scan could not be matched with high certainty to our 3 priority conditions (Acne, Eczema, Herpes). It may represent an out-of-scope dermatological condition or an ambiguous lesion presentation.',
    guidelines: [
      'Consult a licensed dermatologist for a comprehensive in-person medical evaluation',
      'Do not apply unprescribed topical medications or harsh products',
      'Monitor the area for changes in size, color, texture, or spreading'
    ],
    symptoms: [
      'Ambiguous, mixed, or atypical lesion features',
      'Condition outside the 3 trained priority spectrums',
      'Low neural confidence below decisive clinical threshold (< 55%)'
    ],
    causes: [
      'Out-of-scope dermatological condition (e.g. Psoriasis, Rosacea, Dermatitis, Tinea)',
      'Atypical lesion morphology or overlapping presentation',
      'Equally distributed or ambiguous probability distribution'
    ],
    color: COLOR_MAP['Inconclusive']
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
  const isOutOfScopeState = computed(() => {
    if (!currentDiagnosis.value) return false
    const feedback = (currentDiagnosis.value.clinical_feedback || '').toLowerCase()
    return (
      currentDiagnosis.value.label === 'OutOfScope' ||
      currentDiagnosis.value.label === 'Unsupported' ||
      (currentDiagnosis.value.label === 'Inconclusive' &&
        (feedback.includes('outside our 3 primary') || feedback.includes('unsupported') || feedback.includes('psoriasis') || feedback.includes('ringworm')))
    )
  })

  const isInconclusiveState = computed(() => {
    if (!currentDiagnosis.value) return false
    return (
      currentDiagnosis.value.is_inconclusive === true ||
      currentDiagnosis.value.label === 'Inconclusive' ||
      (currentDiagnosis.value.confidence < 0.55 && currentDiagnosis.value.label !== 'None' && currentDiagnosis.value.label !== 'Clear')
    )
  })

  const isNoneState = computed(() => {
    if (!currentDiagnosis.value) return false
    return currentDiagnosis.value.label === 'None'
  })

  const isHealthyState = computed(() => {
    if (!currentDiagnosis.value) return false
    if (isInconclusiveState.value || isNoneState.value) return false
    return currentDiagnosis.value.confidence < 0.35 || currentDiagnosis.value.label === 'Clear'
  })

  const chartData = computed(() => {
    if (!currentDiagnosis.value) {
      return [{ label: 'Normal', value: 100, color: '#f3f4f6' }]
    }

    if (isNoneState.value) {
      return [{ label: 'Non-Skin Image Detected', value: 100, color: COLOR_MAP['None'] }]
    }

    if (isOutOfScopeState.value) {
      return [{ label: 'Unsupported Condition (Out of Scope)', value: 100, color: COLOR_MAP['OutOfScope'] }]
    }

    if (isHealthyState.value) {
      return [{ label: 'No skin disease detected', value: 100, color: COLOR_MAP['Clear'] }]
    }

    if (!currentDiagnosis.value.all_probabilities || Object.keys(currentDiagnosis.value.all_probabilities).length === 0) {
      const label = currentDiagnosis.value.label || 'Inconclusive'
      return [{ label, value: Math.round(currentDiagnosis.value.confidence * 100), color: COLOR_MAP[label] || '#475569' }]
    }

    return Object.entries(currentDiagnosis.value.all_probabilities)
      .filter(([label, value]) => value > 0.02)
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
    isInconclusiveState,
    isOutOfScopeState,
    isNoneState,
    chartData,
    setDiagnosis,
    clearDiagnosis,
    resetScanner,
    saveActiveDiagnosisState
  }
}
