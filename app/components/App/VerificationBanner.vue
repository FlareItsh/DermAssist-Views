<script setup lang="ts">
  import { $api } from '~/composables/useApi'
  import { toast } from 'vue-sonner'

  interface Props {
    user: any
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    (e: 'verified', updatedUser: any): void
  }>()

  const isVerifying = ref(false)
  const isResending = ref(false)
  const showVerifyModal = ref(false)
  const tokenInput = ref('')
  const remainingTimeText = ref('')

  const isPending = computed(() => {
    return props.user?.account_status === 'pending_verification'
  })

  const updateCountdown = () => {
    if (!props.user?.verification_deadline) {
      remainingTimeText.value = '48 hours'
      return
    }

    const deadline = new Date(props.user.verification_deadline).getTime()
    const now = Date.now()
    const diff = deadline - now

    if (diff <= 0) {
      remainingTimeText.value = 'Expired'
      return
    }

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      remainingTimeText.value = `${hours}h ${minutes}m`
    } else {
      remainingTimeText.value = `${minutes}m`
    }
  }

  let timer: any = null

  onMounted(() => {
    updateCountdown()
    timer = setInterval(updateCountdown, 60000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  const handleResend = async () => {
    if (isResending.value) return
    isResending.value = true

    try {
      const res: any = await $api('/resend-verification', {
        method: 'POST'
      })
      toast.success(res?.message || 'New verification details sent.')
      if (res?.verification_deadline) {
        props.user.verification_deadline = res.verification_deadline
        updateCountdown()
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to resend verification.'
      toast.error(msg)
    } finally {
      isResending.value = false
    }
  }

  const handleVerify = async () => {
    if (!tokenInput.value.trim()) {
      toast.error('Please enter your verification token.')
      return
    }

    isVerifying.value = true
    try {
      const res: any = await $api('/verify-account', {
        method: 'POST',
        body: { token: tokenInput.value.trim() }
      })

      toast.success(res?.message || 'Account successfully verified!')
      showVerifyModal.value = false
      if (res?.user) {
        emit('verified', res.user)
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Invalid or expired verification token.'
      toast.error(msg)
    } finally {
      isVerifying.value = false
    }
  }
</script>

<template>
  <div
    v-if="isPending"
    class="w-full border-b border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-900 transition-all dark:text-amber-200"
  >
    <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
      <div class="flex items-center gap-3">
        <div class="shrink-0 rounded-lg bg-amber-500/20 p-1.5 text-amber-600 dark:text-amber-400">
          <svg
            class="size-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div class="text-xs sm:text-sm">
          <span class="font-semibold text-amber-700 dark:text-amber-300">Temporary Account:</span>
          Please verify your account before the deadline.
          <span class="ml-1 font-bold underline decoration-amber-400 decoration-2">
            Time remaining: {{ remainingTimeText }}
          </span>
          <span class="block text-xs text-amber-600/80 sm:ml-1 sm:inline dark:text-amber-400/80">
            (Unverified accounts are automatically deactivated to protect clinical records).
          </span>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-amber-700 disabled:opacity-50"
          @click="showVerifyModal = true"
        >
          Enter Verification Token
        </button>
        <button
          type="button"
          class="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-200"
          :disabled="isResending"
          @click="handleResend"
        >
          {{ isResending ? 'Sending...' : 'Resend Code' }}
        </button>
      </div>
    </div>

    <!-- Verification Token Input Modal -->
    <div
      v-if="showVerifyModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h3 class="mb-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
          Verify Temporary Account
        </h3>
        <p class="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Enter the verification token sent to your email to permanently activate your account.
        </p>

        <input
          v-model="tokenInput"
          type="text"
          placeholder="Paste verification token here..."
          class="focus:ring-primary mb-4 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 focus:ring-2 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />

        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            @click="showVerifyModal = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50"
            :disabled="isVerifying"
            @click="handleVerify"
          >
            {{ isVerifying ? 'Verifying...' : 'Submit Verification' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
