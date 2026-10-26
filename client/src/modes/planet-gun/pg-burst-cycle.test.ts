import {describe,it,expect} from "vitest";
import {PgBurstCycle,type PgBurstAuthority} from "./pg-burst-cycle";
const initial=(extra:Partial<PgBurstAuthority>={}):PgBurstAuthority=>({weapon:"helix",lifeId:1,serverTime:1000,shots:0,nextFireAt:0,burstShots:3,intervalMs:80,recoveryMs:300,...extra});
function setup(){const cycle=new PgBurstCycle();cycle.observe(initial());cycle.setTrigger(true);return cycle;}
describe("PlanetGun accepted Helix burst cycles",()=>{
 it("counts accepted rounds rather than emitted requests and flushes all three after release",()=>{
  const c=setup();expect(c.request(1000,true)).toBe(true);expect(c.acceptedRounds).toBe(0);expect(c.remaining).toBe(3);expect(c.inFlight).toBe(true);c.setTrigger(false);
  c.observe(initial({serverTime:1050,shots:1,nextFireAt:1080}));expect(c.acceptedRounds).toBe(1);expect(c.pending).toBe(true);expect(c.request(1079,true)).toBe(false);expect(c.request(1080,true)).toBe(true);
  c.observe(initial({serverTime:1130,shots:2,nextFireAt:1160}));expect(c.request(1160,true)).toBe(true);expect(c.pending).toBe(true);
  c.observe(initial({serverTime:1210,shots:3,nextFireAt:1460}));expect(c.pending).toBe(false);expect(c.acceptedRounds).toBe(3);expect(c.request(1460,true)).toBe(false);
 });
 it("keeps one request in flight until a snapshot acknowledges it",()=>{
  const c=setup();expect(c.request(1000,true)).toBe(true);for(const at of [1000,1080,1160,1249,1400])expect(c.request(at,true)).toBe(false);expect(c.acceptedRounds).toBe(0);
  c.observe(initial({serverTime:1400,shots:1,nextFireAt:1160}));expect(c.request(1400,true)).toBe(true);expect(c.remaining).toBe(2);
 });
 it("retries a rejected round only after a fresh snapshot proves the original request expired",()=>{
  const c=setup();expect(c.request(1000,true)).toBe(true);c.observe(initial({serverTime:1050,shots:1,nextFireAt:1080}));expect(c.request(1080,true)).toBe(true);
  // The server rejected the early second packet; neither time nor stale state alone permits retry.
  c.observe(initial({serverTime:1200,shots:1,nextFireAt:1100}));expect(c.request(1400,true)).toBe(false);
  c.observe(initial({serverTime:1330,shots:1,nextFireAt:1100}));expect(c.request(1400,true)).toBe(true);expect(c.acceptedRounds).toBe(1);
  c.observe(initial({serverTime:1450,shots:2,nextFireAt:1480}));expect(c.request(1480,true)).toBe(true);c.observe(initial({serverTime:1530,shots:3,nextFireAt:1780}));expect(c.pending).toBe(false);
 });
 it("honors authoritative cooldown, predicted cadence and readiness after jitter",()=>{
  const c=setup();expect(c.request(1000,false)).toBe(false);expect(c.request(1000,true)).toBe(true);
  c.observe(initial({serverTime:1050,shots:1,nextFireAt:1110}));expect(c.request(1080,true)).toBe(false);expect(c.request(1110,true)).toBe(true);
  c.observe(initial({serverTime:1140,shots:2,nextFireAt:1160}));expect(c.request(1189,true)).toBe(false);expect(c.request(1190,true)).toBe(true);
 });
 it("never starts another burst from a held trigger and preserves recovery for a fresh press",()=>{
  const c=setup();c.request(1000,true);c.observe(initial({serverTime:1050,shots:1,nextFireAt:1080}));c.request(1080,true);c.observe(initial({serverTime:1130,shots:2,nextFireAt:1160}));c.request(1160,true);c.observe(initial({serverTime:1210,shots:3,nextFireAt:1460}));
  c.setTrigger(true);expect(c.request(1500,true)).toBe(false);c.setTrigger(false);c.setTrigger(true);expect(c.request(1459,true)).toBe(false);expect(c.request(1460,true)).toBe(true);expect(c.acceptedRounds).toBe(0);
 });
 it("cancels reload, switch, overlay and death without a phantom shot or held-trigger restart",()=>{
  for(const cause of ["reload","switch","overlay","death"]){const c=setup();c.request(1000,true);c.cancel();expect(c.pending,cause).toBe(false);expect(c.inFlight,cause).toBe(false);c.setTrigger(true);expect(c.request(2000,true),cause).toBe(false);c.setTrigger(false);c.setTrigger(true);expect(c.request(2000,true),cause).toBe(true);}
 });
 it("automatically cancels on weapon/life changes and ignores stale snapshots",()=>{
  const c=setup();c.request(1000,true);c.observe(initial({serverTime:1100,shots:1,nextFireAt:1130}));
  c.observe(initial({serverTime:1050,shots:0}));c.observe(initial({serverTime:1150,shots:0}));expect(c.acceptedRounds).toBe(1);expect(c.request(1130,true)).toBe(true);
  c.observe(initial({weapon:"orbit",serverTime:1200,shots:0,burstShots:0}));expect(c.pending).toBe(false);expect(c.request(2000,true)).toBe(false);
  c.observe(initial({lifeId:2,serverTime:1300,shots:0}));c.setTrigger(true);expect(c.request(2000,true)).toBe(false);c.setTrigger(false);c.setTrigger(true);expect(c.request(2000,true)).toBe(true);
  c.observe(initial({lifeId:1,serverTime:1200,shots:99}));expect(c.acceptedRounds).toBe(0);expect(c.inFlight).toBe(true);
 });
});
