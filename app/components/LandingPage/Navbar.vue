<template>
  <div class="bg-card m-5 py-2 rounded-full flex px-7 justify-between items-center text-center text-2xl">
    <div class="hidden md:flex text-[18px] font-semibold space-x-6">
      <a href="#" class="cursor-pointer">About</a>
      <a href="#" class="cursor-pointer">Features</a>
      <a href="#" class="cursor-pointer">Contact Us</a>
    </div>
    <div class="flex space-x-2 mr-3">
      <NuxtImg src="/images/DA_Icon.png" class="h-15 w-auto mb-2 mx-auto" alt="Logo" />
      <h1 class="font-barlow font-light mt-2 text-5xl">DermAssist</h1>
    </div>

    <div class="flex space-x-6 items-center">
      <button class="text-lg font-semibold cursor-pointer">Login</button>
      <button class="bg-secondary hover:bg-primary text-white text-lg px-9 py-3 rounded-full cursor-pointer">Get Started</button>
    </div>
    <!-- <div class="italic underline">
      <NuxtLink to="/admin/dashboard">Admin Dashboard</NuxtLink>
    </div> -->
  </div>
</template>
