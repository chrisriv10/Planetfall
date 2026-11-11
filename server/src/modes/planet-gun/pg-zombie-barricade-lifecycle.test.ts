import {describe,expect,it,vi} from "vitest";
import {DEFAULT_COSMETICS,PG_BALANCE,PG_ZOMBIE_BARRICADE_SITES,PG_ZOMBIE_BARRICADE_REPAIR_MS,pgCapsuleClear,pgCreateGun,pgSpawnMotion,type PgPlayer} from "@planetfall/shared";
import {PgModeWorld} from "./pg-mode-world.js";
import {PgZombies} from "./pg-zombies.js";
const distance=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function fixture(count=1){
 const players=new Map<string,PgPlayer>();for(let i=0;i<count;i++){
  const p={...pgSpawnMotion({x:-28,y:0,z:-9}),id:`pilot-${i}`,name:`Pilot ${i}`,color:"#fff",team:"solar",isBot:false,connected:true,ready:true,hp:100,kills:0,deaths:0,lifeId:1,deadAt:0,respawnAt:0,protectedUntil:0,lastDamageAt:0,lastAttacker:null,lastInputSequence:0,loadout:{primary:"pulse",secondary:"orbit"},slot:0,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],adsSince:0,fireReadyAt:0,fallbucks:250,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:[]} as PgPlayer;players.set(p.id,p);
 }
 const world=new PgModeWorld(),mode=new PgZombies({players,world,damage:vi.fn(()=>0),finish:vi.fn(),respawn:(p,_now,loadout,position)=>{Object.assign(p,pgSpawnMotion(position??p.position));if(loadout)p.loadout=loadout;p.guns=[pgCreateGun(p.loadout.primary),pgCreateGun(p.loadout.secondary)];p.hp=100;}});mode.start(0);
 const p=players.get("pilot-0")!,site=PG_ZOMBIE_BARRICADE_SITES[2];let sequence=0;
 const hold=(pilot=p,now=100)=>mode.action(pilot,{kind:"interact",targetId:`barricade:${site.id}`,held:true,lifeId:pilot.lifeId,sequence:++sequence},now);
 return {players,world,mode,p,site,hold};
}
describe("Zombies physical barricade lifecycle",()=>{
 it("installs9 real30HP planks and repairs exactly one after a valid1500ms hold with no rewards",()=>{
  const {world,mode,p,site,hold}=fixture();expect(world.snapshot().panels.filter(panel=>panel.id.startsWith("barricade-"))).toHaveLength(9);
  const board=site.boards[0];world.damage(board.id,30,1);p.position={...site.interaction};const before=mode.snapshot().pilots[p.id];
  expect(hold().ok).toBe(true);expect(mode.snapshot().pilots[p.id].interaction).toMatchObject({targetId:`barricade:${site.id}`,durationMs:1500});
  mode.update(0,100+PG_ZOMBIE_BARRICADE_REPAIR_MS-1);expect(world.snapshot().panels.find(panel=>panel.id===board.id)!.active).toBe(false);
  const oldMap=world.map,revision=world.revision;mode.update(0,1600);
  expect(world.snapshot().panels.find(panel=>panel.id===board.id)).toMatchObject({active:true,hp:30,maxHp:30,reinforced:false});expect(world.map).not.toBe(oldMap);expect(world.revision).toBeGreaterThan(revision);
  expect(mode.snapshot().pilots[p.id]).toMatchObject({points:before.points,contribution:before.contribution,purchases:before.purchases,interaction:null});expect(hold(p,1601).ok).toBe(false);
 });
 it("cancels moved, released and damaged holds without changing planks",()=>{
  const {mode,world,p,site,hold}=fixture();world.damage(site.boards[0].id,30,1);p.position={...site.interaction};expect(hold().ok).toBe(true);
  p.position.x+=.81;mode.update(0,1600);expect(world.snapshot().panels.find(panel=>panel.id===site.boards[0].id)!.active).toBe(false);
  p.position={...site.interaction};expect(hold(p,1700).ok).toBe(true);mode.action(p,{kind:"interact",targetId:`barricade:${site.id}`,held:false,sequence:100,lifeId:p.lifeId},1800);mode.update(0,3200);expect(mode.snapshot().pilots[p.id].interaction).toBeNull();
  mode.action(p,{kind:"interact",targetId:`barricade:${site.id}`,held:true,sequence:101,lifeId:p.lifeId},3300);mode.damage(p,null,1,3400);mode.update(0,4800);expect(world.snapshot().panels.find(panel=>panel.id===site.boards[0].id)!.active).toBe(false);
 });
 it("rechecks standing survivor/infected occupancy at completion and never rebuilds through them",()=>{
  for(const infected of [false,true]){
   const {mode,world,p,players,site,hold}=fixture(2);world.damage(site.boards[0].id,30,1);p.position={...site.interaction};players.get("pilot-1")!.position={x:-28,y:0,z:-9};expect(hold().ok).toBe(true);
   const occupied={...site.position};if(infected)mode["spawnAt"](occupied,p,200);else players.get("pilot-1")!.position=occupied;
   mode.update(0,1600);expect(world.snapshot().panels.find(panel=>panel.id===site.boards[0].id)!.active).toBe(false);expect(mode.snapshot().pilots[p.id].interaction).toBeNull();
  }
 });
 it("does not let simultaneous holds restore a second board or farm points",()=>{
  const {mode,world,p,players,site,hold}=fixture(2),friend=players.get("pilot-1")!;
  world.damage(site.boards[0].id,30,1);world.damage(site.boards[1].id,30,2);p.position={...site.interaction};friend.position={...site.interaction,x:site.interaction.x+.6};
  expect(hold(p).ok).toBe(true);expect(hold(friend).ok).toBe(true);const points=[p,friend].map(player=>mode.snapshot().pilots[player.id].points);
  mode.update(0,1600);expect(site.boards.filter(board=>world.snapshot().panels.find(panel=>panel.id===board.id)!.active)).toHaveLength(2);
  expect([p,friend].map(player=>mode.snapshot().pilots[player.id].points)).toEqual(points);
 });
 it("rebuilds only an existing inactive panel and preserves its health cap, identity and rewind blockers",()=>{
  const {world,site}=fixture(),board=site.boards[0];world.damage(board.id,30,100);const broken=world.snapshot(),oldMap=world.map;
  for(const [id,now]of [["unknown",200],[board.id,NaN],[board.id,-1]] as const)expect(world.rebuild(id,now)).toBe(false);
  expect(world.snapshot()).toEqual(broken);expect(world.map).toBe(oldMap);
  expect(world.rebuild(board.id,200)).toBe(true);expect(world.snapshot().panels.find(panel=>panel.id===board.id)).toMatchObject({id:board.id,hp:30,maxHp:30,active:true,solid:board.solid});
  expect(world.shotSolids(150,200).some(solid=>solid.id===board.solid.id)).toBe(true);
  const rebuilt=world.snapshot();expect(world.rebuild(board.id,201)).toBe(false);expect(world.snapshot()).toEqual(rebuilt);
 });
 it.each(PG_ZOMBIE_BARRICADE_SITES)("uses ordinary infected attack cadence to breach $id then physically pursue the survivor",site=>{
  const {mode,world,p}=fixture();mode["spawnAt"](site.entry,p,0,site.id);const zombie=[...mode["zombies"].values()][0],board=site.boards[0];
  mode["updateZombie"](zombie,1/30,700);expect(world.snapshot().panels.find(panel=>panel.id===board.id)!.hp).toBe(30);
  const dx=site.position.x-zombie.position.x,dz=site.position.z-zombie.position.z;expect((-Math.sin(zombie.yaw)*dx-Math.cos(zombie.yaw)*dz)/Math.hypot(dx,dz)).toBeCloseTo(1);
  expect(zombie.windupUntil).toBe(1350);mode["updateZombie"](zombie,1/30,1349);expect(world.snapshot().panels.find(panel=>panel.id===board.id)!.hp).toBe(30);
  mode["updateZombie"](zombie,1/30,1350);expect(world.snapshot().panels.find(panel=>panel.id===board.id)!.hp).toBe(8);
  let breached=false,reached=false;
  for(let tick=42;tick<=1800;tick++){
   const old={...zombie.position};mode["updateZombie"](zombie,1/30,tick*1000/30);
   expect(Math.hypot(old.x-zombie.position.x,old.z-zombie.position.z)).toBeLessThan(.2);
   expect(pgCapsuleClear(zombie.position,PG_BALANCE.height,world.map)).toBe(true);
   breached=site.boards.every(board=>!world.snapshot().panels.find(panel=>panel.id===board.id)!.active);
   if(breached&&distance(zombie.position,p.position)<2.1){reached=true;break;}
  }
  expect(breached).toBe(true);expect(zombie.barricadeId).toBeNull();expect(reached,JSON.stringify({position:zombie.position,destination:zombie.destination})).toBe(true);
  const brokenMap=world.map,topology=world.revision;expect(world.rebuild(board.id,61000)).toBe(true);expect(world.map).not.toBe(brokenMap);expect(world.revision).toBeGreaterThan(topology);expect(world.map.solids.some(solid=>solid.id===board.solid.id)).toBe(true);expect(world.rebuild(board.id,61001)).toBe(false);
 });
});
