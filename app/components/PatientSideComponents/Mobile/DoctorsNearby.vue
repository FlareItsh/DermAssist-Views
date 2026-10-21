<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useRouter } from '#app'
  import { userService } from '~/api/user/UserService'
  import { conversationService } from '~/api/conversation/ConversationService'

  const router = useRouter()
  const { searchQuery } = useSearch()
  const { getStorageUrl } = useStorage()

  const params = {
    role: 'doctor' as const,
    status: 'verified'
  }

  const { data: response, pending } = await userService.useList(params, {
    key: 'mobile-doctors-list'
  })

  const users = computed(() => response.value?.data || [])

  const filteredUsers = computed(() => {
    const query = searchQuery.value.trim()
    if (!query) return users.value

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
    return `Dr. ${user.first_name} ${user.last_name}`
  }

  const getWorkplaceOrLocation = (user: any) => {
    if (user.city && user.province) {
      return `${user.city}, ${user.province}`
    }
    return user.city || user.province || 'Location unlisted'
  }

  const activeStartingDoctorId = ref<string | number | null>(null)

  const startConversation = async (doctorId: string | number) => {
    if (activeStartingDoctorId.value !== null) return
    activeStartingDoctorId.value = doctorId
    try {
      const res = await conversationService.create({ doctor_id: doctorId })
      const uuid = res?.data?.id || res?.id || res?.data?.uuid || res?.uuid
      if (uuid) {
        router.push(`/Patient/Messages/${uuid}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      activeStartingDoctorId.value = null
    }
  }

  const goToBooking = (doctorId: string | number) => {
    router.push({
      path: '/patient/appointments',
      query: { doctor: String(doctorId), book: 'true' }
    })
  }
</script>

<template>
  <div class="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <div class="bg-secondary h-5 w-1 shrink-0 rounded-full"></div>
        <h3 class="text-foreground text-base font-bold">Doctors Nearby</h3>
      </div>
      <div class="flex items-center gap-2">
        <span
          v-if="searchQuery"
          class="text-primary bg-primary/10 rounded-full px-2.5 py-0.5 text-[10px] font-bold italic"
        >
          Filtering
        </span>
        <NuxtLink
          to="/patient/appointments"
          class="text-primary hover:text-primary/80 group inline-flex items-center gap-1 text-xs font-bold transition-all"
        >
          <span>See More</span>
          <Icon
            name="solar:alt-arrow-right-linear"
            class="text-sm transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </NuxtLink>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="pending"
      class="flex min-h-[140px] items-center justify-center py-6"
    >
      <div
        class="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
      ></div>
    </div>

    <!-- Doctors Horizontal Scroll List -->
    <div
      v-else-if="filteredUsers.length > 0"
      class="custom-scrollbar scrollbar-hide flex snap-x snap-mandatory flex-row gap-3.5 overflow-x-auto pb-2"
    >
      <div
        v-for="userItem in filteredUsers"
        :key="userItem.id"
        class="hover:border-primary/20 flex w-40 shrink-0 snap-start flex-col justify-between rounded-2xl border border-gray-100 bg-white p-2.5 shadow-xs transition-all active:scale-98"
      >
        <!-- Doctor Avatar Image / Profile Badge -->
        <div
          v-if="userItem.avatar_path || userItem.doctor_verification?.id_photo_path"
          class="h-24 w-full overflow-hidden rounded-xl border border-gray-100 shadow-xs"
        >
          <img
            :src="
              userItem.avatar_path
                ? getStorageUrl(userItem.avatar_path)
                : getStorageUrl(userItem.doctor_verification.id_photo_path)
            "
            :alt="getDisplayName(userItem)"
            class="h-full w-full object-cover"
          />
        </div>
        <div
          v-else
          class="from-primary/15 via-primary/10 to-primary/5 border-primary/20 text-primary relative flex h-24 w-full flex-col items-center justify-center rounded-xl border bg-gradient-to-br shadow-xs"
        >
          <div
            class="bg-card text-primary border-primary/25 flex size-11 items-center justify-center rounded-full border shadow-xs"
          >
            <Icon
              name="solar:user-bold-duotone"
              class="size-6"
            />
          </div>
        </div>

        <!-- Info -->
        <div class="mt-2.5 flex-1">
          <p class="truncate text-[9px] font-bold tracking-tight text-gray-400 uppercase">
            {{ getWorkplaceOrLocation(userItem) }}
          </p>
          <h4 class="text-foreground mt-0.5 truncate text-sm leading-snug font-black">
            {{ getDisplayName(userItem) }}
          </h4>
        </div>

        <!-- Action buttons (Booking + Chat) -->
        <div class="mt-3.5 flex w-full items-center justify-end gap-2">
          <button
            @click="goToBooking(userItem.id)"
            class="border-primary text-primary hover:bg-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all hover:text-white active:scale-90"
            title="Book Appointment"
          >
            <Icon
              name="material-symbols:calendar-add-on-rounded"
              size="15"
            />
          </button>
          <button
            @click="startConversation(userItem.id)"
            :disabled="activeStartingDoctorId !== null"
            class="border-primary text-primary hover:bg-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all hover:text-white active:scale-90"
            title="Send Message"
          >
            <Icon
              name="mingcute:message-4-line"
              size="15"
              v-if="activeStartingDoctorId !== userItem.id"
            />
            <Icon
              name="mingcute:loading-line"
              size="13"
              class="animate-spin"
              v-else
            />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="bg-muted/5 border-border/50 flex flex-col items-center justify-center rounded-2xl border border-dashed py-8 text-center"
    >
      <Icon
        name="solar:users-group-two-rounded-outline"
        class="text-foreground/20 mb-2 text-3xl"
      />
      <p class="text-foreground/60 text-xs font-semibold">No results match your search</p>
    </div>
  </div>
</template>
