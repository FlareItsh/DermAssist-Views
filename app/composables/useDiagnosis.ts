import { ref } from 'vue'

export interface DiagnosisResult {
  label: string
  confidence: number
  all_probabilities: Record<string, number>
  flagged_for_collection?: boolean
}

const currentDiagnosis = ref<DiagnosisResult | null>(null)
const isScanning = ref(false)
const qualityError = ref<string | null>(null)
const previewImage = ref<string | null>(null)
const selectedFile = ref<File | null>(null)

export const useDiagnosis = () => {
  const setDiagnosis = (data: DiagnosisResult) => {
    currentDiagnosis.value = data
  }

  const clearDiagnosis = () => {
    currentDiagnosis.value = null
  }

  const resetScanner = () => {
    previewImage.value = null
    selectedFile.value = null
    clearDiagnosis()
  }

  return {
    currentDiagnosis,
    isScanning,
    qualityError,
    previewImage,
    selectedFile,
    setDiagnosis,
    clearDiagnosis,
    resetScanner
  }
}
