<script setup lang="ts">
  const props = withDefaults(
    defineProps<{
      title?: string
      description?: string
      type?: 'warning' | 'error' | 'info' | 'success'
      icon?: string
    }>(),
    {
      type: 'warning'
    }
  )

  // Style configurations based on type
  const config = computed(() => {
    switch (props.type) {
      case 'error':
        return {
          wrapper: 'border-destructive/20 bg-destructive/5',
          iconWrapper: 'bg-destructive/10 text-destructive',
          icon: props.icon || 'lucide:alert-circle',
          title: 'text-destructive',
          desc: 'text-destructive/80'
        }
      case 'success':
        return {
          wrapper: 'border-green-500/20 bg-green-500/5',
          iconWrapper: 'bg-green-500/10 text-green-500',
          icon: props.icon || 'lucide:check-circle-2',
          title: 'text-green-500',
          desc: 'text-green-700/80'
        }
      case 'info':
        return {
          wrapper: 'border-blue-500/20 bg-blue-500/5',
          iconWrapper: 'bg-blue-500/10 text-blue-500',
          icon: props.icon || 'lucide:info',
          title: 'text-blue-500',
          desc: 'text-blue-700/80'
        }
      case 'warning':
      default:
        return {
          wrapper: 'border-warning-border bg-warning-subtle shadow-2xs',
          iconWrapper: 'bg-warning/15 text-warning',
          icon: props.icon || 'lucide:alert-triangle',
          title: 'text-warning-text font-bold',
          desc: 'text-warning-text/90'
        }
    }
  })
</script>

<template>
  <div
    class="mb-6 flex items-start gap-4 rounded-3xl border p-5 transition-all duration-300"
    :class="config.wrapper"
  >
    <div
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
      :class="config.iconWrapper"
    >
      <Icon
        :name="config.icon"
        size="22"
      />
    </div>
    <div class="flex-1 pt-1">
      <h3
        v-if="title"
        class="text-sm font-bold"
        :class="config.title"
      >
        {{ title }}
      </h3>
      <p
        class="mt-1 text-xs leading-relaxed font-semibold"
        :class="config.desc"
      >
        <slot>{{ description }}</slot>
      </p>
    </div>
  </div>
</template>
