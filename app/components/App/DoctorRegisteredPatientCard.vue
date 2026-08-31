<script setup lang="ts">
import { ref } from 'vue'
import { userService } from '~/api/user/UserService'
import { useStorage } from '~/composables/useStorage'

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
    emit('refresh')
  } catch (e) {
    console.error(e)
  } finally {
    isActionLoading.value = false
  }
}

const confirmDisable = async () => {
  isActionLoading.value = true
  try {
    await userService.disablePatient(props.patient.uuid)
    showDisableModal.value = false
    emit('refresh')
  } catch (e) {
    console.error(e)
  } finally {
    isActionLoading.value = false
  }
}

const confirmDelete = async () => {
  isActionLoading.value = true
  try {
    await userService.deleteDoctorPatient(props.patient.uuid)
    showDeleteModal.value = false
    emit('refresh')
  } catch (e) {
    console.error(e)
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
    isScheduling.value = false
    emit('refresh')
  } catch (e: any) {
    console.error('Failed to schedule action:', e)
    scheduleError.value = e?.data?.message || e?.response?._data?.message || 'Failed to schedule auto-deletion.'
  } finally {
    isActionLoading.value = false
  }
}

const handleCancelSchedule = async () => {
  isActionLoading.value = true
  try {
    await userService.cancelScheduledAction(props.patient.uuid)
    emit('refresh')
  } catch (e) {
    console.error(e)
  } finally {
    isActionLoading.value = false
  }
}

const statusColor = computed(() => {
  return props.patient.account_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
})

