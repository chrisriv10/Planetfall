import {describe,it,expect} from "vitest";
import {PgRenderCorrection} from "./pg-render-correction";
const v=(x=0,y=0,z=0)=>({x,y,z});
describe("PlanetGun camera-only reconciliation",()=>{
 it("preserves presentation across a small correction while simulation changes immediately",()=>{const r=new PgRenderCorrection(),before=v(.08),after=v();expect(r.correct(before,after)).toBe(true);expect(after.x).toBe(0);expect(after.x+r.offset.x).toBeCloseTo(before.x);r.update(.105);expect(r.offset.x).toBeLessThan(.0041);});
 it("does not delay newly predicted movement or mouse look",()=>{const r=new PgRenderCorrection();r.correct(v(.08),v());const before=0+r.offset.x,after=.12+r.offset.x;expect(after-before).toBeCloseTo(.12);expect(Object.keys(r.offset)).toEqual(["x","y","z"]);});
 it("composes successive corrections without discontinuity",()=>{const r=new PgRenderCorrection();r.correct(v(.08),v());r.update(.016);const shown=.2+r.offset.x;r.correct(v(.2),v(.17));expect(.17+r.offset.x).toBeCloseTo(shown);});
 it("snaps large, vertical, respawn and invalid corrections instead of hiding divergence",()=>{for(const [before,continuous]of [[v(1),true],[v(0,.5),true],[v(.04),false],[v(NaN),true]]as const){const r=new PgRenderCorrection();r.correct(v(.03),v());expect(r.correct(before,v(),continuous)).toBe(false);expect(r.offset).toEqual(v());}});
});
