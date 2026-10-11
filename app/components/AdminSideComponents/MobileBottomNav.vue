<script setup lang="ts">
  interface NavItem {
    icon: string
    label: string
    to?: string
    showBadge?: boolean
    badgeText?: string
    highlight?: boolean
    children?: NavItem[]
  }

  const props = defineProps<{
    items: NavItem[]
  }>()

  const route = useRoute()

  const primaryTabs = computed(() => [
    { icon: 'solar:home-2-bold', label: 'Home', to: '/admin', exact: true },
    { icon: 'solar:users-group-rounded-bold', label: 'Users', to: '/admin/moderation/users' },
    {
      icon: 'solar:danger-circle-bold',
      label: 'Appeals',
      to: '/admin/appeals',
      showBadge: Boolean(props.items.find(item => item.to === '/admin/appeals')?.showBadge)
    },
    { icon: 'solar:database-bold', label: 'Dataset', to: '/admin/dataset' }
  ])

  const primaryPaths = computed(() => new Set(primaryTabs.value.map(tab => tab.to)))

  const moreItems = computed<NavItem[]>(() => {
    return props.items
      .map(item => {
        if (!item.children) {
          return item
        }
        return {
          ...item,
          children: item.children.filter(child => !primaryPaths.value.has(child.to || ''))
        }
      })
      .filter(item => {
        if (item.children) {
          return item.children.length > 0
        }
        return !primaryPaths.value.has(item.to || '')
      })
  })

  const hasMoreBadge = computed(() => {
    const flat = moreItems.value.flatMap(item => [item, ...(item.children || [])])
    return flat.some(item => item.showBadge)
  })

  const isMoreSheetOpen = ref(false)
  const expandedGroups = ref<Set<string>>(new Set())

  const normalizePath = (path?: string): string => {
    if (!path) return ''
    return path.replace(/\/+$/, '').toLowerCase() || '/'
  }

  const isPathActive = (path?: string, exact = false): boolean => {
    const current = normalizePath(route.path)
    const target = normalizePath(path)
    if (!target) return false
    if (exact) return current === target
    return current === target || current.startsWith(`${target}/`)
  }

  const isGroupActive = (item: NavItem): boolean => {
    return Boolean(item.children?.some(child => isPathActive(child.to)))
  }

  const isMoreTabActive = computed(() => {
    const isPrimaryActive = primaryTabs.value.some(tab => isPathActive(tab.to, tab.exact))
    return !isPrimaryActive || isMoreSheetOpen.value
  })

  const openMoreSheet = () => {
    for (const item of moreItems.value) {
      if (item.children && isGroupActive(item)) {
        expandedGroups.value.add(item.label)
      }
    }
    isMoreSheetOpen.value = true
  }

  const closeMoreSheet = () => {
    isMoreSheetOpen.value = false
  }

  const toggleMoreSheet = () => {
    if (isMoreSheetOpen.value) {
      closeMoreSheet()
      return
    }
    openMoreSheet()
  }

  const toggleGroup = (label: string) => {
    const next = new Set(expandedGroups.value)
    if (next.has(label)) {
      next.delete(label)
    } else {
      next.add(label)
    }
    expandedGroups.value = next
  }

  const isGroupExpanded = (label: string): boolean => expandedGroups.value.has(label)

  watch(
    () => route.path,
    () => {
      closeMoreSheet()
    }
  )
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-50 md:hidden"
    id="admin-mobile-bottom-nav"
  >
    <div
      class="pb-safe relative flex items-end justify-around border-t border-gray-100 bg-white px-2 pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
    >
      <NuxtLink
        v-for="tab in primaryTabs"
        :key="tab.to"
        :to="tab.to"
        class="relative flex min-w-14 flex-col items-center gap-0.5 px-2 py-2 transition-all active:scale-90"
        :class="isPathActive(tab.to, tab.exact) ? 'text-primary' : 'text-gray-400'"
      >
        <span class="relative">
          <Icon
            :name="tab.icon"
            size="24"
          />
          <span
            v-if="tab.showBadge"
            class="absolute -top-0.5 -right-1 flex h-2.5 w-2.5"
          >
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
            ></span>
            <span
              class="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500"
            ></span>
          </span>
        </span>
        <span class="text-[10px] font-bold tracking-wide">{{ tab.label }}</span>
      </NuxtLink>

      <button
        type="button"
        id="admin-mobile-more-button"
        class="relative flex min-w-14 cursor-pointer flex-col items-center gap-0.5 px-2 py-2 transition-all active:scale-90"
        :class="isMoreTabActive ? 'text-primary' : 'text-gray-400'"
        @click="toggleMoreSheet"
      >
        <span class="relative">
          <Icon
            name="solar:hamburger-menu-bold"
            size="24"
          />
          <span
            v-if="hasMoreBadge"
            class="absolute -top-0.5 -right-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500"
          ></span>
        </span>
        <span class="text-[10px] font-bold tracking-wide">More</span>
      </button>
    </div>
  </nav>

  <Teleport to="body">
    <Transition name="admin-sheet">
      <div
        v-if="isMoreSheetOpen"
        class="fixed inset-0 z-[60] md:hidden"
      >
        <div
          class="bg-foreground/40 absolute inset-0"
          @click="closeMoreSheet"
        ></div>

        <div
          class="admin-sheet-panel pb-safe absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[28px] bg-white px-4 pt-3 pb-24 shadow-2xl"
        >
          <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200"></div>
          <div class="mb-3 flex items-center justify-between px-1">
            <h2 class="text-foreground text-base font-black">More</h2>
            <button
              type="button"
              aria-label="Close menu"
              class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-gray-500 active:scale-90"
              @click="closeMoreSheet"
            >
              <Icon
                name="lucide:x"
                size="16"
              />
            </button>
          </div>

          <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
            <li
              v-for="item in moreItems"
              :key="item.label"
            >
              <NuxtLink
                v-if="!item.children"
                :to="item.to"
                class="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors active:scale-[0.98]"
                :class="
                  isPathActive(item.to)
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-gray-50'
                "
              >
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  :class="isPathActive(item.to) ? 'bg-primary/15' : 'bg-gray-100'"
                >
                  <Icon
                    :name="item.icon"
                    size="18"
                  />
                </span>
                <span class="flex-1 text-sm font-semibold">{{ item.label }}</span>
                <span
                  v-if="item.showBadge"
                  class="h-2 w-2 rounded-full bg-red-500"
                ></span>
                <Icon
                  name="lucide:chevron-right"
                  size="16"
                  class="text-gray-300"
                />
              </NuxtLink>

              <div v-else>
                <button
                  type="button"
                  class="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors active:scale-[0.98]"
                  :class="
                    isGroupActive(item)
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-gray-50'
                  "
                  @click="toggleGroup(item.label)"
                >
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    :class="isGroupActive(item) ? 'bg-primary/15' : 'bg-gray-100'"
                  >
                    <Icon
                      :name="item.icon"
                      size="18"
                    />
                  </span>
                  <span class="flex-1 text-sm font-semibold">{{ item.label }}</span>
                  <Icon
                    name="lucide:chevron-down"
                    size="16"
                    class="text-gray-400 transition-transform duration-300"
                    :class="{ 'rotate-180': isGroupExpanded(item.label) }"
                  />
                </button>

                <div
                  class="grid transition-all duration-300 ease-in-out"
                  :class="isGroupExpanded(item.label) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
                >
                  <ul class="m-0 flex list-none flex-col gap-1 overflow-hidden p-0 pl-6">
                    <li
                      v-for="child in item.children"
                      :key="child.to"
                    >
                      <NuxtLink
                        :to="child.to"
                        class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors active:scale-[0.98]"
                        :class="
                          isPathActive(child.to)
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-foreground/80 hover:bg-gray-50'
                        "
                      >
                        <Icon
                          :name="child.icon"
                          size="16"
                        />
                        <span class="flex-1 text-[13px]">{{ child.label }}</span>
                        <span
                          v-if="child.showBadge"
                          class="h-2 w-2 rounded-full bg-red-500"
                        ></span>
                      </NuxtLink>
                    </li>
                  </ul>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .pb-safe {
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }

  .admin-sheet-enter-active,
  .admin-sheet-leave-active {
    transition: opacity 0.25s ease;
  }

  .admin-sheet-enter-active .admin-sheet-panel,
  .admin-sheet-leave-active .admin-sheet-panel {
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .admin-sheet-enter-from,
  .admin-sheet-leave-to {
    opacity: 0;
  }

  .admin-sheet-enter-from .admin-sheet-panel,
  .admin-sheet-leave-to .admin-sheet-panel {
    transform: translateY(100%);
  }
</style>
