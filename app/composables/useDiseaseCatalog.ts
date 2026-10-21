import { ref, computed } from 'vue'
import {
  candidateDiseaseService,
  type CandidateDiseaseItem
} from '~/api/candidateDisease/CandidateDiseaseService'

export interface CatalogDisease {
  id: string
  uuid?: string
  name: string
  slug: string
  category: string
  description?: string
  badge: string
  icon: string
  isCore?: boolean
  isDefault?: boolean
}

// Guaranteed baseline models trained in the production neural network
export const CORE_MODEL_DISEASES: CatalogDisease[] = [
  {
    id: 'acne',
    name: 'Acne',
    slug: 'acne',
    category: 'Sebaceous / Bacterial',
    description: 'Inflammatory and comedonal papules, pustules, and cysts.',
    badge: 'Trained Model',
    icon: 'lucide:flame',
    isCore: true
  },
  {
    id: 'eczema',
    name: 'Eczema',
    slug: 'eczema',
    category: 'Inflammatory Dermatitis',
    description: 'Pruritic, erythematous, dry, and scaly skin lesions.',
    badge: 'Trained Model',
    icon: 'lucide:activity',
    isCore: true
  },
  {
    id: 'herpes',
    name: 'Herpes',
    slug: 'herpes',
    category: 'Viral Infection',
    description: 'Clustered fluid-filled vesicles on an erythematous base.',
    badge: 'Trained Model',
    icon: 'lucide:shield-alert',
    isCore: true
  },
  {
    id: 'clear',
    name: 'Clear',
    slug: 'clear',
    category: 'Normal / Healthy',
    description: 'No active dermatological lesion or pathological irregularity detected.',
    badge: 'Healthy Skin',
    icon: 'lucide:check-circle-2',
    isCore: true
  }
]

export const useDiseaseCatalog = () => {
  // Use v3 cache key to bust any stale pre-migration in-memory client state
  const candidateDiseases = useState<CandidateDiseaseItem[]>(
    'catalog-candidate-diseases-v3',
    () => []
  )
  const isLoadingCandidates = useState<boolean>('catalog-loading-v3', () => false)
  const candidateError = useState<string | null>('catalog-error-v3', () => null)
  const hasLoadedFromDb = useState<boolean>('catalog-loaded-db-v3', () => false)

  const fetchCandidateDiseases = async (force = false) => {
    if (hasLoadedFromDb.value && candidateDiseases.value.length > 0 && !force) return
    isLoadingCandidates.value = true
    candidateError.value = null
    try {
      const res = await candidateDiseaseService.list()
      const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
      if (data.length > 0) {
        candidateDiseases.value = data
        hasLoadedFromDb.value = true
      }
    } catch (err: any) {
      candidateError.value = err?.message || 'Failed to fetch disease catalog.'
    } finally {
      isLoadingCandidates.value = false
    }
  }

  // Auto-fetch from MySQL API on client
  if (
    import.meta.client &&
    (!hasLoadedFromDb.value || candidateDiseases.value.length === 0) &&
    !isLoadingCandidates.value
  ) {
    fetchCandidateDiseases()
  }

  const allDiseases = computed<CatalogDisease[]>(() => {
    // 1. Initialize with guaranteed core trained models
    const map = new Map<string, CatalogDisease>()
    for (const core of CORE_MODEL_DISEASES) {
      map.set(core.name.toLowerCase(), { ...core })
    }

    // 2. Merge all diseases returned from MySQL database
    for (const d of candidateDiseases.value) {
      const isCore =
        Boolean(d.is_core) || ['acne', 'eczema', 'herpes', 'clear'].includes(d.slug.toLowerCase())
      const key = d.name.toLowerCase()
      const existing = map.get(key)

      const mergedItem: CatalogDisease = {
        id: d.slug,
        uuid: d.uuid,
        name: d.name,
        slug: d.slug,
        category: d.category || (isCore ? existing?.category || 'Core Model' : 'Research'),
        description: d.description || existing?.description || '',
        badge: isCore ? 'Trained Model' : d.badge || (d.is_default ? 'Expansion' : 'Custom'),
        icon: existing?.icon || (isCore ? 'lucide:flame' : d.icon || 'lucide:flask-conical'),
        isCore,
        isDefault: d.is_default
      }

      map.set(key, mergedItem)
    }

    const merged = Array.from(map.values())

    // 3. Always sort trained core models first, followed alphabetically by un-trained expansion diseases
    return merged.sort((a, b) => {
      if (a.isCore !== b.isCore) return a.isCore ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  })

  const searchDiseases = (query: string, currentDiseaseName?: string): CatalogDisease[] => {
    const q = (query || '').trim().toLowerCase()
    const current = (currentDiseaseName || '').trim().toLowerCase()

    // Omit the exact same disease that was already diagnosed by the scanner
    const list = allDiseases.value.filter(d => {
      if (current && d.name.toLowerCase() === current) {
        return false
      }
      return true
    })

    // If query is empty, return full list (trained models at top, expansion below)
    if (!q) {
      return list
    }

    // Score and rank matches
    const scored: { disease: CatalogDisease; score: number }[] = []

    for (const d of list) {
      const name = d.name.toLowerCase()
      const category = d.category.toLowerCase()
      const desc = d.description ? d.description.toLowerCase() : ''
      const badge = d.badge.toLowerCase()

      let score = 0
      if (name.startsWith(q)) {
        score = 100 // Highest priority: exact prefix match (e.g. "Lu" -> "Lupus", "Ac" -> "Acne")
      } else if (name.split(/\s+/).some(part => part.startsWith(q))) {
        score = 90 // Word prefix match (e.g. "Erythematosus" in "Lupus Erythematosus")
      } else if (name.includes(q)) {
        score = 75 // Substring in name
      } else if (category.includes(q) || badge.includes(q)) {
        score = 50 // Category or badge match
      } else if (desc.includes(q)) {
        score = 25 // Mentioned in description text
      }

      if (score > 0) {
        scored.push({ disease: d, score })
      }
    }

    // Sort descending by score; if tied, trained core models first, then alphabetical
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.disease.isCore !== b.disease.isCore) return a.disease.isCore ? -1 : 1
      return a.disease.name.localeCompare(b.disease.name)
    })

    return scored.map(s => s.disease)
  }

  const addCustomDisease = async (payload: {
    name: string
    category?: string
    description?: string
    badge?: string
    icon?: string
  }) => {
    const res = await candidateDiseaseService.create(payload)
    await fetchCandidateDiseases(true)
    return res?.data || res
  }

  const removeCustomDisease = async (uuid: string) => {
    await candidateDiseaseService.delete(uuid)
    await fetchCandidateDiseases(true)
  }

  return {
    candidateDiseases,
    isLoadingCandidates,
    candidateError,
    allDiseases,
    fetchCandidateDiseases,
    searchDiseases,
    addCustomDisease,
    removeCustomDisease
  }
}
