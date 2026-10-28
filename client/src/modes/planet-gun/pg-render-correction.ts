import type {Vec3} from "@planetfall/shared";

/** Simulation corrects immediately. Only the camera retains a short visual offset.
 * Native baseline corrections were <=8cm; large/stale divergences always snap. */
export class PgRenderCorrection {
 readonly offset:Vec3={x:0,y:0,z:0};
 correct(before:Vec3,after:Vec3,continuous=true):boolean{
  const dx=before.x-after.x,dy=before.y-after.y,dz=before.z-after.z;
  if(!continuous||![dx,dy,dz].every(Number.isFinite)||Math.hypot(dx,dy,dz)>=.75||Math.abs(dy)>.4){this.reset();return false;}
  this.offset.x+=dx;this.offset.y+=dy;this.offset.z+=dz;
  if(Math.hypot(this.offset.x,this.offset.y,this.offset.z)>=.75){this.reset();return false;}
  return true;
 }
 update(dt:number):void{
  const decay=Math.exp(-Math.max(0,Math.min(.25,dt))/.035);
  this.offset.x*=decay;this.offset.y*=decay;this.offset.z*=decay;
  if(Math.hypot(this.offset.x,this.offset.y,this.offset.z)<.0001)this.reset();
 }
 reset():void{this.offset.x=this.offset.y=this.offset.z=0;}
}
