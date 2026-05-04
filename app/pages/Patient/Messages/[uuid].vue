<script setup lang="ts">
  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  import { conversationService } from '~/api/conversation/ConversationService'

  const route = useRoute()
  const uuid = route.params.uuid as string
  const userRole = useCookie('user_role')

  const { data: response } = await conversationService.useShow(uuid)
  const conversation = computed(() => response.value)

  const otherPerson = computed(() => {
    if (!conversation.value) return { name: 'Unknown', avatar: null }
    return userRole.value === 'doctor'
      ? conversation.value.patient
      : conversation.value.doctor
  })
</script>

<template>
  <div class="flex h-[calc(100vh-8rem)] gap-3">
    <div class="hidden lg:block">
      <AppChatConversationList
        :active-id="uuid"
        base-path="/Patient/Messages"
      />
    </div>
    <div class="bg-card border-border flex-1 overflow-hidden rounded-3xl border shadow-sm">
      <AppChatMessageWindow
        :conversation-uuid="uuid"
        :other-person-name="otherPerson?.name || 'Unknown'"
        :other-person-avatar="otherPerson?.avatar"
        @conversation-deleted="navigateTo('/Patient/Messages')"
      />
    </div>
  </div>
</template>
