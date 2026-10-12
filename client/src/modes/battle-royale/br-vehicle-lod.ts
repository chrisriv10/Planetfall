import { QUALITY_PRESETS, type GraphicsQuality } from "../../settings";

/** Presentation only: keep local driving detailed and avoid flickering between
 * models when a moving camera sits on a distance boundary. */
export function useFarBrVehicle(distance: number, quality: GraphicsQuality, wasFar: boolean, locallyDriven: boolean): boolean {
  return !locallyDriven && Number.isFinite(distance) && distance > QUALITY_PRESETS[quality].vehicleDetailDistance - (wasFar ? 25 : 0);
}
