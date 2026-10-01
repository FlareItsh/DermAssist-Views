<script setup lang="ts">
  import { computed, ref, onMounted, watch } from 'vue'
  import { useRouter, navigateTo, useCookie } from '#app'
  import { useDiagnosis, DISEASE_DATABASE } from '~/composables/useDiagnosis'
  import { userService } from '~/api/user/UserService'
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'
  import { useDoctorSelection } from '~/composables/useDoctorSelection'
  import { useAppointments } from '~/composables/useAppointments'
  import { useStorage } from '~/composables/useStorage'

  const router = useRouter()
  const {
    currentDiagnosis,
    isHealthyState,
    isInconclusiveState,
    isOutOfScopeState,
    isNoneState,
    chartData
  } = useDiagnosis()
  const userName = useCookie('user_name')
  const userUuid = useCookie('user_uuid')

  const { getStorageUrl } = useStorage()
  const { appointments, pendingAppointments } = useAppointments()
  const { selectedDoctorUuid, clearSelection } = useDoctorSelection()

  const activeDiseaseLabel = computed(() => {
    if (!currentDiagnosis.value) return 'None'
    if (isNoneState.value) return 'Non-Skin Image Detected'
    if (isOutOfScopeState.value) return 'Out of Scope Condition'
    if (isInconclusiveState.value) return 'Inconclusive Result'
    return currentDiagnosis.value.label
  })

  const activeDiseaseInfo = computed(() => {
    if (isNoneState.value) return DISEASE_DATABASE['None']
    if (isOutOfScopeState.value) return DISEASE_DATABASE['OutOfScope']
    if (isInconclusiveState.value) return DISEASE_DATABASE['Inconclusive']
    const label = activeDiseaseLabel.value
    return DISEASE_DATABASE[label] || DISEASE_DATABASE['None']
  })

  const confidencePercent = computed(() => {
    if (!currentDiagnosis.value) return 0
    return Math.round(currentDiagnosis.value.confidence * 100)
  })

  const formatListText = (text: string) => {
    if (text.includes(':')) {
      const parts = text.split(':')
      return `<strong>${parts[0]}:</strong>${parts[1]}`
    }
    return text
  }

  const hasActiveAppointment = computed(() => {
    if (!nearestDoctor.value) return false
    const active = [...appointments.value, ...pendingAppointments.value].filter(a =>
      ['scheduled', 'pending'].includes(a.status)
    )
    return active.some(a => a.doctor_id === nearestDoctor.value.id)
  })

  const messageText = computed(() => {
    return hasActiveAppointment.value
      ? 'I would like to share additional findings from my recent skin scan.'
      : 'I would like to schedule an appointment regarding my recent skin scan.'
  })

  const nearestDoctor = ref<any | null>(null)
  const allNearbyDoctors = ref<any[]>([])
  const isDoctorLoading = ref(false)
  const doctorDistance = ref<number | null>(null)
  const isProfileIncomplete = ref(false)

  const patientLat = ref<number | null>(null)
  const patientLng = ref<number | null>(null)
  const isCheckingAvailability = ref(false)
  const availabilityStatus = ref<any>(null)

  const getLocalDateKey = (date = new Date()) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const normalizeDateKey = (date?: string) => {
    if (!date) return ''
    return date.slice(0, 10)
  }

  const timeToMinutes = (time?: string) => {
    if (!time) return null
    const [hours, minutes] = time.split(':').map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
    return hours * 60 + minutes
  }

  const isBlockedRightNow = (slot: any, now = new Date()) => {
    if (Number(slot.is_available) === 1 || slot.is_available === true) return false
    if (normalizeDateKey(slot.available_date) !== getLocalDateKey(now)) return false

    const start = timeToMinutes(slot.start_time)
    const end = timeToMinutes(slot.end_time)
    if (start === null || end === null) return true

    const current = now.getHours() * 60 + now.getMinutes()
    return current >= start && current <= end
  }

  const checkAvailability = async () => {
    if (!nearestDoctor.value?.uuid) return
    isCheckingAvailability.value = true
    try {
      const today = getLocalDateKey()
      const [status, slots] = await Promise.all([
        doctorAvailabilityService.checkDoctor(nearestDoctor.value.uuid, { date: today }),
        doctorAvailabilityService.listForDoctor(nearestDoctor.value.uuid)
      ])

      const blockedNow = Array.isArray(slots) && slots.some(slot => isBlockedRightNow(slot))
      availabilityStatus.value = blockedNow
        ? status
        : {
            ...status,
            is_available: true,
            next_available: null
          }
    } catch (err) {
      console.error('Failed to check doctor availability:', err)
    } finally {
      isCheckingAvailability.value = false
    }
  }

  watch(
    nearestDoctor,
    async newDoc => {
      if (newDoc?.uuid) {
        await checkAvailability()
      } else {
        availabilityStatus.value = null
      }
    },
    { immediate: true }
  )

  const selectAlternativeDoctor = (altDoctor: any) => {
    nearestDoctor.value = altDoctor
    const doctorLat = parseCoordinate(altDoctor.latitude)
    const doctorLng = parseCoordinate(altDoctor.longitude)

    if (
      patientLat.value !== null &&
      patientLng.value !== null &&
      doctorLat !== null &&
      doctorLng !== null
    ) {
      doctorDistance.value =
        Math.round(
          haversineDistance(patientLat.value, patientLng.value, doctorLat, doctorLng) * 10
        ) / 10
    } else {
      doctorDistance.value = null
    }
  }

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

  const geocodePatientLocation = async (patient: any) => {
    if (!patient?.city || !patient?.province) return null

    try {
      const query = `${patient.city}, ${patient.province}, ${patient.country || 'Philippines'}`
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        {
          headers: { 'User-Agent': 'DermAssist/1.0 (contact@dermassist.com)' }
        }
      )
      const data = await response.json()

      if (!data?.length) return null

      const latitude = parseCoordinate(data[0].lat)
      const longitude = parseCoordinate(data[0].lon)

      if (latitude === null || longitude === null) return null

      await userService.update(patient.uuid, {
        ...patient,
        latitude,
        longitude
      })

      return { latitude, longitude }
    } catch (error) {
      console.error('Failed to geocode patient location:', error)
      return null
    }
  }

  const isDoctorRegistered = ref(false)

  const fetchNearestDoctor = async () => {
    if (!userUuid.value) return
    isDoctorLoading.value = true
    isProfileIncomplete.value = false

    try {
      const patientRes = await userService.show(userUuid.value as string, { t: Date.now() })
      const patient = patientRes?.data ?? patientRes

      isDoctorRegistered.value = Boolean(patient?.is_doctor_registered)

      if (patient?.is_doctor_registered && patient?.registered_by_doctor) {
        nearestDoctor.value = patient.registered_by_doctor
        doctorDistance.value = null
        isDoctorLoading.value = false
        return
      }

      if (!patient?.city || !patient?.province) {
        isProfileIncomplete.value = true
        isDoctorLoading.value = false
        return
      }

      let patLat = parseCoordinate(patient?.latitude)
      let patLng = parseCoordinate(patient?.longitude)

      if (patLat === null || patLng === null) {
        const geocoded = await geocodePatientLocation(patient)
        patLat = geocoded?.latitude ?? null
        patLng = geocoded?.longitude ?? null
      }

      if (patLat === null || patLng === null) {
        isProfileIncomplete.value = true
        isDoctorLoading.value = false
        return
      }

      patientLat.value = patLat
      patientLng.value = patLng

      const doctorsRes = await userService.list({
        role: 'doctor',
        status: 'verified',
        per_page: 100
      })
      const doctors: any[] = doctorsRes?.data ?? []

      const withDistance = doctors
        .filter(d => d.latitude != null && d.longitude != null && d.uuid !== patient?.uuid)
        .map(d => ({
          ...d,
          distance: haversineDistance(
            patLat,
            patLng,
            parseFloat(d.latitude),
            parseFloat(d.longitude)
          )
        }))
        .sort((a, b) => a.distance - b.distance)

      allNearbyDoctors.value = withDistance

      if (selectedDoctorUuid.value) {
        const docRes = await userService.show(selectedDoctorUuid.value)
        nearestDoctor.value = docRes
        const match = withDistance.find(d => d.uuid === docRes.uuid)
        doctorDistance.value = match ? Math.round(match.distance * 10) / 10 : null

        clearSelection()
      } else {
        const activeAppt = [...appointments.value, ...pendingAppointments.value].find(a =>
          ['scheduled', 'pending'].includes(a.status)
        )

        if (activeAppt && activeAppt.doctor_uuid) {
          const docRes = await userService.show(activeAppt.doctor_uuid)
          nearestDoctor.value = docRes
          const match = withDistance.find(d => d.uuid === docRes.uuid)
          doctorDistance.value = match ? Math.round(match.distance * 10) / 10 : null
        } else if (withDistance.length > 0) {
          nearestDoctor.value = withDistance[0]
          doctorDistance.value = Math.round(withDistance[0].distance * 10) / 10
        }
      }
    } catch (e) {
      console.error('Failed to fetch doctors:', e)
    } finally {
      isDoctorLoading.value = false
    }
  }

  const isSending = ref(false)

  const sendDiagnosis = async () => {
    if (!nearestDoctor.value || !currentDiagnosis.value?.uuid) return
    isSending.value = true

    try {
      const res = await appointmentService.create({
        doctor_id: nearestDoctor.value.id,
        diagnosis_uuid: currentDiagnosis.value?.uuid,
        message: messageText.value
      })

      if (res?.conversation_uuid) {
        await navigateTo(`/Patient/Messages/${res.conversation_uuid}`)
      }
    } catch (e) {
      console.error('Failed to send diagnosis:', e)
    } finally {
      isSending.value = false
    }
  }

  onMounted(() => {
    fetchNearestDoctor()
  })
