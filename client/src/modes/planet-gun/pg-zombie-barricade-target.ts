import {PG_ZOMBIE_BARRICADE_SITES,type PgDynamicPanel,type Vec3} from "@planetfall/shared";

/** Range and board status are shared by the input intent and its HUD prompt.
 * The server still owns occupancy, timing, line of sight and repair completion. */
export function pgZombieBarricadeTarget(position:Vec3,panels:readonly PgDynamicPanel[],visible:(at:Vec3)=>boolean=()=>true){
 let result:null|{site:typeof PG_ZOMBIE_BARRICADE_SITES[number];remaining:number;damaged:boolean}=null,best=Infinity;
 for(const site of PG_ZOMBIE_BARRICADE_SITES){
  const distance=Math.hypot(position.x-site.interaction.x,position.y-site.interaction.y,position.z-site.interaction.z);
  if(distance>2.4||distance>=best||!visible(site.interaction))continue;
  let remaining=0,damaged=false,present=0;
  for(const board of site.boards){const panel=panels.find(p=>p.id===board.id);if(!panel)continue;present++;if(panel.active){remaining++;if(panel.hp<panel.maxHp)damaged=true;}else damaged=true;}
  if(present!==site.boards.length)continue;
  result={site,remaining,damaged};best=distance;
 }
 return result;
}
