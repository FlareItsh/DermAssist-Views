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
    return (
      visit.includes('hour') ||
      visit.includes('minute') ||
      visit.includes('hr') ||
      visit.includes('min') ||
      visit === 'just now'
    )
  })

  const getInitials = (name: string): string => {
    if (!name) return ''
    const cleanName = name.replace(/^Dr\.\s+/i, '')
    const parts = cleanName.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
</script>

<template>
  <div
    v-if="isPriorityList"
    class="bg-card group relative flex w-[340px] shrink-0 cursor-pointer snap-start flex-col gap-4 overflow-hidden rounded-2xl border border-red-500/30 p-5 shadow-lg shadow-red-500/5 transition-all hover:-translate-y-1 hover:shadow-xl"
  >
    <div class="relative z-10 flex items-start justify-between">
      <div class="flex items-center gap-3">
        <div
          v-if="patient.avatar"
          class="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-red-500/30 pb-0 shadow-sm"
        >
          <NuxtImg
            :src="patient.avatar"
            :alt="patient.name"
            class="h-full w-full object-cover"
            loading="lazy"
          />
          <div
            class="absolute right-0 bottom-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500"
          ></div>
        </div>
        <div
          v-else
          class="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-red-500/30 bg-red-50 text-lg font-bold text-red-500 shadow-sm"
        >
          {{ getInitials(patient.name) }}
          <div
            class="absolute right-0 bottom-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500"
          ></div>
        </div>
        <div class="flex flex-col">
          <h3 class="text-foreground text-lg font-bold">{{ patient.name }}</h3>
          <p class="text-muted-foreground mt-0.5 text-xs font-semibold">
            {{ patient.age }} yrs • {{ patient.gender }}
          </p>
        </div>
      </div>
    </div>
    <div
      class="relative z-10 flex flex-col gap-1 rounded-xl border border-red-100 bg-red-50/50 p-3 dark:border-red-500/10 dark:bg-red-500/5"
    >
      <span class="text-xs font-bold tracking-wider text-red-500/70 uppercase">Main Concern</span>
      <span class="text-foreground text-sm font-bold">{{ patient.condition }}</span>
    </div>

    <div
      class="border-border/50 relative z-10 mt-auto flex items-center justify-between border-t pt-4"
    >
      <span class="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Icon
          :name="isRecentVisit ? 'lucide:clock' : 'lucide:calendar'"
          class="h-3.5 w-3.5"
        />
        Last visit: {{ patient.lastVisit }}
      </span>
      <AppButton
        variant="unstyled"
        size="unstyled"
        rounded="unstyled"
        class="flex items-center gap-1 text-sm font-bold text-red-600 transition-colors hover:text-red-700"
      >
        Review Case
        <Icon
          name="lucide:arrow-right"
          class="h-4 w-4"
        />
      </AppButton>
    </div>
  </div>

  <div
    v-else
    class="bg-card group border-border/60 hover:border-primary/30 relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
  >
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <div
          v-if="patient.avatar"
          class="border-border relative h-12 w-12 shrink-0 overflow-hidden rounded-full border shadow-sm"
        >
          <NuxtImg
            :src="patient.avatar"
            :alt="patient.name"
            class="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div
          v-else
          class="border-border relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border bg-gray-100 text-sm font-bold text-gray-500 shadow-sm"
        >
          {{ getInitials(patient.name) }}
        </div>
        <div class="flex flex-col">
          <h3 class="text-foreground font-bold">{{ patient.name }}</h3>
          <p class="text-muted-foreground mt-0.5 text-xs font-semibold">
            {{ patient.age }} yrs • {{ patient.gender }}
          </p>
        </div>
      </div>
      <span
        v-if="patient.priority === 'High'"
        class="flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-red-500 uppercase shadow-sm"
      >
        <Icon
          name="solar:danger-triangle-bold"
          class="h-3 w-3"
        />
        Priority
      </span>
    </div>

    <div class="mt-1 flex w-fit flex-col gap-1">
      <span class="text-destructive w-fit text-lg font-semibold">{{ patient.condition }}</span>
    </div>

    <div class="border-border/40 mt-auto flex items-center justify-between border-t pt-3">
      <span class="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Icon
          :name="isRecentVisit ? 'lucide:clock' : 'lucide:calendar'"
          class="h-3.5 w-3.5"
        />
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
          <Icon
            name="fluent:add-12-filled"
            class="h-4 w-4"
          />
        </AppButton>
        <AppButton
          variant="unstyled"
          size="unstyled"
          rounded="unstyled"
          class="bg-foreground/10 text-foreground/80 hover:bg-foreground/20 hover:text-foreground border-border/50 cursor-pointer rounded-lg border px-3.5 py-1.5 text-xs font-bold transition-colors"
        >
          View Diagnosis
        </AppButton>
      </div>
    </div>
  </div>
</template>
