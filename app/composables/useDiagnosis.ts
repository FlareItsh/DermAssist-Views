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
  is_out_of_scope?: boolean
  out_of_scope_category?: string | null
  clinical_feedback?: string
  is_questionnaire_refined?: boolean
  questionnaire_answers?: Record<string, string>
  refined_label?: string
  refined_confidence?: number
  refined_probabilities?: Record<string, number>
  clinical_evidence?: string[]
}

export type DiseaseName =
  | 'Acne'
  | 'Eczema'
  | 'Herpes'
  | 'Clear'
  | 'None'
  | 'Inconclusive'
  | 'OutOfScope'

export interface DiseaseCharacteristicSet {
  lesionType: string
  distribution: string
  texture: string
  sensation: string
  progression: string
}

export interface DiseaseInfo {
  description: string
  prescription?: string
  guidelines: string[]
  symptoms: string[]
  causes: string[]
  characteristics?: DiseaseCharacteristicSet
  color: string
}

export const COLOR_MAP: Record<string, string> = {
  Acne: '#ef4444',
  Eczema: '#d97706',
  Herpes: '#4c0516',
  Clear: '#10b981',
  None: '#6b7280',
  Inconclusive: '#e05328',
  OutOfScope: '#8b5cf6'
}

export const DISEASE_DATABASE: Record<string, DiseaseInfo> = {
  Acne: {
    description:
      'Acne is a common skin condition that occurs when hair follicles become clogged with oil and dead skin cells. It causes whiteheads, blackheads, or pimples.',
    guidelines: [
      'Wash twice daily with gentle cleanser',
      'Avoid picking or squeezing pimples',
      'Use non-comedogenic products'
    ],
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
    characteristics: {
      lesionType:
        'Whiteheads, blackheads, small red pimples, and deeper tender bumps under the skin',
      distribution: 'Most common on the face, forehead, cheeks, chin, neck, chest, and upper back',
      texture:
        'Bumpy and oily to the touch. Pimples may feel raised, slightly swollen, or tender when pressed',
      sensation:
        'Usually painless unless bumped or touched. Larger pimples can feel sore, tender, or achy',
      progression:
        'Starts as a clogged pore or tiny bump → turns into a red pimple → dries up and fades away (may leave a temporary dark mark)'
    },
    color: COLOR_MAP['Acne']
  },
  Eczema: {
    description:
      'Eczema is a condition that causes itchy, inflamed, and cracked patches of skin. It is often chronic and can flare up periodically.',
    guidelines: [
      'Moisturize at least twice a day',
      'Identify and avoid triggers',
      'Take shorter, lukewarm baths'
    ],
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
    characteristics: {
      lesionType:
        'Dry, red, rough patches of skin that look flaky, scaly, or cracked. When irritated, tiny clear fluid drops may appear',
      distribution:
        'Inside the bends of elbows, behind knees, around wrists, neck, hands, or on the face',
      texture:
        'Rough, dry, and coarse like sandpaper. Skin often feels tight, chapped, or easily irritated',
      sensation:
        'Intense, uncomfortable itching (especially at night or when warm), with a dry, stinging sensation',
      progression:
        'Starts with an itchy red patch → skin gets irritated and flaky → calms down and smooths out with daily moisturizing'
    },
    color: COLOR_MAP['Eczema']
  },
  Herpes: {
    description:
      'A viral infection caused by the herpes simplex virus (HSV), typically resulting in sores around the mouth or genitals.',
    guidelines: [
      'Keep the area clean and dry',
      'Avoid touching the sores',
      'Wash hands frequently'
    ],
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
    characteristics: {
      lesionType:
        'A tight cluster of tiny, fluid-filled blisters that pop, form shallow sores, and dry into yellowish crusts',
      distribution:
        'Most often along the border of the lips or mouth (cold sores), or in private and sensitive skin areas',
      texture:
        'Soft, tender little bumps that can easily burst when touched, leaving raw, crusted sores',
      sensation:
        'Starts with a tingling, itching, or prickling feeling before blisters appear, followed by a burning or stinging ache',
      progression:
        'Early tingling or burning → small blisters pop up → blisters burst and crust over → scab falls off as skin heals completely'
    },
    color: COLOR_MAP['Herpes']
  },
  Clear: {
    description:
      'No significant skin irregularities detected. The skin appears healthy and maintains its natural barrier.',
    guidelines: [
      'Maintain current skincare routine',
      'Use daily sunscreen (SPF 30+)',
      'Stay hydrated'
    ],
    symptoms: ['Natural elasticity', 'Even texture', 'Hydrated appearance', 'Consistent color'],
    causes: ['Consistent skincare', 'Proper hydration', 'Sun protection', 'Healthy diet'],
    characteristics: {
      lesionType: 'Clean, even skin with no visible rashes, unusual bumps, or signs of irritation',
      distribution: 'Even and uniform across the entire checked skin area',
      texture: 'Soft, smooth, and comfortable with no rough, tight, or flaky patches',
      sensation: 'Normal and calm. No itching, burning, tingling, or soreness',
      progression:
        'Your skin is healthy and maintaining its natural protection with everyday gentle care and sun protection'
    },
    color: COLOR_MAP['Clear']
  },
  None: {
    description:
      'The uploaded image was flagged as non-skin or outside the operational scope of our dermatological neural backbones.',
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
    characteristics: {
      lesionType: 'The photo does not clearly show human skin or a visible skin spot',
      distribution:
        'The camera might have captured clothing, background items, or an area taken from too far away',
      texture: 'Cannot check skin texture because the photo does not show skin up close',
      sensation: 'Not applicable since no skin condition was found in the image',
      progression:
        'Please take a new, clear, close-up photo in good room lighting to check your skin'
    },
    color: COLOR_MAP['None']
  },
  OutOfScope: {
    description:
      'This skin condition was detected as an out-of-scope dermatological presentation outside our 3 primary focus conditions (Acne, Eczema, Herpes). It may represent other common conditions such as Psoriasis, Ringworm (Tinea), Vitiligo, Rosacea, Hives, or Melanocytic lesions.',
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
    characteristics: {
      lesionType:
        'A skin spot or rash that looks different from common acne, eczema, or cold sores (such as ring-like rashes, silvery scales, or raised hives)',
      distribution: 'Can appear on elbows, knees, scalp, back, chest, or anywhere on the body',
      texture: 'May feel scaly, raised, bumpy, or thick, depending on the specific skin condition',
      sensation: 'You might feel mild itching, dry tightness, stinging, or no discomfort at all',
      progression:
        'Because many skin conditions can look alike, a doctor or dermatologist can examine it in person to give you the right treatment'
    },
    color: COLOR_MAP['OutOfScope']
  },
  Inconclusive: {
    description:
      'This skin scan could not be matched with high certainty to our 3 priority conditions (Acne, Eczema, Herpes). It may represent an out-of-scope dermatological condition or an ambiguous lesion presentation.',
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
    characteristics: {
      lesionType:
        'The skin mark or rash in the photo looks unclear or overlaps with several different conditions',
      distribution:
        'The affected area might be partly shadowed, blurry, or at an angle that is hard to see clearly',
      texture:
        'Cannot be confirmed from this photo alone without a physical touch or closer examination',
      sensation:
        'Only you know how it feels—tell your doctor if it itches, stings, burns, or hurts',
      progression:
        'Try snapping a clearer photo in good lighting, or visit a doctor for a quick in-person check'
    },
    color: COLOR_MAP['Inconclusive']
  }
}

