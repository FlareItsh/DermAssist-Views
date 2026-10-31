<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue'
  import { doctorAvailabilityService } from '~/api/doctorAvailability/DoctorAvailabilityService'
  import { toast } from 'vue-sonner'

  interface Props {
    modelValue: boolean
    slotData: any
    clinics?: any[]
  }

  const props = withDefaults(defineProps<Props>(), {
    clinics: () => []
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', val: boolean): void
    (e: 'saved', updatedSlot: any): void
  }>()

  const isSubmitting = ref(false)
  const errorMessage = ref('')

  const editForm = reactive({
    available_date: '',
    start_time: '09:00',
    end_time: '17:00',
    is_available: true,
    clinic_id: null as number | null,
    location_name: '',
    blockWholeDay: false
  })

  const format12Hour = (timeStr: string) => {
    if (!timeStr) return ''
    const parts = timeStr.split(':')
    if (parts.length < 2) return timeStr
    let h = parseInt(parts[0], 10)
    const m = parts[1].slice(0, 2)
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return `${h}:${m} ${ampm}`
  }

  const isTimeRangeInvalid = computed(() => {
    if (!editForm.start_time || !editForm.end_time) return true
    return editForm.start_time >= editForm.end_time
  })

  const todayDateStr = computed(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })
  const minDate = computed(() => {
    if (editForm.available_date && editForm.available_date < todayDateStr.value) {
      return editForm.available_date
    }
    return todayDateStr.value
  })

  watch(
    () => props.slotData,
    newSlot => {
      if (!newSlot) return
      errorMessage.value = ''
      const isDuty = Number(newSlot.is_available) === 1 || newSlot.is_available === true
      const sStart = (newSlot.start_time || '09:00').slice(0, 5)
      const sEnd = (newSlot.end_time || '17:00').slice(0, 5)
      const isAllDay = !isDuty && sStart <= '00:01' && sEnd >= '23:58'

      editForm.available_date = (newSlot.available_date || '').slice(0, 10)
      editForm.start_time = sStart
      editForm.end_time = sEnd
      editForm.is_available = isDuty
      editForm.clinic_id = newSlot.clinic_id ?? newSlot.clinic?.id ?? null
      editForm.location_name = newSlot.location_name || ''
      editForm.blockWholeDay = isAllDay
    },
    { immediate: true }
  )

  watch(
    () => editForm.blockWholeDay,
    val => {
      if (val && !editForm.is_available) {
        editForm.start_time = '00:00'
        editForm.end_time = '23:59'
      }
    }
  )

  const closeModal = () => {
    if (isSubmitting.value) return
    emit('update:modelValue', false)
  }

  const handleSave = async () => {
    if (!props.slotData?.uuid) {
      toast.error('Unable to locate the schedule slot.')
      return
    }

    if (!editForm.available_date) {
      errorMessage.value = 'Please select a date.'
      return
    }

    if (isTimeRangeInvalid.value) {
      errorMessage.value = 'Start time must be strictly earlier than end time.'
      return
    }

    isSubmitting.value = true
    errorMessage.value = ''

    try {
      const startTime = (
        !editForm.is_available && editForm.blockWholeDay ? '00:00' : editForm.start_time
      ).slice(0, 5)
      const endTime = (
        !editForm.is_available && editForm.blockWholeDay ? '23:59' : editForm.end_time
      ).slice(0, 5)

      let locName: string | null = null
      if (editForm.is_available) {
        const matched = props.clinics.find(c => c.id === editForm.clinic_id)
        locName = matched ? matched.name : editForm.location_name.trim() || 'Clinic Duty'
      } else {
        locName = editForm.location_name.trim() || 'Blocked / Away Period'
      }

      const payload = {
        available_date: editForm.available_date,
        start_time: startTime,
        end_time: endTime,
        is_available: editForm.is_available ? 1 : 0,
        clinic_id: editForm.is_available ? editForm.clinic_id : null,
        location_name: locName,
        overwrite: true
      }

      const res = await doctorAvailabilityService.update(props.slotData.uuid, payload)
      toast.success('Schedule updated successfully!')
      emit('saved', res)
      closeModal()
    } catch (err: any) {
      console.error('Failed to update availability slot:', err)
      errorMessage.value = err.data?.message || err.message || 'Failed to update schedule slot.'
      toast.error(errorMessage.value)
    } finally {
      isSubmitting.value = false
    }
  }
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue && slotData"
      @click.self="closeModal"
      class="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 duration-200"
    >
      <div
        class="border-border bg-card text-foreground relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border p-6 shadow-2xl"
      >
        <!-- Modal Header -->
        <div class="border-border/60 flex items-start justify-between gap-3 border-b pb-4">
          <div class="flex items-center gap-3">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              :class="
                editForm.is_available
                  ? 'bg-emerald-500/10 text-emerald-600 ring-4 ring-emerald-500/5'
                  : 'bg-rose-500/10 text-rose-500 ring-4 ring-rose-500/5'
              "
            >
              <Icon
                :name="
                  editForm.is_available
                    ? 'heroicons:pencil-square-20-solid'
                    : 'heroicons:no-symbol-20-solid'
                "
                class="h-5 w-5"
              />
            </div>
            <div>
              <h3 class="text-foreground text-base font-bold">
                {{ editForm.is_available ? 'Edit Clinic Duty Shift' : 'Edit Blocked Period' }}
              </h3>
              <p class="text-muted-foreground text-xs">
                Adjust date, working hours, and clinic location
              </p>
            </div>
          </div>

          <button
            type="button"
            @click="closeModal"
            class="text-muted-foreground hover:bg-foreground/5 hover:text-foreground cursor-pointer rounded-xl p-1.5 transition"
            title="Close"
          >
            <Icon
              name="heroicons:x-mark"
              class="h-5 w-5"
            />
          </button>
        </div>

        <!-- Form Body -->
        <form
          @submit.prevent="handleSave"
          class="mt-4 space-y-4"
        >
          <!-- Date Field -->
          <div class="space-y-1">
            <label class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
              Schedule Date *
            </label>
            <input
              v-model="editForm.available_date"
              type="date"
              :min="minDate"
              required
              class="border-border bg-card focus:border-primary w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium transition outline-none"
            />
          </div>

          <!-- Time In & Time Out Row -->
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                Duty Hours *
              </label>
              <span
                v-if="isTimeRangeInvalid"
                class="text-[11px] font-bold text-rose-500"
              >
                Upside-down Hours
              </span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <span class="text-muted-foreground text-[10px] font-semibold">Time In</span>
                <input
                  v-model="editForm.start_time"
                  type="time"
                  required
                  :disabled="!editForm.is_available && editForm.blockWholeDay"
                  class="border-border bg-card focus:border-primary w-full rounded-xl border px-3 py-2 text-sm font-medium transition outline-none disabled:opacity-50"
                  :class="isTimeRangeInvalid ? 'border-rose-400 bg-rose-50/20' : ''"
                />
                <p
                  v-if="editForm.start_time"
                  class="text-muted-foreground text-[11px] font-semibold"
                >
                  {{ format12Hour(editForm.start_time) }}
                </p>
              </div>

              <div class="space-y-1">
                <span class="text-muted-foreground text-[10px] font-semibold">Time Out</span>
                <input
                  v-model="editForm.end_time"
                  type="time"
                  required
                  :disabled="!editForm.is_available && editForm.blockWholeDay"
                  class="border-border bg-card focus:border-primary w-full rounded-xl border px-3 py-2 text-sm font-medium transition outline-none disabled:opacity-50"
                  :class="isTimeRangeInvalid ? 'border-rose-400 bg-rose-50/20' : ''"
                />
                <p
                  v-if="editForm.end_time"
                  class="text-muted-foreground text-[11px] font-semibold"
                >
                  {{ format12Hour(editForm.end_time) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Upside-down error alert -->
          <div
            v-if="isTimeRangeInvalid"
            class="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400"
          >
            <Icon
              name="heroicons:exclamation-circle-20-solid"
              class="h-4 w-4 shrink-0"
            />
            <span>Time In cannot be later than or equal to Time Out.</span>
          </div>

          <!-- Clinic Location (Duty) -->
          <div
            v-if="editForm.is_available"
            class="space-y-1"
          >
            <label class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
              Clinic Location
            </label>
            <div
              v-if="clinics.length > 0"
              class="relative"
            >
              <select
                v-model="editForm.clinic_id"
                class="border-border bg-card focus:border-primary w-full cursor-pointer appearance-none rounded-xl border px-3.5 py-2.5 pr-10 text-sm font-semibold transition outline-none"
              >
                <option :value="null">-- Select Clinic Location --</option>
                <option
                  v-for="c in clinics"
                  :key="c.id"
                  :value="c.id"
                >
                  {{ c.name }} {{ c.address ? `(${c.address})` : '' }}
                </option>
              </select>
              <div
                class="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"
              >
                <Icon
                  name="heroicons:chevron-down-20-solid"
                  class="h-4 w-4"
                />
              </div>
            </div>
            <input
              v-else
              v-model="editForm.location_name"
              type="text"
              placeholder="e.g. Main Clinic, Room 302..."
              class="border-border bg-card focus:border-primary w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium transition outline-none"
            />
          </div>

          <!-- Block Whole Day & Reason (Blocked Period) -->
          <template v-else>
            <div class="flex items-center gap-2 pt-1">
              <input
                id="edit-block-whole-day"
                v-model="editForm.blockWholeDay"
                type="checkbox"
                class="text-primary focus:ring-primary h-4 w-4 cursor-pointer rounded"
              />
              <label
                for="edit-block-whole-day"
                class="text-foreground/80 cursor-pointer text-xs font-bold select-none"
              >
                Unavailable all day (Whole day off)
              </label>
            </div>

            <div class="space-y-1">
              <label class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                Reason / Note
              </label>
              <input
                v-model="editForm.location_name"
                type="text"
                placeholder="e.g. Vacation Leave, Clinic Closed, Conference..."
                class="border-border bg-card focus:border-primary w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium transition outline-none"
              />
            </div>
          </template>

          <!-- Error Alert -->
          <div
            v-if="errorMessage"
            class="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400"
          >
            <Icon
              name="heroicons:exclamation-circle-20-solid"
              class="h-4 w-4 shrink-0"
            />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Footer Actions -->
          <div class="border-border/60 mt-6 flex items-center justify-end gap-2.5 border-t pt-4">
            <button
              type="button"
              :disabled="isSubmitting"
              @click="closeModal"
              class="text-muted-foreground hover:bg-foreground/5 hover:text-foreground cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              :disabled="isSubmitting || isTimeRangeInvalid"
              class="bg-primary text-primary-foreground hover:bg-primary/90 flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon
                v-if="isSubmitting"
                name="lucide:loader-2"
                class="h-3.5 w-3.5 animate-spin"
              />
              <span>{{ isSubmitting ? 'Saving Changes...' : 'Save Changes' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
