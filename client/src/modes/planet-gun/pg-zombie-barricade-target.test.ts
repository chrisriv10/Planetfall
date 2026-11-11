import {describe,it,expect} from "vitest";
import {PG_ZOMBIE_BARRICADE_SITES,pgCreateCollisionSnapshot,type PgSnapshot} from "@planetfall/shared";
import {pgZombieBarricadeTarget} from "./pg-zombie-barricade-target";
import {pgNearbyModeInteraction} from "./pg-mode-input";
import {createPgZombieArsenalPrompt} from "./pg-zombie-arsenal-prompt";
function fixture(){
 const collision=pgCreateCollisionSnapshot();collision.panels.push(...PG_ZOMBIE_BARRICADE_SITES.flatMap(site=>site.boards.map(board=>({id:board.id,solid:structuredClone(board.solid),active:true,hp:30,maxHp:30,reinforced:false,revision:0}))));
 const snapshot={serverTime:1000,players:[{id:"me",name:"Me",hp:100,position:{...PG_ZOMBIE_BARRICADE_SITES[0].interaction}}],mode:{id:"planetzombies",collision,power:true,pilots:{me:{life:"alive",points:0,interaction:null}}}} as unknown as PgSnapshot;
 return {snapshot,read:createPgZombieArsenalPrompt()};
}
describe("physical zombie barricade input and prompt",()=>{
 it.each(PG_ZOMBIE_BARRICADE_SITES)("offers only damaged boards and reports authoritative repair progress at $id",site=>{
  const {snapshot:s,read}=fixture();if(s.mode?.id!=="planetzombies")throw Error();const player=s.players[0];player.position={...site.interaction};
  expect(pgNearbyModeInteraction(s,player)).toBeNull();expect(read(s,"me","E")).toMatchObject({available:false,detail:"ENTRY SCREEN INTACT"});
  const board=s.mode.collision.panels.find(p=>p.id===site.boards[0].id)!;board.active=false;board.hp=0;s.mode.collision.revision++;s.mode.collision.topologyRevision=(s.mode.collision.topologyRevision??0)+1;
  expect(pgNearbyModeInteraction(s,player)).toEqual({kind:"interact",targetId:`barricade:${site.id}`,held:true});expect(read(s,"me","MOUSE 4")).toMatchObject({key:"MOUSE 4",available:true,title:`${site.name.toUpperCase()} · 2/3 BOARDS`});
  s.mode.pilots.me.interaction={targetId:`barricade:${site.id}`,startedAt:500,durationMs:1500};expect(read(s,"me","E")?.detail).toBe("REPAIRING · 1s");
  s.mode.pilots.me.life="downed";expect(pgNearbyModeInteraction(s,player)).toBeNull();expect(read(s,"me","E")).toBeNull();
 });
 it("requires actual installed panels, range and clear visibility, including for a partial-board repair",()=>{
  const {snapshot:s}=fixture();if(s.mode?.id!=="planetzombies")throw Error();const site=PG_ZOMBIE_BARRICADE_SITES[0],panels=s.mode.collision.panels;
  panels.find(p=>p.id===site.boards[0].id)!.hp=29;
  expect(pgZombieBarricadeTarget(site.interaction,panels)?.damaged).toBe(true);
  expect(pgZombieBarricadeTarget(site.interaction,panels,()=>false)).toBeNull();expect(pgZombieBarricadeTarget({x:0,y:0,z:0},panels)).toBeNull();
  expect(pgZombieBarricadeTarget(site.interaction,panels.filter(p=>p.id!==site.boards[1].id))).toBeNull();
 });
});
