import {describe,expect,it} from "vitest";
import {PG_MAP,pgCreateGun,type PgSnapshot} from "@planetfall/shared";
import {pgStrikeBuyView} from "./pg-strike-buy-state";

function fixture(){return {serverTime:10000,players:[{id:"me",team:"solar",hp:100,position:{...PG_MAP.spawns.find(spawn=>spawn.team==="solar")!.position},slot:1,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")]}],mode:{id:"planetstrike",subphase:"buy",deadline:20000,pilots:{me:{life:"alive",credits:800,armor:0,primaryUnlocked:false,utilities:[0,0,0]}}}}as unknown as PgSnapshot;}
describe("Strike purchase presentation gates",()=>{
 it("uses canonical prices and actual owned equipment rather than the locked placeholder primary",()=>{
  const snapshot=fixture(),view=pgStrikeBuyView(snapshot,"me")!;
  expect(view.secondsLeft).toBe(10);expect(view.items.find(item=>item.id==="pulse")).toMatchObject({price:2400,owned:false,available:false,reason:"Insufficient credits."});
  expect(view.items.find(item=>item.id==="orbit")).toMatchObject({owned:true,equipped:true,available:true});expect(view.items.find(item=>item.id==="armor")?.available).toBe(true);
 });
 it("explains phase, spawn, life, pending and inventory restrictions",()=>{
  const snapshot=fixture(),mode=snapshot.mode!;if(mode.id!=="planetstrike")throw Error();
  mode.pilots.me.armor=50;mode.pilots.me.utilities[0]=1;
  expect(pgStrikeBuyView(snapshot,"me")!.items.find(item=>item.id==="armor")?.reason).toContain("full");
  expect(pgStrikeBuyView(snapshot,"me")!.items.find(item=>item.id==="smoke")?.reason).toContain("already owned");
  expect(pgStrikeBuyView(snapshot,"me","armor")!.items.every(item=>!item.available)).toBe(true);
  snapshot.players[0].position={x:0,y:0,z:0};expect(pgStrikeBuyView(snapshot,"me")!.reason).toContain("spawn");
  mode.subphase="action";expect(pgStrikeBuyView(snapshot,"me")!.reason).toContain("buy phase");
  mode.pilots.me.life="eliminated";expect(pgStrikeBuyView(snapshot,"me")!.reason).toContain("alive");
 });
 it("closes at the exclusive deadline and rejects stale or absent observers",()=>{
  const snapshot=fixture();snapshot.serverTime=20000;expect(pgStrikeBuyView(snapshot,"me")!.items.every(item=>!item.available)).toBe(true);
  expect(pgStrikeBuyView(snapshot,"missing")).toBeNull();expect(pgStrikeBuyView(null,"me")).toBeNull();
 });
});
