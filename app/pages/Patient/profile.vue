<script setup lang="ts">
  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const { data: user, refresh } = await useApi<any>(`users/${useCookie('user_uuid').value}`, {
    key: `userProfile-${useCookie('user_uuid').value}`
  })

  const { 
    regions, provinces, cities, barangays, 
    fetchRegions, fetchProvinces, fetchCities, fetchBarangays,
    findProvinceByName, findCityByName, findBarangayByName 
  } = usePhLocations()

  const { getStorageUrl } = useStorage()

  const codes = reactive({
    region: '',
    province: '',
    city: '',
    barangay: ''
  })

  const form = reactive({
    first_name: '',
    last_name: '',
    email: '',
    street: '',
    barangay: '',
    city: '',
    province: '',
    country: 'Philippines',
    latitude: null as number | null,
    longitude: null as number | null,
    age: '',
    gender: ''
  })

  onMounted(async () => {
    await fetchRegions()
  })

  // Cascading logic
  watch(() => codes.region, async (newVal) => {
    if (newVal) {
      codes.province = ''
      codes.city = ''
      codes.barangay = ''
      const region = regions.value.find(r => r.code === newVal)
      if (region) form.province = region.name
      await fetchProvinces(newVal)
    }
  })

  watch(() => codes.province, async (newVal) => {
    if (newVal) {
      codes.city = ''
      codes.barangay = ''
      const prov = provinces.value.find(p => p.code === newVal)
      if (prov) form.province = prov.name
      await fetchCities(newVal)
    }
  })

  watch(() => codes.city, async (newVal) => {
    if (newVal) {
      codes.barangay = ''
      const city = cities.value.find(c => c.code === newVal)
      if (city) form.city = city.name
      await fetchBarangays(newVal)
    }
  })

  watch(() => codes.barangay, (newVal) => {
    if (newVal) {
      const brgy = barangays.value.find(b => b.code === newVal)
      if (brgy) form.barangay = brgy.name
    }
  })

  const initDropdowns = async () => {
    if (form.province) {
      const prov = await findProvinceByName(form.province)
      if (prov) {
        codes.region = prov.regionCode
        await fetchProvinces(prov.regionCode)
        codes.province = prov.code
        
        if (form.city) {
          const city = await findCityByName(prov.code, form.city)
          if (city) {
            await fetchCities(prov.code)
            codes.city = city.code
            
            if (form.barangay) {
               const brgy = await findBarangayByName(city.code, form.barangay)
               if (brgy) {
                 await fetchBarangays(city.code)
                 codes.barangay = brgy.code
               }
            }
          }
        }
      }
    }
  }

  const loaded = ref(false)
  watch(user, (newVal) => {
    if (newVal?.data && !loaded.value) {
      const userData = newVal.data
      form.first_name = userData.first_name || ''
      form.last_name = userData.last_name || ''
      form.email = userData.email || ''
      form.street = userData.street || ''
      form.barangay = userData.barangay || ''
      form.city = userData.city || ''
      form.province = userData.province || ''
      form.country = userData.country || 'Philippines'
      form.latitude = userData.latitude ?? null
      form.longitude = userData.longitude ?? null
      form.age = userData.age || ''
      form.gender = userData.gender || ''

      initDropdowns()
      loaded.value = true
    }
  }, { immediate: true, deep: true })

  const isLoading = ref(false)
  const isGeoLoading = ref(false)
  const isSuccess = ref(false)

  const geocodeAddress = async () => {
    if (!form.city || !form.province) return
    
    isGeoLoading.value = true
    try {
      // Step 1: Specific Search
      let query = `${form.street}, ${form.barangay}, ${form.city}, ${form.province}, ${form.country}`
      let response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
        headers: { 'User-Agent': 'DermAssist/1.0 (contact@dermassist.com)' }
      })
      let data = await response.json()

      // Step 2: Fallback to City level if specific fails
      if (!data || data.length === 0) {
        query = `${form.city}, ${form.province}, ${form.country}`
        response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
          headers: { 'User-Agent': 'DermAssist/1.0 (contact@dermassist.com)' }
        })
        data = await response.json()
      }

      if (data && data.length > 0) {
        form.latitude = parseFloat(data[0].lat)
        form.longitude = parseFloat(data[0].lon)
      }
    } catch (error) {
      console.error('Geocoding failed:', error)
    } finally {
      isGeoLoading.value = false
    }
  }

  const submitProfile = async () => {
    isLoading.value = true
    try {
      // Auto-geocode before saving if coordinates are empty
      if (!form.latitude || !form.longitude) {
        await geocodeAddress()
      }

      await $api('users/' + useCookie('user_uuid').value, {
        method: 'PUT',
        body: form
      })
      isSuccess.value = true
      await refresh()

      // Update name cookies
      const userName = useCookie('user_name')
      const authName = useCookie('auth_user_name')
      userName.value = `${form.first_name} ${form.last_name}`
      authName.value = `${form.first_name} ${form.last_name}`

      setTimeout(() => {
        isSuccess.value = false
        navigateTo('/patient')
      }, 1500)
    } catch (error) {
      console.error('Failed to update profile:', error)
    } finally {
      isLoading.value = false
    }
  }
