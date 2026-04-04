<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'

  const videoRef = ref<HTMLVideoElement | null>(null)
  const errorMessage = ref('')
  const fileInput = ref<HTMLInputElement | null>(null) // Ref for the hidden input
  let stream: MediaStream | null = null

  const triggerFileInput = () => {
    if (fileInput.value) {
      fileInput.value.click()
    }
  }

  const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
      const file = target.files[0]
      console.log('User selected file:', file)
      // TODO: You can pass this 'file' variable to your backend or ML model here
    }
  }

  const startCamera = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })

      // Attach stream to the video element
      if (videoRef.value) {
        videoRef.value.srcObject = stream
      }
    } catch (err: any) {
      console.error('Camera access error:', err)
      errorMessage.value = 'Could not access the camera. Please ensure permissions are granted.'
    }
  }

  const stopCamera = () => {
    if (stream) {
      // Stop all video tracks when the component closes
      stream.getTracks().forEach(track => track.stop())
    }
  }

  onMounted(() => {
    startCamera()
  })

  onUnmounted(() => {
    stopCamera()
  })
</script>

<template>
  <div>
    <div class="bg-primary flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-3xl">
      <div class="mx-10 mb-10 flex flex-1 flex-col items-center">
        <h1
          class="bg-foreground text-destructive mt-5 w-fit rounded-t-3xl px-30 py-3 text-center text-3xl font-bold"
        >
          Message Here
        </h1>

        <input
          type="file"
          ref="fileInput"
          accept="image/*"
          class="hidden"
          @change="handleFileUpload"
        />

        <div
          class="relative flex w-full flex-1 shrink-0 flex-col overflow-hidden rounded-3xl rounded-br-none bg-black"
        >
          <video
            ref="videoRef"
            autoplay
            playsinline
            class="h-150 w-full rounded-4xl object-cover p-5"
          ></video>

          <div class="absolute bottom-0 left-0 flex w-full justify-end">
            <div class="bg-primary overflow-hidden rounded-tl-3xl p-2">
              <div
                class="flex h-15 w-55 items-end justify-end gap-2 backdrop-blur-md transition-all"
              >
                <button
                  @click="triggerFileInput"
                  class="flex h-14 w-14 cursor-pointer items-center justify-center rounded-l-full bg-white shadow-lg transition-all hover:bg-gray-100 active:scale-95"
                >
                  <Icon
                    name="famicons:folder-outline"
                    class="text-3xl"
                  />
                </button>

                <button
                  class="flex h-14 w-fit cursor-pointer items-center justify-center rounded-r-full bg-white px-5 text-2xl font-bold shadow-lg transition-all hover:bg-gray-100 active:scale-95"
                >
                  Scan
                  <Icon
                    name="material-symbols-light:camera-outline-rounded"
                    class="ml-2 text-4xl"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
