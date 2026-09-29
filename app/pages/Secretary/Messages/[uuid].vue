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
    const person =
      userRole.value === 'doctor' || userRole.value === 'secretary'
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
  <div class="-mx-5 mt-0 flex h-full gap-3 md:mx-0 md:mt-0">
    <div class="hidden md:block">
      <AppChatConversationList
        :active-id="uuid"
        base-path="/Secretary/Messages"
      />
    </div>
    <div
      class="bg-card md:border-border h-full w-full flex-1 overflow-hidden rounded-none border-0 shadow-none md:rounded-3xl md:border md:shadow-sm"
    >
      <AppChatMessageWindow
        :key="uuid"
        :conversation-uuid="uuid"
        :other-person-name="otherPerson?.name || 'Unknown'"
        :other-person-avatar="otherPerson?.avatar"
        @conversation-deleted="navigateTo('/Secretary/Messages')"
      />
    </div>
  </div>
</template>
