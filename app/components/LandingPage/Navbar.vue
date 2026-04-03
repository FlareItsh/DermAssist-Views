<template>
  <div
    class="bg-card m-5 flex items-center justify-between rounded-full px-7 py-2 text-center text-2xl"
  >
    <div class="hidden space-x-6 text-[18px] font-semibold md:flex">
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
    <div class="mr-3 flex space-x-2">
      <NuxtImg
        src="/images/DA_Icon.png"
        class="mx-auto mb-2 h-15 w-auto"
        alt="Logo"
      />
      <h1 class="font-barlow mt-2 text-5xl font-light">DermAssist</h1>
    </div>

    <div class="flex items-center space-x-6">
      <NuxtLink
        to="/auth/login"
        class="cursor-pointer text-lg font-semibold"
        >Login</NuxtLink
      >
      <NuxtLink
        to="/auth/register"
        class="bg-secondary hover:bg-primary cursor-pointer rounded-full px-9 py-3 text-lg text-white"
        >Get Started</NuxtLink
      >
    </div>
  </div>
</template>
