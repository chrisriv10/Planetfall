import type {PgLoadout,PgModuleId,PgWeaponId} from "./types.js";

export const PG_PRIMARY_WEAPONS=["pulse","nova","photon","quasar","rail","helix","arc","prism"] as const;
export const PG_SECONDARY_WEAPONS=["comet","orbit"] as const;
export interface PgModule {name:string;category:"optic"|"stability"|"energy"|"handling";description:string;weapons:readonly PgWeaponId[];}
const allWeapons:readonly PgWeaponId[]=["pulse","nova","photon","quasar","rail","comet","helix","arc","prism","orbit"];
export const PG_MODULES:Record<PgModuleId,PgModule>={
 "reflex-array":{name:"Reflex Array",category:"optic",description:"Clear holographic aiming ring; unchanged handling.",weapons:allWeapons},
 "precision-lens":{name:"Precision Lens",category:"optic",description:"More magnification; +40ms ADS time.",weapons:allWeapons},
 "gyro-stabilizer":{name:"Gyro Stabilizer",category:"stability",description:"16% less recoil; +25ms ADS and +20ms sprint recovery.",weapons:allWeapons},
 "expanded-cell":{name:"Expanded Cell",category:"energy",description:"20% larger magazine; +250ms reload.",weapons:allWeapons},
 "rapid-charge-cell":{name:"Rapid Charge Cell",category:"energy",description:"15% faster reload; 15% smaller magazine.",weapons:allWeapons},
 "lightweight-frame":{name:"Lightweight Frame",category:"handling",description:"15% faster ADS and 20% faster sprint recovery; 15% more recoil.",weapons:allWeapons},
};

/** Network values contain IDs only. Unknown fields fail closed, including nested stat payloads. */
export function pgValidateModules(weapon:PgWeaponId,raw:unknown,max:number):PgModuleId[]|null {
 if(!allWeapons.includes(weapon))return null;
 if(raw===undefined)return [];
 if(!Array.isArray(raw)||raw.length>max)return null;
 const categories=new Set<string>(),result:PgModuleId[]=[];
 for(const id of raw){
  if(typeof id!=="string"||!Object.hasOwn(PG_MODULES,id))return null;
  const module=PG_MODULES[id as PgModuleId];
  if(!module.weapons.includes(weapon)||categories.has(module.category))return null;
  categories.add(module.category);result.push(id as PgModuleId);
 }
 return result.sort();
}
export function pgValidateLoadout(raw:unknown):PgLoadout|null {
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const value=raw as Record<string,unknown>;
 if(Object.keys(value).some(key=>!["primary","secondary","primaryModules","secondaryModules","kitId","name"].includes(key)))return null;
 if(!PG_PRIMARY_WEAPONS.includes(value.primary as PgLoadout["primary"])||!PG_SECONDARY_WEAPONS.includes(value.secondary as PgLoadout["secondary"]))return null;
 const primary=value.primary as PgLoadout["primary"],secondary=value.secondary as PgLoadout["secondary"];
 const primaryModules=pgValidateModules(primary,value.primaryModules,3),secondaryModules=pgValidateModules(secondary,value.secondaryModules,1);
 if(!primaryModules||!secondaryModules)return null;
 if(value.kitId!==undefined&&(!Number.isInteger(value.kitId)||Number(value.kitId)<0||Number(value.kitId)>4))return null;
 if(value.name!==undefined&&(typeof value.name!=="string"||!value.name.trim()||value.name.length>24||/[\x00-\x1f\x7f]/.test(value.name)))return null;
 return {primary,secondary,primaryModules,secondaryModules,...(value.kitId===undefined?{}:{kitId:value.kitId as 0|1|2|3|4}),...(value.name===undefined?{}:{name:(value.name as string).trim()})};
}
