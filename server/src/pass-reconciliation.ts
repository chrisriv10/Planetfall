import {PLANET_PASS_REWARDS,sessionLevelForXp,sessionXpInLevel,type GuestProfile,type PlanetPassReward} from "@planetfall/shared";

type PassProfile=GuestProfile&{lobbyBadge?:string};
const validAmount=(value:number):boolean=>Number.isSafeInteger(value)&&value>=0;
function ledger(ids:readonly string[]):Set<string> {
 if(!Array.isArray(ids)||ids.some(id=>typeof id!=="string"))throw new TypeError("Invalid pass reward ledger");
 return new Set(ids);
}
function catalog(rewards:readonly PlanetPassReward[]):readonly PlanetPassReward[] {
 const ids=new Set<string>();
 for(const reward of rewards){
  if(!reward||typeof reward.id!=="string"||!reward.id.length||ids.has(reward.id)||!Number.isSafeInteger(reward.level)||reward.level<1
   ||reward.fallbucks!==undefined&&!validAmount(reward.fallbucks)
   ||reward.cosmeticId!==undefined&&(typeof reward.cosmeticId!=="string"||!reward.cosmeticId.length)
   ||reward.badge!==undefined&&(typeof reward.badge!=="string"||!reward.badge.length))throw new TypeError("Invalid pass reward catalog");
  ids.add(reward.id);
 }
 return rewards;
}
function addAmount(total:number,amount:number):number {
 const next=total+amount;
 if(!validAmount(next))throw new RangeError("Pass reward balance exceeds safe integer range");
 return next;
}

/** Reconcile against canonical total XP, including rewards missed by old catalogs or room deltas.
 * Existing IDs never repay currency; their cosmetic/badge entitlements can be repaired on load. */
export function reconcilePassRewards(profile:PassProfile,rewards:readonly PlanetPassReward[]=PLANET_PASS_REWARDS):PlanetPassReward[] {
 if(![profile.fallbucks,profile.crowns,profile.sessionTotalXp].every(validAmount))throw new RangeError("Invalid player profile economy");
 const owned=ledger(profile.ownedCosmetics),unlocked=ledger(profile.unlockedPassRewards);
 const level=sessionLevelForXp(profile.sessionTotalXp),xp=sessionXpInLevel(profile.sessionTotalXp),validated=catalog(rewards);
 const eligible=validated.filter(reward=>reward.level<=level).sort((a,b)=>a.level-b.level);
 const granted:PlanetPassReward[]=[],newCosmetics:string[]=[];
 let balance=profile.fallbucks,badge=profile.lobbyBadge;
 // Preserve custom badges and never downgrade an already earned higher pass badge.
 const knownBadgeLevels=validated.filter(reward=>reward.badge===badge).map(reward=>reward.level);
 let badgeLevel=badge===undefined?0:knownBadgeLevels.length?Math.max(...knownBadgeLevels):Infinity;
 for(const reward of eligible){
  if(!unlocked.has(reward.id)){
   balance=addAmount(balance,reward.fallbucks??0);
   unlocked.add(reward.id);granted.push(reward);
  }
  if(reward.cosmeticId&&!owned.has(reward.cosmeticId)){owned.add(reward.cosmeticId);newCosmetics.push(reward.cosmeticId);}
  if(reward.badge&&reward.level>=badgeLevel){badge=reward.badge;badgeLevel=reward.level;}
 }
 // All validation and overflow checks precede mutations, including derived fields.
 profile.fallbucks=balance;profile.sessionLevel=level;profile.sessionXp=xp;
 profile.unlockedPassRewards.push(...granted.map(reward=>reward.id));
 profile.ownedCosmetics.push(...newCosmetics);
 if(badge!==undefined)profile.lobbyBadge=badge;
 return granted;
}

/** Currency already embedded in a room's balance delta, identified solely by new known IDs.
 * Subtract this from that delta before canonical reconciliation; ordinary earnings/spending remain. */
export function passFallbucksAlreadyGranted(baselineIDs:readonly string[],currentIDs:readonly string[],rewards:readonly PlanetPassReward[]=PLANET_PASS_REWARDS):number {
 const baseline=ledger(baselineIDs),current=ledger(currentIDs);
 let amount=0;
 for(const reward of catalog(rewards))if(current.has(reward.id)&&!baseline.has(reward.id))amount=addAmount(amount,reward.fallbucks??0);
 return amount;
}
