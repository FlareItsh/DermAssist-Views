<script setup lang="ts">
  defineProps<{
    doctorImage: string
    doctorName: string
    doctorWorkplace: string
  }>()
</script>

<template>
  <div class="bg-card flex w-55 flex-col justify-between rounded-3xl border-3 border-gray-100 p-3">
    <img
      :src="doctorImage"
      alt="Doctor"
      class="h-30 w-50 rounded-2xl object-cover shadow-sm"
    />

    <div class="mt-5">
      <p class="text-xs font-medium text-gray-400 uppercase">
        {{ doctorWorkplace }}
      </p>
      <h1 class="text-foreground mt-1 text-lg leading-4 font-bold">
        {{ doctorName }}
      </h1>
    </div>

    <div class="text-secondary mt-8 flex w-full justify-end gap-3">
      <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
        class="border-primary hover:bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full border-[3px]"
      >
        <Icon
          name="famicons:call"
          size="22"
        />
      </AppButton>
      <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
        class="border-primary hover:bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full border-[3px]"
      >
        <Icon
          name="mingcute:message-4-line"
          size="22"
        />
      </AppButton>
    </div>
  </div>
</template>
