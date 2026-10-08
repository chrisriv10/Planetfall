import type { Vec3 } from "../index.js";
import { BR_ELEVATION_REGIONS, BR_SUNKEN_REGIONS, brAuthoredDeckHeight, brGradeAuthoredRoad, brJoinServiceGrades } from "./orbital-isle-elevation.js";
import {
  AUTHORED_BR_SECONDARY_STRUCTURE_BLUEPRINTS,
  AUTHORED_BR_SERVICE_ROADS
} from "./orbital-isle-authored.js";
import {
  AUTHORED_BR_CONNECTIVE_COVER,
  AUTHORED_BR_DISTRICT_ELEVATIONS,
  AUTHORED_BR_ELEVATED_ACCESS,
  AUTHORED_BR_SECONDARY_COVER,
  AUTHORED_BR_SPATIAL_PLANS,
  AUTHORED_BR_STRUCTURE_PLACEMENTS
} from "./orbital-isle-spatial-plan.js";

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
  /** Exterior ramp side, kept separate from the pedestrian entrance so roof
   * access never has to occupy the site's street frontage. */
  roofAccessSide?: "north" | "south" | "east" | "west";
  /** Lateral offset along that facade, used by large landmark buildings whose
   * centered ramp would otherwise meet an adjacent wing. */
  roofAccessOffset?: number;
  enterable: boolean;
  archetype: BrStructureArchetype;
}

export type BrStructureArchetype = "shop" | "apartment" | "tower" | "office" | "hotel" | "warehouse" | "hangar" | "lab" | "academy" | "mall" | "industrial" | "greenhouse" | "transit" | "utility";
export interface BrSecondaryLocation { id:string; name:string; position:Vec3; color:string; style:BrDistrictStyle; connectTo:string; }

export type BrDistrictPlanKind = "neighborhood" | "campus" | "commercial" | "workyard" | "agricultural" | "salvage" | "civic";
export interface BrDistrictParcel {
  id: string;
  position: Vec3;
  entrance: BrStructure["entrance"];
  role: "anchor" | "support" | "service";
}
export interface BrDistrictPlan {
  id: string;
  origin: Vec3;
  elevation: number;
  kind: BrDistrictPlanKind;
  approach: Vec3;
  streets: BrRoadSegment[];
  parcels: BrDistrictParcel[];
  openZone: { position: Vec3; radius: number; purpose: "courtyard" | "yard" | "garden" | "salvage" };
}

export interface BrRoadSegment { id: string; from: Vec3; to: Vec3; width: number; color: string; kind?: "arterial" | "service" | "local"; intentionalTerminus?: boolean; }
export interface BrNavNode { id: string; position: Vec3; neighbors: string[]; }
export interface BrLootSocket { id: string; districtId: string; structureId: string; position: Vec3; kind: "interior" | "roof"; }
export interface BrTerrainPatch { id: string; position: Vec3; size: Vec3; rotation: number; color: string; kind: "park" | "plaza" | "industrial" | "coolant" | "landing"; }
export interface BrTerrace {
  id: string;
  districtId: string;
  position: Vec3;
  size: { x: number; z: number };
  height: number;
  accessSide: BrStructure["entrance"];
  /** Broad district decks use their authored service-road grade instead of a
   * separate narrow pedestrian ramp. */
  gradedRoadAccess?: boolean;
  color: string;
}

export const BR_MAP = { id: "orbital-isle", name: "ORBITAL ISLE", radius: 500, diameter: 1000 } as const;

/** Hand-shaped, contiguous main deck. Shared by rendering, drops and edge validation. */
export const BR_ISLAND_OUTLINE: readonly [number, number][] = [
  [-455,-105],[-418,-250],[-320,-402],[-174,-470],[5,-486],[174,-452],[326,-384],[430,-264],
  [486,-104],[472,62],[418,218],[315,374],[158,455],[-20,478],[-196,444],[-344,354],
  [-438,224],[-488,62]
];

