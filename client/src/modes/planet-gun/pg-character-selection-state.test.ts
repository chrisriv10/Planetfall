import {describe,expect,it} from "vitest";
import {PG_MAP,pgCreateGun,type PgPlayer,type PgRoomView,type PgSnapshot,type PgModeSnapshot} from "@planetfall/shared";
import {pgCharacterSelectionView} from "./pg-character-selection-state";

function fixture(mode:"planetwatch"|"planetsiege"="planetwatch"){
 const players=[{id:"me",name:"Local",team:"solar",connected:true,ready:false,isBot:false,hp:100,position:{...PG_MAP.spawns[0].position},lastDamageAt:0,loadout:{primary:"pulse",secondary:"orbit"},guns:[pgCreateGun("pulse"),pgCreateGun("orbit")]},{id:"friend",name:"Friend",team:"solar",connected:true,ready:false,isBot:false,hp:100},{id:"opponent",name:"Opponent",team:"void",connected:true,ready:false,isBot:false,hp:100}]as PgPlayer[];
 const room:PgRoomView={gameFamily:"planet-gun",code:"PICKS",hostId:"me",phase:"lobby",configuration:{mode,targetPlayers:12,fillBots:true,botDifficulty:"normal",scoreLimit:75},players,selections:{me:"cairn",friend:"cinder"}};
 const live={phase:"playing",serverTime:20000,players,mode:{id:mode,subphase:mode==="planetsiege"?"prepare":"control",deadline:0,pilots:{me:{characterId:mode==="planetsiege"?"brace":"parallax",side:"defend",life:"alive",charges:[2,2]},friend:{characterId:"kepler",side:"attack",life:"alive"},opponent:{characterId:"cairn",life:"alive"}},effects:[]}}as unknown as PgSnapshot;
 return {room,live,read:()=>pgCharacterSelectionView(room,live,"me",{characterId:null,primary:null,pending:false})!};
}
describe("character selection state ownership",()=>{
 it("uses lobby reservations and allows opposing-team mirrors",()=>{
  const g=fixture(),before=JSON.stringify(g.room),view=g.read();expect(view.selectedId).toBe("cairn");expect(view.reserved.get("cinder")).toBe("Friend");expect(view.reserved.has("cairn")).toBe(false);expect(view.team).toHaveLength(2);expect(view.canConfirm).toBe(true);expect(JSON.stringify(g.room)).toBe(before);
 });
 it("prefers live selections over stale lobby picks",()=>{
  const g=fixture();g.room.phase="playing";const view=g.read();expect(view.selectedId).toBe("parallax");expect(view.reserved.get("kepler")).toBe("Friend");expect(view.reserved.has("cinder")).toBe(false);
 });
 it("explains spawn/combat restrictions while preserving eliminated hero selection",()=>{
  const g=fixture();g.room.phase="playing";g.room.players[0].position={x:0,y:0,z:0};expect(g.read()).toMatchObject({canConfirm:false,reason:"Return to spawn or select while eliminated."});
  g.live.mode!.pilots.me.life="eliminated";g.room.players[0].hp=0;expect(g.read().canConfirm).toBe(true);
  g.live.mode!.pilots.me.life="alive";g.room.players[0].hp=100;g.room.players[0].position={...PG_MAP.spawns[0].position};g.room.players[0].lastDamageAt=19000;expect(g.read().reason).toContain("five seconds");
 });
 it("uses the actual rotated Siege role and locks deployed operators",()=>{
  const g=fixture("planetsiege");g.room.phase="playing";let view=g.read();expect(view.catalog.every(character=>"side"in character&&character.side==="defend")).toBe(true);
  const mode=g.live.mode as Extract<PgModeSnapshot,{id:"planetsiege"}>;mode.subphase="action";expect(g.read().reason).toContain("lock");mode.subphase="prepare";mode.effects.push({ownerId:"me"}as typeof mode.effects[number]);expect(g.read().reason).toContain("committed equipment");
 });
 it("never confirms a pending, reserved or unsupported draft",()=>{
  const g=fixture();expect(pgCharacterSelectionView(g.room,g.live,"me",{characterId:"cinder",primary:"rail",pending:false})?.canConfirm).toBe(false);
  expect(pgCharacterSelectionView(g.room,g.live,"me",{characterId:"cairn",primary:null,pending:true})?.canConfirm).toBe(false);
  g.room.configuration.mode="planetstrike";expect(g.read()).toBeNull();
 });
});
