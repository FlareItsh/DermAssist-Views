<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
  import {
    COUNTRY_DIAL_CODES,
    detectUserCountry,
    blockPhoneKey,
    sanitizePhoneNumber,
    formatDisplayPhone,
    splitFullPhoneNumber,
    buildFullPhoneNumber,
    type CountryDialCode
  } from '~/composables/useFormSanitizer'

  interface Props {
    modelValue?: string | null
    label?: string
    placeholder?: string
    error?: string
    required?: boolean
    disabled?: boolean
    compact?: boolean
    id?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: '',
    label: 'Contact Number',
    placeholder: '',
    error: '',
    required: false,
    disabled: false,
    compact: false,
    id: () => `phone-input-${Math.random().toString(36).substring(2, 9)}`
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'blur'): void
    (e: 'countryChange', country: CountryDialCode): void
  }>()

  // State
  const selectedCountry = ref<CountryDialCode>(detectUserCountry())
  const nationalNumber = ref('')
  const isDropdownOpen = ref(false)
  const searchQuery = ref('')
  const dropdownRef = ref<HTMLElement | null>(null)
  const containerRef = ref<HTMLElement | null>(null)
  const searchInputRef = ref<HTMLInputElement | null>(null)
  const dropdownPlacement = ref<'bottom' | 'top'>('bottom')
  const dynamicMaxHeight = ref<number>(270)

  const updatePlacement = () => {
    if (!containerRef.value || typeof window === 'undefined') return
    const rect = containerRef.value.getBoundingClientRect()
    const targetHeight = 270
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12

    if (spaceBelow < targetHeight && spaceAbove > spaceBelow) {
      dropdownPlacement.value = 'top'
      dynamicMaxHeight.value = Math.min(270, Math.max(160, Math.floor(spaceAbove)))
    } else {
      dropdownPlacement.value = 'bottom'
      dynamicMaxHeight.value = Math.min(270, Math.max(160, Math.floor(spaceBelow)))
    }
  }

  // Sync incoming modelValue
  const syncFromModel = (val: string | null | undefined) => {
    if (!val || !val.trim()) {
      nationalNumber.value = ''
      return
    }
    const parsed = splitFullPhoneNumber(val)
    const matching = COUNTRY_DIAL_CODES.find(c => c.dial === parsed.dialCode)
    if (matching) {
      selectedCountry.value = matching
    }
    nationalNumber.value = parsed.nationalNumber
  }

  watch(
    () => props.modelValue,
    newVal => {
      // Only sync if the reconstructed full number doesn't match current input
      const currentFull = buildFullPhoneNumber(selectedCountry.value.dial, nationalNumber.value)
      if (newVal !== currentFull) {
        syncFromModel(newVal)
      }
    },
    { immediate: true }
  )

  watch(isDropdownOpen, open => {
    if (typeof window === 'undefined') return
    if (open) {
      updatePlacement()
      window.addEventListener('resize', updatePlacement, { passive: true })
      window.addEventListener('scroll', updatePlacement, { capture: true, passive: true })
    } else {
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement, true)
    }
  })

  onMounted(() => {
    if (!props.modelValue) {
      selectedCountry.value = detectUserCountry()
    } else {
      syncFromModel(props.modelValue)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('click', handleClickOutside)
    }
  })

  onUnmounted(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handleClickOutside)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement, true)
    }
  })

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
      isDropdownOpen.value = false
      searchQuery.value = ''
    }
  }

  const toggleDropdown = () => {
    if (props.disabled) return
    isDropdownOpen.value = !isDropdownOpen.value
    if (isDropdownOpen.value) {
      updatePlacement()
      searchQuery.value = ''
      setTimeout(() => {
        searchInputRef.value?.focus()
      }, 50)
    }
  }

  const selectCountry = (country: CountryDialCode) => {
    selectedCountry.value = country
    isDropdownOpen.value = false
    searchQuery.value = ''
    emit('countryChange', country)

    // Re-sanitize national number with new country context
    const cleanDigits = sanitizePhoneNumber(nationalNumber.value, country.dial)
    nationalNumber.value = formatDisplayPhone(cleanDigits, country.dial)
    emitFullNumber()
  }

  const filteredCountries = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return COUNTRY_DIAL_CODES
    return COUNTRY_DIAL_CODES.filter(
      c => c.name.toLowerCase().includes(q) || c.iso.toLowerCase().includes(q) || c.dial.includes(q)
    )
  })

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    const raw = target.value
    const sanitized = sanitizePhoneNumber(raw, selectedCountry.value.dial)
    nationalNumber.value = formatDisplayPhone(sanitized, selectedCountry.value.dial)
    emitFullNumber()
  }

  const handleBlur = () => {
    emit('blur')
  }

  const emitFullNumber = () => {
    const full = buildFullPhoneNumber(selectedCountry.value.dial, nationalNumber.value)
    emit('update:modelValue', full)
  }

  const currentPlaceholder = computed(() => {
    if (props.placeholder) return props.placeholder
    return selectedCountry.value.placeholder
  })
