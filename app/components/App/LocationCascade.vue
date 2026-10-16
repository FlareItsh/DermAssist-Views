<script setup lang="ts">
  import { ref, reactive, computed, watch, onMounted } from 'vue'
  import { toast } from 'vue-sonner'
  import { usePhLocations } from '~/composables/usePhLocations'

  interface Props {
    province?: string
    city?: string
    barangay?: string
    street?: string
    coordinates?: string | null
    title?: string
    subtitle?: string
    streetLabel?: string
    streetPlaceholder?: string
    icon?: string
    disabled?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    province: '',
    city: '',
    barangay: '',
    street: '',
    coordinates: null,
    title: 'Location & Address',
    subtitle: 'Provide your geographic location details.',
    streetLabel: 'Street Address',
    streetPlaceholder: 'House No., Building, Street Name',
    icon: 'heroicons:map-pin',
    disabled: false
  })

  const emit = defineEmits<{
    (e: 'update:province', value: string): void
    (e: 'update:city', value: string): void
    (e: 'update:barangay', value: string): void
    (e: 'update:street', value: string): void
    (e: 'change'): void
  }>()

  const {
    regions,
    provinces,
    cities,
    barangays,
    isLoadingRegions,
    isLoadingProvinces,
    isLoadingCities,
    isLoadingBarangays,
    fetchRegions,
    fetchProvinces,
    fetchCities,
    fetchBarangays,
    findProvinceByName,
    findCityByName,
    findBarangayByName
  } = usePhLocations()

  const codes = reactive({
    region: '',
    province: '',
    city: '',
    barangay: ''
  })

  // Visual shake / highlight target when a user attempts to interact with a locked step
  const shakingField = ref<'region' | 'province' | 'city' | null>(null)
  const triggerNudge = (field: 'region' | 'province' | 'city', message: string) => {
    shakingField.value = field
    toast.info(message)
    setTimeout(() => {
      if (shakingField.value === field) {
        shakingField.value = null
      }
    }, 1200)
  }

  // Check if current region is NCR (National Capital Region - code 130000000)
  const isNcrRegion = computed(() => {
    if (!codes.region) return false
    const reg = regions.value.find(r => r.code === codes.region)
    return (
      codes.region === '130000000' ||
      (reg && (reg.name?.includes('NCR') || reg.name?.includes('National Capital')))
    )
  })

  // Step state determinations
  const isRegionCompleted = computed(() => Boolean(codes.region))
  const isProvinceApplicable = computed(() => !isNcrRegion.value)
  const isProvinceUnlocked = computed(() => isRegionCompleted.value && isProvinceApplicable.value)
  const isProvinceCompleted = computed(() => {
    if (isNcrRegion.value) return true
    return Boolean(codes.province)
  })
  const isCityUnlocked = computed(() => {
    if (!isRegionCompleted.value) return false
    if (isNcrRegion.value) return true
    return Boolean(codes.province)
  })
  const isCityCompleted = computed(() => Boolean(codes.city))
  const isBarangayUnlocked = computed(() => isCityCompleted.value)
  const isBarangayCompleted = computed(() => Boolean(codes.barangay))

  // Determine which step is currently the primary "next step"
  const currentActiveStep = computed(() => {
    if (!isRegionCompleted.value) return 1
    if (isProvinceApplicable.value && !codes.province) return 2
    if (!isCityCompleted.value) return 3
    if (!isBarangayCompleted.value) return 4
    return 5
  })

  // Selected item display names for live breadcrumbs
  const selectedRegionName = computed(() => {
    if (!codes.region) return ''
    return regions.value.find(r => r.code === codes.region)?.name || ''
  })

  const selectedProvinceName = computed(() => {
    if (isNcrRegion.value) return 'Metro Manila (NCR)'
    if (!codes.province) return ''
    return provinces.value.find(p => p.code === codes.province)?.name || ''
  })

  const selectedCityName = computed(() => {
    if (!codes.city) return ''
    return cities.value.find(c => c.code === codes.city)?.name || ''
  })

  const selectedBarangayName = computed(() => {
    if (!codes.barangay) return ''
    return barangays.value.find(b => b.code === codes.barangay)?.name || ''
  })

  // Internal initialization lock to prevent cascaded emits during reverse-mapping
  const isInitializing = ref(false)

  // Cascading Watchers
  watch(
    () => codes.region,
    async (newVal, oldVal) => {
      if (isInitializing.value) return
      if (newVal) {
        codes.province = ''
        codes.city = ''
        codes.barangay = ''
        emit('update:city', '')
        emit('update:barangay', '')

        await fetchProvinces(newVal)

        // For NCR or regions with 0 provinces, fetch cities directly and set province name
        if (provinces.value.length === 0) {
          const region = regions.value.find(r => r.code === newVal)
          if (region) {
            emit('update:province', region.name)
          }
          await fetchCities(newVal, true)
        } else {
          emit('update:province', '')
        }
        emit('change')
      } else if (oldVal) {
        codes.province = ''
        codes.city = ''
        codes.barangay = ''
        emit('update:province', '')
        emit('update:city', '')
        emit('update:barangay', '')
        emit('change')
      }
    }
  )

  watch(
    () => codes.province,
    async (newVal, oldVal) => {
      if (isInitializing.value) return
      if (newVal) {
        codes.city = ''
        codes.barangay = ''
        emit('update:city', '')
        emit('update:barangay', '')

        const prov = provinces.value.find(p => p.code === newVal)
        if (prov) {
          emit('update:province', prov.name)
        }

        await fetchCities(newVal, false)
        emit('change')
      } else if (oldVal && !isNcrRegion.value) {
        codes.city = ''
        codes.barangay = ''
        emit('update:city', '')
        emit('update:barangay', '')
        emit('change')
      }
    }
  )

  watch(
    () => codes.city,
    async (newVal, oldVal) => {
      if (isInitializing.value) return
      if (newVal) {
        codes.barangay = ''
        emit('update:barangay', '')

        const city = cities.value.find(c => c.code === newVal)
        if (city) {
          emit('update:city', city.name)
        }

        await fetchBarangays(newVal)
        emit('change')
      } else if (oldVal) {
        codes.barangay = ''
        emit('update:barangay', '')
        emit('change')
      }
    }
  )

  watch(
    () => codes.barangay,
    newVal => {
      if (isInitializing.value) return
      if (newVal) {
        const brgy = barangays.value.find(b => b.code === newVal)
        if (brgy) {
          emit('update:barangay', brgy.name)
        }
      } else {
        emit('update:barangay', '')
      }
      emit('change')
    }
  )

  // Reverse mapping for initial props (e.g. from user profile in DB)
  const isPopulated = ref(false)
  const initDropdowns = async () => {
    if (!import.meta.client || isPopulated.value) return
    isInitializing.value = true

    try {
      await fetchRegions()

      if (props.province) {
        // Try province match first
        const prov = await findProvinceByName(props.province)
        if (prov) {
          codes.region = prov.regionCode
          await fetchProvinces(prov.regionCode)
          codes.province = prov.code

          if (props.city) {
            const city = await findCityByName(prov.code, props.city)
            if (city) {
              await fetchCities(prov.code, false)
              codes.city = city.code

              if (props.barangay) {
                const brgy = await findBarangayByName(city.code, props.barangay)
                if (brgy) {
                  await fetchBarangays(city.code)
                  codes.barangay = brgy.code
                }
              }
            }
          }
        } else {
          // Check if province string corresponds to a Region (e.g. NCR)
          const provLower = props.province ? String(props.province).trim().toLowerCase() : ''
          const matchedRegion = regions.value.find(
            r =>
              (r?.name && String(r.name).toLowerCase() === provLower) ||
              (r?.regionName && String(r.regionName).toLowerCase() === provLower) ||
              (provLower.includes('ncr') && r.code === '130000000')
          )
          if (matchedRegion) {
            codes.region = matchedRegion.code
            await fetchProvinces(matchedRegion.code)
            if (provinces.value.length === 0) {
              await fetchCities(matchedRegion.code, true)
              if (props.city) {
                const cityLower = String(props.city).trim().toLowerCase()
                const cityMatch = cities.value.find(
                  c => c?.name && String(c.name).toLowerCase() === cityLower
                )
                if (cityMatch) {
                  codes.city = cityMatch.code
                  if (props.barangay) {
                    const brgy = await findBarangayByName(cityMatch.code, props.barangay)
                    if (brgy) {
                      await fetchBarangays(cityMatch.code)
                      codes.barangay = brgy.code
                    }
                  }
                }
              }
            }
          }
        }
      }
      isPopulated.value = true
    } catch (err) {
      console.error('Failed to reverse map location codes:', err)
    } finally {
      isInitializing.value = false
    }
  }

  // Watch for external props arriving after initial mount (client only)
  watch(
    () => [props.province, props.city, props.barangay],
    ([newProv]) => {
      if (import.meta.client && newProv && !codes.region && !isPopulated.value) {
        initDropdowns()
      }
    },
    { immediate: true }
  )

  onMounted(async () => {
    await fetchRegions()
    if (props.province && !codes.region && !isPopulated.value) {
      await initDropdowns()
    }
  })

  // Handle clicks on locked wrappers
  const handleLockedProvinceClick = () => {
    if (!isRegionCompleted.value) {
      triggerNudge('region', 'Please select a Region first to unlock Provinces.')
    }
  }

  const handleLockedCityClick = () => {
    if (!isRegionCompleted.value) {
      triggerNudge('region', 'Please select a Region first to unlock Cities.')
    } else if (isProvinceApplicable.value && !codes.province) {
      triggerNudge('province', 'Please select a Province first to unlock Cities.')
    }
  }

  const handleLockedBarangayClick = () => {
    if (!isCityCompleted.value) {
      triggerNudge('city', 'Please select a City / Municipality first to unlock Barangays.')
    }
  }

  const handleStreetInput = (e: Event) => {
    const val = (e.target as HTMLInputElement).value
    emit('update:street', val)
    emit('change')
  }
