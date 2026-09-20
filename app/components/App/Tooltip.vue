<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'

  interface Props {
    title?: string
    text?: string
    placement?: 'auto' | 'top' | 'bottom'
    align?: 'auto' | 'start' | 'center' | 'end' | 'left' | 'right'
    trigger?: 'hover' | 'click' | 'both'
    width?: string
    contentClass?: string
    disabled?: boolean
    delay?: number
  }

  const props = withDefaults(defineProps<Props>(), {
    title: '',
    text: '',
    placement: 'auto',
    align: 'auto',
    trigger: 'both',
    width: 'w-auto max-w-xs sm:max-w-sm',
    contentClass: '',
    disabled: false,
    delay: 150
  })

  const triggerRef = ref<HTMLElement | null>(null)
  const tooltipRef = ref<HTMLElement | null>(null)

  const isHovered = ref(false)
  const isPinned = ref(false)
  let leaveTimeout: ReturnType<typeof setTimeout> | null = null
  let rafId: number | null = null
  let resizeObserver: ResizeObserver | null = null

  const isOpen = computed(() => !props.disabled && (isHovered.value || isPinned.value))

  const coords = ref({ top: 0, left: 0 })
  const actualPlacement = ref<'top' | 'bottom'>('bottom')

  const calculatePosition = () => {
    if (!triggerRef.value) return

    // Find the first element child or fallback to container
    const triggerEl = (triggerRef.value.firstElementChild as HTMLElement) || triggerRef.value
    const triggerRect = triggerEl.getBoundingClientRect()

    // If trigger is detached or not visible, hide/skip
    if (triggerRect.width === 0 && triggerRect.height === 0) return

    const tooltipEl = tooltipRef.value
    const tooltipRect = tooltipEl ? tooltipEl.getBoundingClientRect() : null
    const tooltipWidth = tooltipRect?.width || 320
    const tooltipHeight = tooltipRect?.height || 260

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const spacing = 8
    const margin = 12

    // Space available above and below
    const spaceBelow = viewportHeight - triggerRect.bottom - spacing - margin
    const spaceAbove = triggerRect.top - spacing - margin

    let resolvedPlacement = props.placement
    if (resolvedPlacement === 'auto') {
      if (spaceBelow >= tooltipHeight) {
        resolvedPlacement = 'bottom'
      } else if (spaceAbove >= tooltipHeight) {
        resolvedPlacement = 'top'
      } else {
        resolvedPlacement = spaceBelow >= spaceAbove ? 'bottom' : 'top'
      }
    }

    actualPlacement.value = resolvedPlacement as 'top' | 'bottom'

    let top = 0
    if (resolvedPlacement === 'top') {
      top = triggerRect.top - tooltipHeight - spacing
    } else {
      top = triggerRect.bottom + spacing
    }

    // Viewport clamping for vertical position
    const maxTop = viewportHeight - tooltipHeight - margin
    top = Math.max(margin, Math.min(top, maxTop))

    // Horizontal alignment
    let resolvedAlign = props.align
    if (resolvedAlign === 'auto') {
      resolvedAlign = triggerRect.left > viewportWidth / 2 ? 'end' : 'start'
    }

    let left = 0
    if (resolvedAlign === 'end' || resolvedAlign === 'right') {
      left = triggerRect.right - tooltipWidth
    } else if (resolvedAlign === 'center') {
      left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2
    } else {
      left = triggerRect.left
    }

    // Viewport clamping for horizontal position
    const maxLeft = viewportWidth - tooltipWidth - margin
    left = Math.max(margin, Math.min(left, maxLeft))

    coords.value = {
      top: Math.round(top),
      left: Math.round(left)
    }
  }

  const updatePositionAsync = () => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      calculatePosition()
    })
  }

  watch(isOpen, newVal => {
    if (newVal) {
      nextTick(() => {
        calculatePosition()
        updatePositionAsync()

        // Observe tooltip resize dynamically if content shifts
        if (tooltipRef.value && typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            updatePositionAsync()
          })
          resizeObserver.observe(tooltipRef.value)
        }
      })
    } else {
      if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = null
      }
    }
  })

  const handleMouseEnter = () => {
    if (props.disabled || props.trigger === 'click') return
    if (leaveTimeout) {
      clearTimeout(leaveTimeout)
      leaveTimeout = null
    }
    isHovered.value = true
  }

  const handleMouseLeave = () => {
    if (props.disabled || props.trigger === 'click') return
    leaveTimeout = setTimeout(() => {
      isHovered.value = false
    }, props.delay)
  }

  const handleTooltipMouseEnter = () => {
    if (props.disabled || props.trigger === 'click') return
    if (leaveTimeout) {
      clearTimeout(leaveTimeout)
      leaveTimeout = null
    }
    isHovered.value = true
  }

  const handleTooltipMouseLeave = () => {
    if (props.disabled || props.trigger === 'click') return
    leaveTimeout = setTimeout(() => {
      isHovered.value = false
    }, props.delay)
  }

  const togglePin = () => {
    if (props.disabled || props.trigger === 'hover') return
    isPinned.value = !isPinned.value
  }

  const open = () => {
    if (props.disabled) return
    isPinned.value = true
  }

  const close = () => {
    isPinned.value = false
    isHovered.value = false
  }

  const handleGlobalClick = (event: MouseEvent) => {
    if (!isOpen.value) return
    const target = event.target as Node | null
    if (target && (triggerRef.value?.contains(target) || tooltipRef.value?.contains(target))) {
      return
    }
    close()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen.value) {
      close()
    }
  }

  const handleScrollOrResize = () => {
    if (isOpen.value) {
      updatePositionAsync()
    }
  }

  onMounted(() => {
    window.addEventListener('click', handleGlobalClick, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScrollOrResize, {
      passive: true,
      capture: true
    })
    window.addEventListener('resize', handleScrollOrResize, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('click', handleGlobalClick, true)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('scroll', handleScrollOrResize, true)
    window.removeEventListener('resize', handleScrollOrResize)
    if (leaveTimeout) clearTimeout(leaveTimeout)
    if (rafId) cancelAnimationFrame(rafId)
    if (resizeObserver) resizeObserver.disconnect()
  })

  defineExpose({
    isOpen,
    isPinned,
    open,
    close,
    calculatePosition: updatePositionAsync
  })
</script>

<template>
  <div
    ref="triggerRef"
    class="inline-flex items-center"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @click="togglePin"
  >
    <!-- Trigger Slot: Exposes state and controls -->
    <slot
      :is-open="isOpen"
      :is-pinned="isPinned"
      :toggle="togglePin"
      :open="open"
      :close="close"
    >
      <!-- Fallback Trigger if no slot provided -->
      <button
        type="button"
        class="hover:bg-primary/10 hover:text-primary inline-flex items-center justify-center rounded-full p-1 text-gray-400 transition-colors focus:outline-none"
        :class="isOpen ? 'bg-primary/10 text-primary' : ''"
        aria-label="Information"
      >
        <Icon
          name="material-symbols:info-outline-rounded"
          class="text-base"
        />
      </button>
    </slot>

    <!-- Floating Tooltip Portal -->
    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div
          v-if="isOpen"
          ref="tooltipRef"
          class="custom-scrollbar fixed z-[9999] max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-gray-100 bg-white/95 p-4 text-left shadow-2xl backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95"
          :class="[width, contentClass]"
          :style="{
            top: `${coords.top}px`,
            left: `${coords.left}px`
          }"
          role="tooltip"
          @mouseenter="handleTooltipMouseEnter"
          @mouseleave="handleTooltipMouseLeave"
        >
          <!-- Custom Content Slot -->
          <slot
            name="content"
            :close="close"
            :is-pinned="isPinned"
          >
            <!-- Default Simple Text Content -->
            <div class="space-y-1">
              <h5
                v-if="title"
                class="text-xs font-bold text-gray-900 dark:text-gray-100"
              >
                {{ title }}
              </h5>
              <p
                v-if="text"
                class="text-xs leading-relaxed text-gray-600 dark:text-gray-300"
              >
                {{ text }}
              </p>
            </div>
          </slot>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
  .tooltip-fade-enter-active,
  .tooltip-fade-leave-active {
    transition:
      opacity 0.16s ease,
      transform 0.16s ease;
  }

  .tooltip-fade-enter-from,
  .tooltip-fade-leave-to {
    opacity: 0;
    transform: scale(0.96);
  }
</style>
