<script setup lang="ts">
  import { computed, ref, watch, onMounted } from 'vue'
  import { DISEASE_DATABASE, type DiseaseName, type ImageQuality } from '~/composables/useDiagnosis'
  import { appealService } from '~/api/appeal/AppealService'
  import { userService } from '~/api/user/UserService'
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'
  import { useDoctorSelection } from '~/composables/useDoctorSelection'
  import type { DonutEntry } from '../DonutChart.vue'

  const userUuid = useCookie('user_uuid')
  const userName = useCookie('user_name')
  const patientAge = ref<string | number | null>(null)
  const { getStorageUrl } = useStorage()
  const { appointments, pendingAppointments } = useAppointments()
  const { patientUuid, currentDiagnosis } = useDiagnosis()
  const { selectedDoctorUuid, clearSelection } = useDoctorSelection()

  const isPatientModalOpen = ref(false)

  const uniquePatients = computed(() => {
    const patientsMap = new Map()
    const allAppointments = [...appointments.value, ...pendingAppointments.value]
    
    for (const appt of allAppointments) {
      if (appt.patient && appt.patient_uuid) {
        if (!patientsMap.has(appt.patient_uuid)) {
          patientsMap.set(appt.patient_uuid, {
            ...appt.patient,
            latest_appointment_date: appt.date || appt.created_at
          })
        } else {
          const existing = patientsMap.get(appt.patient_uuid)
          const currentDate = new Date(appt.date || appt.created_at)
          const existingDate = new Date(existing.latest_appointment_date)
          if (currentDate > existingDate) {
            existing.latest_appointment_date = appt.date || appt.created_at
          }
        }
      }
    }
    
    return Array.from(patientsMap.values())
  })

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
    appointmentUuid?: string
    isNewScan?: boolean
  }>()

  const emit = defineEmits(['close', 'finished'])

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
    () => props.age,
    val => {
      if (val !== undefined && val !== null) {
        patientAge.value = val
      }
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

  const defaultChartData: DonutEntry[] = [{ label: 'No skin disease detected', value: 100, color: '#6b7280' }]

  // ── Active disease state ──────────────────────────────────────────
  const activeDisease = ref<DiseaseName>((props.conditionName as DiseaseName) || 'Eczema')

  // Sync with props when component mounts or prop changes
  watch(
    () => props.conditionName,
    newVal => {
      if (newVal === 'Healthy' || newVal === 'No skin disease detected') {
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

  watch(nearestDoctor, async (newDoc) => {
    if (newDoc?.uuid) {
      await checkAvailability()
    } else {
      availabilityStatus.value = null
    }
  }, { immediate: true })

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

      if (selectedDoctorUuid.value) {
        const docRes = await userService.show(selectedDoctorUuid.value)
        nearestDoctor.value = docRes
        const match = withDistance.find(d => d.uuid === docRes.uuid)
        doctorDistance.value = match ? Math.round(match.distance * 10) / 10 : null
        
        clearSelection()
      } else {
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
      }
    } catch (e) {
      console.error('Failed to fetch doctors:', e)
    } finally {
      isDoctorLoading.value = false
    }
  }

  const fetchUserAge = async () => {
    if (!userUuid.value || props.role === 'doctor') return
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

  const doctorCardRef = ref<HTMLElement | null>(null)
  const showGuidancePill = ref(true)
  const scrollToDoctor = () => {
    showGuidancePill.value = false
    doctorCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  onMounted(() => {
    fetchUserAge()
    fetchNearestDoctor()
  })
</script>

<template>
  <div class="custom-scrollbar flex h-full w-full overflow-y-auto items-start">
    <!-- Left Column: Knowledge Base -->
    <div class="sticky top-0 flex flex-1 flex-col p-10 pr-8 self-start overflow-y-auto custom-scrollbar max-h-full">
      <div class="mb-8 flex items-center gap-5">
        <div
          class="bg-primary/10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-inner"
        >
          <Icon
            name="material-symbols:clinical-notes-outline-rounded"
            class="text-primary text-3xl"
          />
        </div>
        <div>
          <h1 class="text-foreground text-3xl lg:text-4xl font-black tracking-tight">{{ activeDisease }}</h1>
          <div class="mt-1 flex items-center gap-2">
            <span class="bg-primary h-2 w-2 animate-pulse rounded-full"></span>
            <p class="text-sm font-bold text-gray-500">
              Clinical Analysis &amp; Guidance
            </p>
          </div>
        </div>
      </div>

      <div
        class="mb-8 grid grid-cols-3 gap-6 rounded-2xl border border-gray-100 bg-gray-50/40 p-6 shadow-sm"
      >
        <div class="flex flex-col gap-1.5">
          <span class="text-[10px] font-black tracking-widest text-gray-400 uppercase"
            >Patient Name</span
          >
          <div
            v-if="props.role === 'doctor'"
            class="flex items-center gap-2 w-full"
          >
            <template v-if="props.isNewScan && patientUuid">
              <span class="text-base font-bold text-gray-900">{{ patientName }}</span>
              <AppButton variant="ghost" size="sm" class="text-xs font-bold text-gray-500 hover:text-primary rounded-xl" @click="isPatientModalOpen = true">
                Change
              </AppButton>
            </template>
            <template v-else>
              <input
                v-model="editablePatientName"
                class="focus:border-primary w-full border-b-2 border-gray-200 bg-transparent py-0.5 text-base font-bold transition-colors outline-none"
                placeholder="Enter patient name"
              />
              <AppButton 
                v-if="props.isNewScan" 
                variant="ghost" 
                size="sm" 
                class="rounded-xl border-dashed border-2 hover:bg-gray-50 transition-colors shrink-0" 
                @click="isPatientModalOpen = true"
                title="Select Registered Patient"
              >
                <Icon name="material-symbols:person-search-outline" class="text-base text-gray-500" />
              </AppButton>
            </template>
          </div>
          <span
            v-else
            class="text-base font-bold text-gray-900"
            >{{ patientName || (props.role === 'patient' ? userName : '') || 'Guest User' }}</span
          >
        </div>

        <div class="flex flex-col gap-1.5 border-x border-gray-200 px-6">
          <span class="text-[10px] font-black tracking-widest text-gray-400 uppercase"
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
              class="focus:border-primary w-full border-b-2 border-gray-200 bg-transparent py-0.5 text-base font-bold transition-colors outline-none"
              placeholder="Age"
            />
          </div>
          <span
            v-else
            class="text-base font-bold text-gray-900"
            >{{ patientAge || '--' }} years old</span
          >
        </div>

        <div class="flex flex-col gap-1.5 pl-6">
          <span class="text-[10px] font-black tracking-widest text-gray-400 uppercase"
            >Assessment Date</span
          >
          <span class="text-base font-bold text-gray-900">{{
            date ||
            new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })
          }}</span>
        </div>
      </div>

      <div v-if="props.role === 'doctor' && (props.appointmentUuid || (editablePatientName?.trim() && editablePatientAge?.toString()?.trim() !== ''))" class="flex flex-col gap-12 mt-12">
        <AppClinicalNoteForm 
          :appointment-uuid="props.appointmentUuid" 
          :diagnosis-id="props.diagnosis?.id || null"
          :diagnosis-uuid="props.diagnosisUuid || null"
          :skip-load="props.isNewScan" 
          :is-finish-mode="props.isNewScan"
          @saved="emit('finished')"
        />
      </div>

      <div v-else class="flex flex-col gap-8 mt-6">
        <section class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div class="mb-4 flex items-center gap-3">
            <div class="bg-primary h-3 w-1.5 rounded-full"></div>
            <h3 class="text-xl font-bold tracking-tight">Clinical Understanding</h3>
          </div>
          <p class="text-base leading-relaxed font-medium text-gray-700">
            {{ description || currentDisease.description }}
          </p>
        </section>

        <div class="grid grid-cols-2 gap-8">
          <section>
            <div class="mb-4 flex items-center gap-2.5">
              <div class="bg-secondary h-2 w-2 rounded-full"></div>
              <h3 class="text-lg font-bold">Common Symptoms</h3>
            </div>
            <ul class="space-y-3">
              <li
                v-for="(symptom, i) in displaySymptoms"
                :key="i"
                class="group flex items-start gap-3 text-sm text-gray-700"
              >
                <div
                  class="group-hover:bg-primary/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 transition-colors"
                >
                  <Icon
                    name="material-symbols:check-small-rounded"
                    class="group-hover:text-primary text-gray-400"
                  />
                </div>
                <p class="leading-snug">{{ symptom }}</p>
              </li>
            </ul>
          </section>

          <section>
            <div class="mb-4 flex items-center gap-2.5">
              <div class="h-2 w-2 rounded-full bg-amber-500"></div>
              <h3 class="text-lg font-bold">Probable Causes</h3>
            </div>
            <ul class="space-y-3">
              <li
                v-for="(cause, i) in displayCauses"
                :key="i"
                class="group flex items-start gap-3 text-sm text-gray-700"
              >
                <div
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 transition-colors group-hover:bg-amber-500/10"
                >
                  <Icon
                    name="material-symbols:info-outline-rounded"
                    class="text-gray-400 group-hover:text-amber-500"
                  />
                </div>
                <p class="leading-snug">{{ cause }}</p>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>

    <!-- Right Column: Findings & Doctors -->
    <div
      class="sticky top-0 flex w-[420px] shrink-0 flex-col gap-6 border-l border-gray-100 bg-gray-50/30 p-6 lg:w-[480px] self-start relative min-h-[500px]"
    >
      <div class="bg-card rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h2 class="mb-6 text-xl font-bold">Statistical Findings</h2>
        <div class="flex flex-col items-center gap-6">
          <div class="relative flex items-center justify-center">
            <AppDonutChart
              :data="displayChartData"
              :size="200"
              :stroke-width="38"
            />
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-foreground text-3xl font-black">{{ activeConfidence }}%</span>
              <span class="text-[10px] font-bold tracking-widest text-gray-400 uppercase"
                >Confidence</span
              >
            </div>
          </div>

          <div class="grid w-full grid-cols-1 gap-2.5">
            <div
              v-for="(entry, i) in displayChartData"
              :key="i"
              class="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-transparent p-3 transition-all hover:border-gray-100 hover:bg-gray-50"
              @click="activeDisease = entry.label as DiseaseName"
            >
              <div class="flex items-center gap-3">
                <span
                  class="h-3.5 w-3.5 shrink-0 rounded-full"
                  :style="{ backgroundColor: entry.color }"
                ></span>
                <span
                  class="text-sm font-bold"
                  :class="activeDisease === entry.label ? 'text-primary' : 'text-foreground'"
                >
                  {{ entry.label }}
                </span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-sm font-bold text-gray-400">{{ entry.value }}%</span>
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-full transition-all"
                  :class="
                    activeDisease === entry.label
                      ? 'bg-primary shadow-primary/20 text-white shadow-md'
                      : 'border border-gray-100 bg-white text-gray-300'
                  "
                >
                  <Icon
                    :name="
                      activeDisease === entry.label
                        ? 'material-symbols:check'
                        : 'material-symbols:search'
                    "
                    class="text-base"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Image Quality & Reliability Card -->
      <div
        v-if="currentDiagnosis?.image_quality"
        class="bg-card rounded-[2.5rem] border p-8 shadow-sm transition-all"
        :class="currentDiagnosis.image_quality.status === 'Excellent'
          ? 'border-green-100'
          : 'border-amber-100'"
      >
        <div class="mb-6 flex items-center gap-4">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            :class="currentDiagnosis.image_quality.status === 'Excellent'
              ? 'bg-green-100 text-green-600'
              : 'bg-amber-100 text-amber-600'"
          >
            <Icon
              :name="currentDiagnosis.image_quality.status === 'Excellent'
                ? 'material-symbols:verified-rounded'
                : 'material-symbols:warning-outline-rounded'"
              class="text-2xl"
            />
          </div>
          <div>
            <h3 class="text-lg font-bold text-gray-900">Image Quality</h3>
            <span
              class="text-sm font-bold"
              :class="currentDiagnosis.image_quality.status === 'Excellent'
                ? 'text-green-600'
                : 'text-amber-600'"
            >
              {{ currentDiagnosis.image_quality.status }}
            </span>
          </div>
        </div>

        <p class="mb-6 text-base leading-relaxed text-gray-600">
          {{ currentDiagnosis.image_quality.feedback_message }}
        </p>

        <!-- Quality metric pills -->
        <div class="flex flex-wrap gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            :class="currentDiagnosis.image_quality.is_blurry
              ? 'bg-red-50 text-red-600'
              : 'bg-green-50 text-green-700'"
          >
            <Icon
              :name="currentDiagnosis.image_quality.is_blurry ? 'material-symbols:close-rounded' : 'material-symbols:check-rounded'"
              class="text-base"
            />
            Focus
          </span>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            :class="currentDiagnosis.image_quality.is_dark
              ? 'bg-red-50 text-red-600'
              : 'bg-green-50 text-green-700'"
          >
            <Icon
              :name="currentDiagnosis.image_quality.is_dark ? 'material-symbols:close-rounded' : 'material-symbols:check-rounded'"
              class="text-base"
            />
            Brightness
          </span>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            :class="currentDiagnosis.image_quality.is_overexposed
              ? 'bg-red-50 text-red-600'
              : 'bg-green-50 text-green-700'"
          >
            <Icon
              :name="currentDiagnosis.image_quality.is_overexposed ? 'material-symbols:close-rounded' : 'material-symbols:check-rounded'"
              class="text-base"
            />
            Glare
          </span>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            :class="currentDiagnosis.image_quality.is_low_contrast
              ? 'bg-red-50 text-red-600'
              : 'bg-green-50 text-green-700'"
          >
            <Icon
              :name="currentDiagnosis.image_quality.is_low_contrast ? 'material-symbols:close-rounded' : 'material-symbols:check-rounded'"
              class="text-base"
            />
            Contrast
          </span>
        </div>
      </div>

      <!-- Medical Appeal Card (Doctor Only) -->
      <div
        v-if="props.role === 'doctor'"
        class="bg-card flex flex-col gap-6 rounded-[2.5rem] border border-gray-100 p-8 shadow-sm mb-6"
      >
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xl font-bold">Disagree with the results?</h3>
            <p class="mt-1 text-sm text-gray-500">File an appeal to suggest a different diagnosis.</p>
          </div>
          <AppButton
            v-if="!isAppealOpen"
            variant="outline"
            @click="isAppealOpen = true"
            class="rounded-xl px-4 py-2 font-bold"
          >
            File Appeal
          </AppButton>
        </div>

        <div v-if="isAppealOpen" class="animate-in slide-in-from-top-2 flex flex-col gap-4 duration-300">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Suggested Diagnosis</label>
            <input
              v-model="suggestedLabel"
              type="text"
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary transition-all outline-none"
              placeholder="Enter correct diagnosis..."
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Reason / Description (Optional)</label>
            <textarea
              v-model="appealDescription"
              rows="3"
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary transition-all outline-none resize-none"
              placeholder="Provide details on why you disagree..."
            ></textarea>
          </div>

          <div v-if="appealError" class="text-sm font-medium text-red-500">{{ appealError }}</div>
          <div v-if="appealSuccess" class="text-sm font-medium text-green-500">Appeal submitted successfully!</div>

          <div class="flex items-center justify-end gap-3 mt-2">
            <AppButton
              variant="ghost"
              @click="isAppealOpen = false"
              class="rounded-xl font-bold text-gray-500"
              :disabled="isSubmittingAppeal"
            >
              Cancel
            </AppButton>
            <AppButton
              @click="submitAppeal"
              :loading="isSubmittingAppeal"
              :disabled="!suggestedLabel"
              class="bg-primary text-card rounded-xl px-6 py-2 font-bold shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              Submit Appeal
            </AppButton>
          </div>
        </div>
      </div>


      <div
        v-if="props.role !== 'doctor'"
        ref="doctorCardRef"
        class="bg-card flex flex-col gap-6 rounded-[2.5rem] border border-gray-100 p-8 shadow-sm"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-2xl font-bold">
            {{ hasActiveAppointment ? 'Your Referred Doctor' : 'Nearest Specialist' }}
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

          <div class="flex gap-4 items-center">
            <div class="relative shrink-0 rounded-2xl border-2 border-gray-100 p-1.5">
              <img
                :src="nearestDoctor.avatar_path ? getStorageUrl(nearestDoctor.avatar_path) : ''"
                :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((nearestDoctor.first_name || 'D') + '+' + (nearestDoctor.last_name || 'r'))}&background=7B5EF5&color=fff&size=256'`"
                class="h-20 w-20 rounded-xl object-cover"
                alt="Doctor photo"
              />
              <div
                v-if="doctorDistance && doctorDistance > 50"
                class="absolute -top-2 -left-2 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-white shadow-md"
              >
                FAR
              </div>
            </div>

            <div class="flex flex-1 flex-col justify-center gap-1 min-w-0">
              <p class="text-foreground text-lg font-bold truncate">
                Dr. {{ nearestDoctor.first_name }} {{ nearestDoctor.last_name }}
              </p>
              <div class="text-primary flex items-center gap-1.5 text-xs font-bold">
                <Icon name="material-symbols:verified-outline-rounded" class="text-sm" />
                <span>Verified</span>
              </div>
              <p v-if="nearestDoctor.affiliation" class="text-xs text-gray-500 truncate">
                Affiliation: <span class="font-semibold">{{ nearestDoctor.affiliation }}</span>
              </p>
            </div>
          </div>

          <!-- Recommended Alternative Doctor Card -->
          <div
            v-if="availabilityStatus && !availabilityStatus.is_available && availabilityStatus.alternatives && availabilityStatus.alternatives.length > 0"
            class="bg-sidebar border border-sidebar-border rounded-2xl p-4 shadow-sm flex flex-col gap-3 animate-in zoom-in-95 duration-500"
          >
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Icon name="heroicons:user-group" class="text-primary text-base" />
                Recommended Alternative Doctor (Available)
              </h4>
              <span
                class="bg-green-500/10 text-green-500 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-green-500/20 uppercase tracking-wider"
              >
                Available
              </span>
            </div>

            <div class="flex gap-4 items-center">
              <img
                :src="availabilityStatus.alternatives[0].avatar_path ? getStorageUrl(availabilityStatus.alternatives[0].avatar_path) : ''"
                :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((availabilityStatus.alternatives[0].first_name || 'D') + '+' + (availabilityStatus.alternatives[0].last_name || 'r'))}&background=7B5EF5&color=fff&size=128'`"
                class="h-14 w-14 rounded-xl object-cover border border-sidebar-border shrink-0"
                alt="Alternative Doctor photo"
              />

              <div class="flex-1 flex flex-col gap-0.5 min-w-0">
                <p class="text-sm font-bold text-foreground truncate">
                  Dr. {{ availabilityStatus.alternatives[0].first_name }} {{ availabilityStatus.alternatives[0].last_name }}
                </p>
                <p class="text-[11px] text-foreground/50">
                  PRC #{{ availabilityStatus.alternatives[0].prc_number || availabilityStatus.alternatives[0].prcNumber || 'N/A' }}
                </p>
                <p class="text-[11px] text-foreground/60 leading-tight truncate">
                  Location: {{ availabilityStatus.alternatives[0].city }}, {{ availabilityStatus.alternatives[0].province }}
                </p>
              </div>
            </div>

            <button
              @click="selectAlternativeDoctor(availabilityStatus.alternatives[0])"
              class="bg-primary hover:bg-primary/90 text-white font-bold text-xs py-2 rounded-xl transition-all shadow-sm active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer animate-in fade-in"
            >
              <Icon name="heroicons:user-plus" size="14" />
              Select Alternative Doctor
            </button>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-3">
            <AppButton
              variant="outline"
              size="md"
              @click="navigateTo('/Patient/Scan/SelectDoctor')"
              class="h-11 rounded-xl text-xs font-bold"
            >
              <Icon
                name="material-symbols:person-search-outline-rounded"
                class="shrink-0 text-base"
              />
              <span class="truncate">Other Doctors</span>
            </AppButton>

            <AppButton
              size="md"
              @click="sendDiagnosis"
              :disabled="isSending || !nearestDoctor"
              class="bg-primary text-white flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-center text-xs font-bold shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              <Icon
                v-if="!isSending"
                name="material-symbols:check-circle-outline-rounded"
                class="shrink-0 text-base"
              />
              <Icon
                v-else
                name="svg-spinners:ring-resize"
                class="shrink-0 text-base"
              />
              <span class="truncate">
                {{ isSending ? 'Sending...' : hasActiveAppointment ? 'Send Findings' : 'Select Doctor' }}
              </span>
            </AppButton>
          </div>

          <!-- Existing appointment notice (full-width, below the buttons) -->
          <div
            v-if="hasActiveAppointment"
            class="mt-3 flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200"
          >
            <Icon name="material-symbols:info-outline-rounded" class="mt-0.5 shrink-0 text-base text-amber-500" />
            <div class="flex-1 text-xs leading-relaxed text-amber-700">
              <span class="font-black">Existing appointment found.</span>
              This will send your new findings to the same doctor in your current conversation.
              Go to
              <NuxtLink
                :to="`/Patient/Messages`"
                @click="emit('close')"
                class="font-bold underline hover:text-amber-900"
              >Messages</NuxtLink>
              to check the status or send additional findings.
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="props.role !== 'doctor' && showGuidancePill"
        @click="scrollToDoctor"
        class="sticky bottom-4 mx-auto z-30 cursor-pointer flex items-center gap-2 rounded-full bg-slate-900/90 text-white px-4 py-2.5 text-xs font-semibold shadow-2xl backdrop-blur-md hover:bg-slate-800 transition-all border border-white/20 active:scale-95 group shrink-0"
      >
        <Icon name="material-symbols:local-hospital-outline-rounded" class="text-base text-indigo-400 group-hover:scale-110 transition-transform" />
        <span>Proceed to Referred Doctor</span>
        <Icon name="material-symbols:keyboard-double-arrow-down-rounded" class="text-base text-indigo-400 animate-bounce" />
      </div>
    </div>



    <!-- Patient Selection Modal -->
    <AppModal v-model="isPatientModalOpen" title="Assign Patient" description="Select a patient for this clinical scan." size="lg">
      <div class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
        <div v-if="uniquePatients.length === 0" class="text-center py-10 text-gray-400">
          <Icon name="material-symbols:inbox-outline" class="text-4xl opacity-50 mb-2" />
          <p>No patients available</p>
        </div>
        <button
          v-for="patient in uniquePatients"
          :key="patient.uuid"
          @click="patientUuid = patient.uuid; isPatientModalOpen = false"
          class="flex items-center gap-4 p-4 rounded-2xl border transition-all text-left w-full"
          :class="patientUuid === patient.uuid ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'"
        >
          <img
            :src="patient.avatar_path ? getStorageUrl(patient.avatar_path) : `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.first_name + '+' + patient.last_name)}&background=7B5EF5&color=fff&size=128`"
            class="h-12 w-12 rounded-full object-cover shrink-0"
          />
          <div class="flex-1">
            <p class="font-bold text-gray-900">{{ patient.first_name }} {{ patient.last_name }}</p>
            <p class="text-xs text-gray-500 mt-0.5">
              Latest: {{ patient.latest_appointment_date ? new Date(patient.latest_appointment_date).toLocaleDateString() : 'N/A' }}
            </p>
          </div>
          <div v-if="patientUuid === patient.uuid" class="bg-primary text-white h-6 w-6 rounded-full flex items-center justify-center shadow-sm">
            <Icon name="material-symbols:check-small-rounded" class="text-xl" />
          </div>
        </button>
      </div>
      <template #footer>
        <AppButton variant="outline" @click="patientUuid = null; isPatientModalOpen = false" class="rounded-xl px-6 font-bold" v-if="patientUuid">
          Clear Selection
        </AppButton>
        <AppButton variant="ghost" @click="isPatientModalOpen = false" class="rounded-xl px-6 font-bold text-gray-500">
          Close
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
