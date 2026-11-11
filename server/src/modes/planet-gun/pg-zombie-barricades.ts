import type {PgDynamicPanel,PgSolid,Vec3} from "@planetfall/shared";

export const PG_ZOMBIE_BARRICADE_BOARD_HP=30;
export const PG_ZOMBIE_BARRICADE_BOARD_COUNT=3;
export interface PgZombieBarricadeSite {id:string;boards:readonly {id:string;solid:PgSolid}[];}
export interface PgZombieBarricadeOccupant {position:Vec3;radius:number;height:number;}
export interface PgZombieBarricadeWorld {
 panel(id:string):PgDynamicPanel|null;
 damage(id:string,amount:number,now:number,breaching?:boolean):number;
 rebuild(id:string,now:number):boolean;
 repair(id:string,amount:number,now:number):number;
}
export interface PgZombieBarricadeStatus {
 id:string;remaining:number;total:number;hp:number;maxHp:number;
 boards:{id:string;active:boolean;hp:number;maxHp:number}[];
}
const finitePosition=(position:Vec3)=>!!position&&[position.x,position.y,position.z].every(Number.isFinite);
const validTime=(now:number)=>Number.isFinite(now)&&now>=0;
/** Standing capsule footprint against a board box, including touching edges. */
function occupied(solid:PgSolid,occupants:readonly PgZombieBarricadeOccupant[]):boolean {
 return occupants.some(({position,radius,height})=>{
  if(position.y>solid.center.y+solid.half.y||position.y+height<solid.center.y-solid.half.y)return false;
  const dx=Math.max(0,Math.abs(position.x-solid.center.x)-solid.half.x),dz=Math.max(0,Math.abs(position.z-solid.center.z)-solid.half.z);
  return Math.hypot(dx,dz)<=radius;
 });
}

/** Reads board health from room authority; each mutation touches at most one board. */
export class PgZombieBarricades {
 private sites=new Map<string,PgZombieBarricadeSite>();
 constructor(sites:readonly PgZombieBarricadeSite[],private world:PgZombieBarricadeWorld){
  const ids=new Set<string>(),solidIds=new Set<string>();
  for(const site of sites){
   if(!site||typeof site.id!=="string"||!site.id.trim()||this.sites.has(site.id)||!Array.isArray(site.boards)||site.boards.length!==PG_ZOMBIE_BARRICADE_BOARD_COUNT)throw Error("Barricade sites require unique ids and exactly three boards");
   for(const board of site.boards){
    const solid=board?.solid;
    if(!board||typeof board.id!=="string"||!board.id.trim()||ids.has(board.id)||!solid||typeof solid.id!=="string"||!solid.id.trim()||solidIds.has(solid.id)||!finitePosition(solid.center)||!finitePosition(solid.half)||[solid.half.x,solid.half.y,solid.half.z].some(n=>n<=0))throw Error("Barricade boards require unique ids and finite positive box geometry");
    ids.add(board.id);solidIds.add(solid.id);
   }
   this.sites.set(site.id,structuredClone(site));
  }
 }
 initialPanels():PgDynamicPanel[]{
  return [...this.sites.values()].flatMap(site=>site.boards.map(board=>({id:board.id,solid:structuredClone(board.solid),hp:PG_ZOMBIE_BARRICADE_BOARD_HP,maxHp:PG_ZOMBIE_BARRICADE_BOARD_HP,active:true,reinforced:false,revision:0})));
 }
 status(siteId:string):PgZombieBarricadeStatus|null {
  const site=this.sites.get(siteId);if(!site)return null;
  const boards=site.boards.map(board=>{
   const panel=this.world.panel(board.id);
   return {id:board.id,active:!!panel?.active&&panel.hp>0,hp:panel?.active?panel.hp:0,maxHp:panel?.maxHp??PG_ZOMBIE_BARRICADE_BOARD_HP};
  });
  return {id:siteId,remaining:boards.filter(board=>board.active).length,total:site.boards.length,hp:boards.reduce((hp,board)=>hp+board.hp,0),maxHp:boards.reduce((hp,board)=>hp+board.maxHp,0),boards};
 }
 nextBoard(siteId:string):PgDynamicPanel|null {
  const site=this.sites.get(siteId);if(!site)return null;
  for(const board of site.boards){const panel=this.world.panel(board.id);if(panel?.active&&panel.hp>0)return panel;}
  return null;
 }
 damage(siteId:string,amount:number,now:number):number {
  if(!Number.isFinite(amount)||amount<=0||!validTime(now))return 0;
  const panel=this.nextBoard(siteId);return panel?this.world.damage(panel.id,Math.min(amount,panel.hp),now):0;
 }
 private repairTarget(siteId:string,occupants:readonly PgZombieBarricadeOccupant[]):PgDynamicPanel|null {
  const site=this.sites.get(siteId);if(!site||!Array.isArray(occupants)||occupants.some(body=>!body||!finitePosition(body.position)||!Number.isFinite(body.radius)||body.radius<=0||!Number.isFinite(body.height)||body.height<=0))return null;
  const boards=site.boards.map(board=>this.world.panel(board.id)).filter((panel):panel is PgDynamicPanel=>!!panel);
  const missing=boards.find(panel=>!panel.active);
  if(missing)return occupied(missing.solid,occupants)?null:missing;
  return boards.find(panel=>panel.active&&panel.hp<panel.maxHp)??null;
 }
 canRepair(siteId:string,occupants:readonly PgZombieBarricadeOccupant[]):boolean {return this.repairTarget(siteId,occupants)!==null;}
 repair(siteId:string,occupants:readonly PgZombieBarricadeOccupant[],now:number):boolean {
  if(!validTime(now))return false;
  const panel=this.repairTarget(siteId,occupants);if(!panel)return false;
  return panel.active?this.world.repair(panel.id,panel.maxHp-panel.hp,now)>0:this.world.rebuild(panel.id,now);
 }
}
