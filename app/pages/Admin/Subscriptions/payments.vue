<template>
  <div class="space-y-6">
    <AdminSideComponentsSubscriptionNavHeader
      title="Payment Verification Queue"
      description="Review and approve manual offline receipts (Bank Transfer, GCash, OTC)."
      icon="lucide:receipt"
      current-tab="payments"
    >
      <template #actions>
        <!-- Status Filter Tabs -->
        <div class="flex rounded-xl border border-primary/20 bg-primary/5 p-1">
          <button 
            v-for="tab in tabs" 
            :key="tab.value"
            @click="activeTab = tab.value; fetchPayments()"
            class="rounded-lg px-3 py-1.5 text-xs font-bold transition"
            :class="activeTab === tab.value ? 'bg-primary text-white shadow-sm' : 'text-primary/70 hover:text-primary hover:bg-primary/10'"
          >
            {{ tab.label }}
          </button>
        </div>
      </template>
    </AdminSideComponentsSubscriptionNavHeader>

    <!-- Payments Queue Table Section -->
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <tr>
              <th class="px-5 py-3.5">Doctor</th>
              <th class="px-5 py-3.5">Requested Plan</th>
              <th class="px-5 py-3.5">Amount</th>
              <th class="px-5 py-3.5">Method</th>
              <th class="px-5 py-3.5">Receipt Photo</th>
              <th class="px-5 py-3.5">Date</th>
              <th class="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="isLoading">
              <td colspan="7" class="px-5 py-10 text-center text-gray-500">
                <div class="flex items-center justify-center gap-2">
                  <Icon name="svg-spinners:ring-resize" class="h-5 w-5 text-primary animate-spin" />
                  <span class="text-xs font-medium">Loading payment verification queue...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="payments.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-gray-500">
                <Icon name="lucide:receipt" class="mx-auto mb-2 text-3xl text-gray-300" />
                <p class="text-sm font-semibold text-gray-700">No payment records found for this filter.</p>
              </td>
            </tr>
            <tr v-for="invoice in payments" :key="invoice.id" class="transition hover:bg-gray-50/60">
              <td class="px-5 py-4 font-bold text-gray-950">
                Dr. {{ invoice.user?.first_name || '' }} {{ invoice.user?.last_name || invoice.user?.name || 'Doctor' }}
                <div class="text-xs font-medium text-gray-500 font-normal">{{ invoice.user?.email }}</div>
              </td>
              <td class="px-5 py-4">
                <span class="font-bold text-gray-900">{{ invoice.subscription?.plan?.name || 'Doctor Subscription' }}</span>
                <div class="text-xs font-mono font-medium text-gray-500 capitalize">{{ invoice.subscription?.billing_cycle }}</div>
              </td>
              <td class="px-5 py-4 font-mono font-bold text-gray-950">
                ₱{{ Number(invoice.final_amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
              </td>
              <td class="px-5 py-4 text-xs font-mono font-semibold text-gray-700 capitalize">
                {{ invoice.payment_method?.replace(/_/g, ' ') }}
              </td>
              <td class="px-5 py-4">
                <button 
                  v-if="invoice.proof_of_payment_path"
                  @click="openReceipt(invoice.proof_of_payment_path)"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/10"
                >
                  <Icon name="lucide:file-text" class="text-sm" />
                  View Receipt
                </button>
                <span v-else class="text-xs italic text-gray-400">No receipt attached</span>
              </td>
              <td class="px-5 py-4 font-mono text-xs font-medium text-gray-500">
                {{ new Date(invoice.created_at).toLocaleDateString() }}
              </td>
              <td class="px-5 py-4 text-right space-x-2">
                <template v-if="invoice.payment_status === 'pending'">
                  <button 
                    @click="approve(invoice)"
                    class="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                  <button 
                    @click="openRejectModal(invoice)"
                    class="rounded-lg border border-rose-200 bg-white px-3.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                  >
                    Reject
                  </button>
                </template>
                <span 
                  v-else 
                  class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize"
                  :class="invoice.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'"
                >
                  {{ invoice.payment_status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Receipt Image Modal -->
    <div v-if="selectedReceipt" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div class="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl space-y-3">
        <div class="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 class="text-base font-black text-gray-950">Proof of Payment Receipt</h3>
          <button @click="selectedReceipt = null" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <Icon name="lucide:x" class="text-lg" />
          </button>
        </div>
        <div class="flex justify-center bg-gray-50 rounded-xl p-3 max-h-[70vh] overflow-hidden border border-gray-100">
          <img :src="selectedReceipt" alt="Receipt" class="object-contain max-h-[65vh] rounded-lg shadow-sm" />
        </div>
      </div>
    </div>

    <!-- Rejection Reason Modal -->
    <div v-if="showRejectModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl space-y-4">
        <div>
          <h3 class="text-lg font-black text-gray-950">Reject Payment Request</h3>
          <p class="mt-1 text-xs text-gray-500">Provide a reason for rejecting this payment submission.</p>
        </div>
        <textarea 
          v-model="rejectionReason"
          rows="3"
          placeholder="e.g. Reference number not found, unclear receipt image..."
          class="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition"
        ></textarea>
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button @click="showRejectModal = false" class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50">Cancel</button>
          <button @click="confirmReject" class="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700">Confirm Rejection</button>
        </div>
      </div>
    </div>
    <!-- Confirm Approval Modal -->
    <AdminSideComponentsConfirmModal
      :show="showApproveModal"
      title="Approve Payment Submission"
      :message="`Are you sure you want to approve subscription payment for Dr. ${invoiceToApprove?.user?.first_name || 'Doctor'}?`"
      confirm-text="Approve Payment"
      variant="primary"
      @confirm="confirmApprove"
      @cancel="showApproveModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import { subscriptionAdminService, type PaymentInvoice } from '~/api/subscription/SubscriptionAdminService'

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const activeTab = ref('pending')
const isLoading = ref(true)
const payments = ref<PaymentInvoice[]>([])
const selectedReceipt = ref<string | null>(null)
const showRejectModal = ref(false)
const rejectionReason = ref('')
const selectedInvoiceId = ref<number | null>(null)

const showApproveModal = ref(false)
const invoiceToApprove = ref<PaymentInvoice | null>(null)

const tabs = [
  { label: 'Pending Approval', value: 'pending' },
  { label: 'Approved Paid', value: 'paid' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All Payments', value: '' }
]

const fetchPayments = async () => {
  isLoading.value = true
  try {
    const res = await subscriptionAdminService.getPayments(activeTab.value)
    payments.value = res?.data?.data || []
  } catch (error: any) {
    toast.error(error.message || 'Failed to fetch payments')
  } finally {
    isLoading.value = false
  }
}

const openReceipt = (path: string) => {
  selectedReceipt.value = path.startsWith('http') ? path : `/storage/${path}`
}

const approve = (invoice: PaymentInvoice) => {
  invoiceToApprove.value = invoice
  showApproveModal.value = true
}

const confirmApprove = async () => {
  if (!invoiceToApprove.value?.id) return
  try {
    await subscriptionAdminService.approvePayment(invoiceToApprove.value.id)
    toast.success('Subscription payment approved successfully')
    showApproveModal.value = false
    invoiceToApprove.value = null
    await fetchPayments()
  } catch (error: any) {
    toast.error(error.message || 'Failed to approve payment')
  }
}

const openRejectModal = (invoice: PaymentInvoice) => {
  selectedInvoiceId.value = invoice.id
  rejectionReason.value = ''
  showRejectModal.value = true
}

const confirmReject = async () => {
  if (!selectedInvoiceId.value || !rejectionReason.value.trim()) {
    toast.error('Please enter a rejection reason')
    return
  }
  try {
    await subscriptionAdminService.rejectPayment(selectedInvoiceId.value, rejectionReason.value)
    toast.success('Payment request rejected')
    showRejectModal.value = false
    await fetchPayments()
  } catch (error: any) {
    toast.error(error.message || 'Failed to reject payment')
  }
}

onMounted(() => {
  fetchPayments()
})
</script>
