import {describe,expect,it} from "vitest";
import {PG_ZOMBIE_ARSENAL_SITE,pgCreateCollisionSnapshot,type PgSnapshot} from "@planetfall/shared";
import {createPgZombieArsenalPrompt} from "./pg-zombie-arsenal-prompt";
import {pgNearbyModeInteraction} from "./pg-mode-input";
function setup(){const snapshot={serverTime:1000,phase:"playing",players:[{id:"me",name:"Me",position:{...PG_ZOMBIE_ARSENAL_SITE.interaction},hp:100}],mode:{id:"planetzombies",collision:pgCreateCollisionSnapshot(),power:false,pilots:{me:{life:"alive",points:900}},arsenal:{phase:"idle",ownerId:null,weaponId:null,revealAt:null,expiresAt:null}}}as unknown as PgSnapshot;return {snapshot,read:createPgZombieArsenalPrompt()};}
describe("Arsenal prompt and input agreement",()=>{
 it("offers no unavailable purchase and shows power, affordability and reserved results",()=>{
  const {snapshot:s,read}=setup();if(s.mode?.id!=="planetzombies")throw Error();
  expect(read(s,"me","E")).toMatchObject({available:false,detail:"RESTORE STATION POWER"});expect(pgNearbyModeInteraction(s,s.players[0])).toBeNull();
  s.mode.power=true;expect(read(s,"me","E")?.available).toBe(true);expect(pgNearbyModeInteraction(s,s.players[0])).toEqual({kind:"buy",itemId:"anomaly-arsenal"});
  s.mode.pilots.me.points=849;expect(read(s,"me","E")?.available).toBe(false);expect(pgNearbyModeInteraction(s,s.players[0])).toBeNull();
  s.mode.arsenal={phase:"ready",ownerId:"me",weaponId:"rail",revealAt:900,expiresAt:16000};expect(read(s,"me","R3")).toMatchObject({key:"R3",available:true,detail:"CLAIM RAIL LASER · REPLACES PRIMARY"});expect(pgNearbyModeInteraction(s,s.players[0])).toEqual({kind:"pickup",entityId:"arsenal-result"});
  s.mode.arsenal.ownerId="friend";expect(read(s,"me","E")?.available).toBe(false);expect(pgNearbyModeInteraction(s,s.players[0])).toBeNull();
 });
 it("shows the same rescue priority as E and hides out-of-range machines",()=>{
  const {snapshot:s,read}=setup();if(s.mode?.id!=="planetzombies")throw Error();s.mode.power=true;
  s.players.push({...s.players[0],id:"friend",name:"Friend"});s.mode.pilots.friend={...s.mode.pilots.me,life:"downed"};
  expect(read(s,"me","E")?.title).toBe("REVIVE FRIEND");expect(pgNearbyModeInteraction(s,s.players[0])).toEqual({kind:"interact",targetId:"revive:friend",held:true});
  s.mode.pilots.friend.life="alive";s.players[0].position={x:0,y:0,z:0};expect(read(s,"me","E")).toBeNull();
 });
});