</script>

<template>
  <div class="max-w-4xl">
    <div class="mb-8">
      <h1 class="text-3xl font-bold">Account Settings</h1>
      <p class="text-foreground/60 mt-2">Manage your personal information and profile settings.</p>
    </div>

    <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <!-- Left: Profile Preview -->
      <div class="lg:col-span-1">
        <div class="bg-sidebar/40 border-sidebar-border rounded-3xl border p-6 text-center shadow-sm backdrop-blur-sm">
          <div class="relative mx-auto mb-4 h-32 w-32 overflow-hidden rounded-full bg-linear-to-br from-primary/20 to-primary/5 p-1 border-2 border-primary/20">
            <template v-if="user?.data?.avatar_path">
              <NuxtImg :src="getStorageUrl(user.data.avatar_path)" class="h-full w-full rounded-full object-cover" placeholder />
            </template>
            <div v-else class="flex h-full w-full items-center justify-center rounded-full bg-sidebar/60 text-4xl font-bold text-primary">
              {{ form.first_name?.charAt(0) }}{{ form.last_name?.charAt(0) }}
            </div>
            <button class="absolute bottom-0 right-0 z-10 bg-primary p-2 rounded-full text-white shadow-lg hover:bg-primary-hover transition-colors">
              <Icon name="heroicons:camera-20-solid" size="16" />
            </button>
          </div>
          <h2 class="text-xl font-bold">{{ form.first_name }} {{ form.last_name }}</h2>
          <p class="text-foreground/60 text-sm italic">{{ form.email }}</p>
          
          <div class="mt-6 flex flex-col gap-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-foreground/50">Account Status</span>
              <AppProfileStatusBadge :is-complete="!!(user?.data?.city && user?.data?.province && user?.data?.age && user?.data?.gender)" />
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Form -->
      <div class="lg:col-span-2">
        <div class="bg-sidebar border-sidebar-border rounded-3xl border p-8 shadow-sm">
          <form @submit.prevent="submitProfile" class="flex flex-col gap-6">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">First Name</label>
                <input 
                  v-model="form.first_name" 
                  type="text" 
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none transition-all"
                  placeholder="Enter first name"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">Last Name</label>
                <input 
                  v-model="form.last_name" 
                  type="text" 
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none transition-all"
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-foreground/70 ml-1 text-sm font-medium">Email Address</label>
              <input 
                v-model="form.email" 
                type="email" 
                disabled
                class="bg-foreground/5 border-sidebar-border w-full rounded-2xl border px-4 py-3 outline-none transition-all opacity-60 cursor-not-allowed"
                placeholder="email@example.com"
              />
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">Age</label>
                <input 
                  v-model="form.age" 
                  type="number" 
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none transition-all"
                  placeholder="Your age"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">Gender</label>
                <select 
                  v-model="form.gender" 
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none transition-all appearance-none"
                >
                  <option value="" disabled>Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">Region</label>
                <select 
                  v-model="codes.region" 
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none transition-all appearance-none"
                >
                  <option value="" disabled>Select Region</option>
                  <option v-for="r in regions" :key="r.code" :value="r.code">{{ r.name }}</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">Province</label>
                <select 
                  v-model="codes.province" 
                  :disabled="!provinces.length"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none transition-all appearance-none disabled:opacity-50"
                >
                  <option value="" disabled>{{ provinces.length ? 'Select Province' : 'N/A' }}</option>
                  <option v-for="p in provinces" :key="p.code" :value="p.code">{{ p.name }}</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">City / Municipality</label>
                <select 
                  v-model="codes.city" 
                  :disabled="!cities.length"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none transition-all appearance-none disabled:opacity-50"
                >
                  <option value="" disabled>Select City</option>
                  <option v-for="c in cities" :key="c.code" :value="c.code">{{ c.name }}</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-foreground/70 ml-1 text-sm font-medium">Barangay</label>
                <select 
                  v-model="codes.barangay" 
                  :disabled="!barangays.length"
                  class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none transition-all appearance-none disabled:opacity-50"
                >
                  <option value="" disabled>Select Barangay</option>
                  <option v-for="b in barangays" :key="b.code" :value="b.code">{{ b.name }}</option>
                </select>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-foreground/70 ml-1 text-sm font-medium">Street Address</label>
              <input 
                v-model="form.street" 
                type="text" 
                class="bg-foreground/5 border-sidebar-border focus:border-primary w-full rounded-2xl border px-4 py-3 outline-none transition-all"
                placeholder="House No., Street Name"
              />
            </div>

            <div class="mt-4 flex items-center justify-between">
              <div v-if="isSuccess" class="flex items-center gap-2 text-green-500">
                <Icon name="heroicons:check-circle" size="20" />
                <span class="text-sm font-medium">Profile updated successfully!</span>
              </div>
              <div v-if="!isSuccess"></div>

              <AppButton 
                type="submit" 
                :loading="isLoading"
                class="min-w-[140px]"
              >
                Save Changes
              </AppButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 1.5em;
  }
</style>
