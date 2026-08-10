export function usePinchZoom(options?: { minScale?: number, maxScale?: number }) {
  const minScale = options?.minScale ?? 1
  const maxScale = options?.maxScale ?? 5

  const scale = ref(1)
  const translateX = ref(0)
  const translateY = ref(0)

  let pinchStartDistance = 0
  let pinchStartScale = 1
  let panStartX = 0
  let panStartY = 0
  let panOriginX = 0
  let panOriginY = 0
  let isPanning = false
  let activePointerId: number | null = null
  let gestureMoved = false

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value))
  }

  function reset() {
    scale.value = 1
    translateX.value = 0
    translateY.value = 0
    isPanning = false
    activePointerId = null
    gestureMoved = false
  }

  function normalizeScale() {
    scale.value = clamp(scale.value, minScale, maxScale)
    if (scale.value <= minScale) {
      scale.value = minScale
      translateX.value = 0
      translateY.value = 0
    }
  }

  function markMoved(clientX: number, clientY: number) {
    const dx = clientX - panStartX
    const dy = clientY - panStartY
    if (Math.hypot(dx, dy) > 6) {
      gestureMoved = true
    }
  }

  function getTouchDistance(touches: TouchList) {
    const dx = touches[0]!.clientX - touches[1]!.clientX
    const dy = touches[0]!.clientY - touches[1]!.clientY
    return Math.hypot(dx, dy)
  }

  function onTouchStart(event: TouchEvent) {
    gestureMoved = false

    if (event.touches.length === 2) {
      isPanning = false
      pinchStartDistance = getTouchDistance(event.touches)
      pinchStartScale = scale.value
      return
    }

    if (event.touches.length === 1) {
      panStartX = event.touches[0]!.clientX
      panStartY = event.touches[0]!.clientY

      if (scale.value > minScale) {
        isPanning = true
        panOriginX = translateX.value
        panOriginY = translateY.value
      }
    }
  }

  function onTouchMove(event: TouchEvent) {
    if (event.touches.length === 2) {
      event.preventDefault()
      gestureMoved = true
      const distance = getTouchDistance(event.touches)
      scale.value = clamp(pinchStartScale * (distance / pinchStartDistance), minScale, maxScale)
      return
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0]!
      markMoved(touch.clientX, touch.clientY)

      if (isPanning) {
        event.preventDefault()
        translateX.value = panOriginX + (touch.clientX - panStartX)
        translateY.value = panOriginY + (touch.clientY - panStartY)
      }
    }
  }

  function onTouchEnd(): boolean {
    const isTap = !gestureMoved
    isPanning = false
    normalizeScale()
    gestureMoved = false
    return isTap
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.12 : 0.12
    scale.value = clamp(scale.value + delta, minScale, maxScale)
    normalizeScale()
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      return
    }

    gestureMoved = false
    panStartX = event.clientX
    panStartY = event.clientY
    activePointerId = event.pointerId

    if (scale.value > minScale) {
      isPanning = true
      panOriginX = translateX.value
      panOriginY = translateY.value
      event.currentTarget?.setPointerCapture?.(event.pointerId)
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== activePointerId) {
      return
    }

    markMoved(event.clientX, event.clientY)

    if (!isPanning) {
      return
    }

    translateX.value = panOriginX + (event.clientX - panStartX)
    translateY.value = panOriginY + (event.clientY - panStartY)
  }

  function onPointerUp(event: PointerEvent): boolean {
    if (event.pointerId !== activePointerId) {
      return false
    }

    const isTap = !gestureMoved
    isPanning = false
    activePointerId = null
    gestureMoved = false
    normalizeScale()
    return isTap
  }

  const transformStyle = computed(() => ({
    transform: `translate3d(${translateX.value}px, ${translateY.value}px, 0) scale(${scale.value})`,
  }))

  return {
    scale,
    translateX,
    translateY,
    transformStyle,
    reset,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
