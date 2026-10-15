export interface ParsedChatPreview {
  isSpecial: boolean
  label: string
  icon: string | null
  iconColor: string
  text: string
  rawUserText: string
}

/**
 * Parses raw chat message strings to produce clean, badge-friendly previews,
 * gracefully handling DermAssist system tags (scans, appointments, reschedules).
 */
export const parseChatPreview = (
  rawMessage?: string | null,
  emptyFallback = 'Tap to open chat'
): ParsedChatPreview => {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return {
      isSpecial: false,
      label: '',
      icon: null,
      iconColor: '',
      text: emptyFallback,
      rawUserText: ''
    }
  }

  const str = rawMessage.trim()

  // 1. Clinical Scan Findings
  if (str.includes('[SCAN_RESULT:')) {
    const cleanNote = str
      .replace(/\[SCAN_RESULT:[^\]]+\]/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()

    return {
      isSpecial: true,
      label: 'Clinical Scan',
      icon: 'solar:shield-check-bold',
      iconColor: 'text-primary',
      text: cleanNote || 'Clinical findings shared',
      rawUserText: cleanNote
    }
  }

  // 2. Appointment Consultation Request
  if (str.includes('[APPOINTMENT_REQUEST:')) {
    const cleanNote = str
      .replace(/\[APPOINTMENT_REQUEST:[^\]]+\]/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()

    return {
      isSpecial: true,
      label: 'Appointment Request',
      icon: 'solar:calendar-date-bold',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      text: cleanNote || 'Consultation requested',
      rawUserText: cleanNote
    }
  }

  // 3. Clinical Findings inside Appointment
  if (str.includes('[DIAGNOSIS_ONLY:')) {
    const cleanNote = str
      .replace(/\[DIAGNOSIS_ONLY:[^\]]+\]/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()

    return {
      isSpecial: true,
      label: 'Clinical Findings',
      icon: 'solar:document-medicine-bold',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      text: cleanNote || 'Clinical findings shared',
      rawUserText: cleanNote
    }
  }

  // 4. Appointment Confirmed / Scheduled
  if (str.includes('[APPOINTMENT_SCHEDULED:')) {
    const cleanNote = str
      .replace(/\[APPOINTMENT_SCHEDULED:[^\]]+\]/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()

    return {
      isSpecial: true,
      label: 'Appointment Confirmed',
      icon: 'solar:calendar-check-bold',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      text: cleanNote || 'Consultation confirmed',
      rawUserText: cleanNote
    }
  }

  // 5. Appointment Declined
  if (str.includes('[APPOINTMENT_DECLINED:')) {
    const cleanNote = str
      .replace(/\[APPOINTMENT_DECLINED:[^\]]+\]/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()

    return {
      isSpecial: true,
      label: 'Appointment Declined',
      icon: 'solar:calendar-minimalistic-bold',
      iconColor: 'text-rose-500',
      text: cleanNote || 'Consultation declined',
      rawUserText: cleanNote
    }
  }

  // 6. Appointment Cancelled
  if (str.includes('[APPOINTMENT_CANCELLED:')) {
    const cleanNote = str
      .replace(/\[APPOINTMENT_CANCELLED:[^\]]+\]/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()

    return {
      isSpecial: true,
      label: 'Appointment Cancelled',
      icon: 'solar:calendar-minimalistic-bold',
      iconColor: 'text-foreground/50',
      text: cleanNote || 'Appointment cancelled',
      rawUserText: cleanNote
    }
  }

  // 7. Appointment Completed
  if (str.includes('[APPOINTMENT_COMPLETED:')) {
    const cleanNote = str
      .replace(/\[APPOINTMENT_COMPLETED:[^\]]+\]/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()

    return {
      isSpecial: true,
      label: 'Consultation Completed',
      icon: 'solar:verified-check-bold',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      text: cleanNote || 'Consultation completed',
      rawUserText: cleanNote
    }
  }

  // 8. Reschedule Requests / Proposals / Confirmations
  if (str.includes('[APPOINTMENT_RESCHEDULE_')) {
    const cleanNote = str
      .replace(/\[APPOINTMENT_RESCHEDULE_[A-Z]+:[^\]]+\]/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()

    return {
      isSpecial: true,
      label: 'Reschedule Update',
      icon: 'solar:calendar-search-bold',
      iconColor: 'text-amber-500',
      text: cleanNote || 'Reschedule requested',
      rawUserText: cleanNote
    }
  }

  // 9. Generic or fallback system tags
  if (/\[[A-Z0-9_]+:[^\]]+\]/i.test(str)) {
    const cleanNote = str
      .replace(/\[[A-Z0-9_]+:[^\]]+\]/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()

    return {
      isSpecial: true,
      label: 'Attachment',
      icon: 'solar:paperclip-2-bold',
      iconColor: 'text-foreground/60',
      text: cleanNote || 'Shared an attachment',
      rawUserText: cleanNote
    }
  }

  // 10. Normal text message (strip any accidental HTML)
  const cleanText = str.replace(/<[^>]*>/g, '').trim()

  return {
    isSpecial: false,
    label: '',
    icon: null,
    iconColor: '',
    text: cleanText || emptyFallback,
    rawUserText: cleanText
  }
}

export const useChatPreview = () => {
  return {
    parseChatPreview
  }
}
