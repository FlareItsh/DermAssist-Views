<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    title: string
  }>()

  const { searchQuery } = useSearch()

  const mockDoctors = [
    {
      id: 1,
      name: 'Dr. Sarah Johnson',
      workplace: 'City Medical Center',
      image: '/images/lp-img.png',
      specialty: 'Dermatologist'
    },
    {
      id: 2,
      name: 'Dr. Michael Chen',
      workplace: 'Metro Skin Clinic',
      image: '/images/lp-img.png',
      specialty: 'Cosmetic Specialist'
    },
    {
      id: 3,
      name: 'Dr. Elena Rodriguez',
      workplace: 'Sunshine Health',
      image: '/images/lp-img.png',
      specialty: 'Pediatric Dermatology'
    },
    {
      id: 4,
      name: 'Dr. James Wilson',
      workplace: 'Westside General',
      image: '/images/lp-img.png',
      specialty: 'Dermato-pathologist'
    },
    {
      id: 5,
      name: 'Dr. Aisha Khan',
      workplace: 'Global Skin Institute',
      image: '/images/lp-img.png',
      specialty: 'Medical Laser Specialist'
    },
    {
      id: 6,
      name: 'Dr. Robert Brown',
      workplace: 'Central Hospital',
      image: '/images/lp-img.png',
      specialty: 'Surgical Dermatology'
    }
  ]

  const filteredDoctors = computed(() => {
    const query = searchQuery.value.trim()
    if (!query) return mockDoctors

    // If the query is a number, don't "touch" (filter) the doctors
    if (/^\d+$/.test(query)) return mockDoctors

    const lowerQuery = query.toLowerCase()
    return mockDoctors.filter(
      doctor =>
        doctor.name.toLowerCase().includes(lowerQuery) ||
        doctor.workplace.toLowerCase().includes(lowerQuery) ||
        doctor.specialty.toLowerCase().includes(lowerQuery)
    )
  })
</script>

<template>
  <div class="bg-card overflow-hidden rounded-3xl border border-gray-100 p-4">
    <div class="mb-4 flex items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="bg-secondary h-8 w-1 shrink-0 rounded-full"></div>
        <h1 class="text-foreground text-2xl font-bold">
          {{ title }}
        </h1>
      </div>
      <span
        v-if="searchQuery"
        class="text-primary bg-primary/10 rounded-full px-3 py-1 text-xs font-bold italic"
      >
        Filtering by: "{{ searchQuery }}"
      </span>
    </div>

    <div
      v-if="filteredDoctors.length > 0"
      class="custom-scrollbar flex min-h-[220px] flex-row gap-4 overflow-x-auto px-2 pb-6"
    >
      <PatientSideComponentsDoctorsCard
        v-for="doc in filteredDoctors"
        :key="doc.id"
        class="shrink-0 cursor-pointer transition-all hover:scale-105 active:scale-95"
        :doctorName="doc.name"
        :doctorWorkplace="doc.workplace"
        :doctorImage="doc.image"
      />
    </div>

    <div
      v-else
      class="bg-muted/5 border-border/50 flex flex-col items-center justify-center rounded-2xl border border-dashed p-10 py-12 text-center"
    >
      <Icon
        name="solar:users-group-two-rounded-outline"
        class="text-foreground/20 mb-3 text-4xl"
      />
      <p class="text-foreground/60 font-medium">No results match your search</p>
      <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
        @click="searchQuery = ''"
        class="text-primary mt-2 text-xs font-bold hover:underline"
      >
        Clear search
      </AppButton>
    </div>
  </div>
</template>
