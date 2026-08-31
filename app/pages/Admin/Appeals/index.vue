<script setup lang="ts">
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const { sortedAppeals, isLoadingAppeals, appealsError, fetchAppeals, markAppealsSeen, filterStatus, resolveAppeal: originalResolve, restoreAppeal: originalRestore } =
    useAdminAppeals()

  const resolveAppeal = (uuid: string) => {
    originalResolve(uuid)
    toast.success('Appeal resolved successfully.')
  }

  const restoreAppeal = (uuid: string) => {
    originalRestore(uuid)
    toast.info('Appeal restored to pending status.')
  }

  const getDoctorName = (appeal: any) => {
    const first = appeal.user?.first_name?.trim()
    const last = appeal.user?.last_name?.trim()
    return [first, last].filter(Boolean).join(' ') || 'Unknown doctor'
  }

  const getInitials = (appeal: any) => {
    const first = appeal.user?.first_name?.[0]
    const last = appeal.user?.last_name?.[0]
    return `${first || 'D'}${last || 'R'}`.toUpperCase()
  }

  const getContactDetails = (appeal: any) => {
    return appeal.user?.email || appeal.user?.affiliation || 'No contact details'
  }

  const formatDate = (date?: string) => {
    if (!date) return 'Recently'
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(date))
  }

  onMounted(async () => {
    await fetchAppeals()
    markAppealsSeen()
  })
</script>

<template>
  <div class="">
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-bold tracking-wider text-rose-500 uppercase">Moderation</p>
        <h1 class="mt-2 text-3xl font-black text-gray-950">Doctor Scan Appeals</h1>
        <p class="mt-2 max-w-2xl text-sm text-gray-500">
          Review doctors who filed appeals for scans they believe produced an incorrect diagnosis.
        </p>
      </div>
    </div>

    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div class="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-black text-gray-950">Filed Appeals</h2>
          <p class="mt-1 text-sm text-gray-500">Newest appeals appear first.</p>
        </div>
        <div class="flex gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
          <button 
            @click="filterStatus = 'pending'"
            :class="filterStatus === 'pending' ? 'bg-white shadow-sm text-gray-950 font-bold' : 'text-gray-500 hover:text-gray-700'"
            class="px-4 py-2 text-sm rounded-lg transition-all"
          >
            Pending
          </button>
          <button 
            @click="filterStatus = 'resolved'"
            :class="filterStatus === 'resolved' ? 'bg-white shadow-sm text-gray-950 font-bold' : 'text-gray-500 hover:text-gray-700'"
            class="px-4 py-2 text-sm rounded-lg transition-all"
          >
            Resolved
          </button>
        </div>
      </div>

      <div
        v-if="isLoadingAppeals"
        class="space-y-3 p-5"
      >
        <div
          v-for="i in 6"
          :key="i"
          class="h-28 animate-pulse rounded-xl bg-gray-100"
        />
      </div>

      <div
        v-else-if="appealsError"
        class="px-5 py-10 text-center"
      >
        <Icon
          name="lucide:circle-alert"
          class="mx-auto mb-3 text-4xl text-rose-500"
        />
        <p class="font-semibold text-gray-900">{{ appealsError }}</p>
      </div>

      <div
        v-else-if="sortedAppeals.length"
        class="divide-y divide-gray-100"
      >
        <article
          v-for="appeal in sortedAppeals"
          :key="appeal.uuid"
          class="grid gap-4 px-5 py-5 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)]"
        >
          <div
            class="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 font-black text-rose-700"
          >
            {{ getInitials(appeal) }}
          </div>

          <div class="min-w-0">
            <h3 class="truncate text-base font-black text-gray-950">
              Dr. {{ getDoctorName(appeal) }}
            </h3>
            <p class="mt-1 truncate text-sm text-gray-500">{{ getContactDetails(appeal) }}</p>
            <p class="mt-2 text-xs font-semibold text-gray-400">
              {{ formatDate(appeal.created_at || appeal.updated_at) }}
            </p>
          </div>

          <div class="min-w-0 rounded-xl border border-gray-100 bg-gray-50 p-4 flex flex-col justify-between gap-3">
            <div>
              <div class="flex flex-wrap gap-2 text-sm">
                <AppBadge
                  color="danger"
                  size="xs"
                  >{{ appeal.diagnosis_label || 'Scanner result' }}</AppBadge
                >
                <Icon
                  name="lucide:arrow-right"
                  class="self-center text-gray-400"
                />
                <AppBadge
                  color="success"
                  size="xs"
                  >{{ appeal.suggested_label || 'Doctor suggestion' }}</AppBadge
                >
              </div>
              <p class="mt-3 text-sm leading-6 text-gray-600">
                {{ appeal.description || 'No appeal reason was provided.' }}
              </p>
            </div>
            
            <div class="flex justify-end border-t border-gray-200/50 pt-3 mt-1">
              <AppButton
                v-if="filterStatus === 'pending'"
                variant="outline"
                size="sm"
                @click="resolveAppeal(appeal.uuid)"
                class="hover:text-green-600 hover:border-green-300"
              >
                <Icon name="lucide:check-circle-2" size="14" class="mr-1.5" />
                Resolve Appeal
              </AppButton>
              <AppButton
                v-else
                variant="outline"
                size="sm"
                @click="restoreAppeal(appeal.uuid)"
                class="hover:text-amber-600 hover:border-amber-300"
              >
                <Icon name="lucide:rotate-ccw" size="14" class="mr-1.5" />
                Restore to Pending
              </AppButton>
            </div>
          </div>
        </article>
      </div>

      <div
        v-else
        class="px-5 py-14 text-center"
      >
        <div
          class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"
        >
          <Icon
            :name="filterStatus === 'pending' ? 'lucide:alert-circle' : 'lucide:check-circle-2'"
            class="text-3xl"
          />
        </div>
        <p class="text-sm font-semibold text-gray-500">
          {{ filterStatus === 'pending' ? 'No pending doctor scan appeals found.' : 'No resolved appeals yet.' }}
        </p>
      </div>
    </section>
  </div>
</template>
