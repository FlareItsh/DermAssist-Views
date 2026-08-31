<template>
  <div class="space-y-6">
    <AdminSideComponentsSubscriptionNavHeader
      title="System Features Manager"
      description="Configure normalized plan feature flags, rename display labels, and manage system access privileges."
      icon="lucide:sparkles"
      current-tab="features"
    >
      <template #actions>
        <button 
          @click="openCreateModal"
          class="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-dark cursor-pointer"
        >
          <Icon name="lucide:plus" class="text-sm" />
          Create Feature
        </button>
      </template>
    </AdminSideComponentsSubscriptionNavHeader>

    <!-- Features Table -->
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <tr>
              <th class="px-5 py-3.5">Feature Name</th>
              <th class="px-5 py-3.5">System Code (Key)</th>
              <th class="px-5 py-3.5">Description</th>
              <th class="px-5 py-3.5">Sort Order</th>
              <th class="px-5 py-3.5">Status</th>
              <th class="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="isLoading">
              <td colspan="6" class="px-5 py-10 text-center text-gray-500">
                <div class="flex items-center justify-center gap-2">
                  <Icon name="svg-spinners:ring-resize" class="h-5 w-5 text-primary animate-spin" />
                  <span class="text-xs font-medium">Loading system features...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="features.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-gray-500">
                <Icon name="lucide:sparkles" class="mx-auto mb-2 text-3xl text-gray-300" />
                <p class="text-sm font-semibold text-gray-700">No features created yet.</p>
              </td>
            </tr>
            <tr v-for="feature in features" :key="feature.id" class="transition hover:bg-gray-50/60">
              <td class="px-5 py-4 font-bold text-gray-950">
                {{ feature.name }}
              </td>
              <td class="px-5 py-4 font-mono text-xs font-semibold text-primary">
                {{ feature.code }}
              </td>
              <td class="px-5 py-4 text-xs text-gray-500 max-w-xs truncate">
                {{ feature.description || 'No description provided.' }}
              </td>
              <td class="px-5 py-4 font-mono text-xs text-gray-700">
                {{ feature.sort_order ?? 0 }}
              </td>
              <td class="px-5 py-4">
                <button
                  @click="toggleActive(feature)"
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition cursor-pointer"
                  :class="feature.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-gray-100 text-gray-500 border border-gray-200'"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="feature.is_active ? 'bg-emerald-500' : 'bg-gray-400'"></span>
                  {{ feature.is_active ? 'Active' : 'Inactive' }}
                </button>
              </td>
              <td class="px-5 py-4 text-right space-x-2">
                <button 
                  @click="openEditModal(feature)"
                  class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50 cursor-pointer"
                >
                  Edit
                </button>
                <button 
                  @click="promptDeleteFeature(feature)"
                  class="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 cursor-pointer"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Create / Edit Feature Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div class="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon :name="isEditing ? 'lucide:pencil' : 'lucide:sparkles'" class="text-base" />
            </div>
            <h3 class="text-lg font-black text-gray-950">{{ isEditing ? 'Edit System Feature' : 'Create System Feature' }}</h3>
          </div>
          <button @click="showModal = false" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <Icon name="lucide:x" class="text-lg" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Feature Display Name</label>
            <input 
              v-model="form.name" 
              type="text" 
              placeholder="e.g. Doctor AI Skin Scanner Execution" 
              required 
              class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" 
            />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">System Code Key (Slug)</label>
            <input 
              v-model="form.code" 
              type="text" 
              placeholder="e.g. can_execute_scan" 
              class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs font-mono text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" 
            />
            <p class="text-[11px] text-gray-400 mt-1">Unique code key used for programmatic backend & UI authorization.</p>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Description</label>
            <textarea 
              v-model="form.description" 
              rows="3" 
              placeholder="Describe what access or privileges this feature enables for subscribed doctors..." 
              class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition"
            ></textarea>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Sort Order</label>
            <input 
              v-model.number="form.sort_order" 
              type="number" 
              min="0" 
              class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition" 
            />
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" @click="showModal = false" class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50">Cancel</button>
            <button type="submit" :disabled="isSubmitting" class="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-50">
              {{ isSubmitting ? 'Saving...' : (isEditing ? 'Update Feature' : 'Create Feature') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Confirm Delete Modal -->
    <AdminSideComponentsConfirmModal
      :show="showDeleteModal"
      title="Delete System Feature"
      :message="`Are you sure you want to delete '${featureToDelete?.name}'? This will remove this feature from all subscription plans.`"
      confirm-text="Delete Feature"
      variant="danger"
      @confirm="confirmDeleteFeature"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import { subscriptionAdminService, type Feature } from '~/api/subscription/SubscriptionAdminService'

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const isLoading = ref(true)
const isSubmitting = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const selectedId = ref<number | null>(null)
const features = ref<Feature[]>([])

const showDeleteModal = ref(false)
const featureToDelete = ref<Feature | null>(null)

const form = ref<Partial<Feature>>({
  name: '',
  code: '',
  description: '',
  sort_order: 0,
  is_active: true
})

const fetchFeatures = async () => {
  isLoading.value = true
  try {
    const res = await subscriptionAdminService.getFeatures()
    features.value = res?.data || []
  } catch (e: any) {
    toast.error('Failed to load system features.')
  } finally {
    isLoading.value = false
  }
}

const openCreateModal = () => {
  isEditing.value = false
  selectedId.value = null
  form.value = {
    name: '',
    code: '',
    description: '',
    sort_order: features.value.length + 1,
    is_active: true
  }
  showModal.value = true
}

const openEditModal = (feature: Feature) => {
  isEditing.value = true
  selectedId.value = feature.id || null
  form.value = {
    name: feature.name,
    code: feature.code,
    description: feature.description,
    sort_order: feature.sort_order,
    is_active: feature.is_active
  }
  showModal.value = true
}

const handleSubmit = async () => {
  if (!form.value.name) return
  isSubmitting.value = true
  try {
    if (isEditing.value && selectedId.value) {
      await subscriptionAdminService.updateFeature(selectedId.value, form.value)
      toast.success('Feature updated successfully.')
    } else {
      await subscriptionAdminService.createFeature(form.value)
      toast.success('Feature created successfully.')
    }
    showModal.value = false
    await fetchFeatures()
  } catch (e: any) {
    toast.error(e?.message || 'Failed to save feature.')
  } finally {
    isSubmitting.value = false
  }
}

const toggleActive = async (feature: Feature) => {
  if (!feature.id) return
  try {
    await subscriptionAdminService.toggleFeatureActive(feature.id)
    feature.is_active = !feature.is_active
    toast.success(`Feature ${feature.is_active ? 'activated' : 'disabled'}.`)
  } catch (e: any) {
    toast.error('Failed to update feature status.')
  }
}

const promptDeleteFeature = (feature: Feature) => {
  featureToDelete.value = feature
  showDeleteModal.value = true
}

const confirmDeleteFeature = async () => {
  if (!featureToDelete.value?.id) return
  try {
    await subscriptionAdminService.deleteFeature(featureToDelete.value.id)
    toast.success('Feature deleted successfully.')
    showDeleteModal.value = false
    featureToDelete.value = null
    await fetchFeatures()
  } catch (e: any) {
    toast.error('Failed to delete feature.')
  }
}

onMounted(() => {
  fetchFeatures()
})
</script>
