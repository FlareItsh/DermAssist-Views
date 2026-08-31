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
      result = list.filter(appt => 
        appt.doctor.toLowerCase().includes(query) || 
        appt.info.toLowerCase().includes(query)
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

        <div v-if="isScheduledForAction" class="w-full bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border-2 border-orange-500/30 rounded-3xl p-5 shadow-sm backdrop-blur-xs relative overflow-hidden group my-1">
          <div class="absolute -right-6 -bottom-6 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative z-10">
            <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/30">
              <Icon name="material-symbols:timer-outline" class="text-3xl" />
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-700">
                  Account Notice
                </span>
              </div>
              <h3 class="text-xl font-bold text-foreground mt-1">
                Account Scheduled for {{ scheduledAction === 'delete' ? 'Deletion' : 'Disabling' }}
              </h3>
              <p class="text-sm text-foreground/80 leading-relaxed mt-1">
                Your attending doctor has scheduled your account for 
                <strong class="text-orange-600 font-bold uppercase">{{ scheduledAction }}</strong> on 
                <strong class="text-foreground font-bold">{{ formatSchedule(scheduledAt) }}</strong>.
              </p>
              <p class="text-xs text-foreground/60 mt-2 flex items-center gap-1.5">
                <Icon name="solar:info-circle-bold" class="text-orange-500 shrink-0 text-sm" />
                Please contact your attending doctor if you have any questions regarding this schedule.
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
    <div class="mobile-only min-h-screen -mx-5 px-5">
      <!-- ─── Scrollable Body ─── -->
      <div class="flex flex-col gap-3 relative z-10">

        <!-- My Health Overview Card -->
        <h2 class="text-foreground text-lg font-bold mb-0.5 mt-4">My Health Overview</h2>
        <PatientSideComponentsMobileWeekTracker />

        <!-- Total Scans Card -->
        <div class="bg-primary rounded-3xl px-5 py-4">
          <h3 class="text-white text-base font-bold mb-3">Total scans performed</h3>
          <div class="flex items-center gap-4">
            <div class="h-14 w-14 flex items-center justify-center rounded-full bg-white/20 shadow-[inset_0_0_9px_rgba(0,0,0,0.3)]">
              <span class="text-white text-xl font-black">{{ total_scans }}</span>
            </div>
            <p class="text-white/70 text-xs leading-relaxed max-w-[160px]">Skin scans analyzed by our AI system</p>
          </div>
        </div>

        <!-- Upcoming Appointment Strip -->
        <div v-if="filteredAppointments.length > 0" class="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
          <div class="flex items-center gap-2 mb-3">
            <div class="bg-secondary h-5 w-1 shrink-0 rounded-full"></div>
            <h3 class="text-foreground text-base font-bold">Upcoming Appointments</h3>
          </div>
          <div class="flex flex-col gap-3">
            <div
              v-for="appt in filteredAppointments.slice(0, 3)"
              :key="appt.id"
              class="flex items-center gap-3 rounded-2xl bg-primary/5 p-3 border border-primary/10"
            >
              <!-- Date badge -->
              <div class="flex flex-col items-center bg-primary rounded-xl px-3 py-2 shrink-0">
                <span class="text-white text-[10px] font-bold uppercase">{{ appt.date ? months[parseInt(appt.date.split('-')[1]) - 1] : 'TBD' }}</span>
                <span class="text-white text-xl font-black leading-none">{{ appt.date ? appt.date.split('-')[2] : '--' }}</span>
              </div>
              <!-- Info -->
              <div class="flex-1 min-w-0">
                <p class="text-foreground text-sm font-bold truncate">{{ appt.doctor }}</p>
                <p class="text-foreground/50 text-xs font-semibold uppercase tracking-wide truncate">{{ appt.info }}</p>
                <p v-if="appt.time" class="text-primary text-xs font-bold mt-0.5">{{ appt.time }}</p>
              </div>
              <img
                v-if="appt.diagnosis_image"
                :src="getStorageUrl(appt.diagnosis_image)"
                class="h-10 w-10 rounded-xl object-cover shrink-0 border border-primary/20"
              />
            </div>
          </div>
        </div>

        <!-- Skin Conditions Accordion -->
        <PatientSideComponentsMobileSkinConditionAccordion />

        <!-- Scheduled Action Indicator Banner (Mobile) -->
        <div v-if="isScheduledForAction" class="w-full bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border-2 border-orange-500/30 rounded-3xl p-5 shadow-sm relative overflow-hidden my-2">
          <div class="flex items-start gap-4">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md">
              <Icon name="material-symbols:timer-outline" class="text-2xl" />
            </div>
            <div class="flex-1 min-w-0">
              <span class="inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-700 mb-1">
                Account Notice
              </span>
              <h3 class="text-base font-bold text-foreground leading-snug">
                Account Scheduled for {{ scheduledAction === 'delete' ? 'Deletion' : 'Disabling' }}
              </h3>
              <p class="text-xs text-foreground/80 mt-1 leading-relaxed">
                Scheduled for <strong class="text-orange-600 font-bold uppercase">{{ scheduledAction }}</strong> on <strong class="text-foreground font-bold">{{ formatSchedule(scheduledAt) }}</strong> by your doctor.
              </p>
            </div>
          </div>
        </div>

        <!-- Doctors Nearby -->
        <PatientSideComponentsMobileDoctorsNearby v-else />

        <!-- SaaS Promo -->
        <PatientSideComponentsSaaSPromotion class="rounded-3xl overflow-hidden mb-2" />

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
