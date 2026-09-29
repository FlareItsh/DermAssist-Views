<script setup lang="ts">
  import { computed } from 'vue'
  import { userService } from '~/api/user/UserService'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })
  const { searchQuery } = useSearch()
  const { appointments } = useAppointments()
  const { getStorageUrl } = useStorage()

  const { data: response } = userService.useShow(useCookie('user_uuid').value as string, {
    key: `userProfile-${useCookie('user_uuid').value}`
  })

  const total_scans = computed(() => response.value?.total_scans ?? 0)

  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC'
  ]

  const { selectedDate } = useAppointments()

  const filteredAppointments = computed(() => {
    let list = appointments.value

    // If selectedDate filter is set, filter by that date
    if (selectedDate.value) {
      list = list.filter(appt => appt.date === selectedDate.value)
    }

    const query = searchQuery.value.trim().toLowerCase()
    if (!query) {
      return [...list].sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : Infinity
        const timeB = b.date ? new Date(b.date).getTime() : Infinity
        return timeA - timeB
      })
    }

    let result = list
    if (/^\d+$/.test(query)) {
      result = list.filter(appt => appt.date.toLowerCase().includes(query))
    } else {
      result = list.filter(
        appt => appt.doctor.toLowerCase().includes(query) || appt.info.toLowerCase().includes(query)
      )
    }

    return [...result].sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : Infinity
      const timeB = b.date ? new Date(b.date).getTime() : Infinity
      return timeA - timeB
    })
  })

  const isScheduledForAction = computed(() => !!response.value?.account_action)
  const scheduledAction = computed(() => response.value?.account_action)
  const scheduledAt = computed(() => response.value?.account_action_scheduled_at)

  const formatSchedule = (dateString?: string) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }
</script>

