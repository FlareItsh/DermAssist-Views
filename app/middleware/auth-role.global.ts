import { $api } from '~/composables/useApi'

export default defineNuxtRouteMiddleware(async (to, from) => {
  const token = useCookie('auth_token', { path: '/' })
  const roleCookie = useCookie('user_role', { path: '/' })
  const authUser = useState<any>('auth_user', () => null)

  const path = to.path.toLowerCase()

  // Define route paths to protect
  const isAdminRoute = path.startsWith('/admin')
  const isPatientRoute = path.startsWith('/patient')
  const isDoctorRoute = path.startsWith('/doctor')
  const isSecretaryRoute = path.startsWith('/secretary')
  const isAuthRoute = path.startsWith('/auth')
  const isProtectedRoute = isAdminRoute || isPatientRoute || isDoctorRoute || isSecretaryRoute

  // If trying to access a protected area without a token
  if (!token.value && isProtectedRoute) {
    return navigateTo('/auth/login')
  }

  // Authoritative role validation from backend on protected/admin navigation
  let verifiedRole = authUser.value?.role?.slug || authUser.value?.role
  if (token.value && (!verifiedRole || isAdminRoute)) {
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
      if (isProtectedRoute) {
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
})
