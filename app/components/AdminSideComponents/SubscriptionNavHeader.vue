<template>
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <div class="flex items-center gap-2">
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon :name="icon" class="text-xl" />
        </div>
        <h1 class="text-2xl font-black text-gray-950">{{ title }}</h1>
      </div>
      <p class="mt-1 text-sm text-gray-500">{{ description }}</p>
    </div>

    <!-- Navigation Tabs & Actions -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
        <NuxtLink
          to="/admin/subscriptions"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition"
          :class="currentTab === 'dashboard' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
        >
          <Icon name="lucide:bar-chart-3" class="text-sm" />
          Dashboard
        </NuxtLink>
        <NuxtLink
          to="/admin/subscriptions/plans"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition"
          :class="currentTab === 'plans' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
        >
          <Icon name="lucide:sliders" class="text-sm" />
          Plan Builder
        </NuxtLink>
        <NuxtLink
          to="/admin/subscriptions/features"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition"
          :class="currentTab === 'features' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
        >
          <Icon name="lucide:sparkles" class="text-sm" />
          Features
        </NuxtLink>
        <NuxtLink
          to="/admin/subscriptions/payments"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition"
          :class="currentTab === 'payments' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
        >
          <Icon name="lucide:receipt" class="text-sm" />
          Payments
        </NuxtLink>
        <NuxtLink
          to="/admin/subscriptions/coupons"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition"
          :class="currentTab === 'coupons' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
        >
          <Icon name="lucide:ticket" class="text-sm" />
          Coupons
        </NuxtLink>
      </div>

      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description: string
    icon?: string
    currentTab: 'dashboard' | 'plans' | 'payments' | 'coupons'
  }>(),
  {
    icon: 'heroicons:credit-card'
  }
)
</script>
