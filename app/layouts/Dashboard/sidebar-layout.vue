<template>
  <div class="bg-background flex h-screen flex-col overflow-hidden">
    <AppNavbar :title="currentPageTitle" />

    <div class="flex flex-1 overflow-hidden">
<<<<<<< HEAD
      <AppSidebar :items="navigationItems" />
=======
      <AppSidebar :items="navItems" />
>>>>>>> 620acbb0ad481d0daf90ae7a80fd483282e6af20

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
      label: 'Users',
      to: '/doctor/users'
    }
  ]

<<<<<<< HEAD
  const navigationItems = computed(() => {
    if (route.path.startsWith('/admin')) {
      return adminNavItems
    } else if (route.path.startsWith('/doctor')) {
      return doctorNavItems
    }
    return patientNavItems
  })

  const currentPageTitle = computed(() => {
    const activeItem = navigationItems.value.find(item => item.to === route.path)
    return activeItem?.navbarTitle || activeItem?.label || 'Dashboard'
=======
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
>>>>>>> 620acbb0ad481d0daf90ae7a80fd483282e6af20
  })
</script>
