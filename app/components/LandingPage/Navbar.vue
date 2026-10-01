<template>
  <div
    class="bg-card relative m-3 flex items-center justify-between rounded-full px-3 py-1 text-center md:m-5 md:px-7"
  >
    <div class="hidden space-x-6 text-[14px] font-semibold md:flex">
      <a
        href="#"
        class="cursor-pointer"
        >About</a
      >
      <a
        href="#"
        class="cursor-pointer"
        >Features</a
      >
      <a
        href="#"
        class="cursor-pointer"
        >Contact Us</a
      >
    </div>
    <div class="mr-2 flex items-center space-x-2 md:mr-3">
      <NuxtImg
        src="/images/DA_Icon.png"
        class="mx-auto mb-1 h-8 w-auto md:mb-2 md:h-15"
        alt="Logo"
      />
      <h1 class="font-barlow mt-1 hidden text-lg font-light md:mt-2 md:block md:text-5xl">
        DermAssist
      </h1>
      <div class="ml-1 flex space-x-2 text-[8px] md:hidden">
        <a
          href="#"
          class="cursor-pointer"
          >About</a
        >
        <a
          href="#"
          class="cursor-pointer"
          >Features</a
        >
        <a
          href="#"
          class="cursor-pointer"
          >Contact</a
        >
      </div>
    </div>

    <div class="flex items-center space-x-1 md:space-x-6">
      <NuxtLink
        to="/auth/login"
        class="cursor-pointer text-[8px] font-semibold md:text-lg"
        >Login</NuxtLink
      >
      <NuxtLink
        to="/auth/register"
        class="bg-secondary hover:bg-primary cursor-pointer rounded-full px-4 py-1.5 text-sm text-[8px] text-white md:px-9 md:py-3 md:text-lg"
        >Get Started</NuxtLink
      >
    </div>
  </div>
</template>
