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
        record.title?.toLowerCase().includes(query) || 
        record.label?.toLowerCase().includes(query)
    )
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
  <div class="mt-6 flex min-h-screen flex-col">
    <!-- Tabs for Filtering -->
    <div class="mb-8 flex gap-4">
      <AppButton
        variant="outline"
        :class="activeTab === 'all' ? 'bg-primary text-white' : ''"
        @click="activeTab = 'all'"
      >
        All Records
      </AppButton>
      <AppButton
        variant="outline"
        :class="activeTab === 'scan' ? 'bg-primary text-white' : ''"
        @click="activeTab = 'scan'"
      >
        Self-Assessment Scans
      </AppButton>
      <AppButton
        variant="outline"
        :class="activeTab === 'doctor_diagnosis' ? 'bg-primary text-white' : ''"
        @click="activeTab = 'doctor_diagnosis'"
      >
        Doctor's Diagnoses
      </AppButton>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <Icon name="svg-spinners:ring-resize" class="text-primary text-4xl" />
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
      <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
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
            class="modal-container bg-card relative max-h-[90vh] w-[68vw] overflow-hidden rounded-4xl shadow-2xl"
          >
            <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
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
