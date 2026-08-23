<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { userService } from '~/api/user/UserService'

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const { getStorageUrl } = useStorage()
const userUuid = useCookie('user_uuid')
const { selectDoctor } = useDoctorSelection()

const allNearbyDoctors = ref<any[]>([])
const isLoading = ref(true)

const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const parseCoordinate = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

const fetchAllDoctors = async () => {
  try {
    const patientRes = await userService.show(userUuid.value as string, { t: Date.now() })
    const patient = patientRes?.data ?? patientRes

    if (patient?.is_doctor_registered && patient?.registered_by_doctor) {
      allNearbyDoctors.value = [{ ...patient.registered_by_doctor, distance: 0 }]
      isLoading.value = false
      return
    }

    let patLat = parseCoordinate(patient?.latitude)
    let patLng = parseCoordinate(patient?.longitude)

    const doctorsRes = await userService.list({
      role: 'doctor',
      status: 'verified',
      per_page: 100
    })
    const doctors: any[] = doctorsRes?.data ?? []

    if (patLat !== null && patLng !== null) {
      allNearbyDoctors.value = doctors
        .filter(d => d.latitude != null && d.longitude != null && d.uuid !== patient?.uuid)
        .map(d => ({
          ...d,
          distance: haversineDistance(
            patLat as number,
            patLng as number,
            parseFloat(d.latitude),
            parseFloat(d.longitude)
          )
        }))
        .sort((a, b) => a.distance - b.distance)
    } else {
       allNearbyDoctors.value = doctors.map(d => ({...d, distance: 0}))
    }
  } catch (e) {
    console.error('Failed to fetch doctors:', e)
  } finally {
    isLoading.value = false
  }
}

const handleSelect = (doc: any) => {
  selectDoctor(doc.uuid)
  navigateTo('/Patient/Scan/Results')
}

onMounted(() => {
  fetchAllDoctors()
})
</script>

<template>
  <div class="flex min-h-[calc(100vh-4rem)] sm:h-[calc(100vh-8rem)] flex-col overflow-hidden bg-white rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-gray-100 px-4 py-4 sm:px-10 sm:py-6 shrink-0 gap-2">
      <AppButton
        variant="unstyled"
        size="unstyled"
        rounded="unstyled"
        @click="navigateTo('/Patient/Scan/Results')"
        class="group flex items-center gap-1.5 sm:gap-2 text-gray-500 hover:text-primary transition-colors shrink-0"
      >
        <div class="bg-gray-100 group-hover:bg-primary/10 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition-colors">
          <Icon name="material-symbols:arrow-back-rounded" class="text-base sm:text-lg" />
        </div>
        <span class="font-bold text-xs sm:text-sm hidden xs:inline">Back to Results</span>
      </AppButton>

      <h1 class="text-lg sm:text-2xl font-black text-center truncate">Select Specialist</h1>

      <div class="w-8 sm:w-32 shrink-0"></div> <!-- Spacer for center alignment -->
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto p-3 sm:p-10 custom-scrollbar">
      <div v-if="isLoading" class="flex justify-center py-16 sm:py-20">
        <Icon name="svg-spinners:ring-resize" class="text-3xl sm:text-4xl text-primary" />
      </div>

      <div v-else class="flex flex-col gap-3 sm:grid sm:grid-cols-1 md:grid-cols-2 sm:gap-6 max-w-5xl mx-auto">
        <div
          v-for="(doc, index) in allNearbyDoctors"
          :key="doc.uuid"
          @click="handleSelect(doc)"
          class="group hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-primary/5 relative flex cursor-pointer items-center gap-3 sm:gap-6 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 bg-white p-3.5 sm:p-6 transition-all duration-300 hover:shadow-xl active:scale-[0.99]"
        >
          <!-- Nearest Match Badge -->
          <div
            v-if="index === 0 && doc.distance > 0"
            class="bg-primary shadow-primary/30 absolute -top-2.5 left-4 sm:-top-3 sm:left-8 rounded-full px-2.5 py-0.5 sm:px-4 sm:py-1 text-[9px] sm:text-[10px] font-black tracking-wider sm:tracking-widest text-white shadow-md z-10"
          >
            NEAREST MATCH
          </div>

          <!-- Doctor Avatar -->
          <div
            class="relative shrink-0 rounded-xl sm:rounded-[2rem] border-2 border-gray-100 bg-white p-1 sm:p-2 transition-transform duration-300 group-hover:scale-105"
          >
            <img
              :src="doc.avatar_path ? getStorageUrl(doc.avatar_path) : ''"
              :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((doc.first_name || 'D') + '+' + (doc.last_name || 'r'))}&background=7B5EF5&color=fff&size=256'`"
              class="h-14 w-14 sm:h-24 sm:w-24 rounded-lg sm:rounded-2xl object-cover"
              alt="Doctor photo"
            />
          </div>

          <!-- Doctor Details -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <h4 class="group-hover:text-primary text-sm sm:text-xl font-bold sm:font-black text-gray-900 transition-colors truncate">
                Dr. {{ doc.first_name }} {{ doc.last_name }}
              </h4>
              <div class="flex h-4 sm:h-5 items-center gap-0.5 sm:gap-1 rounded-full bg-green-50 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black text-green-600 ring-1 ring-green-100 shrink-0">
                <Icon name="material-symbols:verified-rounded" class="text-xs" />
                <span>VERIFIED</span>
              </div>
            </div>

            <p v-if="doc.affiliation" class="text-[11px] sm:text-xs font-semibold text-gray-500 mt-0.5 sm:mt-1 truncate">
               {{ doc.affiliation }}
            </p>

            <div class="mt-1.5 sm:mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm font-bold text-gray-400">
              <div class="flex items-center gap-1 sm:gap-2 truncate">
                <div class="text-primary flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-gray-50 shrink-0">
                  <Icon name="material-symbols:location-on-rounded" class="text-xs sm:text-base" />
                </div>
                <span class="truncate">{{ doc.city }}, {{ doc.province }}</span>
              </div>
              <div class="flex items-center gap-1 sm:gap-2 shrink-0" v-if="doc.distance > 0">
                <div class="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-gray-50 text-amber-500 shrink-0">
                  <Icon name="material-symbols:distance-rounded" class="text-xs sm:text-base" />
                </div>
                <span class="text-primary font-black">{{ Math.round(doc.distance * 10) / 10 }}km away</span>
              </div>
            </div>
          </div>

          <!-- Select Arrow Button -->
          <div class="group-hover:bg-primary flex h-8 w-8 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gray-50 transition-all duration-300 group-hover:text-white">
            <Icon name="material-symbols:arrow-forward-ios-rounded" class="text-xs sm:text-lg text-gray-300 transition-colors group-hover:text-white" />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
