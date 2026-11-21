import {createHash,randomBytes,timingSafeEqual} from "node:crypto";
import type {Application,Request,Response} from "express";
import type {Server} from "socket.io";
import {validateAccountPreferences,type ClientToServerEvents,type ServerToClientEvents} from "@planetfall/shared";
import {AccountOwnership,type LinkChoice} from "./account-ownership.js";
import type {AccountProvider,AccountSession} from "./account-provider.js";
import type {PlayerProfiles} from "./player-profiles.js";
import type {ProfileDatabase} from "./profile-database.js";
import type {RoomManager} from "./room-manager.js";

type GameServer = Server<ClientToServerEvents,ServerToClientEvents>;
type Principal = {profileKey:string;credential:string;session:AccountSession};
type Ticket = Principal & {expiresAt:number};
const ticketLifetime = 15_000;
const sessionCheckPeriod = 30_000;
const digest = (text:string) => createHash("sha256").update(text).digest();
const ticketKey = (token:string) => digest(token).toString("hex");
async function withinProviderDeadline<T>(work:Promise<T>):Promise<T> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    return await Promise.race([work,new Promise<never>((_resolve,reject)=>{
      timer=setTimeout(()=>reject(new Error("Account provider unavailable")),8000);
      timer.unref();
    })]);
  } finally {clearTimeout(timer);}
}

