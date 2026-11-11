import {afterEach,beforeAll,expect,it,vi} from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import {DEFAULT_COSMETICS,type MatchResult} from "@planetfall/shared";
import {GameRoom} from "./game-room.js";
import {PlayerProfiles,type PlayerProgress} from "./player-profiles.js";

const rooms:GameRoom[]=[];
beforeAll(async()=>{await RAPIER.init();});
afterEach(()=>{for(const room of rooms.splice(0))room.dispose();});
it("emits canonical combined-room tier rewards and balances in classic match results",()=>{
 const store=new PlayerProfiles(),identity=store.open(undefined),initial:PlayerProgress={fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],equippedCosmetics:{...DEFAULT_COSMETICS},unlockedPassRewards:["default"]};
 store.bind(initial,identity.key);initial.sessionTotalXp=190;store.capture([initial]);
 function make(code:string){
  const emit=vi.fn(),io={to:()=>({emit})} as unknown as ConstructorParameters<typeof GameRoom>[1],room=new GameRoom(code,io);rooms.push(room);
  const socket={id:code,join:vi.fn(),data:{}} as unknown as Parameters<GameRoom["join"]>[0];
  const joined=room.join(socket,code);if(!joined.ok)throw new Error(joined.error);
  const p=room.players.get(joined.playerId)!;store.bind(p,identity.key);room.onProgress=players=>store.capture(players);
  return {room,p,emit};
 }
 const a=make("ROOMA"),b=make("ROOMB");b.p.sessionTotalXp+=60;
 (a.room as unknown as {end(winner:string,reason:"timer",now:number):void}).end(a.p.id,"timer",1000);
 const entry=a.room.matchResult!.progression.find(p=>p.playerId===a.p.id)!;
 expect(entry.totalXp).toBe(190+60+entry.xpEarned);expect(entry.level).toBe(4);expect(entry.rewards.map(reward=>reward.id)).toEqual(["ion-blue","bucks-75"]);
 expect(entry.fallbucksGranted).toBe(75);expect(a.p.fallbucks).toBe(225);expect(b.p.fallbucks).toBe(225);
 expect(a.room.matchResult!.fallbucks.find(p=>p.playerId===a.p.id)?.balance).toBe(225);
 const event=a.emit.mock.calls.find(([name])=>name==="match:ended")?.[1] as {result:MatchResult};
 expect(event.result.progression).toEqual(a.room.matchResult!.progression);
 const balance=a.p.fallbucks;store.capture([a.p,b.p]);expect(a.p.fallbucks).toBe(balance);
});
