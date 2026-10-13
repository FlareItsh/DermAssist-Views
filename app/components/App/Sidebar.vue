<script setup lang="ts">
  import { authService } from '~/api/auth/AuthService'
  interface NavItem {
    icon: string
    label: string
    to?: string
    showBadge?: boolean
    badgeText?: string
    badgeCount?: number
    highlight?: boolean
    children?: NavItem[]
  }

  const props = defineProps<{
    items?: NavItem[]
  }>()

  const isCollapsed = ref(true)
  const route = useRoute()
  const expandedMenus = ref<Set<string>>(new Set())
  const isLogoutModalOpen = ref(false)

  const getItemBadgeCount = (item: NavItem): number => {
    if (typeof item.badgeCount === 'number' && item.badgeCount > 0) return item.badgeCount
    if (item.children && item.children.length > 0) {
      return item.children.reduce((sum, child) => sum + (child.badgeCount || 0), 0)
    }
    return 0
  }

  const getItemHasBadge = (item: NavItem): boolean => {
    if (item.showBadge || (typeof item.badgeCount === 'number' && item.badgeCount > 0)) return true
    if (item.children && item.children.length > 0) {
      return item.children.some(
        child => child.showBadge || (typeof child.badgeCount === 'number' && child.badgeCount > 0)
      )
    }
    return false
  }

  const formatBadgeCount = (count: number): string => {
    if (count > 99) return '99+'
    return String(count)
  }

  const toggleSubmenu = (label: string) => {
    if (expandedMenus.value.has(label)) {
      expandedMenus.value.delete(label)
    } else {
      expandedMenus.value.add(label)
    }
  }

  const isSubmenuOpen = (label: string) => expandedMenus.value.has(label)

  const normalizePath = (path?: string) => {
    if (!path) return ''
    return path.replace(/\/+$/, '').toLowerCase() || '/'
  }

  const isPathActive = (to?: string): boolean => {
    const itemPath = normalizePath(to)
    const currentPath = normalizePath(route.path)

    if (!itemPath) return false
    if (itemPath === '/') return currentPath === '/'
    if (currentPath === itemPath) return true
    if (['/admin', '/doctor', '/patient'].includes(itemPath)) return false

    return currentPath.startsWith(`${itemPath}/`)
  }

  const isChildActive = (child: NavItem, parent?: NavItem): boolean => {
    const childPath = normalizePath(child.to)
    const currentPath = normalizePath(route.path)

    if (!childPath) return false
    if (currentPath === childPath) return true

    if (parent?.children) {
      const hasMoreSpecificSibling = parent.children.some(sibling => {
        if (sibling === child) return false
        const siblingPath = normalizePath(sibling.to)
        if (!siblingPath) return false
        if (currentPath === siblingPath) return true
        return currentPath.startsWith(`${siblingPath}/`) && siblingPath.length > childPath.length
      })
      if (hasMoreSpecificSibling) return false
    }

    if (['/admin', '/doctor', '/patient'].includes(childPath)) return false
    return currentPath.startsWith(`${childPath}/`)
  }

  const isItemActive = (item: NavItem): boolean => {
    if (isPathActive(item.to)) return true
    if (item.children) {
      return item.children.some(child => isChildActive(child, item))
    }
    return false
  }

  const autoExpandActiveSubmenus = () => {
    if (!props.items) return
    for (const item of props.items) {
      if (item.children && item.children.some(child => isChildActive(child, item))) {
        expandedMenus.value.add(item.label)
      }
    }
  }

  watch(
    () => props.items,
    () => {
      autoExpandActiveSubmenus()
    },
    { immediate: true }
  )

  watch(
    () => route.path,
    () => {
      autoExpandActiveSubmenus()
    }
  )

  const triggerLogout = () => {
    isLogoutModalOpen.value = true
  }

  const logout = async () => {
    isLogoutModalOpen.value = false
    try {
      await authService.logout()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      useDiagnosis().resetScanner()
      useCookie('auth_token').value = null
      useCookie('user_role').value = null
      useCookie('user_uuid').value = null
      useCookie('user_name').value = null
      useCookie('auth_user_name').value = null
      await navigateTo('/auth/login')
    }
  }
</script>

