<script setup lang="ts">
import { ref } from 'vue'

const { getStorageUrl } = useStorage()

const { pendingAppointments } = useAppointments()

const removeRecord = async (id: string) => {
  // Logic to dismiss or decline
}

const { searchQuery } = useSearch()
const filteredRecords = computed(() => {
  const list = pendingAppointments.value
  if (!searchQuery.value) return list
  const query = searchQuery.value.toLowerCase()
  return list.filter(r => 
    r.doctor.toLowerCase().includes(query) || 
    r.info.toLowerCase().includes(query)
  )
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
          :time="record.info"
          :title="record.doctor"
          is-urgent
        >
          <template #image>
            <img 
              v-if="record.diagnosis_image" 
              :src="getStorageUrl(record.diagnosis_image)" 
              class="h-10 w-10 rounded-lg object-cover border border-white/20"
            />
          </template>
        </AppRecordFolder>
      </div>

      <!-- Empty state inside scroll area -->
      <div v-if="pendingAppointments.length === 0"
        class="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-muted-foreground text-sm bg-gray-50/50 mt-4">
        <Icon name="solar:folder-check-bold" class="text-4xl opacity-20 mx-auto mb-2" />
        <p>No urgent diagnosis reports.</p>
      </div>
    </div>
  </div>
</template>
