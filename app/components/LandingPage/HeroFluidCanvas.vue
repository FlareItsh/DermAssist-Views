<template>
  <section
    ref="containerRef"
    class="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-black md:h-screen md:min-h-[720px]"
  >
    <!-- Live HTML5 Canvas Animation Background -->
    <canvas
      ref="canvasRef"
      class="absolute inset-0 block h-full w-full"
    />

    <!-- Subtle vignette overlay for depth and contrast -->
    <div
      class="pointer-events-none absolute inset-0 bg-radial-[circle_at_center,transparent_35%,rgba(0,0,0,0.7)_100%]"
    />

    <!-- Top Area: Centered Subtitle positioned below fixed navbar -->
    <div class="relative z-20 flex w-full shrink-0 flex-col items-center pt-20 sm:pt-24 md:pt-28">
      <h1
        class="font-barlow max-w-[340px] px-4 text-center text-base font-light tracking-[2px] text-white uppercase sm:max-w-xl sm:text-2xl sm:tracking-[4px] md:max-w-none md:text-4xl md:tracking-[6px] lg:text-5xl"
      >
        AI-Powered Skin Condition Recognition System
      </h1>
    </div>

    <!-- Main Content: Centered on mobile, left-aligned on desktop -->
    <div
      class="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-4 pb-14 text-center sm:px-12 sm:pt-6 sm:pb-16 md:items-start md:px-16 md:pb-20 md:text-left lg:px-24"
    >
      <div
        class="flex max-w-md flex-col items-center transition-all duration-700 ease-out sm:max-w-xl md:items-start lg:max-w-2xl"
        :class="isReady ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        <h2
          class="text-3xl leading-[1.12] font-extrabold tracking-tight text-white sm:text-4xl sm:leading-tight md:text-5xl lg:text-[56px]"
        >
          AI-Driven Skin Care That Connects You to Experts
        </h2>

        <p
          class="mt-3.5 max-w-sm text-sm leading-relaxed font-normal text-white/90 sm:mt-5 sm:max-w-lg sm:text-base md:mt-6 md:text-lg lg:text-xl"
        >
          Detect skin conditions early and connect with licensed doctors &mdash;all in one place.
        </p>

        <div class="mt-6 flex w-full justify-center sm:mt-8 md:mt-10 md:justify-start">
          <NuxtLink
            :to="ctaDestination"
            @click="handleCtaClick"
            class="inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-black shadow-2xl shadow-white/20 transition-all duration-200 hover:scale-105 hover:bg-neutral-100 active:scale-95 sm:px-9 sm:py-3.5 sm:text-base"
          >
            Scan Your Skin Now
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'

  const containerRef = ref<HTMLElement | null>(null)
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const isReady = ref(false)

  // Dynamic destination based on authentication status and user role
  const authToken = useCookie<string | null>('auth_token')
  const userRole = useCookie<string | null>('user_role')

  const ctaDestination = computed(() => {
    if (!authToken.value) {
      return '/auth/login'
    }
    const role = (userRole.value || '').toLowerCase()
    if (role === 'doctor') {
      return '/Doctor/Scan'
    }
    return '/Patient/Scan'
  })

  function handleCtaClick(e: MouseEvent) {
    const token = useCookie<string | null>('auth_token')
    const role = useCookie<string | null>('user_role')

    if (!token.value) {
      e.preventDefault()
      navigateTo('/auth/login')
      return
    }

    const roleValue = (role.value || '').toLowerCase()
    e.preventDefault()
    if (roleValue === 'doctor') {
      navigateTo('/Doctor/Scan')
    } else {
      navigateTo('/Patient/Scan')
    }
  }

  let animationFrameId: number | null = null
  let resizeObserver: ResizeObserver | null = null
  let intersectionObserver: IntersectionObserver | null = null
  let isVisible = true
  let lastRenderTime = 0
  const MOBILE_BREAKPOINT = 768
  const MOBILE_TARGET_FPS = 30
  const DESKTOP_TARGET_FPS = 60

  let glContext: WebGLRenderingContext | null = null
  let glProgram: WebGLProgram | null = null
  let vertexShader: WebGLShader | null = null
  let fragmentShader: WebGLShader | null = null
  let positionBuffer: WebGLBuffer | null = null

  // Fallback 2D context tracking
  let ctx2d: CanvasRenderingContext2D | null = null
  let isFallback2d = false

  // Interactive cursor tracking
  let targetMouseX = 0
  let targetMouseY = 0
  let currentMouseX = 0
  let currentMouseY = 0
  let targetActive = 0
  let currentActive = 0

  function getDpr(): number {
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT
    return isMobile
      ? Math.max(0.75, Math.min(window.devicePixelRatio || 1, 1.5) * 0.75)
      : Math.min(window.devicePixelRatio || 1, 2)
  }

  function handlePointerMove(e: PointerEvent) {
    const container = containerRef.value
    const canvas = canvasRef.value
    if (!container || !canvas) return

    const rect = container.getBoundingClientRect()
    const dpr = getDpr()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const glX = x * dpr
    const glY = (rect.height - y) * dpr
    const minDim = Math.min(canvas.width, canvas.height)

    targetMouseX = (glX - 0.5 * canvas.width) / minDim
    targetMouseY = (glY - 0.5 * canvas.height) / minDim
    targetActive = 1
  }

  function handlePointerLeave() {
    targetActive = 0
  }

  const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

  const FRAGMENT_SHADER_SOURCE = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform float u_mouse_active;

  // Simplex-inspired 2D noise helpers
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // Fractional Brownian Motion (smoothed 3-octave for less dense, silky ribbons)
  float fbm(vec2 p) {
    float total = 0.0;
    float amp = 0.55;
    float freq = 1.0;
    for (int i = 0; i < 3; i++) {
      total += snoise(p * freq) * amp;
      freq *= 1.85;
      amp *= 0.46;
    }
    return total;
  }

  void main() {
    // Aspect-ratio normalized coordinates centered around origin
    vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

    // Center fluid vortex (slight desktop offset to balance text, centered on mobile)
    vec2 center = vec2(u_resolution.x > u_resolution.y ? 0.12 : 0.0, -0.02);
    vec2 p = st - center;

    // Interactive cursor avoidance: fluid deflects around a small, clean cursor circle
    vec2 mDiff = st - u_mouse;
    float mDist = length(mDiff);
    float repelRadius = 0.085;
    float influence = 0.17;

    if (u_mouse_active > 0.001) {
      vec2 mDir = mDiff / max(mDist, 0.0001);
      float push = smoothstep(influence, repelRadius * 0.5, mDist) * u_mouse_active;
      p += mDir * push * 0.20;
    }

    float r = length(p);
    float angle = atan(p.y, p.x);

    // Smooth, airy vortex swirl
    float swirl = 1.25 / (r + 0.55) * sin(u_time * 0.16) + (u_time * 0.09);
    float swAng = angle + swirl;
    vec2 pSwirl = vec2(cos(swAng), sin(swAng)) * r;

    // Broader spatial scale for airy, less dense fluid streams
    vec2 q = vec2(
      fbm(pSwirl * 0.88 + vec2(u_time * 0.07, u_time * 0.05)),
      fbm(pSwirl * 0.88 + vec2(-u_time * 0.06, u_time * 0.08))
    );

    vec2 warp = vec2(
      fbm(pSwirl * 1.15 + 1.45 * q + vec2(1.7, 9.2) + u_time * 0.05),
      fbm(pSwirl * 1.15 + 1.45 * q + vec2(8.3, 2.8) - u_time * 0.06)
    );

    float f = fbm(pSwirl * 1.05 + 1.55 * warp + u_time * 0.035);

    // Radial opacity falloff: center is luminous, fades gradually with distance from center
    float maxReach = length(u_resolution.xy) / min(u_resolution.x, u_resolution.y) * 0.82;
    float noiseEdge = 0.10 * q.x + 0.08 * warp.y;
    float radialOpacity = clamp(1.0 - (r / (maxReach + noiseEdge)), 0.0, 1.0);
    radialOpacity = smoothstep(0.0, 1.0, radialOpacity);
    radialOpacity = pow(radialOpacity, 1.2);

    // Color palette: deep royal blue, luminous cobalt sapphire, violet, and magenta-red accents
    vec3 colDeepNavy = vec3(0.01, 0.04, 0.28);
    vec3 colRoyalBlue = vec3(0.02, 0.15, 0.78);
    vec3 colCobaltSapphire = vec3(0.06, 0.35, 0.98);
    vec3 colSapphireSheen = vec3(0.20, 0.52, 1.0);
    vec3 colViolet = vec3(0.40, 0.02, 0.58);
    vec3 colMagentaRed = vec3(0.92, 0.06, 0.36);
    vec3 colHotPink = vec3(1.0, 0.20, 0.65);

    // Airy mixing: black void breathes between flowing ribbons
    float fluidPresence = smoothstep(-0.22, 0.52, f + 0.32 * q.x);
    float blueDepth = smoothstep(0.15, 0.75, f + 0.2 * warp.x);
    float redBand = smoothstep(0.10, 0.68, warp.x * 0.8 + warp.y * 0.5);
    float sheenCrest = smoothstep(0.50, 0.90, f);
    float pinkHighlight = smoothstep(0.48, 0.86, abs(warp.y) + 0.35 * f);

    // Deep royal blue foundation
    vec3 blueGradient = mix(colDeepNavy, colRoyalBlue, fluidPresence);
    blueGradient = mix(blueGradient, colCobaltSapphire, blueDepth * 0.85);

    vec3 fluidColor = mix(vec3(0.0), blueGradient, fluidPresence);
    fluidColor = mix(fluidColor, colViolet, redBand * 0.62);
    fluidColor = mix(fluidColor, colMagentaRed, pow(redBand, 1.7) * 0.88);
    fluidColor = mix(fluidColor, colHotPink, pinkHighlight * 0.42);
    fluidColor += colSapphireSheen * sheenCrest * 0.38;

    // Apply radial opacity and density factor for light, glowing liquid silk
    float density = 0.76;
    vec3 finalColor = fluidColor * radialOpacity * density;

    // Avoidance circle mask: clean circular clearing with zero added border color
    if (u_mouse_active > 0.001) {
      float avoidCircle = smoothstep(repelRadius * 0.55, repelRadius * 1.15, mDist);
      float avoidMask = mix(1.0, avoidCircle, u_mouse_active);
      finalColor *= avoidMask;
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

  function initWebGL(canvas: HTMLCanvasElement): boolean {
    try {
      const gl =
        (canvas.getContext('webgl', {
          alpha: false,
          antialias: true,
          powerPreference: 'high-performance'
        }) as WebGLRenderingContext | null) ||
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)

      if (!gl) return false

      glContext = gl

      // Compile vertex shader
      vertexShader = gl.createShader(gl.VERTEX_SHADER)
      if (!vertexShader) return false
      gl.shaderSource(vertexShader, VERTEX_SHADER_SOURCE)
      gl.compileShader(vertexShader)
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.warn('WebGL Vertex Shader compilation failed:', gl.getShaderInfoLog(vertexShader))
        return false
      }

      // Compile fragment shader
      fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
      if (!fragmentShader) return false
      gl.shaderSource(fragmentShader, FRAGMENT_SHADER_SOURCE)
      gl.compileShader(fragmentShader)
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.warn(
          'WebGL Fragment Shader compilation failed:',
          gl.getShaderInfoLog(fragmentShader)
        )
        return false
      }

      // Link shader program
      glProgram = gl.createProgram()
      if (!glProgram) return false
      gl.attachShader(glProgram, vertexShader)
      gl.attachShader(glProgram, fragmentShader)
      gl.linkProgram(glProgram)
      if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
        console.warn('WebGL Program linking failed:', gl.getProgramInfoLog(glProgram))
        return false
      }

      // Setup fullscreen quad positions
      positionBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

      return true
    } catch (err) {
      console.warn('WebGL initialization exception, falling back to 2D:', err)
      return false
    }
  }

  function init2DFallback(canvas: HTMLCanvasElement): boolean {
    ctx2d = canvas.getContext('2d')
    isFallback2d = !!ctx2d
    return isFallback2d
  }

  function resizeCanvas() {
    const canvas = canvasRef.value
    const container = containerRef.value
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const dpr = getDpr()
    const displayWidth = Math.floor(rect.width * dpr)
    const displayHeight = Math.floor(rect.height * dpr)

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth
      canvas.height = displayHeight
    }

    if (glContext) {
      glContext.viewport(0, 0, canvas.width, canvas.height)
    }
  }

  function render2DFallback(time: number) {
    if (!ctx2d || !canvasRef.value) return
    const canvas = canvasRef.value
    const w = canvas.width
    const h = canvas.height

    ctx2d.fillStyle = '#000000'
    ctx2d.fillRect(0, 0, w, h)

    const centerX = w > h ? w * 0.58 : w * 0.5
    const centerY = h * 0.48
    const baseRadius = Math.max(w, h) * 0.72

    // Airy, spread-out layered radial gradients with deep royal blue and magenta
    const layers = [
      { color: 'rgba(5, 25, 170, 0.35)', r: baseRadius * 1.0, offset: 0 },
      { color: 'rgba(160, 10, 75, 0.22)', r: baseRadius * 0.85, offset: 2.1 },
      { color: 'rgba(12, 45, 210, 0.32)', r: baseRadius * 0.7, offset: 4.2 },
      { color: 'rgba(215, 20, 95, 0.24)', r: baseRadius * 0.55, offset: 1.0 },
      { color: 'rgba(25, 75, 235, 0.26)', r: baseRadius * 0.35, offset: 3.5 }
    ]

    ctx2d.globalCompositeOperation = 'screen'
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]
      const dx = Math.sin(time * 0.25 + layer.offset) * 50
      const dy = Math.cos(time * 0.2 + layer.offset) * 40

      const grad = ctx2d.createRadialGradient(
        centerX + dx,
        centerY + dy,
        0,
        centerX + dx,
        centerY + dy,
        layer.r
      )
      grad.addColorStop(0, layer.color)
      grad.addColorStop(0.5, layer.color.replace(/[\d\.]+\)$/, '0.12)'))
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)')

      ctx2d.fillStyle = grad
      ctx2d.beginPath()
      ctx2d.arc(centerX + dx, centerY + dy, layer.r, 0, Math.PI * 2)
      ctx2d.fill()
    }

    // Interactive mouse clearing in 2D fallback
    if (currentActive > 0.01) {
      const minDim = Math.min(w, h)
      const mousePixelX = currentMouseX * minDim + 0.5 * w
      const mousePixelY = h - (currentMouseY * minDim + 0.5 * h)
      const repelPixels = minDim * 0.085

      ctx2d.save()
      ctx2d.globalCompositeOperation = 'destination-out'
      const repelGrad = ctx2d.createRadialGradient(
        mousePixelX,
        mousePixelY,
        0,
        mousePixelX,
        mousePixelY,
        repelPixels
      )
      repelGrad.addColorStop(0, `rgba(0, 0, 0, ${currentActive})`)
      repelGrad.addColorStop(0.8, `rgba(0, 0, 0, ${currentActive * 0.8})`)
      repelGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx2d.fillStyle = repelGrad
      ctx2d.beginPath()
      ctx2d.arc(mousePixelX, mousePixelY, repelPixels, 0, Math.PI * 2)
      ctx2d.fill()
      ctx2d.restore()
    }

    ctx2d.globalCompositeOperation = 'source-over'
  }

  let startTime = 0

  function startAnimationLoop() {
    if (animationFrameId === null && isVisible) {
      animationFrameId = requestAnimationFrame(animate)
    }
  }

  function stopAnimationLoop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      isVisible = false
      stopAnimationLoop()
    } else {
      isVisible = true
      lastRenderTime = performance.now()
      startAnimationLoop()
    }
  }

  function animate(currentTime: number) {
    if (!isVisible) {
      animationFrameId = null
      return
    }

    // Always schedule next frame first
    animationFrameId = requestAnimationFrame(animate)

    // Framerate pacing: Mobile target 30 FPS (~33.3ms), Desktop 60 FPS (~16.6ms)
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT
    const targetFps = isMobile ? MOBILE_TARGET_FPS : DESKTOP_TARGET_FPS
    const frameInterval = 1000 / targetFps

    const delta = currentTime - lastRenderTime
    if (delta < frameInterval) {
      return
    }

    // Maintain consistent frame pacing cadence without drift
    lastRenderTime = currentTime - (delta % frameInterval)

    if (!startTime) startTime = currentTime
    const elapsedTime = (currentTime - startTime) * 0.001

    // Smooth cursor interpolation
    currentMouseX += (targetMouseX - currentMouseX) * 0.12
    currentMouseY += (targetMouseY - currentMouseY) * 0.12
    currentActive += (targetActive - currentActive) * 0.08
    if (currentActive < 0.001) currentActive = 0

    if (glContext && glProgram && positionBuffer && canvasRef.value) {
      const gl = glContext
      gl.useProgram(glProgram)

      const positionLocation = gl.getAttribLocation(glProgram, 'a_position')
      gl.enableVertexAttribArray(positionLocation)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

      const resLocation = gl.getUniformLocation(glProgram, 'u_resolution')
      const timeLocation = gl.getUniformLocation(glProgram, 'u_time')
      const mouseLocation = gl.getUniformLocation(glProgram, 'u_mouse')
      const mouseActiveLocation = gl.getUniformLocation(glProgram, 'u_mouse_active')

      gl.uniform2f(resLocation, canvasRef.value.width, canvasRef.value.height)
      gl.uniform1f(timeLocation, elapsedTime)
      if (mouseLocation) gl.uniform2f(mouseLocation, currentMouseX, currentMouseY)
      if (mouseActiveLocation) gl.uniform1f(mouseActiveLocation, currentActive)

      gl.drawArrays(gl.TRIANGLES, 0, 6)
    } else if (isFallback2d) {
      render2DFallback(elapsedTime)
    }

    // Once first frame is painted, trigger content entrance transition
    if (!isReady.value) {
      isReady.value = true
    }
  }

  onMounted(() => {
    const canvas = canvasRef.value
    const container = containerRef.value
    if (!canvas || !container) return

    // Try WebGL first, fall back to 2D canvas
    const webglSuccess = initWebGL(canvas)
    if (!webglSuccess) {
      init2DFallback(canvas)
    }

    resizeCanvas()

    // Track container size changes
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvas()
      })
      resizeObserver.observe(container)
    }

    // Viewport intersection observer: pause loop when off-screen
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          const nowVisible = entry ? entry.isIntersecting : true
          if (nowVisible !== isVisible) {
            isVisible = nowVisible
            if (isVisible) {
              lastRenderTime = performance.now()
              startAnimationLoop()
            } else {
              stopAnimationLoop()
            }
          }
        },
        { threshold: 0.02 }
      )
      intersectionObserver.observe(container)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Interactive pointer listeners with passive option for smooth mobile scrolling
    container.addEventListener('pointermove', handlePointerMove, { passive: true })
    container.addEventListener('pointerdown', handlePointerMove, { passive: true })
    container.addEventListener('pointerleave', handlePointerLeave, { passive: true })
    container.addEventListener('pointercancel', handlePointerLeave, { passive: true })

    // Start animation loop
    startAnimationLoop()
  })

  onUnmounted(() => {
    stopAnimationLoop()

    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }

    if (intersectionObserver) {
      intersectionObserver.disconnect()
      intersectionObserver = null
    }

    document.removeEventListener('visibilitychange', handleVisibilityChange)

    if (containerRef.value) {
      const container = containerRef.value
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerdown', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
      container.removeEventListener('pointercancel', handlePointerLeave)
    }

    if (glContext) {
      if (positionBuffer) glContext.deleteBuffer(positionBuffer)
      if (vertexShader) glContext.deleteShader(vertexShader)
      if (fragmentShader) glContext.deleteShader(fragmentShader)
      if (glProgram) glContext.deleteProgram(glProgram)
      glContext = null
    }

    ctx2d = null
  })
</script>
