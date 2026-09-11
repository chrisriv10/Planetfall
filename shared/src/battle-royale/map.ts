import type { Vec3 } from "../index.js";

export type BrDistrictStyle = "nexus" | "city" | "dock" | "reactor" | "academy" | "mall" | "farm" | "wreck" | "industrial";

export interface BrPoi {
  id: string;
  name: string;
  position: Vec3;
  color: string;
  style: BrDistrictStyle;
  lootPoints: Vec3[];
}

/** Optimized gameplay collider. Visual detail is authored separately and never changes collision. */
export interface BrMapBlock {
  id: string;
  districtId: string;
  position: Vec3;
  size: Vec3;
  color: string;
  kind: "building" | "wall" | "cover" | "platform" | "ramp" | "bridge";
  rotation?: Vec3;
}

export interface BrStructure {
  id: string;
  districtId: string;
  position: Vec3;
  size: Vec3;
  color: string;
  style: BrDistrictStyle;
  floors: 1 | 2 | 3;
  entrance: "north" | "south" | "east" | "west";
  roofAccess: boolean;
  enterable: boolean;
  archetype: BrStructureArchetype;
}

export type BrStructureArchetype = "shop" | "apartment" | "tower" | "office" | "hotel" | "warehouse" | "hangar" | "lab" | "academy" | "mall" | "industrial" | "greenhouse" | "transit" | "utility";
export interface BrSecondaryLocation { id:string; name:string; position:Vec3; color:string; style:BrDistrictStyle; connectTo:string; }

export interface BrRoadSegment { id: string; from: Vec3; to: Vec3; width: number; color: string; }
export interface BrNavNode { id: string; position: Vec3; neighbors: string[]; }
export interface BrLootSocket { id: string; districtId: string; structureId: string; position: Vec3; kind: "interior" | "roof"; }
export interface BrTerrainPatch { id: string; position: Vec3; size: Vec3; rotation: number; color: string; kind: "park" | "plaza" | "industrial" | "coolant" | "landing"; }

export const BR_MAP = { id: "orbital-isle", name: "ORBITAL ISLE", radius: 500, diameter: 1000 } as const;

/** Hand-shaped, contiguous main deck. Shared by rendering, drops and edge validation. */
export const BR_ISLAND_OUTLINE: readonly [number, number][] = [
  [-455,-105],[-418,-250],[-320,-402],[-174,-470],[5,-486],[174,-452],[326,-384],[430,-264],
  [486,-104],[472,62],[418,218],[315,374],[158,455],[-20,478],[-196,444],[-344,354],
  [-438,224],[-488,62]
];

const poi = (id: string, name: string, x: number, z: number, color: string, style: BrDistrictStyle, loot: readonly [number, number, number?][]): BrPoi => ({
  id, name, position: { x, y: 0, z }, color, style,
  lootPoints: loot.map(([ox, oz, y = .55]) => ({ x: x + ox, y, z: z + oz }))
});

export const BR_POIS: readonly BrPoi[] = [
  poi("zero-point", "ZERO POINT", 0, 0, "#70f5ff", "nexus", [[0,0,5],[18,14],[-18,13],[20,-18],[-21,-17],[0,31]]),
  poi("nova-plaza", "NOVA PLAZA", -175, -135, "#ff6bba", "city", [[0,0],[34,9],[-35,8],[23,-35],[-24,-38],[0,42]]),
  poi("dockyard-7", "DOCKYARD 7", 188, -156, "#ffb347", "dock", [[0,0],[40,6],[-38,4],[26,-36],[-28,-40],[8,42]]),
  poi("helios-reactor", "HELIOS REACTOR", 262, 78, "#ffd84d", "reactor", [[0,0,4],[32,16,4],[-30,14,4],[20,-34,4],[-22,-31,4]]),
  poi("astra-academy", "ASTRA ACADEMY", -278, 75, "#a88cff", "academy", [[0,0],[38,12],[-36,15],[21,-38],[-22,-35],[0,45]]),
  poi("void-mall", "VOID MALL", -93, 263, "#c565ff", "mall", [[0,0],[38,0],[-38,0],[0,35],[0,-33],[31,32]]),
  poi("orbital-farms", "ORBITAL FARMS", 125, 294, "#63ef8b", "farm", [[0,0],[37,13],[-36,15],[23,-35],[-24,-34],[0,45]]),
  poi("crash-site", "CRASH SITE", -326, -258, "#ff795f", "wreck", [[0,0],[34,12],[-30,17],[18,-33],[-20,-36]]),
  poi("thruster-works", "THRUSTER WORKS", 342, -70, "#65b8ff", "industrial", [[0,0],[36,12],[-36,10],[23,-38],[-25,-37],[0,43]])
];

const secondary=(id:string,name:string,x:number,z:number,color:string,style:BrDistrictStyle,connectTo:string):BrSecondaryLocation=>({id,name,position:{x,y:0,z},color,style,connectTo});

