import type {ShopItem,PlanetPassReward} from "./index.js";
import {WEAPON_FINISHES} from "./weapon-finishes.js";

const ALL_FAMILIES=["planetfall","battle-royale","planet-run","planet-gun"] as const;
const TRAIL_FAMILIES=["planetfall","battle-royale","planet-run"] as const;
const PLANET_FAMILIES=["planetfall"] as const;
const FINISH_FAMILIES=["planet-gun"] as const;
const finishPrices:Readonly<Record<string,number>>={
 "finish-solar-alloy":600,"finish-ion-frost":650,"finish-nebula-drift":750,
 "finish-copper-circuit":700,"finish-voidglass":850,"finish-orbital-champion":0,
};

/** Cosmetic-only additions; legacy items and their prices remain in the base catalog. */
export const EXPANDED_SHOP_CATALOG:readonly ShopItem[]=[
 {id:"pressure-white",name:"Pressure White",category:"suit",price:450,color:"#e6eef1",suitStyle:"pressure",families:ALL_FAMILIES},
 {id:"circuit-courier",name:"Circuit Courier",category:"suit",price:650,color:"#64cbbd",suitStyle:"courier",families:ALL_FAMILIES},
 {id:"midnight-salvage",name:"Midnight Salvage",category:"suit",price:700,color:"#64718e",suitStyle:"salvage",families:ALL_FAMILIES},
 {id:"plasma-helix",name:"Plasma Helix",category:"trail",price:350,color:"#5cdeeb",families:TRAIL_FAMILIES},
 {id:"solar-petals",name:"Solar Petals",category:"trail",price:450,color:"#ffc987",families:TRAIL_FAMILIES},
 {id:"void-wake",name:"Void Wake",category:"trail",price:550,color:"#a69beb",families:TRAIL_FAMILIES},
 {id:"salute",name:"Orbital Salute",category:"emote",price:200,emote:"salute",families:ALL_FAMILIES},
 {id:"shuffle",name:"Moonwalk Shuffle",category:"emote",price:300,emote:"shuffle",families:ALL_FAMILIES},
 {id:"flex",name:"Gravity Flex",category:"emote",price:400,emote:"flex",families:ALL_FAMILIES},
 {id:"orbit-salute",name:"Orbit Salute",category:"victory",price:350,families:ALL_FAMILIES},
 {id:"zero-g-bow",name:"Zero-G Bow",category:"victory",price:450,families:ALL_FAMILIES},
 {id:"champion",name:"Orbital Champion",category:"victory",price:800,families:ALL_FAMILIES},
 {id:"tidal-haven",name:"Tidal Haven",category:"planet",price:600,color:"#438cba",planetStyle:"ocean",families:PLANET_FAMILIES},
 {id:"cinder-moon",name:"Cinder Moon",category:"planet",price:700,color:"#a65a47",planetStyle:"cinder",families:PLANET_FAMILIES},
 {id:"verdant-ring",name:"Verdant Ring",category:"planet",price:900,color:"#65a78a",planetStyle:"garden",families:PLANET_FAMILIES},
 ...WEAPON_FINISHES.map(finish=>({
  id:finish.id,name:finish.name,category:"weapon-skin" as const,price:finishPrices[finish.id],color:finish.body,families:FINISH_FAMILIES,
  ...(finish.id==="finish-orbital-champion"?{passLevel:50}:{}),
 })),
 {id:"card-solar-vanguard",name:"Solar Vanguard Calling Card",category:"calling-card",price:300,families:ALL_FAMILIES},
 {id:"emblem-solar-vanguard",name:"Solar Vanguard Emblem",category:"emblem",price:200,families:ALL_FAMILIES},
 {id:"card-void-explorer",name:"Void Explorer Calling Card",category:"calling-card",price:400,families:ALL_FAMILIES},
 {id:"emblem-void-explorer",name:"Void Explorer Emblem",category:"emblem",price:250,families:ALL_FAMILIES},
 {id:"card-orbital-engineer",name:"Orbital Engineer Calling Card",category:"calling-card",price:400,families:ALL_FAMILIES},
 {id:"emblem-orbital-engineer",name:"Orbital Engineer Emblem",category:"emblem",price:250,families:ALL_FAMILIES},
 {id:"card-crown-collector",name:"Crown Collector Calling Card",category:"calling-card",price:600,families:ALL_FAMILIES},
 {id:"emblem-crown-collector",name:"Crown Collector Emblem",category:"emblem",price:350,families:ALL_FAMILIES},
 {id:"card-ion-runner",name:"Ion Runner Calling Card",category:"calling-card",price:450,families:ALL_FAMILIES},
 {id:"emblem-ion-runner",name:"Ion Runner Emblem",category:"emblem",price:300,families:ALL_FAMILIES},
 {id:"card-shatter-champion",name:"Shatter Champion Calling Card",category:"calling-card",price:700,families:ALL_FAMILIES},
 {id:"emblem-shatter-champion",name:"Shatter Champion Emblem",category:"emblem",price:450,families:ALL_FAMILIES},
];

