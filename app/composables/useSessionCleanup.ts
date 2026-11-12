import { clearNuxtData, useCookie, useState } from '#app'

export const useSessionCleanup = () => {
  const clearSessionCaches = () => {
    useDiagnosis().resetScanner()
    usePrescriptions().resetPrescriptions()

    useCookie('auth_token', { path: '/' }).value = null
    useCookie('user_role', { path: '/' }).value = null
    useCookie('user_uuid', { path: '/' }).value = null
    useCookie('user_name', { path: '/' }).value = null
    useCookie('auth_user_name', { path: '/' }).value = null
    useCookie('doctor_uuid', { path: '/' }).value = null
    useCookie('account_status', { path: '/' }).value = null
    useCookie('verification_deadline', { path: '/' }).value = null

    useState<any>('auth_user').value = null

    useState<any[]>('shared_appointments_list').value = []
    useState<any[]>('shared_pending_appointments_list').value = []
    useState<any[]>('shared_declined_appointments_list').value = []
    useState<any[]>('shared_completed_appointments_list').value = []
    useState<any[]>('shared_no_show_appointments_list').value = []
    useState<any[]>('shared_cancelled_appointments_list').value = []
    useState<any[]>('shared_conversations_list').value = []

    useState<any>('user-scan-quota').value = null
    useState<boolean>('user-scan-quota-loading').value = false
    useState<number | null>('user-scan-quota-fetched-at').value = null

    useState<any>('doctor-active-subscription').value = null
    useState<boolean>('doctor-subscription-loading').value = false
    useState<number | null>('doctor-subscription-fetched-at').value = null

    useState<any[]>('app-doctor-appeals').value = []
    useState<any[]>('app-admin-appeals').value = []
    useState<any[]>('admin-appeals-list').value = []
    useState<boolean>('admin-appeals-loading').value = false
    useState<string | null>('admin-appeals-error').value = null

    useState<any[]>('doctor_all_avail_slots').value = []
    useState<string | null>('selected-doctor-uuid').value = null

    clearNuxtData()
  }

  return {
    clearSessionCaches
  }
}
