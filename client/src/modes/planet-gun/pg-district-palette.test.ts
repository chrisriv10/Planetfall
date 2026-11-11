import { Color } from "three";
import { expect, it } from "vitest";
import { PG_DISTRICT_PALETTE as base, PG_SURFACE_TINT as paint } from "./pg-district-palette";

it("keeps the district hues distinct after diffuse material and instance color multiply", () => {
  const albedo = (material: number, tint: number) => new Color(material).multiply(new Color(tint));
  const coral = albedo(base.west, paint.habitatCoral);
  const blueGlass = albedo(base.glass, paint.habitatGlass);
  const hydro = albedo(base.plazaPaving, paint.hydroTeal);
  const navy = albedo(base.plazaPaving, paint.transitNavy);
  expect(coral.r).toBeGreaterThan(coral.g * 2);
  expect(blueGlass.b).toBeGreaterThan(blueGlass.r * 2);
  expect(hydro.g).toBeGreaterThan(hydro.r * 2);
  expect(navy.b).toBeGreaterThan(navy.r * 2);
  expect(base.cyan).toBe(0x70dfff);
  expect(base.violet).toBe(0xc2a0ff);
});