/** Connective neighborhoods and utility compounds keep rotations active between the nine major POIs. */
export const BR_SECONDARY_LOCATIONS:readonly BrSecondaryLocation[]=[
  secondary("central-heights","CENTRAL HEIGHTS",-75,-82,"#65c9ff","city","zero-point"),
  secondary("relay-market","RELAY MARKET",82,-78,"#72def4","city","zero-point"),
  secondary("comet-hotel","COMET HOTEL",-76,-214,"#ee7ac4","city","nova-plaza"),
  secondary("horizon-homes","HORIZON HOMES",-255,-30,"#d98edc","city","nova-plaza"),
  secondary("academy-dorms","ACADEMY DORMS",-370,125,"#a88cff","academy","astra-academy"),
  secondary("west-overlook","WEST OVERLOOK",-405,15,"#75b8e8","nexus","astra-academy"),
  secondary("signal-station","SIGNAL STATION",-405,-125,"#5b95c9","industrial","nova-plaza"),
  secondary("salvage-row","SALVAGE ROW",-315,-335,"#db705d","wreck","crash-site"),
  secondary("emergency-depot","EMERGENCY DEPOT",-160,-420,"#f47b64","wreck","crash-site"),
  secondary("south-terminal","SOUTH TERMINAL",15,-415,"#5ca9da","nexus","zero-point"),
  secondary("cargo-spur","CARGO SPUR",95,-285,"#d88b47","dock","dockyard-7"),
  secondary("dock-service","DOCK SERVICE",285,-275,"#f0a052","dock","dockyard-7"),
  secondary("engine-gate","ENGINE GATE",405,-180,"#579edf","industrial","thruster-works"),
  secondary("east-checkpoint","EAST CHECKPOINT",420,-5,"#65b8ff","industrial","thruster-works"),
  secondary("helios-relay","HELIOS RELAY",375,135,"#ffd84d","reactor","helios-reactor"),
  secondary("orbital-overlook","ORBITAL OVERLOOK",305,220,"#73c8e8","nexus","helios-reactor"),
  secondary("farm-service","FARM SERVICE",235,370,"#63ef8b","farm","orbital-farms"),
  secondary("solar-field","SOLAR FIELD",75,415,"#63d99c","farm","orbital-farms"),
  secondary("north-gardens","NORTH GARDENS",-45,405,"#69d89a","farm","void-mall"),
  secondary("mall-annex","MALL ANNEX",-205,365,"#c565ff","mall","void-mall"),
  secondary("academy-commons","ACADEMY COMMONS",-265,235,"#9f8ae8","academy","astra-academy"),
  secondary("west-park","WEST PARK",-400,150,"#70c98f","academy","astra-academy"),
  secondary("coolant-plant","COOLANT PLANT",80,180,"#44bdd8","industrial","zero-point"),
  secondary("central-security","CENTRAL SECURITY",-145,85,"#778fd8","nexus","zero-point"),
  secondary("south-shipworks","SOUTH SHIPWORKS",190,-400,"#da8b48","dock","dockyard-7"),
  secondary("east-freight","EAST FREIGHT",330,-315,"#e19450","dock","dockyard-7"),
  secondary("northwest-housing","NORTHWEST HOUSING",-250,365,"#b78bdc","city","void-mall"),
  secondary("west-salvage","WEST SALVAGE",-385,-205,"#cf6b61","wreck","crash-site"),
  secondary("east-rim","EAST RIM",435,100,"#68b8de","industrial","helios-reactor"),
  secondary("west-rim","WEST RIM",-340,280,"#8f8bd6","academy","astra-academy")
];

const inferArchetype=(id:string,style:BrDistrictStyle,height:number):BrStructureArchetype=>id.includes("hangar")?"hangar":id.includes("hotel")?"hotel":id.includes("market")||id.includes("cafe")||id.includes("arcade")?"shop":id.includes("tower")||height>20?"tower":style==="farm"?"greenhouse":style==="academy"?"academy":style==="mall"?"mall":style==="dock"?"warehouse":style==="reactor"||style==="industrial"?"industrial":style==="wreck"?"utility":"office";
const S = (id: string, districtId: string, x: number, z: number, w: number, d: number, h: number, color: string, style: BrDistrictStyle, floors: 1 | 2 | 3 = 1, entrance: BrStructure["entrance"] = "south", roofAccess = false, enterable=true, archetype?:BrStructureArchetype): BrStructure => ({
  id, districtId, position: { x, y: 0, z }, size: { x: w, y: h, z: d }, color, style, floors, entrance, roofAccess, enterable, archetype:archetype??inferArchetype(id,style,h)
});

