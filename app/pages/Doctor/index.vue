<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const { appointments, todayAppointments, pendingAppointments, selectedDate, fetchAppointments } =
    useAppointments()
  const { priorityIds } = usePriorityList()

  // Workspace view filter on the left column: 'all' | 'appointments' | 'patients'
  const activeWorkspaceView = ref<'all' | 'appointments' | 'patients'>('all')

  const uniquePatientsCount = computed(() => {
    const set = new Set<string>()
    for (const a of appointments.value) {
      const pUuid = a.patient_uuid || a.patient?.uuid
      const pId = a.patient_id || a.patient?.id
      const key = pUuid || (pId ? String(pId) : a.id)
      if (key) set.add(key)
    }
    return set.size
  })

  const priorityCount = computed(() => priorityIds.value.length)
  const pendingScansCount = computed(() => pendingAppointments.value.length)

  const clearDateFilter = () => {
    selectedDate.value = null
  }

  const setTodayFilter = () => {
    const today = new Date().toISOString().split('T')[0]
    selectedDate.value = today
    activeWorkspaceView.value = 'appointments'
  }

  const handleShowAllWorkspace = () => {
    activeWorkspaceView.value = 'all'
  }

  onMounted(() => {
    if (!appointments.value.length) {
      fetchAppointments()
    }
  })
</script>