export function installAccounts({app,io,manager,profiles,database,provider,origin,gatewaySecret}:{
  app:Application;io:GameServer;manager:RoomManager;profiles:PlayerProfiles;database:ProfileDatabase;
  provider:AccountProvider;origin:string;gatewaySecret?:string;
}):()=>void {
  const tickets = new Map<string,Ticket>();
  const revoked = new Map<string,number>();
  const limits = new Map<string,{count:number;resetAt:number}>();
  const failedChecks = new Set<string>();
  const expectedGateway = gatewaySecret ? digest(gatewaySecret) : undefined;
  let checking = false;
  const live = (session:AccountSession) => session.expiresAt>Date.now()&&!revoked.has(session.sessionId);
  const ownership = new AccountOwnership(database,profiles,provider.issuer,key=>manager.endGuestAccess(key));

  function endSession(session:AccountSession,reason:"expired"|"signed-out"|"unavailable") {
    if(reason!=="unavailable"&&session.expiresAt>Date.now())revoked.set(session.sessionId,session.expiresAt);
    failedChecks.delete(session.sessionId);
    for(const [key,ticket] of tickets)if(ticket.session.sessionId===session.sessionId)tickets.delete(key);
    for(const socket of io.sockets.sockets.values()) {
      const principal = socket.data.accountPrincipal as Principal|undefined;
      if(principal?.session.sessionId===session.sessionId)manager.endIdentity(socket,reason);
    }
  }

  function permitted(request:Request,response:Response) {
    response.set({"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"});
    if(expectedGateway&&!timingSafeEqual(expectedGateway,digest(request.get("x-planetfall-gateway")??""))) {
      response.status(404).end();return false;
    }
    if(request.method==="POST"&&(request.get("origin")!==origin||!request.is("application/json"))) {
      response.status(403).end();return false;
    }
    const ip = expectedGateway ? request.get("x-planetfall-client")??request.ip : request.ip;
    const choice:unknown=request.body?.choice;
    const lane=request.path==="/api/account/start"?"start":request.path==="/api/account/complete"?"callback":
      request.path==="/api/account/session"&&(choice==="link"||choice==="new")?"link":"session";
    const limitKey = `${lane}:${ip}`;
    const now = Date.now();
    let bucket = limits.get(limitKey);
    if(!bucket||bucket.resetAt<=now) {
      if(limits.size>=10_000&&!bucket){response.status(429).end();return false;}
      bucket={count:0,resetAt:now+60_000};limits.set(limitKey,bucket);
    }
    if(++bucket.count>(lane==="session"?120:24)) {
      response.set("Retry-After",String(Math.ceil((bucket.resetAt-now)/1000))).status(429).end();return false;
    }
    return true;
  }

  function cookies(response:Response,upstream:globalThis.Response) {
    for(const cookie of upstream.headers.getSetCookie())response.append("Set-Cookie",cookie);
  }
  function post(path:string,handle:(req:Request,res:Response)=>Promise<void>) {
    app.post(`/api/account/${path}`,async(req,res)=>{
      if(!permitted(req,res))return;
      try { await handle(req,res); }
      catch { if(!res.headersSent)res.status(503).json({state:"unavailable"}); }
    });
  }
  post("start",async(req,res)=>{
    const next = await withinProviderDeadline(provider.start(req.get("cookie")??"",req.body?.switchAccount===true));
    if(!next.ok){res.status(503).json({state:"unavailable"});return;}
    cookies(res,next);
    res.json(await next.json());
  });
  app.get("/api/account/complete",async(req,res)=>{
    if(!permitted(req,res))return;
    try {
      const url = new URL("/api/account/complete",origin);
      url.search = new URL(req.originalUrl,"http://localhost").search;
      const next = await withinProviderDeadline(provider.complete(url,req.get("cookie")??""));
      cookies(res,next);
      res.redirect(303,next.headers.get("location")==="/?account=return"?"/?account=return":"/?account=failed");
    } catch {res.redirect(303,"/?account=failed");}
  });
  post("session",async(req,res)=>{
    const credential = provider.credential(req.get("cookie")??"");
    const session = await withinProviderDeadline(provider.verify(credential));
    if(!session||!live(session)){res.json({state:"guest"});return;}
    const choice:LinkChoice = req.body?.choice===undefined?"check":req.body.choice;
    if(!["check","link","existing","new"].includes(choice)){res.status(400).end();return;}
    if(req.body?.context!==undefined&&req.body.context!==preferenceContext(session)){res.status(409).end();return;}
    const link = await ownership.resolve(session.userId,req.body?.guestToken,choice,()=>live(session));
    if(!live(session)){res.json({state:"guest"});return;}
    if(link.state!=="linked"){res.json({state:link.state,account:session.account,context:preferenceContext(session)});return;}
    const preferences = await database.accountPreferences(link.key);
    if(!live(session)){res.json({state:"guest"});return;}
    if(tickets.size>=5000){res.status(503).end();return;}
    const ticket = randomBytes(32).toString("hex");
    tickets.set(ticketKey(ticket),{session,credential,profileKey:link.key,expiresAt:Date.now()+ticketLifetime});
    res.json({state:"signed-in",account:session.account,ticket,preferences,context:preferenceContext(session),claimedGuest:link.claimedGuest});
  });
  post("preferences",async(req,res)=>{
    const session = await withinProviderDeadline(provider.verify(provider.credential(req.get("cookie")??"")));
    if(!session||!live(session)){res.status(401).end();return;}
    const key = await database.accountLink(provider.issuer,session.userId);
    if(!key||!live(session)){res.status(401).end();return;}
    const revision:unknown = req.body?.revision;
    const value = validateAccountPreferences(req.body?.value);
    if(typeof revision!=="number"||!Number.isInteger(revision)||revision<0||revision>=2_147_483_647||!value||Buffer.byteLength(JSON.stringify(value))>10_000) {
      res.status(400).end();return;
    }
    // An old tab must prove this is the same session that loaded the preferences.
    if(req.body?.context!==preferenceContext(session)){res.status(409).end();return;}
    const updated = await database.saveAccountPreferences(key,revision,value);
    res.status(updated?200:409).json(updated?{revision:revision+1,value}:await database.accountPreferences(key));
  });
  post("sign-out",async(req,res)=>{
    const credential = provider.credential(req.get("cookie")??"");
    const session = await withinProviderDeadline(provider.verify(credential));
    if(session&&req.body?.context!==undefined&&req.body.context!==preferenceContext(session)){res.status(409).end();return;}
    if(session)endSession(session,"signed-out");
    const result = await withinProviderDeadline(provider.signOut(credential));
    if(!result.ok){res.status(503).json({state:"unavailable"});return;}
    cookies(res,result);
    res.status(204).end();
  });

  // This opaque context prevents queued writes from a tab formerly signed into
  // another account. It has no authentication privileges and is not stored.
  function preferenceContext(session:AccountSession):string {
    return ticketKey(`${provider.issuer}\n${session.userId}\n${session.sessionId}`);
  }

  io.use((socket,next)=>{
    const token:unknown = socket.handshake.auth?.accountTicket;
    if(token===undefined){next();return;}
    const key = typeof token==="string"&&/^[a-f0-9]{64}$/.test(token) ? ticketKey(token) : "";
    const ticket = tickets.get(key);
    if(!ticket||ticket.expiresAt<=Date.now()||!live(ticket.session)||socket.handshake.headers.origin!==origin) {
      next(new Error("Planetfall account session unavailable"));return;
    }
    tickets.delete(key);
    socket.data.accountPrincipal=ticket;
    socket.data.profileKey=ticket.profileKey;
    socket.use((_packet,continuePacket)=>{
      if(live(ticket.session))continuePacket();
      else endSession(ticket.session,"expired");
    });
    next();
  });

  async function checkSessions() {
    const now=Date.now();
    for(const [key,ticket] of tickets)if(ticket.expiresAt<=now)tickets.delete(key);
    for(const [key,expiry] of revoked)if(expiry<=now)revoked.delete(key);
    for(const [key,bucket] of limits)if(bucket.resetAt<=now)limits.delete(key);
    if(checking)return;
    checking=true;
    try {
      await ownership.reconcile();
      const accounts=new Map<string,Principal>();
      const guests=new Set<string>();
      for(const socket of io.sockets.sockets.values()) {
        const principal=socket.data.accountPrincipal as Principal|undefined;
        if(principal)accounts.set(principal.session.sessionId,principal);
        else if(typeof socket.data.profileKey==="string")guests.add(socket.data.profileKey);
      }
      try{
        for(const key of await database.linkedGuests([...guests]))profiles.holdGuest(key);
      }catch{/* guest-only mutations still check ownership in PostgreSQL */}
      for(const id of failedChecks)if(!accounts.has(id))failedChecks.delete(id);
      // Cap concurrent provider traffic and share a verification across tabs.
      const sessions=[...accounts.values()];
      for(let i=0;i<sessions.length;i+=8)await Promise.all(sessions.slice(i,i+8).map(async principal=>{
        if(!live(principal.session)){endSession(principal.session,"expired");return;}
        try {
          const verified=await withinProviderDeadline(provider.verify(principal.credential));
          if(!verified||verified.sessionId!==principal.session.sessionId||verified.userId!==principal.session.userId)
            endSession(principal.session,"expired");
          else failedChecks.delete(principal.session.sessionId);
        } catch {
          if(failedChecks.has(principal.session.sessionId))endSession(principal.session,"unavailable");
          else failedChecks.add(principal.session.sessionId);
        }
      }));
    } finally { checking=false; }
  }
  const timer=setInterval(()=>void checkSessions(),sessionCheckPeriod);
  timer.unref();
  return ()=>clearInterval(timer);
}
