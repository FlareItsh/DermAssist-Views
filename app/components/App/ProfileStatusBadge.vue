<script setup lang="ts">
  defineProps<{
    isComplete: boolean
  }>()
</script>

<template>
  <div class="flex items-center gap-1.5">
    <div 
      v-if="isComplete"
      class="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
    ></div>
    <div 
      v-else
      class="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse"
    ></div>
    
    <span 
      class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.05em] transition-all duration-500"
      :class="isComplete 
        ? 'bg-green-500/10 text-green-500 ring-1 ring-green-500/20' 
        : 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20'"
    >
      {{ isComplete ? 'Profile Complete' : 'Action Required' }}
    </span>
  </div>
</template>
