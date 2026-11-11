import {pgLeanEye,pgRayBox,type PgMap,type PgMotion,type PgSnapshot,type PgSnapshotPlayer,type Vec3} from "@planetfall/shared";

export interface PgCameraPose {kind:"local"|"spectator";targetId:string|null;position:Vec3;yaw:number;pitch:number;}
/** Camera ownership is separate from movement, spectator targets and new lives. */
export class PgCameraLifecycle {
 private viewer="";private life=-1;private alive=true;private target:string|null=null;private orbitYaw=0;private orbitPitch=-.18;
 get targetId(){return this.target;}
 sync(me:Pick<PgSnapshotPlayer,"id"|"lifeId"|"hp">,yaw:number):void{
  const alive=me.hp>0;
  if(this.viewer!==me.id||this.life!==me.lifeId||alive!==this.alive){this.viewer=me.id;this.life=me.lifeId;this.alive=alive;this.target=null;this.orbitYaw=yaw;this.orbitPitch=-.18;}
 }
 private candidates(s:PgSnapshot,me:PgSnapshotPlayer){return s.players.filter(p=>p.id!==me.id&&p.team===me.team&&p.hp>0&&(p.connected||p.isBot));}
 cycle(s:PgSnapshot,me:PgSnapshotPlayer,direction:1|-1):void{
  if(me.hp>0)return;const candidates=this.candidates(s,me);if(!candidates.length){this.target=null;return;}
  const index=candidates.findIndex(p=>p.id===this.target);this.target=candidates[(index<0?0:(index+direction+candidates.length)%candidates.length)].id;
 }
 look(dx:number,dy:number,sensitivity:number,invertY:boolean):void{this.orbitYaw-=dx*sensitivity;this.orbitPitch=Math.max(-.8,Math.min(.45,this.orbitPitch-dy*sensitivity*(invertY?-1:1)));}
 pose(s:PgSnapshot,me:PgSnapshotPlayer,motion:PgMotion,yaw:number,pitch:number,offset:Vec3,map:PgMap):PgCameraPose{
  this.sync(me,yaw);
  if(me.hp>0){const eye=pgLeanEye(motion);return {kind:"local",targetId:null,position:{x:eye.x+offset.x,y:eye.y+offset.y,z:eye.z+offset.z},yaw,pitch};}
  const candidates=this.candidates(s,me);let followed=candidates.find(p=>p.id===this.target);
  if(!followed){followed=candidates[0];this.target=followed?.id??null;}
  const base=followed?.position??me.position,focus={x:base.x,y:base.y+1.1,z:base.z};
  let position:Vec3|undefined,best=-Infinity;
  // Try nearby viewing directions rather than pushing a blocked boom into a helmet.
  for(const turn of [0,Math.PI/3,-Math.PI/3,Math.PI]){
   const angle=this.orbitYaw+turn,c=Math.cos(this.orbitPitch),direction={x:Math.sin(angle)*c,y:-Math.sin(this.orbitPitch),z:Math.cos(angle)*c};
   let length=4.2;
   for(const solid of map.solids){const hit=pgRayBox(focus,direction,solid);if(hit!==null)length=Math.min(length,Math.max(0,hit-.18));}
   const score=length-(turn===0?0:.5);if(length>=1.05&&score>best){position={x:focus.x+direction.x*length,y:focus.y+direction.y*length,z:focus.z+direction.z*length};best=score;if(turn===0&&length>=3.5)break;}
  }
  // Standing headroom supplies a safe high fallback in a cramped corner.
  position??={x:base.x,y:base.y+2.35,z:base.z};
  const dx=focus.x-position.x,dy=focus.y-position.y,dz=focus.z-position.z;
  return {kind:"spectator",targetId:this.target,position,yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(dy,Math.max(.0001,Math.hypot(dx,dz)))};
 }
 reset():void{this.viewer="";this.life=-1;this.alive=true;this.target=null;this.orbitYaw=0;this.orbitPitch=-.18;}
}
