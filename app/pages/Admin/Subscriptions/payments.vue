<template>
  <div class="space-y-6">
    <AdminSideComponentsSubscriptionNavHeader
      title="Payment History & Audit Logs"
      description="View real-time payment transactions and automated gateway settlements via PayMongo."
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
            class="rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer"
            :class="activeTab === tab.value ? 'bg-primary text-white shadow-sm' : 'text-primary/70 hover:text-primary hover:bg-primary/10'"
          >
            {{ tab.label }}
          </button>
        </div>
      </template>
    </AdminSideComponentsSubscriptionNavHeader>

    <!-- Payments Table Section -->
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <tr>
              <th class="px-5 py-3.5">Doctor</th>
              <th class="px-5 py-3.5">Subscribed Plan</th>
              <th class="px-5 py-3.5">Amount</th>
              <th class="px-5 py-3.5">Gateway Reference</th>
              <th class="px-5 py-3.5">Payment Method</th>
              <th class="px-5 py-3.5">Date</th>
              <th class="px-5 py-3.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="isLoading">
              <td colspan="7" class="px-5 py-10 text-center text-gray-500">
                <div class="flex items-center justify-center gap-2">
                  <Icon name="svg-spinners:ring-resize" class="h-5 w-5 text-primary animate-spin" />
                  <span class="text-xs font-medium">Loading payment transactions...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="payments.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-gray-500">
                <Icon name="lucide:receipt" class="mx-auto mb-2 text-3xl text-gray-300" />
                <p class="text-sm font-semibold text-gray-700">No payment transaction records found.</p>
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
              <td class="px-5 py-4 font-mono text-xs text-gray-600">
                {{ invoice.transaction_reference || 'N/A' }}
              </td>
              <td class="px-5 py-4 text-xs font-semibold text-gray-700 uppercase">
                {{ invoice.payment_method === 'paymongo' ? 'PayMongo (Online)' : invoice.payment_method }}
              </td>
              <td class="px-5 py-4 font-mono text-xs font-medium text-gray-500">
                {{ new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
              </td>
              <td class="px-5 py-4 text-right">
                <span 
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider"
                  :class="getStatusBadgeClass(invoice.payment_status)"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="getStatusDotClass(invoice.payment_status)"></span>
                  {{ invoice.payment_status === 'paid' ? 'Completed' : invoice.payment_status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import { subscriptionAdminService, type PaymentInvoice } from '~/api/subscription/SubscriptionAdminService'

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const activeTab = ref('')
const isLoading = ref(true)
const payments = ref<PaymentInvoice[]>([])

const tabs = [
  { label: 'All Transactions', value: '' },
  { label: 'Paid & Settled', value: 'paid' },
  { label: 'Pending Checkout', value: 'pending' },
  { label: 'Failed / Rejected', value: 'rejected' }
]

const fetchPayments = async () => {
  isLoading.value = true
  try {
    const res = await subscriptionAdminService.getPayments(activeTab.value)
    payments.value = res?.data?.data || []
  } catch (error: any) {
    toast.error(error.message || 'Failed to fetch payment records')
  } finally {
    isLoading.value = false
  }
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'paid':
    case 'approved':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
    case 'pending':
      return 'bg-amber-50 text-amber-700 border border-amber-200/60'
    case 'rejected':
      return 'bg-rose-50 text-rose-700 border border-rose-200/60'
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-200'
  }
}

const getStatusDotClass = (status: string) => {
  switch (status) {
    case 'paid':
    case 'approved':
      return 'bg-emerald-500'
    case 'pending':
      return 'bg-amber-500'
    case 'rejected':
      return 'bg-rose-500'
    default:
      return 'bg-gray-400'
  }
}

onMounted(() => {
  fetchPayments()
})
</script>
