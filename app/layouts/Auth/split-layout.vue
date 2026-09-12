<template>
  <div class="bg-background flex min-h-screen md:h-screen w-full p-3 sm:p-6 md:p-8 lg:p-10">
    <div class="flex w-full md:rounded-4xl md:shadow-lg overflow-hidden">
      <div class="bg-card w-full md:w-1/2 md:rounded-l-4xl flex flex-col min-h-0">
        <slot />
      </div>
      <div class="bg-secondary relative hidden md:flex md:w-1/2 md:rounded-r-4xl">
        <NuxtImg
          src="/images/auth/auth-image 1.png"
          alt="Auth Background"
          class="h-full w-full rounded-r-4xl object-cover"
        />
        <div
          class="from-secondary absolute inset-x-0 bottom-0 flex h-1/3 items-end rounded-br-4xl bg-linear-to-t to-transparent p-12"
        >
          <p class="text-accent-foreground text-xl leading-relaxed font-medium italic">
            "The skin is the largest organ of the body. It's our first line of defense against the
            outside world."
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
