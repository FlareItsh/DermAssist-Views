<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { clinicalNoteService, type ClinicalNote } from '~/api/clinicalNote/ClinicalNoteService'

  const props = defineProps<{
    appointmentUuid?: string
    diagnosisId?: number | null
    skipLoad?: boolean
  }>()

  const note = ref<ClinicalNote>({
    history_of_present_illness: '',
    systemic_symptoms: '',
    physical_exam: '',
    differential_diagnosis: '',
    final_diagnosis: '',
    prescription: '',
    patient_education: '',
    follow_up_date: '',
    follow_up_instructions: ''
  })

  const isSaving = ref(false)
  const isLoaded = ref(false)
  const showSuccess = ref(false)

  onMounted(async () => {
    if (props.skipLoad) {
      isLoaded.value = true
      return
    }

    try {
      if (props.appointmentUuid) {
        const existing = await clinicalNoteService.getByAppointment(props.appointmentUuid)
        if (existing) {
          note.value = { ...note.value, ...existing }
        }
      }
    } catch (e) {
      console.error('Failed to load clinical note', e)
    } finally {
      isLoaded.value = true
    }
  })

  const saveNote = async () => {
    isSaving.value = true
    showSuccess.value = false
    try {
      if (props.diagnosisId) {
        note.value.diagnosis_id = props.diagnosisId
      }
      
      if (props.appointmentUuid) {
        const saved = await clinicalNoteService.save(props.appointmentUuid, note.value)
        note.value = { ...note.value, ...saved }
      }
      
      showSuccess.value = true
      setTimeout(() => {
        showSuccess.value = false
      }, 3000)
    } catch (e) {
      console.error('Failed to save clinical note', e)
      alert('Failed to save clinical note. Please try again.')
    } finally {
      isSaving.value = false
    }
  }
</script>

<template>
  <div v-if="!isLoaded" class="flex items-center justify-center py-20">
    <Icon name="svg-spinners:180-ring-with-bg" class="text-6xl text-primary opacity-50" />
  </div>
  <div v-else class="space-y-10 rounded-[2.5rem] bg-white/70 backdrop-blur-xl border border-white/50 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-10 relative overflow-hidden">
    <!-- Decorative background elements -->
    <div class="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
    
    <div class="flex items-center justify-between border-b border-gray-100/50 pb-6 relative z-10">
      <div class="flex items-center gap-4">
        <div class="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center">
           <Icon name="material-symbols:edit-document-outline-rounded" class="text-primary text-2xl" />
        </div>
        <div>
          <h2 class="text-2xl font-black text-gray-900 tracking-tight">Clinical SOAP Note</h2>
          <p class="text-sm font-medium text-gray-500 mt-0.5">Official medical documentation and assessment.</p>
        </div>
      </div>
      <AppButton :loading="isSaving" @click="saveNote" :class="[showSuccess ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20' : 'bg-primary hover:bg-primary/90 shadow-primary/20', 'text-white font-bold px-8 py-3 rounded-2xl shadow-lg transition-all hover:shadow-xl active:scale-95 flex items-center gap-2']">
        <Icon v-if="showSuccess" name="material-symbols:check-circle-rounded" class="text-xl" />
        <Icon v-else-if="!isSaving" name="material-symbols:save-outline-rounded" class="text-xl" />
        {{ showSuccess ? 'Saved!' : (isSaving ? 'Saving...' : 'Save Note') }}
      </AppButton>
    </div>

    <div class="space-y-10 relative z-10">
      <!-- Subjective -->
      <section class="group">
        <h3 class="mb-5 flex items-center gap-3 text-xl font-bold text-gray-900">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-600 shadow-sm border border-indigo-100">S</span>
          Subjective
        </h3>
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">History of Present Illness</label>
            <textarea
              v-model="note.history_of_present_illness"
              rows="3"
              placeholder="Duration, symptoms, triggers..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all outline-none resize-none"
            ></textarea>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Systemic Symptoms</label>
            <textarea
              v-model="note.systemic_symptoms"
              rows="3"
              placeholder="Fever, fatigue, other affected areas..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all outline-none resize-none"
            ></textarea>
          </div>
        </div>
      </section>

      <!-- Objective -->
      <section class="group">
        <h3 class="mb-5 flex items-center gap-3 text-xl font-bold text-gray-900">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-600 shadow-sm border border-blue-100">O</span>
          Objective
        </h3>
        <div class="flex flex-col gap-2">
          <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Physical Exam Findings</label>
          <textarea
            v-model="note.physical_exam"
            rows="3"
            placeholder="Visual inspection details, lesion description..."
            class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-all outline-none resize-none"
          ></textarea>
        </div>
      </section>

      <!-- Assessment -->
      <section class="group">
        <h3 class="mb-5 flex items-center gap-3 text-xl font-bold text-gray-900">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-sm font-black text-emerald-600 shadow-sm border border-emerald-100">A</span>
          Assessment
        </h3>
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Differential Diagnosis</label>
            <textarea
              v-model="note.differential_diagnosis"
              rows="2"
              placeholder="Alternative possible diagnoses..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-emerald-500 transition-all outline-none resize-none"
            ></textarea>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Final Diagnosis</label>
            <input
              type="text"
              v-model="note.final_diagnosis"
              placeholder="Primary diagnosis..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-emerald-500 transition-all outline-none"
            />
          </div>
        </div>
      </section>

      <!-- Plan -->
      <section class="group">
        <h3 class="mb-5 flex items-center gap-3 text-xl font-bold text-gray-900">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-sm font-black text-amber-600 shadow-sm border border-amber-100">P</span>
          Plan
        </h3>
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Prescriptions</label>
            <textarea
              v-model="note.prescription"
              rows="4"
              placeholder="Medication name, dosage, frequency, duration..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-amber-500 transition-all outline-none resize-none"
            ></textarea>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Patient Education & Instructions</label>
            <textarea
              v-model="note.patient_education"
              rows="4"
              placeholder="Skin care routines, triggers to avoid..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-amber-500 transition-all outline-none resize-none"
            ></textarea>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Follow-up Date</label>
            <div class="relative">
              <input
                type="datetime-local"
                v-model="note.follow_up_date"
                class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-amber-500 transition-all outline-none"
              />
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Follow-up Instructions</label>
            <input
              type="text"
              v-model="note.follow_up_instructions"
              placeholder="When to return, what to monitor..."
              class="w-full rounded-2xl border-0 bg-gray-50/50 p-4 text-gray-800 shadow-inner ring-1 ring-inset ring-gray-200/50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-amber-500 transition-all outline-none"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
