<template>
  <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
    <div>
      <div class="flex items-center gap-2">
        <div class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
          <Icon
            :name="icon"
            class="text-xl"
          />
        </div>
        <h1 class="text-xl font-black text-gray-950 md:text-2xl">{{ title }}</h1>
      </div>
      <p
        class="mt-1 text-sm text-gray-500"
        v-html="description"
      />
    </div>

    <!-- Navigation Tabs & Actions -->
    <div
      class="flex min-w-0"
      :class="
        currentTab === 'payments'
          ? 'flex-col items-start gap-2.5 sm:items-end'
          : 'flex-1 flex-wrap items-center justify-start gap-3 md:flex-nowrap xl:justify-end'
      "
    >
      <div
        class="scrollbar-none flex max-w-full shrink-0 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1"
      >
        <NuxtLink
          to="/admin/subscriptions"
          class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition"
          :class="
            currentTab === 'dashboard'
              ? 'bg-primary shadow-primary/25 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          "
        >
          <Icon
            name="lucide:bar-chart-3"
            class="text-sm"
          />
          Dashboard
        </NuxtLink>
        <NuxtLink
          to="/admin/subscriptions/plans"
          class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition"
          :class="
            currentTab === 'plans'
              ? 'bg-primary shadow-primary/25 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          "
        >
          <Icon
            name="lucide:sliders"
            class="text-sm"
          />
          Plan Builder
        </NuxtLink>
        <NuxtLink
          to="/admin/subscriptions/features"
          class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition"
          :class="
            currentTab === 'features'
              ? 'bg-primary shadow-primary/25 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          "
        >
          <Icon
            name="lucide:sparkles"
            class="text-sm"
          />
          Features
        </NuxtLink>
        <NuxtLink
          to="/admin/subscriptions/payments"
          class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition"
          :class="
            currentTab === 'payments'
              ? 'bg-primary shadow-primary/25 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          "
        >
          <Icon
            name="lucide:receipt"
            class="text-sm"
          />
          Payments
        </NuxtLink>
        <NuxtLink
          to="/admin/subscriptions/coupons"
          class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition"
          :class="
            currentTab === 'coupons'
              ? 'bg-primary shadow-primary/25 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          "
        >
          <Icon
            name="lucide:ticket"
            class="text-sm"
          />
          Coupons
        </NuxtLink>
      </div>

      <div
        v-if="$slots.actions"
        class="flex shrink-0 items-center gap-2"
        :class="{ 'w-full justify-start sm:w-auto sm:justify-end': currentTab === 'payments' }"
      >
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  withDefaults(
    defineProps<{
      title: string
      description: string
      icon?: string
      currentTab: 'dashboard' | 'plans' | 'features' | 'payments' | 'coupons'
    }>(),
    {
      icon: 'heroicons:credit-card'
    }
  )
</script>
