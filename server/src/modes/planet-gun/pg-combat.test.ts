import {describe,it,expect} from "vitest";
import {pgCreateGun,type PgPlayer,type PgFireRequest} from "@planetfall/shared";
import {PgCombat} from "./pg-combat.js";

function pilot(id:string,x:number,team:"solar"|"void"):PgPlayer {
  // Combat only reads these fields; room construction supplies profile and movement lifecycle fields.
  return {id,team,hp:100,lifeId:1,position:{x,y:0,z:32},velocity:{x:0,y:0,z:0},yaw:-Math.PI/2,pitch:0,connected:true,isBot:false,crouched:false,grounded:true,slot:0,guns:[pgCreateGun("pulse"),pgCreateGun("comet")],adsSince:500,fireReadyAt:0,protectedUntil:0,mode:"ground"} as PgPlayer;
}
const request=(sequence=1,time=1000):PgFireRequest=>({sequence,clientTime:time,weapon:"pulse",yaw:-Math.PI/2,pitch:0});
describe("PlanetGun authoritative fire validation",()=>{
  it("damages a visible enemy from the authoritative eye origin",()=>{
    const c=new PgCombat(),a=pilot("a",-10,"solar"),b=pilot("b",0,"void");
    c.history.record([a,b],1000);const shots=c.fire(a,request(),[a,b],1000);
    expect(shots).toHaveLength(1);expect(shots[0].targetId).toBe("b");expect(b.hp).toBeLessThan(100);expect(a.guns[0].magazine).toBe(29);
  });
  it("rejects replay, cooldown, stale timestamps and weapon spoofing",()=>{
    const c=new PgCombat(),a=pilot("a",-10,"solar");c.history.record([a],1000);
    expect(c.fire(a,request(),[a],1000)).toHaveLength(1);
    expect(c.fire(a,request(),[a],1200)).toHaveLength(0);
    expect(c.fire(a,request(2,1001),[a],1001)).toHaveLength(0);
    expect(c.fire(a,request(3,600),[a],1200)).toHaveLength(0);
    expect(c.fire(a,{...request(4,1200),weapon:"rail"},[a],1200)).toHaveLength(0);
    expect(a.guns[0].magazine).toBe(29);
  });
  it("friendly astronauts block fire without receiving damage",()=>{
    const c=new PgCombat(),a=pilot("a",-10,"solar"),friend=pilot("f",-5,"solar"),enemy=pilot("e",0,"void"),all=[a,friend,enemy];
    c.history.record(all,1000);const shot=c.fire(a,request(),all,1000)[0];
    expect(shot.damage).toBe(0);expect(friend.hp).toBe(100);expect(enemy.hp).toBe(100);
  });
  it("rejects fire during reload, sprint, death and mismatched aim",()=>{
    for(const change of [(p:PgPlayer)=>{p.guns[0].reloadUntil=2000;},(p:PgPlayer)=>{p.mode="sprint";},(p:PgPlayer)=>{p.hp=0;},(p:PgPlayer)=>{p.yaw=0;}]){
      const c=new PgCombat(),a=pilot("a",-10,"solar");change(a);
      expect(c.fire(a,request(),[a],1000)).toEqual([]);expect(a.guns[0].magazine).toBe(30);
    }
  });
  it("does not hit through the habitat wall",()=>{
    const c=new PgCombat(),a=pilot("a",-40,"solar"),b=pilot("b",-30,"void");a.position.z=b.position.z=-18;
    c.history.record([a,b],1000);const shot=c.fire(a,request(),[a,b],1000)[0];
    expect(shot.damage).toBe(0);expect(shot.end.x).toBeLessThan(-34);expect(b.hp).toBe(100);
  });
  it("rewinds a moving enemy within 200ms and preserves distinct headshots",()=>{
    const c=new PgCombat(),a=pilot("a",-10,"solar"),b=pilot("b",0,"void");
    c.history.record([a,b],1000);b.position.z=36;c.history.record([a,b],1150);
    const shot=c.fire(a,request(1,1000),[a,b],1150)[0];
    expect(shot.targetId).toBe("b");expect(shot.headshot).toBe(true);expect(shot.damage).toBeGreaterThan(25);
  });
  it("a respawn cannot be damaged using the previous life's timestamp",()=>{
    const c=new PgCombat(),a=pilot("a",-10,"solar"),b=pilot("b",0,"void");c.history.record([a,b],1000);b.lifeId++;c.history.record([a,b],1100);
    expect(c.fire(a,request(1,1000),[a,b],1100)[0].damage).toBe(0);
  });
  it("respects respawn protection and permits firing from slide, air and wall run",()=>{
    for(const mode of ["slide","air","wall-run"]as const){const c=new PgCombat(),a=pilot("a",-10,"solar"),b=pilot("b",0,"void");a.mode=mode;b.protectedUntil=2000;c.history.record([a,b],1000);expect(c.fire(a,request(),[a,b],1000)).toHaveLength(1);expect(b.hp).toBe(100);}
  });
});
