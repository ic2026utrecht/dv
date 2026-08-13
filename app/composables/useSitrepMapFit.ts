export function useSitrepMapFit(
  viewportRef: Ref<HTMLElement | null>,
  imageRef: Ref<HTMLImageElement | null>,
  pinchZoom: {
    scale: Ref<number>
    setMinScale: (value: number) => void
    resetToFit: (nextScale?: number) => void
    setClampBounds: (getter: () => import('~/composables/usePinchZoom').PinchZoomClampBounds | null) => void
    clampTranslation: () => void
  },
) {
  const fitScale = ref(1)

  function updateMapFit() {
    const viewport = viewportRef.value
    const img = imageRef.value
    if (!viewport || !img?.naturalWidth || !img.naturalHeight) {
      return
    }

    const viewportW = viewport.clientWidth
    const viewportH = viewport.clientHeight
    if (viewportW <= 0 || viewportH <= 0) {
      return
    }

    const contentW = viewportW
    const contentH = viewportW * (img.naturalHeight / img.naturalWidth)
    const nextFit = contentH > viewportH ? viewportH / contentH : 1

    fitScale.value = nextFit

    pinchZoom.setClampBounds(() => ({
      viewportW,
      viewportH,
      contentW,
      contentH,
    }))

    pinchZoom.setMinScale(nextFit)

    const isAtDefaultZoom = Math.abs(pinchZoom.scale.value - fitScale.value) < 0.01
      || Math.abs(pinchZoom.scale.value - 1) < 0.01
      || pinchZoom.scale.value < nextFit

    if (isAtDefaultZoom) {
      pinchZoom.resetToFit(nextFit)
    }
    else {
      pinchZoom.clampTranslation()
    }
  }

  function resetMapView() {
    pinchZoom.resetToFit(fitScale.value)
  }

  watch(
    [viewportRef, imageRef],
    ([viewport, img], _prev, onCleanup) => {
      if (!viewport || !img) {
        return
      }

      const onLoad = () => updateMapFit()
      img.addEventListener('load', onLoad)

      const observer = new ResizeObserver(() => updateMapFit())
      observer.observe(viewport)

      if (img.complete) {
        updateMapFit()
      }

      onCleanup(() => {
        img.removeEventListener('load', onLoad)
        observer.disconnect()
      })
    },
    { flush: 'post' },
  )

  return {
    fitScale,
    updateMapFit,
    resetMapView,
  }
}
