<script setup lang="ts">
  const props = defineProps<{
    label: string
    modelValue: string | number
    type?: string
    id: string
    error?: string
    placeholder?: string
  }>()

  defineEmits(['update:modelValue'])

  const showPassword = ref(false)
  const togglePassword = () => (showPassword.value = !showPassword.value)

  const inputType = computed(() => {
    if (props.type === 'password') {
      return showPassword.value ? 'text' : 'password'
    }
    return props.type || 'text'
  })
</script>

<template>
  <div class="flex w-full flex-col gap-1.5">
    <div class="relative flex items-center">
      <input
        :type="inputType"
        :id="id"
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        class="peer border-input focus:ring-primary focus:border-primary bg-primary/5 block w-full rounded-2xl border pb-3.5 pt-6 text-sm shadow-sm transition-all duration-200 focus:ring-2 focus:outline-none placeholder-transparent"
        :class="[
          error ? 'border-destructive focus:ring-destructive' : '',
          type === 'password' ? 'pl-4 pr-12' : 'px-4',
        ]"
        :placeholder="placeholder || ' '"
        :aria-describedby="error ? `${id}-error` : undefined"
      />

      <button
        v-if="type === 'password'"
        type="button"
        @click="togglePassword"
        class="text-foreground/40 hover:text-primary absolute right-4 focus:outline-none transition-colors z-20"
      >
        <Icon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" class="h-5 w-5" />
      </button>

      <label
        :for="id"
        class="pointer-events-none absolute left-4 top-4 z-10 origin-left -translate-y-3 scale-75 transform text-sm text-foreground/50 duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-4 peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-primary"
      >
        {{ label }}
      </label>
    </div>
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <p v-if="error" :id="`${id}-error`" class="text-destructive ml-1 text-xs font-medium">
        {{ error }}
      </p>
    </transition>
  </div>
</template>
