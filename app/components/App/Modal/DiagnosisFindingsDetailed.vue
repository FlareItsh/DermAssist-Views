<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import type { DonutEntry } from '../DonutChart.vue'

const userUuid = useCookie('user_uuid')
const userName = useCookie('user_name')
const patientAge = ref<string | number | null>(null)
const { getStorageUrl } = useStorage()
const { appointments, pendingAppointments } = useAppointments()

const hasActiveAppointment = computed(() => {
  if (!nearestDoctor.value) return false
  const active = [...appointments.value, ...pendingAppointments.value]
    .filter(a => ['scheduled', 'pending'].includes(a.status))
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

defineEmits(['close'])

// ── Doctor-editable patient info ──────────────────────────────────
const editablePatientName = ref('')
const editablePatientAge = ref('')

watch(() => props.patientName, (val) => {
  editablePatientName.value = val || ''
}, { immediate: true })

watch(patientAge, (val) => {
  editablePatientAge.value = val ? String(val) : ''
}, { immediate: true })

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
    await $api('/appeals', {
      method: 'POST',
      body: {
        user_uuid: userUuid.value,
        diagnosis_label: activeDisease.value,
        suggested_label: suggestedLabel.value,
        description: appealDescription.value
      }
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

// ── Disease database ──────────────────────────────────────────────
const diseases = {
  Eczema: {
    description:
      'also known as atopic dermatitis, is a chronic skin condition characterized by patches of skin that become inflamed, itchy, cracked, and rough. It is not contagious, but it can be persistent and often flares up periodically.',
    symptoms: [
      'Intense Itching: Often the most burdensome symptom, which can lead to sleep disruption.',
      'Dry, Sensitive Skin: The skin may feel tight or look scaly.',
      'Discoloration: On lighter skin, it often appears red or pink. On darker skin, it may look brown, purple, or gray.',
      'Texture Changes: Small, raised bumps may leak fluid when scratched, or the skin may thicken and become leathery.'
    ],
    causes: [
      'Genetics: It often runs in families, especially those with a history of asthma or hay fever.',
      'Immune System: An overactive immune response to small triggers.',
      'Environmental Triggers: Things like harsh soaps, detergents, stress, weather changes, or certain fabrics like wool.'
    ],
    color: '#d97706' // Serious Amber
  },
  Acne: {
    description:
      'is a common skin condition that occurs when hair follicles become clogged with oil and dead skin cells. It causes whiteheads, blackheads, or pimples and is most common among teenagers, though it affects people of all ages.',
    symptoms: [
      'Whiteheads: Closed clogged pores that appear as small white bumps on the skin.',
      'Blackheads: Open clogged pores that turn dark due to oxidation on the surface.',
      'Papules: Small, red, tender bumps that signal inflammation or infection.',
      'Nodules and Cysts: Large, solid, painful lumps deep in the skin that can cause scarring.'
    ],
    causes: [
      'Excess Oil Production: Sebaceous glands producing too much sebum can clog pores.',
      'Bacteria: Propionibacterium acnes bacteria on the skin can trigger inflammation.',
      'Hormonal Changes: Androgens that increase during puberty, pregnancy, or stress can enlarge sebaceous glands.'
    ],
    color: '#ef4444' // High-Alert Red
  },
  Herpes: {
    description:
      'HSV (Herpes Simplex Virus) is a common viral infection that causes sores on the mouth or genitals. HSV-1 typically causes oral herpes while HSV-2 causes genital herpes. The virus remains dormant in the body and can reactivate periodically.',
    symptoms: [
      'Cold Sores or Blisters: Fluid-filled blisters around the mouth, lips, or genitals that can break and crust over.',
      'Pain and Itching: Tingling, itching, or burning sensations often precede the appearance of sores.',
      'Flu-like Symptoms: During the first outbreak, fever, swollen lymph nodes, and body aches may occur.',
      'Recurrent Outbreaks: The virus reactivates periodically, often triggered by stress, illness, or sun exposure.'
    ],
    causes: [
      'HSV-1 Transmission: Spread through oral contact such as kissing or sharing utensils with an infected person.',
      'HSV-2 Transmission: Primarily spread through sexual contact with an infected individual.',
      'Reactivation Triggers: Stress, weakened immune system, fever, or prolonged sun exposure can trigger outbreaks.'
    ],
    color: '#4c0519' // Deep Critical Maroon
  },
  Clear: {
    description:
      'indicates that no significant skin irregularities or signs of infection were detected. The skin appears to be maintaining its natural barrier and healthy physiological state.',
    symptoms: [
      'Natural Elasticity: The skin feels firm and returns to its original position quickly when pinched.',
      'Even Texture: Smooth surfaces without unexplained bumps, rough patches, or scaling.',
      'Hydrated Appearance: No visible flakes or excessive tightness.',
      'Consistent Color: No unusual redness, dark spots, or pale patches compared to surrounding skin.'
    ],
    causes: [
      'Consistent Skincare: Following a regular cleansing and moisturizing routine.',
      'Hydration: Drinking adequate water and maintaining internal health.',
      'Sun Protection: Regular use of SPF to prevent UV damage.',
      'Healthy Diet: Consuming vitamins and minerals that support skin regeneration.'
    ],
    color: '#22c55e' // Healthy Green
  },
  None: {
    description:
      'indicates that the skin appears clear and healthy. No visible lesions, inflammations, or typical symptoms of skin disease were identified in the scanned area.',
    symptoms: [
      'Healthy Skin Surface: The area shows normal pore distribution and skin oils.',
      'No Inflammation: Absence of redness, swelling, or heat typical of infections.',
      'Natural Barrier: The skin is performing its function of protecting the body.',
      'Uniform Tone: No significant hyperpigmentation or scaly patches.'
    ],
    causes: [
      'Proper Hydration: Helping the skin stay supple and resilient.',
      'Effective Skincare: Using products that complement your skin type.',
      'UV Defense: Minimizing damage from sunlight.',
      'Good Overall Health: Skin often reflects internal well-being.'
    ],
    color: '#22c55e' // Healthy Green
  }
}

type DiseaseName = keyof typeof diseases

const defaultChartData: DonutEntry[] = [
  { label: 'Healthy', value: 100, color: '#22c55e' }
]

// ── Active disease state ──────────────────────────────────────────
const activeDisease = ref<DiseaseName>((props.conditionName as DiseaseName) || 'Eczema')

// Sync with props when modal opens or prop changes
watch(() => props.conditionName, (newVal) => {
  if (newVal === 'Healthy') {
    activeDisease.value = 'Clear'
    return
  }
  if (newVal && (diseases as any)[newVal]) {
    activeDisease.value = newVal as DiseaseName
  }
}, { immediate: true })

const currentDisease = computed(() => diseases[activeDisease.value])

const displaySymptoms = computed(() => props.symptoms ?? currentDisease.value.symptoms)
const displayCauses = computed(() => props.causes ?? currentDisease.value.causes)
const displayChartData = computed(() => {
  return props.diagnosisData ?? defaultChartData
})

const filterPills = computed(() =>
  displayChartData.value.filter(e => e.label !== activeDisease.value)
)

// ── Nearest doctor by proximity ───────────────────────────────────
const nearestDoctor = ref<any | null>(null)
const isDoctorLoading = ref(false)
const doctorDistance = ref<number | null>(null)
const isProfileIncomplete = ref(false)

/**
 * Haversine formula: calculates distance in km between two lat/lng pairs.
 */
const haversineDistance = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
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

const fetchNearestDoctor = async () => {
  if (!userUuid.value) return
  isDoctorLoading.value = true
  isProfileIncomplete.value = false

  try {
    // 1. Get the user's latest data (bypassing cache with a timestamp)
    const patientRes = await $api<any>(`users/${userUuid.value}?t=${Date.now()}`)
    const patient = patientRes?.data

    // NEW: Check if there's an active appointment already.
    // If so, we prioritize that doctor instead of searching for the nearest.
    const activeAppt = [...appointments.value, ...pendingAppointments.value]
      .find(a => a.status === 'scheduled' || a.status === 'pending')

    if (activeAppt) {
      try {
        const docRes = await $api<any>(`users/${activeAppt.doctor_id}`)
        nearestDoctor.value = docRes?.data || docRes
        doctorDistance.value = null
        isDoctorLoading.value = false
        return
      } catch (docErr) {
        console.error('Failed to fetch existing doctor:', docErr)
      }
    }
    
    // Check if location or coordinates are missing
    if (!patient?.city || !patient?.province || !patient?.latitude || !patient?.longitude) {
      isProfileIncomplete.value = true
      isDoctorLoading.value = false
      return
    }

    const patLat = parseFloat(patient?.latitude)
    const patLng = parseFloat(patient?.longitude)

    // 2. Fetch all verified doctors
    const doctorsRes = await $api<any>('users', {
      params: { role: 'doctor', status: 'verified', per_page: 100 }
    })
    const doctors: any[] = doctorsRes?.data ?? []

    // 3. Filter to those with coordinates, compute distance, sort
    const withDistance = doctors
      .filter(d => d.latitude && d.longitude)
      .map(d => ({
        ...d,
        distance: (patLat && patLng)
          ? haversineDistance(patLat, patLng, parseFloat(d.latitude), parseFloat(d.longitude))
          : Infinity
      }))
      .sort((a, b) => a.distance - b.distance)

    if (withDistance.length > 0) {
      nearestDoctor.value = withDistance[0]
      doctorDistance.value = Math.round(withDistance[0].distance * 10) / 10
    }
  } catch (e) {
    console.error('Failed to fetch nearest doctor:', e)
  } finally {
    isDoctorLoading.value = false
  }
}

const fetchUserAge = async () => {
  if (!userUuid.value) return
  try {
    const res = await $api<any>(`users/${userUuid.value}`)
    patientAge.value = res?.data?.age ?? null
  } catch (e) {
    console.error('Failed to fetch user age:', e)
  }
}

const isSending = ref(false)

const sendDiagnosis = async () => {
  if (!nearestDoctor.value || !props.diagnosisUuid) return
  isSending.value = true
  
  try {
    const res = await $api<any>('appointments', {
      method: 'POST',
      body: {
        doctor_id: nearestDoctor.value.id,
        diagnosis_uuid: props.diagnosisUuid,
        message: messageText.value
      }
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
  <div class="flex h-full max-h-[90vh] overflow-hidden rounded-[2.5rem]">
    <!-- Left Column -->
    <div class="custom-scrollbar flex flex-1 flex-col overflow-y-auto p-8 pr-6">
      <h1 class="text-foreground mb-6 text-4xl font-black">{{ activeDisease }}</h1>

      <div class="mb-8 flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span class="text-base font-bold">Patient Name:</span>
          <input v-if="props.role === 'doctor'" v-model="editablePatientName"
            class="border-b border-gray-300 bg-transparent px-1 text-base outline-none focus:border-primary transition-colors"
            placeholder="Enter patient name" />
          <span v-else class="text-base">{{ patientName || (props.role === 'patient' ? userName : '') || 'Guest User'
          }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-base font-bold">Age:</span>
          <input v-if="props.role === 'doctor'" v-model="editablePatientAge" type="number" min="0"
            class="w-50 border-b border-gray-300 bg-transparent px-1 text-base outline-none focus:border-primary transition-colors"
            placeholder="Enter patient age" />
          <span v-else class="text-base">{{ patientAge || '--' }}</span>
        </div>
        <p class="text-base">
          <span class="font-bold">Date:</span>
          <span class="ml-2">{{ date || new Date().toLocaleDateString() }}</span>
        </p>
      </div>

      <!-- Appeal Section (Doctor only) -->


      <div class="mb-3">
        <p class="text-base leading-relaxed">
          <span class="mr-1 inline-flex items-center gap-2">
            <span class="bg-primary inline-block h-3 w-3 shrink-0 rounded-full"></span>
            <strong>{{ activeDisease }}</strong>
          </span>
          {{ description || currentDisease.description }}
        </p>
      </div>

      <div class="mb-6">
        <p class="mb-2 font-semibold">Common Symptoms</p>
        <p class="mb-2 text-sm text-gray-600">
          The appearance can vary significantly depending on skin tone and severity:
        </p>
        <ul class="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li v-for="(symptom, i) in displaySymptoms" :key="i">
            {{ symptom }}
          </li>
        </ul>
      </div>

      <div>
        <p class="mb-2 font-semibold">What Causes It?</p>
        <p class="mb-2 text-sm text-gray-600">Generally believed to be a combination of factors:</p>
        <ol class="list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li v-for="(cause, i) in displayCauses" :key="i">
            {{ cause }}
          </li>
        </ol>
      </div>

    </div>

    <!-- Right Column -->
    <div
      class="custom-scrollbar flex w-[450px] shrink-0 flex-col gap-6 overflow-y-auto border-l border-gray-50 p-8 pl-6 lg:w-[600px]">
      <h2 class="mb-4 text-2xl font-bold">Findings</h2>
      <div :class="{ 'flex-1 flex flex-col justify-center': props.role === 'doctor' }">
        <div :class="[
          props.role === 'doctor'
            ? 'flex flex-col items-center'
            : 'flex items-center justify-center gap-6'
        ]">
          <AppDonutChart :data="displayChartData" :size="props.role === 'doctor' ? 270 : 180"
            :stroke-width="props.role === 'doctor' ? 50 : 30" />
          <div :class="[props.role === 'doctor' ? 'mt-10 grid w-full grid-cols-2 gap-4' : 'flex flex-col gap-3']">
            <div v-for="(entry, i) in displayChartData" :key="i"
              class="group flex cursor-pointer items-center justify-between gap-4 rounded-xl p-2 transition-all hover:bg-gray-50 hover:shadow-sm"
              @click="activeDisease = entry.label as DiseaseName">
              <div class="flex items-center gap-2">
                <span class="h-4 w-4 shrink-0 rounded-full" :style="{ backgroundColor: entry.color }"></span>
                <span class="text-base font-semibold"
                  :class="activeDisease === entry.label ? 'text-secondary' : 'text-foreground'">
                  {{ entry.value }}% {{ entry.label }}
                </span>
              </div>
              <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
                class="flex h-8 w-8 items-center justify-center rounded-full transition-all" :class="activeDisease === entry.label
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-600'
                  ">
                <Icon :name="activeDisease === entry.label ? 'material-symbols:check' : 'material-symbols:search'"
                  class="text-lg" />
              </AppButton>
            </div>
          </div>
        </div>
        <div v-if="props.role === 'doctor'"
          class="mt-4 overflow-hidden rounded-2xl border border-red-100 bg-red-50/30 p-4 transition-all"
          :class="isAppealOpen ? 'max-h-[500px] opacity-100' : 'max-h-[60px] opacity-80'">
          <div class="flex cursor-pointer items-center justify-between" @click="isAppealOpen = !isAppealOpen">
            <div class="flex items-center gap-2 text-red-600">
              <Icon name="material-symbols:report-outline" class="text-xl" />
              <span class="font-semibold">Appeal Clinical Result</span>
            </div>
            <Icon name="material-symbols:keyboard-arrow-down-rounded" class="text-2xl text-red-400 transition-transform"
              :class="{ 'rotate-180': isAppealOpen }" />
          </div>

          <div v-if="isAppealOpen" class="mt-4 flex flex-col gap-4">
            <p class="text-xs text-red-500 leading-relaxed">
              If you believe the AI detection is incorrect, please provide your clinical diagnosis and reasoning below
              for admin review.
            </p>

            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold uppercase text-gray-500">Correct Diagnosis</label>
              <select v-model="suggestedLabel"
                class="w-full rounded-xl border border-red-100 bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-red-100">
                <option value="" disabled>Select the actual condition</option>
                <option v-for="(_, name) in diseases" :key="name" :value="name">{{ name }}</option>
              </select>
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold uppercase text-gray-500">Clinical Reasoning (Required)</label>
              <textarea v-model="appealDescription" rows="3"
                class="w-full resize-none rounded-xl border border-red-100 bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-red-100"
                placeholder="Describe why the AI detection is incorrect based on your clinical findings..."></textarea>
            </div>

            <div v-if="appealError" class="rounded-lg bg-red-100/50 p-2 text-xs text-red-600">
              {{ appealError }}
            </div>

            <div v-if="appealSuccess" class="rounded-lg bg-green-100 p-2 text-xs text-green-600 font-bold">
              Appeal submitted successfully.
            </div>

            <AppButton v-else variant="unstyled" size="unstyled" rounded="unstyled"
              class="bg-red-500 py-3 rounded-xl text-white font-bold text-sm shadow-md active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              :disabled="!suggestedLabel || !appealDescription || isSubmittingAppeal" @click="submitAppeal">
              <Icon v-if="isSubmittingAppeal" name="svg-spinners:ring-resize" class="text-lg" />
              {{ isSubmittingAppeal ? 'Submitting...' : 'Submit Appeal' }}
            </AppButton>
          </div>
        </div>
      </div>

      <div v-if="props.role !== 'doctor'"
        class="bg-card flex flex-col gap-4 rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold">{{ hasActiveAppointment ? 'Send to Referred Doctor' : 'Referred Doctor' }}</h3>
        </div>

        <div v-if="isDoctorLoading" class="flex gap-4 animate-pulse">
          <div class="h-36 w-32 shrink-0 rounded-2xl bg-gray-100"></div>
          <div class="flex flex-1 flex-col gap-2 pt-2">
            <div class="h-4 w-3/4 rounded bg-gray-100"></div>
            <div class="h-3 w-1/2 rounded bg-gray-100"></div>
            <div class="h-3 w-full rounded bg-gray-100"></div>
            <div class="h-3 w-5/6 rounded bg-gray-100"></div>
          </div>
        </div>

        <div v-else-if="isProfileIncomplete" class="bg-primary/5 border-primary/20 flex flex-col items-center gap-4 rounded-2xl border p-6 text-center shadow-sm transition-all animate-in zoom-in-95 duration-500">
          <div class="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
            <Icon name="material-symbols:location-on-outline-rounded" class="text-primary text-3xl" />
          </div>
          <div>
            <h4 class="text-base font-bold text-foreground">Set Your Location</h4>
            <p class="mt-1 text-sm leading-relaxed text-gray-500">
              Please complete your profile so we can refer you to the nearest verified doctors in your area.
            </p>
          </div>
          <AppButton 
            variant="unstyled" 
            size="unstyled" 
            rounded="unstyled" 
            @click="navigateTo('/Patient/profile')"
            class="bg-primary text-card w-full rounded-full py-3 text-sm font-bold shadow-md transition-all hover:opacity-90 active:scale-95"
          >
            Complete Profile
          </AppButton>
        </div>

        <div v-else-if="!nearestDoctor" class="flex flex-col items-center gap-2 py-8 text-center text-gray-400">
          <Icon name="material-symbols:person-search-outline" class="text-4xl" />
          <p class="text-sm">No verified doctors found nearby.</p>
        </div>

        <div v-else class="flex flex-col gap-4">
          <!-- Distance Warning Badge -->
          <div v-if="doctorDistance && doctorDistance > 50" class="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3 transition-all animate-in slide-in-from-top-2">
            <Icon name="material-symbols:distance-outline-rounded" class="text-amber-500 text-xl mt-0.5 shrink-0" />
            <div class="flex flex-col gap-0.5">
              <p class="text-xs font-bold text-amber-700 uppercase">Note: Limited Doctor Coverage</p>
              <p class="text-[11px] leading-relaxed text-amber-600/80">
                This is the nearest verified doctor available on our platform, but they are currently <strong>{{ doctorDistance }}km</strong> away from your location.
              </p>
            </div>
          </div>

          <div class="flex gap-4">
            <div class="shrink-0 rounded-2xl w-50 border-2 border-gray-200 p-3 relative">
              <!-- Far Badge on Image -->
              <div v-if="doctorDistance && doctorDistance > 50" class="absolute top-4 left-4 z-10 bg-amber-500 text-[10px] font-bold text-white px-2 py-0.5 rounded-full shadow-sm">
                FAR
              </div>
              
              <img :src="nearestDoctor.avatar_path ? getStorageUrl(nearestDoctor.avatar_path) : ''"
                :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((nearestDoctor.first_name || 'D') + '+' + (nearestDoctor.last_name || 'r'))}&background=7B5EF5&color=fff&size=128'`"
                class="h-28 w-full rounded-xl object-cover" alt="Doctor photo" />
              <p class="mt-1 text-xs text-gray-500">{{ nearestDoctor.city }}</p>
              <p class="text-md text-foreground leading-4">{{ nearestDoctor.province }}</p>
              <div class="mt-4 flex justify-end gap-3">
                <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
                  class="border-primary flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-gray-50">
                  <Icon name="material-symbols:call-outline" class="text-secondary text-lg" />
                </AppButton>
                <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
                  class="border-primary flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-gray-50">
                  <Icon name="material-symbols:chat-outline" class="text-secondary text-lg" />
                </AppButton>
              </div>
            </div>
            <div class="flex flex-1 flex-col gap-1">
              <p class="text-base font-bold">Dr. {{ nearestDoctor.first_name }} {{ nearestDoctor.last_name }}</p>
              <p class="text-xs text-gray-500">PRC #{{ nearestDoctor.prc_number || 'N/A' }}</p>
              <p class="text-xs text-gray-500">Location: {{ nearestDoctor.city }}, {{ nearestDoctor.barangay }}</p>
              <div class="mt-1">
                <p class="mb-1 text-sm font-bold">Professional Summary</p>
                <p class="text-xs leading-relaxed text-gray-600">
                  A verified dermatologist with expertise in skin conditions, dedicated to providing
                  personalized care and evidence-based treatments for patients in the {{ nearestDoctor.city || 'local' }}
                  area.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-1 flex gap-3">
          <AppButton v-if="!hasActiveAppointment" variant="unstyled" size="unstyled" rounded="unstyled"
            class="bg-primary-light flex-1 rounded-full py-2.5 text-sm font-semibold text-gray-600 transition-all hover:opacity-90 active:scale-95">
            Select a Doctor
          </AppButton>
          <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
            @click="sendDiagnosis"
            :disabled="isSending || !nearestDoctor"
            class="bg-primary text-card flex-1 rounded-full py-2.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50">
            {{ isSending ? 'Sending...' : (hasActiveAppointment ? 'Send to Referred Doctor' : 'Send Diagnosis') }}
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>
