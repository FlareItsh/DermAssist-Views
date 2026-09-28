<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { userService } from '~/api/user/UserService'

  definePageMeta({
    layout: 'dashboard-sidebar-layout',
    alias: ['/patient/scan/select-doctor', '/Patient/Scan/SelectDoctor']
  })

  const { getStorageUrl } = useStorage()
  const userUuid = useCookie('user_uuid')
  const { selectDoctor } = useDoctorSelection()

  const allNearbyDoctors = ref<any[]>([])
  const isLoading = ref(true)
  const isDoctorRegistered = ref(false)

  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLng = (lng2 - lng1) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
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

      isDoctorRegistered.value = Boolean(patient?.is_doctor_registered)

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
        recommended_only: 1,
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
        allNearbyDoctors.value = doctors.map(d => ({ ...d, distance: 0 }))
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
  <div
    class="flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm sm:h-[calc(100vh-8rem)] sm:rounded-[2.5rem]"
  >
    <!-- Header -->
    <header
      class="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-4 sm:px-10 sm:py-6"
    >
      <AppButton
        variant="unstyled"
        size="unstyled"
        rounded="unstyled"
        @click="navigateTo('/Patient/Scan/Results')"
        class="group hover:text-primary flex shrink-0 items-center gap-1.5 text-gray-500 transition-colors sm:gap-2"
      >
        <div
          class="group-hover:bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition-colors sm:h-9 sm:w-9"
        >
          <Icon
            name="material-symbols:arrow-back-rounded"
            class="text-base sm:text-lg"
          />
        </div>
        <span class="xs:inline hidden text-xs font-bold sm:text-sm">Back to Results</span>
      </AppButton>

      <h1 class="truncate text-center text-lg font-black sm:text-2xl">
        {{ isDoctorRegistered ? 'Your Attending Doctor' : 'Select Specialist' }}
      </h1>

      <div class="w-8 shrink-0 sm:w-32"></div>
      <!-- Spacer for center alignment -->
    </header>

    <!-- Main Content -->
    <main class="custom-scrollbar flex-1 overflow-y-auto p-3 sm:p-10">
      <div
        v-if="isLoading"
        class="flex justify-center py-16 sm:py-20"
      >
        <Icon
          name="svg-spinners:ring-resize"
          class="text-primary text-3xl sm:text-4xl"
        />
      </div>

      <div
        v-else
        class="mx-auto flex max-w-5xl flex-col gap-3 sm:grid sm:grid-cols-1 sm:gap-6 md:grid-cols-2"
      >
        <div
          v-if="isDoctorRegistered"
          class="col-span-full mb-2 flex items-center gap-3 rounded-2xl bg-primary/5 p-4 border border-primary/20 text-primary"
        >
          <Icon name="material-symbols:lock-outline" class="text-xl shrink-0" />
          <p class="text-xs sm:text-sm font-semibold">
            Your account was registered by your attending doctor. All appointments and scan findings are managed directly with them.
          </p>
        </div>

        <div
          v-for="(doc, index) in allNearbyDoctors"
          :key="doc.uuid"
          @click="handleSelect(doc)"
          class="group hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-primary/5 relative flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 transition-all duration-300 hover:shadow-xl active:scale-[0.99] sm:gap-6 sm:rounded-[2.5rem] sm:p-6"
        >
          <!-- Nearest Match Badge -->
          <div
            v-if="index === 0 && doc.distance > 0"
            class="bg-primary shadow-primary/30 absolute -top-2.5 left-4 z-10 rounded-full px-2.5 py-0.5 text-[9px] font-black tracking-wider text-white shadow-md sm:-top-3 sm:left-8 sm:px-4 sm:py-1 sm:text-[10px] sm:tracking-widest"
          >
            NEAREST MATCH
          </div>

          <!-- Doctor Avatar -->
          <div
            class="relative shrink-0 rounded-xl border-2 border-gray-100 bg-white p-1 transition-transform duration-300 group-hover:scale-105 sm:rounded-[2rem] sm:p-2"
          >
            <img
              :src="doc.avatar_path ? getStorageUrl(doc.avatar_path) : ''"
              :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((doc.first_name || 'D') + '+' + (doc.last_name || 'r'))}&background=7B5EF5&color=fff&size=256'`"
              class="h-14 w-14 rounded-lg object-cover sm:h-24 sm:w-24 sm:rounded-2xl"
              alt="Doctor photo"
            />
          </div>

          <!-- Doctor Details -->
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <h4
                class="group-hover:text-primary truncate text-sm font-bold text-gray-900 transition-colors sm:text-xl sm:font-black"
              >
                Dr. {{ doc.first_name }} {{ doc.last_name }}
              </h4>
              <div
                class="flex h-4 shrink-0 items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-black text-green-600 ring-1 ring-green-100 sm:h-5 sm:gap-1 sm:px-2 sm:text-[10px]"
              >
                <Icon
                  name="material-symbols:verified-rounded"
                  class="text-xs"
                />
                <span>VERIFIED</span>
              </div>
            </div>

            <p
              v-if="doc.affiliation"
              class="mt-0.5 truncate text-[11px] font-semibold text-gray-500 sm:mt-1 sm:text-xs"
            >
              {{ doc.affiliation }}
            </p>

            <div
              class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-gray-400 sm:mt-3 sm:text-sm"
            >
              <div class="flex items-center gap-1 truncate sm:gap-2">
                <div
                  class="text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-50 sm:h-6 sm:w-6"
                >
                  <Icon
                    name="material-symbols:location-on-rounded"
                    class="text-xs sm:text-base"
                  />
                </div>
                <span class="truncate">{{ doc.city }}, {{ doc.province }}</span>
              </div>
              <div
                class="flex shrink-0 items-center gap-1 sm:gap-2"
                v-if="doc.distance > 0"
              >
                <div
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-50 text-amber-500 sm:h-6 sm:w-6"
                >
                  <Icon
                    name="material-symbols:distance-rounded"
                    class="text-xs sm:text-base"
                  />
                </div>
                <span class="text-primary font-black"
                  >{{ Math.round(doc.distance * 10) / 10 }}km away</span
                >
              </div>
            </div>
          </div>

          <!-- Select Arrow Button -->
          <div
            class="group-hover:bg-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-50 transition-all duration-300 group-hover:text-white sm:h-12 sm:w-12 sm:rounded-2xl"
          >
            <Icon
              name="material-symbols:arrow-forward-ios-rounded"
              class="text-xs text-gray-300 transition-colors group-hover:text-white sm:text-lg"
            />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
