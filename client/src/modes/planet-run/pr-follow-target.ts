import type {CameraShake} from "../../settings";

interface Point {x:number;y:number;z:number}
/** Filter correction/impact jitter in the look target, never the player's input
 * angles. Large relocations and new subjects snap instead of crossing the void. */
export function updatePrFollowTarget(current:Point,next:Readonly<Point>,dt:number,shake:CameraShake,snap=false):void {
 const dx=next.x-current.x,dy=next.y-current.y,dz=next.z-current.z;
 if(snap||dx*dx+dy*dy+dz*dz>225){Object.assign(current,next);return;}
 const step=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));
 const horizontal=1-Math.exp(-18*step),vertical=1-Math.exp(-(shake==="off"?7:shake==="reduced"?9:11)*step);
 current.x+=dx*horizontal;current.z+=dz*horizontal;
 // A large drop must take the look target through the deck with the pilot,
 // rather than leaving the camera looking at an opaque upper floor.
 current.y=Math.abs(dy)>1.5?next.y:current.y+dy*vertical;
}
