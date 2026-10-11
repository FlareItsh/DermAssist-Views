import { webcrypto } from 'node:crypto'

export default defineNitroPlugin(() => {
  try {
    if (!globalThis.crypto) {
      Object.defineProperty(globalThis, 'crypto', {
        value: webcrypto,
        writable: true,
        configurable: true
      })
    } else if (!globalThis.crypto.subtle && webcrypto?.subtle) {
      Object.defineProperty(globalThis.crypto, 'subtle', {
        value: webcrypto.subtle,
        writable: true,
        configurable: true
      })
    }
  } catch (e) {
    // fallback
  }
})