/** Forty authored tiers append to the unchanged ten legacy rewards. */
export const EXPANDED_PASS_REWARDS:readonly PlanetPassReward[]=[
 {id:"pass-11-bucks-125",level:11,label:"+125 FALLBUCKS",fallbucks:125},
 {id:"pressure-white",level:12,label:"PRESSURE WHITE SUIT",cosmeticId:"pressure-white"},
 {id:"plasma-helix",level:13,label:"PLASMA HELIX TRAIL",cosmeticId:"plasma-helix"},
 {id:"salute",level:14,label:"ORBITAL SALUTE EMOTE",cosmeticId:"salute"},
 {id:"finish-solar-alloy",level:15,label:"SOLAR ALLOY WEAPON FINISH",cosmeticId:"finish-solar-alloy"},
 {id:"pass-16-bucks-150",level:16,label:"+150 FALLBUCKS",fallbucks:150},
 {id:"orbit-salute",level:17,label:"ORBIT SALUTE VICTORY",cosmeticId:"orbit-salute"},
 {id:"tidal-haven",level:18,label:"TIDAL HAVEN PLANET",cosmeticId:"tidal-haven"},
 {id:"emblem-solar-vanguard",level:19,label:"SOLAR VANGUARD EMBLEM",cosmeticId:"emblem-solar-vanguard"},
 {id:"finish-nebula-drift",level:20,label:"NEBULA DRIFT FINISH · NEBULA NAVIGATOR",cosmeticId:"finish-nebula-drift",badge:"NEBULA NAVIGATOR"},
 {id:"pass-21-bucks-175",level:21,label:"+175 FALLBUCKS",fallbucks:175},
 {id:"circuit-courier",level:22,label:"CIRCUIT COURIER SUIT",cosmeticId:"circuit-courier"},
 {id:"solar-petals",level:23,label:"SOLAR PETALS TRAIL",cosmeticId:"solar-petals"},
 {id:"shuffle",level:24,label:"MOONWALK SHUFFLE EMOTE",cosmeticId:"shuffle"},
 {id:"finish-ion-frost",level:25,label:"ION FROST WEAPON FINISH",cosmeticId:"finish-ion-frost"},
 {id:"pass-26-bucks-200",level:26,label:"+200 FALLBUCKS",fallbucks:200},
 {id:"zero-g-bow",level:27,label:"ZERO-G BOW VICTORY",cosmeticId:"zero-g-bow"},
 {id:"cinder-moon",level:28,label:"CINDER MOON PLANET",cosmeticId:"cinder-moon"},
 {id:"card-solar-vanguard",level:29,label:"SOLAR VANGUARD CALLING CARD",cosmeticId:"card-solar-vanguard"},
 {id:"verdant-ring",level:30,label:"VERDANT RING PLANET · VERDANT VOYAGER",cosmeticId:"verdant-ring",badge:"VERDANT VOYAGER"},
 {id:"pass-31-bucks-225",level:31,label:"+225 FALLBUCKS",fallbucks:225},
 {id:"emblem-void-explorer",level:32,label:"VOID EXPLORER EMBLEM",cosmeticId:"emblem-void-explorer"},
 {id:"card-void-explorer",level:33,label:"VOID EXPLORER CALLING CARD",cosmeticId:"card-void-explorer"},
 {id:"emblem-orbital-engineer",level:34,label:"ORBITAL ENGINEER EMBLEM",cosmeticId:"emblem-orbital-engineer"},
 {id:"finish-copper-circuit",level:35,label:"COPPER CIRCUIT WEAPON FINISH",cosmeticId:"finish-copper-circuit"},
 {id:"pass-36-bucks-250",level:36,label:"+250 FALLBUCKS",fallbucks:250},
 {id:"card-orbital-engineer",level:37,label:"ORBITAL ENGINEER CALLING CARD",cosmeticId:"card-orbital-engineer"},
 {id:"midnight-salvage",level:38,label:"MIDNIGHT SALVAGE SUIT",cosmeticId:"midnight-salvage"},
 {id:"emblem-crown-collector",level:39,label:"CROWN COLLECTOR EMBLEM",cosmeticId:"emblem-crown-collector"},
 {id:"card-crown-collector",level:40,label:"CROWN COLLECTOR CALLING CARD · CROWN COLLECTOR",cosmeticId:"card-crown-collector",badge:"CROWN COLLECTOR"},
 {id:"emblem-ion-runner",level:41,label:"ION RUNNER EMBLEM",cosmeticId:"emblem-ion-runner"},
 {id:"card-ion-runner",level:42,label:"ION RUNNER CALLING CARD",cosmeticId:"card-ion-runner"},
 {id:"void-wake",level:43,label:"VOID WAKE TRAIL",cosmeticId:"void-wake"},
 {id:"flex",level:44,label:"GRAVITY FLEX EMOTE",cosmeticId:"flex"},
 {id:"finish-voidglass",level:45,label:"VOIDGLASS WEAPON FINISH",cosmeticId:"finish-voidglass"},
 {id:"pass-46-bucks-300",level:46,label:"+300 FALLBUCKS",fallbucks:300},
 {id:"champion",level:47,label:"ORBITAL CHAMPION VICTORY",cosmeticId:"champion"},
 {id:"emblem-shatter-champion",level:48,label:"SHATTER CHAMPION EMBLEM",cosmeticId:"emblem-shatter-champion"},
 {id:"card-shatter-champion",level:49,label:"SHATTER CHAMPION CALLING CARD",cosmeticId:"card-shatter-champion"},
 {id:"finish-orbital-champion",level:50,label:"ORBITAL CHAMPION FINISH · +500 FALLBUCKS",cosmeticId:"finish-orbital-champion",fallbucks:500,badge:"ORBITAL CHAMPION"},
];
