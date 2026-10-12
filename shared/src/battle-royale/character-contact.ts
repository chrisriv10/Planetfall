import type {Vec3} from "../index.js";

type CharacterContacts={computedGrounded():boolean;numComputedCollisions():number;computedCollision(index:number):{normal1:Vec3}|null};

/** Numerical wall sliding can shorten a downward move by a few millimetres.
 * That alone is not a landing: the fallback must also have a walkable normal.
 * Keep the same climb angle as the authoritative/predicted Rapier controller. */
export function brControllerGrounded(controller:CharacterContacts,desired:Vec3,actual:Vec3):boolean {
  if(controller.computedGrounded())return true;
  if(desired.y>0||actual.y<=desired.y+.004)return false;
  for(let index=0;index<controller.numComputedCollisions();index++){
    if((controller.computedCollision(index)?.normal1.y??0)>=Math.cos(Math.PI*.32))return true;
  }
  return false;
}
