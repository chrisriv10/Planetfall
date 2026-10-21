import type { PrCategory, PrRoundDefinition, PrRoundId } from "./types.js";

export function prQualificationTarget(population:number,category:PrCategory,roundIndex:number):number {
  const n=Math.max(0,Math.floor(population));
  if(!n)return 0;
  if(category==="final"||n<=2)return 1;
  return Math.max(1,Math.min(n-1,Math.ceil(n*(roundIndex>=2?.58:.67))));
}
/** Seeded index with stable integer arithmetic; identical on client and server. */
export function prHash(seed:number,index:number):number {
  let n=(seed^Math.imul(index+1,0x9e3779b9))|0;n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return (n^(n>>>15))>>>0;
}
export function prSelectRound(roster:readonly PrRoundDefinition[],population:number,index:number,previous:PrRoundId|null,seed:number):PrRoundDefinition {
  const category:PrCategory=index>=3||population<=5?"final":index===0||index===2?"race":"survival";
  const available=roster.filter(r=>r.category===category&&r.minimumPlayers<=population&&r.maximumPlayers>=population);
  const fresh=available.filter(r=>r.id!==previous),choices=fresh.length?fresh:available;
  if(!choices.length)throw new Error(`No PlanetRun ${category} round supports ${population} pilots`);
  return choices[prHash(seed,index)%choices.length];
}
/** Stable tie break: best progress, then survival duration, then immutable ID. */
export function prRank<T extends {id:string;progress:number;survivedMs:number}>(entries:readonly T[]):T[] {
  return [...entries].sort((a,b)=>b.progress-a.progress||b.survivedMs-a.survivedMs||a.id.localeCompare(b.id));
}
