import { ref } from 'vue'

export const usePhLocations = () => {
  const regions = ref<any[]>([])
  const provinces = ref<any[]>([])
  const cities = ref<any[]>([])
  const barangays = ref<any[]>([])

  const fetchRegions = async () => {
    try {
      const response = await fetch('https://psgc.gitlab.io/api/regions.json')
      regions.value = await response.json()
    } catch (error) {
      console.error('Failed to fetch regions:', error)
    }
  }

  const fetchProvinces = async (regionCode: string) => {
    try {
      const response = await fetch(`https://psgc.gitlab.io/api/regions/${regionCode}/provinces.json`)
      provinces.value = await response.json()
    } catch (error) {
      console.error('Failed to fetch provinces:', error)
    }
  }

  const fetchCities = async (provinceCode: string) => {
    try {
      // Some cities are in provinces, some are sub-municipalities
      const response = await fetch(`https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities.json`)
      cities.value = await response.json()
    } catch (error) {
      console.error('Failed to fetch cities:', error)
    }
  }

  const fetchBarangays = async (cityCode: string) => {
    try {
      const response = await fetch(`https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays.json`)
      barangays.value = await response.json()
    } catch (error) {
      console.error('Failed to fetch barangays:', error)
    }
  }

  // Helpers for reverse mapping
  const findProvinceByName = async (name: string) => {
    try {
      const res = await fetch('https://psgc.gitlab.io/api/provinces.json')
      const all: any[] = await res.json()
      return all.find(p => p.name.toLowerCase() === name.toLowerCase())
    } catch { return null }
  }

  const findCityByName = async (provinceCode: string, name: string) => {
    try {
      const res = await fetch(`https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities.json`)
      const all: any[] = await res.json()
      return all.find(c => c.name.toLowerCase() === name.toLowerCase())
    } catch { return null }
  }

  const findBarangayByName = async (cityCode: string, name: string) => {
    try {
      const res = await fetch(`https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays.json`)
      const all: any[] = await res.json()
      return all.find(b => b.name.toLowerCase() === name.toLowerCase())
    } catch { return null }
  }

  return {
    regions,
    provinces,
    cities,
    barangays,
    fetchRegions,
    fetchProvinces,
    fetchCities,
    fetchBarangays,
    findProvinceByName,
    findCityByName,
    findBarangayByName
  }
}
