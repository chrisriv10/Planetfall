import { describe, expect, it } from "vitest";
import { BR_STARLINER_CAMERA_CULL_RADIUS, shouldHideStarlinerNearCamera, shouldKeepStarlinerInDropView } from "./br-starliner-visibility";

describe("Starliner drop visibility",()=>{
  it("keeps the ship visible while the rendered local pilot is attached",()=>{
    expect(shouldKeepStarlinerInDropView("ship","attached","grounded")).toBe(true);
    expect(shouldKeepStarlinerInDropView("ship",undefined,"attached")).toBe(true);
  });
  it("keeps the initial ship frame visible before the first local snapshot",()=>{
    expect(shouldKeepStarlinerInDropView("ship",undefined,undefined)).toBe(true);
  });
  it("allows near-camera culling after the local pilot jumps",()=>{
    expect(shouldKeepStarlinerInDropView("ship","freefall","attached")).toBe(false);
    expect(shouldKeepStarlinerInDropView("combat","attached","attached")).toBe(false);
  });
  it("covers the full post-jump hull and exhaust envelope without hiding an attached transport",()=>{
    expect(shouldHideStarlinerNearCamera("ship","attached","attached",10)).toBe(false);
    expect(shouldHideStarlinerNearCamera("ship","freefall","attached",BR_STARLINER_CAMERA_CULL_RADIUS-1)).toBe(true);
    expect(shouldHideStarlinerNearCamera("combat","grounded","grounded",BR_STARLINER_CAMERA_CULL_RADIUS-1)).toBe(true);
    expect(shouldHideStarlinerNearCamera("combat","grounded","grounded",BR_STARLINER_CAMERA_CULL_RADIUS+1)).toBe(false);
    expect(shouldHideStarlinerNearCamera("combat","grounded","grounded",Number.NaN)).toBe(false);
  });
});