<template>
  <div class="relative z-50 w-32 shrink-0">
    <aside
      class="border-sidebar-border bg-sidebar scrollbar-hide absolute top-4 left-4 flex h-[85vh] flex-col justify-between gap-6 overflow-x-hidden overflow-y-auto shadow-2xl shadow-black/20 transition-all duration-500 ease-in-out"
      :class="isCollapsed ? 'w-24 rounded-4xl' : 'w-72 rounded-4xl'"
      @mouseenter="isCollapsed = false"
      @mouseleave="isCollapsed = true"
    >
      <nav
        class="flex flex-col gap-2 px-3 transition-all duration-500 ease-in-out"
        :class="isCollapsed ? 'pt-6' : 'pt-6'"
      >
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          <li
            v-for="item in props.items"
            :key="item.label"
          >
            <!-- Main Link Item (No Children) -->
            <NuxtLink
              v-if="!item.children"
              :to="item.to"
              class="group hover:bg-sidebar-accent relative flex items-center rounded-full p-2 transition-all duration-300 active:scale-95"
              :class="[
                isItemActive(item) ? 'bg-sidebar-accent' : '',
                item.highlight && !isItemActive(item) ? 'bg-primary/5 hover:bg-sidebar-accent' : '',
                isCollapsed ? 'mx-auto w-14 justify-center' : 'w-full justify-start'
              ]"
            >
              <div
                class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300"
                :class="[
                  item.highlight && !isItemActive(item)
                    ? 'bg-primary/10 text-primary group-hover:bg-white/20'
                    : ''
                ]"
              >
                <Icon
                  :name="item.icon"
                  size="34"
                  class="transition-all duration-300"
                  :class="[
                    isItemActive(item)
                      ? 'text-sidebar-accent-foreground'
                      : item.highlight
                        ? 'text-primary group-hover:text-sidebar-accent-foreground group-hover:scale-110 group-hover:-rotate-12'
                        : 'text-foreground/70 group-hover:text-sidebar-accent-foreground'
                  ]"
                />

                <!-- Popping Notification Badge with Number in the Middle -->
                <span
                  v-if="getItemBadgeCount(item) > 0"
                  class="badge-pop absolute -top-1 -right-1 z-10 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-black text-white shadow-xs"
                >
                  {{ formatBadgeCount(getItemBadgeCount(item)) }}
                </span>
                <!-- Fallback Pulsing Beacon if showBadge without count -->
                <span
                  v-else-if="getItemHasBadge(item)"
                  class="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5"
                >
                  <span
                    class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
                  ></span>
                  <span
                    class="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 shadow-xs"
                  ></span>
                </span>
              </div>

              <div
                class="grid transition-all duration-500"
                :class="
                  isCollapsed
                    ? 'ml-0 grid-cols-[0fr] opacity-0'
                    : 'ml-4 grid-cols-[1fr] opacity-100'
                "
              >
                <span
                  class="overflow-hidden text-lg font-medium whitespace-nowrap transition-colors duration-300"
                  :class="[
                    isItemActive(item)
                      ? 'text-sidebar-accent-foreground'
                      : item.highlight
                        ? 'text-primary group-hover:text-sidebar-accent-foreground font-semibold'
                        : 'text-foreground/70 group-hover:text-sidebar-accent-foreground'
                  ]"
                >
                  {{ item.label }}
                </span>
              </div>
            </NuxtLink>

            <!-- Parent Item (Has Children) -->
            <div
              v-else
              class="flex flex-col gap-1"
            >
              <AppButton
                variant="unstyled"
                size="unstyled"
                rounded="unstyled"
                @click="toggleSubmenu(item.label)"
                class="group hover:bg-sidebar-accent flex cursor-pointer items-center rounded-full p-2 transition-all duration-300 active:scale-95"
                :class="[
                  isItemActive(item) ? 'bg-sidebar-accent shadow-xs' : '',
                  isCollapsed ? 'mx-auto w-14 justify-center' : 'w-full justify-start'
                ]"
              >
                <div
                  class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300"
                >
                  <Icon
                    :name="item.icon"
                    size="34"
                    class="transition-colors duration-300"
                    :class="
                      isItemActive(item)
                        ? 'text-sidebar-accent-foreground'
                        : 'text-foreground/70 group-hover:text-sidebar-accent-foreground'
                    "
                  />

                  <!-- Popping Notification Badge with Number in the Middle (Aggregated) -->
                  <span
                    v-if="getItemBadgeCount(item) > 0"
                    class="badge-pop absolute -top-1 -right-1 z-10 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-black text-white shadow-xs"
                  >
                    {{ formatBadgeCount(getItemBadgeCount(item)) }}
                  </span>
                  <!-- Fallback Pulsing Beacon if showBadge without count -->
                  <span
                    v-else-if="getItemHasBadge(item)"
                    class="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5"
                  >
                    <span
                      class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
                    ></span>
                    <span
                      class="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 shadow-xs"
                    ></span>
                  </span>
                </div>

                <div
                  class="flex flex-1 items-center justify-between transition-all duration-500"
                  :class="isCollapsed ? 'ml-0 w-0 opacity-0' : 'ml-4 w-full opacity-100'"
                >
                  <span
                    class="overflow-hidden text-lg font-medium whitespace-nowrap transition-colors duration-300"
                    :class="
                      isItemActive(item)
                        ? 'text-sidebar-accent-foreground'
                        : 'text-foreground/70 group-hover:text-sidebar-accent-foreground'
                    "
                  >
                    {{ item.label }}
                  </span>
                  <Icon
                    name="lucide:chevron-right"
                    size="18"
                    class="transition-transform duration-300"
                    :class="[
                      isItemActive(item)
                        ? 'text-sidebar-accent-foreground'
                        : 'text-foreground/50 group-hover:text-sidebar-accent-foreground',
                      { 'rotate-90': isSubmenuOpen(item.label) }
                    ]"
                  />
                </div>
              </AppButton>

              <!-- Submenu Items -->
              <div
                class="grid transition-all duration-300 ease-in-out"
                :class="[
                  isSubmenuOpen(item.label) && !isCollapsed
                    ? 'mt-1 grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                ]"
              >
                <ul class="m-0 flex list-none flex-col gap-1 overflow-hidden p-0 pl-14">
                  <li
                    v-for="child in item.children"
                    :key="child.to"
                  >
                    <NuxtLink
                      :to="child.to"
                      class="group hover:bg-sidebar-accent/40 flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all duration-300 active:scale-95"
                      :class="
                        isChildActive(child, item)
                          ? 'bg-sidebar-accent/60 text-sidebar-accent-foreground font-semibold'
                          : 'text-foreground/80'
                      "
                    >
                      <div class="relative flex items-center justify-center">
                        <Icon
                          :name="child.icon"
                          size="18"
                          class="group-hover:text-sidebar-accent-foreground transition-colors duration-300"
                          :class="
                            isChildActive(child, item)
                              ? 'text-sidebar-accent-foreground'
                              : 'text-foreground/40'
                          "
                        />
                        <!-- Submenu Child Notification Badge strictly on the Icon -->
                        <span
                          v-if="getItemBadgeCount(child) > 0"
                          class="badge-pop absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-white bg-red-500 px-0.5 text-[8px] font-black text-white shadow-xs"
                        >
                          {{ formatBadgeCount(getItemBadgeCount(child)) }}
                        </span>
                        <div
                          v-else-if="getItemHasBadge(child)"
                          class="absolute -top-0.5 -right-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500"
                        ></div>
                      </div>
                      <span
                        class="group-hover:text-sidebar-accent-foreground text-[15px] whitespace-nowrap transition-colors duration-300"
                        :class="
                          isChildActive(child, item)
                            ? 'text-sidebar-accent-foreground font-semibold'
                            : ''
                        "
                      >
                        {{ child.label }}
                      </span>
                    </NuxtLink>
                  </li>
                </ul>
              </div>
            </div>
          </li>
        </ul>
      </nav>

      <!-- Logout -->
      <div
        class="flex flex-col gap-6 px-3 transition-all duration-500 ease-in-out"
        :class="isCollapsed ? 'pb-10' : 'pb-6'"
      >
        <AppButton
          variant="unstyled"
          size="unstyled"
          rounded="unstyled"
          @click="triggerLogout"
          class="group hover:bg-destructive/10 flex items-center gap-0 rounded-full p-2 transition-all duration-300 active:scale-95"
        >
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <Icon
              name="lucide:log-out"
              size="28"
              class="text-destructive transition-transform duration-300 group-hover:scale-110"
            />
          </div>

          <div
            class="grid transition-all duration-500"
            :class="
              isCollapsed ? 'ml-0 grid-cols-[0fr] opacity-0' : 'ml-4 grid-cols-[1fr] opacity-100'
            "
          >
            <span class="text-destructive overflow-hidden text-lg font-medium whitespace-nowrap">
              Logout
            </span>
          </div>
        </AppButton>
      </div>
    </aside>

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="isLogoutModalOpen"
          class="bg-foreground/40 fixed inset-0 z-[999] flex items-center justify-center p-4"
          @click.self="isLogoutModalOpen = false"
        >
          <AppModalLogoutConfirmation
            @close="isLogoutModalOpen = false"
            @confirm="logout"
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  @keyframes badge-pop {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    70% {
      transform: scale(1.2);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .badge-pop {
    animation: badge-pop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
</style>