<template>
  <div class="flex min-h-0 w-full flex-1 flex-col gap-4 pb-2 sm:gap-5 lg:pb-6">
    <h2 class="text-foreground order-0 -mb-3 text-lg font-bold lg:hidden">Dashboard</h2>
    <DoctorSideComponentsAppointmentSchedule />

    <!-- Clinical KPI Summary Bar -->
    <div class="grid grid-cols-2 gap-3 sm:gap-3.5 md:grid-cols-4">
      <!-- KPI 1: Today's Appointments -->
      <DoctorSideComponentsMetricCard
        label="Today's Visits"
        :value="todayAppointments.length"
        :detail="
          todayAppointments.length === 1
            ? '1 visit scheduled'
            : `${todayAppointments.length} visits scheduled`
        "
        :badge="todayAppointments.length > 0 ? 'Active' : 'Today'"
        :badge-tone="todayAppointments.length > 0 ? 'primary' : 'neutral'"
        clickable
        @click="setTodayFilter"
      />

      <!-- KPI 2: Priority Triage Cases -->
      <DoctorSideComponentsMetricCard
        label="Priority Triage"
        :value="priorityCount"
        :detail="priorityCount === 1 ? '1 patient flagged' : `${priorityCount} patients flagged`"
        :badge="priorityCount > 0 ? 'High Focus' : 'Normal'"
        :badge-tone="priorityCount > 0 ? 'amber' : 'neutral'"
        :value-tone="priorityCount > 0 ? 'amber' : 'default'"
        to="/doctor/patients"
      />

      <!-- KPI 3: Urgent Diagnosis Scans -->
      <DoctorSideComponentsMetricCard
        label="Urgent Scans"
        :value="pendingScansCount"
        :detail="
          pendingScansCount === 1
            ? '1 scan pending review'
            : `${pendingScansCount} scans pending review`
        "
        :badge="pendingScansCount > 0 ? 'Action Req.' : 'All Clear'"
        :badge-tone="pendingScansCount > 0 ? 'rose' : 'emerald'"
        :value-tone="pendingScansCount > 0 ? 'rose' : 'default'"
        clickable
        @click="handleShowAllWorkspace"
      />

      <!-- KPI 4: Active Directory -->
      <DoctorSideComponentsMetricCard
        label="Directory"
        :value="uniquePatientsCount"
        :detail="
          uniquePatientsCount === 1 ? '1 active patient' : `${uniquePatientsCount} active patients`
        "
        badge="Total"
        badge-tone="neutral"
        to="/doctor/patients"
      />
    </div>

    <!-- Main Content Area -->
    <div class="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5 lg:flex-row lg:items-start">
      <!-- Left Column: Primary Clinical Workspace -->
      <div class="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5">
        <!-- Workspace Filter Tabs & Status Bar -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div
            class="bg-card flex w-full items-center rounded-2xl border border-gray-200/80 p-1 shadow-2xs sm:w-auto"
          >
            <button
              type="button"
              @click="activeWorkspaceView = 'all'"
              :class="[
                'flex-1 rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all duration-150 sm:flex-none sm:px-3.5',
                activeWorkspaceView === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              All Views
            </button>
            <button
              type="button"
              @click="activeWorkspaceView = 'appointments'"
              :class="[
                'flex-1 rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all duration-150 sm:flex-none sm:px-3.5',
                activeWorkspaceView === 'appointments'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              Appointments ({{ appointments.length }})
            </button>
            <button
              type="button"
              @click="activeWorkspaceView = 'patients'"
              :class="[
                'flex-1 rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all duration-150 sm:flex-none sm:px-3.5',
                activeWorkspaceView === 'patients'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              Patients ({{ uniquePatientsCount }})
            </button>
          </div>

          <!-- Date Filter Banner if Active -->
          <div
            v-if="selectedDate"
            class="bg-secondary/10 text-secondary border-secondary/25 inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold"
          >
            <span
              >Viewing date: <strong class="text-foreground">{{ selectedDate }}</strong></span
            >
            <button
              type="button"
              @click="clearDateFilter"
              class="hover:text-destructive flex items-center font-bold underline transition"
            >
              Clear filter
            </button>
          </div>
        </div>

        <!-- Appointments List -->
        <DoctorSideComponentsAppointmentsList
          v-if="activeWorkspaceView === 'all' || activeWorkspaceView === 'appointments'"
        />

        <!-- Patients List -->
        <DoctorSideComponentsPatientsList
          v-if="activeWorkspaceView === 'all' || activeWorkspaceView === 'patients'"
        />

        <!-- Urgent Diagnosis Reports -->
        <DoctorSideComponentsUrgentDiagnosisReports />
      </div>

      <!-- Right Column: Upgrade Ad, Priority List, and Quick Practice Actions -->
      <!-- Tablet: 2-col grid (ad spans the row) to avoid empty side space; Desktop: fixed sidebar column -->
      <div
        class="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:flex lg:w-[380px] lg:shrink-0 lg:flex-col"
      >
        <!-- Subscription Upgrade Ad (auto-hides on Best Plan) -->
        <DoctorSideComponentsSubscriptionAd class="md:col-span-2" />

        <!-- Priority List (synchronized with /doctor/patients) -->
        <DoctorSideComponentsPriorityList />

        <!-- Quick Practice Actions & Clinic Status Card -->
        <div
          class="bg-card flex shrink-0 flex-col gap-3 rounded-3xl border border-gray-100 p-5 shadow-xs"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="bg-secondary h-6 w-1 shrink-0 rounded-full" />
              <h3 class="text-foreground text-sm font-bold tracking-tight">
                Quick Clinical Actions
              </h3>
            </div>
            <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Practice Active
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <NuxtLink
              to="/doctor/patients?action=register"
              class="group hover:border-primary/40 flex flex-col gap-1 rounded-2xl border border-gray-100 bg-gray-50/60 p-3 transition hover:bg-white hover:shadow-xs"
            >
              <div
                class="text-primary bg-primary/10 flex h-8 w-8 items-center justify-center rounded-xl"
              >
                <Icon
                  name="solar:user-plus-bold"
                  class="text-base"
                />
              </div>
              <span class="text-foreground text-xs font-bold">Register Patient</span>
              <span class="text-muted-foreground text-[10px]">Create clinic profile</span>
            </NuxtLink>

            <NuxtLink
              to="/doctor/messages"
              class="group hover:border-primary/40 flex flex-col gap-1 rounded-2xl border border-gray-100 bg-gray-50/60 p-3 transition hover:bg-white hover:shadow-xs"
            >
              <div
                class="text-secondary bg-secondary/10 flex h-8 w-8 items-center justify-center rounded-xl"
              >
                <Icon
                  name="solar:chat-round-dots-bold"
                  class="text-base"
                />
              </div>
              <span class="text-foreground text-xs font-bold">Consultations</span>
              <span class="text-muted-foreground text-[10px]">Patient messages</span>
            </NuxtLink>
          </div>

          <NuxtLink
            to="/doctor/appointments"
            class="border-border/60 hover:border-primary/30 mt-auto flex items-center justify-between rounded-xl border p-2.5 transition hover:bg-gray-50"
          >
            <div class="flex items-center gap-2">
              <Icon
                name="solar:clock-circle-bold"
                class="text-primary text-sm"
              />
              <span class="text-foreground text-xs font-semibold">Manage Clinic Schedule</span>
            </div>
            <Icon
              name="lucide:chevron-right"
              class="text-muted-foreground text-xs"
            />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
