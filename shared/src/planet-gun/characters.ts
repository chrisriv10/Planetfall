import type {PgLoadout, PgModuleId, PgPrimaryWeaponId, PgSecondaryWeaponId, PgTeam} from "./types.js";
import {pgValidateLoadout} from "./loadouts.js";

export const PG_HERO_IDS = Object.freeze(["cairn", "kepler", "cinder", "parallax", "solace", "spindle"] as const);
export type PgHeroId = typeof PG_HERO_IDS[number];
export const PG_OPERATOR_IDS = Object.freeze(["rivet", "lumen", "null", "strut", "thread", "patch", "brace", "hush", "glint", "coil", "mend", "shroud"] as const);
export type PgOperatorId = typeof PG_OPERATOR_IDS[number];
export type PgSiegeSide = "attack" | "defend";
export type PgHeroRole = "tank" | "damage" | "support";
export type PgAbilityPrimitive = "barrier" | "pulse" | "shield" | "field" | "guard" | "dash" | "weapon-buff" | "recon" | "blink" | "heal-beam" | "beacon" | "relay" | "breach" | "emp" | "trip-line" | "heal" | "shutter" | "jammer" | "sensor" | "floor-strip" | "smoke";
export interface PgAbilityDefinition {
 readonly id:string;
 readonly name:string;
 readonly primitive:PgAbilityPrimitive;
 readonly durationMs:number;
 readonly cooldownMs:number;
 readonly charges:number;
 readonly recharge:"cooldown" | "round" | "ultimate";
 readonly radius:number;
 readonly range:number;
 readonly warningMs:number;
 readonly target:"self" | "enemy" | "ally" | "allies" | "ground" | "panel" | "socket";
 readonly stacking:"replace-own" | "strongest-only" | "capped-refresh";
 readonly lineOfSight:"activation" | "continuous" | "each-pulse" | "collision-path";
 readonly cleanup:readonly ("expiry" | "owner-death" | "round-reset" | "selection-change" | "destroyed")[];
 readonly deployableHp:number;
 /** Numeric, server-owned primitive parameters; values never come from action packets. */
 readonly effect:Readonly<Record<string,number>>;
}
export interface PgCharacterSilhouette {
 readonly helmet:"square" | "round-segmented" | "swept" | "narrow-sensor" | "rescue-collar" | "geometric" | "half-visor" | "split-crown" | "antenna-hood" | "flat" | "slit" | "rescue-wide" | "rectangular" | "dome" | "triple-lens" | "forked" | "rescue-segmented" | "filtered";
 readonly shoulders:string;
 readonly backpack:string;
 readonly arms:string;
 readonly legs:string;
 readonly colors:{readonly armor:string; readonly secondary:string; readonly emitter:string};
 readonly teamMarkings:"shoulders-and-visor";
 readonly preserveAtDistance:readonly ("helmet" | "shoulders" | "backpack" | "arms")[];
}
interface PgCharacterEquipment {
 readonly maxHp:number;
 readonly primaryChoices:readonly PgPrimaryWeaponId[];
 readonly secondary:PgSecondaryWeaponId;
 readonly allowedPrimaryModules:readonly PgModuleId[];
 readonly allowedSecondaryModules:readonly PgModuleId[];
 readonly silhouette:PgCharacterSilhouette;
}
export type PgPassiveId = "braced" | "shielded" | "earned-reload" | "steady-aim" | "recovery" | "assist-resource";
export interface PgHeroDefinition extends PgCharacterEquipment {
 readonly id:PgHeroId;
 readonly name:string;
 readonly role:PgHeroRole;
 readonly passive:PgPassiveId;
 readonly abilities:readonly [PgAbilityDefinition,PgAbilityDefinition];
 readonly ultimate:PgAbilityDefinition;
 readonly ultimateCost:number;
}
export interface PgOperatorDefinition extends PgCharacterEquipment {
 readonly id:PgOperatorId;
 readonly name:string;
 readonly side:PgSiegeSide;
 readonly signature:PgAbilityDefinition;
}
function freeze<T>(value:T):T {
 if(value && typeof value === "object") {for(const child of Object.values(value))freeze(child);Object.freeze(value);}
 return value;
}
/** Catalogs describe rules. Runtime activation, damage, reservations and cleanup belong to authority. */
function ability(id:string,name:string,primitive:PgAbilityPrimitive,options:Partial<Omit<PgAbilityDefinition,"id"|"name"|"primitive">>):PgAbilityDefinition {
 return {id,name,primitive,durationMs:0,cooldownMs:12000,charges:1,recharge:"cooldown",radius:0,range:0,warningMs:0,target:"self",stacking:"strongest-only",lineOfSight:"activation",cleanup:["expiry","owner-death","round-reset","selection-change"],deployableHp:0,effect:{},...options};
}
function silhouette(helmet:PgCharacterSilhouette["helmet"],shoulders:string,backpack:string,arms:string,legs:string,armor:string,secondary:string,emitter:string):PgCharacterSilhouette {
 return {helmet,shoulders,backpack,arms,legs,colors:{armor,secondary,emitter},teamMarkings:"shoulders-and-visor",preserveAtDistance:["helmet","shoulders","backpack","arms"]};
}
const modules:readonly PgModuleId[]=["reflex-array","gyro-stabilizer","lightweight-frame"];
function equipment(maxHp:number,primaryChoices:readonly PgPrimaryWeaponId[],secondary:PgSecondaryWeaponId,silhouette:PgCharacterSilhouette):PgCharacterEquipment {
 return {maxHp,primaryChoices,secondary,silhouette,allowedPrimaryModules:[...modules],allowedSecondaryModules:["reflex-array"]};
}
export const PG_PASSIVES = freeze({
 braced:{knockbackMultiplier:.55},
 shielded:{damageMultiplier:.85,initialPersonalShield:60},
 "earned-reload":{reloadMultiplier:.8,durationMs:3000},
 "steady-aim":{adsTimeMultiplier:.7,stationaryDelayMs:400},
 recovery:{combatDelayMs:5000,healingPerSecond:12},
 "assist-resource":{resourcePerAssist:8,resourceCap:100,maxResourcePerLife:40},
} as const);
export const PG_HEROES:Readonly<Record<PgHeroId,PgHeroDefinition>> = freeze({
 cairn:{id:"cairn",name:"Cairn",role:"tank",passive:"braced",...equipment(325,["photon"],"comet",silhouette("square","broad ceramic slabs","low brace block","heavy squared bracers","wide bracing greaves","#c6c8c3","#354257","#ebb348")),abilities:[
  ability("cairn-barrier","Rampart","barrier",{durationMs:8000,cooldownMs:16000,range:5,target:"ground",lineOfSight:"collision-path",deployableHp:450,cleanup:["expiry","destroyed","owner-death","round-reset","selection-change"],effect:{width:3,height:2,depth:.3}}),
  ability("cairn-pulse","Brace Pulse","pulse",{cooldownMs:10000,radius:5,range:5,target:"enemy",effect:{damage:25,knockback:5,coneCosine:.5}}),
 ],ultimate:ability("cairn-ultimate","Stone Circle","shield",{durationMs:7000,cooldownMs:0,recharge:"ultimate",radius:10,range:10,target:"allies",stacking:"capped-refresh",effect:{shield:100,shieldCap:100}}),ultimateCost:1800},
 kepler:{id:"kepler",name:"Kepler",role:"tank",passive:"shielded",...equipment(300,["arc"],"orbit",silhouette("round-segmented","rounded layered plates","circular gravity coils","ringed gauntlets","segmented heavy boots","#7383ae","#30354f","#b5a0ff")),abilities:[
  ability("kepler-gravity","Gravity Well","field",{durationMs:5000,cooldownMs:14000,radius:4,range:18,warningMs:700,target:"ground",lineOfSight:"each-pulse",effect:{speedMultiplier:.65}}),
  ability("kepler-guard","Personal Guard","guard",{durationMs:2500,cooldownMs:12000,effect:{absorptionCap:150}}),
 ],ultimate:ability("kepler-ultimate","Orbital Well","field",{durationMs:6000,cooldownMs:0,recharge:"ultimate",radius:7,range:20,warningMs:1000,target:"ground",lineOfSight:"each-pulse",effect:{speedMultiplier:.65,pullDistance:3,pullCount:1,stunMs:0}}),ultimateCost:1900},
 cinder:{id:"cinder",name:"Cinder",role:"damage",passive:"earned-reload",...equipment(200,["nova"],"comet",silhouette("swept","swept compact plates","compact twin thrusters","asymmetric heat forearms","lean armored shins","#a44c32","#303b51","#ffb341")),abilities:[
  ability("cinder-dash","Burn Dash","dash",{durationMs:180,cooldownMs:6500,range:6,lineOfSight:"collision-path",effect:{horizontalOnly:1}}),
  ability("cinder-heat","Heat Cell","field",{durationMs:4000,cooldownMs:12000,radius:3,range:20,warningMs:900,target:"ground",lineOfSight:"each-pulse",effect:{damagePerSecond:22}}),
 ],ultimate:ability("cinder-ultimate","Overdrive","weapon-buff",{durationMs:7000,cooldownMs:0,recharge:"ultimate",effect:{fireIntervalMultiplier:.8,coolingMultiplier:1.35,minFireIntervalMs:60}}),ultimateCost:1700},
 parallax:{id:"parallax",name:"Parallax",role:"damage",passive:"steady-aim",...equipment(180,["quasar"],"orbit",silhouette("narrow-sensor","precision sensor shoulder","long offset sensor mast","slim targeting cuffs","tapered boots","#596c87","#263448","#74d4ef")),abilities:[
  ability("parallax-recon","Sightline","recon",{durationMs:2000,cooldownMs:12000,radius:24,range:24,target:"enemy",effect:{coneCosine:.6,intelExpiryMs:2000}}),
  ability("parallax-blink","Short Fold","blink",{cooldownMs:9000,range:5,lineOfSight:"collision-path",effect:{requiresReachableGround:1}}),
 ],ultimate:ability("parallax-ultimate","Perfect Alignment","weapon-buff",{durationMs:7000,cooldownMs:0,recharge:"ultimate",effect:{precisionDamageMultiplier:1.2,adsTimeMultiplier:.75,recoilMultiplier:.7}}),ultimateCost:1750},
 solace:{id:"solace",name:"Solace",role:"support",passive:"recovery",...equipment(210,["pulse"],"orbit",silhouette("rescue-collar","curved rescue collar","curved medical pack","luminous wrist emitter","rescue knee guards","#d4d8d9","#4c6378","#8cddf4")),abilities:[
  ability("solace-beam","Lifeline","heal-beam",{durationMs:4000,cooldownMs:5000,range:14,target:"ally",lineOfSight:"continuous",effect:{healingPerSecond:30,resourceCap:100,resourcePerSecond:25,resourceRecoveryPerSecond:15}}),
  ability("solace-beacon","Recovery Beacon","beacon",{durationMs:10000,cooldownMs:18000,radius:5,range:6,target:"ground",lineOfSight:"each-pulse",deployableHp:80,effect:{healingPerSecond:12,healingPool:240}}),
 ],ultimate:ability("solace-ultimate","Recovery Ring","field",{durationMs:6000,cooldownMs:0,recharge:"ultimate",radius:8,target:"allies",lineOfSight:"each-pulse",effect:{healingPerSecond:35,healingCapPerTarget:180}}),ultimateCost:2000},
 spindle:{id:"spindle",name:"Spindle",role:"support",passive:"assist-resource",...equipment(200,["helix"],"comet",silhouette("geometric","angular tool harness","two folded utility arms","geometric tool gauntlets","angular work boots","#b3975d","#354257","#ffd16b")),abilities:[
  ability("spindle-shield","Shield Stitch","shield",{durationMs:6000,cooldownMs:10000,range:12,target:"ally",lineOfSight:"continuous",stacking:"capped-refresh",effect:{shield:40,shieldCap:60,rechargePerSecond:8}}),
  ability("spindle-relay","Team Relay","relay",{durationMs:10000,cooldownMs:18000,radius:6,range:6,target:"ground",lineOfSight:"each-pulse",deployableHp:90,effect:{speedMultiplier:1.12,reloadMultiplier:.85}}),
 ],ultimate:ability("spindle-ultimate","Relay Surge","relay",{durationMs:6000,cooldownMs:0,recharge:"ultimate",radius:6,range:15,target:"ground",lineOfSight:"each-pulse",effect:{requiresOwnedRelay:1,speedMultiplier:1.2,reloadMultiplier:.7}}),ultimateCost:1850},
});

