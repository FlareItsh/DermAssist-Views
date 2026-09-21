import { toast } from 'vue-sonner'

export const usePasswordGenerator = () => {
  const generateTemporaryPassword = (prefix = 'Patient'): string => {
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    return `${prefix}@${randomNum}`
  }

  const copyToClipboard = async (text: string, label = 'Password'): Promise<boolean> => {
    if (!text) return false
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-https or restricted environments
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }
      toast.success(`${label} copied to clipboard!`)
      return true
    } catch (err) {
      console.error('Failed to copy text:', err)
      toast.error('Failed to copy to clipboard.')
      return false
    }
  }

  return {
    generateTemporaryPassword,
    copyToClipboard
  }
}
