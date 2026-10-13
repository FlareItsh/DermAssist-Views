<script setup lang="ts">
  import { conversationService } from '~/api/conversation/ConversationService'

  interface ConversationPerson {
    id: string
    name: string
    avatar: string | null
  }

  interface Conversation {
    id: string
    doctor: ConversationPerson | null
    patient: ConversationPerson | null
    latest_message?: {
      message: string
      sender_id: string
      created_at: string
    } | null
    unread_count?: number
    created_at: string
    updated_at: string
  }

  interface PaginatedResponse<T> {
    data: T[]
  }

  const props = defineProps<{
    activeId?: string
    basePath: string
  }>()

  const emit = defineEmits<{
    (e: 'select', conversation: Conversation): void
  }>()

  const searchValue = ref('')
  const { getEcho } = useEcho()
  const userUuid = useCookie('user_uuid')

  const userRole = useCookie('user_role')
  const { getStorageUrl } = useStorage()
  const avatarErrors = ref(new Set<string>())

  const hasAvatarError = (id: string) => avatarErrors.value.has(id)
  const handleAvatarError = (id: string) => {
    avatarErrors.value.add(id)
  }

  const { data: conversations, refresh, pending } = await conversationService.useList()

  const filteredConversations = computed(() => {
    if (!conversations.value?.data) return []
    const list = (conversations.value.data as any[]).filter(c => c && typeof c === 'object')
    if (!searchValue.value) return list
    const query = searchValue.value.toLowerCase()
    return list.filter(c => {
      const otherPerson =
        userRole.value === 'doctor' || userRole.value === 'secretary' ? c.patient : c.doctor
      return getPersonName(otherPerson).toLowerCase().includes(query)
    })
  })

  const getPersonName = (person: any) => {
    if (!person) return 'Unknown'
    if (person.name) return person.name

    const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ')
    return fullName || 'Unknown'
  }

  const getPersonAvatar = (person: any) => {
    const raw = person?.avatar_path ?? person?.avatar ?? null
    return raw ? getStorageUrl(raw) : null
  }

  const getOtherPerson = (conv: Conversation): ConversationPerson | null => {
    const person =
      userRole.value === 'doctor' || userRole.value === 'secretary' ? conv.patient : conv.doctor

    if (!person) return null

    return {
      ...person,
      name: getPersonName(person),
      avatar: getPersonAvatar(person)
    }
  }

  const formatTime = (dateStr?: string | null): string => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    }
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      refresh()
    }
  }

  onMounted(() => {
    if (import.meta.client && userUuid.value) {
      const echo = getEcho()
      if (echo) {
        echo
          .private(`user.${userUuid.value}`)
          .listen('.ChatMessageSent', () => {
            refresh()
          })
          .listen('.ChatMessagesRead', () => {
            refresh()
          })
          .listen('.ChatMessageEdited', () => {
            refresh()
          })
          .listen('.ChatMessageDeleted', () => {
            refresh()
          })
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  onUnmounted(() => {
    if (import.meta.client && userUuid.value) {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  const handleSelect = (conv: Conversation) => {
    if (conv.unread_count) {
      conv.unread_count = 0
    }
    emit('select', conv)
    navigateTo(`${props.basePath}/${conv.id}`)
  }
</script>

<template>
  <div
    class="md:bg-card border-border flex h-full w-full shrink-0 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none md:w-80 md:rounded-3xl md:border md:shadow-sm"
  >
    <div class="border-border border-b p-4">
      <div class="relative">
        <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
          <Icon
            name="material-symbols:search-rounded"
            class="text-xl"
          />
        </span>
        <input
          v-model="searchValue"
          type="text"
          placeholder="Search conversations..."
          class="bg-foreground/5 h-11 w-full rounded-2xl border border-transparent pr-4 pl-11 text-sm text-gray-400 transition-all outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          v-if="searchValue"
          @click="searchValue = ''"
          class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
        >
          <Icon
            name="material-symbols:close-rounded"
            class="text-lg"
          />
        </button>
      </div>
    </div>

    <div class="custom-scrollbar flex-1 overflow-y-auto pt-2">
      <div
        v-if="pending && !conversations?.data?.length"
        class="space-y-3 p-4"
      >
        <div
          v-for="i in 5"
          :key="i"
          class="flex animate-pulse items-center gap-4"
        >
          <div class="bg-foreground/10 h-14 w-14 shrink-0 rounded-2xl" />
          <div class="flex-1 space-y-2">
            <div class="bg-foreground/10 h-4 w-3/4 rounded-lg" />
            <div class="bg-foreground/10 h-3 w-1/2 rounded-lg" />
          </div>
        </div>
      </div>

      <div
        v-else-if="filteredConversations.length === 0"
        class="text-muted-foreground p-10 text-center"
      >
        <Icon
          name="solar:chat-round-line-linear"
          class="mx-auto mb-2 text-4xl opacity-20"
        />
        <p
          v-if="searchValue"
          class="text-sm"
        >
          No conversations matching "{{ searchValue }}"
        </p>
        <p
          v-else
          class="text-sm"
        >
          No conversations yet
        </p>
      </div>

      <button
        v-for="conv in filteredConversations"
        :key="conv.id"
        @click="handleSelect(conv)"
        class="hover:bg-foreground/5 mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-3.5 rounded-xl p-3 text-left transition-all active:scale-[0.99]"
        :class="[
          activeId === conv.id
            ? 'bg-secondary/10 border-secondary border-l-4'
            : (conv.unread_count || 0) > 0
              ? 'bg-primary/5 hover:bg-primary/10 border-primary/70 border-l-4'
              : 'border-l-4 border-transparent'
        ]"
      >
        <!-- Avatar with Popping Unread Notification Badge -->
        <div class="relative h-13 w-13 shrink-0">
          <div class="bg-muted h-full w-full overflow-hidden rounded-2xl">
            <img
              v-if="getOtherPerson(conv)?.avatar && !hasAvatarError(conv.id)"
              :src="getOtherPerson(conv)!.avatar!"
              :alt="getOtherPerson(conv)?.name || 'User'"
              class="h-full w-full object-cover"
              @error="handleAvatarError(conv.id)"
            />
            <div
              v-else
              class="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-base font-bold uppercase"
            >
              {{ (getOtherPerson(conv)?.name || '?').charAt(0) }}
            </div>
          </div>

          <!-- Unread Badge with Number in the Middle -->
          <span
            v-if="(conv.unread_count || 0) > 0"
            class="badge-pop absolute -top-1 -right-1 z-10 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-black text-white shadow-xs"
          >
            {{ (conv.unread_count || 0) > 99 ? '99+' : conv.unread_count }}
          </span>
        </div>

        <!-- Chat Details & Indicators -->
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <div class="flex items-center justify-between gap-2">
            <h3
              class="text-foreground truncate text-sm sm:text-base"
              :class="(conv.unread_count || 0) > 0 ? 'font-bold' : 'font-semibold'"
            >
              {{ getOtherPerson(conv)?.name || 'Unknown' }}
            </h3>
            <span
              v-if="conv.latest_message?.created_at || conv.updated_at"
              class="shrink-0 text-[11px]"
              :class="
                (conv.unread_count || 0) > 0
                  ? 'text-primary font-bold'
                  : 'text-foreground/40 font-medium'
              "
            >
              {{ formatTime(conv.latest_message?.created_at || conv.updated_at) }}
            </span>
          </div>

          <p
            class="truncate text-xs leading-tight"
            :class="
              (conv.unread_count || 0) > 0
                ? 'text-foreground font-semibold'
                : 'text-foreground/50 font-normal'
            "
          >
            {{ conv.latest_message?.message || 'Tap to open chat' }}
          </p>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
  @keyframes badge-pop {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    75% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .badge-pop {
    animation: badge-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

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
</style>
