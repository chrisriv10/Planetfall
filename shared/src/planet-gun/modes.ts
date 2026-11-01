import type {Vec3} from "../index.js";
import type {PgTeam,PgWeaponId,PgLoadout} from "./types.js";
import type {PgCollisionSnapshot} from "./mode-collision.js";
import {PG_PANEL_SOCKETS,type PgPanelSocket} from "./mode-collision.js";
import type {PgMovementRules} from "./movement-rules.js";

export const PG_MODE_IDS=["deathmatch","planetstrike","planetwatch","planetsiege","planetzombies"] as const;
export type PgModeId=typeof PG_MODE_IDS[number];
export const PG_MODES={
 deathmatch:{name:"Team Deathmatch",summary:"Solar versus Void. Earn eliminations, respawn and race to the score limit.",equipment:"Saved Combat Kits",maxPlayers:12},
 planetstrike:{name:"PlanetStrike",summary:"Buy equipment. Plant or defuse the shared charge. One life each round.",equipment:"Match credits · tactical equipment",maxPlayers:12},
 planetwatch:{name:"PlanetWatch",summary:"Choose a unique hero. Capture, contest and hold the Control Relay.",equipment:"Six heroes · abilities and ultimates",maxPlayers:12},
 planetsiege:{name:"PlanetSiege",summary:"Scout and prepare, breach the compound, then seize its uplink room.",equipment:"Twelve operators · limited gadgets",maxPlayers:12},
 planetzombies:{name:"PlanetZombies",summary:"One to four survivors face finite waves. Unlock, upgrade and revive together.",equipment:"Run points · weapon racks and perks",maxPlayers:4},
} as const;
export function pgModeId(raw:unknown):PgModeId|null{return typeof raw==="string"&&(PG_MODE_IDS as readonly string[]).includes(raw)?raw as PgModeId:null;}
export type PgLifeState="alive"|"downed"|"eliminated";
export type PgTacticalSide="attack"|"defend";
export type PgModeAction=
 | {kind:"select";sequence:number;lifeId:number;characterId:string;loadout?:PgLoadout}
 | {kind:"buy";sequence:number;lifeId:number;itemId:string}
 | {kind:"interact";sequence:number;lifeId:number;targetId:string;held:boolean}
 | {kind:"ability";sequence:number;lifeId:number;slot:0|1|2;targetId?:string;position?:Vec3}
 | {kind:"deploy";sequence:number;lifeId:number;socketId:string}
 | {kind:"drone";sequence:number;lifeId:number;control:boolean;moveX:number;moveZ:number;yaw:number;pitch:number}
 | {kind:"camera";sequence:number;lifeId:number;cameraId:string|null}
 | {kind:"pickup";sequence:number;lifeId:number;entityId:string};
export interface PgModeActionResult {ok:boolean;error?:string;}
export interface PgCombatModifiers {fireIntervalMultiplier?:number;reloadMultiplier?:number;adsTimeMultiplier?:number;precisionDamageMultiplier?:number;recoilMultiplier?:number;coolingMultiplier?:number;damage?:number;reload?:number;interval?:number;heatPerShot?:number;heatCoolingPerSecond?:number;overheatMs?:number;}
export interface PgModeControl {movement:PgMovementRules;canMove:boolean;canFire:boolean;combat:PgCombatModifiers;viewOrigin?:Vec3|null;lastActionSequence?:number;}
export interface PgModeEffect {id:string;kind:"smoke"|"flash"|"heat"|"gravity"|"heal"|"relay"|"shield"|"recon"|"breach"|"trip"|"jammer"|"sensor"|"electric";ownerId:string;team:PgTeam;position:Vec3;end?:Vec3;radius:number;startsAt:number;endsAt:number;hp:number;maxHp:number;}
export interface PgModePilot {life:PgLifeState;maxHp:number;shield:number;characterId:string|null;side:PgTacticalSide;credits:number;armor:number;cooldowns:[number,number];charges:[number,number];ultimate:number;contribution:number;interaction:{targetId:string;startedAt:number;durationMs:number}|null;}
export interface PgStrikePilot extends PgModePilot {carrying:boolean;utilities:[number,number,number];primaryUnlocked:boolean;}
export interface PgSiegePilot extends PgModePilot {droneId:string|null;cameraId:string|null;reinforcements:number;controllingDrone?:boolean;}
export interface PgZombiePilot extends PgModePilot {points:number;upgrade:0|1|2|3;perks:string[];primaryUnlocked:boolean;bleedoutAt:number;selfRecovery:boolean;revives:number;purchases:number;}
export interface PgModeDrop {id:string;kind:"weapon"|"charge";position:Vec3;weapon?:PgWeaponId;magazine:number;reserve:number;}
export interface PgModeIntel {targetId:string;position:Vec3;at:number;expiresAt:number;}
export interface PgDrone {id:string;ownerId:string;position:Vec3;yaw:number;pitch:number;hp:number;disabledUntil:number;}
export interface PgZombie {id:string;kind:"drifter"|"skitter"|"bulwark";position:Vec3;yaw:number;hp:number;maxHp:number;windupUntil:number;}
interface PgModeCommon {collision:PgCollisionSnapshot;effects:PgModeEffect[];pilots:Record<string,PgModePilot>;round:number;subphase:string;deadline:number;controls?:Record<string,PgModeControl>;}
export type PgModeSnapshot=
 | (PgModeCommon&{id:"planetstrike";pilots:Record<string,PgStrikePilot>;attackTeam:PgTeam;roundScores:Record<PgTeam,number>;charge:{carrierId:string|null;position:Vec3|null;site:"A"|"B"|null;detonatesAt:number};drops:PgModeDrop[]})
 | (PgModeCommon&{id:"planetwatch";control:{owner:PgTeam|null;capture:Record<PgTeam,number>;progress:Record<PgTeam,number>;contested:boolean;point:number};roundScores:Record<PgTeam,number>;intel:PgModeIntel[]})
 | (PgModeCommon&{id:"planetsiege";pilots:Record<string,PgSiegePilot>;attackTeam:PgTeam;roundScores:Record<PgTeam,number>;capture:number;site:number;drones:PgDrone[];intel:PgModeIntel[]})
 | (PgModeCommon&{id:"planetzombies";pilots:Record<string,PgZombiePilot>;wave:number;remaining:number;queued:number;zombies:PgZombie[];power:boolean;unlocked:string[];reason:string|null});

