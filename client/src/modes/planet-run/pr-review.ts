import type {PrRoundDefinition} from "@planetfall/shared";
export const PR_REVIEW_NAMES=["start","hazard","center","landmark","finish","oblique"] as const;
export type PrReviewName=typeof PR_REVIEW_NAMES[number];
/** Short authored opening shot, derived only from immutable course art coordinates. */
export function prIntroCamera(round:PrRoundDefinition,progress:number){
 const shots:Record<PrRoundDefinition['id'],{from:readonly[number,number,number];to:readonly[number,number,number];target:readonly[number,number,number]}>= {
  'cargo-cyclone':{from:[41,28,10],to:[27,20,-8],target:[0,2,-43]},
  'solar-sweep':{from:[35,27,32],to:[26,21,29],target:[0,5,0]},
  'meteor-garden':{from:[34,23,31],to:[25,17,27],target:[4,3,-4]},
  'flux-gardens':{from:[35,23,1],to:[24,18,-16],target:[0,4,-49]},
  'capacitor-causeway':{from:[40,26,-15],to:[28,19,-30],target:[0,3,-65]},
  shatterdeck:{from:[45,38,44],to:[34,31,36],target:[0,10,0]},
 };
 const shot=shots[round.id],p=Math.max(0,Math.min(1,progress)),t=p*p*(3-2*p);
 return {position:shot.from.map((v,i)=>v+(shot.to[i]-v)*t) as [number,number,number],target:shot.target};
}
export function prReviewCamera(round:PrRoundDefinition,name:PrReviewName):{position:readonly[number,number,number];target:readonly[number,number,number]}{
 const race=round.category==="race",final=round.category==="final";
 const cameras:Record<PrReviewName,{position:readonly[number,number,number];target:readonly[number,number,number]}>=race?{
  start:{position:[15,10,27],target:[0,2,-8]},hazard:{position:[13,7,-7],target:[0,1.5,-24]},center:{position:[16,13,-45],target:[0,1,-65]},landmark:{position:[-18,8,-42],target:[30,9,-62]},finish:{position:[14,10,-104],target:[0,2,-124]},oblique:{position:[55,70,30],target:[0,0,-55]},
 }:final?{
  start:{position:[24,31,26],target:[0,17,0]},hazard:{position:[12,22,10],target:[0,18,0]},center:{position:[37,18,25],target:[0,10,0]},landmark:{position:[47,29,42],target:[0,12,0]},finish:{position:[24,7,20],target:[0,2,0]},oblique:{position:[42,55,46],target:[0,10,0]},
 }:{
  start:{position:[27,18,27],target:[0,1,0]},hazard:{position:[15,7,12],target:[0,1,0]},center:{position:[1,8,15],target:[0,1,-4]},landmark:{position:[-21,8,14],target:[35,9,-12]},finish:{position:[30,28,30],target:[0,1,0]},oblique:{position:[38,53,41],target:[0,0,0]},
 };
 if(name==='landmark'){
  const landmarks:Record<PrRoundDefinition['id'],typeof cameras.landmark>={
   'cargo-cyclone':{position:[-5,20,-36],target:[37,14,-72]},
   'solar-sweep':{position:[-26,22,26],target:[0,15,0]},
   'meteor-garden':{position:[37,24,-10],target:[0,9,-49]},
   'flux-gardens':{position:[0,14,-38],target:[33,15,-66]},
   'capacitor-causeway':{position:[5,24,-30],target:[48,18,-60]},
   shatterdeck:{position:[40,28,40],target:[0,12,0]},
  };return landmarks[round.id];
 }
 return cameras[name];
}
