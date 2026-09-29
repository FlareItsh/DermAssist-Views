<script setup lang="ts">
  import { patchNoteService, type PatchNote } from '~/api/patchNote/PatchNoteService'

  const { markLatestUpdateAsSeen } = usePatchNotes()

  const isLoading = ref(true)
  const notes = ref<PatchNote[]>([])
  const expandedIds = ref<Set<string | number>>(new Set())

  const formatDate = (iso: string | undefined): string => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const toggleExpand = (id: string | number) => {
    const set = new Set(expandedIds.value)
    if (set.has(id)) {
      set.delete(id)
    } else {
      set.add(id)
    }
    expandedIds.value = set
  }

  const isExpanded = (id: string | number) => expandedIds.value.has(id)

  onMounted(async () => {
    try {
      const res = await patchNoteService.getPublished(50)
      if (res?.status === 'success') {
        notes.value = res.data || []
        if (notes.value.length > 0) {
          markLatestUpdateAsSeen(notes.value[0])
        }
      }
    } catch (err) {
      console.error('Failed to fetch patch notes:', err)
    } finally {
      isLoading.value = false
    }
  })
</script>

<template>
  <div class="space-y-3">
    <!-- Page Header -->
    <div class="border-border/60 border-b pb-6">
      <h1 class="text-foreground text-xl font-semibold">Updates & Changelog</h1>
      <p class="text-muted-foreground mt-0.5 text-sm">
        A history of all improvements and new features added to DermAssist.
      </p>
    </div>

    <!-- Loading Skeleton -->
    <div
      v-if="isLoading"
      class="space-y-3 pt-2"
    >
      <div
        v-for="i in 3"
        :key="i"
        class="border-border/50 bg-card animate-pulse rounded-2xl border p-6"
      >
        <div class="grid grid-cols-3 gap-6">
          <div class="space-y-2">
            <div class="bg-muted/60 h-4 w-16 rounded" />
            <div class="bg-muted/40 h-3 w-24 rounded" />
          </div>
          <div class="space-y-2">
            <div class="bg-muted/50 h-5 w-full rounded" />
            <div class="bg-muted/50 h-5 w-3/4 rounded" />
          </div>
          <div class="space-y-3">
            <div class="bg-muted/40 h-3 w-full rounded" />
            <div class="bg-muted/40 h-3 w-5/6 rounded" />
            <div class="bg-muted/30 mt-3 h-8 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="notes.length > 0"
      class="space-y-4 pt-2"
    >
      <div
        v-for="(note, index) in notes"
        :key="note.uuid || note.id"
        class="bg-card rounded-2xl border transition-shadow hover:shadow-sm"
        :class="index === 0 ? 'border-border/80' : 'border-border/50'"
      >
        <div class="grid grid-cols-1 md:grid-cols-[180px_1fr_1fr]">
          <div class="border-border/40 shrink-0 px-6 pt-6 pb-4 md:border-r md:pb-6">
            <p class="text-md text-foreground font-medium tabular-nums">
              {{ note.version || '—' }}
            </p>
            <p class="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {{ formatDate(note.published_at) }}
            </p>
            <AppBadge
              v-if="index === 0"
              color="success"
              variant="subtle"
              class="mt-2 text-[10px]"
            >
              Latest
            </AppBadge>
          </div>

          <div class="border-border/40 flex items-start px-6 pt-4 pb-4 md:border-r md:pt-6 md:pb-6">
            <h2 class="text-foreground text-2xl leading-snug font-semibold">
              {{ note.title }}
            </h2>
          </div>

          <div class="px-6 pt-4 pb-6 md:pt-6">
            <p class="text-muted-foreground text-sm leading-relaxed">
              {{ note.description }}
            </p>

            <div
              v-if="note.changes && note.changes.length > 0"
              class="border-border/50 mt-4 overflow-hidden rounded-xl border"
            >
              <AppButton
                variant="unstyled"
                class="hover:bg-muted/30 flex w-full cursor-pointer items-center justify-between px-4 py-3 text-sm transition-colors"
                @click="toggleExpand(note.uuid || note.id!)"
              >
                <span class="text-foreground/80 font-normal"
                  >What's New ({{ note.changes.length }})</span
                >
                <Icon
                  name="lucide:chevron-down"
                  class="text-muted-foreground shrink-0 text-base transition-transform duration-200"
                  :class="{ 'rotate-180': isExpanded(note.uuid || note.id!) }"
                />
              </AppButton>

              <ul v-if="isExpanded(note.uuid || note.id!)">
                <li
                  v-for="(change, idx) in note.changes"
                  :key="idx"
                  class="text-foreground/80 bg-muted/10 border-border/40 flex items-start gap-2.5 border-t px-4 py-2.5 text-xs"
                >
                  <Icon
                    name="lucide:check"
                    class="text-primary mt-0.5 shrink-0 text-xs"
                  />
                  <span class="leading-relaxed">{{ change }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="border-border/60 bg-card mt-2 space-y-3 rounded-2xl border p-16 text-center"
    >
      <div
        class="bg-muted text-muted-foreground/40 mx-auto flex h-14 w-14 items-center justify-center rounded-full"
      >
        <Icon
          name="solar:notes-linear"
          class="text-2xl"
        />
      </div>
      <div class="space-y-1">
        <h3 class="text-foreground text-sm font-semibold">No updates yet</h3>
        <p class="text-muted-foreground mx-auto max-w-xs text-xs">
          There are no published updates at the moment. Check back soon.
        </p>
      </div>
    </div>
  </div>
</template>
