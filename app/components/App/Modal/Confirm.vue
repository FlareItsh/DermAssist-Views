<script setup lang="ts">
  import AppModalConfirmation from './Confirmation.vue'
</script>

<template>
  <AppModalConfirmation v-bind="$attrs">
    <slot />
  </AppModalConfirmation>
</template>
