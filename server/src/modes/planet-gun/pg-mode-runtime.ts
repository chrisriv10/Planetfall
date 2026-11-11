import type {PgInput,PgLoadout,PgModeAction,PgModeActionResult,PgModeSnapshot,PgPlayer,PgTeam,PgWeaponId,PgMovementRules,PgShot,PgCombatModifiers,Vec3} from "@planetfall/shared";
import type {PgModeWorld} from "./pg-mode-world.js";

export interface PgModeContext {
 players:Map<string,PgPlayer>;world:PgModeWorld;
 selections?:ReadonlyMap<string,string>;
 selectedLoadouts?:ReadonlyMap<string,PgLoadout>;
 emitShot?:(shot:PgShot)=>void;
 respawn:(player:PgPlayer,now:number,loadout?:PgLoadout,position?:Vec3)=>void;
 damage:(target:PgPlayer,attacker:PgPlayer|null,amount:number,now:number)=>number;
 finish:(winner:PgTeam|null)=>void;
}
export interface PgModeTarget {id:string;kind:"panel"|"gadget"|"zombie";position:Vec3;half?:Vec3;crouched?:boolean;damage:(amount:number,shooter:PgPlayer,now:number)=>number;}
export interface PgModeRuntime {
 readonly id:Exclude<PgModeSnapshot["id"],never>;
 start(now:number):void;update(dt:number,now:number):void;
 snapshot(viewerId?:string):PgModeSnapshot;
 action(player:PgPlayer,action:PgModeAction,now:number):PgModeActionResult;
 canMove(player:PgPlayer):boolean;canFire(player:PgPlayer):boolean;
 movement(player:PgPlayer):PgMovementRules;
 maxHp(player:PgPlayer):number;
 damage(target:PgPlayer,attacker:PgPlayer|null,amount:number,now:number):number;
 eliminated(player:PgPlayer,killer:PgPlayer|null,weapon:PgWeaponId,now:number):void;
 botGoal(player:PgPlayer,now:number):Vec3|null;
 /** Optional physically validated immediate steering; null means wait safely. */
 botWaypoint?(player:PgPlayer,goal:Vec3|null):Vec3|null;
 /** Bound combat sidesteps to the public objective already being held. */
 botCombatArea?(player:PgPlayer):{position:Vec3;radius:number}|null;
 botAction(player:PgPlayer,now:number):void;
 targets(shooter:PgPlayer):PgModeTarget[];
 leave(id:string,now:number):void;
 allowSlot?(player:PgPlayer,slot:0|1):boolean;
 visible?(from:Vec3,to:Vec3):boolean;
 viewOrigin?(player:PgPlayer):Vec3|null;
 weaponModifiers?(player:PgPlayer,now:number):PgCombatModifiers;
}
