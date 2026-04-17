<script setup lang="ts">
  interface Props {
    isCameraOn: boolean
    isScanning: boolean
    hasQualityError: boolean
  }

  const props = defineProps<Props>()

  const emit = defineEmits<{
    (e: 'toggleCamera'): void
    (e: 'triggerFile'): void
    (e: 'scan'): void
  }>()
</script>

<template>
  <div class="absolute bottom-0 left-0 flex w-full justify-end">
    <div class="bg-primary overflow-hidden rounded-tl-3xl p-2">
      <div class="flex h-15 w-84 items-end justify-end gap-2 backdrop-blur-md">
        <!-- Camera Toggle -->
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          @click="emit('toggleCamera')"
          :disabled="isScanning"
          class="flex h-14 w-19 items-center justify-center rounded-l-full bg-white shadow-lg transition-all hover:bg-gray-100 disabled:opacity-50"
          :class="{ 'text-destructive': !isCameraOn, 'text-primary': isCameraOn }"
        >
          <Icon :name="isCameraOn ? 'material-symbols:videocam-rounded' : 'material-symbols:videocam-off-rounded'" class="text-3xl" />
        </AppButton>

        <!-- File Upload -->
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          @click="emit('triggerFile')"
          :disabled="isScanning"
          class="flex h-14 w-17 items-center justify-center bg-white shadow-lg transition-all hover:bg-gray-100 disabled:opacity-50"
        >
          <Icon name="famicons:folder-outline" class="text-3xl" />
        </AppButton>

        <!-- Scan Button -->
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          @click="emit('scan')"
          :disabled="isScanning || hasQualityError || !isCameraOn"
          class="flex h-14 w-fit items-center justify-center rounded-r-full bg-white px-8 text-2xl font-bold shadow-lg transition-all hover:bg-gray-100 disabled:opacity-50"
          :class="{ 'bg-green-50 text-green-700': isCameraOn && !hasQualityError && !isScanning }"
        >
          {{ isScanning ? '...' : 'Scan' }}
          <Icon name="material-symbols-light:camera-outline-rounded" class="ml-2 text-4xl" />
        </AppButton>
      </div>
    </div>
  </div>
</template>
