<script setup lang="ts">
  import { ref, computed } from 'vue'

  const searchValue = ref('')
  const activeConversationId = ref(1)

  const conversations = [
    {
      id: 1,
      name: 'Dr. John Doe',
      lastMessage: "Hello I'm john doe",
      avatar: '/images/lp-img.png'
    },
    {
      id: 2,
      name: 'Dr. Shaun Murphy',
      lastMessage: 'Come to the hospital',
      avatar: '/images/lp-img.png'
    },
    {
      id: 3,
      name: 'Dr. Diya Eshani',
      lastMessage: 'Hello im Dr. Diya How ....',
      avatar: '/images/lp-img.png'
    },
    {
      id: 4,
      name: 'Dr. Zander Thorne',
      lastMessage: 'Hello',
      avatar: '/images/lp-img.png'
    },
    {
      id: 5,
      name: 'Dr. Felix Kjellberg',
      lastMessage: 'Hello Welcome to the...',
      avatar: '/images/lp-img.png'
    },
    {
      id: 6,
      name: 'Dr. Kanye West',
      lastMessage: 'Hello',
      avatar: '/images/lp-img.png'
    },
    {
      id: 7,
      name: 'Dr. Aaron Glassman',
      lastMessage: 'Hello',
      avatar: '/images/lp-img.png'
    }
  ]

  const activeConversation = computed(() => {
    return conversations.find(c => c.id === activeConversationId.value) || conversations[0]
  })
</script>

<template>
  <div class="flex h-[calc(100vh-8rem)] gap-3">
    <div class="flex h-full flex-col gap-3">
      <AppSearch
        v-model="searchValue"
        rounded="rounded-2xl shadow-sm overflow-hidden"
        text="text-secondary"
        width="w-fit"
      />
      <AppConversationList
        :search="searchValue"
        :conversations="conversations"
        v-model:activeId="activeConversationId"
      />
    </div>
    <div class="bg-card border-border flex-1 overflow-hidden rounded-3xl border shadow-sm">
      <AppChatWindow :conversation="activeConversation" />
    </div>
  </div>
</template>
