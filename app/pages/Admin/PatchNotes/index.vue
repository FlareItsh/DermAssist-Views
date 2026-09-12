<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { patchNoteService, type PatchNote } from '~/api/patchNote/PatchNoteService'

definePageMeta({
  layout: 'dashboard-sidebar-layout'
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
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-gray-950">Patch Notes Manager</h1>
        <p class="mt-1 text-sm text-gray-500 max-w-2xl">
          Publish system announcements, new features, and version changelogs to all doctors and patients.
        </p>
      </div>

      <div class="shrink-0">
        <AppButton
          variant="solid"
          size="md"
          class="flex items-center gap-2 bg-primary font-medium"
          @click="openCreateModal"
        >
          <Icon name="lucide:plus" class="text-base" />
          Publish New Update
        </AppButton>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="rounded-2xl border border-border/60 bg-card p-4 space-y-1 shadow-sm">
        <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">Total Updates</span>
        <div class="flex items-baseline justify-between">
          <span class="text-2xl font-semibold text-foreground">{{ totalCount }}</span>
          <Icon name="solar:document-text-bold-duotone" class="text-xl text-primary/70" />
        </div>
      </div>

      <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1 shadow-sm">
        <span class="text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Published</span>
        <div class="flex items-baseline justify-between">
          <span class="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{{ publishedCount }}</span>
          <Icon name="heroicons:check-circle-solid" class="text-xl text-emerald-500" />
        </div>
      </div>

      <div class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1 shadow-sm">
        <span class="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400 block">Drafts</span>
        <div class="flex items-baseline justify-between">
          <span class="text-2xl font-semibold text-amber-600 dark:text-amber-400">{{ draftCount }}</span>
          <Icon name="solar:pen-new-square-bold" class="text-xl text-amber-500" />
        </div>
      </div>

      <div class="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-1 shadow-sm">
        <span class="text-[11px] font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">Current Version</span>
        <div class="flex items-baseline justify-between">
          <span class="text-xl font-semibold text-indigo-600 dark:text-indigo-400">{{ latestVersion }}</span>
          <Icon name="solar:tag-bold" class="text-xl text-indigo-500" />
        </div>
      </div>
    </div>

    <!-- Filter & Search Controls -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="relative w-full sm:w-80">
        <Icon name="lucide:search" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search patch notes by title or version..."
          class="w-full rounded-2xl border border-border/60 bg-card pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:ring-4 focus:ring-primary/10 outline-none transition"
        />
      </div>

      <div class="flex items-center gap-1.5 rounded-2xl border border-border/60 bg-card p-1 self-stretch sm:self-auto">
        <button
          v-for="tab in ([
            { label: 'All', value: 'all' },
            { label: 'Published', value: 'published' },
            { label: 'Drafts', value: 'draft' }
          ] as const)"
          :key="tab.value"
          type="button"
          @click="statusFilter = tab.value"
          class="flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer"
          :class="statusFilter === tab.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Patch Notes Feed / List -->
    <section class="space-y-4">
      <div v-if="isLoading" class="rounded-3xl border border-border/60 bg-card p-12 text-center text-muted-foreground">
        <Icon name="svg-spinners:ring-resize" class="mx-auto mb-3 h-7 w-7 text-primary animate-spin" />
        <p class="text-sm font-semibold">Loading patch notes...</p>
      </div>

      <div v-else-if="filteredNotes.length === 0" class="rounded-3xl border border-border/60 bg-card p-12 text-center space-y-3">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-muted/40 text-muted-foreground">
          <Icon name="solar:notes-bold-duotone" class="text-3xl" />
        </div>
        <h3 class="text-base font-semibold text-foreground">No Patch Notes Found</h3>
        <p class="text-xs text-muted-foreground max-w-sm mx-auto">
          {{ searchQuery ? 'No patch notes match your current search criteria.' : 'Create your first patch note to announce new features and system updates.' }}
        </p>
        <AppButton
          v-if="!searchQuery"
          variant="solid"
          size="sm"
          class="font-medium"
          @click="openCreateModal"
        >
          <Icon name="lucide:plus" class="mr-1 text-sm" />
          Create Patch Note
        </AppButton>
      </div>

      <div
        v-for="note in filteredNotes"
        :key="note.id"
        class="rounded-3xl border border-border/60 bg-card p-6 shadow-sm transition hover:border-primary/30 space-y-4"
      >
        <!-- Top Bar of Item -->
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 pb-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                v-if="note.version"
                class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-primary/10 text-primary border border-primary/20"
              >
                <Icon name="solar:tag-bold" class="text-xs" />
                {{ note.version }}
              </span>

              <button
                type="button"
                @click="togglePublish(note)"
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition cursor-pointer"
                :class="note.is_published ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'"
              >
                <span class="h-1.5 w-1.5 rounded-full" :class="note.is_published ? 'bg-emerald-500' : 'bg-amber-500'"></span>
                {{ note.is_published ? 'Published (Live)' : 'Draft (Hidden)' }}
              </button>

              <span v-if="note.published_at" class="text-xs text-muted-foreground">
                Published {{ formatDate(note.published_at) }}
              </span>
            </div>

            <h2 class="text-base sm:text-lg font-semibold text-foreground">
              {{ note.title }}
            </h2>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="togglePublish(note)"
              class="rounded-xl border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/40 cursor-pointer"
            >
              {{ note.is_published ? 'Unpublish' : 'Publish' }}
            </button>
            <button
              type="button"
              @click="openEditModal(note)"
              class="rounded-xl border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/40 cursor-pointer"
            >
              Edit
            </button>
            <button
              type="button"
              @click="promptDelete(note)"
              class="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>

        <!-- Description -->
        <p class="text-sm text-foreground/80 leading-relaxed whitespace-pre-line font-normal">
          {{ note.description }}
        </p>

        <!-- Changes / Bullets -->
        <div v-if="note.changes && note.changes.length > 0" class="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2">
          <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
            Changes & Features Included
          </span>
          <ul class="text-xs text-foreground space-y-1.5 list-none m-0 p-0">
            <li
              v-for="(change, idx) in note.changes"
              :key="idx"
              class="flex items-start gap-2"
            >
              <Icon name="heroicons:check-circle-solid" class="text-primary text-sm shrink-0 mt-0.5" />
              <span class="leading-relaxed font-normal">{{ change }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Create / Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div class="w-full max-w-xl rounded-3xl border border-border/60 bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div class="flex items-center justify-between border-b border-border/40 pb-3">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon :name="isEditing ? 'lucide:pencil' : 'solar:notes-bold-duotone'" class="text-xl" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-foreground">
                {{ isEditing ? 'Edit Patch Note' : 'Create & Broadcast Patch Note' }}
              </h3>
              <p class="text-xs text-muted-foreground">
                Broadcast new feature releases and updates to all users.
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="showModal = false"
            class="rounded-full p-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition cursor-pointer"
          >
            <Icon name="lucide:x" class="text-lg" />
          </button>
        </div>

        <form @submit.prevent="handleSave" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Version Tag</label>
              <input
                v-model="form.version"
                type="text"
                placeholder="e.g. v1.4.0"
                class="w-full rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:ring-4 focus:ring-primary/10 outline-none transition font-medium"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Title / Headline *</label>
              <input
                v-model="form.title"
                type="text"
                placeholder="e.g. AI Retraining & UI Polish"
                required
                class="w-full rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:ring-4 focus:ring-primary/10 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Description *</label>
            <textarea
              v-model="form.description"
              rows="3"
              placeholder="Provide a comprehensive summary of the update, why it was made, and how doctors/patients can use it..."
              required
              class="w-full rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs font-normal text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:ring-4 focus:ring-primary/10 outline-none transition leading-relaxed"
            ></textarea>
          </div>

          <!-- Feature / Changes bullet list -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Key Feature Bullets & Fixes</label>
              <button
                type="button"
                @click="addChangeField"
                class="text-xs font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Icon name="lucide:plus" class="text-xs" />
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
                  class="flex-1 rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:ring-4 focus:ring-primary/10 outline-none transition font-normal"
                />
                <button
                  type="button"
                  @click="removeChangeField(idx)"
                  class="rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
                >
                  <Icon name="lucide:trash-2" class="text-sm" />
                </button>
              </div>
            </div>
          </div>

          <!-- Publish Checkbox -->
          <div class="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
            <input
              id="publish-patch-checkbox"
              v-model="form.is_published"
              type="checkbox"
              class="h-4 w-4 rounded text-primary focus:ring-primary/20 cursor-pointer"
            />
            <label for="publish-patch-checkbox" class="text-xs font-normal text-foreground cursor-pointer select-none">
              Publish immediately and alert all users in their notification bell
            </label>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 border-t border-border/40 pt-4">
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
              {{ isEditing ? 'Save Changes' : (form.is_published ? 'Publish Update' : 'Save as Draft') }}
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
