<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { toast } from 'vue-sonner'
  import { patchNoteService, type PatchNote } from '~/api/patchNote/PatchNoteService'

  definePageMeta({
    layout: 'dashboard-sidebar-layout',
    alias: ['/admin/patch-notes']
  })

  const patchNotes = ref<PatchNote[]>([])
  const isLoading = ref(true)
  const searchQuery = ref('')
  const statusFilter = ref<'all' | 'published' | 'draft'>('all')

  // Modal state
  const showModal = ref(false)
  const isEditing = ref(false)
  const isSaving = ref(false)
  const currentNoteId = ref<number | null>(null)

  const form = ref<{
    version: string
    title: string
    description: string
    changes: string[]
    is_published: boolean
  }>({
    version: '',
    title: '',
    description: '',
    changes: [''],
    is_published: true
  })

  // Delete confirmation modal state
  const showDeleteConfirm = ref(false)
  const itemToDelete = ref<PatchNote | null>(null)
  const isDeleting = ref(false)

  const fetchPatchNotes = async () => {
    isLoading.value = true
    try {
      const res = await patchNoteService.getAll()
      patchNotes.value = res.data || []
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to fetch patch notes.')
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    fetchPatchNotes()
  })

  // Computed stats
  const totalCount = computed(() => patchNotes.value.length)
  const publishedCount = computed(() => patchNotes.value.filter(n => n.is_published).length)
  const draftCount = computed(() => patchNotes.value.filter(n => !n.is_published).length)
  const latestVersion = computed(() => {
    const published = patchNotes.value.filter(n => n.is_published && n.version)
    return published.length > 0 ? published[0].version : 'N/A'
  })

  // Filtered notes
  const filteredNotes = computed(() => {
    return patchNotes.value.filter(note => {
      const matchesSearch =
        (note.title?.toLowerCase() || '').includes(searchQuery.value.toLowerCase()) ||
        (note.version?.toLowerCase() || '').includes(searchQuery.value.toLowerCase()) ||
        (note.description?.toLowerCase() || '').includes(searchQuery.value.toLowerCase())

      const matchesStatus =
        statusFilter.value === 'all' ||
        (statusFilter.value === 'published' && note.is_published) ||
        (statusFilter.value === 'draft' && !note.is_published)

      return matchesSearch && matchesStatus
    })
  })

  const openCreateModal = () => {
    isEditing.value = false
    currentNoteId.value = null
    form.value = {
      version: '',
      title: '',
      description: '',
      changes: [''],
      is_published: true
    }
    showModal.value = true
  }

  const openEditModal = (note: PatchNote) => {
    isEditing.value = true
    currentNoteId.value = note.id ?? null
    form.value = {
      version: note.version || '',
      title: note.title,
      description: note.description,
      changes: note.changes && note.changes.length > 0 ? [...note.changes] : [''],
      is_published: Boolean(note.is_published)
    }
    showModal.value = true
  }

  const addChangeField = () => {
    form.value.changes.push('')
  }

  const removeChangeField = (index: number) => {
    if (form.value.changes.length > 1) {
      form.value.changes.splice(index, 1)
    } else {
      form.value.changes[0] = ''
    }
  }

  const handleSave = async () => {
    if (!form.value.title.trim()) {
      toast.error('Title is required.')
      return
    }
    if (!form.value.description.trim()) {
      toast.error('Description is required.')
      return
    }

    isSaving.value = true
    try {
      const payload = {
        version: form.value.version.trim() || null,
        title: form.value.title.trim(),
        description: form.value.description.trim(),
        changes: form.value.changes.map(c => c.trim()).filter(Boolean),
        is_published: form.value.is_published
      }

      if (isEditing.value && currentNoteId.value) {
        await patchNoteService.update(currentNoteId.value, payload)
        toast.success('Patch note updated successfully.')
      } else {
        await patchNoteService.create(payload)
        toast.success(
          form.value.is_published
            ? 'Patch note published and broadcasted to user notification bells!'
            : 'Patch note draft created successfully.'
        )
      }

      showModal.value = false
      await fetchPatchNotes()
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to save patch note.')
    } finally {
      isSaving.value = false
    }
  }

  const togglePublish = async (note: PatchNote) => {
    if (!note.id) return
    try {
      const res = await patchNoteService.togglePublish(note.id)
      const isNowPublished = res.data?.is_published
      toast.success(
        isNowPublished
          ? `"${note.title}" published! All users can now see this update.`
          : `"${note.title}" moved to draft.`
      )
      await fetchPatchNotes()
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to update publish status.')
    }
  }

  const promptDelete = (note: PatchNote) => {
    itemToDelete.value = note
    showDeleteConfirm.value = true
  }

  const handleExecuteDelete = async () => {
    if (!itemToDelete.value?.id) return
    isDeleting.value = true
    try {
      await patchNoteService.delete(itemToDelete.value.id)
      toast.success('Patch note deleted successfully.')
      showDeleteConfirm.value = false
      itemToDelete.value = null
      await fetchPatchNotes()
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to delete patch note.')
    } finally {
      isDeleting.value = false
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="mt-1 text-2xl font-bold text-gray-950 sm:text-3xl">System Updates Manager</h1>
        <p class="mt-1 max-w-2xl text-sm text-gray-500">
          Publish system announcements, new features, and version changelogs to all doctors and
          patients.
        </p>
      </div>

      <div class="shrink-0">
        <AppButton
          variant="solid"
          size="md"
          class="bg-primary flex items-center gap-2 font-medium"
          @click="openCreateModal"
        >
          <Icon
            name="lucide:plus"
            class="text-base"
          />
          Publish New Update
        </AppButton>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div class="border-border/60 bg-card space-y-1 rounded-2xl border p-4 shadow-sm">
        <span class="text-muted-foreground block text-[11px] font-medium tracking-wider uppercase"
          >Total Updates</span
        >
        <div class="flex items-baseline justify-between">
          <span class="text-foreground text-2xl font-semibold">{{ totalCount }}</span>
          <Icon
            name="solar:document-text-bold-duotone"
            class="text-primary/70 text-xl"
          />
        </div>
      </div>

      <div
        class="space-y-1 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm"
      >
        <span
          class="block text-[11px] font-medium tracking-wider text-emerald-600 uppercase dark:text-emerald-400"
          >Published</span
        >
        <div class="flex items-baseline justify-between">
          <span class="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{{
            publishedCount
          }}</span>
          <Icon
            name="heroicons:check-circle-solid"
            class="text-xl text-emerald-500"
          />
        </div>
      </div>

      <div class="space-y-1 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
        <span
          class="block text-[11px] font-medium tracking-wider text-amber-600 uppercase dark:text-amber-400"
          >Drafts</span
        >
        <div class="flex items-baseline justify-between">
          <span class="text-2xl font-semibold text-amber-600 dark:text-amber-400">{{
            draftCount
          }}</span>
          <Icon
            name="solar:pen-new-square-bold"
            class="text-xl text-amber-500"
          />
        </div>
      </div>

      <div class="space-y-1 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 shadow-sm">
        <span
          class="block text-[11px] font-medium tracking-wider text-indigo-600 uppercase dark:text-indigo-400"
          >Current Version</span
        >
        <div class="flex items-baseline justify-between">
          <span class="text-xl font-semibold text-indigo-600 dark:text-indigo-400">{{
            latestVersion
          }}</span>
          <Icon
            name="solar:tag-bold"
            class="text-xl text-indigo-500"
          />
        </div>
      </div>
    </div>

    <!-- Filter & Search Controls -->
    <div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div class="relative w-full sm:w-80">
        <Icon
          name="lucide:search"
          class="text-muted-foreground absolute top-1/2 left-3.5 -translate-y-1/2 text-sm"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search system updates by title or version..."
          class="border-border/60 bg-card text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:ring-primary/10 w-full rounded-2xl border py-2.5 pr-4 pl-10 text-xs transition outline-none focus:ring-4"
        />
      </div>

      <div
        class="border-border/60 bg-card flex items-center gap-1.5 self-stretch rounded-2xl border p-1 sm:self-auto"
      >
        <button
          v-for="tab in [
            { label: 'All', value: 'all' },
            { label: 'Published', value: 'published' },
            { label: 'Drafts', value: 'draft' }
          ] as const"
          :key="tab.value"
          type="button"
          @click="statusFilter = tab.value"
          class="flex-1 cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-medium transition sm:flex-none"
          :class="
            statusFilter === tab.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          "
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Patch Notes Feed / List -->
    <section class="space-y-4">
      <div
        v-if="isLoading"
        class="border-border/60 bg-card text-muted-foreground rounded-3xl border p-12 text-center"
      >
        <Icon
          name="svg-spinners:ring-resize"
          class="text-primary mx-auto mb-3 h-7 w-7 animate-spin"
        />
        <p class="text-sm font-semibold">Loading system updates...</p>
      </div>

      <div
        v-else-if="filteredNotes.length === 0"
        class="border-border/60 bg-card space-y-3 rounded-3xl border p-12 text-center"
      >
        <div
          class="bg-muted/40 text-muted-foreground mx-auto flex h-14 w-14 items-center justify-center rounded-3xl"
        >
          <Icon
            name="solar:notes-bold-duotone"
            class="text-3xl"
          />
        </div>
        <h3 class="text-foreground text-base font-semibold">No System Updates Found</h3>
        <p class="text-muted-foreground mx-auto max-w-sm text-xs">
          {{
            searchQuery
              ? 'No system updates match your current search criteria.'
              : 'Create your first system update to announce new features and improvements.'
          }}
        </p>
        <AppButton
          v-if="!searchQuery"
          variant="solid"
          size="sm"
          class="font-medium"
          @click="openCreateModal"
        >
          <Icon
            name="lucide:plus"
            class="mr-1 text-sm"
          />
          Create Patch Note
        </AppButton>
      </div>

      <div
        v-for="note in filteredNotes"
        :key="note.id"
        class="border-border/60 bg-card hover:border-primary/30 space-y-4 rounded-3xl border p-6 shadow-sm transition"
      >
        <!-- Top Bar of Item -->
        <div
          class="border-border/40 flex flex-wrap items-start justify-between gap-3 border-b pb-4"
        >
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                v-if="note.version"
                class="bg-primary/10 text-primary border-primary/20 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium"
              >
                <Icon
                  name="solar:tag-bold"
                  class="text-xs"
                />
                {{ note.version }}
              </span>

              <button
                type="button"
                @click="togglePublish(note)"
                class="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition"
                :class="
                  note.is_published
                    ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                "
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="note.is_published ? 'bg-emerald-500' : 'bg-amber-500'"
                ></span>
                {{ note.is_published ? 'Published (Live)' : 'Draft (Hidden)' }}
              </button>

              <span
                v-if="note.published_at"
                class="text-muted-foreground text-xs"
              >
                Published {{ formatDate(note.published_at) }}
              </span>
            </div>

            <h2 class="text-foreground text-base font-semibold sm:text-lg">
              {{ note.title }}
            </h2>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="togglePublish(note)"
              class="border-border/60 bg-card text-foreground hover:bg-muted/40 cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-medium transition"
            >
              {{ note.is_published ? 'Unpublish' : 'Publish' }}
            </button>
            <button
              type="button"
              @click="openEditModal(note)"
              class="border-border/60 bg-card text-foreground hover:bg-muted/40 cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-medium transition"
            >
              Edit
            </button>
            <button
              type="button"
              @click="promptDelete(note)"
              class="border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-medium transition"
            >
              Delete
            </button>
          </div>
        </div>

        <!-- Description -->
        <p class="text-foreground/80 text-sm leading-relaxed font-normal whitespace-pre-line">
          {{ note.description }}
        </p>

        <!-- Changes / Bullets -->
        <div
          v-if="note.changes && note.changes.length > 0"
          class="border-border/60 bg-muted/20 space-y-2 rounded-2xl border p-4"
        >
          <span
            class="text-muted-foreground block text-[11px] font-medium tracking-wider uppercase"
          >
            Changes & Features Included
          </span>
          <ul class="text-foreground m-0 list-none space-y-1.5 p-0 text-xs">
            <li
              v-for="(change, idx) in note.changes"
              :key="idx"
              class="flex items-start gap-2"
            >
              <Icon
                name="heroicons:check-circle-solid"
                class="text-primary mt-0.5 shrink-0 text-sm"
              />
              <span class="leading-relaxed font-normal">{{ change }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Create / Edit Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        class="border-border/60 bg-card custom-scrollbar max-h-[90vh] w-full max-w-xl space-y-5 overflow-y-auto rounded-3xl border p-6 shadow-2xl"
      >
        <div class="border-border/40 flex items-center justify-between border-b pb-3">
          <div class="flex items-center gap-3">
            <div
              class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl"
            >
              <Icon
                :name="isEditing ? 'lucide:pencil' : 'solar:notes-bold-duotone'"
                class="text-xl"
              />
            </div>
            <div>
              <h3 class="text-foreground text-lg font-semibold">
                {{ isEditing ? 'Edit Patch Note' : 'Create & Broadcast Patch Note' }}
              </h3>
              <p class="text-muted-foreground text-xs">
                Broadcast new feature releases and updates to all users.
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="showModal = false"
            class="text-muted-foreground hover:bg-muted/40 hover:text-foreground cursor-pointer rounded-full p-2 transition"
          >
            <Icon
              name="lucide:x"
              class="text-lg"
            />
          </button>
        </div>

        <form
          @submit.prevent="handleSave"
          class="space-y-4"
        >
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                class="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wider uppercase"
                >Version Tag</label
              >
              <input
                v-model="form.version"
                type="text"
                placeholder="e.g. v1.4.0"
                class="border-border/60 bg-muted/20 text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:ring-primary/10 w-full rounded-2xl border px-3.5 py-2.5 font-mono text-xs font-medium transition outline-none focus:ring-4"
              />
            </div>

            <div class="sm:col-span-2">
              <label
                class="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wider uppercase"
                >Title / Headline *</label
              >
              <input
                v-model="form.title"
                type="text"
                placeholder="e.g. AI Retraining & UI Polish"
                required
                class="border-border/60 bg-muted/20 text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:ring-primary/10 w-full rounded-2xl border px-3.5 py-2.5 text-sm font-medium transition outline-none focus:ring-4"
              />
            </div>
          </div>

          <div>
            <label
              class="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wider uppercase"
              >Description *</label
            >
            <textarea
              v-model="form.description"
              rows="3"
              placeholder="Provide a comprehensive summary of the update, why it was made, and how doctors/patients can use it..."
              required
              class="border-border/60 bg-muted/20 text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:ring-primary/10 w-full rounded-2xl border px-3.5 py-2.5 text-xs leading-relaxed font-normal transition outline-none focus:ring-4"
            ></textarea>
          </div>

          <!-- Feature / Changes bullet list -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label
                class="text-muted-foreground block text-xs font-medium tracking-wider uppercase"
                >Key Feature Bullets & Fixes</label
              >
              <button
                type="button"
                @click="addChangeField"
                class="text-primary flex cursor-pointer items-center gap-1 text-xs font-medium hover:underline"
              >
                <Icon
                  name="lucide:plus"
                  class="text-xs"
                />
                Add Item
              </button>
            </div>

            <div class="space-y-2">
              <div
                v-for="(change, idx) in form.changes"
                :key="idx"
                class="flex items-center gap-2"
              >
                <input
                  v-model="form.changes[idx]"
                  type="text"
                  placeholder="e.g. Added option to contribute diagnosis scan to AI retraining dataset"
                  class="border-border/60 bg-muted/20 text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:ring-primary/10 flex-1 rounded-2xl border px-3.5 py-2 text-xs font-normal transition outline-none focus:ring-4"
                />
                <button
                  type="button"
                  @click="removeChangeField(idx)"
                  class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer rounded-xl p-2 transition"
                >
                  <Icon
                    name="lucide:trash-2"
                    class="text-sm"
                  />
                </button>
              </div>
            </div>
          </div>

          <!-- Publish Checkbox -->
          <div
            class="border-primary/20 bg-primary/5 flex items-center gap-3 rounded-2xl border p-4"
          >
            <input
              id="publish-patch-checkbox"
              v-model="form.is_published"
              type="checkbox"
              class="text-primary focus:ring-primary/20 h-4 w-4 cursor-pointer rounded"
            />
            <label
              for="publish-patch-checkbox"
              class="text-foreground cursor-pointer text-xs font-normal select-none"
            >
              Publish immediately and alert all users in their notification bell
            </label>
          </div>

          <!-- Actions -->
          <div class="border-border/40 flex items-center justify-end gap-3 border-t pt-4">
            <AppButton
              variant="ghost"
              type="button"
              class="font-medium"
              @click="showModal = false"
              :disabled="isSaving"
            >
              Cancel
            </AppButton>
            <AppButton
              variant="solid"
              type="submit"
              class="font-medium"
              :loading="isSaving"
            >
              {{
                isEditing ? 'Save Changes' : form.is_published ? 'Publish Update' : 'Save as Draft'
              }}
            </AppButton>
          </div>
        </form>
      </div>
    </div>

    <!-- Confirmation Modal for Deletion -->
    <AppModalConfirmation
      v-model="showDeleteConfirm"
      title="Delete Patch Note?"
      :description="`Are you sure you want to delete '${itemToDelete?.title}'? This action cannot be undone.`"
      icon="lucide:trash-2"
      icon-color="danger"
      confirm-text="Delete Note"
      cancel-text="Keep"
      confirm-variant="destructive"
      :loading="isDeleting"
      @confirm="handleExecuteDelete"
    />
  </div>
</template>
