<template>
  <div class="relative w-full overflow-x-clip">
    <!-- Mobile Hero Cover (Strictly Mobile < md: Full screen white canvas that shrinks on scroll) -->
    <LandingPageHeroCover />

    <!-- Desktop Hero Section (Strictly Desktop >= md) -->
    <div class="hidden px-5 pt-2 md:block md:px-12 md:pt-4">
      <h1
        class="font-barlow mt-2 text-center text-[11px] tracking-[1px] md:mt-8 md:text-5xl md:tracking-[5px]"
      >
        AI-Powered Skin Condition Recognition System
      </h1>
      <div class="relative mx-auto mb-2 w-fit">
        <NuxtImg
          src="/images/lp-img.png"
          class="h-auto w-full md:h-screen md:w-auto"
          alt="CTA"
        />
        <NuxtLink
          to="/Doctor"
          class="absolute z-10 cursor-pointer rounded-full"
          style="bottom: 7%; left: 3.8%; width: 18%; height: 7.5%"
        >
          <span class="sr-only">Scan Your Skin Now</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Main Content Container -->
    <div
      class="relative z-10 mx-auto mb-12 flex max-w-7xl flex-col justify-center gap-10 px-4 pt-12 sm:pt-14 md:gap-20 md:px-8 md:pt-10 lg:gap-24 lg:px-12 xl:max-w-[1380px] xl:px-14"
    >
      <!-- Features Pitch Section -->
      <div class="flex items-center justify-center gap-5 md:space-x-20">
        <NuxtImg
          src="/images/accuracy-test.png"
          class="h-auto w-2/5 shrink-0 rounded-2xl border-2 border-white md:h-100 md:w-auto md:border-0"
          alt="CTA"
        />
        <div class="flex flex-col space-y-1 md:space-y-3">
          <p
            class="md:text-foreground text-[10px] leading-relaxed font-semibold text-white sm:text-xs md:w-145 md:text-2xl"
          >
            With DermAssist, you benefit from AI-powered analysis backed by real doctors. Our system
            helps detect skin concerns quickly and accurately, while giving you the option to
            consult professionals for proper guidance.
          </p>
          <div
            class="md:bg-secondary my-2 h-[2px] w-full rounded-full bg-white/40 md:my-7 md:h-[5px] md:w-130"
          ></div>
          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            class="text-secondary md:bg-foreground md:text-card w-24 cursor-pointer rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-md transition-all hover:bg-white/90 md:w-50 md:px-5 md:py-2 md:text-lg"
          >
            Know More
          </AppButton>
        </div>
      </div>

      <!-- About Section -->
      <LandingPageAboutUs />

      <!-- Features Section -->
      <div
        id="features"
        class="relative w-full scroll-mt-20"
      >
        <!-- Ambient Atmospheric Glow -->
        <div
          class="from-secondary/15 via-primary/10 pointer-events-none absolute -top-14 left-1/2 -z-10 h-64 w-full max-w-4xl -translate-x-1/2 rounded-full bg-gradient-to-tr to-amber-400/10 blur-3xl"
        ></div>

        <div class="mb-5 flex flex-col items-center justify-center md:mb-8">
          <h2 class="md:text-secondary text-sm font-medium text-blue-200 md:text-4xl md:font-thin">
            Features
          </h2>
          <h1 class="md:text-secondary text-base font-bold text-white md:text-5xl md:font-semibold">
            Our Features &amp; Services
          </h1>
        </div>
        <div class="grid w-full grid-cols-1 gap-5 md:grid-cols-3 md:gap-7 lg:gap-8">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="bg-card flex w-full flex-col items-center justify-start rounded-[20px] p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md md:h-auto md:min-h-[320px] md:rounded-3xl md:p-8 lg:min-h-[340px] lg:p-9"
          >
            <div
              class="bg-secondary text-card flex h-10 w-10 items-center justify-center rounded-full p-2 md:h-20 md:w-20 md:p-4.5"
            >
              <div
                v-if="feature.icon.startsWith('<svg')"
                v-html="feature.icon"
                class="flex h-5 w-5 items-center justify-center md:h-10 md:w-10 [&>svg]:h-full [&>svg]:w-full"
              ></div>
              <Icon
                v-else
                :name="feature.icon"
                class="text-base md:text-4xl"
              />
            </div>
            <div class="flex flex-col items-center">
              <p class="text-secondary mt-2 text-center text-xs font-bold md:mt-5 md:text-2xl">
                {{ feature.title }}
              </p>
              <p
                class="text-foreground md:text-muted-foreground mt-1 px-1 text-center text-[10px] leading-relaxed md:mt-3 md:px-3 md:text-base"
              >
                {{ feature.description }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Contact Section -->
      <div
        id="contact"
        class="relative w-full scroll-mt-20"
      >
        <!-- Ambient Atmospheric Glow -->
        <div
          class="from-secondary/15 via-primary/10 pointer-events-none absolute -top-14 left-1/2 -z-10 h-64 w-full max-w-4xl -translate-x-1/2 rounded-full bg-gradient-to-tr to-amber-400/10 blur-3xl"
        ></div>

        <div class="mb-5 flex flex-col items-center justify-center md:mb-8">
          <p class="md:text-secondary text-sm font-medium text-blue-200 md:text-4xl md:font-thin">
            Contact Us
          </p>
          <h2
            class="md:text-secondary mt-0 text-center text-base font-bold tracking-tight text-white md:text-5xl md:font-semibold"
          >
            Contact for Reports &amp; Feedback
          </h2>
        </div>
        <div class="flex flex-col gap-6 md:flex-row md:items-stretch md:gap-8 lg:gap-10">
          <!-- Modern Contact Form Card -->
          <div
            class="bg-card border-border/80 relative flex w-full flex-col justify-between rounded-3xl border p-6 shadow-sm sm:p-8 md:w-1/2 md:p-10 lg:p-12"
          >
            <div>
              <div class="mb-6">
                <span
                  class="text-secondary mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase"
                >
                  <Icon
                    name="lucide:message-square-text"
                    class="h-4 w-4"
                  />
                  Message Our Team
                </span>
                <h3 class="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                  Get in Touch
                </h3>
                <p class="text-muted-foreground mt-1.5 text-xs leading-relaxed sm:text-sm">
                  Have questions, feedback, or need clinical assistance? We're here to help!
                </p>
              </div>

              <form
                class="flex flex-col gap-4.5"
                @submit.prevent="handleSendMessage"
              >
                <!-- Full Name -->
                <div class="flex flex-col gap-1.5">
                  <label class="text-foreground/80 text-xs font-semibold">Full Name</label>
                  <div class="relative">
                    <div
                      class="text-muted-foreground/60 pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5"
                    >
                      <Icon
                        name="lucide:user"
                        class="h-4 w-4"
                      />
                    </div>
                    <input
                      v-model="contactForm.name"
                      type="text"
                      placeholder="e.g. Dr. Jane Smith"
                      class="bg-background/50 border-border/80 text-foreground placeholder:text-muted-foreground/50 focus:border-secondary focus:ring-secondary/20 h-11 w-full rounded-2xl border pr-4 pl-10 text-xs transition-all duration-200 outline-none focus:bg-white focus:ring-2 sm:text-sm"
                    />
                  </div>
                </div>

                <!-- Email Address -->
                <div class="flex flex-col gap-1.5">
                  <label class="text-foreground/80 text-xs font-semibold">Email Address</label>
                  <div class="relative">
                    <div
                      class="text-muted-foreground/60 pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5"
                    >
                      <Icon
                        name="lucide:mail"
                        class="h-4 w-4"
                      />
                    </div>
                    <input
                      v-model="contactForm.email"
                      type="email"
                      placeholder="name@example.com"
                      class="bg-background/50 border-border/80 text-foreground placeholder:text-muted-foreground/50 focus:border-secondary focus:ring-secondary/20 h-11 w-full rounded-2xl border pr-4 pl-10 text-xs transition-all duration-200 outline-none focus:bg-white focus:ring-2 sm:text-sm"
                    />
                  </div>
                </div>

                <!-- Message -->
                <div class="flex flex-col gap-1.5">
                  <label class="text-foreground/80 text-xs font-semibold">Your Message</label>
                  <div class="relative">
                    <textarea
                      v-model="contactForm.message"
                      rows="4"
                      placeholder="Tell us about your questions, inquiries, or feedback..."
                      class="bg-background/50 border-border/80 text-foreground placeholder:text-muted-foreground/50 focus:border-secondary focus:ring-secondary/20 w-full resize-none rounded-2xl border p-3.5 text-xs transition-all duration-200 outline-none focus:bg-white focus:ring-2 sm:text-sm"
                    ></textarea>
                  </div>
                </div>

                <!-- Terms & Conditions -->
                <div class="flex items-center gap-2.5 pt-1 text-xs select-none">
                  <input
                    id="contact-terms-checkbox"
                    v-model="contactForm.agreed"
                    type="checkbox"
                    class="accent-secondary border-border/80 h-4 w-4 cursor-pointer rounded-md"
                  />
                  <label
                    for="contact-terms-checkbox"
                    class="text-muted-foreground cursor-pointer"
                  >
                    I agree to the
                    <button
                      type="button"
                      class="text-secondary cursor-pointer font-medium hover:underline"
                      @click="openTermsModal('terms')"
                    >
                      Terms &amp; Conditions
                    </button>
                  </label>
                </div>

                <!-- Submit Button -->
                <button
                  type="submit"
                  :disabled="isSending"
                  class="bg-secondary hover:bg-primary mt-1 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl text-xs font-semibold text-white shadow-xs transition-all duration-200 hover:shadow-md active:scale-98 disabled:cursor-not-allowed disabled:opacity-70 sm:text-sm"
                >
                  <Icon
                    v-if="!isSending"
                    name="lucide:send"
                    class="h-4 w-4"
                  />
                  <Icon
                    v-else
                    name="lucide:loader-2"
                    class="h-4 w-4 animate-spin"
                  />
                  <span>{{ isSending ? 'Sending Message...' : 'Send Message' }}</span>
                </button>
              </form>
            </div>
          </div>

          <NuxtImg
            src="/images/contact-us-img.png"
            class="hidden rounded-3xl object-cover md:block md:h-auto md:w-1/2"
            alt="contact"
          />
        </div>
      </div>
    </div>

    <!-- Terms & Conditions Modal -->
    <AppModalTermsModal
      v-model="showTermsModal"
      :initial-tab="termsModalTab"
      @accept="handleTermsAccepted"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'landing-page'
  })

  const showTermsModal = ref(false)
  const termsModalTab = ref<'terms' | 'privacy' | 'cookies'>('terms')

  const openTermsModal = (tab: 'terms' | 'privacy' | 'cookies' = 'terms') => {
    termsModalTab.value = tab
    showTermsModal.value = true
  }

  const handleTermsAccepted = () => {
    contactForm.value.agreed = true
    showTermsModal.value = false
  }

  const contactForm = ref({
    name: '',
    email: '',
    message: '',
    agreed: false
  })
  const isSending = ref(false)

  const handleSendMessage = () => {
    if (
      !contactForm.value.name.trim() ||
      !contactForm.value.email.trim() ||
      !contactForm.value.message.trim()
    ) {
      toast.error('Please fill in all fields before sending.')
      return
    }
    if (!contactForm.value.agreed) {
      toast.error('Please agree to the terms and conditions.')
      return
    }

    isSending.value = true
    setTimeout(() => {
      isSending.value = false
      toast.success('Thank you! Your message has been sent successfully.')
      contactForm.value = { name: '', email: '', message: '', agreed: false }
    }, 600)
  }

  // THE DYNAMIC ARRAY: Manage your features here!
  const features = [
    {
      title: 'Scan Your Skin',
      description:
        'Take a photo of your skin concern using your device. Our AI analyzes it instantly to detect potential conditions. Quick, simple, and safe.',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><defs><mask id="SVGzmt0MemV"><g fill="none" stroke="#fff" stroke-linejoin="round" stroke-width="4"><path fill="#555555" d="M21 38c9.389 0 17-7.611 17-17S30.389 4 21 4S4 11.611 4 21s7.611 17 17 17Z"/><path stroke-linecap="round" d="M26.657 14.343A7.98 7.98 0 0 0 21 12a7.98 7.98 0 0 0-5.657 2.343m17.879 18.879l8.485 8.485"/></g></mask></defs><path fill="currentColor" d="M0 0h48v48H0z" mask="url(#SVGzmt0MemV)"/></svg>'
    },
    {
      title: 'View AI-Powered Results',
      description:
        'Receive a detailed report highlighting possible skin conditions, severity, and recommendations.',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="currentColor" d="m25.7 9.3l-7-7c-.2-.2-.4-.3-.7-.3H8c-1.1 0-2 .9-2 2v24c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V10c0-.3-.1-.5-.3-.7M18 4.4l5.6 5.6H18zM24 28H8V4h8v6c0 1.1.9 2 2 2h6z"/><path fill="currentColor" d="M10 22h12v2H10zm0-6h12v2H10z"/></svg>'
    },
    {
      title: 'Connect with a Doctor',
      description:
        'Chat with licensed dermatologists to confirm results and get personalized treatment advice. ',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="currentColor"><path fill-rule="evenodd" d="M33.834 13.81c0 3.461-.86 7.975-2.183 7.29a8.001 8.001 0 0 1-15.611-1.54c-1.313-2.297-3.035-6.9 1.392-10.488c.08-.026.128-.242.2-.56c.274-1.203.881-3.877 4.71-3.366c2.953.393 11.492 1.918 11.492 8.665m-3.806 2.182s-.452 1.322-.028 2.795a6 6 0 0 1-11.996.197c.145-.55.145-1.481.144-2.516c-.001-1.867-.003-4.07.852-4.968c5.989 3.989 11.028 4.492 11.028 4.492" clip-rule="evenodd"/><path d="M13 36c0-1.082.573-2.03 1.433-2.558a12 12 0 0 1-.092-.375a22 22 0 0 1-.355-2.068a20 20 0 0 1-.155-2.006C9.61 30.65 6 33.538 6 36.57V42h36v-5.43c0-2.904-3.31-5.675-7.298-7.36v.028c.018.61-.016 1.31-.082 1.983c-.06.624-.149 1.246-.256 1.779H35a1 1 0 0 1 .894.553l1 2c.07.139.106.292.106.447v2a1 1 0 0 1-1 1h-2v-2h1v-.764L34.382 35h-2.764L31 36.236V37h1v2h-2a1 1 0 0 1-1-1v-2c0-.155.036-.308.106-.447l1-2A1 1 0 0 1 31 33h1.315q.033-.129.066-.286c.1-.471.189-1.068.249-1.685c.06-.618.088-1.231.073-1.735a5 5 0 0 0-.049-.624c-.022-.142-.044-.207-.048-.221q-.002-.005 0-.002l.003-.001A22 22 0 0 0 31 28.013c-.503-.115-1.023.577-1.25 1.01H18l-.086-.168c-.212-.422-.473-.943-.914-.842q-.578.131-1.155.297a7 7 0 0 0-.016.527c.004.553.057 1.23.142 1.914c.085.682.2 1.346.32 1.87q.052.227.1.404A3 3 0 1 1 13 36"/><path d="M17 36c0 .574-.462 1.015-1 1.015s-1-.44-1-1.015c0-.574.462-1.015 1-1.015s1 .44 1 1.015"/></g></svg>'
    }
  ]
</script>
