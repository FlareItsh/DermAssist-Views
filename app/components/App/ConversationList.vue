<script setup lang="ts">
  import { ref, computed } from 'vue'

  const props = defineProps<{
    search?: string
    conversations: any[]
    activeId: number
  }>()

  defineEmits(['update:activeId'])

  const tabs = ['All', 'Unread', 'Starred']
  const activeTab = ref('All')

  const filteredConversations = computed(() => {
    if (!props.search) return props.conversations
    const query = props.search.toLowerCase()
    return props.conversations.filter(c => c.name.toLowerCase().includes(query))
  })
</script>

<template>
  <div
    class="bg-card border-border flex h-[calc(100vh-10rem)] w-80 flex-col overflow-hidden rounded-3xl border shadow-sm"
  >
    <AppConversationTabs
      v-model:activeTab="activeTab"
      :tabs="tabs"
    />

    <div class="custom-scrollbar flex-1 overflow-y-auto pt-2">
      <div
        v-if="filteredConversations.length === 0"
        class="text-muted-foreground p-10 text-center"
      >
        <Icon
          name="solar:magnifer-linear"
          class="mx-auto mb-2 text-4xl opacity-20"
        />
        <p class="text-sm">No doctors found matching "{{ search }}"</p>
      </div>
      <AppConversationCard
        v-for="conv in filteredConversations"
        :key="conv.id"
        v-bind="conv"
        :active="activeId === conv.id"
        @click="$emit('update:activeId', conv.id)"
      />
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
