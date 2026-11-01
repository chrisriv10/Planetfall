import type {Vec3} from "../index.js";
import type {PgModeEffect} from "./modes.js";
/** The same finite smoke volumes obscure humans, labels and bot sensing at every quality. */
export function pgSmokeClear(effects:readonly PgModeEffect[],from:Vec3,to:Vec3,at?:number):boolean{
 const x=to.x-from.x,y=to.y-from.y,z=to.z-from.z,length2=x*x+y*y+z*z;
 for(const e of effects){if(e.kind!=="smoke"||at!==undefined&&(at<e.startsAt||at>=e.endsAt))continue;const t=length2?Math.max(0,Math.min(1,((e.position.x-from.x)*x+(e.position.y-from.y)*y+(e.position.z-from.z)*z)/length2)):0;if(Math.hypot(from.x+x*t-e.position.x,from.y+y*t-e.position.y,from.z+z*t-e.position.z)<e.radius)return false;}
 return true;
}
