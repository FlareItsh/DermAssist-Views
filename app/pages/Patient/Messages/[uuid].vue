<script setup lang="ts">
  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  import { conversationService } from '~/api/conversation/ConversationService'

  const route = useRoute()
  const uuid = route.params.uuid as string
  const userRole = useCookie('user_role')

  const { data: response } = await conversationService.useShow(() => route.params.uuid as string)
  const conversation = computed(() => (response.value as any)?.data ?? response.value)

  const getPersonName = (person: any) => {
    if (!person) return 'Unknown'
    if (person.name) return person.name

    const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ')
    return fullName || 'Unknown'
  }

  const getPersonAvatar = (person: any) => {
    return person?.avatar ?? person?.avatar_path ?? null
  }

  const otherPerson = computed(() => {
    if (!conversation.value) return { name: 'Unknown', avatar: null }
    const person = userRole.value === 'doctor'
      ? conversation.value.patient
      : conversation.value.doctor

    return {
      ...person,
      name: getPersonName(person),
      avatar: getPersonAvatar(person)
    }
  })
</script>

<template>
  <div class="flex h-full gap-3 -mx-5 md:mx-0 mt-0 md:mt-0">
    <div class="hidden md:block">
      <AppChatConversationList
        :active-id="uuid"
        base-path="/Patient/Messages"
      />
    </div>
    <div class="bg-card border-0 md:border md:border-border flex-1 overflow-hidden rounded-none md:rounded-3xl shadow-none md:shadow-sm w-full h-full">
      <AppChatMessageWindow
        :key="uuid"
        :conversation-uuid="uuid"
        :other-person-name="otherPerson?.name || 'Unknown'"
        :other-person-avatar="otherPerson?.avatar"
        @conversation-deleted="navigateTo('/Patient/Messages')"
      />
    </div>
  </div>
</template>
