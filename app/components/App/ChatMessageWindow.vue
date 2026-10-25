<script setup lang="ts">
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { conversationService } from '~/api/conversation/ConversationService'
  import { messageService } from '~/api/message/MessageService'
  import { userService } from '~/api/user/UserService'
  import { recordService } from '~/api/record/RecordService'
  import { toast } from 'vue-sonner'

  interface MessageSender {
    id: string
    name: string
    avatar: string | null
  }

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
    conversation_id: string | null
    sender: MessageSender | null
    message: string
    is_read: boolean
    read_at: string | null
    is_edited?: boolean
    edited_at?: string | null
    created_at: string
    updated_at: string
    attachments?: Attachment[]
    appointment_data?: {
      status: string
      diagnosis: {
        label: string
        confidence: number
        image_path: string
        patient_name: string
        patient_age: number | string
        date: string
      }
    }
  }

  interface PaginatedResponse<T> {
    data: T[]
    meta: {
      current_page: number
      last_page: number
    }
  }

  const props = defineProps<{
    conversationUuid: string
    otherPersonName: string
    otherPersonAvatar?: string | null
  }>()

  const emit = defineEmits<{
    (e: 'conversationDeleted'): void
  }>()

  const route = useRoute()
  const router = useRouter()

  const userUuidCookie = useCookie('user_uuid')
  const doctorUuidCookie = useCookie('doctor_uuid')
  const userRole = useCookie('user_role')

  const { data: currentUserResp } = await userService.useShow(
    () => userUuidCookie.value as string,
    {
      key: `chatUser-${userUuidCookie.value}`
    }
  )
  const currentUserData = computed(
    () => (currentUserResp.value as any)?.data ?? currentUserResp.value
  )

  const conversationDoctorUuid = ref<string | null>(null)

  // Fetch conversation data to obtain the doctor's UUID and metadata
  const { data: convResp } = await conversationService.useShow(() => props.conversationUuid)
  const convData = computed(() => (convResp.value as any)?.data ?? convResp.value)
  watch(
    convData,
    val => {
      if (val?.doctor?.id) {
        conversationDoctorUuid.value = val.doctor.id
      }
    },
    { immediate: true }
  )

  // When logged in as secretary, the sender in conversations is attributed to their doctor's UUID
  const effectiveUserUuid = computed(() => {
    const isSec =
      userRole.value === 'secretary' || route.path.toLowerCase().startsWith('/secretary')
    if (isSec) {
      const docUuidFromProfile =
        currentUserData.value?.doctor_uuid ||
        currentUserData.value?.doctor?.uuid ||
        currentUserData.value?.doctor_id
      return (
        doctorUuidCookie.value ||
        docUuidFromProfile ||
        conversationDoctorUuid.value ||
        userUuidCookie.value
      )
    }
    return userUuidCookie.value
  })
  const messageTerm = ref('')
  const messagesContainer = ref<HTMLElement | null>(null)

  // State for messages
  const allMessages = ref<Message[]>([])
  const currentPage = ref(1)
  const lastPage = ref(1)
  const isFetchingOlder = ref(false)
  const pending = ref(false)

  // Search and details state
  const isSearchingInConversation = ref(false)
  const searchInputText = ref('')
  const committedSearchQuery = ref('')
  const searchInputRef = ref<HTMLInputElement | null>(null)
  const currentMatchIndex = ref(0)
  const isSearchDirty = computed(() => searchInputText.value.trim() !== committedSearchQuery.value)

  const showUserDetails = ref(false)
  const toggleUserDetails = () => {
    showUserDetails.value = !showUserDetails.value
  }

  const isApptBarCollapsed = ref(false)

  const otherPersonUuid = computed(() => {
    if (!convData.value) return null
    const isDoc =
      userRole.value === 'doctor' ||
      userRole.value === 'secretary' ||
      route.path.toLowerCase().startsWith('/doctor') ||
      route.path.toLowerCase().startsWith('/secretary')
    return isDoc ? convData.value.patient?.id : convData.value.doctor?.id
  })

  const otherPersonPatientId = computed(() => {
    if (!convData.value) return null
    return convData.value.patient?.user_id || convData.value.patient?.id || otherPersonUuid.value
  })

  const showPatientDirectBookingModal = ref(false)
  const isDirectBooking = ref(false)

  const isDoctorUser = computed(() => {
    return (
      userRole.value === 'doctor' ||
      userRole.value === 'secretary' ||
      route.path.toLowerCase().startsWith('/doctor') ||
      route.path.toLowerCase().startsWith('/secretary')
    )
  })

  const chatPartnerDoctor = computed(() => {
    const doc = convData.value?.doctor
    if (doc) {
      return {
        ...doc,
        id: doc.id,
        uuid: doc.uuid || doc.id,
        name: doc.name || doc.user?.name || props.otherPersonName,
        first_name: doc.first_name,
        last_name: doc.last_name,
        specialty: doc.specialty || 'Dermatologist',
        profile_photo_url:
          doc.avatar_url ||
          doc.avatar ||
          doc.profile_photo_url ||
          doc.user?.profile_photo_url ||
          props.otherPersonAvatar ||
          null,
        avatar_path: doc.avatar_path || null,
        clinics: doc.clinics || []
      }
    }
    if (!isDoctorUser.value) {
      return {
        id: conversationDoctorUuid.value || undefined,
        uuid: conversationDoctorUuid.value || undefined,
        name: props.otherPersonName,
        specialty: 'Dermatologist',
        profile_photo_url: props.otherPersonAvatar || null,
        clinics: []
      }
    }
    return null
  })

  const showPatientBookModal = ref(false)

  const handlePatientBookedFromChat = async () => {
    showPatientBookModal.value = false
    await fetchAppointments()
    await fetchMessages(1)
  }

  const openScheduleFromSidebar = () => {
    if (isDoctorUser.value) {
      if (pendingAppointmentForConversation.value) {
        openScheduleModalFromPending(pendingAppointmentForConversation.value)
      } else {
        schedulingAppointmentUuid.value = ''
        scheduleMode.value = 'schedule'
        showScheduleModal.value = true
      }
      showUserDetails.value = false
    } else {
      showPatientBookModal.value = true
      showUserDetails.value = false
    }
  }

  const confirmPatientDirectBooking = async () => {
    const doctorId =
      convData.value?.doctor?.uuid || convData.value?.doctor?.user_id || convData.value?.doctor?.id
    if (!doctorId) {
      toast.error('Unable to find doctor information to request appointment.')
      return
    }
    isDirectBooking.value = true
    try {
      await appointmentService.create({
        doctor_id: doctorId,
        source: 'direct',
        message: 'I would like to schedule an appointment for a clinical consultation.'
      })
      toast.success('Appointment request sent successfully!')
      showPatientDirectBookingModal.value = false
      await fetchAppointments()
      await fetchMessages(1)
    } catch (e: any) {
      console.error('Failed to book direct appointment:', e)
      toast.error(e?.data?.message || 'Failed to submit appointment request.')
    } finally {
      isDirectBooking.value = false
    }
  }

  const openRescheduleFromSidebar = (appt: any) => {
    openRescheduleModal(appt?.id)
  }

  const handleOpenAppointment = (appt: any) => {
    if (!appt) return
    const isDoc =
      userRole.value === 'doctor' ||
      userRole.value === 'secretary' ||
      route.path.toLowerCase().startsWith('/doctor') ||
      route.path.toLowerCase().startsWith('/secretary')
    if (isDoc) {
      const targetId = appt.id || appt.uuid
      if (targetId) {
        navigateTo(`/Doctor/Appointments/${targetId}`)
      }
    } else {
      navigateTo('/Patient/Appointments')
    }
  }

  const showPatientRecordsModal = ref(false)
  const patientRecordsList = ref<any[]>([])
  const isLoadingPatientRecords = ref(false)
  const selectedPatientRecord = ref<any | null>(null)
  const showIndividualRecordModal = ref(false)

  const closePatientRecordsModal = () => {
    showPatientRecordsModal.value = false
  }

  const closeIndividualRecordModal = () => {
    showIndividualRecordModal.value = false
  }

  const formatRecordDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown Date'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const fetchPatientRecords = async () => {
    isLoadingPatientRecords.value = true
    try {
      const response = await recordService.getRecords()
      const list = (response as any).data || response || []
      const targetUuid = otherPersonUuid.value
      const targetId = otherPersonPatientId.value
      const targetName = (props.otherPersonName || '').toLowerCase().trim()

      patientRecordsList.value = list.filter((r: any) => {
        if (!r) return false
        const pat = r.patient
        if (!pat) return false
        if (targetUuid && (pat.uuid === targetUuid || r.patient_uuid === targetUuid)) return true
        if (targetId && (pat.id === targetId || pat.user_id === targetId)) return true
        const patName = `${pat.first_name || ''} ${pat.last_name || ''}`.toLowerCase().trim()
        if (targetName && (patName.includes(targetName) || targetName.includes(patName)))
          return true
        return false
      })
    } catch (e) {
      console.error('Failed to load patient records', e)
      patientRecordsList.value = []
    } finally {
      isLoadingPatientRecords.value = false
    }
  }

  const handleViewRecord = async (patientUuid?: string) => {
    showPatientRecordsModal.value = true
    await fetchPatientRecords()
  }

  const openFullRecord = (record: any) => {
    selectedPatientRecord.value = record
    showIndividualRecordModal.value = true
  }

  const goToFullRecordsPage = () => {
    showPatientRecordsModal.value = false
    const isDoc =
      userRole.value === 'doctor' ||
      userRole.value === 'secretary' ||
      route.path.toLowerCase().startsWith('/doctor') ||
      route.path.toLowerCase().startsWith('/secretary')
    const searchParam = encodeURIComponent(props.otherPersonName || '')
    if (userRole.value === 'secretary' || route.path.toLowerCase().startsWith('/secretary')) {
      navigateTo(`/Secretary/Records?search=${searchParam}`)
    } else if (isDoc) {
      navigateTo(`/Doctor/Records?search=${searchParam}`)
    } else {
      navigateTo('/Patient/Records')
    }
  }

  const previewImageUrl = ref<string | null>(null)
  const handlePreviewImage = (url: string) => {
    previewImageUrl.value = url
  }

  // Patient clinical questionnaire inspection modal for doctor & attendees
  const selectedDiagnosisForQuestionnaire = ref<any>(null)
  const showPatientQuestionnaireModal = ref(false)

  const openPatientQuestionnaireModal = (diagnosisData: any) => {
    selectedDiagnosisForQuestionnaire.value = diagnosisData
    showPatientQuestionnaireModal.value = true
  }

  const handleClosePatientQuestionnaireModal = () => {
    showPatientQuestionnaireModal.value = false
    selectedDiagnosisForQuestionnaire.value = null
  }

  // Deduplicated displayed messages to filter out duplicate system cards
  const deduplicatedMessages = computed(() => {
    const valid = allMessages.value.filter(m => m && m.id)
    const seenDeclinedUuids = new Set<string>()

    return valid.filter(m => {
      if (m.message && m.message.includes('[APPOINTMENT_DECLINED:')) {
        const match = m.message.match(/\[APPOINTMENT_DECLINED:([a-f0-9-]+)\]/i)
        if (match && match[1]) {
          const apptUuid = match[1]
          if (seenDeclinedUuids.has(apptUuid)) {
            return false
          }
          seenDeclinedUuids.add(apptUuid)
        }
      }
      return true
    })
  })

  // Full conversation is retained during search so user reads messages in context (Messenger style)
  const displayedMessages = computed(() => {
    return deduplicatedMessages.value
  })

  // Messenger-style search matches driven only when search is committed (zero typing overhead)
  const matchingMessageIds = computed(() => {
    const q = committedSearchQuery.value.trim().toLowerCase()
    if (!isSearchingInConversation.value || !q) return []
    return deduplicatedMessages.value
      .filter(m => {
        if (m.message && m.message.toLowerCase().includes(q)) return true
        if (m.attachments?.some((a: any) => a.name?.toLowerCase().includes(q))) return true
        if (m.appointment_data?.diagnosis?.label?.toLowerCase().includes(q)) return true
        return false
      })
      .map(m => m.id)
  })

  const currentSearchMatchMessageId = computed(() => {
    if (matchingMessageIds.value.length === 0) return null
    return matchingMessageIds.value[currentMatchIndex.value] || null
  })

  const scrollToCurrentMatch = () => {
    const id = currentSearchMatchMessageId.value
    if (!id) return
    nextTick(() => {
      const el = document.getElementById(`msg-${id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }

  const nextSearchMatch = () => {
    if (matchingMessageIds.value.length === 0) return
    currentMatchIndex.value = (currentMatchIndex.value + 1) % matchingMessageIds.value.length
    scrollToCurrentMatch()
  }

  const prevSearchMatch = () => {
    if (matchingMessageIds.value.length === 0) return
    currentMatchIndex.value =
      (currentMatchIndex.value - 1 + matchingMessageIds.value.length) %
      matchingMessageIds.value.length
    scrollToCurrentMatch()
  }

  const commitSearch = () => {
    const query = searchInputText.value.trim()
    if (!query) {
      clearSearch()
      return
    }
    // If query is already committed, subsequent Enter presses act as "Next match"
    if (query === committedSearchQuery.value) {
      nextSearchMatch()
      return
    }
    committedSearchQuery.value = query
    currentMatchIndex.value = 0
    if (matchingMessageIds.value.length > 0) {
      scrollToCurrentMatch()
    }
  }

  const clearSearch = () => {
    searchInputText.value = ''
    committedSearchQuery.value = ''
    currentMatchIndex.value = 0
  }

  const toggleSearchInConversation = () => {
    isSearchingInConversation.value = !isSearchingInConversation.value
    if (isSearchingInConversation.value) {
      showUserDetails.value = false
      nextTick(() => {
        searchInputRef.value?.focus()
        if (committedSearchQuery.value && matchingMessageIds.value.length > 0) {
          scrollToCurrentMatch()
        }
      })
    } else {
      clearSearch()
    }
  }

  const openSearchFromSidebar = () => {
    isSearchingInConversation.value = true
    showUserDetails.value = false
    nextTick(() => {
      searchInputRef.value?.focus()
      if (committedSearchQuery.value && matchingMessageIds.value.length > 0) {
        scrollToCurrentMatch()
      }
    })
  }

  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  const escapeRegex = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // Highlights matching keywords. If this message is the focused match, applies intense Messenger active styling
  const formatHighlightedText = (text: string | null | undefined, messageId?: string): string => {
    if (!text) return ''
    const escaped = escapeHtml(text)
    const q = committedSearchQuery.value.trim()
    if (!isSearchingInConversation.value || !q) {
      return escaped
    }
    const isCurrentMatch = currentSearchMatchMessageId.value === messageId
    const markClass = isCurrentMatch
      ? 'bg-amber-400 dark:bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded shadow-xs ring-2 ring-amber-500 animate-pulse'
      : 'bg-amber-200/90 dark:bg-amber-400/40 text-amber-950 dark:text-amber-100 font-semibold px-1 py-0.5 rounded'

    try {
      const regex = new RegExp(`(${escapeRegex(q)})`, 'gi')
      return escaped.replace(regex, `<mark class="${markClass}">$1</mark>`)
    } catch {
      return escaped
    }
  }

  const cleanClinicalFindings = (message: string): string => {
    return (
      message
        .replace(/\[(APPOINTMENT_REQUEST|DIAGNOSIS_ONLY):[^\]]+\]/g, '')
        .replace(/\[SCAN_RESULT:[a-f0-9-]+\]/g, '')
        .replace(/Requested schedule:\s*[^\.\n]+\.?/gi, '')
        .trim() ||
      (message.includes('[APPOINTMENT_REQUEST:')
        ? 'Appointment consultation requested.'
        : 'Additional findings shared.')
    )
  }

  const { getEcho } = useEcho()
  const partnerIsTyping = ref(false)
  let typingTimeout: any = null
  let lastTypingBroadcast = 0
  let isUserNearBottom = true
  const cacheKey = computed(() => `chat_history_${props.conversationUuid}`)

  // Context menu & modal states
  const contextMenu = ref<{ visible: boolean; x: number; y: number; message: Message | null }>({
    visible: false,
    x: 0,
    y: 0,
    message: null
  })
  const editingMessageId = ref<string | null>(null)
  const editingMessageText = ref('')
  const showDeleteMessageModal = ref(false)
  const messageToDelete = ref<Message | null>(null)
  const showDeleteConversationModal = ref(false)

  const { getStorageUrl } = useStorage()
  const { removeFromPriority } = usePriorityList()

  const headerAvatarFailed = ref(false)
  const messageAvatarErrors = ref(new Set<string>())
  const hasMessageAvatarError = (id: string) => messageAvatarErrors.value.has(id)
  const handleMessageAvatarError = (id: string) => {
    messageAvatarErrors.value.add(id)
  }

  watch(
    () => props.otherPersonAvatar,
    () => {
      headerAvatarFailed.value = false
    }
  )

  // --- Attachments ---
  const fileInput = ref<HTMLInputElement | null>(null)
  const selectedFiles = ref<File[]>([])
  const isDragging = ref(false)

  const triggerFileInput = () => {
    fileInput.value?.click()
  }

  const handleFileChange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (files) {
      addFiles(Array.from(files))
    }
    // Reset input
    if (fileInput.value) fileInput.value.value = ''
  }

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`"${file.name}" is too large. Maximum allowed file size is 15MB.`)
        return false
      }
      return true
    })
    selectedFiles.value = [...selectedFiles.value, ...validFiles]
  }

  const removeFile = (index: number) => {
    selectedFiles.value.splice(index, 1)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const isImage = (type: string) => type.startsWith('image/')
  const isPdf = (type: string) => type === 'application/pdf'

  // --- Scheduling & Viewport ---
  const isMobile = ref(false)
  const updateIsMobile = () => {
    if (typeof window !== 'undefined') {
      isMobile.value = window.innerWidth < 768
    }
  }

  onMounted(() => {
    updateIsMobile()
    window.addEventListener('resize', updateIsMobile)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateIsMobile)
  })

  const showScheduleModal = ref(false)
  const schedulingAppointmentUuid = ref('')

  /** Extract the UUID embedded in appointment system messages */
  const extractAppointmentUuid = (
    message: string,
    type: 'REQUEST' | 'SCHEDULED' | 'DECLINED' = 'REQUEST'
  ): string => {
    // Handle both old [TAG:UUID] and new [TAG:UUID:DIAG_UUID] formats
    const regex = new RegExp(
      `\\[(APPOINTMENT_${type}|DIAGNOSIS_ONLY):([a-f0-9-]+)(?::[a-f0-9-]+)?\\]`
    )
    const match = message.match(regex)
    return match ? match[2] : ''
  }

  /** Extract UUID from an APPOINTMENT_SCHEDULED or APPOINTMENT_CONFIRMED system message. */
  const extractScheduledAppointmentUuid = (message: string): string => {
    const match = message.match(/\[(APPOINTMENT_SCHEDULED|APPOINTMENT_CONFIRMED):([a-f0-9-]+)\]/)
    return match ? match[2] : ''
  }

  /** Returns true when either party can request/propose a reschedule directly from the chat bubble. */
  const canRequestReschedule = (message: string): boolean => {
    const uuid = extractScheduledAppointmentUuid(message)
    if (!uuid) return false
    const appt =
      activeAppointment.value?.id === uuid || activeAppointment.value?.uuid === uuid
        ? activeAppointment.value
        : appointments.value.find(a => a.id === uuid || a.uuid === uuid)
    if (!appt) return false
    return ['scheduled', 'confirmed'].includes(appt.status)
  }

  // --- Rebook Appointment (Patient Side) ---
  const isRebookingAppt = ref(false)
  const rebookedDeclinedApptUuids = ref<Set<string>>(new Set())
  const lastRebookTimestamp = ref<number>(0)

  const extractDeclinedAppointmentUuid = (message: string): string => {
    const match = message.match(/\[APPOINTMENT_DECLINED:([a-f0-9-]+)\]/i)
    return match ? match[1] : ''
  }

  const getDeclinedDiagnosisUuid = (declinedApptUuid?: string): string | null => {
    if (!declinedApptUuid) return null
    for (const m of allMessages.value) {
      if (m.message.includes(`[APPOINTMENT_REQUEST:${declinedApptUuid}:`)) {
        const match = m.message.match(
          new RegExp(`\\[APPOINTMENT_REQUEST:${declinedApptUuid}:([a-f0-9-]+)\\]`, 'i')
        )
        if (match && match[1]) {
          return match[1]
        }
      }
    }
    return null
  }

  const getDeclinedDiagnosisData = (msg: Message) => {
    if (msg.appointment_data?.diagnosis) {
      return msg.appointment_data.diagnosis
    }
    const apptUuid = extractDeclinedAppointmentUuid(msg.message)
    if (!apptUuid) return null
    const reqMsg = allMessages.value.find(
      m =>
        m.message.includes(`[APPOINTMENT_REQUEST:${apptUuid}:`) ||
        m.message.includes(`[APPOINTMENT_REQUEST:${apptUuid}]`)
    )
    return reqMsg?.appointment_data?.diagnosis || null
  }

  const canRebookAppointment = (msg: Message): boolean => {
    if (userRole.value?.toLowerCase() !== 'patient') return false

    const apptUuid = extractDeclinedAppointmentUuid(msg.message)
    if (apptUuid && rebookedDeclinedApptUuids.value.has(apptUuid)) return false

    if (activeAppointment.value || pendingAppointmentForConversation.value) return false

    const hasPendingOrActiveInConversation = appointments.value.some(
      a =>
        a.conversation_uuid === props.conversationUuid &&
        ['scheduled', 'pending', 'reschedule_proposed', 'reschedule_requested'].includes(a.status)
    )
    if (hasPendingOrActiveInConversation) return false

    const hasUnhandledRequest = allMessages.value.some(
      m => m.message.includes('[APPOINTMENT_REQUEST:') && !isAppointmentHandled(m.message)
    )
    if (hasUnhandledRequest) return false

    return true
  }

  const handleRebookAppointment = async (msg: Message) => {
    if (isRebookingAppt.value) return

    const now = Date.now()
    if (now - lastRebookTimestamp.value < 5000) {
      toast.warning('Please wait a moment before sending another request.')
      return
    }

    const declinedApptUuid = extractDeclinedAppointmentUuid(msg.message)
    if (declinedApptUuid && rebookedDeclinedApptUuids.value.has(declinedApptUuid)) return

    const diagnosisUuid =
      (msg.appointment_data as any)?.diagnosis_uuid ||
      (msg.appointment_data as any)?.diagnosis?.id ||
      getDeclinedDiagnosisUuid(declinedApptUuid)

    const doctorId =
      (msg.appointment_data as any)?.doctor_uuid ||
      (msg.appointment_data as any)?.doctor_id ||
      convData.value?.doctor?.uuid ||
      convData.value?.doctor?.user_id ||
      convData.value?.doctor?.id

    if (!doctorId) {
      toast.error('Unable to find doctor information to rebook appointment.')
      return
    }

    if (declinedApptUuid) {
      rebookedDeclinedApptUuids.value.add(declinedApptUuid)
    }
    lastRebookTimestamp.value = now
    isRebookingAppt.value = true

    try {
      await appointmentService.create({
        doctor_id: doctorId,
        diagnosis_uuid: diagnosisUuid || undefined,
        message: 'I would like to schedule an appointment regarding my recent skin scan.'
      })
      toast.success('Appointment request sent successfully!')
      await fetchAppointments()
      await fetchMessages(1)
    } catch (e: any) {
      console.error('Failed to rebook appointment:', e)
      if (e?.status !== 429 && e?.status !== 422 && declinedApptUuid) {
        rebookedDeclinedApptUuids.value.delete(declinedApptUuid)
      }
      toast.error(e?.data?.message || 'Failed to rebook appointment. Please try again.')
    } finally {
      isRebookingAppt.value = false
    }
  }

  const openScheduleModal = (message: string) => {
    const uuid = extractAppointmentUuid(message, 'REQUEST')
    if (!uuid) return
    schedulingAppointmentUuid.value = uuid
    showScheduleModal.value = true
  }

  const isAcceptingBookingDirect = ref<string | null>(null)
  const acceptAppointmentDirectly = async (message: string) => {
    const uuid = extractAppointmentUuid(message, 'REQUEST')
    if (!uuid || isAcceptingBookingDirect.value) return
    isAcceptingBookingDirect.value = uuid
    try {
      await appointmentService.accept(uuid)
      toast.success('Appointment booking confirmed successfully.')
      await fetchMessages(1)
      await fetchAppointments()
    } catch (e: any) {
      console.error(e)
      const errorMsg =
        e?.response?._data?.message ||
        e?.data?.message ||
        e?.message ||
        'Failed to accept appointment.'
      if (e?.response?.status === 409 || errorMsg.includes('SLOT_')) {
        toast.error('Slot Conflict: Requested time slot is no longer available.')
      } else {
        toast.error(errorMsg)
      }
    } finally {
      isAcceptingBookingDirect.value = null
    }
  }

  const getAppointmentScheduleFromMsg = (msg: any): string | null => {
    if (msg.appointment_data?.scheduled_at_formatted) {
      return msg.appointment_data.scheduled_at_formatted
    }
    if (msg.appointment_data?.scheduled_at) {
      const p = parseAppointmentDateTime(msg.appointment_data.scheduled_at)
      let str = `${p.date} at ${p.time}`
      if (msg.appointment_data.scheduled_end_at) {
        const pEnd = parseAppointmentDateTime(msg.appointment_data.scheduled_end_at)
        str += ` - ${pEnd.time}`
      }
      return str
    }
    const apptUuid = extractAppointmentUuid(msg.message, 'REQUEST')
    if (apptUuid) {
      const found = [...appointments.value, ...pendingAppointments.value].find(
        a => a.id === apptUuid || a.uuid === apptUuid
      )
      if (found?.raw_scheduled_at || found?.date) {
        let str = found.date
        if (found.time) str += ` at ${found.time}`
        return str
      }
    }
    const scheduleMatch = msg.message.match(/Requested schedule:\s*([^\.\n]+)/i)
    if (scheduleMatch) {
      return scheduleMatch[1].trim()
    }
    return null
  }

  const decliningApptUuids = ref<Set<string>>(new Set())

  const declineAppointment = async (message: string) => {
    const uuid = extractAppointmentUuid(message, 'REQUEST')
    if (!uuid || decliningApptUuids.value.has(uuid)) return
    decliningApptUuids.value.add(uuid)
    try {
      await appointmentService.update(uuid, { status: 'declined' })
      await fetchMessages(1)
      await fetchAppointments()
    } catch (e) {
      console.error(e)
      decliningApptUuids.value.delete(uuid)
    }
  }

  const isAppointmentHandled = (message: string) => {
    const uuid = extractAppointmentUuid(message, 'REQUEST')
    if (!uuid) return true
    if (decliningApptUuids.value.has(uuid)) return true
    const apptInStore = appointments.value.find(a => a.id === uuid || a.uuid === uuid)
    if (apptInStore && apptInStore.status !== 'pending') {
      return true
    }
    return allMessages.value.some(
      m =>
        m.message.includes(`[APPOINTMENT_SCHEDULED:${uuid}]`) ||
        m.message.includes(`[APPOINTMENT_CONFIRMED:${uuid}]`) ||
        m.message.includes(`[APPOINTMENT_DECLINED:${uuid}]`) ||
        m.message.includes(`[APPOINTMENT_CANCELLED:${uuid}]`)
    )
  }

  // --- Active Appointment (Top Bar) ---
  const { appointments, pendingAppointments, fetchAppointments } = useAppointments()
  const activeAppointment = computed(() => {
    if (!props.conversationUuid) return null
    return appointments.value.find(
      a =>
        Boolean(a.conversation_uuid) &&
        a.conversation_uuid === props.conversationUuid &&
        (a.status === 'scheduled' ||
          a.status === 'confirmed' ||
          a.status === 'reschedule_proposed' ||
          a.status === 'reschedule_requested')
    )
  })

  /**
   * The pending appointment for this specific conversation (if any).
   * Shown to the doctor as a top-of-window banner.
   */
  const pendingAppointmentForConversation = computed(() => {
    if (!props.conversationUuid) return null
    return (
      pendingAppointments.value.find(
        a => Boolean(a.conversation_uuid) && a.conversation_uuid === props.conversationUuid
      ) ?? null
    )
  })

  // Synchronize chat messages when appointments update in real-time
  watch(appointments, () => {
    if (props.conversationUuid) {
      fetchMessages(1)
    }
  })

  const scheduleMode = ref<'schedule' | 'reschedule'>('schedule')

  const openScheduleModalFromPending = (appt: any) => {
    schedulingAppointmentUuid.value = appt.id
    scheduleMode.value = 'schedule'
    showScheduleModal.value = true
  }

  const rescheduleModalAppt = ref<any | null>(null)

  const openRescheduleModal = (uuid?: string) => {
    const targetUuid = typeof uuid === 'string' && uuid ? uuid : activeAppointment.value?.id
    if (!targetUuid) return
    const found =
      appointments.value.find(a => a.id === targetUuid || a.uuid === targetUuid) ||
      pendingAppointments.value.find(a => a.id === targetUuid || a.uuid === targetUuid) ||
      (activeAppointment.value?.id === targetUuid ? activeAppointment.value : null)
    if (found) {
      rescheduleModalAppt.value = found
    } else {
      rescheduleModalAppt.value = {
        id: targetUuid,
        doctor_uuid:
          convData.value?.doctor?.uuid || convData.value?.doctor?.id || doctorInfo.value?.uuid,
        doctor_id: convData.value?.doctor?.id || doctorInfo.value?.id,
        doctor: doctorInfo.value
          ? doctorInfo.value.name?.startsWith('Dr.')
            ? doctorInfo.value.name
            : `Dr. ${doctorInfo.value.name}`
          : 'Doctor',
        info: 'Consultation'
      }
    }
  }

  const handleScheduleModalClose = () => {
    showScheduleModal.value = false
    scheduleMode.value = 'schedule'
  }

  const handleAppointmentScheduled = () => {
    fetchMessages(1)
    fetchAppointments()
  }

  const isAcceptingReschedule = ref(false)
  const showAcceptConfirmModal = ref(false)
  const pendingAcceptUuid = ref<string | null>(null)

  const promptAcceptReschedule = (uuid?: string) => {
    pendingAcceptUuid.value =
      uuid || activeAppointment.value?.id || activeAppointment.value?.uuid || null
    showAcceptConfirmModal.value = true
  }

  const confirmAcceptReschedule = async () => {
    const targetUuid =
      pendingAcceptUuid.value || activeAppointment.value?.id || activeAppointment.value?.uuid
    if (!targetUuid) return

    isAcceptingReschedule.value = true
    try {
      await appointmentService.acceptReschedule(targetUuid, {})
      toast.success('Appointment schedule accepted.')
      showAcceptConfirmModal.value = false
      pendingAcceptUuid.value = null
      await fetchMessages(1)
      await fetchAppointments()
    } catch (e: any) {
      console.error('Failed to accept reschedule:', e)
      const errorMsg =
        e?.response?._data?.message ||
        e?.data?.message ||
        e?.message ||
        'Failed to accept reschedule.'
      toast.error(errorMsg)
    } finally {
      isAcceptingReschedule.value = false
    }
  }

  const acceptReschedule = async (uuid?: string) => {
    promptAcceptReschedule(uuid)
  }

  const closeAcceptModal = () => {
    showAcceptConfirmModal.value = false
    pendingAcceptUuid.value = null
  }

  const pendingCancelUuid = ref<string | null>(null)

  const promptCancelAppointment = (uuid: string) => {
    pendingCancelUuid.value = uuid
    showCancelConfirm.value = true
  }

  const closeCancelModal = () => {
    showCancelConfirm.value = false
    pendingCancelUuid.value = null
  }

  const cancelAppointment = async (uuid: string) => {
    promptCancelAppointment(uuid)
  }

  const requestReschedule = (uuid: string) => {
    openRescheduleModal(uuid)
  }

  const onRescheduleRequested = () => {
    fetchMessages(1)
    fetchAppointments()
  }

  const isRescheduleProposedByMe = (uuid: string) => {
    const msg = [...allMessages.value]
      .reverse()
      .find(m => m.message.includes(`[APPOINTMENT_RESCHEDULE_PROPOSED:${uuid}:`))
    return msg ? msg.sender?.id === effectiveUserUuid.value : false
  }

  /** Decline a pending appointment directly from the banner. */
  const declineAppointmentFromPending = async (appt: any) => {
    if (!appt?.id || decliningApptUuids.value.has(appt.id)) return
    decliningApptUuids.value.add(appt.id)
    try {
      await appointmentService.update(appt.id, { status: 'declined' })
      await fetchMessages(1)
      await fetchAppointments()
    } catch (e) {
      console.error(e)
      decliningApptUuids.value.delete(appt.id)
    }
  }

  const showCompleteConfirm = ref(false)
  const showCancelConfirm = ref(false)
  const showResolveModal = ref(false)
  const isCompleting = ref(false)
  const isCancelling = ref(false)

  const isOverdue = computed(() => {
    if (!activeAppointment.value?.date) return false
    const todayStr = new Date().toISOString().split('T')[0]
    if (activeAppointment.value.date < todayStr) return true
    if (activeAppointment.value.date === todayStr && activeAppointment.value.time) {
      return (
        new Date(`${activeAppointment.value.date}T${activeAppointment.value.time}`) < new Date()
      )
    }
    return false
  })

  const openCompleteConfirmFromRoute = () => {
    if (userRole.value?.toLowerCase() !== 'doctor' || !activeAppointment.value) return

    if (route.query.resolve === '1') {
      showResolveModal.value = true
      const query = { ...route.query }
      delete query.resolve
      router.replace({ query })
      return
    }

    if (route.query.complete === '1') {
      showCompleteConfirm.value = true
      const query = { ...route.query }
      delete query.complete
      router.replace({ query })
    }
  }

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0]
    return dateStr === today
  }

  const formatRequestedRescheduleLabel = (appt: any): string => {
    if (!appt?.requested_reschedule_date) return ''
    const rawDate =
      typeof appt.requested_reschedule_date === 'string'
        ? appt.requested_reschedule_date.split('T')[0]
        : appt.requested_reschedule_date
    const d = new Date(rawDate + 'T00:00:00')
    const dateFmt = isNaN(d.getTime())
      ? rawDate
      : d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
    if (appt.requested_reschedule_time) {
      const [hStr, mStr] = appt.requested_reschedule_time.split(':')
      const h = parseInt(hStr, 10)
      const m = parseInt(mStr || '0', 10)
      if (!isNaN(h)) {
        const ampm = h >= 12 ? 'PM' : 'AM'
        const h12 = h % 12 || 12
        const timeFmt = `${h12}:${String(m).padStart(2, '0')} ${ampm}`
        return `${dateFmt} at ${timeFmt}`
      }
    }
    return dateFmt
  }

  onMounted(() => {
    fetchAppointments()
  })

  watch(
    [() => route.query.complete, () => route.query.resolve, activeAppointment],
    openCompleteConfirmFromRoute,
    { immediate: true }
  )

  const completeAppointment = async () => {
    if (!activeAppointment.value) return
    isCompleting.value = true
    try {
      const completedAppointment = activeAppointment.value
      await appointmentService.update(completedAppointment.id, { status: 'completed' })
      await conversationService.sendMessage(
        props.conversationUuid,
        `[APPOINTMENT_COMPLETED:${completedAppointment.id}] Appointment completed by the doctor. Your visit summary has been moved to your records.`
      )
      removeFromPriority(completedAppointment.id)
      showCompleteConfirm.value = false
      showResolveModal.value = false
      fetchAppointments()
      fetchMessages(1)
    } catch (e: any) {
      console.error(e)
      const errorMsg =
        e.data?.message || e.response?.data?.message || e.message || 'Cannot complete consultation.'
      toast.error(errorMsg)
    } finally {
      isCompleting.value = false
    }
  }

  const cancelAppointmentDirectly = async () => {
    const targetUuid = pendingCancelUuid.value || activeAppointment.value?.id
    if (!targetUuid) return
    isCancelling.value = true
    try {
      await appointmentService.update(targetUuid, { status: 'declined' })
      removeFromPriority(targetUuid)
      showCancelConfirm.value = false
      showResolveModal.value = false
      pendingCancelUuid.value = null
      toast.success('Appointment cancelled.')
      fetchAppointments()
      fetchMessages(1)
    } catch (e: any) {
      console.error(e)
      toast.error(e?.response?._data?.message || 'Failed to cancel appointment.')
    } finally {
      isCancelling.value = false
    }
  }

  // --- Caching ---
  const saveToCache = () => {
    if (typeof window !== 'undefined' && allMessages.value.length > 0) {
      // Limit cache to last 30 messages for performance
      localStorage.setItem(cacheKey.value, JSON.stringify(allMessages.value.slice(-30)))
    }
  }

  const loadFromCache = () => {
    return false // Skip stale cache to ensure fresh server messages and accurate bubble alignment
  }

  // --- Fetching Logic ---
  const fetchMessages = async (page = 1, prepend = false) => {
    if (page > 1) isFetchingOlder.value = true
    else if (allMessages.value.length === 0) pending.value = true

    try {
      const response = await conversationService.getMessages(props.conversationUuid, { page })

      const newMessages = [...response.data].reverse()

      if (prepend) {
        // Store previous scroll height to maintain position
        const container = messagesContainer.value
        const oldHeight = container?.scrollHeight || 0

        allMessages.value = [...newMessages, ...allMessages.value]

        // Restore scroll position after DOM update
        nextTick(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - oldHeight
          }
        })
      } else {
        // If it's the first page, we might be polling or initial load
        if (page === 1) {
          const freshMessages = newMessages.filter(
            nm =>
              nm &&
              typeof nm === 'object' &&
              nm.id &&
              !allMessages.value.find(am => am && am.id === nm.id)
          )
          if (freshMessages.length > 0) {
            allMessages.value = [...allMessages.value, ...freshMessages].filter(m => m && m.id)
            if (isUserNearBottom) scrollToBottom()
          }
          lastPage.value = response.meta.last_page
        } else {
          allMessages.value = [...newMessages, ...allMessages.value].filter(m => m && m.id)
        }
      }

      currentPage.value = response.meta.current_page
      saveToCache()
    } catch (e) {
      console.error('Failed to fetch messages:', e)
    } finally {
      isFetchingOlder.value = false
      pending.value = false
    }
  }

  const loadOlderMessages = async () => {
    if (isFetchingOlder.value || currentPage.value >= lastPage.value) return
    await fetchMessages(currentPage.value + 1, true)
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const doScroll = () => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTo({
          top: messagesContainer.value.scrollHeight,
          behavior
        })
      }
    }

    nextTick(() => {
      doScroll()
      setTimeout(doScroll, 50)
      setTimeout(doScroll, 150)
      setTimeout(doScroll, 300)
    })
  }

  const handleScroll = () => {
    if (!messagesContainer.value) return
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value

    // Near bottom check
    isUserNearBottom = scrollHeight - scrollTop - clientHeight < 100

    // Near top check (Infinite scroll)
    if (scrollTop < 10 && !isFetchingOlder.value) {
      loadOlderMessages()
    }
  }

  const markUnreadMessages = async () => {
    const unread = allMessages.value.filter(
      m => m && !m.is_read && m.sender?.id !== effectiveUserUuid.value
    )
    for (const msg of unread) {
      try {
        await messageService.update(msg.id, { is_read: true })
        msg.is_read = true // Update locally
      } catch (e) {}
    }
  }

  const subscribeToChatChannel = (uuid: string) => {
    if (!uuid || import.meta.server) return
    const echo = getEcho()
    if (!echo) return

    // Clean up existing listener on this channel to avoid duplicate handlers
    echo.leave(`chat.conversation.${uuid}`)

    echo
      .private(`chat.conversation.${uuid}`)
      .listen('.ChatMessageSent', (e: any) => {
        if (!e?.message) return
        const msg = e.message
        const msgId = msg.id || msg.uuid
        const exists = allMessages.value.some(m => msgId && (m.id === msgId || m.uuid === msgId))
        if (!exists) {
          allMessages.value.push(msg)
          scrollToBottom()
          saveToCache()
          markUnreadMessages()
        }
      })
      .listen('.ChatMessagesRead', (e: any) => {
        const uuids = e?.message_uuids || []
        allMessages.value.forEach(m => {
          if (uuids.includes(m.uuid) || uuids.includes(m.id)) {
            m.is_read = true
          }
        })
      })
      .listen('.ChatMessageEdited', (e: any) => {
        if (!e?.message) return
        const updatedMsg = e.message
        const targetId = updatedMsg.id || updatedMsg.uuid
        const idx = allMessages.value.findIndex(
          m => m && (m.id === targetId || m.uuid === targetId)
        )
        if (idx !== -1) {
          allMessages.value[idx] = {
            ...allMessages.value[idx],
            ...updatedMsg
          }
          saveToCache()
        }
      })
      .listen('.ChatMessageDeleted', (e: any) => {
        const targetId = e?.message_uuid || e?.message_id
        if (!targetId) return
        allMessages.value = allMessages.value.filter(
          m => m && m.id !== targetId && m.uuid !== targetId
        )
        saveToCache()
      })
      .listenForWhisper('typing', () => {
        partnerIsTyping.value = true
        scrollToBottom('smooth')
        if (typingTimeout) clearTimeout(typingTimeout)
        typingTimeout = setTimeout(() => {
          partnerIsTyping.value = false
        }, 3000)
      })
  }

  const unsubscribeFromChatChannel = (uuid: string) => {
    if (!uuid || import.meta.server) return
    const echo = getEcho()
    if (echo) {
      echo.leave(`chat.conversation.${uuid}`)
    }
  }

  const broadcastTyping = () => {
    if (!props.conversationUuid || import.meta.server) return
    const now = Date.now()
    if (now - lastTypingBroadcast < 1500) return
    lastTypingBroadcast = now

    const echo = getEcho()
    if (echo) {
      echo.private(`chat.conversation.${props.conversationUuid}`).whisper('typing', {
        uuid: effectiveUserUuid.value
      })
    }
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && props.conversationUuid) {
      fetchMessages(1).then(markUnreadMessages)
    }
  }

  watch(
    () => props.conversationUuid,
    (newUuid, oldUuid) => {
      if (oldUuid) {
        unsubscribeFromChatChannel(oldUuid)
      }
      if (newUuid && newUuid !== oldUuid) {
        allMessages.value = []
        currentPage.value = 1
        lastPage.value = 1
        isUserNearBottom = true

        const hasCache = loadFromCache()
        if (hasCache) {
          scrollToBottom('instant')
        }

        fetchMessages(1).then(() => {
          scrollToBottom('instant')
          markUnreadMessages()
        })
        subscribeToChatChannel(newUuid)
      }
    }
  )

  onMounted(() => {
    const hasCache = loadFromCache()
    if (hasCache) {
      scrollToBottom('instant')
    }

    fetchMessages(1).then(() => {
      scrollToBottom('instant')
      markUnreadMessages()
    })

    subscribeToChatChannel(props.conversationUuid)
    document.addEventListener('click', closeContextMenu)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    unsubscribeFromChatChannel(props.conversationUuid)
    document.removeEventListener('click', closeContextMenu)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    if (typingTimeout) clearTimeout(typingTimeout)
  })

  // --- Send Message ---
  const sendMessage = async () => {
    const text = messageTerm.value.trim()
    if (!text && selectedFiles.value.length === 0) return

    const filesToSend = [...selectedFiles.value]
    messageTerm.value = ''
    selectedFiles.value = []

    try {
      const response = await conversationService.sendMessage(
        props.conversationUuid,
        text,
        filesToSend
      )
      // Add immediately to UI for snappiness if not already received via websocket
      if (response) {
        const resId = response.id || response.uuid
        const alreadyInList = allMessages.value.some(
          m => resId && (m.id === resId || m.uuid === resId)
        )
        if (!alreadyInList) {
          allMessages.value.push(response)
          scrollToBottom()
          saveToCache()
        }
      }
    } catch (e) {
      messageTerm.value = text
      selectedFiles.value = filesToSend
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // --- Context Menu & Actions ---
  const openContextMenu = (event: MouseEvent, msg: Message) => {
    if (msg.sender?.id !== effectiveUserUuid.value) return
    event.preventDefault()
    contextMenu.value = { visible: true, x: event.clientX, y: event.clientY, message: msg }
  }

  const closeContextMenu = () => {
    contextMenu.value.visible = false
  }

  const startEditing = (msg: Message) => {
    editingMessageId.value = msg.id
    editingMessageText.value = msg.message
    closeContextMenu()
  }

  const cancelEditing = () => {
    editingMessageId.value = null
    editingMessageText.value = ''
  }

  const saveEdit = async () => {
    const targetId = editingMessageId.value
    if (!targetId) return
    const trimmed = editingMessageText.value.trim()
    if (!trimmed) return

    try {
      const response = await messageService.update(targetId, { message: trimmed })
      // Update locally immediately
      const idx = allMessages.value.findIndex(m => m && (m.id === targetId || m.uuid === targetId))
      if (idx !== -1) {
        allMessages.value[idx] = {
          ...allMessages.value[idx],
          ...(response || {}),
          message: trimmed,
          updated_at: response?.updated_at || new Date().toISOString()
        }
      }
      cancelEditing()
      saveToCache()
    } catch (e) {
      console.error('Failed to save message edit:', e)
    }
  }

  const handleEditKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveEdit()
    }
    if (e.key === 'Escape') cancelEditing()
  }

  const confirmDeleteMessage = (msg: Message) => {
    messageToDelete.value = msg
    showDeleteMessageModal.value = true
    closeContextMenu()
  }

  const deleteMessage = async () => {
    if (!messageToDelete.value) return
    const targetId = messageToDelete.value.id || (messageToDelete.value as any).uuid
    try {
      await messageService.delete(targetId)
      allMessages.value = allMessages.value.filter(
        m => m && m.id !== targetId && m.uuid !== targetId
      )
      saveToCache()
    } catch (e) {
      console.error('Failed to delete message:', e)
    } finally {
      showDeleteMessageModal.value = false
      messageToDelete.value = null
    }
  }

  const deleteConversation = async () => {
    try {
      await conversationService.delete(props.conversationUuid)
      showDeleteConversationModal.value = false
      emit('conversationDeleted')
    } catch (e) {}
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isEdited = (msg: Message) => {
    return Boolean(msg.is_edited || msg.edited_at)
  }
</script>

<template>
  <div class="bg-card relative flex h-full flex-col overflow-hidden">
    <!-- Mobile Appointment Schedule View (Covers entire chat window as a dedicated component with back button) -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-x-full opacity-0"
      enter-to-class="transform translate-x-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-x-0 opacity-100"
      leave-to-class="transform translate-x-full opacity-0"
    >
      <div
        v-if="showScheduleModal && isMobile"
        class="bg-card absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden"
      >
        <AppModalAppointmentSchedule
          :appointment-uuid="schedulingAppointmentUuid"
          :mode="scheduleMode"
          :inline="true"
          :patient="convData?.patient"
          :patient-name="otherPersonName"
          :patient-avatar="otherPersonAvatar"
          :patient-id="otherPersonPatientId"
          @close="handleScheduleModalClose"
          @scheduled="handleAppointmentScheduled"
        />
      </div>
    </Transition>

    <!-- Mobile Reschedule View (Covers entire chat window as a dedicated component with back button) -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-x-full opacity-0"
      enter-to-class="transform translate-x-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-x-0 opacity-100"
      leave-to-class="transform translate-x-full opacity-0"
    >
      <div
        v-if="rescheduleModalAppt && isMobile"
        class="bg-card absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden"
      >
        <PatientSideComponentsRescheduleModal
          :appointment="rescheduleModalAppt"
          :inline="true"
          @close="rescheduleModalAppt = null"
          @requested="onRescheduleRequested"
        />
      </div>
    </Transition>

    <!-- Header -->
    <div
      class="bg-card border-border z-20 flex shrink-0 items-center justify-between border-b px-3 py-2.5 sm:px-6 sm:py-4"
    >
      <div class="flex min-w-0 items-center gap-2 sm:gap-3">
        <!-- Native mobile back button -->
        <NuxtLink
          :to="$route.path.replace(/\/[^/]+$/, '')"
          class="text-foreground/60 hover:text-foreground hover:bg-foreground/5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors md:hidden"
          title="Back to conversations"
        >
          <Icon
            name="solar:arrow-left-linear"
            class="text-2xl"
          />
        </NuxtLink>

        <!-- Interactive Contact Profile Trigger (Tap to open details) -->
        <button
          type="button"
          @click="toggleUserDetails"
          class="group flex min-w-0 cursor-pointer items-center gap-2.5 text-left transition-transform active:scale-[0.99] sm:gap-3.5"
          title="Click to view contact information"
        >
          <div class="relative shrink-0">
            <div
              class="bg-muted ring-border/50 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full shadow-xs ring-2 sm:h-12 sm:w-12"
            >
              <img
                v-if="otherPersonAvatar && !headerAvatarFailed"
                :src="getStorageUrl(otherPersonAvatar)"
                :alt="otherPersonName"
                class="h-full w-full object-cover"
                @error="headerAvatarFailed = true"
              />
              <div
                v-else
                class="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-base font-black uppercase sm:text-lg"
              >
                {{ otherPersonName ? otherPersonName.charAt(0) : '?' }}
              </div>
            </div>
          </div>

          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <h2
                class="text-foreground group-hover:text-primary max-w-[150px] truncate text-base font-bold transition-colors sm:max-w-xs sm:text-lg md:max-w-none md:text-xl"
              >
                {{ otherPersonName }}
              </h2>
              <Icon
                name="solar:alt-arrow-right-linear"
                class="text-foreground/40 group-hover:text-primary shrink-0 text-xs transition-transform group-hover:translate-x-0.5"
              />
            </div>
          </div>
        </button>
      </div>

      <!-- Header actions menu -->
      <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <!-- Search in chat button -->
        <button
          type="button"
          @click="toggleSearchInConversation"
          class="border-border/40 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border shadow-2xs transition-all duration-200 active:scale-95 sm:h-10 sm:w-10 sm:rounded-2xl"
          :class="
            isSearchingInConversation
              ? 'bg-primary/10 text-primary border-primary/30 ring-primary/20 shadow-xs ring-2'
              : 'bg-foreground/5 text-foreground/60 hover:text-primary hover:bg-primary/5 hover:border-primary/25'
          "
          title="Search in conversation"
        >
          <Icon
            name="solar:minimalistic-magnifer-linear"
            class="text-lg sm:text-xl"
          />
        </button>

        <!-- Messenger-style Info toggle button (i) -->
        <button
          type="button"
          @click="toggleUserDetails"
          class="border-border/40 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border shadow-2xs transition-all duration-200 active:scale-95 sm:h-10 sm:w-10 sm:rounded-2xl"
          :class="
            showUserDetails
              ? 'bg-primary/10 text-primary border-primary/30 ring-primary/20 shadow-xs ring-2'
              : 'bg-foreground/5 text-foreground/60 hover:text-primary hover:bg-primary/5 hover:border-primary/25'
          "
          title="Conversation details"
        >
          <Icon
            name="solar:info-circle-linear"
            class="text-lg sm:text-xl"
          />
        </button>
      </div>
    </div>

    <!-- Search Bar in Conversation -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <div
        v-if="isSearchingInConversation"
        class="border-border/60 bg-card z-10 flex shrink-0 items-center gap-2 border-b px-3 py-2 shadow-xs sm:px-6 sm:py-2.5"
      >
        <Icon
          name="solar:magnifer-linear"
          class="text-primary shrink-0 text-lg"
        />
        <input
          ref="searchInputRef"
          v-model="searchInputText"
          type="text"
          placeholder="Search in conversation (press Enter)..."
          class="text-foreground placeholder:text-foreground/40 w-full min-w-0 bg-transparent text-xs outline-none sm:text-sm"
          @keydown.enter.prevent="commitSearch"
          @keydown.shift.enter.prevent="prevSearchMatch"
          @keydown.esc="toggleSearchInConversation"
        />

        <!-- Explicit Search Button (Shown when text is typed/edited but not yet committed) -->
        <button
          v-if="isSearchDirty && searchInputText.trim()"
          type="button"
          @click="commitSearch"
          class="bg-primary hover:bg-primary/90 flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-white shadow-xs transition-all active:scale-95"
          title="Search (Enter)"
        >
          <span>Search</span>
          <kbd class="py-0.2 ml-0.5 rounded bg-white/20 px-1 font-mono text-[9px]">↵</kbd>
        </button>

        <!-- Match Counter & Navigation (Messenger Style, shown when a query is committed) -->
        <template v-else-if="committedSearchQuery">
          <span
            v-if="matchingMessageIds.length > 0"
            class="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300"
          >
            {{ currentMatchIndex + 1 }} of {{ matchingMessageIds.length }}
          </span>
          <span
            v-else
            class="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400"
          >
            No matches
          </span>

          <!-- Match Navigation Arrows (Up / Down) -->
          <div class="border-border/60 flex items-center gap-0.5 border-l pl-1">
            <button
              type="button"
              :disabled="matchingMessageIds.length <= 1"
              @click="prevSearchMatch"
              class="text-foreground/70 hover:bg-foreground/10 hover:text-foreground flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-30"
              title="Previous match (Shift+Enter)"
            >
              <Icon
                name="solar:alt-arrow-up-linear"
                class="text-base"
              />
            </button>
            <button
              type="button"
              :disabled="matchingMessageIds.length <= 1"
              @click="nextSearchMatch"
              class="text-foreground/70 hover:bg-foreground/10 hover:text-foreground flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-30"
              title="Next match (Enter)"
            >
              <Icon
                name="solar:alt-arrow-down-linear"
                class="text-base"
              />
            </button>
          </div>
        </template>

        <!-- Clear Text Button (visible if either input or committed search has content) -->
        <button
          v-if="searchInputText || committedSearchQuery"
          type="button"
          @click="clearSearch"
          class="text-foreground/40 hover:text-foreground p-1"
          title="Clear search"
        >
          <Icon
            name="material-symbols:close-rounded"
            class="text-base"
          />
        </button>

        <button
          type="button"
          @click="toggleSearchInConversation"
          class="text-primary hover:bg-primary/10 shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors"
        >
          Done
        </button>
      </div>
    </Transition>

    <!-- Main Chat Workspace: Messages (flex-1) + Inline Details Sidebar (desktop) -->
    <div class="relative flex min-h-0 flex-1 flex-row overflow-hidden">
      <!-- Chat Body Container (relative container holding chat messages and inputs) -->
      <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Pending Appointment Request Banner (Doctor-only, shown when patient has a pending request for this conversation) -->
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="transform -translate-y-full opacity-0"
          enter-to-class="transform translate-y-0 opacity-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="transform translate-y-0 opacity-100"
          leave-to-class="transform -translate-y-full opacity-0"
        >
          <div
            v-if="userRole?.toLowerCase() === 'doctor' && pendingAppointmentForConversation"
            class="border-b border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 sm:px-6"
          >
            <div
              class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div class="flex items-start gap-3 sm:items-center">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100"
                >
                  <Icon
                    name="material-symbols:calendar-add-on-rounded"
                    class="text-lg text-indigo-600"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-black text-indigo-900">New Appointment Request</p>
                  <p class="text-xs font-medium text-indigo-600">
                    {{ pendingAppointmentForConversation.doctor }} is requesting an appointment
                    <span
                      v-if="
                        pendingAppointmentForConversation.info &&
                        pendingAppointmentForConversation.info !== 'General Appointment'
                      "
                    >
                      for
                      <span class="font-bold">{{ pendingAppointmentForConversation.info }}</span>
                    </span>
                    — review the chat for details.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Active Appointment Bar (scheduled appointment or reschedule in progress) -->
        <div
          v-if="
            activeAppointment &&
            ['scheduled', 'confirmed', 'reschedule_proposed', 'reschedule_requested'].includes(
              activeAppointment.status
            )
          "
          class="flex flex-col border-b px-3.5 py-2.5 transition-all sm:p-4"
          :class="[
            activeAppointment.status === 'reschedule_requested' ||
            activeAppointment.status === 'reschedule_proposed'
              ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20'
              : isOverdue
                ? 'border-red-200 bg-red-50 dark:bg-red-950/20'
                : isToday(activeAppointment.date)
                  ? 'border-amber-100 bg-amber-50 dark:bg-amber-950/20'
                  : 'border-indigo-100 bg-indigo-50/70 dark:bg-indigo-950/20'
          ]"
        >
          <!-- Row 1: Active Scheduled Appointment Details (HIDDEN when reschedule is requested or proposed) -->
          <div
            v-if="
              activeAppointment.status === 'scheduled' || activeAppointment.status === 'confirmed'
            "
            class="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <div
                  class="shrink-0 rounded-full p-2"
                  :class="[
                    isOverdue
                      ? 'bg-red-100'
                      : isToday(activeAppointment.date)
                        ? 'bg-amber-100'
                        : 'bg-indigo-100'
                  ]"
                >
                  <Icon
                    :name="
                      isOverdue
                        ? 'material-symbols:warning-rounded'
                        : isToday(activeAppointment.date)
                          ? 'material-symbols:alarm-on-outline-rounded'
                          : 'material-symbols:calendar-clock-outline-rounded'
                    "
                    class="text-lg sm:text-xl"
                    :class="
                      isOverdue
                        ? 'text-red-600'
                        : isToday(activeAppointment.date)
                          ? 'text-amber-600'
                          : 'text-indigo-600'
                    "
                  />
                </div>
                <div class="min-w-0">
                  <p
                    class="truncate text-xs font-bold sm:text-sm"
                    :class="[
                      isOverdue
                        ? 'text-red-900'
                        : isToday(activeAppointment.date)
                          ? 'text-amber-900'
                          : 'text-indigo-900'
                    ]"
                  >
                    {{
                      isOverdue
                        ? 'Overdue Appointment — Action Needed'
                        : isToday(activeAppointment.date)
                          ? 'Appointment Today!'
                          : 'Upcoming Appointment'
                    }}
                  </p>
                  <p
                    class="truncate text-[11px] font-medium sm:text-xs"
                    :class="[
                      isOverdue
                        ? 'text-red-700'
                        : isToday(activeAppointment.date)
                          ? 'text-amber-700'
                          : 'text-indigo-700'
                    ]"
                  >
                    {{
                      isOverdue
                        ? `Was scheduled for ${activeAppointment.date} at ${activeAppointment.time}`
                        : isToday(activeAppointment.date)
                          ? 'Scheduled for today at ' + activeAppointment.time
                          : activeAppointment.date + ' at ' + activeAppointment.time
                    }}
                  </p>
                </div>
              </div>

              <!-- Mobile action toggle button -->
              <button
                type="button"
                @click="isApptBarCollapsed = !isApptBarCollapsed"
                class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-700 shadow-xs transition-all active:scale-95 sm:hidden"
              >
                <span>{{ isApptBarCollapsed ? 'Show Actions' : 'Hide' }}</span>
                <Icon
                  :name="
                    isApptBarCollapsed ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-up-linear'
                  "
                  class="text-xs"
                />
              </button>
            </div>

            <div
              v-if="userRole?.toLowerCase() === 'doctor'"
              class="w-full flex-wrap justify-end gap-2 sm:w-auto"
              :class="isApptBarCollapsed ? 'hidden sm:flex' : 'flex'"
            >
              <button
                type="button"
                @click="showCompleteConfirm = true"
                class="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
              >
                <Icon
                  name="material-symbols:check-circle-rounded"
                  class="text-sm"
                />
                Mark as Accomplished
              </button>
              <button
                type="button"
                @click="showCancelConfirm = true"
                class="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-bold text-red-600 shadow-sm ring-1 ring-red-200 transition-all hover:bg-red-50 active:scale-95"
              >
                <Icon
                  name="material-symbols:cancel-rounded"
                  class="text-sm"
                />
                Cancel
              </button>
              <button
                type="button"
                @click="openRescheduleModal"
                class="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-200 transition-all hover:bg-indigo-50 active:scale-95"
              >
                <Icon
                  name="material-symbols:edit-calendar-rounded"
                  class="text-sm"
                />
                Reschedule
              </button>
            </div>
            <div
              v-else-if="
                userRole?.toLowerCase() === 'patient' &&
                (activeAppointment.status === 'scheduled' ||
                  activeAppointment.status === 'confirmed')
              "
              class="items-center gap-2"
              :class="isApptBarCollapsed ? 'hidden sm:flex' : 'flex'"
            >
              <button
                type="button"
                @click="requestReschedule(activeAppointment.id)"
                class="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-200 transition-all hover:bg-indigo-50 active:scale-95"
              >
                <Icon
                  name="material-symbols:edit-calendar-rounded"
                  class="text-sm"
                />
                Request Reschedule
              </button>
            </div>
          </div>

          <!-- Action Bar when status is reschedule_proposed or reschedule_requested -->
          <div
            v-if="
              activeAppointment.status === 'reschedule_proposed' ||
              activeAppointment.status === 'reschedule_requested'
            "
            class="flex flex-col items-start justify-between gap-3 p-1 md:flex-row md:items-center"
          >
            <!-- Case 1: Status is reschedule_proposed -->
            <template v-if="activeAppointment.status === 'reschedule_proposed'">
              <template v-if="!isRescheduleProposedByMe(activeAppointment.id)">
                <div class="flex shrink-0 items-center gap-2 text-sm font-bold text-amber-800">
                  <Icon
                    name="material-symbols:info"
                    class="shrink-0 text-lg"
                  />
                  New schedule proposed by
                  {{ userRole?.toLowerCase() === 'doctor' ? 'patient' : 'doctor' }}
                </div>
                <div class="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                  <button
                    type="button"
                    :disabled="isAcceptingReschedule"
                    @click="acceptReschedule(activeAppointment.id)"
                    class="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-green-700 active:scale-95 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
                  >
                    <Icon
                      v-if="isAcceptingReschedule"
                      name="svg-spinners:ring-resize"
                      class="text-sm"
                    />
                    <Icon
                      v-else
                      name="material-symbols:check-circle-rounded"
                      class="text-sm"
                    />
                    Accept
                  </button>
                  <button
                    v-if="userRole?.toLowerCase() === 'patient'"
                    type="button"
                    @click="requestReschedule(activeAppointment.id)"
                    class="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 sm:w-auto"
                  >
                    <Icon
                      name="material-symbols:edit-calendar-rounded"
                      class="text-sm"
                    />
                    Request Reschedule
                  </button>
                  <button
                    v-else
                    type="button"
                    @click="openRescheduleModal"
                    class="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 sm:w-auto"
                  >
                    <Icon
                      name="material-symbols:edit-calendar-rounded"
                      class="text-sm"
                    />
                    Propose Another Date
                  </button>
                  <button
                    type="button"
                    @click="cancelAppointment(activeAppointment.id)"
                    class="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-bold text-red-600 shadow-sm ring-1 ring-red-200 transition-all hover:bg-red-50 active:scale-95 sm:w-auto"
                  >
                    <Icon
                      name="material-symbols:cancel-rounded"
                      class="text-sm"
                    />
                    Cancel Appointment
                  </button>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center gap-2 text-sm font-bold text-amber-800">
                  <Icon
                    name="material-symbols:hourglass-top-rounded"
                    class="shrink-0 animate-pulse text-lg"
                  />
                  Waiting for {{ userRole?.toLowerCase() === 'doctor' ? 'patient' : 'doctor' }} to
                  confirm your proposed schedule...
                </div>
              </template>
            </template>

            <!-- Case 2: Status is reschedule_requested -->
            <template v-else-if="activeAppointment.status === 'reschedule_requested'">
              <template v-if="userRole?.toLowerCase() === 'doctor'">
                <div class="flex items-start gap-2.5">
                  <Icon
                    name="material-symbols:calendar-month-rounded"
                    class="mt-0.5 shrink-0 text-lg text-amber-700"
                  />
                  <div class="flex flex-col">
                    <span class="text-sm font-bold text-amber-900"
                      >Patient requested a reschedule</span
                    >
                    <span
                      v-if="activeAppointment.requested_reschedule_date"
                      class="text-xs font-medium text-amber-800"
                    >
                      Preferred: {{ formatRequestedRescheduleLabel(activeAppointment) }}
                    </span>
                  </div>
                </div>
                <div class="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                  <button
                    type="button"
                    :disabled="isAcceptingReschedule"
                    @click="acceptReschedule(activeAppointment.id)"
                    class="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-green-700 active:scale-95 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
                  >
                    <Icon
                      v-if="isAcceptingReschedule"
                      name="svg-spinners:ring-resize"
                      class="text-sm"
                    />
                    <Icon
                      v-else
                      name="material-symbols:check-circle-rounded"
                      class="text-sm"
                    />
                    Accept Request
                  </button>
                  <button
                    type="button"
                    @click="openRescheduleModal"
                    class="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 sm:w-auto"
                  >
                    <Icon
                      name="material-symbols:edit-calendar-rounded"
                      class="text-sm"
                    />
                    Propose Another Date
                  </button>
                  <button
                    type="button"
                    @click="cancelAppointment(activeAppointment.id)"
                    class="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-bold text-red-600 shadow-sm ring-1 ring-red-200 transition-all hover:bg-red-50 active:scale-95 sm:w-auto"
                  >
                    <Icon
                      name="material-symbols:cancel-rounded"
                      class="text-sm"
                    />
                    Cancel Appointment
                  </button>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center gap-2 text-sm font-bold text-amber-800">
                  <Icon
                    name="material-symbols:hourglass-top-rounded"
                    class="shrink-0 animate-pulse text-lg"
                  />
                  Waiting for doctor to propose a new schedule...
                </div>
              </template>
            </template>
          </div>
        </div>

        <!-- Messages Area -->

        <div
          ref="messagesContainer"
          @scroll="handleScroll"
          class="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 md:p-8"
        >
          <!-- Loading older messages indicator -->
          <div
            v-if="isFetchingOlder"
            class="flex justify-center py-2"
          >
            <Icon
              name="svg-spinners:ring-resize"
              class="text-primary text-2xl"
            />
          </div>

          <!-- Loading skeleton (Initial) -->
          <div
            v-if="pending && displayedMessages.length === 0"
            class="flex flex-1 items-center justify-center"
          >
            <div class="text-foreground/20 text-center">
              <Icon
                name="svg-spinners:ring-resize"
                class="mx-auto mb-4 text-5xl"
              />
              <p class="text-lg font-medium">Loading messages...</p>
            </div>
          </div>

          <!-- Empty state -->
          <div
            v-else-if="displayedMessages.length === 0"
            class="flex flex-1 items-center justify-center"
          >
            <div class="text-foreground/20 text-center">
              <Icon
                name="solar:chat-round-line-linear"
                class="mb-4 text-8xl"
              />
              <p class="text-xl font-bold">No messages yet</p>
              <p class="mt-1 text-sm">Send a message to start the conversation</p>
            </div>
          </div>

          <!-- Message bubbles -->
          <div class="flex flex-col gap-4">
            <div
              v-for="msg in displayedMessages"
              :key="msg.id"
              :id="'msg-' + msg.id"
              class="group flex items-end gap-3 rounded-2xl transition-all duration-300"
              :class="[
                msg.sender?.id === effectiveUserUuid ? 'flex-row-reverse' : 'flex-row',
                currentSearchMatchMessageId === msg.id
                  ? '-m-1 bg-amber-500/10 p-1 shadow-sm ring-2 ring-amber-400 dark:bg-amber-400/10'
                  : ''
              ]"
              @contextmenu="openContextMenu($event, msg)"
            >
              <div class="border-border/50 h-10 w-10 shrink-0 overflow-hidden rounded-full border">
                <img
                  v-if="msg.sender?.avatar && !hasMessageAvatarError(msg.id)"
                  :src="getStorageUrl(msg.sender.avatar)"
                  :alt="msg.sender?.name"
                  class="h-full w-full object-cover"
                  @error="handleMessageAvatarError(msg.id)"
                />
                <div
                  v-else
                  class="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-sm font-bold uppercase"
                >
                  {{ (msg.sender?.name || '?').charAt(0) }}
                </div>
              </div>

              <div class="flex max-w-[70%] flex-col gap-1">
                <!-- Editing mode -->
                <div
                  v-if="editingMessageId === msg.id"
                  class="flex flex-col gap-2"
                >
                  <textarea
                    v-model="editingMessageText"
                    @keydown="handleEditKeydown"
                    class="bg-foreground/5 border-primary/30 min-h-12 w-full resize-none rounded-2xl border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-200"
                    rows="2"
                  ></textarea>
                  <div class="flex items-center gap-2">
                    <button
                      @click="saveEdit"
                      class="bg-primary hover:bg-primary/90 rounded-lg px-3 py-1 text-xs font-semibold text-white transition-colors"
                    >
                      Save
                    </button>
                    <button
                      @click="cancelEditing"
                      class="text-foreground/50 hover:text-foreground rounded-lg px-3 py-1 text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <!-- Normal bubble -->
                <div
                  v-else
                  class="relative px-5 py-3 transition-all"
                  :class="[
                    msg.sender?.id === effectiveUserUuid
                      ? 'bg-primary shadow-primary/10 rounded-t-2xl rounded-bl-2xl text-white shadow-lg'
                      : 'bg-foreground/5 text-foreground rounded-t-2xl rounded-br-2xl'
                  ]"
                >
                  <div
                    v-if="
                      msg.message.includes('[APPOINTMENT_REQUEST:') ||
                      msg.message.includes('[DIAGNOSIS_ONLY:') ||
                      msg.message.includes('[SCAN_RESULT:')
                    "
                  >
                    <div class="mb-2">
                      <Icon
                        :name="
                          msg.message.includes('[APPOINTMENT_REQUEST:')
                            ? 'material-symbols:calendar-month-rounded'
                            : 'material-symbols:diagnosis-outline-rounded'
                        "
                        class="mb-2 text-3xl"
                        :class="
                          msg.sender?.id === effectiveUserUuid ? 'text-white' : 'text-primary'
                        "
                      />
                      <p class="text-lg font-bold">
                        {{
                          msg.message.includes('[APPOINTMENT_REQUEST:')
                            ? 'Appointment Request'
                            : 'Clinical Findings'
                        }}
                      </p>
                      <p
                        class="text-sm"
                        :class="
                          msg.sender?.id === effectiveUserUuid ? 'text-white/90' : 'opacity-80'
                        "
                        v-html="formatHighlightedText(cleanClinicalFindings(msg.message), msg.id)"
                      ></p>
                    </div>

                    <!-- Requested Schedule Information Card -->
                    <div
                      v-if="getAppointmentScheduleFromMsg(msg)"
                      class="mt-3 rounded-2xl border p-3.5 shadow-xs"
                      :class="[
                        msg.sender?.id === effectiveUserUuid
                          ? 'border-white/20 bg-white text-gray-900 shadow-md'
                          : 'bg-card/70 border-border/60 text-foreground backdrop-blur-sm'
                      ]"
                    >
                      <div class="flex items-start gap-3">
                        <div
                          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-2xs"
                        >
                          <Icon
                            name="material-symbols:event-available-rounded"
                            class="text-xl"
                          />
                        </div>
                        <div class="min-w-0 flex-1">
                          <p
                            class="text-[10px] font-black tracking-wider text-indigo-600 uppercase"
                          >
                            Requested Consultation Schedule
                          </p>
                          <p
                            class="text-sm leading-tight font-black"
                            :class="
                              msg.sender?.id === effectiveUserUuid
                                ? 'text-gray-900'
                                : 'text-foreground'
                            "
                          >
                            {{ getAppointmentScheduleFromMsg(msg) }}
                          </p>
                          <p
                            v-if="msg.appointment_data?.purpose"
                            class="mt-1 text-xs font-semibold"
                            :class="
                              msg.sender?.id === effectiveUserUuid
                                ? 'text-gray-600'
                                : 'text-muted-foreground'
                            "
                          >
                            Purpose: {{ msg.appointment_data.purpose }}
                          </p>
                        </div>
                      </div>
                    </div>

                    <!-- Diagnosis Details -->
                    <div
                      v-if="msg.appointment_data && msg.appointment_data.diagnosis"
                      class="mt-3 rounded-2xl border p-4 shadow-sm"
                      :class="[
                        msg.sender?.id === effectiveUserUuid
                          ? 'border-white/20 bg-white text-gray-900 shadow-md'
                          : 'bg-card/50 border-border/50 text-foreground backdrop-blur-sm'
                      ]"
                    >
                      <div class="flex gap-4">
                        <img
                          :src="getStorageUrl(msg.appointment_data.diagnosis.image_path)"
                          class="border-border h-24 w-24 shrink-0 rounded-xl border object-cover shadow-sm"
                          alt="Diagnosis scan"
                        />
                        <div class="flex min-w-0 flex-col justify-center gap-0.5">
                          <p class="text-primary text-[10px] font-black tracking-widest uppercase">
                            {{
                              msg.appointment_data?.diagnosis?.scan_type === 'in_clinic'
                                ? 'Clinical Findings'
                                : 'AI Scan Result (Home Self-Assessment)'
                            }}
                          </p>
                          <h4
                            class="truncate text-lg leading-tight font-black"
                            :class="
                              msg.sender?.id === effectiveUserUuid
                                ? 'text-gray-900'
                                : 'text-foreground'
                            "
                            v-html="
                              formatHighlightedText(msg.appointment_data.diagnosis.label, msg.id)
                            "
                          ></h4>
                          <div class="mt-1 flex flex-col gap-0.5">
                            <p
                              class="truncate text-xs font-bold"
                              :class="
                                msg.sender?.id === effectiveUserUuid
                                  ? 'text-gray-700'
                                  : 'text-foreground/70'
                              "
                            >
                              {{ msg.appointment_data.diagnosis.patient_name }}
                            </p>
                            <p
                              class="text-[11px] font-medium"
                              :class="
                                msg.sender?.id === effectiveUserUuid
                                  ? 'text-gray-500'
                                  : 'text-foreground/50'
                              "
                            >
                              {{
                                msg.appointment_data.diagnosis.patient_age != null &&
                                msg.appointment_data.diagnosis.patient_age !== ''
                                  ? `${msg.appointment_data.diagnosis.patient_age} years old • `
                                  : ''
                              }}{{ msg.appointment_data.diagnosis.date }}
                            </p>
                          </div>
                        </div>
                      </div>

                      <!-- Doctor / Attendees Button for Patient Clinical Anamnesis Answers -->
                      <div
                        v-if="
                          msg.appointment_data?.diagnosis?.is_questionnaire_refined ||
                          (msg.appointment_data?.diagnosis as any)?.questionnaire_answers
                        "
                        class="border-border/40 mt-3 border-t pt-2.5"
                      >
                        <button
                          type="button"
                          class="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 flex w-full items-center justify-between rounded-xl border px-3 py-1.5 text-xs font-bold transition-all active:scale-98"
                          @click.stop="
                            openPatientQuestionnaireModal(msg.appointment_data.diagnosis)
                          "
                        >
                          <div class="flex items-center gap-1.5">
                            <Icon
                              name="lucide:folder-heart"
                              class="h-4 w-4"
                            />
                            <span>Patient Anamnesis Answers</span>
                          </div>
                          <span class="text-primary/80 text-[10px] font-black uppercase">
                            View Answers →
                          </span>
                        </button>
                      </div>

                      <div
                        v-else-if="
                          userRole?.toLowerCase() === 'doctor' ||
                          userRole?.toLowerCase() === 'secretary'
                        "
                        class="text-muted-foreground/80 mt-2 flex items-center gap-1.5 text-[10px] italic"
                      >
                        <Icon
                          name="lucide:info"
                          class="h-3.5 w-3.5 shrink-0"
                        />
                        <span>Visual scan only (No questionnaire submitted)</span>
                      </div>
                    </div>

                    <!-- Only show buttons for actual Appointment Requests and only if no appointment is active -->
                    <div
                      v-if="
                        (userRole?.toLowerCase() === 'doctor' ||
                          userRole?.toLowerCase() === 'secretary') &&
                        msg.message.includes('[APPOINTMENT_REQUEST:') &&
                        !isAppointmentHandled(msg.message)
                      "
                      class="mt-4 flex flex-wrap gap-2"
                    >
                      <button
                        v-if="getAppointmentScheduleFromMsg(msg)"
                        type="button"
                        :disabled="
                          isAcceptingBookingDirect ===
                          extractAppointmentUuid(msg.message, 'REQUEST')
                        "
                        @click.prevent="acceptAppointmentDirectly(msg.message)"
                        class="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                      >
                        <Icon
                          v-if="
                            isAcceptingBookingDirect ===
                            extractAppointmentUuid(msg.message, 'REQUEST')
                          "
                          name="svg-spinners:ring-resize"
                          class="text-sm"
                        />
                        <Icon
                          v-else
                          name="material-symbols:check-circle-rounded"
                          class="text-sm"
                        />
                        <span>Accept Request</span>
                      </button>

                      <button
                        type="button"
                        @click.prevent="openScheduleModal(msg.message)"
                        class="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
                      >
                        {{
                          getAppointmentScheduleFromMsg(msg)
                            ? 'Adjust Schedule'
                            : 'Accept & Schedule'
                        }}
                      </button>

                      <button
                        type="button"
                        @click.prevent="declineAppointment(msg.message)"
                        class="bg-foreground/10 hover:bg-foreground/20 cursor-pointer rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-95"
                      >
                        Decline
                      </button>
                    </div>

                    <!-- Patient actions for pending requests -->
                    <div
                      v-if="
                        userRole?.toLowerCase() === 'patient' &&
                        msg.message.includes('[APPOINTMENT_REQUEST:') &&
                        !isAppointmentHandled(msg.message)
                      "
                      class="mt-4 flex flex-wrap gap-2"
                    >
                      <button
                        type="button"
                        @click.prevent="
                          requestReschedule(extractAppointmentUuid(msg.message, 'REQUEST'))
                        "
                        class="text-primary ring-primary/20 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 self-start rounded-xl bg-white px-3.5 text-xs font-bold shadow-sm ring-1 transition-all hover:bg-white/90 active:scale-95"
                      >
                        <Icon
                          name="material-symbols:edit-calendar-rounded"
                          class="text-sm"
                        />
                        Request Reschedule
                      </button>
                    </div>
                  </div>
                  <div
                    v-else-if="
                      msg.message.includes('[APPOINTMENT_SCHEDULED:') ||
                      msg.message.includes('[APPOINTMENT_CONFIRMED:')
                    "
                  >
                    <div class="flex flex-col">
                      <div class="mb-2 flex items-center gap-2">
                        <div
                          class="rounded-full p-2"
                          :class="
                            msg.sender?.id === effectiveUserUuid
                              ? 'bg-white text-green-600 shadow-sm'
                              : 'bg-green-100 text-green-600'
                          "
                        >
                          <Icon
                            name="material-symbols:check-circle-rounded"
                            class="text-xl"
                          />
                        </div>
                        <span
                          class="font-bold"
                          :class="
                            msg.sender?.id === effectiveUserUuid ? 'text-white' : 'text-green-700'
                          "
                          >Appointment Confirmed</span
                        >
                      </div>
                      <p
                        class="text-sm"
                        :class="
                          msg.sender?.id === effectiveUserUuid ? 'text-white/95' : 'opacity-90'
                        "
                        v-html="
                          msg.message
                            .replace(/\[(APPOINTMENT_SCHEDULED|APPOINTMENT_CONFIRMED):.*?\]/g, '')
                            .trim()
                        "
                      ></p>
                      <button
                        v-if="canRequestReschedule(msg.message)"
                        type="button"
                        @click.prevent="
                          requestReschedule(extractScheduledAppointmentUuid(msg.message))
                        "
                        class="text-primary ring-primary/20 mt-3 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 self-start rounded-xl bg-white px-3.5 text-xs font-bold shadow-sm ring-1 transition-all hover:bg-white/90 active:scale-95"
                      >
                        <Icon
                          name="material-symbols:edit-calendar-rounded"
                          class="text-sm"
                        />
                        {{ isDoctorUser ? 'Reschedule' : 'Request Reschedule' }}
                      </button>
                    </div>
                  </div>
                  <div v-else-if="msg.message.includes('[APPOINTMENT_DECLINED:')">
                    <div class="flex flex-col">
                      <div class="mb-2 flex items-center gap-2">
                        <div
                          class="rounded-full p-2"
                          :class="
                            msg.sender?.id === effectiveUserUuid
                              ? 'bg-white text-red-500 shadow-sm'
                              : 'bg-red-100 text-red-500'
                          "
                        >
                          <Icon
                            name="material-symbols:cancel-rounded"
                            class="text-xl"
                          />
                        </div>
                        <span
                          class="font-bold"
                          :class="
                            msg.sender?.id === effectiveUserUuid ? 'text-white' : 'text-red-600'
                          "
                          >Appointment Request Declined</span
                        >
                      </div>
                      <p
                        class="text-sm"
                        :class="
                          msg.sender?.id === effectiveUserUuid ? 'text-white/95' : 'opacity-90'
                        "
                        v-html="
                          formatHighlightedText(
                            msg.message.replace(/\[APPOINTMENT_DECLINED:.*?\]/g, '').trim(),
                            msg.id
                          )
                        "
                      ></p>

                      <!-- Diagnosis Details Preview (if available) -->
                      <div
                        v-if="getDeclinedDiagnosisData(msg)"
                        class="mt-3 rounded-2xl border p-4 shadow-sm"
                        :class="[
                          msg.sender?.id === effectiveUserUuid
                            ? 'border-white/20 bg-white text-gray-900 shadow-md'
                            : 'border-border/50 bg-card/50 text-foreground backdrop-blur-sm'
                        ]"
                      >
                        <div class="flex gap-4">
                          <img
                            v-if="getDeclinedDiagnosisData(msg)?.image_path"
                            :src="getStorageUrl(getDeclinedDiagnosisData(msg)!.image_path)"
                            class="border-border h-20 w-20 shrink-0 rounded-xl border object-cover shadow-sm"
                            alt="Diagnosis scan"
                          />
                          <div class="flex min-w-0 flex-col justify-center gap-0.5">
                            <p
                              class="text-primary text-[10px] font-black tracking-widest uppercase"
                            >
                              Clinical Findings
                            </p>
                            <h4
                              class="truncate text-base leading-tight font-black"
                              :class="
                                msg.sender?.id === effectiveUserUuid
                                  ? 'text-gray-900'
                                  : 'text-foreground'
                              "
                              v-html="
                                formatHighlightedText(getDeclinedDiagnosisData(msg)?.label, msg.id)
                              "
                            ></h4>
                            <div class="mt-0.5 flex flex-col gap-0.5">
                              <p
                                class="truncate text-xs font-bold"
                                :class="
                                  msg.sender?.id === effectiveUserUuid
                                    ? 'text-gray-700'
                                    : 'text-foreground/70'
                                "
                              >
                                {{ getDeclinedDiagnosisData(msg)?.patient_name }}
                              </p>
                              <p
                                v-if="getDeclinedDiagnosisData(msg)?.date"
                                class="text-[11px] font-medium"
                                :class="
                                  msg.sender?.id === effectiveUserUuid
                                    ? 'text-gray-500'
                                    : 'text-foreground/50'
                                "
                              >
                                {{ getDeclinedDiagnosisData(msg)?.date }}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Rebook Appointment Button for Patients -->
                      <div
                        v-if="canRebookAppointment(msg)"
                        class="mt-3.5 flex items-center gap-2"
                      >
                        <button
                          type="button"
                          :disabled="isRebookingAppt"
                          @click.prevent="handleRebookAppointment(msg)"
                          class="bg-primary hover:bg-primary/90 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                        >
                          <Icon
                            v-if="isRebookingAppt"
                            name="svg-spinners:ring-resize"
                            class="text-sm"
                          />
                          <Icon
                            v-else
                            name="material-symbols:replay-rounded"
                            class="text-sm"
                          />
                          <span>{{ isRebookingAppt ? 'Rebooking...' : 'Rebook Appointment' }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="msg.message.includes('[APPOINTMENT_CANCELLED:')">
                    <div class="flex flex-col">
                      <div class="mb-2 flex items-center gap-2">
                        <div
                          class="rounded-full p-2"
                          :class="
                            msg.sender?.id === effectiveUserUuid
                              ? 'bg-white text-amber-600 shadow-sm'
                              : 'bg-amber-100 text-amber-600'
                          "
                        >
                          <Icon
                            name="material-symbols:event-busy-rounded"
                            class="text-xl"
                          />
                        </div>
                        <span
                          class="font-bold"
                          :class="
                            msg.sender?.id === effectiveUserUuid ? 'text-white' : 'text-amber-800'
                          "
                          >Appointment Cancelled</span
                        >
                      </div>
                      <p
                        class="text-sm"
                        :class="
                          msg.sender?.id === effectiveUserUuid ? 'text-white/95' : 'opacity-90'
                        "
                        v-html="
                          formatHighlightedText(
                            msg.message.replace(/\[APPOINTMENT_CANCELLED:.*?\]/g, '').trim(),
                            msg.id
                          )
                        "
                      ></p>
                    </div>
                  </div>
                  <div v-else-if="msg.message.includes('[APPOINTMENT_COMPLETED:')">
                    <div class="flex flex-col">
                      <div class="mb-2 flex items-center gap-2">
                        <div
                          class="rounded-full p-2"
                          :class="
                            msg.sender?.id === effectiveUserUuid
                              ? 'bg-white text-green-600 shadow-sm'
                              : 'bg-green-100 text-green-600'
                          "
                        >
                          <Icon
                            name="material-symbols:check-circle-rounded"
                            class="text-xl"
                          />
                        </div>
                        <span
                          class="font-bold"
                          :class="
                            msg.sender?.id === effectiveUserUuid ? 'text-white' : 'text-green-700'
                          "
                          >Appointment Completed</span
                        >
                      </div>
                      <p
                        class="text-sm"
                        :class="
                          msg.sender?.id === effectiveUserUuid ? 'text-white/95' : 'opacity-90'
                        "
                        v-html="
                          formatHighlightedText(
                            msg.message.replace(/\[APPOINTMENT_COMPLETED:.*?\]/g, '').trim(),
                            msg.id
                          )
                        "
                      ></p>
                    </div>
                  </div>
                  <div v-else-if="msg.message.includes('[APPOINTMENT_RESCHEDULE_PROPOSED:')">
                    <div class="flex flex-col">
                      <div class="mb-2 flex items-center gap-2">
                        <div
                          class="rounded-full p-2"
                          :class="
                            msg.sender?.id === effectiveUserUuid
                              ? 'bg-white text-amber-600 shadow-sm'
                              : 'bg-amber-100 text-amber-600'
                          "
                        >
                          <Icon
                            name="material-symbols:edit-calendar-rounded"
                            class="text-xl"
                          />
                        </div>
                        <span
                          class="font-bold"
                          :class="
                            msg.sender?.id === effectiveUserUuid ? 'text-white' : 'text-amber-700'
                          "
                          >Reschedule Proposed</span
                        >
                      </div>
                      <p
                        class="text-sm leading-relaxed"
                        :class="
                          msg.sender?.id === effectiveUserUuid ? 'text-white/95' : 'opacity-90'
                        "
                        v-html="
                          formatHighlightedText(
                            msg.message
                              .replace(/\[APPOINTMENT_RESCHEDULE_PROPOSED:.*?\]/g, '')
                              .trim(),
                            msg.id
                          )
                        "
                      ></p>
                    </div>
                  </div>
                  <div v-else-if="msg.message.includes('[APPOINTMENT_RESCHEDULE_REQUESTED:')">
                    <div class="flex flex-col">
                      <div class="mb-2 flex items-center gap-2">
                        <div
                          class="rounded-full p-2"
                          :class="
                            msg.sender?.id === effectiveUserUuid
                              ? 'bg-white text-amber-600 shadow-sm'
                              : 'bg-amber-100 text-amber-600'
                          "
                        >
                          <Icon
                            name="material-symbols:event-repeat-rounded"
                            class="text-xl"
                          />
                        </div>
                        <span
                          class="font-bold"
                          :class="
                            msg.sender?.id === effectiveUserUuid ? 'text-white' : 'text-amber-700'
                          "
                          >Reschedule Requested</span
                        >
                      </div>
                      <p
                        class="text-sm leading-relaxed"
                        :class="
                          msg.sender?.id === effectiveUserUuid ? 'text-white/95' : 'opacity-90'
                        "
                        v-html="
                          formatHighlightedText(
                            msg.message
                              .replace(/\[APPOINTMENT_RESCHEDULE_REQUESTED:.*?\]/g, '')
                              .trim(),
                            msg.id
                          )
                        "
                      ></p>
                    </div>
                  </div>
                  <div v-else-if="msg.message.includes('[APPOINTMENT_RESCHEDULE_ACCEPTED:')">
                    <div class="flex flex-col">
                      <div class="mb-2 flex items-center gap-2">
                        <div
                          class="rounded-full p-2"
                          :class="
                            msg.sender?.id === effectiveUserUuid
                              ? 'bg-white text-green-600 shadow-sm'
                              : 'bg-green-100 text-green-600'
                          "
                        >
                          <Icon
                            name="material-symbols:check-circle-rounded"
                            class="text-xl"
                          />
                        </div>
                        <span
                          class="font-bold"
                          :class="
                            msg.sender?.id === effectiveUserUuid ? 'text-white' : 'text-green-700'
                          "
                          >Reschedule Accepted</span
                        >
                      </div>
                      <p
                        class="text-sm"
                        :class="
                          msg.sender?.id === effectiveUserUuid ? 'text-white/95' : 'opacity-90'
                        "
                        v-html="
                          formatHighlightedText(
                            msg.message
                              .replace(/\[APPOINTMENT_RESCHEDULE_ACCEPTED:.*?\]/g, '')
                              .trim(),
                            msg.id
                          )
                        "
                      ></p>
                    </div>
                  </div>
                  <p
                    v-else-if="msg.message"
                    class="text-base leading-relaxed whitespace-pre-wrap"
                    v-html="formatHighlightedText(msg.message, msg.id)"
                  ></p>

                  <!-- Attachments Display -->
                  <div
                    v-if="msg.attachments && msg.attachments.length > 0"
                    class="mt-3 flex flex-col gap-2"
                  >
                    <div
                      v-for="attachment in msg.attachments"
                      :key="attachment.id"
                      class="group/attachment relative overflow-hidden rounded-xl border border-white/10"
                      :class="msg.sender?.id === effectiveUserUuid ? 'bg-white/10' : 'bg-black/5'"
                    >
                      <!-- Image Preview -->
                      <div
                        v-if="isImage(attachment.type)"
                        class="max-w-xs cursor-pointer"
                        @click="handlePreviewImage(attachment.url)"
                      >
                        <img
                          :src="attachment.url"
                          :alt="attachment.name"
                          class="h-auto w-full object-cover transition-transform group-hover/attachment:scale-105"
                        />
                      </div>

                      <!-- File Link -->
                      <a
                        v-else
                        :href="attachment.url"
                        target="_blank"
                        class="flex items-center gap-3 p-3 transition-colors hover:bg-white/5"
                      >
                        <div
                          class="bg-primary/20 flex h-10 w-10 items-center justify-center rounded-lg"
                        >
                          <Icon
                            :name="
                              isPdf(attachment.type)
                                ? 'solar:file-text-bold'
                                : 'solar:document-bold'
                            "
                            class="text-xl"
                            :class="
                              msg.sender?.id === effectiveUserUuid ? 'text-white' : 'text-primary'
                            "
                          />
                        </div>
                        <div class="flex-1 overflow-hidden">
                          <p
                            class="truncate text-xs font-bold"
                            :class="
                              msg.sender?.id === effectiveUserUuid
                                ? 'text-white'
                                : 'text-foreground'
                            "
                            v-html="formatHighlightedText(attachment.name, msg.id)"
                          ></p>
                          <p
                            class="text-[10px] opacity-60"
                            :class="
                              msg.sender?.id === effectiveUserUuid
                                ? 'text-white'
                                : 'text-foreground'
                            "
                          >
                            {{ formatFileSize(attachment.size) }}
                          </p>
                        </div>
                        <Icon
                          name="solar:download-minimalistic-linear"
                          class="text-lg opacity-40"
                        />
                      </a>
                    </div>
                  </div>

                  <!-- Own message action dots (visible on hover) -->
                  <button
                    v-if="msg.sender?.id === effectiveUserUuid"
                    @click.stop="openContextMenu($event, msg)"
                    class="absolute top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                    :class="msg.sender?.id === effectiveUserUuid ? '-left-9' : '-right-9'"
                  >
                    <Icon
                      name="solar:menu-dots-vertical-bold"
                      class="text-foreground/30 hover:text-foreground/60 text-lg"
                    />
                  </button>
                </div>

                <span
                  class="text-foreground/70 text-[11px] font-medium"
                  :class="msg.sender?.id === effectiveUserUuid ? 'text-right' : 'text-left'"
                >
                  {{ formatTime(msg.created_at) }}
                  <span
                    v-if="isEdited(msg)"
                    class="italic"
                  >
                    · edited</span
                  >
                  <span
                    v-if="msg.sender?.id === effectiveUserUuid && msg.is_read"
                    class="ml-1"
                    >✓✓</span
                  >
                </span>
              </div>
            </div>
          </div>

          <!-- Live Messenger-Style Typing Bubble -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <div
              v-if="partnerIsTyping"
              class="flex items-end gap-2 pt-1 pb-1.5"
            >
              <!-- Partner Avatar (Identical to message avatar, proportionally compact) -->
              <div
                class="border-border/50 relative h-7 w-7 shrink-0 overflow-hidden rounded-full border"
              >
                <img
                  v-if="otherPersonAvatar && !headerAvatarFailed"
                  :src="getStorageUrl(otherPersonAvatar)"
                  :alt="otherPersonName"
                  class="h-full w-full object-cover"
                  @error="headerAvatarFailed = true"
                />
                <div
                  v-else
                  class="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-[11px] font-bold uppercase"
                >
                  {{ (otherPersonName || '?').charAt(0) }}
                </div>
              </div>

              <!-- 3 Bouncing Dots Bubble (Same style as incoming chat, smaller size) -->
              <div
                class="bg-foreground/5 text-foreground flex items-center gap-1.5 rounded-t-2xl rounded-br-2xl px-3.5 py-2.5"
              >
                <span
                  class="typing-dot bg-foreground/40 inline-block h-1.5 w-1.5 rounded-full"
                ></span>
                <span
                  class="typing-dot bg-foreground/40 inline-block h-1.5 w-1.5 rounded-full"
                ></span>
                <span
                  class="typing-dot bg-foreground/40 inline-block h-1.5 w-1.5 rounded-full"
                ></span>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Input Area -->
        <div
          class="bg-card border-border/60 shrink-0 border-t px-3 pt-2.5 pb-[max(0.875rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] sm:px-4 sm:py-3 md:border-0 md:bg-transparent md:p-6 md:pt-0"
        >
          <!-- File Preview Area -->
          <div
            v-if="selectedFiles.length > 0"
            class="mb-3 flex flex-wrap gap-2 sm:gap-3"
          >
            <div
              v-for="(file, index) in selectedFiles"
              :key="index"
              class="bg-card border-border/50 relative flex items-center gap-2.5 rounded-2xl border p-2.5 pr-8 shadow-xs sm:p-3 sm:pr-10"
            >
              <div
                class="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-xl sm:h-10 sm:w-10"
              >
                <Icon
                  :name="isImage(file.type) ? 'solar:gallery-bold' : 'solar:document-bold'"
                  class="text-primary text-lg sm:text-xl"
                />
              </div>
              <div class="max-w-[120px] overflow-hidden sm:max-w-[150px]">
                <p class="text-foreground truncate text-xs font-bold">{{ file.name }}</p>
                <p class="text-foreground/50 text-[10px]">{{ formatFileSize(file.size) }}</p>
              </div>
              <button
                @click="removeFile(index)"
                class="text-foreground/40 hover:text-destructive absolute top-2 right-2 transition-colors"
              >
                <Icon
                  name="solar:close-circle-bold"
                  class="text-base sm:text-lg"
                />
              </button>
            </div>
          </div>

          <div class="group relative flex items-center gap-2 sm:gap-3">
            <!-- Hidden File Input -->
            <input
              type="file"
              ref="fileInput"
              multiple
              class="hidden"
              @change="handleFileChange"
            />

            <div class="relative flex flex-1 items-center">
              <textarea
                v-model="messageTerm"
                placeholder="Type a message..."
                @input="broadcastTyping"
                @keydown="handleKeydown"
                class="bg-foreground/5 text-foreground placeholder:text-foreground/40 focus:border-primary/40 focus:ring-primary/20 custom-scrollbar border-border/50 h-11 w-full resize-none rounded-3xl border py-2.5 pr-22 pl-4 text-xs leading-normal transition-all outline-none focus:ring-3 sm:h-12 sm:pr-24 sm:text-sm md:h-13 md:py-3 md:text-base"
              ></textarea>

              <div
                class="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1 sm:right-3.5 sm:gap-1.5"
              >
                <!-- Attachment Button -->
                <button
                  type="button"
                  @click="triggerFileInput"
                  class="text-foreground/40 hover:text-primary hover:bg-foreground/5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors sm:h-9 sm:w-9"
                  title="Attach files (max 15MB)"
                >
                  <Icon
                    name="solar:paperclip-linear"
                    class="text-xl sm:text-2xl"
                  />
                </button>

                <!-- Send Button -->
                <button
                  type="button"
                  @click="sendMessage"
                  class="bg-primary hover:bg-primary/90 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white shadow-sm transition-all active:scale-90 sm:h-9 sm:w-9"
                  title="Send message"
                >
                  <Icon
                    name="material-symbols:send-rounded"
                    class="text-lg sm:text-xl"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
        <!-- End Chat Body Container -->
      </div>

      <!-- Desktop Inline User Details Sidebar (xl:flex) -->
      <div
        v-if="showUserDetails"
        class="hidden h-full shrink-0 xl:flex"
      >
        <AppChatUserDetailsSidebar
          :user-uuid="otherPersonUuid"
          :conversation-uuid="conversationUuid"
          :other-person-name="otherPersonName"
          :other-person-avatar="otherPersonAvatar"
          :messages="allMessages"
          :active-appointment="activeAppointment"
          :pending-appointment="pendingAppointmentForConversation"
          :inline="true"
          @close="showUserDetails = false"
          @schedule-appointment="openScheduleFromSidebar"
          @reschedule-appointment="openRescheduleFromSidebar"
          @open-appointment="handleOpenAppointment"
          @view-record="handleViewRecord"
          @search="openSearchFromSidebar"
          @delete-conversation="showDeleteConversationModal = true"
          @preview-image="handlePreviewImage"
        />
      </div>
    </div>

    <!-- Mobile & Tablet Slide-Over Sheet (when < xl) -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-x-full opacity-0"
      enter-to-class="transform translate-x-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-x-0 opacity-100"
      leave-to-class="transform translate-x-full opacity-0"
    >
      <div
        v-if="showUserDetails"
        class="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs xl:hidden"
        @click.self="showUserDetails = false"
      >
        <div class="bg-card flex h-full w-full flex-col overflow-hidden shadow-2xl sm:max-w-md">
          <AppChatUserDetailsSidebar
            :user-uuid="otherPersonUuid"
            :conversation-uuid="conversationUuid"
            :other-person-name="otherPersonName"
            :other-person-avatar="otherPersonAvatar"
            :messages="allMessages"
            :active-appointment="activeAppointment"
            :pending-appointment="pendingAppointmentForConversation"
            :inline="false"
            @close="showUserDetails = false"
            @schedule-appointment="openScheduleFromSidebar"
            @reschedule-appointment="openRescheduleFromSidebar"
            @open-appointment="handleOpenAppointment"
            @view-record="handleViewRecord"
            @search="openSearchFromSidebar"
            @delete-conversation="showDeleteConversationModal = true"
            @preview-image="handlePreviewImage"
          />
        </div>
      </div>
    </Transition>

    <!-- Context Menu & Modals (ClientOnly to prevent SSR Teleport hydration mismatch) -->
    <ClientOnly>
      <Teleport to="body">
        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <div
            v-if="contextMenu.visible"
            class="fixed z-200 w-44 overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl"
            :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
          >
            <button
              @click.stop="startEditing(contextMenu.message!)"
              class="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Icon
                name="solar:pen-2-linear"
                class="text-lg text-indigo-500"
              />
              Edit Message
            </button>
            <button
              @click.stop="confirmDeleteMessage(contextMenu.message!)"
              class="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <Icon
                name="solar:trash-bin-trash-linear"
                class="text-lg"
              />
              Delete Message
            </button>
          </div>
        </Transition>

        <!-- Delete Message Confirmation Modal -->
        <Transition name="modal">
          <div
            v-if="showDeleteMessageModal"
            class="fixed inset-0 z-999 flex items-center justify-center bg-black/50 p-4"
            @click.self="showDeleteMessageModal = false"
          >
            <div
              class="bg-card border-border modal-container w-full max-w-sm rounded-4xl border p-8 text-center shadow-2xl"
            >
              <div
                class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-500"
              >
                <Icon
                  name="solar:trash-bin-trash-bold"
                  size="40"
                />
              </div>
              <h3 class="mb-2 text-2xl font-bold">Delete Message</h3>
              <p class="text-foreground/60 mb-8 text-sm">
                Are you sure you want to delete this message?<br />
                This action cannot be undone.
              </p>
              <div class="flex flex-col gap-3">
                <AppButton
                  variant="solid"
                  class="border-none bg-red-500 text-white hover:bg-red-600"
                  @click="deleteMessage"
                >
                  Yes, Delete
                </AppButton>
                <AppButton
                  variant="unstyled"
                  class="bg-foreground/5 text-foreground/70 hover:bg-foreground/10 font-bold transition-all"
                  @click="showDeleteMessageModal = false"
                >
                  Cancel
                </AppButton>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Cancel Appointment Confirmation Modal -->
        <Transition name="modal">
          <div
            v-if="showCancelConfirm"
            class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
            @click.self="closeCancelModal"
          >
            <div
              class="modal-container bg-card border-border w-full max-w-md overflow-hidden rounded-3xl border p-8 shadow-2xl"
            >
              <div class="mb-6 flex flex-col items-center text-center">
                <div
                  class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100"
                >
                  <Icon
                    name="material-symbols:cancel-outline-rounded"
                    class="text-4xl text-red-600"
                  />
                </div>
                <h3 class="text-2xl font-bold">Cancel Appointment?</h3>
                <p class="text-foreground/60 mt-2 text-sm">
                  Are you sure you want to cancel this appointment? The patient will be notified
                  that the appointment was cancelled.
                </p>
              </div>

              <div class="flex flex-col gap-3">
                <AppButton
                  variant="solid"
                  class="bg-red-600 text-white hover:bg-red-700"
                  :disabled="isCancelling"
                  @click="cancelAppointmentDirectly"
                >
                  {{ isCancelling ? 'Cancelling...' : 'Yes, Cancel Appointment' }}
                </AppButton>
                <AppButton
                  variant="unstyled"
                  class="bg-foreground/5 text-foreground/70 hover:bg-foreground/10 font-bold transition-all"
                  @click="closeCancelModal"
                >
                  Go Back
                </AppButton>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Resolution Choice Modal (Overdue Appointment Resolution) -->
        <Transition name="modal">
          <div
            v-if="showResolveModal"
            class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
            @click.self="showResolveModal = false"
          >
            <div
              class="modal-container bg-card border-border w-full max-w-md overflow-hidden rounded-3xl border p-8 shadow-2xl"
            >
              <div class="mb-6 flex flex-col items-center text-center">
                <div
                  class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100"
                >
                  <Icon
                    name="material-symbols:warning-rounded"
                    class="text-4xl text-amber-600"
                  />
                </div>
                <h3 class="text-2xl font-bold">Resolve Past Appointment</h3>
                <p class="text-foreground/60 mt-2 text-sm">
                  This appointment date has passed. Please specify the outcome of this appointment.
                </p>
              </div>

              <div class="flex flex-col gap-3">
                <AppButton
                  variant="solid"
                  class="flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
                  :disabled="isCompleting || isCancelling"
                  @click="completeAppointment"
                >
                  <Icon
                    name="material-symbols:check-circle-rounded"
                    class="text-lg"
                  />
                  {{ isCompleting ? 'Marking Accomplished...' : 'Mark as Accomplished' }}
                </AppButton>
                <AppButton
                  variant="solid"
                  class="flex items-center justify-center gap-2 bg-red-600 text-white hover:bg-red-700"
                  :disabled="isCompleting || isCancelling"
                  @click="cancelAppointmentDirectly"
                >
                  <Icon
                    name="material-symbols:cancel-rounded"
                    class="text-lg"
                  />
                  {{ isCancelling ? 'Cancelling...' : 'Cancel Appointment' }}
                </AppButton>
                <AppButton
                  variant="unstyled"
                  class="bg-foreground/5 text-foreground/70 hover:bg-foreground/10 font-bold transition-all"
                  @click="showResolveModal = false"
                >
                  Decide Later
                </AppButton>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Delete Conversation Confirmation Modal -->
        <Transition name="modal">
          <div
            v-if="showDeleteConversationModal"
            class="fixed inset-0 z-999 flex items-center justify-center bg-black/50 p-4"
            @click.self="showDeleteConversationModal = false"
          >
            <div
              class="bg-card border-border modal-container w-full max-w-sm rounded-4xl border p-8 text-center shadow-2xl"
            >
              <div
                class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-500"
              >
                <Icon
                  name="solar:chat-round-dots-bold"
                  size="40"
                />
              </div>
              <h3 class="mb-2 text-2xl font-bold">Delete Conversation</h3>
              <p class="text-foreground/60 mb-8 text-sm">
                Are you sure you want to delete this entire conversation with
                <strong>{{ otherPersonName }}</strong
                >?<br />
                All messages will be permanently removed.
              </p>
              <div class="flex flex-col gap-3">
                <AppButton
                  variant="solid"
                  class="border-none bg-red-500 text-white hover:bg-red-600"
                  @click="deleteConversation"
                >
                  Yes, Delete Conversation
                </AppButton>
                <AppButton
                  variant="unstyled"
                  class="bg-foreground/5 text-foreground/70 hover:bg-foreground/10 font-bold transition-all"
                  @click="showDeleteConversationModal = false"
                >
                  Cancel
                </AppButton>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Complete Appointment Confirmation Modal -->
        <Transition name="modal">
          <div
            v-if="showCompleteConfirm"
            class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
            @click.self="showCompleteConfirm = false"
          >
            <div
              class="modal-container bg-card border-border w-full max-w-md overflow-hidden rounded-3xl border p-8 shadow-2xl"
            >
              <div class="mb-6 flex flex-col items-center text-center">
                <div
                  class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100"
                >
                  <Icon
                    name="material-symbols:check-circle-outline-rounded"
                    class="text-4xl text-indigo-600"
                  />
                </div>
                <h3 class="text-2xl font-bold">Complete Appointment?</h3>
                <p class="text-foreground/60 mt-2">
                  Are you sure you want to mark this appointment as completed? This will move it to
                  the patient's records.
                </p>
              </div>

              <div class="flex flex-col gap-3">
                <AppButton
                  variant="solid"
                  class="bg-indigo-600 text-white hover:bg-indigo-700"
                  :disabled="isCompleting"
                  @click="completeAppointment"
                >
                  {{ isCompleting ? 'Completing...' : 'Yes, Complete Appointment' }}
                </AppButton>
                <AppButton
                  variant="unstyled"
                  class="bg-foreground/5 text-foreground/70 hover:bg-foreground/10 font-bold transition-all"
                  @click="showCompleteConfirm = false"
                >
                  Cancel
                </AppButton>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- In-App Image Lightbox Modal -->
      <Teleport to="body">
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="previewImageUrl"
            class="fixed inset-0 z-100 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
            @click.self="previewImageUrl = null"
          >
            <div class="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl shadow-2xl">
              <button
                type="button"
                @click="previewImageUrl = null"
                class="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-all hover:bg-black/90 active:scale-95"
                title="Close preview"
              >
                <Icon
                  name="material-symbols:close-rounded"
                  class="text-xl"
                />
              </button>
              <img
                :src="previewImageUrl"
                alt="Shared preview"
                class="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
              />
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Schedule Modal (Desktop centered modal only, never mounted on mobile) -->
      <AppModalAppointmentSchedule
        v-if="showScheduleModal && !isMobile"
        :appointment-uuid="schedulingAppointmentUuid"
        :mode="scheduleMode"
        :inline="false"
        :patient="convData?.patient"
        :patient-name="otherPersonName"
        :patient-avatar="otherPersonAvatar"
        :patient-id="otherPersonPatientId"
        @close="handleScheduleModalClose"
        @scheduled="handleAppointmentScheduled"
      />

      <!-- Patient Reschedule Modal (Desktop centered modal only, never mounted on mobile) -->
      <PatientSideComponentsRescheduleModal
        v-if="rescheduleModalAppt && !isMobile"
        :appointment="rescheduleModalAppt"
        :inline="false"
        @close="rescheduleModalAppt = null"
        @requested="onRescheduleRequested"
      />

      <!-- Patient Consultation Booking Modal -->
      <PatientSideComponentsBookAppointmentModal
        v-if="!isDoctorUser"
        v-model="showPatientBookModal"
        :doctor="chatPartnerDoctor"
        @booked="handlePatientBookedFromChat"
      />

      <!-- Reschedule Accept Confirmation Modal -->
      <AppModalConfirmation
        v-model="showAcceptConfirmModal"
        title="Accept Reschedule?"
        description="Are you sure you want to accept this proposed appointment schedule? The appointment date and time will be officially updated."
        confirm-text="Yes, Accept Schedule"
        cancel-text="Go Back"
        confirm-variant="solid"
        icon="material-symbols:check-circle-rounded"
        icon-color="primary"
        :loading="isAcceptingReschedule"
        @confirm="confirmAcceptReschedule"
        @cancel="closeAcceptModal"
      />

      <!-- Patient Direct Booking Confirmation Modal -->
      <AppModalConfirmation
        v-model="showPatientDirectBookingModal"
        title="Request Clinical Appointment"
        :description="`Would you like to request an appointment with ${otherPersonName}? This submits a consultation booking request directly without attaching any skin scans.`"
        confirm-text="Request Appointment"
        cancel-text="Cancel"
        confirm-variant="solid"
        icon="solar:calendar-add-bold"
        icon-color="primary"
        :loading="isDirectBooking"
        @confirm="confirmPatientDirectBooking"
        @cancel="showPatientDirectBookingModal = false"
      />

      <!-- In-Chat Patient Records Modal -->
      <Teleport to="body">
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="showPatientRecordsModal"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
            @click.self="closePatientRecordsModal"
          >
            <div
              class="bg-card text-foreground border-border/80 relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border shadow-2xl"
            >
              <!-- Modal Header -->
              <div
                class="border-border/60 flex items-center justify-between border-b px-5 py-4 sm:px-6"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-xs"
                  >
                    <Icon
                      name="solar:folder-with-files-bold"
                      class="text-xl"
                    />
                  </div>
                  <div>
                    <h3 class="text-foreground text-base font-bold tracking-tight sm:text-lg">
                      {{ otherPersonName ? `${otherPersonName}'s Records` : 'Patient Records' }}
                    </h3>
                    <p class="text-foreground/60 text-xs">
                      Consultation notes, AI diagnoses, and clinical findings
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  @click="closePatientRecordsModal"
                  class="text-foreground/50 hover:text-foreground hover:bg-foreground/5 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                  title="Close"
                >
                  <Icon
                    name="material-symbols:close-rounded"
                    class="text-xl"
                  />
                </button>
              </div>

              <!-- Modal Body -->
              <div class="custom-scrollbar flex-1 overflow-y-auto p-5 sm:p-6">
                <!-- Loading State -->
                <div
                  v-if="isLoadingPatientRecords"
                  class="flex flex-col items-center justify-center py-12 text-center"
                >
                  <Icon
                    name="svg-spinners:ring-resize"
                    class="text-primary text-3xl"
                  />
                  <p class="text-foreground/60 mt-3 text-xs font-semibold">
                    Loading clinical records...
                  </p>
                </div>

                <!-- Empty State -->
                <div
                  v-else-if="patientRecordsList.length === 0"
                  class="bg-foreground/5 flex flex-col items-center justify-center rounded-2xl p-8 text-center"
                >
                  <div
                    class="bg-foreground/10 text-foreground/50 flex h-12 w-12 items-center justify-center rounded-full"
                  >
                    <Icon
                      name="solar:folder-open-linear"
                      class="text-2xl"
                    />
                  </div>
                  <h4 class="text-foreground mt-3 text-sm font-bold">No Clinical Records Found</h4>
                  <p class="text-foreground/60 mt-1 max-w-sm text-xs">
                    No past consultations or completed diagnostic scans recorded for this patient
                    yet.
                  </p>
                  <button
                    type="button"
                    @click="goToFullRecordsPage"
                    class="bg-primary/10 text-primary hover:bg-primary/20 mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors"
                  >
                    <span>View System Records Directory</span>
                    <Icon
                      name="solar:arrow-right-up-linear"
                      class="text-xs"
                    />
                  </button>
                </div>

                <!-- Records List -->
                <div
                  v-else
                  class="space-y-3"
                >
                  <div
                    v-for="record in patientRecordsList"
                    :key="record.id || record.uuid"
                    @click="openFullRecord(record)"
                    class="group border-border/80 bg-foreground/5 hover:border-primary/50 hover:bg-primary/5 flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-4 transition-all hover:shadow-sm"
                  >
                    <div class="flex items-start gap-3">
                      <div
                        class="bg-primary/10 text-primary mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-xs"
                      >
                        <Icon
                          name="solar:document-text-bold"
                          class="text-lg"
                        />
                      </div>
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <h4
                            class="text-foreground group-hover:text-primary text-sm font-bold transition-colors"
                          >
                            {{ record.label || record.title || 'Clinical Consultation' }}
                          </h4>
                          <span
                            class="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase dark:text-emerald-400"
                          >
                            Completed
                          </span>
                        </div>
                        <p class="text-foreground/60 mt-1 text-xs">
                          {{ formatRecordDate(record.created_at) }}
                          <template
                            v-if="record.clinical_note?.doctor?.name || record.doctor?.name"
                          >
                            • Attending: Dr.
                            {{ record.clinical_note?.doctor?.name || record.doctor?.name }}
                          </template>
                        </p>
                        <p
                          v-if="
                            record.clinical_note?.final_diagnosis ||
                            record.clinical_note?.differential_diagnosis
                          "
                          class="text-foreground/80 mt-1.5 line-clamp-2 text-xs font-medium"
                        >
                          <span class="text-foreground/50">Diagnosis: </span>
                          {{
                            record.clinical_note?.final_diagnosis ||
                            record.clinical_note?.differential_diagnosis
                          }}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      class="text-primary group-hover:bg-primary/10 shrink-0 rounded-lg p-2 text-xs font-bold transition-colors"
                      title="View Clinical Report"
                    >
                      <Icon
                        name="solar:eye-bold"
                        class="text-lg"
                      />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Modal Footer -->
              <div
                class="border-border/60 bg-foreground/2 flex items-center justify-between border-t px-5 py-3 sm:px-6"
              >
                <span class="text-foreground/60 text-xs font-medium">
                  {{ patientRecordsList.length }} record(s) found
                </span>
                <button
                  type="button"
                  @click="goToFullRecordsPage"
                  class="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-bold transition-colors"
                >
                  <span>Open in Records Management</span>
                  <Icon
                    name="solar:arrow-right-up-linear"
                    class="text-xs"
                  />
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Individual Clinical Record Modal -->
      <Teleport to="body">
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showIndividualRecordModal && selectedPatientRecord"
            class="fixed inset-0 z-999 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs transition-all"
            @click.self="closeIndividualRecordModal"
          >
            <div
              class="modal-container bg-card relative flex max-h-[90vh] w-[95vw] flex-col overflow-hidden rounded-3xl shadow-2xl md:w-full md:max-w-4xl md:rounded-4xl lg:max-w-5xl"
            >
              <AppModalRecord
                :record="selectedPatientRecord"
                :role="userRole === 'patient' ? 'patient' : 'doctor'"
                @close="closeIndividualRecordModal"
              />
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Patient Questionnaire Answers Modal (Doctor View) -->
      <AppModalPatientQuestionnaireAnswersModal
        v-model="showPatientQuestionnaireModal"
        :diagnosis="selectedDiagnosisForQuestionnaire"
        @update:model-value="handleClosePatientQuestionnaireModal"
      />
    </ClientOnly>
  </div>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--primary), 0.1);
    border-radius: 10px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(var(--primary), 0.2);
  }

  .message-enter-active {
    transition: all 0.3s ease;
  }
  .message-enter-from {
    opacity: 0;
    transform: translateY(20px);
  }

  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
  .modal-enter-active .modal-container {
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .modal-leave-active .modal-container {
    transition: all 0.2s ease-in;
  }
  .modal-enter-from .modal-container {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  .modal-leave-to .modal-container {
    opacity: 0;
    transform: scale(0.95);
  }

  @keyframes messengerDotBounce {
    0%,
    80%,
    100% {
      transform: translateY(0);
      opacity: 0.45;
    }
    40% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }

  .typing-dot {
    animation: messengerDotBounce 1.3s infinite ease-in-out both;
  }

  .typing-dot:nth-child(1) {
    animation-delay: -0.32s;
  }

  .typing-dot:nth-child(2) {
    animation-delay: -0.16s;
  }

  .typing-dot:nth-child(3) {
    animation-delay: 0s;
  }
</style>
