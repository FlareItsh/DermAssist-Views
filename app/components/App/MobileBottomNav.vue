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

  interface TabItem {
    icon: string
    label: string
    to: string
    exact?: boolean
    showBadge?: boolean
    badgeCount?: number
  }

  const props = withDefaults(
    defineProps<{
      items?: NavItem[]
      role?: string
    }>(),
    {
      items: () => [],
      role: ''
    }
  )

  const route = useRoute()
  const userRole = useCookie<string>('user_role')
  const { totalUnreadCount } = useConversations()

  const resolvedRole = computed<'patient' | 'doctor' | 'admin' | 'secretary'>(() => {
    if (props.role) return props.role as any
    if (userRole.value) return userRole.value as any
    if (route.path.startsWith('/admin')) return 'admin'
    if (route.path.startsWith('/doctor')) return 'doctor'
    if (route.path.startsWith('/secretary')) return 'secretary'
    return 'patient'
  })

  const navBreakpointClass = computed(() => {
    return resolvedRole.value === 'doctor' ? 'lg:hidden' : 'md:hidden'
  })

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

  // Scan Action Detection (for Patient & Doctor)
  const scanItem = computed<NavItem | null>(() => {
    if (resolvedRole.value === 'admin' || resolvedRole.value === 'secretary') {
      return null
    }
    const found = props.items.find(item => item.to && /\/(patient|doctor)\/scan$/i.test(item.to))
    if (found) return found
    if (resolvedRole.value === 'patient') {
      return { icon: 'solar:camera-bold', label: 'Scan', to: '/patient/scan' }
    }
    if (resolvedRole.value === 'doctor') {
      return { icon: 'solar:camera-bold', label: 'Scan', to: '/doctor/scan' }
    }
    return null
  })

  const hasScanAction = computed(() => Boolean(scanItem.value))
  const isScanActive = computed(() => isPathActive(scanItem.value?.to))

  // Primary Tabs configuration per role
  const primaryTabs = computed<TabItem[]>(() => {
    const role = resolvedRole.value

    if (role === 'doctor') {
      return [
        { icon: 'solar:home-2-bold', label: 'Home', to: '/doctor', exact: true },
        { icon: 'solar:users-group-rounded-bold', label: 'Patients', to: '/doctor/patients' },
        {
          icon: 'solar:letter-bold',
          label: 'Messages',
          to: '/doctor/messages',
          badgeCount: totalUnreadCount.value
        }
      ]
    }

    if (role === 'patient') {
      return [
        { icon: 'solar:home-2-bold', label: 'Home', to: '/patient', exact: true },
        {
          icon: 'solar:letter-bold',
          label: 'Messages',
          to: '/patient/messages',
          badgeCount: totalUnreadCount.value
        },
        { icon: 'solar:folder-bold', label: 'Records', to: '/patient/records' }
      ]
    }

    if (role === 'admin') {
      const appealsBadge = Boolean(
        props.items.find(item => item.to === '/admin/appeals')?.showBadge
      )
      return [
        { icon: 'solar:home-2-bold', label: 'Home', to: '/admin', exact: true },
        { icon: 'solar:users-group-rounded-bold', label: 'Users', to: '/admin/moderation/users' },
        {
          icon: 'solar:danger-circle-bold',
          label: 'Appeals',
          to: '/admin/appeals',
          showBadge: appealsBadge
        },
        { icon: 'solar:database-bold', label: 'Dataset', to: '/admin/dataset' }
      ]
    }

    // Secretary
    return [
      { icon: 'solar:home-2-bold', label: 'Home', to: '/secretary', exact: true },
      { icon: 'solar:users-group-rounded-bold', label: 'Patients', to: '/secretary/patients' },
      { icon: 'solar:calendar-date-bold', label: 'Schedule', to: '/secretary/appointments' },
      {
        icon: 'solar:letter-bold',
        label: 'Messages',
        to: '/secretary/messages',
        badgeCount: totalUnreadCount.value
      }
    ]
  })

  const primaryPaths = computed(() => {
    const paths = new Set<string>(primaryTabs.value.map(tab => tab.to))
    if (scanItem.value?.to) {
      paths.add(scanItem.value.to)
    }
    return paths
  })

  // Calculate secondary items for the "More" slideover sheet
  const moreItems = computed<NavItem[]>(() => {
    const list: NavItem[] = []
    for (const rawItem of props.items) {
      if (rawItem.children && rawItem.children.length > 0) {
        const remainingChildren = rawItem.children.filter(
          child => !primaryPaths.value.has(child.to || '')
        )
        // If only 1 child remains in group, unwrap directly to a 1-tap item
        if (remainingChildren.length === 1) {
          list.push(remainingChildren[0]!)
        } else if (remainingChildren.length > 1) {
          list.push({
            ...rawItem,
            children: remainingChildren
          })
        }
      } else if (!primaryPaths.value.has(rawItem.to || '')) {
        list.push(rawItem)
      }
    }
    return list
  })

  const profileRoute = computed(() => `/${resolvedRole.value}/profile`)

  const hasMoreBadge = computed(() => {
    const flat = moreItems.value.flatMap(item => [item, ...(item.children || [])])
    return flat.some(item => item.showBadge)
  })

  const isMoreSheetOpen = ref(false)
  const expandedGroups = ref<Set<string>>(new Set())

  const isGroupActive = (item: NavItem): boolean => {
    return Boolean(item.children?.some(child => isPathActive(child.to)))
  }

  const isMoreTabActive = computed(() => {
    if (isMoreSheetOpen.value) return true
    const isPrimaryActive = primaryTabs.value.some(tab => isPathActive(tab.to, tab.exact))
    const isScan = isScanActive.value
    return (!isPrimaryActive && !isScan) || isPathActive(profileRoute.value)
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
    class="fixed inset-x-0 bottom-0 z-50"
    :class="navBreakpointClass"
    id="app-mobile-bottom-nav"
  >
    <div
      class="pb-safe relative border-t border-gray-100 bg-white px-2 pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] sm:px-6"
    >
      <div class="mx-auto grid max-w-2xl grid-cols-5 items-end">
        <!-- Primary Tabs -->
        <NuxtLink
          v-for="item in primaryTabs"
          :key="item.to"
          :to="item.to"
          class="relative flex flex-col items-center gap-0.5 py-2 transition-all active:scale-90"
          :class="isPathActive(item.to, item.exact) ? 'text-primary' : 'text-gray-400'"
        >
          <span class="relative">
            <Icon
              :name="item.icon"
              size="24"
            />
            <!-- Number badge (e.g. unread messages) -->
            <span
              v-if="item.badgeCount && item.badgeCount > 0"
              class="absolute -top-0.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-bold text-white"
            >
              {{ item.badgeCount > 99 ? '99+' : item.badgeCount }}
            </span>
            <!-- Ping badge (e.g. admin appeals) -->
            <span
              v-else-if="item.showBadge"
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
          <span class="text-[10px] font-bold tracking-wide">{{ item.label }}</span>
        </NuxtLink>

        <!-- More Tab Button (When role has Scan, More is slot 4; when no Scan, More is slot 5) -->
        <button
          type="button"
          id="app-mobile-more-button"
          class="flex cursor-pointer flex-col items-center gap-0.5 py-2 transition-all active:scale-90"
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

        <!-- Scan Action (Raised circle button on the right side if role has scan) -->
        <div
          v-if="hasScanAction && scanItem"
          class="flex flex-col items-center gap-0.5 pb-1 select-none"
        >
          <NuxtLink
            :to="scanItem.to"
            id="app-mobile-scan-action"
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
            >{{ scanItem.label }}</span
          >
        </div>
      </div>
    </div>
  </nav>

  <!-- Slide-up "More" Sheet (Universal for all roles) -->
  <Teleport to="body">
    <Transition name="mobile-sheet">
      <div
        v-if="isMoreSheetOpen"
        class="fixed inset-0 z-[60]"
        :class="navBreakpointClass"
      >
        <div
          class="bg-foreground/40 absolute inset-0 backdrop-blur-xs"
          @click="closeMoreSheet"
        ></div>

        <div
          class="mobile-sheet-panel pb-safe absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[28px] bg-white px-4 pt-3 pb-24 shadow-2xl"
        >
          <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200"></div>
          <div class="mb-3 flex items-center justify-between px-1">
            <div>
              <h2 class="text-foreground text-base font-black">More</h2>
              <p class="text-xs text-gray-500">Workspace navigation & tools</p>
            </div>
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
                    ? 'bg-primary/10 text-primary font-semibold'
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
                  v-if="item.badgeText"
                  class="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold"
                >
                  {{ item.badgeText }}
                </span>
                <span
                  v-else-if="item.showBadge"
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

            <!-- Profile Settings Link -->
            <li class="mt-1 border-t border-gray-100 pt-2">
              <NuxtLink
                :to="profileRoute"
                class="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors active:scale-[0.98]"
                :class="
                  isPathActive(profileRoute)
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground hover:bg-gray-50'
                "
              >
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  :class="isPathActive(profileRoute) ? 'bg-primary/15' : 'bg-gray-100'"
                >
                  <Icon
                    name="lucide:user"
                    size="18"
                  />
                </span>
                <span class="flex-1 text-sm font-semibold">Profile Settings</span>
                <Icon
                  name="lucide:chevron-right"
                  size="16"
                  class="text-gray-300"
                />
              </NuxtLink>
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

  .mobile-sheet-enter-active,
  .mobile-sheet-leave-active {
    transition: opacity 0.25s ease;
  }

  .mobile-sheet-enter-active .mobile-sheet-panel,
  .mobile-sheet-leave-active .mobile-sheet-panel {
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .mobile-sheet-enter-from,
  .mobile-sheet-leave-to {
    opacity: 0;
  }

  .mobile-sheet-enter-from .mobile-sheet-panel,
  .mobile-sheet-leave-to .mobile-sheet-panel {
    transform: translateY(100%);
  }
</style>
