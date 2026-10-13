<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { recordService } from '~/api/record/RecordService'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const isOpen = ref(false)
  const selectedRecord = ref<any>(null)
  const records = ref<any[]>([])
  const isLoading = ref(true)

  const { searchQuery } = useSearch()

  const fetchRecords = async () => {
    isLoading.value = true
    try {
      const response = await recordService.getRecords()
      records.value = (response as any).data || response || []
    } catch (e) {
      console.error('Failed to fetch records', e)
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    fetchRecords()
  })

  const filteredRecords = computed(() => {
    let result = records.value

    if (!searchQuery.value) return result

    const query = searchQuery.value.toLowerCase()
    return result.filter(
      record =>
        record.title?.toLowerCase().includes(query) ||
        record.label?.toLowerCase().includes(query) ||
        record.patient?.first_name?.toLowerCase().includes(query) ||
        record.patient?.last_name?.toLowerCase().includes(query)
    )
  })

  const recordsPerPage = 10
  const recordCurrentPage = ref(1)

  const paginatedRecords = computed(() => {
    const start = (recordCurrentPage.value - 1) * recordsPerPage
    return filteredRecords.value.slice(start, start + recordsPerPage)
  })

  watch(searchQuery, () => {
    recordCurrentPage.value = 1
  })

  const handleRecordClick = (record: any) => {
    selectedRecord.value = record
    isOpen.value = true
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Unknown Date'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }
</script>

<template>
  <div class="mt-4 flex flex-col pb-4 md:mt-6 md:pb-0">
    <!-- Page Header -->
    <div class="mb-4">
      <h1 class="text-foreground text-2xl font-bold sm:text-3xl">Records</h1>
      <p class="text-muted-foreground mt-0.5 text-xs sm:text-sm">
        View clinic patient consultation records and diagnostic findings.
      </p>
    </div>

    <!-- Mobile Search Bar (hidden on desktop) -->
    <div class="mb-4 block md:hidden">
      <div
        class="flex items-center gap-2.5 rounded-2xl border border-gray-200/80 bg-white px-3.5 py-2.5 shadow-2xs"
      >
        <Icon
          name="solar:magnifer-linear"
          class="shrink-0 text-gray-400"
          size="18"
        />
        <input
          type="text"
          placeholder="Search records by patient or condition..."
          v-model="searchQuery"
          class="text-foreground flex-1 bg-transparent text-xs font-medium placeholder-gray-400 outline-none"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="shrink-0 text-gray-400 hover:text-gray-600"
        >
          <Icon
            name="heroicons:x-mark-20-solid"
            size="16"
          />
        </button>
      </div>
    </div>

    <div
      v-if="isLoading"
      class="flex items-center justify-center py-20"
    >
      <Icon
        name="svg-spinners:ring-resize"
        class="text-primary text-4xl"
      />
    </div>

    <div
      v-else-if="filteredRecords.length > 0"
      class="flex flex-col gap-6"
    >
      <div class="flex flex-col">
        <AppRecordFolder
          v-for="(record, index) in paginatedRecords"
          :key="record.id"
          :time="formatDate(record.created_at)"
          :title="
            record.patient
              ? `${record.patient.first_name} ${record.patient.last_name} - ${record.title}`
              : record.title
          "
          :style="{
            marginTop: index === 0 ? '0px' : '-200px',
            zIndex: 10 + index
          }"
          class="transition-all hover:z-100 hover:-translate-y-6"
          @click="handleRecordClick(record)"
        />
      </div>

      <div class="bg-card border-sidebar-border mt-4 overflow-hidden rounded-2xl border shadow-xs">
        <AppPagination
          v-model:currentPage="recordCurrentPage"
          :total-items="filteredRecords.length"
          :per-page="recordsPerPage"
          item-label="records"
        />
      </div>
    </div>

    <!-- No Results State -->
    <div
      v-else
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <div class="bg-muted/10 mb-6 flex h-24 w-24 items-center justify-center rounded-full">
        <Icon
          name="solar:magnifer-outline"
          class="text-foreground/20 text-5xl"
        />
      </div>
      <h3 class="text-foreground mb-2 text-2xl font-bold">No records found</h3>
      <p class="text-muted-foreground">Try searching for a different condition or date.</p>
      <AppButton
        variant="unstyled"
        size="unstyled"
        rounded="unstyled"
        @click="searchQuery = ''"
        class="text-primary mt-6 font-bold hover:underline"
      >
        Clear search
      </AppButton>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="isOpen"
          class="fixed inset-0 z-999 flex items-center justify-center bg-black/50 p-4 transition-all"
          @click.self="isOpen = false"
        >
          <div
            class="modal-container bg-card relative max-h-[90vh] w-[95vw] overflow-y-auto rounded-3xl shadow-2xl md:w-full md:max-w-2xl md:rounded-4xl"
          >
            <AppButton
              variant="unstyled"
              size="unstyled"
              rounded="unstyled"
              @click="isOpen = false"
              class="group absolute top-6 right-6 z-10 rounded-full p-3 transition-all hover:bg-gray-100 active:scale-90"
            >
              <Icon
                name="material-symbols:close-rounded"
                class="group-hover:text-foreground text-3xl text-gray-400"
              />
            </AppButton>

            <AppModalRecord
              v-if="selectedRecord"
              :record="selectedRecord"
              role="doctor"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--primary), 0.1);
    border-radius: 10px;
  }
</style>
