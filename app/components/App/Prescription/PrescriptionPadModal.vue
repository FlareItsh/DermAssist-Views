<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
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
        fetchPrescriptionData()
      }
    },
    { immediate: true }
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
              margin: 10mm;
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
              font-size: 11px;
              line-height: 1.4;
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
          class="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-6 py-3.5"
        >
          <div class="flex items-center gap-2">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
            >
              <Icon
                name="material-symbols:prescriptions-outline-rounded"
                class="text-lg"
              />
            </div>
            <div>
              <h3 class="text-sm font-bold text-gray-900">
                Official Medical Prescription (Rx Pad)
              </h3>
              <p class="text-[11px] text-gray-500">
                Standard Philippine FDA & Generics Act Compliant
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="allowEditCredentials"
              type="button"
              @click="showCredentialsModal = true"
              class="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50"
            >
              <Icon
                name="lucide:pen-tool"
                class="text-xs text-indigo-600"
              />
              <span>Doctor Signature & PTR</span>
            </button>
            <button
              type="button"
              @click="emit('update:modelValue', false)"
              class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <Icon
                name="lucide:x"
                class="text-base"
              />
            </button>
          </div>
        </div>

        <!-- Preview Body (A5 Prescription Slip Layout) -->
        <div class="flex-1 overflow-y-auto bg-gray-100/60 p-4 sm:p-6">
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

          <div
            v-else-if="prescriptionData"
            id="prescription-slip-printable"
            class="mx-auto flex w-full max-w-lg flex-col justify-between rounded-2xl border border-gray-200/80 bg-white p-6 shadow-md sm:p-8"
            style="min-height: 520px"
          >
            <!-- 1. Header -->
            <div>
              <div
                class="mb-3 flex items-start justify-between gap-3 border-b-2 border-indigo-600 pb-3"
              >
                <div class="flex flex-col">
                  <img
                    v-if="prescriptionData.logoUrl"
                    :src="prescriptionData.logoUrl"
                    alt="Clinic Logo"
                    class="mb-1.5 h-9 w-auto max-w-[130px] object-contain"
                  />
                  <h4 class="text-sm font-extrabold tracking-tight text-indigo-950 uppercase">
                    {{ prescriptionData.clinicName || 'DermAssist Clinical Dermatology' }}
                  </h4>
                  <p class="text-[10px] leading-tight text-gray-500">
                    {{ prescriptionData.clinicAddress }}
                  </p>
                  <p
                    v-if="prescriptionData.clinicPhone || prescriptionData.clinicEmail"
                    class="mt-0.5 text-[9px] text-gray-400"
                  >
                    <span v-if="prescriptionData.clinicPhone"
                      >Tel: {{ prescriptionData.clinicPhone }}</span
                    >
                    <span v-if="prescriptionData.clinicPhone && prescriptionData.clinicEmail">
                      &bull;
                    </span>
                    <span v-if="prescriptionData.clinicEmail">{{
                      prescriptionData.clinicEmail
                    }}</span>
                  </p>
                </div>

                <div class="shrink-0 text-right">
                  <div class="text-xs font-extrabold text-gray-900">
                    Dr. {{ prescriptionData.doctorName || 'Attending Physician' }}
                  </div>
                  <div class="text-[10px] font-semibold text-indigo-600">
                    {{ prescriptionData.doctorAffiliation || 'Dermatology & Cutaneous Care' }}
                  </div>
                  <div class="mt-1 space-y-0.5 text-[9px] text-gray-500">
                    <div>
                      PRC No.:
                      <strong class="text-gray-800">{{
                        prescriptionData.prcNumber || 'N/A'
                      }}</strong>
                    </div>
                    <div>
                      PTR No.:
                      <strong class="text-gray-800">{{
                        prescriptionData.ptrNumber || 'N/A'
                      }}</strong>
                    </div>
                    <div v-if="prescriptionData.s2Number">
                      S2 No.: <strong class="text-gray-800">{{ prescriptionData.s2Number }}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 2. Patient Demographics Block -->
              <div
                class="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-gray-100 bg-gray-50/80 p-2.5 text-xs"
              >
                <div class="col-span-2">
                  <span class="block text-[9px] font-bold tracking-wider text-gray-400 uppercase"
                    >Patient</span
                  >
                  <span class="font-bold text-gray-900">{{ prescriptionData.patientName }}</span>
                  <span class="block truncate text-[10px] text-gray-500">{{
                    prescriptionData.patientAddress
                  }}</span>
                </div>
                <div class="text-right">
                  <span class="block text-[9px] font-bold tracking-wider text-gray-400 uppercase"
                    >Date</span
                  >
                  <span class="font-bold text-gray-900">{{ prescriptionData.dateFormatted }}</span>
                  <span class="block text-[9px] font-semibold text-indigo-600">{{
                    prescriptionData.prescriptionNumber
                  }}</span>
                </div>
              </div>

              <!-- 3. Superscription & Medication Orders -->
              <div class="py-2">
                <div class="mb-3 flex items-center select-none">
                  <img
                    :src="prescriptionData.rxSymbolUrl || '/rx_symbol.jpg'"
                    alt="Rx"
                    class="inline-block h-6 w-auto select-none"
                    onerror="
                      this.style.display = 'none'
                      if (this.nextElementSibling)
                        this.nextElementSibling.style.display = 'inline-block'
                    "
                  />
                  <span
                    class="hidden font-serif text-2xl leading-none font-extrabold text-indigo-700"
                  >
                    R<sub class="text-base font-bold italic">x</sub>
                  </span>
                </div>

                <!-- Structured Items -->
                <div
                  v-if="prescriptionData.items && prescriptionData.items.length > 0"
                  class="space-y-3"
                >
                  <div
                    v-for="(item, idx) in prescriptionData.items"
                    :key="idx"
                    class="border-b border-dashed border-gray-100 pb-2.5 last:border-b-0"
                  >
                    <div class="flex items-baseline justify-between gap-3">
                      <div class="text-xs font-bold text-gray-900">
                        {{ idx + 1 }}. {{ item.medication }}
                      </div>
                      <div
                        v-if="item.quantity"
                        class="shrink-0 font-mono text-xs font-extrabold tracking-wide text-indigo-800"
                      >
                        {{ item.quantity.startsWith('#') ? item.quantity : `#${item.quantity}` }}
                      </div>
                    </div>
                    <div
                      v-if="item.instructions"
                      class="mt-0.5 ml-4 text-[11px] text-gray-700"
                    >
                      <span class="font-bold text-gray-900">Sig:</span> {{ item.instructions }}
                    </div>
                  </div>
                </div>

                <!-- Raw Text Fallback -->
                <div
                  v-else-if="prescriptionData.rawPrescription"
                  class="font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-800"
                >
                  {{ prescriptionData.rawPrescription }}
                </div>

                <!-- Empty Notice -->
                <div
                  v-else
                  class="py-6 text-center text-xs text-gray-400 italic"
                >
                  No prescription medications drafted.
                </div>
              </div>
            </div>

            <!-- 4. Footer & Signature -->
            <div class="mt-6 border-t border-gray-100 pt-6">
              <div class="flex items-end justify-between">
                <div class="max-w-[240px] text-[9px] text-gray-400">
                  <div>
                    Ref: #{{ prescriptionData.recordUuid?.slice(0, 8) }} &bull; Auth:
                    {{ prescriptionData.verificationHash }}
                  </div>
                  <div>Issued pursuant to Philippine FDA Circular No. 2020-007</div>
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
                      class="h-10 w-auto max-w-[140px] object-contain"
                    />
                    <div class="w-36 border-b border-gray-900"></div>
                  </div>
                  <div
                    v-else
                    class="mb-1 h-8 w-36 border-b border-gray-900"
                  ></div>

                  <div class="text-xs font-bold text-gray-900">
                    Dr. {{ prescriptionData.doctorName || 'Attending Physician' }}
                  </div>
                  <div class="text-[9px] text-gray-500">
                    <span>PRC: {{ prescriptionData.prcNumber || 'N/A' }}</span>
                    <span v-if="prescriptionData.ptrNumber">
                      &bull; PTR: {{ prescriptionData.ptrNumber }}</span
                    >
                  </div>
                </div>
              </div>

              <!-- Disclaimer -->
              <div
                class="mt-4 border-t border-gray-100 pt-2 text-center text-[8px] tracking-wider text-gray-400 uppercase"
              >
                Official Medical Prescription &bull; Valid in Licensed Pharmacies Nationwide &bull;
                No Refills Without Re-evaluation
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
        <div class="flex items-center justify-between border-t border-gray-100 bg-white px-6 py-4">
          <span class="text-xs text-gray-500">
            Print directly to office printer or download signed A5 PDF.
          </span>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="handleDirectPrint"
              class="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50"
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
              class="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50"
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