</script>

<template>
  <div class="bg-card border-border flex flex-col justify-between rounded-3xl border p-6 shadow-xs">
    <div>
      <!-- Card Header -->
      <div class="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div class="flex items-center gap-3">
          <div
            class="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          >
            <Icon
              :name="icon"
              size="22"
            />
          </div>
          <div>
            <h2 class="text-foreground text-base font-bold sm:text-lg">
              {{ title }}
            </h2>
            <p class="text-muted-foreground mt-0.5 text-xs">
              {{ subtitle }}
            </p>
          </div>
        </div>

        <!-- Coordinates Status Badge -->
        <div
          v-if="coordinates"
          class="inline-flex w-fit items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
          title="Geographic coordinates mapped for discovery"
        >
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
          <span>{{ coordinates }} Mapped</span>
        </div>
      </div>

      <!-- Live Hierarchy Breadcrumb Strip -->
      <div
        class="bg-foreground/[0.03] border-border/70 mb-5 flex flex-wrap items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs"
      >
        <span class="text-muted-foreground mr-1 text-[11px] font-semibold tracking-wider uppercase">
          Flow:
        </span>

        <!-- Region Crumb -->
        <span
          class="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-all"
          :class="[
            isRegionCompleted
              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : currentActiveStep === 1
                ? 'border-primary/30 bg-primary/10 text-primary ring-primary/10 border font-bold ring-2'
                : 'text-muted-foreground bg-foreground/5'
          ]"
        >
          <Icon
            v-if="isRegionCompleted"
            name="heroicons:check-16-solid"
            size="12"
          />
          <span
            v-else-if="currentActiveStep === 1"
            class="bg-primary h-1.5 w-1.5 animate-ping rounded-full"
          ></span>
          <span>{{ selectedRegionName || '1. Region' }}</span>
        </span>

        <Icon
          name="heroicons:chevron-right-16-solid"
          class="text-muted-foreground/40 shrink-0"
          size="12"
        />

        <!-- Province Crumb -->
        <span
          class="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-all"
          :class="[
            isNcrRegion
              ? 'text-muted-foreground border border-slate-500/20 bg-slate-500/10'
              : codes.province
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : currentActiveStep === 2
                  ? 'border-primary/30 bg-primary/10 text-primary ring-primary/10 border font-bold ring-2'
                  : 'text-muted-foreground/60 bg-foreground/5'
          ]"
        >
          <Icon
            v-if="codes.province"
            name="heroicons:check-16-solid"
            size="12"
          />
          <Icon
            v-else-if="!isProvinceUnlocked"
            name="heroicons:lock-closed-16-solid"
            size="11"
          />
          <span>{{ selectedProvinceName || '2. Province' }}</span>
        </span>

        <Icon
          name="heroicons:chevron-right-16-solid"
          class="text-muted-foreground/40 shrink-0"
          size="12"
        />

        <!-- City Crumb -->
        <span
          class="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-all"
          :class="[
            isCityCompleted
              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : currentActiveStep === 3
                ? 'border-primary/30 bg-primary/10 text-primary ring-primary/10 border font-bold ring-2'
                : 'text-muted-foreground/60 bg-foreground/5'
          ]"
        >
          <Icon
            v-if="isCityCompleted"
            name="heroicons:check-16-solid"
            size="12"
          />
          <Icon
            v-else-if="!isCityUnlocked"
            name="heroicons:lock-closed-16-solid"
            size="11"
          />
          <span>{{ selectedCityName || '3. City' }}</span>
        </span>

        <Icon
          name="heroicons:chevron-right-16-solid"
          class="text-muted-foreground/40 shrink-0"
          size="12"
        />

        <!-- Barangay Crumb -->
        <span
          class="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-all"
          :class="[
            isBarangayCompleted
              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : currentActiveStep === 4
                ? 'border-primary/30 bg-primary/10 text-primary ring-primary/10 border font-bold ring-2'
                : 'text-muted-foreground/60 bg-foreground/5'
          ]"
        >
          <Icon
            v-if="isBarangayCompleted"
            name="heroicons:check-16-solid"
            size="12"
          />
          <Icon
            v-else-if="!isBarangayUnlocked"
            name="heroicons:lock-closed-16-solid"
            size="11"
          />
          <span>{{ selectedBarangayName || '4. Barangay' }}</span>
        </span>
      </div>

      <div class="bg-border/60 mb-5 h-px"></div>

      <!-- Dependent Fields Grid -->
      <div class="space-y-4">
        <!-- Row 1: Region & Province -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <!-- Step 1: Region -->
          <div
            class="flex flex-col gap-1.5 transition-all"
            :class="{ 'animate-shake': shakingField === 'region' }"
          >
            <div class="flex items-center justify-between">
              <label
                class="text-foreground/80 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase"
              >
                <span
                  class="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                  :class="
                    isRegionCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-primary text-primary-foreground'
                  "
                >
                  <Icon
                    v-if="isRegionCompleted"
                    name="heroicons:check-16-solid"
                    size="10"
                  />
                  <span v-else>1</span>
                </span>
                <span>Region</span>
              </label>

              <span
                v-if="isLoadingRegions"
                class="text-primary flex items-center gap-1 text-[11px] font-medium"
              >
                <Icon
                  name="svg-spinners:180-ring"
                  size="12"
                />
                <span>Loading...</span>
              </span>
            </div>

            <div class="relative">
              <select
                v-model="codes.region"
                :disabled="disabled || isLoadingRegions"
                class="bg-foreground/5 border-border focus:border-primary w-full cursor-pointer appearance-none rounded-2xl border px-4 py-3 pr-10 text-sm font-medium transition-all outline-none"
                :class="[currentActiveStep === 1 ? 'border-primary/50 ring-primary/10 ring-2' : '']"
              >
                <option
                  value=""
                  disabled
                >
                  Select Region
                </option>
                <option
                  v-for="r in regions"
                  :key="r.code"
                  :value="r.code"
                >
                  {{ r.name }}
                </option>
              </select>
              <div
                class="text-muted-foreground/60 pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5"
              >
                <Icon
                  name="heroicons:chevron-down-20-solid"
                  size="18"
                />
              </div>
            </div>

            <!-- Subtext Indicator -->
            <p class="text-[11px]">
              <span
                v-if="isRegionCompleted"
                class="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400"
              >
                <Icon
                  name="heroicons:check-circle-16-solid"
                  size="13"
                />
                Region selected
              </span>
              <span
                v-else
                class="text-muted-foreground inline-flex items-center gap-1"
              >
                Step 1: Choose administrative region to start
              </span>
            </p>
          </div>

          <!-- Step 2: Province -->
          <div
            class="flex flex-col gap-1.5 transition-all"
            :class="{ 'animate-shake': shakingField === 'province' }"
            @click="!isProvinceUnlocked && handleLockedProvinceClick()"
          >
            <div class="flex items-center justify-between">
              <label
                class="text-foreground/80 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase"
              >
                <span
                  class="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                  :class="[
                    codes.province
                      ? 'bg-emerald-500 text-white'
                      : isNcrRegion
                        ? 'bg-slate-400 text-white'
                        : currentActiveStep === 2
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted-foreground/30 text-muted-foreground'
                  ]"
                >
                  <Icon
                    v-if="codes.province"
                    name="heroicons:check-16-solid"
                    size="10"
                  />
                  <span v-else-if="isNcrRegion">—</span>
                  <span v-else>2</span>
                </span>
                <span>Province</span>
              </label>

              <span
                v-if="isLoadingProvinces"
                class="text-primary flex items-center gap-1 text-[11px] font-medium"
              >
                <Icon
                  name="svg-spinners:180-ring"
                  size="12"
                />
                <span>Fetching provinces...</span>
              </span>
            </div>

            <div class="relative">
              <select
                v-model="codes.province"
                :disabled="disabled || !isProvinceUnlocked || isLoadingProvinces"
                class="border-border w-full appearance-none rounded-2xl border px-4 py-3 pr-10 text-sm font-medium transition-all outline-none"
                :class="[
                  isProvinceUnlocked
                    ? 'bg-foreground/5 focus:border-primary cursor-pointer'
                    : 'bg-foreground/5 text-muted-foreground cursor-not-allowed opacity-50',
                  currentActiveStep === 2 && isProvinceUnlocked
                    ? 'border-primary/50 ring-primary/10 ring-2'
                    : ''
                ]"
              >
                <option
                  value=""
                  disabled
                >
                  {{
                    isNcrRegion
                      ? 'N/A (Metro Manila has no provinces)'
                      : !isRegionCompleted
                        ? 'Select Province (Locked)'
                        : isLoadingProvinces
                          ? 'Fetching provinces...'
                          : provinces.length
                            ? 'Select Province'
                            : 'No provinces found'
                  }}
                </option>
                <option
                  v-for="p in provinces"
                  :key="p.code"
                  :value="p.code"
                >
                  {{ p.name }}
                </option>
              </select>
              <div
                class="text-muted-foreground/60 pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5"
              >
                <Icon
                  v-if="!isProvinceUnlocked && !isNcrRegion"
                  name="heroicons:lock-closed-16-solid"
                  size="16"
                  class="text-muted-foreground/50"
                />
                <Icon
                  v-else
                  name="heroicons:chevron-down-20-solid"
                  size="18"
                />
              </div>
            </div>

            <!-- Subtext Indicator -->
            <p class="text-[11px]">
              <span
                v-if="isNcrRegion"
                class="inline-flex items-center gap-1 font-medium text-slate-500"
              >
                <Icon
                  name="heroicons:information-circle-16-solid"
                  size="13"
                />
                Skipped: Metro Manila proceeds directly to City
              </span>
              <span
                v-else-if="codes.province"
                class="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400"
              >
                <Icon
                  name="heroicons:check-circle-16-solid"
                  size="13"
                />
                Province selected
              </span>
              <span
                v-else-if="isLoadingProvinces"
                class="text-primary inline-flex items-center gap-1"
              >
                Loading provinces from registry...
              </span>
              <span
                v-else-if="isProvinceUnlocked"
                class="text-primary/90 inline-flex items-center gap-1 font-medium"
              >
                Step 2: Choose province to unlock cities
              </span>
              <span
                v-else
                class="text-muted-foreground/80 inline-flex items-center gap-1"
              >
                <Icon
                  name="heroicons:lock-closed-16-solid"
                  size="12"
                  class="text-amber-500/80"
                />
                Locked • Select Region first to enable
              </span>
            </p>
          </div>
        </div>

        <!-- Row 2: City & Barangay -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <!-- Step 3: City / Municipality -->
          <div
            class="flex flex-col gap-1.5 transition-all"
            :class="{ 'animate-shake': shakingField === 'city' }"
            @click="!isCityUnlocked && handleLockedCityClick()"
          >
            <div class="flex items-center justify-between">
              <label
                class="text-foreground/80 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase"
              >
                <span
                  class="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                  :class="[
                    isCityCompleted
                      ? 'bg-emerald-500 text-white'
                      : currentActiveStep === 3
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted-foreground/30 text-muted-foreground'
                  ]"
                >
                  <Icon
                    v-if="isCityCompleted"
                    name="heroicons:check-16-solid"
                    size="10"
                  />
                  <span v-else>3</span>
                </span>
                <span>City / Municipality</span>
              </label>

              <span
                v-if="isLoadingCities"
                class="text-primary flex items-center gap-1 text-[11px] font-medium"
              >
                <Icon
                  name="svg-spinners:180-ring"
                  size="12"
                />
                <span>Fetching cities...</span>
              </span>
            </div>

            <div class="relative">
              <select
                v-model="codes.city"
                :disabled="disabled || !isCityUnlocked || isLoadingCities"
                class="border-border w-full appearance-none rounded-2xl border px-4 py-3 pr-10 text-sm font-medium transition-all outline-none"
                :class="[
                  isCityUnlocked
                    ? 'bg-foreground/5 focus:border-primary cursor-pointer'
                    : 'bg-foreground/5 text-muted-foreground cursor-not-allowed opacity-50',
                  currentActiveStep === 3 && isCityUnlocked
                    ? 'border-primary/50 ring-primary/10 ring-2'
                    : ''
                ]"
              >
                <option
                  value=""
                  disabled
                >
                  {{
                    !isCityUnlocked
                      ? 'Select City (Locked)'
                      : isLoadingCities
                        ? 'Fetching cities...'
                        : 'Select City'
                  }}
                </option>
                <option
                  v-for="c in cities"
                  :key="c.code"
                  :value="c.code"
                >
                  {{ c.name }}
                </option>
              </select>
              <div
                class="text-muted-foreground/60 pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5"
              >
                <Icon
                  v-if="!isCityUnlocked"
                  name="heroicons:lock-closed-16-solid"
                  size="16"
                  class="text-muted-foreground/50"
                />
                <Icon
                  v-else
                  name="heroicons:chevron-down-20-solid"
                  size="18"
                />
              </div>
            </div>

            <!-- Subtext Indicator -->
            <p class="text-[11px]">
              <span
                v-if="isCityCompleted"
                class="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400"
              >
                <Icon
                  name="heroicons:check-circle-16-solid"
                  size="13"
                />
                City / Municipality selected
              </span>
              <span
                v-else-if="isLoadingCities"
                class="text-primary inline-flex items-center gap-1"
              >
                Loading cities & municipalities...
              </span>
              <span
                v-else-if="isCityUnlocked"
                class="text-primary/90 inline-flex items-center gap-1 font-medium"
              >
                Step 3: Choose city to unlock barangays
              </span>
              <span
                v-else
                class="text-muted-foreground/80 inline-flex items-center gap-1"
              >
                <Icon
                  name="heroicons:lock-closed-16-solid"
                  size="12"
                  class="text-amber-500/80"
                />
                Locked • Select {{ isNcrRegion ? 'Region' : 'Province' }} first to enable
              </span>
            </p>
          </div>

          <!-- Step 4: Barangay -->
          <div
            class="flex flex-col gap-1.5 transition-all"
            @click="!isBarangayUnlocked && handleLockedBarangayClick()"
          >
            <div class="flex items-center justify-between">
              <label
                class="text-foreground/80 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase"
              >
                <span
                  class="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                  :class="[
                    isBarangayCompleted
                      ? 'bg-emerald-500 text-white'
                      : currentActiveStep === 4
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted-foreground/30 text-muted-foreground'
                  ]"
                >
                  <Icon
                    v-if="isBarangayCompleted"
                    name="heroicons:check-16-solid"
                    size="10"
                  />
                  <span v-else>4</span>
                </span>
                <span>Barangay</span>
              </label>

              <span
                v-if="isLoadingBarangays"
                class="text-primary flex items-center gap-1 text-[11px] font-medium"
              >
                <Icon
                  name="svg-spinners:180-ring"
                  size="12"
                />
                <span>Fetching barangays...</span>
              </span>
            </div>

            <div class="relative">
              <select
                v-model="codes.barangay"
                :disabled="disabled || !isBarangayUnlocked || isLoadingBarangays"
                class="border-border w-full appearance-none rounded-2xl border px-4 py-3 pr-10 text-sm font-medium transition-all outline-none"
                :class="[
                  isBarangayUnlocked
                    ? 'bg-foreground/5 focus:border-primary cursor-pointer'
                    : 'bg-foreground/5 text-muted-foreground cursor-not-allowed opacity-50',
                  currentActiveStep === 4 && isBarangayUnlocked
                    ? 'border-primary/50 ring-primary/10 ring-2'
                    : ''
                ]"
              >
                <option
                  value=""
                  disabled
                >
                  {{
                    !isBarangayUnlocked
                      ? 'Select Barangay (Locked)'
                      : isLoadingBarangays
                        ? 'Fetching barangays...'
                        : 'Select Barangay'
                  }}
                </option>
                <option
                  v-for="b in barangays"
                  :key="b.code"
                  :value="b.code"
                >
                  {{ b.name }}
                </option>
              </select>
              <div
                class="text-muted-foreground/60 pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5"
              >
                <Icon
                  v-if="!isBarangayUnlocked"
                  name="heroicons:lock-closed-16-solid"
                  size="16"
                  class="text-muted-foreground/50"
                />
                <Icon
                  v-else
                  name="heroicons:chevron-down-20-solid"
                  size="18"
                />
              </div>
            </div>

            <!-- Subtext Indicator -->
            <p class="text-[11px]">
              <span
                v-if="isBarangayCompleted"
                class="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400"
              >
                <Icon
                  name="heroicons:check-circle-16-solid"
                  size="13"
                />
                Barangay selected
              </span>
              <span
                v-else-if="isLoadingBarangays"
                class="text-primary inline-flex items-center gap-1"
              >
                Loading barangays...
              </span>
              <span
                v-else-if="isBarangayUnlocked"
                class="text-primary/90 inline-flex items-center gap-1 font-medium"
              >
                Step 4: Choose barangay to finalize location
              </span>
              <span
                v-else
                class="text-muted-foreground/80 inline-flex items-center gap-1"
              >
                <Icon
                  name="heroicons:lock-closed-16-solid"
                  size="12"
                  class="text-amber-500/80"
                />
                Locked • Select City / Municipality first to enable
              </span>
            </p>
          </div>
        </div>

        <!-- Row 3: Street Address / Practice Room -->
        <div class="flex flex-col gap-1.5 pt-1">
          <label
            class="text-foreground/80 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase"
          >
            <span
              class="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
              :class="
                street
                  ? 'bg-emerald-500 text-white'
                  : 'bg-muted-foreground/30 text-muted-foreground'
              "
            >
              <Icon
                v-if="street"
                name="heroicons:check-16-solid"
                size="10"
              />
              <span v-else>5</span>
            </span>
            <span>{{ streetLabel }}</span>
          </label>
          <input
            :value="street"
            :disabled="disabled"
            type="text"
            class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-all outline-none"
            :placeholder="streetPlaceholder"
            @input="handleStreetInput"
          />
        </div>
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    20%,
    60% {
      transform: translateX(-4px);
    }
    40%,
    80% {
      transform: translateX(4px);
    }
  }

  .animate-shake {
    animation: shake 0.4s ease-in-out 2;
  }
</style>
