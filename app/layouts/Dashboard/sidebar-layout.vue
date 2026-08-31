<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <!-- Desktop Navbar (hidden on mobile) -->
    <div class="hidden md:block">
      <AppNavbar
        :title="currentPageTitle"
        :breadcrumbs="breadcrumbs"
      >
        <AppUtilityBar v-if="userRole !== 'admin'" />
      </AppNavbar>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <!-- Desktop Sidebar (hidden on mobile) -->
      <div class="hidden md:block">
        <AppSidebar :items="navItems" />
      </div>

      <main
        class="flex-1"
        :class="[
          isFullHeightPage ? 'overflow-hidden h-full pb-0 bg-transparent' : 'overflow-y-auto pb-24 md:pb-5',
          userRole === 'patient' 
            ? (isFullHeightPage 
                ? (isChatThread ? 'mt-0 pt-0 md:pt-5 md:-mt-4 md:p-5 h-full' : 'mt-0 pt-0 md:pt-5 md:-mt-4 md:p-5 h-full')
                : 'mt-0 pt-0 md:pt-5 md:-mt-4 md:p-5')
            : '-mt-4 p-5'
        ]"
        id="main-content"
      >
        <!-- Mobile Header (only on mobile viewports for patients, except in active chat threads) -->
        <div class="block md:hidden relative z-50" v-if="userRole === 'patient' && !isChatThread">
          <PatientSideComponentsMobileHeroHeader />
        </div>
        <div 
          class="mx-auto" 
          :class="[
            userRole === 'patient' ? 'px-5 md:p-0' : '',
            (isFullHeightPage || isChatPage) ? 'h-full min-h-0' : 'min-h-0'
          ]"
        >
          <slot />
        </div>
      </main>
    </div>

    <!-- Mobile Bottom Navigation (patient only, hidden on desktop) -->
    <AppMobileBottomNav v-if="userRole === 'patient' && !isChatThread" />
  </div>
</template>

<script setup lang="ts">
  const route = useRoute()
  const userRole = useCookie('user_role')
  const { hasUnseenAppeals, fetchAppeals, markAppealsSeen } = useAdminAppeals()

  const adminNavItems = computed(() => [
    { icon: 'lucide:layout-dashboard', label: 'Dashboard', to: '/admin' },
    {
      icon: 'lucide:shield-check',
      label: 'Moderation',
      children: [
        { icon: 'lucide:users', label: 'All Users', to: '/admin/moderation/users' },
        {
          icon: 'lucide:shield',
          label: 'Roles & Permissions',
          to: '/admin/moderation/roles'
        },
        { icon: 'lucide:badge-check', label: 'Verification', to: '/admin/moderation/verification' }
      ]
    },
    {
      icon: 'lucide:alert-circle',
      label: 'Scan Appeals',
      to: '/admin/appeals',
      showBadge: hasUnseenAppeals.value
    },
    { icon: 'lucide:database', label: 'Dataset', to: '/admin/dataset' },
    {
      icon: 'lucide:credit-card',
      label: 'Subscriptions',
      children: [
        { icon: 'lucide:bar-chart-3', label: 'Dashboard', to: '/admin/subscriptions' },
        { icon: 'lucide:sliders', label: 'Plan Builder', to: '/admin/subscriptions/plans' },
        { icon: 'lucide:sparkles', label: 'Features Manager', to: '/admin/subscriptions/features' },
        { icon: 'lucide:receipt', label: 'Payment Verification', to: '/admin/subscriptions/payments' },
        { icon: 'lucide:ticket', label: 'Coupons & Promo', to: '/admin/subscriptions/coupons' }
      ]
    }
  ])

  const patientNavItems = computed(() => [
    { icon: 'lucide:layout-dashboard', label: 'Dashboard', to: '/patient' },
    {
      icon: 'lucide:camera',
      label: 'Scan',
      to: '/patient/scan'
    },
    {
      icon: 'lucide:message-square',
      label: 'Message',
      to: '/patient/messages'
    },
    {
      icon: 'lucide:folder',
      label: 'Records',
      to: '/patient/records'
    }
  ])

  const doctorNavItems = computed(() => [
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
        { icon: 'lucide:users', label: 'Patients', to: '/doctor/users' },
        { icon: 'lucide:calendar', label: 'Appointments', to: '/doctor/appointments' }
      ]
    },
    {
      icon: 'lucide:user-plus',
      label: 'Secretaries',
      to: '/doctor/secretaries'
    },
    {
      icon: 'lucide:message-square',
      label: 'Message',
      to: '/doctor/messages'
    },
    {
      icon: 'lucide:folder',
      label: 'Records',
      to: '/doctor/records'
    },
    {
      icon: 'lucide:credit-card',
      label: 'Subscription',
      to: '/doctor/subscription'
    }
  ])

  const secretaryNavItems = computed(() => [
    { icon: 'lucide:layout-dashboard', label: 'Dashboard', to: '/secretary' },
    {
      icon: 'lucide:user-round',
      label: 'Consultations',
      children: [
        { icon: 'lucide:users', label: 'Patients', to: '/secretary/users' },
        { icon: 'lucide:calendar', label: 'Appointments', to: '/secretary/appointments' }
      ]
    },
    {
      icon: 'lucide:message-square',
      label: 'Message',
      to: '/secretary/messages'
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

    if (route.path.endsWith('/profile')) {
      return { title: '', breadcrumbs: [] }
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
    return /^\/(patient|doctor)\/(messages|scan)/i.test(route.path)
  })

  const currentPageTitle = computed(() => activeItemInfo.value.title)
  const breadcrumbs = computed(() => activeItemInfo.value.breadcrumbs)

  onMounted(() => {
    if (userRole.value === 'admin' || route.path.startsWith('/admin')) {
      fetchAppeals()
    }
  })

  watch(
    () => route.path,
    async path => {
      if (path.startsWith('/admin/appeals')) {
        markAppealsSeen()
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
