import {parseBindingSettings,type BindingSettings} from "./input-bindings.js";
import {pgValidateLoadout,type PgLoadout,type PgModeId} from "./planet-gun/index.js";
import {validatePgCharacterPreference,type PgCharacterPreference,type PgCharacterPreferenceKey} from "./pg-character-preferences.js";

export interface AccountControls {
  mouseSensitivity:number;
  controllerSensitivity:number;
  invertY:boolean;
  cameraShake:"off"|"reduced"|"full";
}
export interface AccountPreferences {
  version:1;
  controls?:AccountControls;
  bindings?:BindingSettings;
  pgMode?:PgModeId;
  pgKits?:{version:1;activeSlot:number;kits:PgLoadout[]};
  pgCharacters?:{version:1;choices:Partial<Record<PgCharacterPreferenceKey,PgCharacterPreference>>};
}

const object = (value:unknown):value is Record<string,unknown> => value!==null&&typeof value==="object"&&!Array.isArray(value);
const sensitivity = (n:unknown):n is number => typeof n==="number"&&n>=0.4&&n<=2;
const isMode = (v:unknown):v is PgModeId => v==="deathmatch"||v==="planetstrike"||v==="planetwatch"||v==="planetsiege"||v==="planetzombies";

/** Canonical, bounded preferences only. Economy and equipment use the ledger. */
export function validateAccountPreferences(value:unknown):AccountPreferences|null {
  if(!object(value)||value.version!==1||Object.keys(value).some(k=>!["version","controls","bindings","pgMode","pgKits","pgCharacters"].includes(k)))return null;
  const result:AccountPreferences={version:1};
  if(value.controls!==undefined) {
    if(!object(value.controls))return null;
    const {mouseSensitivity,controllerSensitivity,invertY,cameraShake}=value.controls;
    if(!sensitivity(mouseSensitivity)||!sensitivity(controllerSensitivity)||typeof invertY!=="boolean"||
      cameraShake!=="off"&&cameraShake!=="reduced"&&cameraShake!=="full")return null;
    result.controls={mouseSensitivity,controllerSensitivity,invertY,cameraShake};
  }
  if(value.bindings!==undefined) {
    const raw=value.bindings;
    if(!object(raw)||raw.version!==1||!object(raw.overrides))return null;
    const bindings=parseBindingSettings(raw);
    if(Object.keys(bindings.overrides).length!==Object.keys(raw.overrides).length)return null;
    result.bindings=bindings;
  }
  if(value.pgMode!==undefined) {
    if(!isMode(value.pgMode))return null;
    result.pgMode=value.pgMode;
  }
  if(value.pgKits!==undefined) {
    const raw=value.pgKits;
    if(!object(raw)||raw.version!==1||typeof raw.activeSlot!=="number"||!Number.isInteger(raw.activeSlot)||raw.activeSlot<0||raw.activeSlot>4||!Array.isArray(raw.kits)||raw.kits.length!==5)return null;
    const kits=raw.kits.map(kit=>pgValidateLoadout(kit));
    if(kits.some((kit,index)=>!kit||kit.kitId!==index))return null;
    result.pgKits={version:1,activeSlot:raw.activeSlot,kits:kits as PgLoadout[]};
  }
  if(value.pgCharacters!==undefined) {
    const raw=value.pgCharacters;
    if(!object(raw)||raw.version!==1||!object(raw.choices))return null;
    const choices:NonNullable<AccountPreferences["pgCharacters"]>["choices"]={};
    for(const [key,item] of Object.entries(raw.choices)) {
      if(key!=="planetwatch"&&key!=="siege-attack"&&key!=="siege-defend")return null;
      const choice=validatePgCharacterPreference(key,item);
      if(!choice)return null;
      choices[key]=choice;
    }
    result.pgCharacters={version:1,choices};
  }
  return result;
}
