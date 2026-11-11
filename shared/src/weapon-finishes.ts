/** Canonical cosmetic-only finishes. IDs travel with profiles; geometry,
 * weapon stats and hit registration never depend on these definitions. */
export interface WeaponFinishDefinition {
 id:string;name:string;body:string;inset:string;accent:string;
 metalness:number;roughness:number;
 pattern:"brushed"|"ceramic"|"circuit"|"starfield"|"glass"|"champion";
}
export const WEAPON_FINISHES:readonly WeaponFinishDefinition[]=[
 {id:"finish-solar-alloy",name:"Solar Alloy",body:"#c9b176",inset:"#344454",accent:"#ffe1a0",metalness:.72,roughness:.34,pattern:"brushed"},
 {id:"finish-ion-frost",name:"Ion Frost",body:"#c7e5e9",inset:"#3e617c",accent:"#76e7ec",metalness:.18,roughness:.43,pattern:"ceramic"},
 {id:"finish-nebula-drift",name:"Nebula Drift",body:"#74699a",inset:"#26354e",accent:"#d1b3f2",metalness:.39,roughness:.38,pattern:"starfield"},
 {id:"finish-copper-circuit",name:"Copper Circuit",body:"#bc8865",inset:"#293e40",accent:"#79d9c3",metalness:.64,roughness:.42,pattern:"circuit"},
 {id:"finish-voidglass",name:"Voidglass",body:"#485b74",inset:"#263145",accent:"#a4bce5",metalness:.48,roughness:.23,pattern:"glass"},
 {id:"finish-orbital-champion",name:"Orbital Champion",body:"#e0c996",inset:"#536577",accent:"#f1dfb7",metalness:.60,roughness:.32,pattern:"champion"},
];
export function weaponFinishForId(id:string|undefined):WeaponFinishDefinition|null{return WEAPON_FINISHES.find(finish=>finish.id===id)??null;}
