<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <AppNavbar
      :title="currentPageTitle"
      :breadcrumbs="breadcrumbs"
    >
      <AppUtilityBar v-if="userRole !== 'admin'" />
    </AppNavbar>
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

<script setup lang="ts">
  const route = useRoute()
  const userRole = useCookie('user_role')

  const adminNavItems = [
    { icon: 'boxicons:dashboard', label: 'Dashboard', to: '/admin' },
    {
      icon: 'lucide:shield-check',
      label: 'Moderation',
      children: [
        { icon: 'heroicons:users', label: 'All Users', to: '/admin/moderation/users' },
        {
          icon: 'heroicons:shield-check',
          label: 'Roles & Permissions',
          to: '/admin/moderation/roles'
        },
        { icon: 'tabler:id', label: 'Verification', to: '/admin/moderation/verification' }
      ]
    }
  ]

  const patientNavItems = computed(() => [
    { icon: 'material-symbols-light:dashboard-2-outline', label: 'Dashboard', to: '/patient' },
    {
      icon: 'material-symbols-light:camera-outline-rounded',
      label: 'Scan',
      to: '/patient/scan'
    },
    {
      icon: 'lets-icons:message-light',
      label: 'Message',
      to: '/patient/messages'
    },
    {
      icon: 'material-symbols-light:folder-copy-outline-rounded',
      label: 'Records',
      to: '/patient/records'
    }
  ])

  const doctorNavItems = computed(() => [
    { icon: 'mi:home', label: 'Dashboard', to: '/doctor' },
    {
      icon: 'material-symbols-light:camera-outline-rounded',
      label: 'Scan',
      to: '/doctor/scan'
    },
    {
      icon: 'mage:user-circle',
      label: 'Consultations',
      children: [
        { icon: 'heroicons:user-group', label: 'Patients', to: '/doctor/users' },
        { icon: 'heroicons:calendar', label: 'Appointments', to: '/doctor/appointments' }
      ]
    },
    {
      icon: 'lets-icons:message-light',
      label: 'Message',
      to: '/doctor/messages'
    },
    {
      icon: 'material-symbols-light:folder-copy-outline-rounded',
      label: 'Records',
      to: '/doctor/records'
    }
  ])

  const navItems = computed(() => {
    switch (userRole.value) {
      case 'admin':
        return adminNavItems
      case 'doctor':
        return doctorNavItems.value
      case 'patient':
        return patientNavItems.value
      default:
        // Fallback to route-based if cookie is missing
        if (route.path.startsWith('/admin')) return adminNavItems
        if (route.path.startsWith('/doctor')) return doctorNavItems.value
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

  const currentPageTitle = computed(() => activeItemInfo.value.title)
  const breadcrumbs = computed(() => activeItemInfo.value.breadcrumbs)
</script>
