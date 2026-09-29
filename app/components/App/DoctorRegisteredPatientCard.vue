<script setup lang="ts">
  import { ref } from 'vue'
  import { userService } from '~/api/user/UserService'
  import { useStorage } from '~/composables/useStorage'
  import { toast } from 'vue-sonner'

  const props = defineProps<{
    patient: any
  }>()

  const emit = defineEmits(['refresh'])

  const { getStorageUrl } = useStorage()
  const isActionLoading = ref(false)
  const isScheduling = ref(false)
  const getTodayStr = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getCurrentTimeStr = () => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  }

  const isTimePassedToday = (timeVal: string) => {
    if (scheduleDateOnly.value !== getTodayStr()) return false
    return timeVal <= getCurrentTimeStr()
  }

  const availableTimeOptions = [
    { value: '08:00', label: '08:00 AM' },
    { value: '09:00', label: '09:00 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '11:00', label: '11:00 AM' },
    { value: '12:00', label: '12:00 PM' },
    { value: '13:00', label: '01:00 PM' },
    { value: '14:00', label: '02:00 PM' },
    { value: '15:00', label: '03:00 PM' },
    { value: '16:00', label: '04:00 PM' },
    { value: '17:00', label: '05:00 PM' },
    { value: '18:00', label: '06:00 PM' },
    { value: '23:59', label: '11:59 PM' }
  ]

  const scheduleDateOnly = ref(getTodayStr())
  const scheduleTimeOnly = ref('09:00')
  const scheduleAction = ref('delete')

  const showDisableModal = ref(false)
  const showDeleteModal = ref(false)

  const openScheduling = () => {
    if (!scheduleDateOnly.value) {
      scheduleDateOnly.value = getTodayStr()
    }
    isScheduling.value = true
  }

  const handleEnable = async () => {
    isActionLoading.value = true
    try {
      await userService.enablePatient(props.patient.uuid)
      toast.success('Patient account activated.')
      emit('refresh')
    } catch (e) {
      console.error(e)
      toast.error('Failed to activate patient account.')
    } finally {
      isActionLoading.value = false
    }
  }

  const confirmDisable = async () => {
    isActionLoading.value = true
    try {
      await userService.disablePatient(props.patient.uuid)
      toast.success('Patient account deactivated.')
      showDisableModal.value = false
      emit('refresh')
    } catch (e) {
      console.error(e)
      toast.error('Failed to deactivate patient account.')
    } finally {
      isActionLoading.value = false
    }
  }

  const confirmDelete = async () => {
    isActionLoading.value = true
    try {
      await userService.deleteDoctorPatient(props.patient.uuid)
      toast.success('Patient account deleted.')
      showDeleteModal.value = false
      emit('refresh')
    } catch (e) {
      console.error(e)
      toast.error('Failed to delete patient account.')
    } finally {
      isActionLoading.value = false
    }
  }

  const scheduleError = ref<string | null>(null)

  const handleSchedule = async () => {
    if (!scheduleDateOnly.value) {
      scheduleError.value = 'Please select a date.'
      return
    }

    const selectedDateTime = new Date(`${scheduleDateOnly.value}T${scheduleTimeOnly.value}:00`)
    if (selectedDateTime <= new Date()) {
      scheduleError.value = 'Auto-deletion schedule date & time must be in the future.'
      return
    }

    scheduleError.value = null
    isActionLoading.value = true
    try {
      const dateTimeStr = `${scheduleDateOnly.value} ${scheduleTimeOnly.value}:00`
      await userService.scheduleAccountAction(props.patient.uuid, {
        action: scheduleAction.value || 'delete',
        scheduled_at: dateTimeStr
      })
      toast.success('Auto-action scheduled successfully.')
      isScheduling.value = false
      emit('refresh')
    } catch (e: any) {
      console.error('Failed to schedule action:', e)
      const err =
        e?.data?.message || e?.response?._data?.message || 'Failed to schedule auto-deletion.'
      scheduleError.value = err
      toast.error(err)
    } finally {
      isActionLoading.value = false
    }
  }

  const handleCancelSchedule = async () => {
    isActionLoading.value = true
    try {
      await userService.cancelScheduledAction(props.patient.uuid)
      toast.success('Scheduled auto-action canceled.')
      emit('refresh')
    } catch (e) {
      console.error(e)
      toast.error('Failed to cancel scheduled action.')
    } finally {
      isActionLoading.value = false
    }
  }

  const statusColor = computed(() => {
    return props.patient.account_status === 'active'
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700'
  })

  const formatSchedule = (dateString: string) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }
