<script setup lang="ts">
import { ref } from 'vue'

// Urgent records — mirrors the folder component from records.vue
const urgentRecords = ref([
  { id: 1, patientName: 'Rizal, Jose', condition: 'Herpes' },
  { id: 2, patientName: 'Rizal, Jose', condition: 'Herpes' },
  { id: 3, patientName: 'Rizal, Jose', condition: 'Herpes' },
])

const removeRecord = (id: number) => {
  urgentRecords.value = urgentRecords.value.filter(r => r.id !== id)
}

const { searchQuery } = useSearch()
const filteredRecords = computed(() => {
  if (!searchQuery.value) return urgentRecords.value
  const query = searchQuery.value.toLowerCase()
  const filtered = urgentRecords.value.filter(r => 
    r.patientName.toLowerCase().includes(query) || 
    r.condition.toLowerCase().includes(query)
  )
  return filtered.length > 0 ? filtered : urgentRecords.value
})
</script>

<template>
  <div class="flex flex-col">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-4">
      <div class="bg-secondary h-8 w-1 shrink-0 rounded-full"></div>
      <h2 class="text-foreground text-xl font-bold">Urgent Patients Diagnosis Reports</h2>
    </div>

    <!-- Scrollable Folder Stack -->
    <div class="flex flex-col flex-1 min-h-[300px] max-h-[400px] overflow-y-auto custom-scrollbar pr-2 pb-12">
      <div v-for="(record, index) in filteredRecords" :key="record.id"
        class="flex flex-col relative transition-all duration-300 hover:-translate-y-4"
        :style="{ marginTop: index > 0 ? '-220px' : '0', zIndex: index + 1 }">
        
        <AppRecordFolder
          :time="record.condition"
          :title="record.patientName"
          is-urgent
        />
      </div>

      <!-- Empty state inside scroll area -->
      <div v-if="urgentRecords.length === 0"
        class="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-muted-foreground text-sm bg-gray-50/50 mt-4">
        <Icon name="solar:folder-check-bold" class="text-4xl opacity-20 mx-auto mb-2" />
        <p>No urgent diagnosis reports.</p>
      </div>
    </div>
  </div>
</template>
