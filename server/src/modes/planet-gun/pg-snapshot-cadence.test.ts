import type {Server,Socket} from "socket.io";
import {describe,expect,it} from "vitest";
import {BALANCE,PG_BALANCE,type ClientToServerEvents,type PgModeId,type PgSnapshot,type ServerToClientEvents} from "@planetfall/shared";
import {PlanetGunRoom} from "./pg-room.js";

const period=1000/PG_BALANCE.snapshotRate;
const tick=1000/BALANCE.serverRate;

function fixture(mode:PgModeId="deathmatch"){
  const sent:{target:string;snapshot:PgSnapshot}[]=[];
  const io={to:(target:string)=>({emit:(event:string,snapshot:PgSnapshot)=>{
    if(event==="pg:match:snapshot")sent.push({target,snapshot});
  }})} as unknown as Server<ClientToServerEvents,ServerToClientEvents>;
  const room=new PlanetGunRoom("CADENCE",io);
  const join=(id:string)=>{
    const socket={id,data:{},join:()=>{}} as unknown as Socket<ClientToServerEvents,ServerToClientEvents>;
    const joined=room.join(socket,id);
    if(!joined.ok)throw Error(joined.error);
    return joined.playerId;
  };
  const host=join("host"),guest=join("guest");
  room.configure(host,{mode,targetPlayers:4,fillBots:false});
  const start=(at:number)=>{
    room.setReady(host,true);
    room.setReady(guest,true);
    expect(room.start(host,at)).toBe(true);
    room.update(0,at);
  };
  const timestamps=()=>sent.map(({snapshot})=>snapshot.serverTime);
  return {room,sent,host,start,timestamps};
}

describe("PlanetGun periodic snapshot cadence",()=>{
  it("averages the configured rate for a minute at the actual room update rate",()=>{
    const f=fixture(),start=10_000,seconds=60;
    f.start(start);
    expect(f.sent.at(-1)?.snapshot).toMatchObject({phase:"countdown",serverTime:start});
    f.sent.length=0;
    let previousTick=start;
    for(let frame=1;frame<=seconds*BALANCE.serverRate;frame++){
      const now=start+Math.round(frame*tick),before=f.sent.length;
      f.room.update((now-previousTick)/1000,now);
      const latest=f.sent.slice(before);
      expect(latest.length).toBeLessThanOrEqual(1);
      if(latest.length)expect(latest[0].snapshot.serverTime).toBe(now);
      previousTick=now;
    }
    expect(f.sent).toHaveLength(seconds*PG_BALANCE.snapshotRate);
    const times=f.timestamps();
    expect(new Set(times).size).toBe(times.length);
    expect(Math.min(...times.slice(1).map((now,i)=>now-times[i]))).toBeGreaterThanOrEqual(Math.floor(tick));
    expect(Math.max(...times.slice(1).map((now,i)=>now-times[i]))).toBeLessThanOrEqual(Math.ceil(2*tick));
  });

  it("retains the elapsed remainder over irregular updates",()=>{
    const f=fixture(),start=20_000,gaps=[20,39,26,45,37,31,28,44];
    f.start(start);
    f.sent.length=0;
    let now=start;
    for(let i=0;i<600;i++){
      const elapsed=gaps[i%gaps.length];
      now+=elapsed;
      f.room.update(elapsed/1000,now);
      expect(f.sent).toHaveLength(Math.floor((now-start)/period));
    }
  });

  it("sends only current state after a stall and ignores repeated or backward update times",()=>{
    const f=fixture(),start=30_000;
    f.start(start);
    f.sent.length=0;
    f.room.update(.067,start+67);
    f.room.update(.1,start+10_759);
    f.room.update(0,start+10_759);
    f.room.update(-.001,start+10_758);
    f.room.update(.001,start+10_760);
    expect(f.timestamps()).toEqual([start+67,start+10_759]);
    f.room.update(.04,start+10_800);
    expect(f.timestamps()).toEqual([start+67,start+10_759,start+10_800]);
    f.sent.length=0;
    for(let frame=1;frame<=3*BALANCE.serverRate;frame++)f.room.update(1/BALANCE.serverRate,start+10_800+Math.round(frame*tick));
    expect(f.sent).toHaveLength(3*PG_BALANCE.snapshotRate);
  });

  it("keeps join and lobby traffic separate and starts a fresh schedule on rematch or replacement",()=>{
    const f=fixture(),start=40_000;
    expect(f.sent.map(({target,snapshot})=>[target,snapshot.phase])).toEqual([["host","lobby"],["guest","lobby"]]);
    f.sent.length=0;
    f.room.update(.1,start-1);
    expect(f.sent).toHaveLength(0);
    f.start(start);
    const live=start+PG_BALANCE.countdownMs;
    f.room.update(.1,live);
    // Drive the phases directly so this checks scheduling independently of a match's combat outcome.
    f.room["match"].finish("solar");
    f.room.update(.051,live+51);
    expect(f.sent.map(({snapshot})=>snapshot.phase)).toEqual(["countdown","playing","results"]);
    f.room.returnToLobby(f.host);
    f.room.update(0,live+52);
    expect(f.sent).toHaveLength(3);
    f.start(live+53);
    expect(f.sent.at(-1)?.snapshot).toMatchObject({serverTime:live+53,phase:"countdown"});

    f.room.dispose();
    expect(f.room.isEmpty()).toBe(true);
    const replacement=fixture();
    replacement.sent.length=0;
    replacement.start(live+54);
    expect(replacement.timestamps()).toEqual([live+54]);
    expect(f.sent).toHaveLength(4);
  });

  it("emits one personalized packet per viewer per deadline with current movement acknowledgment",()=>{
    const f=fixture("planetwatch"),start=Date.now()-PG_BALANCE.countdownMs;
    f.start(start);
    const live=start+PG_BALANCE.countdownMs;
    f.room.update(.1,live);
    f.sent.length=0;
    const initial=f.room.snapshot(live,f.host);
    const mode=initial.mode!;
    const pilot=initial.players.find(p=>p.id===f.host)!;
    f.room.setInput(f.host,{sequence:9,yaw:pilot.yaw,pitch:pilot.pitch,moveX:0,moveZ:-1,jump:false,sprint:false,crouch:false,ads:false,collisionRevision:mode.collision.topologyRevision??mode.collision.revision});
    f.room.update(1/BALANCE.serverRate,live+33);
    expect(f.sent).toHaveLength(0);
    f.room.update(1/BALANCE.serverRate,live+67);
    expect(f.sent.map(x=>x.target)).toEqual(["host","guest"]);
    for(const {snapshot} of f.sent){
      expect(snapshot).toMatchObject({phase:"playing",serverTime:live+67,mode:{id:"planetwatch"}});
      expect(snapshot.players.find(p=>p.id===f.host)?.lastInputSequence).toBe(9);
    }
    expect(Object.keys(f.sent[0].snapshot.mode!.controls!)).toEqual([f.host]);
  });
});
