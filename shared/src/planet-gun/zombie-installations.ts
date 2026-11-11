import type {PgSolid} from "./types.js";
import {PG_OBJECTIVES,PG_ZOMBIE_PRICES} from "./modes.js";

export const PG_ZOMBIE_SURVIVOR_SPAWNS=Array.from({length:4},(_,i)=>({x:-28+(i%2)*1.4,y:0,z:-9+Math.floor(i/2)*1.4}));

/** Authored against the habitat's south wall, clear of its entrance and stairs. */
export const PG_ZOMBIE_ARSENAL_SITE={
 id:"anomaly-arsenal",position:{x:-20,y:0,z:-2.2},yaw:0,
 interaction:{x:-20,y:0,z:-3.6},
 solid:{id:"installation-anomaly-arsenal",kind:"utility",mantle:false,center:{x:-20,y:.9,z:-2.2},half:{x:.75,y:.9,z:.45}}satisfies PgSolid,
}as const;

export const PG_ZOMBIE_FORGE_SITE={
 id:"overcharge-forge",position:{x:-19,y:0,z:12.5},yaw:0,
 interaction:{x:-19,y:0,z:10.7},
 solid:{id:"installation-overcharge-forge",kind:"utility",mantle:false,center:{x:-19,y:.95,z:12.5},half:{x:1.1,y:.95,z:.65}}satisfies PgSolid,
}as const;

/** Battery-powered street dispensers on the habitat's exterior south frontage. */
export const PG_ZOMBIE_TONIC_SITES=[
 {id:"perk-vitality",name:"CORE RESERVE",color:0xeea76b,price:750,position:{x:-21.8,y:0,z:0},yaw:Math.PI},
 {id:"perk-reload",name:"QUICK CIRCUIT",color:0x7be6df,price:600,position:{x:-19.6,y:0,z:0},yaw:Math.PI},
 {id:"perk-stamina",name:"VELOCITY BLEND",color:0xb2a0f0,price:450,position:{x:-17.4,y:0,z:0},yaw:Math.PI},
]as const;
export const PG_ZOMBIE_TONIC_SOCKETS=PG_ZOMBIE_TONIC_SITES.map(site=>({
 ...site,interaction:{x:site.position.x,y:0,z:1.4},
 solid:{id:`installation-${site.id}`,kind:"utility",mantle:false,center:{x:site.position.x,y:1,z:0},half:{x:.5,y:1,z:.4}}satisfies PgSolid,
}));

/** Backed requisition displays, with the original primary purchase approaches preserved. */
export const PG_ZOMBIE_WALL_BUYS=[
 ...PG_OBJECTIVES.racks.map(rack=>({id:rack.id,weaponId:rack.weapon,price:PG_ZOMBIE_PRICES[rack.id],
  interaction:{...rack.position},position:rack.weapon==="photon"?{x:-26.5,y:0,z:-5}:rack.weapon==="nova"?{x:-16.2,y:0,z:10}:{x:rack.position.x,y:0,z:rack.position.z+1.3},yaw:rack.weapon==="photon"||rack.weapon==="nova"?Math.PI/2:0})),
 {id:"rack-comet",weaponId:"comet",price:PG_ZOMBIE_PRICES["rack-comet"],interaction:{x:-28,y:0,z:-2.5},position:{x:-26.5,y:0,z:-2.5},yaw:Math.PI/2}as const,
 {id:"rack-orbit",weaponId:"orbit",price:PG_ZOMBIE_PRICES["rack-orbit"],interaction:{x:-31,y:0,z:1.2},position:{x:-31,y:0,z:-.36},yaw:Math.PI}as const,
].map(site=>({
 ...site,bodyHalf:{x:1.05,y:1.15,z:.18},
 solid:{id:`installation-${site.id}`,kind:"utility",mantle:false,center:{...site.position,y:1.15},
  half:Math.abs(Math.sin(site.yaw))<.5?{x:1.05,y:1.15,z:.18}:{x:.18,y:1.15,z:1.05}}satisfies PgSolid,
}));
