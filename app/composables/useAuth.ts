import { computed } from 'vue'
import { useState, useCookie } from '#app'
import { $api } from '~/composables/useApi'

export const useAuth = () => {
  const token = useCookie<string | null | undefined>('auth_token', { path: '/' })
  const authUser = useState<any>('auth_user', () => null)

  const role = computed<string>(() => {
    const rawRole = authUser.value?.role?.slug || authUser.value?.role || ''
    return String(rawRole).toLowerCase()
  })

  const uuid = computed<string>(() => authUser.value?.uuid || '')

  const fullName = computed<string>(() => {
    if (!authUser.value) return ''
    return `${authUser.value.first_name || ''} ${authUser.value.last_name || ''}`.trim()
  })

  const doctorUuid = computed<string | null>(() => {
    return authUser.value?.doctor_uuid || authUser.value?.doctor?.uuid || null
  })

  const accountStatus = computed<string>(() => authUser.value?.account_status || 'active')

  const verificationDeadline = computed<string | null>(() => {
    return authUser.value?.verification_deadline || null
  })

  const termsAccepted = computed<boolean>(() => Boolean(authUser.value?.terms_accepted_at))

  const isAuthenticated = computed<boolean>(() => Boolean(token.value))

  const fetchUser = async (force = false) => {
    if (!token.value) {
      authUser.value = null
      return null
    }

    if (authUser.value && !force) {
      return authUser.value
    }

    try {
      const res: any = await $api('/user')
      const userData = res?.data || res
      authUser.value = userData
      return userData
    } catch (err) {
      authUser.value = null
      token.value = null
      throw err
    }
  }

  const setUser = (userData: any) => {
    authUser.value = (userData as any)?.data || userData
  }

  const clearAuth = () => {
    authUser.value = null
    token.value = null
  }

  return {
    token,
    user: authUser,
    role,
    uuid,
    fullName,
    doctorUuid,
    accountStatus,
    verificationDeadline,
    termsAccepted,
    isAuthenticated,
    fetchUser,
    setUser,
    clearAuth
  }
}
