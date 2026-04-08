<script setup lang="ts">
definePageMeta({
  layout: 'dashboard-sidebar-layout'
})
</script>

<template>
  <div class="flex flex-col h-full p-6">
    <div class="flex flex-1 items-center justify-center rounded-2xl border border-dashed p-12 text-center shadow-sm bg-card/50">
      <div class="flex flex-col items-center gap-2">
        <Icon name="heroicons:calendar" class="h-10 w-10 text-muted-foreground/50 mb-2" />
        <h3 class="font-semibold">No Appointments Scheduled</h3>
        <p class="text-sm text-muted-foreground">Your schedule is currently clear.</p>
      </div>
    </div>
  </div>
</template>
