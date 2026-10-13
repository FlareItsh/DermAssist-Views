<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useRouter } from '#app'
  import { conversationService } from '~/api/conversation/ConversationService'

  const props = defineProps<{
    doctorId: string | number
    doctorImage?: string
    doctorName: string
    doctorWorkplace: string
  }>()

  const router = useRouter()
  const isStartingConversation = ref(false)
  const imageError = ref(false)

  const handleImageError = () => {
    imageError.value = true
  }

  const hasCustomImage = computed(() => {
    return !!props.doctorImage && props.doctorImage !== '/images/lp-img.png' && !imageError.value
  })

  const startConversation = async () => {
    if (isStartingConversation.value) return
    isStartingConversation.value = true
    try {
      const res = await conversationService.create({ doctor_id: props.doctorId })
      const uuid = res?.data?.id || res?.id || res?.data?.uuid || res?.uuid
      if (uuid) {
        router.push(`/Patient/Messages/${uuid}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      isStartingConversation.value = false
    }
  }
</script>

<template>
  <div class="bg-card flex w-55 flex-col justify-between rounded-3xl border-3 border-gray-100 p-3">
    <!-- Doctor Avatar / Profile Badge -->
    <div
      v-if="hasCustomImage"
      class="h-30 w-full overflow-hidden rounded-2xl border border-gray-100 shadow-xs"
    >
      <img
        :src="doctorImage"
        :alt="doctorName"
        @error="handleImageError"
        class="h-full w-full object-cover"
      />
    </div>
    <div
      v-else
      class="from-primary/15 via-primary/10 to-primary/5 border-primary/20 text-primary relative flex h-30 w-full flex-col items-center justify-center rounded-2xl border bg-gradient-to-br shadow-xs"
    >
      <div
        class="bg-card text-primary border-primary/25 flex size-14 items-center justify-center rounded-full border shadow-sm"
      >
        <Icon
          name="solar:user-bold-duotone"
          class="size-8"
        />
      </div>
      <div
        class="bg-primary text-primary-foreground absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-lg shadow-xs"
      >
        <Icon
          name="lucide:stethoscope"
          class="size-3.5"
        />
      </div>
    </div>

    <div class="mt-5">
      <p class="text-xs font-medium text-gray-400 uppercase">
        {{ doctorWorkplace }}
      </p>
      <h1 class="text-foreground mt-1 text-lg leading-4 font-bold">
        {{ doctorName }}
      </h1>
    </div>

    <div class="text-secondary mt-8 flex w-full justify-end gap-3">
      <!-- <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
        class="border-primary hover:bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full border-[3px]"
      >
        <Icon
          name="famicons:call"
          size="22"
        />
      </AppButton> -->
      <AppButton
        variant="unstyled"
        size="unstyled"
        rounded="unstyled"
        class="border-primary hover:bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full border-[3px]"
        @click="startConversation"
        :disabled="isStartingConversation"
      >
        <Icon
          name="mingcute:message-4-line"
          size="22"
          v-if="!isStartingConversation"
        />
        <Icon
          name="mingcute:loading-line"
          size="22"
          class="animate-spin"
          v-else
        />
      </AppButton>
    </div>
  </div>
</template>
