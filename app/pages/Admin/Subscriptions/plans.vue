<template>
  <div class="space-y-6">
    <AdminSideComponentsSubscriptionNavHeader
      title="SaaS Plan Builder"
      description="Configure dynamic doctor subscription tiers, seat limits, and feature flags."
      icon="lucide:sliders-horizontal"
      current-tab="plans"
    >
      <template #actions>
        <button 
          @click="openCreateModal"
          class="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-dark"
        >
          <Icon name="lucide:plus" class="text-sm" />
          Create New Plan
        </button>
      </template>
    </AdminSideComponentsSubscriptionNavHeader>

    <!-- Plans Table -->
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <tr>
              <th class="px-5 py-3.5">Plan Name</th>
              <th class="px-5 py-3.5">Tier Model</th>
              <th class="px-5 py-3.5">Monthly Price</th>
              <th class="px-5 py-3.5">Annual Price</th>
              <th class="px-5 py-3.5">Limits</th>
              <th class="px-5 py-3.5">Status</th>
              <th class="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="isLoading">
              <td colspan="7" class="px-5 py-10 text-center text-gray-500">
                <div class="flex items-center justify-center gap-2">
                  <Icon name="svg-spinners:ring-resize" class="h-5 w-5 text-primary animate-spin" />
                  <span class="text-xs font-medium">Loading subscription plans...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="plans.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-gray-500">
                <Icon name="lucide:sliders-horizontal" class="mx-auto mb-2 text-3xl text-gray-300" />
                <p class="text-sm font-semibold text-gray-700">No plans created yet. Click "Create New Plan" to add one.</p>
              </td>
            </tr>
            <tr v-for="plan in plans" :key="plan.id" class="transition hover:bg-gray-50/60">
              <td class="px-5 py-4 font-bold text-gray-950">
                {{ plan.name }}
                <div class="text-xs font-mono font-normal text-gray-400">{{ plan.slug }}</div>
              </td>
              <td class="px-5 py-4">
                <span class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary border border-primary/20 capitalize">
                  {{ plan.tier_type?.replace(/_/g, ' ') }}
                </span>
              </td>
              <td class="px-5 py-4 font-mono font-bold text-gray-950">
                ₱{{ Number(plan.price_monthly).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
              </td>
              <td class="px-5 py-4 font-mono font-bold text-gray-950">
                ₱{{ Number(plan.price_annual).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
              </td>
              <td class="px-5 py-4 text-xs font-medium space-y-0.5">
                <div class="text-gray-700">Doctors: <span class="font-mono text-gray-500">{{ plan.max_doctors ?? 'Unlimited' }}</span></div>
                <div class="text-gray-700">Clinics: <span class="font-mono text-gray-500">{{ plan.max_clinics ?? 'Unlimited' }}</span></div>
              </td>
              <td class="px-5 py-4">
                <button 
                  @click="toggleActive(plan)"
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition"
                  :class="plan.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-gray-100 text-gray-500 border border-gray-200'"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="plan.is_active ? 'bg-emerald-500' : 'bg-gray-400'"></span>
                  {{ plan.is_active ? 'Active' : 'Inactive' }}
                </button>
              </td>
              <td class="px-5 py-4 text-right space-x-2">
                <button @click="editPlan(plan)" class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50">
                  Edit
                </button>
                <button @click="deletePlan(plan)" class="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Create / Edit Plan Dialog Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div class="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 class="text-lg font-black text-gray-950">{{ isEditing ? 'Edit Subscription Plan' : 'Create Subscription Plan' }}</h3>
          <button @click="showModal = false" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <Icon name="lucide:x" class="text-lg" />
          </button>
        </div>

        <form @submit.prevent="savePlan" class="space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Plan Name</label>
            <input v-model="form.name" type="text" required placeholder="e.g. Solo Practitioner" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Subscription Tier Type</label>
            <select v-model="form.tier_type" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-bold text-gray-700 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition">
              <option value="individual">Individual (1 Doctor, 1 Clinic)</option>
              <option value="doctor_multi_clinic">One Doctor, Multiple Clinics</option>
              <option value="clinic_multi_doctor">One Clinic, Multiple Doctors</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Monthly Price (₱)</label>
              <input v-model.number="form.price_monthly" type="number" step="0.01" min="0" required class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Annual Price (₱)</label>
              <input v-model.number="form.price_annual" type="number" step="0.01" min="0" required class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Max Doctors (Seats)</label>
              <input v-model.number="form.max_doctors" type="number" placeholder="Leave empty for unlimited" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Max Clinics (Branches)</label>
              <input v-model.number="form.max_clinics" type="number" placeholder="Leave empty for unlimited" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Free Trial Days</label>
              <input v-model.number="form.trial_period_days" type="number" min="0" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Grace Period Days</label>
              <input v-model.number="form.grace_period_days" type="number" min="0" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" />
            </div>
          </div>

          <!-- Custom Marketing Feature Bullet Items -->
          <div class="space-y-1.5 border-t border-gray-100 pt-3">
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500">Custom Feature Highlights (One per line)</label>
            <textarea
              v-model="customFeaturesText"
              rows="3"
              placeholder="e.g. 24/7 Priority Support&#10;Custom Clinic Branding&#10;Dedicated Account Manager"
              class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition"
            ></textarea>
          </div>

          <!-- Dynamic Feature Flags Checkboxes -->
          <div class="space-y-2 border-t border-gray-100 pt-3">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-500">Feature Access Flags</label>
              <NuxtLink to="/admin/subscriptions/features" class="text-[11px] font-bold text-primary hover:underline flex items-center gap-1">
                <Icon name="lucide:settings" class="text-xs" />
                <span>Manage Features</span>
              </NuxtLink>
            </div>
            <div v-if="isLoadingFeatures" class="py-3 text-center text-xs text-gray-400">
              Loading system features...
            </div>
            <div v-else class="space-y-2 text-xs">
              <label 
                v-for="feature in availableFeatures" 
                :key="feature.id" 
                class="flex items-center gap-2.5 cursor-pointer font-bold text-gray-700 hover:text-gray-900"
              >
                <input 
                  v-model="form.features[feature.code || '']" 
                  type="checkbox" 
                  class="rounded border-gray-300 text-primary focus:ring-primary/20 h-4 w-4" 
                />
                <div class="flex flex-col">
                  <span>{{ feature.name }}</span>
                  <span v-if="feature.description" class="text-[10px] font-normal text-gray-400">{{ feature.description }}</span>
                </div>
              </label>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" @click="showModal = false" class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50">Cancel</button>
            <button type="submit" :disabled="isSubmitting" class="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-50">
              {{ isSubmitting ? 'Saving...' : 'Save Plan' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <!-- Confirm Delete Modal -->
    <AdminSideComponentsConfirmModal
      :show="showDeleteModal"
      title="Delete Subscription Plan"
      :message="`Are you sure you want to delete '${planToDelete?.name}'? This action cannot be undone.`"
      confirm-text="Delete Plan"
      variant="danger"
      @confirm="confirmDeletePlan"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import { subscriptionAdminService, type Plan, type Feature } from '~/api/subscription/SubscriptionAdminService'

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const isLoading = ref(true)
const isLoadingFeatures = ref(true)
const isSubmitting = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const selectedId = ref<number | null>(null)
const plans = ref<Plan[]>([])
const availableFeatures = ref<Feature[]>([])

const showDeleteModal = ref(false)
const planToDelete = ref<Plan | null>(null)

const form = ref<Plan>({
  name: '',
  tier_type: 'individual',
  price_monthly: 0,
  price_annual: 0,
  max_doctors: null,
  max_clinics: null,
  trial_period_days: 0,
  grace_period_days: 3,
  is_active: true,
  features: {}
})

const customFeaturesText = ref('')

const fetchPlans = async () => {
  isLoading.value = true
  try {
    const res = await subscriptionAdminService.getPlans()
    plans.value = res?.data || []
  } catch (error: any) {
    toast.error(error.message || 'Failed to load plans')
  } finally {
    isLoading.value = false
  }
}

const fetchFeatures = async () => {
  isLoadingFeatures.value = true
  try {
    const res = await subscriptionAdminService.getFeatures()
    availableFeatures.value = res?.data || []
  } catch (e: any) {
    console.error('Failed to load system features:', e)
  } finally {
    isLoadingFeatures.value = false
  }
}

const openCreateModal = () => {
  isEditing.value = false
  selectedId.value = null
  customFeaturesText.value = ''
  
  const defaultFlags: Record<string, boolean> = {
    custom_list: [] as any
  }
  availableFeatures.value.forEach((f) => {
    if (f.code) {
      defaultFlags[f.code] = true
    }
  })

  form.value = {
    name: '',
    tier_type: 'individual',
    price_monthly: 999,
    price_annual: 9990,
    max_doctors: 1,
    max_clinics: 1,
    trial_period_days: 14,
    grace_period_days: 3,
    is_active: true,
    features: defaultFlags
  }
  showModal.value = true
}

const editPlan = (plan: Plan) => {
  isEditing.value = true
  selectedId.value = plan.id ?? null
  form.value = JSON.parse(JSON.stringify(plan))
  
  if (!form.value.features || Array.isArray(form.value.features)) {
    form.value.features = {}
  }
  
  // Populate from plan_features relationship if available
  const planFeats = (plan as any).plan_features || []
  if (Array.isArray(planFeats) && planFeats.length > 0) {
    planFeats.forEach((pf: any) => {
      if (pf.code) {
        form.value.features[pf.code] = Boolean(pf.is_included)
      }
    })
  } else {
    // Ensure all available features have an entry
    availableFeatures.value.forEach((f) => {
      if (f.code && form.value.features[f.code] === undefined) {
        form.value.features[f.code] = false
      }
    })
  }

  const existingList = form.value.features.custom_list || []
  customFeaturesText.value = Array.isArray(existingList) ? existingList.join('\n') : ''
  showModal.value = true
}

const savePlan = async () => {
  isSubmitting.value = true
  try {
    const customList = customFeaturesText.value
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    if (typeof form.value.features === 'object' && form.value.features !== null) {
      form.value.features.custom_list = customList
    }

    if (isEditing.value && selectedId.value) {
      await subscriptionAdminService.updatePlan(selectedId.value, form.value)
      toast.success('Subscription plan updated successfully')
    } else {
      await subscriptionAdminService.createPlan(form.value)
      toast.success('Subscription plan created successfully')
    }
    showModal.value = false
    await fetchPlans()
  } catch (error: any) {
    toast.error(error.message || 'Failed to save plan')
  } finally {
    isSubmitting.value = false
  }
}

const toggleActive = async (plan: Plan) => {
  if (!plan.id) return
  try {
    await subscriptionAdminService.togglePlanActive(plan.id)
    plan.is_active = !plan.is_active
    toast.success(`Plan status updated to ${plan.is_active ? 'Active' : 'Inactive'}`)
  } catch (error: any) {
    toast.error(error.message || 'Failed to toggle status')
  }
}

const deletePlan = (plan: Plan) => {
  if (!plan.id) return
  planToDelete.value = plan
  showDeleteModal.value = true
}

const confirmDeletePlan = async () => {
  if (!planToDelete.value?.id) return
  try {
    await subscriptionAdminService.deletePlan(planToDelete.value.id)
    toast.success(`Plan "${planToDelete.value.name}" deleted successfully`)
    showDeleteModal.value = false
    planToDelete.value = null
    await fetchPlans()
  } catch (error: any) {
    toast.error(error.message || 'Failed to delete plan')
  }
}

onMounted(async () => {
  await Promise.all([fetchPlans(), fetchFeatures()])
})
</script>