</script>

<template>
  <div
    class="group relative col-span-1 flex flex-col gap-6 overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:col-span-2 md:flex-row md:items-center md:justify-between"
  >
    <div
      class="absolute top-0 bottom-0 left-0 my-8 w-1 rounded-3xl"
      :class="props.patient.account_status === 'active' ? 'bg-green-500' : 'bg-red-500'"
    ></div>

    <div class="flex items-center gap-5">
      <img
        :src="
          patient.avatar_path
            ? getStorageUrl(patient.avatar_path)
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.first_name + '+' + patient.last_name)}&background=7B5EF5&color=fff&size=128`
        "
        class="h-20 w-20 shrink-0 rounded-2xl border border-gray-100 bg-gray-50 object-cover"
      />
      <div>
        <h3 class="line-clamp-1 text-lg font-bold text-gray-900">
          {{ patient.first_name }} {{ patient.last_name }}
        </h3>
        <p class="mt-1 flex items-center gap-2 text-xs text-gray-500">
          <span>{{ patient.age || 'N/A' }} yrs</span>
          <span class="h-1 w-1 rounded-full bg-gray-300"></span>
          <span>{{ patient.gender || 'N/A' }}</span>
        </p>
        <span
          class="mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
          :class="statusColor"
        >
          {{ patient.account_status }}
        </span>
      </div>
    </div>

    <div
      class="flex flex-col justify-center border-t border-gray-100 pt-4 md:min-w-[260px] md:border-t-0 md:pt-0 md:pl-6"
    >
      <!-- Default View -->
      <div
        v-if="!isScheduling"
        class="flex flex-col gap-3"
      >
        <div
          v-if="patient.account_action"
          class="flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50 p-3"
        >
          <div class="flex items-center gap-2 text-orange-700">
            <Icon
              name="material-symbols:timer-outline"
              class="shrink-0 text-lg"
            />
            <span class="text-xs font-bold tracking-wider uppercase"
              >Scheduled {{ patient.account_action }} on
              {{ formatSchedule(patient.account_action_scheduled_at) }}</span
            >
          </div>
          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            class="shrink-0 cursor-pointer rounded-lg border border-orange-200 bg-orange-100/80 px-3.5 py-1.5 text-xs font-bold text-orange-800 transition-all hover:bg-orange-200/80 active:scale-95"
            :disabled="isActionLoading"
            @click="handleCancelSchedule"
          >
            Cancel
          </AppButton>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <AppButton
            v-if="patient.account_status === 'disabled'"
            size="sm"
            class="rounded-xl px-5"
            @click="handleEnable"
            :disabled="isActionLoading"
            >Enable</AppButton
          >
          <AppButton
            v-if="patient.account_status === 'active'"
            variant="outline"
            size="sm"
            class="rounded-xl border-gray-200 px-5 text-gray-600 hover:bg-gray-100"
            @click="showDisableModal = true"
            :disabled="isActionLoading"
            >Disable</AppButton
          >
          <AppButton
            variant="outline"
            size="sm"
            class="rounded-xl border-red-200 px-5 text-red-600 hover:border-red-300 hover:bg-red-50"
            @click="showDeleteModal = true"
            :disabled="isActionLoading"
            >Delete</AppButton
          >

          <div class="flex-1"></div>

          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            class="hover:text-primary hover:bg-primary/5 hover:border-primary/30 flex cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-bold text-gray-600 transition-all"
            @click="openScheduling"
            v-if="!patient.account_action"
          >
            <Icon
              name="material-symbols:calendar-clock-outline"
              class="text-base"
            />
            Schedule auto-deletion
          </AppButton>
        </div>
      </div>

      <!-- Scheduling View -->
      <div
        v-else
        class="flex flex-col flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 p-3.5 sm:flex-row"
      >
        <select
          v-model="scheduleAction"
          class="focus:border-primary cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-xs outline-none"
        >
          <option value="delete">Delete Account</option>
        </select>

        <span class="text-xs font-bold tracking-wider text-gray-400 uppercase">on</span>

        <!-- Date Picker -->
        <input
          type="date"
          v-model="scheduleDateOnly"
          :min="getTodayStr()"
          class="focus:border-primary cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-xs outline-none"
        />

        <!-- Time Select Dropdown -->
        <select
          v-model="scheduleTimeOnly"
          class="focus:border-primary cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-xs outline-none"
        >
          <option
            v-for="opt in availableTimeOptions"
            :key="opt.value"
            :value="opt.value"
            :disabled="isTimePassedToday(opt.value)"
          >
            {{ opt.label }} {{ isTimePassedToday(opt.value) ? '(Passed)' : '' }}
          </option>
        </select>

        <div class="flex items-center gap-2 sm:ml-auto">
          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            class="bg-primary cursor-pointer rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            @click="handleSchedule"
            :disabled="!scheduleDateOnly || isActionLoading"
          >
            {{ isActionLoading ? 'Confirming...' : 'Confirm' }}
          </AppButton>
          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            class="cursor-pointer rounded-xl bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700 transition-all hover:bg-gray-200"
            @click="isScheduling = false"
          >
            Cancel
          </AppButton>
        </div>

        <p
          v-if="scheduleError"
          class="mt-1 w-full text-xs font-bold text-red-600"
        >
          {{ scheduleError }}
        </p>
      </div>
    </div>

    <!-- Disable Account Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDisableModal"
          class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
          @click.self="showDisableModal = false"
        >
          <div
            class="modal-container bg-card border-border w-full max-w-md overflow-hidden rounded-3xl border p-8 text-center shadow-2xl"
          >
            <div class="mb-6 flex flex-col items-center">
              <div
                class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600"
              >
                <Icon
                  name="material-symbols:block-rounded"
                  class="text-4xl"
                />
              </div>
              <h3 class="text-foreground text-2xl font-bold">Disable Patient Account?</h3>
              <p class="text-muted-foreground mt-2 text-sm leading-relaxed">
                Are you sure you want to disable
                <strong>{{ patient.first_name }} {{ patient.last_name }}</strong
                >'s account? They will be logged out immediately and cannot log in.
              </p>
            </div>

            <div class="flex flex-col gap-3">
              <AppButton
                variant="solid"
                class="h-12 rounded-xl border-none bg-amber-600 font-bold text-white hover:bg-amber-700"
                :disabled="isActionLoading"
                @click="confirmDisable"
              >
                {{ isActionLoading ? 'Disabling...' : 'Yes, Disable Account' }}
              </AppButton>
              <AppButton
                variant="unstyled"
                class="bg-foreground/5 text-foreground/70 hover:bg-foreground/10 h-12 rounded-xl font-bold transition-all"
                @click="showDisableModal = false"
              >
                Cancel
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Account Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDeleteModal"
          class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
          @click.self="showDeleteModal = false"
        >
          <div
            class="modal-container bg-card border-border w-full max-w-md overflow-hidden rounded-3xl border p-8 text-center shadow-2xl"
          >
            <div class="mb-6 flex flex-col items-center">
              <div
                class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600"
              >
                <Icon
                  name="solar:trash-bin-trash-bold"
                  class="text-4xl"
                />
              </div>
              <h3 class="text-foreground text-2xl font-bold">Delete Patient Account?</h3>
              <p class="text-muted-foreground mt-2 text-sm leading-relaxed">
                Are you sure you want to delete
                <strong>{{ patient.first_name }} {{ patient.last_name }}</strong
                >'s account? This action is permanent and cannot be undone.
              </p>
            </div>

            <div class="flex flex-col gap-3">
              <AppButton
                variant="solid"
                class="h-12 rounded-xl border-none bg-red-600 font-bold text-white hover:bg-red-700"
                :disabled="isActionLoading"
                @click="confirmDelete"
              >
                {{ isActionLoading ? 'Deleting...' : 'Yes, Delete Account' }}
              </AppButton>
              <AppButton
                variant="unstyled"
                class="bg-foreground/5 text-foreground/70 hover:bg-foreground/10 h-12 rounded-xl font-bold transition-all"
                @click="showDeleteModal = false"
              >
                Cancel
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
