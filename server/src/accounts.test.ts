import {afterEach,expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {io,type Socket} from "socket.io-client";
import {SHOP_CATALOG,type ClientToServerEvents,type ServerToClientEvents} from "@planetfall/shared";
import {createPlanetfallServer} from "./app.js";
import {FixtureAccountProvider} from "../../e2e/fixtures/account-provider.js";
import type {ProfileDatabaseConnection,ProfileQuery} from "./profile-database.js";
import {migrateProfileSchema} from "./profile-migrations.js";

type GameSocket=Socket<ServerToClientEvents,ClientToServerEvents>;
const origin="http://127.0.0.1:5173";
const cleanup:(()=>Promise<unknown>|void)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();});

async function fixture() {
  const db=new PGlite();await db.waitReady;
  cleanup.push(()=>db.close());
  const provider=new FixtureAccountProvider();
  let failLink=false, failAfterLink=false;
  let beforeReceipt:(()=>Promise<void>)|undefined;
  const connection:ProfileDatabaseConnection={
      query:(sql,values)=>db.query(sql,values),
      async transaction(run){
        let claim=false;
        const result=await db.transaction(tx=>{
          const query:ProfileQuery=async(sql,values)=>{
            if(sql.startsWith("INSERT INTO planetfall_account_links")){
              claim=true;
              if(failLink){failLink=false;throw new Error("Transient fixture failure");}
            }
            if(sql.startsWith("INSERT INTO planetfall_profile_operations")&&beforeReceipt){
              const wait=beforeReceipt;beforeReceipt=undefined;await wait();
            }
            return tx.query(sql,values);
          };
          return run(query);
        });
        if(claim&&failAfterLink){failAfterLink=false;throw new Error("Ambiguous fixture commit");}
        return result;
      },
      end:async()=>{},
  };
  await migrateProfileSchema(connection);
  async function boot() {
    const app=await createPlanetfallServer({port:0,nodeEnv:"test",testAccounts:{origin,provider,connection}});
    let closed=false;
    async function close(){if(closed)return;closed=true;await app.close();}
    cleanup.push(close);
    const {url}=await app.listen();
    function post(path:string,session:string,body:object={},source=origin) {
      return fetch(`${url}/api/account/${path}`,{method:"POST",body:JSON.stringify(body),headers:{origin:source,"content-type":"application/json",cookie:`pf-test-session=${session}`}});
    }
    function dial(auth:object):GameSocket {
      const socket:GameSocket=io(url,{auth,extraHeaders:{origin},transports:["websocket"],autoConnect:false,reconnection:false,forceNew:true});
      cleanup.push(()=>{socket.disconnect();});
      return socket;
    }
    function connect(auth:object) {
      const socket=dial(auth);
      return new Promise<{socket:GameSocket;ready:Parameters<ServerToClientEvents["profile:ready"]>[0]}>((resolve,reject)=>{
        socket.once("connect_error",reject);
        socket.once("profile:ready",ready=>resolve({socket,ready}));socket.connect();
      });
    }
    return {app,post,connect,dial,close};
  }
  return {db,provider,boot,failNextLink:()=>{failLink=true;},loseNextLinkResponse:()=>{failAfterLink=true;},
    beforeReceipt:(wait:()=>Promise<void>)=>{beforeReceipt=wait;}};
}

it("acknowledges a Shop purchase only after its committed debit and ownership survive reconnection",async()=>{
  const {boot,beforeReceipt}=await fixture();
  const first=await boot(),guest=await first.connect({profile:true});
  const joined=await guest.socket.timeout(5000).emitWithAck("room:create",{name:"Shop pilot"});
  if(!joined.ok)throw Error(joined.error);
  const room=first.app.manager.rooms.get(joined.room.code)!,pilot=room.players.get(joined.playerId)!;
  const item=SHOP_CATALOG.find(item=>item.id==="solar-gold")!;
  const saved=new Promise<void>(resolve=>guest.socket.once("profile:state",()=>resolve()));
  pilot.fallbucks=item.price+25;
  room.onProgress?.([pilot]);
  await saved;
  const reached=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
  beforeReceipt(async()=>{reached.resolve();await release.promise;});
  let acknowledged=false;
  const purchase=guest.socket.timeout(5000).emitWithAck("shop:buy",{itemId:item.id}).then(result=>{acknowledged=true;return result;});
  try{
    await reached.promise;
    expect(acknowledged).toBe(false);
    expect(pilot.ownedCosmetics).not.toContain(item.id);
  }finally{release.resolve();}
  expect(await purchase).toEqual({ok:true});
  expect((await guest.socket.timeout(5000).emitWithAck("shop:equip",{itemId:item.id})).ok).toBe(true);
  const second=await boot(),returning=await second.connect({profile:true,profileToken:guest.ready.token});
  expect(returning.ready.profile).toMatchObject({fallbucks:25,ownedCosmetics:[item.id],equippedCosmetics:{suit:item.id}});
  expect(returning.ready.token).toBe(guest.ready.token);
},30000);

