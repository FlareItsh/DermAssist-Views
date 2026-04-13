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

  const userUuid = useCookie('user_uuid')
  const messageTerm = ref('')
  const messagesContainer = ref<HTMLElement | null>(null)
  let pollingInterval: any = null
  let isUserNearBottom = true

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
  })

  onUnmounted(() => {
    stopPolling()
  })

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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
          class="flex items-end gap-3"
          :class="msg.sender?.id === userUuid ? 'flex-row-reverse' : 'flex-row'"
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
            <div
              class="px-5 py-3 transition-all"
              :class="[
                msg.sender?.id === userUuid
                  ? 'bg-primary shadow-primary/10 rounded-t-2xl rounded-bl-2xl text-white shadow-lg'
                  : 'bg-foreground/5 text-foreground rounded-t-2xl rounded-br-2xl'
              ]"
            >
              <p class="text-base leading-relaxed whitespace-pre-wrap">{{ msg.message }}</p>
            </div>
            <span
              class="text-foreground/30 text-[11px]"
              :class="msg.sender?.id === userUuid ? 'text-right' : 'text-left'"
            >
              {{ formatTime(msg.created_at) }}
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
</style>
