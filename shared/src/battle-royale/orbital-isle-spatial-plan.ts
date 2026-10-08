import type { BrDistrictPlan, BrDistrictPlanKind, BrDistrictParcel, BrMapBlock, BrRoadSegment, BrStructure } from "./map.js";

type Entrance=BrStructure["entrance"];
type Purpose=BrDistrictPlan["openZone"]["purpose"];
type FixedSite={
  id:string;
  kind:BrDistrictPlanKind;
  elevation:number;
  origin?:readonly [number,number];
  approach:{x:number;y:number;z:number};
  streets:readonly BrRoadSegment[];
  parcels:readonly [string,number,number,Entrance,BrDistrictParcel["role"],number?,number?][];
  openZone:{x:number;z:number;radius:number;purpose:Purpose};
};

const road=(id:string,x1:number,z1:number,x2:number,z2:number,width=7,color="#304761",intentionalTerminus=false):BrRoadSegment=>({
  id,from:{x:x1,y:.1,z:z1},to:{x:x2,y:.1,z:z2},width,color,kind:"local",intentionalTerminus
});

/**
 * Fixed authored plans for every connective district. Every endpoint, parcel,
 * entrance and open zone is literal map data: no seed, candidate search or
 * nearest-free-space solver participates in world construction.
 */
