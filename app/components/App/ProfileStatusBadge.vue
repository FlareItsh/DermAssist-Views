<script setup lang="ts">
  defineProps<{
    isComplete: boolean
    isPending?: boolean
    isDeclined?: boolean
  }>()
</script>

<template>
  <div class="flex items-center gap-1.5">
    <div 
      v-if="isComplete"
      class="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
    ></div>
    <div 
      v-else-if="isDeclined"
      class="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
    ></div>
    <div 
      v-else-if="isPending"
      class="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse"
    ></div>
    <div 
      v-else
      class="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse"
    ></div>
    
    <span 
      class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.05em] transition-all duration-500"
      :class="isComplete 
        ? 'bg-green-500/10 text-green-500 ring-1 ring-green-500/20' 
        : isDeclined ? 'bg-red-500/10 text-red-500 ring-1 ring-red-500/20'
        : isPending ? 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20'
        : 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20'"
    >
      {{ isComplete ? 'Profile Complete' : isDeclined ? 'Verification Declined' : isPending ? 'Pending Verification' : 'Action Required' }}
    </span>
  </div>
</template>
