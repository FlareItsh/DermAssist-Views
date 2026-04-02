<template>
  <div class="bg-background flex h-screen flex-col overflow-hidden">
    <AppNavbar title="Admin Dashboard"> </AppNavbar>

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
  const adminNavItems = [
    { icon: 'mi:home', label: 'Dashboard', to: '/admin' },
    {
      icon: 'material-symbols-light:camera-rounded',
      label: 'Scan',
      to: '/admin/scan'
    },
    { icon: 'mynaui:envelope', label: 'Messages', to: '/admin/messages' },
    { icon: 'ic:round-settings', label: 'Settings', to: '/admin/settings' }
  ]
</script>
