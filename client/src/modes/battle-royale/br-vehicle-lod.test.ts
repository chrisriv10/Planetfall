import { describe, expect, it } from "vitest";
import { useFarBrVehicle } from "./br-vehicle-lod";

describe("BR vehicle detail policy", () => {
  it("keeps the locally driven vehicle detailed at any camera distance", () => {
    for(const quality of ["low","medium","high"] as const)expect(useFarBrVehicle(800,quality,true,true)).toBe(false);
  });
  it("keeps a steady model inside the hysteresis band and recovers detail on approach", () => {
    expect(useFarBrVehicle(101,"low",false,false)).toBe(true);
    expect(useFarBrVehicle(90,"low",true,false)).toBe(true);
    expect(useFarBrVehicle(90,"low",false,false)).toBe(false);
    expect(useFarBrVehicle(74,"low",true,false)).toBe(false);
    expect(useFarBrVehicle(200,"medium",false,false)).toBe(true);
    expect(useFarBrVehicle(200,"high",false,false)).toBe(false);
    expect(useFarBrVehicle(Number.NaN,"low",true,false)).toBe(false);
  });
});
