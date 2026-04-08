<script setup lang="ts">
  import { ref, computed } from 'vue'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const isOpen = ref(false)
  const selectedRecord = ref<any>(null)

  const { searchQuery } = useSearch()

  const mockRecords = [
    { id: 1, time: '20 minutes ago', title: 'Herpes | Cold Sores | Viral' },
    { id: 2, time: '3 hours ago', title: 'Eczema | Redness | Skin Rash' },
    { id: 3, time: 'Yesterday', title: 'Acne | Pimple | Breakout' },
    { id: 4, time: 'March 28, 2024', title: 'Eczema Flare-up' },
    { id: 5, time: 'March 25, 2024', title: 'Severe Acne Case' },
    { id: 6, time: 'March 20, 2024', title: 'Herpes Outbreak' },
    { id: 7, time: 'March 15, 2024', title: 'Acne Scars' },
    { id: 8, time: 'March 10, 2024', title: 'Chronic Eczema' },
    { id: 9, time: 'March 05, 2024', title: 'Herpes Consultation' }
  ]

  const filteredRecords = computed(() => {
    if (!searchQuery.value) return mockRecords
    const query = searchQuery.value.toLowerCase()
    return mockRecords.filter(
      record =>
        record.title.toLowerCase().includes(query) || record.time.toLowerCase().includes(query)
    )
  })

  const handleRecordClick = (record: any) => {
    selectedRecord.value = record
    isOpen.value = true
  }
</script>

<template>
  <div class="mt-6 flex min-h-screen flex-col">
    <div
      v-if="filteredRecords.length > 0"
      class="flex flex-col"
    >
      <AppRecordFolder
        v-for="(record, index) in filteredRecords"
        :key="record.id"
        :time="record.time"
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
