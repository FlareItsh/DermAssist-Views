<script setup lang="ts">
  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const { getStorageUrl } = useStorage()
</script>

<template>
  <div class="flex flex-wrap gap-4">
    <div class="border-accent/20 flex flex-col items-center rounded-2xl border-4 p-2">
      <h2>Dr. Medwin Gardose</h2>
      <p>PRC ID: 0123456789</p>
      <NuxtImg
        :src="getStorageUrl('verifications/doctor_4_1775490320.png')"
        class="w-xs rounded-lg object-contain"
      />
    </div>
  </div>
</template>
