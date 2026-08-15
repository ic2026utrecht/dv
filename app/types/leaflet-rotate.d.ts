import 'leaflet'

declare module 'leaflet' {
  interface MapOptions {
    rotate?: boolean
    bearing?: number
    rotateControl?: boolean | ControlOptions
    touchRotate?: boolean
  }

  interface Map {
    setBearing: (bearing: number) => this
    getBearing: () => number
  }
}

declare module 'leaflet-rotate'
