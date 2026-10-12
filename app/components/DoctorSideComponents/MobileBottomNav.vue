<script setup lang="ts">
  const route = useRoute()

  const isActive = (path: string, exact = false): boolean => {
    const current = route.path.toLowerCase().replace(/\/$/, '')
    const target = path.toLowerCase()
    if (exact) {
      return current === target
    }
    return current === target || current.startsWith(target + '/')
  }

  const leftItems = [
    { icon: 'solar:home-2-bold', label: 'Home', to: '/doctor', exact: true },
    {
      icon: 'solar:users-group-rounded-bold',
      label: 'Patients',
      to: '/doctor/patients',
      exact: false
    }
  ]

  const rightItems = [
    {
      icon: 'solar:calendar-date-bold',
      label: 'Schedule',
      to: '/doctor/appointments',
      exact: false
    },
    { icon: 'solar:letter-bold', label: 'Messages', to: '/doctor/messages', exact: false }
  ]

  const isScanActive = computed(() => isActive('/doctor/scan'))
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-50 lg:hidden"
    id="doctor-mobile-bottom-nav"
  >
    <div
      class="pb-safe relative border-t border-gray-100 bg-white px-2 pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] sm:px-6"
    >
      <div class="mx-auto grid max-w-2xl grid-cols-5 items-end">
        <NuxtLink
          v-for="item in leftItems"
          :key="item.to"
          :to="item.to"
          class="flex flex-col items-center gap-0.5 py-2 transition-all active:scale-90"
          :class="isActive(item.to, item.exact) ? 'text-primary' : 'text-gray-400'"
        >
          <Icon
            :name="item.icon"
            size="24"
          />
          <span class="text-[10px] font-bold tracking-wide">{{ item.label }}</span>
        </NuxtLink>

        <!-- Scan (raised center action) -->
        <div class="flex flex-col items-center gap-0.5 pb-1 select-none">
          <NuxtLink
            to="/doctor/scan"
            id="doctor-mobile-scan-action"
            class="shadow-primary/25 -mt-7 flex h-[58px] w-[58px] items-center justify-center rounded-full border-[3px] shadow-xl transition-all active:scale-90"
            :class="
              isScanActive
                ? 'border-primary bg-white text-black'
                : 'bg-primary border-white text-white'
            "
          >
            <Icon
              :name="isScanActive ? 'lucide:aperture' : 'solar:camera-bold'"
              size="26"
            />
          </NuxtLink>
          <span
            class="text-[10px] font-bold tracking-wide"
            :class="isScanActive ? 'text-primary' : 'text-gray-400'"
            >Scan</span
          >
        </div>

        <NuxtLink
          v-for="item in rightItems"
          :key="item.to"
          :to="item.to"
          class="flex flex-col items-center gap-0.5 py-2 transition-all active:scale-90"
          :class="isActive(item.to, item.exact) ? 'text-primary' : 'text-gray-400'"
        >
          <Icon
            :name="item.icon"
            size="24"
          />
          <span class="text-[10px] font-bold tracking-wide">{{ item.label }}</span>
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>

<style scoped>
  .pb-safe {
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }
</style>