function signature(id:string,name:string,primitive:PgAbilityPrimitive,options:Partial<Omit<PgAbilityDefinition,"id"|"name"|"primitive">>):PgAbilityDefinition {
 return ability(id,name,primitive,{cooldownMs:0,recharge:"round",...options});
}
export const PG_SIEGE_COMMON_EQUIPMENT = freeze({
 attack:{scoutDrones:1,droneHp:35,breachCharges:1,breachReinforced:false},
 defend:{reinforcements:2,barricades:2,repairCharges:1},
});
export const PG_OPERATORS:Readonly<Record<PgOperatorId,PgOperatorDefinition>> = freeze({
 rivet:{id:"rivet",name:"Rivet",side:"attack",...equipment(120,["pulse","photon"],"comet",silhouette("half-visor","industrial offset shoulder","charge rack","heavy asymmetric breaching forearm","industrial boots","#ad8051","#323e51","#f4b646")),signature:signature("rivet-puck","Breach Puck","breach",{charges:2,range:2,target:"panel",warningMs:1300,effect:{reinforcedDamage:1000,ordinaryDamage:1000,localDamage:35,localRadius:2}})},
 lumen:{id:"lumen",name:"Lumen",side:"attack",...equipment(100,["quasar","helix"],"orbit",silhouette("split-crown","slim scout plates","slim directional scout pack","sensor cuffs","light scout boots","#8b9fb4","#343c52","#f9dd82")),signature:signature("lumen-dart","Survey Dart","sensor",{charges:2,durationMs:45000,range:20,radius:16,target:"ground",lineOfSight:"each-pulse",deployableHp:20,effect:{pulseIntervalMs:2000,intelExpiryMs:1500,coneCosine:.65}})},
 null:{id:"null",name:"Null",side:"attack",...equipment(105,["nova","arc"],"orbit",silhouette("antenna-hood","insulated shoulder pads","insulated capacitor backpack","cable-wrapped forearms","insulated boots","#566272","#282f44","#8fb4fa")),signature:signature("null-emp","EMP Cell","emp",{charges:2,durationMs:6000,range:18,radius:6,warningMs:700,target:"ground",lineOfSight:"each-pulse",effect:{disableElectronics:1}})},
 strut:{id:"strut",name:"Strut",side:"attack",...equipment(120,["pulse","helix"],"comet",silhouette("flat","flat reinforcement shoulders","folded cover plates","plate-deployment gauntlets","reinforced knees","#7e8d92","#32394d","#dfb367")),signature:signature("strut-cover","Approach Cover","barrier",{charges:2,durationMs:150000,range:3,target:"ground",lineOfSight:"collision-path",deployableHp:300,effect:{width:2,height:1,depth:.35,blocksMovement:1}})},
 thread:{id:"thread",name:"Thread",side:"attack",...equipment(100,["quasar","rail"],"orbit",silhouette("slit","narrow angular shoulders","spool backpack","paired wrist launchers","narrow work greaves","#8e7397","#333c52","#efb6dc")),signature:signature("thread-line","Flank Thread","trip-line",{charges:2,durationMs:150000,range:6,target:"ground",lineOfSight:"collision-path",deployableHp:25,effect:{maxLineLength:6,slowMultiplier:.7,slowMs:1500,intelExpiryMs:2000,triggerCount:1}})},
 patch:{id:"patch",name:"Patch",side:"attack",...equipment(110,["nova","pulse"],"comet",silhouette("rescue-wide","field medic harness","compact supply canisters","injector gauntlets","padded rescue boots","#afaaa0","#39475b","#efc88c")),signature:signature("patch-heal","Field Charge","heal",{charges:3,range:8,target:"ally",effect:{healing:45,allowResurrection:0}})},
 brace:{id:"brace",name:"Brace",side:"defend",...equipment(125,["photon","pulse"],"comet",silhouette("rectangular","thick shoulder frame","reinforcement tool rack","wide shutter controls","heavy utility boots","#8a877b","#303b4f","#e0b35b")),signature:signature("brace-shutter","Brace Shutter","shutter",{charges:1,durationMs:150000,range:2,target:"socket",lineOfSight:"collision-path",deployableHp:550,effect:{extraReinforcements:1,toggleCooldownMs:1500}})},
 hush:{id:"hush",name:"Hush",side:"defend",...equipment(110,["nova","arc"],"orbit",silhouette("dome","padded round shoulders","shielded jammer pack","padded insulated bracers","soft armored boots","#69788b","#293548","#9fbeef")),signature:signature("hush-jammer","Quiet Array","jammer",{charges:2,durationMs:150000,range:3,radius:6,target:"ground",lineOfSight:"each-pulse",deployableHp:60,effect:{suppressDrones:1,suppressIntel:1,empSensitive:1}})},
 glint:{id:"glint",name:"Glint",side:"defend",...equipment(100,["quasar","helix"],"comet",silhouette("triple-lens","angular sensor shoulders","compact sensor satchel","sensor mounting cuffs","angular scout boots","#929caa","#343b4d","#e8d78a")),signature:signature("glint-sensor","Movement Lens","sensor",{charges:3,durationMs:150000,range:3,radius:12,target:"ground",lineOfSight:"each-pulse",deployableHp:25,effect:{requiresWall:1,movementOnly:1,coneCosine:.65,intelExpiryMs:1500,pulseIntervalMs:1000,empSensitive:1}})},
 coil:{id:"coil",name:"Coil",side:"defend",...equipment(115,["photon","arc"],"orbit",silhouette("forked","cable-housed shoulders","paired cable reels","insulated strip deployers","insulated leg guards","#9a825b","#313f51","#f4cc64")),signature:signature("coil-strip","Arc Strip","floor-strip",{charges:3,durationMs:150000,range:3,radius:1.5,target:"ground",lineOfSight:"each-pulse",deployableHp:35,effect:{damagePerSecond:8,damageCapPerTarget:32,speedMultiplier:.7,empSensitive:1}})},
 mend:{id:"mend",name:"Mend",side:"defend",...equipment(110,["pulse","prism"],"orbit",silhouette("rescue-segmented","rigid medical chest frame","supply tubing pack","station-control gauntlets","segmented rescue boots","#c0c4bd","#3b4b60","#a9d9e8")),signature:signature("mend-station","Care Station","beacon",{charges:1,durationMs:150000,range:3,radius:4,target:"ground",lineOfSight:"each-pulse",deployableHp:100,effect:{healingPool:240,healingPerSecond:12,sharedThroughputPerSecond:24,empSensitive:1}})},
 shroud:{id:"shroud",name:"Shroud",side:"defend",...equipment(100,["quasar","rail"],"comet",silhouette("filtered","layered soft shoulders","twin filter canisters","canister launch cuffs","soft layered greaves","#847d92","#323a4e","#cfb2e1")),signature:signature("shroud-screen","Obscurant","smoke",{charges:3,durationMs:10000,range:18,radius:4,warningMs:500,target:"ground",lineOfSight:"collision-path",effect:{blocksVision:1,blocksBullets:0,blocksMovement:0}})},
});

