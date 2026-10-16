<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
  import { useRouter } from '#app'
  import { toast } from 'vue-sonner'
  import { useDiagnosis, type PendingPatientRegistration } from '~/composables/useDiagnosis'
  import { diagnosisService } from '~/api/diagnosis/DiagnosisService'
  import { userService } from '~/api/user/UserService'
  import { useAppointments, parseAppointmentDateTime } from '~/composables/useAppointments'
  import { usePasswordGenerator } from '~/composables/usePasswordGenerator'
  import { useFormSanitizer } from '~/composables/useFormSanitizer'
  import { useStorage } from '~/composables/useStorage'

  const router = useRouter()
  const {
    isScanning,
    isScanned,
    setDiagnosis,
    qualityError,
    previewImage,
    selectedFile,
    patientUuid,
    appointmentUuid,
    pendingPatientRegistration,
    walkInPatientInfo,
    pendingPatientName,
    isHealthyState,
    isNoneState,
    saveActiveDiagnosisState
  } = useDiagnosis()

  const userUuid = useCookie('user_uuid')
  const userName = useCookie('user_name')
  const { getStorageUrl } = useStorage()
  const { appointments, pendingAppointments, fetchAppointments } = useAppointments()
  const { generateTemporaryPassword, copyToClipboard } = usePasswordGenerator()
  const { calculateAge, todayIsoDate, splitFullPhoneNumber, validatePhoneNumber } =
    useFormSanitizer()

  // Camera & Scanner State
  const videoRef = ref<HTMLVideoElement | null>(null)
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const fileInput = ref<HTMLInputElement | null>(null)
  const isCameraOn = ref(false)
  const errorMessage = ref('')
  const uploadQualityWarning = ref<string | null>(null)
  const agreeToConsent = ref(false)
  const showTermsModal = ref(false)
  const termsInitialTab = ref<'terms' | 'privacy'>('terms')

  const openTermsModal = (tab: 'terms' | 'privacy' = 'terms') => {
    termsInitialTab.value = tab
    showTermsModal.value = true
  }

  let stream: MediaStream | null = null
  let qualityCheckInterval: ReturnType<typeof setInterval> | null = null
  const currentFacingMode = ref<'user' | 'environment'>('environment')

  // Drag & drop state
  const isDraggingOver = ref(false)
  let dragCounter = 0

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter++
    if (e.dataTransfer && e.dataTransfer.types.length > 0) {
      isDraggingOver.value = true
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
    isDraggingOver.value = true
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter--
    if (dragCounter <= 0) {
      dragCounter = 0
      isDraggingOver.value = false
    }
  }

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload or drop a valid image file (JPEG, PNG, WEBP).')
      return
    }
    selectedFile.value = file
    isScanned.value = false
    uploadQualityWarning.value = null
    const reader = new FileReader()
    reader.onload = e => {
      previewImage.value = e.target?.result as string
      analyzeUploadedImageQuality(previewImage.value)
    }
    reader.readAsDataURL(file)
    stopCamera()
    isCameraOn.value = false
  }

  const processImageUrl = async (rawUrl: string) => {
    let url = rawUrl.trim()
    if (!url) return

    const imgMatch = url.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (imgMatch && imgMatch[1]) {
      url = imgMatch[1]
    }

    if (url.startsWith('data:image/')) {
      try {
        const res = await fetch(url)
        const blob = await res.blob()
        const ext = url.substring(url.indexOf('/') + 1, url.indexOf(';')) || 'jpg'
        const file = new File([blob], `dropped-image.${ext}`, { type: blob.type || 'image/jpeg' })
        processImageFile(file)
        toast.success('Dropped image loaded successfully!')
        return
      } catch (e) {
        console.error('Failed to parse dropped data URL:', e)
      }
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      toast.error('Dropped link is not a valid image URL.')
      return
    }

    const toastId = toast.loading('Loading image from link...')
    try {
      const response = await fetch(url, { mode: 'cors' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      if (!blob.type.startsWith('image/') && !blob.type.includes('octet-stream')) {
        toast.dismiss(toastId)
        toast.error('The link does not point to a recognized image format.')
        return
      }
      const filename = url.split('/').pop()?.split('?')[0] || 'dropped-image.jpg'
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
      toast.dismiss(toastId)
      toast.success('Image loaded from link successfully!')
      processImageFile(file)
    } catch {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth || img.width
            canvas.height = img.naturalHeight || img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Canvas context unavailable')
            ctx.drawImage(img, 0, 0)
            canvas.toBlob(
              blob => {
                toast.dismiss(toastId)
                if (blob) {
                  const file = new File([blob], 'dropped-image.jpg', { type: 'image/jpeg' })
                  toast.success('Image loaded from link successfully!')
                  processImageFile(file)
                } else {
                  toast.error('Could not extract image from link. Please save and drop the file.')
                }
              },
              'image/jpeg',
              0.9
            )
          } catch {
            toast.dismiss(toastId)
            toast.error(
              'Direct link access is protected by CORS. Please save and drop the file directly.'
            )
          }
        }
        img.onerror = () => {
          toast.dismiss(toastId)
          toast.error(
            'Unable to load image from URL. Please save the image and drop the file directly.'
          )
        }
        img.src = url
      } catch {
        toast.dismiss(toastId)
        toast.error('Could not load image from URL.')
      }
    }
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter = 0
    isDraggingOver.value = false

    const dataTransfer = e.dataTransfer
    if (!dataTransfer) return

    if (dataTransfer.files && dataTransfer.files.length > 0) {
      const file = dataTransfer.files[0]
      if (file.type.startsWith('image/')) {
        processImageFile(file)
        return
      }
    }

    const htmlData = dataTransfer.getData('text/html')
    if (htmlData) {
      const match = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i)
      if (match && match[1]) {
        await processImageUrl(match[1])
        return
      }
    }

    const uriData = dataTransfer.getData('text/uri-list')
    if (uriData) {
      const firstUrl = uriData.split('\n')[0].trim()
      if (firstUrl && !firstUrl.startsWith('#')) {
        await processImageUrl(firstUrl)
        return
      }
    }

    const textData = dataTransfer.getData('text/plain')
    if (textData) {
      const trimmed = textData.trim()
      if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:image/')
      ) {
        await processImageUrl(trimmed)
        return
      }
    }

    if (dataTransfer.items && dataTransfer.items.length > 0) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const item = dataTransfer.items[i]
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            processImageFile(file)
            return
          }
        }
      }
    }

    toast.info('No valid image or image link detected in the drop.')
  }

  const flipCamera = async () => {
    if (!isCameraOn.value) return
    currentFacingMode.value = currentFacingMode.value === 'user' ? 'environment' : 'user'
    await startCamera()
  }

  const triggerFileInput = () => {
    if (fileInput.value) {
      fileInput.value.click()
    }
  }

  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.files && target.files[0]) {
      const file = target.files[0]
      processImageFile(file)
    }
  }

  const stopCamera = () => {
    if (qualityCheckInterval) {
      clearInterval(qualityCheckInterval)
    }
    qualityCheckInterval = null
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }
  }

  const toggleCamera = async () => {
    if (isCameraOn.value) {
      stopCamera()
      isCameraOn.value = false
    } else {
      previewImage.value = null
      selectedFile.value = null
      uploadQualityWarning.value = null
      await startCamera()
    }
  }

  const startCamera = async () => {
    isCameraOn.value = true
    errorMessage.value = ''
    await nextTick()

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      errorMessage.value = 'Camera not available. Open this app over HTTPS.'
      isCameraOn.value = false
      return
    }

    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      stream = null
    }

    await new Promise(resolve => setTimeout(resolve, 200))

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: currentFacingMode.value } }
      })
    } catch (err: any) {
      console.error('Camera error:', err)
      errorMessage.value = `Camera error: ${err.name} — ${err.message}`
      isCameraOn.value = false
      return
    }

    if (videoRef.value) {
      videoRef.value.srcObject = stream
      try {
        await videoRef.value.play()
      } catch (playErr) {
        console.warn('Video play blocked:', playErr)
      }
    }
    startQualityLoop()
  }

  const startQualityLoop = () => {
    if (qualityCheckInterval) {
      clearInterval(qualityCheckInterval)
    }
    qualityCheckInterval = setInterval(() => {
      if (
        !videoRef.value ||
        !canvasRef.value ||
        isScanning.value ||
        !isCameraOn.value ||
        previewImage.value
      )
        return
      const v = videoRef.value
      const c = canvasRef.value
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      c.width = 160
      c.height = 120
      ctx.drawImage(v, 0, 0, c.width, c.height)
      qualityError.value = validateImageQuality(ctx, c.width, c.height)
    }, 400)
  }

  const analyzeUploadedImageQuality = (dataUrl: string): void => {
    const img = new Image()
    img.onload = () => {
      const offscreen = document.createElement('canvas')
      offscreen.width = 160
      offscreen.height = 120
      const ctx = offscreen.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height)
      const warning = validateImageQuality(ctx, offscreen.width, offscreen.height)
      uploadQualityWarning.value = warning
    }
    img.src = dataUrl
  }

  const validateImageQuality = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): string | null => {
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    let totalLum = 0
    let variance = 0
    const pixelCount = data.length / 4

    for (let i = 0; i < data.length; i += 4) {
      const r = (data as any)[i]
      const g = (data as any)[i + 1]
      const b = (data as any)[i + 2]
      totalLum += 0.299 * r + 0.587 * g + 0.114 * b
    }

    const avgLum = totalLum / pixelCount

    if (avgLum < 80) return 'Too dark - use more light'
    if (avgLum > 230) return 'Too much glare - avoid direct reflection'

    for (let i = 0; i < data.length; i += 8) {
      const r = (data as any)[i]
      const g = (data as any)[i + 1]
      const b = (data as any)[i + 2]
      const lum = (r + g + b) / 3
      variance += Math.abs(lum - avgLum)
    }

    if (variance / (pixelCount / 2) < 20) return 'Get closer or fix focus...'

    return null
  }

  const resetToCamera = async () => {
    previewImage.value = null
    selectedFile.value = null
    isScanned.value = false
    uploadQualityWarning.value = null
    await startCamera()
  }

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const maxSide = 1024

        if (width > height && width > maxSide) {
          height *= maxSide / width
          width = maxSide
        } else if (height > maxSide) {
          width *= maxSide / height
          height = maxSide
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject('Could not get canvas context')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          blob => {
            if (blob) resolve(blob)
            else reject('Compression failed')
          },
          'image/jpeg',
          0.85
        )
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  // ─── Patient Assignment & Modal Management ───────────────────────────────────
  const isPatientModalOpen = ref(false)
  const activeModalTab = ref<'appointments' | 'registered' | 'register'>('appointments')
  const patientSearchQuery = ref('')
  const selectedDateFilter = ref<'today' | 'tomorrow' | 'custom' | 'all'>('today')

  const getTodayStr = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getTomorrowStr = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const year = tomorrow.getFullYear()
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const day = String(tomorrow.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const customSelectedDate = ref(getTodayStr())
  const assignedName = ref('')
  const assignedAppointment = ref<any | null>(null)
  const doctorRegisteredPatients = ref<any[]>([])

  const loadDoctorPatients = async () => {
    try {
      const res = await userService.listDoctorPatients({ per_page: 100 })
      doctorRegisteredPatients.value = (res?.data ?? res ?? []).map((p: any) => ({
        ...p,
        _source: 'registered'
      }))
    } catch {
      // silent fail
    }
  }

  onMounted(() => {
    loadDoctorPatients()
    fetchAppointments()
  })

  onUnmounted(() => {
    stopCamera()
  })

  const formatPatientDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const availableAppointments = computed(() => {
    const all = [...appointments.value, ...pendingAppointments.value]
    const todayStr = getTodayStr()
    const tomorrowStr = getTomorrowStr()

    const list: any[] = []

    for (const appt of all) {
      const rawDateStr = appt.raw_scheduled_at || appt.scheduled_at || appt.date
      if (!rawDateStr) continue

      const pStart = parseAppointmentDateTime(rawDateStr)
      if (!pStart.date) continue

      let endTime = ''
      if (appt.raw_scheduled_end_at || appt.scheduled_end_at) {
        endTime = parseAppointmentDateTime(appt.raw_scheduled_end_at || appt.scheduled_end_at).time
      }

      const patient = appt.patient || {}
      const patientName =
        patient.first_name && patient.last_name
          ? `${patient.first_name} ${patient.last_name}`
          : appt.doctor
            ? appt.doctor
            : 'Patient'

      list.push({
        id: appt.id || appt.uuid,
        uuid: appt.uuid || appt.id,
        date: pStart.date,
        time: pStart.time,
        endTime,
        timeRange: endTime ? `${pStart.time} - ${endTime}` : pStart.time,
        raw_scheduled_at: rawDateStr,
        isToday: pStart.date === todayStr,
        isTomorrow: pStart.date === tomorrowStr,
        status: appt.status || 'scheduled',
        purpose: appt.purpose || 'Consultation',
        patient,
        patient_uuid: appt.patient_uuid || patient.uuid,
        patientName,
        patientEmail: patient.email || '',
        patientAge: calculateAge(patient.date_of_birth) ?? patient.age ?? appt.patient_age,
        patientGender: patient.gender || appt.patient_gender,
        avatar_path: patient.avatar_path
      })
    }

    return list.sort((a, b) => {
      const timeA = new Date(a.raw_scheduled_at).getTime()
      const timeB = new Date(b.raw_scheduled_at).getTime()
      return timeA - timeB
    })
  })

  const allAppointmentsCount = computed(() => availableAppointments.value.length)
  const registeredPatientsCount = computed(() => doctorRegisteredPatients.value.length)

  const filteredAppointments = computed(() => {
    let list = availableAppointments.value

    if (selectedDateFilter.value === 'today') {
      const todayStr = getTodayStr()
      list = list.filter(a => a.date === todayStr)
    } else if (selectedDateFilter.value === 'tomorrow') {
      const tomorrowStr = getTomorrowStr()
      list = list.filter(a => a.date === tomorrowStr)
    } else if (selectedDateFilter.value === 'custom') {
      if (customSelectedDate.value) {
        list = list.filter(a => a.date === customSelectedDate.value)
      }
    }

    const q = patientSearchQuery.value.trim().toLowerCase()
    if (q) {
      list = list.filter(a => {
        const name = (a.patientName || '').toLowerCase()
        const email = (a.patientEmail || '').toLowerCase()
        const purpose = (a.purpose || '').toLowerCase()
        const time = (a.timeRange || '').toLowerCase()
        const date = (a.date || '').toLowerCase()
        return (
          name.includes(q) ||
          email.includes(q) ||
          purpose.includes(q) ||
          time.includes(q) ||
          date.includes(q)
        )
      })
    }

    return list
  })

  // Registered Patients (including Active Staged Patient if present)
  const allRegisteredPatients = computed(() => {
    const list = [...doctorRegisteredPatients.value]
    if (pendingPatientRegistration.value) {
      const p = pendingPatientRegistration.value
      list.unshift({
        uuid: 'pending_new_patient',
        first_name: p.firstName,
        last_name: p.lastName,
        email: p.email,
        contact_number: p.contact_number,
        date_of_birth: p.date_of_birth,
        age: p.age,
        gender: p.gender,
        isPendingCreation: true,
        account_status: 'Staged (Unsaved)'
      })
    }
    return list
  })

  const filteredRegisteredPatients = computed(() => {
    let list = allRegisteredPatients.value
    const q = patientSearchQuery.value.trim().toLowerCase()
    if (q) {
      list = list.filter((p: any) => {
        const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase()
        const email = (p.email || '').toLowerCase()
        return name.includes(q) || email.includes(q)
      })
    }
    return list
  })

  const selectedPatientName = computed(() => {
    if (assignedName.value) return assignedName.value
    if (pendingPatientName.value) return pendingPatientName.value
    if (pendingPatientRegistration.value) {
      return `${pendingPatientRegistration.value.firstName} ${pendingPatientRegistration.value.lastName}`
    }
    if (patientUuid.value) {
      const reg = doctorRegisteredPatients.value.find(p => p.uuid === patientUuid.value)
      if (reg) return `${reg.first_name} ${reg.last_name}`
      const appt = availableAppointments.value.find(a => a.patient_uuid === patientUuid.value)
      if (appt) return appt.patientName
    }
    return ''
  })

  // Watch pendingPatientRegistration to restore assignedName when navigating across pages
  watch(
    () => pendingPatientRegistration.value,
    val => {
      if (val) {
        assignedName.value = `${val.firstName} ${val.lastName}`
        if (!userName.value) userName.value = assignedName.value
      }
    },
    { immediate: true }
  )

  // Watch patientUuid and loaded lists to re-hydrate assignedName & appointment after navigation
  watch(
    [patientUuid, doctorRegisteredPatients, availableAppointments],
    ([uuid, patients, appts]) => {
      if (uuid && !assignedName.value && !pendingPatientRegistration.value) {
        if (uuid === 'walk_in_guest' && walkInPatientInfo.value) {
          assignedName.value = `${walkInPatientInfo.value.firstName} ${walkInPatientInfo.value.lastName}`
          if (!userName.value) userName.value = assignedName.value
          return
        }
        const reg = patients.find((p: any) => p.uuid === uuid)
        if (reg) {
          assignedName.value = `${reg.first_name} ${reg.last_name}`
          return
        }
        const appt = appts.find((a: any) => a.patient_uuid === uuid)
        if (appt) {
          assignedName.value = appt.patientName
          assignedAppointment.value = appt
        }
      }
    },
    { immediate: true }
  )

  const assignedBadgeText = computed(() => {
    if (pendingPatientRegistration.value) {
      return 'New Patient (Pending)'
    }
    if (patientUuid.value === 'walk_in_guest') {
      return 'Walk-In (No Account)'
    }
    if (assignedAppointment.value) {
      return `${assignedAppointment.value.isToday ? 'Today' : formatPatientDate(assignedAppointment.value.date)} • ${assignedAppointment.value.time}`
    }
    return 'Walk-In Patient'
  })

  const openPatientModal = () => {
    isPatientModalOpen.value = true
  }

  const selectAppointment = (appt: any) => {
    pendingPatientRegistration.value = null
    patientUuid.value = appt.patient_uuid
    appointmentUuid.value = appt.id || appt.uuid || null
    assignedName.value = appt.patientName
    userName.value = appt.patientName
    assignedAppointment.value = appt
    saveActiveDiagnosisState()
    isPatientModalOpen.value = false
    toast.success(
      `Assigned to ${appt.patientName} (${appt.isToday ? 'Today' : formatPatientDate(appt.date)} at ${appt.time})`
    )
  }

  const selectRegisteredPatient = (patient: any) => {
    if (patient.isPendingCreation) {
      patientUuid.value = 'pending_new_patient'
      assignedName.value = `${patient.first_name} ${patient.last_name}`
      userName.value = assignedName.value
      assignedAppointment.value = null
      saveActiveDiagnosisState()
      isPatientModalOpen.value = false
      toast.success(`Assigned to ${assignedName.value} (Staged Patient)`)
      return
    }
    pendingPatientRegistration.value = null
    patientUuid.value = patient.uuid
    appointmentUuid.value = null
    assignedName.value = `${patient.first_name} ${patient.last_name}`
    userName.value = assignedName.value
    assignedAppointment.value = null
    saveActiveDiagnosisState()
    isPatientModalOpen.value = false
    toast.success(`Assigned to ${assignedName.value} (Walk-in)`)
  }

  const clearAssignedPatient = () => {
    pendingPatientRegistration.value = null
    walkInPatientInfo.value = null
    patientUuid.value = null
    appointmentUuid.value = null
    assignedName.value = ''
    userName.value = ''
    assignedAppointment.value = null
    saveActiveDiagnosisState()
    isPatientModalOpen.value = false
    toast.info('Patient selection cleared.')
  }

  // Registration Form State
  const registerForm = reactive({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    contact_number: '',
    password: generateTemporaryPassword('Patient'),
    date_of_birth: '',
    age: '',
    gender: 'Female',
    street: '',
    barangay: ''
  })
  const isSubmittingRegistration = ref(false)
  const registrationError = ref<string | null>(null)
  const showPassword = ref(false)
  const calculatedRegisterAge = computed(() => calculateAge(registerForm.date_of_birth))

  const handleRegeneratePassword = () => {
    registerForm.password = generateTemporaryPassword('Patient')
  }

  const handleCopyPassword = () => {
    copyToClipboard(registerForm.password, 'Temporary password')
  }

  const openRegistrationForm = () => {
    activeModalTab.value = 'register'
  }

  const resetRegisterForm = () => {
    registerForm.firstName = ''
    registerForm.middleName = ''
    registerForm.lastName = ''
    registerForm.email = ''
    registerForm.contact_number = ''
    registerForm.password = generateTemporaryPassword('Patient')
    registerForm.date_of_birth = ''
    registerForm.age = ''
    registerForm.gender = 'Female'
    registerForm.street = ''
    registerForm.barangay = ''
    registrationError.value = null
  }

  const shouldCreateAccount = ref(true)

  // Reset registration form inputs only when the modal is closed
  watch(isPatientModalOpen, isOpen => {
    if (!isOpen) {
      resetRegisterForm()
      shouldCreateAccount.value = true
      activeModalTab.value = 'appointments'
    }
  })

  const handleRegisterPatient = async () => {
    if (!shouldCreateAccount.value) {
      if (!registerForm.firstName.trim() || !registerForm.lastName.trim()) {
        registrationError.value = 'First Name and Last Name are required.'
        return
      }

      if (!registerForm.date_of_birth) {
        registrationError.value = 'Please provide the patient’s Date of Birth.'
        return
      }

      const calculatedAge = calculatedRegisterAge.value ?? undefined

      if (registerForm.contact_number) {
        const parts = splitFullPhoneNumber(registerForm.contact_number)
        const res = validatePhoneNumber(parts.national, parts.dialCode)
        if (!res.valid) {
          registrationError.value = res.error
          return
        }
      }

      const walkInPayload: PendingPatientRegistration = {
        firstName: registerForm.firstName.trim(),
        middleName: registerForm.middleName?.trim() || undefined,
        lastName: registerForm.lastName.trim(),
        date_of_birth: registerForm.date_of_birth || undefined,
        age: calculatedAge,
        gender: registerForm.gender || undefined,
        contact_number: registerForm.contact_number?.trim() || undefined,
        email: '',
        password: '',
        is_walk_in: true
      }

      walkInPatientInfo.value = {
        firstName: walkInPayload.firstName,
        middleName: walkInPayload.middleName,
        lastName: walkInPayload.lastName,
        age: walkInPayload.age,
        gender: walkInPayload.gender,
        date_of_birth: walkInPayload.date_of_birth,
        contact_number: walkInPayload.contact_number
      }
      pendingPatientRegistration.value = walkInPayload
      patientUuid.value = 'pending_new_patient'
      assignedName.value = `${walkInPayload.firstName} ${walkInPayload.lastName}`
      userName.value = assignedName.value
      assignedAppointment.value = null

      saveActiveDiagnosisState()

      toast.success(
        `Walk-in patient ${assignedName.value} prepared! Patient record will be saved when you complete the diagnosis.`
      )

      activeModalTab.value = 'appointments'
      isPatientModalOpen.value = false
      resetRegisterForm()
      return
    }

    if (
      !registerForm.firstName.trim() ||
      !registerForm.lastName.trim() ||
      !registerForm.email.trim() ||
      !registerForm.password
    ) {
      registrationError.value = 'First Name, Last Name, Email, and Password are required.'
      return
    }

    if (registerForm.contact_number) {
      const parts = splitFullPhoneNumber(registerForm.contact_number)
      const res = validatePhoneNumber(parts.national, parts.dialCode)
      if (!res.valid) {
        registrationError.value = res.error
        return
      }
    }

    isSubmittingRegistration.value = true
    registrationError.value = null

    try {
      const payload: PendingPatientRegistration = {
        firstName: registerForm.firstName.trim(),
        middleName: registerForm.middleName?.trim() || undefined,
        lastName: registerForm.lastName.trim(),
        email: registerForm.email.trim(),
        contact_number: registerForm.contact_number?.trim() || undefined,
        password: registerForm.password,
        date_of_birth: registerForm.date_of_birth || undefined,
        age: calculatedRegisterAge.value ?? undefined,
        gender: registerForm.gender || undefined,
        street: registerForm.street?.trim() || undefined,
        barangay: registerForm.barangay?.trim() || undefined
      }

      walkInPatientInfo.value = null
      pendingPatientRegistration.value = payload
      patientUuid.value = 'pending_new_patient'
      assignedName.value = `${payload.firstName} ${payload.lastName}`
      userName.value = assignedName.value
      assignedAppointment.value = null

      saveActiveDiagnosisState()

      toast.success(
        `Patient ${payload.firstName} ${payload.lastName} assigned! Account will be created when diagnosis is saved.`
      )

      activeModalTab.value = 'appointments'
      isPatientModalOpen.value = false
      resetRegisterForm()
    } catch (e: any) {
      console.error('Registration failed:', e)
      const msg =
        e?.data?.message || e?.response?._data?.message || 'Failed to stage patient registration.'
      registrationError.value = msg
      toast.error(msg)
    } finally {
      isSubmittingRegistration.value = false
    }
  }

  // ─── Scan & Diagnose Workflow ───────────────────────────────────────────────
  const captureAndDiagnose = async () => {
    if (isScanning.value) return

    // Doctor Requirement: A patient must be assigned before scan can proceed
    if (!patientUuid.value) {
      toast.error('Please assign or register a patient before starting the diagnosis scan.')
      isPatientModalOpen.value = true
      return
    }

    if (previewImage.value && selectedFile.value) {
      await runDiagnosis(selectedFile.value)
      return
    }

    if (!videoRef.value || !canvasRef.value || !isCameraOn.value) {
      errorMessage.value = 'Please upload a photo or turn on the camera'
      return
    }

    const video = videoRef.value
    const canvas = canvasRef.value
    const context = canvas.getContext('2d')
    if (!context) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    if (currentFacingMode.value === 'user') {
      context.save()
      context.scale(-1, 1)
      context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
      context.restore()
    } else {
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
    }

    previewImage.value = canvas.toDataURL('image/jpeg')
    stopCamera()
    isCameraOn.value = false

    canvas.toBlob(
      async blob => {
        if (blob) {
          const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' })
          selectedFile.value = file
          await runDiagnosis(file)
        }
      },
      'image/jpeg',
      0.85
    )
  }

  const runDiagnosis = async (file: File) => {
    isScanning.value = true
    errorMessage.value = ''
    try {
      const compressedBlob = await compressImage(file)
      const finalFile = new File([compressedBlob], 'scan.jpg', { type: 'image/jpeg' })

      const formData = new FormData()
      formData.append('image', finalFile)
      if (userUuid.value) {
        formData.append('user_uuid', userUuid.value)
      }
      const isValidUuid = (val?: string | null) =>
        !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)

      if (
        isValidUuid(patientUuid.value) &&
        !pendingPatientRegistration.value &&
        patientUuid.value !== 'pending_new_patient' &&
        patientUuid.value !== 'walk_in_guest'
      ) {
        formData.append('patient_uuid', patientUuid.value)
      }

      const response = await diagnosisService.create(formData, {
        headers: userUuid.value ? { 'X-User-Uuid': userUuid.value } : {}
      })
      if (response) {
        setDiagnosis(response as any)
        if (isHealthyState.value) {
          errorMessage.value = 'Healthy skin detected. No disease present.'
          toast.info('Healthy skin detected. No disease present.')
        } else if (isNoneState.value) {
          errorMessage.value = 'Non-skin image detected. Scan skin to proceed.'
          toast.error('Non-skin image detected. Scan skin to proceed.')
        } else {
          // Link patient to diagnosis explicitly
          try {
            const uuid = (response as any).uuid || (response as any).id
            if (
              uuid &&
              isValidUuid(patientUuid.value) &&
              patientUuid.value !== 'pending_new_patient' &&
              patientUuid.value !== 'walk_in_guest'
            ) {
              await diagnosisService.update(uuid, { patient_uuid: patientUuid.value })
            }
          } catch (updateErr) {
            console.error('Failed to update diagnosis with patient uuid:', updateErr)
          }
          router.push('/Doctor/Scan/Results')
        }
      }
    } catch (err: any) {
      errorMessage.value = err.data?.error || err.statusMessage || err.message || 'Scanning error.'
    } finally {
      isScanning.value = false
    }
  }
