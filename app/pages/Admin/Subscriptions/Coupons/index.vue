<template>
  <div class="space-y-6">
    <AdminSideComponentsSubscriptionNavHeader
      title="Coupons & Promo Codes"
      description="Manage promotional campaign discount codes, schedules, eligibility rules, and redemptions."
      icon="lucide:ticket"
      current-tab="coupons"
    >
      <template #actions>
        <AppButton
          @click="openCreateModal"
          variant="solid"
          size="sm"
          class="shrink-0 whitespace-nowrap"
        >
          <Icon
            name="lucide:plus"
            class="mr-1 text-sm"
          />
          Create Coupon
        </AppButton>
      </template>
    </AdminSideComponentsSubscriptionNavHeader>

    <!-- Filter Tabs & Stats Bar -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div
        class="flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xs"
      >
        <button
          v-for="tab in filterTabs"
          :key="tab.value"
          type="button"
          @click="changeTab(tab.value)"
          class="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition"
          :class="
            activeTab === tab.value
              ? 'bg-primary text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          "
        >
          <span>{{ tab.label }}</span>
          <span
            class="py-0.2 rounded-full px-1.5 text-[10px] font-black"
            :class="
              activeTab === tab.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
            "
          >
            {{ tab.count }}
          </span>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-gray-500">
          Showing {{ filteredCoupons.length }} of {{ rawCoupons.length }} coupon(s)
        </span>
      </div>
    </div>

    <!-- Coupons Table Section -->
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead
            class="border-b border-gray-100 bg-gray-50/70 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
          >
            <tr>
              <th class="px-5 py-3.5">Code</th>
              <th class="px-5 py-3.5">Discount</th>
              <th class="px-5 py-3.5">Schedule & Validity</th>
              <th class="px-5 py-3.5">Redemptions & Limits</th>
              <th class="px-5 py-3.5">Eligibility</th>
              <th class="px-5 py-3.5">Status</th>
              <th class="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="isLoading">
              <td
                colspan="7"
                class="px-5 py-12 text-center text-gray-500"
              >
                <div class="flex items-center justify-center gap-2">
                  <Icon
                    name="svg-spinners:ring-resize"
                    class="text-primary h-5 w-5 animate-spin"
                  />
                  <span class="text-xs font-medium">Loading promo coupons...</span>
                </div>
              </td>
            </tr>

            <tr v-else-if="filteredCoupons.length === 0">
              <td
                colspan="7"
                class="px-5 py-14 text-center text-gray-500"
              >
                <div
                  class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400"
                >
                  <Icon
                    name="lucide:ticket"
                    class="text-2xl"
                  />
                </div>
                <p class="text-sm font-bold text-gray-800">No coupons found in this view</p>
                <p class="mt-0.5 text-xs text-gray-400">
                  {{
                    activeTab === 'archived'
                      ? 'No archived promo codes yet.'
                      : 'Generate promo codes to offer onboarding discounts.'
                  }}
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="coupon in filteredCoupons"
              :key="coupon.id"
              class="transition hover:bg-gray-50/60"
            >
              <!-- Code Column -->
              <td class="px-5 py-4">
                <div class="flex items-center gap-2">
                  <span class="text-primary font-mono text-sm font-black tracking-wider">
                    {{ coupon.code }}
                  </span>
                  <button
                    type="button"
                    @click="copyCode(coupon.code)"
                    class="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    title="Copy code"
                  >
                    <Icon
                      name="lucide:copy"
                      class="text-xs"
                    />
                  </button>
                </div>
              </td>

              <!-- Discount Column -->
              <td class="px-5 py-4">
                <div class="font-bold text-gray-950">
                  {{
                    coupon.discount_type === 'percentage'
                      ? `${coupon.value}% OFF`
                      : `₱${Number(coupon.value).toLocaleString()} OFF`
                  }}
                </div>
                <div
                  v-if="coupon.min_spend"
                  class="text-[11px] font-medium text-gray-400"
                >
                  Min: ₱{{ Number(coupon.min_spend).toLocaleString() }}
                </div>
              </td>

              <!-- Schedule & Validity Column -->
              <td class="px-5 py-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-1.5">
                    <span
                      class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                      :class="getScheduleBadge(coupon).classes"
                    >
                      <Icon
                        :name="getScheduleBadge(coupon).icon"
                        class="text-[10px]"
                      />
                      {{ getScheduleBadge(coupon).label }}
                    </span>
                  </div>
                  <div class="font-mono text-xs text-gray-600">
                    {{ coupon.valid_until ? formatDate(coupon.valid_until) : 'No expiry' }}
                  </div>
                </div>
              </td>

              <!-- Redemptions Column -->
              <td class="px-5 py-4">
                <div class="font-mono text-xs font-bold text-gray-800">
                  {{ coupon.times_redeemed || 0 }} / {{ coupon.max_redemptions ?? '∞' }}
                </div>
                <div class="text-[11px] font-medium text-gray-400">
                  {{
                    coupon.max_redemptions_per_user
                      ? `${coupon.max_redemptions_per_user} / doctor`
                      : 'Unlimited / dr'
                  }}
                </div>
              </td>

              <!-- Eligibility Column -->
              <td class="px-5 py-4">
                <div class="space-y-1">
                  <span
                    class="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700"
                  >
                    {{ formatSegment(coupon.customer_segment) }}
                  </span>
                  <div class="text-[11px] font-medium text-gray-500">
                    {{ formatPlanSummary(coupon) }}
                  </div>
                </div>
              </td>

              <!-- Status Column -->
              <td class="px-5 py-4">
                <div v-if="coupon.is_archived">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700"
                  >
                    <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                    Archived
                  </span>
                </div>
                <button
                  v-else
                  type="button"
                  @click="toggleActive(coupon)"
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition"
                  :class="
                    coupon.is_active
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-gray-200 bg-gray-100 text-gray-500'
                  "
                >
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="coupon.is_active ? 'bg-emerald-500' : 'bg-gray-400'"
                  ></span>
                  {{ coupon.is_active ? 'Active' : 'Disabled' }}
                </button>
              </td>

              <!-- Actions Column -->
              <td class="px-5 py-4 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <!-- View Button -->
                  <button
                    type="button"
                    @click="openViewModal(coupon)"
                    class="rounded-lg border border-gray-200 bg-white p-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                    title="View Coupon Details"
                  >
                    <Icon
                      name="lucide:eye"
                      class="text-sm"
                    />
                  </button>

                  <!-- Restore Button if Archived -->
                  <button
                    v-if="coupon.is_archived"
                    type="button"
                    @click="restoreCoupon(coupon)"
                    class="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
                    title="Restore Coupon"
                  >
                    <Icon
                      name="lucide:archive-restore"
                      class="text-sm"
                    />
                    <span>Restore</span>
                  </button>

                  <!-- Edit & Delete if not archived -->
                  <template v-else>
                    <!-- Edit Button -->
                    <button
                      type="button"
                      @click="openEditModal(coupon)"
                      class="rounded-lg border border-gray-200 bg-white p-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                      title="Edit Coupon"
                    >
                      <Icon
                        name="lucide:pencil"
                        class="text-sm"
                      />
                    </button>

                    <!-- Delete / Archive Button -->
                    <button
                      type="button"
                      @click="openDeleteModal(coupon)"
                      class="rounded-lg border border-rose-200 bg-white p-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                      :title="coupon.has_redemptions ? 'Archive Coupon' : 'Delete Coupon'"
                    >
                      <Icon
                        :name="coupon.has_redemptions ? 'lucide:archive' : 'lucide:trash-2'"
                        class="text-sm"
                      />
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- View Coupon Modal -->
    <AdminSideComponentsCouponViewModal
      :show="showViewModal"
      :coupon="selectedCoupon"
      :available-plans="availablePlans"
      @close="closeViewModal"
      @edit="switchViewToEdit"
      @restore="restoreCoupon"
    />

    <!-- Create / Edit Coupon Modal -->
    <AdminSideComponentsCouponEditModal
      :show="showEditModal"
      :coupon="selectedCoupon"
      :available-plans="availablePlans"
      :is-submitting="isSubmitting"
      @close="closeEditModal"
      @submit="handleSaveCoupon"
    />

    <!-- Smart Delete / Archive Modal -->
    <AdminSideComponentsCouponDeleteModal
      :show="showDeleteModal"
      :coupon="couponToDelete"
      :is-submitting="isDeleting"
      @cancel="closeDeleteModal"
      @confirm="handleConfirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import {
    subscriptionAdminService,
    type Coupon,
    type Plan
  } from '~/api/subscription/SubscriptionAdminService'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const isLoading = ref(true)
  const isSubmitting = ref(false)
  const isDeleting = ref(false)

  const activeTab = ref<'all' | 'active' | 'inactive' | 'archived'>('all')
  const rawCoupons = ref<Coupon[]>([])
  const availablePlans = ref<Plan[]>([])

  // Modal States
  const showViewModal = ref(false)
  const showEditModal = ref(false)
  const showDeleteModal = ref(false)

  const selectedCoupon = ref<Coupon | null>(null)
  const couponToDelete = ref<Coupon | null>(null)

  const fetchCoupons = async () => {
    isLoading.value = true
    try {
      // Fetch all including trashed
      const res = await subscriptionAdminService.getCoupons('all')
      rawCoupons.value = res?.data || []
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch coupons')
    } finally {
      isLoading.value = false
    }
  }

  const fetchPlans = async () => {
    try {
      const res = await subscriptionAdminService.getPlans()
      availablePlans.value = res?.data || []
    } catch {
      // Non-critical plan load error
    }
  }

  const filteredCoupons = computed(() => {
    if (activeTab.value === 'archived') {
      return rawCoupons.value.filter(c => c.is_archived)
    }
    if (activeTab.value === 'active') {
      return rawCoupons.value.filter(c => !c.is_archived && c.is_active)
    }
    if (activeTab.value === 'inactive') {
      return rawCoupons.value.filter(c => !c.is_archived && !c.is_active)
    }
    return rawCoupons.value
  })

  const filterTabs = computed(() => [
    {
      label: 'All Coupons',
      value: 'all' as const,
      count: rawCoupons.value.length
    },
    {
      label: 'Active',
      value: 'active' as const,
      count: rawCoupons.value.filter(c => !c.is_archived && c.is_active).length
    },
    {
      label: 'Disabled',
      value: 'inactive' as const,
      count: rawCoupons.value.filter(c => !c.is_archived && !c.is_active).length
    },
    {
      label: 'Archived',
      value: 'archived' as const,
      count: rawCoupons.value.filter(c => c.is_archived).length
    }
  ])

  const changeTab = (tab: 'all' | 'active' | 'inactive' | 'archived') => {
    activeTab.value = tab
  }

  const openCreateModal = () => {
    selectedCoupon.value = null
    showEditModal.value = true
  }

  const openViewModal = (coupon: Coupon) => {
    selectedCoupon.value = coupon
    showViewModal.value = true
  }

  const closeViewModal = () => {
    showViewModal.value = false
    selectedCoupon.value = null
  }

  const switchViewToEdit = (coupon: Coupon) => {
    showViewModal.value = false
    selectedCoupon.value = coupon
    showEditModal.value = true
  }

  const openEditModal = (coupon: Coupon) => {
    selectedCoupon.value = coupon
    showEditModal.value = true
  }

  const closeEditModal = () => {
    showEditModal.value = false
    selectedCoupon.value = null
  }

  const openDeleteModal = (coupon: Coupon) => {
    couponToDelete.value = coupon
    showDeleteModal.value = true
  }

  const closeDeleteModal = () => {
    showDeleteModal.value = false
    couponToDelete.value = null
  }

  const handleSaveCoupon = async (payload: Partial<Coupon>) => {
    isSubmitting.value = true
    try {
      if (payload.id) {
        await subscriptionAdminService.updateCoupon(payload.id, payload)
        toast.success(`Coupon "${payload.code}" updated successfully`)
      } else {
        await subscriptionAdminService.createCoupon(payload as Coupon)
        toast.success(`Coupon "${payload.code}" generated successfully`)
      }
      closeEditModal()
      await fetchCoupons()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save coupon')
    } finally {
      isSubmitting.value = false
    }
  }

  const toggleActive = async (coupon: Coupon) => {
    if (!coupon.id) return
    try {
      await subscriptionAdminService.toggleCouponActive(coupon.id)
      coupon.is_active = !coupon.is_active
      toast.success(
        `Coupon "${coupon.code}" status changed to ${coupon.is_active ? 'Active' : 'Disabled'}`
      )
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle status')
    }
  }

  const handleConfirmDelete = async ({ coupon, force }: { coupon: Coupon; force: boolean }) => {
    if (!coupon.id) return
    isDeleting.value = true
    try {
      const res = await subscriptionAdminService.deleteCoupon(coupon.id, force)
      if (res?.archived) {
        toast.success(`Coupon "${coupon.code}" archived successfully`)
      } else {
        toast.success(`Coupon "${coupon.code}" permanently deleted`)
      }
      closeDeleteModal()
      if (showViewModal.value) {
        closeViewModal()
      }
      await fetchCoupons()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete coupon')
    } finally {
      isDeleting.value = false
    }
  }

  const restoreCoupon = async (coupon: Coupon) => {
    if (!coupon.id) return
    try {
      await subscriptionAdminService.restoreCoupon(coupon.id)
      toast.success(`Coupon "${coupon.code}" restored from archive`)
      if (showViewModal.value) {
        closeViewModal()
      }
      await fetchCoupons()
    } catch (error: any) {
      toast.error(error.message || 'Failed to restore coupon')
    }
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success(`Copied "${code}" to clipboard!`)
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
    if (segment === 'new_doctors') return 'New Doctors Only'
    if (segment === 'renewals') return 'Renewals Only'
    return 'All Doctors'
  }

  const formatPlanSummary = (coupon: Coupon) => {
    if (!coupon.applicable_plans || coupon.applicable_plans.length === 0) {
      return 'All Plans'
    }
    return `${coupon.applicable_plans.length} plan(s) selected`
  }

  const getScheduleBadge = (coupon: Coupon) => {
    const now = new Date()
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return {
        label: 'Scheduled',
        classes: 'border border-blue-200 bg-blue-50 text-blue-700',
        icon: 'lucide:calendar-clock'
      }
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return {
        label: 'Expired',
        classes: 'border border-rose-200 bg-rose-50 text-rose-700',
        icon: 'lucide:calendar-x'
      }
    }
    return {
      label: 'Active Window',
      classes: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: 'lucide:calendar-check'
    }
  }

  onMounted(() => {
    fetchCoupons()
    fetchPlans()
  })
</script>
