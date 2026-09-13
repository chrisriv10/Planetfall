import { expect,it } from "vitest";
import { BR_ROADS,BR_STRUCTURES } from "@planetfall/shared";
import { brRoadDetailClear } from "./br-road-detail";
it("does not paint intersecting curbs or road arrows through buildings",()=>{
  for(const structure of BR_STRUCTURES)expect(brRoadDetailClear(BR_ROADS[0],structure.position.x,structure.position.z)).toBe(false);
  const radial=BR_ROADS.find(r=>r.id==="radial-0")!;
  expect(brRoadDetailClear(radial,0,0)).toBe(false);
  expect(brRoadDetailClear(radial,-175,-135)).toBe(false);
});
