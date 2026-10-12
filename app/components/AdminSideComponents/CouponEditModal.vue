<template>
  <div
    v-if="show && form"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs transition-opacity"
  >
    <div
      class="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl transition-all"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-6 py-4"
      >
        <div class="flex items-center gap-3">
          <div
            class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl"
          >
            <Icon
              name="lucide:pencil"
              class="text-lg"
            />
          </div>
          <div>
            <h3 class="text-base font-black text-gray-950">
              {{ form.id ? `Edit Coupon: ${form.code}` : 'Create Promo Coupon' }}
            </h3>
            <p class="text-xs text-gray-500">
              Adjust active schedules, usage limits, eligibility constraints, and status
            </p>
          </div>
        </div>
        <button
          type="button"
          @click="handleClose"
          class="rounded-xl p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <Icon
            name="lucide:x"
            class="text-lg"
          />
        </button>
      </div>

      <!-- Form Body -->
      <form
        @submit.prevent="handleSubmit"
        class="flex flex-col"
      >
        <div class="max-h-[72vh] space-y-6 overflow-y-auto p-6">
          <!-- Safeguard Notice if Redeemed -->
          <div
            v-if="form.id && form.has_redemptions"
            class="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-3.5 text-xs text-blue-900"
          >
            <Icon
              name="lucide:shield-alert"
              class="mt-0.5 shrink-0 text-base text-blue-600"
            />
            <div>
              <span class="font-bold">Historical Redemptions Protected:</span>
              <p class="mt-0.5 text-[11px] text-blue-800">
                This coupon was redeemed {{ form.times_redeemed }} time(s). Core discount values are
                locked to maintain invoice integrity, but schedules, usage limits, and eligibility
                can be updated freely.
              </p>
            </div>
          </div>

          <!-- Section 1: Core Code & Discount -->
          <div class="space-y-3">
            <h4 class="text-xs font-bold tracking-wider text-gray-400 uppercase">
              1. Core Identification
            </h4>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div class="md:col-span-1">
                <label class="mb-1 block text-xs font-bold text-gray-700">Coupon Code</label>
                <input
                  v-model="form.code"
                  type="text"
                  required
                  :disabled="Boolean(form.id && form.has_redemptions)"
                  placeholder="e.g. DERM2026"
                  class="focus:border-primary/40 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 font-mono text-sm font-bold text-gray-900 uppercase transition outline-none focus:bg-white focus:ring-3 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>

              <div>
                <label class="mb-1 block text-xs font-bold text-gray-700">Discount Type</label>
                <select
                  v-model="form.discount_type"
                  :disabled="Boolean(form.id && form.has_redemptions)"
                  class="focus:border-primary/40 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 transition outline-none focus:bg-white focus:ring-3 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed_amount">Fixed Amount (₱)</option>
                </select>
              </div>

              <div>
                <label class="mb-1 block text-xs font-bold text-gray-700">Value</label>
                <input
                  v-model.number="form.value"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  :disabled="Boolean(form.id && form.has_redemptions)"
                  class="focus:border-primary/40 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 transition outline-none focus:bg-white focus:ring-3 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            </div>
          </div>

          <!-- Section 2: Expiration & Schedule -->
          <div class="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold tracking-wider text-gray-600 uppercase">
                2. Expiration Dates & Schedules
              </h4>
              <span class="text-[11px] font-medium text-gray-400"
                >Extend or restrict campaign window</span
              >
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-semibold text-gray-700"
                  >Valid From (Start Date)</label
                >
                <input
                  v-model="validFromInput"
                  type="date"
                  class="focus:border-primary/40 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition outline-none focus:ring-3"
                />
                <span class="mt-1 block text-[10px] text-gray-400"
                  >Leave blank to activate immediately</span
                >
              </div>

              <div>
                <label class="mb-1 block text-xs font-semibold text-gray-700"
                  >Valid Until (Expiration Date)</label
                >
                <input
                  v-model="validUntilInput"
                  type="date"
                  class="focus:border-primary/40 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition outline-none focus:ring-3"
                />
                <span class="mt-1 block text-[10px] text-gray-400"
                  >Leave blank for no expiration</span
                >
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-semibold text-gray-700">Duration Model</label>
                <select
                  v-model="form.duration"
                  class="focus:border-primary/40 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition outline-none focus:ring-3"
                >
                  <option value="once">Once (Single Billing Cycle)</option>
                  <option value="repeating">Repeating (Multiple Months)</option>
                  <option value="forever">Forever (Continuous Discount)</option>
                </select>
              </div>

              <div v-if="form.duration === 'repeating'">
                <label class="mb-1 block text-xs font-semibold text-gray-700"
                  >Repeating Months</label
                >
                <input
                  v-model.number="form.duration_in_months"
                  type="number"
                  min="1"
                  placeholder="e.g. 3"
                  class="focus:border-primary/40 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition outline-none focus:ring-3"
                />
              </div>
            </div>
          </div>

          <!-- Section 3: Usage Limits -->
          <div class="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold tracking-wider text-gray-600 uppercase">
                3. Usage Limits
              </h4>
              <span class="text-[11px] font-medium text-gray-400">Global and per-doctor caps</span>
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-semibold text-gray-700"
                  >Total Max Redemptions</label
                >
                <input
                  v-model.number="form.max_redemptions"
                  type="number"
                  min="1"
                  placeholder="Leave empty for unlimited"
                  class="focus:border-primary/40 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition outline-none focus:ring-3"
                />
                <span class="mt-1 block text-[10px] text-gray-400">
                  Current usage: {{ form.times_redeemed || 0 }} redeemed
                </span>
              </div>

              <div>
                <label class="mb-1 block text-xs font-semibold text-gray-700"
                  >Per-Doctor Limit</label
                >
                <input
                  v-model.number="form.max_redemptions_per_user"
                  type="number"
                  min="1"
                  placeholder="Default: 1 per doctor"
                  class="focus:border-primary/40 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition outline-none focus:ring-3"
                />
                <span class="mt-1 block text-[10px] text-gray-400"
                  >Limits redemptions per individual account</span
                >
              </div>
            </div>
          </div>

          <!-- Section 4: Eligibility Rules -->
          <div class="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold tracking-wider text-gray-600 uppercase">
                4. Eligibility Rules
              </h4>
              <span class="text-[11px] font-medium text-gray-400"
                >Segments, minimum spend & plans</span
              >
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-semibold text-gray-700"
                  >Minimum Spend (₱)</label
                >
                <input
                  v-model.number="form.min_spend"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 1000.00"
                  class="focus:border-primary/40 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition outline-none focus:ring-3"
                />
                <span class="mt-1 block text-[10px] text-gray-400"
                  >Cart subtotal before coupon applies</span
                >
              </div>

              <div>
                <label class="mb-1 block text-xs font-semibold text-gray-700"
                  >Customer Segment</label
                >
                <select
                  v-model="form.customer_segment"
                  class="focus:border-primary/40 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition outline-none focus:ring-3"
                >
                  <option value="all">All Doctors</option>
                  <option value="new_doctors">New Doctors (First-Time Only)</option>
                  <option value="renewals">Existing Subscribers (Renewals Only)</option>
                </select>
              </div>
            </div>

            <!-- Applicable Plans -->
            <div class="pt-2">
              <label class="mb-1.5 block text-xs font-semibold text-gray-700">
                Applicable Subscription Plans
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  @click="toggleAllPlans"
                  class="rounded-xl border px-3 py-1.5 text-xs font-bold transition"
                  :class="
                    selectedPlanIds.length === 0
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  "
                >
                  All Plans
                </button>

                <button
                  v-for="plan in availablePlans"
                  :key="plan.id"
                  type="button"
                  @click="togglePlanSelection(plan.id!)"
                  class="rounded-xl border px-3 py-1.5 text-xs font-semibold transition"
                  :class="
                    selectedPlanIds.includes(plan.id!)
                      ? 'border-primary bg-primary text-white shadow-xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  "
                >
                  {{ plan.name }}
                </button>
              </div>
              <span class="mt-1.5 block text-[10px] text-gray-400">
                {{
                  selectedPlanIds.length === 0
                    ? 'Coupon applies to any subscription plan.'
                    : `Restricted to ${selectedPlanIds.length} specific plan(s).`
                }}
              </span>
            </div>
          </div>

          <!-- Section 5: Active Status Switch -->
          <div
            class="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4"
          >
            <div>
              <span class="block text-xs font-bold text-gray-900">Active Status</span>
              <p class="text-[11px] text-gray-500">
                Disabled coupons cannot be redeemed at checkout even if within active schedule
                dates.
              </p>
            </div>

            <button
              type="button"
              @click="toggleActiveState"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
              :class="form.is_active ? 'bg-emerald-500' : 'bg-gray-300'"
              role="switch"
              :aria-checked="form.is_active"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                :class="form.is_active ? 'translate-x-5' : 'translate-x-0'"
              ></span>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-6 py-4"
        >
          <button
            type="button"
            @click="handleClose"
            class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="bg-primary hover:bg-primary-dark inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50"
          >
            <Icon
              v-if="isSubmitting"
              name="svg-spinners:ring-resize"
              class="h-4 w-4 animate-spin"
            />
            <span>{{
              isSubmitting ? 'Saving Changes...' : form.id ? 'Update Coupon' : 'Create Coupon'
            }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { Coupon, Plan } from '~/api/subscription/SubscriptionAdminService'

  const props = defineProps<{
    show: boolean
    coupon: Coupon | null
    availablePlans?: Plan[]
    isSubmitting?: boolean
  }>()

  const emit = defineEmits<{
    (e: 'close'): void
    (e: 'submit', payload: Partial<Coupon>): void
  }>()

  const form = ref<Partial<Coupon>>({})
  const selectedPlanIds = ref<number[]>([])

  const validFromInput = computed({
    get: () => {
      if (!form.value.valid_from) return ''
      return form.value.valid_from.split('T')[0]
    },
    set: (val: string) => {
      form.value.valid_from = val ? `${val}T00:00:00` : null
    }
  })

  const validUntilInput = computed({
    get: () => {
      if (!form.value.valid_until) return ''
      return form.value.valid_until.split('T')[0]
    },
    set: (val: string) => {
      form.value.valid_until = val ? `${val}T23:59:59` : null
    }
  })

  watch(
    () => props.coupon,
    val => {
      if (val) {
        form.value = { ...val }
        if (Array.isArray(val.applicable_plans)) {
          selectedPlanIds.value = val.applicable_plans.map(p => Number(p))
        } else {
          selectedPlanIds.value = []
        }
      } else {
        form.value = {
          code: '',
          discount_type: 'percentage',
          value: 10,
          duration: 'once',
          max_redemptions: null,
          max_redemptions_per_user: 1,
          min_spend: null,
          applicable_plans: null,
          customer_segment: 'all',
          is_active: true
        }
        selectedPlanIds.value = []
      }
    },
    { immediate: true }
  )

  const handleClose = () => {
    emit('close')
  }

  const toggleActiveState = () => {
    form.value.is_active = !form.value.is_active
  }

  const toggleAllPlans = () => {
    selectedPlanIds.value = []
    form.value.applicable_plans = null
  }

  const togglePlanSelection = (planId: number) => {
    const idx = selectedPlanIds.value.indexOf(planId)
    if (idx >= 0) {
      selectedPlanIds.value.splice(idx, 1)
    } else {
      selectedPlanIds.value.push(planId)
    }

    form.value.applicable_plans = selectedPlanIds.value.length > 0 ? selectedPlanIds.value : null
  }

  const handleSubmit = () => {
    form.value.applicable_plans = selectedPlanIds.value.length > 0 ? selectedPlanIds.value : null
    emit('submit', form.value)
  }
</script>
