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

          <!-- Feature Flags Checkboxes -->
          <div class="space-y-2 border-t border-gray-100 pt-3">
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500">Feature Access Flags</label>
            <div class="space-y-2 text-xs">
              <label class="flex items-center gap-2.5 cursor-pointer font-bold text-gray-700">
                <input v-model="form.features.show_in_recommendation" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary/20 h-4 w-4" />
                <span>Show in Patient Scan Recommendations</span>
              </label>
              <label class="flex items-center gap-2.5 cursor-pointer font-bold text-gray-700">
                <input v-model="form.features.can_execute_scan" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary/20 h-4 w-4" />
                <span>Allow Doctor AI Scan Execution</span>
              </label>
              <label class="flex items-center gap-2.5 cursor-pointer font-bold text-gray-700">
                <input v-model="form.features.export_pdf_reports" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary/20 h-4 w-4" />
                <span>Allow PDF Clinical Report Exports</span>
              </label>
              <label class="flex items-center gap-2.5 cursor-pointer font-bold text-gray-700">
                <input v-model="form.features.unlimited_appointments" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary/20 h-4 w-4" />
                <span>Enable Teleconsultation Appointments</span>
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
  </div>
</template>

<script setup lang="ts">
import { subscriptionAdminService, type Plan } from '~/api/subscription/SubscriptionAdminService'

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const isLoading = ref(true)
const isSubmitting = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const selectedId = ref<number | null>(null)
const plans = ref<Plan[]>([])

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
  features: {
    show_in_recommendation: true,
    can_execute_scan: true,
    export_pdf_reports: true,
    unlimited_appointments: true
  }
})

const fetchPlans = async () => {
  isLoading.value = true
  try {
    const res = await subscriptionAdminService.getPlans()
    plans.value = res?.data || []
  } catch (error) {
    console.error('Failed to load plans:', error)
  } finally {
    isLoading.value = false
  }
}

const openCreateModal = () => {
  isEditing.value = false
  selectedId.value = null
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
    features: {
      show_in_recommendation: true,
      can_execute_scan: true,
      export_pdf_reports: true,
      unlimited_appointments: true
    }
  }
  showModal.value = true
}

const editPlan = (plan: Plan) => {
  isEditing.value = true
  selectedId.value = plan.id ?? null
  form.value = JSON.parse(JSON.stringify(plan))
  if (!form.value.features) {
    form.value.features = {
      show_in_recommendation: true,
      can_execute_scan: true,
      export_pdf_reports: true,
      unlimited_appointments: true
    }
  }
  showModal.value = true
}

const savePlan = async () => {
  isSubmitting.value = true
  try {
    if (isEditing.value && selectedId.value) {
      await subscriptionAdminService.updatePlan(selectedId.value, form.value)
    } else {
      await subscriptionAdminService.createPlan(form.value)
    }
    showModal.value = false
    await fetchPlans()
  } catch (error: any) {
    alert(error.message || 'Failed to save plan')
  } finally {
    isSubmitting.value = false
  }
}

const toggleActive = async (plan: Plan) => {
  if (!plan.id) return
  try {
    await subscriptionAdminService.togglePlanActive(plan.id)
    plan.is_active = !plan.is_active
  } catch (error: any) {
    alert(error.message || 'Failed to toggle status')
  }
}

const deletePlan = async (plan: Plan) => {
  if (!plan.id || !confirm(`Are you sure you want to delete "${plan.name}"?`)) return
  try {
    await subscriptionAdminService.deletePlan(plan.id)
    await fetchPlans()
  } catch (error: any) {
    alert(error.message || 'Failed to delete plan')
  }
}

onMounted(() => {
  fetchPlans()
})
</script>
