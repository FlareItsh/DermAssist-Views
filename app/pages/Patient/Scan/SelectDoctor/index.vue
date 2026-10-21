<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useRoute, useRouter } from '#app'
  import { toast } from 'vue-sonner'
  import { userService } from '~/api/user/UserService'
  import { conversationService } from '~/api/conversation/ConversationService'
  import { appointmentService } from '~/api/appointment/AppointmentService'

  definePageMeta({
    layout: 'dashboard-sidebar-layout',
    alias: ['/patient/scan/select-doctor', '/Patient/Scan/SelectDoctor']
  })

  const route = useRoute()
  const router = useRouter()
  const diagnosisUuid = computed(
    () => (route.query.diagnosis_uuid as string) || (route.query.diagnosis as string) || ''
  )
  const actionType = computed(() => (route.query.action as string) || 'appointment')

  const { getStorageUrl } = useStorage()
  const userUuid = useCookie('user_uuid')
  const { selectDoctor } = useDoctorSelection()

  const allNearbyDoctors = ref<any[]>([])
  const isLoading = ref(true)
  const isSubmitting = ref(false)
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

  const handleSelect = async (doc: any) => {
    if (diagnosisUuid.value) {
      if (isSubmitting.value) return
      isSubmitting.value = true
      try {
        const docId = doc.id || doc.uuid
        if (actionType.value === 'chat') {
          const convRes = await conversationService.create({ doctor_id: docId })
          const convUuid = convRes?.data?.id || convRes?.id
          if (convUuid) {
            await conversationService.sendMessage(convUuid, `[SCAN_RESULT:${diagnosisUuid.value}]`)
            toast.success(`Scan findings shared with Dr. ${doc.last_name || 'Doctor'}!`)
            await navigateTo(`/Patient/Messages/${convUuid}`)
            return
          }
        } else {
          const res = await appointmentService.create({
            doctor_id: docId,
            diagnosis_uuid: diagnosisUuid.value
          })
          toast.success('Appointment request submitted with scan attached!')
          if (res?.conversation_uuid) {
            await navigateTo(`/Patient/Messages/${res.conversation_uuid}`)
            return
          }
          await navigateTo('/Patient/Messages')
          return
        }
      } catch (err: any) {
        console.error('Failed to dispatch doctor selection:', err)
        toast.error(err?.data?.message || err?.message || 'Could not process request.')
      } finally {
        isSubmitting.value = false
      }
      return
    }

    if (isSubmitting.value) return
    isSubmitting.value = true
    try {
      const docId = doc.id || doc.uuid
      if (actionType.value === 'chat') {
        const convRes = await conversationService.create({ doctor_id: docId })
        const convUuid = convRes?.data?.id || convRes?.id
        if (convUuid) {
          await navigateTo(`/Patient/Messages/${convUuid}`)
          return
        }
      } else {
        const res = await appointmentService.create({
          doctor_id: docId,
          source: 'direct'
        })
        toast.success(`Appointment request submitted to Dr. ${doc.last_name || 'Doctor'}!`)
        if (res?.conversation_uuid) {
          await navigateTo(`/Patient/Messages/${res.conversation_uuid}`)
          return
        }
        await navigateTo('/Patient/Messages')
        return
      }
    } catch (err: any) {
      console.error('Failed to dispatch direct doctor booking:', err)
      toast.error(err?.data?.message || err?.message || 'Could not process booking request.')
    } finally {
      isSubmitting.value = false
    }
  }

  const handleBack = () => {
    if (diagnosisUuid.value) {
      router.back()
    } else {
      navigateTo('/Patient')
    }
  }

  onMounted(() => {
    fetchAllDoctors()
  })
</script>

