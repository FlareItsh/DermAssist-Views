<script setup lang="ts">
import { ref } from 'vue'

const patients = ref([
  {
    id: 1,
    name: 'Wally',
    condition: 'Herpes',
    date: 'March 12, 2026',
    avatar: 'https://i.pravatar.cc/150?u=wally',
    isUrgent: true,
    urgentLabel: 'Urgent • 2 mins ago'
  },
  {
    id: 2,
    name: 'Julianne',
    condition: 'Acne',
    date: 'March 12, 2026',
    avatar: 'https://i.pravatar.cc/150?u=julianne',
    isUrgent: false
  },
  {
    id: 3,
    name: 'Elena Vance',
    condition: 'Acne',
    date: 'March 12, 2026',
    avatar: 'https://i.pravatar.cc/150?u=elena',
    isUrgent: false
  },
  {
    id: 4,
    name: 'David Miller',
    condition: 'Acne',
    date: 'March 12, 2026',
    avatar: 'https://i.pravatar.cc/150?u=david',
    isUrgent: false
  },
  {
    id: 5,
    name: 'Robert Chen',
    condition: 'Acne',
    date: 'March 12, 2026',
    avatar: 'https://i.pravatar.cc/150?u=robert',
    isUrgent: false
  },
  {
    id: 6,
    name: 'Aria Kim',
    condition: 'Eczema',
    date: 'March 12, 2026',
    avatar: 'https://i.pravatar.cc/150?u=aria',
    isUrgent: false
  }
])

const { searchQuery } = useSearch()
const filteredPatients = computed(() => {
  if (!searchQuery.value) return patients.value
  const query = searchQuery.value.toLowerCase()
  const filtered = patients.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.condition.toLowerCase().includes(query)
  )
  return filtered.length > 0 ? filtered : patients.value
})
</script>

<template>
  <div class="bg-card rounded-3xl border border-gray-100 p-5">
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="bg-secondary h-8 w-1 shrink-0 rounded-full"></div>
        <h2 class="text-foreground text-xl font-bold">Patients</h2>
      </div>
      <button class="text-secondary text-sm font-semibold hover:underline transition">See more ›</button>
    </div>

    <!-- Horizontal Scroll Row -->
    <div class="flex gap-4 overflow-x-auto pb-2 custom-scrollbar snap-x snap-mandatory">
      <div
        v-for="patient in filteredPatients"
        :key="patient.id"
        class="patient-card group flex-shrink-0 snap-start w-[160px] flex flex-col cursor-pointer"
      >
        <!-- Photo -->
        <div class="relative w-full h-[130px] overflow-hidden rounded-2xl bg-gray-100">
          <img
            :src="patient.avatar"
            :alt="patient.name"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <!-- Urgent badge -->
          <div
            v-if="patient.isUrgent"
            class="absolute bottom-0 left-0 right-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 py-2"
          >
            <Icon name="solar:danger-triangle-bold" class="text-destructive text-xs shrink-0" />
            <span class="text-[9px] font-bold text-white">{{ patient.urgentLabel }}</span>
          </div>
        </div>

        <span class="mt-1.5 text-[10px] text-muted-foreground font-medium">{{ patient.date }}</span>

        <div class="mt-0.5 flex items-center justify-between gap-1">
          <div class="min-w-0">
            <p class="text-foreground text-sm font-bold truncate">{{ patient.name }}</p>
            <p class="text-destructive text-xs font-semibold">{{ patient.condition }}</p>
          </div>
          <div class="flex gap-1 shrink-0">
            <AppButton
              variant="unstyled" size="unstyled" rounded="unstyled"
              class="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 hover:bg-primary/10 transition-colors"
            >
              <Icon name="mingcute:message-4-line" class="text-secondary text-sm" />
            </AppButton>
            <AppButton
              variant="unstyled" size="unstyled" rounded="unstyled"
              class="flex h-7 w-7 items-center justify-center rounded-full bg-primary transition-colors hover:bg-primary/80"
            >
              <Icon name="fluent:add-12-filled" class="text-white text-sm" />
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
