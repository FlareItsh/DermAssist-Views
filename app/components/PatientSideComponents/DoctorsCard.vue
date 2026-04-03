<script setup lang="ts">
defineProps<{
  doctorImage: string
  doctorName: string
  doctorWorkplace: string
}>()
</script>

<template>
  <div class="bg-card flex w-fit flex-col justify-between rounded-3xl border-3 border-gray-100 p-3 ">
    <NuxtImg :src="doctorImage" alt="Doctor" class="h-30 w-50 rounded-2xl object-cover shadow-sm" />

    <div class="mt-5">
      <p class="text-gray-400 text-xs font-medium uppercase">
        {{ doctorWorkplace }}
      </p>
      <h1 class="text-foreground mt-1 text-lg font-bold leading-4">
        {{ doctorName }}
      </h1>
    </div>

    <div class="mt-8 flex w-full justify-end gap-3 text-secondary">
      <button
        class="border-primary hover:bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full border-[3px] transition-all active:scale-90">
        <Icon name="famicons:call" size="22" />
      </button>
      <button
        class="border-primary hover:bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full border-[3px] transition-all active:scale-90">
        <Icon name="mingcute:message-4-line" size="22" />
      </button>
    </div>
  </div>
</template>