/** 62 authored structures with different footprints and district identities. */
const PRIMARY_BR_STRUCTURES: readonly BrStructure[] = [
  S("zero-spire","zero-point",0,0,28,28,36,"#70f5ff","nexus",3,"south",true),
  S("zero-control","zero-point",-38,-9,30,20,8,"#4ed3ff","nexus",2,"east",true),
  S("zero-relay","zero-point",38,12,24,18,7,"#72a7ff","nexus",2,"west",true),
  S("zero-archive","zero-point",2,43,34,18,6,"#4c86c8","nexus",1,"south"),
  S("nova-tower-a","nova-plaza",-196,-153,27,28,34,"#ff6bba","city",3,"east",true),
  S("nova-tower-b","nova-plaza",-152,-153,25,26,27,"#ff8bd0","city",3,"west",true),
  S("nova-cafe","nova-plaza",-207,-105,31,20,6,"#ba4f9a","city",1,"east"),
  S("nova-studio","nova-plaza",-158,-102,34,22,9,"#c65fb1","city",2,"south",true),
  S("nova-kiosk","nova-plaza",-174,-133,14,12,4,"#ffc2e8","city",1,"north"),
  S("dock-hangar","dockyard-7",190,-174,52,34,11,"#d97b37","dock",2,"south",true),
  S("dock-office","dockyard-7",150,-130,26,20,8,"#ffb347","dock",2,"east",true),
  S("dock-warehouse","dockyard-7",230,-129,38,24,7,"#bd6f38","dock",1,"west"),
  S("dock-customs","dockyard-7",191,-105,25,18,5,"#f2a65a","dock",1,"north"),
  S("helios-core","helios-reactor",262,78,34,34,42,"#ffd84d","reactor",3,"south",true),
  S("helios-turbine-a","helios-reactor",218,74,24,30,9,"#dc8c2d","reactor",2,"east"),
  S("helios-turbine-b","helios-reactor",306,74,24,30,9,"#dc8c2d","reactor",2,"west"),
  S("helios-control","helios-reactor",261,124,38,20,7,"#f7b43d","reactor",1,"north",true),
  S("astra-hall","astra-academy",-278,75,48,24,9,"#a88cff","academy",2,"south",true),
  S("astra-lab","astra-academy",-323,52,30,26,7,"#7e70ce","academy",2,"east"),
  S("astra-library","astra-academy",-233,52,30,26,7,"#927bdf","academy",2,"west"),
  S("astra-observatory","astra-academy",-278,119,28,24,26,"#beb1ff","academy",3,"north",true),
  S("void-anchor","void-mall",-93,263,64,34,18,"#c565ff","mall",2,"south",true),
  S("void-west","void-mall",-142,260,28,54,8,"#8340b8","mall",2,"east"),
  S("void-east","void-mall",-44,260,28,54,8,"#9c50ca","mall",2,"west"),
  S("void-cinema","void-mall",-93,309,46,24,7,"#71369d","mall",1,"north"),
  S("farm-dome-a","orbital-farms",94,291,34,30,8,"#63ef8b","farm",1,"east"),
  S("farm-dome-b","orbital-farms",137,319,38,30,8,"#73df9a","farm",1,"south"),
  S("farm-processing","orbital-farms",165,271,30,24,7,"#409d72","farm",2,"west",true),
  S("farm-pump","orbital-farms",106,248,22,18,5,"#54c884","farm",1,"north"),
  S("crash-fuselage","crash-site",-326,-258,58,18,9,"#ff795f","wreck",1,"east"),
  S("crash-cargo","crash-site",-286,-226,27,22,6,"#a94c51","wreck",1,"west"),
  S("crash-shelter","crash-site",-367,-224,30,25,6,"#bd5860","wreck",1,"east"),
  S("crash-engine","crash-site",-350,-294,24,22,8,"#e2654e","wreck",2,"north",true),
  S("thruster-foundry","thruster-works",342,-70,46,32,22,"#65b8ff","industrial",2,"south",true),
  S("thruster-pump-a","thruster-works",297,-98,27,25,8,"#3f78bd","industrial",2,"east"),
  S("thruster-pump-b","thruster-works",387,-98,27,25,8,"#3f78bd","industrial",2,"west"),
  S("thruster-control","thruster-works",342,-22,34,23,7,"#579edf","industrial",1,"north",true),
  S("thruster-depot","thruster-works",392,-43,26,24,6,"#395e91","industrial",1,"west"),
  S("mid-transit-west","zero-point",-92,-22,31,18,5,"#3c557c","nexus",1,"east"),
  S("mid-transit-east","zero-point",95,24,31,18,5,"#3c557c","nexus",1,"west"),
  S("south-relay","dockyard-7",35,-255,28,22,7,"#47608a","dock",2,"north",true),
  S("zero-gallery","zero-point",-48,35,25,19,7,"#3b9fca","nexus",2,"east",true),
  S("zero-works","zero-point",51,-31,29,20,8,"#28799e","nexus",2,"west",true),
  S("nova-arcade","nova-plaza",-225,-72,27,22,9,"#d45bac","city",2,"south",true),
  S("nova-hotel","nova-plaza",-128,-187,24,26,24,"#f078c2","city",3,"west",true),
  S("nova-market","nova-plaza",-123,-112,29,20,7,"#a83f88","city",1,"north"),
  S("dock-freight-a","dockyard-7",247,-188,29,23,8,"#c56c32","dock",2,"west",true),
  S("dock-freight-b","dockyard-7",136,-190,31,22,7,"#e0924b","dock",1,"east"),
  S("dock-tower","dockyard-7",224,-90,20,18,19,"#f3a253","dock",3,"south",true),
  S("helios-annex","helios-reactor",315,126,28,22,9,"#c98a2e","reactor",2,"west",true),
  S("helios-storage","helios-reactor",211,126,29,22,7,"#a86d26","reactor",1,"east"),
  S("astra-student-hall","astra-academy",-338,105,29,24,10,"#8073c8","academy",2,"east",true),
  S("astra-workshop","astra-academy",-218,105,30,22,8,"#9684de","academy",2,"west",true),
  S("void-food-court","void-mall",-151,320,34,22,8,"#8840b5","mall",2,"east",true),
  S("void-market","void-mall",-35,319,34,22,8,"#a953d0","mall",2,"west",true),
  S("void-station","void-mall",-92,214,36,20,9,"#6f369a","mall",2,"north",true),
  S("farm-greenhouse-c","orbital-farms",193,328,36,27,8,"#58ca87","farm",1,"west"),
  S("farm-silo","orbital-farms",66,263,22,22,16,"#47b77a","farm",3,"east",true),
  S("crash-medbay","crash-site",-378,-270,28,22,8,"#b94d55","wreck",2,"east",true),
  S("crash-salvage","crash-site",-282,-301,29,23,7,"#99404b","wreck",1,"west"),
  S("thruster-assembly","thruster-works",400,-15,31,24,10,"#4f8bd0","industrial",2,"west",true),
  S("thruster-cooling","thruster-works",290,-28,31,24,9,"#477cb8","industrial",2,"east",true)
];

