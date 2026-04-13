<script setup lang="ts">
  interface MessageSender {
    id: string
    name: string
    avatar: string | null
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
  }

  interface PaginatedResponse<T> {
    data: T[]
  }

  const props = defineProps<{
    conversationUuid: string
    otherPersonName: string
    otherPersonAvatar?: string | null
  }>()

  const emit = defineEmits<{
    (e: 'conversationDeleted'): void
  }>()

  const userUuid = useCookie('user_uuid')
  const messageTerm = ref('')
  const messagesContainer = ref<HTMLElement | null>(null)
  let pollingInterval: any = null
  let isUserNearBottom = true

  // Context menu state
  const contextMenu = ref<{ visible: boolean; x: number; y: number; message: Message | null }>({
    visible: false,
    x: 0,
    y: 0,
    message: null
  })

  // Edit state
  const editingMessageId = ref<string | null>(null)
  const editingMessageText = ref('')

  // Delete confirmation modal
  const showDeleteMessageModal = ref(false)
  const messageToDelete = ref<Message | null>(null)

  // Delete conversation modal
  const showDeleteConversationModal = ref(false)

  const { data: messagesData, refresh, pending } =
    await useApi<PaginatedResponse<Message>>(() => `conversations/${props.conversationUuid}/messages`)

  const sortedMessages = computed(() => {
    if (!messagesData.value?.data) return []
    return [...messagesData.value.data].reverse()
  })

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTo({
          top: messagesContainer.value.scrollHeight,
          behavior
        })
      }
    })
  }

  const checkScrollPosition = () => {
    if (!messagesContainer.value) return
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value
    isUserNearBottom = scrollHeight - scrollTop - clientHeight < 100
  }

  const markUnreadMessages = async () => {
    if (!messagesData.value?.data) return
    const unread = messagesData.value.data.filter(
      (m) => !m.is_read && m.sender?.id !== userUuid.value
    )
    for (const msg of unread) {
      try {
        await $api(`messages/${msg.id}`, { method: 'PUT' })
      } catch (e) {
        // silently fail
      }
    }
  }

  const startPolling = () => {
    if (pollingInterval) clearInterval(pollingInterval)
    pollingInterval = setInterval(async () => {
      if (!pending.value) {
        const prevCount = messagesData.value?.data?.length || 0
        await refresh()
        const newCount = messagesData.value?.data?.length || 0
        if (newCount > prevCount) {
          if (isUserNearBottom) {
            scrollToBottom()
          }
          await markUnreadMessages()
        }
      }
    }, 3000)
  }

  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
  }

  onMounted(() => {
    scrollToBottom('instant')
    markUnreadMessages()
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
    if (!text) return

    messageTerm.value = ''
    try {
      await $api(`conversations/${props.conversationUuid}/messages`, {
        method: 'POST',
        body: { message: text }
      })
      await refresh()
      scrollToBottom()
    } catch (e) {
      messageTerm.value = text
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // --- Context Menu ---
  const openContextMenu = (event: MouseEvent, msg: Message) => {
    if (msg.sender?.id !== userUuid.value) return
    event.preventDefault()
    contextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      message: msg
    }
  }

  const closeContextMenu = () => {
    contextMenu.value.visible = false
  }

  // --- Edit Message ---
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
      await $api(`messages/${editingMessageId.value}`, {
        method: 'PUT',
        body: { message: trimmed }
      })
      await refresh()
      cancelEditing()
    } catch (e) {
      // keep editing state on error
    }
  }

  const handleEditKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveEdit()
    }
    if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  // --- Delete Message ---
  const confirmDeleteMessage = (msg: Message) => {
    messageToDelete.value = msg
    showDeleteMessageModal.value = true
    closeContextMenu()
  }

  const deleteMessage = async () => {
    if (!messageToDelete.value) return
    try {
      await $api(`messages/${messageToDelete.value.id}`, { method: 'DELETE' })
      await refresh()
    } catch (e) {
      // silently fail
    } finally {
      showDeleteMessageModal.value = false
      messageToDelete.value = null
    }
  }

  // --- Delete Conversation ---
  const deleteConversation = async () => {
    try {
      await $api(`conversations/${props.conversationUuid}`, { method: 'DELETE' })
      showDeleteConversationModal.value = false
      emit('conversationDeleted')
    } catch (e) {
      // silently fail
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isEdited = (msg: Message) => {
    return msg.created_at !== msg.updated_at
  }
</script>

<template>
  <div class="bg-card flex h-full flex-col">
    <!-- Header -->
    <div class="border-border flex items-center justify-between border-b px-8 py-6">
      <div class="flex items-center gap-4">
        <NuxtLink
          :to="$route.path.replace(/\/[^/]+$/, '')"
          class="text-foreground/40 hover:text-foreground -ml-2 flex items-center transition-colors lg:hidden"
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
        <h2 class="text-foreground text-2xl font-bold">{{ otherPersonName }}</h2>
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

    <!-- Messages Area -->
    <div
      ref="messagesContainer"
      @scroll="checkScrollPosition"
      class="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto p-8"
    >
      <!-- Loading skeleton -->
      <div v-if="pending && !messagesData?.data?.length" class="flex flex-1 items-center justify-center">
        <div class="text-foreground/20 text-center">
          <Icon name="svg-spinners:ring-resize" class="mx-auto mb-4 text-5xl" />
          <p class="text-lg font-medium">Loading messages...</p>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="sortedMessages.length === 0"
        class="flex flex-1 items-center justify-center"
      >
        <div class="text-foreground/20 text-center">
          <Icon name="solar:chat-round-line-linear" class="mb-4 text-8xl" />
          <p class="text-xl font-bold">No messages yet</p>
          <p class="mt-1 text-sm">Send a message to start the conversation</p>
        </div>
      </div>

      <!-- Message bubbles -->
      <TransitionGroup name="message" tag="div" class="flex flex-col gap-4">
        <div
          v-for="msg in sortedMessages"
          :key="msg.id"
          class="group flex items-end gap-3"
          :class="msg.sender?.id === userUuid ? 'flex-row-reverse' : 'flex-row'"
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
                msg.sender?.id === userUuid
                  ? 'bg-primary shadow-primary/10 rounded-t-2xl rounded-bl-2xl text-white shadow-lg'
                  : 'bg-foreground/5 text-foreground rounded-t-2xl rounded-br-2xl'
              ]"
            >
              <p class="text-base leading-relaxed whitespace-pre-wrap">{{ msg.message }}</p>

              <!-- Own message action dots (visible on hover) -->
              <button
                v-if="msg.sender?.id === userUuid"
                @click.stop="openContextMenu($event, msg)"
                class="absolute top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                :class="msg.sender?.id === userUuid ? '-left-9' : '-right-9'"
              >
                <Icon name="solar:menu-dots-vertical-bold" class="text-foreground/30 hover:text-foreground/60 text-lg" />
              </button>
            </div>

            <span
              class="text-foreground/30 text-[11px]"
              :class="msg.sender?.id === userUuid ? 'text-right' : 'text-left'"
            >
              {{ formatTime(msg.created_at) }}
              <span v-if="isEdited(msg)" class="italic"> · edited</span>
              <span v-if="msg.sender?.id === userUuid && msg.is_read" class="ml-1">✓✓</span>
            </span>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Input Area -->
    <div class="p-8 pt-0">
      <div class="group relative flex items-end">
        <textarea
          v-model="messageTerm"
          placeholder="Type a message..."
          @keydown="handleKeydown"
          class="bg-foreground/5 focus:border-primary/20 focus:ring-primary/5 custom-scrollbar h-14 w-full resize-none rounded-2xl border border-transparent px-6 pr-16 py-4 text-base transition-all outline-none focus:ring-4"
        ></textarea>

        <div class="absolute top-1/2 right-4 -translate-y-1/2">
          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            @click="sendMessage"
            class="text-foreground/40 hover:text-primary group-focus-within:text-primary flex cursor-pointer items-center justify-center p-2 transition-colors"
          >
            <Icon name="tabler:send" class="text-2xl" />
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Context Menu (floating) -->
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
    </Teleport>
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
