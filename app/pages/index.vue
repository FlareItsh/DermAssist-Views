<template>
  <div class="flex flex-col">
    <!-- Home Section (Occupied entirely by live canvas fluid animation) -->
    <LandingPageHeroFluidCanvas />

    <div
      class="mt-12 mb-20 flex flex-col justify-center gap-16 px-5 sm:px-8 md:mt-24 md:gap-28 md:px-12 lg:px-16"
    >
      <!-- Features Pitch Section -->
      <section class="mx-auto w-full max-w-7xl">
        <div class="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
          <!-- Left: Coded Accuracy Test Card (converted from accuracy-test.png) -->
          <div class="mx-auto w-full max-w-md lg:col-span-5">
            <div
              class="relative overflow-hidden rounded-[28px] border border-blue-500/20 bg-gradient-to-br from-[#1E5AF3] via-[#164CCC] to-[#0B3BB8] p-6 text-white shadow-xl shadow-blue-600/15 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-600/25 sm:p-7"
            >
              <!-- Ambient background glow -->
              <div
                class="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/10 blur-2xl"
              ></div>

              <!-- Header: Target Icon + Title + Date/Model info -->
              <div class="relative z-10 flex items-center gap-4">
                <div
                  class="flex size-14 shrink-0 items-center justify-center rounded-full bg-white text-[#1E5AF3] shadow-md shadow-black/10"
                >
                  <svg
                    class="size-8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="5"
                    />
                    <path d="m9.5 12 1.8 1.8 3.5-3.6" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-xl font-bold tracking-tight text-white sm:text-2xl">
                    Accuracy Test
                  </h3>
                  <p class="text-xs font-medium text-white/80 sm:text-sm">
                    Continuously Validated Model
                  </p>
                </div>
              </div>

              <!-- Diagnostic Waveform Sparkline -->
              <div class="relative z-10 my-6 h-28 w-full">
                <svg
                  class="h-full w-full overflow-visible"
                  viewBox="0 0 320 90"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient
                      id="sparklineFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stop-color="#ffffff"
                        stop-opacity="0.3"
                      />
                      <stop
                        offset="100%"
                        stop-color="#ffffff"
                        stop-opacity="0.0"
                      />
                    </linearGradient>
                  </defs>
                  <!-- Baseline and pulse line matching original visual -->
                  <path
                    d="M0,55 L80,55 L105,35 L135,78 L185,15 L225,50 L255,50 L275,68 L320,20"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="3.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <!-- Gradient area fill -->
                  <path
                    d="M0,55 L80,55 L105,35 L135,78 L185,15 L225,50 L255,50 L275,68 L320,20 L320,90 L0,90 Z"
                    fill="url(#sparklineFill)"
                  />
                  <!-- Live telemetry point at the end -->
                  <circle
                    cx="320"
                    cy="20"
                    r="5"
                    fill="#ffffff"
                    class="animate-ping opacity-75"
                  />
                  <circle
                    cx="320"
                    cy="20"
                    r="4"
                    fill="#ffffff"
                  />
                </svg>
              </div>

              <!-- Bottom White Metric Card -->
              <div
                class="relative z-10 rounded-2xl border border-white/20 bg-white/95 p-5 text-gray-900 shadow-sm backdrop-blur-sm"
              >
                <div class="flex items-baseline justify-between">
                  <span class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl"
                    >75.5%</span
                  >
                  <span
                    class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                  >
                    Clinical Agreement
                  </span>
                </div>
                <p class="mt-2 text-xs leading-relaxed font-medium text-gray-600 sm:text-sm">
                  Continuously improving through real-world dermatology data.
                </p>
              </div>
            </div>
          </div>

          <!-- Right: Features Pitch Content -->
          <div class="flex flex-col justify-center lg:col-span-7">
            <span
              class="bg-primary/10 text-primary inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wider uppercase"
            >
              <Icon
                name="lucide:sparkles"
                class="size-3.5"
              />
              Physician-Validated AI
            </span>
            <h2
              class="text-foreground mt-4 text-2xl leading-snug font-bold tracking-tight sm:text-3xl md:text-4xl"
            >
              With DermAssist, you benefit from AI-powered analysis backed by real doctors.
            </h2>
            <p class="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
              Our system helps detect skin concerns quickly and accurately, while giving you the
              option to consult certified dermatologists for personalized medical guidance.
            </p>

            <div class="bg-primary/20 my-6 h-1 w-28 rounded-full sm:my-8 sm:w-36"></div>

            <div class="flex flex-wrap items-center gap-4">
              <AppButton
                to="#about"
                variant="solid"
                rounded="full"
                class="bg-foreground text-background hover:bg-foreground/90 px-6 py-3 text-sm font-medium shadow-sm transition sm:px-8 sm:text-base"
              >
                Know More
                <Icon
                  name="lucide:arrow-down"
                  class="ml-2 size-4"
                />
              </AppButton>
              <AppButton
                to="#features"
                variant="outline"
                rounded="full"
                class="border-border text-foreground hover:bg-muted px-6 py-3 text-sm font-medium transition sm:px-8 sm:text-base"
              >
                Explore Services
              </AppButton>
            </div>
          </div>
        </div>
      </section>

      <!-- About Section -->
      <section
        id="about"
        class="mx-auto w-full max-w-7xl scroll-mt-24 md:scroll-mt-28"
      >
        <!-- Section Header -->
        <div class="mb-10 flex flex-col items-center justify-center text-center md:mb-14">
          <span
            class="bg-primary/10 text-primary rounded-full px-3.5 py-1 text-xs font-semibold tracking-widest uppercase"
          >
            About Us
          </span>
          <h2
            class="text-foreground mt-2 text-2xl font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            About DermAssist
          </h2>
        </div>

        <!-- Coded Feature Showcase Container (converted from about-us-img.png) -->
        <div
          class="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1E5AF3] via-[#1646CA] to-[#0D36A8] p-6 text-white shadow-xl shadow-blue-500/10 sm:p-10 md:rounded-[40px] md:p-14 lg:p-16"
        >
          <!-- Subtle radial background ambient glow -->
          <div
            class="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
          ></div>
          <div
            class="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl"
          ></div>

          <div class="relative z-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
            <!-- Left: Headline, Statement & Trust Badges -->
            <div class="flex flex-col space-y-6 lg:col-span-7">
              <h3
                class="text-3xl leading-tight font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl"
              >
                Smarter Skin Care, <br class="hidden sm:inline" />Made Accessible
              </h3>

              <p class="text-base leading-relaxed font-normal text-white/90 sm:text-lg">
                <strong class="font-bold text-white">DermAssist</strong> combines advanced AI
                technology with real medical expertise to help people understand and care for their
                skin. Our platform provides fast, accurate skin analysis, and connects you with
                licensed dermatologists for personalized guidance. We believe everyone deserves
                accessible, reliable, and secure skin health support, anytime, anywhere.
              </p>

              <!-- 3 Trust Badges -->
              <div class="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
                <div class="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
                  <div class="flex items-center gap-2">
                    <Icon
                      name="lucide:scan-face"
                      class="size-5 shrink-0 text-blue-200"
                    />
                    <span class="text-xs font-semibold text-white">Instant AI Triage</span>
                  </div>
                  <p class="mt-1 text-[11px] leading-tight text-white/75">
                    Fast condition recognition under 5 seconds.
                  </p>
                </div>

                <div class="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
                  <div class="flex items-center gap-2">
                    <Icon
                      name="lucide:stethoscope"
                      class="size-5 shrink-0 text-blue-200"
                    />
                    <span class="text-xs font-semibold text-white">Licensed Doctors</span>
                  </div>
                  <p class="mt-1 text-[11px] leading-tight text-white/75">
                    Teleconsultations with certified dermatologists.
                  </p>
                </div>

                <div class="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
                  <div class="flex items-center gap-2">
                    <Icon
                      name="lucide:shield-check"
                      class="size-5 shrink-0 text-blue-200"
                    />
                    <span class="text-xs font-semibold text-white">Private & Secure</span>
                  </div>
                  <p class="mt-1 text-[11px] leading-tight text-white/75">
                    HIPAA & DPA compliant data encryption.
                  </p>
                </div>
              </div>
            </div>

            <!-- Right: Clinical Photos in Coded Responsive Layout -->
            <div
              class="flex flex-col items-center justify-center gap-4 sm:flex-row lg:col-span-5 lg:flex-col"
            >
              <!-- Top Photo: Dermoscopic analysis device -->
              <div
                class="group relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/20 bg-black/20 shadow-lg"
              >
                <NuxtImg
                  src="/images/about-clinical-1.png"
                  class="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-48"
                  alt="Clinical Dermoscopic Device Examination"
                />
                <div
                  class="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-md"
                >
                  <span class="size-2 animate-pulse rounded-full bg-emerald-400"></span>
                  High-Res Dermoscopy Analysis
                </div>
              </div>

              <!-- Bottom Photo: Dermatologist examination -->
              <div
                class="group relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/20 bg-black/20 shadow-lg lg:ml-8"
              >
                <NuxtImg
                  src="/images/about-clinical-2.png"
                  class="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-48"
                  alt="Dermatologist Clinical Consultation"
                />
                <div
                  class="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-md"
                >
                  <Icon
                    name="lucide:user-check"
                    class="size-3.5 text-blue-300"
                  />
                  Doctor-in-the-Loop Triaging
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Features Section -->
      <section
        id="features"
        class="mx-auto w-full max-w-7xl scroll-mt-24 md:scroll-mt-28"
      >
        <div class="mb-10 flex flex-col items-center justify-center text-center md:mb-14">
          <span
            class="bg-primary/10 text-primary rounded-full px-3.5 py-1 text-xs font-semibold tracking-widest uppercase"
          >
            Features
          </span>
          <h2
            class="text-foreground mt-2 text-2xl font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            Our Features & Services
          </h2>
          <p class="text-muted-foreground mt-3 max-w-2xl text-sm sm:text-base">
            An intuitive, clinically designed 3-step workflow connecting advanced machine learning
            with board-certified dermatological care.
          </p>
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
          <div
            v-for="(feature, index) in features"
            :key="feature.title"
            class="group bg-card border-border/60 relative flex flex-col justify-between rounded-3xl border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl sm:p-8"
          >
            <div>
              <!-- Top bar with step number pill and category -->
              <div class="flex items-center justify-between">
                <span
                  class="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-bold tracking-wider"
                >
                  STEP 0{{ index + 1 }}
                </span>
                <span class="text-muted-foreground text-xs font-medium">
                  {{ index === 0 ? 'Capture' : index === 1 ? 'Analyze' : 'Consult' }}
                </span>
              </div>

              <!-- Feature Icon -->
              <div
                class="bg-primary/10 text-primary group-hover:bg-primary my-6 flex size-16 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-105 group-hover:text-white sm:size-20"
              >
                <div
                  v-if="feature.icon.startsWith('<svg')"
                  v-html="feature.icon"
                  class="flex size-8 items-center justify-center sm:size-10 [&>svg]:size-full"
                ></div>
                <Icon
                  v-else
                  :name="feature.icon"
                  class="size-8 sm:size-10"
                />
              </div>

              <!-- Title & Description -->
              <h3 class="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                {{ feature.title }}
              </h3>
              <p class="text-muted-foreground mt-3 text-sm leading-relaxed sm:text-base">
                {{ feature.description }}
              </p>
            </div>

            <div class="border-border/60 mt-6 border-t pt-4">
              <span
                class="text-primary group-hover:text-primary/80 inline-flex items-center text-xs font-semibold transition"
              >
                Learn More
                <Icon
                  name="lucide:chevron-right"
                  class="ml-1 size-3.5 transition-transform group-hover:translate-x-1"
                />
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Contact Section -->
      <section
        id="contact"
        class="mx-auto w-full max-w-7xl scroll-mt-24 md:scroll-mt-28"
      >
        <div class="mb-10 flex flex-col items-center justify-center text-center md:mb-14">
          <span
            class="bg-primary/10 text-primary rounded-full px-3.5 py-1 text-xs font-semibold tracking-widest uppercase"
          >
            Contact Us
          </span>
          <h2
            class="text-foreground mt-2 text-2xl font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            Contact for Reports & Feedback
          </h2>
          <p class="text-muted-foreground mt-3 max-w-xl text-sm sm:text-base">
            Have questions about clinical scans, feedback, or need dedicated support? We're here to
            assist.
          </p>
        </div>

        <div class="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
          <!-- Left: Contact Form -->
          <div
            class="bg-card border-border/60 flex flex-col justify-between rounded-3xl border p-6 shadow-sm sm:p-10 lg:col-span-7"
          >
            <div>
              <h3 class="text-foreground text-2xl font-bold tracking-tight">Get in Touch</h3>
              <p class="text-muted-foreground mt-1 text-sm">
                Fill out the form below and our medical administration team will respond within 24
                hours.
              </p>

              <form
                @submit.prevent="handleSubmitContact"
                class="mt-6 flex flex-col gap-4"
              >
                <div>
                  <label
                    for="contact-name"
                    class="text-foreground mb-1.5 block text-xs font-semibold sm:text-sm"
                  >
                    Your Name
                  </label>
                  <input
                    id="contact-name"
                    v-model="contactForm.name"
                    type="text"
                    required
                    placeholder="e.g. Maria Santos"
                    class="border-input bg-background focus:border-primary focus:ring-primary/20 h-11 w-full rounded-xl border px-4 text-sm transition outline-none focus:ring-2"
                  />
                </div>

                <div>
                  <label
                    for="contact-email"
                    class="text-foreground mb-1.5 block text-xs font-semibold sm:text-sm"
                  >
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    v-model="contactForm.email"
                    type="email"
                    required
                    placeholder="maria@example.com"
                    class="border-input bg-background focus:border-primary focus:ring-primary/20 h-11 w-full rounded-xl border px-4 text-sm transition outline-none focus:ring-2"
                  />
                </div>

                <div>
                  <label
                    for="contact-message"
                    class="text-foreground mb-1.5 block text-xs font-semibold sm:text-sm"
                  >
                    Message or Inquiry
                  </label>
                  <textarea
                    id="contact-message"
                    v-model="contactForm.message"
                    rows="4"
                    required
                    placeholder="Describe your inquiry, report details, or question..."
                    class="border-input bg-background focus:border-primary focus:ring-primary/20 w-full resize-none rounded-xl border p-4 text-sm transition outline-none focus:ring-2"
                  ></textarea>
                </div>

                <div class="mt-2 flex items-center gap-2.5">
                  <input
                    id="contact-terms"
                    v-model="contactForm.agreed"
                    type="checkbox"
                    required
                    class="accent-primary size-4 cursor-pointer rounded"
                  />
                  <label
                    for="contact-terms"
                    class="text-muted-foreground cursor-pointer text-xs leading-normal select-none sm:text-sm"
                  >
                    I agree to the terms and privacy conditions regarding medical inquiry handling.
                  </label>
                </div>

                <div class="mt-3">
                  <AppButton
                    type="submit"
                    variant="solid"
                    rounded="full"
                    :loading="isSubmitting"
                    class="bg-primary hover:bg-primary/90 text-primary-foreground w-full py-3 text-sm font-semibold shadow-md transition sm:w-auto sm:px-8"
                  >
                    Send Message
                    <Icon
                      name="lucide:send"
                      class="ml-2 size-4"
                    />
                  </AppButton>
                </div>
              </form>
            </div>
          </div>

          <!-- Right: Live Contact & Support Hub (converted from contact-us-img.png) -->
          <div
            class="bg-card border-border/60 flex flex-col overflow-hidden rounded-3xl border shadow-sm lg:col-span-5"
          >
            <!-- Top Doctor Workspace Photo Header -->
            <div class="relative h-52 w-full overflow-hidden bg-black sm:h-60">
              <NuxtImg
                src="/images/contact-doctor.png"
                class="h-full w-full object-cover"
                alt="Doctor Teleconsultation Desk"
              />
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
              ></div>
              <div class="absolute right-4 bottom-4 left-4 flex items-center justify-between">
                <div>
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md"
                  >
                    <span class="size-2 animate-pulse rounded-full bg-emerald-400"></span>
                    Support Center Active
                  </span>
                  <p class="mt-1 text-xs font-medium text-white/80">
                    Clinical Assistance & Inquiry Desk
                  </p>
                </div>
              </div>
            </div>

            <!-- Bottom Contact Channels in Pure Code -->
            <div class="flex flex-1 flex-col justify-between p-6 sm:p-8">
              <div class="space-y-4">
                <!-- Email Channel -->
                <a
                  href="mailto:DermAssist@gmail.com"
                  class="group border-border/60 hover:border-primary/40 hover:bg-muted/40 flex items-center gap-4 rounded-2xl border p-4 transition-all"
                >
                  <div
                    class="bg-primary/10 text-primary group-hover:bg-primary flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors group-hover:text-white"
                  >
                    <Icon
                      name="lucide:mail"
                      class="size-6"
                    />
                  </div>
                  <div>
                    <p class="text-muted-foreground text-xs font-medium">Direct Email</p>
                    <p class="text-foreground text-sm font-bold sm:text-base">
                      DermAssist@gmail.com
                    </p>
                  </div>
                  <Icon
                    name="lucide:arrow-up-right"
                    class="text-muted-foreground group-hover:text-primary ml-auto size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </a>

                <!-- Phone Channel -->
                <a
                  href="tel:+6321234567"
                  class="group border-border/60 hover:border-primary/40 hover:bg-muted/40 flex items-center gap-4 rounded-2xl border p-4 transition-all"
                >
                  <div
                    class="bg-primary/10 text-primary group-hover:bg-primary flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors group-hover:text-white"
                  >
                    <Icon
                      name="lucide:phone"
                      class="size-6"
                    />
                  </div>
                  <div>
                    <p class="text-muted-foreground text-xs font-medium">Hotline Support</p>
                    <p class="text-foreground text-sm font-bold sm:text-base">(02) 123 4567</p>
                  </div>
                  <Icon
                    name="lucide:arrow-up-right"
                    class="text-muted-foreground group-hover:text-primary ml-auto size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </a>

                <!-- Clinic Hours -->
                <div class="border-border/60 flex items-center gap-4 rounded-2xl border p-4">
                  <div
                    class="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl"
                  >
                    <Icon
                      name="lucide:clock"
                      class="size-6"
                    />
                  </div>
                  <div>
                    <p class="text-muted-foreground text-xs font-medium">Consultation Hours</p>
                    <p class="text-foreground text-sm font-semibold">
                      Mon – Fri: 8:00 AM – 6:00 PM (PHT)
                    </p>
                  </div>
                </div>
              </div>

              <!-- Urgent notice -->
              <div
                class="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200"
              >
                <div class="flex items-start gap-2">
                  <Icon
                    name="lucide:alert-circle"
                    class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                  />
                  <p class="leading-relaxed">
                    <strong>Medical Note:</strong> For sudden acute symptoms, severe infections, or
                    bleeding, please visit your nearest hospital emergency department immediately.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'landing-page'
  })

  // Contact form reactive state
  const contactForm = ref({
    name: '',
    email: '',
    message: '',
    agreed: false
  })

  const isSubmitting = ref(false)

  const handleSubmitContact = async () => {
    if (!contactForm.value.agreed) {
      toast.error('Please accept the privacy terms before submitting.')
      return
    }

    isSubmitting.value = true

    // Simulate clean submission with UX feedback
    setTimeout(() => {
      isSubmitting.value = false
      toast.success('Thank you! Your message has been sent to our medical care team.')
      contactForm.value = {
        name: '',
        email: '',
        message: '',
        agreed: false
      }
    }, 700)
  }

  // The dynamic feature services array
  const features = [
    {
      title: 'Scan Your Skin',
      description:
        'Take a clear photo of your skin concern using your smartphone or webcam. Our AI instantly segments and evaluates lesion boundaries. Fast, private, and frictionless.',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><defs><mask id="SVGzmt0MemV"><g fill="none" stroke="#fff" stroke-linejoin="round" stroke-width="4"><path fill="#555555" d="M21 38c9.389 0 17-7.611 17-17S30.389 4 21 4S4 11.611 4 21s7.611 17 17 17Z"/><path stroke-linecap="round" d="M26.657 14.343A7.98 7.98 0 0 0 21 12a7.98 7.98 0 0 0-5.657 2.343m17.879 18.879l8.485 8.485"/></g></mask></defs><path fill="currentColor" d="M0 0h48v48H0z" mask="url(#SVGzmt0MemV)"/></svg>'
    },
    {
      title: 'View AI-Powered Results',
      description:
        'Receive a structured clinical report highlighting condition likelihoods, risk severity levels, symptom breakdowns, and recommended next steps.',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="currentColor" d="m25.7 9.3l-7-7c-.2-.2-.4-.3-.7-.3H8c-1.1 0-2 .9-2 2v24c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V10c0-.3-.1-.5-.3-.7M18 4.4l5.6 5.6H18zM24 28H8V4h8v6c0 1.1.9 2 2 2h6z"/><path fill="currentColor" d="M10 22h12v2H10zm0-6h12v2H10z"/></svg>'
    },
    {
      title: 'Connect with a Doctor',
      description:
        'Chat directly with board-certified dermatologists to confirm AI findings, ask questions, and receive official diagnosis, treatment plans, and prescriptions.',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="currentColor"><path fill-rule="evenodd" d="M33.834 13.81c0 3.461-.86 7.975-2.183 7.29a8.001 8.001 0 0 1-15.611-1.54c-1.313-2.297-3.035-6.9 1.392-10.488c.08-.026.128-.242.2-.56c.274-1.203.881-3.877 4.71-3.366c2.953.393 11.492 1.918 11.492 8.665m-3.806 2.182s-.452 1.322-.028 2.795a6 6 0 0 1-11.996.197c.145-.55.145-1.481.144-2.516c-.001-1.867-.003-4.07.852-4.968c5.989 3.989 11.028 4.492 11.028 4.492" clip-rule="evenodd"/><path d="M13 36c0-1.082.573-2.03 1.433-2.558a12 12 0 0 1-.092-.375a22 22 0 0 1-.355-2.068a20 20 0 0 1-.155-2.006C9.61 30.65 6 33.538 6 36.57V42h36v-5.43c0-2.904-3.31-5.675-7.298-7.36v.028c.018.61-.016 1.31-.082 1.983c-.06.624-.149 1.246-.256 1.779H35a1 1 0 0 1 .894.553l1 2c.07.139.106.292.106.447v2a1 1 0 0 1-1 1h-2v-2h1v-.764L34.382 35h-2.764L31 36.236V37h1v2h-2a1 1 0 0 1-1-1v-2c0-.155.036-.308.106-.447l1-2A1 1 0 0 1 31 33h1.315q.033-.129.066-.286c.1-.471.189-1.068.249-1.685c.06-.618.088-1.231.073-1.735a5 5 0 0 0-.049-.624c-.022-.142-.044-.207-.048-.221q-.002-.005 0-.002l.003-.001A22 22 0 0 0 31 28.013c-.503-.115-1.023.577-1.25 1.01H18l-.086-.168c-.212-.422-.473-.943-.914-.842q-.578.131-1.155.297a7 7 0 0 0-.016.527c.004.553.057 1.23.142 1.914c.085.682.2 1.346.32 1.87q.052.227.1.404A3 3 0 1 1 13 36"/><path d="M17 36c0 .574-.462 1.015-1 1.015s-1-.44-1-1.015c0-.574.462-1.015 1-1.015s1 .44 1 1.015"/></g></svg>'
    }
  ]
</script>
