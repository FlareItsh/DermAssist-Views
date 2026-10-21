<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { toast } from 'vue-sonner'
  import { navigateTo, useCookie } from '#app'
  import { useStorage } from '~/composables/useStorage'
  import { userService } from '~/api/user/UserService'
  import { conversationService } from '~/api/conversation/ConversationService'
  import { appointmentService } from '~/api/appointment/AppointmentService'

  interface Props {
    modelValue: boolean
    record: any
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
  }>()

  const { getStorageUrl } = useStorage()
  const userUuid = useCookie('user_uuid')

  // Step state: 'options' | 'select_doctor' | 'confirm'
  const step = ref<'options' | 'select_doctor' | 'confirm'>('options')
  const selectedAction = ref<'chat' | 'appointment' | null>(null)
  const selectedDoctor = ref<any | null>(null)
  const userNote = ref('')
  const searchQuery = ref('')
  const isSubmitting = ref(false)
  const isLoadingDoctors = ref(false)

  // Doctor state
  const isDoctorRegistered = ref(false)
  const attendingDoctor = ref<any | null>(null)
  const myDoctors = ref<any[]>([])
  const allDoctors = ref<any[]>([])
  const doctorTab = ref<'my_doctors' | 'all_doctors'>('my_doctors')

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

  const fetchPatientAndDoctors = async () => {
    if (!userUuid.value) return
    isLoadingDoctors.value = true
    try {
      const patientRes = await userService.show(userUuid.value as string, { t: Date.now() })
      const patient = patientRes?.data ?? patientRes

      isDoctorRegistered.value = Boolean(patient?.is_doctor_registered)

      if (patient?.is_doctor_registered && patient?.registered_by_doctor) {
        attendingDoctor.value = { ...patient.registered_by_doctor, distance: 0 }
        selectedDoctor.value = attendingDoctor.value
        myDoctors.value = [attendingDoctor.value]
        allDoctors.value = [attendingDoctor.value]
        return
      }

      // Fetch existing conversations to find doctors with ongoing chats
      try {
        const convRes = await conversationService.list({ per_page: 50 })
        const convList: any[] = convRes?.data ?? []
        const docsMap = new Map<string, any>()

        for (const c of convList) {
          if (c.doctor && (c.doctor.id || c.doctor.uuid)) {
            const key = String(c.doctor.uuid || c.doctor.id)
            if (!docsMap.has(key)) {
              docsMap.set(key, {
                id: c.doctor.user_id || c.doctor.id,
                uuid: c.doctor.uuid || c.doctor.id,
                first_name: c.doctor.first_name || c.doctor.name?.split(' ')[0] || '',
                last_name: c.doctor.last_name || c.doctor.name?.split(' ').slice(1).join(' ') || '',
                name: c.doctor.name,
                avatar_path: c.doctor.avatar_path,
                affiliation: c.doctor.affiliation || 'Attending Specialist',
                city: c.doctor.city || '',
                province: c.doctor.province || '',
                conversation_uuid: c.id,
                has_existing_conversation: true,
                last_message_at: c.latest_message?.created_at
              })
            }
          }
        }
        myDoctors.value = Array.from(docsMap.values())
        if (myDoctors.value.length > 0) {
          doctorTab.value = 'my_doctors'
        } else {
          doctorTab.value = 'all_doctors'
        }
      } catch (convErr) {
        console.error('Failed to load conversations in ShareRecord:', convErr)
      }

      // Fetch directory of verified doctors
      const patLat = parseCoordinate(patient?.latitude)
      const patLng = parseCoordinate(patient?.longitude)

      const doctorsRes = await userService.list({
        role: 'doctor',
        status: 'verified',
        per_page: 50
      })
      const doctors: any[] = doctorsRes?.data ?? []

      if (patLat !== null && patLng !== null) {
        allDoctors.value = doctors
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
      } else {
        allDoctors.value = doctors.map(d => ({ ...d, distance: 0 }))
      }
    } catch (err) {
      console.error('Failed to fetch doctors in ShareRecord modal:', err)
    } finally {
      isLoadingDoctors.value = false
    }
  }

  watch(
    () => props.modelValue,
    val => {
      if (val) {
        step.value = 'options'
        selectedAction.value = null
        userNote.value = ''
        searchQuery.value = ''
        if (allDoctors.value.length === 0) {
          fetchPatientAndDoctors()
        }
      }
    }
  )

  const close = () => {
    emit('update:modelValue', false)
  }

  const formattedDate = computed(() => {
    if (!props.record?.created_at) return 'Recent Scan'
    const d = new Date(props.record.created_at)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  })

  const recordUuid = computed(() => {
    return props.record?.uuid || props.record?.id || ''
  })

  const shortId = computed(() => {
    const id = recordUuid.value
    return id ? id.slice(0, 8) : 'N/A'
  })

  const conditionLabel = computed(() => {
    return (
      props.record?.label || props.record?.title || props.record?.condition_name || 'Skin Condition'
    )
  })

  const confidenceScore = computed(() => {
    if (typeof props.record?.confidence === 'number') {
      return `${Math.round(props.record.confidence * 100)}% Confidence`
    }
    return ''
  })

  const activeDoctorList = computed(() => {
    if (doctorTab.value === 'my_doctors' && myDoctors.value.length > 0) {
      return myDoctors.value
    }
    return allDoctors.value
  })

  const filteredDoctors = computed(() => {
    const list = activeDoctorList.value
    if (!searchQuery.value.trim()) return list
    const q = searchQuery.value.toLowerCase().trim()
    return list.filter(doc => {
      const fullName = `${doc.first_name || ''} ${doc.last_name || ''}`.toLowerCase()
      const affil = (doc.affiliation || '').toLowerCase()
      const city = (doc.city || '').toLowerCase()
      return fullName.includes(q) || affil.includes(q) || city.includes(q)
    })
  })

  // Navigation handlers
  const handleChooseChatOption = () => {
    selectedAction.value = 'chat'
    if (isDoctorRegistered.value && attendingDoctor.value) {
      selectedDoctor.value = attendingDoctor.value
      step.value = 'confirm'
    } else {
      doctorTab.value = myDoctors.value.length > 0 ? 'my_doctors' : 'all_doctors'
      step.value = 'select_doctor'
    }
  }

  const handleChooseAppointmentOption = () => {
    selectedAction.value = 'appointment'
    if (isDoctorRegistered.value && attendingDoctor.value) {
      selectedDoctor.value = attendingDoctor.value
      step.value = 'confirm'
    } else {
      doctorTab.value = myDoctors.value.length > 0 ? 'my_doctors' : 'all_doctors'
      step.value = 'select_doctor'
    }
  }

  const handleBackToOptions = () => {
    step.value = 'options'
  }

  const handleBackFromConfirm = () => {
    if (isDoctorRegistered.value) {
      step.value = 'options'
    } else {
      step.value = 'select_doctor'
    }
  }

  const handleSelectDoctor = (doc: any) => {
    selectedDoctor.value = doc
    step.value = 'confirm'
  }

  const handleChangeDoctor = () => {
    if (isDoctorRegistered.value) return
    step.value = 'select_doctor'
  }

  const handleSetDoctorTab = (tab: 'my_doctors' | 'all_doctors') => {
    doctorTab.value = tab
    searchQuery.value = ''
  }

  // Execution handlers
  const handleSendDirectMessage = async () => {
    if (!selectedDoctor.value || !recordUuid.value) return
    isSubmitting.value = true
    try {
      const docId = selectedDoctor.value.id || selectedDoctor.value.uuid
      const convRes = await conversationService.create({ doctor_id: docId })
      const convUuid = convRes?.data?.id || convRes?.id

      if (!convUuid) {
        throw new Error('Unable to create or locate doctor conversation.')
      }

      const note = userNote.value.trim()
      const scanTag = `[SCAN_RESULT:${recordUuid.value}]`
      const messageBody = note ? `${note}\n${scanTag}` : scanTag

      await conversationService.sendMessage(convUuid, messageBody)

      toast.success(`Scan findings shared with Dr. ${selectedDoctor.value.last_name || 'Doctor'}!`)
      close()
      await navigateTo(`/Patient/Messages/${convUuid}`)
    } catch (err: any) {
      console.error('Failed to send scan via chat:', err)
      toast.error(err?.data?.message || err?.message || 'Could not send scan to doctor.')
    } finally {
      isSubmitting.value = false
    }
  }

  const handleBookDirectAppointment = async () => {
    if (!selectedDoctor.value || !recordUuid.value) return
    isSubmitting.value = true
    try {
      const docId = selectedDoctor.value.id || selectedDoctor.value.uuid
      const res = await appointmentService.create({
        doctor_id: docId,
        diagnosis_uuid: recordUuid.value,
        message: userNote.value.trim() || undefined
      })

      toast.success('Appointment request submitted with scan attached!')
      close()

      if (res?.conversation_uuid) {
        await navigateTo(`/Patient/Messages/${res.conversation_uuid}`)
      } else {
        await navigateTo('/Patient/Messages')
      }
    } catch (err: any) {
      console.error('Failed to book appointment:', err)
      toast.error(err?.data?.message || err?.message || 'Could not submit appointment request.')
    } finally {
      isSubmitting.value = false
    }
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-999 flex items-center justify-center p-4 sm:p-6"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          @click="close"
        ></div>

        <!-- Modal Card -->
        <div
          class="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-2xl transition-all"
        >
          <!-- Header -->
          <div
            class="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4.5 sm:px-7"
          >
            <div class="flex items-center gap-3">
              <button
                v-if="step !== 'options'"
                type="button"
                @click="step === 'confirm' ? handleBackFromConfirm() : handleBackToOptions()"
                class="hover:bg-primary/10 hover:text-primary -ml-1 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors"
                title="Go back"
              >
                <Icon
                  name="material-symbols:arrow-back-rounded"
                  size="18"
                />
              </button>

              <div
                class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              >
                <Icon
                  v-if="step === 'options'"
                  name="solar:share-bold"
                  size="20"
                />
                <Icon
                  v-else-if="step === 'select_doctor'"
                  name="solar:user-hand-up-bold"
                  size="20"
                />
                <Icon
                  v-else-if="selectedAction === 'chat'"
                  name="solar:chat-round-dots-bold"
                  size="20"
                />
                <Icon
                  v-else
                  name="solar:calendar-date-bold"
                  size="20"
                />
              </div>

              <div>
                <h3 class="text-sm font-bold text-gray-900 sm:text-base">
                  {{
                    step === 'options'
                      ? 'Share Scan Findings'
                      : step === 'select_doctor'
                        ? selectedAction === 'chat'
                          ? 'Select Doctor for Chat'
                          : 'Select Doctor for Consultation'
                        : selectedAction === 'chat'
                          ? 'Send Scan via Chat'
                          : 'Book Consultation'
                  }}
                </h3>
                <p class="text-[11px] font-semibold text-gray-500">Record Ref: #{{ shortId }}</p>
              </div>
            </div>

            <!-- Close Button -->
            <button
              type="button"
              @click="close"
              class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <Icon
                name="lucide:x"
                class="h-4 w-4"
              />
            </button>
          </div>

          <!-- Body Container -->
          <div class="custom-scrollbar flex-1 overflow-y-auto p-6 sm:p-7">
            <!-- STEP 1: OPTIONS -->
            <div
              v-if="step === 'options'"
              class="space-y-4"
            >
              <!-- Mini Scan Summary Card -->
              <div class="rounded-2xl border border-gray-100 bg-gray-50/80 p-3.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    >
                      <Icon
                        name="solar:shield-check-bold"
                        size="16"
                      />
                    </div>
                    <div>
                      <p class="text-xs font-bold text-gray-900">{{ conditionLabel }}</p>
                      <span
                        v-if="confidenceScore"
                        class="text-[10px] font-semibold text-emerald-600"
                      >
                        {{ confidenceScore }}
                      </span>
                    </div>
                  </div>
                  <span class="text-[11px] font-medium text-gray-400">{{ formattedDate }}</span>
                </div>
              </div>

              <p class="text-xs font-medium text-gray-500">
                Choose how you would like to share this clinical scan:
              </p>

              <!-- Option 1: Send via Chat -->
              <button
                type="button"
                @click="handleChooseChatOption"
                class="group flex w-full items-center gap-3.5 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-2xs transition-all hover:border-purple-200 hover:bg-purple-50/30 hover:shadow-xs active:scale-[0.99]"
              >
                <div
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 transition-colors group-hover:bg-purple-100 group-hover:text-purple-700"
                >
                  <Icon
                    name="solar:chat-round-dots-bold-duotone"
                    size="22"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <p class="text-xs font-bold text-gray-900 sm:text-sm">
                      Send to Doctor via Chat
                    </p>
                    <span
                      class="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold tracking-wider text-purple-700 uppercase"
                    >
                      No Appointment
                    </span>
                  </div>
                  <p class="mt-0.5 text-xs text-gray-500">
                    Send findings directly into conversation for review without scheduling a clinic
                    visit.
                  </p>
                </div>
                <Icon
                  name="lucide:chevron-right"
                  class="text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-700"
                  size="18"
                />
              </button>

              <!-- Option 2: Book Consultation -->
              <button
                type="button"
                @click="handleChooseAppointmentOption"
                class="group flex w-full items-center gap-3.5 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-2xs transition-all hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-xs active:scale-[0.99]"
              >
                <div
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100 group-hover:text-blue-700"
                >
                  <Icon
                    name="solar:calendar-date-bold-duotone"
                    size="22"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <p class="text-xs font-bold text-gray-900 sm:text-sm">
                      Book Doctor Consultation
                    </p>
                    <span
                      class="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold tracking-wider text-blue-700 uppercase"
                    >
                      Clinic Visit
                    </span>
                  </div>
                  <p class="mt-0.5 text-xs text-gray-500">
                    Request an in-person or telemedicine appointment with this scan attached.
                  </p>
                </div>
                <Icon
                  name="lucide:chevron-right"
                  class="text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-700"
                  size="18"
                />
              </button>
            </div>

            <!-- STEP 2: SELECT DOCTOR -->
            <div
              v-else-if="step === 'select_doctor'"
              class="space-y-3.5"
            >
              <!-- Doctor Group Filter Tabs (if patient has existing conversations) -->
              <div
                v-if="myDoctors.length > 0"
                class="flex items-center gap-1.5 rounded-2xl border border-gray-200/80 bg-gray-100 p-1"
              >
                <button
                  type="button"
                  @click="handleSetDoctorTab('my_doctors')"
                  class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold transition-all"
                  :class="
                    doctorTab === 'my_doctors'
                      ? 'border border-gray-200/60 bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  "
                >
                  <Icon
                    name="solar:chat-round-line-bold"
                    size="15"
                  />
                  <span>My Doctors</span>
                  <span
                    class="py-0.2 rounded-full px-1.5 text-[10px] font-bold"
                    :class="
                      doctorTab === 'my_doctors'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-gray-200 text-gray-600'
                    "
                  >
                    {{ myDoctors.length }}
                  </span>
                </button>

                <button
                  type="button"
                  @click="handleSetDoctorTab('all_doctors')"
                  class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold transition-all"
                  :class="
                    doctorTab === 'all_doctors'
                      ? 'border border-gray-200/60 bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  "
                >
                  <Icon
                    name="solar:magnifer-linear"
                    size="15"
                  />
                  <span>All Specialists</span>
                  <span
                    class="py-0.2 rounded-full px-1.5 text-[10px] font-bold"
                    :class="
                      doctorTab === 'all_doctors'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-gray-200 text-gray-600'
                    "
                  >
                    {{ allDoctors.length }}
                  </span>
                </button>
              </div>

              <!-- Search Input -->
              <div class="relative">
                <Icon
                  name="lucide:search"
                  class="absolute top-1/2 left-3.5 -translate-y-1/2 text-gray-400"
                  size="16"
                />
                <input
                  v-model="searchQuery"
                  type="text"
                  :placeholder="
                    doctorTab === 'my_doctors' && myDoctors.length > 0
                      ? 'Search your doctors...'
                      : 'Search by doctor name or clinic...'
                  "
                  class="focus:border-primary focus:ring-primary/20 w-full rounded-xl border border-gray-200 bg-gray-50/60 py-2.5 pr-4 pl-10 text-xs text-gray-900 transition-all placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:outline-none"
                />
              </div>

              <!-- Doctors List -->
              <div
                v-if="isLoadingDoctors"
                class="flex flex-col items-center justify-center py-10"
              >
                <Icon
                  name="svg-spinners:ring-resize"
                  class="text-primary text-2xl"
                />
                <p class="mt-2 text-xs font-medium text-gray-500">Loading verified doctors...</p>
              </div>

              <div
                v-else-if="filteredDoctors.length === 0"
                class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-10 text-center"
              >
                <Icon
                  name="solar:user-cross-linear"
                  class="text-3xl text-gray-300"
                />
                <p class="mt-2 text-xs font-bold text-gray-700">No doctors available</p>
                <p class="text-[11px] text-gray-500">
                  {{
                    doctorTab === 'my_doctors' && myDoctors.length > 0
                      ? 'No matching doctors in your active conversations.'
                      : 'Try adjusting your search query.'
                  }}
                </p>
              </div>

              <div
                v-else
                class="space-y-2.5"
              >
                <div
                  v-for="doc in filteredDoctors"
                  :key="doc.uuid || doc.id"
                  @click="handleSelectDoctor(doc)"
                  class="group hover:border-primary/30 hover:bg-primary/5 flex cursor-pointer items-center gap-3.5 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-2xs transition-all active:scale-[0.99]"
                >
                  <!-- Doctor Avatar -->
                  <img
                    :src="doc.avatar_path ? getStorageUrl(doc.avatar_path) : ''"
                    :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((doc.first_name || 'D') + '+' + (doc.last_name || 'r'))}&background=7B5EF5&color=fff&size=128'`"
                    class="h-12 w-12 shrink-0 rounded-xl object-cover shadow-2xs"
                    alt="Doctor avatar"
                  />

                  <!-- Info -->
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <h4
                        class="group-hover:text-primary truncate text-xs font-bold text-gray-900 transition-colors sm:text-sm"
                      >
                        Dr. {{ doc.first_name }} {{ doc.last_name }}
                      </h4>
                      <span
                        v-if="doc.has_existing_conversation"
                        class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[9px] font-bold"
                      >
                        Active Chat
                      </span>
                      <div
                        v-else
                        class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600"
                      >
                        <Icon
                          name="material-symbols:verified-rounded"
                          size="12"
                        />
                        <span>Verified</span>
                      </div>
                    </div>
                    <p
                      v-if="doc.affiliation"
                      class="truncate text-[11px] text-gray-500"
                    >
                      {{ doc.affiliation }}
                    </p>
                    <div class="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400">
                      <span class="truncate"
                        >{{ doc.city || 'Clinic' }}, {{ doc.province || '' }}</span
                      >
                      <template v-if="doc.distance > 0">
                        <span>•</span>
                        <span class="font-semibold text-gray-600"
                          >{{ Math.round(doc.distance * 10) / 10 }} km away</span
                        >
                      </template>
                    </div>
                  </div>

                  <!-- Select Button -->
                  <div
                    class="group-hover:bg-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400 transition-all group-hover:text-white"
                  >
                    <Icon
                      name="material-symbols:arrow-forward-rounded"
                      size="16"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- STEP 3: CONFIRM & SEND -->
            <div
              v-else
              class="space-y-4"
            >
              <!-- Selected Doctor Card -->
              <div
                v-if="selectedDoctor"
                class="rounded-2xl border border-gray-100 bg-gray-50/80 p-4"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <img
                      :src="
                        selectedDoctor.avatar_path ? getStorageUrl(selectedDoctor.avatar_path) : ''
                      "
                      :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((selectedDoctor.first_name || 'D') + '+' + (selectedDoctor.last_name || 'r'))}&background=7B5EF5&color=fff&size=128'`"
                      class="h-11 w-11 shrink-0 rounded-xl object-cover shadow-2xs"
                      alt="Doctor avatar"
                    />
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <p class="truncate text-xs font-bold text-gray-900 sm:text-sm">
                          Dr. {{ selectedDoctor.first_name }} {{ selectedDoctor.last_name }}
                        </p>
                        <span
                          v-if="isDoctorRegistered"
                          class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold"
                        >
                          Attending Doctor
                        </span>
                        <span
                          v-else-if="selectedDoctor.has_existing_conversation"
                          class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold"
                        >
                          Active Chat
                        </span>
                      </div>
                      <p
                        v-if="selectedDoctor.affiliation"
                        class="truncate text-[11px] text-gray-500"
                      >
                        {{ selectedDoctor.affiliation }}
                      </p>
                    </div>
                  </div>

                  <button
                    v-if="!isDoctorRegistered"
                    type="button"
                    @click="handleChangeDoctor"
                    class="text-primary text-[11px] font-bold hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>

              <!-- Scan Details Card -->
              <div class="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-2xs">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-gray-700">Scan Finding:</span>
                  <span class="text-primary font-bold">{{ conditionLabel }}</span>
                </div>
                <div class="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Confidence:</span>
                  <span class="font-semibold text-gray-700">{{
                    confidenceScore || 'Analyzed'
                  }}</span>
                </div>
                <div class="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Date:</span>
                  <span>{{ formattedDate }}</span>
                </div>
              </div>

              <!-- Message / Note Input -->
              <div>
                <label class="mb-1.5 block text-xs font-bold text-gray-700">
                  {{
                    selectedAction === 'chat'
                      ? 'Message for Doctor (Optional)'
                      : 'Reason for Consultation (Optional)'
                  }}
                </label>
                <textarea
                  v-model="userNote"
                  rows="3"
                  class="custom-scrollbar focus:border-primary focus:ring-primary/20 w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:outline-none"
                  :placeholder="
                    selectedAction === 'chat'
                      ? `Add any questions or symptom context for Dr. ${selectedDoctor?.last_name || 'Doctor'}...`
                      : 'Describe any symptoms, duration, or preferred consultation times...'
                  "
                ></textarea>
              </div>

              <!-- Action Confirmation Button -->
              <div class="pt-1">
                <button
                  type="button"
                  @click="
                    selectedAction === 'chat'
                      ? handleSendDirectMessage()
                      : handleBookDirectAppointment()
                  "
                  :disabled="isSubmitting"
                  class="bg-primary hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-white shadow-md transition-all active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                >
                  <Icon
                    v-if="isSubmitting"
                    name="svg-spinners:ring-resize"
                    size="18"
                  />
                  <Icon
                    v-else-if="selectedAction === 'chat'"
                    name="solar:plain-bold"
                    size="18"
                  />
                  <Icon
                    v-else
                    name="solar:calendar-add-bold"
                    size="18"
                  />
                  <span>
                    {{
                      isSubmitting
                        ? 'Sending...'
                        : selectedAction === 'chat'
                          ? `Send Scan to Dr. ${selectedDoctor?.last_name || 'Doctor'}`
                          : `Submit Consultation Request`
                    }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="flex shrink-0 items-center justify-between border-t border-gray-100 bg-gray-50/50 px-6 py-3 sm:px-7"
          >
            <span class="text-[11px] text-gray-400">
              {{
                step === 'options'
                  ? 'Select an option to proceed'
                  : step === 'select_doctor'
                    ? `${filteredDoctors.length} doctors available`
                    : 'Review and confirm'
              }}
            </span>
            <button
              type="button"
              @click="close"
              class="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
</style>