</script>

<template>
  <div class="flex flex-col gap-4 px-4 pb-20">
    <!-- Header Row -->
    <div class="mt-4 flex items-center justify-between">
      <h2 class="text-foreground text-xl font-bold">Analysis Results</h2>
      <button
        @click="router.push('/Patient/Scan')"
        class="text-primary flex items-center gap-1 text-xs font-bold hover:underline"
      >
        <Icon name="material-symbols:arrow-back-rounded" />
        Back
      </button>
    </div>

    <!-- Main Results Card -->
    <div class="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <!-- Primary Condition Status -->
      <div class="flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold text-white shadow-sm"
          :style="{ backgroundColor: activeDiseaseInfo.color || '#3b82f6' }"
        >
          <Icon
            name="solar:shield-warning-bold-duotone"
            size="24"
          />
        </div>
        <div class="min-w-0 flex-1">
          <span class="text-[10px] font-black tracking-wider text-gray-400 uppercase"
            >Detected Condition</span
          >
          <h3 class="text-foreground mt-0.5 truncate text-lg leading-tight font-black">
            {{ activeDiseaseLabel }}
          </h3>
          <p
            class="mt-1 text-xs font-bold"
            :class="{
              'text-purple-600 dark:text-purple-400': isOutOfScopeState,
              'text-amber-600 dark:text-amber-400': isInconclusiveState && !isOutOfScopeState,
              'text-primary': !isInconclusiveState && !isOutOfScopeState
            }"
          >
            Confidence: {{ confidencePercent }}%
          </p>
        </div>
      </div>

      <!-- Out-of-Scope Advisory Banner (Mobile) -->
      <div
        v-if="isOutOfScopeState"
        class="space-y-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 text-purple-950 shadow-sm dark:text-purple-200"
      >
        <div class="flex items-center justify-between">
          <div
            class="flex items-center gap-1.5 text-xs font-bold text-purple-800 dark:text-purple-300"
          >
            <Icon
              name="lucide:stethoscope"
              size="16"
              class="shrink-0 text-purple-600 dark:text-purple-400"
            />
            <span>Out-of-Scope Condition Gate</span>
          </div>
          <span
            class="text-[10px] font-bold tracking-wider text-purple-700 uppercase dark:text-purple-400"
            >Zero-Shot Filter</span
          >
        </div>
        <p class="text-xs leading-relaxed font-semibold text-purple-950 dark:text-purple-100">
          {{
            currentDiagnosis?.clinical_feedback ||
            'This skin condition appears to be outside our 3 primary focus areas (Acne, Eczema, Herpes). Please consult a licensed dermatologist for comprehensive evaluation.'
          }}
        </p>
        <div class="border-t border-purple-500/20 pt-1.5">
          <p class="mb-1 text-[10px] font-semibold text-purple-800 dark:text-purple-300">
            Examples: Psoriasis, Ringworm, Vitiligo, Rosacea, Hives
          </p>
        </div>
      </div>

      <!-- Inconclusive Advisory Banner (Mobile) -->
      <div
        v-else-if="isInconclusiveState"
        class="space-y-1 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-900 dark:text-amber-200"
      >
        <div class="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
          <Icon
            name="lucide:alert-triangle"
            size="14"
            class="shrink-0"
          />
          <span>Low Confidence &amp; Inconclusive Guard</span>
        </div>
        <p class="text-xs leading-relaxed opacity-90">
          {{
            currentDiagnosis?.clinical_feedback ||
            'This skin scan could not be matched with high certainty to our 3 priority conditions (Acne, Eczema, Herpes). Please consult a licensed dermatologist for comprehensive evaluation.'
          }}
        </p>
      </div>

      <!-- Non-Skin Advisory Banner (Mobile) -->
      <div
        v-else-if="isNoneState"
        class="bg-muted/40 border-border text-muted-foreground space-y-1 rounded-2xl border p-3.5"
      >
        <div class="text-foreground flex items-center gap-1.5 text-xs font-bold">
          <Icon
            name="lucide:image-off"
            size="14"
            class="shrink-0"
          />
          <span>Non-Skin Image Detected</span>
        </div>
        <p class="text-xs leading-relaxed">
          The uploaded image does not appear to be a human skin photo. Please retake or upload a
          clear, focused photo of the skin lesion.
        </p>
      </div>

      <!-- Probability Distribution -->
      <div
        v-if="chartData && chartData.length > 0"
        class="mt-1 flex flex-col gap-2"
      >
        <h4 class="text-foreground text-xs font-extrabold tracking-wide text-gray-400 uppercase">
          Diagnosis Probability
        </h4>
        <div class="mt-1 flex flex-col gap-3">
          <div
            v-for="entry in chartData"
            :key="entry.label"
            class="flex flex-col gap-1.5"
          >
            <div class="flex items-center justify-between text-xs font-bold">
              <span class="text-foreground">{{ entry.label }}</span>
              <span :style="{ color: entry.color }">{{ entry.value }}%</span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                class="h-full rounded-full transition-all duration-500"
                :style="{ width: `${entry.value}%`, backgroundColor: entry.color }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Clinical Understanding Description -->
      <div class="mt-2 border-t border-gray-100 pt-4">
        <h4
          class="text-foreground mb-2 text-xs font-extrabold tracking-wide text-gray-400 uppercase"
        >
          Clinical Understanding
        </h4>
        <p class="text-sm leading-relaxed font-semibold text-gray-600">
          {{ activeDiseaseInfo.description }}
        </p>
      </div>

      <!-- Symptoms Section -->
      <div
        v-if="activeDiseaseInfo.symptoms && activeDiseaseInfo.symptoms.length > 0"
        class="border-t border-gray-100 pt-4"
      >
        <h4
          class="text-foreground mb-3 text-xs font-extrabold tracking-wide text-gray-400 uppercase"
        >
          Common Symptoms
        </h4>
        <ul class="flex flex-col gap-2.5">
          <li
            v-for="(symptom, i) in activeDiseaseInfo.symptoms"
            :key="i"
            class="flex items-start gap-3"
          >
            <div
              class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#22c55e]/10 text-[#22c55e]"
            >
              <Icon
                name="material-symbols:check-small-rounded"
                size="18"
              />
            </div>
            <span
              class="text-xs leading-relaxed font-medium text-gray-600"
              v-html="formatListText(symptom)"
            ></span>
          </li>
        </ul>
      </div>

      <!-- Causes Section -->
      <div
        v-if="activeDiseaseInfo.causes && activeDiseaseInfo.causes.length > 0"
        class="border-t border-gray-100 pt-4"
      >
        <h4
          class="text-foreground mb-3 text-xs font-extrabold tracking-wide text-gray-400 uppercase"
        >
          Potential Causes
        </h4>
        <ul class="flex flex-col gap-2.5">
          <li
            v-for="(cause, i) in activeDiseaseInfo.causes"
            :key="i"
            class="flex items-start gap-3"
          >
            <div
              class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-500"
            >
              <Icon
                name="material-symbols:info-outline-rounded"
                size="14"
              />
            </div>
            <span
              class="text-xs leading-relaxed font-medium text-gray-600"
              v-html="formatListText(cause)"
            ></span>
          </li>
        </ul>
      </div>

      <!-- Recommended Doctor Section -->
      <div class="mt-4 border-t border-gray-100 pt-4">
        <h3 class="mb-4 text-lg font-bold text-gray-900">
          {{
            isDoctorRegistered
              ? 'Your Attending Doctor'
              : hasActiveAppointment
                ? 'Your Preferred Doctor'
                : 'Nearest Specialist'
          }}
        </h3>

        <div
          v-if="isDoctorLoading"
          class="flex animate-pulse gap-4"
        >
          <div class="h-24 w-20 shrink-0 rounded-2xl bg-gray-100"></div>
          <div class="flex flex-1 flex-col gap-2 pt-1">
            <div class="h-5 w-3/4 rounded bg-gray-100"></div>
            <div class="h-3 w-1/2 rounded bg-gray-100"></div>
            <div class="mt-2 h-8 w-full rounded bg-gray-100"></div>
          </div>
        </div>

        <div
          v-else-if="isProfileIncomplete"
          class="bg-primary/5 border-primary/10 rounded-2xl border p-6 text-center"
        >
          <Icon
            name="material-symbols:location-on-outline"
            class="text-primary mb-2 text-3xl"
          />
          <h4 class="text-base font-bold text-gray-900">Set Your Location</h4>
          <p class="mt-1 mb-4 text-xs text-gray-500">
            Complete your profile to find specialists near you.
          </p>
          <button
            @click="navigateTo('/Patient/profile')"
            class="bg-primary w-full rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-md"
          >
            Complete Profile
          </button>
        </div>

        <div
          v-else-if="!nearestDoctor"
          class="py-6 text-center text-gray-400"
        >
          <Icon
            name="material-symbols:person-search-outline"
            class="mb-2 text-4xl opacity-20"
          />
          <p class="text-sm font-medium">No verified doctors found nearby.</p>
        </div>

        <div
          v-else
          class="flex flex-col gap-4"
        >
          <!-- Availability Status -->
          <div
            v-if="isCheckingAvailability"
            class="h-8 w-full animate-pulse rounded-lg bg-gray-100"
          ></div>
          <div v-else-if="availabilityStatus">
            <div
              v-if="availabilityStatus.is_available"
              class="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-green-600"
            >
              <span class="relative flex h-2 w-2">
                <span
                  class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
                ></span>
                <span class="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              <p class="text-[10px] font-bold tracking-wider uppercase">Available Now</p>
            </div>
            <div
              v-else
              class="flex flex-col gap-1 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-900"
            >
              <div class="flex items-center gap-2 text-amber-800">
                <Icon
                  name="material-symbols:info-outline-rounded"
                  class="shrink-0 text-base text-amber-600"
                />
                <p class="text-[10px] font-bold tracking-wider uppercase">Doctor Away Today</p>
              </div>
              <p
                v-if="availabilityStatus.next_available"
                class="mt-0.5 text-xs leading-relaxed text-amber-800/90"
              >
                Dr. {{ nearestDoctor.last_name }} is currently away. Next available on
                <strong>{{ availabilityStatus.next_available.formatted }}</strong
                >. You can still send your findings now for review upon return.
              </p>
              <p
                v-else
                class="mt-0.5 text-xs leading-relaxed text-amber-800/90"
              >
                Dr. {{ nearestDoctor.last_name }} is currently away. You can still send your
                findings now for review as soon as possible.
              </p>
            </div>
          </div>

          <!-- Doctor Info -->
          <div class="flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div class="relative shrink-0">
              <img
                :src="nearestDoctor.avatar_path ? getStorageUrl(nearestDoctor.avatar_path) : ''"
                :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((nearestDoctor.first_name || 'D') + '+' + (nearestDoctor.last_name || 'r'))}&background=7B5EF5&color=fff&size=128'`"
                class="h-20 w-16 rounded-xl object-cover"
                alt="Doctor photo"
              />
              <div
                v-if="doctorDistance && doctorDistance > 50"
                class="absolute -top-2 -left-2 rounded-full bg-amber-500 px-2 py-0.5 text-[8px] font-black text-white shadow-md"
              >
                FAR
              </div>
            </div>

            <div class="flex flex-1 flex-col justify-center">
              <p class="truncate text-lg font-black text-gray-900">
                Dr. {{ nearestDoctor.first_name }} {{ nearestDoctor.last_name }}
              </p>
              <div class="text-primary mt-0.5 flex items-center gap-1 text-xs font-bold">
                <Icon
                  name="material-symbols:verified-outline-rounded"
                  size="14"
                />
                <span>Verified</span>
              </div>
              <p
                v-if="nearestDoctor.affiliation"
                class="mt-1 truncate text-[10px] text-gray-500"
              >
                {{ nearestDoctor.affiliation }}
              </p>
            </div>
          </div>

          <!-- Alternative Doctor -->
          <div
            v-if="
              !isDoctorRegistered &&
              availabilityStatus &&
              !availabilityStatus.is_available &&
              availabilityStatus.alternatives &&
              availabilityStatus.alternatives.length > 0
            "
            class="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div class="flex items-center justify-between">
              <h4 class="flex items-center gap-1 text-xs font-bold text-gray-900">
                <Icon
                  name="heroicons:user-group"
                  class="text-primary"
                />
                Alternative (Available)
              </h4>
            </div>
            <div class="flex items-center gap-3">
              <img
                :src="
                  availabilityStatus.alternatives[0].avatar_path
                    ? getStorageUrl(availabilityStatus.alternatives[0].avatar_path)
                    : ''
                "
                :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((availabilityStatus.alternatives[0].first_name || 'D') + '+' + (availabilityStatus.alternatives[0].last_name || 'r'))}&background=7B5EF5&color=fff&size=64'`"
                class="h-12 w-12 shrink-0 rounded-lg object-cover"
                alt="Alternative Doctor"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold text-gray-900">
                  Dr. {{ availabilityStatus.alternatives[0].first_name }}
                  {{ availabilityStatus.alternatives[0].last_name }}
                </p>
              </div>
            </div>
            <button
              @click="selectAlternativeDoctor(availabilityStatus.alternatives[0])"
              class="mt-1 w-full rounded-lg bg-gray-100 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200"
            >
              Select Doctor
            </button>
          </div>

          <!-- Actions -->
          <div :class="isDoctorRegistered ? 'mt-2 flex' : 'mt-2 grid grid-cols-2 gap-3'">
            <button
              v-if="!isDoctorRegistered"
              @click="navigateTo('/Patient/Scan/SelectDoctor')"
              class="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-gray-100 bg-white py-3 text-sm font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
            >
              <Icon
                name="material-symbols:person-search-outline-rounded"
                size="16"
              />
              Other Doctors
            </button>
            <button
              @click="sendDiagnosis"
              :disabled="isSending || !nearestDoctor || isHealthyState"
              class="bg-primary hover:bg-primary/95 flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold text-white shadow-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon
                v-if="isSending"
                name="svg-spinners:180-ring"
                size="16"
              />
              <Icon
                v-else
                name="solar:plain-bold-duotone"
                size="16"
              />
              <span>{{
                isHealthyState
                  ? 'Invalid Scan'
                  : isSending
                    ? 'Sending...'
                    : hasActiveAppointment
                      ? 'Send Findings'
                      : isDoctorRegistered
                        ? 'Proceed'
                        : 'Send Message'
              }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
