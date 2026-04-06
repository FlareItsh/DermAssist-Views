<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <AppNavbar :title="currentPageTitle" />

    <div class="flex flex-1 overflow-hidden">
      <AppSidebar :items="navItems" />

      <main class="-mt-4 flex-1 overflow-y-auto p-5">
        <div class="mx-auto">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
  const route = useRoute()
  const userRole = useCookie('user_role')

  const adminNavItems = [
    { icon: 'boxicons:dashboard', label: 'Dashboard', to: '/admin' },
    {
      icon: 'lucide:shield-check',
      label: 'Moderation',
      children: [
        { icon: 'heroicons:users', label: 'All Users', to: '/admin/users' },
        { icon: 'heroicons:shield-check', label: 'Roles & Permissions', to: '/admin/roles' },
        { icon: 'tabler:id', label: 'Verification', to: '/admin/verification' }
      ]
    }
  ]

  const patientNavItems = [
    { icon: 'material-symbols-light:dashboard-2-outline', label: 'Dashboard', to: '/patient' },
    {
      icon: 'material-symbols-light:camera-outline-rounded',
      label: 'Scan',
      to: '/patient/scan'
    },
    {
      icon: 'lets-icons:message-light',
      label: 'Message',
      to: '/patient/message'
    },
    {
      icon: 'material-symbols-light:folder-copy-outline-rounded',
      label: 'Records',
      to: '/patient/records'
    }
  ]

  const doctorNavItems = [
    { icon: 'mi:home', label: 'Dashboard', to: '/doctor' },
    {
      icon: 'mage:user-circle',
      label: 'Consultations',
      children: [
        { icon: 'heroicons:user-group', label: 'Patients', to: '/doctor/users' },
        { icon: 'heroicons:calendar', label: 'Appointments', to: '/doctor/appointments' }
      ]
    }
  ]

  const navItems = computed(() => {
    switch (userRole.value) {
      case 'admin':
        return adminNavItems
      case 'doctor':
        return doctorNavItems
      case 'patient':
        return patientNavItems
      default:
        // Fallback to route-based if cookie is missing
        if (route.path.startsWith('/admin')) return adminNavItems
        if (route.path.startsWith('/doctor')) return doctorNavItems
        return patientNavItems
    }
  })

  const currentPageTitle = computed(() => {
    const activeItem = navItems.value.find(item => item.to === route.path)
    return activeItem?.navbarTitle || activeItem?.label || 'Title'
  })
</script>