it("settles a retiring guest room into its linked ledger without broadcasting account progress to the old guest socket",async()=>{
  const {boot,provider}=await fixture();
  const first=await boot(),guest=await first.connect({profile:true});
  const joined=await guest.socket.timeout(5000).emitWithAck("room:create",{name:"Retiring pilot"});
  if(!joined.ok)throw Error(joined.error);
  const room=first.app.manager.rooms.get(joined.room.code)!,pilot=room.players.get(joined.playerId)!;
  const second=await boot();
  const session=provider.issue("replacement-account");
  const link=await (await second.post("session",session,{choice:"link",guestToken:guest.ready.token})).json();
  expect(link).toMatchObject({state:"signed-in",claimedGuest:true});
  expect(await guest.socket.timeout(5000).emitWithAck("leaderboard:visibility","Old guest")).toMatchObject({ok:false});
  const pushed=vi.fn();
  guest.socket.on("profile:state",pushed);
  const ended=new Promise(resolve=>guest.socket.once("account:ended",resolve));
  pilot.fallbucks+=30;pilot.sessionTotalXp+=60;
  room.onProgress?.([pilot]);
  expect(await ended).toBe("linked");
  expect(pushed).not.toHaveBeenCalled();
  const account=await second.connect({accountTicket:link.ticket});
  expect(account.ready.profile).toMatchObject({fallbucks:30,sessionTotalXp:60});
},30000);

