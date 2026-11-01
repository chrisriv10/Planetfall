import {pgResolveHero,pgResolveOperator,pgValidateHeroLoadout,pgValidateOperatorLoadout,type PgLoadout,type PgModeId,type PgTacticalSide} from "@planetfall/shared";
export const PG_CHARACTER_PREFERENCES_KEY="planetfall:pg-characters:v1";
type Choice={characterId:string;loadout?:PgLoadout};
type Key="planetwatch"|"siege-attack"|"siege-defend";
type Store=Pick<Storage,"getItem"|"setItem">;
function key(mode:PgModeId,side:PgTacticalSide):Key|null{return mode==="planetwatch"?"planetwatch":mode==="planetsiege"?`siege-${side}`:null;}
function validate(k:Key,value:unknown):Choice|null{
 if(!value||typeof value!=="object")return null;const choice=value as Choice;
 const definition=k==="planetwatch"?pgResolveHero(choice.characterId):pgResolveOperator(choice.characterId,k==="siege-attack"?"attack":"defend");if(!definition)return null;
 const loadout=choice.loadout===undefined?undefined:k==="planetwatch"?pgValidateHeroLoadout(definition.id,choice.loadout):pgValidateOperatorLoadout(definition.id,choice.loadout);if(loadout===null)return null;
 return {characterId:definition.id,...(loadout?{loadout}:{})};
}
function read(store:Store):Partial<Record<Key,Choice>>{
 try{const raw=store.getItem(PG_CHARACTER_PREFERENCES_KEY);if(!raw||raw.length>12000)return {};const parsed=JSON.parse(raw);if(parsed?.version!==1||!parsed.choices||typeof parsed.choices!=="object")return {};const result:Partial<Record<Key,Choice>>={};for(const k of ["planetwatch","siege-attack","siege-defend"] as const){const value=validate(k,parsed.choices[k]);if(value)result[k]=value;}return result;}catch{return {};}
}
export function pgReadCharacterPreference(store:Store,mode:PgModeId,side:PgTacticalSide):Choice|null{const k=key(mode,side);return k?read(store)[k]??null:null;}
export function pgSaveCharacterPreference(store:Store,mode:PgModeId,side:PgTacticalSide,value:Choice):void{const k=key(mode,side);if(!k)return;const valid=validate(k,value);if(!valid)return;try{store.setItem(PG_CHARACTER_PREFERENCES_KEY,JSON.stringify({version:1,choices:{...read(store),[k]:valid}}));}catch{/* A full/disabled browser store cannot change authoritative selection. */}}
