<template>
  <div class="flex h-[100dvh] h-screen flex-col overflow-hidden">
    <!-- Global Daily Medication Reminder Banner (Patient Only, Fixed Top Overlay) -->
    <PatientSideComponentsMedicationReminderBanner v-if="userRole === 'patient'" />

    <!-- Desktop Navbar (hidden on mobile; doctors also hide it on tablet) -->
    <div :class="desktopChromeClass">
      <AppNavbar
        :title="currentPageTitle"
        :description="currentPageDescription"
        :breadcrumbs="breadcrumbs"
      >
        <AppUtilityBar v-if="userRole !== 'admin'" />
      </AppNavbar>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <!-- Desktop Sidebar (hidden on mobile; doctors also hide it on tablet) -->
      <div :class="desktopChromeClass">
        <AppSidebar :items="navItems" />
      </div>

      <main
        class="flex-1"
        :class="
          isDoctorRole
            ? doctorMainClass
            : [
                isFullHeightPage
                  ? 'h-full overflow-hidden bg-transparent pb-0'
                  : 'overflow-y-auto pb-24 md:pb-5',
                userRole === 'patient'
                  ? isFullHeightPage
                    ? isChatThread
                      ? 'mt-0 h-full pt-0 md:-mt-4 md:p-5 md:pt-5'
                      : 'mt-0 h-full pt-0 md:-mt-4 md:p-5 md:pt-5'
                    : 'mt-0 pt-0 md:-mt-4 md:p-5 md:pt-5'
                  : userRole === 'admin'
                    ? 'mt-0 md:-mt-4 md:p-5'
                    : isChatPage || isFullHeightPage
                      ? 'mt-0 h-full p-0 md:-mt-4 md:p-5'
                      : '-mt-4 p-5'
              ]
        "
        id="main-content"
      >
        <!-- Mobile Header (only on mobile viewports for patients, except in active chat threads) -->
        <div
          class="relative z-50 block md:hidden"
          v-if="userRole === 'patient' && !isChatThread"
        >
          <PatientSideComponentsMobileHeroHeader />
        </div>
        <!-- Doctor Mobile/Tablet Header (below lg, except in active chat threads) -->
        <DoctorSideComponentsMobileHeader v-if="showDoctorMobileChrome" />
        <!-- Admin Mobile Header (only on mobile viewports for admins) -->
        <AdminSideComponentsMobileHeader
          v-if="userRole === 'admin'"
          :title="currentPageTitle"
        />
        <div
          class="mx-auto"
          :class="
            isDoctorRole
              ? doctorContentClass
              : [
                  userRole === 'patient'
                    ? isChatPage
                      ? 'px-0 md:p-0'
                      : 'px-5 md:p-0'
                    : userRole === 'admin'
                      ? 'px-4 pt-4 md:p-0'
                      : '',
                  isFullHeightPage || isChatPage ? 'h-full min-h-0' : 'min-h-0'
                ]
          "
        >
          <slot />
        </div>
      </main>
    </div>

    <!-- Unified Dynamic Mobile Bottom Navigation (for all roles) -->
    <AppMobileBottomNav
      v-if="!isChatThread"
      :items="navItems"
      :role="userRole"
    />

    <!-- Mandatory Terms & Conditions Gate for New / Doctor-Created / OAuth Accounts -->
    <AppModalTermsModal
      :model-value="needsTermsAcceptance"
      :mandatory="true"
      :is-submitting="isAcceptingTerms"
      :user-role="String(userRole || authUser?.role?.slug || authUser?.role || '').toLowerCase()"
      :initial-consent-dataset="Boolean(authUser?.consent_dataset)"
      @accept="handleAcceptMandatoryTerms"
      @decline="handleDeclineMandatoryTerms"
    />
  </div>
</template>

