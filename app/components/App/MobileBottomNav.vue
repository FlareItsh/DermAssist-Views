<script setup lang="ts">
  const route = useRoute()

  const isActive = (path: string, exact = false): boolean => {
    const current = route.path.toLowerCase()
    const target = path.toLowerCase()
    if (exact) return current === target
    return current === target || current.startsWith(target + '/')
  }
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-50 md:hidden">
    <div
      class="pb-safe relative flex items-end justify-around border-t border-gray-100 bg-white px-4 pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
    >
      <!-- Home -->
      <NuxtLink
        to="/patient"
        class="flex flex-col items-center gap-0.5 px-3 py-2 transition-all active:scale-90"
        :class="isActive('/patient', true) ? 'text-primary' : 'text-gray-400'"
      >
        <Icon
          name="solar:home-2-bold"
          size="24"
        />
        <span class="text-[10px] font-bold tracking-wide">Home</span>
      </NuxtLink>

      <!-- Messages -->
      <NuxtLink
        to="/patient/messages"
        class="flex flex-col items-center gap-0.5 px-3 py-2 transition-all active:scale-90"
        :class="isActive('/patient/messages') ? 'text-primary' : 'text-gray-400'"
      >
        <Icon
          name="solar:letter-bold"
          size="24"
        />
        <span class="text-[10px] font-bold tracking-wide">Messages</span>
      </NuxtLink>

      <!-- Records -->
      <NuxtLink
        to="/patient/records"
        class="flex flex-col items-center gap-0.5 px-3 py-2 transition-all active:scale-90"
        :class="isActive('/patient/records') ? 'text-primary' : 'text-gray-400'"
      >
        <Icon
          name="solar:folder-bold"
          size="24"
        />
        <span class="text-[10px] font-bold tracking-wide">Records</span>
      </NuxtLink>

      <!-- Scan (raised circle button) -->
      <div class="flex flex-col items-center gap-0.5 pb-1 select-none">
        <NuxtLink
          to="/patient/scan"
          class="shadow-primary/20 -mt-7 flex h-[58px] w-[58px] items-center justify-center rounded-full border-[3px] shadow-xl transition-all active:scale-90"
          :class="
            isActive('/patient/scan')
              ? 'border-primary bg-white text-black'
              : 'bg-primary border-white text-white'
          "
        >
          <Icon
            :name="isActive('/patient/scan') ? 'lucide:aperture' : 'solar:camera-bold'"
            size="26"
          />
        </NuxtLink>
        <span
          class="text-[10px] font-bold tracking-wide"
          :class="isActive('/patient/scan') ? 'text-primary' : 'text-gray-400'"
          >Scan</span
        >
      </div>
    </div>
  </nav>
</template>

<style scoped>
  .pb-safe {
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }
</style>
