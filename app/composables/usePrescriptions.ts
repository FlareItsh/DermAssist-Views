import { computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { recordService } from '~/api/record/RecordService'
import {
  medicationLogService,
  type MedicationAdherenceStatus
} from '~/api/medication-log/MedicationLogService'

export interface ParsedMedicationItem {
  key: string
  medication: string
  quantity: string | null
  frequency: string | null
  duration: string | null
  instructions: string | null
  isExpired: boolean
}

export interface PrescriptionRecordEntry {
  key: string
  noteId?: number | null
  diagnosisUuid: string | null
  prescriptionNumber: string
  conditionLabel: string
  doctorName: string
  dateFormatted: string
  rawDate: string
  timestamp: number
  rawPrescription: string
  patientEducation: string | null
  items: ParsedMedicationItem[]
}

export interface PendingTodayMedication {
  prescriptionKey: string
  prescriptionNumber: string
  doctorName: string
  conditionLabel: string
  item: ParsedMedicationItem
}

export const getTodayDateString = (): string => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Checks whether a medication's prescribed duration (e.g. "7 days", "2 weeks")
 * has already elapsed relative to the prescription's issued date.
 */
export const isMedicationExpired = (
  rawIssuedDate?: string | null,
  durationStr?: string | null
): boolean => {
  if (!rawIssuedDate || !durationStr) return false
  const dur = durationStr.trim().toLowerCase()
  if (!dur) return false

  const numMatch = dur.match(/(\d+)/)
  let totalDays: number | null = null

  if (numMatch && numMatch[1]) {
    const n = parseInt(numMatch[1], 10)
    if (!isNaN(n) && n > 0) {
      if (/month/i.test(dur)) {
        totalDays = n * 30
      } else if (/week/i.test(dur)) {
        totalDays = n * 7
      } else {
        totalDays = n
      }
    }
  } else if (/week/i.test(dur)) {
    totalDays = 7
  } else if (/month/i.test(dur)) {
    totalDays = 30
  }

  if (totalDays === null) return false

  const issued = new Date(rawIssuedDate)
  if (isNaN(issued.getTime())) return false

  // Reset both to start of day for inclusive day window check
  const startOfIssued = new Date(issued.getFullYear(), issued.getMonth(), issued.getDate())
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const elapsedDays = Math.floor(
    (startOfToday.getTime() - startOfIssued.getTime()) / (1000 * 60 * 60 * 24)
  )

  return elapsedDays >= totalDays
}

export const parsePrescriptionText = (
  text: string,
  rawIssuedDate?: string | null
): ParsedMedicationItem[] => {
  const trimmed = (text || '').trim()
  if (!trimmed) return []

  const lines = trimmed.split(/\r\n|\r|\n/)
  const items: ParsedMedicationItem[] = []
  const freqCodeRegex = /^(OD|BID|TID|QID|QOD|PRN|HS|STAT|Q\d+H|1X|2X|3X|4X)$/i

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const cleanLine = line.replace(/^[•\-\*\d\.\)\s]+/u, '').trim()
    if (!cleanLine) continue

    let rawMed = cleanLine
    let sigSegment: string | null = null

    if (cleanLine.includes('—')) {
      const parts = cleanLine.split('—')
      rawMed = (parts[0] || '').trim()
      sigSegment = parts.slice(1).join('—').trim()
    } else if (cleanLine.includes(' - ')) {
      const parts = cleanLine.split(' - ')
      rawMed = (parts[0] || '').trim()
      sigSegment = parts.slice(1).join(' - ').trim()
    }

    let quantity: string | null = null
    let cleanMed = rawMed

    const medHashMatch = rawMed.match(/(?:^|\s)#\s*([0-9a-zA-Z\s\(\)\.\/\-]+)$/i)
    const medQtyBracketMatch = rawMed.match(
      /[\(\[]\s*(?:Qty|Dispense|Disp)[\:\s]*([^\)\]]+)[\)\]]/i
    )

    if (medHashMatch && medHashMatch[1]) {
      quantity = `#${medHashMatch[1].trim()}`
      const hashIdx = rawMed.lastIndexOf('#')
      if (hashIdx !== -1) {
        cleanMed = rawMed.slice(0, hashIdx).trim()
      }
    } else if (medQtyBracketMatch && medQtyBracketMatch[1]) {
      quantity = `#${medQtyBracketMatch[1].trim()}`
      cleanMed = rawMed.replace(/[\(\[]\s*(?:Qty|Dispense|Disp)[\:\s]*([^\)\]]+)[\)\]]/i, '').trim()
    } else if (sigSegment) {
      const sigHashMatch = sigSegment.match(/(?:^|\s)#\s*([0-9a-zA-Z\s\(\)\.\/\-]+)$/i)
      if (sigHashMatch && sigHashMatch[1]) {
        quantity = `#${sigHashMatch[1].trim()}`
        const hashIdx = sigSegment.lastIndexOf('#')
        if (hashIdx !== -1) {
          sigSegment = sigSegment.slice(0, hashIdx).trim()
        }
      }
    }

    let frequency: string | null = null
    let duration: string | null = null
    let instructions: string | null = null

    if (sigSegment) {
      let rem = sigSegment.trim()

      const trailingParenMatch = rem.match(/^(.*?)\s*\(([^()]+)\)\s*$/)
      if (trailingParenMatch) {
        const beforeParen = (trailingParenMatch[1] || '').trim()
        const insideParen = (trailingParenMatch[2] || '').trim()
        if (beforeParen && !freqCodeRegex.test(insideParen)) {
          instructions = insideParen
          rem = beforeParen
        }
      }

      const forMatch = rem.match(/^(.*?)\s+for\s+(.+)$/i)
      if (forMatch) {
        frequency = (forMatch[1] || '').trim() || null
        duration = (forMatch[2] || '').trim() || null
      } else {
        frequency = rem || null
      }
    }

    const idx = items.length
    const normalizedMedKey = `${idx}:${cleanMed.toLowerCase().slice(0, 120)}`

    items.push({
      key: normalizedMedKey,
      medication: cleanMed,
      quantity,
      frequency,
      duration,
      instructions,
      isExpired: isMedicationExpired(rawIssuedDate, duration)
    })
  }

  return items
}

