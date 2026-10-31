/**
 * Client-Side Device Hardware & Canvas Fingerprint Generator
 *
 * Produces a stable SHA-256 fingerprint representing the client machine's
 * GPU rasterization, WebGL renderer, hardware specs, and screen metrics.
 * Persists across incognito mode and browser closures.
 */

let cachedFingerprint: string | null = null

async function sha256(str: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buffer = new TextEncoder().encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // Fallback simple hash if subtle crypto unavailable
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(16, '0')
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 60
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'no-canvas-2d'

    ctx.textBaseline = 'top'
    ctx.font = "14px 'Arial', sans-serif"
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('DermAssist-Device-Token-2026', 2, 15)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('DermAssist-Device-Token-2026', 4, 17)

    return canvas.toDataURL()
  } catch {
    return 'canvas-error'
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    if (!gl) return 'no-webgl'

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) return 'no-debug-info'

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || ''
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ''
    return `${vendor}~${renderer}`
  } catch {
    return 'webgl-error'
  }
}

export async function getDeviceFingerprint(): Promise<string> {
  if (import.meta.server) {
    return 'server-render'
  }

  if (cachedFingerprint) {
    return cachedFingerprint
  }

  try {
    // Check sessionStorage cache first for performance
    const stored = window.sessionStorage?.getItem('da_device_fingerprint')
    if (stored) {
      cachedFingerprint = stored
      return stored
    }
  } catch {
    // Storage access blocked or denied
  }

  const canvasSig = getCanvasFingerprint()
  const webglSig = getWebGLFingerprint()

  const screenMetrics = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}@${window.devicePixelRatio || 1}`
  const hardwareConcurrency = String(navigator.hardwareConcurrency || 4)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const platform = navigator.platform || 'unknown'

  const rawToken = [
    canvasSig,
    webglSig,
    screenMetrics,
    hardwareConcurrency,
    timeZone,
    platform
  ].join(':::')

  const fingerprint = await sha256(rawToken)
  cachedFingerprint = fingerprint

  try {
    window.sessionStorage?.setItem('da_device_fingerprint', fingerprint)
  } catch {
    // Storage blocked in extreme incognito shields
  }

  return fingerprint
}
