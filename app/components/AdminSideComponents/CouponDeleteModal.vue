<template>
  <div
    v-if="show && coupon"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs transition-opacity"
  >
    <div
      class="w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl transition-all"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-6 py-4"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl"
            :class="hasRedemptions ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'"
          >
            <Icon
              :name="hasRedemptions ? 'lucide:archive' : 'lucide:trash-2'"
              class="text-lg"
            />
          </div>
          <div>
            <h3 class="text-base font-black text-gray-950">
              {{ hasRedemptions ? 'Archive Promo Coupon' : 'Delete Promo Coupon' }}
            </h3>
            <p class="font-mono text-xs font-bold text-gray-500">{{ coupon.code }}</p>
          </div>
        </div>
        <button
          type="button"
          @click="handleCancel"
          class="rounded-xl p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <Icon
            name="lucide:x"
            class="text-lg"
          />
        </button>
      </div>

      <!-- Content -->
      <div class="space-y-4 p-6">
        <!-- Scenario A: Coupon has existing redemptions -->
        <div
          v-if="hasRedemptions"
          class="space-y-3"
        >
          <div
            class="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900"
          >
            <div class="flex items-center gap-2 font-bold text-amber-800">
              <Icon
                name="lucide:shield-check"
                class="shrink-0 text-base text-amber-600"
              />
              <span>Financial Audit Integrity Protection</span>
            </div>
            <p class="text-[11px] leading-relaxed text-amber-950">
              This coupon was redeemed <strong>{{ coupon.times_redeemed }}</strong> time(s). Hard
              removal is prevented to safeguard customer subscription invoices and billing history.
            </p>
          </div>

          <p class="text-xs text-gray-600">
            Archiving will immediately deactivate <strong>{{ coupon.code }}</strong> and hide it
            from active campaigns while keeping audit logs intact. You can view or restore it
            anytime from the <strong>Archived</strong> tab.
          </p>
        </div>

        <!-- Scenario B: Coupon has never been redeemed -->
        <div
          v-else
          class="space-y-4"
        >
          <p class="text-xs text-gray-600">
            This coupon has <strong>never been redeemed</strong> (0 redemptions). Choose how you
            would like to handle its removal:
          </p>

          <div class="space-y-2.5">
            <!-- Option 1: Soft Archive -->
            <label
              class="flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition"
              :class="
                deleteMode === 'archive'
                  ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-400/20'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              "
            >
              <input
                type="radio"
                name="deleteMode"
                value="archive"
                v-model="deleteMode"
                class="mt-1 text-amber-600 focus:ring-amber-500"
              />
              <div class="text-xs">
                <span class="block font-bold text-gray-900">Archive (Soft Delete)</span>
                <span class="text-[11px] text-gray-500">
                  Deactivate and move to archive folder. Can be un-archived or reviewed later.
                </span>
              </div>
            </label>

            <!-- Option 2: Hard Purge -->
            <label
              class="flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition"
              :class="
                deleteMode === 'hard'
                  ? 'border-rose-400 bg-rose-50/40 ring-2 ring-rose-400/20'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              "
            >
              <input
                type="radio"
                name="deleteMode"
                value="hard"
                v-model="deleteMode"
                class="mt-1 text-rose-600 focus:ring-rose-500"
              />
              <div class="text-xs">
                <span class="block font-bold text-gray-900">Permanent Removal (Hard Delete)</span>
                <span class="text-[11px] text-rose-600">
                  Completely erase this promo code from database. This action cannot be undone.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-6 py-4"
      >
        <button
          type="button"
          @click="handleCancel"
          class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
        >
          Cancel
        </button>

        <!-- Submit Button -->
        <button
          v-if="hasRedemptions"
          type="button"
          :disabled="isSubmitting"
          @click="handleConfirmArchive"
          class="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700 disabled:opacity-50"
        >
          <Icon
            v-if="isSubmitting"
            name="svg-spinners:ring-resize"
            class="h-4 w-4 animate-spin"
          />
          <Icon
            v-else
            name="lucide:archive"
            class="text-xs"
          />
          <span>Archive Coupon</span>
        </button>

        <button
          v-else-if="deleteMode === 'archive'"
          type="button"
          :disabled="isSubmitting"
          @click="handleConfirmArchive"
          class="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700 disabled:opacity-50"
        >
          <Icon
            v-if="isSubmitting"
            name="svg-spinners:ring-resize"
            class="h-4 w-4 animate-spin"
          />
          <Icon
            v-else
            name="lucide:archive"
            class="text-xs"
          />
          <span>Archive Coupon</span>
        </button>

        <button
          v-else
          type="button"
          :disabled="isSubmitting"
          @click="handleConfirmPermanentDelete"
          class="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700 disabled:opacity-50"
        >
          <Icon
            v-if="isSubmitting"
            name="svg-spinners:ring-resize"
            class="h-4 w-4 animate-spin"
          />
          <Icon
            v-else
            name="lucide:trash-2"
            class="text-xs"
          />
          <span>Permanently Delete</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { Coupon } from '~/api/subscription/SubscriptionAdminService'

  const props = defineProps<{
    show: boolean
    coupon: Coupon | null
    isSubmitting?: boolean
  }>()

  const emit = defineEmits<{
    (e: 'cancel'): void
    (e: 'confirm', payload: { coupon: Coupon; force: boolean }): void
  }>()

  const deleteMode = ref<'archive' | 'hard'>('archive')

  watch(
    () => props.show,
    val => {
      if (val) {
        deleteMode.value = 'archive'
      }
    }
  )

  const hasRedemptions = computed(() => {
    if (!props.coupon) return false
    return Boolean(
      props.coupon.has_redemptions ||
      (props.coupon.times_redeemed && props.coupon.times_redeemed > 0)
    )
  })

  const handleCancel = () => {
    emit('cancel')
  }

  const handleConfirmArchive = () => {
    if (props.coupon) {
      emit('confirm', { coupon: props.coupon, force: false })
    }
  }

  const handleConfirmPermanentDelete = () => {
    if (props.coupon) {
      emit('confirm', { coupon: props.coupon, force: true })
    }
  }
</script>
