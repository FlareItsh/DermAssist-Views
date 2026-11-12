import { $api } from '~/composables/useApi'

export default defineNuxtRouteMiddleware(async (to, from) => {
  const token = useCookie('auth_token', { path: '/' })
  const roleCookie = useCookie('user_role', { path: '/' })
  const authUser = useState<any>('auth_user', () => null)

  const path = to.path.toLowerCase()
  const normalizedPath = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path

  // Define route paths to protect
  const isAdminRoute = path.startsWith('/admin')
  const isPatientRoute = path.startsWith('/patient')
  const isDoctorRoute = path.startsWith('/doctor')
  const isSecretaryRoute = path.startsWith('/secretary')
  const isAuthRoute = path.startsWith('/auth')
  const isProtectedRoute = isAdminRoute || isPatientRoute || isDoctorRoute || isSecretaryRoute
  const isDashboardUtilityRoute = path.startsWith('/notifications') || path.startsWith('/updates')

  // If trying to access a protected area without a token
  if (!token.value && (isProtectedRoute || isDashboardUtilityRoute)) {
    return navigateTo('/auth/login')
  }

  // Authoritative role & terms validation from backend on protected/admin navigation
  let verifiedRole = authUser.value?.role?.slug || authUser.value?.role
  if (
    token.value &&
    (!verifiedRole ||
      isAdminRoute ||
      !authUser.value ||
      authUser.value.terms_accepted_at === undefined)
  ) {
    try {
      const res: any = await $api('/user')
      const userData = res?.data || res
      authUser.value = userData
      const trueRole = (userData?.role?.slug || userData?.role || '').toLowerCase()
      verifiedRole = trueRole

      if (roleCookie.value !== trueRole) {
        roleCookie.value = trueRole
      }
    } catch {
      token.value = null
      roleCookie.value = null
      authUser.value = null
      if (isProtectedRoute || isDashboardUtilityRoute) {
        return navigateTo('/auth/login')
      }
    }
  }

  const effectiveRole = (verifiedRole || roleCookie.value || '').toLowerCase()

  // If trying to access an Auth route while already logged in (exempt OAuth callback, verify, check-email, and doctor step 2 onboarding)
  const isDoctorOnboarding =
    path === '/auth/register' && (to.query.step === '2' || to.query.source === 'google')
  if (
    token.value &&
    effectiveRole &&
    isAuthRoute &&
    path !== '/auth/callback' &&
    path !== '/auth/verify' &&
    path !== '/auth/check-email' &&
    path !== '/auth/reset-password' &&
    path !== '/auth/resetpassword' &&
    !isDoctorOnboarding
  ) {
    return navigateTo(`/${effectiveRole}`)
  }

  // Authoritative Role-based route protection
  if (isAdminRoute && effectiveRole !== 'admin') {
    return navigateTo(`/${effectiveRole || 'auth/login'}`)
  }

  if (isPatientRoute && effectiveRole !== 'patient') {
    return navigateTo(`/${effectiveRole || 'auth/login'}`)
  }

  if (isDoctorRoute && effectiveRole !== 'doctor') {
    return navigateTo(`/${effectiveRole || 'auth/login'}`)
  }

  if (isSecretaryRoute && effectiveRole !== 'secretary') {
    return navigateTo(`/${effectiveRole || 'auth/login'}`)
  }

  // Mandatory Terms & Conditions Gate: Prevent navigation to subpages until terms are accepted
  const hasPendingTermsReminder =
    import.meta.client &&
    authUser.value?.uuid &&
    localStorage.getItem(`da_pending_terms_reminder_${authUser.value.uuid}`) === '1'

  if (
    token.value &&
    effectiveRole &&
    authUser.value &&
    (!authUser.value.terms_accepted_at || hasPendingTermsReminder) &&
    (isProtectedRoute || isDashboardUtilityRoute) &&
    normalizedPath !== `/${effectiveRole}`
  ) {
    return navigateTo(`/${effectiveRole}`)
  }
})
