<template>
  <div class="mb-12 flex flex-col justify-center gap-20 px-12">
    <div>
      <h1 class="font-barlow mt-12 text-center text-5xl tracking-[5px]">
        AI-Powered Skin Condition Recognition System
      </h1>
      <NuxtImg
        src="/images/lp-img.png"
        class="mx-auto mb-2 h-screen w-auto"
        alt="CTA"
      />
      <NuxtLink
        to="/admin/dashboard"
        class="absolute z-10 cursor-pointer rounded-full"
        style="top: 112%; left: 6.7%; width: 16.8%; height: 8%"
      >
        <span class="sr-only">Get Started</span>
      </NuxtLink>
    </div>

    <div class="flex items-center justify-center space-x-20">
      <NuxtImg
        src="/images/accuracy-test.png"
        class="h-100 w-auto"
        alt="CTA"
      />
      <div class="flex flex-col space-y-3">
        <p class="w-185 text-2xl font-semibold">With DermAssist, you benefit from AI-powered</p>
        <p class="w-185 text-2xl font-semibold">
          analysis backed by real doctors. Our system helps
        </p>
        <p class="w-185 text-2xl font-semibold">
          detect skin concerns quickly and accurately, while
        </p>
        <p class="w-185 text-2xl font-semibold">
          giving you the option to consult professionals for
        </p>
        <p class="w-185 text-2xl font-semibold">proper guidance.</p>
        <div class="bg-secondary my-7 h-[5px] w-130 rounded-full"></div>
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled" class="bg-foreground text-card w-50 cursor-pointer rounded-full px-5 py-2 text-lg">
          Know More
        </AppButton>
      </div>
    </div>

    <div>
      <div class="mb-20 flex flex-col items-center justify-center">
        <h2 class="text-secondary text-4xl font-thin">About Us</h2>
        <h1 class="text-secondary text-5xl font-semibold">About DermAssist</h1>
      </div>
      <div>
        <h1 class="text-foreground -mb-25 text-[82px] leading-25 font-semibold tracking-[10px]">
          Smarter Skin Care, Made <br />
          Accessible
        </h1>
        <NuxtImg
          src="/images/about-us-img.png"
          class="h-auto w-screen"
          alt="CTA"
        />
      </div>
    </div>

    <div>
      <div class="mb-20 flex flex-col items-center justify-center">
        <h2 class="text-secondary text-4xl font-thin">Features</h2>
        <h1 class="text-secondary text-5xl font-semibold">Our Features & Services</h1>
      </div>
      <div class="flex flex-wrap justify-center gap-10">
        <div
          v-for="feature in features"
          :key="feature.title"
          class="bg-card flex h-150 w-110 flex-col items-center justify-center rounded-[50px] p-10 shadow-sm transition-shadow hover:shadow-md"
        >
          <div
            class="bg-secondary text-card flex h-35 w-35 w-fit items-center justify-center rounded-full p-7"
          >
            <div
              v-if="feature.icon.startsWith('<svg')"
              v-html="feature.icon"
              class="flex h-20 w-20 items-center justify-center [&>svg]:h-full [&>svg]:w-full"
            ></div>
            <Icon
              v-else
              :name="feature.icon"
              class="text-7xl"
            />
          </div>
          <div class="flex flex-col items-center">
            <p class="text-secondary mt-10 text-center text-[40px] font-bold">
              {{ feature.title }}
            </p>
            <p class="text-foreground text-md mt-5 px-4 text-center text-[20px]">
              {{ feature.description }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div>
      <div class="mb-20 flex flex-col items-center justify-center">
        <h2 class="text-secondary text-4xl font-thin">Contact Us</h2>
        <h1 class="text-secondary text-5xl font-semibold">Contact for Reports & Feedback</h1>
      </div>
      <div class="flex gap-10">
        <NuxtImg
          src="/images/contact-us-img.png"
          class="h-auto w-1/2 rounded-[25px] object-cover"
          alt="contact"
        />

        <div class="bg-card flex w-1/2 flex-col rounded-[25px] p-15 px-25">
          <h1 class="mb-2 text-3xl font-semibold">Get in Touch</h1>
          <p class="mb-6 text-gray-500">
            Have questions, feedback, or need assistance? We're here to help!
          </p>

          <p class="mb-1 text-sm text-gray-500">Name</p>
          <input
            type="text"
            class="bg-primary-light ring-secondary mb-4 rounded-xl px-4 py-2 outline-none focus:ring-1"
          />

          <p class="mb-1 text-sm text-gray-500">Email</p>
          <input
            type="email"
            class="bg-primary-light ring-secondary mb-4 rounded-xl px-4 py-2 outline-none focus:ring-1"
          />

          <p class="mb-1 text-sm text-gray-500">Message</p>
          <textarea
            class="bg-primary-light ring-secondary h-32 resize-none rounded-xl px-4 py-2 outline-none focus:ring-1"
          ></textarea>

          <div class="mt-4 flex items-center justify-start gap-2">
            <input
              type="checkbox"
              class="accent-secondary h-4 w-4 cursor-pointer"
            />
            <p class="text-sm text-gray-500">I agree to the terms and conditions</p>
          </div>

          <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
            class="bg-secondary hover:bg-opacity-90 mt-20 rounded-xl py-3 font-semibold text-white transition-all"
          >
            Send Message
          </AppButton>
        </div>
      </div>
    </div>
  </div>
  <div>{{ data }}</div>
</template>

<script setup lang="ts">
  definePageMeta({
    layout: 'landing-page'
  })

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

  const { data } = await useApi('test')
</script>
