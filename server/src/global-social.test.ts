import {afterEach,describe,expect,it,vi} from "vitest";
import {io,type Socket} from "socket.io-client";
import type {ClientToServerEvents,ServerToClientEvents} from "@planetfall/shared";
import {createPlanetfallServer} from "./app.js";
import {GlobalLeaderboard} from "./global-leaderboard.js";

type PilotSocket=Socket<ServerToClientEvents,ClientToServerEvents>;
const cleanups:Array<()=>unknown>=[];
afterEach(async()=>{for(const close of cleanups.splice(0).reverse())await close();});
const once=<T>(listen:(cb:(value:T)=>void)=>void)=>new Promise<T>(resolve=>listen(resolve));
async function service(){
  const app=await createPlanetfallServer({port:0,host:"127.0.0.1",nodeEnv:"test"}),{url}=await app.listen();
  cleanups.push(()=>app.close());
  return url;
}
async function connect(url:string,token?:string){
  const socket:PilotSocket=io(url,{autoConnect:false,reconnection:false,auth:{profile:true,profileToken:token},transports:["websocket"]});
  cleanups.push(()=>socket.disconnect());
  const ready=once<Parameters<ServerToClientEvents["profile:ready"]>[0]>(cb=>socket.once("profile:ready",cb));
  socket.connect();
  return {socket,token:(await ready).token};
}
function count(socket:PilotSocket,expected:number){
  return new Promise<number>(resolve=>{
    const check=(n:number)=>{if(n===expected){socket.off("presence:count",check);resolve(n);}};
    socket.on("presence:count",check);
  });
}
const subscribe=(socket:PilotSocket,expected:number)=>{
  const result=count(socket,expected);
  socket.emit("presence:menu",true);
  return result;
};

describe("global social protocol",()=>{
  it("counts verified identities across menus, families, tabs and reconnects",async()=>{
    const url=await service(),a=await connect(url);
    expect(await subscribe(a.socket,1)).toBe(1);
    const both=count(a.socket,2),b=await connect(url);
    expect(await both).toBe(2);
    const tab=await connect(url,a.token);
    expect(await subscribe(tab.socket,2)).toBe(2);

    const classic=await a.socket.timeout(2000).emitWithAck("room:create",{name:"Classic"});
    const gun=await b.socket.timeout(2000).emitWithAck("pg:room:create",{name:"Watch"});
    expect(classic.ok&&gun.ok).toBe(true);
    if(!classic.ok||!gun.ok)throw new Error("Rooms were not created");
    a.socket.emit("room:mode",{mode:"chaos"});
    expect(await subscribe(tab.socket,2)).toBe(2);
    expect(await a.socket.timeout(2000).emitWithAck("room:leave",{code:classic.room.code})).toEqual({ok:true});
    expect((await a.socket.timeout(2000).emitWithAck("pr:room:create",{name:"Race"})).ok).toBe(true);
    tab.socket.disconnect();
    expect(await subscribe(a.socket,2)).toBe(2);

    const afterDisconnect=count(a.socket,1);
    b.socket.disconnect();
    expect(await afterDisconnect).toBe(1);
    a.socket.emit("presence:menu",false);
    // Ordered same-transport ack is a barrier for unsubscribe.
    await a.socket.timeout(2000).emitWithAck("leaderboard:read");
    const push=vi.fn();a.socket.on("presence:count",push);
    const reconnected=await connect(url,b.token);
    expect(await subscribe(reconnected.socket,2)).toBe(2);
    // A later subscribed observer receives a coalesced update; the old one does not.
    const next=count(reconnected.socket,3);
    await connect(url);
    expect(await next).toBe(3);
    expect(push).not.toHaveBeenCalled();
  },15000);

  it("only lets the authenticated profile publish a validated name, never an XP score",async()=>{
    const url=await service(),a=await connect(url),b=await connect(url);
    expect(await a.socket.timeout(2000).emitWithAck("leaderboard:visibility","Pilot One")).toEqual({ok:true});
    expect(await b.socket.timeout(2000).emitWithAck("leaderboard:visibility",{name:"Fake",xp:9000} as unknown as string)).toMatchObject({ok:false});
    const reply=await b.socket.timeout(2000).emitWithAck("leaderboard:read");
    expect(reply).toEqual({ok:true,data:{entries:[{rank:1,name:"Pilot One",xp:0,isYou:false}],currentPlayer:null,publicName:null}});
    expect(await a.socket.timeout(2000).emitWithAck("leaderboard:visibility",null)).toEqual({ok:true});
    expect(await b.socket.timeout(2000).emitWithAck("leaderboard:read")).toMatchObject({ok:true,data:{entries:[]}});
  });

  it("shares pending queries and backs off then recovers from a temporary database failure",async()=>{
    let now=0;
    const top=vi.fn<()=>Promise<Array<{key:string;name:string;xp:number}>>>().mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue([]);
    const board=new GlobalLeaderboard({leaderboardTop:top,leaderboardName:()=>null,leaderboardRank:async()=>null,setLeaderboardName:async()=>{}},()=>now);
    await Promise.all([expect(board.read()).rejects.toThrow("unavailable"),expect(board.read()).rejects.toThrow("unavailable")]);
    await expect(board.read()).rejects.toThrow("unavailable");
    expect(top).toHaveBeenCalledOnce();
    now=5000;expect((await board.read()).entries).toEqual([]);
    now=24999;await board.read();
    expect(top).toHaveBeenCalledTimes(2);
    now=25000;await board.read();
    expect(top).toHaveBeenCalledTimes(3);
  });
});