export function pgResolveHero(id:unknown):PgHeroDefinition|null {
 return typeof id === "string" && Object.hasOwn(PG_HEROES,id) ? PG_HEROES[id as PgHeroId] : null;
}
export function pgResolveOperator(id:unknown,side?:PgSiegeSide):PgOperatorDefinition|null {
 const operator=typeof id === "string" && Object.hasOwn(PG_OPERATORS,id) ? PG_OPERATORS[id as PgOperatorId] : null;
 return operator && (side===undefined || operator.side===side) ? operator : null;
}
export interface PgCharacterReservation {readonly playerId:string; readonly team:PgTeam; readonly characterId:string;}
export function pgAvailableHeroes(team:PgTeam,reservations:readonly PgCharacterReservation[],excludingPlayerId?:string):PgHeroId[] {
 const taken=new Set(reservations.filter(r=>r.team===team && r.playerId!==excludingPlayerId).map(r=>r.characterId));
 return PG_HERO_IDS.filter(id=>!taken.has(id));
}
export function pgAvailableOperators(side:PgSiegeSide,team:PgTeam,reservations:readonly PgCharacterReservation[],excludingPlayerId?:string):PgOperatorId[] {
 const taken=new Set(reservations.filter(r=>r.team===team && r.playerId!==excludingPlayerId).map(r=>r.characterId));
 return PG_OPERATOR_IDS.filter(id=>PG_OPERATORS[id].side===side && !taken.has(id));
}
/** Always return a fresh player-owned loadout, never mutable catalog or weapon objects. */
export function pgCharacterDefaultLoadout(character:PgHeroDefinition|PgOperatorDefinition):PgLoadout {
 return {primary:character.primaryChoices[0],secondary:character.secondary,primaryModules:[],secondaryModules:[]};
}
function legalLoadout(character:PgHeroDefinition|PgOperatorDefinition|null,raw:unknown):PgLoadout|null {
 const value=pgValidateLoadout(raw);
 if(!character || !value || !character.primaryChoices.includes(value.primary) || value.secondary!==character.secondary)return null;
 if(value.primaryModules?.some(id=>!character.allowedPrimaryModules.includes(id)) || value.secondaryModules?.some(id=>!character.allowedSecondaryModules.includes(id)))return null;
 return value;
}
export function pgValidateHeroLoadout(id:unknown,raw:unknown):PgLoadout|null {return legalLoadout(pgResolveHero(id),raw);}
export function pgValidateOperatorLoadout(id:unknown,raw:unknown):PgLoadout|null {return legalLoadout(pgResolveOperator(id),raw);}
