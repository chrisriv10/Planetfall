import { describe, expect, it } from "vitest";
import { brAimProfile, brCameraGeometry, brCameraMode, brDropEntryPitch, brShipLookState } from "./br-camera";

describe("Battle Royale camera rig", () => {
  it("keeps physical camera orbit independent from aim pitch", () => {
    const low = brCameraGeometry({ x: 4, y: 2, z: 8 }, .6, -.8, "grounded");
    const high = brCameraGeometry({ x: 4, y: 2, z: 8 }, .6, .8, "grounded");
    expect(high.desired).toEqual(low.desired);
    expect(high.focus).toEqual(low.focus);
    expect(high.aimDirection.y).toBeGreaterThan(0);
    expect(low.aimDirection.y).toBeLessThan(0);
  });

  it("orbits horizontally from yaw and preserves the requested boom", () => {
    const rig = brCameraGeometry({ x: 0, y: 0, z: 0 }, Math.PI / 2, .2, "grounded");
    const backX = rig.desired.x - rig.right.x * rig.shoulder;
    const backZ = rig.desired.z - rig.right.z * rig.shoulder;
    expect(Math.hypot(backX, backZ)).toBeCloseTo(rig.boom, 6);
    expect(rig.horizontalForward.x).toBeCloseTo(1, 6);
    expect(rig.desired.y).toBeCloseTo(2.05, 6);
  });

  it("selects separate gameplay camera states", () => {
    expect(brCameraMode("grounded", false, false, false)).toBe("grounded");
    expect(brCameraMode("grounded", false, true, false)).toBe("aiming");
    expect(brCameraMode("freefall", false, false, false)).toBe("freefall");
    expect(brCameraMode("chute", false, false, false)).toBe("chute");
    expect(brCameraMode("grounded", true, false, false)).toBe("downed");
    expect(brCameraMode("grounded", false, false, true)).toBe("spectator");
  });

  it("tips an untouched ship view toward the island without overriding deliberate input", () => {
    expect(brDropEntryPitch(-.08)).toBe(-.3);
    expect(brDropEntryPitch(.12)).toBe(-.3);
    expect(brDropEntryPitch(-.42)).toBe(-.42);
    expect(brDropEntryPitch(.45)).toBe(.45);
  });

  it("uses route-facing Starliner yaw for initialization only",()=>{
    const initial=brShipLookState(.25,{x:1,z:0},false);
    expect(initial.yaw).toBeCloseTo(Math.PI/2);
    const deliberate=brShipLookState(-2.4,{x:1,z:0},initial.initialized);
    expect(deliberate.yaw).toBe(-2.4);
  });

  it("provides functional precision and medium-range optics",()=>{
    expect(brAimProfile("rail-laser",true)).toEqual({fov:36,sensitivity:.42,scope:"rail"});
    expect(brAimProfile("pulse-rifle",true)).toEqual({fov:52,sensitivity:.68,scope:"pulse"});
    expect(brAimProfile("nova-smg",true)).toEqual({fov:62,sensitivity:.82,scope:null});
    expect(brAimProfile("rail-laser",false)).toEqual({fov:70,sensitivity:1,scope:null});
  });
});
