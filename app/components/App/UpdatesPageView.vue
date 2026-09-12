<script setup lang="ts">
  import { patchNoteService, type PatchNote } from '~/api/patchNote/PatchNoteService'

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
    <div class="pb-6 border-b border-border/60">
      <h1 class="text-xl font-semibold text-foreground">Updates & Changelog</h1>
      <p class="text-sm text-muted-foreground mt-0.5">
        A history of all improvements and new features added to DermAssist.
      </p>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="isLoading" class="space-y-3 pt-2">
      <div
        v-for="i in 3"
        :key="i"
        class="animate-pulse rounded-2xl border border-border/50 bg-card p-6"
      >
        <div class="grid grid-cols-3 gap-6">
          <div class="space-y-2">
            <div class="h-4 w-16 rounded bg-muted/60" />
            <div class="h-3 w-24 rounded bg-muted/40" />
          </div>
          <div class="space-y-2">
            <div class="h-5 w-full rounded bg-muted/50" />
            <div class="h-5 w-3/4 rounded bg-muted/50" />
          </div>
          <div class="space-y-3">
            <div class="h-3 w-full rounded bg-muted/40" />
            <div class="h-3 w-5/6 rounded bg-muted/40" />
            <div class="h-8 w-full rounded-lg bg-muted/30 mt-3" />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="notes.length > 0" class="space-y-4 pt-2">
      <div
        v-for="(note, index) in notes"
        :key="note.uuid || note.id"
        class="rounded-2xl border bg-card transition-shadow hover:shadow-sm"
        :class="index === 0 ? 'border-border/80' : 'border-border/50'"
      >
        <div class="grid grid-cols-1 md:grid-cols-[180px_1fr_1fr]">
          <div class="px-6 pt-6 pb-4 md:pb-6 md:border-r border-border/40 shrink-0">
            <p class="text-md font-medium text-foreground tabular-nums">
              {{ note.version || '—' }}
            </p>
            <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">
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

          <div class="px-6 pt-4 md:pt-6 pb-4 md:pb-6 md:border-r border-border/40 flex items-start">
            <h2 class="text-2xl font-semibold text-foreground leading-snug">
              {{ note.title }}
            </h2>
          </div>

          <div class="px-6 pt-4 md:pt-6 pb-6">
            <p class="text-sm text-muted-foreground leading-relaxed">
              {{ note.description }}
            </p>

            <div
              v-if="note.changes && note.changes.length > 0"
              class="mt-4 border border-border/50 rounded-xl overflow-hidden"
            >
              <AppButton
                variant="unstyled"
                class="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-muted/30 transition-colors cursor-pointer"
                @click="toggleExpand(note.uuid || note.id!)"
              >
                <span class="font-normal text-foreground/80">What's New ({{ note.changes.length }})</span>
                <Icon
                  name="lucide:chevron-down"
                  class="text-muted-foreground text-base shrink-0 transition-transform duration-200"
                  :class="{ 'rotate-180': isExpanded(note.uuid || note.id!) }"
                />
              </AppButton>

              <ul v-if="isExpanded(note.uuid || note.id!)">
                <li
                  v-for="(change, idx) in note.changes"
                  :key="idx"
                  class="flex items-start gap-2.5 px-4 py-2.5 text-xs text-foreground/80 bg-muted/10 border-t border-border/40"
                >
                  <Icon name="lucide:check" class="text-primary shrink-0 mt-0.5 text-xs" />
                  <span class="leading-relaxed">{{ change }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="border border-border/60 bg-card rounded-2xl p-16 text-center space-y-3 mt-2">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground/40">
        <Icon name="solar:notes-linear" class="text-2xl" />
      </div>
      <div class="space-y-1">
        <h3 class="text-sm font-semibold text-foreground">No updates yet</h3>
        <p class="text-xs text-muted-foreground max-w-xs mx-auto">
          There are no published updates at the moment. Check back soon.
        </p>
      </div>
    </div>
  </div>
</template>