import { ref, computed, onUnmounted, watch } from 'vue'
import { conversationService } from '~/api/conversation/ConversationService'

export interface ConversationPerson {
  id: string
  name: string
  avatar: string | null
}

export interface Conversation {
  id: string
  doctor: ConversationPerson | null
  patient: ConversationPerson | null
  latest_message?: {
    message: string
    sender_id: string
    created_at: string
  } | null
  unread_count: number
  created_at: string
  updated_at: string
}

// Global shared polling state
let conversationPollingTimer: any = null
let isConversationListenerBound = false
let activeConversationFetch: Promise<void> | null = null

export const useConversations = () => {
  const userUuid = useCookie('user_uuid')
  const conversations = useState<Conversation[]>('shared_conversations_list', () => [])
  const pending = ref(false)

  const fetchConversations = async () => {
    if (!userUuid.value) {
      conversations.value = []
      return
    }

    // Reuse in-flight request if already pending
    if (activeConversationFetch) return activeConversationFetch

    pending.value = true
    activeConversationFetch = (async () => {
      try {
        const res = await conversationService.list()
        if (res && res.data) {
          conversations.value = res.data
        }
      } catch (e) {
        console.error('Failed to fetch conversations:', e)
      } finally {
        pending.value = false
        activeConversationFetch = null
      }
    })()

    return activeConversationFetch
  }

  const totalUnreadCount = computed(() => {
    return conversations.value.reduce((sum, conv) => sum + (conv.unread_count || 0), 0)
  })

  // Watch for user changes to reset and refetch
  watch(() => userUuid.value, (newUuid) => {
    conversations.value = []
    if (newUuid) fetchConversations()
  })

  // Singleton Polling: Starts only ONE global interval regardless of how many components call useConversations()
  if (import.meta.client) {
    if (!conversationPollingTimer) {
      fetchConversations()
      conversationPollingTimer = setInterval(() => {
        // Only poll if tab is visible and user is logged in
        if (document.visibilityState === 'visible' && userUuid.value) {
          fetchConversations()
        }
      }, 5000)
    }

    if (!isConversationListenerBound && typeof document !== 'undefined') {
      isConversationListenerBound = true
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && userUuid.value) {
          fetchConversations()
        }
      })
    }
  }

  return {
    conversations,
    pending,
    totalUnreadCount,
    fetchConversations
  }
}
