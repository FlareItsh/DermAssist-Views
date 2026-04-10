<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    title: string
    role?: 'doctor' | 'patient'
    status?: string
  }>()

  const { searchQuery } = useSearch()
  const { getStorageUrl } = useStorage()

  const queryUrl = computed(() => {
    let url = 'users?'
    if (props.role) url += `role=${props.role}&`
    if (props.status) url += `status=${props.status}&`
    return url.slice(0, -1) 
  })

  const { data: response, pending } = await useApi<any>(() => queryUrl.value, {
    key: `users-list-${props.role}-${props.status}`,
    watch: [() => props.role, () => props.status]
  })

  const users = computed(() => response.value?.data || [])

  const filteredUsers = computed(() => {
    const query = searchQuery.value.trim()
    if (!query) return users.value

    if (/^\d+$/.test(query)) return users.value

    const lowerQuery = query.toLowerCase()
    return users.value.filter(
      (user: any) =>
        user.first_name?.toLowerCase().includes(lowerQuery) ||
        user.last_name?.toLowerCase().includes(lowerQuery) ||
        user.city?.toLowerCase().includes(lowerQuery) ||
        user.province?.toLowerCase().includes(lowerQuery)
    )
  })

  const getDisplayName = (user: any) => {
    if (user.role === 'doctor') {
      return `Dr. ${user.first_name} ${user.last_name}`
    }
    return `${user.first_name} ${user.last_name}`
  }

  const getWorkplaceOrLocation = (user: any) => {
    if (user.city && user.province) {
      return `${user.city}, ${user.province}`
    }
    return user.city || user.province || 'Location unlisted'
  }
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
      v-if="pending"
      class="flex min-h-[220px] items-center justify-center p-10"
    >
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
    </div>
    
    <div
      v-else-if="filteredUsers.length > 0"
      class="custom-scrollbar flex min-h-[220px] flex-row gap-4 overflow-x-auto px-2 pb-6"
    >
      <PatientSideComponentsDoctorsCard
        v-for="userItem in filteredUsers"
        :key="userItem.id"
        class="shrink-0 cursor-pointer transition-all hover:scale-105 active:scale-95"
        :doctorName="getDisplayName(userItem)"
        :doctorWorkplace="getWorkplaceOrLocation(userItem)"
        :doctorImage="userItem.avatar_path ? getStorageUrl(userItem.avatar_path) : (userItem.doctor_verification?.id_photo_path ? getStorageUrl(userItem.doctor_verification.id_photo_path) : '/images/lp-img.png')"
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
