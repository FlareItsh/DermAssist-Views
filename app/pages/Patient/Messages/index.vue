<script setup lang="ts">
  definePageMeta({
    layout: 'dashboard-sidebar-layout',
    alias: ['/patient/messages', '/Patient/Messages']
  })
</script>

<template>
  <div class="mt-0 flex h-full gap-3">
    <AppChatConversationList
      base-path="/Patient/Messages"
      class="flex-1 md:flex-none"
    />
    <div
      class="bg-card border-border hidden w-full flex-1 overflow-hidden rounded-3xl border shadow-xs md:flex"
    >
      <div class="flex h-full w-full items-center justify-center p-8">
        <div class="flex max-w-sm flex-col items-center text-center">
          <div
            class="bg-primary/10 text-primary mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-xs"
          >
            <Icon
              name="solar:chat-round-dots-bold"
              class="text-3xl"
            />
          </div>
          <h3 class="text-foreground text-xl font-bold tracking-tight">Doctor Consultations</h3>
          <p class="text-muted-foreground mt-2 text-xs leading-relaxed">
            Select an ongoing conversation from the list to review diagnosis findings, ask
            questions, and receive treatment follow-ups.
          </p>
          <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
            <AppButton
              to="/patient/appointments"
              size="sm"
              variant="outline"
              class="gap-1.5 text-xs font-semibold"
            >
              <Icon
                name="lucide:calendar"
                size="14"
              />
              Book Appointment
            </AppButton>
            <AppButton
              to="/patient/scan"
              size="sm"
              variant="solid"
              class="gap-1.5 text-xs font-semibold"
            >
              <Icon
                name="lucide:camera"
                size="14"
              />
              New Skin Scan
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