const formatIssuedDate = (dateStr?: string | null): string => {
  if (!dateStr) return 'Recent Consultation'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'Recent Consultation'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

let inFlightPrescriptionFetch: Promise<void> | null = null
let dateWatcherAttached = false

export const usePrescriptions = () => {
  const userUuid = useCookie('user_uuid')
  const userRole = useCookie('user_role')
  const { allAppointments } = useAppointments()

  const rawRecords = useState<any[]>('patient_raw_prescription_records', () => [])
  const isLoading = useState<boolean>('patient_prescriptions_loading', () => false)
  const hasLoadedOnce = useState<boolean>('patient_prescriptions_loaded_once', () => false)
  const currentDateStr = useState<string>('patient_prescriptions_current_date', () =>
    getTodayDateString()
  )
  const todayStatusMap = useState<Record<string, MedicationAdherenceStatus>>(
    'patient_today_medication_status_map',
    () => ({})
  )
  const updatingKeys = useState<Record<string, boolean>>(
    'patient_updating_medication_keys',
    () => ({})
  )

  const buildCompositeKey = (prescriptionKey: string, medicationKey: string): string => {
    return `${prescriptionKey}::${medicationKey}`
  }

  const fetchPrescriptionsAndLogs = async (force = false) => {
    if (!userUuid.value || userRole.value !== 'patient') {
      rawRecords.value = []
      todayStatusMap.value = {}
      hasLoadedOnce.value = false
      return
    }

    const todayStr = getTodayDateString()
    if (currentDateStr.value !== todayStr) {
      currentDateStr.value = todayStr
      force = true
    }

    if (inFlightPrescriptionFetch && !force) {
      return inFlightPrescriptionFetch
    }

    if (!hasLoadedOnce.value) {
      isLoading.value = true
    }

    inFlightPrescriptionFetch = (async () => {
      try {
        const targetDate = getTodayDateString()
        const [recordsRes, logsRes] = await Promise.all([
          recordService.getRecords().catch(() => []),
          medicationLogService.list({ date: targetDate }).catch(() => [])
        ])

        rawRecords.value = (recordsRes as any)?.data || recordsRes || []

        const logsArray = (logsRes as any)?.data || logsRes || []
        const nextMap: Record<string, MedicationAdherenceStatus> = {}
        if (Array.isArray(logsArray)) {
          for (const log of logsArray) {
            if (log?.prescription_key && log?.medication_key && log?.status) {
              nextMap[buildCompositeKey(log.prescription_key, log.medication_key)] = log.status
            }
          }
        }
        currentDateStr.value = targetDate
        todayStatusMap.value = nextMap
        hasLoadedOnce.value = true
      } catch (e) {
        console.error('Failed to load patient prescriptions and medication logs:', e)
      } finally {
        isLoading.value = false
        inFlightPrescriptionFetch = null
      }
    })()

    return inFlightPrescriptionFetch
  }

  if (import.meta.client && !dateWatcherAttached) {
    dateWatcherAttached = true
    const syncDateOnFocus = () => {
      const latestDate = getTodayDateString()
      if (currentDateStr.value !== latestDate) {
        currentDateStr.value = latestDate
        fetchPrescriptionsAndLogs(true)
      }
    }
    window.addEventListener('focus', syncDateOnFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncDateOnFocus()
      }
    })
  }

  watch(
    () => userUuid.value,
    (newUuid, oldUuid) => {
      if (newUuid !== oldUuid) {
        rawRecords.value = []
        todayStatusMap.value = {}
        hasLoadedOnce.value = false
        if (newUuid && userRole.value === 'patient') {
          fetchPrescriptionsAndLogs(true)
        }
      }
    }
  )

  const prescriptionsList = computed<PrescriptionRecordEntry[]>(() => {
    const entries: PrescriptionRecordEntry[] = []
    const seenNoteIds = new Set<number>()
    const seenDiagUuids = new Set<string>()

    // 1. From completed diagnostic records
    for (const rec of rawRecords.value) {
      const rxText = (rec?.clinical_note?.prescription || rec?.prescription || '').trim()
      if (!rxText) continue

      const noteId = rec?.clinical_note?.id || null
      const diagUuid = rec?.uuid || null

      if (noteId && seenNoteIds.has(noteId)) continue
      if (diagUuid && seenDiagUuids.has(diagUuid)) continue

      if (noteId) seenNoteIds.add(noteId)
      if (diagUuid) seenDiagUuids.add(diagUuid)

      const doc = rec?.doctor || rec?.clinical_note?.doctor
      const doctorName = doc
        ? `Dr. ${doc.first_name || ''} ${doc.last_name || ''}`.trim()
        : 'Attending Physician'

      const conditionLabel =
        rec?.clinical_note?.final_diagnosis || rec?.label || 'Clinical Consultation'
      const rawDate = rec?.clinical_note?.updated_at || rec?.created_at || ''
      const timestamp = rawDate ? new Date(rawDate).getTime() : 0
      const rxKey = diagUuid || `note-${noteId || entries.length}`

      const activeItems = parsePrescriptionText(rxText, rawDate).filter(item => !item.isExpired)
      if (activeItems.length === 0) continue

      entries.push({
        key: rxKey,
        noteId,
        diagnosisUuid: diagUuid,
        prescriptionNumber: diagUuid
          ? `RX-${String(diagUuid).slice(0, 8).toUpperCase()}`
          : 'RX-SLIP',
        conditionLabel,
        doctorName,
        dateFormatted: formatIssuedDate(rawDate),
        rawDate,
        timestamp: isNaN(timestamp) ? 0 : timestamp,
        rawPrescription: rxText,
        patientEducation: rec?.clinical_note?.patient_education?.trim() || null,
        items: activeItems
      })
    }

    // 2. Fallback from appointments with clinical notes
    for (const appt of allAppointments.value) {
      const rawAppt = (appt as any)?.raw
      const note = rawAppt?.clinical_note
      const rxText = (note?.prescription || '').trim()
      if (!rxText) continue

      const noteId = note?.id || null
      const diagUuid =
        appt.diagnosis_uuid || rawAppt?.in_clinic_diagnosis?.uuid || note?.diagnosis?.uuid || null

      if (noteId && seenNoteIds.has(noteId)) continue
      if (diagUuid && seenDiagUuids.has(diagUuid)) continue

      if (noteId) seenNoteIds.add(noteId)
      if (diagUuid) seenDiagUuids.add(diagUuid)

      const doc = rawAppt?.doctor
      const doctorName = doc
        ? `Dr. ${doc.first_name || ''} ${doc.last_name || ''}`.trim()
        : appt.doctor || 'Attending Physician'

      const conditionLabel = note?.final_diagnosis || appt.info || 'Clinical Consultation'
      const rawDate = note?.updated_at || appt.completed_at || appt.raw_scheduled_at || ''
      const timestamp = rawDate ? new Date(rawDate).getTime() : 0
      const rxKey = diagUuid || (noteId ? `note-${noteId}` : `appt-${appt.id}`)

      const activeItems = parsePrescriptionText(rxText, rawDate).filter(item => !item.isExpired)
      if (activeItems.length === 0) continue

      entries.push({
        key: rxKey,
        noteId,
        diagnosisUuid: diagUuid,
        prescriptionNumber: diagUuid
          ? `RX-${String(diagUuid).slice(0, 8).toUpperCase()}`
          : 'RX-SLIP',
        conditionLabel,
        doctorName,
        dateFormatted: formatIssuedDate(rawDate),
        rawDate,
        timestamp: isNaN(timestamp) ? 0 : timestamp,
        rawPrescription: rxText,
        patientEducation: note?.patient_education?.trim() || null,
        items: activeItems
      })
    }

    return entries.sort((a, b) => b.timestamp - a.timestamp)
  })

  const getMedicationStatus = (
    prescriptionKey: string,
    medicationKey: string
  ): MedicationAdherenceStatus => {
    return todayStatusMap.value[buildCompositeKey(prescriptionKey, medicationKey)] || 'pending'
  }

  const isMedicationUpdating = (prescriptionKey: string, medicationKey: string): boolean => {
    return Boolean(updatingKeys.value[buildCompositeKey(prescriptionKey, medicationKey)])
  }

  const setMedicationStatus = async (
    prescriptionKey: string,
    medicationKey: string,
    status: MedicationAdherenceStatus,
    medDisplayName?: string
  ) => {
    const compKey = buildCompositeKey(prescriptionKey, medicationKey)
    const previousStatus = todayStatusMap.value[compKey] || 'pending'

    // Optimistic update
    if (status === 'pending') {
      const clone = { ...todayStatusMap.value }
      delete clone[compKey]
      todayStatusMap.value = clone
    } else {
      todayStatusMap.value = {
        ...todayStatusMap.value,
        [compKey]: status
      }
    }

    updatingKeys.value = { ...updatingKeys.value, [compKey]: true }

    try {
      await medicationLogService.recordStatus({
        prescription_key: prescriptionKey,
        medication_key: medicationKey,
        logged_date: getTodayDateString(),
        status
      })

      if (status === 'taken') {
        toast.success(
          medDisplayName ? `Marked "${medDisplayName}" as taken today.` : 'Marked as taken today.'
        )
      } else if (status === 'pending') {
        toast.info(
          medDisplayName
            ? `Reset today's status for "${medDisplayName}".`
            : "Reset today's medication status."
        )
      }
    } catch (e) {
      console.error('Failed to save medication adherence status:', e)
      // Rollback optimistic change
      if (previousStatus === 'pending') {
        const clone = { ...todayStatusMap.value }
        delete clone[compKey]
        todayStatusMap.value = clone
      } else {
        todayStatusMap.value = {
          ...todayStatusMap.value,
          [compKey]: previousStatus
        }
      }
      toast.error('Failed to update medication status. Please try again.')
    } finally {
      const nextUpdating = { ...updatingKeys.value }
      delete nextUpdating[compKey]
      updatingKeys.value = nextUpdating
    }
  }

  const dismissAllPendingForToday = async (items: PendingTodayMedication[]) => {
    await Promise.all(
      items.map(entry => setMedicationStatus(entry.prescriptionKey, entry.item.key, 'dismissed'))
    )
  }

  // Active medications from the most recent prescription that haven't expired and haven't been answered today
  const pendingTodayMedications = computed<PendingTodayMedication[]>(() => {
    const latestRx = prescriptionsList.value[0]
    if (!latestRx) return []

    const list: PendingTodayMedication[] = []
    for (const item of latestRx.items) {
      if (item.isExpired) continue
      const st = getMedicationStatus(latestRx.key, item.key)
      if (st === 'pending') {
        list.push({
          prescriptionKey: latestRx.key,
          prescriptionNumber: latestRx.prescriptionNumber,
          doctorName: latestRx.doctorName,
          conditionLabel: latestRx.conditionLabel,
          item
        })
      }
    }
    return list
  })

  return {
    prescriptionsList,
    pendingTodayMedications,
    isLoading,
    hasLoadedOnce,
    fetchPrescriptionsAndLogs,
    getMedicationStatus,
    isMedicationUpdating,
    setMedicationStatus,
    dismissAllPendingForToday
  }
}
