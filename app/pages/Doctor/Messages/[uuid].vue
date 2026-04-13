<script setup lang="ts">
  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const route = useRoute()
  const uuid = route.params.uuid as string
  const userRole = useCookie('user_role')

  const { data: conversation } = await useApi<any>(() => `conversations/${uuid}`)

  const otherPerson = computed(() => {
    if (!conversation.value?.data) return { name: 'Unknown', avatar: null }
    return userRole.value === 'doctor'
      ? conversation.value.data.patient
      : conversation.value.data.doctor
  })
</script>

<template>
  <div class="flex h-[calc(100vh-8rem)] gap-3">
    <div class="hidden lg:block">
      <AppChatConversationList
        :active-id="uuid"
        base-path="/Doctor/Messages"
      />
    </div>
    <div class="bg-card border-border flex-1 overflow-hidden rounded-3xl border shadow-sm">
      <AppChatMessageWindow
        :conversation-uuid="uuid"
        :other-person-name="otherPerson?.name || 'Unknown'"
        :other-person-avatar="otherPerson?.avatar"
      />
    </div>
  </div>
</template>