const currentDiagnosis = ref<DiagnosisResult | null>(null)
const isScanning = ref(false)
const isScanned = ref(false)
const isProceededToResults = ref(false)
export interface PendingPatientRegistration {
  firstName: string
  middleName?: string
  lastName: string
  email?: string
  contact_number?: string
  password?: string
  date_of_birth?: string
  age?: number
  gender?: string
  street?: string
  barangay?: string
  city?: string
  province?: string
  is_walk_in?: boolean
}

export interface WalkInPatientInfo {
  firstName: string
  middleName?: string
  lastName: string
  age?: number
  gender?: string
  date_of_birth?: string
  contact_number?: string
}

const qualityError = ref<string | null>(null)
const previewImage = ref<string | null>(null)
const selectedFile = ref<File | null>(null)
const patientUuid = ref<string | null>(null)
const appointmentUuid = ref<string | null>(null)
const pendingPatientRegistration = ref<PendingPatientRegistration | null>(null)
const walkInPatientInfo = ref<WalkInPatientInfo | null>(null)
const boundUserUuid = ref<string | null>(null)

const getStorageKey = (uuid?: string | null): string | null => {
  if (!import.meta.client) return null
  const effectiveUuid = uuid || useCookie('user_uuid').value
  return effectiveUuid ? `dermassist_active_diagnosis_${effectiveUuid}` : null
}

