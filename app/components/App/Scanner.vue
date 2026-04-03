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
        <h1 class="bg-foreground text-destructive mt-5 w-fit rounded-t-3xl px-30 py-3 text-center text-3xl font-bold">
          Message Here
        </h1>

        <input type="file" ref="fileInput" accept="image/*" class="hidden" @change="handleFileUpload" />

        <div class="bg-black relative flex flex-1 w-full flex-col overflow-hidden rounded-3xl rounded-br-none shrink-0">

          <video ref="videoRef" autoplay playsinline class="h-150 w-full p-5 rounded-4xl object-cover"></video>

          <div class="absolute bottom-0 left-0 flex w-full justify-end">
            <div class="bg-primary rounded-tl-3xl overflow-hidden p-2">
              <div class="flex h-15 w-55 gap-2 items-end justify-end backdrop-blur-md transition-all">
                <button @click="triggerFileInput"
                  class="h-14 w-14 rounded-l-full flex items-center justify-center bg-white shadow-lg cursor-pointer hover:bg-gray-100 active:scale-95 transition-all">
                  <Icon name="famicons:folder-outline" class="text-3xl" />
                </button>

                <button
                  class="h-14 px-5 w-fit flex items-center justify-center text-2xl font-bold rounded-r-full bg-white shadow-lg cursor-pointer hover:bg-gray-100 active:scale-95 transition-all">
                  Scan
                  <Icon name="material-symbols-light:camera-outline-rounded" class="text-4xl ml-2" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
