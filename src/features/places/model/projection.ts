import type { LatLng } from './types'

/** Mock-map world size in px and scale (Block 3 only; Mapbox replaces it in Block 7). */
export const WORLD_SIZE = 1600
const METERS_PER_PX = 1.1

/** Equirectangular projection around `center`, good enough for a 2 km district. */
export function project(point: LatLng, center: LatLng): { x: number; y: number } {
  const metersX = (point.lng - center.lng) * 111_320 * Math.cos((center.lat * Math.PI) / 180)
  const metersY = (point.lat - center.lat) * 110_540
  return {
    x: WORLD_SIZE / 2 + metersX / METERS_PER_PX,
    y: WORLD_SIZE / 2 - metersY / METERS_PER_PX,
  }
}