const FIXED_SITES:readonly FixedSite[]=[
  {id:"central-heights",kind:"neighborhood",elevation:0,origin:[-65,-82],approach:{x:-1,y:0,z:0},streets:[road("central-heights-main",-105,-82,-45,-82,8),road("central-heights-cross",-65,-109,-65,-33,7,"#304761",true)],parcels:[["central-heights-parcel-1",-48,-42,"west","anchor"],["central-heights-parcel-2",-51,-98,"west","support"],["central-heights-parcel-3",-119,-82,"east","service"]],openZone:{x:-95,z:-65,radius:8,purpose:"courtyard"}},
  {id:"relay-market",kind:"commercial",elevation:0,approach:{x:-1,y:0,z:0},streets:[road("relay-market-main",52,-78,112,-78,8),road("relay-market-cross",82,-105,82,-51,8,"#304761",true)],parcels:[["relay-market-parcel-1",102,-52,"west","anchor"],["relay-market-parcel-2",128,-94,"west","support"],["relay-market-parcel-3",60,-98,"east","service"]],openZone:{x:62,z:-61,radius:8,purpose:"courtyard"}},
  {id:"comet-hotel",kind:"commercial",elevation:0,origin:[-65,-214],approach:{x:-1,y:0,z:0},streets:[road("comet-hotel-main",-106,-214,-46,-214,8),road("comet-hotel-cross",-65,-241,-65,-187,7,"#49384f",true)],parcels:[["comet-hotel-parcel-1",-94,-236,"east","anchor"],["comet-hotel-parcel-2",-118,-234,"east","support"],["comet-hotel-parcel-3",-50,-230,"west","service"]],openZone:{x:-56,z:-197,radius:8,purpose:"courtyard"}},
  {id:"horizon-homes",kind:"neighborhood",elevation:0,approach:{x:0,y:0,z:-1},streets:[road("horizon-homes-main",-285,-30,-225,-30,7),road("horizon-homes-cross",-255,-57,-255,-3,7,"#3b3b57",true)],parcels:[["horizon-homes-parcel-1",-275,-13,"east","anchor"],["horizon-homes-parcel-2",-235,-13,"west","support"],["horizon-homes-parcel-3",-275,-47,"east","service"]],openZone:{x:-235,z:-47,radius:8,purpose:"courtyard"}},
  {id:"academy-dorms",kind:"campus",elevation:0,origin:[-400,125],approach:{x:1,y:0,z:0},streets:[road("academy-dorms-main",-400,125,-340,125,7),road("academy-dorms-cross",-400,123,-400,185,7,"#393650",true),road("academy-dorms-north",-400,185,-369,185,7,"#393650"),road("academy-dorms-frontage",-369,185,-369,159,7,"#393650",true)],parcels:[["academy-dorms-parcel-1",-384,167,"east","anchor"],["academy-dorms-parcel-2",-390,107,"east","support"],["academy-dorms-parcel-3",-350,81,"west","service"]],openZone:{x:-350,z:142,radius:8,purpose:"garden"}},
  {id:"west-overlook",kind:"civic",elevation:0,approach:{x:-1,y:0,z:0},streets:[road("west-overlook-main",-435,15,-375,15,7),road("west-overlook-cross",-405,-12,-405,42,7,"#33465b",true)],parcels:[["west-overlook-parcel-1",-385,31,"west","anchor"],["west-overlook-parcel-2",-385,-1,"west","support"],["west-overlook-parcel-3",-449,-1,"east","service"]],openZone:{x:-425,z:32,radius:8,purpose:"courtyard"}},
  {id:"signal-station",kind:"workyard",elevation:0,approach:{x:-1,y:0,z:0},streets:[road("signal-station-main",-435,-125,-375,-125,8),road("signal-station-cross",-405,-152,-405,-98,7,"#374351",true)],parcels:[["signal-station-parcel-1",-409,-83,"east","anchor"],["signal-station-parcel-2",-385,-109,"west","support"],["signal-station-parcel-3",-385,-141,"west","service"]],openZone:{x:-425,z:-142,radius:8,purpose:"yard"}},
  {id:"salvage-row",kind:"salvage",elevation:0,approach:{x:0,y:0,z:1},streets:[road("salvage-row-main",-345,-335,-285,-335,8),road("salvage-row-cross",-315,-362,-315,-308,7,"#49363c",true)],parcels:[["salvage-row-parcel-1",-307,-293,"east","anchor",16,14],["salvage-row-parcel-2",-335,-351,"east","support"],["salvage-row-parcel-3",-295,-351,"west","service"]],openZone:{x:-295,z:-318,radius:8,purpose:"salvage"}},
  {id:"emergency-depot",kind:"salvage",elevation:5.5,approach:{x:0,y:0,z:1},streets:[road("emergency-depot-main",-190,-420,-130,-420,8),road("emergency-depot-cross",-160,-447,-160,-393,8,"#49363c",true)],parcels:[["emergency-depot-parcel-1",-140,-403,"west","anchor"],["emergency-depot-parcel-2",-140,-437,"west","support"],["emergency-depot-parcel-3",-180,-437,"east","service"]],openZone:{x:-180,z:-403,radius:8,purpose:"salvage"}},
  {id:"south-terminal",kind:"civic",elevation:3.5,approach:{x:0,y:0,z:1},streets:[road("south-terminal-main",-15,-415,45,-415,8),road("south-terminal-cross",15,-442,15,-388,8,"#33465b",true)],parcels:[["south-terminal-parcel-1",35,-398,"west","anchor"],["south-terminal-parcel-2",35,-432,"west","support"],["south-terminal-parcel-3",-5,-432,"east","service"]],openZone:{x:-5,z:-398,radius:8,purpose:"courtyard"}},
  {id:"cargo-spur",kind:"workyard",elevation:0,approach:{x:1,y:0,z:0},streets:[road("cargo-spur-main",65,-285,125,-285,8),road("cargo-spur-cross",95,-312,95,-258,8,"#463d34",true)],parcels:[["cargo-spur-parcel-1",75,-269,"east","anchor"],["cargo-spur-parcel-2",75,-301,"east","support"],["cargo-spur-parcel-3",129,-301,"west","service"]],openZone:{x:115,z:-268,radius:8,purpose:"yard"}},
  {id:"dock-service",kind:"workyard",elevation:0,approach:{x:-.2,y:0,z:1},streets:[road("dock-service-main",255,-275,315,-275,9),road("dock-service-cross",285,-302,285,-248,8,"#463d34",true)],parcels:[["dock-service-parcel-1",319,-253,"west","anchor"],["dock-service-parcel-2",253,-291,"east","support"],["dock-service-parcel-3",271,-291,"west","service"]],openZone:{x:265,z:-258,radius:8,purpose:"yard"}},
  {id:"engine-gate",kind:"workyard",elevation:0,approach:{x:.5,y:0,z:1},streets:[road("engine-gate-main",375,-180,435,-180,8),road("engine-gate-cross",405,-207,405,-153,8,"#33465b",true)],parcels:[["engine-gate-parcel-1",385,-163,"east","anchor"],["engine-gate-parcel-2",385,-197,"east","support"],["engine-gate-parcel-3",425,-197,"west","service"]],openZone:{x:425,z:-163,radius:8,purpose:"yard"}},
  {id:"east-checkpoint",kind:"civic",elevation:4.5,approach:{x:0,y:0,z:-1},streets:[road("east-checkpoint-main",325,255,385,255,8),road("east-checkpoint-cross",355,228,355,282,8,"#33465b",true)],parcels:[["east-checkpoint-parcel-1",373,239,"west","anchor"],["east-checkpoint-parcel-2",373,215,"west","support"],["east-checkpoint-parcel-3",327,241,"east","service"]],openZone:{x:335,z:272,radius:8,purpose:"courtyard"}},
  {id:"helios-relay",kind:"workyard",elevation:0,approach:{x:-1,y:0,z:0},streets:[road("helios-relay-main",345,135,405,135,8),road("helios-relay-cross",375,108,375,162,8,"#4b482e",true)],parcels:[["helios-relay-parcel-1",359,179,"east","anchor"],["helios-relay-parcel-2",365,89,"east","support"],["helios-relay-parcel-3",417,121,"west","service"]],openZone:{x:395,z:152,radius:8,purpose:"yard"}},
  {id:"orbital-overlook",kind:"civic",elevation:0,approach:{x:.6,y:0,z:-1},streets:[road("orbital-overlook-main",275,220,335,220,7),road("orbital-overlook-cross",305,193,305,247,7,"#33465b",true)],parcels:[["orbital-overlook-parcel-1",285,236,"east","anchor"],["orbital-overlook-parcel-2",313,262,"west","support"],["orbital-overlook-parcel-3",267,174,"east","service"]],openZone:{x:325,z:203,radius:8,purpose:"courtyard"}},
  {id:"farm-service",kind:"agricultural",elevation:0,approach:{x:-1,y:0,z:0},streets:[road("farm-service-main",250,330,310,330,7),road("farm-service-cross",280,303,280,357,7,"#304b43",true)],parcels:[["farm-service-parcel-1",300,347,"west","anchor"],["farm-service-parcel-2",300,313,"west","support"],["farm-service-parcel-3",260,313,"east","service"]],openZone:{x:260,z:347,radius:8,purpose:"garden"}},
  {id:"solar-field",kind:"agricultural",elevation:4,approach:{x:0,y:0,z:-1},streets:[road("solar-field-main",45,415,105,415,7),road("solar-field-cross",75,388,75,442,7,"#304b43",true)],parcels:[["solar-field-parcel-1",55,432,"east","anchor"],["solar-field-parcel-2",95,432,"west","support"],["solar-field-parcel-3",55,398,"east","service"]],openZone:{x:95,z:398,radius:8,purpose:"garden"}},
  {id:"north-gardens",kind:"agricultural",elevation:0,approach:{x:0,y:0,z:-1},streets:[road("north-gardens-main",-75,405,-15,405,7),road("north-gardens-cross",-45,378,-45,432,7,"#304b43",true)],parcels:[["north-gardens-parcel-1",-65,422,"east","anchor"],["north-gardens-parcel-2",-65,388,"east","support"],["north-gardens-parcel-3",-25,388,"west","service"]],openZone:{x:-25,z:422,radius:8,purpose:"garden"}},
  {id:"mall-annex",kind:"commercial",elevation:0,approach:{x:1,y:0,z:0},streets:[road("mall-annex-main",-235,365,-175,365,8),road("mall-annex-cross",-205,338,-205,392,8,"#41314f",true)],parcels:[["mall-annex-parcel-1",-225,381,"east","anchor"],["mall-annex-parcel-2",-221,327,"east","support"],["mall-annex-parcel-3",-203,323,"west","service"]],openZone:{x:-185,z:382,radius:8,purpose:"courtyard"}},
  {id:"academy-commons",kind:"campus",elevation:5.5,approach:{x:-1,y:0,z:1},streets:[road("academy-commons-main",-295,235,-235,235,7),road("academy-commons-cross",-265,208,-265,262,7,"#393650",true)],parcels:[["academy-commons-parcel-1",-245,252,"west","anchor"],["academy-commons-parcel-2",-245,218,"west","support"],["academy-commons-parcel-3",-285,218,"east","service"]],openZone:{x:-285,z:252,radius:8,purpose:"garden"}},
  {id:"west-park",kind:"campus",elevation:0,origin:[-400,150],approach:{x:-1,y:0,z:0},streets:[road("west-park-main",-430,150,-365,150,7),road("west-park-cross",-400,123,-400,177,7,"#393650",true)],parcels:[["west-park-parcel-1",-347,174,"west","anchor"],["west-park-parcel-2",-410,108,"west","support"],["west-park-parcel-3",-448,134,"east","service"]],openZone:{x:-420,z:167,radius:8,purpose:"garden"}},
  {id:"coolant-plant",kind:"workyard",elevation:0,approach:{x:1,y:0,z:0},streets:[road("coolant-plant-main",50,180,110,180,8),road("coolant-plant-cross",80,153,80,207,8,"#304a58",true)],parcels:[["coolant-plant-parcel-1",60,197,"east","anchor"],["coolant-plant-parcel-2",60,163,"east","support"],["coolant-plant-parcel-3",100,163,"west","service"]],openZone:{x:100,z:197,radius:8,purpose:"yard"}},
  {id:"central-security",kind:"civic",elevation:0,approach:{x:-1,y:0,z:1},streets:[road("central-security-main",-175,85,-115,85,8),road("central-security-cross",-145,58,-145,112,8,"#374157",true)],parcels:[["central-security-parcel-1",-109,123,"west","anchor"],["central-security-parcel-2",-181,65,"east","support"],["central-security-parcel-3",-125,69,"west","service"]],openZone:{x:-165,z:102,radius:8,purpose:"courtyard"}},
  {id:"south-shipworks",kind:"workyard",elevation:4,approach:{x:0,y:0,z:1},streets:[road("south-shipworks-main",160,-400,220,-400,9),road("south-shipworks-cross",190,-427,190,-373,8,"#463d34",true)],parcels:[["south-shipworks-parcel-1",210,-383,"west","anchor"],["south-shipworks-parcel-2",210,-417,"west","support"],["south-shipworks-parcel-3",170,-417,"east","service"]],openZone:{x:170,z:-383,radius:8,purpose:"yard"}},
  {id:"east-freight",kind:"workyard",elevation:8,approach:{x:-1,y:0,z:1},streets:[road("east-freight-main",300,-315,360,-315,9),road("east-freight-cross",330,-342,330,-288,8,"#463d34",true)],parcels:[["east-freight-parcel-1",350,-298,"west","anchor"],["east-freight-parcel-2",350,-332,"west","support"],["east-freight-parcel-3",310,-332,"east","service"]],openZone:{x:310,z:-298,radius:8,purpose:"yard"}},
  {id:"northwest-housing",kind:"neighborhood",elevation:0,approach:{x:1,y:0,z:0},streets:[road("northwest-housing-main",-280,365,-220,365,7),road("northwest-housing-cross",-250,338,-250,392,7,"#3b3b57",true)],parcels:[["northwest-housing-parcel-1",-268,381,"east","anchor"],["northwest-housing-parcel-2",-296,353,"east","support"],["northwest-housing-parcel-3",-238,323,"west","service"]],openZone:{x:-230,z:382,radius:8,purpose:"courtyard"}},
  {id:"west-salvage",kind:"salvage",elevation:0,approach:{x:-1,y:0,z:0},streets:[road("west-salvage-main",-415,-205,-355,-205,8),road("west-salvage-cross",-395,-232,-395,-205,7,"#49363c",true)],parcels:[["west-salvage-parcel-1",-365,-179,"west","anchor"],["west-salvage-parcel-2",-412,-229,"east","support"],["west-salvage-parcel-3",-367,-247,"west","service"]],openZone:{x:-405,z:-188,radius:8,purpose:"salvage"}},
  {id:"east-rim",kind:"workyard",elevation:6,approach:{x:1,y:0,z:0},streets:[road("east-rim-main",375,105,435,105,8),road("east-rim-cross",405,78,405,132,7,"#33465b",true)],parcels:[["east-rim-parcel-1",389,121,"east","anchor"],["east-rim-parcel-2",433,121,"west","support"],["east-rim-parcel-3",425,89,"west","service"]],openZone:{x:385,z:88,radius:8,purpose:"yard"}},
  {id:"west-rim",kind:"campus",elevation:0,approach:{x:1,y:0,z:-1},streets:[road("west-rim-main",-374,310,-346,310,7),road("west-rim-cross",-360,283,-360,330,7,"#393650",true)],parcels:[["west-rim-parcel-1",-340,326,"west","anchor"],["west-rim-parcel-2",-320,278,"west","support"],["west-rim-parcel-3",-376,292,"east","service"]],openZone:{x:-380,z:327,radius:8,purpose:"garden"}}
];