it("links the original earned ledger, rejects old guest and room credentials, and restores after restart",async()=>{
  const {boot,provider,db}=await fixture();
  let server=await boot();
  const guest=await server.connect({profile:true});
  const join=await guest.socket.timeout(5000).emitWithAck("room:create",{name:"Same display name"});
  if(!join.ok)throw Error(join.error);
  const room=server.app.manager.rooms.get(join.room.code)!;
  const player=room.players.get(join.playerId)!;
  player.fallbucks=150;player.sessionTotalXp=115;player.crowns=1;
  player.ownedCosmetics.push("solar-gold");player.equippedCosmetics.suit="solar-gold";
  room.onProgress?.([player]);
  expect(await guest.socket.timeout(5000).emitWithAck("leaderboard:visibility","Stella Flight")).toEqual({ok:true});
  const guestToken=guest.ready.token!;
  const first=provider.issue("primary"),second=provider.issue("primary");
  const stolen=provider.issue("different");
  expect(await (await server.post("session","forged",{choice:"link",guestToken,userId:"primary"})).json()).toEqual({state:"guest"});
  expect((await server.post("session",first,{choice:"link",guestToken},"https://different.test")).status).toBe(403);
  const ended=new Promise(resolve=>guest.socket.once("account:ended",resolve));
  const link=await (await server.post("session",first,{choice:"link",guestToken})).json();
  expect(link).toMatchObject({state:"signed-in",claimedGuest:true});
  expect(await ended).toBe("linked");
  expect(server.app.manager.rooms.has(join.room.code)).toBe(false);
  const a=await server.connect({accountTicket:link.ticket,userId:"different"});
  expect(a.ready.token).toBeUndefined();
  await expect(server.connect({accountTicket:link.ticket})).rejects.toThrow(/unavailable/);
  const bLink=await (await server.post("session",second)).json();
  const b=await server.connect({accountTicket:bLink.ticket});
  const count=new Promise<number>(resolve=>b.socket.once("presence:count",resolve));
  b.socket.emit("presence:menu",true);
  expect(await count).toBe(1);
  expect(await b.socket.timeout(5000).emitWithAck("leaderboard:read")).toMatchObject({ok:true,data:{
    entries:[{rank:1,name:"Stella Flight",xp:115,isYou:true}],
  }});
  expect(b.ready.profile).toEqual(a.ready.profile);
  expect(a.ready.profile).toMatchObject({fallbucks:200,crowns:1,sessionTotalXp:115,ownedCosmetics:["solar-gold"],equippedCosmetics:{suit:"solar-gold"}});
  expect(a.ready.profile.unlockedPassRewards).toContain("bucks-50");

  const classic=await a.socket.timeout(5000).emitWithAck("room:create",{name:"Stella Pilot"});
  if(!classic.ok)throw Error(classic.error);
  const other=await server.connect({profile:true,profileToken:guestToken});
  expect(other.ready.profile.fallbucks).toBe(0);
  expect(other.ready.token).not.toBe(guestToken);
  const badResume=await other.socket.timeout(5000).emitWithAck("room:join",{name:"Stella Pilot",code:classic.room.code,sessionToken:classic.sessionToken});
  expect(badResume.ok).toBe(false);
  const updated=new Promise<Parameters<ServerToClientEvents["profile:state"]>[0]>(resolve=>b.socket.once("profile:state",resolve));
  const liveRoom=server.app.manager.rooms.get(classic.room.code)!;
  const livePlayer=liveRoom.players.get(classic.playerId)!;
  livePlayer.fallbucks+=25;liveRoom.onProgress?.([livePlayer]);
  expect((await updated).fallbucks).toBe(225);

  const selected=await (await server.post("session",stolen,{choice:"link",guestToken})).json();
  const different=await server.connect({accountTicket:selected.ticket});
  expect(different.ready.profile.fallbucks).toBe(0);
  const links=await db.query("SELECT profile_key FROM planetfall_account_links");
  expect(links.rows).toHaveLength(2);
  expect(JSON.stringify(links.rows)).not.toContain(guestToken);
  a.socket.disconnect();b.socket.disconnect();different.socket.disconnect();other.socket.disconnect();
  await server.close();
  server=await boot();
  const restoredLink=await (await server.post("session",second)).json();
  const restored=await server.connect({accountTicket:restoredLink.ticket});
  const restartedCount=new Promise<number>(resolve=>restored.socket.once("presence:count",resolve));
  restored.socket.emit("presence:menu",true);
  expect(await restartedCount).toBe(1);
  expect(await restored.socket.timeout(5000).emitWithAck("leaderboard:read")).toMatchObject({ok:true,data:{
    currentPlayer:{rank:1,name:"Stella Flight",xp:115,isYou:true},
  }});
  expect(restored.ready.profile).toMatchObject({fallbucks:225,sessionTotalXp:115,equippedCosmetics:{suit:"solar-gold"}});
  expect((await server.connect({profile:true,profileToken:guestToken})).ready.profile.fallbucks).toBe(0);
},30_000);

