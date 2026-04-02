<template>
  <div class="bg-background flex h-screen flex-col overflow-hidden">
    <AppNavbar :title="currentPageTitle" />

    <div class="flex flex-1 overflow-hidden">
      <AppSidebar :items="adminNavItems" />

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

  const adminNavItems = [
    { icon: 'mi:home', label: 'Dashboard', to: '/admin' },
    {
      icon: 'mage:user-circle',
      label: 'Users',
      to: '/admin/users'
    }
  ]

  const currentPageTitle = computed(() => {
    const activeItem = adminNavItems.find(item => item.to === route.path)
    return activeItem?.navbarTitle || activeItem?.label || 'Title'
  })
</script>
