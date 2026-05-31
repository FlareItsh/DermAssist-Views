<script setup lang="ts">
  import { computed, ref, watch, onMounted } from 'vue'
  import { DISEASE_DATABASE, type DiseaseName } from '~/composables/useDiagnosis'
  import { appealService } from '~/api/appeal/AppealService'
  import { userService } from '~/api/user/UserService'
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'
  import type { DonutEntry } from '../DonutChart.vue'

  const userUuid = useCookie('user_uuid')
  const userName = useCookie('user_name')
  const patientAge = ref<string | number | null>(null)
  const { getStorageUrl } = useStorage()
  const { appointments, pendingAppointments } = useAppointments()

  const hasActiveAppointment = computed(() => {
    if (!nearestDoctor.value) return false
    const active = [...appointments.value, ...pendingAppointments.value].filter(a =>
      ['scheduled', 'pending'].includes(a.status)
    )
    return active.some(a => a.doctor_id === nearestDoctor.value.id)
  })

  const messageText = computed(() => {
    return hasActiveAppointment.value
      ? ''
      : 'I would like to schedule an appointment regarding my recent skin scan.'
  })

  const props = defineProps<{
    role?: 'patient' | 'doctor'
    conditionName?: string
    patientName?: string
    age?: number | string
    date?: string
    description?: string
    symptoms?: string[]
    causes?: string[]
    diagnosisData?: DonutEntry[]
    doctor?: {
      name: string
      photo?: string
      hospital?: string
      location?: string
      summary?: string
    }
    diagnosisUuid?: string
  }>()

  const emit = defineEmits(['close'])

  // ── Doctor-editable patient info ──────────────────────────────────
  const editablePatientName = ref('')
  const editablePatientAge = ref('')

  watch(
    () => props.patientName,
    val => {
      editablePatientName.value = val || ''
    },
    { immediate: true }
  )

  watch(
    patientAge,
    val => {
      editablePatientAge.value = val ? String(val) : ''
    },
    { immediate: true }
  )

  // ── Medical Appeal (Doctor only) ─────────────────────────────────
  const isAppealOpen = ref(false)
  const suggestedLabel = ref('')
  const appealDescription = ref('')
  const isSubmittingAppeal = ref(false)
  const appealSuccess = ref(false)
  const appealError = ref<string | null>(null)

  const submitAppeal = async () => {
    if (!suggestedLabel.value) return

    isSubmittingAppeal.value = true
    appealError.value = null
    appealSuccess.value = false

    try {
      await appealService.create({
        user_uuid: userUuid.value,
        diagnosis_label: activeDisease.value,
        suggested_label: suggestedLabel.value,
        description: appealDescription.value
      })
      appealSuccess.value = true
      setTimeout(() => {
        isAppealOpen.value = false
        appealSuccess.value = false
        suggestedLabel.value = ''
        appealDescription.value = ''
      }, 2000)
    } catch (err: any) {
      appealError.value = err.data?.message || 'Failed to submit appeal.'
    } finally {
      isSubmittingAppeal.value = false
    }
  }

  const defaultChartData: DonutEntry[] = [{ label: 'Healthy', value: 100, color: '#22c55e' }]

  // ── Active disease state ──────────────────────────────────────────
  const activeDisease = ref<DiseaseName>((props.conditionName as DiseaseName) || 'Eczema')

  // Sync with props when component mounts or prop changes
  watch(
    () => props.conditionName,
    newVal => {
      if (newVal === 'Healthy') {
        activeDisease.value = 'Clear'
        return
      }
      if (newVal && (DISEASE_DATABASE as any)[newVal]) {
        activeDisease.value = newVal as DiseaseName
      }
    },
    { immediate: true }
  )

  const currentDisease = computed(() => DISEASE_DATABASE[activeDisease.value])

  const displaySymptoms = computed(() => props.symptoms ?? currentDisease.value.symptoms)
  const displayCauses = computed(() => props.causes ?? currentDisease.value.causes)
  const displayChartData = computed(() => {
    return props.diagnosisData ?? defaultChartData
  })

  const filterPills = computed(() =>
    displayChartData.value.filter(e => e.label !== activeDisease.value)
  )

  const activeConfidence = computed(() => {
    const active = displayChartData.value.find(e => e.label === activeDisease.value)
    return active ? active.value : (displayChartData.value[0]?.value || 0)
  })

  // ── Nearest doctor by proximity ───────────────────────────────────
  const nearestDoctor = ref<any | null>(null)
  const allNearbyDoctors = ref<any[]>([])
  const isDoctorModalOpen = ref(false)
  const isDoctorLoading = ref(false)
  const doctorDistance = ref<number | null>(null)
  const isProfileIncomplete = ref(false)

  const patientLat = ref<number | null>(null)
  const patientLng = ref<number | null>(null)
  const isCheckingAvailability = ref(false)
  const availabilityStatus = ref<any>(null)

  const checkAvailability = async () => {
    if (!nearestDoctor.value?.uuid) return
    isCheckingAvailability.value = true
    try {
      const res = await doctorAvailabilityService.checkDoctor(nearestDoctor.value.uuid)
      availabilityStatus.value = res
    } catch (err) {
      console.error('Failed to check doctor availability:', err)
    } finally {
      isCheckingAvailability.value = false
    }
  }

  watch(nearestDoctor, async (newDoc) => {
    if (newDoc?.uuid) {
      await checkAvailability()
    } else {
      availabilityStatus.value = null
    }
  }, { immediate: true })

  const selectDoctor = (doctor: any) => {
    nearestDoctor.value = doctor
    doctorDistance.value = doctor.distance ? Math.round(doctor.distance * 10) / 10 : null
    isDoctorModalOpen.value = false
  }

  const selectAlternativeDoctor = (altDoctor: any) => {
    nearestDoctor.value = altDoctor
    const doctorLat = parseCoordinate(altDoctor.latitude)
    const doctorLng = parseCoordinate(altDoctor.longitude)

    if (patientLat.value !== null && patientLng.value !== null && doctorLat !== null && doctorLng !== null) {
      doctorDistance.value = Math.round(haversineDistance(patientLat.value, patientLng.value, doctorLat, doctorLng) * 10) / 10
    } else {
      doctorDistance.value = null
    }
  }

  /**
   * Haversine formula: calculates distance in km between two lat/lng pairs.
   */
  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371 // Earth radius in km
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
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
        headers: { 'User-Agent': 'DermAssist/1.0 (contact@dermassist.com)' }
      })
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

  const fetchNearestDoctor = async () => {
    if (!userUuid.value) return
    isDoctorLoading.value = true
    isProfileIncomplete.value = false

    try {
      // 1. Get the user's latest data
      const patientRes = await userService.show(userUuid.value as string, { t: Date.now() })
      const patient = patientRes?.data ?? patientRes

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

      // 2. Fetch all verified doctors
      const doctorsRes = await userService.list({
        role: 'doctor',
        status: 'verified',
        per_page: 100
      })
      const doctors: any[] = doctorsRes?.data ?? []

      // 3. Filter and compute distances
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

      // 4. Check for active appointment to set the default "nearest" doctor
      const activeAppt = [...appointments.value, ...pendingAppointments.value].find(a =>
        ['scheduled', 'pending'].includes(a.status)
      )

      if (activeAppt && activeAppt.doctor_uuid) {
        const docRes = await userService.show(activeAppt.doctor_uuid)
        nearestDoctor.value = docRes
        // Set distance if available in our withDistance list
        const match = withDistance.find(d => d.uuid === docRes.uuid)
        doctorDistance.value = match ? Math.round(match.distance * 10) / 10 : null
      } else if (withDistance.length > 0) {
        nearestDoctor.value = withDistance[0]
        doctorDistance.value = Math.round(withDistance[0].distance * 10) / 10
      }
    } catch (e) {
      console.error('Failed to fetch doctors:', e)
    } finally {
      isDoctorLoading.value = false
    }
  }

  const fetchUserAge = async () => {
    if (!userUuid.value) return
    try {
      const res = await userService.show(userUuid.value as string)
      patientAge.value = res?.age ?? null
    } catch (e) {
      console.error('Failed to fetch user age:', e)
    }
  }

  const isSending = ref(false)

  const sendDiagnosis = async () => {
    if (!nearestDoctor.value || !props.diagnosisUuid) return
    isSending.value = true

    try {
      const res = await appointmentService.create({
        doctor_id: nearestDoctor.value.id,
        diagnosis_uuid: props.diagnosisUuid,
        message: messageText.value
      })

      if (res?.conversation_uuid) {
        await navigateTo(`/Patient/Messages/${res.conversation_uuid}`)
        emit('close')
      }
    } catch (e) {
      console.error('Failed to send diagnosis:', e)
    } finally {
      isSending.value = false
    }
  }

  onMounted(() => {
    fetchUserAge()
    fetchNearestDoctor()
  })
