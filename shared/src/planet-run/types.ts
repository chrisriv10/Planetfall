import type { BotDifficulty, EmoteType, GuestProfile, Vec3 } from "../index.js";

export type PrPhase = "lobby" | "intro" | "countdown" | "running" | "round-results" | "results";
export type PrCategory = "race" | "survival" | "final";
export type PrStatus = "active" | "qualified" | "eliminated";
export type PrRoundId = "cargo-cyclone" | "solar-sweep" | "meteor-garden" | "flux-gardens" | "capacitor-causeway" | "shatterdeck";
export interface PrInput { sequence:number; moveX:number; moveZ:number; jump:boolean; dive:boolean; }
export interface PrMotion {
  position:Vec3; velocity:Vec3; grounded:boolean; yaw:number;
  coyoteUntil:number; jumpBufferedUntil:number; diveUntil:number; diveReadyAt:number;
  jumpHeld:boolean; diveHeld:boolean; supportId:string|null;
}
export interface PrPlayerState extends GuestProfile, PrMotion {
  id:string; name:string; color:string; isBot:boolean; connected:boolean; ready:boolean;
  emote:EmoteType|null;emoteStartedAt:number;status:PrStatus; checkpoint:number; place:number; qualifiedRounds:number; lastInputSequence:number;
}
export interface PrConfiguration {targetPlayers:10|20|30;fillBots:boolean;botDifficulty:BotDifficulty;}
export interface PrPlatform {id:string;center:Vec3;half:Vec3;motion?:{axis:"x"|"z";distance:number;period:number;phase:number};conveyor?:Vec3;gravityScale?:number;}
export interface PrObstacle {id:string;kind:"rotator"|"door"|"meteor"|"boost"|"shutter"|"arc"|"barrier";center:Vec3;half:Vec3;period:number;phase:number;strength:number;lane?:0|1|2;travel?:number;launch?:Vec3;}
export interface PrCheckpoint {center:Vec3;half:Vec3;spawn:Vec3;}
export interface PrTile {id:number;deck:number;column:number;row:number;center:Vec3;neighbors:number[];}
export interface PrRoundDefinition {
  id:PrRoundId;name:string;category:PrCategory;minimumPlayers:number;maximumPlayers:number;
  timeoutMs:number;objective:string;theme:string;platforms:PrPlatform[];obstacles:PrObstacle[];
  checkpoints:PrCheckpoint[];finish:PrCheckpoint|null;waypoints:Vec3[];spawns:Vec3[];killY:number;tiles:PrTile[];
}
/** Trigger time is relative to authoritative round start. Null means untouched. */
export interface PrTileDelta {id:number;triggeredAt:number;}
export type PrSnapshotPlayer = Omit<PrPlayerState,"fallbucks"|"crowns"|"sessionTotalXp"|"sessionLevel"|"sessionXp"|"ownedCosmetics"|"unlockedPassRewards">;
export interface PrSnapshot {
  serverTime:number;roundStartedAt:number;phaseEndsAt:number;phase:PrPhase;roundId:PrRoundId|null;
  roundIndex:number;seed:number;players:PrSnapshotPlayer[];qualificationTarget:number;winnerId:string|null;
  tileRevision:number;tiles:PrTileDelta[];tilesFull:boolean;
}
export interface PrRoomView {code:string;gameFamily:"planet-run";hostId:string;phase:PrPhase;configuration:PrConfiguration;players:PrPlayerState[];}
export type PrJoinResult={ok:true;room:PrRoomView;playerId:string;sessionToken:string}|{ok:false;error:string};
export interface PrClientToServerEvents {
  "pr:room:create":(payload:{name:string;sessionToken?:string},ack:(r:PrJoinResult)=>void)=>void;
  "pr:room:join":(payload:{code:string;name:string;sessionToken?:string},ack:(r:PrJoinResult)=>void)=>void;
  "pr:room:ready":(payload:{ready:boolean})=>void;
  "pr:room:configure":(payload:Partial<PrConfiguration>)=>void;
  "pr:match:start":()=>void;
  "pr:match:quick-start":()=>void;
  "pr:match:return":()=>void;
  "pr:player:input":(payload:PrInput)=>void;
  "pr:emote":(payload:{emote:EmoteType})=>void;
  "pr:tiles:sync":()=>void;
  "pr:dev:start":(payload:{roundId:PrRoundId;seed:number;players:10|20|30})=>void;
  "pr:shop:buy":(payload:{itemId:string},ack:(r:{ok:boolean;error?:string})=>void)=>void;
  "pr:shop:equip":(payload:{itemId:string},ack:(r:{ok:boolean;error?:string})=>void)=>void;
}
export interface PrServerToClientEvents {
  "pr:room:state":(room:PrRoomView)=>void;
  "pr:match:snapshot":(snapshot:PrSnapshot)=>void;
  "pr:tiles:delta":(payload:{roundIndex:number;revision:number;tiles:PrTileDelta[]})=>void;
  "pr:error":(payload:{message:string})=>void;
}
