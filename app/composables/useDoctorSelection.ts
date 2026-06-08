import { useState } from '#app'

export const useDoctorSelection = () => {
  const selectedDoctorUuid = useState<string | null>('selected-doctor-uuid', () => null)

  const selectDoctor = (uuid: string) => {
    selectedDoctorUuid.value = uuid
  }

  const clearSelection = () => {
    selectedDoctorUuid.value = null
  }

  return {
    selectedDoctorUuid,
    selectDoctor,
    clearSelection
  }
}
