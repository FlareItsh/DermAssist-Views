<script setup lang="ts">
  const props = defineProps<{
    label: string
    modelValue: string | number
    type?: string
    id: string
    error?: string
    placeholder?: string
    autocomplete?: string
    optional?: boolean
    maxlength?: number | string
    inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
    pattern?: string
    onlyDigits?: boolean
    onlyLetters?: boolean
  }>()

  const emit = defineEmits(['update:modelValue'])

  const showPassword = ref(false)
  const togglePassword = () => (showPassword.value = !showPassword.value)

  const inputType = computed(() => {
    if (props.type === 'password') {
      return showPassword.value ? 'text' : 'password'
    }
    return props.type || 'text'
  })

  const isNumericOnly = computed(() => props.onlyDigits || props.inputmode === 'numeric')
  const isLettersOnly = computed(() => props.onlyLetters)

  const handleKeyDown = (event: KeyboardEvent) => {
    // Allow navigation and edit control keys
    const allowedKeys = [
      'Backspace',
      'Tab',
      'Enter',
      'Delete',
      'Escape',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End'
    ]
    if (allowedKeys.includes(event.key)) {
      return
    }
    // Allow clipboard and selection shortcuts: Ctrl/Cmd + A, C, V, X, Z
    if (event.ctrlKey || event.metaKey) {
      return
    }

    if (isNumericOnly.value) {
      // Strictly block non-numeric characters (letters, spaces, punctuation)
      if (!/^[0-9]$/.test(event.key)) {
        event.preventDefault()
      }
    } else if (isLettersOnly.value) {
      // Strictly block numbers 0-9
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault()
      }
    }
  }

  const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (isNumericOnly.value) {
      let cleaned = target.value.replace(/\D/g, '')
      if (props.maxlength) {
        cleaned = cleaned.slice(0, Number(props.maxlength))
      }
      if (target.value !== cleaned) {
        target.value = cleaned
      }
      emit('update:modelValue', cleaned)
    } else if (isLettersOnly.value) {
      let cleaned = target.value.replace(/[0-9]/g, '')
      if (props.maxlength) {
        cleaned = cleaned.slice(0, Number(props.maxlength))
      }
      if (target.value !== cleaned) {
        target.value = cleaned
      }
      emit('update:modelValue', cleaned)
    } else {
      emit('update:modelValue', target.value)
    }
  }

  const handlePaste = (event: ClipboardEvent) => {
    if (isNumericOnly.value) {
      event.preventDefault()
      const pasteText = event.clipboardData?.getData('text') || ''
      const cleaned = pasteText.replace(/\D/g, '')
      const target = event.target as HTMLInputElement
      const current = target.value || ''
      const start = target.selectionStart ?? current.length
      const end = target.selectionEnd ?? current.length
      const max = props.maxlength ? Number(props.maxlength) : Infinity
      const nextVal = (current.slice(0, start) + cleaned + current.slice(end)).slice(0, max)
      target.value = nextVal
      emit('update:modelValue', nextVal)
    } else if (isLettersOnly.value) {
      event.preventDefault()
      const pasteText = event.clipboardData?.getData('text') || ''
      const cleaned = pasteText.replace(/[0-9]/g, '')
      const target = event.target as HTMLInputElement
      const current = target.value || ''
      const start = target.selectionStart ?? current.length
      const end = target.selectionEnd ?? current.length
      const max = props.maxlength ? Number(props.maxlength) : Infinity
      const nextVal = (current.slice(0, start) + cleaned + current.slice(end)).slice(0, max)
      target.value = nextVal
      emit('update:modelValue', nextVal)
    }
  }
</script>

<template>
  <div class="flex w-full flex-col gap-1.5">
    <div class="relative flex items-center">
      <input
        :type="inputType"
        :id="id"
        :value="modelValue"
        :maxlength="maxlength"
        :inputmode="inputmode"
        :pattern="pattern"
        :autocomplete="autocomplete || (type === 'password' ? 'new-password' : 'off')"
        @keydown="handleKeyDown"
        @input="handleInput"
        @paste="handlePaste"
        class="peer border-input focus:ring-primary focus:border-primary bg-primary/5 block w-full rounded-xl border pt-5 pb-2 text-sm placeholder-transparent shadow-xs transition-all duration-200 focus:ring-2 focus:outline-none"
        :class="[
          error ? 'border-destructive focus:ring-destructive' : '',
          type === 'password' ? 'pr-11 pl-3.5' : optional ? 'pr-12 pl-3.5' : 'px-3.5'
        ]"
        :placeholder="placeholder || ' '"
        :aria-describedby="error ? `${id}-error` : undefined"
      />

      <AppButton
        variant="unstyled"
        size="unstyled"
        rounded="unstyled"
        v-if="type === 'password'"
        type="button"
        @click="togglePassword"
        class="text-foreground/40 hover:text-primary absolute right-3 z-20 transition-colors focus:outline-none"
      >
        <Icon
          :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'"
          class="h-4.5 w-4.5"
        />
      </AppButton>

      <label
        :for="id"
        class="text-foreground/50 peer-focus:text-primary pointer-events-none absolute top-3.5 left-3.5 z-10 origin-left -translate-y-2.5 scale-75 transform text-sm duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-3.5 peer-focus:-translate-y-2.5 peer-focus:scale-75"
        :class="optional && type !== 'password' ? 'max-w-[calc(100%-3rem)]' : ''"
      >
        {{ label }}
      </label>

      <!-- Optional Indicator Badge -->
      <span
        v-if="optional && type !== 'password'"
        class="text-foreground/40 bg-muted/80 border-border/50 pointer-events-none absolute top-3 right-2.5 z-10 rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase transition-opacity"
      >
        Opt
      </span>
    </div>
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <p
        v-if="error"
        :id="`${id}-error`"
        class="text-destructive ml-1 text-xs font-medium"
      >
        {{ error }}
      </p>
    </transition>
  </div>
</template>
