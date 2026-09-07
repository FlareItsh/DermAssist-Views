import { doctorClinicService, type DoctorClinic, type CreateClinicPayload } from '~/api/doctorClinic/DoctorClinicService'

const clinics = ref<DoctorClinic[]>([])
const isLoading = ref(false)
const isLoaded = ref(false)

export const useDoctorClinics = () => {
  const fetchClinics = async (force = false) => {
    if (isLoaded.value && !force) return clinics.value

    isLoading.value = true
    try {
      const res = await doctorClinicService.list()
      const list = (res as any)?.data ?? (Array.isArray(res) ? res : [])
      clinics.value = list
      isLoaded.value = true
    } catch (err) {
      console.error('Failed to fetch doctor clinics:', err)
    } finally {
      isLoading.value = false
    }

    return clinics.value
  }

  const addClinic = async (payload: CreateClinicPayload) => {
    const res = await doctorClinicService.create(payload)
    await fetchClinics(true)
    return res
  }

  const updateClinic = async (uuid: string, payload: Partial<CreateClinicPayload>) => {
    const res = await doctorClinicService.update(uuid, payload)
    await fetchClinics(true)
    return res
  }

  const removeClinic = async (uuid: string) => {
    const res = await doctorClinicService.delete(uuid)
    await fetchClinics(true)
    return res
  }

  return {
    clinics,
    isLoading,
    isLoaded,
    fetchClinics,
    addClinic,
    updateClinic,
    removeClinic
  }
}
