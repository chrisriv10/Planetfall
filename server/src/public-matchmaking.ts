import type {Server,Socket} from "socket.io";
import {BALANCE,sanitizeName,type ClientToServerEvents,type ServerToClientEvents,type JoinResult} from "@planetfall/shared";
import type {GameRoom} from "./game-room.js";
type Pilot=Socket<ClientToServerEvents,ServerToClientEvents>;
type Entry={key:string;socketId:string;playerId:string;room:GameRoom};
export const PUBLIC_BOT_WAIT_MS=15_000;
export const PUBLIC_SEARCH_LIMIT_MS=5*60_000;

/** Public waiting rooms reuse Classic's membership, readiness and simulation. */
export class PublicMatchmaking {
  private rooms=new Set<GameRoom>();
  private running=new Set<GameRoom>();
  private entries=new Map<string,Entry>();
  private attempts=new Map<string,number>();
  constructor(private io:Server<ClientToServerEvents,ServerToClientEvents>,private hooks:{
    create:()=>GameRoom; exists:(room:GameRoom)=>boolean;
    current:(socket:Pilot)=>boolean; leave:(socket:Pilot)=>void;
    attach:(socket:Pilot,room:GameRoom,result:JoinResult)=>JoinResult;
  }){}
  bind(socket:Pilot):void {
    socket.on("quick:join",(payload,ack)=>{
      if(typeof ack!=="function")return;
      const key=socket.data.profileKey;
      if(typeof key!=="string")return ack({ok:false,error:"Connect your saved pilot before finding a match."});
      const existing=this.entries.get(key);
      if(existing?.socketId===socket.id&&existing.room.players.has(existing.playerId)&&existing.room.phase==="lobby") {
        const player=existing.room.players.get(existing.playerId)!;
        return ack({ok:true,room:existing.room.view(),playerId:player.id,sessionToken:player.sessionToken});
      }
      if(this.hooks.current(socket)||existing||[...this.io.sockets.sockets.values()].some(other=>other!==socket&&other.data.profileKey===key&&other.data.roomCode))
        return ack({ok:false,error:"This pilot is already in a room or searching in another tab."});
      const name=typeof payload?.name==="string"?sanitizeName(payload.name):"";
      if(!name)return ack({ok:false,error:"Choose a pilot name first."});
      const now=Date.now(),last=this.attempts.get(socket.id)??0;
      if(now-last<1000)return ack({ok:false,error:"Wait a moment before searching again."});
      this.attempts.set(socket.id,now);
      // Synchronous join/reservation prevents simultaneous requests overfilling.
      let room=[...this.rooms].find(r=>this.hooks.exists(r)&&r.phase==="lobby"&&r.matchmaking!.expiresAt>now&&r.players.size<BALANCE.maxPlayers&&![...r.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase()));
      if(!room){room=this.hooks.create();room.matchmaking={botsAvailableAt:now+PUBLIC_BOT_WAIT_MS,expiresAt:now+PUBLIC_SEARCH_LIMIT_MS};this.rooms.add(room);}
      const result=room.join(socket,name);
      if(result.ok)this.entries.set(key,{key,socketId:socket.id,playerId:result.playerId,room});
      ack(this.hooks.attach(socket,room,result));
    });
    socket.on("quick:cancel",ack=>{
      if(typeof ack!=="function")return;
      const entry=this.entry(socket);
      if(!entry||entry.room.phase!=="lobby")return ack({ok:false,error:"No active public search to cancel."});
      this.hooks.leave(socket);ack({ok:true});
    });
    socket.on("quick:bots",ack=>{
      if(typeof ack!=="function")return;
      const entry=this.entry(socket),room=entry?.room;
      if(!entry||!room||room.phase!=="lobby")return ack({ok:false,error:"No active public lobby."});
      if(room.hostId!==entry.playerId)return ack({ok:false,error:"The lobby host can start with bots."});
      if(Date.now()<room.matchmaking!.botsAvailableAt)return ack({ok:false,error:"Give other players a moment to join first."});
      if([...room.players.values()].some(p=>!p.isBot&&p.id!==entry.playerId&&!p.ready))return ack({ok:false,error:"Wait for the other pilots to ready up."});
      room.prepareSolo(entry.playerId,Math.max(0,4-room.players.size));
      ack(room.phase!=="lobby"?{ok:true}:{ok:false,error:"The lobby is not ready to start."});
    });
  }
  release(socket:Pilot):void {const entry=this.entry(socket);if(entry)this.entries.delete(entry.key);}
  reattach(socket:Pilot,room:GameRoom,playerId:string):void {
    const entry=this.entries.get(socket.data.profileKey);
    if(entry?.room===room&&entry.playerId===playerId)entry.socketId=socket.id;
  }
  disconnect(socket:Pilot):boolean {
    this.attempts.delete(socket.id);
    const entry=this.entry(socket);
    if(entry?.room.phase==="lobby"){this.hooks.leave(socket);return true;}
    return false;
  }
  tick(now:number):void {
    for(const [key,entry]of this.entries)if(!this.hooks.exists(entry.room)||!entry.room.players.has(entry.playerId))this.entries.delete(key);
    for(const room of this.rooms){
      if(!this.hooks.exists(room)){this.rooms.delete(room);this.running.delete(room);continue;}
      if(room.phase!=="lobby"){this.running.add(room);continue;}
      if(this.running.delete(room)){room.matchmaking={botsAvailableAt:now+PUBLIC_BOT_WAIT_MS,expiresAt:now+PUBLIC_SEARCH_LIMIT_MS};room.emitRoom();}
      if(room.phase!=="lobby"||now<room.matchmaking!.expiresAt)continue;
      for(const entry of [...this.entries.values()].filter(e=>e.room===room)){
        const socket=this.io.sockets.sockets.get(entry.socketId);
        if(socket){this.hooks.leave(socket);socket.emit("quick:ended","Search ended after five minutes. You can find another match.");}
        else this.entries.delete(entry.key);
      }
      this.rooms.delete(room);
    }
  }
  private entry(socket:Pilot):Entry|undefined {
    const entry=this.entries.get(socket.data.profileKey);
    return entry?.socketId===socket.id?entry:undefined;
  }
  stop():void {this.entries.clear();this.rooms.clear();this.running.clear();this.attempts.clear();}
}
