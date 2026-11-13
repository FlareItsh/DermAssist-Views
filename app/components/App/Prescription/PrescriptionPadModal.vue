<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
  import { toast } from 'vue-sonner'
  import { $api } from '~/composables/useApi'

  interface Props {
    modelValue: boolean
    diagnosisUuid?: string | null
    recordUuid?: string | null
    allowEditCredentials?: boolean
    draftData?: any | null
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    diagnosisUuid: null,
    recordUuid: null,
    allowEditCredentials: true,
    draftData: null
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', val: boolean): void
    (e: 'credentials-updated'): void
  }>()

  const isLoading = ref(false)
  const isDownloadingPdf = ref(false)
  const prescriptionData = ref<any>(null)
  const showCredentialsModal = ref(false)

  // Document canvas scaling & zoom for mobile screens
  const isZoomed = ref(false)
  const viewportRef = ref<HTMLElement | null>(null)
  const slipRef = ref<HTMLElement | null>(null)
  const viewportWidth = ref(520)
  const slipHeight = ref(600)
  let resizeObserver: ResizeObserver | null = null

  const updateDimensions = () => {
    if (viewportRef.value) {
      viewportWidth.value = viewportRef.value.clientWidth
    }
    if (slipRef.value) {
      slipHeight.value = slipRef.value.offsetHeight
    }
  }

  const currentScale = computed(() => {
    if (isZoomed.value) return 1
    if (!viewportWidth.value || viewportWidth.value >= 540) return 1
    // Padding allowance inside the scroll viewport (16px total)
    const available = Math.max(260, viewportWidth.value - 24)
    return Math.min(1, available / 520)
  })

  onMounted(() => {
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateDimensions()
      })
      if (viewportRef.value) resizeObserver.observe(viewportRef.value)
      if (slipRef.value) resizeObserver.observe(slipRef.value)
    }
    window.addEventListener('resize', updateDimensions)
  })

  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    window.removeEventListener('resize', updateDimensions)
  })

  const effectiveUuid = computed(() => props.diagnosisUuid || props.recordUuid || null)

  const fetchPrescriptionData = async () => {
    if (props.draftData) {
      prescriptionData.value = props.draftData
      return
    }

    if (!effectiveUuid.value) return

    isLoading.value = true
    try {
      const res = await $api<any>(`/diagnoses/${effectiveUuid.value}/prescription/data`)
      prescriptionData.value = res?.data ?? res
    } catch (err: any) {
      console.error('Failed to load prescription data:', err)
      toast.error(err?.data?.message || 'Failed to load prescription details.')
    } finally {
      isLoading.value = false
    }
  }

  watch(
    () => props.modelValue,
    isOpen => {
      if (isOpen) {
        isZoomed.value = false
        fetchPrescriptionData()
        nextTick(() => {
          setTimeout(updateDimensions, 60)
        })
      }
    },
    { immediate: true }
  )

  watch(
    prescriptionData,
    () => {
      nextTick(() => {
        setTimeout(updateDimensions, 60)
      })
    }
  )

  const handleDownloadPdf = async () => {
    if (!effectiveUuid.value) {
      toast.error('No diagnosis record found for PDF download.')
      return
    }

    isDownloadingPdf.value = true
    try {
      const blob = await $api<Blob>(`/diagnoses/${effectiveUuid.value}/prescription/pdf`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `prescription-${prescriptionData.value?.prescriptionNumber || effectiveUuid.value.slice(0, 8)}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Prescription PDF downloaded successfully!')
    } catch (err: any) {
      console.error('Failed to download prescription PDF:', err)
      toast.error('Failed to download PDF. Please try again.')
    } finally {
      isDownloadingPdf.value = false
    }
  }

  const handleDirectPrint = () => {
    const padEl = document.getElementById('prescription-slip-printable')
    if (!padEl) {
      window.print()
      return
    }

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) return

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n')

    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prescription - ${prescriptionData.value?.prescriptionNumber || ''}</title>
          ${styles}
          <style>
            @page {
              size: 148mm 210mm portrait;
              margin: 8mm 10mm 8mm 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #111827;
              margin: 0;
              padding: 0;
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            * { box-sizing: border-box; }
            .pad-container {
              width: 100%;
              max-width: 148mm;
              margin: 0 auto;
              font-size: 10px;
              line-height: 1.35;
              min-height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="pad-container">
            ${padEl.innerHTML}
          </div>
        </body>
      </html>
    `)
    doc.close()

    iframe.contentWindow?.focus()
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
    }, 400)
  }

  const handleCredentialsSaved = () => {
    fetchPrescriptionData()
    emit('credentials-updated')
  }
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-2 sm:p-4"
    >
      <div
        class="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl"
      >
        <!-- Top Bar -->
        <div
          class="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:px-6 sm:py-3.5"
        >
          <div class="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
            >
              <Icon
                name="material-symbols:prescriptions-outline-rounded"
                class="text-lg"
              />
            </div>
            <div class="min-w-0">
              <h3 class="truncate text-xs font-bold text-gray-900 sm:text-sm">
                Official Medical Prescription (Rx Pad)
              </h3>
              <p class="truncate text-[10px] text-gray-500 sm:text-[11px]">
                Standard Philippine FDA &amp; Generics Act Compliant
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              v-if="allowEditCredentials"
              type="button"
              @click="showCredentialsModal = true"
              class="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 sm:px-3"
              title="Doctor Signature &amp; PTR"
            >
              <Icon
                name="lucide:pen-tool"
                class="text-xs text-indigo-600"
              />
              <span class="hidden sm:inline">Doctor Signature &amp; PTR</span>
              <span class="sm:hidden">Signature</span>
            </button>
            <button
              type="button"
              @click="emit('update:modelValue', false)"
              class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close prescription modal"
            >
              <Icon
                name="lucide:x"
                class="text-base"
              />
            </button>
          </div>
        </div>

        <!-- Preview Body (A5 Scaled Proportional Document Viewport) -->
        <div
          ref="viewportRef"
          class="custom-scrollbar relative flex-1 overflow-x-auto overflow-y-auto bg-gray-100/70 p-2 sm:p-6"
        >
          <!-- Floating Zoom Toggle Pill on Mobile/Scaled screens -->
          <div
            v-if="viewportWidth < 540 && prescriptionData && !isLoading"
            class="sticky top-1 z-10 mb-2 flex justify-end"
          >
            <button
              type="button"
              @click="isZoomed = !isZoomed"
              class="flex items-center gap-1.5 rounded-full border border-gray-200/90 bg-white/95 px-3 py-1 text-xs font-semibold text-gray-700 shadow-xs backdrop-blur-xs transition hover:bg-white active:scale-95"
            >
              <Icon
                :name="isZoomed ? 'lucide:minimize-2' : 'lucide:maximize-2'"
                class="text-xs text-indigo-600"
              />
              <span>{{ isZoomed ? 'Fit to Screen' : '100% Zoom' }}</span>
            </button>
          </div>

          <div
            v-if="isLoading"
            class="flex flex-col items-center justify-center gap-2 py-20 text-center"
          >
            <Icon
              name="lucide:loader-2"
              class="animate-spin text-2xl text-indigo-600"
            />
            <span class="text-xs font-semibold text-gray-500"
              >Generating Prescription Pad Preview...</span
            >
          </div>

          <!-- Document Canvas Wrapper -->
          <div
            v-else-if="prescriptionData"
            class="mx-auto flex justify-center transition-[height] duration-200"
            :style="{
              height: isZoomed ? 'auto' : `${slipHeight * currentScale}px`,
              minWidth: isZoomed ? '520px' : 'auto'
            }"
          >
            <div
              ref="slipRef"
              id="prescription-slip-printable"
              class="flex flex-col justify-between w-[520px] shrink-0 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-md transition-transform duration-200 sm:p-7"
              :style="{
                transform: `scale(${currentScale})`,
                transformOrigin: 'top center',
                minHeight: '660px'
              }"
            >
              <!-- Upper Content: Header, Patient Details, Diagnosis, Prescription, Education -->
              <div class="space-y-3">
                <!-- 1. Header: Clinic Logo (Left) | Clinic Details & PTR (Right) -->
              <div
                class="mb-3 flex items-start justify-between gap-4 border-b-2 border-indigo-600 pb-3"
              >
                <div class="shrink-0">
                  <img
                    :src="prescriptionData.logoUrl || '/DA_Logo.jpg'"
                    alt="Clinic Logo"
                    class="h-11 w-auto max-w-[110px] object-contain"
                  />
                </div>

                <div class="min-w-0 flex-1 text-right">
                  <h4 class="text-xs sm:text-sm font-extrabold tracking-tight text-indigo-950 uppercase">
                    {{ prescriptionData.clinicName || 'DermAssist Clinical Dermatology' }}
                  </h4>
                  <p class="mt-0.5 text-[10px] leading-tight text-gray-500">
                    {{ prescriptionData.clinicAddress }}
                  </p>
                  <p
                    v-if="prescriptionData.clinicPhone || prescriptionData.clinicEmail"
                    class="mt-0.5 text-[9px] text-gray-400"
                  >
                    <span v-if="prescriptionData.clinicPhone"
                      >Phone: {{ prescriptionData.clinicPhone }}</span
                    >
                    <span v-if="prescriptionData.clinicPhone && prescriptionData.clinicEmail">
                      &bull;
                    </span>
                    <span v-if="prescriptionData.clinicEmail">{{
                      prescriptionData.clinicEmail
                    }}</span>
                  </p>
                  <div class="mt-1 text-[10px] font-bold text-indigo-700">
                    PTR No.:
                    <span class="text-gray-900">{{
                      prescriptionData.ptrNumber || 'N/A'
                    }}</span>
                  </div>
                </div>
              </div>

              <!-- 2. Patient Details -->
              <div class="mb-3">
                <div class="mb-1 text-[10px] font-bold tracking-wider text-indigo-700 uppercase">
                  Patient Details:
                </div>
                <div
                  class="rounded-xl border border-gray-100 bg-gray-50/80 p-2.5 text-xs text-gray-800"
                >
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <span class="text-[9px] font-bold tracking-wider text-gray-400 uppercase"
                        >Name:</span
                      >
                      <strong class="ml-1 text-gray-900">{{ prescriptionData.patientName }}</strong>
                    </div>
                    <div class="text-right">
                      <span class="text-[9px] font-bold tracking-wider text-gray-400 uppercase"
                        >Date of Diagnosis:</span
                      >
                      <strong class="ml-1 text-gray-900">{{ prescriptionData.dateFormatted }}</strong>
                    </div>
                  </div>
                  <div class="mt-1 grid grid-cols-2 gap-2 border-t border-gray-100 pt-1 text-[11px]">
                    <div>
                      <span class="text-[9px] font-bold tracking-wider text-gray-400 uppercase"
                        >Age / Sex:</span
                      >
                      <span class="ml-1 text-gray-700">{{ prescriptionData.patientAge || 'N/A' }} / {{ prescriptionData.patientSex || 'N/A' }}</span>
                    </div>
                    <div class="truncate text-right">
                      <span class="text-[9px] font-bold tracking-wider text-gray-400 uppercase"
                        >Address:</span
                      >
                      <span class="ml-1 text-gray-600">{{ prescriptionData.patientAddress }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 3. Diagnosis / Notes -->
              <div class="mb-3">
                <div class="mb-1 text-[10px] font-bold tracking-wider text-indigo-700 uppercase">
                  Diagnosis / Notes:
                </div>
                <div
                  class="rounded-r-lg border-l-3 border-indigo-600 bg-indigo-50/50 p-2.5 text-xs"
                >
                  <div class="font-bold text-indigo-950">
                    {{ prescriptionData.diagnosisResult || 'Clinical Dermatology Evaluation' }}
                  </div>
                  <p
                    v-if="prescriptionData.clinicalNotes"
                    class="mt-1 text-[11px] leading-relaxed text-gray-600"
                  >
                    {{ prescriptionData.clinicalNotes }}
                  </p>
                </div>
              </div>

              <!-- 4. Prescription: Header with Rx Logo & Rx Number -->
              <div class="mb-3">
                <div class="mb-1.5 flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <img
                      :src="prescriptionData.rxSymbolUrl || '/rx_symbol.jpg'"
                      alt="Rx"
                      class="h-5 w-auto select-none"
                      onerror="
                        this.style.display = 'none'
                        if (this.nextElementSibling)
                          this.nextElementSibling.style.display = 'inline-block'
                      "
                    />
                    <span
                      class="hidden font-serif text-lg leading-none font-extrabold text-indigo-700"
                    >
                      R<sub class="text-xs font-bold italic">x</sub>
                    </span>
                    <span class="text-[10px] font-bold tracking-wider text-indigo-700 uppercase">
                      Prescription:
                    </span>
                  </div>
                  <span
                    class="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-700"
                  >
                    {{ prescriptionData.prescriptionNumber }}
                  </span>
                </div>

                <!-- 4-Column Prescription Table -->
                <div class="overflow-hidden rounded-lg border border-gray-200">
                  <table class="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr class="border-b border-gray-200 bg-gray-50 text-[9px] font-bold tracking-wider text-gray-600 uppercase">
                        <th class="w-8 px-2 py-1.5 text-center">#</th>
                        <th class="px-2.5 py-1.5">Medicine &amp; Formulation</th>
                        <th class="w-24 px-2 py-1.5 text-center">Quantity</th>
                        <th class="px-2.5 py-1.5">Direction / Sig</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 text-[11px]">
                      <template v-if="prescriptionData.items && prescriptionData.items.length > 0">
                        <tr
                          v-for="(item, idx) in prescriptionData.items"
                          :key="idx"
                          class="hover:bg-gray-50/50"
                        >
                          <td class="px-2 py-2 text-center font-bold text-gray-400">
                            {{ idx + 1 }}
                          </td>
                          <td class="px-2.5 py-2 font-bold text-gray-900">
                            {{ item.medication }}
                          </td>
                          <td class="px-2 py-2 text-center font-mono font-bold text-indigo-700">
                            {{ item.quantity ? (item.quantity.startsWith('#') ? item.quantity : `#${item.quantity}`) : '—' }}
                          </td>
                          <td class="px-2.5 py-2 text-gray-700">
                            {{ item.instructions || 'As prescribed by physician' }}
                          </td>
                        </tr>
                      </template>
                      <tr v-else-if="prescriptionData.rawPrescription">
                        <td colspan="4" class="p-3 font-mono text-xs whitespace-pre-wrap text-gray-800">
                          {{ prescriptionData.rawPrescription }}
                        </td>
                      </tr>
                      <tr v-else>
                        <td colspan="4" class="py-6 text-center text-xs text-gray-400 italic">
                          No prescription medications drafted.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- 5. Patient Education & Instructions (if present) -->
              <div
                v-if="prescriptionData.patientEducation"
                class="mb-3"
              >
                <div class="mb-1 text-[10px] font-bold tracking-wider text-indigo-700 uppercase">
                  Patient Education &amp; Instructions:
                </div>
                <div
                  class="rounded-lg border border-gray-100 bg-gray-50/80 p-2.5 text-[11px] leading-relaxed text-gray-700"
                >
                  {{ prescriptionData.patientEducation }}
                </div>
              </div>
            </div>

            <!-- Bottom Pinned Section: Follow-Up, Signature & Footer -->
            <div class="mt-auto shrink-0 pt-4">
              <!-- 6. Follow-Up Consultation Schedule (if present) -->
              <div
                v-if="prescriptionData.followUpDateFormatted"
                class="mb-3"
              >
                <div class="mb-1 text-[10px] font-bold tracking-wider text-emerald-700 uppercase">
                  Follow-Up Consultation Schedule:
                </div>
                <div
                  class="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 text-[11px] text-emerald-900"
                >
                  <strong>Scheduled Visit:</strong> {{ prescriptionData.followUpDateFormatted }}
                  <span v-if="prescriptionData.followUpInstructions">
                    &bull; {{ prescriptionData.followUpInstructions }}
                  </span>
                </div>
              </div>

              <!-- 7. Doctor Name & Signature (PRC removed for confidentiality) -->
              <div class="mt-5 border-t border-gray-100 pt-4">
                <div class="flex items-end justify-between">
                  <div class="max-w-[220px] text-[9px] text-gray-400">
                    <div>
                      Ref: #{{ prescriptionData.recordUuid?.slice(0, 8) }} &bull; Auth:
                      {{ prescriptionData.verificationHash }}
                    </div>
                    <div>Official Medical Prescription &bull; Valid Nationwide</div>
                  </div>

                  <!-- Signature Area -->
                  <div class="flex flex-col items-center text-center">
                    <div
                      v-if="prescriptionData.signatureUrl"
                      class="mb-1"
                    >
                      <img
                        :src="prescriptionData.signatureUrl"
                        alt="Doctor Signature"
                        class="h-9 w-auto max-w-[130px] object-contain"
                      />
                      <div class="w-36 border-b border-gray-900"></div>
                    </div>
                    <div
                      v-else
                      class="mb-1 h-7 w-36 border-b border-gray-900"
                    ></div>

                    <div class="text-xs font-bold text-gray-900">
                      Dr. {{ prescriptionData.doctorName || 'Attending Physician' }}
                    </div>
                    <div class="text-[9px] font-semibold text-indigo-700">
                      <span>PTR No.: {{ prescriptionData.ptrNumber || 'N/A' }}</span>
                      <span v-if="prescriptionData.s2Number">
                        &bull; S2: {{ prescriptionData.s2Number }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>

              <!-- 8. Footer: DermAssist Logo & Note -->
              <div
                class="mt-4 flex items-center justify-center gap-1.5 border-t border-gray-100 pt-2.5 text-[9px] text-gray-400"
              >
                <img
                  src="/DA_Logo.jpg"
                  alt="DermAssist"
                  class="h-3.5 w-auto object-contain"
                />
                <span>Powered by DermAssist</span>
              </div>
            </div>
          </div>
        </div>

          <div
            v-else
            class="py-12 text-center text-xs text-gray-400"
          >
            Unable to load prescription preview.
          </div>
        </div>

        <!-- Action Buttons Bar -->
        <div
          class="flex items-center justify-between border-t border-gray-100 bg-white px-4 py-3 sm:px-6 sm:py-4"
        >
          <span class="hidden text-xs text-gray-500 sm:inline">
            Print directly to office printer or download signed A5 PDF.
          </span>

          <div class="flex w-full items-center justify-end gap-2 sm:w-auto">
            <button
              type="button"
              @click="handleDirectPrint"
              class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 sm:flex-initial sm:px-4"
            >
              <Icon
                name="lucide:printer"
                class="text-sm text-gray-600"
              />
              <span>Print Now</span>
            </button>

            <button
              type="button"
              :disabled="isDownloadingPdf"
              @click="handleDownloadPdf"
              class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50 sm:flex-initial sm:px-5"
            >
              <Icon
                v-if="isDownloadingPdf"
                name="lucide:loader-2"
                class="animate-spin text-sm"
              />
              <Icon
                v-else
                name="lucide:download"
                class="text-sm"
              />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Doctor Signature & PTR Setup Sub-Modal -->
      <AppPrescriptionDoctorSignatureModal
        v-model="showCredentialsModal"
        :initial-ptr="prescriptionData?.ptrNumber"
        :initial-tin="prescriptionData?.tinNumber"
        :initial-s2="prescriptionData?.s2Number"
        :initial-signature-url="prescriptionData?.signatureUrl"
        @saved="handleCredentialsSaved"
      />
    </div>
  </Teleport>
</template>
