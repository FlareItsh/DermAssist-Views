<script setup lang="ts">
  import type { DatasetCategory } from '~/api/dataset/DatasetService'

  interface RecentDatasetImage {
    url: string
    category: string
  }

  const props = withDefaults(
    defineProps<{
      datasets: DatasetCategory[]
      loading?: boolean
      maxItems?: number
    }>(),
    {
      loading: false,
      maxItems: 8
    }
  )

  const recentImages = computed<RecentDatasetImage[]>(() => {
    return props.datasets
      .flatMap(dataset =>
        dataset.images.map(url => ({
          url,
          category: dataset.category
        }))
      )
      .slice(0, props.maxItems)
  })

  const totalImages = computed(() =>
    props.datasets.reduce((total, dataset) => total + dataset.images.length, 0)
  )
</script>

<template>
  <section class="flex h-[300px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div class="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
      <div class="min-w-0">
        <div class="flex items-center gap-3">
          <div class="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <h2 class="truncate text-lg font-black text-gray-950">Recently Added Dataset Images</h2>
        </div>
        <p class="mt-1 text-sm text-gray-500">
          {{ totalImages }} images across {{ datasets.length }} categories
        </p>
      </div>

      <NuxtLink
        to="/admin/dataset"
        class="hover:border-primary hover:text-primary inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition"
      >
        <span>See more</span>
        <Icon
          name="lucide:arrow-right"
          class="text-base"
        />
      </NuxtLink>
    </div>

    <div class="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div
        v-if="loading"
        class="flex min-w-max gap-3 p-5"
      >
        <div
          v-for="i in maxItems"
          :key="i"
          class="h-40 w-40 shrink-0 animate-pulse rounded-xl bg-gray-100"
        />
      </div>

      <div
        v-else-if="recentImages.length"
        class="flex min-w-max gap-3 p-5"
      >
        <NuxtLink
          v-for="image in recentImages"
          :key="`${image.category}-${image.url}`"
          to="/admin/dataset"
          class="group relative h-40 w-40 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm"
        >
          <img
            :src="image.url"
            :alt="`${image.category} dataset image`"
            class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
          <div class="absolute inset-x-0 bottom-0 bg-gray-950/70 px-3 py-2">
            <p class="truncate text-xs font-bold text-white capitalize">{{ image.category }}</p>
          </div>
        </NuxtLink>
      </div>

      <div
        v-else
        class="px-5 py-12 text-center"
      >
        <div
          class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400"
        >
          <Icon
            name="lucide:images"
            class="text-2xl"
          />
        </div>
        <p class="text-sm font-medium text-gray-500">No dataset images have been added yet.</p>
      </div>
    </div>
  </section>
</template>