const SECONDARY_ARCHETYPES:readonly BrStructureArchetype[]=["apartment","shop","utility","hotel","transit","warehouse","office","lab","industrial","greenhouse","hangar","academy","mall","tower"];
const secondaryStructures=BR_SECONDARY_LOCATIONS.flatMap((location,index)=>{
  const angle=(index%6)*Math.PI/3+.18;const cos=Math.cos(angle),sin=Math.sin(angle);
  const offsets=[[-15,-9],[14,-7],[1,15]] as const;
  return offsets.map(([localX,localZ],buildingIndex)=>{
    const x=location.position.x+localX*cos-localZ*sin,z=location.position.z+localX*sin+localZ*cos;
    const width=buildingIndex===0?20+(index%3)*2:14+((index+buildingIndex)%4)*2;
    const depth=buildingIndex===2?16+(index%3)*2:18+((index+buildingIndex)%3)*2;
    const height=buildingIndex===0?8+(index%4)*3:5+((index+buildingIndex)%3)*2;
    const floors=Math.min(3,Math.max(1,Math.round(height/7))) as 1|2|3;
    const entrance=(["south","east","north","west"] as const)[(index+buildingIndex)%4];
    const enterable=buildingIndex===0&&index<8;
    return S(`${location.id}-${buildingIndex+1}`,location.id,x,z,width,depth,height,location.color,location.style,floors,entrance,enterable&&height<18,enterable,SECONDARY_ARCHETYPES[(index*3+buildingIndex)%SECONDARY_ARCHETYPES.length]);
  });
});

/** 152 structures total; 70 are enterable combat/loot spaces. */
export const BR_STRUCTURES:readonly BrStructure[]=[...PRIMARY_BR_STRUCTURES,...secondaryStructures];

/** Large flush deck treatments break up the island while preserving one flat gameplay surface. */
export const BR_TERRAIN_PATCHES: readonly BrTerrainPatch[] = [
  {id:"central-plaza",position:{x:0,y:.31,z:0},size:{x:122,y:.12,z:104},rotation:.12,color:"#284d69",kind:"plaza"},
  {id:"nova-streets",position:{x:-175,y:.3,z:-135},size:{x:142,y:.1,z:126},rotation:-.12,color:"#432b59",kind:"plaza"},
  {id:"dock-apron",position:{x:190,y:.3,z:-157},size:{x:154,y:.1,z:132},rotation:.05,color:"#574130",kind:"industrial"},
  {id:"helios-deck",position:{x:261,y:.3,z:83},size:{x:132,y:.1,z:136},rotation:-.08,color:"#554d2d",kind:"industrial"},
  {id:"astra-quad",position:{x:-278,y:.3,z:80},size:{x:140,y:.1,z:132},rotation:.08,color:"#3d3659",kind:"park"},
  {id:"void-concourse",position:{x:-93,y:.3,z:268},size:{x:150,y:.1,z:128},rotation:0,color:"#432b5a",kind:"plaza"},
  {id:"farm-terrace",position:{x:128,y:.3,z:294},size:{x:162,y:.1,z:132},rotation:-.05,color:"#285546",kind:"park"},
  {id:"crash-basin",position:{x:-330,y:.3,z:-258},size:{x:132,y:.1,z:112},rotation:.18,color:"#493642",kind:"landing"},
  {id:"thruster-yard",position:{x:344,y:.3,z:-64},size:{x:144,y:.1,z:130},rotation:-.11,color:"#2a4058",kind:"industrial"},
  {id:"coolant-west",position:{x:-68,y:.32,z:106},size:{x:24,y:.08,z:118},rotation:.28,color:"#164e6d",kind:"coolant"},
  {id:"coolant-east",position:{x:99,y:.32,z:123},size:{x:20,y:.08,z:128},rotation:-.24,color:"#17607c",kind:"coolant"},
  {id:"south-landing",position:{x:20,y:.31,z:-300},size:{x:150,y:.1,z:70},rotation:.06,color:"#2f4862",kind:"landing"}
];

