<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import { $api } from '~/composables/useApi'

  definePageMeta({
    layout: false,
    path: '/auth/check-email',
    alias: ['/auth/CheckEmail']
  })

  const route = useRoute()
  const email = computed(() => (route.query.email as string) || '')
  const type = computed(() => (route.query.type as string) || 'google')

  const isResending = ref(false)
  const cooldownSeconds = ref(0)
  let cooldownTimer: any = null

  const startCooldown = () => {
    cooldownSeconds.value = 60
    if (cooldownTimer) clearInterval(cooldownTimer)
    cooldownTimer = setInterval(() => {
      if (cooldownSeconds.value > 0) {
        cooldownSeconds.value--
      } else {
        clearInterval(cooldownTimer)
      }
    }, 1000)
  }

  const handleResend = async () => {
    if (isResending.value || cooldownSeconds.value > 0) return
    if (!email.value) {
      toast.error('No email address found.')
      return
    }

    isResending.value = true
    try {
      if (type.value === 'google') {
        const res: any = await $api('/auth/google/resend-confirm', {
          method: 'POST',
          body: { email: email.value }
        })
        toast.success(res?.message || 'New confirmation email sent.')
      } else {
        const res: any = await $api('/resend-verification', {
          method: 'POST'
        })
        toast.success(res?.message || 'New verification email sent.')
      }
      startCooldown()
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to resend confirmation email.'
      toast.error(msg)
    } finally {
      isResending.value = false
    }
  }

  onUnmounted(() => {
    if (cooldownTimer) clearInterval(cooldownTimer)
  })
</script>

<template>
  <div
    class="bg-background relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8 select-none"
  >
    <!-- Ambient Healthcare Tech Background Gradients -->
    <div
      class="bg-primary/15 pointer-events-none absolute -top-40 -left-40 size-96 rounded-full blur-3xl"
    />
    <div
      class="bg-secondary/15 pointer-events-none absolute -right-40 -bottom-40 size-96 rounded-full blur-3xl"
    />
    <div
      class="from-primary/5 pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] via-transparent to-transparent"
    />

    <!-- Main Glassmorphism Card -->
    <div
      class="border-border/70 bg-card/90 relative z-10 flex w-full max-w-md flex-col items-center rounded-3xl border p-8 text-center shadow-2xl backdrop-blur-2xl transition-all duration-300 sm:p-10"
    >
      <!-- DermAssist Official Logo -->
      <NuxtLink
        to="/"
        class="mb-6 inline-block transition-transform hover:scale-105"
      >
        <NuxtImg
          src="/DA_Logo.png"
          alt="DermAssist Logo"
          class="h-12 object-contain sm:h-14"
        />
      </NuxtLink>

      <!-- Envelope Icon -->
      <div
        class="border-primary/30 bg-primary/10 text-primary mb-6 flex size-20 items-center justify-center rounded-3xl border shadow-sm"
      >
        <Icon
          name="solar:letter-opened-bold-duotone"
          class="size-10"
        />
      </div>

      <h1 class="font-primary text-foreground text-2xl font-black tracking-tight sm:text-3xl">
        Check Your Email
      </h1>

      <p class="text-muted-foreground mt-3 max-w-sm text-xs leading-relaxed sm:text-sm">
        We sent a sign-in authorization link to:
      </p>

      <div
        v-if="email"
        class="border-border/70 bg-muted/40 text-foreground mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border px-4 py-1.5 font-mono text-xs font-semibold"
      >
        <Icon
          name="solar:user-circle-bold"
          class="text-primary size-4 shrink-0"
        />
        <span class="truncate">{{ email }}</span>
      </div>

      <div class="border-border/50 bg-muted/20 mt-6 rounded-2xl border p-4 text-left">
        <div class="flex items-start gap-3">
          <div class="text-primary mt-0.5 shrink-0">
            <Icon
              name="solar:shield-check-bold"
              class="size-5"
            />
          </div>
          <div class="text-xs leading-relaxed">
            <span class="text-foreground font-bold">New Device Protection:</span>
            <p class="text-muted-foreground mt-0.5">
              Click the link inside the email to authorize this browser and instantly sign into your
              DermAssist dashboard.
            </p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mt-6 flex w-full flex-col gap-3">
        <button
          type="button"
          :disabled="isResending || cooldownSeconds > 0"
          @click="handleResend"
          class="bg-primary hover:bg-primary/90 text-primary-foreground flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
        >
          <Icon
            v-if="!isResending"
            name="solar:refresh-linear"
            class="size-4"
          />
          <span>
            {{
              isResending
                ? 'Sending...'
                : cooldownSeconds > 0
                  ? `Resend available in ${cooldownSeconds}s`
                  : 'Resend Email'
            }}
          </span>
        </button>

        <NuxtLink
          to="/auth/login"
          class="text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 py-1 text-xs font-medium transition-colors"
        >
          <Icon
            name="solar:arrow-left-linear"
            class="size-4"
          />
          <span>Return to Sign In</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