<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import { authService } from '~/api/auth/AuthService'
  import { $api } from '~/composables/useApi'

  const route = useRoute()
  const userRole = useCookie('user_role', { path: '/' })
  const authToken = useCookie('auth_token', { path: '/' })
  const authUser = useState<any>('auth_user', () => null)

  const isHydrated = ref(false)
  const isAcceptingTerms = ref(false)
  const hasPendingTermsReminder = ref(false)

  const syncPendingTermsReminder = () => {
    if (!import.meta.client) return
    const uuid = authUser.value?.uuid || useCookie('user_uuid', { path: '/' }).value
    hasPendingTermsReminder.value = Boolean(
      uuid && localStorage.getItem(`da_pending_terms_reminder_${uuid}`) === '1'
    )
  }

  watch(
    () => authUser.value?.uuid,
    () => {
      syncPendingTermsReminder()
    }
  )

  const needsTermsAcceptance = computed(() => {
    return Boolean(
      isHydrated.value &&
      authToken.value &&
      authUser.value &&
      (!authUser.value.terms_accepted_at || hasPendingTermsReminder.value)
    )
  })

  const handleAcceptMandatoryTerms = async (payload?: { consent_dataset: boolean }) => {
    if (isAcceptingTerms.value) return
    isAcceptingTerms.value = true
    try {
      const requestBody: { consent_dataset?: boolean } = {}
      const effectiveRole = String(
        userRole.value || authUser.value?.role?.slug || authUser.value?.role || ''
      ).toLowerCase()
      if (effectiveRole === 'patient' && payload) {
        requestBody.consent_dataset = Boolean(payload.consent_dataset)
      }

      const res: any = await authService.acceptTerms(requestBody)
      const updatedUser = res?.user?.data || res?.user || res?.data || null
      if (updatedUser) {
        authUser.value = updatedUser
      } else if (authUser.value) {
        authUser.value = {
          ...authUser.value,
          terms_accepted_at: new Date().toISOString(),
          ...(requestBody.consent_dataset !== undefined
            ? { consent_dataset: requestBody.consent_dataset }
            : {})
        }
      }
      if (import.meta.client) {
        const uuid = authUser.value?.uuid || useCookie('user_uuid', { path: '/' }).value
        if (uuid) {
          localStorage.removeItem(`da_pending_terms_reminder_${uuid}`)
        }
      }
      hasPendingTermsReminder.value = false
      toast.success('Terms and Conditions accepted. Welcome to DermAssist!')
    } catch (error: any) {
      const msg = error?.data?.message || error?.message || 'Failed to save your acceptance.'
      toast.error(msg)
    } finally {
      isAcceptingTerms.value = false
    }
  }

  const handleDeclineMandatoryTerms = async () => {
    if (isAcceptingTerms.value) return
    isAcceptingTerms.value = true
    try {
      await authService.logout()
    } catch (error) {
      console.error('Logout on terms decline failed:', error)
    } finally {
      useSessionCleanup().clearSessionCaches()
      isAcceptingTerms.value = false
      toast.info('You must agree to the Terms & Conditions to access your account.')
      await navigateTo('/auth/login')
    }
  }

  const { hasUnseenAppeals, sortedAppeals, fetchAppeals, markAppealsSeen } = useAdminAppeals()
  const { hasUnseenUpdate, fetchPublishedPatchNotes, markLatestUpdateAsSeen } = usePatchNotes()
  const { totalUnreadCount } = useConversations()
  const { rescheduleRequestsCount } = useAppointments()

  const showWhatsNew = computed(() => {
    return Boolean(hasUnseenUpdate.value)
  })

  const adminNavItems = computed(() => [
    { icon: 'lucide:layout-dashboard', label: 'Dashboard', to: '/admin' },
    {
      icon: 'lucide:shield-check',
      label: 'Moderation',
      children: [
        { icon: 'lucide:users', label: 'All Users', to: '/admin/moderation/users' },
        { icon: 'lucide:badge-check', label: 'Verification', to: '/admin/moderation/verification' }
      ]
    },
    {
      icon: 'lucide:alert-circle',
      label: 'Scan Appeals',
      to: '/admin/appeals',
      showBadge: hasUnseenAppeals.value,
      badgeCount: hasUnseenAppeals.value ? sortedAppeals.value.length || 1 : 0
    },
    { icon: 'lucide:database', label: 'Dataset', to: '/admin/dataset' },
    {
      icon: 'lucide:brain-circuit',
      label: 'AI Models',
      children: [
        { icon: 'lucide:refresh-cw', label: 'Retrain Models', to: '/admin/ai' },
        { icon: 'lucide:flask-conical', label: 'Train New Disease', to: '/admin/ai/expansion' }
      ]
    },
    {
      icon: 'lucide:credit-card',
      label: 'Subscriptions',
      children: [
        { icon: 'lucide:bar-chart-3', label: 'Dashboard', to: '/admin/subscriptions' },
        { icon: 'lucide:sliders', label: 'Plan Builder', to: '/admin/subscriptions/plans' },
        { icon: 'lucide:sparkles', label: 'Features Manager', to: '/admin/subscriptions/features' },
        {
          icon: 'lucide:receipt',
          label: 'Payment Verification',
          to: '/admin/subscriptions/payments'
        },
        { icon: 'lucide:ticket', label: 'Coupons & Promo', to: '/admin/subscriptions/coupons' }
      ]
    },
    {
      icon: 'lucide:newspaper',
      label: 'System Updates',
      to: '/admin/patch-notes',
      showBadge: hasUnseenUpdate.value,
      badgeCount: hasUnseenUpdate.value ? 1 : 0
    }
  ])

  const patientNavItems = computed(() => {
    const items = [
      { icon: 'lucide:layout-dashboard', label: 'Dashboard', to: '/patient' },
      {
        icon: 'lucide:camera',
        label: 'Scan',
        to: '/patient/scan'
      },
      {
        icon: 'lucide:calendar',
        label: 'Appointments',
        to: '/patient/appointments',
        description:
          'Schedule consultations, choose preferred doctors, and view appointment histories.'
      },
      {
        icon: 'lucide:message-square',
        label: 'Message',
        to: '/patient/messages',
        showBadge: totalUnreadCount.value > 0,
        badgeCount: totalUnreadCount.value
      },
      {
        icon: 'lucide:folder',
        label: 'Records',
        to: '/patient/records'
      }
    ]

    if (showWhatsNew.value) {
      items.push({
        icon: 'lucide:sparkles',
        label: "What's New",
        to: '/patient/updates',
        showBadge: hasUnseenUpdate.value,
        badgeCount: hasUnseenUpdate.value ? 1 : 0
      })
    }

    return items
  })

  const doctorNavItems = computed(() => {
    const items = [
      { icon: 'lucide:layout-dashboard', label: 'Dashboard', to: '/doctor' },
      {
        icon: 'lucide:camera',
        label: 'Scan',
        to: '/doctor/scan'
      },
      {
        icon: 'lucide:user-round',
        label: 'Consultations',
        children: [
          { icon: 'lucide:users', label: 'Patients', to: '/doctor/patients' },
          {
            icon: 'lucide:calendar',
            label: 'Appointments',
            to: '/doctor/appointments',
            showBadge: rescheduleRequestsCount.value > 0,
            badgeCount: rescheduleRequestsCount.value
          }
        ]
      },
      {
        icon: 'lucide:pill',
        label: 'Medicine Library',
        to: '/doctor/medicines'
      },
      {
        icon: 'lucide:user-plus',
        label: 'Secretaries',
        to: '/doctor/secretaries'
      },
      {
        icon: 'lucide:message-square',
        label: 'Message',
        to: '/doctor/messages',
        showBadge: totalUnreadCount.value > 0,
        badgeCount: totalUnreadCount.value
      },
      {
        icon: 'lucide:folder',
        label: 'Records',
        to: '/doctor/records'
      },
      {
        icon: 'lucide:database',
        label: 'Dataset',
        to: '/doctor/dataset'
      },
      {
        icon: 'lucide:credit-card',
        label: 'Subscription',
        to: '/doctor/subscription'
      }
    ]

    if (showWhatsNew.value) {
      items.push({
        icon: 'lucide:sparkles',
        label: "What's New",
        to: '/doctor/updates',
        showBadge: hasUnseenUpdate.value,
        badgeCount: hasUnseenUpdate.value ? 1 : 0
      })
    }

    return items
  })

  const secretaryNavItems = computed(() => [
    { icon: 'lucide:layout-dashboard', label: 'Dashboard', to: '/secretary' },
    {
      icon: 'lucide:user-round',
      label: 'Consultations',
      children: [
        { icon: 'lucide:users', label: 'Patients', to: '/secretary/patients' },
        {
          icon: 'lucide:calendar',
          label: 'Appointments',
          to: '/secretary/appointments',
          showBadge: rescheduleRequestsCount.value > 0,
          badgeCount: rescheduleRequestsCount.value
        }
      ]
    },
    {
      icon: 'lucide:pill',
      label: 'Medicine Library',
      to: '/secretary/medicines'
    },
    {
      icon: 'lucide:message-square',
      label: 'Message',
      to: '/secretary/messages',
      showBadge: totalUnreadCount.value > 0,
      badgeCount: totalUnreadCount.value
    },
    {
      icon: 'lucide:folder',
      label: 'Records',
      to: '/secretary/records'
    }
  ])

  const navItems = computed(() => {
    switch (userRole.value) {
      case 'admin':
        return adminNavItems.value
      case 'doctor':
        return doctorNavItems.value
      case 'secretary':
        return secretaryNavItems.value
      case 'patient':
        return patientNavItems.value
      default:
        // Fallback to route-based if cookie is missing
        if (route.path.startsWith('/admin')) return adminNavItems.value
        if (route.path.startsWith('/doctor')) return doctorNavItems.value
        if (route.path.startsWith('/secretary')) return secretaryNavItems.value
        return patientNavItems.value
    }
  })

  const activeItemInfo = computed(() => {
    const findActive = (items: any[], path: string, trail: any[] = []): any => {
      const lowerPath = path.toLowerCase()
      for (const item of items) {
        const currentTrail = [...trail, { label: item.label, to: item.to }]
        if (item.to && item.to.toLowerCase() === lowerPath) {
          return {
            title: item.navbarTitle || item.label,
            breadcrumbs: currentTrail
          }
        }
        if (item.children) {
          const found = findActive(item.children, path, currentTrail)
          if (found) return found
        }
      }
      return null
    }

    let active = findActive(navItems.value, route.path)

    if (route.path.toLowerCase().endsWith('/profile')) {
      const role = (userRole.value as string) || route.path.split('/')[1] || 'patient'
      const baseDashboard = `/${role}`
      let description = 'Manage your personal information and profile settings.'
      if (role === 'doctor') {
        description =
          'Manage your professional profile, clinic branches, schedule, and subscription.'
      } else if (role === 'secretary') {
        description = 'Manage your personal details and account security.'
      }
      return {
        title: 'Settings',
        description,
        breadcrumbs: [
          { label: 'Dashboard', to: baseDashboard },
          { label: 'Settings', to: route.path }
        ]
      }
    }

    if (!active) {
      let parentPath = route.path
      while (parentPath.lastIndexOf('/') > 0) {
        parentPath = parentPath.substring(0, parentPath.lastIndexOf('/'))
        active = findActive(navItems.value, parentPath)
        if (active) break
      }
    }

    return active || { title: '', breadcrumbs: [] }
  })

  const isChatThread = computed(() => {
    return /^\/(patient|doctor|secretary)\/messages\/[a-f0-9-]+/i.test(route.path)
  })

  const isChatPage = computed(() => {
    return /^\/(patient|doctor|secretary)\/messages/i.test(route.path)
  })

  const isFullHeightPage = computed(() => {
    if (/\/scan\/results/i.test(route.path)) {
      return false
    }
    return /^\/(patient|doctor|secretary)\/(messages|scan)/i.test(route.path)
  })

  /**
   * Doctors switch to the mobile chrome below `lg` (phones + portrait tablets),
   * while other roles keep the original `md` breakpoint.
   */
  const isDoctorRole = computed(() => userRole.value === 'doctor')

  const desktopChromeClass = computed(() =>
    isDoctorRole.value ? 'hidden lg:block' : 'hidden md:block'
  )

  const showDoctorMobileChrome = computed(() => isDoctorRole.value && !isChatThread.value)

  const doctorMainClass = computed(() => {
    if (isChatThread.value) {
      return 'mt-0 h-full overflow-hidden bg-transparent p-0 lg:-mt-4 lg:p-5'
    }
    if (isFullHeightPage.value) {
      return 'mt-0 flex h-full flex-col overflow-hidden bg-transparent p-0 lg:-mt-4 lg:flex lg:overflow-hidden lg:p-5'
    }
    return 'mt-0 overflow-y-auto p-0 lg:-mt-4 lg:p-5'
  })

  const doctorContentClass = computed(() => {
    if (isChatThread.value) {
      return 'h-full min-h-0'
    }
    if (isChatPage.value) {
      return 'min-h-0 w-full flex-1 px-0 pt-0 pb-[92px] lg:h-full lg:p-0'
    }
    if (/\/scan\/results/i.test(route.path)) {
      return 'min-h-0 w-full flex-1 px-4 pt-4 pb-[104px] sm:px-6 sm:pt-5 lg:h-full lg:p-0'
    }
    if (isFullHeightPage.value) {
      return 'min-h-0 w-full flex-1 px-4 pt-3 pb-[92px] sm:px-6 lg:h-full lg:p-0'
    }
    return 'min-h-0 px-4 pt-4 pb-[104px] sm:px-6 sm:pt-5 lg:p-0'
  })

  const currentPageTitle = computed(() => activeItemInfo.value.title)
  const currentPageDescription = computed(() => (activeItemInfo.value as any)?.description || '')
  const breadcrumbs = computed(() => activeItemInfo.value.breadcrumbs)

  onMounted(async () => {
    isHydrated.value = true

    if (authToken.value && (!authUser.value || authUser.value.terms_accepted_at === undefined)) {
      try {
        const res: any = await $api('/user')
        const userData = res?.data || res
        if (userData) {
          authUser.value = userData
        }
      } catch {
        // Handled by global auth middleware if token is invalid
      }
    }

    syncPendingTermsReminder()

    const effectiveRole = String(
      userRole.value || authUser.value?.role?.slug || authUser.value?.role || ''
    ).toLowerCase()
    const normalizedPath =
      route.path.length > 1 && route.path.endsWith('/')
        ? route.path.slice(0, -1).toLowerCase()
        : route.path.toLowerCase()
    if (needsTermsAcceptance.value && effectiveRole && normalizedPath !== `/${effectiveRole}`) {
      await navigateTo(`/${effectiveRole}`)
    }

    fetchPublishedPatchNotes()
    if (userRole.value === 'admin' || route.path.startsWith('/admin')) {
      fetchAppeals()
      if (import.meta.client) {
        const { getEcho } = useEcho()
        const echo = getEcho()
        if (echo) {
          echo.private('admin.moderation').listen('.ScanAppealUpdated', () => {
            fetchAppeals(true)
          })
        }
      }
    }
  })

  onUnmounted(() => {
    if (import.meta.client) {
      const { getEcho } = useEcho()
      const echo = getEcho()
      if (echo) {
        echo.private('admin.moderation').stopListening('.ScanAppealUpdated')
      }
    }
  })

  watch(
    () => route.path,
    async path => {
      if (path.startsWith('/admin/appeals')) {
        markAppealsSeen()
      }

      if (path.toLowerCase().endsWith('/updates') || path.toLowerCase().endsWith('/patch-notes')) {
        markLatestUpdateAsSeen()
      }

      // Scroll to top on page change (only on client-side)
      if (typeof document !== 'undefined') {
        await nextTick()
        const mainContent = document.getElementById('main-content')
        if (mainContent) {
          mainContent.scrollTop = 0
        }
      }
    },
    { immediate: true }
  )
</script>
