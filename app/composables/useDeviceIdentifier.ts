export const useDeviceIdentifier = () => {
  const deviceCookie = useCookie<string>('da_device_id', {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    path: '/'
  })

  const cookiesAccepted = useCookie<boolean>('da_cookies_accepted', {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/'
  })

  // Ensure device token exists
  if (!deviceCookie.value) {
    const randomHex = () => Math.random().toString(36).substring(2, 10)
    deviceCookie.value = `dev_${randomHex()}-${randomHex()}-${Date.now().toString(36)}`
  }

  const acceptCookies = () => {
    cookiesAccepted.value = true
  }

  return {
    deviceId: computed(() => deviceCookie.value),
    isAccepted: computed(() => Boolean(cookiesAccepted.value)),
    acceptCookies
  }
}
