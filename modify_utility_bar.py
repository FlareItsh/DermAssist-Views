import re

with open('/opt/lampp/htdocs/DermAssist/views/app/components/App/UtilityBar.vue', 'r') as f:
    content = f.read()

# I will replace everything between 'const isPatientProfileIncomplete = computed(() => {'
# and the end of 'const notifications = computed<AppNotification[]>(() => { ... })'
# Actually, it's safer to just import useAppNotifications and use it.

start_str = """  /**
   * Check if a patient profile is considered incomplete"""
end_str = """    return list.filter(n => !(dismissedNotifs.value || []).includes(n.id))
  })"""

if start_str in content and end_str in content:
    start_idx = content.find(start_str)
    end_idx = content.find(end_str) + len(end_str)
    
    replacement = """  const {
    notifications,
    unreadNotifications,
    dismissedNotifs,
    readNotifs,
    isPatientProfileIncomplete,
    isDoctorProfileIncomplete
  } = await useAppNotifications()"""
    
    new_content = content[:start_idx] + replacement + content[end_idx:]
    
    # We also need to update markAllNotificationsRead, handleNotificationClick and handleNotificationDelete to use readNotifs instead of dismissedNotifs
    
    # Let's fix handleNotificationClick
    new_content = new_content.replace("""    // Auto-dismiss dismissable notifications on click
    if (typeof notif.id === 'string') {
      const arr = dismissedNotifs.value || []
      if (!arr.includes(notif.id)) {
        arr.push(notif.id)
        dismissedNotifs.value = arr
      }
    }""", """    // Auto-mark as read on click
    if (typeof notif.id === 'string') {
      const arr = readNotifs.value || []
      if (!arr.includes(notif.id)) {
        arr.push(notif.id)
        readNotifs.value = arr
      }
    }""")
    
    # handleNotificationDelete
    new_content = new_content.replace("""  const handleNotificationDelete = (id: string | number) => {
    const arr = dismissedNotifs.value || []
    if (!arr.includes(id)) {
      arr.push(id)
      dismissedNotifs.value = arr
    }
  }""", """  const handleNotificationDelete = (id: string | number) => {
    const arr = dismissedNotifs.value || []
    if (!arr.includes(id)) {
      arr.push(id)
      dismissedNotifs.value = arr
    }
  }""") # Wait, delete is dismissedNotifs, so this is correct.
    
    # markAllNotificationsRead
    new_content = new_content.replace("""  const markAllNotificationsRead = () => {
    const arr = dismissedNotifs.value || []
    notifications.value.forEach(n => {
      if (!arr.includes(n.id)) arr.push(n.id)
    })
    dismissedNotifs.value = arr
  }""", """  const markAllNotificationsRead = () => {
    const arr = readNotifs.value || []
    notifications.value.forEach(n => {
      if (!arr.includes(n.id)) arr.push(n.id)
    })
    readNotifs.value = arr
  }""")
    
    # Update HTML: "View all activity" button link
    new_content = new_content.replace("""              <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
                class="text-card hover:text-foreground/40 w-full cursor-pointer py-2 text-sm font-bold transition-colors"
              >
                View all activity
              </AppButton>""", """              <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
                class="text-card hover:text-foreground/40 w-full cursor-pointer py-2 text-sm font-bold transition-colors"
                @click="navigateTo('/notifications'); isNotificationsOpen = false"
              >
                View all activity
              </AppButton>""")
              
    # Update unread badge logic for notifications
    # Currently it just checks `notifications.length > 0`, but it should use `unreadNotifications.length > 0`
    new_content = new_content.replace("""          <span
            v-if="notifications.length > 0"
            class="absolute top-3 right-3 flex h-3 w-3"
          >""", """          <span
            v-if="unreadNotifications.length > 0"
            class="absolute top-3 right-3 flex h-3 w-3"
          >""")
          
    # also loop through unreadNotifications if we only show unread?
    # the existing logic shows `notifications`. We can leave it to show `notifications` but badge based on `unread`.
    
    with open('/opt/lampp/htdocs/DermAssist/views/app/components/App/UtilityBar.vue', 'w') as f:
        f.write(new_content)
    print("Done")
else:
    print("Could not find start or end string")