export const AUTHORED_BR_DISTRICT_ELEVATIONS:ReadonlyMap<string,number>=new Map(FIXED_SITES.map(site=>[site.id,site.elevation]));

/** Hand-authored grade break for the two full raised districts. The service
 * road runs level across the district deck, then descends from `edge` to its
 * existing collector endpoint. These are map data, not a terrain solver. */
export const AUTHORED_BR_ELEVATED_ACCESS:ReadonlyMap<string,{districtId:string;edge:{x:number;y:number;z:number}}>=new Map([
  ["service-8",{districtId:"emergency-depot",edge:{x:-160,y:5.6,z:-384}}],
  ["service-9",{districtId:"south-terminal",edge:{x:15,y:3.6,z:-382}}],
  ["service-13",{districtId:"east-checkpoint",edge:{x:327.4,y:4.6,z:207}}],
  ["service-17",{districtId:"solar-field",edge:{x:76.23,y:4.1,z:379}}],
  ["service-20",{districtId:"academy-commons",edge:{x:-230,y:5.6,z:234.15}}],
  ["service-24",{districtId:"south-shipworks",edge:{x:190,y:4.1,z:-367}}],
  ["service-25",{districtId:"east-freight",edge:{x:306.17,y:8.1,z:-276}}],
  ["service-28",{districtId:"east-rim",edge:{x:362,y:6.1,z:105}}]
]);

