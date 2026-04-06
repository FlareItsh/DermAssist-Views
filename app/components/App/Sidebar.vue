<script setup lang="ts">
  interface NavItem {
    icon: string
    label: string
    to?: string
    children?: NavItem[]
  }

  const props = defineProps<{
    items?: NavItem[]
  }>()

  const isCollapsed = ref(true)
  const route = useRoute()
  const expandedMenus = ref<Set<string>>(new Set())

  const toggleSubmenu = (label: string) => {
    if (expandedMenus.value.has(label)) {
      expandedMenus.value.delete(label)
    } else {
      expandedMenus.value.add(label)
    }
  }

  const isSubmenuOpen = (label: string) => expandedMenus.value.has(label)

  const isItemActive = (item: NavItem): boolean => {
    if (item.to && route.path === item.to) return true
    if (item.children) {
      return item.children.some(child => isItemActive(child))
    }
    return false
  }

  const logout = async () => {
    try {
      await $api('logout', {
        method: 'POST'
      })
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      const token = useCookie('auth_token')
      token.value = null
      await navigateTo('/auth/login')
    }
  }
</script>

<template>
  <div class="relative z-50 w-32 shrink-0">
    <aside
      class="border-sidebar-border bg-sidebar absolute top-4 left-4 flex h-[85vh] flex-col justify-between gap-6 overflow-y-auto overflow-x-hidden shadow-2xl shadow-black/20 transition-all duration-500 ease-in-out scrollbar-hide"
      :class="isCollapsed ? 'w-24 rounded-4xl' : 'w-72 rounded-4xl'"
      @mouseenter="isCollapsed = false"
      @mouseleave="isCollapsed = true"
    >
      <div
        class="flex flex-col gap-2 px-3 transition-all duration-500 ease-in-out"
        :class="isCollapsed ? 'pt-6' : 'pt-6'"
      >
        <template v-for="item in props.items" :key="item.label">
          <!-- Main Link Item (No Children) -->
          <NuxtLink
            v-if="!item.children"
            :to="item.to"
            class="group hover:bg-sidebar-accent flex items-center rounded-full p-2 transition-all duration-300 active:scale-95"
            :class="[
              route.path === item.to ? 'bg-sidebar-accent' : '',
              isCollapsed ? 'w-14 justify-center mx-auto' : 'w-full justify-start'
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
                  route.path === item.to
                    ? 'text-sidebar-accent-foreground'
                    : 'text-foreground/70 group-hover:text-sidebar-accent-foreground'
                "
              />
            </div>

            <div
              class="grid transition-all duration-500"
              :class="
                isCollapsed ? 'ml-0 grid-cols-[0fr] opacity-0' : 'ml-4 grid-cols-[1fr] opacity-100'
              "
            >
              <span
                class="overflow-hidden text-lg font-medium whitespace-nowrap transition-colors duration-300"
                :class="
                  route.path === item.to
                    ? 'text-sidebar-accent-foreground'
                    : 'text-foreground/70 group-hover:text-sidebar-accent-foreground'
                "
              >
                {{ item.label }}
              </span>
            </div>
          </NuxtLink>

          <!-- Parent Item (Has Children) -->
          <div v-else class="flex flex-col gap-1">
            <button
              @click="toggleSubmenu(item.label)"
              class="group hover:bg-sidebar-accent flex items-center rounded-full p-2 transition-all duration-300 active:scale-95 cursor-pointer"
              :class="[
                isItemActive(item) ? 'bg-sidebar-accent/40' : '',
                isCollapsed ? 'w-14 justify-center mx-auto' : 'w-full justify-start'
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

              <div
                class="flex flex-1 items-center justify-between transition-all duration-500"
                :class="
                  isCollapsed ? 'ml-0 w-0 opacity-0' : 'ml-4 w-full opacity-100'
                "
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
                  name="heroicons:chevron-right-20-solid"
                  size="20"
                  class="text-foreground/50 transition-transform duration-300"
                  :class="{ 'rotate-90': isSubmenuOpen(item.label) }"
                />
              </div>
            </button>

            <!-- Submenu Items -->
            <div
              class="grid transition-all duration-300 ease-in-out"
              :class="[
                isSubmenuOpen(item.label) && !isCollapsed ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'
              ]"
            >
              <div class="flex flex-col gap-1 overflow-hidden pl-14">
                <NuxtLink
                  v-for="child in item.children"
                  :key="child.to"
                  :to="child.to"
                  class="group hover:bg-sidebar-accent/40 flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all duration-300 active:scale-95"
                  :class="route.path === child.to ? 'bg-sidebar-accent/60 text-sidebar-accent-foreground font-semibold' : 'text-foreground/80'"
                >
                  <Icon
                    :name="child.icon"
                    size="21"
                    class="transition-colors duration-300 group-hover:text-sidebar-accent-foreground"
                    :class="route.path === child.to ? 'text-sidebar-accent-foreground' : 'text-foreground/40'"
                  />
                  <span class="text-[15px] whitespace-nowrap transition-colors duration-300 group-hover:text-sidebar-accent-foreground">
                    {{ child.label }}
                  </span>
                </NuxtLink>
              </div>
            </div>
          </div>
        </template>

      </div>

      <!-- Logout -->
      <div
        class="flex flex-col gap-6 px-3 transition-all duration-500 ease-in-out"
        :class="isCollapsed ? 'pb-10' : 'pb-6'"
      >
        <button
          @click="logout"
          class="group hover:bg-destructive/10 flex items-center gap-0 rounded-full p-2 transition-all duration-300 active:scale-95"
        >
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <Icon
              name="ic:round-log-out"
              size="34"
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
        </button>
      </div>
    </aside>
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

