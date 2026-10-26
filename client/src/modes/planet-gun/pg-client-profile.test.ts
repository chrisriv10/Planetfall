import {describe,it,expect} from "vitest";
import {PgClientProfile} from "./pg-client-profile";
describe("bounded client timing evidence",()=>{
 it("retains only the latest window and reports its tail rather than startup history",()=>{
  const p=new PgClientProfile();for(let i=0;i<1000;i++)p.snapshot(i,i/2);
  const s=p.read();expect(s.snapshotCpuMs.count).toBe(240);expect(s.snapshotCpuMs.mean).toBe(879.5);expect(s.snapshotCpuMs.median).toBe(880);expect(s.snapshotCpuMs.p95).toBe(988);expect(s.snapshotCpuMs.p99).toBe(997);expect(s.hudCpuMs.mean).toBe(439.75);
 });
 it("rejects invalid observations and distinguishes CPU submission from elapsed frame cadence",()=>{
  const p=new PgClientProfile();p.snapshot(NaN,Infinity);p.snapshot(-1,-5);expect(p.read().snapshotCpuMs.count).toBe(0);
  p.frame(100,101,103,106,110,115);const s=p.read();expect(s.frameCpuMs.mean).toBe(15);expect(s.inputCpuMs.mean).toBe(1);expect(s.viewmodelCpuMs.mean).toBe(2);expect(s.pilotsCpuMs.mean).toBe(3);expect(s.worldCpuMs.mean).toBe(4);expect(s.renderSubmitCpuMs.mean).toBe(5);
 });
});
