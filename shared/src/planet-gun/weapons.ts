import type {PgGunState,PgWeaponId,PgModuleId} from "./types.js";
import {pgValidateModules} from "./loadouts.js";
export {PG_PRIMARY_WEAPONS} from "./loadouts.js";
export interface PgWeapon {name:string;damage:number;intervalMs:number;magazine:number;reserve:number;reloadMs:number;headMultiplier:number;hipSpread:number;adsSpread:number;adsFov:number;adsMs:number;sprintDelayMs:number;range:number;falloffStart:number;recoil:number;pellets:number;automatic:boolean;burstShots?:number;burstRecoveryMs?:number;heatPerShot?:number;heatCooldownPerSecond?:number;overheatMs?:number;}
export const PG_WEAPONS:Record<PgWeaponId,PgWeapon>={
 pulse:{name:"Pulse Rifle",damage:25,intervalMs:115,magazine:30,reserve:120,reloadMs:1700,headMultiplier:1.5,hipSpread:.025,adsSpread:.003,adsFov:61,adsMs:180,sprintDelayMs:160,range:95,falloffStart:34,recoil:.012,pellets:1,automatic:true},
 nova:{name:"Nova SMG",damage:19,intervalMs:75,magazine:36,reserve:144,reloadMs:1450,headMultiplier:1.4,hipSpread:.035,adsSpread:.009,adsFov:67,adsMs:120,sprintDelayMs:110,range:65,falloffStart:17,recoil:.009,pellets:1,automatic:true},
 photon:{name:"Photon Shotgun",damage:15,intervalMs:720,magazine:7,reserve:35,reloadMs:2100,headMultiplier:1.25,hipSpread:.085,adsSpread:.065,adsFov:71,adsMs:160,sprintDelayMs:180,range:36,falloffStart:10,recoil:.065,pellets:8,automatic:false},
 quasar:{name:"Quasar Carbine",damage:38,intervalMs:260,magazine:16,reserve:64,reloadMs:1800,headMultiplier:1.8,hipSpread:.032,adsSpread:.0015,adsFov:49,adsMs:240,sprintDelayMs:190,range:120,falloffStart:50,recoil:.026,pellets:1,automatic:false},
 rail:{name:"Rail Laser",damage:80,intervalMs:1100,magazine:5,reserve:25,reloadMs:2400,headMultiplier:1.5,hipSpread:.07,adsSpread:.0005,adsFov:34,adsMs:340,sprintDelayMs:230,range:150,falloffStart:90,recoil:.085,pellets:1,automatic:false},
 comet:{name:"Comet Hand Cannon",damage:34,intervalMs:310,magazine:9,reserve:54,reloadMs:1350,headMultiplier:1.6,hipSpread:.025,adsSpread:.004,adsFov:65,adsMs:130,sprintDelayMs:120,range:75,falloffStart:25,recoil:.042,pellets:1,automatic:false},
 helix:{name:"Helix Burst Rifle",damage:24,intervalMs:80,burstShots:3,burstRecoveryMs:300,magazine:27,reserve:108,reloadMs:1800,headMultiplier:1.65,hipSpread:.028,adsSpread:.002,adsFov:57,adsMs:190,sprintDelayMs:170,range:105,falloffStart:42,recoil:.0175,pellets:1,automatic:false},
 arc:{name:"Arc Blaster",damage:29,intervalMs:180,magazine:20,reserve:100,reloadMs:1700,headMultiplier:1.3,hipSpread:.027,adsSpread:.006,adsFov:66,adsMs:125,sprintDelayMs:115,range:60,falloffStart:22,recoil:.018,pellets:1,automatic:true},
 prism:{name:"Prism Beam",damage:8,intervalMs:70,magazine:100,reserve:300,reloadMs:1900,headMultiplier:1.1,hipSpread:.025,adsSpread:.003,adsFov:66,adsMs:150,sprintDelayMs:130,range:60,falloffStart:25,recoil:.0025,pellets:1,automatic:true,heatPerShot:.04,heatCooldownPerSecond:.38,overheatMs:900},
 orbit:{name:"Orbit Sidearm",damage:17,intervalMs:135,magazine:15,reserve:90,reloadMs:1250,headMultiplier:1.5,hipSpread:.026,adsSpread:.005,adsFov:69,adsMs:110,sprintDelayMs:105,range:55,falloffStart:18,recoil:.018,pellets:1,automatic:false},
};
const profiles=new Map<string,Readonly<PgWeapon>>();
/** Canonical module order gives every supported combination one immutable cached profile. */
export function pgWeaponProfile(id:PgWeaponId,modules:readonly PgModuleId[]=[]):Readonly<PgWeapon> {
 if(!pgWeaponValid(id))throw new Error("Invalid PlanetGun weapon");
 if(!modules.length)return PG_WEAPONS[id];
 const key=`${id}:${JSON.stringify([...modules].sort())}`,cached=profiles.get(key);if(cached)return cached;
 const valid=pgValidateModules(id,modules,3);if(!valid)throw new Error("Invalid PlanetGun module combination");
 const w={...PG_WEAPONS[id]};
 for(const module of valid)switch(module){
  case "precision-lens":w.adsFov=Math.max(28,w.adsFov*.82);w.adsMs+=40;break;
  case "gyro-stabilizer":w.recoil*=.84;w.adsMs+=25;w.sprintDelayMs+=20;break;
  case "expanded-cell":w.magazine=Math.ceil(w.magazine*1.2);w.reloadMs+=250;break;
  case "rapid-charge-cell":w.reloadMs=Math.round(w.reloadMs*.85);w.magazine=Math.max(1,Math.floor(w.magazine*.85));break;
  case "lightweight-frame":w.adsMs=Math.round(w.adsMs*.85);w.sprintDelayMs=Math.round(w.sprintDelayMs*.8);w.recoil*=1.15;break;
 }
 const profile=Object.freeze(w);profiles.set(key,profile);return profile;
}
type ProfileGun={id:PgWeaponId;modules?:readonly PgModuleId[]};
const gunProfiles=new WeakMap<ProfileGun,{id:PgWeaponId;modules:ProfileGun["modules"];profile:Readonly<PgWeapon>}>();
export function pgGunProfile(gun:ProfileGun):Readonly<PgWeapon>{const cached=gunProfiles.get(gun);if(cached?.id===gun.id&&cached.modules===gun.modules)return cached.profile;const profile=pgWeaponProfile(gun.id,gun.modules);gunProfiles.set(gun,{id:gun.id,modules:gun.modules,profile});return profile;}
export function pgCreateGun(id:PgWeaponId,modules:readonly PgModuleId[]=[]):PgGunState{const normalized=pgValidateModules(id,modules,3);if(!normalized)throw new Error("Invalid PlanetGun modules");const w=pgWeaponProfile(id,normalized);return {id,modules:Object.freeze(normalized),magazine:w.magazine,reserve:w.reserve,reloadUntil:0,nextFireAt:0,shots:0,recoil:0,...(w.burstShots?{burstRemaining:0}:{}),...(w.heatPerShot?{heat:0,heatUpdatedAt:0,overheatedUntil:0}:{})};}
export function pgWeaponValid(id:unknown):id is PgWeaponId{return typeof id==="string"&&Object.hasOwn(PG_WEAPONS,id);}
export function pgFinishReload(gun:PgGunState,now:number):void {if(gun.reloadUntil&&now>=gun.reloadUntil){const needed=Math.min(Math.max(0,pgGunProfile(gun).magazine-gun.magazine),gun.reserve);gun.magazine+=needed;gun.reserve-=needed;gun.reloadUntil=0;}}
export function pgStartReload(gun:PgGunState,now:number):boolean {pgFinishReload(gun,now);const w=pgGunProfile(gun);if(gun.reloadUntil||gun.magazine>=w.magazine||gun.reserve<=0)return false;gun.reloadUntil=now+w.reloadMs;gun.burstRemaining=0;return true;}
/** Cooling uses authoritative time; continuous accepted beam ticks do not cool between ticks. */
export function pgUpdateGunHeat(gun:PgGunState,now:number):void {
 const w=pgGunProfile(gun);if(!w.heatPerShot)return;
 const previous=gun.heatUpdatedAt??now,elapsed=Math.max(0,now-Math.max(previous,gun.nextFireAt));
 gun.heat=Math.max(0,(gun.heat??0)-elapsed/1000*(w.heatCooldownPerSecond??0));gun.heatUpdatedAt=Math.max(previous,now);
}
export function pgSpread(id:PgWeaponId,adsFactor:number,moving:boolean,airborne:boolean,modules:readonly PgModuleId[]=[]):number{const w=pgWeaponProfile(id,modules);return (w.hipSpread+(w.adsSpread-w.hipSpread)*Math.max(0,Math.min(1,adsFactor)))*(airborne?1.55:moving?1.2:1);}
export function pgDamage(id:PgWeaponId,distance:number,head:boolean):number {const w=PG_WEAPONS[id],fall=1-.45*Math.max(0,Math.min(1,(distance-w.falloffStart)/Math.max(1,w.range-w.falloffStart)));return Math.round(w.damage*fall*(head?w.headMultiplier:1));}
