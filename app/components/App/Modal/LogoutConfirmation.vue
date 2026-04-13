<script setup lang="ts">
const emit = defineEmits(['close', 'confirm'])

const props = defineProps<{
  isLoading?: boolean
}>()
</script>

<template>
  <div class="bg-card w-full max-w-sm rounded-[2rem] border border-sidebar-border p-8 text-center shadow-2xl modal-container">
    <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
      <Icon name="ic:round-log-out" size="40" />
    </div>

    <h3 class="mb-2 text-2xl font-bold">Logout Confirmation</h3>
    <p class="text-foreground/60 mb-8 text-sm">
      Are you sure you want to log out? <br />
      You will need to sign in again to access your dashboard.
    </p>

    <div class="flex flex-col gap-3">
      <AppButton
        variant="primary"
        class="bg-destructive text-white hover:bg-destructive/90 border-none"
        :loading="isLoading"
        @click="emit('confirm')"
      >
        Yes, Log Out
      </AppButton>
      <AppButton
        variant="unstyled"
        class="bg-foreground/5 hover:bg-foreground/10 text-foreground/70 font-bold transition-all"
        @click="emit('close')"
      >
        Stay Logged In
      </AppButton>
    </div>
  </div>
</template>
