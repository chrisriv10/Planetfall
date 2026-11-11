import {describe,it,expect} from "vitest";
import {PG_MAP,pgSpawnMotion,type PgSnapshot,type PgSnapshotPlayer} from "@planetfall/shared";
import {PgCameraLifecycle} from "./pg-camera-lifecycle";
const pilot=(id:string,x:number,hp=100)=>({...pgSpawnMotion({x,y:0,z:-34}),id,lifeId:1,team:"solar",hp,connected:true,isBot:false} as PgSnapshotPlayer);
function scene(){const me=pilot("me",-30,0),a=pilot("a",-20),b=pilot("b",-10);const s={players:[me,a,b]} as PgSnapshot;return {me,a,b,s,view:new PgCameraLifecycle()};}
const pose=(f:ReturnType<typeof scene>)=>f.view.pose(f.s,f.me,f.me,.7,.2,{x:0,y:0,z:0},PG_MAP);
describe("PlanetGun camera ownership",()=>{
 it("follows from outside the target astronaut instead of its eye position",()=>{const f=scene(),p=pose(f);expect(p.kind).toBe("spectator");expect(p.targetId).toBe("a");expect(Math.hypot(p.position.x-f.a.position.x,p.position.y-(f.a.position.y+1.57),p.position.z-f.a.position.z)).toBeGreaterThan(1);});
 it("retains a chosen target, cycles both ways, and handles death/disconnect",()=>{const f=scene();pose(f);f.view.cycle(f.s,f.me,1);expect(pose(f).targetId).toBe("b");f.view.cycle(f.s,f.me,-1);expect(pose(f).targetId).toBe("a");f.a.connected=false;expect(pose(f).targetId).toBe("b");f.b.hp=0;expect(pose(f).targetId).toBeNull();});
 it("reattaches to the new local life without spectator orientation or offsets",()=>{const f=scene();pose(f);f.view.look(400,80,.0022,false);f.me.hp=100;f.me.lifeId++;f.me.position={x:40,y:0,z:0};const p=pose(f);expect(p).toMatchObject({kind:"local",targetId:null,yaw:.7,pitch:.2,position:{x:40,y:1.57,z:0}});expect(f.view.targetId).toBeNull();});
 it("keeps spectator mouse motion separate from the local aim",()=>{const f=scene(),before=pose(f);f.view.look(100,0,.0022,false);const after=pose(f);expect(after.yaw).not.toBe(before.yaw);f.me.hp=100;f.me.lifeId++;expect(pose(f).yaw).toBe(.7);});
 it("does not place the boom beyond an opaque wall",()=>{const f=scene();f.a.position={x:0,y:0,z:0};const wall={id:"back-wall",kind:"structure" as const,center:{x:0,y:2,z:2},half:{x:10,y:2,z:.2},mantle:false};const p=f.view.pose(f.s,f.me,f.me,0,0,{x:0,y:0,z:0},{...PG_MAP,solids:[wall]});expect(p.position.z).toBeLessThan(1.8);expect(Math.hypot(p.position.x,p.position.y-1.57,p.position.z)).toBeGreaterThan(.7);});
});
