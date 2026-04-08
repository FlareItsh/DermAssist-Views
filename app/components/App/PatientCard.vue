<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  patient: {
    type: Object as any,
    required: true
  },
  isPriorityList: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-priority'])

const isRecentVisit = computed(() => {
  const visit = props.patient.lastVisit?.toLowerCase() || ''
  return visit.includes('hour') || visit.includes('minute') || visit.includes('hr') || visit.includes('min') || visit === 'just now'
})
</script>

<template>
  <div v-if="isPriorityList" class="bg-card border-red-500/30 shadow-red-500/5 group relative flex w-[340px] shrink-0 snap-start cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border p-5 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl">
    <div class="flex items-start justify-between relative z-10">
      <div class="flex items-center gap-3">
        <div class="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-red-500/30 pb-0 shadow-sm">
          <img :src="patient.avatar" :alt="patient.name" class="h-full w-full object-cover" />
          <div class="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500"></div>
        </div>
        <div class="flex flex-col">
          <h3 class="font-bold text-foreground text-lg">{{ patient.name }}</h3>
          <p class="text-xs font-semibold text-muted-foreground mt-0.5">{{ patient.age }} yrs • {{ patient.gender }}</p>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-1 rounded-xl bg-red-50/50 dark:bg-red-500/5 p-3 relative z-10 border border-red-100 dark:border-red-500/10">
      <span class="text-xs font-bold uppercase tracking-wider text-red-500/70">Main Concern</span>
      <span class="text-sm font-bold text-foreground">{{ patient.condition }}</span>
    </div>

    <div class="mt-auto flex items-center justify-between border-t border-border/50 pt-4 relative z-10">
      <span class="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
        <Icon :name="isRecentVisit ? 'lucide:clock' : 'lucide:calendar'" class="h-3.5 w-3.5" />
        Last visit: {{ patient.lastVisit }}
      </span>
      <AppButton variant="unstyled" size="unstyled" rounded="unstyled" class="flex items-center gap-1 text-sm font-bold text-red-600 transition-colors hover:text-red-700">
        Review Case
        <Icon name="lucide:arrow-right" class="h-4 w-4" />
      </AppButton>
    </div>
  </div>


  <div v-else class="bg-card group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border border-border/60 p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <div class="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border shadow-sm">
          <img :src="patient.avatar" :alt="patient.name" class="h-full w-full object-cover" />
        </div>
        <div class="flex flex-col">
          <h3 class="font-bold text-foreground">{{ patient.name }}</h3>
          <p class="text-xs font-semibold text-muted-foreground mt-0.5">{{ patient.age }} yrs • {{ patient.gender }}</p>
        </div>
      </div>
      <span v-if="patient.priority === 'High'" class="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500 shadow-sm border border-red-500/20">
        <Icon name="solar:danger-triangle-bold" class="h-3 w-3" />
        Priority
      </span>
    </div>

    <div class="flex flex-col w-fit gap-1 mt-1">
      <span class="text-lg w-fit font-semibold text-destructive">{{ patient.condition }}</span>
    </div>

    <div class="mt-auto flex items-center justify-between pt-3 border-t border-border/40">
      <span class="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
        <Icon :name="isRecentVisit ? 'lucide:clock' : 'lucide:calendar'" class="h-3.5 w-3.5" />
        {{ patient.lastVisit }}
      </span>
      <div class="flex items-center gap-2">
        <AppButton 
          v-if="patient.priority !== 'High'"
          @click.stop="emit('toggle-priority', patient)"
          rounded="full"
          size="icon"
          class="!h-8 !w-8 !p-0 shadow-sm"
        >
          <Icon name="fluent:add-12-filled" class="h-4 w-4" />
        </AppButton>
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          class="rounded-lg bg-foreground/10 px-3.5 py-1.5 text-xs font-bold text-foreground/80 hover:bg-foreground/20 cursor-pointer hover:text-foreground transition-colors border border-border/50">
          View Diagnosis
        </AppButton>
      </div>
    </div>
  </div>
</template>
