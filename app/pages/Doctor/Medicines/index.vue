<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue'
  import { toast } from 'vue-sonner'
  import {
    medicineService,
    type Medicine,
    type MedicineVariant
  } from '~/api/medicine/MedicineService'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const { data: response, pending, refresh } = medicineService.useList()

  const medicines = computed<Medicine[]>(() => {
    const res = response.value as any
    if (Array.isArray(res?.data)) return res.data
    if (Array.isArray(res)) return res
    return []
  })

  // Search filter
  const searchQuery = ref('')
  const filteredMedicines = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return medicines.value

    return medicines.value.filter(med => {
      const matchName = med.name.toLowerCase().includes(q)
      const matchDesc = med.description?.toLowerCase().includes(q)
      const matchVariant = med.variants?.some(
        v =>
          v.dosage.toLowerCase().includes(q) ||
          v.unit.toLowerCase().includes(q) ||
          v.default_frequency.toLowerCase().includes(q)
      )
      return matchName || matchDesc || matchVariant
    })
  })

  // Statistics
  const totalCount = computed(() => medicines.value.length)
  const totalVariantsCount = computed(() =>
    medicines.value.reduce((acc, med) => acc + (med.variants?.length || 0), 0)
  )

  // Pagination
  const medicinesPerPage = 9
  const currentPage = ref(1)

  const paginatedMedicines = computed(() => {
    const start = (currentPage.value - 1) * medicinesPerPage
    return filteredMedicines.value.slice(start, start + medicinesPerPage)
  })

  watch(searchQuery, () => {
    currentPage.value = 1
  })

  watch(filteredMedicines, () => {
    const totalPages = Math.max(1, Math.ceil(filteredMedicines.value.length / medicinesPerPage))
    if (currentPage.value > totalPages) {
      currentPage.value = totalPages
    }
  })

  // Form & Modal State
  const showModal = ref(false)
  const isEditing = ref(false)
  const editingUuid = ref<string | null>(null)
  const isSaving = ref(false)

  interface VariantRow {
    uuid?: string
    dosage: string
    unit: string
    default_frequency: string
  }

  const form = reactive<{
    name: string
    description: string
    variants: VariantRow[]
  }>({
    name: '',
    description: '',
    variants: []
  })

  const commonUnits = ['mg', 'g', '%', 'ml', 'mcg', 'drops', 'IU', 'puff']
  const frequencySuggestions = [
    'Once daily (OD)',
    'Twice daily (BID)',
    'Three times daily (TID)',
    'Four times daily (QID)',
    'Every 6 hours',
    'Every 8 hours',
    'Every 12 hours',
    'Apply BID',
    'Apply once daily at bedtime',
    'As needed (PRN)'
  ]

  const openCreateModal = () => {
    isEditing.value = false
    editingUuid.value = null
    form.name = ''
    form.description = ''
    form.variants = [
      {
        dosage: '',
        unit: 'mg',
        default_frequency: 'Once daily (OD)'
      }
    ]
    showModal.value = true
  }

  const openEditModal = (med: Medicine) => {
    isEditing.value = true
    editingUuid.value = med.uuid
    form.name = med.name
    form.description = med.description || ''
    form.variants = (med.variants || []).map(v => ({
      uuid: v.uuid,
      dosage: v.dosage,
      unit: v.unit,
      default_frequency: v.default_frequency
    }))

    if (form.variants.length === 0) {
      form.variants.push({
        dosage: '',
        unit: 'mg',
        default_frequency: 'Once daily (OD)'
      })
    }

    showModal.value = true
  }

  const closeModal = () => {
    showModal.value = false
  }

  const addVariantRow = () => {
    form.variants.push({
      dosage: '',
      unit: 'mg',
      default_frequency: 'Once daily (OD)'
    })
  }

  const removeVariantRow = (index: number) => {
    if (form.variants.length > 1) {
      form.variants.splice(index, 1)
    } else {
      toast.warning('A medicine must have at least one dosage variant.')
    }
  }

  const applyFrequencySuggestion = (index: number, freq: string) => {
    if (form.variants[index]) {
      form.variants[index].default_frequency = freq
    }
  }

  const handleSaveMedicine = async () => {
    const trimmedName = form.name.trim()
    if (!trimmedName) {
      toast.error('Medicine name is required.')
      return
    }

    if (form.variants.length === 0) {
      toast.error('Please add at least one dosage variant.')
      return
    }

    for (let i = 0; i < form.variants.length; i++) {
      const v = form.variants[i]
      if (!v.dosage.trim()) {
        toast.error(`Variant #${i + 1} is missing a dosage/strength value.`)
        return
      }
      if (!v.unit.trim()) {
        toast.error(`Variant #${i + 1} is missing a unit.`)
        return
      }
      if (!v.default_frequency.trim()) {
        toast.error(`Variant #${i + 1} is missing a default frequency.`)
        return
      }
    }

    isSaving.value = true
    try {
      const payload = {
        name: trimmedName,
        description: form.description.trim() || null,
        variants: form.variants.map(v => ({
          uuid: v.uuid || undefined,
          dosage: v.dosage.trim(),
          unit: v.unit.trim(),
          default_frequency: v.default_frequency.trim()
        }))
      }

      if (isEditing.value && editingUuid.value) {
        await medicineService.update(editingUuid.value, payload)
        toast.success(`"${trimmedName}" updated successfully.`)
      } else {
        await medicineService.create(payload)
        toast.success(`"${trimmedName}" added to library.`)
      }

      showModal.value = false
      await refresh()
    } catch (err: any) {
      console.error('Failed to save medicine:', err)
      toast.error(err?.message || 'Failed to save medicine.')
    } finally {
      isSaving.value = false
    }
  }

  // Delete State & Confirmation
  const showDeleteModal = ref(false)
  const deletingMedicine = ref<Medicine | null>(null)
  const isDeleting = ref(false)

  const promptDelete = (med: Medicine) => {
    deletingMedicine.value = med
    showDeleteModal.value = true
  }

  const handleConfirmDelete = async () => {
    if (!deletingMedicine.value) return

    isDeleting.value = true
    try {
      await medicineService.delete(deletingMedicine.value.uuid)
      toast.success(`"${deletingMedicine.value.name}" deleted from library.`)
      showDeleteModal.value = false
      deletingMedicine.value = null
      await refresh()
    } catch (err: any) {
      console.error('Failed to delete medicine:', err)
      toast.error(err?.message || 'Failed to delete medicine.')
    } finally {
      isDeleting.value = false
    }
  }
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 pb-12">
    <!-- Page Header -->
    <div
      class="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:p-8"
    >
      <div class="flex items-start gap-4">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 shadow-2xs"
        >
          <Icon
            name="lucide:pill"
            class="text-2xl"
          />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
            Medicine Library
          </h1>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-3">
        <button
          type="button"
          @click="openCreateModal"
          class="bg-primary hover:bg-primary/90 focus:ring-primary/20 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all focus:ring-2 focus:outline-none active:scale-98 sm:text-sm"
        >
          <Icon
            name="lucide:plus"
            class="text-base"
          />
          <span>Add Medicine</span>
        </button>
      </div>
    </div>

    <!-- Stats & Search Bar -->
    <div class="grid gap-4 sm:grid-cols-2">
      <!-- Total Counter -->
      <div
        class="flex items-center gap-3.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xs"
      >
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon
            name="lucide:tablets"
            class="text-lg"
          />
        </div>
        <div>
          <div class="text-[11px] font-bold tracking-wider text-gray-400 uppercase">Medicines</div>
          <div class="text-lg font-extrabold text-gray-900">{{ totalCount }}</div>
        </div>
      </div>

      <!-- Variants Counter -->
      <div
        class="flex items-center gap-3.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xs"
      >
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"
        >
          <Icon
            name="lucide:layers"
            class="text-lg"
          />
        </div>
        <div>
          <div class="text-[11px] font-bold tracking-wider text-gray-400 uppercase">
            Dosage Variants
          </div>
          <div class="text-lg font-extrabold text-gray-900">{{ totalVariantsCount }}</div>
        </div>
      </div>
    </div>

    <!-- Search Input -->
    <div class="relative">
      <div
        class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400"
      >
        <Icon
          name="lucide:search"
          class="text-base"
        />
      </div>
      <input
        type="text"
        v-model="searchQuery"
        placeholder="Search medicines..."
        class="focus:ring-primary w-full rounded-2xl border-0 bg-white py-3.5 pr-4 pl-11 text-xs text-gray-900 shadow-2xs ring-1 ring-gray-200/80 transition-all placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:outline-none sm:text-sm"
      />
    </div>

    <!-- Loading State -->
    <div
      v-if="pending"
      class="flex flex-col items-center justify-center py-20"
    >
      <Icon
        name="svg-spinners:180-ring-with-bg"
        class="text-primary text-4xl opacity-60"
      />
      <span class="mt-3 text-xs font-semibold text-gray-500">Loading medicines...</span>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredMedicines.length === 0"
      class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white px-4 py-16 text-center shadow-2xs"
    >
      <div
        class="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"
      >
        <Icon
          name="lucide:pill"
          class="text-3xl"
        />
      </div>
      <h3 class="mt-4 text-base font-bold text-gray-900">
        {{ searchQuery ? 'No matching medicines found' : 'No medicines added yet' }}
      </h3>
      <p class="mt-1 max-w-sm text-xs text-gray-500">
        {{
          searchQuery
            ? 'Try searching with different keywords.'
            : 'Add medicines and dosage variants to start prescribing.'
        }}
      </p>
      <button
        v-if="!searchQuery"
        type="button"
        @click="openCreateModal"
        class="bg-primary hover:bg-primary/90 mt-5 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold text-white shadow-xs transition-all"
      >
        <Icon
          name="lucide:plus"
          class="text-base"
        />
        <span>Add Medicine</span>
      </button>
    </div>

    <!-- Medicines Grid & Pagination -->
    <div
      v-else
      class="space-y-4"
    >
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="med in paginatedMedicines"
          :key="med.uuid"
          class="group flex flex-col justify-between rounded-3xl border border-gray-100 bg-white p-5 shadow-2xs transition-all hover:border-gray-200 hover:shadow-md"
        >
          <div>
            <!-- Card Header -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100"
                >
                  <Icon
                    name="lucide:pill"
                    class="text-lg"
                  />
                </div>
                <div>
                  <h3 class="text-sm font-bold text-gray-900 sm:text-base">
                    {{ med.name }}
                  </h3>
                  <span
                    class="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700"
                  >
                    <Icon
                      name="lucide:layers"
                      class="text-[11px]"
                    />
                    {{ med.variants?.length || 0 }} variant{{
                      (med.variants?.length || 0) === 1 ? '' : 's'
                    }}
                  </span>
                </div>
              </div>

              <!-- Card Actions -->
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  @click="openEditModal(med)"
                  class="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  title="Edit medicine"
                >
                  <Icon
                    name="lucide:pencil"
                    class="text-sm"
                  />
                </button>
                <button
                  type="button"
                  @click="promptDelete(med)"
                  class="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="Delete medicine"
                >
                  <Icon
                    name="lucide:trash-2"
                    class="text-sm"
                  />
                </button>
              </div>
            </div>

            <!-- Description -->
            <p
              v-if="med.description"
              class="mt-3 line-clamp-2 text-xs leading-relaxed text-gray-500"
            >
              {{ med.description }}
            </p>

            <!-- Variants List -->
            <div class="mt-4 space-y-2 border-t border-gray-100 pt-3.5">
              <div
                class="flex items-center justify-between text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >
                <span>Dosage Variants</span>
                <span>{{ med.variants?.length || 0 }} total</span>
              </div>

              <div class="flex flex-wrap gap-1.5">
                <div
                  v-for="v in med.variants"
                  :key="v.uuid"
                  class="flex items-center gap-1.5 rounded-xl border border-gray-200/60 bg-gray-50/70 px-2.5 py-1 text-xs transition-colors hover:bg-gray-100"
                >
                  <span class="font-bold text-gray-900"> {{ v.dosage }} {{ v.unit }} </span>
                  <span class="text-gray-300">•</span>
                  <span class="max-w-[140px] truncate text-[11px] font-medium text-gray-600">
                    {{ v.default_frequency }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 flex justify-end border-t border-gray-50 pt-2 text-[11px] text-gray-400">
            <span class="font-mono text-[10px]">#{{ med.uuid.slice(0, 8) }}</span>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
        <AppPagination
          v-model:currentPage="currentPage"
          :total-items="filteredMedicines.length"
          :per-page="medicinesPerPage"
          item-label="medicines"
        />
      </div>
    </div>

    <!-- Create / Edit Medicine Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        @click.self="closeModal"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs"
      >
        <div
          class="relative my-8 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-gray-100 bg-white p-5 shadow-2xl duration-200 sm:p-7"
        >
          <!-- Modal Header -->
          <div class="flex items-center justify-between border-b border-gray-100 pb-4">
            <div class="flex items-center gap-3">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"
              >
                <Icon
                  name="lucide:pill"
                  class="text-xl"
                />
              </div>
              <div>
                <h2 class="text-base font-bold text-gray-900 sm:text-lg">
                  {{ isEditing ? 'Edit Medicine' : 'Add Medicine' }}
                </h2>
              </div>
            </div>
            <button
              type="button"
              @click="closeModal"
              class="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <Icon
                name="lucide:x"
                class="text-lg"
              />
            </button>
          </div>

          <!-- Modal Body (Scrollable) -->
          <div class="flex-1 space-y-5 overflow-y-auto py-5 pr-1">
            <!-- Medicine Name -->
            <div class="space-y-1.5">
              <label class="text-[11px] font-bold tracking-wider text-gray-600 uppercase">
                Medicine Name <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                v-model="form.name"
                placeholder="e.g. Hydrocortisone, Ibuprofen"
                class="focus:ring-primary w-full rounded-2xl border-0 bg-gray-50/70 p-3 text-xs text-gray-900 ring-1 ring-gray-200/70 transition-all placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:outline-none sm:text-sm"
              />
            </div>

            <!-- Description / Notes -->
            <div class="space-y-1.5">
              <label class="text-[11px] font-bold tracking-wider text-gray-600 uppercase">
                Description (optional)
              </label>
              <textarea
                v-model="form.description"
                rows="2"
                placeholder="Optional notes or directions..."
                class="focus:ring-primary w-full resize-none rounded-2xl border-0 bg-gray-50/70 p-3 text-xs text-gray-900 ring-1 ring-gray-200/70 transition-all placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:outline-none sm:text-sm"
              ></textarea>
            </div>

            <!-- Nested Dosage Variants Repeater -->
            <div class="space-y-3 border-t border-gray-100 pt-2">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold tracking-wider text-gray-700 uppercase">
                    Dosage Variants <span class="text-red-500">*</span>
                  </h3>
                </div>
                <button
                  type="button"
                  @click="addVariantRow"
                  class="border-primary/20 bg-primary/10 text-primary hover:bg-primary inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all hover:text-white"
                >
                  <Icon
                    name="lucide:plus"
                    class="text-sm"
                  />
                  <span>Add Variant</span>
                </button>
              </div>

              <!-- Repeater Rows -->
              <div class="space-y-3">
                <div
                  v-for="(row, idx) in form.variants"
                  :key="idx"
                  class="relative space-y-3 rounded-2xl border border-gray-200/70 bg-gray-50/40 p-3.5 transition-all hover:border-gray-300 sm:space-y-2.5"
                >
                  <div class="flex items-center justify-between border-b border-gray-200/40 pb-1">
                    <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                      Variant #{{ idx + 1 }}
                    </span>
                    <button
                      v-if="form.variants.length > 1"
                      type="button"
                      @click="removeVariantRow(idx)"
                      class="flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-700"
                    >
                      <Icon
                        name="lucide:trash-2"
                        class="text-xs"
                      />
                      <span>Remove</span>
                    </button>
                  </div>

                  <div class="grid gap-2.5 sm:grid-cols-12 sm:items-center">
                    <!-- Dosage -->
                    <div class="sm:col-span-3">
                      <label class="block text-[10px] font-bold text-gray-500 uppercase"
                        >Strength</label
                      >
                      <input
                        type="text"
                        v-model="row.dosage"
                        placeholder="e.g. 500, 0.05"
                        class="focus:ring-primary mt-1 w-full rounded-xl border-0 bg-white p-2.5 text-xs text-gray-900 ring-1 ring-gray-200 transition-all placeholder:text-gray-400 focus:ring-2 focus:outline-none"
                      />
                    </div>

                    <!-- Unit -->
                    <div class="sm:col-span-3">
                      <label class="block text-[10px] font-bold text-gray-500 uppercase"
                        >Unit</label
                      >
                      <div class="mt-1 flex gap-1">
                        <input
                          type="text"
                          v-model="row.unit"
                          placeholder="e.g. mg, %, ml"
                          list="unit-datalist"
                          class="focus:ring-primary w-full rounded-xl border-0 bg-white p-2.5 text-xs text-gray-900 ring-1 ring-gray-200 transition-all placeholder:text-gray-400 focus:ring-2 focus:outline-none"
                        />
                      </div>
                    </div>

                    <!-- Default Frequency -->
                    <div class="sm:col-span-6">
                      <label class="block text-[10px] font-bold text-gray-500 uppercase"
                        >Default Frequency</label
                      >
                      <input
                        type="text"
                        v-model="row.default_frequency"
                        placeholder="e.g. BID, Every 6h"
                        class="focus:ring-primary mt-1 w-full rounded-xl border-0 bg-white p-2.5 text-xs text-gray-900 ring-1 ring-gray-200 transition-all placeholder:text-gray-400 focus:ring-2 focus:outline-none"
                      />
                    </div>
                  </div>

                  <!-- Quick frequency chips for convenience -->
                  <div class="flex flex-wrap items-center gap-1 pt-1">
                    <button
                      v-for="sug in frequencySuggestions.slice(0, 5)"
                      :key="sug"
                      type="button"
                      @click="applyFrequencySuggestion(idx, sug)"
                      class="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    >
                      {{ sug }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Datalist for Unit Autocomplete -->
              <datalist id="unit-datalist">
                <option
                  v-for="u in commonUnits"
                  :key="u"
                  :value="u"
                />
              </datalist>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              @click="closeModal"
              class="rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleSaveMedicine"
              :disabled="isSaving"
              class="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50"
            >
              <Icon
                v-if="isSaving"
                name="svg-spinners:180-ring-with-bg"
                class="text-sm"
              />
              <span>{{ isEditing ? 'Update Medicine' : 'Save Medicine' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <AppModalConfirmation
      v-model="showDeleteModal"
      :title="`Delete ${deletingMedicine?.name || 'Medicine'}?`"
      description="This will permanently remove this medicine and all its dosage variants from your library. Existing saved consultation records will remain unaffected."
      icon="lucide:trash-2"
      icon-color="danger"
      confirm-text="Delete Medicine"
      cancel-text="Keep Medicine"
      confirm-variant="destructive"
      @confirm="handleConfirmDelete"
    />
  </div>
</template>
