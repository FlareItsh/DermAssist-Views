import { ref, computed } from 'vue'
import { useCookie } from '#app'
import { patchNoteService, type PatchNote } from '~/api/patchNote/PatchNoteService'

// Module-level singleton state so all components share the fetched patch notes
const publishedPatchNotes = ref<PatchNote[]>([])
const isPatchNotesLoaded = ref(false)
const isLoadingPatchNotes = ref(false)

export const usePatchNotes = () => {
  const userUuid = useCookie('user_uuid')

  const lastSeenPatchNoteToken = useCookie<string | null>(
    `last_seen_patch_note_${userUuid.value || 'guest'}`,
    {
      default: () => null,
      maxAge: 60 * 60 * 24 * 365
    }
  )

  const getNoteToken = (note: PatchNote | null | undefined): string => {
    if (!note) return ''
    return `${note.uuid || note.id || ''}_${note.published_at || note.created_at || note.version || ''}`
  }

  const latestPatchNote = computed<PatchNote | null>(() => {
    if (publishedPatchNotes.value && publishedPatchNotes.value.length > 0) {
      return publishedPatchNotes.value[0]
    }
    return null
  })

  const hasUnseenUpdate = computed<boolean>(() => {
    if (!latestPatchNote.value) return false
    const currentToken = getNoteToken(latestPatchNote.value)
    if (!currentToken) return false
    return lastSeenPatchNoteToken.value !== currentToken
  })

  const fetchPublishedPatchNotes = async (force = false): Promise<PatchNote[]> => {
    if (isPatchNotesLoaded.value && !force && publishedPatchNotes.value.length > 0) {
      return publishedPatchNotes.value
    }

    if (isLoadingPatchNotes.value) {
      return publishedPatchNotes.value
    }

    isLoadingPatchNotes.value = true
    try {
      const res = await patchNoteService.getPublished()
      if (res?.status === 'success') {
        publishedPatchNotes.value = res.data || []
        isPatchNotesLoaded.value = true
      }
    } catch (err) {
      console.error('Failed to fetch published patch notes:', err)
    } finally {
      isLoadingPatchNotes.value = false
    }

    return publishedPatchNotes.value
  }

  const markLatestUpdateAsSeen = (targetNote?: PatchNote | null) => {
    const note = targetNote || latestPatchNote.value
    if (!note) return
    const token = getNoteToken(note)
    if (token) {
      lastSeenPatchNoteToken.value = token
    }
  }

  return {
    publishedPatchNotes,
    isPatchNotesLoaded,
    isLoadingPatchNotes,
    latestPatchNote,
    hasUnseenUpdate,
    lastSeenPatchNoteToken,
    getNoteToken,
    fetchPublishedPatchNotes,
    markLatestUpdateAsSeen
  }
}