export const AUTHORED_BR_SPATIAL_PLANS:readonly BrDistrictPlan[]=FIXED_SITES.map(site=>({
  id:site.id,
  origin:{x:site.origin?.[0]??(site.streets[0].from.x+site.streets[0].to.x)/2,z:site.origin?.[1]??(site.streets[0].from.z+site.streets[0].to.z)/2,y:site.elevation},
  elevation:site.elevation,
  kind:site.kind,
  approach:site.approach,
  streets:site.streets.map(street=>({...street,from:{...street.from,y:site.elevation+.1},to:{...street.to,y:site.elevation+.1}})),
  parcels:site.parcels.map(([id,x,z,entrance,role])=>({id,position:{x,y:site.elevation,z},entrance,role})),
  openZone:{position:{x:site.openZone.x,y:site.elevation,z:site.openZone.z},radius:site.openZone.radius,purpose:site.openZone.purpose}
}));

export const AUTHORED_BR_STRUCTURE_PLACEMENTS:ReadonlyMap<string,{position:{x:number;y:number;z:number};entrance:Entrance;size?:{x:number;z:number}}>=new Map(
  FIXED_SITES.flatMap(site=>site.parcels.map(([parcelId,x,z,entrance,,width,depth])=>[
    parcelId.replace("-parcel-","-"),
    {position:{x,y:site.elevation,z},entrance,size:width&&depth?{x:width,z:depth}:undefined}
  ] as const))
);