const resetScannerInMemory = () => {
  currentDiagnosis.value = null
  isScanning.value = false
  isScanned.value = false
  isProceededToResults.value = false
  qualityError.value = null
  previewImage.value = null
  selectedFile.value = null
  patientUuid.value = null
  appointmentUuid.value = null
  pendingPatientRegistration.value = null
  walkInPatientInfo.value = null
  boundUserUuid.value = null
}

// Restore active diagnosis state from user-scoped localStorage on client side init
const restoreActiveDiagnosisState = () => {
  if (!import.meta.client) return
  try {
    // Purge legacy non-scoped key so it never leaks across accounts
    localStorage.removeItem('dermassist_active_diagnosis')

    const currentUuid = useCookie('user_uuid').value
    if (!currentUuid) {
      resetScannerInMemory()
      return
    }

    const key = getStorageKey(currentUuid)
    if (!key) {
      resetScannerInMemory()
      return
    }

    const rawState = localStorage.getItem(key)
    if (rawState) {
      const parsed = JSON.parse(rawState)
      if (parsed && parsed.userUuid === currentUuid) {
        boundUserUuid.value = currentUuid
        if (parsed.currentDiagnosis) currentDiagnosis.value = parsed.currentDiagnosis
        if (typeof parsed.isScanned === 'boolean') isScanned.value = parsed.isScanned
        if (typeof parsed.isProceededToResults === 'boolean')
          isProceededToResults.value = parsed.isProceededToResults
        if (parsed.previewImage) previewImage.value = parsed.previewImage
        if (parsed.patientUuid) patientUuid.value = parsed.patientUuid
        if (parsed.appointmentUuid) appointmentUuid.value = parsed.appointmentUuid
        if (parsed.pendingPatientRegistration)
          pendingPatientRegistration.value = parsed.pendingPatientRegistration
        if (parsed.walkInPatientInfo) walkInPatientInfo.value = parsed.walkInPatientInfo
        return
      } else {
        localStorage.removeItem(key)
      }
    }
    resetScannerInMemory()
  } catch (e) {
    console.error('Failed to restore active diagnosis state', e)
    resetScannerInMemory()
  }
}

if (import.meta.client) {
  restoreActiveDiagnosisState()
}

const saveActiveDiagnosisState = () => {
  if (!import.meta.client) return
  try {
    const currentUuid = useCookie('user_uuid').value
    if (!currentUuid) {
      localStorage.removeItem('dermassist_active_diagnosis')
      return
    }

    const key = getStorageKey(currentUuid)
    if (!key) return

    if (
      currentDiagnosis.value ||
      isScanned.value ||
      previewImage.value ||
      patientUuid.value ||
      appointmentUuid.value ||
      pendingPatientRegistration.value ||
      walkInPatientInfo.value
    ) {
      boundUserUuid.value = currentUuid
      localStorage.setItem(
        key,
        JSON.stringify({
          userUuid: currentUuid,
          currentDiagnosis: currentDiagnosis.value,
          isScanned: isScanned.value,
          isProceededToResults: isProceededToResults.value,
          previewImage: previewImage.value,
          patientUuid: patientUuid.value,
          appointmentUuid: appointmentUuid.value,
          pendingPatientRegistration: pendingPatientRegistration.value,
          walkInPatientInfo: walkInPatientInfo.value
        })
      )
    } else {
      localStorage.removeItem(key)
    }
  } catch (e) {
    console.error('Failed to save active diagnosis state', e)
  }
}

const clearAllStoredDiagnosis = (uuid?: string | null) => {
  if (!import.meta.client) return
  try {
    localStorage.removeItem('dermassist_active_diagnosis')
    const key = getStorageKey(uuid)
    if (key) localStorage.removeItem(key)
  } catch (e) {
    console.error('Failed to clear stored diagnosis', e)
  }
}

