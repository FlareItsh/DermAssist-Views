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
  <div class="flex h-[calc(100vh-8rem)] flex-col overflow-hidden bg-white rounded-[2.5rem] shadow-sm border border-gray-100">
    <header class="flex items-center justify-between border-b border-gray-100 px-10 py-6 shrink-0">
      <div class="flex items-center gap-4">
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          @click="navigateTo('/Patient/Scan/Results')"
          class="group flex items-center gap-2 text-gray-500 hover:text-primary transition-colors">
          <div class="bg-gray-100 group-hover:bg-primary/10 flex h-9 w-9 items-center justify-center rounded-full transition-colors">
             <Icon name="material-symbols:arrow-back-rounded" class="text-lg" />
          </div>
          <span class="font-bold text-sm">Back to Results</span>
        </AppButton>
      </div>
      <div>
        <h1 class="text-2xl font-black">Select Your Specialist</h1>
      </div>
      <div class="w-32"></div> <!-- Spacer for center alignment -->
    </header>

    <main class="flex-1 overflow-y-auto p-10 custom-scrollbar">
      <div v-if="isLoading" class="flex justify-center py-20">
        <Icon name="svg-spinners:ring-resize" class="text-4xl text-primary" />
      </div>
      
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        <div
          v-for="(doc, index) in allNearbyDoctors"
          :key="doc.uuid"
          @click="handleSelect(doc)"
          class="group hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-primary/5 relative flex cursor-pointer items-center gap-6 rounded-[2.5rem] border border-gray-100 bg-white p-6 transition-all duration-300 hover:shadow-2xl active:scale-[0.99]"
        >
          <div
            v-if="index === 0 && doc.distance > 0"
            class="bg-primary shadow-primary/30 absolute -top-3 left-8 rounded-full px-4 py-1 text-[10px] font-black tracking-widest text-white shadow-lg z-10"
          >
            NEAREST MATCH
          </div>

          <div
            class="relative shrink-0 rounded-[2rem] border-2 border-gray-100 bg-white p-2 transition-transform duration-300 group-hover:scale-105"
          >
            <img
              :src="doc.avatar_path ? getStorageUrl(doc.avatar_path) : ''"
              :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((doc.first_name || 'D') + '+' + (doc.last_name || 'r'))}&background=7B5EF5&color=fff&size=256'`"
              class="h-24 w-24 rounded-2xl object-cover"
              alt="Doctor photo"
            />
          </div>

          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h4 class="group-hover:text-primary text-xl font-black text-gray-900 transition-colors">
                Dr. {{ doc.first_name }} {{ doc.last_name }}
              </h4>
              <div class="flex h-5 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-black text-green-600 ring-1 ring-green-100">
                <Icon name="material-symbols:verified-rounded" />
                <span>VERIFIED</span>
              </div>
            </div>

            <p v-if="doc.affiliation" class="text-xs font-bold text-gray-500 mt-1 line-clamp-1">
               {{ doc.affiliation }}
            </p>

            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-gray-400">
              <div class="flex items-center gap-2">
                <div class="text-primary flex h-6 w-6 items-center justify-center rounded-full bg-gray-50">
                  <Icon name="material-symbols:location-on-rounded" />
                </div>
                <span>{{ doc.city }}, {{ doc.province }}</span>
              </div>
              <div class="flex items-center gap-2" v-if="doc.distance > 0">
                <div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-50 text-amber-500">
                  <Icon name="material-symbols:distance-rounded" />
                </div>
                <span class="text-primary font-black">{{ Math.round(doc.distance * 10) / 10 }}km away</span>
              </div>
            </div>
          </div>

          <div class="group-hover:bg-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-50 transition-all duration-300 group-hover:text-white">
            <Icon name="material-symbols:arrow-forward-ios-rounded" class="text-lg text-gray-300 transition-colors group-hover:text-white" />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
