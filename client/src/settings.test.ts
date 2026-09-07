import { describe, expect, it } from "vitest";
import { QUALITY_PRESETS, defaultSettings, parseStoredSettings, shakeMultiplier, validateSettings } from "./settings";

describe("user settings", () => {
  it("uses comfort-aware defaults", () => {
    expect(defaultSettings(false).cameraShake).toBe("full");
    expect(defaultSettings(true).cameraShake).toBe("reduced");
  });

  it("validates and clamps stored settings", () => {
    const settings = validateSettings({ mouseSensitivity: 8, controllerSensitivity: .1, musicVolume: -2, sfxVolume: .45, invertY: true, cameraShake: "off", graphicsQuality: "medium" });
    expect(settings).toMatchObject({ mouseSensitivity: 2, controllerSensitivity: .4, musicVolume: 0, sfxVolume: .45, invertY: true, cameraShake: "off", graphicsQuality: "medium" });
  });

  it("falls back safely for corrupt storage", () => {
    expect(parseStoredSettings("{nope")).toEqual(defaultSettings());
  });

  it("keeps quality presets ordered and shake centralized", () => {
    expect(QUALITY_PRESETS.low.particleCap).toBeLessThan(QUALITY_PRESETS.medium.particleCap);
    expect(QUALITY_PRESETS.medium.particleCap).toBeLessThan(QUALITY_PRESETS.high.particleCap);
    expect(shakeMultiplier("off")).toBe(0);
    expect(shakeMultiplier("reduced")).toBeCloseTo(.35);
    expect(shakeMultiplier("full")).toBe(1);
  });
});