<template>
  <div>
    <!-- ═══════════════════════════════════════════════
         DESKTOP LAYOUT (unchanged, hidden on mobile)
         ═══════════════════════════════════════════════ -->
    <div class="desktop-only flex gap-5 overflow-hidden">
      <div class="flex min-w-0 flex-1 flex-col gap-4">
        <div class="flex gap-5">
          <PatientSideComponentsPatientCard
            title="Total Scans Performed"
            class="w-100 shrink-0"
          >
            <p
              class="bg-card flex h-15 w-15 items-center justify-center rounded-full text-center text-xl font-medium shadow-[inset_0_0_9px_rgba(0,0,0,0.4),0_0_10px_rgba(0,0,0,0.5)]"
            >
              {{ total_scans }}
            </p>
          </PatientSideComponentsPatientCard>

          <PatientSideComponentsPatientCard
            title="Appointments"
            class=""
          >
            <div
              class="custom-scrollbar bg-card flex h-20 w-[446px] items-center gap-6 overflow-x-auto rounded-2xl px-6 font-medium shadow-[inset_0_0_9px_rgba(0,0,0,0.4),0_0_10px_rgba(0,0,0,0.5)]"
            >
              <div
                v-if="filteredAppointments.length > 0"
                class="flex shrink-0 items-center gap-8"
              >
                <div
                  v-for="appt in filteredAppointments"
                  :key="appt.id"
                  class="flex shrink-0 items-center gap-4 border-r border-white/10 pr-8 last:border-0 last:pr-0"
                >
                  <div class="flex flex-col items-center leading-none">
                    <span class="text-primary text-[10px] font-bold tracking-tighter uppercase">{{
                      appt.date ? months[parseInt(appt.date.split('-')[1]) - 1] : 'TBD'
                    }}</span>
                    <span class="text-foreground text-xl font-black">{{
                      appt.date ? appt.date.split('-')[2] : '--'
                    }}</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <img
                      v-if="appt.diagnosis_image"
                      :src="getStorageUrl(appt.diagnosis_image)"
                      class="h-10 w-10 rounded-lg border border-white/10 object-cover"
                    />
                    <div class="flex flex-col">
                      <span class="text-foreground text-sm leading-tight font-bold">{{
                        appt.doctor
                      }}</span>
                      <span
                        class="text-foreground/40 text-[10px] leading-none font-black tracking-widest uppercase"
                        >{{ appt.info }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="text-foreground/20 flex items-center gap-2 text-sm italic"
              >
                <Icon
                  name="solar:calendar-search-linear"
                  class="text-xl"
                />
                <span>No matching appointments...</span>
              </div>
            </div>
          </PatientSideComponentsPatientCard>
        </div>
        <div class="mt-2 flex items-center gap-3">
          <div class="bg-secondary h-8 w-1 shrink-0 rounded-full"></div>
          <h1 class="text-foreground text-2xl font-bold">Skin Conditions Information</h1>
        </div>
        <div class="flex gap-5">
          <PatientSideComponentsSkinConditionsInfo
            title="Acne"
            icon="/images/acne-icon.png"
          >
            <p class="bg-card max-w-md text-xl leading-relaxed text-gray-700 opacity-90">
              Common skin condition involving clogged pores, inflammation, and pimples. Common in
              adolescence.
            </p>
          </PatientSideComponentsSkinConditionsInfo>
          <PatientSideComponentsSkinConditionsInfo
            title="Eczema"
            icon="/images/eczema-icon.png"
          >
            <p class="bg-card max-w-md text-xl leading-relaxed text-gray-700 opacity-90">
              Inflammatory condition causing dry, itchy skin, often linked to genetics and immune
              triggers.
            </p>
          </PatientSideComponentsSkinConditionsInfo>
          <PatientSideComponentsSkinConditionsInfo
            title="HSV"
            icon="/images/hsv-icon.png"
          >
            <p class="bg-card max-w-md text-xl leading-relaxed text-gray-700 opacity-90">
              Viral infection causing cold sores (type 1) or genital sores (type 2). Periods of
              dormancy.
            </p>
          </PatientSideComponentsSkinConditionsInfo>
        </div>

        <div
          v-if="isScheduledForAction"
          class="group relative my-1 w-full overflow-hidden rounded-3xl border-2 border-orange-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 p-5 shadow-sm backdrop-blur-xs"
        >
          <div
            class="pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-orange-500/10 blur-2xl"
          ></div>
          <div class="relative z-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div
              class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/30"
            >
              <Icon
                name="material-symbols:timer-outline"
                class="text-3xl"
              />
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span
                  class="inline-block rounded-md bg-orange-500/20 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-orange-700 uppercase"
                >
                  Account Notice
                </span>
              </div>
              <h3 class="text-foreground mt-1 text-xl font-bold">
                Account Scheduled for {{ scheduledAction === 'delete' ? 'Deletion' : 'Disabling' }}
              </h3>
              <p class="text-foreground/80 mt-1 text-sm leading-relaxed">
                Your attending doctor has scheduled your account for
                <strong class="font-bold text-orange-600 uppercase">{{ scheduledAction }}</strong>
                on
                <strong class="text-foreground font-bold">{{ formatSchedule(scheduledAt) }}</strong
                >.
              </p>
              <p class="text-foreground/60 mt-2 flex items-center gap-1.5 text-xs">
                <Icon
                  name="solar:info-circle-bold"
                  class="shrink-0 text-sm text-orange-500"
                />
                Please contact your attending doctor if you have any questions regarding this
                schedule.
              </p>
            </div>
          </div>
        </div>

        <AppUsers
          v-else
          title="Doctors"
          role="doctor"
          status="verified"
        />
      </div>
      <!-- TODO: CALENDAR -->
      <div class="sticky top-0 flex h-[calc(91vh-3rem)] flex-col gap-4">
        <PatientSideComponentsCalendar />
        <PatientSideComponentsSaaSPromotion class="flex-1" />
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════
         MOBILE LAYOUT (only on phones/tablets)
         ═══════════════════════════════════════════════ -->
    <div class="mobile-only -mx-5 min-h-screen px-5">
      <!-- ─── Scrollable Body ─── -->
      <div class="relative z-10 flex flex-col gap-3">
        <!-- My Health Overview Card -->
        <h2 class="text-foreground mt-4 mb-0.5 text-lg font-bold">My Health Overview</h2>
        <PatientSideComponentsMobileWeekTracker />

        <!-- Total Scans Card -->
        <div class="bg-primary rounded-3xl px-5 py-4">
          <h3 class="mb-3 text-base font-bold text-white">Total scans performed</h3>
          <div class="flex items-center gap-4">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 shadow-[inset_0_0_9px_rgba(0,0,0,0.3)]"
            >
              <span class="text-xl font-black text-white">{{ total_scans }}</span>
            </div>
            <p class="max-w-[160px] text-xs leading-relaxed text-white/70">
              Skin scans analyzed by our AI system
            </p>
          </div>
        </div>

        <!-- Upcoming Appointment Strip -->
        <div
          v-if="filteredAppointments.length > 0"
          class="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div class="mb-3 flex items-center gap-2">
            <div class="bg-secondary h-5 w-1 shrink-0 rounded-full"></div>
            <h3 class="text-foreground text-base font-bold">Upcoming Appointments</h3>
          </div>
          <div class="flex flex-col gap-3">
            <div
              v-for="appt in filteredAppointments.slice(0, 3)"
              :key="appt.id"
              class="bg-primary/5 border-primary/10 flex items-center gap-3 rounded-2xl border p-3"
            >
              <!-- Date badge -->
              <div class="bg-primary flex shrink-0 flex-col items-center rounded-xl px-3 py-2">
                <span class="text-[10px] font-bold text-white uppercase">{{
                  appt.date ? months[parseInt(appt.date.split('-')[1]) - 1] : 'TBD'
                }}</span>
                <span class="text-xl leading-none font-black text-white">{{
                  appt.date ? appt.date.split('-')[2] : '--'
                }}</span>
              </div>
              <!-- Info -->
              <div class="min-w-0 flex-1">
                <p class="text-foreground truncate text-sm font-bold">{{ appt.doctor }}</p>
                <p
                  class="text-foreground/50 truncate text-xs font-semibold tracking-wide uppercase"
                >
                  {{ appt.info }}
                </p>
                <p
                  v-if="appt.time"
                  class="text-primary mt-0.5 text-xs font-bold"
                >
                  {{ appt.time }}
                </p>
              </div>
              <img
                v-if="appt.diagnosis_image"
                :src="getStorageUrl(appt.diagnosis_image)"
                class="border-primary/20 h-10 w-10 shrink-0 rounded-xl border object-cover"
              />
            </div>
          </div>
        </div>

        <!-- Skin Conditions Accordion -->
        <PatientSideComponentsMobileSkinConditionAccordion />

        <!-- Scheduled Action Indicator Banner (Mobile) -->
        <div
          v-if="isScheduledForAction"
          class="relative my-2 w-full overflow-hidden rounded-3xl border-2 border-orange-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 p-5 shadow-sm"
        >
          <div class="flex items-start gap-4">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md"
            >
              <Icon
                name="material-symbols:timer-outline"
                class="text-2xl"
              />
            </div>
            <div class="min-w-0 flex-1">
              <span
                class="mb-1 inline-block rounded-md bg-orange-500/20 px-2 py-0.5 text-[9px] font-black tracking-wider text-orange-700 uppercase"
              >
                Account Notice
              </span>
              <h3 class="text-foreground text-base leading-snug font-bold">
                Account Scheduled for {{ scheduledAction === 'delete' ? 'Deletion' : 'Disabling' }}
              </h3>
              <p class="text-foreground/80 mt-1 text-xs leading-relaxed">
                Scheduled for
                <strong class="font-bold text-orange-600 uppercase">{{ scheduledAction }}</strong>
                on
                <strong class="text-foreground font-bold">{{ formatSchedule(scheduledAt) }}</strong>
                by your doctor.
              </p>
            </div>
          </div>
        </div>

        <!-- Doctors Nearby -->
        <PatientSideComponentsMobileDoctorsNearby v-else />

        <!-- SaaS Promo -->
        <PatientSideComponentsSaaSPromotion class="mb-2 overflow-hidden rounded-3xl" />
      </div>
    </div>
  </div>
</template>

<style scoped>
  @media (min-width: 768px) {
    .mobile-only {
      display: none !important;
    }
  }
  @media (max-width: 767px) {
    .desktop-only {
      display: none !important;
    }
  }
</style>