export const BR_ROADS: readonly BrRoadSegment[] = [
  { id:"ring-nw", from:{x:-278,y:.08,z:75}, to:{x:-175,y:.08,z:-135}, width:15, color:"#293b58" },
  { id:"ring-sw", from:{x:-175,y:.08,z:-135}, to:{x:-326,y:.08,z:-258}, width:15, color:"#293b58" },
  { id:"ring-s", from:{x:-326,y:.08,z:-258}, to:{x:188,y:.08,z:-156}, width:17, color:"#293b58" },
  { id:"ring-se", from:{x:188,y:.08,z:-156}, to:{x:342,y:.08,z:-70}, width:15, color:"#293b58" },
  { id:"ring-e", from:{x:342,y:.08,z:-70}, to:{x:262,y:.08,z:78}, width:15, color:"#293b58" },
  { id:"ring-ne", from:{x:262,y:.08,z:78}, to:{x:125,y:.08,z:294}, width:15, color:"#293b58" },
  { id:"ring-n", from:{x:125,y:.08,z:294}, to:{x:-93,y:.08,z:263}, width:15, color:"#293b58" },
  { id:"ring-wn", from:{x:-93,y:.08,z:263}, to:{x:-278,y:.08,z:75}, width:15, color:"#293b58" },
  ...([[-175,-135],[188,-156],[262,78],[-278,75],[-93,263],[125,294],[342,-70],[-326,-258]] as const).map(([x,z], index) => ({ id:`radial-${index}`, from:{x:0,y:.09,z:0}, to:{x,y:.09,z}, width:13, color:"#304766" })),
  ...BR_SECONDARY_LOCATIONS.map((location,index)=>{const target=BR_POIS.find((poi)=>poi.id===location.connectTo)??BR_POIS[0];return{id:`service-${index}`,from:{...location.position,y:.1},to:{...target.position,y:.1},width:index%4===0?10:8,color:"#263b57"};})
];

const navPositions: Record<string, Vec3> = Object.fromEntries([...BR_POIS,...BR_SECONDARY_LOCATIONS].map((entry)=>[entry.id,{...entry.position}]));
const navLinks: Array<[string,string]> = [
  ["zero-point","nova-plaza"],["zero-point","dockyard-7"],["zero-point","helios-reactor"],["zero-point","astra-academy"],
  ["zero-point","void-mall"],["zero-point","orbital-farms"],["zero-point","crash-site"],["zero-point","thruster-works"],
  ["nova-plaza","crash-site"],["crash-site","dockyard-7"],["dockyard-7","thruster-works"],["thruster-works","helios-reactor"],
  ["helios-reactor","orbital-farms"],["orbital-farms","void-mall"],["void-mall","astra-academy"],["astra-academy","nova-plaza"],
  ...BR_SECONDARY_LOCATIONS.map((location)=>[location.id,location.connectTo] as [string,string])
];
export const BR_NAV_NODES: readonly BrNavNode[] = Object.entries(navPositions).map(([id,position])=>({id,position,neighbors:navLinks.flatMap(([a,b])=>a===id?[b]:b===id?[a]:[])}));

/** Returns a road-network waypoint, keeping simple bots out of dense building footprints. */
export function brNextWaypoint(start:Vec3,target:Vec3):Vec3 {
  const closest=(point:Vec3)=>BR_NAV_NODES.reduce((best,node)=>Math.hypot(node.position.x-point.x,node.position.z-point.z)<Math.hypot(best.position.x-point.x,best.position.z-point.z)?node:best,BR_NAV_NODES[0]);
  const source=closest(start),destination=closest(target); if(source.id===destination.id)return target;
  const queue=[source.id],previous=new Map<string,string|null>([[source.id,null]]);
  while(queue.length){const current=queue.shift()!;if(current===destination.id)break;const node=BR_NAV_NODES.find((entry)=>entry.id===current)!;for(const neighbor of node.neighbors)if(!previous.has(neighbor)){previous.set(neighbor,current);queue.push(neighbor);}}
  let step=destination.id,parent=previous.get(step);while(parent&&parent!==source.id){step=parent;parent=previous.get(step);}return {...(BR_NAV_NODES.find((entry)=>entry.id===step)?.position??target)};
}

