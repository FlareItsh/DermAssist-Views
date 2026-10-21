<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useRouter } from '#app'
  import { toast } from 'vue-sonner'
  import { conversationService } from '~/api/conversation/ConversationService'
  import { appointmentService } from '~/api/appointment/AppointmentService'

  const props = defineProps<{
    doctorId: string | number
    doctorImage?: string
    doctorName: string
    doctorWorkplace: string
  }>()

  const router = useRouter()
  const isStartingConversation = ref(false)
  const isBooking = ref(false)
  const showConfirmBooking = ref(false)
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

  const promptDirectBooking = () => {
    showConfirmBooking.value = true
  }

  const confirmDirectBooking = async () => {
    isBooking.value = true
    try {
      const res = await appointmentService.create({
        doctor_id: props.doctorId,
        source: 'direct'
      })
      toast.success(`Appointment request submitted to ${props.doctorName}!`)
      showConfirmBooking.value = false
      const convUuid = res?.conversation_uuid || res?.conversation?.uuid
      if (convUuid) {
        router.push(`/Patient/Messages/${convUuid}`)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err?.data?.message || err?.message || 'Failed to submit appointment request.')
    } finally {
      isBooking.value = false
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
    </div>

    <div class="mt-5">
      <p class="text-xs font-medium text-gray-400 uppercase">
        {{ doctorWorkplace }}
      </p>
      <h1 class="text-foreground mt-1 text-lg leading-4 font-bold">
        {{ doctorName }}
      </h1>
    </div>

    <div class="text-secondary mt-8 flex w-full items-center justify-end gap-2.5">
      <AppButton
        variant="unstyled"
        size="unstyled"
        rounded="unstyled"
        class="border-primary text-primary hover:bg-primary flex h-10 w-10 items-center justify-center rounded-full border-[2.5px] transition-all hover:text-white active:scale-95"
        @click.stop="promptDirectBooking"
        :disabled="isBooking"
        title="Book Appointment"
      >
        <Icon
          name="material-symbols:calendar-add-on-rounded"
          size="20"
          v-if="!isBooking"
        />
        <Icon
          name="mingcute:loading-line"
          size="20"
          class="animate-spin"
          v-else
        />
      </AppButton>
      <AppButton
        variant="unstyled"
        size="unstyled"
        rounded="unstyled"
        class="border-primary text-primary hover:bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full border-[2.5px] transition-all active:scale-95"
        @click="startConversation"
        :disabled="isStartingConversation"
        title="Send Message"
      >
        <Icon
          name="mingcute:message-4-line"
          size="20"
          v-if="!isStartingConversation"
        />
        <Icon
          name="mingcute:loading-line"
          size="20"
          class="animate-spin"
          v-else
        />
      </AppButton>
    </div>

    <!-- Direct Booking Confirmation Modal -->
    <AppModalConfirmation
      v-if="showConfirmBooking"
      v-model="showConfirmBooking"
      title="Request Clinical Appointment"
      :description="`Would you like to request an appointment with ${doctorName}? This submits a direct consultation request to the doctor's practice without attaching any skin scans.`"
      confirm-text="Request Appointment"
      cancel-text="Cancel"
      icon="solar:calendar-add-bold"
      icon-color="primary"
      confirm-variant="solid"
      :loading="isBooking"
      @confirm="confirmDirectBooking"
      @cancel="showConfirmBooking = false"
    />
  </div>
</template>
