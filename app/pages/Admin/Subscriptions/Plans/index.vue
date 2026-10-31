<template>
  <div class="space-y-6">
    <AdminSideComponentsSubscriptionNavHeader
      title="SaaS Plan Builder"
      description="Configure dynamic doctor subscription tiers, seat limits, and feature flags."
      icon="lucide:sliders-horizontal"
      current-tab="plans"
    >
      <template #actions>
        <AppButton
          @click="openCreateModal"
          variant="solid"
          size="sm"
          class="shrink-0 whitespace-nowrap"
        >
          <Icon
            name="lucide:plus"
            class="mr-1 text-sm"
          />
          Create New Plan
        </AppButton>
      </template>
    </AdminSideComponentsSubscriptionNavHeader>

    <!-- Dynamic AI Scan & Trial Policy Management -->
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div
        class="flex flex-col gap-3 border-b border-gray-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between md:px-5"
      >
        <div>
          <div class="flex items-center gap-2">
            <div
              class="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-lg"
            >
              <Icon
                name="lucide:gauge"
                class="h-4 w-4"
              />
            </div>
            <h2 class="text-sm font-black text-gray-950">AI Scan & Trial Quota Policies</h2>
          </div>
          <p class="mt-0.5 text-xs text-gray-500">
            Configure system-wide doctor trial quotas, unsubscribed limits, and patient care tiers.
          </p>
        </div>
        <AppButton
          @click="savePolicies"
          variant="solid"
          size="sm"
          :disabled="isUpdatingPolicies || isLoadingPolicies"
          class="shrink-0 whitespace-nowrap"
        >
          <Icon
            v-if="isUpdatingPolicies"
            name="svg-spinners:ring-resize"
            class="mr-1 h-3.5 w-3.5 animate-spin"
          />
          <Icon
            v-else
            name="lucide:save"
            class="mr-1 h-3.5 w-3.5"
          />
          Save Quota Policies
        </AppButton>
      </div>

      <div
        class="grid grid-cols-1 divide-y divide-gray-100 lg:grid-cols-3 lg:divide-x lg:divide-y-0"
      >
        <!-- Doctor Policies Panel -->
        <div class="space-y-4 p-4 md:p-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600"
              >
                <Icon
                  name="lucide:stethoscope"
                  class="h-4 w-4"
                />
              </span>
              <h3 class="text-xs font-bold tracking-wider text-gray-900 uppercase">
                Doctor Scan Policies
              </h3>
            </div>
            <span
              class="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700"
            >
              Verification Required
            </span>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label class="mb-1 block text-[11px] font-bold tracking-wider text-gray-500 uppercase"
                >Trial Duration</label
              >
              <div class="relative">
                <input
                  v-model.number="policiesForm.doctor_trial_days"
                  type="number"
                  min="1"
                  max="365"
                  class="focus:border-primary/30 focus:ring-primary/10 h-9.5 w-full rounded-xl border border-gray-200 bg-gray-50 pr-11 pl-3 text-sm font-bold text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                  :disabled="isLoadingPolicies || isUpdatingPolicies"
                />
                <span
                  class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-gray-400"
                  >days</span
                >
              </div>
            </div>

            <div>
              <label class="mb-1 block text-[11px] font-bold tracking-wider text-gray-500 uppercase"
                >Trial Scans / Day</label
              >
              <div class="relative">
                <input
                  v-model.number="policiesForm.doctor_trial_daily_scans"
                  type="number"
                  min="1"
                  max="1000"
                  class="focus:border-primary/30 focus:ring-primary/10 h-9.5 w-full rounded-xl border border-gray-200 bg-gray-50 pr-11 pl-3 text-sm font-bold text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                  :disabled="isLoadingPolicies || isUpdatingPolicies"
                />
                <span
                  class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-gray-400"
                  >scans</span
                >
              </div>
            </div>

            <div>
              <label class="mb-1 block text-[11px] font-bold tracking-wider text-gray-500 uppercase"
                >Post-Trial Scans</label
              >
              <div class="relative">
                <input
                  v-model.number="policiesForm.doctor_unsubscribed_daily_scans"
                  type="number"
                  min="0"
                  max="1000"
                  class="focus:border-primary/30 focus:ring-primary/10 h-9.5 w-full rounded-xl border border-gray-200 bg-gray-50 pr-11 pl-3 text-sm font-bold text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                  :disabled="isLoadingPolicies || isUpdatingPolicies"
                />
                <span
                  class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-gray-400"
                  >scans</span
                >
              </div>
            </div>
          </div>

          <p class="text-[11px] leading-relaxed text-gray-500">
            • Doctors must be verified to scan. Newly verified doctors receive free trial scans.
            Post-trial unsubscribed doctors receive base quota. Subscribed doctors follow their plan
            limit (Unlimited by default).
          </p>
        </div>

        <!-- Patient Policies Panel -->
        <div class="space-y-4 p-4 md:p-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"
              >
                <Icon
                  name="lucide:heart-pulse"
                  class="h-4 w-4"
                />
              </span>
              <h3 class="text-xs font-bold tracking-wider text-gray-900 uppercase">
                Patient Scan Policies
              </h3>
            </div>
            <span
              class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
            >
              Care Tier Auto-Upgrades
            </span>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label class="mb-1 block text-[11px] font-bold tracking-wider text-gray-500 uppercase"
                >Standard Patient</label
              >
              <div class="relative">
                <input
                  v-model.number="policiesForm.patient_default_daily_scans"
                  type="number"
                  min="1"
                  max="1000"
                  class="focus:border-primary/30 focus:ring-primary/10 h-9.5 w-full rounded-xl border border-gray-200 bg-gray-50 pr-11 pl-3 text-sm font-bold text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                  :disabled="isLoadingPolicies || isUpdatingPolicies"
                />
                <span
                  class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-gray-400"
                  >scans</span
                >
              </div>
            </div>

            <div>
              <label class="mb-1 block text-[11px] font-bold tracking-wider text-gray-500 uppercase"
                >Doctor Care Tier</label
              >
              <div class="relative">
                <input
                  v-model.number="policiesForm.patient_care_daily_scans"
                  type="number"
                  min="1"
                  max="1000"
                  class="focus:border-primary/30 focus:ring-primary/10 h-9.5 w-full rounded-xl border border-gray-200 bg-gray-50 pr-11 pl-3 text-sm font-bold text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                  :disabled="isLoadingPolicies || isUpdatingPolicies"
                />
                <span
                  class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-gray-400"
                  >scans</span
                >
              </div>
            </div>

            <div>
              <label class="mb-1 block text-[11px] font-bold tracking-wider text-gray-500 uppercase"
                >Care Duration</label
              >
              <div class="relative">
                <input
                  v-model.number="policiesForm.patient_care_duration_days"
                  type="number"
                  min="1"
                  max="365"
                  class="focus:border-primary/30 focus:ring-primary/10 h-9.5 w-full rounded-xl border border-gray-200 bg-gray-50 pr-11 pl-3 text-sm font-bold text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                  :disabled="isLoadingPolicies || isUpdatingPolicies"
                />
                <span
                  class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-gray-400"
                  >days</span
                >
              </div>
            </div>
          </div>

          <p class="text-[11px] leading-relaxed text-gray-500">
            • 15 scans/day for 1 month awarded to doctor-created patients and after completed
            appointments. Does not stack quotas. Reverts to standard after 30 days without another
            appointment.
          </p>
        </div>

        <!-- Guest Visitor Policies Panel -->
        <div class="space-y-4 p-4 md:p-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"
              >
                <Icon
                  name="lucide:fingerprint"
                  class="h-4 w-4"
                />
              </span>
              <h3 class="text-xs font-bold tracking-wider text-gray-900 uppercase">
                Guest Visitor Policies
              </h3>
            </div>
            <span
              class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700"
            >
              Hardware & IP Block
            </span>
          </div>

          <div>
            <label class="mb-1 block text-[11px] font-bold tracking-wider text-gray-500 uppercase"
              >Guest Scans / 24 Hours</label
            >
            <div class="relative">
              <input
                v-model.number="policiesForm.guest_daily_scans"
                type="number"
                min="0"
                max="100"
                class="focus:border-primary/30 focus:ring-primary/10 h-9.5 w-full rounded-xl border border-gray-200 bg-gray-50 pr-11 pl-3 text-sm font-bold text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                :disabled="isLoadingPolicies || isUpdatingPolicies"
              />
              <span
                class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-gray-400"
                >scans</span
              >
            </div>
          </div>

          <p class="text-[11px] leading-relaxed text-gray-500">
            • Daily free preview scans for unregistered visitors on the landing page scanner. Enforced via combined Canvas/WebGL device fingerprint and IP address to prevent incognito or multi-browser abuse. Set to 0 to disable guest scans.
          </p>
        </div>
      </div>
    </section>

    <!-- Plans Table -->
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <!-- Mobile Card List -->
      <div class="divide-y divide-gray-100 md:hidden">
        <div
          v-if="isLoading"
          class="flex items-center justify-center gap-2 px-4 py-10 text-gray-500"
        >
          <Icon
            name="svg-spinners:ring-resize"
            class="text-primary h-5 w-5 animate-spin"
          />
          <span class="text-xs font-medium">Loading subscription plans...</span>
        </div>
        <div
          v-else-if="plans.length === 0"
          class="px-4 py-10 text-center text-gray-500"
        >
          <Icon
            name="lucide:sliders-horizontal"
            class="mx-auto mb-2 text-3xl text-gray-300"
          />
          <p class="text-sm font-semibold text-gray-700">
            No plans created yet. Tap "Create New Plan" to add one.
          </p>
        </div>
        <template v-else>
          <article
            v-for="plan in plans"
            :key="plan.id"
            class="space-y-3 px-4 py-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-bold text-gray-950">{{ plan.name }}</p>
                <p class="truncate font-mono text-xs text-gray-400">{{ plan.slug }}</p>
              </div>
              <button
                @click="toggleActive(plan)"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition"
                :class="
                  plan.is_active
                    ? 'border border-emerald-200/60 bg-emerald-50 text-emerald-700'
                    : 'border border-gray-200 bg-gray-100 text-gray-500'
                "
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="plan.is_active ? 'bg-emerald-500' : 'bg-gray-400'"
                ></span>
                {{ plan.is_active ? 'Active' : 'Disabled' }}
              </button>
            </div>

            <span
              class="bg-primary/10 text-primary border-primary/20 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold capitalize"
            >
              {{ plan.tier_type?.replace(/_/g, ' ') }}
            </span>

            <div class="grid grid-cols-2 gap-2">
              <div class="rounded-xl bg-gray-50 px-3 py-2">
                <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Monthly</p>
                <p class="font-mono text-sm font-bold text-gray-950">
                  ₱{{
                    Number(plan.price_monthly).toLocaleString('en-US', {
                      minimumFractionDigits: 2
                    })
                  }}
                </p>
              </div>
              <div class="rounded-xl bg-gray-50 px-3 py-2">
                <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Annual</p>
                <p class="font-mono text-sm font-bold text-gray-950">
                  ₱{{
                    Number(plan.price_annual).toLocaleString('en-US', {
                      minimumFractionDigits: 2
                    })
                  }}
                </p>
              </div>
            </div>

            <p class="text-xs font-medium text-gray-600">
              Doctors:
              <span class="font-mono text-gray-500">{{ plan.max_doctors ?? 'Unlimited' }}</span>
              · Clinics:
              <span class="font-mono text-gray-500">{{ plan.max_clinics ?? 'Unlimited' }}</span>
              · Secretaries:
              <span class="font-mono text-gray-500">{{
                plan.max_secretaries !== null && plan.max_secretaries !== undefined
                  ? plan.max_secretaries
                  : 'Unlimited'
              }}</span>
              · Scans/day:
              <span class="font-mono text-gray-500">{{
                plan.daily_scan_limit !== null && plan.daily_scan_limit !== undefined
                  ? plan.daily_scan_limit
                  : 'Unlimited'
              }}</span>
            </p>

            <div class="flex gap-2">
              <button
                @click="editPlan(plan)"
                class="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition active:bg-gray-50"
              >
                Edit
              </button>
              <button
                @click="deletePlan(plan)"
                class="flex-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 transition active:bg-rose-50"
              >
                Delete
              </button>
            </div>
          </article>
        </template>
      </div>

      <div class="hidden overflow-x-auto md:block">
        <table class="w-full text-left text-sm">
          <thead
            class="border-b border-gray-100 bg-gray-50/70 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
          >
            <tr>
              <th class="px-5 py-3.5">Plan Name</th>
              <th class="px-5 py-3.5">Tier Model</th>
              <th class="px-5 py-3.5">Monthly Price</th>
              <th class="px-5 py-3.5">Annual Price</th>
              <th class="px-5 py-3.5">Limits</th>
              <th class="px-5 py-3.5">Status</th>
              <th class="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="isLoading">
              <td
                colspan="7"
                class="px-5 py-10 text-center text-gray-500"
              >
                <div class="flex items-center justify-center gap-2">
                  <Icon
                    name="svg-spinners:ring-resize"
                    class="text-primary h-5 w-5 animate-spin"
                  />
                  <span class="text-xs font-medium">Loading subscription plans...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="plans.length === 0">
              <td
                colspan="7"
                class="px-5 py-12 text-center text-gray-500"
              >
                <Icon
                  name="lucide:sliders-horizontal"
                  class="mx-auto mb-2 text-3xl text-gray-300"
                />
                <p class="text-sm font-semibold text-gray-700">
                  No plans created yet. Click "Create New Plan" to add one.
                </p>
              </td>
            </tr>
            <tr
              v-for="plan in plans"
              :key="plan.id"
              class="transition hover:bg-gray-50/60"
            >
              <td class="px-5 py-4 font-bold text-gray-950">
                {{ plan.name }}
                <div class="font-mono text-xs font-normal text-gray-400">{{ plan.slug }}</div>
              </td>
              <td class="px-5 py-4">
                <span
                  class="bg-primary/10 text-primary border-primary/20 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold capitalize"
                >
                  {{ plan.tier_type?.replace(/_/g, ' ') }}
                </span>
              </td>
              <td class="px-5 py-4 font-mono font-bold text-gray-950">
                ₱{{
                  Number(plan.price_monthly).toLocaleString('en-US', { minimumFractionDigits: 2 })
                }}
              </td>
              <td class="px-5 py-4 font-mono font-bold text-gray-950">
                ₱{{
                  Number(plan.price_annual).toLocaleString('en-US', { minimumFractionDigits: 2 })
                }}
              </td>
              <td class="space-y-0.5 px-5 py-4 text-xs font-medium">
                <div class="text-gray-700">
                  Doctors:
                  <span class="font-mono text-gray-500">{{ plan.max_doctors ?? 'Unlimited' }}</span>
                </div>
                <div class="text-gray-700">
                  Clinics:
                  <span class="font-mono text-gray-500">{{ plan.max_clinics ?? 'Unlimited' }}</span>
                </div>
                <div class="text-gray-700">
                  Secretaries:
                  <span class="font-mono text-gray-500">{{
                    plan.max_secretaries !== null && plan.max_secretaries !== undefined
                      ? plan.max_secretaries
                      : 'Unlimited'
                  }}</span>
                </div>
                <div class="text-gray-700">
                  Daily Scans:
                  <span class="font-mono text-gray-500">{{
                    plan.daily_scan_limit !== null && plan.daily_scan_limit !== undefined
                      ? plan.daily_scan_limit
                      : 'Unlimited'
                  }}</span>
                </div>
              </td>
              <td class="px-5 py-4">
                <button
                  @click="toggleActive(plan)"
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition"
                  :class="
                    plan.is_active
                      ? 'border border-emerald-200/60 bg-emerald-50 text-emerald-700'
                      : 'border border-gray-200 bg-gray-100 text-gray-500'
                  "
                >
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="plan.is_active ? 'bg-emerald-500' : 'bg-gray-400'"
                  ></span>
                  {{ plan.is_active ? 'Active' : 'Disabled' }}
                </button>
              </td>
              <td class="space-x-2 px-5 py-4 text-right">
                <button
                  @click="editPlan(plan)"
                  class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  @click="deletePlan(plan)"
                  class="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Create / Edit Plan Dialog Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-4"
      >
        <div
          class="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:max-w-3xl sm:p-6"
        >
          <div class="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 class="text-base font-black text-gray-950 sm:text-lg">
              {{ isEditing ? 'Edit Subscription Plan' : 'Create Subscription Plan' }}
            </h3>
            <button
              @click="showModal = false"
              class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <Icon
                name="lucide:x"
                class="text-lg"
              />
            </button>
          </div>

          <form
            @submit.prevent="savePlan"
            class="space-y-4"
          >
            <div>
              <label class="mb-1 block text-xs font-bold tracking-wider text-gray-500 uppercase"
                >Plan Name</label
              >
              <input
                v-model="form.name"
                type="text"
                required
                placeholder="e.g. Solo Practitioner"
                class="focus:border-primary/30 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 transition outline-none focus:bg-white focus:ring-4"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-bold tracking-wider text-gray-500 uppercase"
                >Subscription Tier Type</label
              >
              <select
                v-model="form.tier_type"
                class="focus:border-primary/30 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-bold text-gray-700 transition outline-none focus:bg-white focus:ring-4"
              >
                <option value="individual">Individual (1 Doctor, 1 Clinic)</option>
                <option value="doctor_multi_clinic">One Doctor, Multiple Clinics</option>
                <option value="clinic_multi_doctor">One Clinic, Multiple Doctors</option>
              </select>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >Monthly Price (₱)</label
                >
                <input
                  v-model.number="form.price_monthly"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  class="focus:border-primary/30 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >Annual Price (₱)</label
                >
                <input
                  v-model.number="form.price_annual"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  class="focus:border-primary/30 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >Max Doctors (Seats)</label
                >
                <input
                  v-model.number="form.max_doctors"
                  type="number"
                  min="1"
                  placeholder="Empty = Unltd"
                  class="focus:border-primary/30 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >Max Clinics (Branches)</label
                >
                <input
                  v-model.number="form.max_clinics"
                  type="number"
                  min="1"
                  placeholder="Empty = Unltd"
                  class="focus:border-primary/30 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >Max Secretaries</label
                >
                <input
                  v-model.number="form.max_secretaries"
                  type="number"
                  min="0"
                  placeholder="0 = None"
                  class="focus:border-primary/30 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >Daily AI Scans</label
                >
                <input
                  v-model.number="form.daily_scan_limit"
                  type="number"
                  min="1"
                  placeholder="Empty = Unltd"
                  class="focus:border-primary/30 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >Free Trial Days</label
                >
                <input
                  v-model.number="form.trial_period_days"
                  type="number"
                  min="0"
                  class="focus:border-primary/30 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >Grace Period Days</label
                >
                <input
                  v-model.number="form.grace_period_days"
                  type="number"
                  min="0"
                  class="focus:border-primary/30 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 transition outline-none focus:bg-white focus:ring-4"
                />
              </div>
            </div>

            <!-- Custom Marketing Feature Bullet Items -->
            <div class="space-y-1.5 border-t border-gray-100 pt-3">
              <label class="block text-xs font-bold tracking-wider text-gray-500 uppercase"
                >Custom Feature Highlights (One per line)</label
              >
              <textarea
                v-model="customFeaturesText"
                rows="3"
                placeholder="e.g. 24/7 Priority Support&#10;Custom Clinic Branding&#10;Dedicated Account Manager"
                class="focus:border-primary/30 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs font-medium text-gray-900 transition outline-none focus:bg-white focus:ring-4"
              ></textarea>
            </div>

            <!-- Dynamic Feature Flags Checkboxes -->
            <div class="space-y-2 border-t border-gray-100 pt-3">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-bold tracking-wider text-gray-500 uppercase"
                  >Feature Access Flags</label
                >
                <NuxtLink
                  to="/admin/subscriptions/features"
                  class="text-primary flex items-center gap-1 text-[11px] font-bold hover:underline"
                >
                  <Icon
                    name="lucide:settings"
                    class="text-xs"
                  />
                  <span>Manage Features</span>
                </NuxtLink>
              </div>
              <div
                v-if="isLoadingFeatures"
                class="py-3 text-center text-xs text-gray-400"
              >
                Loading system features...
              </div>
              <div
                v-else
                class="space-y-2 text-xs"
              >
                <label
                  v-for="feature in planBuilderFeatures"
                  :key="feature.id"
                  class="flex cursor-pointer items-center gap-2.5 font-bold text-gray-700 hover:text-gray-900"
                >
                  <input
                    v-model="form.features[feature.code || '']"
                    type="checkbox"
                    class="text-primary focus:ring-primary/20 h-4 w-4 rounded border-gray-300"
                  />
                  <div class="flex flex-col">
                    <span>{{ feature.name }}</span>
                    <span
                      v-if="feature.description"
                      class="text-[10px] font-normal text-gray-400"
                      >{{ feature.description }}</span
                    >
                  </div>
                </label>
              </div>
            </div>

            <div
              class="flex flex-col-reverse items-stretch justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center"
            >
              <button
                type="button"
                @click="showModal = false"
                class="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-center text-xs font-bold text-gray-700 transition hover:bg-gray-50 sm:w-auto sm:py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isSubmitting"
                class="bg-primary hover:bg-primary-dark w-full rounded-xl px-4 py-2.5 text-center text-xs font-bold text-white shadow-sm transition disabled:opacity-50 sm:w-auto sm:py-2"
              >
                {{ isSubmitting ? 'Saving...' : 'Save Plan' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Confirm Delete Modal -->
    <AdminSideComponentsConfirmModal
      :show="showDeleteModal"
      title="Delete Subscription Plan"
      :message="`Are you sure you want to delete '${planToDelete?.name}'? This action cannot be undone.`"
      confirm-text="Delete Plan"
      variant="danger"
      @confirm="confirmDeletePlan"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import {
    subscriptionAdminService,
    type Plan,
    type Feature
  } from '~/api/subscription/SubscriptionAdminService'
  import { scanQuotaService, type ScanQuotaPolicies } from '~/api/scanQuota/ScanQuotaService'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  // Dynamic Scan Quota Policies State
  const isLoadingPolicies = ref(false)
  const isUpdatingPolicies = ref(false)
  const policiesForm = ref<ScanQuotaPolicies>({
    doctor_trial_days: 14,
    doctor_trial_daily_scans: 10,
    doctor_unsubscribed_daily_scans: 3,
    patient_default_daily_scans: 5,
    patient_care_daily_scans: 15,
    patient_care_duration_days: 30,
    guest_daily_scans: 1
  })

  const fetchPolicies = async () => {
    isLoadingPolicies.value = true
    try {
      const res = await scanQuotaService.getPolicies()
      if (res?.data) {
        policiesForm.value = { ...res.data }
      }
    } catch (e: any) {
      console.error('Failed to load scan quota policies:', e)
    } finally {
      isLoadingPolicies.value = false
    }
  }

  const savePolicies = async () => {
    isUpdatingPolicies.value = true
    try {
      const res = await scanQuotaService.updatePolicies(policiesForm.value)
      if (res?.data) {
        policiesForm.value = { ...res.data }
        toast.success('AI scan and trial policies updated successfully.')
      }
    } catch (e: any) {
      toast.error(e.data?.message || e.message || 'Failed to update policies.')
    } finally {
      isUpdatingPolicies.value = false
    }
  }

  const isLoading = ref(true)
  const isLoadingFeatures = ref(true)
  const isSubmitting = ref(false)
  const showModal = ref(false)
  const isEditing = ref(false)
  const selectedId = ref<number | null>(null)
  const plans = ref<Plan[]>([])
  const availableFeatures = ref<Feature[]>([])
  const planBuilderFeatures = computed(() => {
    return availableFeatures.value.filter(f => f.code !== 'can_have_secretary')
  })

  const showDeleteModal = ref(false)
  const planToDelete = ref<Plan | null>(null)

  const form = ref<Plan>({
    name: '',
    tier_type: 'individual',
    price_monthly: 0,
    price_annual: 0,
    max_doctors: null,
    max_clinics: null,
    max_secretaries: null,
    daily_scan_limit: null,
    trial_period_days: 0,
    grace_period_days: 3,
    is_active: true,
    features: {}
  })

  const customFeaturesText = ref('')

  const fetchPlans = async () => {
    isLoading.value = true
    try {
      const res = await subscriptionAdminService.getPlans()
      plans.value = res?.data || []
    } catch (error: any) {
      toast.error(error.message || 'Failed to load plans')
    } finally {
      isLoading.value = false
    }
  }

  const fetchFeatures = async () => {
    isLoadingFeatures.value = true
    try {
      const res = await subscriptionAdminService.getFeatures()
      availableFeatures.value = res?.data || []
    } catch (e: any) {
      console.error('Failed to load system features:', e)
    } finally {
      isLoadingFeatures.value = false
    }
  }

  const openCreateModal = () => {
    isEditing.value = false
    selectedId.value = null
    customFeaturesText.value = ''

    const defaultFlags: Record<string, boolean> = {
      custom_list: [] as any
    }
    availableFeatures.value.forEach(f => {
      if (f.code) {
        defaultFlags[f.code] = true
      }
    })

    form.value = {
      name: '',
      tier_type: 'individual',
      price_monthly: 999,
      price_annual: 9990,
      max_doctors: 1,
      max_clinics: 1,
      max_secretaries: 0,
      daily_scan_limit: 50,
      trial_period_days: 14,
      grace_period_days: 3,
      is_active: true,
      features: defaultFlags
    }
    showModal.value = true
  }

  const editPlan = (plan: Plan) => {
    isEditing.value = true
    selectedId.value = plan.id ?? null
    form.value = JSON.parse(JSON.stringify(plan))

    if (!form.value.features || Array.isArray(form.value.features)) {
      form.value.features = {}
    }

    // Populate from plan_features relationship if available
    const planFeats = (plan as any).plan_features || []
    if (Array.isArray(planFeats) && planFeats.length > 0) {
      planFeats.forEach((pf: any) => {
        if (pf.code) {
          form.value.features[pf.code] = Boolean(pf.is_included)
        }
      })
    } else {
      // Ensure all available features have an entry
      availableFeatures.value.forEach(f => {
        if (f.code && form.value.features[f.code] === undefined) {
          form.value.features[f.code] = false
        }
      })
    }

    const existingList = form.value.features.custom_list || []
    customFeaturesText.value = Array.isArray(existingList) ? existingList.join('\n') : ''
    showModal.value = true
  }

  const savePlan = async () => {
    isSubmitting.value = true
    try {
      const customList = customFeaturesText.value
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      if (typeof form.value.features === 'object' && form.value.features !== null) {
        form.value.features.custom_list = customList
        form.value.features.can_have_secretary =
          form.value.max_secretaries === null ||
          form.value.max_secretaries === undefined ||
          Number(form.value.max_secretaries) > 0
      }

      if (isEditing.value && selectedId.value) {
        await subscriptionAdminService.updatePlan(selectedId.value, form.value)
        toast.success('Subscription plan updated successfully')
      } else {
        await subscriptionAdminService.createPlan(form.value)
        toast.success('Subscription plan created successfully')
      }
      showModal.value = false
      await fetchPlans()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save plan')
    } finally {
      isSubmitting.value = false
    }
  }

  const toggleActive = async (plan: Plan) => {
    if (!plan.id) return
    try {
      await subscriptionAdminService.togglePlanActive(plan.id)
      plan.is_active = !plan.is_active
      toast.success(`Plan status updated to ${plan.is_active ? 'Active' : 'Inactive'}`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle status')
    }
  }

  const deletePlan = (plan: Plan) => {
    if (!plan.id) return
    planToDelete.value = plan
    showDeleteModal.value = true
  }

  const confirmDeletePlan = async () => {
    if (!planToDelete.value?.id) return
    try {
      await subscriptionAdminService.deletePlan(planToDelete.value.id)
      toast.success(`Plan "${planToDelete.value.name}" deleted successfully`)
      showDeleteModal.value = false
      planToDelete.value = null
      await fetchPlans()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete plan')
    }
  }

  onMounted(async () => {
    await Promise.all([fetchPlans(), fetchFeatures(), fetchPolicies()])
  })
</script>
