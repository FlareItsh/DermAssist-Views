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
  let pollingInterval: any = null

  const userRole = useCookie('user_role')

  const { data: conversations, refresh, pending } =
    await conversationService.useList()

  const filteredConversations = computed(() => {
    if (!conversations.value?.data) return []
    const list = (conversations.value.data as any[]).filter(c => c && typeof c === 'object')
    if (!searchValue.value) return list
    const query = searchValue.value.toLowerCase()
    return list.filter((c) => {
      const otherPerson = userRole.value === 'doctor' ? c.patient : c.doctor
      return otherPerson?.name?.toLowerCase().includes(query)
    })
  })

  const getOtherPerson = (conv: Conversation): ConversationPerson | null => {
    return userRole.value === 'doctor' ? conv.patient : conv.doctor
  }

  const startPolling = () => {
    if (pollingInterval) clearInterval(pollingInterval)
    pollingInterval = setInterval(async () => {
      if (!pending.value) {
        await refresh()
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
    startPolling()
  })

  onUnmounted(() => {
    stopPolling()
  })

  const handleSelect = (conv: Conversation) => {
    emit('select', conv)
    navigateTo(`${props.basePath}/${conv.id}`)
  }
</script>

<template>
  <div
    class="bg-card border-border flex h-full w-80 shrink-0 flex-col overflow-hidden rounded-3xl border shadow-sm"
  >
    <div class="border-border border-b p-4">
      <div class="relative">
        <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
          <Icon name="material-symbols:search-rounded" class="text-xl" />
        </span>
        <input
          v-model="searchValue"
          type="text"
          placeholder="Search conversations..."
          class="bg-foreground/5 h-11 w-full rounded-2xl border border-transparent pl-11 pr-4 text-sm font-medium transition-all outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          v-if="searchValue"
          @click="searchValue = ''"
          class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
        >
          <Icon name="material-symbols:close-rounded" class="text-lg" />
        </button>
      </div>
    </div>

    <div class="custom-scrollbar flex-1 overflow-y-auto pt-2">
      <div
        v-if="pending && !conversations?.data?.length"
        class="space-y-3 p-4"
      >
        <div v-for="i in 5" :key="i" class="flex items-center gap-4 animate-pulse">
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
        <p v-if="searchValue" class="text-sm">No conversations matching "{{ searchValue }}"</p>
        <p v-else class="text-sm">No conversations yet</p>
      </div>

      <button
        v-for="conv in filteredConversations"
        :key="conv.id"
        @click="handleSelect(conv)"
        class="hover:bg-foreground/5 mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-4 rounded-xl p-3 text-left transition-colors"
        :class="activeId === conv.id ? 'bg-secondary/10 border-secondary border-l-4' : ''"
      >
        <div class="bg-muted h-14 w-14 shrink-0 overflow-hidden rounded-2xl">
          <img
            v-if="getOtherPerson(conv)?.avatar"
            :src="getOtherPerson(conv)!.avatar!"
            :alt="getOtherPerson(conv)?.name || 'User'"
            class="h-full w-full object-cover"
          />
          <div
            v-else
            class="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-lg font-bold uppercase"
          >
            {{ (getOtherPerson(conv)?.name || '?').charAt(0) }}
          </div>
        </div>

        <div class="flex min-w-0 flex-1 flex-col">
          <h3 class="text-foreground truncate text-lg font-semibold">
            {{ getOtherPerson(conv)?.name || 'Unknown' }}
          </h3>
          <p class="text-foreground/50 truncate text-sm leading-tight">Tap to open chat</p>
        </div>
      </button>
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
</style>