const formatSchedule = (dateString: string) => {
  if (!dateString) return ''
  const d = new Date(dateString)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <div class="col-span-1 md:col-span-2 flex flex-col md:flex-row md:items-center md:justify-between gap-6 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
    
    <div class="absolute rounded-3xl my-8 left-0 top-0 bottom-0 w-1" :class="props.patient.account_status === 'active' ? 'bg-green-500' : 'bg-red-500'"></div>
    
    <div class="flex items-center gap-5">
      <img
        :src="patient.avatar_path ? getStorageUrl(patient.avatar_path) : `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.first_name + '+' + patient.last_name)}&background=7B5EF5&color=fff&size=128`"
        class="h-20 w-20 rounded-2xl object-cover shrink-0 bg-gray-50 border border-gray-100"
      />
      <div>
        <h3 class="font-bold text-lg text-gray-900 line-clamp-1">{{ patient.first_name }} {{ patient.last_name }}</h3>
        <p class="text-xs text-gray-500 mt-1 flex items-center gap-2">
           <span>{{ patient.age || 'N/A' }} yrs</span>
           <span class="w-1 h-1 rounded-full bg-gray-300"></span>
           <span>{{ patient.gender || 'N/A' }}</span>
        </p>
        <span class="inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="statusColor">
          {{ patient.account_status }}
        </span>
      </div>
    </div>
    
    <div class="flex flex-col justify-center border-t md:border-t-0 border-gray-100 pt-4 md:pt-0 md:pl-6 md:min-w-[260px]">
      
      <!-- Default View -->
      <div v-if="!isScheduling" class="flex flex-col gap-3">
        <div v-if="patient.account_action" class="bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-orange-700">
             <Icon name="material-symbols:timer-outline" class="text-lg shrink-0" />
             <span class="text-xs font-bold uppercase tracking-wider">Scheduled {{ patient.account_action }} on {{ formatSchedule(patient.account_action_scheduled_at) }}</span>
          </div>
          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            class="px-3.5 py-1.5 bg-orange-100/80 hover:bg-orange-200/80 text-orange-800 rounded-lg text-xs font-bold transition-all border border-orange-200 cursor-pointer active:scale-95 shrink-0"
            :disabled="isActionLoading"
            @click="handleCancelSchedule"
          >
            Cancel
          </AppButton>
        </div>
        
        <div class="flex flex-wrap items-center gap-3">
           <AppButton v-if="patient.account_status === 'disabled'" size="sm" class="rounded-xl px-5" @click="handleEnable" :disabled="isActionLoading">Enable</AppButton>
           <AppButton v-if="patient.account_status === 'active'" variant="outline" size="sm" class="rounded-xl px-5 text-gray-600 border-gray-200 hover:bg-gray-100" @click="showDisableModal = true" :disabled="isActionLoading">Disable</AppButton>
           <AppButton variant="outline" size="sm" class="rounded-xl px-5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" @click="showDeleteModal = true" :disabled="isActionLoading">Delete</AppButton>
           
           <div class="flex-1"></div>
           
           <AppButton 
             variant="unstyled" 
             size="unstyled" 
             rounded="unstyled"
             class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-gray-600 hover:text-primary hover:bg-primary/5 transition-all text-xs font-bold border border-gray-200 hover:border-primary/30 cursor-pointer"
             @click="openScheduling" 
             v-if="!patient.account_action"
           >
             <Icon name="material-symbols:calendar-clock-outline" class="text-base" />
             Schedule auto-deletion
           </AppButton>
        </div>
      </div>
      
      <!-- Scheduling View -->
      <div v-else class="flex flex-col sm:flex-row flex-wrap items-center gap-3 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
         <select v-model="scheduleAction" class="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-primary cursor-pointer shadow-xs">
           <option value="delete">Delete Account</option>
         </select>

         <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">on</span>

         <!-- Date Picker -->
         <input 
           type="date" 
           v-model="scheduleDateOnly" 
           :min="getTodayStr()"
           class="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-primary cursor-pointer shadow-xs" 
         />

         <!-- Time Select Dropdown -->
         <select 
           v-model="scheduleTimeOnly" 
           class="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-primary cursor-pointer shadow-xs"
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
             class="px-5 py-2 bg-primary text-white hover:opacity-90 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer" 
             @click="handleSchedule" 
             :disabled="!scheduleDateOnly || isActionLoading"
           >
             {{ isActionLoading ? 'Confirming...' : 'Confirm' }}
           </AppButton>
           <AppButton 
             variant="unstyled" 
             size="unstyled" 
             rounded="unstyled"
             class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer" 
             @click="isScheduling = false"
           >
             Cancel
           </AppButton>
         </div>

         <p v-if="scheduleError" class="text-xs font-bold text-red-600 w-full mt-1">
           {{ scheduleError }}
         </p>
      </div>
      
    </div>

    <!-- Disable Account Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDisableModal"
          class="bg-foreground/40 fixed inset-0 z-[1000] flex items-center justify-center p-4 backdrop-blur-xs"
          @click.self="showDisableModal = false"
        >
          <div class="modal-container bg-card border-border w-full max-w-md overflow-hidden rounded-3xl border p-8 shadow-2xl text-center">
            <div class="mb-6 flex flex-col items-center">
              <div class="bg-amber-100 mb-4 flex h-16 w-16 items-center justify-center rounded-full text-amber-600">
                <Icon name="material-symbols:block-rounded" class="text-4xl" />
              </div>
              <h3 class="text-2xl font-bold text-foreground">Disable Patient Account?</h3>
              <p class="text-muted-foreground mt-2 text-sm leading-relaxed">
                Are you sure you want to disable <strong>{{ patient.first_name }} {{ patient.last_name }}</strong>'s account? They will be logged out immediately and cannot log in.
              </p>
            </div>

            <div class="flex flex-col gap-3">
              <AppButton
                variant="solid"
                class="bg-amber-600 hover:bg-amber-700 text-white font-bold h-12 rounded-xl border-none"
                :disabled="isActionLoading"
                @click="confirmDisable"
              >
                {{ isActionLoading ? 'Disabling...' : 'Yes, Disable Account' }}
              </AppButton>
              <AppButton
                variant="unstyled"
                class="bg-foreground/5 text-foreground/70 font-bold h-12 rounded-xl transition-all hover:bg-foreground/10"
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
          class="bg-foreground/40 fixed inset-0 z-[1000] flex items-center justify-center p-4 backdrop-blur-xs"
          @click.self="showDeleteModal = false"
        >
          <div class="modal-container bg-card border-border w-full max-w-md overflow-hidden rounded-3xl border p-8 shadow-2xl text-center">
            <div class="mb-6 flex flex-col items-center">
              <div class="bg-red-100 mb-4 flex h-16 w-16 items-center justify-center rounded-full text-red-600">
                <Icon name="solar:trash-bin-trash-bold" class="text-4xl" />
              </div>
              <h3 class="text-2xl font-bold text-foreground">Delete Patient Account?</h3>
              <p class="text-muted-foreground mt-2 text-sm leading-relaxed">
                Are you sure you want to delete <strong>{{ patient.first_name }} {{ patient.last_name }}</strong>'s account? This action is permanent and cannot be undone.
              </p>
            </div>

            <div class="flex flex-col gap-3">
              <AppButton
                variant="solid"
                class="bg-red-600 hover:bg-red-700 text-white font-bold h-12 rounded-xl border-none"
                :disabled="isActionLoading"
                @click="confirmDelete"
              >
                {{ isActionLoading ? 'Deleting...' : 'Yes, Delete Account' }}
              </AppButton>
              <AppButton
                variant="unstyled"
                class="bg-foreground/5 text-foreground/70 font-bold h-12 rounded-xl transition-all hover:bg-foreground/10"
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
