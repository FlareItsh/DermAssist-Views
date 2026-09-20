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

  const { getStorageUrl } = useStorage()
  const { acceptInvitation, declineInvitation, fetchClinicDoctors, acknowledgeRevocation } =
    useDoctorClinicDoctors()
  const { fetchSubscription } = useDoctorSubscription()
  const { readNotifs } = useAppNotifications()

  const isAccepting = ref(false)
  const isDeclining = ref(false)
  const isDismissing = ref(false)

  const close = () => {
    if (isAccepting.value || isDeclining.value || isDismissing.value) return
    emit('update:modelValue', false)
    emit('close')
  }

  // Auto-mark notification as read when opened
  watch(
    () => props.modelValue,
    isOpen => {
      if (isOpen && props.notification?.id !== undefined) {
        const arr = [...(readNotifs.value || [])]
        if (!arr.includes(props.notification.id)) {
          arr.push(props.notification.id)
          readNotifs.value = arr
        }
      }
    }
  )

  const isInvitation = computed(
    () => props.notification?.type === 'clinic_invitation' && props.notification?.data
  )
  const inviteData = computed(() => props.notification?.data)
  const isPatchNote = computed(
    () => props.notification?.type === 'patch_note' && props.notification?.data
  )
  const patchNoteData = computed(() => props.notification?.data)

  const isRevocation = computed(
    () => props.notification?.type === 'clinic_revocation' && props.notification?.data
  )
  const revocationData = computed(() => props.notification?.data)

  const formattedRole = computed(() => {
    const role = inviteData.value?.role || 'associate'
    return role.charAt(0).toUpperCase() + role.slice(1)
  })

  const handleDismissRevocation = async () => {
    if (!revocationData.value?.pivot_id) {
      close()
      return
    }
    isDismissing.value = true
    try {
      await acknowledgeRevocation(revocationData.value.pivot_id)
      toast.info('Clinic seat removal acknowledged.')
      await fetchSubscription()
      await fetchClinicDoctors(true)
      close()
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to dismiss notice.'
      toast.error(msg)
    } finally {
      isDismissing.value = false
    }
  }

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
  const userRole = useCookie('user_role')

  const updatesRoute = computed(() => {
    if (userRole.value === 'doctor') return '/doctor/updates'
    if (userRole.value === 'patient') return '/patient/updates'
    return '/updates'
  })

  const handleViewAllUpdates = () => {
    close()
    navigateTo(updatesRoute.value)
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
        class="bg-foreground/50 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        @click.self="close"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <div
            class="bg-card border-border/80 relative w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl"
          >
            <!-- Header -->
            <div
              class="border-border/60 bg-muted/30 flex items-start justify-between gap-4 border-b p-6 pb-5"
            >
              <div class="flex items-start gap-4">
                <div
                  class="ring-primary/5 bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-8"
                >
                  <Icon
                    :name="notification.icon || 'solar:bell-bing-bold'"
                    class="text-2xl"
                  />
                </div>
                <div>
                  <span
                    class="bg-primary/10 text-primary inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                  >
                    {{
                      isInvitation ? 'Doctor Seat Invitation' : notification.time || 'Notification'
                    }}
                  </span>
                  <h3 class="text-foreground text-lg leading-tight font-black">
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
                <Icon
                  name="lucide:x"
                  class="text-xl"
                />
              </button>
            </div>

            <!-- Content Body -->
            <div class="custom-scrollbar max-h-[70vh] space-y-5 overflow-y-auto p-6">
              <!-- Case 1: Clinic Doctor Invitation -->
              <template v-if="isInvitation">
                <div class="bg-primary/5 border-primary/20 rounded-2xl border p-4">
                  <p class="text-foreground text-sm leading-relaxed">
                    You have been invited to join a clinic group practice as an
                    <strong class="text-primary font-bold">{{ formattedRole }}</strong> doctor.
                  </p>
                </div>

                <!-- Inviting Doctor Profile Box -->
                <div
                  class="border-border/60 bg-muted/20 flex items-center gap-4 rounded-2xl border p-4"
                >
                  <div class="relative shrink-0">
                    <img
                      v-if="inviteData?.owner_avatar_path"
                      :src="inviteData.owner_avatar_path"
                      :alt="inviteData.owner_first_name"
                      class="border-primary/20 h-14 w-14 rounded-full border-2 object-cover"
                    />
                    <div
                      v-else
                      class="bg-primary/15 text-primary flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold uppercase"
                    >
                      {{ (inviteData?.owner_first_name || 'D').charAt(0) }}
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <span
                      class="text-muted-foreground block text-[11px] font-bold tracking-wider uppercase"
                      >Invited By (Practice Head)</span
                    >
                    <h4 class="text-foreground truncate text-base font-black">
                      Dr. {{ inviteData?.owner_first_name }} {{ inviteData?.owner_last_name }}
                    </h4>
                    <p
                      v-if="inviteData?.owner_prc_number"
                      class="text-muted-foreground text-xs"
                    >
                      PRC: {{ inviteData.owner_prc_number }}
                    </p>
                    <p class="text-muted-foreground truncate text-xs">
                      {{ inviteData?.owner_email }}
                    </p>
                  </div>
                </div>

                <!-- Sponsoring Clinic Location -->
                <div class="border-border/60 bg-card space-y-2 rounded-2xl border p-4">
                  <div
                    class="text-primary flex items-center gap-2 text-xs font-bold tracking-wider uppercase"
                  >
                    <Icon
                      name="solar:hospital-bold"
                      class="text-base"
                    />
                    <span>Clinic Assignment</span>
                  </div>
                  <h5 class="text-foreground text-base font-bold">
                    {{ inviteData?.clinic_name }}
                  </h5>
                  <p
                    v-if="inviteData?.clinic_address"
                    class="text-muted-foreground flex items-start gap-1.5 text-xs leading-relaxed"
                  >
                    <Icon
                      name="solar:map-point-linear"
                      class="mt-0.5 shrink-0 text-sm"
                    />
                    <span>{{ inviteData.clinic_address }}</span>
                  </p>
                </div>

                <!-- Benefits granted -->
                <div
                  class="space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"
                >
                  <span
                    class="block text-[11px] font-black tracking-wider text-emerald-600 uppercase dark:text-emerald-400"
                  >
                    Access Granted Upon Acceptance
                  </span>
                  <ul class="text-muted-foreground m-0 list-none space-y-1.5 p-0 text-xs">
                    <li class="flex items-center gap-2">
                      <Icon
                        name="heroicons:check-circle-solid"
                        class="shrink-0 text-sm text-emerald-500"
                      />
                      <span>Full Doctor AI Skin Scanner execution privileges</span>
                    </li>
                    <li class="flex items-center gap-2">
                      <Icon
                        name="heroicons:check-circle-solid"
                        class="shrink-0 text-sm text-emerald-500"
                      />
                      <span>Direct patient teleconsultations & appointment management</span>
                    </li>
                    <li class="flex items-center gap-2">
                      <Icon
                        name="heroicons:check-circle-solid"
                        class="shrink-0 text-sm text-emerald-500"
                      />
                      <span>Electronic medical records & clinical notes generation</span>
                    </li>
                  </ul>
                </div>
              </template>

              <!-- Case 2: Clinic Revocation Notification -->
              <template v-else-if="isRevocation">
                <!-- Revoked Practice Head Info -->
                <div
                  class="border-border/60 bg-card flex items-center gap-3.5 rounded-2xl border p-4"
                >
                  <div class="relative shrink-0">
                    <img
                      v-if="revocationData?.owner_avatar_path"
                      :src="getStorageUrl(revocationData.owner_avatar_path)"
                      alt="Clinic Owner Avatar"
                      class="border-border h-14 w-14 rounded-full border object-cover"
                    />
                    <div
                      v-else
                      class="bg-destructive/15 text-destructive flex h-14 w-14 items-center justify-center rounded-full text-lg font-black uppercase"
                    >
                      {{ (revocationData?.owner_first_name || 'D').charAt(0) }}
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <span
                      class="text-muted-foreground block text-[11px] font-bold tracking-wider uppercase"
                      >Clinic Owner</span
                    >
                    <h4 class="text-foreground truncate text-base font-black">
                      Dr. {{ revocationData?.owner_first_name }}
                      {{ revocationData?.owner_last_name }}
                    </h4>
                    <p
                      v-if="revocationData?.owner_prc_number"
                      class="text-muted-foreground text-xs"
                    >
                      PRC: {{ revocationData.owner_prc_number }}
                    </p>
                    <p class="text-muted-foreground truncate text-xs">
                      {{ revocationData?.owner_email }}
                    </p>
                  </div>
                </div>

                <!-- Clinic Location Info -->
                <div class="border-border/60 bg-card space-y-2 rounded-2xl border p-4">
                  <div
                    class="text-destructive flex items-center gap-2 text-xs font-bold tracking-wider uppercase"
                  >
                    <Icon
                      name="solar:hospital-bold"
                      class="text-base"
                    />
                    <span>Seat Removal</span>
                  </div>
                  <h5 class="text-foreground text-base font-bold">
                    {{ revocationData?.clinic_name }}
                  </h5>
                  <p
                    v-if="revocationData?.clinic_address"
                    class="text-muted-foreground flex items-start gap-1.5 text-xs leading-relaxed"
                  >
                    <Icon
                      name="solar:map-point-linear"
                      class="mt-0.5 shrink-0 text-sm"
                    />
                    <span>{{ revocationData.clinic_address }}</span>
                  </p>
                </div>

                <!-- Explanatory Notice -->
                <div class="space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <span
                    class="block text-[11px] font-black tracking-wider text-amber-600 uppercase dark:text-amber-400"
                  >
                    Access Notice
                  </span>
                  <p class="text-muted-foreground text-xs leading-relaxed">
                    You have been removed from this clinic seat. You will no longer inherit
                    subscription benefits from Dr. {{ revocationData?.owner_first_name }}
                    {{ revocationData?.owner_last_name }}'s plan. All of your personal medical
                    records, consultations, and patient history remain intact.
                  </p>
                </div>
              </template>

              <!-- Case 3: Patch Note Notification -->
              <template v-else-if="isPatchNote">
                <div class="bg-primary/5 border-primary/20 rounded-2xl border p-4">
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <span
                      v-if="patchNoteData?.version"
                      class="bg-primary/15 text-primary border-primary/20 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium"
                    >
                      <Icon
                        name="solar:tag-bold"
                        class="text-xs"
                      />
                      {{ patchNoteData.version }}
                    </span>
                    <span
                      v-if="notification.time"
                      class="text-muted-foreground text-xs"
                    >
                      {{ notification.time }}
                    </span>
                  </div>
                  <h4 class="text-foreground text-base font-semibold">
                    {{ patchNoteData?.title }}
                  </h4>
                  <p
                    class="text-muted-foreground mt-2 text-sm leading-relaxed font-normal whitespace-pre-line"
                  >
                    {{ patchNoteData?.description }}
                  </p>
                </div>

                <!-- Changes / Features list if available -->
                <div
                  v-if="patchNoteData?.changes && patchNoteData.changes.length > 0"
                  class="border-border/60 bg-muted/20 space-y-2.5 rounded-2xl border p-4"
                >
                  <div
                    class="text-primary flex items-center gap-2 text-xs font-semibold tracking-wider uppercase"
                  >
                    <Icon
                      name="solar:stars-minimalistic-bold"
                      class="text-sm"
                    />
                    <span>What's New & Improvements</span>
                  </div>
                  <ul class="text-foreground m-0 list-none space-y-2 p-0 text-xs">
                    <li
                      v-for="(change, idx) in patchNoteData.changes"
                      :key="idx"
                      class="flex items-start gap-2"
                    >
                      <Icon
                        name="heroicons:check-badge-solid"
                        class="text-primary mt-0.5 shrink-0 text-sm"
                      />
                      <span class="leading-relaxed font-normal">{{ change }}</span>
                    </li>
                  </ul>
                </div>
              </template>

              <!-- Case 4: General / System / Appointment Notification -->
              <template v-else>
                <p class="text-foreground text-sm leading-relaxed whitespace-pre-line sm:text-base">
                  {{ notification.description }}
                </p>

                <div
                  v-if="notification.time"
                  class="text-muted-foreground flex items-center gap-2 text-xs"
                >
                  <Icon
                    name="solar:clock-circle-linear"
                    class="text-sm"
                  />
                  <span>{{ notification.time }}</span>
                </div>
              </template>
            </div>

            <!-- Footer Actions -->
            <div
              class="border-border/40 bg-muted/20 flex flex-wrap items-center justify-end gap-3 border-t p-5"
            >
              <!-- Revocation actions -->
              <template v-if="isRevocation">
                <AppButton
                  variant="solid"
                  :loading="isDismissing"
                  @click="handleDismissRevocation"
                >
                  <Icon
                    name="solar:check-circle-bold"
                    class="mr-1.5 text-base"
                  />
                  Acknowledge & Dismiss
                </AppButton>
              </template>

              <!-- Invitation actions -->
              <template v-else-if="isInvitation">
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
                  <Icon
                    name="solar:close-circle-bold"
                    class="mr-1.5 text-base"
                  />
                  Decline
                </AppButton>
                <AppButton
                  variant="solid"
                  :loading="isAccepting"
                  :disabled="isDeclining"
                  @click="handleAccept"
                >
                  <Icon
                    name="solar:check-circle-bold"
                    class="mr-1.5 text-base"
                  />
                  Accept Invitation
                </AppButton>
              </template>

              <!-- Patch note actions -->
              <template v-else-if="isPatchNote">
                <AppButton
                  variant="ghost"
                  @click="close"
                >
                  Close
                </AppButton>
                <AppButton
                  variant="outline"
                  @click="handleViewAllUpdates"
                >
                  <Icon
                    name="solar:notes-bold-duotone"
                    class="mr-1.5 text-base"
                  />
                  View All Updates
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
                  <Icon
                    name="solar:arrow-right-linear"
                    class="ml-1.5 text-base"
                  />
                </AppButton>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
