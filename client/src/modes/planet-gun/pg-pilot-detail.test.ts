import {describe,it,expect} from "vitest";
import {pgPilotDetail} from "./pg-pilot-detail";
describe("PlanetGun pilot presentation scheduling",()=>{
 it("retains close opponents at full fidelity while lighter presets simplify distance",()=>{for(const q of["low","medium","high"]as const)expect(pgPilotDetail(8,q)).toBe("near");expect(pgPilotDetail(35,"low")).toBe("far");expect(pgPilotDetail(35,"medium")).toBe("mid");expect(pgPilotDetail(35,"high")).toBe("mid");expect(pgPilotDetail(50,"high")).toBe("mid");});
 it("avoids oscillation around both tier boundaries",()=>{expect(pgPilotDetail(26,"low","far")).toBe("far");expect(pgPilotDetail(23,"low","far")).toBe("mid");expect(pgPilotDetail(15,"low","near")).toBe("near");expect(pgPilotDetail(15,"low","mid")).toBe("mid");expect(pgPilotDetail(11,"low","mid")).toBe("near");});
});