function structureBlocks(structure: BrStructure): BrMapBlock[] {
  const { x, z } = structure.position; const { x: width, z: depth, y: height } = structure.size;
  const wall = .65; const door = 4.8; const blocks: BrMapBlock[] = [];
  if(!structure.enterable)return[{id:`${structure.id}-solid`,districtId:structure.districtId,position:{x,y:height/2,z},size:{x:width,y:height,z:depth},color:structure.color,kind:"building"}];
  blocks.push({ id:`${structure.id}-floor`, districtId:structure.districtId, position:{x,y:.18,z}, size:{x:width,y:.36,z:depth}, color:"#17243b", kind:"platform" });
  for (let floor = 1; floor < structure.floors; floor++) {
    const floorHeight=height/structure.floors;const levelY=floor*floorHeight;const stairX=x+width*.27;const opening=Math.min(5.2,width*.22);
    const leftWidth=stairX-opening/2-(x-width/2);const rightWidth=x+width/2-(stairX+opening/2);
    if(leftWidth>.5)blocks.push({id:`${structure.id}-deck-${floor}-left`,districtId:structure.districtId,position:{x:x-width/2+leftWidth/2,y:levelY,z},size:{x:leftWidth,y:.35,z:depth},color:"#253554",kind:"platform"});
    if(rightWidth>.5)blocks.push({id:`${structure.id}-deck-${floor}-right`,districtId:structure.districtId,position:{x:stairX+opening/2+rightWidth/2,y:levelY,z},size:{x:rightWidth,y:.35,z:depth},color:"#253554",kind:"platform"});
    const rampLength=Math.max(6,Math.min(depth-3,floorHeight*2.6));const angle=Math.atan2(floorHeight,rampLength);
    blocks.push({id:`${structure.id}-stairs-${floor}`,districtId:structure.districtId,position:{x:stairX,y:levelY-floorHeight/2,z},size:{x:opening-.7,y:.32,z:rampLength},rotation:{x:angle,y:0,z:0},color:"#405978",kind:"ramp"});
  }
  blocks.push({ id:`${structure.id}-roof`, districtId:structure.districtId, position:{x,y:height,z}, size:{x:width,y:.42,z:depth}, color:structure.color, kind:"platform" });
  const addWall = (suffix:string,px:number,pz:number,sx:number,sz:number) => blocks.push({ id:`${structure.id}-${suffix}`, districtId:structure.districtId, position:{x:px,y:height/2,z:pz}, size:{x:sx,y:height,z:sz}, color:structure.color, kind:"wall" });
  if (structure.entrance === "north" || structure.entrance === "south") {
    addWall("west",x-width/2,z,wall,depth); addWall("east",x+width/2,z,wall,depth);
    const doorZ=structure.entrance==="north"?z+depth/2:z-depth/2; const backZ=structure.entrance==="north"?z-depth/2:z+depth/2;
    addWall("back",x,backZ,width,wall); addWall("door-left",x-(width+door)/4,doorZ,(width-door)/2,wall); addWall("door-right",x+(width+door)/4,doorZ,(width-door)/2,wall);
  } else {
    addWall("north",x,z+depth/2,width,wall); addWall("south",x,z-depth/2,width,wall);
    const doorX=structure.entrance==="east"?x+width/2:x-width/2; const backX=structure.entrance==="east"?x-width/2:x+width/2;
    addWall("back",backX,z,wall,depth); addWall("door-left",doorX,z-(depth+door)/4,wall,(depth-door)/2); addWall("door-right",doorX,z+(depth+door)/4,wall,(depth-door)/2);
  }
  if(width>=30&&depth>=20){
    const dividerZ=z+(structure.entrance==="north"?-depth*.18:depth*.18);const gap=Math.min(5,width*.22);const span=(width-gap)/2;
    blocks.push({id:`${structure.id}-room-west`,districtId:structure.districtId,position:{x:x-(width+gap)/4,y:2,z:dividerZ},size:{x:span,y:4,z:.45},color:"#202f4a",kind:"wall"});
    blocks.push({id:`${structure.id}-room-east`,districtId:structure.districtId,position:{x:x+(width+gap)/4,y:2,z:dividerZ},size:{x:span,y:4,z:.45},color:"#202f4a",kind:"wall"});
  }
  if(structure.roofAccess){
    const length=Math.max(10,height*2.35),angle=Math.atan2(height,length);let px=x,pz=z,rotation:Vec3={x:0,y:0,z:0};
    if(structure.entrance==="south"){pz=z-depth/2-length/2;rotation={x:-angle,y:0,z:0};}
    else if(structure.entrance==="north"){pz=z+depth/2+length/2;rotation={x:angle,y:0,z:0};}
    else if(structure.entrance==="east"){px=x+width/2+length/2;rotation={x:0,y:0,z:angle};}
    else {px=x-width/2-length/2;rotation={x:0,y:0,z:-angle};}
    blocks.push({id:`${structure.id}-roof-ramp`,districtId:structure.districtId,position:{x:px,y:height/2,z:pz},size:{x:structure.entrance==="north"||structure.entrance==="south"?3.4:length,y:.36,z:structure.entrance==="north"||structure.entrance==="south"?length:3.4},rotation,color:"#354d6d",kind:"ramp"});
  }
  return blocks;
}

