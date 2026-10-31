<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { userService } from '~/api/user/UserService'
  import { useStorage } from '~/composables/useStorage'
  import { calculateAge } from '~/composables/useFormSanitizer'
  import { toast } from 'vue-sonner'

  interface Attachment {
    id: string
    name: string
    url: string
    type: string
    size: number
    created_at: string
  }

  interface Message {
    id: string
    message: string
    sender?: any
    created_at: string
    attachments?: Attachment[]
    appointment_data?: {
      status: string
      diagnosis?: {
        label: string
        confidence?: number
        image_path: string
        patient_name: string
        patient_age?: number | string
        date?: string
      }
    }
  }

  const props = withDefaults(
    defineProps<{
      userUuid?: string | null
      conversationUuid: string
      otherPersonName: string
      otherPersonAvatar?: string | null
      messages?: Message[]
      activeAppointment?: any
      pendingAppointment?: any
      inline?: boolean
    }>(),
    {
      userUuid: null,
      messages: () => [],
      activeAppointment: null,
      pendingAppointment: null,
      inline: false
    }
  )

  const emit = defineEmits<{
    (e: 'close'): void
    (e: 'scheduleAppointment'): void
    (e: 'rescheduleAppointment', appt: any): void
    (e: 'openAppointment', appt: any): void
    (e: 'viewRecord', patientUuid: string): void
    (e: 'search'): void
    (e: 'deleteConversation'): void
    (e: 'previewImage', url: string): void
  }>()

  const { getStorageUrl } = useStorage()
  const userRole = useCookie('user_role')

  const userDetails = ref<any>(null)
  const isLoadingUser = ref(false)
  const isMuted = ref(false)
  const activeMediaTab = ref<'media' | 'files'>('media')
  const isInfoExpanded = ref(true)
  const isApptExpanded = ref(true)
  const isMediaExpanded = ref(true)

  const isImageAttachment = (type?: string, name?: string): boolean => {
    if (type && type.toLowerCase().startsWith('image/')) return true
    if (name) {
      const ext = name.toLowerCase().split('.').pop()
      return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext || '')
    }
    return false
  }

  const fetchUserDetails = async () => {
    if (!props.userUuid) return
    try {
      isLoadingUser.value = true
      const res = await userService.show(props.userUuid)
      userDetails.value = (res as any)?.data ?? res
    } catch (err) {
      console.warn('Could not fetch extra user details', err)
    } finally {
      isLoadingUser.value = false
    }
  }

  watch(
    () => props.userUuid,
    () => {
      fetchUserDetails()
    },
    { immediate: true }
  )

  const computedAge = computed(() => {
    if (!userDetails.value) return null
    return (
      calculateAge(userDetails.value.date_of_birth) ??
      userDetails.value.age ??
      userDetails.value.patient_age ??
      null
    )
  })

  const roleBadgeLabel = computed(() => {
    if (!userDetails.value && !userRole.value) return 'User'
    const targetRole =
      userDetails.value?.role || (userRole.value === 'patient' ? 'doctor' : 'patient')

    if (targetRole === 'doctor') {
      return 'Attending Dermatologist'
    }
    if (targetRole === 'secretary') {
      return 'Clinic Secretary'
    }
    if (userDetails.value?.is_walk_in) {
      return 'Walk-In Patient'
    }
    if (userDetails.value?.is_doctor_registered) {
      return 'Registered Patient'
    }
    return 'Patient'
  })

  // Dynamic extraction of shared media & scans from conversation messages
  const sharedMediaList = computed(() => {
    const list: { id: string; url: string; title: string; date: string; type: 'scan' | 'photo' }[] =
      []
    const seenUrls = new Set<string>()

    const sorted = [...(props.messages || [])].reverse()

    for (const msg of sorted) {
      if (msg.appointment_data?.diagnosis?.image_path) {
        const fullUrl = getStorageUrl(msg.appointment_data.diagnosis.image_path)
        if (fullUrl && !seenUrls.has(fullUrl)) {
          seenUrls.add(fullUrl)
          list.push({
            id: `diag-${msg.id}`,
            url: fullUrl,
            title: msg.appointment_data.diagnosis.label || 'Clinical Scan',
            date: msg.appointment_data.diagnosis.date || msg.created_at,
            type: 'scan'
          })
        }
      }

      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          if (isImageAttachment(att.type, att.name)) {
            const url = att.url || getStorageUrl(att.name)
            if (url && !seenUrls.has(url)) {
              seenUrls.add(url)
              list.push({
                id: att.id || `att-${msg.id}`,
                url,
                title: att.name || 'Photo',
                date: att.created_at || msg.created_at,
                type: 'photo'
              })
            }
          }
        }
      }
    }

    return list
  })

  const sharedFilesList = computed(() => {
    const list: { id: string; url: string; name: string; size?: number; date: string }[] = []
    const seenUrls = new Set<string>()

    for (const msg of props.messages || []) {
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          if (!isImageAttachment(att.type, att.name)) {
            const url = att.url || getStorageUrl(att.name)
            if (url && !seenUrls.has(url)) {
              seenUrls.add(url)
              list.push({
                id: att.id || `file-${msg.id}`,
                url,
                name: att.name || 'Document',
                size: att.size,
                date: att.created_at || msg.created_at
              })
            }
          }
        }
      }
    }

    return list
  })

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || isNaN(bytes)) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  onMounted(() => {
    if (typeof window !== 'undefined' && props.conversationUuid) {
      isMuted.value = localStorage.getItem(`chat_muted_${props.conversationUuid}`) === 'true'
    }
  })

  watch(
    () => props.conversationUuid,
    newUuid => {
      if (typeof window !== 'undefined' && newUuid) {
        isMuted.value = localStorage.getItem(`chat_muted_${newUuid}`) === 'true'
      }
    }
  )

  const handleToggleMute = () => {
    isMuted.value = !isMuted.value
    if (typeof window !== 'undefined' && props.conversationUuid) {
      localStorage.setItem(`chat_muted_${props.conversationUuid}`, String(isMuted.value))
    }
    toast.success(isMuted.value ? 'Conversation muted' : 'Notifications unmuted')
  }

  const handleScheduleClick = () => {
    emit('scheduleAppointment')
  }

  const handleRescheduleClick = () => {
    if (props.activeAppointment) {
      emit('rescheduleAppointment', props.activeAppointment)
    }
  }

  const handleAppointmentClick = () => {
    if (props.activeAppointment) {
      emit('openAppointment', props.activeAppointment)
    }
  }

  const handleViewRecordClick = () => {
    emit('viewRecord', props.userUuid || '')
  }

  const handleSearchClick = () => {
    emit('search')
  }

  const handleDeleteClick = () => {
    emit('deleteConversation')
  }

  const handleImageClick = (url: string) => {
    emit('previewImage', url)
  }

  const handleClose = () => {
    emit('close')
  }
