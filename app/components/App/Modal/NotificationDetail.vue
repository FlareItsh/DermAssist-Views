<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import type { AppNotification } from '~/composables/useAppNotifications'

  interface Props {
    modelValue?: boolean
    notification: AppNotification | null
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    notification: null
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'close'): void
    (e: 'invitation-accepted', pivotId: number): void
    (e: 'invitation-declined', pivotId: number): void
  }>()

  const { acceptInvitation, declineInvitation, fetchClinicDoctors } = useDoctorClinicDoctors()
  const { fetchSubscription } = useDoctorSubscription()
  const { readNotifs } = useAppNotifications()

  const isAccepting = ref(false)
  const isDeclining = ref(false)

  const close = () => {
    if (isAccepting.value || isDeclining.value) return
    emit('update:modelValue', false)
    emit('close')
  }

  // Auto-mark notification as read when opened
  watch(() => props.modelValue, (isOpen) => {
    if (isOpen && props.notification?.id !== undefined) {
      const arr = [...(readNotifs.value || [])]
      if (!arr.includes(props.notification.id)) {
        arr.push(props.notification.id)
        readNotifs.value = arr
      }
    }
  })

  const isInvitation = computed(() => props.notification?.type === 'clinic_invitation' && props.notification?.data)
  const inviteData = computed(() => props.notification?.data)

  const formattedRole = computed(() => {
    const role = inviteData.value?.role || 'associate'
    return role.charAt(0).toUpperCase() + role.slice(1)
  })

  const handleAccept = async () => {
    if (!inviteData.value?.pivot_id) return
    isAccepting.value = true
    try {
      await acceptInvitation(inviteData.value.pivot_id)
      toast.success('Invitation accepted! You now have full access under this clinic group.')
      await fetchSubscription()
      await fetchClinicDoctors(true)
      emit('invitation-accepted', inviteData.value.pivot_id)
      close()
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to accept invitation.'
      toast.error(msg)
    } finally {
      isAccepting.value = false
    }
  }

  const handleDecline = async () => {
    if (!inviteData.value?.pivot_id) return
    isDeclining.value = true
    try {
      await declineInvitation(inviteData.value.pivot_id)
      toast.info('Clinic seat invitation declined.')
      await fetchClinicDoctors(true)
      emit('invitation-declined', inviteData.value.pivot_id)
      close()
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to decline invitation.'
      toast.error(msg)
    } finally {
      isDeclining.value = false
    }
  }

  const handleNavigate = () => {
    if (props.notification?.to) {
      close()
      navigateTo(props.notification.to)
    }
  }
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue && notification"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
        aria-modal="true"
        role="dialog"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          @click="close"
        ></div>

        <!-- Dialog Card -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform scale-95 opacity-0 translate-y-4"
          enter-to-class="transform scale-100 opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="transform scale-100 opacity-100 translate-y-0"
          leave-to-class="transform scale-95 opacity-0 translate-y-4"
        >
          <div
            class="bg-card border-border/60 relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl"
          >
            <!-- Header bar with icon and close button -->
            <div class="border-border/40 flex items-center justify-between border-b px-6 py-5">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-8 ring-primary/5 bg-primary/10 text-primary"
                >
                  <Icon
                    :name="notification.icon || 'solar:bell-bing-bold'"
                    class="text-2xl"
                  />
                </div>
                <div>
                  <span class="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                    {{ isInvitation ? 'Doctor Seat Invitation' : (notification.time || 'Notification') }}
                  </span>
                  <h3 class="text-foreground text-lg font-black leading-tight">
                    {{ notification.title }}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                @click="close"
                class="text-muted-foreground hover:text-foreground hover:bg-foreground/5 cursor-pointer rounded-full p-2 transition-colors"
                aria-label="Close modal"
              >
                <Icon name="lucide:x" class="text-xl" />
              </button>
            </div>

            <!-- Content Body -->
            <div class="custom-scrollbar max-h-[70vh] overflow-y-auto p-6 space-y-5">
              <!-- Case 1: Clinic Doctor Invitation -->
              <template v-if="isInvitation">
                <div class="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                  <p class="text-foreground text-sm leading-relaxed">
                    You have been invited to join a clinic group practice as an <strong class="text-primary font-bold">{{ formattedRole }}</strong> doctor.
                  </p>
                </div>

                <!-- Inviting Doctor Profile Box -->
                <div class="border border-border/60 bg-muted/20 rounded-2xl p-4 flex items-center gap-4">
                  <div class="relative shrink-0">
                    <img
                      v-if="inviteData?.owner_avatar_path"
                      :src="inviteData.owner_avatar_path"
                      :alt="inviteData.owner_first_name"
                      class="h-14 w-14 rounded-full object-cover border-2 border-primary/20"
                    />
                    <div
                      v-else
                      class="bg-primary/15 text-primary flex h-14 w-14 items-center justify-center rounded-full text-lg font-black uppercase"
                    >
                      {{ (inviteData?.owner_first_name || 'D').charAt(0) }}
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Invited By (Practice Head)</span>
                    <h4 class="text-foreground font-black text-base truncate">
                      Dr. {{ inviteData?.owner_first_name }} {{ inviteData?.owner_last_name }}
                    </h4>
                    <p v-if="inviteData?.owner_prc_number" class="text-xs text-muted-foreground">
                      PRC: {{ inviteData.owner_prc_number }}
                    </p>
                    <p class="text-xs text-muted-foreground truncate">
                      {{ inviteData?.owner_email }}
                    </p>
                  </div>
                </div>

                <!-- Sponsoring Clinic Location -->
                <div class="border border-border/60 bg-card rounded-2xl p-4 space-y-2">
                  <div class="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                    <Icon name="solar:hospital-bold" class="text-base" />
                    <span>Clinic Assignment</span>
                  </div>
                  <h5 class="text-foreground font-bold text-base">
                    {{ inviteData?.clinic_name }}
                  </h5>
                  <p v-if="inviteData?.clinic_address" class="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                    <Icon name="solar:map-point-linear" class="text-sm shrink-0 mt-0.5" />
                    <span>{{ inviteData.clinic_address }}</span>
                  </p>
                </div>

                <!-- Benefits granted -->
                <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                  <span class="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                    Access Granted Upon Acceptance
                  </span>
                  <ul class="text-xs text-muted-foreground space-y-1.5 list-none m-0 p-0">
                    <li class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle-solid" class="text-emerald-500 text-sm shrink-0" />
                      <span>Full Doctor AI Skin Scanner execution privileges</span>
                    </li>
                    <li class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle-solid" class="text-emerald-500 text-sm shrink-0" />
                      <span>Direct patient teleconsultations & appointment management</span>
                    </li>
                    <li class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle-solid" class="text-emerald-500 text-sm shrink-0" />
                      <span>Electronic medical records & clinical notes generation</span>
                    </li>
                  </ul>
                </div>
              </template>

              <!-- Case 2: General / System / Appointment Notification -->
              <template v-else>
                <p class="text-foreground text-sm sm:text-base leading-relaxed whitespace-pre-line">
                  {{ notification.description }}
                </p>

                <div v-if="notification.time" class="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="solar:clock-circle-linear" class="text-sm" />
                  <span>{{ notification.time }}</span>
                </div>
              </template>
            </div>

            <!-- Footer Actions -->
            <div class="border-border/40 bg-muted/20 flex flex-wrap items-center justify-end gap-3 border-t p-5">
              <!-- Invitation actions -->
              <template v-if="isInvitation">
                <AppButton
                  variant="ghost"
                  @click="close"
                  :disabled="isAccepting || isDeclining"
                >
                  Decide Later
                </AppButton>
                <AppButton
                  variant="outline"
                  class="border-destructive/40 text-destructive hover:bg-destructive/10"
                  :loading="isDeclining"
                  :disabled="isAccepting"
                  @click="handleDecline"
                >
                  <Icon name="solar:close-circle-bold" class="mr-1.5 text-base" />
                  Decline
                </AppButton>
                <AppButton
                  variant="solid"
                  :loading="isAccepting"
                  :disabled="isDeclining"
                  @click="handleAccept"
                >
                  <Icon name="solar:check-circle-bold" class="mr-1.5 text-base" />
                  Accept Invitation
                </AppButton>
              </template>

              <!-- General notification actions -->
              <template v-else>
                <AppButton
                  variant="ghost"
                  @click="close"
                >
                  Close
                </AppButton>
                <AppButton
                  v-if="notification.to"
                  variant="solid"
                  @click="handleNavigate"
                >
                  View Details
                  <Icon name="solar:arrow-right-linear" class="ml-1.5 text-base" />
                </AppButton>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