const poi = (id: string, name: string, x: number, z: number, color: string, style: BrDistrictStyle, loot: readonly [number, number, number?][]): BrPoi => ({
  id, name, position: { x, y: brAuthoredDeckHeight({x,z}), z }, color, style,
  lootPoints: loot.map(([ox, oz, y = .55]) => ({ x: x + ox, y:y+brAuthoredDeckHeight({x:x+ox,z:z+oz}), z: z + oz }))
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

const secondary=(id:string,name:string,x:number,z:number,color:string,style:BrDistrictStyle,connectTo:string):BrSecondaryLocation=>({
  id,name,position:{x,y:brAuthoredDeckHeight({x,z})||AUTHORED_BR_DISTRICT_ELEVATIONS.get(id)||0,z},color,style,connectTo
});

/** Connective neighborhoods and utility compounds keep rotations active between the nine major POIs. */
export const BR_SECONDARY_LOCATIONS:readonly BrSecondaryLocation[]=[
  secondary("central-heights","CENTRAL HEIGHTS",-65,-82,"#65c9ff","city","zero-point"),
  secondary("relay-market","RELAY MARKET",82,-78,"#72def4","city","zero-point"),
  secondary("comet-hotel","COMET HOTEL",-65,-214,"#ee7ac4","city","nova-plaza"),
  secondary("horizon-homes","HORIZON HOMES",-255,-30,"#d98edc","city","nova-plaza"),
  secondary("academy-dorms","ACADEMY DORMS",-400,125,"#a88cff","academy","astra-academy"),
  secondary("west-overlook","WEST OVERLOOK",-405,15,"#75b8e8","nexus","astra-academy"),
  secondary("signal-station","SIGNAL STATION",-405,-125,"#5b95c9","industrial","nova-plaza"),
  secondary("salvage-row","SALVAGE ROW",-315,-335,"#db705d","wreck","crash-site"),
  secondary("emergency-depot","EMERGENCY DEPOT",-160,-420,"#f47b64","wreck","crash-site"),
  secondary("south-terminal","SOUTH TERMINAL",15,-415,"#5ca9da","nexus","zero-point"),
  secondary("cargo-spur","CARGO SPUR",95,-285,"#d88b47","dock","dockyard-7"),
  secondary("dock-service","DOCK SERVICE",285,-275,"#f0a052","dock","dockyard-7"),
  secondary("engine-gate","ENGINE GATE",405,-180,"#579edf","industrial","thruster-works"),
  secondary("east-checkpoint","EAST CHECKPOINT",355,255,"#65b8ff","industrial","helios-reactor"),
  secondary("helios-relay","HELIOS RELAY",375,135,"#ffd84d","reactor","helios-reactor"),
  secondary("orbital-overlook","ORBITAL OVERLOOK",305,220,"#73c8e8","nexus","helios-reactor"),
  secondary("farm-service","FARM SERVICE",280,330,"#63ef8b","farm","orbital-farms"),
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
  secondary("east-rim","EAST RIM",405,105,"#68b8de","industrial","helios-reactor"),
  secondary("west-rim","WEST RIM",-360,310,"#8f8bd6","academy","astra-academy"),
  secondary("transit-court","TRANSIT COURT",137.5,92.5,"#63bcd4","nexus","zero-point"),
  secondary("south-exchange","SOUTH EXCHANGE",-76,-357,"#d69bb8","city","nova-plaza"),
  secondary("farm-transfer","PRODUCTION TRANSFER",189,196,"#79beb3","industrial","orbital-farms"),
  secondary("solar-service","SOLAR SERVICE",180,416,"#79bea1","industrial","orbital-farms"),
  secondary("ring-service","SALVAGE CROSSING",-210,-340,"#b99878","industrial","crash-site"),
  secondary("west-junction","WEST JUNCTION",-330,-128.71900826446281,"#7bafc3","city","nova-plaza")
];

const BR_ARTERIAL_ROADS:readonly BrRoadSegment[]=[
  // A west-side collector keeps the rim neighborhoods connected without
  // drawing several hundred-metre service diagonals through the island's
  // central skyline. Its bends follow the engineered perimeter rather than
  // presenting as one implausibly straight decal across multiple districts.
  { id:"west-collector-south", from:{x:-414,y:.08,z:-210}, to:{x:-430,y:.08,z:-80}, width:13, color:"#293b58",kind:"arterial" },
  { id:"west-collector-mid", from:{x:-430,y:.08,z:-80}, to:{x:-430,y:.08,z:150}, width:13, color:"#293b58",kind:"arterial" },
  { id:"west-collector-rise", from:{x:-430,y:.08,z:150}, to:{x:-380,y:.08,z:240}, width:13, color:"#293b58",kind:"arterial" },
  { id:"west-collector-north", from:{x:-380,y:.08,z:240}, to:{x:-300,y:.08,z:330}, width:13, color:"#293b58",kind:"arterial" },
  { id:"west-collector-link", from:{x:-300,y:.08,z:330}, to:{x:-185,y:.08,z:358}, width:13, color:"#293b58",kind:"arterial" },
  // A neighborhood avenue gives the western housing and signal districts a
  // direct street relationship instead of forcing every rotation onto the
  // remote perimeter collector. The bend is literal level design: it clears
  // both districts' entrance parcels and frames the previously undefined
  // west-side deck as an inhabited connective corridor.
  { id:"west-neighborhood-link-a", from:{x:-285,y:.1,z:-30}, to:{x:-350,y:.1,z:-105}, width:8, color:"#33445d",kind:"arterial" },
  { id:"west-neighborhood-link-b", from:{x:-350,y:.1,z:-105}, to:{x:-360,y:.1,z:-125}, width:8, color:"#33445d",kind:"arterial" },
  { id:"west-neighborhood-link-c", from:{x:-360,y:.1,z:-125}, to:{x:-375,y:.1,z:-125}, width:8, color:"#33445d",kind:"arterial" },
  { id:"west-transit-avenue", from:{x:-375,y:.1,z:-125}, to:{x:-254,y:.1,z:-135}, width:8, color:"#3b4058",kind:"arterial" },
  // Emergency Depot sits on a 5.5m service deck. This long engineered grade
  // descends into Salvage Row through the former southwest dead field, giving
  // both players and bots a visible lower/upper-district rotation.
  { id:"southwest-salvage-grade", from:{x:-190,y:5.6,z:-420}, to:{x:-250,y:.1,z:-400}, width:8, color:"#4b3d4a",kind:"arterial" },
  { id:"southwest-salvage-link", from:{x:-250,y:.1,z:-400}, to:{x:-315,y:.1,z:-362}, width:8, color:"#4b3d4a",kind:"arterial" },
  // Emergency Depot and South Terminal share a civic rim loop. The inner
  // promenade is the fast rotation; the three-segment outer boardwalk bends
  // around their service buildings and gives the southern edge a deliberate
  // observation route instead of an unused strip of deck.
  { id:"south-rim-promenade", from:{x:-130,y:5.6,z:-420}, to:{x:-15,y:3.6,z:-415}, width:8, color:"#3b4654",kind:"arterial" },
  { id:"south-rim-boardwalk-west", from:{x:-160,y:5.6,z:-447}, to:{x:-125,y:5.1,z:-462}, width:7, color:"#35434f",kind:"arterial" },
  { id:"south-rim-boardwalk-main", from:{x:-125,y:5.1,z:-462}, to:{x:15,y:3.6,z:-452}, width:7, color:"#35434f",kind:"arterial" },
  { id:"south-rim-boardwalk-link", from:{x:15,y:3.6,z:-452}, to:{x:15,y:3.6,z:-442}, width:7, color:"#35434f",kind:"arterial" },
  { id:"ring-wn", from:{x:-185,y:.08,z:358}, to:{x:-190,y:.08,z:154}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-west", from:{x:-190,y:.08,z:154}, to:{x:-120,y:.08,z:-50}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-central-west", from:{x:-120,y:.08,z:-50}, to:{x:-92,y:.08,z:-60}, width:15, color:"#293b58",kind:"arterial" },
  // A three-way civic junction turns Central Heights, Relay Market and Comet
  // Hotel into one walkable neighborhood rather than three isolated sites.
  { id:"central-market-avenue-west", from:{x:-45,y:.1,z:-82}, to:{x:0,y:.1,z:-80}, width:8, color:"#34455c",kind:"arterial" },
  // Dogleg around Relay Market's authored loading/waiting pocket instead of
  // paving through the pedestrian furniture on the district's west edge.
  { id:"central-market-avenue-east", from:{x:0,y:.1,z:-80}, to:{x:40,y:.1,z:-55}, width:8, color:"#34455c",kind:"arterial" },
  { id:"central-market-avenue-bend", from:{x:40,y:.1,z:-55}, to:{x:52,y:.1,z:-60}, width:8, color:"#34455c",kind:"arterial" },
  { id:"central-market-avenue-entry", from:{x:52,y:.1,z:-60}, to:{x:52,y:.1,z:-78}, width:8, color:"#34455c",kind:"arterial" },
  // Approach Comet Hotel along its west service edge so the avenue frames,
  // rather than bisects, the small arrival garden north of the building.
  { id:"central-hotel-promenade", from:{x:0,y:.1,z:-80}, to:{x:-65,y:.1,z:-175}, width:8, color:"#3d4057",kind:"arterial" },
  { id:"central-hotel-promenade-south", from:{x:-65,y:.1,z:-175}, to:{x:-65,y:.1,z:-214}, width:8, color:"#3d4057",kind:"arterial" },
  { id:"central-hotel-promenade-entry", from:{x:-65,y:.1,z:-214}, to:{x:-46,y:.1,z:-214}, width:8, color:"#3d4057",kind:"arterial" },
  // Comet Hotel becomes the north/south anchor of a continuous southern
  // avenue linking the Crash-side ring to Cargo Spur. This replaces the broad
  // blank band between three neighborhoods with a readable street grid.
  // Keep each leg explicit in the route contract: treating the whole dogleg
  // as one chord makes downstream frontage/clearance helpers pave the parcel.
  { id:"hotel-south-avenue-entry", from:{x:-65,y:.1,z:-241}, to:{x:-65,y:.1,z:-270}, width:8, color:"#41404f",kind:"arterial" },
  { id:"hotel-south-avenue-link", from:{x:-65,y:.1,z:-270}, to:{x:-76,y:.1,z:-270}, width:8, color:"#41404f",kind:"arterial" },
  { id:"hotel-south-avenue", from:{x:-76,y:.1,z:-270}, to:{x:-76,y:.1,z:-340}, width:8, color:"#41404f",kind:"arterial" },
  { id:"crash-hotel-avenue", from:{x:-254,y:.1,z:-290}, to:{x:-76,y:.1,z:-290}, width:8, color:"#41404f",kind:"arterial" },
  { id:"hotel-cargo-avenue", from:{x:-76,y:.1,z:-290}, to:{x:65,y:.1,z:-285}, width:8, color:"#41404f",kind:"arterial" },
  { id:"ring-nova-east", from:{x:-92,y:.08,z:-60}, to:{x:-92,y:.08,z:-215}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-nova-south", from:{x:-92,y:.08,z:-215}, to:{x:-254,y:.08,z:-215}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-sw", from:{x:-254,y:.08,z:-215}, to:{x:-254,y:.08,z:-340}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-s", from:{x:-254,y:.08,z:-340}, to:{x:112,y:.08,z:-340}, width:17, color:"#293b58",kind:"arterial" },
  // A raised transfer bridge joins South Terminal to South Shipworks instead
  // of leaving a hundred-metre featureless gap between the two elevated
  // neighborhoods. Its endpoints meet the authored local streets exactly, so
  // navigation, rendered paving and the authoritative walkable surface all
  // describe the same continuous route.
  { id:"south-transfer-bridge", from:{x:45,y:3.6,z:-415}, to:{x:160,y:4.1,z:-400}, width:9, color:"#33485d",kind:"arterial" },
  // A freight boulevard carries rotations through the cargo district instead
  // of making Cargo Spur and Dock Service face one another across a bare deck.
  // The shallow diagonal preserves both loading yards and leaves shoulder
  // space for combat cover without narrowing the vehicle-scale carriageway.
  { id:"south-freight-boulevard", from:{x:125,y:.1,z:-285}, to:{x:255,y:.1,z:-275}, width:9, color:"#453f45",kind:"arterial" },
  // The southeast freight districts form an industrial triangle: Dock
  // Service reaches Engine Gate at deck level while elevated East Freight
  // receives its own descending haul route into the same gate.
  { id:"dock-engine-link-west", from:{x:315,y:.1,z:-275}, to:{x:340,y:.1,z:-275}, width:8, color:"#493f3a",kind:"arterial" },
  { id:"dock-engine-link-east", from:{x:340,y:.1,z:-275}, to:{x:340,y:.1,z:-180}, width:8, color:"#493f3a",kind:"arterial" },
  { id:"dock-engine-link-gate", from:{x:340,y:.1,z:-180}, to:{x:375,y:.1,z:-180}, width:8, color:"#493f3a",kind:"arterial" },
  { id:"east-freight-engine-deck", from:{x:360,y:8.1,z:-315}, to:{x:375,y:8.1,z:-315}, width:9, color:"#4e433c",kind:"arterial" },
  // Keep the first leg level beside the freight shell, then descend on a
  // shorter grade. Besides reading as a proper loading viaduct, this keeps
  // the entire ramp comfortably traversable within the controller's bounded
  // service-road traversal budget.
  { id:"east-freight-engine-deck-turn", from:{x:375,y:8.1,z:-315}, to:{x:375,y:8.1,z:-285}, width:9, color:"#4e433c",kind:"arterial" },
  { id:"east-freight-engine-grade", from:{x:375,y:8.1,z:-285}, to:{x:405,y:.1,z:-207}, width:9, color:"#4e433c",kind:"arterial" },
  { id:"ring-s-rise", from:{x:112,y:.08,z:-340}, to:{x:112,y:.08,z:-225}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-se-south", from:{x:112,y:.08,z:-225}, to:{x:275,y:.08,z:-225}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-se-east", from:{x:275,y:.08,z:-225}, to:{x:275,y:.08,z:-130}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-thruster-south", from:{x:275,y:.08,z:-130}, to:{x:430,y:.08,z:-130}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-thruster-east", from:{x:430,y:.08,z:-130}, to:{x:430,y:.08,z:40}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-helios-south", from:{x:430,y:.08,z:40}, to:{x:345,y:.08,z:40}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-helios-east", from:{x:345,y:.08,z:40}, to:{x:345,y:.08,z:155}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-ne", from:{x:345,y:.08,z:155}, to:{x:225,y:.08,z:224}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-north-east", from:{x:225,y:.08,z:224}, to:{x:225,y:.08,z:372}, width:15, color:"#293b58",kind:"arterial" },
  { id:"ring-n", from:{x:225,y:.08,z:372}, to:{x:-185,y:.08,z:358}, width:15, color:"#293b58",kind:"arterial" },
  // The north rim's garden and mall districts share a direct promenade. This
  // closes their local-street loop and gives the broad observation deck a
  // legible pedestrian edge instead of leaving it as undefined gray space.
  { id:"north-garden-promenade", from:{x:-75,y:.1,z:405}, to:{x:-175,y:.1,z:365}, width:7, color:"#35514f",kind:"arterial" },
  // The outer half of the garden loop turns the broad north observation deck
  // into a deliberate public promenade while preserving a safe rim apron.
  { id:"north-skywalk-west", from:{x:-205,y:.1,z:392}, to:{x:-160,y:.1,z:430}, width:7, color:"#35514f",kind:"arterial" },
  { id:"north-skywalk-east", from:{x:-160,y:.1,z:430}, to:{x:-75,y:.1,z:405}, width:7, color:"#35514f",kind:"arterial" },
  { id:"solar-rim-deck-link", from:{x:105,y:4.1,z:415}, to:{x:135,y:4.1,z:405}, width:8, color:"#3b5049",kind:"arterial" },
  { id:"solar-rim-grade", from:{x:135,y:4.1,z:405}, to:{x:225,y:.1,z:372}, width:8, color:"#3b5049",kind:"arterial" },
  // The outer solar service block has a real ground-floor arrival, not an
  // apron-generated road suspended across its entrances. Its access grade
  // holds beyond the full ring shoulder before descending into the block.
  { id:"solar-service-access",from:{x:225,y:.1,z:372},to:{x:225,y:.1,z:400},width:8,color:"#3b5049",kind:"arterial" },
  { id:"solar-service-arrival",from:{x:225,y:.1,z:400},to:{x:180,y:.1,z:400},width:8,color:"#3b5049",kind:"arterial" },
  // The Nova/Zero feeder follows the neighborhood street below, rather than
  // cutting a highway-width diagonal across its ground-level shop frontage.
  { id:"radial-0", from:{x:-70,y:.1,z:-58}, to:{x:-92,y:5.1,z:-82}, width:8, color:"#304766",kind:"arterial" },
  { id:"radial-1", from:{x:72,y:.09,z:-58}, to:{x:112,y:.09,z:-225}, width:13, color:"#304766",kind:"arterial" },
  // Fixed service neighborhood replaces the diagonal across the central/right
  // void. Its street enters the lower court, serves facing storefronts and
  // climbs out toward Helios and the agricultural boulevard.
  {id:"radial-2",from:{x:70,y:.1,z:58},to:{x:137.5,y:.1,z:58},width:10,color:"#304766",kind:"arterial"},
  {id:"transit-court-main",from:{x:137.5,y:.1,z:58},to:{x:137.5,y:.1,z:145},width:10,color:"#304766",kind:"local"},
  {id:"transit-court-north-link",from:{x:137.5,y:.1,z:145},to:{x:190,y:.1,z:166},width:10,color:"#304766",kind:"arterial"},
  // Descend onto the transfer block before crossing it. A single long bridge
  // previously bypassed this entire space above an undefined empty underpass.
  // Finish the incline before the local arrival junction. The full-width
  // sloping ribbon must not cross a level side street at a different height.
  {id:"transit-farm-boulevard",from:{x:190,y:.1,z:166},to:{x:194,y:4.1,z:178},width:13,color:"#304766",kind:"arterial"},
  {id:"transit-farm-boulevard-entry",from:{x:194,y:4.1,z:178},to:{x:201,y:4.1,z:184},width:13,color:"#304766",kind:"arterial"},
  {id:"transit-farm-boulevard-middle",from:{x:201,y:4.1,z:184},to:{x:215,y:4.1,z:208},width:13,color:"#304766",kind:"arterial"},
  {id:"transit-farm-boulevard-farm",from:{x:215,y:4.1,z:208},to:{x:225,y:4.1,z:224},width:13,color:"#304766",kind:"arterial"},
  // Exit the basin at its northern gate before climbing to the power deck.
  // A direct east exit would put a 9m rise across the 5m gap between decks.
  {id:"transit-helios-entry",from:{x:190,y:.1,z:166},to:{x:185,y:.1,z:93},width:8,color:"#304766",kind:"local"},
  { id:"zero-coolant-avenue", from:{x:70,y:.1,z:58}, to:{x:80,y:.1,z:153}, width:8, color:"#304a58",kind:"arterial" },
  { id:"radial-3", from:{x:-70,y:.09,z:58}, to:{x:-190,y:.09,z:154}, width:13, color:"#304766",kind:"arterial" }
];

const BR_PRIMARY_DISTRICT_ROADS:readonly BrRoadSegment[]=[

  // Primary districts use continuous circulation rather than isolated access
  // spurs. These authored loops follow the actual building blocks and join the
  // island collectors at two or more points, so a road visibly enters, serves,
  // and exits each POI. Landmark cores remain pedestrian spaces inside them.
  { id:"zero-circulation-s", from:{x:-70,y:.1,z:-58}, to:{x:70,y:.1,z:-58}, width:11, color:"#304d69",kind:"arterial" },
  { id:"zero-circulation-e", from:{x:70,y:.1,z:-58}, to:{x:70,y:.1,z:58}, width:11, color:"#304d69",kind:"arterial" },
  { id:"zero-circulation-n", from:{x:70,y:.1,z:58}, to:{x:-70,y:.1,z:58}, width:11, color:"#304d69",kind:"arterial" },
  { id:"zero-circulation-w", from:{x:-70,y:.1,z:58}, to:{x:-70,y:.1,z:-58}, width:11, color:"#304d69",kind:"arterial" },

  // Put the north ring fully ON Nova's raised deck. Its former z=-48 center
  // bridged beyond the retaining edge and blocked the neighborhood approach.
  { id:"nova-circulation-w", from:{x:-254,y:.1,z:-215}, to:{x:-254,y:.1,z:-56}, width:11, color:"#3b3558",kind:"arterial" },
  { id:"nova-circulation-n", from:{x:-255,y:.1,z:-56}, to:{x:-92,y:.1,z:-56}, width:11, color:"#3b3558",kind:"arterial" },
  { id:"nova-circulation-ne", from:{x:-92,y:.1,z:-56}, to:{x:-92,y:.1,z:-60}, width:11, color:"#3b3558",kind:"arterial" },
  { id:"nova-street-a-west", from:{x:-254,y:.11,z:-135}, to:{x:-175,y:.11,z:-135}, width:12, color:"#44385e",kind:"arterial" },
  { id:"nova-street-a-east", from:{x:-175,y:.11,z:-135}, to:{x:-92,y:.11,z:-135}, width:12, color:"#44385e",kind:"arterial" },
  { id:"nova-street-b-south", from:{x:-175,y:.11,z:-215}, to:{x:-175,y:.11,z:-135}, width:12, color:"#44385e",kind:"arterial" },
  { id:"nova-street-b-north", from:{x:-175,y:.11,z:-135}, to:{x:-175,y:.11,z:-48}, width:12, color:"#44385e",kind:"arterial" },

  { id:"dock-circulation-w", from:{x:112,y:.1,z:-225}, to:{x:112,y:.1,z:-70}, width:12, color:"#443a32",kind:"arterial" },
  { id:"dock-circulation-n", from:{x:112,y:.1,z:-70}, to:{x:275,y:.1,z:-70}, width:12, color:"#443a32",kind:"arterial" },
  { id:"dock-circulation-e", from:{x:275,y:.1,z:-70}, to:{x:275,y:.1,z:-130}, width:12, color:"#443a32",kind:"arterial" },

  { id:"helios-circulation-w", from:{x:185,y:.1,z:40}, to:{x:185,y:.1,z:155}, width:11, color:"#4c482e",kind:"arterial" },
  { id:"helios-circulation-n", from:{x:185,y:.1,z:155}, to:{x:345,y:.1,z:155}, width:11, color:"#4c482e",kind:"arterial" },
  { id:"helios-circulation-s", from:{x:345,y:.1,z:40}, to:{x:185,y:.1,z:40}, width:11, color:"#4c482e",kind:"arterial" },

  { id:"astra-circulation-w", from:{x:-365,y:.1,z:25}, to:{x:-365,y:.1,z:150}, width:10, color:"#393650",kind:"arterial" },
  { id:"astra-circulation-n", from:{x:-365,y:.1,z:150}, to:{x:-195,y:.1,z:150}, width:10, color:"#393650",kind:"arterial" },
  { id:"astra-circulation-e", from:{x:-195,y:.1,z:150}, to:{x:-195,y:.1,z:25}, width:10, color:"#393650",kind:"arterial" },
  { id:"astra-circulation-s", from:{x:-195,y:.1,z:25}, to:{x:-365,y:.1,z:25}, width:10, color:"#393650",kind:"arterial" },
  { id:"astra-circulation-link", from:{x:-195,y:.1,z:150}, to:{x:-190,y:.1,z:154}, width:10, color:"#393650",kind:"arterial" },

  { id:"mall-circulation-s", from:{x:-180,y:.1,z:190}, to:{x:-5,y:.1,z:190}, width:11, color:"#41314f",kind:"arterial" },
  { id:"mall-circulation-e", from:{x:-5,y:.1,z:190}, to:{x:-5,y:.1,z:345}, width:11, color:"#41314f",kind:"arterial" },
  { id:"mall-circulation-n", from:{x:-5,y:.1,z:345}, to:{x:-180,y:.1,z:345}, width:11, color:"#41314f",kind:"arterial" },
  { id:"mall-circulation-w", from:{x:-180,y:.1,z:345}, to:{x:-180,y:.1,z:190}, width:11, color:"#41314f",kind:"arterial" },
  { id:"mall-circulation-link", from:{x:-180,y:.1,z:190}, to:{x:-189.12,y:.1,z:190}, width:11, color:"#41314f",kind:"arterial" },

  { id:"farm-circulation-w", from:{x:40,y:.1,z:220}, to:{x:40,y:.1,z:360}, width:9, color:"#304b43",kind:"arterial" },
  { id:"farm-circulation-s", from:{x:40,y:.1,z:220}, to:{x:225,y:.1,z:220}, width:9, color:"#304b43",kind:"arterial" },
  { id:"farm-circulation-n", from:{x:40,y:.1,z:360}, to:{x:225,y:.1,z:360}, width:9, color:"#304b43",kind:"arterial" },

  { id:"crash-circulation-w", from:{x:-390,y:.1,z:-195}, to:{x:-390,y:.1,z:-245}, width:10, color:"#43343b",kind:"arterial" },
  { id:"crash-circulation-w-drop", from:{x:-390,y:.1,z:-245}, to:{x:-365,y:.1,z:-325}, width:10, color:"#43343b",kind:"arterial" },
  { id:"crash-circulation-n", from:{x:-390,y:.1,z:-195}, to:{x:-258,y:.1,z:-195}, width:10, color:"#43343b",kind:"arterial" },
  { id:"crash-circulation-e", from:{x:-258,y:.1,z:-195}, to:{x:-258,y:.1,z:-325}, width:10, color:"#43343b",kind:"arterial" },
  { id:"crash-circulation-s", from:{x:-258,y:.1,z:-325}, to:{x:-365,y:.1,z:-325}, width:10, color:"#43343b",kind:"arterial" },
  { id:"crash-circulation-link", from:{x:-258,y:.1,z:-260}, to:{x:-254,y:.1,z:-260}, width:10, color:"#43343b",kind:"arterial" },

  { id:"thruster-circulation-w", from:{x:270,y:.1,z:-130}, to:{x:270,y:.1,z:15}, width:11, color:"#303d50",kind:"arterial" },
  { id:"thruster-circulation-n", from:{x:270,y:.1,z:15}, to:{x:430,y:.1,z:15}, width:11, color:"#303d50",kind:"arterial" },
  { id:"thruster-circulation-link", from:{x:270,y:.1,z:-130}, to:{x:275,y:.1,z:-130}, width:11, color:"#303d50",kind:"arterial" }
];
const pointSegmentDistance=(point:Vec3,from:Vec3,to:Vec3):number=>{
  const dx=to.x-from.x,dz=to.z-from.z,denominator=dx*dx+dz*dz;
  const amount=denominator<=1e-8?0:Math.max(0,Math.min(1,((point.x-from.x)*dx+(point.z-from.z)*dz)/denominator));
  return Math.hypot(point.x-(from.x+dx*amount),point.z-(from.z+dz*amount));
};
const BR_ROOF_RAMP_WIDTH=3;

const inferArchetype=(id:string,style:BrDistrictStyle,height:number):BrStructureArchetype=>id.includes("hangar")?"hangar":id.includes("hotel")?"hotel":id.includes("market")||id.includes("cafe")||id.includes("arcade")?"shop":id.includes("tower")||height>20?"tower":style==="farm"?"greenhouse":style==="academy"?"academy":style==="mall"?"mall":style==="dock"?"warehouse":style==="reactor"||style==="industrial"?"industrial":style==="wreck"?"utility":"office";
const S = (id: string, districtId: string, x: number, z: number, w: number, d: number, h: number, color: string, style: BrDistrictStyle, floors: 1 | 2 | 3 = 1, entrance: BrStructure["entrance"] = "south", roofAccess = false, enterable=true, archetype?:BrStructureArchetype,roofAccessSide?:BrStructure["roofAccessSide"],roofAccessOffset?:number): BrStructure => ({
  id, districtId, position: { x, y: brAuthoredDeckHeight({x,z}), z }, size: { x: w, y: h, z: d }, color, style, floors, entrance, roofAccess, roofAccessSide, roofAccessOffset, enterable, archetype:archetype??inferArchetype(id,style,h)
});

/** 62 authored structures with different footprints and district identities. */
const PRIMARY_BR_STRUCTURES: readonly BrStructure[] = [
  S("zero-spire","zero-point",0,0,28,28,36,"#70f5ff","nexus",3,"south",false),
  S("zero-control","zero-point",-38,-9,30,20,8,"#4ed3ff","nexus",2,"east",true,true,undefined,"north"),
  S("zero-relay","zero-point",38,12,24,18,7,"#72a7ff","nexus",2,"west",false),
  S("zero-archive","zero-point",2,43,34,18,6,"#4c86c8","nexus",1,"south"),
  S("nova-tower-a","nova-plaza",-210,-172,27,28,34,"#ff6bba","city",3,"east",false),
  S("nova-tower-b","nova-plaza",-140,-172,25,26,27,"#ff8bd0","city",3,"west",false),
  S("nova-cafe","nova-plaza",-220,-104,31,20,6,"#ba4f9a","city",1,"south"),
  S("nova-studio","nova-plaza",-150,-103,34,22,9,"#c65fb1","city",2,"south",true,true,undefined,"north"),
  S("nova-kiosk","nova-plaza",-190,-105,14,12,4,"#ffc2e8","city",1,"south"),
  S("dock-hangar","dockyard-7",190,-174,52,34,11,"#d97b37","dock",2,"south",false),
  S("dock-office","dockyard-7",150,-130,26,20,8,"#ffb347","dock",2,"east",true),
  S("dock-warehouse","dockyard-7",230,-129,38,24,7,"#bd6f38","dock",1,"west"),
  S("dock-customs","dockyard-7",191,-105,25,18,5,"#f2a65a","dock",1,"north"),
  S("helios-core","helios-reactor",262,78,34,34,42,"#ffd84d","reactor",3,"south",false),
  S("helios-turbine-a","helios-reactor",218,74,24,30,9,"#dc8c2d","reactor",2,"east"),
  S("helios-turbine-b","helios-reactor",306,74,24,30,9,"#dc8c2d","reactor",2,"west"),
  S("helios-control","helios-reactor",261,124,38,20,7,"#f7b43d","reactor",1,"north",true,true,undefined,"east"),
  S("astra-hall","astra-academy",-278,75,48,24,9,"#a88cff","academy",2,"south",true),
  S("astra-lab","astra-academy",-323,52,30,26,7,"#7e70ce","academy",2,"east"),
  S("astra-library","astra-academy",-233,52,30,26,7,"#927bdf","academy",2,"west"),
  S("astra-observatory","astra-academy",-278,119,28,24,26,"#beb1ff","academy",3,"north",false),
  S("void-anchor","void-mall",-93,263,64,34,18,"#c565ff","mall",2,"south",false),
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
  S("crash-engine","crash-site",-350,-294,24,22,8,"#e2654e","wreck",2,"north",true,true,undefined,"east"),
  S("thruster-foundry","thruster-works",342,-70,46,32,22,"#65b8ff","industrial",2,"south",false),
  S("thruster-pump-a","thruster-works",297,-98,27,25,8,"#3f78bd","industrial",2,"east"),
  S("thruster-pump-b","thruster-works",387,-98,27,25,8,"#3f78bd","industrial",2,"west"),
  S("thruster-control","thruster-works",342,-22,34,23,7,"#579edf","industrial",1,"north",true),
  S("thruster-depot","thruster-works",392,-43,26,24,6,"#395e91","industrial",1,"west"),
  S("mid-transit-west","zero-point",-92,-22,31,18,5,"#3c557c","nexus",1,"east"),
  S("mid-transit-east","zero-point",95,24,31,18,5,"#3c557c","nexus",1,"west"),
  S("south-relay","dockyard-7",35,-255,28,22,7,"#47608a","dock",2,"north",true),
  S("zero-gallery","zero-point",-48,35,25,19,7,"#3b9fca","nexus",2,"east",false),
  S("zero-works","zero-point",48,-31,29,20,8,"#28799e","nexus",2,"west",false),
  S("nova-arcade","nova-plaza",-232,-73,27,22,9,"#d45bac","city",2,"south",false),
  // Separate actual parcels, not just their decorative shells. The old hotel
  // overlapped Tower B by 100m²; its shallower southern frontage now keeps an
  // alley behind the tower and stays clear of the south circulation road.
  S("nova-hotel","nova-plaza",-128,-197,24,18,24,"#f078c2","city",3,"west",false),
  // The old shop occupied 189m² of the enterable studio. Separate the two
  // frontages with an 8m alley, preserving the studio's full interior and the
  // market's depth; the compact shop now faces the east circulation road.
  S("nova-market","nova-plaza",-114,-106,22,20,7,"#a83f88","city",1,"east"),
  S("dock-freight-a","dockyard-7",247,-188,29,23,8,"#c56c32","dock",2,"west",false),
  S("dock-freight-b","dockyard-7",136,-190,31,22,7,"#e0924b","dock",1,"east"),
  S("dock-tower","dockyard-7",224,-90,20,18,19,"#f3a253","dock",3,"south",false),
  S("helios-annex","helios-reactor",315,126,28,22,9,"#c98a2e","reactor",2,"west",false),
  S("helios-storage","helios-reactor",211,126,29,22,7,"#a86d26","reactor",1,"east"),
  S("astra-student-hall","astra-academy",-338,105,29,24,10,"#8073c8","academy",2,"east",false),
  S("astra-workshop","astra-academy",-218,105,30,22,8,"#9684de","academy",2,"west",false),
  S("void-food-court","void-mall",-151,320,34,22,8,"#8840b5","mall",2,"east",true,true,undefined,"south"),
  S("void-market","void-mall",-35,319,34,22,8,"#a953d0","mall",2,"west",false),
  S("void-station","void-mall",-92,214,36,20,9,"#6f369a","mall",2,"north",false),
  S("farm-greenhouse-c","orbital-farms",193,328,36,27,8,"#58ca87","farm",1,"west"),
  S("farm-silo","orbital-farms",66,263,22,22,16,"#47b77a","farm",3,"east",false),
  S("crash-medbay","crash-site",-330,-215,28,22,8,"#b94d55","wreck",2,"east",false),
  S("crash-salvage","crash-site",-282,-301,29,23,7,"#99404b","wreck",1,"west"),
  S("thruster-assembly","thruster-works",400,-15,31,24,10,"#4f8bd0","industrial",2,"west",false),
  S("thruster-cooling","thruster-works",300,-28,31,24,9,"#477cb8","industrial",2,"east",false),
  S("transit-cafe","transit-court",110,76,18,15,6,"#63bcd4","city",1,"east",false,true,"shop"),
  S("transit-service-store","transit-court",110,112,18,18,7,"#63bcd4","city",1,"east",false,true,"shop"),
  S("transit-ticket-hall","transit-court",161,72,20,16,8,"#63bcd4","nexus",2,"west",false,true,"transit"),
  S("transit-maintenance","transit-court",161,115,20,18,7,"#63bcd4","industrial",1,"west",false,true,"utility"),
  // Four corners face the south avenue. The ring road remains a clear through
  // route between the northern storefronts and the southern service court.
  S("south-exchange-cafe","south-exchange",-100,-314,22,22,6,"#d69bb8","city",1,"east",false,true,"shop"),
  S("south-exchange-office","south-exchange",-52,-314,22,22,9,"#85afcd","city",2,"west",false,true,"office"),
  S("south-exchange-market","south-exchange",-100,-378,22,20,7,"#d69bb8","city",1,"east",false,true,"shop"),
  S("south-exchange-service","south-exchange",-52,-378,22,20,6,"#85afcd","nexus",1,"west",false,true,"utility"),
  S("transfer-logistics","farm-transfer",170,184,18,14,7,"#79beb3","dock",1,"east",false,true,"warehouse"),
  S("transfer-canteen","farm-transfer",170,203,18,14,6,"#79beb3","city",1,"east",false,true,"shop"),
  S("transfer-control","farm-transfer",228,184,18,14,9,"#79beb3","city",2,"west",false,true,"office"),
  // The compact service annex faces the Farms circulation road, not the
  // narrowing wedge between the boulevard and the northeast ring.
  S("transfer-maintenance","farm-transfer",149,205,10,16,7,"#79beb3","industrial",1,"north",false,true,"utility")
];

/** Fixed connective-district topology. These arrays are intentionally verbose:
 * they are map data, not runtime urban-design algorithms. */
const BR_SERVICE_ROADS:readonly BrRoadSegment[]=AUTHORED_BR_SERVICE_ROADS.flatMap(road=>{
  const access=AUTHORED_BR_ELEVATED_ACCESS.get(road.id);
  if(!access)return [road];
  const elevation=AUTHORED_BR_DISTRICT_ELEVATIONS.get(access.districtId)??0;
  const deckY=elevation+.1;
  return [
    {...road,id:`${road.id}-deck`,from:{...road.from,y:deckY},to:{...access.edge,y:deckY}},
    {...road,id:`${road.id}-grade`,from:{...access.edge,y:deckY},to:{...road.to}}
  ];
});
export const BR_DISTRICT_PLANS:readonly BrDistrictPlan[]=[...AUTHORED_BR_SPATIAL_PLANS.map(plan=>({...plan,parcels:plan.parcels.map(parcel=>({...parcel,position:{...parcel.position,y:brAuthoredDeckHeight(parcel.position)||parcel.position.y}}))})),{
  id:"transit-court",origin:{x:137.5,y:-3,z:92.5},elevation:-3,kind:"commercial",approach:{x:137.5,y:0,z:145},
  streets:[{id:"transit-court-service",from:{x:137.5,y:-2.9,z:64},to:{x:137.5,y:-2.9,z:123},width:10,color:"#304766",kind:"local"},{id:"transit-court-crosswalk",from:{x:120,y:-2.9,z:93},to:{x:137.5,y:-2.9,z:93},width:6,color:"#304766",kind:"local",intentionalTerminus:true}],
  parcels:[{id:"transit-cafe",position:{x:110,y:-3,z:76},entrance:"east",role:"anchor"},{id:"transit-service-store",position:{x:110,y:-3,z:112},entrance:"east",role:"support"},{id:"transit-ticket-hall",position:{x:161,y:-3,z:72},entrance:"west",role:"anchor"},{id:"transit-maintenance",position:{x:161,y:-3,z:115},entrance:"west",role:"service"}],
  openZone:{position:{x:122,y:-3,z:95},radius:3,purpose:"courtyard"}
},{
  id:"south-exchange",origin:{x:-76,y:0,z:-357},elevation:0,kind:"commercial",approach:{x:-76,y:0,z:-340},
  streets:[
    {id:"south-exchange-main",from:{x:-76,y:.1,z:-310},to:{x:-76,y:.1,z:-390},width:8,color:"#41404f",kind:"local",intentionalTerminus:true},
    {id:"south-exchange-court",from:{x:-110,y:.1,z:-357},to:{x:-42,y:.1,z:-357},width:7,color:"#41404f",kind:"local",intentionalTerminus:true}
  ],
  parcels:[
    {id:"south-exchange-cafe",position:{x:-100,y:0,z:-314},entrance:"east",role:"anchor"},
    {id:"south-exchange-office",position:{x:-52,y:0,z:-314},entrance:"west",role:"support"},
    {id:"south-exchange-market",position:{x:-100,y:0,z:-378},entrance:"east",role:"support"},
    {id:"south-exchange-service",position:{x:-52,y:0,z:-378},entrance:"west",role:"service"}
  ],
  openZone:{position:{x:-124,y:0,z:-357},radius:4,purpose:"courtyard"}
},{
  id:"farm-transfer",origin:{x:189,y:4,z:196},elevation:4,kind:"workyard",approach:{x:208,y:4,z:196},
  streets:[
    {id:"farm-transfer-main",from:{x:189,y:4.1,z:184},to:{x:189,y:4.1,z:220},width:8,color:"#304b43",kind:"local"},
    {id:"farm-transfer-arrival",from:{x:189,y:4.1,z:184},to:{x:201,y:4.1,z:184},width:8,color:"#304b43",kind:"local"},
    {id:"farm-transfer-cross",from:{x:189,y:4.1,z:196},to:{x:208,y:4.1,z:196},width:7,color:"#304b43",kind:"local"}
  ],
  parcels:[
    {id:"transfer-logistics",position:{x:170,y:4,z:184},entrance:"east",role:"anchor"},
    {id:"transfer-canteen",position:{x:170,y:4,z:203},entrance:"east",role:"support"},
    {id:"transfer-control",position:{x:228,y:4,z:184},entrance:"west",role:"support"},
    {id:"transfer-maintenance",position:{x:149,y:4,z:205},entrance:"north",role:"service"}
  ],
  openZone:{position:{x:155,y:4,z:191},radius:3,purpose:"yard"}
},{
  // The outline tapers here: three facing parcels form a service street;
  // a rectangular fourth southeast parcel would extend off the island.
  id:"solar-service",origin:{x:180,y:0,z:416},elevation:0,kind:"workyard",approach:{x:225,y:0,z:400},
  streets:[
    {id:"solar-service-main",from:{x:180,y:.1,z:400},to:{x:180,y:.1,z:436},width:8,color:"#3b5049",kind:"local",intentionalTerminus:true},
    {id:"solar-service-cross",from:{x:180,y:.1,z:400},to:{x:225,y:.1,z:400},width:8,color:"#3b5049",kind:"local"}
  ],
  parcels:[
    {id:"solar-service-1",position:{x:155,y:0,z:418},entrance:"east",role:"anchor"},
    {id:"solar-service-2",position:{x:205,y:0,z:414},entrance:"west",role:"support"},
    {id:"solar-service-3",position:{x:153,y:0,z:437},entrance:"east",role:"service"}
  ],
  openZone:{position:{x:191,y:0,z:433},radius:3,purpose:"yard"}
},{
  // The south ring already carries through traffic. Author facing parcels on
  // its corners instead of scattering cover across the 60m enclosure gap.
  id:"ring-service",origin:{x:-210,y:0,z:-340},elevation:0,kind:"workyard",approach:{x:-210,y:0,z:-290},
  streets:[
    {id:"ring-service-main",from:{x:-210,y:.1,z:-290},to:{x:-210,y:.1,z:-386},width:8,color:"#41404f",kind:"local",intentionalTerminus:true},
    {id:"ring-service-court",from:{x:-242,y:.1,z:-386},to:{x:-178,y:.1,z:-386},width:8,color:"#41404f",kind:"local",intentionalTerminus:true}
  ],
  parcels:[
    {id:"ring-service-shop",position:{x:-232,y:0,z:-315},entrance:"east",role:"anchor"},
    {id:"ring-service-office",position:{x:-188,y:0,z:-315},entrance:"west",role:"support"},
    {id:"ring-service-warehouse",position:{x:-232,y:0,z:-365},entrance:"east",role:"anchor"},
    {id:"ring-service-utility",position:{x:-188,y:0,z:-365},entrance:"west",role:"service"}
  ],
  openZone:{position:{x:-210,y:0,z:-386},radius:4,purpose:"yard"}
},{
  // Ground-floor commercial/service frontage joins the western collector.
  // The Nova climb starts east of this block, not through its doorways.
  id:"west-junction",origin:{x:-330,y:0,z:-128.71900826446281},elevation:0,kind:"commercial",approach:{x:-375,y:0,z:-125},
  streets:[
    {id:"west-junction-main",from:{x:-330,y:.1,z:-118},to:{x:-330,y:.1,z:-180},width:7,color:"#3b4058",kind:"local",intentionalTerminus:true},
    {id:"west-junction-shop-entry",from:{x:-330,y:.1,z:-118},to:{x:-312,y:.1,z:-118},width:7,color:"#3b4058",kind:"local",intentionalTerminus:true},
    {id:"west-junction-office-entry",from:{x:-330,y:.1,z:-142},to:{x:-294,y:.1,z:-142},width:7,color:"#3b4058",kind:"local",intentionalTerminus:true}
  ],
  parcels:[
    {id:"west-junction-shop",position:{x:-312,y:0,z:-103},entrance:"south",role:"anchor"},
    {id:"west-junction-office",position:{x:-294,y:0,z:-163},entrance:"north",role:"support"},
    {id:"west-junction-utility",position:{x:-352,y:0,z:-152},entrance:"east",role:"service"}
  ],
  openZone:{position:{x:-330,y:0,z:-180},radius:3,purpose:"yard"}
}];
// Horizon Homes is a lower street-front neighborhood, not an overpass. The
// broad Nova apron used to raise its main street 2.37m and its crossing 4.42m
// independently, leaving an overhead slab and a >2m step at the junction.
// Author its actual frontage first, then a grade up to Nova's +5m deck.
// Finish the grade outside the WHOLE 11m-wide upper ring, not at its center:
// otherwise a pilot meets the old ring's end cap halfway up the new ramp.
// The short feeder uses that same grade rather than an angled duplicate nub.
const fixedRoadProfiles=new Map<string,readonly Vec3[]>([
  ["west-transit-avenue",[{x:-375,y:.1,z:-125},{x:-330,y:.1,z:-128.71900826446281},{x:-300,y:.1,z:-131.19834710743802},{x:-262,y:5.1,z:-134.3388429752066},{x:-254,y:5.1,z:-135}]],
  ["west-junction-main",[{x:-330,y:.1,z:-118},{x:-330,y:.1,z:-128.71900826446281},{x:-330,y:.1,z:-142},{x:-330,y:.1,z:-180}]],
  ["west-junction-shop-entry",[{x:-330,y:.1,z:-118},{x:-312,y:.1,z:-118}]],
  ["west-junction-office-entry",[{x:-330,y:.1,z:-142},{x:-294,y:.1,z:-142}]],
  // An internal/internal road crossing is invisible to the endpoint-based
  // navigation graph. Keep the exact same avenue footprint, but make the
  // real ring junction an explicit endpoint so all four branches connect.
  ["ring-service-main",[{x:-210,y:.1,z:-290},{x:-210,y:.1,z:-340},{x:-210,y:.1,z:-386}]],
  ["solar-service-access",[{x:225,y:3.6555555555555554,z:372},{x:225,y:3.6555555555555554,z:380},{x:225,y:.1,z:397},{x:225,y:.1,z:400}]],
  ["solar-service-arrival",[{x:225,y:.1,z:400},{x:180,y:.1,z:400}]],
  ["solar-service-main",[{x:180,y:.1,z:400},{x:180,y:.1,z:436}]],
  ["solar-service-cross",[{x:180,y:.1,z:400},{x:225,y:.1,z:400}]],
  ["service-33",[{x:180,y:.1,z:416},{x:180,y:.1,z:400}]],
  // West Overlook serves ground-floor shops outside the Academy retaining
  // wall. The campus apron used to suspend its cross street 1.83m above the
  // doorway and independently tilt the main street across that junction.
  ["west-overlook-main",[{x:-435,y:.1,z:15},{x:-375,y:.1,z:15}]],
  ["west-overlook-cross",[{x:-405,y:.1,z:-12},{x:-405,y:.1,z:42}]],
  ["service-5",[{x:-405,y:.1,z:15},{x:-430,y:.1,z:15}]],
  ["horizon-homes-main",[{x:-285,y:.1,z:-30},{x:-225,y:.1,z:-30}]],
  ["horizon-homes-cross",[{x:-255,y:5.1,z:-57},{x:-255,y:5.1,z:-50},{x:-255,y:.1,z:-36},{x:-255,y:.1,z:-3}]],
  ["service-3",[{x:-255,y:.1,z:-30},{x:-255,y:.1,z:-36},{x:-255,y:5.1,z:-50},{x:-255,y:5.1,z:-56}]],
  ["west-neighborhood-link-a",[{x:-285,y:.1,z:-30},{x:-350,y:.1,z:-105}]],
  // Central Heights is a split-level neighborhood: the service building sits
  // on Nova, while its apartment/shop entrances face a ground-level street.
  // Hold the upper approach past the FULL east-ring edge (-84.5), then grade
  // outside the solid deck and finish before the cross street's west edge.
  // Its feeder and radial use this same ramp, not two independent apron planes.
  ["central-heights-main",[{x:-105,y:5.1,z:-82},{x:-84,y:5.1,z:-82},{x:-69,y:.1,z:-82},{x:-45,y:.1,z:-82}]],
  ["central-heights-cross",[{x:-65,y:.1,z:-109},{x:-65,y:.1,z:-33}]],
  ["service-0",[{x:-65,y:.1,z:-82},{x:-69,y:.1,z:-82},{x:-84,y:5.1,z:-82},{x:-92,y:5.1,z:-82}]],
  ["radial-0",[{x:-70,y:.1,z:-58},{x:-65,y:.1,z:-58},{x:-65,y:.1,z:-82},{x:-69,y:.1,z:-82},{x:-84,y:5.1,z:-82},{x:-92,y:5.1,z:-82}]],
  // Zero's civic streets serve ground-level buildings. Nova's apron must not
  // turn them into inaccessible overhead slabs or tilt one side of a junction.
  ["zero-circulation-s",[{x:-70,y:.1,z:-58},{x:70,y:.1,z:-58}]],
  ["zero-circulation-w",[{x:-70,y:.1,z:58},{x:-70,y:.1,z:-58}]],
  // Comet's entrance is below Nova. The old apron raised a road through its
  // doorway, and the independently graded civic feeder met a different plane.
  // Keep the whole frontage/through route level; only its west access climbs.
  ["comet-hotel-main",[{x:-106,y:5.1,z:-214},{x:-84,y:5.1,z:-214},{x:-69,y:.1,z:-214},{x:-46,y:.1,z:-214}]],
  ["comet-hotel-cross",[{x:-65,y:.1,z:-241},{x:-65,y:.1,z:-187}]],
  ["service-2",[{x:-65,y:.1,z:-214},{x:-69,y:.1,z:-214},{x:-84,y:5.1,z:-214},{x:-92,y:5.1,z:-214}]],
  ["central-hotel-promenade",[{x:0,y:.1,z:-80},{x:-65,y:.1,z:-175}]],
  ["central-hotel-promenade-south",[{x:-65,y:.1,z:-175},{x:-65,y:.1,z:-214}]],
  ["central-hotel-promenade-entry",[{x:-65,y:.1,z:-214},{x:-46,y:.1,z:-214}]],
  // Rejoin the existing South Exchange avenue before its building parcels.
  ["hotel-south-avenue-entry",[{x:-65,y:.1,z:-241},{x:-65,y:.1,z:-270}]],
  ["hotel-south-avenue-link",[{x:-65,y:.1,z:-270},{x:-76,y:.1,z:-270}]],
  ["hotel-south-avenue",[{x:-76,y:.1,z:-270},{x:-76,y:.1,z:-340}]],
  // Security frontage is below the Academy approach bridge, not a continuation
  // of its apron. Both local streets meet the ground-level buildings. Route
  // the feeder around the shop to Zero's ground-level west junction,
  // instead of trying to climb onto the bridge through this small crossroads.
  ["central-security-main",[{x:-175,y:.1,z:85},{x:-115,y:.1,z:85}]],
  ["central-security-cross",[{x:-145,y:.1,z:58},{x:-145,y:.1,z:112}]],
  ["service-23",[{x:-145,y:.1,z:85},{x:-108,y:.1,z:85},{x:-108,y:.1,z:42},{x:-70,y:.1,z:42}]],
  // The dorm/park buildings are on the LOWER campus edge. Apron grading
  // previously put their street 7.67m overhead, with no supported frontage.
  // Keep their loop on the real floor and climb only on the two east accesses.
  // The upper landing extends beyond the full west circulation road (-370).
  ["academy-dorms-main",[{x:-400,y:.1,z:125},{x:-394,y:.1,z:125},{x:-372,y:8.1,z:125},{x:-340,y:8.1,z:125}]],
  ["academy-dorms-cross",[{x:-400,y:.1,z:123},{x:-400,y:.1,z:185}]],
  ["academy-dorms-north",[{x:-400,y:.1,z:185},{x:-369,y:.1,z:185}]],
  ["academy-dorms-frontage",[{x:-369,y:.1,z:185},{x:-369,y:.1,z:159}]],
  ["service-4",[{x:-400,y:.1,z:125},{x:-394,y:.1,z:125},{x:-372,y:8.1,z:125},{x:-365,y:8.1,z:125}]],
  ["west-park-main",[{x:-430,y:.1,z:150},{x:-394,y:.1,z:150},{x:-372,y:8.1,z:150},{x:-365,y:8.1,z:150}]],
  ["west-park-cross",[{x:-400,y:.1,z:123},{x:-400,y:.1,z:177}]],
  ["service-21",[{x:-400,y:.1,z:150},{x:-422.92452830188677,y:.1,z:162.73584905660377}]]
]);

export const BR_ROADS: readonly BrRoadSegment[] = brJoinServiceGrades([
  ...BR_ARTERIAL_ROADS,
  ...BR_PRIMARY_DISTRICT_ROADS,
  ...BR_SERVICE_ROADS,
  {id:"service-30",from:{x:137.5,y:.1,z:145},to:{x:190,y:.1,z:166},width:10,color:"#304766",kind:"service" as const},
  {id:"service-31",from:{x:-76,y:.1,z:-357},to:{x:-76,y:.1,z:-340},width:8,color:"#41404f",kind:"service" as const},
  {id:"service-32",from:{x:189,y:4.1,z:196},to:{x:208,y:4.1,z:196},width:7,color:"#304b43",kind:"service" as const},
  {id:"service-33",from:{x:180,y:.1,z:416},to:{x:180,y:.1,z:400},width:8,color:"#3b5049",kind:"service" as const},
  ...BR_DISTRICT_PLANS.flatMap(plan=>plan.streets)
].map(road=>({...road,from:{...road.from,y:Math.round((road.from.y-.1)*10)/10+.1},to:{...road.to,y:Math.round((road.to.y-.1)*10)/10+.1}})).flatMap(road=>{
  const profile=fixedRoadProfiles.get(road.id);
  return profile?profile.slice(1).map((to,i)=>({...road,id:i===0?road.id:`${road.id}-grade-part-${i}`,from:profile[i],to})):brGradeAuthoredRoad(road);
}));

/** Topological routes retain authored identities/endpoints after subdivision
 * into walkable grade pieces. Useful for map review and connectivity checks;
 * collision/rendering/navigation continue to use BR_ROADS' exact pieces. */
export const BR_ROAD_ROUTES:readonly BrRoadSegment[]=(()=>{
  const routes=new Map<string,BrRoadSegment>();
  for(const road of BR_ROADS){const id=road.id.replace(/-grade-part-\d+$/,"");const existing=routes.get(id);if(existing)existing.to=road.to;else routes.set(id,{...road,id});}
  return [...routes.values()];
})();

/** Exact 2D segment-vs-expanded-AABB check used while authoring secondary
 * shells. Keeping it shared prevents a visible building from ever occupying
 * the same corridor as its authoritative road. */
export function brRoadIntersectsFootprint(road:BrRoadSegment,center:Vec3,size:Vec3,clearance=0):boolean {
  const pad=road.width/2+clearance;
  const bounds=[center.x-size.x/2-pad,center.x+size.x/2+pad,center.z-size.z/2-pad,center.z+size.z/2+pad] as const;
  let minimum=0,maximum=1;
  for(const [origin,delta,low,high] of [[road.from.x,road.to.x-road.from.x,bounds[0],bounds[1]],[road.from.z,road.to.z-road.from.z,bounds[2],bounds[3]]] as const){
    if(Math.abs(delta)<1e-8){if(origin<low||origin>high)return false;continue;}
    let near=(low-origin)/delta,far=(high-origin)/delta;if(near>far)[near,far]=[far,near];
    minimum=Math.max(minimum,near);maximum=Math.min(maximum,far);if(minimum>maximum)return false;
  }
  return true;
}

/** Fixed secondary buildings retain their authored parcels and support heights. */
const FIXED_SECONDARY_STRUCTURES:readonly BrStructure[]=AUTHORED_BR_SECONDARY_STRUCTURE_BLUEPRINTS.map(structure=>{
  const placement=AUTHORED_BR_STRUCTURE_PLACEMENTS.get(structure.id);
  if(!placement)throw new Error(`Missing fixed Orbital Isle placement for ${structure.id}`);
  return {...structure,position:{...placement.position,y:brAuthoredDeckHeight(placement.position)||placement.position.y},size:placement.size?{...structure.size,...placement.size}:structure.size,entrance:placement.entrance,roofAccess:false,roofAccessSide:undefined,roofAccessOffset:undefined};
});
// Append rather than inserting among existing structures: loot identity and
// the alternating lateral sockets in established buildings must stay stable.
const SOLAR_SERVICE_STRUCTURES:readonly BrStructure[]=[
  S("solar-service-1","solar-service",155,418,22,18,7,"#79bea1","city",1,"east",false,true,"shop"),
  S("solar-service-2","solar-service",205,414,22,16,9,"#81adc6","city",2,"west",false,true,"office"),
  S("solar-service-3","solar-service",153,437,20,14,6,"#79bea1","industrial",1,"east",false,true,"utility")
];
const SOUTH_RING_STRUCTURES:readonly BrStructure[]=[
  S("ring-service-shop","ring-service",-232,-315,20,20,6,"#b99878","city",1,"east",false,true,"shop"),
  S("ring-service-office","ring-service",-188,-315,20,18,9,"#85afcd","city",2,"west",false,true,"office"),
  S("ring-service-warehouse","ring-service",-232,-365,20,18,7,"#b99878","dock",1,"east",false,true,"warehouse"),
  S("ring-service-utility","ring-service",-188,-365,20,18,6,"#85afcd","industrial",1,"west",false,true,"utility")
];
const WEST_JUNCTION_STRUCTURES:readonly BrStructure[]=[
  S("west-junction-shop","west-junction",-312,-103,22,18,6,"#7bafc3","city",1,"south",false,true,"shop"),
  S("west-junction-office","west-junction",-294,-163,20,20,10,"#7bafc3","city",2,"north",false,true,"office"),
  S("west-junction-utility","west-junction",-352,-152,18,18,7,"#8ca7b6","industrial",1,"east",false,true,"utility")
];
export const BR_STRUCTURES:readonly BrStructure[]=[...PRIMARY_BR_STRUCTURES,...FIXED_SECONDARY_STRUCTURES,...SOLAR_SERVICE_STRUCTURES,...SOUTH_RING_STRUCTURES,...WEST_JUNCTION_STRUCTURES];

/** District surfaces and smaller landscape beds follow the authored deck levels. */
export const BR_TERRAIN_PATCHES: readonly BrTerrainPatch[] = [
  {id:"central-plaza",position:{x:0,y:.31,z:0},size:{x:122,y:.12,z:104},rotation:.12,color:"#284d69",kind:"plaza"},
  {id:"nova-streets",position:{x:-175,y:.3,z:-135},size:{x:142,y:.1,z:126},rotation:-.12,color:"#432b59",kind:"plaza"},
  {id:"dock-apron",position:{x:190,y:.3,z:-157},size:{x:154,y:.1,z:132},rotation:.05,color:"#574130",kind:"industrial"},
  {id:"helios-deck",position:{x:261,y:.3,z:83},size:{x:132,y:.1,z:136},rotation:-.08,color:"#554d2d",kind:"industrial"},
  {id:"astra-quad",position:{x:-278,y:.3,z:80},size:{x:140,y:.1,z:132},rotation:0,color:"#3d3659",kind:"plaza"},
  {id:"astra-library-lawn",position:{x:-278,y:.3,z:40},size:{x:38,y:.1,z:20},rotation:0,color:"#3d3659",kind:"park"},
  {id:"astra-west-garden",position:{x:-349,y:.3,z:78},size:{x:18,y:.1,z:32},rotation:0,color:"#3d3659",kind:"park"},
  {id:"astra-observation-lawn",position:{x:-278,y:.3,z:143},size:{x:45,y:.1,z:12},rotation:0,color:"#3d3659",kind:"park"},
  {id:"void-concourse",position:{x:-93,y:.3,z:268},size:{x:150,y:.1,z:128},rotation:0,color:"#432b5a",kind:"plaza"},
  {id:"farm-terrace",position:{x:128,y:.3,z:294},size:{x:162,y:.1,z:132},rotation:0,color:"#285546",kind:"plaza"},
  {id:"farm-crop-west",position:{x:56,y:.3,z:320},size:{x:16,y:.1,z:35},rotation:0,color:"#285546",kind:"park"},
  {id:"farm-crop-north",position:{x:114,y:.3,z:351},size:{x:50,y:.1,z:14},rotation:0,color:"#285546",kind:"park"},
  {id:"farm-crop-east",position:{x:188,y:.3,z:248},size:{x:32,y:.1,z:16},rotation:0,color:"#285546",kind:"park"},
  {id:"crash-basin",position:{x:-330,y:.3,z:-258},size:{x:132,y:.1,z:112},rotation:.18,color:"#493642",kind:"landing"},
  {id:"thruster-yard",position:{x:344,y:.3,z:-64},size:{x:144,y:.1,z:130},rotation:-.11,color:"#2a4058",kind:"industrial"},
  {id:"coolant-west",position:{x:-68,y:.32,z:106},size:{x:24,y:.08,z:118},rotation:.28,color:"#164e6d",kind:"coolant"},
  {id:"coolant-east",position:{x:99,y:.32,z:123},size:{x:20,y:.08,z:128},rotation:-.24,color:"#17607c",kind:"coolant"},
  {id:"south-landing",position:{x:20,y:.31,z:-300},size:{x:150,y:.1,z:70},rotation:.06,color:"#2f4862",kind:"landing"}
];

/** Fixed gameplay elevation in deliberately reserved civic/green spaces.
 * These are broad landscape terraces, not ad-hoc building roof ramps. */
export const BR_TERRACES:readonly BrTerrace[]=[
  ...BR_ELEVATION_REGIONS.filter(region=>region.height>0).map(region=>({id:region.id,districtId:region.districtId,position:{x:region.x,y:0,z:region.z},size:{x:region.width,z:region.depth},height:region.height,accessSide:"south" as const,gradedRoadAccess:true,color:"#4b6070"})),
  // Full secondary districts use one broad engineered deck and one explicit
  // service-road grade. Their structures, streets, loot and decoration all
  // share the same authored elevation.
  {id:"emergency-depot-deck",districtId:"emergency-depot",position:{x:-160,y:0,z:-420},size:{x:80,z:72},height:5.5,accessSide:"north",gradedRoadAccess:true,color:"#584248"},
  {id:"east-checkpoint-deck",districtId:"east-checkpoint",position:{x:355,y:0,z:250},size:{x:80,z:92},height:4.5,accessSide:"south",gradedRoadAccess:true,color:"#40586c"},
  {id:"solar-field-deck",districtId:"solar-field",position:{x:75,y:0,z:415},size:{x:80,z:72},height:4,accessSide:"south",gradedRoadAccess:true,color:"#36584d"},
  {id:"academy-commons-deck",districtId:"academy-commons",position:{x:-265,y:0,z:235},size:{x:70,z:66},height:5.5,accessSide:"east",gradedRoadAccess:true,color:"#625e82"},
  {id:"south-terminal-deck",districtId:"south-terminal",position:{x:15,y:0,z:-415},size:{x:70,z:66},height:3.5,accessSide:"north",gradedRoadAccess:true,color:"#405469"},
  {id:"south-shipworks-deck",districtId:"south-shipworks",position:{x:190,y:0,z:-400},size:{x:70,z:66},height:4,accessSide:"north",gradedRoadAccess:true,color:"#51483f"},
  {id:"east-freight-deck",districtId:"east-freight",position:{x:330,y:0,z:-315},size:{x:82,z:78},height:8,accessSide:"north",gradedRoadAccess:true,color:"#55483d"},
  {id:"east-rim-deck",districtId:"east-rim",position:{x:405,y:0,z:105},size:{x:86,z:70},height:6,accessSide:"west",gradedRoadAccess:true,color:"#405266"},
  {id:"zero-point-steps",districtId:"zero-point",position:{x:0,y:0,z:-30},size:{x:16,z:14},height:1.6,accessSide:"south",color:"#476b83"},
  {id:"astra-lab-court",districtId:"astra-academy",position:{x:-290,y:0,z:45},size:{x:16,z:14},height:2.8,accessSide:"north",color:"#706a9b"},
  {id:"academy-commons-garden",districtId:"academy-commons",position:{x:-206.5,y:0,z:255.9},size:{x:15,z:14},height:2.8,accessSide:"north",color:"#706a9b"},
  {id:"farm-irrigation-deck",districtId:"orbital-farms",position:{x:130,y:0,z:289},size:{x:16,z:14},height:2.2,accessSide:"west",color:"#42695a"},
  {id:"crash-salvage-platform",districtId:"crash-site",position:{x:-280,y:0,z:-260},size:{x:16,z:14},height:2.4,accessSide:"south",color:"#674b4c"}
];

type MutableNavNode={id:string;position:Vec3;neighbors:Set<string>};
const navKey=(point:Vec3)=>`${Math.round(point.x*100)/100}:${Math.round(point.y*100)/100}:${Math.round(point.z*100)/100}`;
const mutableNavNodes=new Map<string,MutableNavNode>();
const ensureNavNode=(point:Vec3):MutableNavNode=>{
  const id=`road-${navKey(point)}`;
  let node=mutableNavNodes.get(id);
  if(!node){node={id,position:{x:point.x,y:point.y+.2,z:point.z},neighbors:new Set()};mutableNavNodes.set(id,node);}
  return node;
};
const linkNavNodes=(first:MutableNavNode,second:MutableNavNode)=>{
  if(first.id===second.id)return;
  first.neighbors.add(second.id);second.neighbors.add(first.id);
};
for(const road of BR_ROADS)linkNavNodes(ensureNavNode(road.from),ensureNavNode(road.to));
// A service or local road frequently terminates on the middle of a longer
// arterial. Join that endpoint to both ends of the containing segment so bots
// follow the visible route rather than cutting directly across architecture.
for(const road of BR_ROADS)for(const endpoint of [road.from,road.to]){
  const endpointNode=ensureNavNode(endpoint);
  for(const other of BR_ROADS){
    if(other===road||pointSegmentDistance(endpoint,other.from,other.to)>.05)continue;
    linkNavNodes(endpointNode,ensureNavNode(other.from));
    linkNavNodes(endpointNode,ensureNavNode(other.to));
  }
}
export const BR_NAV_NODES: readonly BrNavNode[] = [...mutableNavNodes.values()].map(node=>({id:node.id,position:node.position,neighbors:[...node.neighbors]}));
const navNodesById=new Map(BR_NAV_NODES.map(node=>[node.id,node]));

/** Returns a road-network waypoint, keeping simple bots out of dense building footprints. */
export function brNextWaypoint(start:Vec3,target:Vec3):Vec3 {
  const closest=(point:Vec3)=>BR_NAV_NODES.reduce((best,node)=>Math.hypot(node.position.x-point.x,node.position.z-point.z)<Math.hypot(best.position.x-point.x,best.position.z-point.z)?node:best,BR_NAV_NODES[0]);
  const source=closest(start),destination=closest(target); if(source.id===destination.id)return target;
  const queue=[source.id],previous=new Map<string,string|null>([[source.id,null]]);
  while(queue.length){const current=queue.shift()!;if(current===destination.id)break;const node=navNodesById.get(current)!;for(const neighbor of node.neighbors)if(!previous.has(neighbor)){previous.set(neighbor,current);queue.push(neighbor);}}
  let step=destination.id,parent=previous.get(step);while(parent&&parent!==source.id){step=parent;parent=previous.get(step);}return {...(navNodesById.get(step)?.position??target)};
}

function structureBlocks(structure: BrStructure): BrMapBlock[] {
  const { x, y:baseY, z } = structure.position; const { x: width, z: depth, y: height } = structure.size;
  const wall = .65; const door = 4.8; const blocks: BrMapBlock[] = [];
  if(!structure.enterable)return[{id:`${structure.id}-solid`,districtId:structure.districtId,position:{x,y:baseY+height/2,z},size:{x:width,y:height,z:depth},color:structure.color,kind:"building"}];
  blocks.push({ id:`${structure.id}-floor`, districtId:structure.districtId, position:{x,y:baseY+.18,z}, size:{x:width,y:.36,z:depth}, color:"#17243b", kind:"platform" });
  for (let floor = 1; floor < structure.floors; floor++) {
    const floorHeight=height/structure.floors;const levelY=floor*floorHeight;const stairX=x+width*.27;const opening=Math.min(5.2,width*.22);
    const leftWidth=stairX-opening/2-(x-width/2);const rightWidth=x+width/2-(stairX+opening/2);
    if(leftWidth>.5)blocks.push({id:`${structure.id}-deck-${floor}-left`,districtId:structure.districtId,position:{x:x-width/2+leftWidth/2,y:baseY+levelY,z},size:{x:leftWidth,y:.35,z:depth},color:"#253554",kind:"platform"});
    if(rightWidth>.5)blocks.push({id:`${structure.id}-deck-${floor}-right`,districtId:structure.districtId,position:{x:stairX+opening/2+rightWidth/2,y:baseY+levelY,z},size:{x:rightWidth,y:.35,z:depth},color:"#253554",kind:"platform"});
    const rampLength=Math.max(6,Math.min(depth-3,floorHeight*2.6));const angle=Math.atan2(floorHeight,rampLength);
    blocks.push({id:`${structure.id}-stairs-${floor}`,districtId:structure.districtId,position:{x:stairX,y:baseY+levelY-floorHeight/2,z},size:{x:opening-.7,y:.32,z:Math.hypot(rampLength,floorHeight)},rotation:{x:angle,y:0,z:0},color:"#405978",kind:"ramp"});
    // Bridge only the upper-end margin of the stair opening. The old split
    // decks left a full-depth hole, so walking off the incline caused a fall.
    const landingDepth=(depth-rampLength)/2;
    blocks.push({id:`${structure.id}-deck-${floor}-landing`,districtId:structure.districtId,position:{x:stairX,y:baseY+levelY,z:z-depth/2+landingDepth/2},size:{x:opening,y:.35,z:landingDepth},color:"#253554",kind:"platform"});
  }
  blocks.push({ id:`${structure.id}-roof`, districtId:structure.districtId, position:{x,y:baseY+height,z}, size:{x:width,y:.42,z:depth}, color:structure.color, kind:"platform" });
  const addWall = (suffix:string,px:number,pz:number,sx:number,sz:number) => blocks.push({ id:`${structure.id}-${suffix}`, districtId:structure.districtId, position:{x:px,y:baseY+height/2,z:pz}, size:{x:sx,y:height,z:sz}, color:structure.color, kind:"wall" });
  if (structure.entrance === "north" || structure.entrance === "south") {
    addWall("west",x-width/2,z,wall,depth); addWall("east",x+width/2,z,wall,depth);
    const doorZ=structure.entrance==="north"?z+depth/2:z-depth/2; const backZ=structure.entrance==="north"?z-depth/2:z+depth/2;
    addWall("back",x,backZ,width,wall); addWall("door-left",x-(width+door)/4,doorZ,(width-door)/2,wall); addWall("door-right",x+(width+door)/4,doorZ,(width-door)/2,wall);
  } else {
    addWall("north",x,z+depth/2,width,wall); addWall("south",x,z-depth/2,width,wall);
    const doorX=structure.entrance==="east"?x+width/2:x-width/2; const backX=structure.entrance==="east"?x-width/2:x+width/2;
    addWall("back",backX,z,wall,depth); addWall("door-left",doorX,z-(depth+door)/4,wall,(depth-door)/2); addWall("door-right",doorX,z+(depth+door)/4,wall,(depth-door)/2);
  }
  // Interior collision follows fixed archetype plans instead of placing the
  // same world-Z divider into every building. Local V always points inward
  // from the authored entrance; U runs across its frontage. This keeps the
  // visible room plan and collision coherent for east/west entrances too.
  const localWidth=structure.entrance==="north"||structure.entrance==="south"?width:depth;
  const localDepth=structure.entrance==="north"||structure.entrance==="south"?depth:width;
  const addInteriorSegment=(suffix:string,u:number,v:number,sizeU:number,sizeV:number,segmentHeight=4)=>{
    let px=x,pz=z,sx=sizeU,sz=sizeV;
    if(structure.entrance==="south"){px=x+u;pz=z-depth/2+v;}
    else if(structure.entrance==="north"){px=x+u;pz=z+depth/2-v;}
    else if(structure.entrance==="east"){px=x+width/2-v;pz=z+u;sx=sizeV;sz=sizeU;}
    else {px=x-width/2+v;pz=z+u;sx=sizeV;sz=sizeU;}
    const storeyHeight=height/structure.floors;
    const wallHeight=Math.min(segmentHeight,Math.max(1.6,storeyHeight-.45));
    for(let floor=0;floor<structure.floors;floor++)blocks.push({
      id:`${structure.id}-room-${suffix}${structure.floors>1?`-level-${floor+1}`:""}`,
      districtId:structure.districtId,
      position:{x:px,y:baseY+floor*storeyHeight+wallHeight/2,z:pz},
      size:{x:sx,y:wallHeight,z:sz},color:"#202f4a",kind:"wall"
    });
  };
  const splitCrossWall=(suffix:string,v:number,gap:number)=>{
    const span=(localWidth-gap)/2;
    if(span<1)return;
    addInteriorSegment(`${suffix}-left`,-(localWidth+gap)/4,v,span,.5);
    addInteriorSegment(`${suffix}-right`,(localWidth+gap)/4,v,span,.5);
  };
  if(structure.archetype==="shop"){
    // Public sales floor in front, compact service room behind it.
    splitCrossWall("service",localDepth*.68,Math.min(5.2,localWidth*.28));
  }else if(structure.archetype==="apartment"||structure.archetype==="hotel"){
    // Lobby/corridor spine with two readable side rooms rather than a maze.
    splitCrossWall("lobby",localDepth*.48,Math.min(5.2,localWidth*.3));
    const rearLength=Math.max(3,localDepth*.34);
    addInteriorSegment("suite-spine",localWidth*.2,localDepth*.78,.5,rearLength);
  }else if(structure.archetype==="office"||structure.archetype==="lab"||structure.archetype==="academy"){
    // Staggered partitions retain long combat sightlines and two circulation
    // choices while giving campuses/offices a deliberate room plan.
    addInteriorSegment("workbay-left",-localWidth*.25,localDepth*.58,localWidth*.36,.5);
    addInteriorSegment("workbay-right",localWidth*.25,localDepth*.76,localWidth*.36,.5);
  }else if(structure.archetype==="mall"){
    // Keep the atrium center open; short storefront returns frame both sides.
    addInteriorSegment("storefront-left",-localWidth*.36,localDepth*.58,localWidth*.22,.5);
    addInteriorSegment("storefront-right",localWidth*.36,localDepth*.58,localWidth*.22,.5);
  }
  if(structure.roofAccess){
    const accessSide=structure.roofAccessSide??structure.entrance;
    const length=Math.max(10,height*2.35),angle=Math.atan2(height,length);let px=x,pz=z,rotation:Vec3={x:0,y:0,z:0};
    if(accessSide==="south"){pz=z-depth/2-length/2;rotation={x:-angle,y:0,z:0};}
    else if(accessSide==="north"){pz=z+depth/2+length/2;rotation={x:angle,y:0,z:0};}
    else if(accessSide==="east"){px=x+width/2+length/2;rotation={x:0,y:0,z:-angle};}
    else {px=x-width/2-length/2;rotation={x:0,y:0,z:angle};}
    if(accessSide==="north"||accessSide==="south")px+=structure.roofAccessOffset??0;else pz+=structure.roofAccessOffset??0;
    // `length` is the horizontal run used for placement and slope. Rotating a
    // slab of that same length leaves both ends short (and the bottom floating).
    const slopeLength=Math.hypot(length,height);
    blocks.push({id:`${structure.id}-roof-ramp`,districtId:structure.districtId,position:{x:px,y:baseY+height/2,z:pz},size:{x:accessSide==="north"||accessSide==="south"?BR_ROOF_RAMP_WIDTH:slopeLength,y:.36,z:accessSide==="north"||accessSide==="south"?slopeLength:BR_ROOF_RAMP_WIDTH},rotation,color:"#354d6d",kind:"ramp"});
  }
  return blocks;
}

function terraceBlocks(terrace:BrTerrace):BrMapBlock[]{
  const {x,z}=terrace.position,{height,accessSide}=terrace;
  const base=terrace.gradedRoadAccess?terrace.position.y:brAuthoredDeckHeight(terrace.position);
  const platform:BrMapBlock={id:`${terrace.id}-platform`,districtId:terrace.districtId,position:{x,y:base+height/2,z},size:{x:terrace.size.x,y:height,z:terrace.size.z},color:terrace.color,kind:"platform"};
  if(terrace.gradedRoadAccess)return[platform];
  const horizontalRun=Math.max(7,height*2.75),slopeLength=Math.hypot(horizontalRun,height);
  const angle=Math.atan2(height,horizontalRun);
  let rampX=x,rampZ=z,rotation:Vec3={x:0,y:0,z:0},size:Vec3;
  if(accessSide==="south"){
    rampZ=z-terrace.size.z/2-horizontalRun/2;rotation={x:-angle,y:0,z:0};size={x:4.8,y:.4,z:slopeLength};
  }else if(accessSide==="north"){
    rampZ=z+terrace.size.z/2+horizontalRun/2;rotation={x:angle,y:0,z:0};size={x:4.8,y:.4,z:slopeLength};
  }else if(accessSide==="east"){
    rampX=x+terrace.size.x/2+horizontalRun/2;rotation={x:0,y:0,z:-angle};size={x:slopeLength,y:.4,z:4.8};
  }else{
    rampX=x-terrace.size.x/2-horizontalRun/2;rotation={x:0,y:0,z:angle};size={x:slopeLength,y:.4,z:4.8};
  }
  return[
    platform,
    {id:`${terrace.id}-ramp`,districtId:terrace.districtId,position:{x:rampX,y:base+height/2,z:rampZ},size,rotation,color:terrace.color,kind:"ramp"}
  ];
}

/** Sloped service-road collision is kept deliberately simple and matches the
 * rendered grade. Level roads continue to use their supporting deck. */
function roadGradeBlocks(roads:readonly BrRoadSegment[]):BrMapBlock[]{
  return roads.flatMap(road=>{
    const dx=road.to.x-road.from.x,dy=road.to.y-road.from.y,dz=road.to.z-road.from.z;
    const horizontal=Math.hypot(dx,dz);
    if(horizontal<.01||(Math.abs(dy)<.05&&Math.abs(road.from.y-.1)<.05))return[];
    const slope=Math.atan2(dy,horizontal),yaw=Math.atan2(dz,dx),thickness=.34;
    // Road endpoints are authored 10 cm above their walkable deck to avoid
    // visual z-fighting. Place the oriented collider so its *top* surface,
    // rather than its center line, joins the base and raised deck heights.
    const surfaceOffset=.1+thickness/2*Math.cos(slope);
    // Rotation also moves the upper face longitudinally by -halfThickness*sin.
    // Offset the cuboid center back along the route so the WHOLE top face,
    // including its endpoints, matches the ribbon/floor query. A Y-only offset
    // left floating/unsupported seams, especially on steeper access ramps.
    const longitudinalOffset=thickness/2*Math.sin(slope);
    return [{
      id:`${road.id}-surface`,districtId:AUTHORED_BR_ELEVATED_ACCESS.get(road.id.replace(/-grade(?:-part-\d+)?$/,""))?.districtId??BR_ELEVATION_REGIONS.find(region=>brAuthoredDeckHeight(road.from)===region.height&&Math.abs(road.from.x-region.x)<=region.width/2+.01&&Math.abs(road.from.z-region.z)<=region.depth/2+.01)?.districtId??BR_ELEVATION_REGIONS.find(region=>brAuthoredDeckHeight(road.to)===region.height&&Math.abs(road.to.x-region.x)<=region.width/2+.01&&Math.abs(road.to.z-region.z)<=region.depth/2+.01)?.districtId??"orbital-isle",
      position:{x:(road.from.x+road.to.x)/2+dx/horizontal*longitudinalOffset,y:(road.from.y+road.to.y)/2-surfaceOffset,z:(road.from.z+road.to.z)/2+dz/horizontal*longitudinalOffset},
      size:{x:Math.hypot(horizontal,dy),y:thickness,z:road.width},rotation:{x:0,y:-yaw,z:slope},
      color:road.color,kind:"ramp" as const
    }];
  });
}

const authoredCover: BrMapBlock[] = [
  [-25,22,8,3,"zero-point"],[27,-25,5,7,"zero-point"],[-225,-126,7,3,"nova-plaza"],[-126,-147,4,8,"nova-plaza"],
  [152,-176,12,3,"dockyard-7"],[224,-183,9,4,"dockyard-7"],[251,28,5,10,"helios-reactor"],[286,114,8,3,"helios-reactor"],
  [-306,98,10,3,"astra-academy"],[-250,94,4,9,"astra-academy"],[-119,231,12,3,"void-mall"],[-66,231,12,3,"void-mall"],
  [78,322,6,8,"orbital-farms"],[178,309,9,3,"orbital-farms"],[-307,-282,9,4,"crash-site"],[-371,-264,5,8,"crash-site"],
  [310,-50,8,3,"thruster-works"],[378,-72,4,9,"thruster-works"],
  [-54,-21,10,3,"zero-point"],[56,8,10,3,"zero-point"],[-12,70,4,9,"zero-point"],[15,-47,4,9,"zero-point"],
  [-240,-112,8,3,"nova-plaza"],[-112,-150,8,3,"nova-plaza"],[-197,-83,4,8,"nova-plaza"],[-146,-79,4,8,"nova-plaza"],
  [132,-157,11,3,"dockyard-7"],[251,-145,11,3,"dockyard-7"],[170,-211,4,10,"dockyard-7"],[218,-208,4,10,"dockyard-7"],
  [208,105,9,3,"helios-reactor"],[316,100,9,3,"helios-reactor"],[238,142,4,9,"helios-reactor"],[287,143,4,9,"helios-reactor"],
  [-336,80,9,3,"astra-academy"],[-217,79,9,3,"astra-academy"],[-304,137,4,8,"astra-academy"],[-250,139,4,8,"astra-academy"],
  [-162,285,9,3,"void-mall"],[-25,286,9,3,"void-mall"],[-126,333,4,9,"void-mall"],[-60,334,4,9,"void-mall"],
  [61,294,10,3,"orbital-farms"],[198,285,10,3,"orbital-farms"],[98,344,4,9,"orbital-farms"],[161,348,4,9,"orbital-farms"],
  [-402,-245,10,3,"crash-site"],[-269,-260,10,3,"crash-site"],[-347,-313,4,9,"crash-site"],[-306,-206,4,9,"crash-site"],
  [288,-70,10,3,"thruster-works"],[411,-72,10,3,"thruster-works"],[319,-5,4,9,"thruster-works"],[374,-10,4,9,"thruster-works"]
].map(([x,z,w,d,districtId], index) => ({ id:`cover-${index}`, districtId:String(districtId), position:{x:Number(x),y:1+brAuthoredDeckHeight({x:Number(x),z:Number(z)}),z:Number(z)}, size:{x:Number(w),y:2,z:Number(d)}, color:"#344764", kind:"cover" }));

export const BR_MAP_BLOCKS: readonly BrMapBlock[] = [
  ...BR_STRUCTURES.flatMap(structureBlocks),...BR_TERRACES.flatMap(terraceBlocks),...roadGradeBlocks(BR_ROADS),
  // Match the cutout walls already present in the movement deck, so rays and
  // the visible retaining shell never treat a movement obstruction as open.
  ...BR_SUNKEN_REGIONS.flatMap(region=>[
    {id:`${region.id}-retaining-west`,districtId:region.districtId,position:{x:region.x-region.width/2-.05,y:region.height/2,z:region.z},size:{x:.1,y:-region.height,z:region.depth},color:"#405469",kind:"wall" as const},
    {id:`${region.id}-retaining-east`,districtId:region.districtId,position:{x:region.x+region.width/2+.05,y:region.height/2,z:region.z},size:{x:.1,y:-region.height,z:region.depth},color:"#405469",kind:"wall" as const},
    {id:`${region.id}-retaining-south`,districtId:region.districtId,position:{x:region.x,y:region.height/2,z:region.z-region.depth/2-.05},size:{x:region.width,y:-region.height,z:.1},color:"#405469",kind:"wall" as const},
    {id:`${region.id}-retaining-north`,districtId:region.districtId,position:{x:region.x,y:region.height/2,z:region.z+region.depth/2+.05},size:{x:region.width,y:-region.height,z:.1},color:"#405469",kind:"wall" as const}
  ]),
  ...authoredCover,...[...AUTHORED_BR_SECONDARY_COVER,...AUTHORED_BR_CONNECTIVE_COVER].map(block=>({...block,position:{...block.position,y:block.position.y+(brAuthoredDeckHeight(block.position)>0?brAuthoredDeckHeight(block.position):0)}})),
  // Low service-yard cover frames the loading pocket without closing either
  // shop doorway or narrowing the eight-metre street.
  {id:"solar-service-yard-cover",districtId:"solar-service",position:{x:168.5,y:.7,z:429},size:{x:3,y:1.4,z:2},color:"#344764",kind:"cover"}
];

const brRoadBySurfaceId=new Map(BR_ROADS.filter(road=>Math.abs(road.to.y-road.from.y)>=.05||Math.abs(road.from.y-.1)>=.05).map(road=>[`${road.id}-surface`,road]));
/** Walkable height of an authored service-road grade. This deterministic floor
 * path avoids the KCC choosing the island's overlapping base deck underneath
 * a shallow oriented cuboid; the cuboid remains in both physics worlds for
 * ray/weapon obstruction. */
export function brRoadGradeFloorAt(block:BrMapBlock,position:Vec3,margin=0):number|null{
  const road=brRoadBySurfaceId.get(block.id);if(!road)return null;
  const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,lengthSq=dx*dx+dz*dz;
  if(lengthSq<.001)return null;
  const raw=((position.x-road.from.x)*dx+(position.z-road.from.z)*dz)/lengthSq;
  // A capsule's side margin may reach the ribbon, but must not extend its
  // endpoint plane into the next grade. That produced a raised, invisible
  // ledge at downhill junctions while the rendered/raycast road ended earlier.
  if(raw < 0 || raw > 1)return null;
  const amount=raw;
  const closestX=road.from.x+dx*amount,closestZ=road.from.z+dz*amount;
  if(Math.hypot(position.x-closestX,position.z-closestZ)>road.width/2+margin)return null;
  // Authored road ribbons sit 10 cm above collision to avoid z-fighting.
  return road.from.y+(road.to.y-road.from.y)*amount-.1;
}

/** Selects a real upper-deck patch instead of assuming the center of every
 * storey is solid. Multi-storey interiors deliberately reserve a stairwell,
 * and several old sockets floated directly above that opening. */
function upperLootSocketPosition(structure:BrStructure,inward:{x:number;z:number}):Vec3{
  const supportY=structure.position.y+structure.size.y/structure.floors;
  const candidates:readonly [number,number][]=[
    [inward.x*.72/structure.size.x,inward.z*.72/structure.size.z],
    [-.3,-.22],[-.3,.22],[-.14,0],[.4,-.22],[.4,.22]
  ];
  for(const [fx,fz] of candidates){
    const position={x:structure.position.x+structure.size.x*fx,y:supportY+.58,z:structure.position.z+structure.size.z*fz};
    const supported=BR_MAP_BLOCKS.some(block=>block.districtId===structure.districtId&&block.kind==="platform"
      &&Math.abs(block.position.y+block.size.y/2-supportY)<.3
      &&Math.abs(position.x-block.position.x)<=block.size.x/2-.5
      &&Math.abs(position.z-block.position.z)<=block.size.z/2-.5);
    const blocked=BR_MAP_BLOCKS.some(block=>block.districtId===structure.districtId&&(block.kind==="wall"||block.kind==="cover")
      &&Math.abs(position.x-block.position.x)<block.size.x/2+.38
      &&Math.abs(position.z-block.position.z)<block.size.z/2+.38
      &&position.y+.38>block.position.y-block.size.y/2&&position.y-.38<block.position.y+block.size.y/2);
    if(supported&&!blocked)return position;
  }
  // Authoring validation catches this fallback. It is intentionally finite so
  // malformed content cannot poison a match snapshot before tests report it.
  return {x:structure.position.x-structure.size.x*.3,y:supportY+.58,z:structure.position.z};
}

/** Fixed, learnable loot locations tied to actual playable structure floors. */
export const BR_LOOT_SOCKETS: readonly BrLootSocket[] = BR_STRUCTURES.filter((structure)=>structure.enterable).flatMap((structure,index)=>{
  const inward=structure.entrance==="north"?{x:0,z:-structure.size.z*.23}:structure.entrance==="south"?{x:0,z:structure.size.z*.23}:structure.entrance==="east"?{x:-structure.size.x*.23,z:0}:{x:structure.size.x*.23,z:0};
  const floorY=structure.position.y+.58;
  const sockets:BrLootSocket[]=[{id:`${structure.id}-interior`,districtId:structure.districtId,structureId:structure.id,position:{x:structure.position.x+inward.x,y:floorY,z:structure.position.z+inward.z},kind:"interior"}];
  // A legitimate landing building must offer a second decision without forcing
  // a room-by-room scavenger hunt. Keep the socket on the opposite side of the
  // central traversal lane rather than sprinkling pickups outside at random.
  if(structure.size.x>=10&&structure.size.z>=9){
    const side=index%2?-1:1;
    const lateral=Math.abs(inward.x)>.01?{x:0,z:structure.size.z*.22*side}:{x:structure.size.x*.22*side,z:0};
    sockets.push({id:`${structure.id}-interior-secondary`,districtId:structure.districtId,structureId:structure.id,position:{x:structure.position.x-inward.x*.3+lateral.x,y:floorY,z:structure.position.z-inward.z*.3+lateral.z},kind:"interior"});
  }
  // Every authored multi-storey structure has a shared stair/deck collider.
  // Reuse the known-clear ground-floor footprint at the first upper deck so a
  // landing site rewards vertical exploration instead of exhausting its loot
  // on the entrance floor.
  if(structure.floors>=2)sockets.push({id:`${structure.id}-upper-loot`,districtId:structure.districtId,structureId:structure.id,position:upperLootSocketPosition(structure,inward),kind:"interior"});
  // Roof loot is only valid where the authored layout provides an actual
  // traversal route. Decorating inaccessible roofs with pickups creates false
  // objectives and exposes the old procedural ramp assumptions.
  if(structure.roofAccess)sockets.push({id:`${structure.id}-roof-loot`,districtId:structure.districtId,structureId:structure.id,position:{x:structure.position.x-structure.size.x*.18,y:structure.position.y+structure.size.y+.65,z:structure.position.z+structure.size.z*.17},kind:"roof"});
  return sockets;
});

/** Fixed service yards and forecourts, not the district's navigation origin.
 * Origins became street intersections when the road-first blocks were authored.
 * Keep crate identity/order and count stable, while reserving the full crate
 * footprint outside travel lanes. Plot Y is its actual supporting floor, not
 * the POI center's height (the Overlook forecourt uses the Checkpoint terrace). */
const secondaryCratePlots: readonly [string,number,number,number][] = [
  ["central-heights",-53,0,-70],
  ["horizon-homes",-235,0,-36],
  ["signal-station",-417,0,-108],
  ["south-terminal",-5,3.5,-398],
  ["engine-gate",425,0,-163],
  ["orbital-overlook",320,4.5,229],
  ["north-gardens",-25,0,422],
  ["west-park",-410,0,135],
  ["south-shipworks",170,4,-383],
  ["west-salvage",-405,0,-188],
  ["transit-court",122,-3,99.5],
  ["solar-service",191,0,433]
];
export const BR_SECONDARY_CRATE_SOCKETS = secondaryCratePlots.map(([districtId,x,y,z])=>({districtId,position:{x,y:y+.62,z}}));

export const BR_CRATE_SOCKETS: readonly Vec3[] = [...BR_POIS.map((district,index)=>{
  const structure=BR_STRUCTURES.find((entry)=>entry.districtId===district.id)!;const side=index%2?-1:1;
  return{x:structure.position.x+side*structure.size.x*.22,y:structure.position.y+.62,z:structure.position.z};
}),...BR_SECONDARY_CRATE_SOCKETS.map(socket=>socket.position)];

export const BR_TRAVERSAL = [
  { id:"lift-zero", kind:"grav-lift" as const, position:{x:20,y:0,z:18}, target:{x:20,y:25,z:18} },
  { id:"lift-nova", kind:"grav-lift" as const, position:{x:-137,y:0,z:-168}, target:{x:-137,y:21,z:-168} },
  { id:"lift-helios", kind:"grav-lift" as const, position:{x:262,y:0,z:38}, target:{x:262,y:25,z:38} },
  { id:"jump-east", kind:"jump-pad" as const, position:{x:112,y:0,z:28}, target:{x:238,y:24,z:75} },
  { id:"jump-west", kind:"jump-pad" as const, position:{x:-112,y:0,z:24}, target:{x:-252,y:23,z:77} }
].map(device=>({...device,position:{...device.position,y:device.position.y+brAuthoredDeckHeight(device.position)},target:{...device.target,y:device.target.y+brAuthoredDeckHeight(device.target)}}));

export function isInsideBrIsland(position: Vec3, margin = 0): boolean {
  if (pointInPolygon(position.x,position.z)) return true;
  return margin > 0 && Math.hypot(position.x,position.z) <= BR_MAP.radius+margin && distanceToOutline(position.x,position.z) <= margin;
}

/** True only when a point is inside the playable polygon with a real inward
 * boundary buffer. `isInsideBrIsland(position, margin)` deliberately expands
 * the accepted area for projectiles and interaction reach; drop/lifecycle
 * checks that need guaranteed landing room must use this inset predicate. */
export function isInsideBrIslandInterior(position:Vec3,inset=0):boolean {
  return pointInPolygon(position.x,position.z)&&distanceToOutline(position.x,position.z)>=Math.max(0,inset);
}

// The map is immutable. Cache ordered candidates for the small clearance and
// mantle queries executed by every character; broad sector construction queries
// still use the complete map. Bound the cache to the island's surrounding cells.
const localBlockCandidates = new Map<number, readonly BrMapBlock[]>();
/** World-space X/Z half extents for the authored collider. Rotated ramps are
 * long on a different world axis than their unrotated `size` suggests, so the
 * broadphase must project their oriented box before deciding they are absent.
 * This matches Three/Rapier's shared XYZ Euler convention. */
export function brBlockPlanarHalfExtents(block:BrMapBlock):{x:number;z:number}{
  const hx=block.size.x/2,hy=block.size.y/2,hz=block.size.z/2;
  if(!block.rotation)return{x:hx,z:hz};
  const {x,y,z}=block.rotation;
  const a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z);
  return{
    x:Math.abs(c*e)*hx+Math.abs(-c*f)*hy+Math.abs(d)*hz,
    z:Math.abs(b*f-a*e*d)*hx+Math.abs(b*e+a*f*d)*hy+Math.abs(a*c)*hz
  };
}
export function brBlocksNear(position: Vec3, radius = 8): BrMapBlock[] {
  let candidates = BR_MAP_BLOCKS;
  const cellX = Math.floor(position.x / 50), cellZ = Math.floor(position.z / 50);
  if (radius >= 0 && radius <= 8 && cellX >= -11 && cellX <= 10 && cellZ >= -11 && cellZ <= 10) {
    const key = (cellX + 11) * 22 + cellZ + 11;
    let cached = localBlockCandidates.get(key);
    if (!cached) {
      const x = cellX * 50 + 25, z = cellZ * 50 + 25;
      cached = BR_MAP_BLOCKS.filter(block => {const half=brBlockPlanarHalfExtents(block);return Math.abs(block.position.x-x)<=half.x+33 && Math.abs(block.position.z-z)<=half.z+33;});
      localBlockCandidates.set(key, cached);
    }
    candidates = cached;
  }
  return candidates.filter((block) => {const half=brBlockPlanarHalfExtents(block);return Math.abs(block.position.x-position.x)<=half.x+radius && Math.abs(block.position.z-position.z)<=half.z+radius;});
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
  // brBlocksNear already expands by each block's own half extent. The sector
  // therefore only needs a few metres beyond its 50 m half-width to cover a
  // full-speed frame and capsule radius. The previous extra 46 m duplicated
  // most neighbouring-district colliders into every Rapier sector and made
  // forty-player movement unnecessarily expensive.
  return brBlocksNear(center, BR_PHYSICS_SECTOR_SIZE / 2 + 4);
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
