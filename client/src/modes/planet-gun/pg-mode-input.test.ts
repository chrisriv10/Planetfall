import {describe,it,expect} from "vitest";
import {PG_OBJECTIVES,pgSpawnMotion,type PgSnapshot,type PgSnapshotPlayer} from "@planetfall/shared";
import {pgNearbyModeInteraction} from "./pg-mode-input";
function fixture(){
 const p={...pgSpawnMotion(PG_OBJECTIVES.strike[0].position),id:"a",team:"solar"} as PgSnapshotPlayer;
 const mode:Extract<NonNullable<PgSnapshot["mode"]>,{id:"planetstrike"}>={id:"planetstrike",collision:{revision:0,panels:[]},effects:[],round:1,deadline:105000,subphase:"action",attackTeam:"solar",roundScores:{solar:0,void:0},pilots:{a:{life:"alive",maxHp:100,shield:0,characterId:null,side:"attack",credits:800,armor:0,cooldowns:[0,0],charges:[0,0],ultimate:0,contribution:0,interaction:null,carrying:true,utilities:[0,0,0],primaryUnlocked:false}},charge:{carrierId:"a",site:null,position:null,detonatesAt:0},drops:[]};
 const snapshot:PgSnapshot={phase:"playing",serverTime:100,phaseEndsAt:105000,scores:{solar:0,void:0},winner:null,players:[p],feed:[],mode};return {p,mode,snapshot};
}
describe("mode interaction targeting",()=>{
 it("offers the charge carrier a nearby planting site",()=>{const f=fixture();expect(pgNearbyModeInteraction(f.snapshot,f.p)).toEqual({kind:"interact",targetId:"site-A",held:true});});
 it("offers a planted charge only to defenders",()=>{
  const f=fixture();f.mode.charge={carrierId:null,site:"A",position:{...f.p.position},detonatesAt:35000};
  expect(pgNearbyModeInteraction(f.snapshot,f.p)).toBeNull();
  expect(pgNearbyModeInteraction(f.snapshot,{...f.p,team:"void"})).toEqual({kind:"interact",targetId:"charge",held:true});
 });
 it("does not offer a new charge interaction outside action",()=>{const f=fixture();f.mode.subphase="buy";expect(pgNearbyModeInteraction(f.snapshot,f.p)).toBeNull();});
 it("stops refreshing a completed hold while its result snapshot is in flight",()=>{
  const f=fixture();f.mode.pilots.a.interaction={targetId:"site-A",startedAt:100,durationMs:4000};
  expect(pgNearbyModeInteraction(f.snapshot,f.p,4099)).toEqual({kind:"interact",targetId:"site-A",held:true});
  expect(pgNearbyModeInteraction(f.snapshot,f.p,4100)).toBeNull();
 });
});
