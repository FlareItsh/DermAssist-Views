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

export const useConversations = () => {
  const userUuid = useCookie('user_uuid')
  const conversations = useState<Conversation[]>('shared_conversations_list', () => [])
  const pending = ref(false)

  const fetchConversations = async () => {
    if (!userUuid.value) {
      conversations.value = []
      return
    }

    if (pending.value) return
    pending.value = true

    try {
      const res = await conversationService.list()
      if (res && res.data) {
        conversations.value = res.data
      }
    } catch (e) {
      console.error('Failed to fetch conversations:', e)
    } finally {
      pending.value = false
    }
  }

  const totalUnreadCount = computed(() => {
    return conversations.value.reduce((sum, conv) => sum + (conv.unread_count || 0), 0)
  })

  // Watch for user changes to reset and refetch
  watch(() => userUuid.value, (newUuid) => {
    conversations.value = []
    if (newUuid) fetchConversations()
  })

  // Fetch immediately and poll every 5 seconds for reactivity
  let polling: any = null
  if (import.meta.client) {
    fetchConversations()
    polling = setInterval(fetchConversations, 5000)
    onUnmounted(() => {
      if (polling) clearInterval(polling)
    })
  }

  return {
    conversations,
    pending,
    totalUnreadCount,
    fetchConversations
  }
}
