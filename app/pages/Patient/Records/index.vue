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
  const activeTab = ref<'all' | 'scan' | 'doctor_diagnosis'>('all')

  const { searchQuery } = useSearch()

  const fetchRecords = async () => {
    isLoading.value = true
    try {
      const response = await recordService.getRecords()
      records.value = (response as any).data || response || []
      console.log('RECORDS LOADED:', records.value)
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

    if (activeTab.value !== 'all') {
      result = result.filter(r => r.type === activeTab.value)
    }

    if (!searchQuery.value) return result

    const query = searchQuery.value.toLowerCase()
    return result.filter(
      record =>
        record.title?.toLowerCase().includes(query) || record.label?.toLowerCase().includes(query)
    )
  })

  const activeRecordState = useState<any>('active_patient_record', () => null)

  const handleRecordClick = (record: any) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      activeRecordState.value = record
      navigateTo(`/Patient/Records/${record.uuid || record.id}`)
      return
    }
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
  <div class="mt-4 flex min-h-screen flex-col pb-24 md:mt-6 md:pb-0">
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
          placeholder="Search records by condition or title..."
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

    <!-- Tabs for Filtering -->
    <div
      class="mb-6 grid grid-cols-3 gap-1 rounded-2xl border border-gray-200/80 bg-white/80 p-1 md:mb-8 md:inline-flex md:w-fit md:gap-1.5 md:p-1.5"
    >
      <button
        type="button"
        @click="activeTab = 'all'"
        class="flex items-center justify-center rounded-xl px-2.5 py-2.5 text-center text-xs font-semibold transition-all active:scale-95 md:px-5 md:py-2 md:text-sm"
        :class="
          activeTab === 'all'
            ? 'bg-primary text-white shadow-xs'
            : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
        "
      >
        <span>All Records</span>
      </button>

      <button
        type="button"
        @click="activeTab = 'scan'"
        class="flex items-center justify-center rounded-xl px-2.5 py-2.5 text-center text-xs font-semibold transition-all active:scale-95 md:px-5 md:py-2 md:text-sm"
        :class="
          activeTab === 'scan'
            ? 'bg-primary text-white shadow-xs'
            : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
        "
      >
        <span>Self-Scans</span>
      </button>

      <button
        type="button"
        @click="activeTab = 'doctor_diagnosis'"
        class="flex items-center justify-center rounded-xl px-2.5 py-2.5 text-center text-xs font-semibold transition-all active:scale-95 md:px-5 md:py-2 md:text-sm"
        :class="
          activeTab === 'doctor_diagnosis'
            ? 'bg-primary text-white shadow-xs'
            : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
        "
      >
        <span class="sm:hidden">Doctor Notes</span>
        <span class="hidden sm:inline">Doctor Diagnoses</span>
      </button>
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
      class="flex flex-col"
    >
      <AppRecordFolder
        v-for="(record, index) in filteredRecords"
        :key="record.id"
        :time="formatDate(record.created_at)"
        :title="record.title"
        :style="{
          marginTop: index === 0 ? '0px' : '-200px',
          zIndex: 10 + index
        }"
        class="transition-all hover:z-100 hover:-translate-y-6"
        @click="handleRecordClick(record)"
      />
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
          class="fixed inset-0 z-999 flex items-center justify-center bg-black/40 p-4 transition-all"
          @click.self="isOpen = false"
        >
          <div
            class="modal-container relative max-h-[90vh] w-[95vw] overflow-y-auto rounded-3xl bg-white shadow-2xl md:w-full md:max-w-2xl md:rounded-4xl"
          >
            <AppModalRecord
              v-if="selectedRecord"
              :record="selectedRecord"
              @close="isOpen = false"
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
