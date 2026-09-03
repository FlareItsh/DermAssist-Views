import {
  doctorClinicDoctorService,
  type ClinicDoctorItem,
  type SeatUsage,
  type CandidateDoctor,
  type OwnerInfo,
  type SponsoringClinicInfo
} from '~/api/doctorClinicDoctor/DoctorClinicDoctorService'

const clinicDoctors = ref<ClinicDoctorItem[]>([])
const seatUsage = ref<SeatUsage | null>(null)
const isOwner = ref(true)
const clinicOwner = ref<OwnerInfo | null>(null)
const sponsoringClinic = ref<SponsoringClinicInfo | null>(null)
const isLoading = ref(false)
const isLoaded = ref(false)

export const useDoctorClinicDoctors = () => {
  const fetchClinicDoctors = async (force = false) => {
    if (isLoaded.value && !force) return clinicDoctors.value

    isLoading.value = true
    try {
      const res = await doctorClinicDoctorService.getClinicDoctors()
      if (res?.status === 'success') {
        clinicDoctors.value = res.data || []
        seatUsage.value = res.seat_usage || null
        isOwner.value = res.is_owner ?? true
        clinicOwner.value = res.owner || null
        sponsoringClinic.value = res.sponsoring_clinic || null
        isLoaded.value = true
      }
    } catch (err) {
      console.error('Failed to fetch clinic doctors:', err)
    } finally {
      isLoading.value = false
    }

    return clinicDoctors.value
  }

  const searchCandidates = async (query: string): Promise<CandidateDoctor[]> => {
    if (!query || query.trim().length < 2) return []
    try {
      const res = await doctorClinicDoctorService.searchDoctors(query)
      return res?.data || []
    } catch (err) {
      console.error('Failed to search candidate doctors:', err)
      return []
    }
  }

  const assignDoctor = async (payload: {
    clinic_id?: number
    clinic_uuid?: string
    doctor_id?: number
    doctor_uuid?: string
    email?: string
    role?: string
  }) => {
    const res = await doctorClinicDoctorService.assignDoctor(payload)
    await fetchClinicDoctors(true)
    return res
  }

  const removeDoctor = async (pivotId: number) => {
    const res = await doctorClinicDoctorService.removeDoctor(pivotId)
    await fetchClinicDoctors(true)
    return res
  }

  return {
    clinicDoctors,
    seatUsage,
    isOwner,
    clinicOwner,
    sponsoringClinic,
    isLoading,
    isLoaded,
    fetchClinicDoctors,
    searchCandidates,
    assignDoctor,
    removeDoctor,
  }
}
