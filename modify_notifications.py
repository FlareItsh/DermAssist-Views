import re

with open('/opt/lampp/htdocs/DermAssist/views/app/pages/notifications.vue', 'r') as f:
    content = f.read()

# Add states for modal
script_addition = """
const selectedNotification = ref<any>(null)
const isModalOpen = ref(false)

const closeModal = () => {
  isModalOpen.value = false
  setTimeout(() => {
    selectedNotification.value = null
  }, 200)
}
"""

content = content.replace("const currentFilter = ref('all') // 'all', 'unread', 'read'", script_addition + "\nconst currentFilter = ref('all') // 'all', 'unread', 'read'")

# Modify handleNotificationClick
old_click = """const handleNotificationClick = (notif: any) => {
  if (typeof notif.id === 'string' || typeof notif.id === 'number') {
    const arr = readNotifs.value || []
    if (!arr.includes(notif.id)) {
      arr.push(notif.id)
      readNotifs.value = arr
    }
  }
}"""

new_click = """const handleNotificationClick = (notif: any) => {
  if (typeof notif.id === 'string' || typeof notif.id === 'number') {
    const arr = readNotifs.value || []
    if (!arr.includes(notif.id)) {
      arr.push(notif.id)
      readNotifs.value = arr
    }
  }
  selectedNotification.value = notif
  isModalOpen.value = true
}"""

content = content.replace(old_click, new_click)

# Add Modal to template
modal_html = """
    <!-- Notification Details Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" @click.self="closeModal">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="closeModal"></div>
          
          <!-- Modal Content -->
          <div class="relative w-full max-w-lg overflow-hidden rounded-3xl bg-card border border-border/50 shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-border/50 p-6 pb-4">
              <h2 class="text-xl font-bold">Notification Details</h2>
              <button @click="closeModal" class="text-muted-foreground hover:bg-secondary/20 rounded-full p-2 transition-colors">
                <Icon name="heroicons:x-mark-20-solid" size="24" />
              </button>
            </div>
            
            <!-- Body -->
            <div class="p-6 flex flex-col gap-5" v-if="selectedNotification">
              <div class="flex items-start gap-4">
                <div 
                  class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  :class="selectedNotification.color + ' bg-current bg-opacity-10'"
                >
                  <Icon :name="selectedNotification.icon" class="text-3xl" />
                </div>
                <div class="flex-1 min-w-0 pt-1">
                  <h3 class="text-lg font-bold text-foreground leading-tight">{{ selectedNotification.title }}</h3>
                  <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1 block">{{ selectedNotification.time }}</span>
                </div>
              </div>
              
              <div class="bg-secondary/5 rounded-2xl p-5 border border-border/30">
                <p class="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{{ selectedNotification.description }}</p>
              </div>
            </div>
            
            <!-- Footer -->
            <div class="border-t border-border/50 bg-secondary/5 p-6 flex justify-end gap-3">
              <AppButton @click="closeModal" variant="outline" class="rounded-xl">Close</AppButton>
              <AppButton 
                v-if="selectedNotification?.to" 
                @click="navigateTo(selectedNotification.to); closeModal()" 
                class="rounded-xl font-bold shadow-md"
              >
                Go to Details
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
"""

content = content.replace("  </div>\n</template>", modal_html)

# Now we need to remove the "NuxtLink" behavior from AppNotificationPreview because it will try to navigate on click.
# AppNotificationPreview uses `to` prop. If we pass `to`, it becomes a NuxtLink.
# We can just omit passing `to` to `AppNotificationPreview` in `notifications.vue`.
# Instead of `v-bind="notif"`, we can bind everything except `to`.
# Wait, `v-bind="{ ...notif, to: undefined }"` is easy.

vbind_old = """          <AppNotificationPreview 
            v-bind="notif"
            class="bg-card rounded-2xl border border-border/20 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            @click="handleNotificationClick(notif)"
            @delete="handleNotificationDelete(notif.id)"
          />"""

vbind_new = """          <AppNotificationPreview 
            v-bind="{ ...notif, to: undefined }"
            class="bg-card rounded-2xl border border-border/20 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            @click="handleNotificationClick(notif)"
            @delete="handleNotificationDelete(notif.id)"
          />"""

content = content.replace(vbind_old, vbind_new)

with open('/opt/lampp/htdocs/DermAssist/views/app/pages/notifications.vue', 'w') as f:
    f.write(content)
print("Done")
