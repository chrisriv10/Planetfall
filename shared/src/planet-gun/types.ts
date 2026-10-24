import type {Vec3,GuestProfile,BotDifficulty} from "../index.js";
export type PgTeam="solar"|"void";
export type PgWeaponId="pulse"|"nova"|"photon"|"quasar"|"rail"|"comet";
export type PgPhase="lobby"|"countdown"|"playing"|"overtime"|"results";
export interface PgInput {sequence:number;moveX:number;moveZ:number;yaw:number;pitch:number;jump:boolean;sprint:boolean;crouch:boolean;ads:boolean;}
export interface PgMotion {position:Vec3;velocity:Vec3;yaw:number;pitch:number;grounded:boolean;crouched:boolean;ion:number;launchY:number;jumpHeld:boolean;coyoteUntil:number;jumpBufferUntil:number;lastJumpAt:number;slideUntil:number;slideReadyAt:number;wallId:string|null;wallNormal:Vec3;wallUntil:number;wallReadyAt:number;mantleFrom:Vec3|null;mantleTo:Vec3|null;mantleStart:number;mantleUntil:number;mode:"ground"|"air"|"sprint"|"slide"|"wall-run"|"mantle";}
export interface PgSolid {id:string;center:Vec3;half:Vec3;kind:"floor"|"habitat"|"planter"|"utility"|"transit"|"wall-run"|"stair"|"rail"|"landscape"|"tree"|"structure";mantle:boolean;wallRunFaces?:readonly ("x-"|"x+"|"z-"|"z+")[];}
export interface PgSpawn {id:string;team:PgTeam;position:Vec3;yaw:number;}
export interface PgNavNode {id:number;position:Vec3;links:{to:number;kind:"walk"|"jump"|"mantle"|"wall-run"}[];}
export interface PgMap {id:"nova-block";name:string;halfWidth:number;halfDepth:number;solids:PgSolid[];spawns:PgSpawn[];navigation:PgNavNode[];}
export interface PgLoadout {primary:Exclude<PgWeaponId,"comet">;secondary:"comet";}
export interface PgGunState {id:PgWeaponId;magazine:number;reserve:number;reloadUntil:number;nextFireAt:number;shots:number;recoil:number;}
export interface PgPlayer extends PgMotion,GuestProfile {id:string;name:string;color:string;isBot:boolean;connected:boolean;ready:boolean;team:PgTeam;hp:number;kills:number;deaths:number;lifeId:number;deadAt:number;respawnAt:number;protectedUntil:number;lastDamageAt:number;lastAttacker:string|null;lastInputSequence:number;loadout:PgLoadout;slot:0|1;guns:[PgGunState,PgGunState];adsSince:number;fireReadyAt:number;}
export interface PgConfiguration {targetPlayers:4|8|12;fillBots:boolean;botDifficulty:BotDifficulty;scoreLimit:25|50|75;}
export interface PgKill {id:number;at:number;killerId:string;victimId:string;weapon:PgWeaponId;headshot:boolean;}
export type PgSnapshotPlayer=Omit<PgPlayer,"fallbucks"|"crowns"|"sessionTotalXp"|"sessionLevel"|"sessionXp"|"ownedCosmetics"|"unlockedPassRewards">;
export interface PgSnapshot {phase:PgPhase;serverTime:number;phaseEndsAt:number;scores:Record<PgTeam,number>;winner:PgTeam|null;players:PgSnapshotPlayer[];feed:PgKill[];}
export interface PgRoomView {gameFamily:"planet-gun";code:string;hostId:string;phase:PgPhase;configuration:PgConfiguration;players:PgPlayer[];}
export type PgJoinResult={ok:true;playerId:string;sessionToken:string;room:PgRoomView}|{ok:false;error:string};
export interface PgFireRequest {sequence:number;clientTime:number;weapon:PgWeaponId;yaw:number;pitch:number;}
export interface PgShot {id:number;at:number;shooterId:string;weapon:PgWeaponId;origin:Vec3;end:Vec3;targetId:string|null;damage:number;headshot:boolean;}
export interface PgClientToServerEvents {
 "pg:clock":(ack:(serverTime:number)=>void)=>void;
 "pg:room:create":(p:{name:string;sessionToken?:string},ack:(r:PgJoinResult)=>void)=>void;
 "pg:room:join":(p:{code:string;name:string;sessionToken?:string},ack:(r:PgJoinResult)=>void)=>void;
 "pg:room:ready":(p:{ready:boolean})=>void;
 "pg:room:configure":(p:Partial<PgConfiguration>)=>void;
 "pg:loadout":(p:PgLoadout)=>void;
 "pg:match:start":()=>void;"pg:match:quick-start":()=>void;"pg:match:return":()=>void;
 "pg:player:input":(p:PgInput)=>void;
 "pg:weapon:fire":(p:PgFireRequest)=>void;"pg:weapon:reload":()=>void;"pg:weapon:switch":(p:{slot:0|1})=>void;
 "pg:shop:buy":(p:{itemId:string},ack:(r:{ok:boolean;error?:string})=>void)=>void;
 "pg:shop:equip":(p:{itemId:string},ack:(r:{ok:boolean;error?:string})=>void)=>void;
}
export interface PgServerToClientEvents {"pg:room:state":(p:PgRoomView)=>void;"pg:match:snapshot":(p:PgSnapshot)=>void;"pg:combat:shot":(p:PgShot)=>void;"pg:error":(p:{message:string})=>void;}
