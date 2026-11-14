<script setup lang="ts">
  import { ref, reactive, watch } from 'vue'
  import { toast } from 'vue-sonner'

  interface ClinicData {
    id?: number | string
    uuid?: string
    name?: string
    address?: string | null
    phone?: string | null
    email?: string | null
    is_active?: boolean
    logo_path?: string | null
    logo_url?: string | null
  }

  interface Props {
    modelValue: boolean
    mode?: 'create' | 'edit'
    clinic?: ClinicData | null
    loading?: boolean
    errorMessage?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    mode: 'create',
    clinic: null,
    loading: false,
    errorMessage: ''
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (
      e: 'save',
      payload: {
        name: string
        address: string | null
        phone: string | null
        email: string | null
        is_active: boolean
        logo: string | null
        logoPreview: string
        removedLogo: boolean
      }
    ): void
  }>()

  const fileInputRef = ref<HTMLInputElement | null>(null)
  const isDraggingOver = ref(false)
  const localError = ref('')

  const form = reactive({
    name: '',
    address: '',
    phone: '',
    email: '',
    is_active: true,
    logo: '',
    logoPreview: '',
    removedLogo: false
  })

  const syncFormFromProps = () => {
    localError.value = ''
    if (props.mode === 'edit' && props.clinic) {
      form.name = props.clinic.name || ''
      form.address = props.clinic.address || ''
      form.phone = props.clinic.phone || ''
      form.email = props.clinic.email || ''
      form.is_active = props.clinic.is_active !== false
      form.logo = ''
      form.logoPreview = props.clinic.logo_url || props.clinic.logo_path || ''
      form.removedLogo = false
    } else {
      form.name = ''
      form.address = ''
      form.phone = ''
      form.email = ''
      form.is_active = true
      form.logo = ''
      form.logoPreview = ''
      form.removedLogo = false
    }
  }

  watch(
    () => props.modelValue,
    isOpen => {
      if (isOpen) {
        syncFormFromProps()
      }
    },
    { immediate: true }
  )

  watch(
    () => props.clinic,
    () => {
      if (props.modelValue && props.mode === 'edit') {
        syncFormFromProps()
      }
    }
  )

  const close = () => {
    if (props.loading) return
    emit('update:modelValue', false)
  }

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, or WebP).')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Clinic logo must be under 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = ev => {
      const base64 = ev.target?.result as string
      form.logo = base64
      form.logoPreview = base64
      form.removedLogo = false
      toast.success('Logo selected. See live preview below.')
    }
    reader.readAsDataURL(file)
  }

  const handleFileInputChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (file) {
      processImageFile(file)
    }
    if (target) target.value = ''
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingOver.value = true
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingOver.value = false
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingOver.value = false
    const file = e.dataTransfer?.files?.[0]
    if (file) {
      processImageFile(file)
    }
  }

  const triggerSelectFile = () => {
    fileInputRef.value?.click()
  }

  const removeLogo = () => {
    form.logo = ''
    form.logoPreview = ''
    form.removedLogo = true
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
    toast.info('Logo removed. Default DermAssist logo will be used on prescriptions.')
  }

  const handleSubmit = () => {
    localError.value = ''
    if (!form.name.trim()) {
      localError.value = 'Clinic or hospital name is required.'
      return
    }

    emit('save', {
      name: form.name.trim(),
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      is_active: form.is_active,
      logo: form.logo || null,
      logoPreview: form.logoPreview,
      removedLogo: form.removedLogo
    })
  }
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-6 sm:translate-y-0 sm:scale-95"
      enter-to-class="opacity-100 translate-y-0 sm:scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 sm:scale-100"
      leave-to-class="opacity-0 translate-y-6 sm:translate-y-0 sm:scale-95"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-xs"
        @click.self="close"
        @keydown.esc="close"
      >
        <div
          class="bg-card border-border relative flex max-h-[92dvh] sm:max-h-[88vh] w-full max-w-xl flex-col rounded-t-[2rem] sm:rounded-3xl border shadow-2xl transition-all overflow-hidden"
        >
          <!-- Sticky Header: Stays pinned so close button & context are always accessible -->
          <div
            class="border-border/60 bg-card/95 sticky top-0 z-20 flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-7 sm:py-4.5 backdrop-blur-md"
          >
            <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div
                class="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl shadow-2xs"
                :class="
                  mode === 'edit'
                    ? 'bg-primary/10 text-primary border-primary/20 border'
                    : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                "
              >
                <Icon
                  :name="mode === 'edit' ? 'heroicons:pencil-square' : 'heroicons:building-office-2'"
                  class="h-5 w-5"
                />
              </div>
              <div class="min-w-0">
                <h3 class="text-foreground text-base font-bold tracking-tight sm:text-lg truncate">
                  {{ mode === 'edit' ? 'Edit Clinic Branch' : 'Add Clinic Branch' }}
                </h3>
                <p class="text-muted-foreground truncate text-xs">
                  {{
                    mode === 'edit'
                      ? 'Update location, contact info, and prescription pad branding.'
                      : 'Register a new clinic location and consultation branding.'
                  }}
                </p>
              </div>
            </div>

            <button
              type="button"
              class="text-muted-foreground hover:bg-muted/80 hover:text-foreground flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl p-2 transition"
              title="Close modal"
              @click="close"
            >
              <Icon
                name="heroicons:x-mark"
                class="h-5 w-5"
              />
            </button>
          </div>

          <!-- Scrollable Body: Responsive spacing and scale -->
          <form
            id="clinic-branch-form"
            class="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-7 space-y-4 sm:space-y-5"
            @submit.prevent="handleSubmit"
          >
            <!-- Error Banner -->
            <div
              v-if="errorMessage || localError"
              class="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3 sm:p-3.5 text-xs font-semibold text-red-600"
            >
              <Icon
                name="heroicons:exclamation-circle"
                class="h-4 w-4 shrink-0"
              />
              <span>{{ errorMessage || localError }}</span>
            </div>

            <!-- Clinic Name Input -->
            <div class="space-y-1.5">
              <label class="text-foreground flex items-center justify-between text-xs font-bold">
                <span class="flex items-center gap-1.5">
                  <Icon
                    name="heroicons:building-office-2"
                    class="text-primary h-3.5 w-3.5"
                  />
                  Clinic / Hospital Name <span class="text-rose-500">*</span>
                </span>
                <span class="text-muted-foreground text-[11px] font-normal">Required</span>
              </label>
              <input
                v-model="form.name"
                type="text"
                required
                placeholder="e.g. Davao Skin Specialists Clinic"
                class="border-border bg-foreground/[0.03] focus:border-primary focus:bg-background focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/60 w-full rounded-2xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3"
              />
            </div>

            <!-- Address Field (2-row textarea preventing mobile truncation) -->
            <div class="space-y-1.5">
              <label class="text-foreground flex items-center justify-between text-xs font-bold">
                <span class="flex items-center gap-1.5">
                  <Icon
                    name="heroicons:map-pin"
                    class="text-primary h-3.5 w-3.5"
                  />
                  Address / Floor & Room
                </span>
                <span class="text-muted-foreground text-[11px] font-normal">Appears on Rx</span>
              </label>
              <textarea
                v-model="form.address"
                rows="2"
                placeholder="e.g. Room 302, Medical Arts Building, Davao Doctors Hospital, E. Quirino Ave, Davao City"
                class="border-border bg-foreground/[0.03] focus:border-primary focus:bg-background focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/60 w-full resize-none rounded-2xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3"
              ></textarea>
            </div>

            <!-- Contact Phone & Email Grid (Stacks on mobile, 2 cols on tablet/desktop) -->
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="space-y-1.5">
                <label class="text-foreground flex items-center gap-1.5 text-xs font-bold">
                  <Icon
                    name="heroicons:phone"
                    class="text-primary h-3.5 w-3.5"
                  />
                  Contact Phone
                </label>
                <input
                  v-model="form.phone"
                  type="text"
                  placeholder="e.g. +63 (82) 222-8000"
                  class="border-border bg-foreground/[0.03] focus:border-primary focus:bg-background focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/60 w-full rounded-2xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3"
                />
              </div>

              <div class="space-y-1.5">
                <label class="text-foreground flex items-center gap-1.5 text-xs font-bold">
                  <Icon
                    name="heroicons:envelope"
                    class="text-primary h-3.5 w-3.5"
                  />
                  Clinic Email
                </label>
                <input
                  v-model="form.email"
                  type="email"
                  placeholder="e.g. clinic@dermspecialists.com"
                  class="border-border bg-foreground/[0.03] focus:border-primary focus:bg-background focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/60 w-full rounded-2xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3"
                />
              </div>
            </div>

            <!-- Clinic Logo Upload Section -->
            <div class="space-y-2 pt-0.5">
              <div class="flex items-center justify-between">
                <label class="text-foreground flex items-center gap-1.5 text-xs font-bold">
                  <Icon
                    name="heroicons:photo"
                    class="text-primary h-3.5 w-3.5"
                  />
                  Clinic Logo (for Prescription Pad Header)
                </label>
                <span class="text-muted-foreground text-[10px] sm:text-[11px]">PNG, JPG, WebP ≤ 2MB</span>
              </div>

              <input
                ref="fileInputRef"
                type="file"
                accept="image/png, image/jpeg, image/webp"
                class="hidden"
                @change="handleFileInputChange"
              />

              <!-- Dropzone / Touch Upload Box (Reflowed for mobile tap & desktop drag) -->
              <div
                v-if="!form.logoPreview"
                class="group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 sm:p-6 text-center transition-all"
                :class="
                  isDraggingOver
                    ? 'border-primary bg-primary/10 ring-primary/20 scale-[0.99] ring-4'
                    : 'border-border/80 bg-foreground/[0.015] hover:border-primary/60 hover:bg-foreground/[0.03]'
                "
                @click="triggerSelectFile"
                @dragover="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop"
              >
                <div
                  class="bg-primary/10 text-primary group-hover:scale-110 mb-2 sm:mb-3 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl transition duration-200"
                >
                  <Icon
                    name="lucide:cloud-upload"
                    class="h-5 w-5 sm:h-6 sm:w-6"
                  />
                </div>
                <div class="space-y-0.5 sm:space-y-1">
                  <p class="text-foreground text-xs font-bold">
                    <span class="text-primary underline decoration-primary/40 underline-offset-2 sm:inline hidden"
                      >Click to browse</span
                    >
                    <span class="text-primary underline decoration-primary/40 underline-offset-2 sm:hidden inline"
                      >Tap to select logo</span
                    >
                    <span class="hidden sm:inline"> or drag and drop logo here</span>
                  </p>
                  <p class="text-muted-foreground text-[10px] sm:text-[11px]">
                    Transparent PNG recommended for prescription pad print quality
                  </p>
                </div>
              </div>

              <!-- Uploaded Logo State Card -->
              <div
                v-else
                class="border-border/80 bg-foreground/[0.02] flex flex-col items-start sm:items-center justify-between gap-3 rounded-2xl border p-3 sm:p-3.5 sm:flex-row sm:gap-4"
              >
                <div class="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                  <div
                    class="border-gray-200 bg-white relative flex h-12 w-16 sm:h-14 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border p-1 shadow-2xs"
                  >
                    <img
                      :src="form.logoPreview"
                      alt="Clinic Logo Preview"
                      class="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div class="min-w-0 flex-1 space-y-0.5">
                    <div class="flex items-center gap-1.5">
                      <span class="text-foreground truncate text-xs font-bold">Clinic Logo</span>
                      <span
                        class="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600"
                      >
                        Ready
                      </span>
                    </div>
                    <p class="text-muted-foreground truncate text-[10px] sm:text-[11px]">
                      Ready for prescription slips
                    </p>
                  </div>
                </div>

                <!-- Action Buttons: 44px minimum tap targets on mobile -->
                <div class="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto pt-1 sm:pt-0">
                  <button
                    type="button"
                    class="border-border/80 hover:bg-muted text-foreground flex min-h-[40px] sm:min-h-[34px] flex-1 sm:flex-initial cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition"
                    @click="triggerSelectFile"
                  >
                    <Icon
                      name="heroicons:arrow-path"
                      class="h-3.5 w-3.5"
                    />
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    class="border-border/80 text-rose-600 hover:bg-rose-500/10 flex min-h-[40px] sm:min-h-[34px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition"
                    title="Remove logo and use DermAssist default"
                    @click="removeLogo"
                  >
                    <Icon
                      name="heroicons:trash"
                      class="h-3.5 w-3.5"
                    />
                    <span>Remove</span>
                  </button>
                </div>
              </div>

              <!-- Live Prescription Pad Header Preview: Scaled responsibly for mobile screens -->
              <div class="space-y-1.5 pt-1">
                <div class="flex items-center justify-between px-0.5">
                  <span
                    class="text-muted-foreground/90 flex items-center gap-1 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase"
                  >
                    <Icon
                      name="heroicons:sparkles"
                      class="text-primary h-3.5 w-3.5"
                    />
                    Live Prescription Header Preview
                  </span>
                  <span class="text-muted-foreground text-[9px] sm:text-[10px]">Real-time Rx stationery</span>
                </div>

                <!-- Mini Rx Slip Card on Authentic White Stationery -->
                <div
                  class="border-gray-200/90 relative overflow-hidden rounded-2xl border bg-white p-3 sm:p-4 shadow-sm"
                >
                  <div class="flex items-start justify-between gap-2.5 sm:gap-4 border-b-2 border-indigo-600 pb-2.5 sm:pb-3">
                    <!-- Left: Logo -->
                    <div class="shrink-0">
                      <img
                        :src="form.logoPreview || '/DA_Logo.jpg'"
                        alt="Rx Slip Logo"
                        class="h-8 sm:h-10 w-auto max-w-[80px] sm:max-w-[110px] object-contain rounded-xs"
                      />
                    </div>

                    <!-- Right: Clinic Name, Address, Contact -->
                    <div class="min-w-0 flex-1 text-right">
                      <h4
                        class="truncate text-[11px] sm:text-xs font-extrabold tracking-tight text-indigo-950 uppercase"
                        :class="!form.name.trim() && 'italic opacity-60'"
                      >
                        {{ form.name.trim() || 'YOUR CLINIC / HOSPITAL NAME' }}
                      </h4>
                      <p
                        class="mt-0.5 line-clamp-1 text-[9.5px] sm:text-[10px] leading-tight text-gray-600"
                        :class="!form.address.trim() && 'italic opacity-60'"
                      >
                        {{ form.address.trim() || 'Room 302, Medical Arts Building, Clinic Street' }}
                      </p>
                      <p class="mt-0.5 text-[8.5px] sm:text-[9px] text-gray-500 truncate">
                        <span v-if="form.phone.trim()">Tel: {{ form.phone.trim() }}</span>
                        <span v-if="form.phone.trim() && form.email.trim()"> • </span>
                        <span v-if="form.email.trim()">{{ form.email.trim() }}</span>
                        <span v-if="!form.phone.trim() && !form.email.trim()" class="italic opacity-60"
                          >Contact Phone / Email</span
                        >
                      </p>
                    </div>
                  </div>

                  <!-- Subtle watermark tag -->
                  <div class="mt-2 flex items-center justify-between text-[8.5px] sm:text-[9px] text-gray-400">
                    <span class="flex items-center gap-1 font-mono font-medium">
                      <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      PRESCRIPTION PAD HEADER
                    </span>
                    <span>DermAssist Rx Engine</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Active Status Toggle (in edit mode) -->
            <div
              v-if="mode === 'edit'"
              class="border-border/70 bg-foreground/[0.02] flex items-center justify-between rounded-2xl border p-3.5 sm:p-4 transition-colors"
            >
              <div class="space-y-0.5 pr-2 sm:pr-3">
                <div class="flex items-center gap-2">
                  <span class="text-foreground text-xs font-bold">Active Clinic Branch</span>
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    :class="
                      form.is_active
                        ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                        : 'border border-neutral-300 bg-neutral-200/60 text-neutral-600'
                    "
                  >
                    {{ form.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </div>
                <p class="text-muted-foreground text-[10px] sm:text-[11px] leading-relaxed">
                  Allow patient appointments and availability allocation at this clinic branch.
                </p>
              </div>

              <label class="relative inline-flex shrink-0 cursor-pointer items-center p-1.5 min-h-[44px]">
                <input
                  v-model="form.is_active"
                  type="checkbox"
                  class="peer sr-only"
                />
                <div
                  class="relative peer bg-muted-foreground/20 peer-checked:bg-primary h-6 w-11 rounded-full transition-colors peer-focus:outline-hidden after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-xs after:transition-all after:content-[''] peer-checked:after:translate-x-full"
                ></div>
              </label>
            </div>
          </form>

          <!-- Sticky Footer: Always visible, never covered by bottom nav bars, thumb-friendly tap targets -->
          <div
            class="border-border/60 bg-card/95 sticky bottom-0 z-20 flex shrink-0 items-center justify-end gap-2.5 border-t px-4 py-3 sm:px-7 sm:py-4 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <AppButton
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-[44px] sm:min-h-[38px] px-4 font-semibold"
              :disabled="loading"
              @click="close"
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              form="clinic-branch-form"
              variant="solid"
              size="sm"
              class="min-h-[44px] sm:min-h-[38px] flex-1 sm:flex-initial px-5 font-bold"
              :loading="loading"
              :disabled="!form.name.trim() || loading"
            >
              <Icon
                v-if="!loading"
                :name="mode === 'edit' ? 'heroicons:check' : 'heroicons:plus'"
                class="h-4 w-4"
              />
              <span>{{ mode === 'edit' ? 'Update Clinic' : 'Save Clinic' }}</span>
            </AppButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