</script>

<template>
  <div class="flex h-full min-h-0">
    <!-- Left Column: Knowledge Base -->
    <div class="custom-scrollbar flex flex-1 flex-col overflow-y-auto p-10 pr-8">
      <div class="mb-12 flex items-center gap-8">
        <div
          class="bg-primary/10 flex h-24 w-24 shrink-0 items-center justify-center rounded-[2.5rem] shadow-inner"
        >
          <Icon
            name="material-symbols:clinical-notes-outline-rounded"
            class="text-primary text-5xl"
          />
        </div>
        <div>
          <h1 class="text-foreground text-6xl font-black tracking-tighter">{{ activeDisease }}</h1>
          <div class="mt-2 flex items-center gap-2">
            <span class="bg-primary h-2 w-2 animate-pulse rounded-full"></span>
            <p class="text-xl font-bold tracking-tight text-gray-500">
              Clinical Analysis & Guidance
            </p>
          </div>
        </div>
      </div>

      <div
        class="mb-12 grid grid-cols-3 gap-8 rounded-[2.5rem] border border-gray-100 bg-gray-50/40 p-10 shadow-sm"
      >
        <div class="flex flex-col gap-2">
          <span class="text-xs font-black tracking-widest text-gray-400 uppercase"
            >Patient Name</span
          >
          <div
            v-if="props.role === 'doctor'"
            class="flex items-center gap-2"
          >
            <input
              v-model="editablePatientName"
              class="focus:border-primary w-full border-b-2 border-gray-200 bg-transparent py-1 text-xl font-black transition-colors outline-none"
              placeholder="Enter patient name"
            />
          </div>
          <span
            v-else
            class="text-xl font-black text-gray-900"
            >{{ patientName || (props.role === 'patient' ? userName : '') || 'Guest User' }}</span
          >
        </div>

        <div class="flex flex-col gap-2 border-x border-gray-200 px-8">
          <span class="text-xs font-black tracking-widest text-gray-400 uppercase"
            >Clinical Age</span
          >
          <div
            v-if="props.role === 'doctor'"
            class="flex items-center gap-2"
          >
            <input
              v-model="editablePatientAge"
              type="number"
              min="0"
              class="focus:border-primary w-full border-b-2 border-gray-200 bg-transparent py-1 text-xl font-black transition-colors outline-none"
              placeholder="Age"
            />
          </div>
          <span
            v-else
            class="text-xl font-black text-gray-900"
            >{{ patientAge || '--' }} years old</span
          >
        </div>

        <div class="flex flex-col gap-2 pl-8">
          <span class="text-xs font-black tracking-widest text-gray-400 uppercase"
            >Assessment Date</span
          >
          <span class="text-xl font-black text-gray-900">{{
            date ||
            new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })
          }}</span>
        </div>
      </div>

      <div class="flex flex-col gap-12">
        <section class="rounded-[2.5rem] border border-gray-100 bg-white p-10 shadow-sm">
          <div class="mb-6 flex items-center gap-4">
            <div class="bg-primary h-3 w-1.5 rounded-full"></div>
            <h3 class="text-2xl font-black tracking-tight">Clinical Understanding</h3>
          </div>
          <p class="text-2xl leading-relaxed font-bold tracking-tight text-gray-600/90">
            {{ description || currentDisease.description }}
          </p>
        </section>

        <div class="grid grid-cols-2 gap-12">
          <section>
            <div class="mb-6 flex items-center gap-3">
              <div class="bg-secondary h-2 w-2 rounded-full"></div>
              <h3 class="text-xl font-bold">Common Symptoms</h3>
            </div>
            <ul class="space-y-4">
              <li
                v-for="(symptom, i) in displaySymptoms"
                :key="i"
                class="group flex items-start gap-4"
              >
                <div
                  class="group-hover:bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 transition-colors"
                >
                  <Icon
                    name="material-symbols:check-small-rounded"
                    class="group-hover:text-primary text-gray-400"
                  />
                </div>
                <p class="leading-snug text-gray-700">{{ symptom }}</p>
              </li>
            </ul>
          </section>

          <section>
            <div class="mb-6 flex items-center gap-3">
              <div class="h-2 w-2 rounded-full bg-amber-500"></div>
              <h3 class="text-xl font-bold">Probable Causes</h3>
            </div>
            <ul class="space-y-4">
              <li
                v-for="(cause, i) in displayCauses"
                :key="i"
                class="group flex items-start gap-4"
              >
                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 transition-colors group-hover:bg-amber-500/10"
                >
                  <Icon
                    name="material-symbols:info-outline-rounded"
                    class="text-gray-400 group-hover:text-amber-500"
                  />
                </div>
                <p class="leading-snug text-gray-700">{{ cause }}</p>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>

    <!-- Right Column: Findings & Doctors -->
    <div
      class="custom-scrollbar flex w-[480px] shrink-0 flex-col gap-8 overflow-y-auto border-l border-gray-100 bg-gray-50/30 p-10 lg:w-[550px]"
    >
      <div class="bg-card rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
        <h2 class="mb-8 text-2xl font-bold">Statistical Findings</h2>
        <div class="flex flex-col items-center gap-10">
          <div class="relative flex items-center justify-center">
            <AppDonutChart
              :data="displayChartData"
              :size="240"
              :stroke-width="45"
            />
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-foreground text-4xl font-black">{{ activeConfidence }}%</span>
              <span class="text-xs font-bold tracking-widest text-gray-400 uppercase"
                >Confidence</span
              >
            </div>
          </div>

          <div class="grid w-full grid-cols-1 gap-3">
            <div
              v-for="(entry, i) in displayChartData"
              :key="i"
              class="group flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-transparent p-4 transition-all hover:border-gray-100 hover:bg-gray-50"
              @click="activeDisease = entry.label as DiseaseName"
            >
              <div class="flex items-center gap-4">
                <span
                  class="h-4 w-4 shrink-0 rounded-full"
                  :style="{ backgroundColor: entry.color }"
                ></span>
                <span
                  class="text-lg font-bold"
                  :class="activeDisease === entry.label ? 'text-primary' : 'text-foreground'"
                >
                  {{ entry.label }}
                </span>
              </div>
              <div class="flex items-center gap-4">
                <span class="text-lg font-black text-gray-400">{{ entry.value }}%</span>
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-full transition-all"
                  :class="
                    activeDisease === entry.label
                      ? 'bg-primary shadow-primary/20 text-white shadow-lg'
                      : 'border border-gray-100 bg-white text-gray-300'
                  "
                >
                  <Icon
                    :name="
                      activeDisease === entry.label
                        ? 'material-symbols:check'
                        : 'material-symbols:search'
                    "
                    class="text-xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="props.role !== 'doctor'"
        class="bg-card flex flex-col gap-6 rounded-[2.5rem] border border-gray-100 p-8 shadow-sm"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-2xl font-bold">
            {{ hasActiveAppointment ? 'Your Preferred Doctor' : 'Nearest Specialist' }}
          </h3>
        </div>

        <div
          v-if="isDoctorLoading"
          class="flex animate-pulse gap-6"
        >
          <div class="h-40 w-36 shrink-0 rounded-3xl bg-gray-100"></div>
          <div class="flex flex-1 flex-col gap-3 pt-2">
            <div class="h-6 w-3/4 rounded bg-gray-100"></div>
            <div class="h-4 w-1/2 rounded bg-gray-100"></div>
            <div class="h-16 w-full rounded bg-gray-100"></div>
          </div>
        </div>

        <div
          v-else-if="isProfileIncomplete"
          class="bg-primary/5 border-primary/20 flex flex-col items-center gap-6 rounded-3xl border p-8 text-center"
        >
          <div class="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
            <Icon
              name="material-symbols:location-on-outline"
              class="text-primary text-4xl"
            />
          </div>
          <div>
            <h4 class="text-foreground text-xl font-bold">Set Your Location</h4>
            <p class="mt-2 text-base leading-relaxed text-gray-500">
              Complete your profile so we can refer you to verified specialists in your area.
            </p>
          </div>
          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            @click="navigateTo('/Patient/profile')"
            class="bg-primary text-card shadow-primary/20 w-full rounded-2xl py-4 text-base font-bold shadow-xl transition-all hover:opacity-90 active:scale-95"
          >
            Complete Profile
          </AppButton>
        </div>

        <div
          v-else-if="!nearestDoctor"
          class="flex flex-col items-center gap-4 py-12 text-center text-gray-400"
        >
          <Icon
            name="material-symbols:person-search-outline"
            class="text-6xl opacity-20"
          />
          <p class="text-lg font-medium">No verified doctors found nearby.</p>
        </div>

        <div
          v-else
          class="flex flex-col gap-6"
        >
          <!-- Availability Status Banner -->
          <div v-if="isCheckingAvailability" class="h-12 w-full rounded-xl bg-foreground/5 animate-pulse mb-1"></div>

          <div v-else-if="availabilityStatus" class="mb-1 animate-in slide-in-from-top-2 duration-300">
            <!-- Available -->
            <div v-if="availabilityStatus.is_available"
              class="bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <span class="relative flex h-2.5 w-2.5">
                <span
                  class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <p class="text-xs font-bold uppercase tracking-wider">Available Now</p>
            </div>

            <!-- Unavailable Banner -->
            <div v-else
              class="bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl p-3.5 flex items-start gap-3">
              <Icon name="heroicons:exclamation-triangle" class="text-xl mt-0.5 shrink-0" />
              <div class="flex flex-col gap-0.5">
                <p class="text-xs font-bold uppercase tracking-wider">Not Available Now</p>
                <p v-if="availabilityStatus.next_available" class="text-xs leading-relaxed text-red-600/80 mt-0.5">
                  Dr. {{ nearestDoctor.last_name }} is away. Next available on <strong>{{
                    availabilityStatus.next_available.formatted }}</strong>.
                </p>
                <p v-else class="text-xs leading-relaxed text-red-600/80 mt-0.5">
                  Dr. {{ nearestDoctor.last_name }} is currently away with no upcoming availability.
                </p>
              </div>
            </div>
          </div>
          <div
            v-if="doctorDistance && doctorDistance > 50"
            class="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
          >
            <Icon
              name="material-symbols:distance-outline-rounded"
              class="mt-0.5 shrink-0 text-2xl text-amber-500"
            />
            <div>
              <p class="text-sm font-black tracking-widest text-amber-700 uppercase">
                Limited Coverage
              </p>
              <p class="mt-1 text-sm leading-relaxed text-amber-700/70">
                The nearest verified specialist is <strong>{{ doctorDistance }}km</strong> away.
              </p>
            </div>
          </div>

          <div class="flex gap-6">
            <div class="relative shrink-0 rounded-[2rem] border-2 border-gray-100 p-2">
              <img
                :src="nearestDoctor.avatar_path ? getStorageUrl(nearestDoctor.avatar_path) : ''"
                :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((nearestDoctor.first_name || 'D') + '+' + (nearestDoctor.last_name || 'r'))}&background=7B5EF5&color=fff&size=256'`"
                class="h-40 w-36 rounded-3xl object-cover"
                alt="Doctor photo"
              />
              <div
                v-if="doctorDistance && doctorDistance > 50"
                class="absolute -top-2 -left-2 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black text-white shadow-lg"
              >
                FAR
              </div>
            </div>

            <div class="flex flex-1 flex-col justify-center gap-2">
              <p class="text-foreground text-3xl font-black">
                Dr. {{ nearestDoctor.first_name }} {{ nearestDoctor.last_name }}
              </p>
              <div class="text-primary flex items-center gap-2 text-base font-bold">
                <Icon name="material-symbols:verified-outline-rounded" />
                <span>Verified</span>
              </div>
              <p v-if="nearestDoctor.affiliation" class="text-xs text-gray-500 mt-1">
                Affiliation: <span class="font-semibold">{{ nearestDoctor.affiliation }}</span>
              </p>
            </div>
          </div>

          <!-- Recommended Alternative Doctor Card -->
          <div
            v-if="availabilityStatus && !availabilityStatus.is_available && availabilityStatus.alternatives && availabilityStatus.alternatives.length > 0"
            class="bg-sidebar border border-sidebar-border rounded-[2rem] p-6 shadow-sm flex flex-col gap-4 animate-in zoom-in-95 duration-500"
          >
            <div class="flex items-center justify-between">
              <h4 class="text-base font-bold text-foreground flex items-center gap-2">
                <Icon name="heroicons:user-group" class="text-primary text-xl" />
                Recommended Alternative Doctor (Available)
              </h4>
              <span
                class="bg-green-500/10 text-green-500 text-xs font-bold px-3 py-1 rounded-full border border-green-500/20 uppercase tracking-wider"
              >
                Available
              </span>
            </div>

            <div class="flex gap-6 items-start">
              <img
                :src="availabilityStatus.alternatives[0].avatar_path ? getStorageUrl(availabilityStatus.alternatives[0].avatar_path) : ''"
                :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((availabilityStatus.alternatives[0].first_name || 'D') + '+' + (availabilityStatus.alternatives[0].last_name || 'r'))}&background=7B5EF5&color=fff&size=128'`"
                class="h-24 w-20 rounded-2xl object-cover border border-sidebar-border shrink-0"
                alt="Alternative Doctor photo"
              />

              <div class="flex-1 flex flex-col gap-1">
                <p class="text-lg font-bold text-foreground">
                  Dr. {{ availabilityStatus.alternatives[0].first_name }} {{ availabilityStatus.alternatives[0].last_name }}
                </p>
                <p class="text-xs text-foreground/50">
                  PRC #{{ availabilityStatus.alternatives[0].prc_number || availabilityStatus.alternatives[0].prcNumber || 'N/A' }}
                </p>
                <p class="text-xs text-foreground/60 leading-relaxed mt-1">
                  Location: {{ availabilityStatus.alternatives[0].city }}, {{ availabilityStatus.alternatives[0].province }}
                </p>
                <p v-if="availabilityStatus.alternatives[0].affiliation" class="text-xs text-foreground/60 mt-0.5">
                  Affiliation: {{ availabilityStatus.alternatives[0].affiliation }}
                </p>
              </div>
            </div>

            <button
              @click="selectAlternativeDoctor(availabilityStatus.alternatives[0])"
              class="bg-primary hover:bg-primary/90 text-white font-bold text-sm py-3 rounded-2xl transition-all shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2 cursor-pointer animate-in fade-in"
            >
              <Icon name="heroicons:user-plus" size="16" />
              Select Alternative Doctor
            </button>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-3">
            <AppButton
              variant="outline"
              size="lg"
              @click="isDoctorModalOpen = true"
            >
              <Icon
                name="material-symbols:person-search-outline-rounded"
                class="shrink-0 text-lg"
              />
              <span class="truncate">Other Doctors</span>
            </AppButton>
            <AppButton
              size="lg"
              @click="sendDiagnosis"
              :disabled="isSending || !nearestDoctor"
              class="bg-primary text-card shadow-primary/20 flex h-14 items-center justify-center gap-2 rounded-2xl px-2 text-center text-sm font-bold shadow-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              <Icon
                v-if="!isSending"
                name="material-symbols:check-circle-outline-rounded"
                class="shrink-0 text-lg"
              />
              <Icon
                v-else
                name="svg-spinners:ring-resize"
                class="shrink-0 text-lg"
              />
              <span class="truncate">{{ isSending ? 'Selecting...' : 'Select Doctor' }}</span>
            </AppButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Other Doctors Modal -->
    <AppModal
      v-model="isDoctorModalOpen"
      title="Select Your Specialist"
      description="Connect with verified dermatologists near your location for a professional clinical review."
      size="xl"
    >
      <div class="flex flex-col gap-5 py-2">
        <div
          v-for="(doc, index) in allNearbyDoctors"
          :key="doc.uuid"
          @click="selectDoctor(doc)"
          class="group hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-primary/5 relative flex cursor-pointer items-center gap-6 rounded-[2.5rem] border border-gray-100 bg-white p-6 transition-all duration-300 hover:shadow-2xl active:scale-[0.99]"
          :class="{
            'border-primary/40 bg-primary/[0.03] ring-primary/20 ring-1':
              nearestDoctor?.uuid === doc.uuid
          }"
        >
          <!-- Ranking Badge -->
          <div
            v-if="index === 0"
            class="bg-primary shadow-primary/30 absolute -top-3 left-8 rounded-full px-4 py-1 text-[10px] font-black tracking-widest text-white shadow-lg"
          >
            NEAREST MATCH
          </div>

          <!-- Doctor Avatar -->
          <div
            class="relative shrink-0 rounded-[2rem] border-2 border-gray-100 bg-white p-2 transition-transform duration-300 group-hover:scale-105"
          >
            <img
              :src="doc.avatar_path ? getStorageUrl(doc.avatar_path) : ''"
              :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((doc.first_name || 'D') + '+' + (doc.last_name || 'r'))}&background=7B5EF5&color=fff&size=256'`"
              class="h-20 w-20 rounded-2xl object-cover"
              alt="Doctor photo"
            />
            <div
              v-if="nearestDoctor?.uuid === doc.uuid"
              class="bg-primary absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white"
            >
              <Icon
                name="material-symbols:check-rounded"
                class="text-xl"
              />
            </div>
          </div>

          <!-- Doctor Info -->
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h4
                class="group-hover:text-primary text-xl font-black text-gray-900 transition-colors"
              >
                Dr. {{ doc.first_name }} {{ doc.last_name }}
              </h4>
              <div
                class="flex h-5 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-black text-green-600 ring-1 ring-green-100"
              >
                <Icon name="material-symbols:verified-rounded" />
                <span>VERIFIED</span>
              </div>
            </div>

            <div
              class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-gray-400"
            >
              <div class="flex items-center gap-2">
                <div
                  class="text-primary flex h-6 w-6 items-center justify-center rounded-full bg-gray-50"
                >
                  <Icon name="material-symbols:location-on-rounded" />
                </div>
                <span>{{ doc.city }}, {{ doc.province }}</span>
              </div>
              <div class="flex items-center gap-2">
                <div
                  class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-50 text-amber-500"
                >
                  <Icon name="material-symbols:distance-rounded" />
                </div>
                <span class="text-primary font-black"
                  >{{ Math.round(doc.distance * 10) / 10 }}km away</span
                >
              </div>
            </div>
          </div>

          <!-- Action Indicator -->
          <div
            class="group-hover:bg-primary flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 transition-all duration-300 group-hover:text-white"
          >
            <Icon
              name="material-symbols:arrow-forward-ios-rounded"
              class="text-lg text-gray-300 transition-colors group-hover:text-white"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <AppButton
          variant="unstyled"
          @click="isDoctorModalOpen = false"
          class="text-sm font-bold text-gray-400 transition-colors hover:text-gray-600"
        >
          Dismiss
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