<template>
  <div
    class="flex flex-col sm:h-[calc(100vh-8rem)] sm:overflow-hidden sm:rounded-[2.5rem] sm:border sm:border-gray-100 sm:bg-white sm:shadow-sm"
  >
    <!-- Header -->
    <header
      class="flex shrink-0 items-center justify-between gap-2 py-4 sm:border-b sm:border-gray-100 sm:px-10 sm:py-6"
    >
      <AppButton
        variant="unstyled"
        size="unstyled"
        rounded="unstyled"
        @click="handleBack"
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
        <span class="xs:inline hidden text-xs font-medium sm:text-sm">
          {{ diagnosisUuid ? 'Back' : 'Back to Results' }}
        </span>
      </AppButton>

      <h1 class="truncate text-center text-base font-semibold text-gray-900 sm:text-xl">
        {{
          isDoctorRegistered
            ? 'Your Attending Doctor'
            : diagnosisUuid
              ? actionType === 'chat'
                ? 'Select Doctor for Chat'
                : 'Select Doctor for Consultation'
              : 'Select Specialist'
        }}
      </h1>

      <div class="w-8 shrink-0 sm:w-32"></div>
      <!-- Spacer for center alignment -->
    </header>

    <!-- Main Content -->
    <main class="custom-scrollbar flex-1 p-0 sm:overflow-y-auto sm:p-10">
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
        class="mx-auto flex max-w-5xl flex-col gap-3 pt-2.5 pb-6 sm:grid sm:grid-cols-1 sm:gap-5 sm:pt-3 sm:pb-0 md:grid-cols-2"
      >
        <div
          v-if="isDoctorRegistered"
          class="col-span-full mb-1 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-gray-700 shadow-xs"
        >
          <Icon
            name="material-symbols:lock-outline"
            class="shrink-0 text-lg text-gray-400"
          />
          <p class="text-xs leading-relaxed font-normal text-gray-600 sm:text-sm">
            Your account was registered by your attending doctor. All appointments and scan findings
            are managed directly with them.
          </p>
        </div>

        <div
          v-for="(doc, index) in allNearbyDoctors"
          :key="doc.uuid"
          @click="handleSelect(doc)"
          class="group relative flex cursor-pointer items-center gap-3.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs transition-all duration-200 hover:border-gray-200 hover:shadow-sm active:scale-[0.99] sm:gap-5 sm:p-5"
        >
          <!-- Nearest Match Badge -->
          <div
            v-if="index === 0 && !isDoctorRegistered"
            class="bg-primary absolute -top-2.5 left-4 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-xs sm:-top-3 sm:left-6 sm:px-3 sm:py-0.5 sm:text-xs"
          >
            <Icon
              name="solar:shield-check-bold"
              size="12"
              class="shrink-0"
            />
            <span>Nearest Specialist</span>
          </div>

          <!-- Doctor Avatar -->
          <div class="relative shrink-0">
            <img
              :src="doc.avatar_path ? getStorageUrl(doc.avatar_path) : ''"
              :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((doc.first_name || 'D') + '+' + (doc.last_name || 'r'))}&background=7B5EF5&color=fff&size=256'`"
              class="h-14 w-14 rounded-xl object-cover sm:h-16 sm:w-16"
              alt="Doctor photo"
            />
          </div>

          <!-- Doctor Details -->
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <h4
                class="group-hover:text-primary truncate text-sm font-semibold text-gray-900 transition-colors sm:text-base"
              >
                Dr. {{ doc.first_name }} {{ doc.last_name }}
              </h4>
              <div
                class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 sm:text-xs"
              >
                <Icon
                  name="material-symbols:verified-rounded"
                  size="13"
                  class="shrink-0 text-emerald-600"
                />
                <span>Verified</span>
              </div>
            </div>

            <p
              v-if="doc.affiliation"
              class="mt-0.5 truncate text-xs font-normal text-gray-500"
            >
              {{ doc.affiliation }}
            </p>

            <div
              class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal text-gray-500"
            >
              <div class="flex items-center gap-1 truncate">
                <Icon
                  name="material-symbols:location-on-outline"
                  size="14"
                  class="shrink-0 text-gray-400"
                />
                <span class="truncate">{{ doc.city }}, {{ doc.province }}</span>
              </div>
              <template v-if="doc.distance > 0">
                <span class="text-gray-300">•</span>
                <span class="font-medium text-gray-600"
                  >{{ Math.round(doc.distance * 10) / 10 }} km away</span
                >
              </template>
            </div>
          </div>

          <!-- Select Arrow Button -->
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 text-gray-400 transition-colors group-hover:border-gray-200 group-hover:bg-gray-100 group-hover:text-gray-700 sm:h-9 sm:w-9"
          >
            <Icon
              name="material-symbols:arrow-forward-rounded"
              size="16"
            />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
