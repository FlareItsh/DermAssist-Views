<script setup lang="ts">
  import { ref, watch, computed, onMounted } from 'vue'
  import { appointmentService } from '~/api/appointment/AppointmentService'

  const props = defineProps<{
    conversation: any
  }>()

  const messageTerm = ref('')
  const mockMessages = ref([
    {
      id: 1,
      text: 'Hello',
      sentByMe: true,
      avatar: '/images/lp-img.png'
    },
    {
      id: 2,
      text: "Hello i'm here to help",
      sentByMe: false,
      avatar: '/images/lp-img.png'
    }
  ])

  watch(
    () => props.conversation?.id,
    () => {
      if (props.conversation) {
        mockMessages.value[1].text = `Hello I'm ${props.conversation.name}`
      }
    },
    { immediate: true }
  )

  const sendMessage = () => {
    if (!messageTerm.value.trim()) return
    // Handle sending here later
    messageTerm.value = ''
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }
  const userRole = useCookie('user_role')
  const { appointments, fetchAppointments } = useAppointments()
  
  const activeAppointment = computed(() => {
    if (!props.conversation) return null
    return appointments.value.find(a => 
      a.conversation_uuid === props.conversation.uuid || 
      a.id === props.conversation.id ||
      a.id === props.conversation.uuid
    )
  })

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0]
    return dateStr === today
  }

  const showCompleteConfirm = ref(false)
  const isCompleting = ref(false)

  onMounted(() => {
    fetchAppointments()
  })

  const completeAppointment = async () => {
    if (!activeAppointment.value) return
    isCompleting.value = true
    try {
      await appointmentService.update(activeAppointment.value.id, { status: 'completed' })
      showCompleteConfirm.value = false
      fetchAppointments()
    } catch (e) {
      console.error(e)
    } finally {
      isCompleting.value = false
    }
  }
</script>

