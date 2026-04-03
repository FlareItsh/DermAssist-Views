<script setup lang="ts">
  const props = defineProps<{
    items?: Array<{
      icon: string
      label: string
      to: string
    }>
  }>()

  const isCollapsed = ref(true)
  const route = useRoute()

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
  <aside
    class="border-sidebar-border bg-sidebar m-4 flex h-[80vh] flex-col justify-between gap-10 overflow-hidden shadow-2xl shadow-black/20 transition-all duration-500 ease-in-out"
    :class="isCollapsed ? 'w-24 rounded-4xl' : 'w-72 rounded-4xl'"
    @mouseenter="isCollapsed = false"
    @mouseleave="isCollapsed = true"
  >
    <div
      class="flex flex-col gap-6 px-4 transition-all duration-500 ease-in-out"
      :class="isCollapsed ? 'pt-6' : 'pt-6'"
    >
      <NuxtLink
        v-for="item in props.items"
        :key="item.to"
        :to="item.to"
        class="group hover:bg-sidebar-accent flex items-center gap-0 rounded-full p-2 transition-all duration-300 active:scale-95"
        :class="{ 'bg-sidebar-accent': route.path === item.to }"
      >
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all duration-300"
        >
          <Icon
            :name="item.icon"
            size="48"
            class="transition-colors duration-300"
            :class="
              route.path === item.to
                ? 'text-sidebar-accent-foreground'
                : 'text-foreground group-hover:text-sidebar-accent-foreground'
            "
          />
        </div>

        <div
          class="grid transition-all duration-500"
          :class="
            isCollapsed ? 'ml-0 grid-cols-[0fr] opacity-0' : 'ml-5 grid-cols-[1fr] opacity-100'
          "
        >
          <span
            class="overflow-hidden text-xl font-medium whitespace-nowrap transition-colors duration-300"
            :class="
              route.path === item.to
                ? 'text-sidebar-accent-foreground'
                : 'text-foreground group-hover:text-sidebar-accent-foreground'
            "
          >
            {{ item.label }}
          </span>
        </div>
      </NuxtLink>
    </div>

    <!--Logout-->
    <div
      class="flex flex-col gap-6 px-4 transition-all duration-500 ease-in-out"
      :class="isCollapsed ? 'pb-10' : 'pb-6'"
    >
      <button
        @click="logout"
        class="group hover:bg-destructive/10 flex items-center gap-0 rounded-full p-2 transition-all duration-300 active:scale-95"
      >
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <Icon
            name="ic:round-log-out"
            size="48"
            class="text-destructive transition-transform duration-300 group-hover:scale-110"
          />
        </div>

        <div
          class="grid transition-all duration-500"
          :class="
            isCollapsed ? 'ml-0 grid-cols-[0fr] opacity-0' : 'ml-5 grid-cols-[1fr] opacity-100'
          "
        >
          <span class="text-destructive overflow-hidden text-xl font-medium whitespace-nowrap">
            Logout
          </span>
        </div>
      </button>
    </div>
  </aside>
</template>
