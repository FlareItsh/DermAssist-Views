import { useState } from '#app'

export const usePriorityList = () => {
  const userUuid = useCookie('user_uuid')
  
  // Store all priority lists in one cookie map: { [uuid]: string[] }
  const allPriorityLists = useCookie<Record<string, string[]>>('dermassist_priority_storage', {
    default: () => ({}),
    maxAge: 60 * 60 * 24 * 7 // 1 week
  })

  // Computed for the current user's list
  const priorityIds = computed({
    get: () => {
      const uuid = userUuid.value || 'guest'
      return allPriorityLists.value[uuid] || []
    },
    set: (val) => {
      const uuid = userUuid.value || 'guest'
      allPriorityLists.value = {
        ...allPriorityLists.value,
        [uuid]: val
      }
    }
  })

  const addToPriority = (id: string) => {
    if (!priorityIds.value.includes(id)) {
      priorityIds.value = [...priorityIds.value, id]
    }
  }

  const removeFromPriority = (id: string) => {
    priorityIds.value = priorityIds.value.filter(pid => pid !== id)
  }

  const isInPriority = (id: string) => {
    return priorityIds.value.includes(id)
  }

  return {
    priorityIds,
    addToPriority,
    removeFromPriority,
    isInPriority
  }
}

