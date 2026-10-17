import type {BrRarity} from "./rarity.js";
import type {BrUtilityId} from "./types.js";
export const BR_UTILITIES:Record<BrUtilityId,{name:string;role:string;rarity:BrRarity;maxStack:number;durationMs:number;strength:number;radius:number}>={
  "grav-coil":{name:"GRAV COIL",role:"Controlled mobility launch",rarity:"rare",maxStack:2,durationMs:2500,strength:14,radius:0},
  "void-filter":{name:"VOID FILTER",role:"40% Void resistance · 18s",rarity:"epic",maxStack:2,durationMs:18000,strength:.4,radius:0},
  "pulse-scanner":{name:"PULSE SCANNER",role:"Brief approximate enemy scan",rarity:"epic",maxStack:2,durationMs:4000,strength:1,radius:65},
  "nano-mist":{name:"NANO MIST",role:"Short-lived team healing field",rarity:"rare",maxStack:2,durationMs:6000,strength:8,radius:5},
};
