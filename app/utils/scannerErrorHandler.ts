export interface ParsedScannerError {
  headerMessage: string
  toastMessage: string
}

/**
 * Sanitizes technical API, network, and quota errors into user-friendly copy.
 * Prevents raw [POST] URL strings and stack traces from leaking to the UI.
 */
export function parseScanError(err: any): ParsedScannerError {
  const status = err?.status || err?.statusCode || err?.response?.status
  const rawMsg = String(
    err?.data?.error || err?.data?.message || err?.statusMessage || err?.message || ''
  )
  const code = err?.data?.code || ''

  // 1. Quota limit reached (HTTP 429 or code SCAN_LIMIT_REACHED)
  if (status === 429 || code === 'SCAN_LIMIT_REACHED' || /scan limit|quota/i.test(rawMsg)) {
    return {
      headerMessage: 'Daily Limit Reached',
      toastMessage:
        'Daily scan limit reached. Please wait for your quota to reset or upgrade your subscription plan.'
    }
  }

  // 2. Doctor verification required (HTTP 403 or code DOCTOR_VERIFICATION_REQUIRED)
  if (
    status === 403 ||
    code === 'DOCTOR_VERIFICATION_REQUIRED' ||
    /verification required/i.test(rawMsg)
  ) {
    return {
      headerMessage: 'Verification Required',
      toastMessage: 'Doctor account verification required before performing AI scans.'
    }
  }

  // 3. Non-skin image / invalid skin format (HTTP 422 or server validator message)
  if (status === 422 || /not appear to be a skin|not_skin|non-skin|invalid skin/i.test(rawMsg)) {
    return {
      headerMessage: 'Non-Skin Image Detected',
      toastMessage:
        'The uploaded image does not appear to be human skin. Please try again with a clear, close-up photo.'
    }
  }

  // 4. Server unavailable, AI brain not loaded, or general 500/502/503/network failure
  if (
    status === 503 ||
    status === 502 ||
    status === 500 ||
    /ai server|ai brain|unavailable|connection error|failed to fetch|networkerror|\[post\]/i.test(
      rawMsg
    )
  ) {
    return {
      headerMessage: 'Scan Failed. Please Try Again',
      toastMessage: 'Unable to analyze scan. Please check your connection and try again.'
    }
  }

  // 5. General fallback: Never expose raw [POST] or stack trace to user
  return {
    headerMessage: 'Scan Failed. Please Try Again',
    toastMessage: 'Something went wrong while processing the scan. Please try again.'
  }
}

/**
 * Sanitizes browser camera hardware and permissions errors into clean, helpful guidance.
 */
export function parseCameraError(err: any): ParsedScannerError {
  const errName = err?.name || ''
  const errMsg = String(err?.message || '')

  if (errName === 'NotAllowedError' || /permission/i.test(errName) || /permission/i.test(errMsg)) {
    return {
      headerMessage: 'Camera Permission Denied',
      toastMessage: 'Please allow camera access in your browser settings to scan live.'
    }
  }

  if (
    errName === 'NotFoundError' ||
    errName === 'DevicesNotFoundError' ||
    /device not found/i.test(errMsg)
  ) {
    return {
      headerMessage: 'Camera Not Found',
      toastMessage: 'No video camera was detected on this device. You can upload an image instead.'
    }
  }

  if (errName === 'NotReadableError' || errName === 'TrackStartError' || /in use/i.test(errMsg)) {
    return {
      headerMessage: 'Camera In Use',
      toastMessage:
        'Camera is currently in use by another application. Please close other apps and try again.'
    }
  }

  if (errName === 'OverconstrainedError' || errName === 'ConstraintNotSatisfiedError') {
    return {
      headerMessage: 'Camera Incompatible',
      toastMessage: 'Selected camera settings are not supported. Please try another camera source.'
    }
  }

  return {
    headerMessage: 'Camera Unavailable',
    toastMessage: 'Unable to access camera. Please check camera permissions or upload an image.'
  }
}