</script>

<template>
  <div
    class="fixed inset-0 overflow-hidden bg-black"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div
      v-if="isDraggingOver && !isScanning"
      class="border-primary pointer-events-none absolute inset-4 z-50 flex flex-col items-center justify-center rounded-3xl border-4 border-dashed bg-black/85 p-6 text-center backdrop-blur-md transition-all duration-150"
    >
      <div
        class="bg-primary/20 text-primary ring-primary/10 mb-4 flex h-20 w-20 animate-bounce items-center justify-center rounded-full ring-8"
      >
        <Icon
          name="material-symbols:add-photo-alternate-rounded"
          class="text-4xl"
        />
      </div>
      <h3 class="mb-1 text-xl font-black tracking-tight text-white">Drop Image or Link Here</h3>
      <p class="mb-4 text-sm leading-relaxed text-gray-300">
        Release image file or web link to load and analyze for clinical assessment
      </p>
      <div class="flex items-center gap-2">
        <span
          class="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wider text-white/90 uppercase"
        >
          JPG, PNG, WEBP
        </span>
        <span
          class="bg-primary/20 text-primary border-primary/30 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wider uppercase"
        >
          Image URLs & Links
        </span>
      </div>
    </div>

    <!-- === FULLSCREEN VIDEO / PREVIEW === -->
    <video
      v-show="isCameraOn && !previewImage"
      ref="videoRef"
      autoplay
      playsinline
      muted
      class="absolute inset-0 h-full w-full object-cover"
      :class="{ '-scale-x-100': currentFacingMode === 'user' }"
    ></video>

    <img
      v-if="previewImage"
      :src="previewImage"
      class="absolute inset-0 h-full w-full bg-black object-contain"
    />

    <!-- === EMPTY STATE (no camera, no image) === -->
    <div
      v-if="!isCameraOn && !previewImage"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 select-none"
    >
      <Icon
        name="solar:camera-minimalistic-linear"
        class="text-8xl text-white/10"
      />
      <p class="text-sm font-medium text-white/25">
        Tap the camera button or drop an image to start
      </p>
    </div>

    <!-- === TOP HUD: Patient Assignment Chip & Status === -->
    <div
      class="pointer-events-none absolute top-0 right-0 left-0 z-30 flex flex-col items-center gap-2.5 px-4 pt-22 sm:pt-28"
    >
      <!-- Doctor Patient Assignment Floating Chip -->
      <div class="pointer-events-auto mt-2 sm:mt-3">
        <div
          v-if="selectedPatientName"
          class="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/70 py-1 pr-2.5 pl-3.5 text-white shadow-lg backdrop-blur-md"
        >
          <button
            type="button"
            @click="openPatientModal"
            class="flex items-center gap-2.5 text-left transition-all active:scale-95"
          >
            <div
              class="bg-primary/20 text-primary flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
            >
              <Icon
                name="material-symbols:person"
                class="text-sm"
              />
            </div>
            <div class="flex flex-col text-left">
              <span class="max-w-[140px] truncate text-xs leading-tight font-bold">{{
                selectedPatientName
              }}</span>
              <span class="text-[10px] font-medium text-white/70">{{ assignedBadgeText }}</span>
            </div>
            <span
              class="text-primary hover:text-primary/80 ml-1 text-[11px] font-bold underline underline-offset-2"
            >
              Change
            </span>
          </button>

          <button
            type="button"
            @click.stop="clearAssignedPatient"
            class="ml-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 transition-all hover:bg-rose-500 hover:text-white"
            title="Clear assigned patient"
          >
            <Icon
              name="lucide:x"
              class="text-[11px]"
            />
          </button>
        </div>

        <button
          v-else
          type="button"
          @click="openPatientModal"
          class="bg-primary hover:bg-primary/95 flex items-center gap-2 rounded-full border border-white/20 px-3.5 py-1.5 text-white backdrop-blur-md transition-all active:scale-95"
        >
          <div class="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
            <Icon
              name="material-symbols:person-add-rounded"
              class="text-sm"
            />
          </div>
          <span class="text-xs font-bold tracking-wider uppercase">Assign Patient</span>
          <span
            class="flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-black tracking-wider text-white uppercase"
          >
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
            Required
          </span>
        </button>
      </div>

      <!-- No image found pill -->
      <div
        v-if="!isCameraOn && !previewImage"
        class="flex items-center gap-2 rounded-full bg-black/60 px-5 py-2 backdrop-blur-md"
      >
        <Icon
          name="solar:camera-minimalistic-broken"
          class="text-white/50"
          size="16"
        />
        <span class="text-xs font-semibold tracking-wider text-white/70 uppercase">
          No Image Found
        </span>
      </div>

      <!-- Error message pill -->
      <div
        v-if="errorMessage"
        class="border-red flex max-w-xs items-start gap-2 rounded-2xl border bg-red-500/30 px-4 py-2.5 backdrop-blur-md"
      >
        <Icon
          name="material-symbols:error-outline-rounded"
          class="mt-0.5 shrink-0 text-white"
          size="16"
        />
        <span class="text-xs leading-snug font-semibold text-white">{{ errorMessage }}</span>
      </div>
    </div>

    <!-- === AUGMENTED REALITY OVERLAYS (only on live camera) === -->
    <template v-if="isCameraOn && !previewImage && !isScanning">
      <!-- Quality warning AR overlay -->
      <div
        v-if="qualityError"
        class="pointer-events-none absolute inset-x-0 top-1/3 z-20 flex items-center justify-center"
      >
        <div
          class="mx-6 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-black/40 px-5 py-3 backdrop-blur-sm"
        >
          <Icon
            name="material-symbols:warning-outline-rounded"
            class="shrink-0 animate-pulse text-2xl text-amber-400"
          />
          <div>
            <p class="text-xs font-black tracking-wider text-amber-300 uppercase">
              Image Quality Warning
            </p>
            <p class="mt-0.5 text-sm font-semibold text-white/80">{{ qualityError }}</p>
          </div>
        </div>
      </div>

      <!-- Corner bracket targeting frame -->
      <div
        v-if="!qualityError"
        class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      >
        <div class="relative h-64 w-64">
          <div
            class="absolute top-0 left-0 h-10 w-10 rounded-tl-lg border-t-[3px] border-l-[3px] border-white/80"
          ></div>
          <div
            class="absolute top-0 right-0 h-10 w-10 rounded-tr-lg border-t-[3px] border-r-[3px] border-white/80"
          ></div>
          <div
            class="absolute bottom-0 left-0 h-10 w-10 rounded-bl-lg border-b-[3px] border-l-[3px] border-white/80"
          ></div>
          <div
            class="absolute right-0 bottom-0 h-10 w-10 rounded-br-lg border-r-[3px] border-b-[3px] border-white/80"
          ></div>
          <div class="absolute inset-0 flex items-end justify-center pb-3">
            <span class="text-[10px] font-semibold tracking-widest text-white/40 uppercase">
              Place skin within frame
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- === SCANNING OVERLAY === -->
    <div
      v-if="isScanning"
      class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm"
    >
      <div
        class="border-t-primary h-16 w-16 animate-spin rounded-full border-4 border-white/20"
      ></div>
      <p class="text-base font-black tracking-widest text-white uppercase">
        Analyzing skin image...
      </p>
      <p class="text-xs font-medium text-white/50">Running clinical AI assessment</p>
    </div>

    <!-- === FLIP & RETAKE BUTTONS === -->
    <div class="absolute top-36 right-4 z-30 flex flex-col gap-2 sm:top-40">
      <button
        v-if="isCameraOn && !previewImage && !isScanning"
        @click="flipCamera"
        class="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition-all active:scale-90"
      >
        <Icon
          name="material-symbols:flip-camera-android-rounded"
          size="22"
        />
      </button>

      <button
        v-if="previewImage && !isScanning"
        @click="resetToCamera"
        class="flex h-11 items-center gap-2 rounded-full border border-white/20 bg-black/50 px-4 text-white backdrop-blur-md transition-all active:scale-90"
      >
        <Icon
          name="material-symbols:arrow-back-rounded"
          size="18"
        />
        <span class="text-xs font-bold">Retake</span>
      </button>
    </div>

    <!-- Upload quality warning pill -->
    <div
      v-if="uploadQualityWarning && previewImage"
      class="pointer-events-none absolute right-0 bottom-44 left-0 z-30 flex justify-center px-6"
    >
      <div
        class="flex max-w-xs items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/40 px-5 py-3 backdrop-blur-sm"
      >
        <Icon
          name="material-symbols:warning-outline-rounded"
          class="shrink-0 animate-pulse text-xl text-white"
        />
        <div>
          <p class="text-xs font-black tracking-wider text-white uppercase">Upload Warning</p>
          <p class="mt-0.5 text-sm font-medium text-white/90">{{ uploadQualityWarning }}</p>
        </div>
      </div>
    </div>

    <!-- AI Disclaimer Banner -->
    <div
      v-if="!isScanning"
      class="absolute right-4 bottom-48 left-4 z-30 flex justify-center"
    >
      <div
        class="flex max-w-sm items-center gap-2 rounded-2xl border border-white/20 bg-black/75 px-3.5 py-1.5 text-white shadow-2xl backdrop-blur-md"
      >
        <Icon
          name="lucide:info"
          class="text-primary h-3.5 w-3.5 shrink-0"
        />
        <p class="text-[10px] leading-tight text-white/90 select-none">
          AI results are assistive only.
          <button
            type="button"
            class="text-primary font-bold underline underline-offset-2 hover:opacity-80"
            @click.stop="openTermsModal('terms')"
          >
            Medical Disclaimer
          </button>
          &
          <button
            type="button"
            class="text-primary font-bold underline underline-offset-2 hover:opacity-80"
            @click.stop="openTermsModal('privacy')"
          >
            Privacy Policy
          </button>
        </p>
      </div>
    </div>

    <!-- === BOTTOM CONTROLS === -->
    <div class="absolute right-0 bottom-0 left-0 z-30 px-8 pt-4 pb-24">
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/60 to-transparent"
      ></div>

      <div class="relative flex items-center justify-between">
        <!-- Gallery / Upload button -->
        <button
          @click="triggerFileInput"
          class="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-black/50 text-white backdrop-blur-md transition-all active:scale-90"
        >
          <Icon
            name="famicons:folder-outline"
            size="28"
          />
        </button>

        <!-- Main shutter / diagnose button -->
        <button
          @click="captureAndDiagnose"
          :disabled="isScanning || (qualityError !== null && isCameraOn)"
          class="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-2xl transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <div
            class="flex h-16 w-16 items-center justify-center rounded-full border-4 border-black/10"
          >
            <Icon
              v-if="previewImage"
              name="solar:arrow-right-bold"
              size="28"
              class="text-primary"
            />
            <Icon
              v-else
              name="lucide:aperture"
              size="28"
              class="text-black"
            />
          </div>
        </button>

        <!-- Camera toggle button -->
        <button
          @click="toggleCamera"
          class="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-black/50 backdrop-blur-md transition-all active:scale-90"
          :class="isCameraOn ? 'text-primary border-primary/40' : 'text-white'"
        >
          <Icon
            :name="
              isCameraOn
                ? 'material-symbols:videocam-rounded'
                : 'material-symbols:videocam-off-rounded'
            "
            size="28"
          />
        </button>
      </div>
    </div>

    <!-- Hidden inputs -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileUpload"
    />
    <canvas
      ref="canvasRef"
      class="hidden"
    ></canvas>

    <!-- Terms & Medical Disclaimer Modal -->
    <AppModalTermsModal
      v-model="showTermsModal"
      :initial-tab="termsInitialTab"
      @accept="agreeToConsent = true"
    />

    <!-- === DOCTOR PATIENT ASSIGNMENT & ACCOUNT CREATION MODAL === -->
    <AppModal
      v-model="isPatientModalOpen"
      :title="
        activeModalTab === 'register'
          ? 'Register Patient Account'
          : activeModalTab === 'registered'
            ? 'Select Walk-In Patient'
            : 'Assign Appointment Patient'
      "
      :description="
        activeModalTab === 'register'
          ? 'Register a new patient account linked exclusively to your clinic.'
          : activeModalTab === 'registered'
            ? 'Select a registered patient under your clinic for an unscheduled scan.'
            : 'Select a scheduled appointment patient for this clinical scan session.'
      "
      size="2xl"
      compact
      hide-scrollbar
    >
      <!-- Clear current assignment notice / button inside modal if patient is assigned -->
      <div
        v-if="patientUuid || pendingPatientRegistration || walkInPatientInfo || assignedName"
        class="mb-3.5 flex items-center justify-between rounded-2xl border border-gray-200/80 bg-gray-50 px-3.5 py-2 text-xs"
      >
        <span class="truncate font-medium text-gray-600">
          Currently assigned:
          <strong class="text-gray-900">{{ selectedPatientName || assignedName }}</strong>
        </span>
        <button
          type="button"
          @click="clearAssignedPatient"
          class="ml-2 inline-flex cursor-pointer items-center gap-1 font-bold text-rose-600 transition-colors hover:text-rose-800"
        >
          <Icon
            name="lucide:x"
            class="text-xs"
          />
          Clear Assignment
        </button>
      </div>

      <!-- Mode Navigation Tabs -->
      <div
        class="mb-4 flex items-center gap-1 rounded-2xl bg-gray-100/80 p-1 text-xs font-bold sm:gap-1.5"
      >
        <button
          type="button"
          @click="activeModalTab = 'appointments'"
          class="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-bold whitespace-nowrap transition-all sm:gap-1.5 sm:text-xs"
          :class="
            activeModalTab === 'appointments'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          "
        >
          <span>Appointments</span>
          <span
            class="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            :class="
              activeModalTab === 'appointments'
                ? 'bg-primary/10 text-primary'
                : 'bg-gray-200 text-gray-600'
            "
          >
            {{ allAppointmentsCount }}
          </span>
        </button>

        <button
          type="button"
          @click="activeModalTab = 'registered'"
          class="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-bold whitespace-nowrap transition-all sm:gap-1.5 sm:text-xs"
          :class="
            activeModalTab === 'registered'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          "
        >
          <span>Registered</span>
          <span
            class="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            :class="
              activeModalTab === 'registered'
                ? 'bg-indigo-50 text-indigo-700'
                : 'bg-gray-200 text-gray-600'
            "
          >
            {{ registeredPatientsCount }}
          </span>
        </button>

        <button
          type="button"
          @click="openRegistrationForm"
          class="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-bold whitespace-nowrap transition-all sm:gap-1.5 sm:text-xs"
          :class="
            activeModalTab === 'register'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          "
        >
          <span>+ New Patient</span>
        </button>
      </div>

      <!-- 1. Appointments View -->
      <div
        v-if="activeModalTab === 'appointments'"
        class="flex flex-col gap-3.5"
      >
        <!-- Date Filters -->
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            @click="selectedDateFilter = 'today'"
            class="rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
            :class="
              selectedDateFilter === 'today'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            "
          >
            Today
          </button>
          <button
            type="button"
            @click="selectedDateFilter = 'tomorrow'"
            class="rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
            :class="
              selectedDateFilter === 'tomorrow'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            "
          >
            Tomorrow
          </button>
          <button
            type="button"
            @click="selectedDateFilter = 'all'"
            class="rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
            :class="
              selectedDateFilter === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            "
          >
            All Dates
          </button>
          <div class="flex items-center gap-1 rounded-xl bg-gray-100 px-2 py-1 text-xs">
            <Icon
              name="material-symbols:calendar-today-outline"
              class="text-gray-500"
            />
            <input
              type="date"
              v-model="customSelectedDate"
              @change="selectedDateFilter = 'custom'"
              class="cursor-pointer bg-transparent text-xs font-bold text-gray-700 outline-none"
            />
          </div>
        </div>

        <!-- Search input -->
        <div class="relative">
          <Icon
            name="material-symbols:search"
            class="absolute top-1/2 left-3.5 -translate-y-1/2 text-lg text-gray-400"
          />
          <input
            v-model="patientSearchQuery"
            type="text"
            placeholder="Search scheduled patients by name or email..."
            class="focus:border-primary w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pr-4 pl-10 text-xs transition-colors outline-none"
          />
        </div>

        <!-- Appointments List -->
        <div class="custom-scrollbar flex max-h-[46vh] flex-col gap-2.5 overflow-y-auto pr-1">
          <div
            v-if="filteredAppointments.length === 0"
            class="flex flex-col items-center justify-center py-10 text-center"
          >
            <div
              class="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400"
            >
              <Icon
                name="material-symbols:event-busy-outline-rounded"
                class="text-2xl"
              />
            </div>
            <p class="text-sm font-bold text-gray-700">No scheduled appointments found</p>
            <p class="mt-1 text-xs text-gray-400">
              Try changing the date filter or assign a walk-in patient.
            </p>
          </div>

          <div
            v-for="appt in filteredAppointments"
            :key="appt.uuid"
            @click="selectAppointment(appt)"
            class="group flex cursor-pointer items-center justify-between rounded-2xl border p-3.5 transition-all"
            :class="
              patientUuid === appt.patient_uuid
                ? 'border-primary bg-primary/5 shadow-xs'
                : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/80'
            "
          >
            <div class="flex min-w-0 items-center gap-3">
              <img
                :src="
                  appt.avatar_path
                    ? getStorageUrl(appt.avatar_path)
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(appt.patientName)}&background=7B5EF5&color=fff&size=128`
                "
                class="h-10 w-10 shrink-0 rounded-xl object-cover"
                alt="Patient avatar"
              />
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="truncate text-xs font-bold text-gray-900">{{ appt.patientName }}</p>
                  <span
                    class="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase"
                    :class="
                      appt.isToday
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-indigo-50 text-indigo-700'
                    "
                  >
                    {{ appt.isToday ? 'Today' : formatPatientDate(appt.date) }}
                  </span>
                </div>
                <p class="mt-0.5 truncate text-[11px] text-gray-500">
                  <span>{{ appt.timeRange }}</span>
                  <span v-if="appt.purpose"> • {{ appt.purpose }}</span>
                </p>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <span
                v-if="patientUuid === appt.patient_uuid"
                class="bg-primary flex h-6 w-6 items-center justify-center rounded-full text-white shadow-xs"
              >
                <Icon
                  name="material-symbols:check"
                  class="text-sm font-bold"
                />
              </span>
              <span
                v-else
                class="text-primary group-hover:bg-primary rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold transition-all group-hover:text-white"
              >
                Assign
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Registered (Walk-In) View -->
      <div
        v-else-if="activeModalTab === 'registered'"
        class="flex flex-col gap-3.5"
      >
        <div class="relative">
          <Icon
            name="material-symbols:search"
            class="absolute top-1/2 left-3.5 -translate-y-1/2 text-lg text-gray-400"
          />
          <input
            v-model="patientSearchQuery"
            type="text"
            placeholder="Search registered patients by name or email..."
            class="focus:border-primary w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pr-4 pl-10 text-xs transition-colors outline-none"
          />
        </div>

        <div class="custom-scrollbar flex max-h-[46vh] flex-col gap-2.5 overflow-y-auto pr-1">
          <div
            v-if="filteredRegisteredPatients.length === 0"
            class="flex flex-col items-center justify-center py-10 text-center"
          >
            <div
              class="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400"
            >
              <Icon
                name="material-symbols:person-off-outline-rounded"
                class="text-2xl"
              />
            </div>
            <p class="text-sm font-bold text-gray-700">No registered patients found</p>
            <p class="mt-1 text-xs text-gray-400">Click '+ New Patient' to create an account.</p>
          </div>

          <div
            v-for="patient in filteredRegisteredPatients"
            :key="patient.uuid"
            @click="selectRegisteredPatient(patient)"
            class="group flex cursor-pointer items-center justify-between rounded-2xl border p-3.5 transition-all"
            :class="
              (patientUuid === patient.uuid ||
                (patient.isPendingCreation &&
                  (patientUuid === 'pending_new_patient' || !!pendingPatientRegistration))) &&
              !assignedAppointment
                ? 'border-primary bg-primary/5 shadow-xs'
                : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/80'
            "
          >
            <div class="flex min-w-0 items-center gap-3">
              <img
                :src="
                  patient.avatar_path
                    ? getStorageUrl(patient.avatar_path)
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.first_name + ' ' + patient.last_name)}&background=7B5EF5&color=fff&size=128`
                "
                class="h-10 w-10 shrink-0 rounded-xl object-cover"
                alt="Patient avatar"
              />
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <p class="truncate text-xs font-bold text-gray-900">
                    {{ patient.first_name }} {{ patient.last_name }}
                  </p>
                  <span
                    v-if="patient.isPendingCreation"
                    class="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-800 uppercase"
                  >
                    Staged
                  </span>
                </div>
                <p class="mt-0.5 truncate text-[11px] text-gray-500">
                  {{ patient.email || patient.contact_number || 'No contact info' }}
                </p>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <span
                v-if="
                  patientUuid === patient.uuid ||
                  (patient.isPendingCreation &&
                    (patientUuid === 'pending_new_patient' || !!pendingPatientRegistration))
                "
                class="bg-primary flex h-6 w-6 items-center justify-center rounded-full text-white shadow-xs"
              >
                <Icon
                  name="material-symbols:check"
                  class="text-sm font-bold"
                />
              </span>
              <span
                v-else
                class="text-primary group-hover:bg-primary rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold transition-all group-hover:text-white"
              >
                Select
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. + New Patient Account Creation Form -->
      <div
        v-else-if="activeModalTab === 'register'"
        class="flex flex-col gap-3 py-0.5"
      >
        <form
          @submit.prevent="handleRegisterPatient"
          class="flex flex-col gap-3 text-left"
        >
          <!-- Account Creation Selection Mode -->
          <div class="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-2.5">
            <label class="mb-1.5 block px-1 text-[11px] font-bold text-indigo-900"
              >Patient Registration Type</label
            >
            <div class="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                @click="shouldCreateAccount = true"
                class="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold transition-all"
                :class="
                  shouldCreateAccount
                    ? 'border border-indigo-200/60 bg-white text-indigo-600 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                "
              >
                <Icon
                  name="material-symbols:account-circle-outline"
                  class="shrink-0 text-sm"
                />
                <span>Create Account</span>
              </button>
              <button
                type="button"
                @click="shouldCreateAccount = false"
                class="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold transition-all"
                :class="
                  !shouldCreateAccount
                    ? 'border border-indigo-200/60 bg-white text-indigo-600 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                "
              >
                <Icon
                  name="material-symbols:badge-outline"
                  class="shrink-0 text-sm"
                />
                <span>No Account (Walk-In)</span>
              </button>
            </div>
            <p class="mt-1.5 px-1 text-[10px] leading-relaxed text-gray-500">
              <span v-if="shouldCreateAccount">
                Generates online portal credentials (email & temporary password) so the patient can
                log in.
              </span>
              <span v-else>
                Sets patient name & age for this consultation only without creating an online login
                account.
              </span>
            </p>
          </div>

          <div
            v-if="registrationError"
            class="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600"
          >
            <Icon
              name="material-symbols:error-outline-rounded"
              class="shrink-0 text-base"
            />
            <span>{{ registrationError }}</span>
          </div>

          <!-- Name fields -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div class="flex flex-col gap-1">
              <label class="text-[11px] font-bold text-gray-600"
                >First Name <span class="text-red-500">*</span></label
              >
              <input
                v-model="registerForm.firstName"
                type="text"
                required
                placeholder="John"
                class="focus:border-primary rounded-xl border border-gray-200 p-2.5 text-xs outline-none"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[11px] font-bold text-gray-600">Middle Name</label>
              <input
                v-model="registerForm.middleName"
                type="text"
                placeholder="Optional"
                class="focus:border-primary rounded-xl border border-gray-200 p-2.5 text-xs outline-none"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[11px] font-bold text-gray-600"
                >Last Name <span class="text-red-500">*</span></label
              >
              <input
                v-model="registerForm.lastName"
                type="text"
                required
                placeholder="Doe"
                class="focus:border-primary rounded-xl border border-gray-200 p-2.5 text-xs outline-none"
              />
            </div>
          </div>

          <!-- Email & Phone (Only shown when creating an account) -->
          <div
            v-if="shouldCreateAccount"
            class="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <div class="flex flex-col gap-1">
              <label class="text-[11px] font-bold text-gray-600"
                >Email Address <span class="text-red-500">*</span></label
              >
              <input
                v-model="registerForm.email"
                type="email"
                :required="shouldCreateAccount"
                placeholder="john.doe@example.com"
                class="focus:border-primary rounded-xl border border-gray-200 p-2.5 text-xs outline-none"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[11px] font-bold text-gray-600">Contact Number</label>
              <AppPhoneInput
                v-model="registerForm.contact_number"
                placeholder="0912 345 6789"
                compact
              />
            </div>
          </div>

          <!-- Temporary Password Generator (Only shown when creating an account) -->
          <div
            v-if="shouldCreateAccount"
            class="flex flex-col gap-1.5 rounded-2xl border border-gray-100 bg-gray-50/50 p-3.5"
          >
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-700">
                Temporary Password <span class="text-red-500">*</span>
              </label>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="handleCopyPassword"
                  class="text-primary hover:text-primary/80 flex items-center gap-1 text-[11px] font-bold"
                >
                  <Icon
                    name="material-symbols:content-copy-outline"
                    class="text-xs"
                  />
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  @click="handleRegeneratePassword"
                  class="hover:text-primary flex items-center gap-1 text-[11px] font-bold text-gray-500"
                >
                  <Icon
                    name="material-symbols:refresh-rounded"
                    class="text-xs"
                  />
                  <span>Regenerate</span>
                </button>
              </div>
            </div>
            <div class="relative">
              <input
                :type="showPassword ? 'text' : 'password'"
                v-model="registerForm.password"
                :required="shouldCreateAccount"
                class="focus:border-primary w-full rounded-xl border border-gray-200 bg-white py-2 pr-10 pl-3 font-mono text-xs outline-none"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <Icon
                  :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'"
                  class="text-sm"
                />
              </button>
            </div>
            <p class="text-[10px] text-gray-400">
              Provide this temporary password to the patient so they can sign in and view their
              findings.
            </p>
          </div>

          <!-- DOB & Gender -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-gray-600">
                  Date of Birth
                  <span
                    v-if="!shouldCreateAccount"
                    class="text-red-500"
                    >*</span
                  >
                </label>
                <span
                  v-if="calculatedRegisterAge !== null"
                  class="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700"
                >
                  <Icon
                    name="heroicons:cake-20-solid"
                    size="10"
                  />
                  {{ calculatedRegisterAge }} yrs old
                </span>
              </div>
              <input
                v-model="registerForm.date_of_birth"
                type="date"
                :max="todayIsoDate"
                :required="!shouldCreateAccount"
                class="focus:border-primary rounded-xl border border-gray-200 p-2.5 text-xs outline-none"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[11px] font-bold text-gray-600">Gender</label>
              <select
                v-model="registerForm.gender"
                class="focus:border-primary rounded-xl border border-gray-200 bg-white p-2.5 text-xs outline-none"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <!-- Contact Number when No Account -->
          <div
            v-if="!shouldCreateAccount"
            class="flex flex-col gap-1"
          >
            <label class="text-[11px] font-bold text-gray-600">Contact Number (Optional)</label>
            <AppPhoneInput
              v-model="registerForm.contact_number"
              placeholder="0912 345 6789"
              compact
            />
          </div>

          <div class="mt-2 flex items-center justify-end gap-2.5 pt-2">
            <AppButton
              type="button"
              variant="ghost"
              size="sm"
              @click="activeModalTab = 'appointments'"
              class="rounded-xl font-bold text-gray-500"
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              variant="solid"
              size="sm"
              :loading="isSubmittingRegistration"
              class="bg-primary hover:bg-primary/90 rounded-xl px-5 py-2 font-bold text-white shadow-md"
            >
              {{ shouldCreateAccount ? 'Register & Assign Account' : 'Set Patient (No Account)' }}
            </AppButton>
          </div>
        </form>
      </div>

      <!-- Modal Footer -->
      <template #footer>
        <div class="flex w-full items-center justify-between">
          <AppButton
            v-if="patientUuid"
            variant="outline"
            size="sm"
            @click="clearAssignedPatient"
            class="rounded-xl text-xs font-bold text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            Clear Selection
          </AppButton>
          <div v-else></div>

          <AppButton
            variant="ghost"
            size="sm"
            @click="isPatientModalOpen = false"
            class="rounded-xl font-bold text-gray-500"
          >
            Close
          </AppButton>
        </div>
      </template>
    </AppModal>
  </div>
</template>
