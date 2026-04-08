<script setup lang="ts">
  const props = defineProps({
    title: String,
    breadcrumbs: {
      type: Array as () => Array<{ label: string; to?: string }>,
      default: () => []
    }
  })

  const token = useCookie('auth_token')
  const isLoggedIn = computed(() => !!token.value)
</script>

<template>
  <nav class="flex items-center justify-between bg-transparent px-4 py-2">
    <div class="flex w-full items-center gap-10">
      <NuxtLink
        v-if="!isLoggedIn"
        to="/"
      >
        <NuxtImg
          src="/DA_Logo.png"
          class="h-20"
        />
      </NuxtLink>
      <div
        v-else
        class="flex items-center"
      >
        <NuxtImg
          src="/DA_Logo.png"
          class="h-20 cursor-default"
        />
      </div>
      <div class="flex w-full items-center justify-between">
        <div class="flex flex-col gap-1">
          <!-- Breadcrumbs -->
          <nav
            v-if="breadcrumbs && breadcrumbs.length > 1"
            class="flex items-center gap-2 text-sm text-foreground/50"
            aria-label="Breadcrumb"
          >
            <template
              v-for="(breadcrumb, index) in breadcrumbs"
              :key="index"
            >
              <div class="flex items-center gap-2">
                <NuxtLink
                  v-if="breadcrumb.to && index < breadcrumbs.length - 1"
                  :to="breadcrumb.to"
                  class="hover:text-primary transition-colors"
                >
                  {{ breadcrumb.label }}
                </NuxtLink>
                <span v-else>{{ breadcrumb.label }}</span>
                
                <Icon
                  v-if="index < breadcrumbs.length - 1"
                  name="heroicons:chevron-right-20-solid"
                  size="14"
                  class="opacity-50"
                />
              </div>
            </template>
          </nav>

          <h2 class="text-3xl font-semibold">{{ title }}</h2>
        </div>
        <AppUtilityBar />
      </div>
    </div>

    <!-- if you want to add more items in the navbar aside from the title use the slot here-->
    <div class="flex items-center gap-5">
      <slot />
    </div>
  </nav>
</template>
