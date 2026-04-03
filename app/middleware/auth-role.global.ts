export default defineNuxtRouteMiddleware((to, from) => {
  // We skip middleware on the server just to be safe if cookies aren't synced,
  // but useCookie works in Nuxt 3 SSR for initial requests.
  const token = useCookie('auth_token')
  const role = useCookie('user_role')

  const path = to.path.toLowerCase()

  // Define route paths to protect
  const isAdminRoute = path.startsWith('/admin')
  const isPatientRoute = path.startsWith('/patient')
  const isDoctorRoute = path.startsWith('/doctor')
  const isAuthRoute = path.startsWith('/auth')

  // If trying to access a protected area without a token
  if (!token.value && (isAdminRoute || isPatientRoute || isDoctorRoute)) {
    return navigateTo('/auth/login')
  }

  // If trying to access an Auth route while already logged in
  if (token.value && role.value && isAuthRoute) {
    return navigateTo(`/${role.value}`)
  }

  // Role-based route protection
  if (isAdminRoute && role.value !== 'admin') {
    return navigateTo(`/${role.value || 'auth/login'}`)
  }

  if (isPatientRoute && role.value !== 'patient') {
    return navigateTo(`/${role.value || 'auth/login'}`)
  }

  if (isDoctorRoute && role.value !== 'doctor') {
    return navigateTo(`/${role.value || 'auth/login'}`)
  }
})
