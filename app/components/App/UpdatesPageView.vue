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
        <div class="grid grid-cols-1 gap-6 md:grid-cols-[170px_0.8fr_1.3fr]">
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
        class="bg-card rounded-2xl border transition-all duration-200 hover:shadow-md"
        :class="[
          index === 0
            ? 'border-l-primary border-border/80 border-l-4 shadow-xs'
            : 'border-border/50 hover:border-border/80'
        ]"
      >
        <div class="grid grid-cols-1 md:grid-cols-[170px_0.8fr_1.3fr]">
          <div class="border-border/40 shrink-0 px-6 pt-6 pb-4 md:border-r md:pb-6">
            <div class="flex items-center gap-1.5">
              <span
                class="bg-muted/70 text-foreground rounded-md px-2 py-0.5 font-mono text-xs font-bold tracking-tight"
              >
                {{
                  note.version
                    ? note.version.startsWith('v')
                      ? note.version
                      : `v${note.version}`
                    : '—'
                }}
              </span>
            </div>
            <div
              class="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs leading-relaxed"
            >
              <Icon
                name="lucide:calendar"
                class="h-3.5 w-3.5 shrink-0 opacity-70"
              />
              <span>{{ formatDate(note.published_at) }}</span>
            </div>
            <div
              v-if="index === 0"
              class="mt-3"
            >
              <span
                class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-600 dark:text-emerald-400"
              >
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
                LATEST
              </span>
            </div>
          </div>

          <div
            class="border-border/40 flex flex-col justify-start px-6 pt-4 pb-4 md:border-r md:pt-6 md:pb-6"
          >
            <div class="mb-1.5 flex items-center gap-1.5">
              <span class="text-primary/80 text-[10px] font-bold tracking-wider uppercase">
                Release Update
              </span>
            </div>
            <h2 class="text-foreground text-xl leading-snug font-semibold md:text-2xl">
              {{ note.title }}
            </h2>
          </div>

          <div class="px-6 pt-4 pb-6 md:pt-6">
            <p class="text-muted-foreground text-sm leading-relaxed md:text-[15px]">
              {{ note.description }}
            </p>

            <div
              v-if="note.changes && note.changes.length > 0"
              class="border-border/60 bg-muted/15 mt-4 overflow-hidden rounded-xl border transition-all"
            >
              <button
                type="button"
                class="group hover:bg-muted/40 flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left transition-colors select-none focus:outline-none"
                :class="{
                  'border-border/50 bg-muted/25 border-b': isExpanded(note.uuid || note.id!)
                }"
                @click="toggleExpand(note.uuid || note.id!)"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="lucide:sparkles"
                    class="text-primary h-3.5 w-3.5"
                  />
                  <span
                    class="text-foreground/80 group-hover:text-foreground text-xs font-semibold"
                  >
                    What's New
                  </span>
                  <span
                    class="bg-primary/10 text-primary inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold"
                  >
                    {{ note.changes.length }}
                  </span>
                </div>
                <div
                  class="text-muted-foreground group-hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
                >
                  <span class="hidden text-[11px] font-medium sm:inline">
                    {{ isExpanded(note.uuid || note.id!) ? 'Hide details' : 'Show details' }}
                  </span>
                  <Icon
                    name="lucide:chevron-down"
                    class="h-4 w-4 shrink-0 transition-transform duration-200"
                    :class="{ 'text-primary rotate-180': isExpanded(note.uuid || note.id!) }"
                  />
                </div>
              </button>

              <ul
                v-if="isExpanded(note.uuid || note.id!)"
                class="divide-border/30 bg-card/60 divide-y p-1.5"
              >
                <li
                  v-for="(change, idx) in note.changes"
                  :key="idx"
                  class="group/item text-foreground/85 hover:bg-muted/30 flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs leading-relaxed transition-colors"
                >
                  <div
                    class="bg-primary/10 text-primary group-hover/item:bg-primary group-hover/item:text-primary-foreground mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors"
                  >
                    <Icon
                      name="lucide:check"
                      class="h-2.5 w-2.5 stroke-[2.5]"
                    />
                  </div>
                  <span>{{ change }}</span>
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