<template>
  <div
    class="bg-card flex h-full flex-col"
    v-if="conversation"
  >
    <div class="border-border flex items-center justify-between border-b px-8 py-6">
      <h2 class="text-foreground text-3xl font-bold">{{ conversation.name }}</h2>
      <AppButton variant="unstyled" size="unstyled" rounded="unstyled" class="text-foreground/40 hover:text-primary cursor-pointer transition-colors">
        <Icon
          name="solar:menu-dots-vertical-bold"
          class="text-3xl"
        />
      </AppButton>
    </div>

    <!-- Active Appointment Bar -->
    <div v-if="activeAppointment && activeAppointment.status === 'scheduled'" 
      class="border-b p-4 flex items-center justify-between transition-all"
      :class="[
        isToday(activeAppointment.date) 
          ? 'bg-amber-50 border-amber-100' 
          : 'bg-indigo-50 border-indigo-100'
      ]"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-full" :class="isToday(activeAppointment.date) ? 'bg-amber-100' : 'bg-indigo-100'">
          <Icon 
            :name="isToday(activeAppointment.date) ? 'material-symbols:alarm-on-outline-rounded' : 'material-symbols:calendar-clock-outline-rounded'" 
            class="text-xl"
            :class="isToday(activeAppointment.date) ? 'text-amber-600' : 'text-indigo-600'"
          />
        </div>
        <div>
          <p class="text-sm font-bold" :class="isToday(activeAppointment.date) ? 'text-amber-900' : 'text-indigo-900'">
            {{ isToday(activeAppointment.date) ? 'Appointment Today!' : 'Upcoming Appointment' }}
          </p>
          <p class="text-xs font-medium" :class="isToday(activeAppointment.date) ? 'text-amber-700' : 'text-indigo-700'">
            {{ isToday(activeAppointment.date) ? 'Your appointment is scheduled for today' : activeAppointment.date }} at {{ activeAppointment.time }}
          </p>
        </div>
      </div>
      
      <div v-if="userRole?.toLowerCase() === 'doctor'">
        <AppButton @click="showCompleteConfirm = true" class="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2">
          <Icon name="material-symbols:check-circle-rounded" class="text-lg" />
          Mark as Accomplished
        </AppButton>
      </div>
    </div>

    <!-- Messages Area -->
    <div class="custom-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      <div
        v-for="msg in mockMessages"
        :key="msg.id"
        class="flex items-end gap-4"
        :class="msg.sentByMe ? 'flex-row-reverse' : 'flex-row'"
      >
        <div class="border-border/50 h-12 w-12 shrink-0 overflow-hidden rounded-full border">
          <img
            :src="msg.avatar"
            class="h-full w-full object-cover"
          />
        </div>

        <div
          class="max-w-[70%] px-6 py-3 transition-all"
          :class="[
            msg.sentByMe
              ? 'bg-primary shadow-primary/10 rounded-t-3xl rounded-bl-3xl text-white shadow-lg'
              : 'bg-primary/30 text-foreground rounded-t-3xl rounded-br-3xl'
          ]"
        >
          <p class="text-xl leading-relaxed">{{ msg.text }}</p>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="p-8 pt-0">
      <div class="group relative flex items-end">
        <textarea
          v-model="messageTerm"
          placeholder="Your message"
          @keydown="handleKeydown"
          class="bg-foreground/5 focus:border-primary/20 focus:ring-primary/5 custom-scrollbar h-17 w-full resize-none rounded-2xl border border-transparent px-15 py-5 text-lg transition-all outline-none focus:ring-4"
        ></textarea>

        <div class="absolute top-1/2 left-6 -translate-y-1/2">
          <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
            class="text-foreground/30 hover:text-primary flex cursor-pointer items-center justify-center transition-colors"
          >
            <Icon
              name="material-symbols:link-rounded"
              class="text-foreground/60 text-3xl"
            />
          </AppButton>
        </div>

        <div class="absolute top-1/2 right-6 -translate-y-1/2">
          <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
            @click="sendMessage"
            class="text-foreground/40 hover:text-primary group-focus-within:text-primary flex cursor-pointer items-center justify-center p-2 transition-colors"
          >
            <Icon
              name="tabler:send"
              class="text-secondary text-3xl"
            />
          </AppButton>
        </div>
      </div>
    </div>
  </div>
  <div
    v-else
    class="bg-muted/5 flex flex-1 items-center justify-center"
  >
    <div class="text-foreground/20 text-center">
      <Icon
        name="solar:chat-round-line-linear"
        class="mb-4 text-9xl"
      />
      <p class="text-2xl font-bold">Select a conversation to start chatting</p>
    </div>
  </div>

  <!-- Complete Appointment Confirmation Modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showCompleteConfirm"
        class="bg-foreground/40 fixed inset-0 z-[1000] flex items-center justify-center p-4"
        @click.self="showCompleteConfirm = false"
      >
        <div class="modal-container bg-card border-border w-full max-w-md overflow-hidden rounded-3xl border p-8 shadow-2xl">
          <div class="mb-6 flex flex-col items-center text-center">
            <div class="bg-indigo-100 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <Icon name="material-symbols:check-circle-outline-rounded" class="text-4xl text-indigo-600" />
            </div>
            <h3 class="text-2xl font-bold">Complete Appointment?</h3>
            <p class="text-foreground/60 mt-2">
              Are you sure you want to mark this appointment as completed? This will move it to the patient's records.
            </p>
          </div>

          <div class="flex flex-col gap-3">
            <AppButton
              variant="solid"
              class="bg-indigo-600 text-white hover:bg-indigo-700"
              :disabled="isCompleting"
              @click="completeAppointment"
            >
              {{ isCompleting ? 'Completing...' : 'Yes, Complete Appointment' }}
            </AppButton>
            <AppButton
              variant="unstyled"
              class="bg-foreground/5 text-foreground/70 font-bold transition-all hover:bg-foreground/10"
              @click="showCompleteConfirm = false"
            >
              Cancel
            </AppButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--primary), 0.1);
    border-radius: 10px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(var(--primary), 0.2);
  }
</style>