/** Low authoritative cover placed by hand at the edges of reserved courtyards
 * and yards. These replace the old four-per-site radial formula that put
 * collision props across roads and entrances. */
const FIXED_SECONDARY_COVER:readonly [string,number,number,number,number][]=[
  ["central-heights",-103,-69,5.5,1.8],
  ["relay-market",62,-67,5.5,1.8],["relay-market",59,-70,1.8,5.5],
  ["comet-hotel",-53,-197,5.5,1.8],["comet-hotel",-56,-203,1.8,5.5],
  ["horizon-homes",-235,-39,5.5,1.8],["horizon-homes",-241,-39,1.8,5.5],
  ["academy-dorms",-356,142,5.5,1.8],["academy-dorms",-350,136,1.8,5.5],
  ["west-overlook",-419,32,5.5,1.8],["west-overlook",-421,26,1.8,5.5],
  ["signal-station",-433,-144,5.5,1.8],["signal-station",-433,-138,1.8,5.5],
  ["salvage-row",-301,-318,5.5,1.8],["salvage-row",-299,-312,1.8,5.5],
  ["emergency-depot",-186,-403,5.5,1.8],["emergency-depot",-180,-409,1.8,5.5],
  ["south-terminal",-11,-398,5.5,1.8],["south-terminal",-5,-404,1.8,5.5],
  ["cargo-spur",123,-268,5.5,1.8],["cargo-spur",123,-274,1.8,5.5],
  ["dock-service",259,-258,5.5,1.8],["dock-service",265,-264,1.8,5.5],
  ["engine-gate",419,-163,5.5,1.8],["engine-gate",425,-169,1.8,5.5],
  ["east-checkpoint",329,272,5.5,1.8],["east-checkpoint",335,266,1.8,5.5],
  ["helios-relay",389,152,5.5,1.8],["helios-relay",395,146,1.8,5.5],
  ["orbital-overlook",319,207,5.5,1.8],["orbital-overlook",331,201,1.8,5.5],
  ["farm-service",254,347,5.5,1.8],["farm-service",260,341,1.8,5.5],
  ["solar-field",89,398,5.5,1.8],["solar-field",95,392,1.8,5.5],
  ["north-gardens",-31,422,5.5,1.8],["north-gardens",-25,416,1.8,5.5],
  ["mall-annex",-191,382,5.5,1.8],["mall-annex",-185,376,1.8,5.5],
  ["academy-commons",-291,252,5.5,1.8],["academy-commons",-285,246,1.8,5.5],
  ["coolant-plant",94,197,5.5,1.8],["coolant-plant",100,191,1.8,5.5],
  ["central-security",-159,106,5.5,1.8],["central-security",-157,100,1.8,5.5],
  ["south-shipworks",176,-375,5.5,1.8],
  ["east-freight",304,-298,5.5,1.8],["east-freight",310,-304,1.8,5.5],
  ["northwest-housing",-240,382,5.5,1.8],["northwest-housing",-238,388,1.8,5.5],
  ["west-salvage",-405,-194,5.5,1.8],["west-salvage",-405,-182,1.8,5.5],
  ["east-rim",379,88,5.5,1.8],["east-rim",385,82,1.8,5.5]
];

