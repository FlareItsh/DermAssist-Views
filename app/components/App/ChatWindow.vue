<script setup lang="ts">
  import { ref, watch } from 'vue'

  const props = defineProps<{
    conversation: any
  }>()

  const messageTerm = ref('')
  const mockMessages = ref([
    {
      id: 1,
      text: 'Hello',
      sentByMe: true,
      avatar: '/images/lp-img.png'
    },
    {
      id: 2,
      text: "Hello i'm here to help",
      sentByMe: false,
      avatar: '/images/lp-img.png'
    }
  ])

  watch(
    () => props.conversation?.id,
    () => {
      if (props.conversation) {
        mockMessages.value[1].text = `Hello I'm ${props.conversation.name}`
      }
    },
    { immediate: true }
  )

  const sendMessage = () => {
    if (!messageTerm.value.trim()) return
    // Handle sending here later
    messageTerm.value = ''
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }
</script>

<template>
  <div
    class="bg-card flex h-full flex-col"
    v-if="conversation"
  >
    <div class="border-border flex items-center justify-between border-b px-8 py-6">
      <h2 class="text-foreground text-3xl font-bold">{{ conversation.name }}</h2>
      <button class="text-foreground/40 hover:text-primary cursor-pointer transition-colors">
        <Icon
          name="solar:menu-dots-vertical-bold"
          class="text-3xl"
        />
      </button>
    </div>

    <!-- Messages Area -->
    <div class="custom-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      <div
        v-for="msg in mockMessages"
        :key="msg.id"
        class="flex items-end gap-4"
        :class="msg.sentByMe ? 'flex-row-reverse' : 'flex-row'"
      >
        <div class="border-border/50 h-12 w-12 shrink-0 overflow-hidden rounded-full border">
          <img
            :src="msg.avatar"
            class="h-full w-full object-cover"
          />
        </div>

        <div
          class="max-w-[70%] px-6 py-3 transition-all"
          :class="[
            msg.sentByMe
              ? 'bg-primary shadow-primary/10 rounded-t-3xl rounded-bl-3xl text-white shadow-lg'
              : 'bg-primary/30 text-foreground rounded-t-3xl rounded-br-3xl'
          ]"
        >
          <p class="text-xl leading-relaxed">{{ msg.text }}</p>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="p-8 pt-0">
      <div class="group relative flex items-end">
        <textarea
          v-model="messageTerm"
          placeholder="Your message"
          @keydown="handleKeydown"
          class="bg-foreground/5 focus:border-primary/20 focus:ring-primary/5 custom-scrollbar h-17 w-full resize-none rounded-2xl border border-transparent px-15 py-5 text-lg transition-all outline-none focus:ring-4"
        ></textarea>

        <div class="absolute top-1/2 left-6 -translate-y-1/2">
          <button
            class="text-foreground/30 hover:text-primary flex cursor-pointer items-center justify-center transition-colors"
          >
            <Icon
              name="material-symbols:link-rounded"
              class="text-foreground/60 text-3xl"
            />
          </button>
        </div>

        <div class="absolute top-1/2 right-6 -translate-y-1/2">
          <button
            @click="sendMessage"
            class="text-foreground/40 hover:text-primary group-focus-within:text-primary flex cursor-pointer items-center justify-center p-2 transition-colors"
          >
            <Icon
              name="tabler:send"
              class="text-secondary text-3xl"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
  <div
    v-else
    class="bg-muted/5 flex flex-1 items-center justify-center"
  >
    <div class="text-foreground/20 text-center">
      <Icon
        name="solar:chat-round-line-linear"
        class="mb-4 text-9xl"
      />
      <p class="text-2xl font-bold">Select a conversation to start chatting</p>
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
