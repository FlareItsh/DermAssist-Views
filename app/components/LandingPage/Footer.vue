<template>
  <div class="bg-secondary">
    <div class="flex flex-col items-start gap-2 md:flex-row md:items-center">
      <h1 class="font-barlow text-card ml-5 pt-8 text-lg font-semibold md:ml-12 md:pt-15 md:text-3xl">
        DermAssist – AI-Powered Skin Detection & Doctor Consultation
      </h1>
      <div class="bg-card mt-2 hidden h-[5px] w-208 rounded-full md:mt-7 md:block"></div>
    </div>
    <div class="m-5 mt-10 md:m-12 md:mt-30">
      <div class="flex flex-col gap-4 md:flex-row md:justify-between">
        <div class="font-barlow leading-tight">
          <p class="text-primary-light text-sm">Contact DermAssist at:</p>
          <p class="text-card text-base md:text-2xl">dermassist@gmail.com</p>
        </div>
        <div>
          <div class="text-card font-barlow hidden space-x-4 text-2xl md:flex">
            <a href="#" class="cursor-pointer">About</a>
            <span>|</span>
            <a href="#" class="cursor-pointer">Features</a>
            <span>|</span>
            <a href="#" class="cursor-pointer">Contact Us</a>
          </div>
        </div>
      </div>
      <div class="mt-4 flex items-center justify-start space-x-2 overflow-hidden md:mt-5 md:-ml-3.5 md:space-x-5">
        <NuxtImg
          src="/images/DA_Icon.png"
          class="h-12 w-auto md:h-25"
          alt="Logo"
        />
        <p class="text-card font-barlow text-3xl tracking-[8px] md:text-8xl md:tracking-[75px]">DERMASSIST</p>
      </div>
      <div class="flex">
        <p class="text-primary-light font-barlow text-xs md:text-sm">
          © 2026 DermAssist. All rights reserved. Privacy Policy | Terms of Service
        </p>
      </div>
    </div>
  </div>
</template>