/** Authored ground-level anchors; every site has independent exterior approaches. */
export const PG_OBJECTIVES={
 strike:[{id:"A",position:{x:-28,y:0,z:-9},radius:3.2},{id:"B",position:{x:28,y:0,z:15},radius:3.2}],
 relay:[{position:{x:0,y:0,z:0},radius:5.5},{position:{x:-28,y:0,z:-9},radius:5},{position:{x:28,y:0,z:15},radius:5}],
 uplink:[{position:{x:-28,y:0,z:-9},radius:4.5},{position:{x:28,y:0,z:15},radius:4.5}],
 power:{x:-16,y:0,z:8},station:{x:-18,y:0,z:10},
 racks:[{id:"rack-pulse",position:{x:-22,y:0,z:6},weapon:"pulse"},{id:"rack-nova",position:{x:-18,y:0,z:10},weapon:"nova"},{id:"rack-photon",position:{x:-28,y:0,z:-5},weapon:"photon"},{id:"rack-rail",position:{x:27,y:0,z:14},weapon:"rail"}] as const,
} as const;
export const PG_STRIKE_PRICES:Readonly<Record<string,number>>=Object.freeze({orbit:200,comet:500,nova:1200,photon:1400,arc:1700,pulse:2400,helix:2500,quasar:2700,prism:3000,rail:4000,armor:650,smoke:300,flash:200,damage:400});
export const PG_ZOMBIE_PRICES=Object.freeze({ammo:200,door:650,upgrade:[900,1600,2400] as const,"perk-vitality":750,"perk-reload":600,"perk-stamina":450,"rack-pulse":700,"rack-nova":700,"rack-photon":950,"rack-rail":1800,"rack-comet":350,"rack-orbit":350});
export const PG_SIEGE_CAMERAS=[{id:"west-camera",position:{x:-34,y:2.5,z:-19}},{id:"east-camera",position:{x:34,y:2.5,z:26}}] as const;
/** Quarantine infill occupies the habitat's genuinely open court edge, including its gallery. */
export const PG_ZOMBIE_COURT_GATE:PgPanelSocket={id:"west-court-access",compound:"west",solid:{id:"panel-west-court-access",kind:"structure",center:{x:-15,y:4.5,z:-10},half:{x:.16,y:4.5,z:3},mantle:false},approaches:[{x:-16.2,y:0,z:-10},{x:-13.8,y:0,z:-10}]};
export const PG_ZOMBIE_DOORS:readonly PgPanelSocket[]=[...PG_PANEL_SOCKETS.filter(s=>s.compound==="west"||s.compound==="east"),PG_ZOMBIE_COURT_GATE];
export const PG_ZOMBIE_QUARANTINE_WINGS=[
 {id:"quarantine-north",kind:"structure" as const,center:{x:-15,y:4.5,z:-17},half:{x:.16,y:4.5,z:4},mantle:false},
 {id:"quarantine-south",kind:"structure" as const,center:{x:-15,y:4.5,z:-4},half:{x:.16,y:4.5,z:3},mantle:false},
 {id:"quarantine-upper-north",kind:"structure" as const,center:{x:-25,y:6,z:-21},half:{x:10,y:3,z:.16},mantle:false},
 {id:"quarantine-upper-south",kind:"structure" as const,center:{x:-25,y:6,z:-1},half:{x:10,y:3,z:.16},mantle:false},
 {id:"quarantine-upper-west",kind:"structure" as const,center:{x:-35,y:6,z:-11},half:{x:.16,y:3,z:10},mantle:false},
];
export const PG_ZOMBIE_ENTRIES:readonly Vec3[]=[{x:-34,y:0,z:-19},{x:-17,y:0,z:-19},{x:-17,y:0,z:-3},{x:-34,y:0,z:-3},{x:-28,y:0,z:-19},{x:-18,y:0,z:-9},
 {x:-30.5,y:6.8,z:-19},{x:-22.5,y:6.8,z:-19},{x:-30.5,y:6.8,z:-15.5},{x:-22.5,y:6.8,z:-15.5},{x:-26.5,y:6.8,z:-17.25},
 {x:-9,y:4.25,z:1},{x:9,y:4.25,z:1},{x:-4,y:4.25,z:2.5},{x:4,y:4.25,z:-.5}];
