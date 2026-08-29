<template>
  <div class="space-y-6">
    <AdminSideComponentsSubscriptionNavHeader
      title="Coupons & Promo Codes"
      description="Generate promotional campaign discount codes for doctor onboarding."
      icon="lucide:ticket"
      current-tab="coupons"
    >
      <template #actions>
        <button 
          @click="showModal = true"
          class="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-dark"
        >
          <Icon name="lucide:plus" class="text-sm" />
          Create Coupon
        </button>
      </template>
    </AdminSideComponentsSubscriptionNavHeader>

    <!-- Coupons Table Section -->
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <tr>
              <th class="px-5 py-3.5">Code</th>
              <th class="px-5 py-3.5">Discount</th>
              <th class="px-5 py-3.5">Duration</th>
              <th class="px-5 py-3.5">Redemptions</th>
              <th class="px-5 py-3.5">Valid Until</th>
              <th class="px-5 py-3.5">Status</th>
              <th class="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="isLoading">
              <td colspan="7" class="px-5 py-10 text-center text-gray-500">
                <div class="flex items-center justify-center gap-2">
                  <Icon name="svg-spinners:ring-resize" class="h-5 w-5 text-primary animate-spin" />
                  <span class="text-xs font-medium">Loading promo codes...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="coupons.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-gray-500">
                <Icon name="lucide:ticket" class="mx-auto mb-2 text-3xl text-gray-300" />
                <p class="text-sm font-semibold text-gray-700">No promo codes generated yet.</p>
              </td>
            </tr>
            <tr v-for="coupon in coupons" :key="coupon.id" class="transition hover:bg-gray-50/60">
              <td class="px-5 py-4 font-mono font-bold text-primary tracking-wider">
                {{ coupon.code }}
              </td>
              <td class="px-5 py-4 font-bold text-gray-950">
                {{ coupon.discount_type === 'percentage' ? `${coupon.value}% OFF` : `₱${coupon.value} OFF` }}
              </td>
              <td class="px-5 py-4 text-xs font-mono font-semibold text-gray-700 capitalize">
                {{ coupon.duration }}
              </td>
              <td class="px-5 py-4 text-xs font-mono font-semibold text-gray-700">
                {{ coupon.times_redeemed || 0 }} / {{ coupon.max_redemptions ?? '∞' }}
              </td>
              <td class="px-5 py-4 font-mono text-xs font-medium text-gray-500">
                {{ coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString() : 'No expiry' }}
              </td>
              <td class="px-5 py-4">
                <button 
                  @click="toggleActive(coupon)"
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition"
                  :class="coupon.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-gray-100 text-gray-500 border border-gray-200'"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="coupon.is_active ? 'bg-emerald-500' : 'bg-gray-400'"></span>
                  {{ coupon.is_active ? 'Active' : 'Inactive' }}
                </button>
              </td>
              <td class="px-5 py-4 text-right">
                <button @click="deleteCoupon(coupon)" class="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Create Coupon Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 class="text-lg font-black text-gray-950">Generate New Coupon</h3>
          <button @click="showModal = false" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <Icon name="lucide:x" class="text-lg" />
          </button>
        </div>

        <form @submit.prevent="createCoupon" class="space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Coupon Code</label>
            <input v-model="form.code" type="text" required placeholder="e.g. DERM2026" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-mono font-bold uppercase text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Discount Type</label>
              <select v-model="form.discount_type" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-bold text-gray-700 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount (₱)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Value</label>
              <input v-model.number="form.value" type="number" step="0.01" min="0.01" required class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Max Redemptions</label>
              <input v-model.number="form.max_redemptions" type="number" placeholder="Unlimited" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Valid Until</label>
              <input v-model="form.valid_until" type="date" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" />
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" @click="showModal = false" class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50">Cancel</button>
            <button type="submit" :disabled="isSubmitting" class="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-50">
              {{ isSubmitting ? 'Generating...' : 'Save Coupon' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <!-- Confirm Delete Coupon Modal -->
    <AdminSideComponentsConfirmModal
      :show="showDeleteModal"
      title="Delete Promo Coupon"
      :message="`Are you sure you want to delete coupon code '${couponToDelete?.code}'?`"
      confirm-text="Delete Coupon"
      variant="danger"
      @confirm="confirmDeleteCoupon"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import { subscriptionAdminService, type Coupon } from '~/api/subscription/SubscriptionAdminService'

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const isLoading = ref(true)
const isSubmitting = ref(false)
const showModal = ref(false)
const coupons = ref<Coupon[]>([])

const showDeleteModal = ref(false)
const couponToDelete = ref<Coupon | null>(null)

const form = ref<Coupon>({
  code: '',
  discount_type: 'percentage',
  value: 10,
  duration: 'once',
  max_redemptions: 50,
  is_active: true
})

const fetchCoupons = async () => {
  isLoading.value = true
  try {
    const res = await subscriptionAdminService.getCoupons()
    coupons.value = res?.data || []
  } catch (error: any) {
    toast.error(error.message || 'Failed to fetch coupons')
  } finally {
    isLoading.value = false
  }
}

const createCoupon = async () => {
  isSubmitting.value = true
  try {
    await subscriptionAdminService.createCoupon(form.value)
    toast.success('Coupon code created successfully')
    showModal.value = false
    form.value = {
      code: '',
      discount_type: 'percentage',
      value: 10,
      duration: 'once',
      max_redemptions: 50,
      is_active: true
    }
    await fetchCoupons()
  } catch (error: any) {
    toast.error(error.message || 'Failed to create coupon')
  } finally {
    isSubmitting.value = false
  }
}

const toggleActive = async (coupon: Coupon) => {
  if (!coupon.id) return
  try {
    await subscriptionAdminService.toggleCouponActive(coupon.id)
    coupon.is_active = !coupon.is_active
    toast.success(`Coupon "${coupon.code}" status updated to ${coupon.is_active ? 'Active' : 'Inactive'}`)
  } catch (error: any) {
    toast.error(error.message || 'Failed to toggle active state')
  }
}

const deleteCoupon = (coupon: Coupon) => {
  if (!coupon.id) return
  couponToDelete.value = coupon
  showDeleteModal.value = true
}

const confirmDeleteCoupon = async () => {
  if (!couponToDelete.value?.id) return
  try {
    await subscriptionAdminService.deleteCoupon(couponToDelete.value.id)
    toast.success(`Coupon "${couponToDelete.value.code}" deleted successfully`)
    showDeleteModal.value = false
    couponToDelete.value = null
    await fetchCoupons()
  } catch (error: any) {
    toast.error(error.message || 'Failed to delete coupon')
  }
}

onMounted(() => {
  fetchCoupons()
})
</script>
