<script setup lang="ts">
  import { authService } from '~/api/auth/AuthService'
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
    items?: NavItem[]
  }>()

  const isCollapsed = ref(true)
  const route = useRoute()
  const expandedMenus = ref<Set<string>>(new Set())
  const isLogoutModalOpen = ref(false)

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

  const isItemActive = (item: NavItem): boolean => {
    if (isPathActive(item.to)) return true
    if (item.children) {
      return item.children.some(child => isItemActive(child))
    }
    return false
  }

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

                <!-- Pulsing Notification Beacon on Icon -->
                <span
                  v-if="item.showBadge"
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
                <div class="flex items-center gap-2 overflow-hidden whitespace-nowrap">
                  <span
                    class="text-lg font-medium transition-colors duration-300"
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

                  <!-- NEW Badge Capsule -->
                  <span
                    v-if="item.badgeText"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tracking-wider uppercase shadow-xs transition-colors duration-300"
                    :class="[
                      isItemActive(item)
                        ? 'bg-white/20 text-white'
                        : 'bg-primary/15 text-primary border-primary/20 group-hover:text-primary border group-hover:border-transparent group-hover:bg-white'
                    ]"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      :class="[
                        isItemActive(item) ? 'bg-white' : 'bg-primary group-hover:bg-primary'
                      ]"
                    ></span>
                    {{ item.badgeText }}
                  </span>
                </div>
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
                  isItemActive(item) ? 'bg-sidebar-accent/40' : '',
                  isCollapsed ? 'mx-auto w-14 justify-center' : 'w-full justify-start'
                ]"
              >
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300"
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
                </div>

                <!-- Notification Dot for parents -->
                <div
                  v-if="item.showBadge"
                  class="border-sidebar absolute top-2 right-2 h-3 w-3 rounded-full border-2 bg-red-500"
                  :class="isCollapsed ? 'right-4' : 'right-auto left-8'"
                ></div>

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
                    class="text-foreground/50 transition-transform duration-300"
                    :class="{ 'rotate-90': isSubmenuOpen(item.label) }"
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
                        isItemActive(child)
                          ? 'bg-sidebar-accent/60 text-sidebar-accent-foreground font-semibold'
                          : 'text-foreground/80'
                      "
                    >
                      <Icon
                        :name="child.icon"
                        size="18"
                        class="group-hover:text-sidebar-accent-foreground transition-colors duration-300"
                        :class="
                          isItemActive(child)
                            ? 'text-sidebar-accent-foreground'
                            : 'text-foreground/40'
                        "
                      />
                      <!-- Notification Dot for children -->
                      <div
                        v-if="child.showBadge"
                        class="h-2 w-2 shrink-0 rounded-full bg-red-500"
                      ></div>
                      <span
                        class="group-hover:text-sidebar-accent-foreground text-[15px] whitespace-nowrap transition-colors duration-300"
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
</style>
