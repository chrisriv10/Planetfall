import { describe, expect, it } from "vitest";
import { shouldKeepStarlinerInDropView } from "./br-starliner-visibility";

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
});
