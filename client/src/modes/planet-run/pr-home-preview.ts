import * as THREE from "three";
import { createAstronautVisual } from "../../astronaut";
import { createAstronautMotion } from "../../astronaut-motion";

/** Purpose-built miniature; no world renderer, game simulation, lights or physics. */
export class PrHomePreview {
  readonly root=new THREE.Group();
  private readonly course=new THREE.Group();
  private readonly sweeper=new THREE.Group();
  private readonly astronaut=createAstronautVisual({identityColor:"#91eed8",suitAccent:"#91eed8",isBot:false});
  private readonly motion=createAstronautMotion(this.astronaut);
  private readonly geometries=new Set<THREE.BufferGeometry>();
  private readonly materials=new Set<THREE.Material>();
  private lastTime:number|null=null;
  private disposed=false;

  constructor(){
    this.root.name="planet-run-home-preview";this.root.add(this.course);
    const box=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,24);
    const hex=new THREE.CylinderGeometry(.72,.72,.28,6);
    this.geometries.add(box);this.geometries.add(cylinder);this.geometries.add(hex);
    const material=(color:number,emissive=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.56,metalness:.15,emissive:color,emissiveIntensity:emissive});this.materials.add(m);return m;};
    const coral=material(0xff8c76),dark=material(0x253b5e),white=material(0xe8f2f4),mint=material(0x9fffe0,.4),purple=material(0xad9be5);
    const mesh=(geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,parent:THREE.Object3D=this.course)=>{
      const object=new THREE.Mesh(geo,mat);object.position.set(x,y,z);object.scale.set(sx,sy,sz);parent.add(object);return object;
    };
    mesh(cylinder,dark,0,-.8,0,5.1,.8,5.1);
    mesh(cylinder,coral,0,-.25,0,5,.3,5);
    mesh(cylinder,white,0,-.08,0,4.7,.04,4.7);
    mesh(cylinder,dark,0,-.045,0,4.3,.025,4.3);
    // Perimeter route tiles communicate the collapsing-floor finale at miniature scale.
    for(let i=0;i<16;i++) {const a=i*Math.PI/8;mesh(hex,i%3===0?purple:mint,Math.sin(a)*3.65,.08,Math.cos(a)*3.65,1,1,1);}
    mesh(cylinder,dark,0,-1.6,0,3.8,1,3.8);
    mesh(cylinder,mint,0,-2.16,0,2.5,.12,2.5);
    for(const x of [-2.1,2.1]){mesh(box,coral,x,1.45,-3.2,.45,3,.5);mesh(box,mint,x,1.45,-2.93,.17,2.5,.05);}
    mesh(box,white,0,3,-3.2,4.7,.6,.7);
    for(let i=-3;i<=3;i++)mesh(box,i%2?dark:mint,i*.55,3.02,-2.84,.55,.35,.04);
    this.course.add(this.sweeper);this.sweeper.position.y=.45;
    mesh(box,coral,0,0,0,6.3,.35,.45,this.sweeper);
    mesh(cylinder,white,0,.15,0,.65,.6,.65,this.sweeper);
    for(const x of [-3,3])mesh(box,mint,x,0,0,.3,.37,.47,this.sweeper);
    this.astronaut.group.scale.setScalar(.85);this.course.add(this.astronaut.group);
    this.astronaut.group.traverse(o=>{if(o instanceof THREE.Mesh){this.geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])this.materials.add(m);}});
    this.update(0);
  }

  update(timeSeconds:number):void{
    if(this.disposed)return;
    const dt=this.lastTime===null?1/60:THREE.MathUtils.clamp(timeSeconds-this.lastTime,0,.05);this.lastTime=timeSeconds;
    this.course.rotation.y=.25+Math.sin(timeSeconds*.17)*.22;
    this.sweeper.rotation.y=-timeSeconds*.65;
    const a=timeSeconds*.55,hop=Math.max(0,Math.sin(timeSeconds*1.7));
    this.astronaut.group.position.set(Math.sin(a)*2.8,.25+hop*.8,Math.cos(a)*2.8);
    this.astronaut.group.rotation.y=a+Math.PI/2;
    const input=this.motion.input;input.dt=dt;input.timeSeconds=timeSeconds;input.forwardSpeed=3.5;input.grounded=hop<.08;input.verticalSpeed=Math.cos(timeSeconds*1.7)*1.36;
    this.motion.update();
  }

  dispose():void{
    if(this.disposed)return;this.disposed=true;
    for(const geometry of this.geometries)geometry.dispose();
    for(const material of this.materials)material.dispose();
    this.root.clear();this.root.removeFromParent();
  }
}
