import type {Server,Socket} from "socket.io";
import {describe,expect,it} from "vitest";
import {PG_BALANCE,type ClientToServerEvents,type PgInput,type PgSnapshot,type ServerToClientEvents} from "@planetfall/shared";
import {PlanetGunRoom} from "./pg-room.js";

function fixture(mode:"planetsiege"|"deathmatch"="planetsiege"){
  const sent:PgSnapshot[]=[];
  const io={to:()=>({emit:(event:string,snapshot:PgSnapshot)=>{
    if(event==="pg:match:snapshot")sent.push(snapshot);
  }})} as unknown as Server<ClientToServerEvents,ServerToClientEvents>;
  const room=new PlanetGunRoom("INPUT",io);
  const join=(name:string,token?:string)=>{
    const socket={id:name,data:{},join:()=>{}} as unknown as Socket<ClientToServerEvents,ServerToClientEvents>;
    const result=room.join(socket,name,token);
    if(!result.ok)throw Error(result.error);
    return result;
  };
  const host=join("host"),guest=join("guest"),pilot=room.players.get(host.playerId)!;
  const world=room["world"];
  let now=Date.now();
  const start=(at:number)=>{
    room.setReady(host.playerId,true);
    room.setReady(guest.playerId,true);
    expect(room.start(room.hostId,at)).toBe(true);
    room.update(0,at+PG_BALANCE.countdownMs);
  };
  const tick=(ms=17)=>{now+=ms;room.update(ms/1000,now);};
  room.configure(host.playerId,{mode,targetPlayers:4,fillBots:false});
  start(now-PG_BALANCE.countdownMs-(mode==="planetsiege"?35_000:0));
  tick();
  const receive=(sequence:number,collisionRevision:number|undefined=world.revision,changes:Partial<PgInput>={})=>{
    room.setInput(pilot.id,{sequence,collisionRevision,moveX:0,moveZ:0,yaw:pilot.yaw,pitch:0,jump:false,sprint:false,crouch:false,ads:false,...changes});
  };
  const ack=()=>room.snapshot(now,pilot.id).players.find(p=>p.id===pilot.id)!.lastInputSequence;
  const wireAck=()=>sent.at(-1)?.players.find(p=>p.id===pilot.id)?.lastInputSequence;
  const replaceTopology=()=>world.reset(world.snapshot().panels,now);
  return {room,pilot,world,join,host,start,tick,receive,ack,wireAck,replaceTopology,now:()=>now};
}

describe("PlanetGun movement disposition watermark",()=>{
  it("keeps the discarded sequence in the next snapshot after a Siege topology change",()=>{
    const f=fixture(),revision=f.world.revision,yaw=f.pilot.yaw;
    f.receive(10,revision);
    f.tick();
    expect(f.ack()).toBe(10);
    f.replaceTopology();
    expect(f.world.revision).toBe(revision+1);
    f.receive(11,revision,{yaw:yaw+.6,moveZ:-1});
    expect(f.ack()).toBe(11);
    f.tick(67);
    expect(f.ack()).toBe(11);
    expect(f.wireAck()).toBe(11);
    expect(f.pilot.yaw).toBe(yaw);
  });

  it("disposes consecutive obsolete inputs and applies the first valid newer movement",()=>{
    const f=fixture(),revision=f.world.revision,yaw=f.pilot.yaw;
    f.receive(10,revision);
    f.tick();
    f.replaceTopology();
    for(const sequence of [11,12,13])f.receive(sequence,revision,{yaw:yaw+.6,moveZ:-1});
    f.tick(67);
    expect(f.ack()).toBe(13);
    expect(f.pilot.yaw).toBe(yaw);
    const before={...f.pilot.position};
    f.receive(14,f.world.revision,{yaw:yaw-.4,moveZ:-1});
    expect(f.ack()).toBe(13);
    f.tick();
    expect(f.ack()).toBe(14);
    expect(f.pilot.yaw).toBeCloseTo(yaw-.4);
    expect(Math.hypot(f.pilot.position.x-before.x,f.pilot.position.z-before.z)).toBeGreaterThan(0);
  });

  it("waits for an already queued valid input before acknowledging a newer obsolete packet",()=>{
    const f=fixture(),revision=f.world.revision,yaw=f.pilot.yaw;
    f.receive(10,revision);
    f.tick();
    f.replaceTopology();
    const current=f.world.revision;
    f.receive(11,current,{yaw:yaw+.4});
    f.receive(12,revision,{yaw:yaw-.5});
    f.receive(11,current,{yaw:yaw-.7});
    f.receive(12,current,{yaw:yaw-.7});
    expect(f.ack()).toBe(10);
    expect(f.pilot.yaw).toBe(yaw);
    f.tick(67);
    expect(f.ack()).toBe(12);
    expect(f.wireAck()).toBe(12);
    expect(f.pilot.yaw).toBeCloseTo(yaw+.4);
    f.receive(12,current,{yaw:yaw-.7});
    f.tick();
    expect(f.pilot.yaw).toBeCloseTo(yaw+.4);
  });

  it("does not carry a pending jump across a topology change",()=>{
    const f=fixture(),revision=f.world.revision;
    f.receive(10,revision,{jump:true});
    f.replaceTopology();
    f.receive(11,f.world.revision);
    expect(f.pilot.input.jump).toBe(false);
    f.tick();
    expect(f.ack()).toBe(11);
  });

  it("retires queued movement on disconnect and respawn while continuing the same player's sequence",()=>{
    const f=fixture("deathmatch"),id=f.pilot.id,yaw=f.pilot.yaw;
    f.receive(10,undefined);
    f.tick();
    f.receive(11,undefined,{yaw:yaw+.4});
    f.room.disconnect(id);
    f.tick(67);
    expect(f.ack()).toBe(11);
    expect(f.pilot.yaw).toBe(yaw);
    expect(f.join("returning",f.host.sessionToken).playerId).toBe(id);
    f.receive(11,undefined,{yaw:yaw+.5});
    f.tick();
    expect(f.ack()).toBe(11);
    expect(f.pilot.yaw).toBe(yaw);
    f.receive(12,undefined,{yaw:yaw+.6});
    f.room["respawn"](f.pilot,f.now());
    expect(f.ack()).toBe(12);
    const newYaw=f.pilot.yaw;
    f.receive(13,undefined,{yaw:newYaw-.4});
    f.tick();
    expect(f.ack()).toBe(13);
    expect(f.pilot.yaw).toBeCloseTo(newYaw-.4);
    f.room["match"].finish("solar");
    f.room.returnToLobby(f.room.hostId);
    f.start(f.now());
    expect(f.ack()).toBe(13);
  });
});
