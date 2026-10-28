import * as THREE from "three";
import {PG_MAP,PG_BALANCE,pgRayBox,type PgSnapshot,type PgSolid,type Vec3} from "@planetfall/shared";

type Pilot=Pick<PgSnapshot["players"][number],"id"|"team"|"hp"|"name"|"position"|"crouched">;
export function pgFriendlyNameOpacity(p:Pick<Pilot,"id"|"team"|"hp">,me:Pick<Pilot,"id"|"team"|"hp">,distance:number,occluded:boolean):number{
 if(p.id===me.id||p.team!==me.team||p.hp<=0||me.hp<=0||occluded||!Number.isFinite(distance)||distance>=30)return 0;
 return distance<=15?1:1-(distance-15)/15*.8;
}
export function pgNameOccluded(eye:Vec3,target:Vec3,solids:readonly PgSolid[]=PG_MAP.solids):boolean{
 const dx=target.x-eye.x,dy=target.y-eye.y,dz=target.z-eye.z,distance=Math.hypot(dx,dy,dz);if(distance<.01)return false;
 const direction={x:dx/distance,y:dy/distance,z:dz/distance};
 return solids.some(s=>{const hit=pgRayBox(eye,direction,s);return hit!==null&&hit<distance-.12;});
}
/** At most five living friendly labels. Canvas textures change only with identity. */
export function createPgFriendlyNames(solids:readonly PgSolid[]=PG_MAP.solids){
 const root=new THREE.Group();root.name="pg-friendly-nameplates";
 const labels=new Map<string,{name:string;sprite:THREE.Sprite;texture:THREE.CanvasTexture;width:number;blocked:boolean;checkAt:number}>();
 const projected=new THREE.Vector3(),sightTarget=new THREE.Vector3();let visible=0;
 const remove=(id:string)=>{const item=labels.get(id);if(!item)return;item.sprite.removeFromParent();item.sprite.material.dispose();item.texture.dispose();labels.delete(id);};
 return {root,
  update(players:readonly Pilot[],me:Pilot,camera:THREE.PerspectiveCamera,time:number,viewportHeight:number,positionFor?:(id:string)=>Vec3|undefined){
   visible=0;
   for(const [id]of labels)if(!players.some(p=>p.id===id&&p.team===me.team&&p.hp>0))remove(id);
   for(const p of players){
    if(p.id===me.id||p.team!==me.team||p.hp<=0)continue;
    let label=labels.get(p.id);if(label&&label.name!==p.name){remove(p.id);label=undefined;}
    if(!label){
     if(labels.size>=5)continue;
     const canvas=document.createElement("canvas"),context=canvas.getContext("2d");if(!context)continue;
     context.font="700 28px Arial";const width=Math.ceil(context.measureText(p.name).width)+30;canvas.width=width;canvas.height=62;
     context.fillStyle="rgba(5,13,33,.85)";context.beginPath();context.roundRect(1,1,width-2,42,8);context.fill();context.strokeStyle="#80eaff";context.lineWidth=2;context.stroke();
     context.font="700 28px Arial";context.fillStyle="#f5fbff";context.textAlign="center";context.fillText(p.name,width/2,31);
     context.fillStyle="#80eaff";context.beginPath();context.moveTo(width/2-6,48);context.lineTo(width/2+6,48);context.lineTo(width/2,56);context.fill();
     const texture=new THREE.CanvasTexture(canvas),material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,toneMapped:false});texture.colorSpace=THREE.SRGBColorSpace;
     const sprite=new THREE.Sprite(material);sprite.name="friendly-"+p.id;sprite.userData.cameraCollision=false;root.add(sprite);label={name:p.name,sprite,texture,width,blocked:false,checkAt:0};labels.set(p.id,label);
    }
    const renderedPosition=positionFor?.(p.id),pos=renderedPosition??p.position;label.sprite.position.set(pos.x,pos.y+(p.crouched?1.95:2.3),pos.z);
    const distance=camera.position.distanceTo(label.sprite.position);
    if(time>=label.checkAt){sightTarget.set(pos.x,pos.y-(renderedPosition?(p.crouched?.04:.25):0)+(p.crouched?PG_BALANCE.crouchEye:PG_BALANCE.eye),pos.z);label.blocked=pgNameOccluded(camera.position,sightTarget,solids);label.checkAt=time+100;}
    let opacity=pgFriendlyNameOpacity(p,me,distance,label.blocked);
    projected.copy(label.sprite.position).project(camera);
    // No friendly text over the aiming point or behind the camera.
    const reticleOverlap=Math.abs(projected.x)*camera.aspect*viewportHeight/2<label.width*.25+12&&Math.abs(projected.y)*viewportHeight/2<27;
    if(projected.z< -1||projected.z>1||Math.abs(projected.x)>1.1||Math.abs(projected.y)>1.1||reticleOverlap)opacity=0;
    label.sprite.visible=opacity>0;label.sprite.material.opacity=opacity;if(!opacity)continue;visible++;
    const pixelScale=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*distance/Math.max(1,viewportHeight),size=distance<15?1:1-(distance-15)/15*.15;
    label.sprite.scale.set(label.width*.5*pixelScale*size,31*pixelScale*size,1);
   }
  },stats:()=>({allocated:labels.size,visible}),clear(){for(const [id]of labels)remove(id);},dispose(){for(const [id]of labels)remove(id);root.removeFromParent();}
 };
}
