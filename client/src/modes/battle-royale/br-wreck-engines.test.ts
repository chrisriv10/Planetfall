import {describe,expect,it} from "vitest";
import {BR_STRUCTURES} from "@planetfall/shared";
import {buildBrWreckEngineMounts} from "./br-wreck-engines";

describe("external wreck engine mounts",()=>{
  it("clears the full end wall and separates the sibling torus tubes",()=>{
    const s=BR_STRUCTURES.find(s=>s.id==="crash-fuselage")!,mounts=buildBrWreckEngineMounts(s);
    expect(mounts).toHaveLength(2);
    for(const m of mounts){
      expect(m.x+m.tube).toBeLessThanOrEqual(-s.size.x/2-.399);
      expect(m.emberX).toBeLessThan(-s.size.x/2-.325);
      expect(m.emberX).toBeGreaterThan(m.x);
      expect(m.y-m.radius-m.tube).toBeGreaterThan(0);
    }
    expect(mounts[1].z-mounts[0].z-2*(mounts[0].radius+mounts[0].tube)).toBeGreaterThan(.2);
  });
});
