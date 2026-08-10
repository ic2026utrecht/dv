export interface PinchZoomClampBounds {
  viewportW: number
  viewportH: number
  contentW: number
  contentH: number
}

export function usePinchZoom(options?: {
  minScale?: number
  maxScale?: number
  /** Lower = slower pinch zoom (0.5 is half as aggressive as linear). */
  pinchExponent?: number
  /** Wheel zoom step as a fraction of current scale per tick. */
  wheelStep?: number
}) {
  const minScale = ref(options?.minScale ?? 1)
  const maxScale = options?.maxScale ?? 5
  const pinchExponent = options?.pinchExponent ?? 0.35
  const wheelStep = options?.wheelStep ?? 0.04

  const scale = ref(minScale.value)
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
  let getClampBounds: (() => PinchZoomClampBounds | null) | null = null

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value))
  }

  function clampTranslation() {
    const bounds = getClampBounds?.()
    if (!bounds) {
      return
    }

    const { viewportW, viewportH, contentW, contentH } = bounds
    const scaledW = contentW * scale.value
    const scaledH = contentH * scale.value

    if (scaledW <= viewportW) {
      translateX.value = 0
    }
    else {
      const maxTx = (scaledW - viewportW) / 2
      translateX.value = clamp(translateX.value, -maxTx, maxTx)
    }

    if (scaledH <= viewportH) {
      translateY.value = 0
    }
    else {
      const maxTy = (scaledH - viewportH) / 2
      translateY.value = clamp(translateY.value, -maxTy, maxTy)
    }
  }

  function setClampBounds(getter: () => PinchZoomClampBounds | null) {
    getClampBounds = getter
  }

  function setMinScale(value: number) {
    minScale.value = value
    if (scale.value < value) {
      resetToFit(value)
    }
    else {
      clampTranslation()
    }
  }

  function resetToFit(nextScale = minScale.value) {
    scale.value = nextScale
    translateX.value = 0
    translateY.value = 0
    isPanning = false
    activePointerId = null
    gestureMoved = false
  }

  function reset() {
    resetToFit(minScale.value)
  }

  function normalizeScale() {
    scale.value = clamp(scale.value, minScale.value, maxScale)
    if (scale.value <= minScale.value) {
      scale.value = minScale.value
      translateX.value = 0
      translateY.value = 0
    }
    clampTranslation()
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

      if (scale.value > minScale.value) {
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
      const ratio = distance / pinchStartDistance
      const dampedRatio = Math.pow(ratio, pinchExponent)
      scale.value = clamp(pinchStartScale * dampedRatio, minScale.value, maxScale)
      clampTranslation()
      return
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0]!
      markMoved(touch.clientX, touch.clientY)

      if (isPanning) {
        event.preventDefault()
        translateX.value = panOriginX + (touch.clientX - panStartX)
        translateY.value = panOriginY + (touch.clientY - panStartY)
        clampTranslation()
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
    const factor = event.deltaY > 0 ? 1 - wheelStep : 1 + wheelStep
    scale.value = clamp(scale.value * factor, minScale.value, maxScale)
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

    if (scale.value > minScale.value) {
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
    clampTranslation()
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
    minScale,
    translateX,
    translateY,
    transformStyle,
    reset,
    resetToFit,
    setMinScale,
    setClampBounds,
    clampTranslation,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