it("preserves conflicts, rolls back failed claims, serializes competing links, and rejects stale preferences",async()=>{
  const {boot,provider,db,failNextLink,loseNextLinkResponse}=await fixture();
  const server=await boot();
  const one=provider.issue("one"),two=provider.issue("two");
  const guest=await server.connect({profile:true});
  const guestToken=guest.ready.token!;
  failNextLink();
  expect((await server.post("session",one,{choice:"link",guestToken})).status).toBe(503);
  expect((await server.connect({profile:true,profileToken:guestToken})).ready.token).toBe(guestToken);
  const results=await Promise.all([one,two].map(async token=>(await server.post("session",token,{choice:"link",guestToken})).json()));
  expect(results.filter(value=>value.claimedGuest)).toHaveLength(1);
  const winner=results[0].claimedGuest?one:two;
  const result=await (await server.post("session",winner,{choice:"link",guestToken})).json();
  expect(result.state).toBe("signed-in");
  expect((await db.query("SELECT DISTINCT profile_key FROM planetfall_account_links")).rows).toHaveLength(2);

  const device=await server.connect({profile:true});
  const lobby=await device.socket.timeout(5000).emitWithAck("room:create",{name:"Stella Pilot"});
  if(!lobby.ok)throw Error(lobby.error);
  const room=server.app.manager.rooms.get(lobby.room.code)!;
  const player=room.players.get(lobby.playerId)!;
  player.fallbucks=40;room.onProgress?.([player]);
  expect(await (await server.post("session",winner,{choice:"link",guestToken:device.ready.token})).json()).toMatchObject({state:"conflict"});
  const resume=await (await server.post("session",winner,{choice:"existing",guestToken:device.ready.token})).json();
  expect((await server.connect({accountTicket:resume.ticket})).ready.profile.fallbucks).toBe(0);
  expect((await server.connect({profile:true,profileToken:device.ready.token})).ready.profile.fallbucks).toBe(40);

  const prefs={version:1,pgMode:"planetwatch"};
  const save={context:resume.context,revision:0,value:prefs};
  expect(await (await server.post("preferences",winner,save)).json()).toEqual({revision:1,value:prefs});
  const stale=await server.post("preferences",winner,{...save,value:{version:1,pgMode:"deathmatch"}});
  expect(stale.status).toBe(409);
  expect(await stale.json()).toEqual({revision:1,value:prefs});
  expect((await server.post("preferences",winner,{...save,revision:1,value:{...prefs,fallbucks:1000}})).status).toBe(400);
  expect((await server.post("preferences",winner===one?two:one,save)).status).toBe(409);

  const ambiguous=await server.connect({profile:true});
  const other=provider.issue("third");
  loseNextLinkResponse();
  expect((await server.post("session",other,{choice:"link",guestToken:ambiguous.ready.token})).status).toBe(503);
  expect((await server.connect({profile:true,profileToken:ambiguous.ready.token})).ready.token).not.toBe(ambiguous.ready.token);
  expect(await (await server.post("session",other)).json()).toMatchObject({state:"signed-in"});
},30_000);

it("logs out connected tabs, clears room membership, and rejects expired verified sessions",async()=>{
  const {boot,provider}=await fixture();
  const server=await boot();
  const session=provider.issue("logout");
  const link=await (await server.post("session",session,{choice:"new"})).json();
  const a=await server.connect({accountTicket:link.ticket});
  const other=await (await server.post("session",session)).json();
  const b=await server.connect({accountTicket:other.ticket});
  const outstanding=await (await server.post("session",session)).json();
  const room=await a.socket.timeout(5000).emitWithAck("room:create",{name:"Logout pilot"});
  if(!room.ok)throw Error(room.error);
  const ended=[a,b].map(({socket})=>new Promise(resolve=>socket.once("account:ended",resolve)));
  expect((await server.post("sign-out",session,{context:link.context})).status).toBe(204);
  expect(await Promise.all(ended)).toEqual(["signed-out","signed-out"]);
  expect(server.app.manager.rooms.has(room.room.code)).toBe(false);
  await expect(server.connect({accountTicket:outstanding.ticket})).rejects.toThrow(/unavailable/);
  expect(await (await server.post("session",session)).json()).toEqual({state:"guest"});
  const expired=provider.issue("logout");
  provider.sessions.get(expired)!.expiresAt=Date.now()-1;
  expect(await (await server.post("session",expired)).json()).toEqual({state:"guest"});
  expect((await server.connect({profile:true})).ready.token).toHaveLength(64);
},30_000);

it("limits sign-in starts and new links independently without blocking an existing account choice",async()=>{
  const {boot,provider}=await fixture();
  const server=await boot();
  const session=provider.issue("limited-pilot");
  expect((await server.post("session",session,{choice:"new"})).status).toBe(200);
  const attempts=await Promise.all(Array.from({length:23},()=>server.post("session","invalid",{choice:"link"})));
  expect(attempts.map(response=>response.status)).toEqual(Array(23).fill(200));
  const limited=await server.post("session","invalid",{choice:"link"});
  expect(limited.status).toBe(429);
  expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  const starts=await Promise.all(Array.from({length:24},()=>server.post("start","")));
  expect(starts.map(response=>response.status)).toEqual(Array(24).fill(200));
  expect((await server.post("start","")).status).toBe(429);
  const returning=await server.post("session",session,{choice:"existing"});
  expect(await returning.json()).toMatchObject({state:"signed-in"});
},30_000);
