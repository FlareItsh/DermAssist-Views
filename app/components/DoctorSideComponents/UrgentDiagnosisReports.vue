<script setup lang="ts">
  import { computed } from 'vue'

  const { getStorageUrl } = useStorage()
  const { pendingAppointments } = useAppointments()
  const { searchQuery } = useSearch()

  const resolvePatientName = (record: any): string => {
    const patientObj = record.patient || record.raw?.patient
    if (patientObj?.first_name || patientObj?.last_name) {
      return [patientObj.first_name, patientObj.last_name].filter(Boolean).join(' ')
    }
    if (record.doctor && !record.doctor.startsWith('Dr.')) {
      return record.doctor
    }
    return 'Patient Consultation'
  }

  const filteredRecords = computed(() => {
    const list = pendingAppointments.value.map(r => ({
      ...r,
      resolvedName: resolvePatientName(r)
    }))

    if (!searchQuery.value) return list
    const query = searchQuery.value.toLowerCase()
    return list.filter(
      r =>
        r.resolvedName.toLowerCase().includes(query) ||
        (r.info && r.info.toLowerCase().includes(query)) ||
        (r.purpose && r.purpose.toLowerCase().includes(query))
    )
  })

  const goToRecord = (record: any) => {
    if (record.conversation_uuid) {
      const role = useCookie('user_role').value
      const prefix = role === 'secretary' ? '/secretary' : '/doctor'
      navigateTo(`${prefix}/messages/${record.conversation_uuid}`)
    } else {
      navigateTo('/doctor/appointments')
    }
  }
</script>

<template>
  <div class="flex flex-col">
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="bg-secondary h-8 w-1 shrink-0 rounded-full"></div>
        <h2 class="text-foreground text-xl font-bold">Urgent Patients Diagnosis Reports</h2>
        <span
          v-if="filteredRecords.length > 0"
          class="bg-destructive/10 text-destructive inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold"
        >
          {{ filteredRecords.length }}
        </span>
      </div>
      <NuxtLink
        to="/doctor/appointments"
        class="text-secondary text-sm font-semibold transition hover:underline"
      >
        Manage ›
      </NuxtLink>
    </div>

    <!-- Scrollable Folder Stack -->
    <div
      class="custom-scrollbar flex max-h-[420px] min-h-[260px] flex-1 flex-col overflow-y-auto pr-2 pb-8"
    >
      <div
        v-for="(record, index) in filteredRecords"
        :key="record.id"
        class="relative flex flex-col transition-all duration-300"
        :style="{ marginTop: index > 0 ? '-170px' : '0', zIndex: index + 1 }"
      >
        <AppRecordFolder
          :time="record.info || 'Skin Condition Assessment'"
          :title="record.resolvedName"
          is-urgent
          @click="goToRecord(record)"
          class="cursor-pointer"
        >
          <template #image>
            <NuxtImg
              v-if="record.diagnosis_image"
              :src="getStorageUrl(record.diagnosis_image)"
              class="h-10 w-10 shrink-0 rounded-lg border border-white/20 object-cover"
              loading="lazy"
            />
            <div
              v-else
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white"
            >
              <Icon
                name="lucide:file-text"
                class="text-lg"
              />
            </div>
          </template>
        </AppRecordFolder>
      </div>

      <!-- Empty state inside scroll area -->
      <div
        v-if="filteredRecords.length === 0"
        class="text-muted-foreground mt-2 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-10 text-center text-sm"
      >
        <Icon
          name="solar:folder-check-bold"
          class="text-primary mx-auto mb-2 text-4xl opacity-25"
        />
        <p class="text-foreground font-semibold">No urgent diagnosis reports</p>
        <p class="text-muted-foreground mt-0.5 text-xs">
          All pending triage cases have been attended to.
        </p>
      </div>
    </div>
  </div>
</template>
