import { ref } from 'vue'

export const usePhLocations = () => {
  const regions = ref<any[]>([])
  const provinces = ref<any[]>([])
  const cities = ref<any[]>([])
  const barangays = ref<any[]>([])

  const isLoadingRegions = ref(false)
  const isLoadingProvinces = ref(false)
  const isLoadingCities = ref(false)
  const isLoadingBarangays = ref(false)

  const fetchRegions = async () => {
    isLoadingRegions.value = true
    try {
      const response = await fetch('https://psgc.gitlab.io/api/regions.json')
      regions.value = await response.json()
    } catch (error) {
      console.error('Failed to fetch regions:', error)
    } finally {
      isLoadingRegions.value = false
    }
  }

  const fetchProvinces = async (regionCode: string) => {
    isLoadingProvinces.value = true
    try {
      const response = await fetch(
        `https://psgc.gitlab.io/api/regions/${regionCode}/provinces.json`
      )
      provinces.value = await response.json()
    } catch (error) {
      console.error('Failed to fetch provinces:', error)
    } finally {
      isLoadingProvinces.value = false
    }
  }

  const fetchCities = async (code: string, isRegion: boolean = false) => {
    isLoadingCities.value = true
    try {
      const url = isRegion
        ? `https://psgc.gitlab.io/api/regions/${code}/cities-municipalities.json`
        : `https://psgc.gitlab.io/api/provinces/${code}/cities-municipalities.json`
      const response = await fetch(url)
      cities.value = await response.json()
    } catch (error) {
      console.error('Failed to fetch cities:', error)
    } finally {
      isLoadingCities.value = false
    }
  }

  const fetchBarangays = async (cityCode: string) => {
    isLoadingBarangays.value = true
    try {
      const response = await fetch(
        `https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays.json`
      )
      barangays.value = await response.json()
    } catch (error) {
      console.error('Failed to fetch barangays:', error)
    } finally {
      isLoadingBarangays.value = false
    }
  }

  // Helpers for reverse mapping with strict null/type safety
  const findProvinceByName = async (name?: string | null) => {
    if (!name || typeof name !== 'string') return null
    try {
      const res = await fetch('https://psgc.gitlab.io/api/provinces.json')
      const all: any[] = await res.json()
      const target = name.trim().toLowerCase()
      return all.find(p => p?.name && String(p.name).toLowerCase() === target) || null
    } catch {
      return null
    }
  }

  const findCityByName = async (provinceCode: string, name?: string | null) => {
    if (!provinceCode || !name || typeof name !== 'string') return null
    try {
      const res = await fetch(
        `https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities.json`
      )
      const all: any[] = await res.json()
      const target = name.trim().toLowerCase()
      return all.find(c => c?.name && String(c.name).toLowerCase() === target) || null
    } catch {
      return null
    }
  }

  const findBarangayByName = async (cityCode: string, name?: string | null) => {
    if (!cityCode || !name || typeof name !== 'string') return null
    try {
      const res = await fetch(
        `https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays.json`
      )
      const all: any[] = await res.json()
      const target = name.trim().toLowerCase()
      return all.find(b => b?.name && String(b.name).toLowerCase() === target) || null
    } catch {
      return null
    }
  }

  return {
    regions,
    provinces,
    cities,
    barangays,
    isLoadingRegions,
    isLoadingProvinces,
    isLoadingCities,
    isLoadingBarangays,
    fetchRegions,
    fetchProvinces,
    fetchCities,
    fetchBarangays,
    findProvinceByName,
    findCityByName,
    findBarangayByName
  }
}
