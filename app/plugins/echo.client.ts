export default defineNuxtPlugin(nuxtApp => {
  const { getEcho, disconnectEcho } = useEcho()

  return {
    provide: {
      echo: getEcho(),
      getEcho,
      disconnectEcho
    }
  }
})
