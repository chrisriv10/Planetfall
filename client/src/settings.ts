export type GraphicsQuality = "low" | "medium" | "high";
export type GraphicsSelection = GraphicsQuality | "auto";
export type CameraShake = "off" | "reduced" | "full";

export interface UserSettings {
  mouseSensitivity: number;
  controllerSensitivity: number;
  invertY: boolean;
  musicVolume: number;
  sfxVolume: number;
  cameraShake: CameraShake;
  graphicsQuality: GraphicsSelection;
}
export type RuntimeSettings = Omit<UserSettings, "graphicsQuality"> & { graphicsQuality: GraphicsQuality };

export interface QualityPreset {
  pixelRatioCap: number;
  resolutionScale: number;
  worldDetailDistance: number;
  vehicleDetailDistance: number;
  particleCap: number;
  particleScale: number;
  trailScale: number;
  nearPropLimit: number;
  midPropLimit: number;
  farPropLimit: number;
  atmosphereScale: number;
}

export const SETTINGS_STORAGE_KEY = "planetfall:settings:v1";

export const QUALITY_PRESETS: Record<GraphicsQuality, QualityPreset> = {
  low: {
    pixelRatioCap: 1,
    resolutionScale: .72,
    worldDetailDistance: 100,
    vehicleDetailDistance: 100,
    particleCap: 90,
    particleScale: 0.55,
    trailScale: 0.55,
    nearPropLimit: 16,
    midPropLimit: 9,
    farPropLimit: 4,
    atmosphereScale: 0.72
  },
  medium: {
    pixelRatioCap: 1.35,
    resolutionScale: .9,
    worldDetailDistance: 165,
    vehicleDetailDistance: 180,
    particleCap: 135,
    particleScale: 0.78,
    trailScale: 0.78,
    nearPropLimit: 24,
    midPropLimit: 12,
    farPropLimit: 6,
    atmosphereScale: 0.88
  },
  high: {
    pixelRatioCap: 1.8,
    resolutionScale: 1,
    worldDetailDistance: 240,
    vehicleDetailDistance: 260,
    particleCap: 180,
    particleScale: 1,
    trailScale: 1,
    nearPropLimit: Number.POSITIVE_INFINITY,
    midPropLimit: 14,
    farPropLimit: 8,
    atmosphereScale: 1
  }
};

const clampNumber = (value: unknown, fallback: number, minimum: number, maximum: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;

export function defaultSettings(prefersReducedMotion = false): UserSettings {
  return {
    mouseSensitivity: 1,
    controllerSensitivity: 1,
    invertY: false,
    musicVolume: 0.8,
    sfxVolume: 0.9,
    cameraShake: prefersReducedMotion ? "reduced" : "full",
    graphicsQuality: "auto"
  };
}

export function validateSettings(value: unknown, prefersReducedMotion = false): UserSettings {
  const defaults = defaultSettings(prefersReducedMotion);
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const record = value as Record<string, unknown>;
  return {
    mouseSensitivity: clampNumber(record.mouseSensitivity, defaults.mouseSensitivity, 0.4, 2),
    controllerSensitivity: clampNumber(record.controllerSensitivity, defaults.controllerSensitivity, 0.4, 2),
    invertY: typeof record.invertY === "boolean" ? record.invertY : defaults.invertY,
    musicVolume: clampNumber(record.musicVolume, defaults.musicVolume, 0, 1),
    sfxVolume: clampNumber(record.sfxVolume, defaults.sfxVolume, 0, 1),
    cameraShake: record.cameraShake === "off" || record.cameraShake === "reduced" || record.cameraShake === "full"
      ? record.cameraShake
      : defaults.cameraShake,
    graphicsQuality: record.graphicsQuality === "auto" || record.graphicsQuality === "low" || record.graphicsQuality === "medium" || record.graphicsQuality === "high"
      ? record.graphicsQuality
      : defaults.graphicsQuality
  };
}

export function parseStoredSettings(raw: string | null, prefersReducedMotion = false): UserSettings {
  if (!raw) return defaultSettings(prefersReducedMotion);
  try { return validateSettings(JSON.parse(raw), prefersReducedMotion); }
  catch { return defaultSettings(prefersReducedMotion); }
}

export function shakeMultiplier(setting: CameraShake): number {
  return setting === "off" ? 0 : setting === "reduced" ? 0.35 : 1;
}

