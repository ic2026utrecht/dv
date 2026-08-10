export interface GeoCoordinates {
  latitude: number
  longitude: number
}

export function useGeolocation() {
  function getCurrentPosition(timeoutMs = 8000): Promise<GeoCoordinates | null> {
    if (!import.meta.client || !navigator.geolocation) {
      return Promise.resolve(null)
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 60_000,
        },
      )
    })
  }

  return { getCurrentPosition }
}