export const useDiagnosis = () => {
  const isOutOfScopeState = computed(() => {
    if (!currentDiagnosis.value) return false
    if (currentDiagnosis.value.is_out_of_scope) return true
    if (Boolean(currentDiagnosis.value.out_of_scope_category)) return true
    const feedback = (currentDiagnosis.value.clinical_feedback || '').toLowerCase()
    return (
      currentDiagnosis.value.label === 'OutOfScope' ||
      currentDiagnosis.value.label === 'Unsupported' ||
      (currentDiagnosis.value.label === 'Inconclusive' &&
        (feedback.includes('outside our 3 primary') ||
          feedback.includes('unsupported') ||
          feedback.includes('psoriasis') ||
          feedback.includes('ringworm') ||
          feedback.includes('hives') ||
          feedback.includes('warts')))
    )
  })

  const isInconclusiveState = computed(() => {
    if (!currentDiagnosis.value) return false
    return (
      currentDiagnosis.value.is_inconclusive === true ||
      currentDiagnosis.value.label === 'Inconclusive' ||
      (currentDiagnosis.value.confidence < 0.55 &&
        currentDiagnosis.value.label !== 'None' &&
        currentDiagnosis.value.label !== 'Clear')
    )
  })

  const isNoneState = computed(() => {
    if (!currentDiagnosis.value) return false
    return currentDiagnosis.value.label === 'None'
  })

  const isHealthyState = computed(() => {
    if (!currentDiagnosis.value) return false
    if (isInconclusiveState.value || isNoneState.value || isOutOfScopeState.value) return false
    return currentDiagnosis.value.confidence < 0.35 || currentDiagnosis.value.label === 'Clear'
  })

  const chartData = computed(() => {
    if (!currentDiagnosis.value) {
      return [{ label: 'Normal', value: 100, color: '#f3f4f6' }]
    }

    if (isNoneState.value) {
      return [{ label: 'Non-Skin/No Skin Disease Detected', value: 100, color: COLOR_MAP['None'] }]
    }

    if (isOutOfScopeState.value) {
      const rawCat = currentDiagnosis.value?.out_of_scope_category
      const formattedCat = rawCat
        ? rawCat.charAt(0).toUpperCase() + rawCat.slice(1)
        : 'Other Condition'
      return [
        {
          label: rawCat ? `Out-of-Scope (Possible: ${formattedCat})` : 'Out-of-Scope Condition',
          value: 100,
          color: COLOR_MAP['OutOfScope']
        }
      ]
    }

    if (isHealthyState.value) {
      return [{ label: 'No skin disease detected', value: 100, color: COLOR_MAP['Clear'] }]
    }

    const targetProbs =
      currentDiagnosis.value.is_questionnaire_refined &&
      currentDiagnosis.value.refined_probabilities &&
      Object.keys(currentDiagnosis.value.refined_probabilities).length > 0
        ? currentDiagnosis.value.refined_probabilities
        : currentDiagnosis.value.all_probabilities

    if (!targetProbs || Object.keys(targetProbs).length === 0) {
      const label =
        (currentDiagnosis.value.is_questionnaire_refined
          ? currentDiagnosis.value.refined_label
          : null) ||
        currentDiagnosis.value.label ||
        'Inconclusive'
      const conf =
        currentDiagnosis.value.is_questionnaire_refined &&
        currentDiagnosis.value.refined_confidence != null
          ? currentDiagnosis.value.refined_confidence
          : currentDiagnosis.value.confidence
      return [
        {
          label,
          value: Math.round(conf * 100),
          color: COLOR_MAP[label] || '#475569'
        }
      ]
    }

    return Object.entries(targetProbs)
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
    const currentUuid = useCookie('user_uuid').value
    resetScannerInMemory()
    clearAllStoredDiagnosis(currentUuid)
  }

  // Ensure active user diagnosis state is synchronized
  if (import.meta.client) {
    const currentUuid = useCookie('user_uuid').value
    if (currentUuid !== boundUserUuid.value) {
      restoreActiveDiagnosisState()
    }
  }

  const pendingPatientName = computed(() => {
    if (!pendingPatientRegistration.value) return ''
    return `${pendingPatientRegistration.value.firstName} ${pendingPatientRegistration.value.lastName}`
  })

  return {
    currentDiagnosis,
    isScanning,
    isScanned,
    isProceededToResults,
    qualityError,
    previewImage,
    selectedFile,
    patientUuid,
    appointmentUuid,
    pendingPatientRegistration,
    walkInPatientInfo,
    pendingPatientName,
    isHealthyState,
    isInconclusiveState,
    isOutOfScopeState,
    isNoneState,
    chartData,
    setDiagnosis,
    clearDiagnosis,
    resetScanner,
    saveActiveDiagnosisState,
    restoreActiveDiagnosisState
  }
}
