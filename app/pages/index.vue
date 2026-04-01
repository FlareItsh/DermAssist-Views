<template>
  <div>Landing Page</div>
  <div>{{ data }}</div>
</template>

<script setup lang="ts">
  definePageMeta({
    layout: 'landing-page'
  })

  const { data } = await useApi('test')
</script>
