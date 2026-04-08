<script setup lang="ts">
import { ref } from 'vue'

const priorityPatients = ref([
  {
    id: 1,
    name: 'John Cena',
    condition: 'Herpes',
    schedule: 'April 12, 2026\n3:00 PM',
    avatar: 'https://i.pravatar.cc/150?u=priority1',
    read: false
  },
  {
    id: 2,
    name: 'John Cena',
    condition: 'Acne',
    schedule: 'April 12, 2026\n5:00 PM',
    avatar: 'https://i.pravatar.cc/150?u=priority2',
    read: false
  },
  {
    id: 3,
    name: 'John Cena',
    condition: 'Acne',
    schedule: 'April 16, 2026\n2:00 PM',
    avatar: 'https://i.pravatar.cc/150?u=priority3',
    read: false
  },

])

const dismiss = (id: number) => {
  priorityPatients.value = priorityPatients.value.filter(p => p.id !== id)
}

const conditionColor = (condition: string) => {
  const map: Record<string, string> = {
    Herpes: 'text-destructive',
    Acne: 'text-destructive',
    Eczema: 'text-amber-500'
  }
  return map[condition] ?? 'text-destructive'
}

const { searchQuery } = useSearch()
const filteredPriority = computed(() => {
  if (!searchQuery.value) return priorityPatients.value
  const query = searchQuery.value.toLowerCase()
  const filtered = priorityPatients.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.condition.toLowerCase().includes(query)
  )
  return filtered.length > 0 ? filtered : priorityPatients.value
})
</script>

<template>
  <div class="bg-card rounded-3xl border border-gray-100 w-full p-5 flex flex-col h-190">
    <!-- Header -->
    <div class="mb-4 flex items-center gap-3">
      <div class="bg-secondary h-7 w-1 shrink-0 rounded-full" />
      <h2 class="text-foreground text-xl font-bold">Priority List</h2>
    </div>

    <!-- List -->
    <div class="flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1 pr-1 min-h-0">
      <div
        v-for="patient in filteredPriority"
        :key="patient.id"
        class="group flex items-center gap-3 rounded-2xl border border-gray-100 bg-background/50 p-3 transition-all hover:border-primary/30 hover:shadow-md"
      >
        <!-- Avatar -->
        <div class="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gray-200">
          <img
            :src="patient.avatar"
            :alt="patient.name"
            class="h-full w-full object-cover"
          />
        </div>

        <!-- Info -->
        <div class="flex flex-1 min-w-0 flex-col gap-0.5">
          <div class="flex items-start justify-between gap-1">
            <p class="text-foreground text-sm font-bold truncate">{{ patient.name }}</p>
            <!-- Dismiss -->
            <button
              @click="dismiss(patient.id)"
              class="text-gray-300 hover:text-foreground transition-colors shrink-0 opacity-0 group-hover:opacity-100"
            >
              <Icon name="material-symbols:close-rounded" class="text-base" />
            </button>
          </div>
          <span :class="['text-xs font-semibold', conditionColor(patient.condition)]">
            {{ patient.condition }}
          </span>
          <div class="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <Icon name="lucide:calendar" class="h-3 w-3 shrink-0" />
            <span class="whitespace-pre-line">{{ patient.schedule }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col gap-1.5 shrink-0">
          <AppButton
            variant="unstyled" size="unstyled" rounded="unstyled"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-primary/10 transition-colors"
          >
            <Icon name="mingcute:message-4-line" class="text-secondary text-sm" />
          </AppButton>
          <AppButton
            variant="unstyled" size="unstyled" rounded="unstyled"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-primary hover:bg-primary/80 transition-colors"
          >
            <Icon name="material-symbols:check-rounded" class="text-white text-sm" />
          </AppButton>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="priorityPatients.length === 0"
        class="flex flex-col items-center justify-center py-10 text-center text-muted-foreground"
      >
        <Icon name="solar:list-check-bold" class="mb-2 text-4xl opacity-20" />
        <p class="text-sm">No priority patients</p>
      </div>
    </div>
  </div>
</template>
