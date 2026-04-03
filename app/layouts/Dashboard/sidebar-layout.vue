<template>
  <div class="bg-background flex h-screen flex-col overflow-hidden">
    <AppNavbar :title="currentPageTitle" />

    <div class="flex flex-1 overflow-hidden">
      <AppSidebar :items="navItems" />

      <main class="flex-1 overflow-y-auto p-5">
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
    { icon: 'mi:home', label: 'Dashboard', to: '/admin' },
    {
      icon: 'mage:user-circle',
      label: 'Users',
      to: '/admin/users'
    }
  ]

  const patientNavItems = [
    { icon: 'mi:home', label: 'Dashboard', to: '/patient' },
    {
      icon: 'material-symbols-light:camera-outline-rounded',
      label: 'Scan',
      to: '/patient/scan'
    }
  ]

  const doctorNavItems = [
    { icon: 'mi:home', label: 'Dashboard', to: '/admin' },
    {
      icon: 'mage:user-circle',
      label: 'Users',
      to: '/admin/users'
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