</script>

<template>
  <div
    class="flex flex-col gap-1.5"
    ref="dropdownRef"
  >
    <div
      v-if="label"
      class="flex items-center justify-between"
    >
      <label
        :for="id"
        class="text-foreground/70 text-xs font-bold tracking-wider uppercase"
      >
        {{ label }}
        <span
          v-if="required"
          class="text-rose-500"
          >*</span
        >
      </label>
      <span
        v-if="selectedCountry.iso === 'PH' && nationalNumber"
        class="text-muted-foreground text-[10px] font-semibold"
      >
        {{ nationalNumber.replace(/\D/g, '').length }}/10 digits
      </span>
    </div>

    <div
      ref="containerRef"
      class="relative flex items-center rounded-2xl border transition-all"
      :class="[
        error
          ? 'border-rose-400 bg-rose-500/5 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20'
          : 'border-border bg-foreground/5 focus-within:border-primary focus-within:ring-primary/20 focus-within:ring-2',
        disabled ? 'cursor-not-allowed opacity-60' : '',
        compact ? 'h-10' : 'h-12'
      ]"
    >
      <!-- Country Trigger Button -->
      <button
        type="button"
        @click="toggleDropdown"
        :disabled="disabled"
        class="border-border/60 text-foreground hover:bg-foreground/5 flex h-full items-center gap-1.5 rounded-l-2xl border-r bg-transparent px-3 text-xs font-bold transition-colors focus:outline-none"
        :class="compact ? 'py-1 text-xs' : 'py-2 text-sm'"
        title="Select Country Dial Code"
      >
        <span class="text-base leading-none select-none">{{ selectedCountry.flag }}</span>
        <span class="text-foreground/80 font-mono text-xs font-semibold">{{
          selectedCountry.dial
        }}</span>
        <Icon
          name="lucide:chevron-down"
          class="text-muted-foreground h-3.5 w-3.5 transition-transform duration-200"
          :class="isDropdownOpen ? 'rotate-180' : ''"
        />
      </button>

      <!-- National Phone Number Input -->
      <input
        :id="id"
        type="tel"
        inputmode="tel"
        :value="nationalNumber"
        @input="handleInput"
        @keydown="blockPhoneKey"
        @blur="handleBlur"
        :disabled="disabled"
        :placeholder="currentPlaceholder"
        class="text-foreground placeholder:text-muted-foreground/60 h-full w-full rounded-r-2xl bg-transparent px-3.5 text-sm font-medium outline-none"
        :class="compact ? 'text-xs' : 'text-sm'"
      />

      <!-- Country Dropdown Popover -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          v-if="isDropdownOpen"
          class="bg-popover border-border absolute left-0 z-50 w-72 overflow-hidden rounded-2xl border p-2 shadow-xl"
          :class="[
            dropdownPlacement === 'top'
              ? 'bottom-full mb-1.5 origin-bottom'
              : 'top-full mt-1.5 origin-top'
          ]"
          :style="{ maxHeight: `${dynamicMaxHeight}px` }"
        >
          <!-- Search input -->
          <div class="relative mb-2">
            <Icon
              name="lucide:search"
              class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
            />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              placeholder="Search country or code..."
              class="bg-foreground/5 border-border focus:border-primary text-foreground h-8 w-full rounded-xl border pr-2.5 pl-8 text-xs transition-colors outline-none"
            />
          </div>

          <!-- List of countries -->
          <div
            class="space-y-0.5 overflow-y-auto pr-1"
            :style="{ maxHeight: `${Math.max(100, dynamicMaxHeight - 56)}px` }"
          >
            <button
              v-for="country in filteredCountries"
              :key="country.iso"
              type="button"
              @click="selectCountry(country)"
              class="hover:bg-foreground/10 flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors"
              :class="
                selectedCountry.iso === country.iso
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-foreground'
              "
            >
              <div class="flex items-center gap-2 truncate">
                <span class="text-sm select-none">{{ country.flag }}</span>
                <span class="truncate">{{ country.name }}</span>
              </div>
              <span class="font-mono text-[11px] opacity-70">{{ country.dial }}</span>
            </button>
            <div
              v-if="filteredCountries.length === 0"
              class="text-muted-foreground py-3 text-center text-xs"
            >
              No matching countries
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Error message -->
    <p
      v-if="error"
      class="text-xs font-medium text-rose-500"
    >
      {{ error }}
    </p>
  </div>
</template>
