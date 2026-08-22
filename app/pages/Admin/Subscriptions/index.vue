<template>
  <div class="space-y-6">
    <AdminSideComponentsSubscriptionNavHeader
      title="Subscription Management"
      description="Monitor doctor subscriptions, recurring revenue, and payment status."
      icon="heroicons:credit-card"
      current-tab="dashboard"
    />

    <!-- Stat Metrics Grid using reusable MetricCard component -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <AdminSideComponentsMetricCard
        label="Est. MRR"
        :value="`₱${metrics.mrr.toLocaleString('en-US', { minimumFractionDigits: 2 })}`"
        detail="Monthly Recurring Revenue"
        icon="lucide:dollar-sign"
        tone="emerald"
        :loading="isLoading"
      />

      <AdminSideComponentsMetricCard
        label="Active Subscribers"
        :value="metrics.active_count"
        detail="Doctors with active access"
        icon="lucide:check-circle-2"
        tone="blue"
        :loading="isLoading"
      />

      <AdminSideComponentsMetricCard
        label="Pending Approvals"
        :value="metrics.pending_payments_count"
        detail="Manual receipts awaiting review"
        icon="lucide:clock"
        tone="amber"
        to="/admin/subscriptions/payments"
        :loading="isLoading"
      />

      <AdminSideComponentsMetricCard
        label="Past Due / Expired"
        :value="metrics.past_due_count"
        detail="Subscriptions needing renewal"
        icon="lucide:alert-triangle"
        tone="rose"
        :loading="isLoading"
      />
    </div>

    <!-- Recent Subscriptions Table Section -->
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h2 class="text-base font-black text-gray-950">Recent Subscribers</h2>
          <p class="mt-1 text-xs text-gray-500">List of latest registered doctor subscription accounts.</p>
        </div>
        <span class="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-500 border border-gray-100">Top 10 Accounts</span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <tr>
              <th class="px-5 py-3.5">Doctor</th>
              <th class="px-5 py-3.5">Plan</th>
              <th class="px-5 py-3.5">Billing Cycle</th>
              <th class="px-5 py-3.5">Status</th>
              <th class="px-5 py-3.5">Starts At</th>
              <th class="px-5 py-3.5">Ends At</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="isLoading">
              <td colspan="6" class="px-5 py-10 text-center text-gray-500">
                <div class="flex items-center justify-center gap-2">
                  <Icon name="svg-spinners:ring-resize" class="h-5 w-5 text-primary animate-spin" />
                  <span class="text-xs font-medium">Loading subscription accounts...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="recentSubscribers.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-gray-500">
                <Icon name="lucide:inbox" class="mx-auto mb-2 text-3xl text-gray-300" />
                <p class="text-sm font-semibold text-gray-700">No doctor subscriptions found.</p>
              </td>
            </tr>
            <tr v-for="sub in recentSubscribers" :key="sub.id" class="transition hover:bg-gray-50/60">
              <td class="px-5 py-4 font-bold text-gray-950">
                Dr. {{ sub.user?.first_name || '' }} {{ sub.user?.last_name || sub.user?.name || 'Doctor' }}
                <div class="text-xs font-medium text-gray-500 font-normal">{{ sub.user?.email }}</div>
              </td>
              <td class="px-5 py-4">
                <span class="font-bold text-gray-900">{{ sub.plan?.name || 'Standard Plan' }}</span>
                <div class="text-xs font-medium text-gray-500 capitalize">{{ sub.plan?.tier_type?.replace(/_/g, ' ') }}</div>
              </td>
              <td class="px-5 py-4 font-mono text-xs font-semibold text-gray-700 capitalize">
                {{ sub.billing_cycle }}
              </td>
              <td class="px-5 py-4">
                <span 
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize"
                  :class="{
                    'bg-emerald-50 text-emerald-700 border border-emerald-200/60': sub.status === 'active',
                    'bg-amber-50 text-amber-700 border border-amber-200/60': sub.status === 'trialing' || sub.status === 'pending',
                    'bg-rose-50 text-rose-700 border border-rose-200/60': sub.status === 'past_due' || sub.status === 'expired'
                  }"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="{
                    'bg-emerald-500': sub.status === 'active',
                    'bg-amber-500': sub.status === 'trialing' || sub.status === 'pending',
                    'bg-rose-500': sub.status === 'past_due' || sub.status === 'expired'
                  }"></span>
                  {{ sub.status }}
                </span>
              </td>
              <td class="px-5 py-4 font-mono text-xs font-medium text-gray-500">
                {{ sub.starts_at ? new Date(sub.starts_at).toLocaleDateString() : 'N/A' }}
              </td>
              <td class="px-5 py-4 font-mono text-xs font-medium text-gray-500">
                {{ sub.ends_at ? new Date(sub.ends_at).toLocaleDateString() : 'N/A' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { subscriptionAdminService } from '~/api/subscription/SubscriptionAdminService'

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const isLoading = ref(true)
const metrics = ref({
  mrr: 0,
  active_count: 0,
  trialing_count: 0,
  past_due_count: 0,
  pending_payments_count: 0
})
const recentSubscribers = ref<any[]>([])

const fetchDashboard = async () => {
  isLoading.value = true
  try {
    const res = await subscriptionAdminService.getDashboard()
    if (res?.data) {
      metrics.value = res.data.metrics || metrics.value
      recentSubscribers.value = res.data.recent_subscribers || []
    }
  } catch (error) {
    console.error('Failed to load subscription dashboard:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchDashboard()
})
</script>