const authoredCover: BrMapBlock[] = [
  [-25,22,8,3,"zero-point"],[27,-25,5,7,"zero-point"],[-225,-134,7,3,"nova-plaza"],[-126,-137,4,8,"nova-plaza"],
  [152,-180,12,3,"dockyard-7"],[224,-183,9,4,"dockyard-7"],[251,40,5,10,"helios-reactor"],[282,114,8,3,"helios-reactor"],
  [-306,98,10,3,"astra-academy"],[-250,94,4,9,"astra-academy"],[-119,231,12,3,"void-mall"],[-66,231,12,3,"void-mall"],
  [78,322,6,8,"orbital-farms"],[178,309,9,3,"orbital-farms"],[-307,-286,9,4,"crash-site"],[-371,-264,5,8,"crash-site"],
  [310,-50,8,3,"thruster-works"],[378,-72,4,9,"thruster-works"],
  [-54,-10,10,3,"zero-point"],[52,8,10,3,"zero-point"],[-12,58,4,9,"zero-point"],[15,-55,4,9,"zero-point"],
  [-238,-112,8,3,"nova-plaza"],[-112,-150,8,3,"nova-plaza"],[-197,-83,4,8,"nova-plaza"],[-146,-79,4,8,"nova-plaza"],
  [132,-157,11,3,"dockyard-7"],[251,-145,11,3,"dockyard-7"],[170,-211,4,10,"dockyard-7"],[218,-208,4,10,"dockyard-7"],
  [208,105,9,3,"helios-reactor"],[316,100,9,3,"helios-reactor"],[238,142,4,9,"helios-reactor"],[287,143,4,9,"helios-reactor"],
  [-339,80,9,3,"astra-academy"],[-217,79,9,3,"astra-academy"],[-304,137,4,8,"astra-academy"],[-250,139,4,8,"astra-academy"],
  [-160,285,9,3,"void-mall"],[-25,286,9,3,"void-mall"],[-126,339,4,9,"void-mall"],[-60,340,4,9,"void-mall"],
  [61,294,10,3,"orbital-farms"],[198,285,10,3,"orbital-farms"],[98,344,4,9,"orbital-farms"],[161,348,4,9,"orbital-farms"],
  [-396,-245,10,3,"crash-site"],[-269,-260,10,3,"crash-site"],[-347,-317,4,9,"crash-site"],[-306,-198,4,9,"crash-site"],
  [276,-70,10,3,"thruster-works"],[411,-72,10,3,"thruster-works"],[319,-5,4,9,"thruster-works"],[374,-10,4,9,"thruster-works"]
].map(([x,z,w,d,districtId], index) => ({ id:`cover-${index}`, districtId:String(districtId), position:{x:Number(x),y:1,z:Number(z)}, size:{x:Number(w),y:2,z:Number(d)}, color:"#344764", kind:"cover" }));

const secondaryCover:BrMapBlock[]=BR_SECONDARY_LOCATIONS.flatMap((location,index)=>[0,1,2,3].map((slot)=>{
  const angle=slot*Math.PI/2+(index%3)*.22,radius=27+(slot%2)*5;
  const wide=slot%2===0;
  return{id:`${location.id}-cover-${slot}`,districtId:location.id,position:{x:location.position.x+Math.cos(angle)*radius,y:1,z:location.position.z+Math.sin(angle)*radius},size:{x:wide?7:2.4,y:2,z:wide?2.4:7},color:location.color,kind:"cover" as const};
}));

export const BR_MAP_BLOCKS: readonly BrMapBlock[] = [...BR_STRUCTURES.flatMap(structureBlocks), ...authoredCover,...secondaryCover];

