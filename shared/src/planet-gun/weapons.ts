import type {PgGunState,PgWeaponId} from "./types.js";
export interface PgWeapon {name:string;damage:number;intervalMs:number;magazine:number;reserve:number;reloadMs:number;headMultiplier:number;hipSpread:number;adsSpread:number;adsFov:number;adsMs:number;sprintDelayMs:number;range:number;falloffStart:number;recoil:number;pellets:number;automatic:boolean;}
export const PG_WEAPONS:Record<PgWeaponId,PgWeapon>={
 pulse:{name:"Pulse Rifle",damage:25,intervalMs:115,magazine:30,reserve:120,reloadMs:1700,headMultiplier:1.5,hipSpread:.025,adsSpread:.003,adsFov:61,adsMs:180,sprintDelayMs:160,range:95,falloffStart:34,recoil:.012,pellets:1,automatic:true},
 nova:{name:"Nova SMG",damage:19,intervalMs:75,magazine:36,reserve:144,reloadMs:1450,headMultiplier:1.4,hipSpread:.035,adsSpread:.009,adsFov:67,adsMs:120,sprintDelayMs:110,range:65,falloffStart:17,recoil:.009,pellets:1,automatic:true},
 photon:{name:"Photon Shotgun",damage:15,intervalMs:720,magazine:7,reserve:35,reloadMs:2100,headMultiplier:1.25,hipSpread:.085,adsSpread:.065,adsFov:71,adsMs:160,sprintDelayMs:180,range:36,falloffStart:10,recoil:.065,pellets:8,automatic:false},
 quasar:{name:"Quasar Carbine",damage:38,intervalMs:260,magazine:16,reserve:64,reloadMs:1800,headMultiplier:1.8,hipSpread:.032,adsSpread:.0015,adsFov:49,adsMs:240,sprintDelayMs:190,range:120,falloffStart:50,recoil:.026,pellets:1,automatic:false},
 rail:{name:"Rail Laser",damage:80,intervalMs:1100,magazine:5,reserve:25,reloadMs:2400,headMultiplier:1.5,hipSpread:.07,adsSpread:.0005,adsFov:34,adsMs:340,sprintDelayMs:230,range:150,falloffStart:90,recoil:.085,pellets:1,automatic:false},
 comet:{name:"Comet Hand Cannon",damage:34,intervalMs:310,magazine:9,reserve:54,reloadMs:1350,headMultiplier:1.6,hipSpread:.025,adsSpread:.004,adsFov:65,adsMs:130,sprintDelayMs:120,range:75,falloffStart:25,recoil:.042,pellets:1,automatic:false},
};
export const PG_PRIMARY_WEAPONS=["pulse","nova","photon","quasar","rail"] as const;
export function pgCreateGun(id:PgWeaponId):PgGunState{const w=PG_WEAPONS[id];return {id,magazine:w.magazine,reserve:w.reserve,reloadUntil:0,nextFireAt:0,shots:0,recoil:0};}
export function pgWeaponValid(id:unknown):id is PgWeaponId{return typeof id==="string"&&Object.hasOwn(PG_WEAPONS,id);}
export function pgFinishReload(gun:PgGunState,now:number):void {if(gun.reloadUntil&&now>=gun.reloadUntil){const needed=Math.min(PG_WEAPONS[gun.id].magazine-gun.magazine,gun.reserve);gun.magazine+=needed;gun.reserve-=needed;gun.reloadUntil=0;}}
export function pgStartReload(gun:PgGunState,now:number):boolean {pgFinishReload(gun,now);if(gun.reloadUntil||gun.magazine>=PG_WEAPONS[gun.id].magazine||gun.reserve<=0)return false;gun.reloadUntil=now+PG_WEAPONS[gun.id].reloadMs;return true;}
export function pgSpread(id:PgWeaponId,adsFactor:number,moving:boolean,airborne:boolean):number{const w=PG_WEAPONS[id];return (w.hipSpread+(w.adsSpread-w.hipSpread)*Math.max(0,Math.min(1,adsFactor)))*(airborne?1.55:moving?1.2:1);}
export function pgDamage(id:PgWeaponId,distance:number,head:boolean):number {const w=PG_WEAPONS[id],fall=1-.45*Math.max(0,Math.min(1,(distance-w.falloffStart)/Math.max(1,w.range-w.falloffStart)));return Math.round(w.damage*fall*(head?w.headMultiplier:1));}
