<template>
  <div
    class="bg-card m-3 flex items-center justify-between rounded-full px-3 py-1 text-center md:m-5 md:px-7 relative"
  >
    <div class="hidden space-x-6 text-[18px] font-semibold md:flex">
      <a href="#" class="cursor-pointer">About</a>
      <a href="#" class="cursor-pointer">Features</a>
      <a href="#" class="cursor-pointer">Contact Us</a>
    </div>
    <div class="mr-2 flex items-center space-x-2 md:mr-3">
      <NuxtImg
        src="/images/DA_Icon.png"
        class="mx-auto mb-1 h-8 w-auto md:mb-2 md:h-15"
        alt="Logo"
      />
      <h1 class="font-barlow mt-1 text-lg font-light md:mt-2 md:text-5xl hidden md:block">DermAssist</h1>
      <div class="flex md:hidden space-x-2 text-[10px] ml-2">
        <a href="#" class="cursor-pointer">About</a>
        <a href="#" class="cursor-pointer">Features</a>
        <a href="#" class="cursor-pointer">Contact</a>
      </div>
    </div>

    <div class="flex items-center space-x-2 md:space-x-6">
      <NuxtLink
        to="/auth/login"
        class="cursor-pointer text-[10px] font-semibold md:text-lg"
      >Login</NuxtLink>
      <NuxtLink
        to="/auth/register"
        class="bg-secondary hover:bg-primary text-[10px] cursor-pointer rounded-full px-4 py-1.5 text-sm text-white md:px-9 md:py-3 md:text-lg"
      >Get Started</NuxtLink>
    </div>
  </div>
</template>
