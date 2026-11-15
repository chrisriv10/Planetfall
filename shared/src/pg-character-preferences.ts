import {pgResolveHero,pgResolveOperator,pgValidateHeroLoadout,pgValidateOperatorLoadout,type PgLoadout} from "./planet-gun/index.js";
export type PgCharacterPreference={characterId:string;loadout?:PgLoadout};
export type PgCharacterPreferenceKey="planetwatch"|"siege-attack"|"siege-defend";
export function validatePgCharacterPreference(k:PgCharacterPreferenceKey,value:unknown):PgCharacterPreference|null{
 if(!value||typeof value!=="object")return null;const choice=value as PgCharacterPreference;
 const definition=k==="planetwatch"?pgResolveHero(choice.characterId):pgResolveOperator(choice.characterId,k==="siege-attack"?"attack":"defend");if(!definition)return null;
 const loadout=choice.loadout===undefined?undefined:k==="planetwatch"?pgValidateHeroLoadout(definition.id,choice.loadout):pgValidateOperatorLoadout(definition.id,choice.loadout);if(loadout===null)return null;
 return {characterId:definition.id,...(loadout?{loadout}:{})};
}
