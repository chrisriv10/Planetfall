import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanetfallGame } from "./game";
import { BattleRoyaleGame } from "./modes/battle-royale/br-game";
import { defaultSettings, QUALITY_PRESETS } from "./settings";

// Exercise the actual lifecycle methods without constructing a WebGL context,
// full world or audio graph. A shared fake renderer exposes cross-mode writes.
function fixture(active: boolean) {
  const renderer = { setSize: vi.fn(), setPixelRatio: vi.fn(), setAnimationLoop: vi.fn(), shadowMap: { enabled: true } };
  const camera = { aspect: 0, updateProjectionMatrix: vi.fn() };
  const classic = Object.assign(Object.create(PlanetfallGame.prototype), {
    active, renderer, camera, quality: QUALITY_PRESETS.high,
    audio: { setVolumes: vi.fn() }
  });
  const br = Object.assign(Object.create(BattleRoyaleGame.prototype), {
    active: !active, renderer, camera: { ...camera, updateProjectionMatrix: vi.fn() },
    settings: defaultSettings(), world: { setQuality: vi.fn() }, sun: { castShadow: false },
    syncPlayers: vi.fn(), syncVehicles: vi.fn(), input: { method: "keyboard" }
  });
  return { classic, br, renderer };
}

describe("shared renderer mode ownership", () => {
  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1440);
    vi.stubGlobal("innerHeight", 900);
    vi.stubGlobal("devicePixelRatio", 2);
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([true, false])("only the active mode resizes the shared framebuffer (Classic active: %s)", (classicActive) => {
    const { classic, br, renderer } = fixture(classicActive);
    classic.resize(); br.resize();
    expect(classic.camera.aspect).toBe(1.6);
    expect(br.camera.aspect).toBe(1.6);
    expect(renderer.setSize).toHaveBeenCalledExactlyOnceWith(1440, 900);
    expect(renderer.setPixelRatio).toHaveBeenCalledExactlyOnceWith(1.8);
  });

  it("inactive settings update the mode, not the other mode's framebuffer or shadows", () => {
    const { classic, br, renderer } = fixture(true);
    br.setSettings({ ...defaultSettings(), graphicsQuality: "low" });
    expect(br.world.setQuality).toHaveBeenCalledWith("low");
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.setSize).not.toHaveBeenCalled();
    expect(renderer.setPixelRatio).not.toHaveBeenCalled();
    classic.active = false; br.active = true;
    classic.setSettings({ ...defaultSettings(), graphicsQuality: "medium" });
    expect(classic.quality).toBe(QUALITY_PRESETS.medium);
    expect(renderer.setPixelRatio).not.toHaveBeenCalled();
  });

  it("restores the current viewport when Classic takes the renderer back", () => {
    const { classic, renderer } = fixture(false);
    classic.setActive(true);
    expect(renderer.setSize).toHaveBeenCalledExactlyOnceWith(1440, 900);
    expect(renderer.setPixelRatio).toHaveBeenCalledExactlyOnceWith(1.8);
    expect(renderer.setAnimationLoop).toHaveBeenCalledOnce();
  });

  it("restores BR settings on activation but does not reallocate on room updates", () => {
    const { br, renderer } = fixture(true);
    br.settings.graphicsQuality = "low";
    const room = { phase: "lobby", players: [], vehicles: [] };
    br.activate(room, "pilot");
    expect(renderer.shadowMap.enabled).toBe(false);
    expect(renderer.setSize).toHaveBeenCalledExactlyOnceWith(1440, 900);
    expect(renderer.setPixelRatio).toHaveBeenCalledExactlyOnceWith(1);
    br.activate(room, "pilot");
    expect(renderer.setSize).toHaveBeenCalledOnce();
  });
});
