<script setup lang="ts">
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { conversationService } from '~/api/conversation/ConversationService'
  import { messageService } from '~/api/message/MessageService'
  import { userService } from '~/api/user/UserService'

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

  const { data: currentUserResp } = await userService.useShow(() => userUuidCookie.value as string, {
    key: `chatUser-${userUuidCookie.value}`
  })
  const currentUserData = computed(() => (currentUserResp.value as any)?.data ?? currentUserResp.value)

  const conversationDoctorUuid = ref<string | null>(null)

  // Fetch conversation data if on secretary side to obtain the doctor's UUID
  if ((userRole.value === 'secretary' || route.path.toLowerCase().startsWith('/secretary')) && props.conversationUuid) {
    const { data: convResp } = await conversationService.useShow(() => props.conversationUuid)
    const convData = computed(() => (convResp.value as any)?.data ?? convResp.value)
    watch(convData, (val) => {
      if (val?.doctor?.id) {
        conversationDoctorUuid.value = val.doctor.id
      }
    }, { immediate: true })
  }

  // When logged in as secretary, the sender in conversations is attributed to their doctor's UUID
  const effectiveUserUuid = computed(() => {
    const isSec = userRole.value === 'secretary' || route.path.toLowerCase().startsWith('/secretary')
    if (isSec) {
      const docUuidFromProfile = currentUserData.value?.doctor_uuid || currentUserData.value?.doctor?.uuid || currentUserData.value?.doctor_id
      return doctorUuidCookie.value || docUuidFromProfile || conversationDoctorUuid.value || userUuidCookie.value
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
  
  let pollingInterval: any = null
  let isUserNearBottom = true
  const cacheKey = computed(() => `chat_history_${props.conversationUuid}`)

  // Context menu & modal states
  const contextMenu = ref<{ visible: boolean; x: number; y: number; message: Message | null }>({
    visible: false, x: 0, y: 0, message: null
  })
  const editingMessageId = ref<string | null>(null)
  const editingMessageText = ref('')
  const showDeleteMessageModal = ref(false)
  const messageToDelete = ref<Message | null>(null)
  const showDeleteConversationModal = ref(false)

  const { getStorageUrl } = useStorage()
  const { removeFromPriority } = usePriorityList()

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
        alert(`${file.name} is too large. Maximum size is 15MB.`)
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

  // --- Scheduling ---
  const showScheduleModal = ref(false)
  const schedulingAppointmentUuid = ref('')

  /** Extract the UUID embedded in appointment system messages */
  const extractAppointmentUuid = (message: string, type: 'REQUEST' | 'SCHEDULED' | 'DECLINED' = 'REQUEST'): string => {
    // Handle both old [TAG:UUID] and new [TAG:UUID:DIAG_UUID] formats
    const regex = new RegExp(`\\[(APPOINTMENT_${type}|DIAGNOSIS_ONLY):([a-f0-9-]+)(?::[a-f0-9-]+)?\\]`)
    const match = message.match(regex)
    return match ? match[2] : ''
  }

  /** Extract UUID from an APPOINTMENT_SCHEDULED system message. */
  const extractScheduledAppointmentUuid = (message: string): string => {
    const match = message.match(/\[APPOINTMENT_SCHEDULED:([a-f0-9-]+)\]/)
    return match ? match[1] : ''
  }

  /** Returns true when the patient can request a reschedule directly from the chat bubble. */
  const canPatientRequestReschedule = (message: string): boolean => {
    if (userRole.value?.toLowerCase() !== 'patient') return false
    const uuid = extractScheduledAppointmentUuid(message)
    if (!uuid) return false
    return activeAppointment.value?.id === uuid && activeAppointment.value?.status === 'scheduled'
  }

  const openScheduleModal = (message: string) => {
    const uuid = extractAppointmentUuid(message, 'REQUEST')
    if (!uuid) return
    schedulingAppointmentUuid.value = uuid
    showScheduleModal.value = true
  }

  const declineAppointment = async (message: string) => {
    const uuid = extractAppointmentUuid(message, 'REQUEST')
    if (!uuid) return
    try {
      await appointmentService.update(uuid, { status: 'declined' })
      fetchMessages(1)
    } catch (e) {
      console.error(e)
    }
  }

  const isAppointmentHandled = (message: string) => {
    const uuid = extractAppointmentUuid(message, 'REQUEST')
    if (!uuid) return true
    return allMessages.value.some(m => 
      m.message.includes(`[APPOINTMENT_SCHEDULED:${uuid}]`) || 
      m.message.includes(`[APPOINTMENT_DECLINED:${uuid}]`) ||
      m.message.includes(`[APPOINTMENT_CANCELLED:${uuid}]`)
    )
  }

  // --- Active Appointment (Top Bar) ---
  const { appointments, pendingAppointments, fetchAppointments } = useAppointments()
  const activeAppointment = computed(() => {
    return appointments.value.find(a => a.conversation_uuid === props.conversationUuid && (a.status === 'scheduled' || a.status === 'reschedule_proposed' || a.status === 'reschedule_requested'))
  })

  /**
   * The pending appointment for this specific conversation (if any).
   * Shown to the doctor as a top-of-window banner.
   */
  const pendingAppointmentForConversation = computed(() => {
    return pendingAppointments.value.find(a => a.conversation_uuid === props.conversationUuid) ?? null
  })

  const scheduleMode = ref<'schedule' | 'reschedule'>('schedule')

  const openScheduleModalFromPending = (appt: any) => {
    schedulingAppointmentUuid.value = appt.id
    scheduleMode.value = 'schedule'
    showScheduleModal.value = true
  }

  const openRescheduleModal = () => {
    if (!activeAppointment.value) return
    schedulingAppointmentUuid.value = activeAppointment.value.id
    scheduleMode.value = 'reschedule'
    showScheduleModal.value = true
  }

  const handleScheduleModalClose = () => {
    showScheduleModal.value = false
    scheduleMode.value = 'schedule'
  }

  const acceptReschedule = async (uuid: string) => {
    try {
      await appointmentService.acceptReschedule(uuid, {})
      fetchMessages(1)
      fetchAppointments()
    } catch (e) {
      console.error(e)
    }
  }

  const cancelAppointment = async (uuid: string) => {
    try {
      await appointmentService.update(uuid, { status: 'declined' })
      fetchMessages(1)
      fetchAppointments()
    } catch (e) {
      console.error(e)
    }
  }

  const requestReschedule = async (uuid: string) => {
    try {
      await appointmentService.update(uuid, { status: 'reschedule_requested' })
      fetchMessages(1)
      fetchAppointments()
    } catch (e) {
      console.error(e)
    }
  }

  const isRescheduleProposedByMe = (uuid: string) => {
    const msg = [...allMessages.value].reverse().find(m => m.message.includes(`[APPOINTMENT_RESCHEDULE_PROPOSED:${uuid}:`))
    return msg ? msg.sender?.id === effectiveUserUuid.value : false
  }

  /** Decline a pending appointment directly from the banner. */
  const declineAppointmentFromPending = async (appt: any) => {
    try {
      await appointmentService.update(appt.id, { status: 'declined' })
      fetchMessages(1)
      fetchAppointments()
    } catch (e) {
      console.error(e)
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
      return new Date(`${activeAppointment.value.date}T${activeAppointment.value.time}`) < new Date()
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
    } catch (e) {
      console.error(e)
    } finally {
      isCompleting.value = false
    }
  }

  const cancelAppointmentDirectly = async () => {
    if (!activeAppointment.value) return
    isCancelling.value = true
    try {
      const cancelledAppointment = activeAppointment.value
      await appointmentService.update(cancelledAppointment.id, { status: 'declined' })
      removeFromPriority(cancelledAppointment.id)
      showCancelConfirm.value = false
      showResolveModal.value = false
      fetchAppointments()
      fetchMessages(1)
    } catch (e) {
      console.error(e)
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
            nm => nm && typeof nm === 'object' && nm.id && !allMessages.value.find(am => am && am.id === nm.id)
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
      (m) => m && !m.is_read && m.sender?.id !== effectiveUserUuid.value
    )
    for (const msg of unread) {
      try {
        await messageService.update(msg.id, { is_read: true })
        msg.is_read = true // Update locally
      } catch (e) {}
    }
  }

  const startPolling = () => {
    if (pollingInterval) clearInterval(pollingInterval)
    pollingInterval = setInterval(async () => {
      // Only poll the first page for new messages
      await fetchMessages(1)
      await markUnreadMessages()
    }, 3000)
  }

  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
  }

  watch(
    () => props.conversationUuid,
    (newUuid, oldUuid) => {
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
    
    startPolling()
    document.addEventListener('click', closeContextMenu)
  })

  onUnmounted(() => {
    stopPolling()
    document.removeEventListener('click', closeContextMenu)
  })

  // --- Send Message ---
  const sendMessage = async () => {
    const text = messageTerm.value.trim()
    if (!text && selectedFiles.value.length === 0) return

    const filesToSend = [...selectedFiles.value]
    messageTerm.value = ''
    selectedFiles.value = []

    try {
      const response = await conversationService.sendMessage(props.conversationUuid, text, filesToSend)
      // Add immediately to UI for snappiness
      if (response) {
        allMessages.value.push(response)
        scrollToBottom()
        saveToCache()
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

  const closeContextMenu = () => { contextMenu.value.visible = false }

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
    if (!editingMessageId.value) return
    const trimmed = editingMessageText.value.trim()
    if (!trimmed) return

    try {
      const response = await messageService.update(editingMessageId.value, { message: trimmed })
      // Update locally
      const idx = allMessages.value.findIndex(m => m && m.id === editingMessageId.value)
      if (idx !== -1 && response) allMessages.value[idx] = response
      cancelEditing()
      saveToCache()
    } catch (e) {}
  }

  const handleEditKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() }
    if (e.key === 'Escape') cancelEditing()
  }

  const confirmDeleteMessage = (msg: Message) => {
    messageToDelete.value = msg
    showDeleteMessageModal.value = true
    closeContextMenu()
  }

  const deleteMessage = async () => {
    if (!messageToDelete.value) return
    try {
      await messageService.delete(messageToDelete.value.id)
      allMessages.value = allMessages.value.filter(m => m && m.id !== messageToDelete.value!.id)
      saveToCache()
    } catch (e) {
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
    // Standard comparison to check if message was updated after creation
    return msg.created_at !== msg.updated_at
  }
</script>

<template>
  <div class="bg-card flex h-full flex-col">
    <!-- Header -->
    <div class="bg-card border-border flex items-center justify-between border-b px-3 py-3 md:px-8 md:py-6">
      <div class="flex items-center gap-4">
        <NuxtLink
          :to="$route.path.replace(/\/[^/]+$/, '')"
          class="text-foreground/40 hover:text-foreground mr-1 flex items-center transition-colors md:hidden"
        >
          <Icon name="heroicons:arrow-left-20-solid" class="text-2xl" />
        </NuxtLink>
        <div class="bg-muted h-12 w-12 overflow-hidden rounded-full">
          <img
            v-if="otherPersonAvatar"
            :src="otherPersonAvatar"
            :alt="otherPersonName"
            class="h-full w-full object-cover"
          />
          <div
            v-else
            class="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-lg font-bold uppercase"
          >
            {{ otherPersonName.charAt(0) }}
          </div>
        </div>
        <h2 class="text-foreground text-lg md:text-2xl font-bold truncate max-w-[150px] md:max-w-none">{{ otherPersonName }}</h2>
      </div>

      <!-- Header actions menu -->
      <AppButton
        variant="unstyled"
        size="unstyled"
        rounded="unstyled"
        @click="showDeleteConversationModal = true"
        class="text-foreground/30 hover:text-destructive cursor-pointer rounded-full p-2 transition-colors hover:bg-red-50"
      >
        <Icon name="solar:trash-bin-trash-linear" class="text-2xl" />
      </AppButton>
    </div>

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
        class="border-b border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-6 py-3"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
              <Icon name="material-symbols:calendar-add-on-rounded" class="text-lg text-indigo-600" />
            </div>
            <div>
              <p class="text-sm font-black text-indigo-900">New Appointment Request</p>
              <p class="text-xs font-medium text-indigo-600">
                {{ pendingAppointmentForConversation.doctor }} is requesting an appointment
                <span v-if="pendingAppointmentForConversation.info && pendingAppointmentForConversation.info !== 'General Appointment'">
                  for <span class="font-bold">{{ pendingAppointmentForConversation.info }}</span>
                </span>
                — review the chat for details.
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button
              @click="openScheduleModalFromPending(pendingAppointmentForConversation)"
              class="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Icon name="material-symbols:check-circle-outline-rounded" class="text-sm" />
              Accept &amp; Schedule
            </button>
            <button
              @click="declineAppointmentFromPending(pendingAppointmentForConversation)"
              class="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-200 transition-all hover:bg-indigo-50 active:scale-95"
            >
              <Icon name="material-symbols:cancel-outline-rounded" class="text-sm" />
              Decline
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Active Appointment Bar (scheduled appointment) -->
    <div v-if="activeAppointment" 
      class="border-b p-4 flex flex-col transition-all"
      :class="[
        isOverdue
          ? 'bg-red-50 border-red-200'
          : isToday(activeAppointment.date) 
            ? 'bg-amber-50 border-amber-100' 
            : 'bg-indigo-50 border-indigo-100'
      ]"
    >
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-full"
            :class="[
              isOverdue
                ? 'bg-red-100'
                : isToday(activeAppointment.date) ? 'bg-amber-100' : 'bg-indigo-100'
            ]"
          >
            <Icon 
              :name="isOverdue ? 'material-symbols:warning-rounded' : isToday(activeAppointment.date) ? 'material-symbols:alarm-on-outline-rounded' : 'material-symbols:calendar-clock-outline-rounded'" 
              class="text-xl"
              :class="isOverdue ? 'text-red-600' : isToday(activeAppointment.date) ? 'text-amber-600' : 'text-indigo-600'"
            />
          </div>
          <div>
            <p class="text-sm font-bold"
              :class="[
                isOverdue
                  ? 'text-red-900'
                  : isToday(activeAppointment.date) ? 'text-amber-900' : 'text-indigo-900'
              ]"
            >
              {{ isOverdue ? 'Overdue Appointment — Action Needed' : isToday(activeAppointment.date) ? 'Appointment Today!' : 'Upcoming Appointment' }}
            </p>
            <p class="text-xs font-medium"
              :class="[
                isOverdue
                  ? 'text-red-700'
                  : isToday(activeAppointment.date) ? 'text-amber-700' : 'text-indigo-700'
              ]"
            >
              {{ isOverdue ? `Was scheduled for ${activeAppointment.date} at ${activeAppointment.time}. Please mark as Accomplished or Cancelled.` : isToday(activeAppointment.date) ? 'Your appointment is scheduled for today' : activeAppointment.date + ' at ' + activeAppointment.time }}
            </p>
          </div>
        </div>
        
        <div v-if="userRole?.toLowerCase() === 'doctor'" class="flex flex-wrap gap-2">
          <button
            @click="showCompleteConfirm = true"
            class="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
          >
            <Icon name="material-symbols:check-circle-rounded" class="text-sm" />
            Mark as Accomplished
          </button>
          <button
            @click="showCancelConfirm = true"
            class="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-red-600 shadow-sm ring-1 ring-red-200 transition-all hover:bg-red-50 active:scale-95"
          >
            <Icon name="material-symbols:cancel-rounded" class="text-sm" />
            Cancel
          </button>
          <button
            @click="openRescheduleModal"
            class="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-200 transition-all hover:bg-indigo-50 active:scale-95"
          >
            <Icon name="material-symbols:edit-calendar-rounded" class="text-sm" />
            Reschedule
          </button>
        </div>
        <div v-else-if="userRole?.toLowerCase() === 'patient' && activeAppointment.status === 'scheduled'" class="flex gap-2">
          <AppButton @click="requestReschedule(activeAppointment.id)" class="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2">
            <Icon name="material-symbols:edit-calendar-rounded" class="text-lg" />
            Request Reschedule
          </AppButton>
        </div>
      </div>

      <!-- Action Bar below current appointment when status is reschedule_proposed or reschedule_requested -->
      <div v-if="activeAppointment.status === 'reschedule_proposed' || activeAppointment.status === 'reschedule_requested'" class="mt-4 p-3 bg-white/60 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border border-amber-200 shadow-sm backdrop-blur-sm">
        
        <!-- Case 1: Status is reschedule_proposed -->
        <template v-if="activeAppointment.status === 'reschedule_proposed'">
          <template v-if="!isRescheduleProposedByMe(activeAppointment.id)">
            <div class="flex items-center gap-2 text-amber-800 text-sm font-bold shrink-0">
              <Icon name="material-symbols:info" class="text-lg shrink-0" />
              New schedule proposed by {{ userRole?.toLowerCase() === 'doctor' ? 'patient' : 'doctor' }}
            </div>
            <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <AppButton @click="acceptReschedule(activeAppointment.id)" class="bg-green-600 text-white hover:bg-green-700 px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-sm w-full sm:w-auto justify-center">Accept</AppButton>
              
              <!-- If patient is responding to doctor, they Request Reschedule. If doctor is responding to patient, they can Propose Another (open modal) -->
              <AppButton v-if="userRole?.toLowerCase() === 'patient'" @click="requestReschedule(activeAppointment.id)" class="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-sm w-full sm:w-auto justify-center">Request Reschedule</AppButton>
              <AppButton v-else @click="openRescheduleModal" class="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-sm w-full sm:w-auto justify-center">Propose Another Date</AppButton>
              
              <AppButton @click="cancelAppointment(activeAppointment.id)" class="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-sm w-full sm:w-auto justify-center">Cancel</AppButton>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center gap-2 text-amber-800 text-sm font-bold">
              <Icon name="material-symbols:hourglass-top-rounded" class="text-lg animate-pulse shrink-0" />
              Waiting for {{ userRole?.toLowerCase() === 'doctor' ? 'patient' : 'doctor' }} to confirm your proposed schedule...
            </div>
          </template>
        </template>

        <!-- Case 2: Status is reschedule_requested -->
        <template v-else-if="activeAppointment.status === 'reschedule_requested'">
          <template v-if="userRole?.toLowerCase() === 'doctor'">
            <div class="flex items-center gap-2 text-amber-800 text-sm font-bold shrink-0">
              <Icon name="material-symbols:info" class="text-lg shrink-0" />
              Patient requested a new schedule
            </div>
            <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <AppButton @click="openRescheduleModal" class="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-sm w-full sm:w-auto justify-center">Choose Another Date</AppButton>
              <AppButton @click="cancelAppointment(activeAppointment.id)" class="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-sm w-full sm:w-auto justify-center">Cancel</AppButton>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center gap-2 text-amber-800 text-sm font-bold">
              <Icon name="material-symbols:hourglass-top-rounded" class="text-lg animate-pulse shrink-0" />
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
      <div v-if="isFetchingOlder" class="flex justify-center py-2">
        <Icon name="svg-spinners:ring-resize" class="text-primary text-2xl" />
      </div>

      <!-- Loading skeleton (Initial) -->
      <div v-if="pending && allMessages.length === 0" class="flex flex-1 items-center justify-center">
        <div class="text-foreground/20 text-center">
          <Icon name="svg-spinners:ring-resize" class="mx-auto mb-4 text-5xl" />
          <p class="text-lg font-medium">Loading messages...</p>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="allMessages.length === 0"
        class="flex flex-1 items-center justify-center"
      >
        <div class="text-foreground/20 text-center">
          <Icon name="solar:chat-round-line-linear" class="mb-4 text-8xl" />
          <p class="text-xl font-bold">No messages yet</p>
          <p class="mt-1 text-sm">Send a message to start the conversation</p>
        </div>
      </div>

      <!-- Message bubbles -->
      <div class="flex flex-col gap-4">
        <div
          v-for="msg in allMessages.filter(m => m && m.id)"
          :key="msg.id"
          class="group flex items-end gap-3"
          :class="msg.sender?.id === effectiveUserUuid ? 'flex-row-reverse' : 'flex-row'"
          @contextmenu="openContextMenu($event, msg)"
        >
          <div class="border-border/50 h-10 w-10 shrink-0 overflow-hidden rounded-full border">
            <img
              v-if="msg.sender?.avatar"
              :src="msg.sender.avatar"
              :alt="msg.sender?.name"
              class="h-full w-full object-cover"
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
            <div v-if="editingMessageId === msg.id" class="flex flex-col gap-2">
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
              <div v-if="msg.message.includes('[APPOINTMENT_REQUEST:') || msg.message.includes('[DIAGNOSIS_ONLY:')">
                <div class="mb-2">
                  <Icon 
                    :name="msg.message.includes('[APPOINTMENT_REQUEST:') ? 'material-symbols:calendar-month-rounded' : 'material-symbols:diagnosis-outline-rounded'" 
                    class="text-3xl text-indigo-500 mb-2" 
                  />
                  <p class="font-bold text-lg">
                    {{ msg.message.includes('[APPOINTMENT_REQUEST:') ? 'Appointment Request' : 'Clinical Findings' }}
                  </p>
                  <p class="text-sm opacity-80">{{ msg.message.replace(/\[(APPOINTMENT_REQUEST|DIAGNOSIS_ONLY):.*?:.*?\]/g, '').trim() || (msg.message.includes('[APPOINTMENT_REQUEST:') ? 'A diagnosis was shared.' : 'Additional findings shared.') }}</p>
                </div>

                <!-- Diagnosis Details -->
                <div v-if="msg.appointment_data" class="bg-card/50 mt-3 rounded-2xl border border-border/50 p-4 shadow-sm backdrop-blur-sm">
                  <div class="flex gap-4">
                    <img 
                      :src="getStorageUrl(msg.appointment_data.diagnosis.image_path)" 
                      class="h-24 w-24 rounded-xl object-cover border border-border shadow-sm"
                      alt="Diagnosis scan"
                    />
                    <div class="flex flex-col justify-center gap-0.5">
                      <p class="text-[10px] font-black uppercase tracking-widest text-indigo-500">Clinical Findings</p>
                      <h4 class="text-lg font-black leading-tight text-foreground">{{ msg.appointment_data.diagnosis.label }}</h4>
                      <div class="flex flex-col gap-0.5 mt-1">
                        <p class="text-xs font-bold text-foreground/70">
                          {{ msg.appointment_data.diagnosis.patient_name }}
                        </p>
                        <p class="text-[11px] font-medium text-foreground/50">
                          {{ msg.appointment_data.diagnosis.patient_age }} years old • {{ msg.appointment_data.diagnosis.date }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Only show buttons for actual Appointment Requests and only if no appointment is active -->
                <div v-if="userRole?.toLowerCase() === 'doctor' && msg.message.includes('[APPOINTMENT_REQUEST:') && !isAppointmentHandled(msg.message)" class="flex gap-2 mt-4">
                  <button @click.prevent="openScheduleModal(msg.message)" class="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all active:scale-95">
                    Accept & Schedule
                  </button>
                  <button @click.prevent="declineAppointment(msg.message)" class="bg-foreground/10 px-5 py-2 rounded-xl text-sm font-bold hover:bg-foreground/20 transition-all active:scale-95">
                    Decline
                  </button>
                </div>
              </div>
              <div v-else-if="msg.message.includes('[APPOINTMENT_SCHEDULED:')">
                <div class="flex flex-col">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="bg-green-100 p-2 rounded-full">
                      <Icon name="material-symbols:check-circle-rounded" class="text-xl text-green-600" />
                    </div>
                    <span class="font-bold text-green-700">Appointment Confirmed</span>
                  </div>
                  <p class="text-sm opacity-90" v-html="msg.message.replace(/\[APPOINTMENT_SCHEDULED:.*?\]/g, '').trim()"></p>
                  <button
                    v-if="canPatientRequestReschedule(msg.message)"
                    @click.prevent="requestReschedule(extractScheduledAppointmentUuid(msg.message))"
                    class="mt-3 flex items-center gap-1.5 self-start rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700 shadow-sm transition-all hover:bg-indigo-50 active:scale-95"
                  >
                    <Icon name="material-symbols:edit-calendar-rounded" class="text-sm" />
                    Request Reschedule
                  </button>
                </div>
              </div>
              <div v-else-if="msg.message.includes('[APPOINTMENT_DECLINED:')">
                <div class="flex flex-col">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="bg-red-100 p-2 rounded-full">
                      <Icon name="material-symbols:cancel-rounded" class="text-xl text-red-500" />
                    </div>
                    <span class="font-bold text-red-600">Appointment Request Declined</span>
                  </div>
                  <p class="text-sm opacity-90">{{ msg.message.replace(/\[APPOINTMENT_DECLINED:.*?\]/g, '').trim() }}</p>
                </div>
              </div>
              <div v-else-if="msg.message.includes('[APPOINTMENT_CANCELLED:')">
                <div class="flex flex-col">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="bg-amber-100 p-2 rounded-full">
                      <Icon name="material-symbols:event-busy-rounded" class="text-xl text-amber-600" />
                    </div>
                    <span class="font-bold text-amber-800">Appointment Cancelled</span>
                  </div>
                  <p class="text-sm opacity-90">{{ msg.message.replace(/\[APPOINTMENT_CANCELLED:.*?\]/g, '').trim() }}</p>
                </div>
              </div>
              <div v-else-if="msg.message.includes('[APPOINTMENT_COMPLETED:')">
                <div class="flex flex-col">
                  <div class="mb-2 flex items-center gap-2">
                    <div class="rounded-full bg-green-100 p-2">
                      <Icon name="material-symbols:check-circle-rounded" class="text-xl text-green-600" />
                    </div>
                    <span class="font-bold text-green-700">Appointment Completed</span>
                  </div>
                  <p class="text-sm opacity-90">{{ msg.message.replace(/\[APPOINTMENT_COMPLETED:.*?\]/g, '').trim() }}</p>
                </div>
              </div>
              <div v-else-if="msg.message.includes('[APPOINTMENT_RESCHEDULE_PROPOSED:')">
                <div class="flex flex-col">
                  <div class="mb-2 flex items-center gap-2">
                    <div class="rounded-full bg-amber-100 p-2">
                      <Icon name="material-symbols:edit-calendar-rounded" class="text-xl text-amber-600" />
                    </div>
                    <span class="font-bold text-amber-700">Reschedule Proposed</span>
                  </div>
                  <p class="text-sm opacity-90" v-html="msg.message.replace(/\[APPOINTMENT_RESCHEDULE_PROPOSED:.*?\]/g, '').trim()"></p>
                </div>
              </div>
              <div v-else-if="msg.message.includes('[APPOINTMENT_RESCHEDULE_REQUESTED:')">
                <div class="flex flex-col">
                  <div class="mb-2 flex items-center gap-2">
                    <div class="rounded-full bg-amber-100 p-2">
                      <Icon name="material-symbols:event-repeat-rounded" class="text-xl text-amber-600" />
                    </div>
                    <span class="font-bold text-amber-700">Reschedule Requested</span>
                  </div>
                  <p class="text-sm opacity-90" v-html="msg.message.replace(/\[APPOINTMENT_RESCHEDULE_REQUESTED:.*?\]/g, '').trim()"></p>
                </div>
              </div>
              <div v-else-if="msg.message.includes('[APPOINTMENT_RESCHEDULE_ACCEPTED:')">
                <div class="flex flex-col">
                  <div class="mb-2 flex items-center gap-2">
                    <div class="rounded-full bg-green-100 p-2">
                      <Icon name="material-symbols:check-circle-rounded" class="text-xl text-green-600" />
                    </div>
                    <span class="font-bold text-green-700">Reschedule Accepted</span>
                  </div>
                  <p class="text-sm opacity-90" v-html="msg.message.replace(/\[APPOINTMENT_RESCHEDULE_ACCEPTED:.*?\]/g, '').trim()"></p>
                </div>
              </div>
              <p
                v-else-if="msg.message"
                class="text-base leading-relaxed whitespace-pre-wrap"
              >{{ msg.message }}</p>

              <!-- Attachments Display -->
              <div v-if="msg.attachments && msg.attachments.length > 0" class="mt-3 flex flex-col gap-2">
                <div 
                  v-for="attachment in msg.attachments" 
                  :key="attachment.id"
                  class="group/attachment relative overflow-hidden rounded-xl border border-white/10"
                  :class="msg.sender?.id === effectiveUserUuid ? 'bg-white/10' : 'bg-black/5'"
                >
                  <!-- Image Preview -->
                  <div v-if="isImage(attachment.type)" class="max-w-xs">
                    <a :href="attachment.url" target="_blank">
                      <img 
                        :src="attachment.url" 
                        :alt="attachment.name"
                        class="h-auto w-full object-cover transition-transform group-hover/attachment:scale-105"
                      />
                    </a>
                  </div>
                  
                  <!-- File Link -->
                  <a 
                    v-else 
                    :href="attachment.url" 
                    target="_blank"
                    class="flex items-center gap-3 p-3 transition-colors hover:bg-white/5"
                  >
                    <div class="bg-primary/20 flex h-10 w-10 items-center justify-center rounded-lg">
                      <Icon 
                        :name="isPdf(attachment.type) ? 'solar:file-text-bold' : 'solar:document-bold'" 
                        class="text-xl"
                        :class="msg.sender?.id === effectiveUserUuid ? 'text-white' : 'text-primary'"
                      />
                    </div>
                    <div class="flex-1 overflow-hidden">
                      <p class="truncate text-xs font-bold" :class="msg.sender?.id === effectiveUserUuid ? 'text-white' : 'text-foreground'">
                        {{ attachment.name }}
                      </p>
                      <p class="text-[10px] opacity-60" :class="msg.sender?.id === effectiveUserUuid ? 'text-white' : 'text-foreground'">
                        {{ formatFileSize(attachment.size) }}
                      </p>
                    </div>
                    <Icon name="solar:download-minimalistic-linear" class="text-lg opacity-40" />
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
                <Icon name="solar:menu-dots-vertical-bold" class="text-foreground/30 hover:text-foreground/60 text-lg" />
              </button>
            </div>

            <span
              class="text-foreground/70 font-medium text-[11px]"
              :class="msg.sender?.id === effectiveUserUuid ? 'text-right' : 'text-left'"
            >
              {{ formatTime(msg.created_at) }}
              <span v-if="isEdited(msg)" class="italic"> · edited</span>
              <span v-if="msg.sender?.id === effectiveUserUuid && msg.is_read" class="ml-1">✓✓</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="py-2 px-3 md:p-8 md:pt-0 bg-card md:bg-transparent border-t md:border-0 border-border">
      <!-- File Preview Area -->
      <div v-if="selectedFiles.length > 0" class="mb-4 flex flex-wrap gap-3">
        <div 
          v-for="(file, index) in selectedFiles" 
          :key="index"
          class="bg-card border-border/50 relative flex items-center gap-3 rounded-2xl border p-3 pr-10 shadow-sm"
        >
          <div class="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
            <Icon 
              :name="isImage(file.type) ? 'solar:gallery-bold' : 'solar:document-bold'" 
              class="text-primary text-xl" 
            />
          </div>
          <div class="max-w-[150px] overflow-hidden">
            <p class="truncate text-xs font-bold text-foreground">{{ file.name }}</p>
            <p class="text-[10px] text-foreground/50">{{ formatFileSize(file.size) }}</p>
          </div>
          <button 
            @click="removeFile(index)"
            class="absolute top-2 right-2 text-foreground/30 hover:text-destructive transition-colors"
          >
            <Icon name="solar:close-circle-bold" class="text-lg" />
          </button>
        </div>
      </div>

      <div class="group relative flex items-end gap-3">
        <!-- Hidden File Input -->
        <input 
          type="file" 
          ref="fileInput" 
          multiple 
          class="hidden" 
          @change="handleFileChange"
        />

        <div class="flex-1 relative flex items-end">
          <textarea
            v-model="messageTerm"
            placeholder="Type a message..."
            @keydown="handleKeydown"
            class="bg-foreground/5 mb-3 text-foreground placeholder:text-foreground/50 focus:border-primary/30 focus:ring-primary/20 custom-scrollbar h-11 md:h-14 w-full resize-none rounded-2xl border border-border/50 pl-4 pr-24 py-2.5 md:py-4 text-sm md:text-base transition-all outline-none focus:ring-4"
          ></textarea>

          <div class="absolute right-4 -mb-1 -translate-y-1/2 flex items-center gap-2">
            <!-- Attachment Button -->
            <button
              @click="triggerFileInput"
              class="text-foreground/30 hover:text-primary flex cursor-pointer items-center justify-center p-2 transition-colors"
              title="Attach files (max 15MB)"
            >
              <Icon name="solar:paperclip-linear" class="text-2xl" />
            </button>

            <!-- Send Button -->
            <AppButton
              variant="unstyled"
              size="unstyled"
              rounded="unstyled"
              @click="sendMessage"
              class="text-primary hover:text-primary-hover flex cursor-pointer items-center justify-center p-2 transition-colors"
            >
              <Icon name="material-symbols:send-rounded" class="text-2xl" />
            </AppButton>
          </div>
        </div>
      </div>
    </div>

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
              <Icon name="solar:pen-2-linear" class="text-lg text-indigo-500" />
              Edit Message
            </button>
            <button
              @click.stop="confirmDeleteMessage(contextMenu.message!)"
              class="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <Icon name="solar:trash-bin-trash-linear" class="text-lg" />
              Delete Message
            </button>
          </div>
        </Transition>

        <!-- Delete Message Confirmation Modal -->
        <Transition name="modal">
          <div
            v-if="showDeleteMessageModal"
            class="bg-foreground/40 fixed inset-0 z-999 flex items-center justify-center p-4"
            @click.self="showDeleteMessageModal = false"
          >
            <div class="bg-card border-border modal-container w-full max-w-sm rounded-4xl border p-8 text-center shadow-2xl">
              <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-500">
                <Icon name="solar:trash-bin-trash-bold" size="40" />
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
                  class="bg-foreground/5 text-foreground/70 font-bold transition-all hover:bg-foreground/10"
                  @click="showDeleteMessageModal = false"
                >
                  Cancel
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Cancel Appointment Confirmation Modal -->
      <Transition name="modal">
        <div
          v-if="showCancelConfirm"
          class="bg-foreground/40 fixed inset-0 z-[1000] flex items-center justify-center p-4"
          @click.self="showCancelConfirm = false"
        >
          <div class="modal-container bg-card border-border w-full max-w-md overflow-hidden rounded-3xl border p-8 shadow-2xl">
            <div class="mb-6 flex flex-col items-center text-center">
              <div class="bg-red-100 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <Icon name="material-symbols:cancel-outline-rounded" class="text-4xl text-red-600" />
              </div>
              <h3 class="text-2xl font-bold">Cancel Appointment?</h3>
              <p class="text-foreground/60 mt-2 text-sm">
                Are you sure you want to cancel this appointment? The patient will be notified that the appointment was cancelled.
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
                class="bg-foreground/5 text-foreground/70 font-bold transition-all hover:bg-foreground/10"
                @click="showCancelConfirm = false"
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
          class="bg-foreground/40 fixed inset-0 z-[1000] flex items-center justify-center p-4"
          @click.self="showResolveModal = false"
        >
          <div class="modal-container bg-card border-border w-full max-w-md overflow-hidden rounded-3xl border p-8 shadow-2xl">
            <div class="mb-6 flex flex-col items-center text-center">
              <div class="bg-amber-100 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <Icon name="material-symbols:warning-rounded" class="text-4xl text-amber-600" />
              </div>
              <h3 class="text-2xl font-bold">Resolve Past Appointment</h3>
              <p class="text-foreground/60 mt-2 text-sm">
                This appointment date has passed. Please specify the outcome of this appointment.
              </p>
            </div>

            <div class="flex flex-col gap-3">
              <AppButton
                variant="solid"
                class="bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center gap-2"
                :disabled="isCompleting || isCancelling"
                @click="completeAppointment"
              >
                <Icon name="material-symbols:check-circle-rounded" class="text-lg" />
                {{ isCompleting ? 'Marking Accomplished...' : 'Mark as Accomplished' }}
              </AppButton>
              <AppButton
                variant="solid"
                class="bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2"
                :disabled="isCompleting || isCancelling"
                @click="cancelAppointmentDirectly"
              >
                <Icon name="material-symbols:cancel-rounded" class="text-lg" />
                {{ isCancelling ? 'Cancelling...' : 'Cancel Appointment' }}
              </AppButton>
              <AppButton
                variant="unstyled"
                class="bg-foreground/5 text-foreground/70 font-bold transition-all hover:bg-foreground/10"
                @click="showResolveModal = false"
              >
                Decide Later
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
=======
        </Transition>

        <!-- Delete Conversation Confirmation Modal -->
        <Transition name="modal">
          <div
            v-if="showDeleteConversationModal"
            class="bg-foreground/40 fixed inset-0 z-999 flex items-center justify-center p-4"
            @click.self="showDeleteConversationModal = false"
          >
            <div class="bg-card border-border modal-container w-full max-w-sm rounded-4xl border p-8 text-center shadow-2xl">
              <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-500">
                <Icon name="solar:chat-round-dots-bold" size="40" />
              </div>
              <h3 class="mb-2 text-2xl font-bold">Delete Conversation</h3>
              <p class="text-foreground/60 mb-8 text-sm">
                Are you sure you want to delete this entire conversation with <strong>{{ otherPersonName }}</strong>?<br />
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
                  class="bg-foreground/5 text-foreground/70 font-bold transition-all hover:bg-foreground/10"
                  @click="showDeleteConversationModal = false"
                >
                  Cancel
                </AppButton>
              </div>
            </div>
          </div>
        </Transition>
        <!-- Schedule Appointment Modal -->
        <AppModalAppointmentSchedule
          v-if="showScheduleModal"
          :appointment-uuid="schedulingAppointmentUuid"
          :mode="scheduleMode"
          @close="handleScheduleModalClose"
          @scheduled="() => { fetchMessages(1); fetchAppointments(); }"
        />

        <!-- Complete Appointment Confirmation Modal -->
        <Transition name="modal">
          <div
            v-if="showCompleteConfirm"
            class="bg-foreground/40 fixed inset-0 z-[1000] flex items-center justify-center p-4"
            @click.self="showCompleteConfirm = false"
          >
            <div class="modal-container bg-card border-border w-full max-w-md overflow-hidden rounded-3xl border p-8 shadow-2xl">
              <div class="mb-6 flex flex-col items-center text-center">
                <div class="bg-indigo-100 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                  <Icon name="material-symbols:check-circle-outline-rounded" class="text-4xl text-indigo-600" />
                </div>
                <h3 class="text-2xl font-bold">Complete Appointment?</h3>
                <p class="text-foreground/60 mt-2">
                  Are you sure you want to mark this appointment as completed? This will move it to the patient's records.
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
                  class="bg-foreground/5 text-foreground/70 font-bold transition-all hover:bg-foreground/10"
                  @click="showCompleteConfirm = false"
                >
                  Cancel
                </AppButton>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
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
</style>
