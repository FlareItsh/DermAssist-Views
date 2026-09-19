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

  onMounted(() => {
    if (!appointments.value.length) {
      fetchAppointments()
    }
  })
</script>

<template>
  <div class="flex min-h-0 w-full flex-1 flex-col gap-5 pb-6">
    <!-- Top: 14-Day Appointment Schedule -->
    <DoctorSideComponentsAppointmentSchedule />

    <!-- Clinical KPI Summary Bar -->
    <div class="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
      <!-- KPI 1: Today's Appointments -->
      <div
        @click="setTodayFilter"
        class="group bg-card hover:border-primary/40 relative flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl border border-gray-100 p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
      >
        <div class="flex flex-col">
          <span class="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            Today's Visits
          </span>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="text-foreground text-2xl font-black">
              {{ todayAppointments.length }}
            </span>
            <span class="text-muted-foreground text-[11px] font-medium">scheduled</span>
          </div>
        </div>
        <div
          class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
        >
          <Icon
            name="solar:calendar-date-bold"
            class="text-xl"
          />
        </div>
      </div>

      <!-- KPI 2: Priority Triage Cases -->
      <NuxtLink
        to="/doctor/patients"
        class="group bg-card relative flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl border border-gray-100 p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/40 hover:shadow-sm"
      >
        <div class="flex flex-col">
          <span class="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            Priority Triage
          </span>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="text-2xl font-black text-amber-600">
              {{ priorityCount }}
            </span>
            <span class="text-muted-foreground text-[11px] font-medium">flagged</span>
          </div>
        </div>
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 transition-transform duration-300 group-hover:scale-110"
        >
          <Icon
            name="solar:star-bold"
            class="text-xl"
          />
        </div>
      </NuxtLink>

      <!-- KPI 3: Urgent Diagnosis Scans -->
      <div
        @click="activeWorkspaceView = 'all'"
        class="group bg-card hover:border-destructive/40 relative flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl border border-gray-100 p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
      >
        <div class="flex flex-col">
          <span class="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            Urgent Scans
          </span>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="text-destructive text-2xl font-black">
              {{ pendingScansCount }}
            </span>
            <span class="text-muted-foreground text-[11px] font-medium">pending review</span>
          </div>
        </div>
        <div
          class="bg-destructive/10 text-destructive flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
        >
          <Icon
            name="solar:shield-warning-bold"
            class="text-xl"
          />
        </div>
      </div>

      <!-- KPI 4: Active Directory -->
      <NuxtLink
        to="/doctor/patients"
        class="group bg-card hover:border-secondary/40 relative flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl border border-gray-100 p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
      >
        <div class="flex flex-col">
          <span class="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            Directory
          </span>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="text-foreground text-2xl font-black">
              {{ uniquePatientsCount }}
            </span>
            <span class="text-muted-foreground text-[11px] font-medium">active patients</span>
          </div>
        </div>
        <div
          class="bg-secondary/10 text-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
        >
          <Icon
            name="solar:users-group-rounded-bold"
            class="text-xl"
          />
        </div>
      </NuxtLink>
    </div>

    <!-- Main Content Area -->
    <div class="flex min-w-0 flex-1 flex-col gap-5 lg:flex-row">
      <!-- Left Column: Primary Clinical Workspace -->
      <div class="flex min-w-0 flex-1 flex-col gap-5">
        <!-- Workspace Filter Tabs & Status Bar -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div
            class="bg-card flex items-center rounded-2xl border border-gray-200/80 p-1 shadow-2xs"
          >
            <button
              type="button"
              @click="activeWorkspaceView = 'all'"
              :class="[
                'rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-150',
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
                'rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-150',
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
                'rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-150',
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
      <div class="flex w-full flex-col gap-4 lg:w-[380px] lg:shrink-0">
        <!-- Subscription Upgrade Ad (auto-hides on Best Plan) -->
        <DoctorSideComponentsSubscriptionAd />

        <!-- Priority List (synchronized with /doctor/patients) -->
        <DoctorSideComponentsPriorityList />

        <!-- Quick Practice Actions & Clinic Status Card -->
        <div class="bg-card flex flex-col gap-3 rounded-3xl border border-gray-100 p-5 shadow-xs">
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
            class="border-border/60 hover:border-primary/30 flex items-center justify-between rounded-xl border p-2.5 transition hover:bg-gray-50"
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
