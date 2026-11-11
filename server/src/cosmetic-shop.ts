import {SHOP_CATALOG,cosmeticCompatible,type GameFamily,type GuestProfile} from "@planetfall/shared";

type ShopPlayer=Pick<GuestProfile,"fallbucks"|"ownedCosmetics"|"equippedCosmetics">&{isBot?:boolean};
export type ShopResult={ok:true}|{ok:false;error:string};
type EquipResult={ok:true;changed:boolean}|{ok:false;error:string};
const betweenMatches=(phase:string)=>phase==="lobby"||phase==="results";

/** Deterministic authoritative transaction. Family compatibility affects equipping,
 * never catalog ownership; the server catalog supplies every price and category. */
export function buyCosmetic(player:ShopPlayer|undefined,phase:string,itemId:unknown):ShopResult{
 if(!player||player.isBot||!betweenMatches(phase))return {ok:false,error:"Shop is only available between matches."};
 const item=typeof itemId==="string"?SHOP_CATALOG.find(entry=>entry.id===itemId):undefined;
 if(!item)return {ok:false,error:"Item not found."};
 if(item.passLevel!==undefined)return {ok:false,error:"Planet Pass reward only."};
 if(player.ownedCosmetics.includes(item.id))return {ok:false,error:"Already owned."};
 if(!Number.isSafeInteger(player.fallbucks)||player.fallbucks<0||!Number.isSafeInteger(item.price)||item.price<0||player.fallbucks<item.price)return {ok:false,error:"Not enough Fallbucks."};
 player.fallbucks-=item.price;player.ownedCosmetics.push(item.id);return {ok:true};
}

/** Emotes grant owned access rather than occupying an equipped cosmetic slot. */
export function equipCosmetic(player:ShopPlayer|undefined,phase:string,itemId:unknown,family:GameFamily):EquipResult{
 if(!player||player.isBot||!betweenMatches(phase))return {ok:false,error:"Shop is only available between matches."};
 const item=typeof itemId==="string"?SHOP_CATALOG.find(entry=>entry.id===itemId):undefined;
 if(!item||!player.ownedCosmetics.includes(item.id))return {ok:false,error:"Item not owned."};
 if(!cosmeticCompatible(item,family))return {ok:false,error:"This cosmetic is not compatible with this game."};
 if(item.category==="emote")return {ok:true,changed:false};
 player.equippedCosmetics[item.category]=item.id;return {ok:true,changed:true};
}
