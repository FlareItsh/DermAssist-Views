<template>
  <div class="bg-background flex h-screen w-full p-20">
    <div class="flex w-full rounded-4xl shadow-lg">
      <div class="bg-card w-1/2 rounded-l-4xl">
        <slot />
      </div>
      <div class="bg-secondary relative w-1/2 rounded-r-4xl">
        <NuxtImg
          src="/images/auth/auth-image 1.png"
          alt="Auth Background"
          class="h-full w-full rounded-r-4xl object-cover"
        />
        <div
          class="from-secondary absolute inset-x-0 bottom-0 flex h-1/3 items-end rounded-br-4xl bg-linear-to-t to-transparent p-12"
        >
          <p class="text-accent-foreground text-xl leading-relaxed font-medium italic">
            “The skin is the largest organ of the body. It’s our first line of defense against the
            outside world.”
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