export const AUTHORED_BR_SECONDARY_COVER:readonly BrMapBlock[]=FIXED_SECONDARY_COVER.map(([districtId,x,z,width,depth],index)=>({
  id:`secondary-cover-${index}`,districtId,position:{x,y:(AUTHORED_BR_DISTRICT_ELEVATIONS.get(districtId)??0)+1,z},size:{x:width,y:2,z:depth},color:"#344764",kind:"cover"
}));

/** Permanent tactical rhythm for the four long inter-district transitions.
 * These are gameplay cover, not decorative props: their exact locations are
 * shared by server collision, client prediction, navigation and rendering. */
export const AUTHORED_BR_CONNECTIVE_COVER:readonly BrMapBlock[]=[
  {id:"coolant-exchange-cover-west",districtId:"coolant-plant",position:{x:-43,y:1,z:125},size:{x:7,y:2,z:3},color:"#344764",kind:"cover"},
  {id:"coolant-exchange-cover-east",districtId:"coolant-plant",position:{x:-7,y:1,z:125},size:{x:7,y:2,z:3},color:"#344764",kind:"cover"},
  {id:"south-orbit-cover-west",districtId:"south-terminal",position:{x:7,y:1,z:-175},size:{x:7,y:2,z:3},color:"#344764",kind:"cover"},
  {id:"south-orbit-cover-east",districtId:"south-terminal",position:{x:43,y:1,z:-175},size:{x:7,y:2,z:3},color:"#344764",kind:"cover"},
  {id:"crash-transit-cover-west",districtId:"crash-site",position:{x:-218,y:1,z:-275},size:{x:7,y:2,z:3},color:"#344764",kind:"cover"},
  {id:"crash-transit-cover-east",districtId:"crash-site",position:{x:-182,y:1,z:-275},size:{x:7,y:2,z:3},color:"#344764",kind:"cover"},
  {id:"east-power-cover-west",districtId:"helios-reactor",position:{x:157,y:1,z:-25},size:{x:7,y:2,z:3},color:"#344764",kind:"cover"},
  {id:"east-power-cover-east",districtId:"helios-reactor",position:{x:193,y:1,z:-25},size:{x:7,y:2,z:3},color:"#344764",kind:"cover"},
  {id:"west-neighborhood-cover-south",districtId:"horizon-homes",position:{x:-307,y:1,z:-76},size:{x:6,y:2,z:2},color:"#344764",kind:"cover"},
  {id:"west-neighborhood-cover-north",districtId:"horizon-homes",position:{x:-328,y:1,z:-58},size:{x:6,y:2,z:2},color:"#344764",kind:"cover"},
  {id:"south-freight-cover-west",districtId:"cargo-spur",position:{x:160,y:1,z:-270},size:{x:7,y:2,z:3},color:"#344764",kind:"cover"},
  {id:"south-freight-cover-east",districtId:"dock-service",position:{x:220,y:1,z:-290},size:{x:7,y:2,z:3},color:"#344764",kind:"cover"},
  {id:"north-skywalk-cover-west",districtId:"mall-annex",position:{x:-187,y:1,z:423},size:{x:6,y:2,z:2},color:"#344764",kind:"cover"},
  {id:"north-skywalk-cover-east",districtId:"north-gardens",position:{x:-120,y:1,z:435},size:{x:6,y:2,z:2},color:"#344764",kind:"cover"}
];
