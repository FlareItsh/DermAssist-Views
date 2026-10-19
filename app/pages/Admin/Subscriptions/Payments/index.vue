<template>
  <div class="space-y-6">
    <AdminSideComponentsSubscriptionNavHeader
      title="Payment History & Audit Logs"
      description="View real-time payment transactions and automated gateway settlements via PayMongo."
      icon="lucide:receipt"
      current-tab="payments"
    >
      <template #actions>
        <!-- Status Filter Tabs (Stacked under nav filter on the right side) -->
        <div
          class="scrollbar-none flex max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1"
        >
          <button
            v-for="tab in tabs"
            :key="tab.value"
            @click="selectTab(tab.value)"
            class="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition"
            :class="
              activeTab === tab.value
                ? 'bg-primary shadow-primary/25 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            "
          >
            {{ tab.label }}
          </button>
        </div>
      </template>
    </AdminSideComponentsSubscriptionNavHeader>

    <!-- Payments Table Section -->
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <!-- Mobile Card List -->
      <div class="divide-y divide-gray-100 md:hidden">
        <div
          v-if="isLoading"
          class="flex items-center justify-center gap-2 px-4 py-10 text-gray-500"
        >
          <Icon
            name="svg-spinners:ring-resize"
            class="text-primary h-5 w-5 animate-spin"
          />
          <span class="text-xs font-medium">Loading payment transactions...</span>
        </div>
        <div
          v-else-if="payments.length === 0"
          class="px-4 py-10 text-center text-gray-500"
        >
          <Icon
            name="lucide:receipt"
            class="mx-auto mb-2 text-3xl text-gray-300"
          />
          <p class="text-sm font-semibold text-gray-700">No payment transaction records found.</p>
        </div>
        <template v-else>
          <article
            v-for="invoice in payments"
            :key="invoice.id"
            class="space-y-3 px-4 py-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-bold text-gray-950">
                  Dr. {{ invoice.user?.first_name || '' }}
                  {{ invoice.user?.last_name || invoice.user?.name || 'Doctor' }}
                </p>
                <p class="truncate text-xs font-medium text-gray-500">{{ invoice.user?.email }}</p>
              </div>
              <span
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase"
                :class="getStatusBadgeClass(invoice.payment_status)"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="getStatusDotClass(invoice.payment_status)"
                ></span>
                {{ invoice.payment_status === 'paid' ? 'Completed' : invoice.payment_status }}
              </span>
            </div>

            <div class="flex items-end justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-bold text-gray-900">
                  {{ invoice.subscription?.plan?.name || 'Doctor Subscription' }}
                </p>
                <p class="font-mono text-xs font-medium text-gray-500 capitalize">
                  {{ invoice.subscription?.billing_cycle }}
                </p>
              </div>
              <p class="font-mono text-base font-bold text-gray-950">
                ₱{{
                  Number(invoice.final_amount).toLocaleString('en-US', {
                    minimumFractionDigits: 2
                  })
                }}
              </p>
            </div>

            <div class="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <p class="font-semibold text-gray-700 uppercase">
                {{
                  invoice.payment_method === 'paymongo'
                    ? 'PayMongo (Online)'
                    : invoice.payment_method
                }}
                ·
                {{
                  new Date(invoice.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                }}
              </p>
            </div>
          </article>
        </template>
      </div>

      <div class="hidden overflow-x-auto md:block">
        <table class="w-full text-left text-sm">
          <thead
            class="border-b border-gray-100 bg-gray-50/70 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
          >
            <tr>
              <th class="px-5 py-3.5">Doctor</th>
              <th class="px-5 py-3.5">Subscribed Plan</th>
              <th class="px-5 py-3.5">Amount</th>
              <th class="px-5 py-3.5">Payment Method</th>
              <th class="px-5 py-3.5">Date</th>
              <th class="px-5 py-3.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="isLoading">
              <td
                colspan="6"
                class="px-5 py-10 text-center text-gray-500"
              >
                <div class="flex items-center justify-center gap-2">
                  <Icon
                    name="svg-spinners:ring-resize"
                    class="text-primary h-5 w-5 animate-spin"
                  />
                  <span class="text-xs font-medium">Loading payment transactions...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="payments.length === 0">
              <td
                colspan="6"
                class="px-5 py-12 text-center text-gray-500"
              >
                <Icon
                  name="lucide:receipt"
                  class="mx-auto mb-2 text-3xl text-gray-300"
                />
                <p class="text-sm font-semibold text-gray-700">
                  No payment transaction records found.
                </p>
              </td>
            </tr>
            <tr
              v-for="invoice in payments"
              :key="invoice.id"
              class="transition hover:bg-gray-50/60"
            >
              <td class="px-5 py-4 font-bold text-gray-950">
                Dr. {{ invoice.user?.first_name || '' }}
                {{ invoice.user?.last_name || invoice.user?.name || 'Doctor' }}
                <div class="text-xs font-medium font-normal text-gray-500">
                  {{ invoice.user?.email }}
                </div>
              </td>
              <td class="px-5 py-4">
                <span class="font-bold text-gray-900">{{
                  invoice.subscription?.plan?.name || 'Doctor Subscription'
                }}</span>
                <div class="font-mono text-xs font-medium text-gray-500 capitalize">
                  {{ invoice.subscription?.billing_cycle }}
                </div>
              </td>
              <td class="px-5 py-4 font-mono font-bold text-gray-950">
                ₱{{
                  Number(invoice.final_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })
                }}
              </td>
              <td class="px-5 py-4 text-xs font-semibold text-gray-700 uppercase">
                {{
                  invoice.payment_method === 'paymongo'
                    ? 'PayMongo (Online)'
                    : invoice.payment_method
                }}
              </td>
              <td class="px-5 py-4 font-mono text-xs font-medium text-gray-500">
                {{
                  new Date(invoice.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                }}
              </td>
              <td class="px-5 py-4 text-right">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-wider uppercase"
                  :class="getStatusBadgeClass(invoice.payment_status)"
                >
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="getStatusDotClass(invoice.payment_status)"
                  ></span>
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
  import {
    subscriptionAdminService,
    type PaymentInvoice
  } from '~/api/subscription/SubscriptionAdminService'

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

  const selectTab = (tabValue: string) => {
    activeTab.value = tabValue
    fetchPayments()
  }

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