/** Fixed, learnable loot locations tied to actual playable structure floors. */
export const BR_LOOT_SOCKETS: readonly BrLootSocket[] = BR_STRUCTURES.filter((structure)=>structure.enterable).flatMap((structure,index)=>{
  const inward=structure.entrance==="north"?{x:0,z:-structure.size.z*.23}:structure.entrance==="south"?{x:0,z:structure.size.z*.23}:structure.entrance==="east"?{x:-structure.size.x*.23,z:0}:{x:structure.size.x*.23,z:0};
  const sockets:BrLootSocket[]=[{id:`${structure.id}-interior`,districtId:structure.districtId,structureId:structure.id,position:{x:structure.position.x+inward.x,y:.58,z:structure.position.z+inward.z},kind:"interior"}];
  if(structure.roofAccess||index%3===0)sockets.push({id:`${structure.id}-roof-loot`,districtId:structure.districtId,structureId:structure.id,position:{x:structure.position.x-structure.size.x*.18,y:structure.size.y+.65,z:structure.position.z+structure.size.z*.17},kind:"roof"});
  return sockets;
});

export const BR_CRATE_SOCKETS: readonly Vec3[] = [...BR_POIS.map((district,index)=>{
  const structure=BR_STRUCTURES.find((entry)=>entry.districtId===district.id)!;const side=index%2?-1:1;
  return{x:structure.position.x+side*structure.size.x*.22,y:.62,z:structure.position.z};
}),...BR_SECONDARY_LOCATIONS.filter((_,index)=>index%3===0).map((location)=>({x:location.position.x,y:.62,z:location.position.z}))];

export const BR_TRAVERSAL = [
  { id:"lift-zero", kind:"grav-lift" as const, position:{x:20,y:0,z:18}, target:{x:20,y:25,z:18} },
  { id:"lift-nova", kind:"grav-lift" as const, position:{x:-137,y:0,z:-168}, target:{x:-137,y:21,z:-168} },
  { id:"lift-helios", kind:"grav-lift" as const, position:{x:262,y:0,z:38}, target:{x:262,y:25,z:38} },
  { id:"jump-east", kind:"jump-pad" as const, position:{x:112,y:0,z:28}, target:{x:238,y:24,z:75} },
  { id:"jump-west", kind:"jump-pad" as const, position:{x:-112,y:0,z:24}, target:{x:-252,y:23,z:77} }
] as const;

export function isInsideBrIsland(position: Vec3, margin = 0): boolean {
  if (pointInPolygon(position.x,position.z)) return true;
  return margin > 0 && Math.hypot(position.x,position.z) <= BR_MAP.radius+margin && distanceToOutline(position.x,position.z) <= margin;
}

export function brBlocksNear(position: Vec3, radius = 8): BrMapBlock[] {
  return BR_MAP_BLOCKS.filter((block) => Math.abs(block.position.x-position.x)<=block.size.x/2+radius && Math.abs(block.position.z-position.z)<=block.size.z/2+radius);
}

/** Stable spatial partition used by both prediction and authority for movement queries. */
export const BR_PHYSICS_SECTOR_SIZE = 100;
export function brPhysicsSector(position: Vec3): { key: string; center: Vec3 } {
  const x = Math.floor(position.x / BR_PHYSICS_SECTOR_SIZE);
  const z = Math.floor(position.z / BR_PHYSICS_SECTOR_SIZE);
  return { key: `${x}:${z}`, center: { x: (x + .5) * BR_PHYSICS_SECTOR_SIZE, y: 0, z: (z + .5) * BR_PHYSICS_SECTOR_SIZE } };
}

export function brBlocksForPhysicsSector(position: Vec3): readonly BrMapBlock[] {
  const { center } = brPhysicsSector(position);
  // The overlap margin covers the largest authored shell plus multiple full-speed
  // frames, so switching sectors cannot expose a collision seam.
  return brBlocksNear(center, BR_PHYSICS_SECTOR_SIZE / 2 + 46);
}

function pointInPolygon(x:number,z:number): boolean {
  let inside=false;
  for(let i=0,j=BR_ISLAND_OUTLINE.length-1;i<BR_ISLAND_OUTLINE.length;j=i++) { const [xi,zi]=BR_ISLAND_OUTLINE[i]; const [xj,zj]=BR_ISLAND_OUTLINE[j]; if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi) inside=!inside; }
  return inside;
}

function distanceToOutline(x:number,z:number): number {
  let best=Number.POSITIVE_INFINITY;
  for(let i=0;i<BR_ISLAND_OUTLINE.length;i++){const [ax,az]=BR_ISLAND_OUTLINE[i];const [bx,bz]=BR_ISLAND_OUTLINE[(i+1)%BR_ISLAND_OUTLINE.length];const dx=bx-ax,dz=bz-az;const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(x-(ax+dx*t),z-(az+dz*t)));}
  return best;
}

export function brShipPath(seed:number): { start:Vec3; end:Vec3 } {
  const angle=((seed>>>0)%6283)/1000; const lateral=(((seed*1664525+1013904223)>>>0)%180)-90; const dx=Math.cos(angle),dz=Math.sin(angle),px=-dz*lateral,pz=dx*lateral;
  return {start:{x:px-dx*620,y:195,z:pz-dz*620},end:{x:px+dx*620,y:195,z:pz+dz*620}};
}
