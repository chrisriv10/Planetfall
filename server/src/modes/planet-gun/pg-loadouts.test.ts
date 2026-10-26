import {describe,it,expect} from "vitest";
import {PG_BALANCE,pgGunProfile,type PgLoadout} from "@planetfall/shared";
import {PlanetGunRoom} from "./pg-room.js";

function setup(){
 const io={to:()=>({emit:()=>{}})},room=new PlanetGunRoom("KITS",io as never);
 const join=(id:string)=>{const result=room.join({id,data:{},join:()=>Promise.resolve()} as never,id);if(!result.ok)throw Error(result.error);return result.playerId;};
 const id=join("host");join("other");room.configure(id,{fillBots:false});room.setReady(id,true);
 for(const player of room.players.values())room.setReady(player.id,true);
 return {room,id,p:room.players.get(id)!};
}
const kit:PgLoadout={primary:"helix",secondary:"orbit",primaryModules:["expanded-cell","gyro-stabilizer"],secondaryModules:["lightweight-frame"],kitId:2,name:"Burst Scout"};
describe("PlanetGun authoritative kit selection",()=>{
 it("applies validated kits between matches with authoritative module profiles",()=>{
  const {room,id,p}=setup();room.setLoadout(id,kit);expect(p.loadout.primary).toBe("helix");expect(p.guns[1].id).toBe("orbit");expect(p.guns[0].magazine).toBe(33);expect(pgGunProfile(p.guns[0]).recoil).toBeLessThan(.025);
 });
 it("queues alive selection without changing guns, health or ammunition, then applies on respawn",()=>{
  const {room,id,p}=setup(),now=Date.now();expect(room.start(id,now)).toBe(true);room.update(0,now+PG_BALANCE.countdownMs);
  p.guns[0].magazine=9;p.hp=43;const guns=p.guns;
  room.setLoadout(id,kit);expect(p.loadout.primary).toBe("pulse");expect(p.guns).toBe(guns);expect(p.guns[0].magazine).toBe(9);expect(p.hp).toBe(43);expect(p.queuedLoadout).toEqual(kit);
  expect(room.snapshot(now).players.find(x=>x.id===id)?.queuedLoadout).toEqual(kit);
  p.position.y=-10;room.update(1/60,now+PG_BALANCE.countdownMs+20);expect(p.hp).toBe(0);
  room.update(1/60,now+PG_BALANCE.countdownMs+PG_BALANCE.respawnMs+40);expect(p.hp).toBe(100);expect(p.loadout).toEqual(kit);expect(p.guns[0].id).toBe("helix");expect(p.guns[1].id).toBe("orbit");expect(p.queuedLoadout).toBeUndefined();
 });
 it("keeps a dead selection queued until the next life and uses the newest valid selection",()=>{
  const {room,id,p}=setup(),now=Date.now();room.start(id,now);room.update(0,now+PG_BALANCE.countdownMs);p.position.y=-10;room.update(1/60,now+PG_BALANCE.countdownMs+20);
  room.setLoadout(id,kit);room.setLoadout(id,{primary:"arc",secondary:"orbit"});expect(p.loadout.primary).toBe("pulse");expect(p.guns[0].id).toBe("pulse");
  room.update(1/60,now+PG_BALANCE.countdownMs+PG_BALANCE.respawnMs+40);expect(p.loadout.primary).toBe("arc");expect(p.guns[1].id).toBe("orbit");
 });
 it("rejects arbitrary stats and invalid module combinations without replacing the queued kit",()=>{
  const {room,id,p}=setup(),now=Date.now();room.start(id,now);room.update(0,now+PG_BALANCE.countdownMs);room.setLoadout(id,kit);
  for(const bad of [{...kit,damage:999},{...kit,primaryModules:["expanded-cell","rapid-charge-cell"]},{...kit,secondaryModules:["reflex-array","gyro-stabilizer"]},{...kit,primary:"orbit"},{...kit,secondary:"helix"}])room.setLoadout(id,bad as PgLoadout);
  expect(p.queuedLoadout).toEqual(kit);expect(p.guns[0].id).toBe("pulse");
 });
 it("cancels interrupted burst state across switching and death",()=>{
  const {room,id,p}=setup(),now=Date.now();room.setLoadout(id,kit);room.start(id,now);room.update(0,now+PG_BALANCE.countdownMs);
  p.guns[0].burstRemaining=2;room.switchWeapon(id,1,now+PG_BALANCE.countdownMs+10);expect(p.guns[0].burstRemaining).toBe(0);
  p.guns[0].burstRemaining=1;p.position.y=-10;room.update(1/60,now+PG_BALANCE.countdownMs+30);expect(p.hp).toBe(0);expect(p.guns.every(g=>!g.burstRemaining)).toBe(true);
 });
});
