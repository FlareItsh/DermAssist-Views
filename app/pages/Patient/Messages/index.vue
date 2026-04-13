<script setup lang="ts">
  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })
</script>

<template>
  <div class="flex h-[calc(100vh-8rem)] gap-3">
    <AppChatConversationList
      base-path="/Patient/Messages"
    />
    <div class="bg-card border-border flex-1 overflow-hidden rounded-3xl border shadow-sm">
      <div class="flex h-full items-center justify-center">
        <div class="text-foreground/20 text-center">
          <Icon name="solar:chat-round-line-linear" class="mb-4 text-9xl" />
          <p class="text-2xl font-bold">Select a conversation to start chatting</p>
        </div>
      </div>
    </div>
  </div>
</template>
