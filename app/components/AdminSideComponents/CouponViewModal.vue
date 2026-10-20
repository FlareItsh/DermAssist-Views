<template>
  <div
    v-if="show && coupon"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs transition-opacity sm:p-4"
  >
    <div
      class="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl transition-all"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:px-6 sm:py-4"
      >
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div
            class="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10"
          >
            <Icon
              name="lucide:ticket"
              class="text-lg sm:text-xl"
            />
          </div>
          <div>
            <h3 class="text-sm font-black text-gray-950 sm:text-base">Coupon Details</h3>
            <p class="text-[11px] text-gray-500 sm:text-xs">
              Audit configuration, usage metrics, and rules
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

      <!-- Content -->
      <div class="max-h-[75vh] space-y-4 overflow-y-auto p-4 sm:space-y-5 sm:p-6">
        <!-- Code & Discount Banner -->
        <div
          class="border-primary/20 from-primary/5 via-primary/[0.02] relative overflow-hidden rounded-2xl border bg-linear-to-br to-transparent p-5"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                >Promo Code</span
              >
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="text-primary font-mono text-xl font-black tracking-wider break-all sm:text-2xl"
                >
                  {{ coupon.code }}
                </span>
                <button
                  type="button"
                  @click="copyCode"
                  class="border-primary/20 text-primary hover:bg-primary inline-flex items-center gap-1 rounded-lg border bg-white px-2 py-1 text-[11px] font-bold shadow-xs transition hover:text-white"
                  title="Copy code"
                >
                  <Icon
                    name="lucide:copy"
                    class="text-xs"
                  />
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <div class="text-right">
              <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                >Discount</span
              >
              <div class="text-xl font-black text-gray-950">
                {{
                  coupon.discount_type === 'percentage'
                    ? `${coupon.value}% OFF`
                    : `₱${Number(coupon.value).toLocaleString()} OFF`
                }}
              </div>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-2">
            <span
              v-if="coupon.is_archived"
              class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
              Archived
            </span>
            <span
              v-else-if="coupon.is_active"
              class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Active
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
              Disabled
            </span>

            <span
              v-if="scheduleStatus"
              class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
              :class="scheduleStatus.classes"
            >
              <Icon
                :name="scheduleStatus.icon"
                class="text-xs"
              />
              {{ scheduleStatus.label }}
            </span>
          </div>
        </div>

        <!-- Usage & Limits -->
        <div class="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold tracking-wider text-gray-500 uppercase">
              Redemption Limits
            </h4>
            <span class="font-mono text-xs font-bold text-gray-900">
              {{ coupon.times_redeemed || 0 }} / {{ coupon.max_redemptions ?? 'Unlimited' }}
            </span>
          </div>

          <!-- Progress Bar -->
          <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              class="bg-primary h-full rounded-full transition-all"
              :style="{ width: `${redemptionPercentage}%` }"
            ></div>
          </div>

          <div class="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div class="rounded-xl border border-gray-100 bg-white p-2.5">
              <span class="text-[10px] font-bold text-gray-400 uppercase">Per Customer Limit</span>
              <p class="font-bold text-gray-900">
                {{
                  coupon.max_redemptions_per_user
                    ? `${coupon.max_redemptions_per_user} per doctor`
                    : 'Unlimited'
                }}
              </p>
            </div>
            <div class="rounded-xl border border-gray-100 bg-white p-2.5">
              <span class="text-[10px] font-bold text-gray-400 uppercase">Duration Model</span>
              <p class="font-bold text-gray-900 capitalize">
                {{ coupon.duration }}
                <span
                  v-if="coupon.duration === 'repeating' && coupon.duration_in_months"
                  class="text-[11px] text-gray-500"
                >
                  ({{ coupon.duration_in_months }} mo)
                </span>
              </p>
            </div>
          </div>
        </div>

        <!-- Schedule & Timeline -->
        <div class="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <h4 class="mb-3 text-xs font-bold tracking-wider text-gray-500 uppercase">
            Active Schedule Window
          </h4>
          <div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div class="rounded-xl border border-gray-100 bg-white p-3">
              <span class="mb-1 block text-[10px] font-bold text-gray-400 uppercase"
                >Valid From</span
              >
              <p class="font-semibold text-gray-900">
                {{ coupon.valid_from ? formatDate(coupon.valid_from) : 'Immediate (No delay)' }}
              </p>
            </div>
            <div class="rounded-xl border border-gray-100 bg-white p-3">
              <span class="mb-1 block text-[10px] font-bold text-gray-400 uppercase"
                >Valid Until</span
              >
              <p class="font-semibold text-gray-900">
                {{ coupon.valid_until ? formatDate(coupon.valid_until) : 'Never (Perpetual)' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Eligibility Rules -->
        <div class="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <h4 class="text-xs font-bold tracking-wider text-gray-500 uppercase">
            Eligibility Constraints
          </h4>

          <div class="space-y-2 text-xs">
            <div
              class="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-2.5"
            >
              <span class="font-medium text-gray-500">Minimum Spend</span>
              <span class="font-bold text-gray-900">
                {{
                  coupon.min_spend
                    ? `₱${Number(coupon.min_spend).toLocaleString()}`
                    : 'None (No threshold)'
                }}
              </span>
            </div>

            <div
              class="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-2.5"
            >
              <span class="font-medium text-gray-500">Target Customer Segment</span>
              <span class="font-bold text-gray-900 capitalize">
                {{ formatSegment(coupon.customer_segment) }}
              </span>
            </div>

            <div class="rounded-xl border border-gray-100 bg-white p-2.5">
              <span class="mb-1.5 block font-medium text-gray-500"
                >Applicable Subscription Plans</span
              >
              <div
                v-if="applicablePlanNames.length > 0"
                class="flex flex-wrap gap-1.5"
              >
                <span
                  v-for="name in applicablePlanNames"
                  :key="name"
                  class="rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700"
                >
                  {{ name }}
                </span>
              </div>
              <span
                v-else
                class="font-semibold text-gray-800"
              >
                All Subscription Plans
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex flex-col-reverse items-stretch justify-between gap-2.5 border-t border-gray-100 bg-gray-50/70 px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4"
      >
        <button
          type="button"
          @click="handleClose"
          class="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-center text-xs font-bold text-gray-700 transition hover:bg-gray-50 sm:w-auto sm:py-2"
        >
          Close
        </button>

        <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <button
            v-if="coupon.is_archived"
            type="button"
            @click="handleRestore"
            class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs font-bold text-amber-700 transition hover:bg-amber-100 sm:w-auto sm:py-2"
          >
            <Icon
              name="lucide:archive-restore"
              class="text-sm"
            />
            Restore Coupon
          </button>
          <button
            v-else
            type="button"
            @click="handleOpenEdit"
            class="bg-primary hover:bg-primary-dark inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-center text-xs font-bold text-white shadow-xs transition sm:w-auto sm:py-2"
          >
            <Icon
              name="lucide:pencil"
              class="text-xs"
            />
            Edit Coupon
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import type { Coupon, Plan } from '~/api/subscription/SubscriptionAdminService'

  const props = defineProps<{
    show: boolean
    coupon: Coupon | null
    availablePlans?: Plan[]
  }>()

  const emit = defineEmits<{
    (e: 'close'): void
    (e: 'edit', coupon: Coupon): void
    (e: 'restore', coupon: Coupon): void
  }>()

  const handleClose = () => {
    emit('close')
  }

  const handleOpenEdit = () => {
    if (props.coupon) {
      emit('edit', props.coupon)
    }
  }

  const handleRestore = () => {
    if (props.coupon) {
      emit('restore', props.coupon)
    }
  }

  const copyCode = async () => {
    if (!props.coupon?.code) return
    try {
      await navigator.clipboard.writeText(props.coupon.code)
      toast.success(`Coupon code "${props.coupon.code}" copied to clipboard!`)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  const formatDate = (val: string) => {
    return new Date(val).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatSegment = (segment?: string) => {
    if (segment === 'new_doctors') return 'New Doctors (First-Time Only)'
    if (segment === 'renewals') return 'Existing Subscribers (Renewals)'
    return 'All Doctors'
  }

  const redemptionPercentage = computed(() => {
    if (!props.coupon) return 0
    if (!props.coupon.max_redemptions) return 0
    return Math.min(
      100,
      Math.round(((props.coupon.times_redeemed || 0) / props.coupon.max_redemptions) * 100)
    )
  })

  const applicablePlanNames = computed(() => {
    if (!props.coupon?.applicable_plans || props.coupon.applicable_plans.length === 0) {
      return []
    }
    const plans = props.availablePlans || []
    return props.coupon.applicable_plans.map(id => {
      const match = plans.find(p => p.id === Number(id) || p.uuid === id)
      return match ? match.name : `Plan #${id}`
    })
  })

  const scheduleStatus = computed(() => {
    if (!props.coupon) return null
    const now = new Date()

    if (props.coupon.valid_from && new Date(props.coupon.valid_from) > now) {
      return {
        label: 'Scheduled',
        classes: 'border-blue-200 bg-blue-50 text-blue-700',
        icon: 'lucide:calendar-clock'
      }
    }

    if (props.coupon.valid_until && new Date(props.coupon.valid_until) < now) {
      return {
        label: 'Expired',
        classes: 'border-rose-200 bg-rose-50 text-rose-700',
        icon: 'lucide:calendar-x'
      }
    }

    return null
  })
</script>