</script>

<template>
  <aside
    class="border-border bg-card/95 text-foreground flex h-full w-full flex-col overflow-hidden transition-all select-none"
    :class="[
      inline
        ? 'w-full max-w-xs border-l shadow-none md:max-w-sm lg:w-80 xl:w-88 2xl:w-96'
        : 'h-full w-full shadow-2xl'
    ]"
  >
    <!-- Top Action Bar -->
    <div class="border-border/60 flex items-center justify-between border-b px-4 py-3.5 sm:px-5">
      <div class="flex items-center gap-2">
        <Icon
          name="solar:user-id-bold"
          class="text-primary text-xl"
        />
        <h3 class="text-foreground text-sm font-bold tracking-tight sm:text-base">Details</h3>
      </div>
      <button
        type="button"
        @click="handleClose"
        class="text-foreground/50 hover:text-foreground hover:bg-foreground/5 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
        title="Close details"
      >
        <Icon
          name="material-symbols:close-rounded"
          class="text-xl"
        />
      </button>
    </div>

    <!-- Scrollable Profile Content -->
    <div class="custom-scrollbar flex-1 overflow-y-auto px-4 py-5 sm:px-5">
      <!-- Profile Header Hero -->
      <div class="flex flex-col items-center text-center">
        <div class="relative">
          <div
            class="bg-muted ring-primary/20 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm ring-4 sm:h-24 sm:w-24"
          >
            <img
              v-if="otherPersonAvatar"
              :src="getStorageUrl(otherPersonAvatar)"
              :alt="otherPersonName"
              class="h-full w-full object-cover"
            />
            <div
              v-else
              class="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-2xl font-black uppercase sm:text-3xl"
            >
              {{ otherPersonName ? otherPersonName.charAt(0) : '?' }}
            </div>
          </div>
        </div>

        <h2 class="text-foreground mt-3 text-lg font-black tracking-tight sm:text-xl">
          {{ otherPersonName }}
        </h2>

        <div class="mt-1 flex items-center gap-1.5">
          <span
            class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
          >
            <Icon
              :name="
                roleBadgeLabel.includes('Doctor')
                  ? 'solar:stethoscope-bold'
                  : 'solar:user-check-bold'
              "
              class="text-xs"
            />
            {{ roleBadgeLabel }}
          </span>
        </div>

        <!-- Quick Actions Row (Messenger 4-button rail) -->
        <div class="mt-5 grid w-full grid-cols-4 gap-2">
          <!-- View Profile / Record -->
          <button
            type="button"
            @click="handleViewRecordClick"
            class="hover:bg-foreground/5 flex flex-col items-center gap-1.5 rounded-2xl p-2.5 transition-all active:scale-95"
            title="View Records"
          >
            <div
              class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full shadow-xs"
            >
              <Icon
                name="solar:folder-with-files-bold"
                class="text-lg"
              />
            </div>
            <span class="text-foreground/70 text-[11px] font-semibold">Records</span>
          </button>

          <!-- Schedule Appointment -->
          <button
            type="button"
            @click="handleScheduleClick"
            class="hover:bg-foreground/5 flex flex-col items-center gap-1.5 rounded-2xl p-2.5 transition-all active:scale-95"
            title="Schedule Visit"
          >
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 shadow-xs"
            >
              <Icon
                name="solar:calendar-date-bold"
                class="text-lg"
              />
            </div>
            <span class="text-foreground/70 text-[11px] font-semibold">Schedule</span>
          </button>

          <!-- Search Conversation -->
          <button
            type="button"
            @click="handleSearchClick"
            class="hover:bg-foreground/5 flex flex-col items-center gap-1.5 rounded-2xl p-2.5 transition-all active:scale-95"
            title="Search in Chat"
          >
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 shadow-xs"
            >
              <Icon
                name="solar:magnifer-linear"
                class="text-lg"
              />
            </div>
            <span class="text-foreground/70 text-[11px] font-semibold">Search</span>
          </button>

          <!-- Mute Notifications -->
          <button
            type="button"
            @click="handleToggleMute"
            class="hover:bg-foreground/5 flex flex-col items-center gap-1.5 rounded-2xl p-2.5 transition-all active:scale-95"
            :title="isMuted ? 'Unmute notifications' : 'Mute notifications'"
          >
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full shadow-xs transition-colors"
              :class="
                isMuted ? 'bg-rose-500/15 text-rose-600' : 'bg-foreground/10 text-foreground/70'
              "
            >
              <Icon
                :name="isMuted ? 'solar:bell-off-bold' : 'solar:bell-linear'"
                class="text-lg"
              />
            </div>
            <span class="text-foreground/70 text-[11px] font-semibold">
              {{ isMuted ? 'Muted' : 'Mute' }}
            </span>
          </button>
        </div>
      </div>

      <hr class="border-border/60 my-5" />

      <!-- Active / Scheduled Appointment Card -->
      <div class="mb-4">
        <button
          type="button"
          @click="isApptExpanded = !isApptExpanded"
          class="hover:text-primary flex w-full items-center justify-between text-xs font-bold tracking-wider uppercase transition-colors"
        >
          <span class="flex items-center gap-1.5">
            <Icon
              name="solar:calendar-mark-bold"
              class="text-primary text-sm"
            />
            Appointments
          </span>
          <Icon
            :name="isApptExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'"
            class="text-base"
          />
        </button>

        <div
          v-if="isApptExpanded"
          class="mt-3 space-y-2.5"
        >
          <!-- Active appointment pill card -->
          <div
            v-if="activeAppointment"
            @click="handleAppointmentClick"
            class="group border-primary/25 bg-primary/5 hover:border-primary/50 hover:bg-primary/10 relative cursor-pointer rounded-2xl border p-3.5 transition-all hover:shadow-xs active:scale-[0.99]"
            title="Open appointment details"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span
                    class="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                  >
                    {{ activeAppointment.status || 'Scheduled' }}
                  </span>
                  <Icon
                    name="solar:arrow-right-up-linear"
                    class="text-primary/60 group-hover:text-primary text-xs transition-colors"
                  />
                </div>
                <p
                  class="text-foreground group-hover:text-primary mt-1 text-sm font-black transition-colors"
                >
                  {{ activeAppointment.date }}
                </p>
                <p class="text-foreground/60 text-xs font-medium">
                  {{ activeAppointment.time }}
                  <span v-if="activeAppointment.clinic_name">
                    • {{ activeAppointment.clinic_name }}
                  </span>
                </p>
              </div>
              <button
                type="button"
                @click.stop="handleRescheduleClick"
                class="text-primary hover:bg-primary/20 shrink-0 rounded-lg p-1.5 text-xs font-bold transition-colors"
                title="Reschedule"
              >
                <Icon
                  name="solar:restart-square-linear"
                  class="text-lg"
                />
              </button>
            </div>
          </div>

          <!-- Pending appointment request card -->
          <div
            v-else-if="pendingAppointment"
            class="rounded-2xl border border-amber-300 bg-amber-500/10 p-3.5"
          >
            <span
              class="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase"
            >
              Pending Request
            </span>
            <p class="mt-1 text-xs font-medium text-amber-800">
              Awaiting confirmation. Review the chat actions above.
            </p>
          </div>

          <!-- Empty state -->
          <div
            v-else
            class="bg-foreground/5 rounded-2xl p-4 text-center"
          >
            <p class="text-foreground/60 text-xs">No active appointment scheduled.</p>
            <button
              type="button"
              @click="handleScheduleClick"
              class="text-primary mt-2 inline-flex items-center gap-1 text-xs font-bold hover:underline"
            >
              <Icon
                name="solar:calendar-add-linear"
                class="text-sm"
              />
              Book an Appointment
            </button>
          </div>
        </div>
      </div>

      <hr class="border-border/60 my-4" />

      <!-- User Information / Demographics Accordion -->
      <div class="mb-4">
        <button
          type="button"
          @click="isInfoExpanded = !isInfoExpanded"
          class="hover:text-primary flex w-full items-center justify-between text-xs font-bold tracking-wider uppercase transition-colors"
        >
          <span class="flex items-center gap-1.5">
            <Icon
              name="solar:user-bold"
              class="text-primary text-sm"
            />
            Patient Information
          </span>
          <Icon
            :name="isInfoExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'"
            class="text-base"
          />
        </button>

        <div
          v-if="isInfoExpanded"
          class="mt-3 space-y-2.5 text-xs"
        >
          <!-- Contact Number -->
          <div
            v-if="userDetails?.phone || userDetails?.contact_number"
            class="bg-foreground/5 flex items-center justify-between rounded-xl px-3.5 py-2.5"
          >
            <div class="flex items-center gap-2.5">
              <Icon
                name="solar:phone-calling-rounded-bold"
                class="text-foreground/50 text-base"
              />
              <div>
                <span class="text-foreground/50 block text-[10px] font-semibold uppercase"
                  >Phone</span
                >
                <span class="text-foreground font-semibold">
                  {{ userDetails.phone || userDetails.contact_number }}
                </span>
              </div>
            </div>
            <a
              :href="`tel:${userDetails.phone || userDetails.contact_number}`"
              class="text-primary hover:bg-primary/10 rounded-lg p-1.5 transition-colors"
              title="Call"
            >
              <Icon
                name="solar:outgoing-call-rounded-bold"
                class="text-base"
              />
            </a>
          </div>

          <!-- Email Address -->
          <div
            v-if="userDetails?.email"
            class="bg-foreground/5 flex items-center justify-between rounded-xl px-3.5 py-2.5"
          >
            <div class="flex min-w-0 items-center gap-2.5">
              <Icon
                name="solar:letter-bold"
                class="text-foreground/50 shrink-0 text-base"
              />
              <div class="min-w-0">
                <span class="text-foreground/50 block text-[10px] font-semibold uppercase"
                  >Email</span
                >
                <span class="text-foreground block truncate font-semibold">
                  {{ userDetails.email }}
                </span>
              </div>
            </div>
            <a
              :href="`mailto:${userDetails.email}`"
              class="text-primary hover:bg-primary/10 shrink-0 rounded-lg p-1.5 transition-colors"
              title="Email"
            >
              <Icon
                name="solar:arrow-right-up-linear"
                class="text-base"
              />
            </a>
          </div>

          <!-- Age and Gender -->
          <div
            v-if="computedAge || userDetails?.gender"
            class="bg-foreground/5 grid grid-cols-2 gap-2 rounded-xl px-3.5 py-2.5"
          >
            <div v-if="computedAge">
              <span class="text-foreground/50 block text-[10px] font-semibold uppercase">Age</span>
              <span class="text-foreground font-bold">{{ computedAge }} yrs old</span>
            </div>
            <div v-if="userDetails?.gender">
              <span class="text-foreground/50 block text-[10px] font-semibold uppercase"
                >Gender</span
              >
              <span class="text-foreground font-bold capitalize">{{ userDetails.gender }}</span>
            </div>
          </div>

          <!-- Location / Address -->
          <div
            v-if="userDetails?.city || userDetails?.province || userDetails?.location"
            class="bg-foreground/5 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5"
          >
            <Icon
              name="solar:map-point-wave-bold"
              class="text-foreground/50 mt-0.5 shrink-0 text-base"
            />
            <div>
              <span class="text-foreground/50 block text-[10px] font-semibold uppercase"
                >Location</span
              >
              <span class="text-foreground font-semibold">
                {{
                  [userDetails.barangay, userDetails.city, userDetails.province]
                    .filter(Boolean)
                    .join(', ') || userDetails.location
                }}
              </span>
            </div>
          </div>

          <!-- Total Scans Performed -->
          <div
            v-if="userDetails?.total_scans != null"
            @click="handleViewRecordClick"
            class="bg-foreground/5 hover:bg-foreground/10 flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 transition-colors"
            title="View Patient Records"
          >
            <div class="flex items-center gap-2.5">
              <Icon
                name="solar:camera-square-bold"
                class="text-foreground/50 text-base"
              />
              <span class="text-foreground/70 font-semibold">Total Scans Performed</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="bg-primary/10 text-primary rounded-md px-2 py-0.5 font-black">
                {{ userDetails.total_scans }}
              </span>
              <Icon
                name="solar:alt-arrow-right-linear"
                class="text-foreground/40 text-xs"
              />
            </div>
          </div>

          <!-- Attending Physician (If doctor registered patient) -->
          <div
            v-if="userDetails?.registered_by_doctor"
            class="border-primary/20 bg-primary/5 rounded-xl border px-3.5 py-2.5"
          >
            <span class="text-primary block text-[10px] font-bold tracking-wider uppercase">
              Attending Physician
            </span>
            <p class="text-foreground mt-0.5 font-bold">
              Dr. {{ userDetails.registered_by_doctor.first_name }}
              {{ userDetails.registered_by_doctor.last_name }}
            </p>
            <p
              v-if="userDetails.registered_by_doctor.affiliation"
              class="text-foreground/60 text-[11px]"
            >
              {{ userDetails.registered_by_doctor.affiliation }}
            </p>
          </div>
        </div>
      </div>

      <hr class="border-border/60 my-4" />

      <!-- Shared Media & Files Section -->
      <div class="mb-4">
        <button
          type="button"
          @click="isMediaExpanded = !isMediaExpanded"
          class="hover:text-primary flex w-full items-center justify-between text-xs font-bold tracking-wider uppercase transition-colors"
        >
          <span class="flex items-center gap-1.5">
            <Icon
              name="solar:gallery-wide-bold"
              class="text-primary text-sm"
            />
            Shared Media &amp; Scans
          </span>
          <Icon
            :name="isMediaExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'"
            class="text-base"
          />
        </button>

        <div
          v-if="isMediaExpanded"
          class="mt-3"
        >
          <!-- Media Tabs -->
          <div class="bg-foreground/5 flex rounded-xl p-1 text-xs">
            <button
              type="button"
              @click="activeMediaTab = 'media'"
              class="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-bold transition-all"
              :class="
                activeMediaTab === 'media'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-foreground/50 hover:text-foreground'
              "
            >
              <Icon
                name="solar:camera-bold"
                class="text-sm"
              />
              Photos ({{ sharedMediaList.length }})
            </button>
            <button
              type="button"
              @click="activeMediaTab = 'files'"
              class="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-bold transition-all"
              :class="
                activeMediaTab === 'files'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-foreground/50 hover:text-foreground'
              "
            >
              <Icon
                name="solar:document-bold"
                class="text-sm"
              />
              Files ({{ sharedFilesList.length }})
            </button>
          </div>

          <!-- Photos & Scans Grid -->
          <div
            v-if="activeMediaTab === 'media'"
            class="mt-3"
          >
            <div
              v-if="sharedMediaList.length > 0"
              class="grid grid-cols-3 gap-2"
            >
              <button
                v-for="item in sharedMediaList"
                :key="item.id"
                type="button"
                @click="handleImageClick(item.url)"
                class="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/10 transition-transform active:scale-95"
              >
                <img
                  :src="item.url"
                  :alt="item.title"
                  class="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <span
                  v-if="item.type === 'scan'"
                  class="bg-primary/80 py-0.2 absolute top-1 left-1 rounded px-1 text-[9px] font-bold text-white uppercase"
                >
                  Scan
                </span>
              </button>
            </div>
            <div
              v-else
              class="text-foreground/40 py-6 text-center text-xs"
            >
              <Icon
                name="solar:gallery-line-duotone"
                class="mx-auto mb-1 text-2xl opacity-40"
              />
              No photos or clinical scans shared yet
            </div>
          </div>

          <!-- Documents / Files List -->
          <div
            v-else
            class="mt-3 space-y-2"
          >
            <div
              v-if="sharedFilesList.length > 0"
              class="space-y-1.5"
            >
              <a
                v-for="file in sharedFilesList"
                :key="file.id"
                :href="file.url"
                target="_blank"
                class="bg-foreground/5 hover:bg-foreground/10 flex items-center gap-2.5 rounded-xl p-2.5 transition-colors"
              >
                <div
                  class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                >
                  <Icon
                    name="solar:document-text-bold"
                    class="text-base"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-foreground truncate text-xs font-semibold">
                    {{ file.name }}
                  </p>
                  <p
                    v-if="file.size"
                    class="text-foreground/50 text-[10px]"
                  >
                    {{ formatFileSize(file.size) }}
                  </p>
                </div>
                <Icon
                  name="solar:download-linear"
                  class="text-foreground/40 text-base"
                />
              </a>
            </div>
            <div
              v-else
              class="text-foreground/40 py-6 text-center text-xs"
            >
              <Icon
                name="solar:document-outline"
                class="mx-auto mb-1 text-2xl opacity-40"
              />
              No documents or files shared yet
            </div>
          </div>
        </div>
      </div>

      <hr class="border-border/60 my-4" />

      <!-- Privacy & Danger Zone -->
      <div class="space-y-2 pt-1 pb-4">
        <button
          type="button"
          @click="handleDeleteClick"
          class="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-colors"
        >
          <Icon
            name="solar:trash-bin-trash-linear"
            class="text-base"
          />
          Delete Conversation
        </button>
      </div>
    </div>
  </aside>
</template>
