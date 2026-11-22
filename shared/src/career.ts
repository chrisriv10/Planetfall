import type {GameFamily} from "./game-family.js";

/** Career uses the same four canonical game families as matchmaking. */
export type CareerFamily=GameFamily;
export const CAREER_FAMILIES:readonly CareerFamily[]=["planetfall","battle-royale","planet-run","planet-gun"];
export interface CareerCounters {
  completions:number;wins:number;eliminations:number;qualifications:number;repairs:number;scrap:number;waves:number;
}
export interface CareerData {
  version:1;
  /** First recorded result, not account creation or inferred historical activity. */
  trackedSince:string;
  families:Record<CareerFamily,CareerCounters>;
  /** Recognition only; values are first unlock timestamps. */
  achievements:Record<string,string>;
}
export interface CareerResult {
  won:boolean;eliminations?:number;qualifications?:number;repairs?:number;scrap?:number;waves?:number;
}
export interface CareerAchievement {id:string;name:string;description:string;target:number;family?:CareerFamily;stat:keyof CareerCounters|"families";}
export const CAREER_ACHIEVEMENTS:readonly CareerAchievement[]=[
  {id:"first-match",name:"First Landing",description:"Complete 1 match in any Career family.",target:1,stat:"completions"},
  {id:"ten-matches",name:"Frequent Flyer",description:"Complete 10 matches across Career families.",target:10,stat:"completions"},
  {id:"first-win",name:"First Victory",description:"Win 1 match in any Career family.",target:1,stat:"wins"},
  {id:"ten-wins",name:"Victory Lap",description:"Win 10 matches across Career families.",target:10,stat:"wins"},
  {id:"all-families",name:"Across the System",description:"Complete a match in each of the 4 Career families.",target:4,stat:"families"},
  {id:"scrap-collector",name:"Scrap Collector",description:"Collect 100 scrap across completed Classic matches.",target:100,stat:"scrap",family:"planetfall"},
  {id:"world-defender",name:"World Defender",description:"Perform 5 repairs across completed Classic matches.",target:5,stat:"repairs",family:"planetfall"},
  {id:"last-planet-standing",name:"Last Planet Standing",description:"Win 1 completed Classic match.",target:1,stat:"wins",family:"planetfall"},
  {id:"royale-explorer",name:"Royale Explorer",description:"Complete 1 eligible Battle Royale match.",target:1,stat:"completions",family:"battle-royale"},
  {id:"orbital-champion",name:"Orbital Champion",description:"Win 1 eligible Battle Royale match.",target:1,stat:"wins",family:"battle-royale"},
  {id:"first-qualification",name:"First Qualification",description:"Finish a Planet Run tournament with at least 1 qualification.",target:1,stat:"qualifications",family:"planet-run"},
  {id:"perfect-run",name:"Perfect Run",description:"Win 1 completed Planet Run tournament.",target:1,stat:"wins",family:"planet-run"},
  {id:"first-elimination",name:"First Elimination",description:"Score 1 elimination in Planet Gun, recorded after an eligible completed match.",target:1,stat:"eliminations",family:"planet-gun"},
];
const zero=():CareerCounters=>({completions:0,wins:0,eliminations:0,qualifications:0,repairs:0,scrap:0,waves:0});
export function emptyCareer(at:string):CareerData {
  return {version:1,trackedSince:at,families:Object.fromEntries(CAREER_FAMILIES.map(f=>[f,zero()])) as CareerData["families"],achievements:{}};
}
export function copyCareer(career:CareerData):CareerData {
  return {...career,families:Object.fromEntries(CAREER_FAMILIES.map(f=>[f,{...career.families[f]}])) as CareerData["families"],achievements:{...career.achievements}};
}
export function careerAchievementProgress(career:CareerData,achievement:CareerAchievement):number {
  if(achievement.stat==="families")return CAREER_FAMILIES.filter(f=>career.families[f].completions>0).length;
  const stat=achievement.stat;
  return achievement.family?career.families[achievement.family][stat]:CAREER_FAMILIES.reduce((n,f)=>n+career.families[f][stat],0);
}
/** Only authoritative result writers call this; no economy or equipment changes. */
export function applyCareerResult(previous:CareerData|undefined,family:CareerFamily,result:CareerResult,at:string):CareerData {
  if(!CAREER_FAMILIES.includes(family)||typeof result.won!=="boolean"||!Number.isFinite(Date.parse(at)))throw new RangeError("Invalid Career result");
  const career=previous?copyCareer(previous):emptyCareer(at),counts=career.families[family];
  const add=(key:keyof CareerCounters,value:number)=>{
    if(!Number.isSafeInteger(value)||value<0||!Number.isSafeInteger(counts[key]+value))throw new RangeError("Invalid Career counter");
    counts[key]+=value;
  };
  add("completions",1);add("wins",result.won?1:0);
  for(const key of ["eliminations","qualifications","repairs","scrap","waves"] as const){
    const value=result[key]??0;
    if(!Number.isSafeInteger(value)||value<0)throw new RangeError("Invalid Career metric");
    if((key==="eliminations"&&(family==="planet-gun"||family==="battle-royale"))||
       (key==="qualifications"&&family==="planet-run")||((key==="repairs"||key==="scrap")&&family==="planetfall")||
       (key==="waves"&&family==="planet-gun"))add(key,value);
  }
  for(const achievement of CAREER_ACHIEVEMENTS)if(!career.achievements[achievement.id]&&careerAchievementProgress(career,achievement)>=achievement.target)career.achievements[achievement.id]=at;
  return career;
}
