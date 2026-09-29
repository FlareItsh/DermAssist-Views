<script setup lang="ts">
  import { computed } from 'vue'

  const props = withDefaults(
    defineProps<{
      currentPage: number
      totalItems: number
      perPage?: number
      itemLabel?: string
    }>(),
    {
      perPage: 10,
      itemLabel: 'items'
    }
  )

  const emit = defineEmits<{
    (e: 'update:currentPage', page: number): void
    (e: 'change', page: number): void
  }>()

  const totalPages = computed(() => Math.max(1, Math.ceil(props.totalItems / props.perPage)))
  const firstVisible = computed(() =>
    props.totalItems ? (props.currentPage - 1) * props.perPage + 1 : 0
  )
  const lastVisible = computed(() => Math.min(props.totalItems, props.currentPage * props.perPage))

  const setPage = (page: number) => {
    if (page < 1 || page > totalPages.value || page === props.currentPage) return
    emit('update:currentPage', page)
    emit('change', page)
  }
</script>

<template>
  <div
    v-if="totalItems > 0"
    class="border-sidebar-border/70 flex flex-col gap-3 border-t px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
  >
    <p class="text-muted-foreground font-medium">
      Showing <span class="text-foreground font-semibold">{{ firstVisible }}</span
      >–<span class="text-foreground font-semibold">{{ lastVisible }}</span> of
      <span class="text-foreground font-semibold">{{ totalItems }}</span> {{ itemLabel }}
    </p>

    <div class="flex items-center gap-1.5 self-end sm:self-auto">
      <AppButton
        variant="outline"
        size="sm"
        :disabled="currentPage <= 1"
        @click="setPage(currentPage - 1)"
      >
        <Icon
          name="lucide:chevron-left"
          class="mr-1 h-4 w-4"
        />
        Prev
      </AppButton>

      <div
        class="text-foreground bg-muted/20 border-sidebar-border rounded-xl border px-2 py-1 text-xs font-semibold"
      >
        {{ currentPage }} / {{ totalPages }}
      </div>

      <AppButton
        variant="outline"
        size="sm"
        :disabled="currentPage >= totalPages"
        @click="setPage(currentPage + 1)"
      >
        Next
        <Icon
          name="lucide:chevron-right"
          class="ml-1 h-4 w-4"
        />
      </AppButton>
    </div>
  </div>
</template>
