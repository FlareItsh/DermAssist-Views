<template>
  <footer class="bg-secondary mt-auto w-full pb-8 md:pb-12">
    <div
      class="flex flex-col items-start gap-2 px-5 pt-8 md:flex-row md:items-center md:px-12 md:pt-14"
    >
      <h1 class="font-barlow text-card shrink-0 text-lg font-semibold md:text-3xl">
        DermAssist – AI-Powered Skin Detection & Doctor Consultation
      </h1>
      <div class="bg-card mt-2 hidden h-[5px] flex-1 rounded-full md:mt-1 md:ml-4 md:block"></div>
    </div>
    <div class="mt-8 px-5 md:mt-16 md:px-12">
      <div class="flex flex-col gap-4 md:flex-row md:justify-between">
        <div class="font-barlow leading-tight">
          <p class="text-primary-light text-sm">Contact DermAssist at:</p>
          <p class="text-card text-base md:text-2xl">dermassist@gmail.com</p>
        </div>
        <div>
          <div class="text-card font-barlow hidden space-x-4 text-2xl md:flex">
            <a
              href="#about"
              class="cursor-pointer transition-opacity hover:opacity-80"
              >About</a
            >
            <span>|</span>
            <a
              href="#features"
              class="cursor-pointer transition-opacity hover:opacity-80"
              >Features</a
            >
            <span>|</span>
            <a
              href="#contact"
              class="cursor-pointer transition-opacity hover:opacity-80"
              >Contact Us</a
            >
          </div>
        </div>
      </div>
      <div
        class="mt-4 flex items-center justify-start space-x-2 overflow-hidden md:mt-5 md:-ml-3.5 md:space-x-5"
      >
        <NuxtImg
          src="/images/DA_Icon.png"
          class="h-12 w-auto md:h-25"
          alt="Logo"
        />
        <p class="text-card font-barlow text-3xl tracking-[8px] md:text-8xl md:tracking-[75px]">
          DERMASSIST
        </p>
      </div>
      <div class="mt-2 flex">
        <p class="text-primary-light font-barlow text-xs md:text-sm">
          © 2026 DermAssist. All rights reserved. Privacy Policy | Terms of Service
        </p>
      </div>
    </div>
  </footer>
</template>
