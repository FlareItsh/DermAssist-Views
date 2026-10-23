<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue'
  import { useScanQuota } from '~/composables/useScanQuota'

  interface Props {
    compact?: boolean
    lightTheme?: boolean
  }

  withDefaults(defineProps<Props>(), {
    compact: false,
    lightTheme: false
  })

  const {
    quota,
    isLoading,
    isUnlimited,
    limit,
    used,
    remaining,
    isLimitReached,
    formattedCountdown,
    quotaSource,
    unlimitedUntil,
    formattedUnlimitedUntil,
    formattedUnlimitedRemaining,
    fetchQuota,
    startCountdownTimer,
    stopCountdownTimer
  } = useScanQuota()

  const showInfoModal = ref(false)

  const openInfoModal = () => {
    showInfoModal.value = true
  }

  const closeInfoModal = () => {
    showInfoModal.value = false
  }

  onMounted(async () => {
    await fetchQuota()
    startCountdownTimer()
  })

  onUnmounted(() => {
    stopCountdownTimer()
  })
</script>

<template>
  <div class="relative inline-flex items-center">
    <!-- Indicator Pill -->
    <button
      type="button"
      @click="openInfoModal"
      class="group relative inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
      :class="[
        isLimitReached
          ? 'border-red-500/40 bg-red-500/15 text-red-700 shadow-sm shadow-red-500/10 dark:text-red-400'
          : isUnlimited && quotaSource === 'doctor_care'
            ? 'border-amber-500/40 bg-amber-500/15 text-amber-800 shadow-sm shadow-amber-500/10 dark:text-amber-300'
            : isUnlimited
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 shadow-sm shadow-emerald-500/10 dark:text-emerald-300'
              : remaining !== null && remaining <= 1
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-800 shadow-sm shadow-amber-500/10 dark:text-amber-300'
                : lightTheme
                  ? 'border-white/20 bg-white/15 text-white shadow-sm hover:bg-white/25'
                  : 'border-border bg-card/90 text-foreground hover:border-primary/40 shadow-xs'
      ]"
      :title="
        formattedCountdown
          ? `Cooldown: ${formattedCountdown}`
          : isUnlimited && formattedUnlimitedUntil
            ? `Unlimited AI Scans until ${formattedUnlimitedUntil}`
            : 'AI Scan Quota'
      "
    >
      <!-- Loading indicator -->
      <template v-if="isLoading && !quota">
        <Icon
          name="svg-spinners:ring-resize"
          class="h-3.5 w-3.5 animate-spin opacity-70"
        />
        <span>Checking quota...</span>
      </template>

      <!-- Doctor unverified gate -->
      <template v-else-if="quotaSource === 'doctor_unverified'">
        <Icon
          name="lucide:shield-alert"
          class="h-3.5 w-3.5 text-amber-500"
        />
        <span>Verification Required</span>
      </template>

      <!-- Unlimited admin or plan -->
      <template v-else-if="isUnlimited">
        <Icon
          name="lucide:infinity"
          class="h-3.5 w-3.5 text-emerald-500"
        />
        <span>Unlimited AI Scans</span>
        <span
          v-if="!compact && quotaSource === 'subscription'"
          class="py-0.2 rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-200"
        >
          Clinic Plan
        </span>
      </template>

      <!-- Limit reached -->
      <template v-else-if="isLimitReached">
        <Icon
          name="lucide:alert-circle"
          class="h-3.5 w-3.5 text-red-500"
        />
        <span class="font-bold">Daily Limit Reached</span>
        <span
          v-if="formattedCountdown"
          class="font-mono text-[11px] opacity-90"
        >
          · {{ formattedCountdown }}
        </span>
      </template>

      <!-- Normal quota active -->
      <template v-else>
        <Icon
          :name="formattedCountdown ? 'lucide:timer' : 'lucide:gauge'"
          class="h-3.5 w-3.5 opacity-80"
          :class="{ 'text-primary animate-pulse': Boolean(formattedCountdown) }"
        />
        <span>
          <strong class="font-bold">{{ remaining ?? 0 }}</strong> of {{ limit ?? 5 }} left
        </span>
        <span
          v-if="quotaSource === 'doctor_trial' && !compact"
          class="py-0.2 rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-200"
        >
          Trial ({{ limit }}/d)
        </span>
        <span
          v-else-if="quotaSource === 'doctor_care' && !compact"
          class="py-0.2 rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-800 dark:text-amber-200"
        >
          Doctor Care
        </span>
        <span
          v-else-if="quotaSource === 'subscription' && !compact"
          class="py-0.2 rounded-full bg-indigo-500/20 px-1.5 text-[10px] font-bold text-indigo-800 dark:text-indigo-200"
        >
          Plan ({{ limit }}/day)
        </span>
        <span
          v-if="formattedCountdown && !compact"
          class="font-mono text-[11px] opacity-80"
        >
          · {{ formattedCountdown }}
        </span>
      </template>

      <Icon
        name="lucide:info"
        class="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100"
      />
    </button>

    <!-- Detailed Quota Modal -->
    <AppModal
      v-model="showInfoModal"
      title="Daily AI Scan Quota"
      class="max-w-md"
    >
      <div class="space-y-4 text-sm">
        <div
          class="border-border bg-muted/40 flex items-center justify-between rounded-2xl border p-4"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl"
              :class="[
                isLimitReached
                  ? 'bg-red-500/10 text-red-600'
                  : isUnlimited
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-primary/10 text-primary'
              ]"
            >
              <Icon
                :name="
                  isLimitReached
                    ? 'lucide:alert-circle'
                    : isUnlimited
                      ? 'lucide:infinity'
                      : 'lucide:gauge'
                "
                class="h-5 w-5"
              />
            </div>
            <div>
              <p class="text-muted-foreground text-xs font-medium">Current Status</p>
              <h4 class="text-foreground text-base font-bold">
                <template v-if="quotaSource === 'doctor_unverified'">
                  Verification Required
                </template>
                <template v-else-if="isUnlimited && quotaSource === 'subscription'">
                  Unlimited Plan Scans
                </template>
                <template v-else-if="isUnlimited">Unlimited Scans</template>
                <template v-else-if="quotaSource === 'subscription'">
                  {{ remaining }} of {{ limit }} Plan Scans
                </template>
                <template v-else-if="quotaSource === 'doctor_trial'">
                  {{ remaining }} of {{ limit }} Trial Scans
                </template>
                <template v-else-if="quotaSource === 'doctor_care'">
                  {{ remaining }} of {{ limit }} Care Scans
                </template>
                <template v-else-if="isLimitReached">Limit Exhausted</template>
                <template v-else>{{ remaining }} Scans Available</template>
              </h4>
              <p
                v-if="quotaSource === 'doctor_unverified'"
                class="mt-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
              >
                Verification required before AI scanning is unlocked
              </p>
              <p
                v-else-if="isUnlimited && quotaSource === 'subscription'"
                class="mt-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              >
                Included with your active clinical subscription
              </p>
              <p
                v-else-if="quotaSource === 'subscription'"
                class="mt-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
              >
                {{ limit }} daily scans included with your subscription plan
              </p>
              <p
                v-else-if="quotaSource === 'doctor_trial' && formattedUnlimitedUntil"
                class="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              >
                14-Day Doctor Trial active until {{ formattedUnlimitedUntil }}
              </p>
              <p
                v-else-if="quotaSource === 'doctor_unsubscribed'"
                class="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
              >
                Post-trial base allowance ({{ limit }} scans/day)
              </p>
              <p
                v-else-if="quotaSource === 'doctor_care' && formattedUnlimitedUntil"
                class="text-xs font-semibold text-amber-600 dark:text-amber-400"
              >
                Doctor Care Tier active until {{ formattedUnlimitedUntil }}
              </p>
              <p
                v-else-if="isUnlimited && formattedUnlimitedUntil"
                class="text-xs font-semibold text-amber-600 dark:text-amber-400"
              >
                Until {{ formattedUnlimitedUntil }}
              </p>
            </div>
          </div>

          <div class="text-right">
            <p class="text-muted-foreground text-xs font-medium">Daily Quota</p>
            <p class="text-foreground font-mono text-sm font-bold">
              {{ isUnlimited ? '∞' : `${used} / ${limit}` }}
            </p>
          </div>
        </div>

        <!-- Cooldown timer display if active -->
        <div
          v-if="formattedCountdown"
          class="border-primary/20 bg-primary/5 flex items-center justify-between rounded-xl border p-3 text-xs"
        >
          <div class="text-foreground flex items-center gap-2">
            <Icon
              name="lucide:clock"
              class="text-primary h-4 w-4"
            />
            <span class="font-medium">Quota Resets In:</span>
          </div>
          <span class="text-primary font-mono text-xs font-bold">
            {{ formattedCountdown }}
          </span>
        </div>

        <div class="text-muted-foreground space-y-2 text-xs leading-relaxed">
          <p>
            • <strong class="text-foreground">24-Hour Rolling Window:</strong> The 24-hour countdown
            starts only when you initiate your first scan of the cycle.
          </p>
          <p>
            • <strong class="text-foreground">Fair Usage Policy:</strong> Only scans that
            successfully produce an AI result deduct from your quota. Failed uploads or non-skin
            rejections do not consume scans.
          </p>
          <p v-if="quotaSource === 'subscription'">
            • <strong class="text-foreground">Clinical Plan Quota:</strong> Your account receives
            <strong class="text-foreground">{{
              isUnlimited ? 'Unlimited' : `${limit} scans/day`
            }}</strong>
            provided by your active clinical subscription plan.
          </p>
          <p v-else-if="quotaSource === 'doctor_trial'">
            • <strong class="text-foreground">14-Day Doctor Free Trial:</strong> Newly verified
            doctors receive 10 scans per day during their initial 14-day trial period.
          </p>
          <p v-else-if="quotaSource === 'doctor_unsubscribed'">
            • <strong class="text-foreground">Unsubscribed Doctor Allowance:</strong> Unsubscribed
            verified doctors receive 3 scans per day. Upgrade to a subscription plan for unlimited
            scanning.
          </p>
          <p v-else-if="quotaSource === 'doctor_care'">
            • <strong class="text-foreground">Doctor Care Benefit Tier:</strong> You receive 15
            scans per day for 1 month through your attending doctor's appointment or registration.
            Once the 30-day care duration ends without a follow-up appointment, your account will
            smoothly return to the standard daily quota.
          </p>
          <p v-else>
            • <strong class="text-foreground">Doctor Care Tier:</strong> Patients who complete an
            appointment with their doctor or have an account created by their doctor receive an
            upgraded allowance of 15 scans per day for 1 month.
          </p>
        </div>

        <div class="flex justify-end pt-2">
          <AppButton
            variant="solid"
            size="sm"
            @click="closeInfoModal"
          >
            Got it
          </AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>
