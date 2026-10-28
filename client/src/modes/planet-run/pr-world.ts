import {createPrMeteorArt} from "./pr-meteor-art";
import * as THREE from "three";
import {prMeteorTimeline,prObstacleTransform,prObstacleCenter,prPlatformCenter,type PrRoundDefinition,type PrPhase} from "@planetfall/shared";
import {createPrCargoArt} from "./art/pr-art-cargo";
import {createPrSolarArt} from "./art/pr-art-solar";
import {createPrMeteorArtCourse} from "./art/pr-art-meteor";
import {createPrFluxArt} from "./art/pr-art-flux";
import {createPrCapacitorArt} from "./art/pr-art-capacitor";
import {createPrShatterdeckArt} from "./art/pr-art-shatterdeck";
import {createPrSkyArt} from "./art/pr-sky-art";
import {createPrBackdrop} from "./art/pr-backdrop";
import {createPrCellArt} from "./art/pr-cell-art";
import {createPrCountdownArt} from "./art/pr-countdown-art";
import {PR_ART_PALETTES,type PrRoundArt,type PrArtContext,type PrArtQuality} from "./art/pr-art-shared";

/** Authority supplies all support volumes, moving platforms and hazard transforms.
 * Round modules own only their visual shell, ambient motion and pooled effects. */
export class PrWorldRenderer {
  readonly root=new THREE.Group();
  private readonly geometries:THREE.BufferGeometry[]=[];
  private readonly materials:THREE.Material[]=[];
  private readonly box=this.geometry(new THREE.BoxGeometry(1,1,1));
  private readonly cylinder=this.geometry(new THREE.CylinderGeometry(1,1,1,12));
  private readonly platforms:THREE.Group[]=[];
  private readonly obstacles:{body:THREE.Group;meteor?:ReturnType<typeof createPrMeteorArt>;openMark?:THREE.Group}[]=[];
  private readonly batches:THREE.InstancedMesh[]=[];
  private readonly art:PrRoundArt;
  private readonly sky:ReturnType<typeof createPrSkyArt>;
  private readonly backdrop:ReturnType<typeof createPrBackdrop>;
  private readonly countdown:ReturnType<typeof createPrCountdownArt>;
  private readonly cells:ReturnType<typeof createPrCellArt>|null;
  private disposed=false;
  constructor(private readonly round:PrRoundDefinition){
    this.root.name="planet-run-"+round.id;
    const palette=PR_ART_PALETTES[round.id],deck=this.material(palette.primary),frame=this.material(palette.dark),cream=this.material(palette.white),ink=this.material(0x17273c),glow=this.material(palette.glow,.65),hazard=this.material(palette.hazard,.18),passage=this.material(0x83fff2,.65);
    const solid=(parent:THREE.Object3D,material:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{const mesh=new THREE.Mesh(this.box,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    const platformGroups=new Map<string,THREE.Group>(),obstacleGroups=new Map<string,THREE.Group>(),surfaces=new Map<string,THREE.Mesh>(),volumes=new Map<string,THREE.Mesh>();
    for(const p of round.platforms){const group=new THREE.Group();group.name=p.id;this.root.add(group);this.platforms.push(group);platformGroups.set(p.id,group);const surface=solid(group,deck,0,0,0,p.half.x*2,p.half.y*2,p.half.z*2);surface.name="authoritative-platform";surfaces.set(p.id,surface);}
    for(const o of round.obstacles){
      const body=new THREE.Group();body.name=o.id;body.position.copy(o.center);this.root.add(body);obstacleGroups.set(o.id,body);
      let meteor:ReturnType<typeof createPrMeteorArt>|undefined,openMark:THREE.Group|undefined;
      if(o.kind==="meteor"){meteor=createPrMeteorArt(o.half);body.add(meteor.root);}
      else if(o.kind==="boost")solid(body,glow,0,.025,0,o.half.x*2,.05,o.half.z*2);
      else{const volume=solid(body,hazard,0,0,0,o.half.x*2,o.half.y*2,o.half.z*2);volume.name="authoritative-hazard";volumes.set(o.id,volume);}
      if(o.kind==="door"||o.kind==="shutter"){
        openMark=new THREE.Group();openMark.name=o.id+"-open-passage";openMark.position.copy(o.center);this.root.add(openMark);
        const support=round.platforms.find(p=>Math.abs(p.center.z-o.center.z)<p.half.z&&Math.abs(p.center.x-o.center.x)<p.half.x);
        const paintY=(support?support.center.y+support.half.y:o.center.y-o.half.y)-o.center.y+.018;
        for(const x of[-o.half.x+.55,o.half.x-.55])solid(openMark,passage,x,paintY,0,.5,.014,o.half.z*2);
        for(const side of[-1,1]){const arrow=solid(openMark,passage,side*.3,paintY,0,.15,.014,.9);arrow.rotation.y=side*Math.PI/4;}
        this.batchDecoration(openMark);
      }
      this.obstacles.push({body,meteor,openMark});
    }
    const context:PrArtContext={round,root:this.root,platforms:platformGroups,obstacles:obstacleGroups,surfaces,hazardVolumes:volumes};
    const factories={"cargo-cyclone":createPrCargoArt,"solar-sweep":createPrSolarArt,"meteor-garden":createPrMeteorArtCourse,"flux-gardens":createPrFluxArt,"capacitor-causeway":createPrCapacitorArt,shatterdeck:createPrShatterdeckArt};
    this.art=factories[round.id](context);
    this.buildFacility(deck,frame,cream,ink,glow);
    this.sky=createPrSkyArt(round);this.root.add(this.sky.root);
    this.backdrop=createPrBackdrop(round);this.root.add(this.backdrop.root);
    this.cells=round.tiles.length?createPrCellArt(round):null;if(this.cells)this.root.add(this.cells.root);
    this.countdown=createPrCountdownArt(round);this.root.add(this.countdown.root);
    this.batchDecoration(this.root);this.update(0,0,new Map());this.setQuality("medium");
  }
  update(elapsedMs:number,seed:number,tileState:ReadonlyMap<number,number>):void{
    if(this.disposed)return;
    for(let i=0;i<this.platforms.length;i++)this.platforms[i].position.copy(prPlatformCenter(this.round.platforms[i],elapsedMs));
    for(let i=0;i<this.obstacles.length;i++){
      const o=this.round.obstacles[i],view=this.obstacles[i],state=prObstacleTransform(o,elapsedMs,seed);
      view.body.userData.prHazardActive=state.active;
      view.body.position.copy(prObstacleCenter(o,elapsedMs,seed));
      view.body.visible=o.kind==="boost"||state.active||["meteor","shutter","arc"].includes(o.kind)&&state.warning;
      view.body.rotation.y=o.kind==="rotator"?-state.yaw:0;
      if(view.openMark)view.openMark.visible=!state.active;
      view.meteor?.update(state.active,state.warning,elapsedMs,prMeteorTimeline(o,elapsedMs,seed));
    }
    this.cells?.update(elapsedMs,tileState);this.art.update(elapsedMs,seed,tileState);this.sky.update(elapsedMs);this.backdrop.update(elapsedMs);
  }
  setPhase(phase:PrPhase,seconds:number,elapsedMs:number):void{this.countdown.update(phase,seconds,elapsedMs);}
  setQuality(q:PrArtQuality):void{this.art.setQuality(q);this.sky.setQuality(q);this.backdrop.setQuality(q);this.cells?.setQuality(q);this.countdown.setQuality(q);}
  dispose():void{if(this.disposed)return;this.disposed=true;this.art.dispose();this.sky.dispose();this.backdrop.dispose();this.cells?.dispose();this.countdown.dispose();for(const o of this.obstacles)o.meteor?.dispose();for(const batch of this.batches)batch.dispose();for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();this.root.clear();this.root.removeFromParent();}
  private geometry<T extends THREE.BufferGeometry>(geometry:T):T{this.geometries.push(geometry);return geometry;}
  private buildFacility(deck:THREE.Material,frame:THREE.Material,cream:THREE.Material,ink:THREE.Material,glow:THREE.Material):void {
    const facility=new THREE.Group();facility.name=`signature-${this.round.id}`;this.root.add(facility);
    if(this.round.id==="shatterdeck"){
      // The authored open containment replaces the old thick duplicate cage.
      const containment=this.root.getObjectByName("shatterdeck-final-containment");if(containment)facility.add(containment);
      return;
    }
    const leaf=this.material(this.round.id==="meteor-garden"?0x59b894:0x9c88ca);
    const leafTip=this.material(this.round.id==="meteor-garden"?0xa4dbc0:0xd9c7ef);
    const sphere=this.geometry(new THREE.IcosahedronGeometry(1,1));
    const ring=this.geometry(new THREE.TorusGeometry(1,.045,6,48));
    const shape=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{
      const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);facility.add(mesh);return mesh;
    };
    const box=(mat:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>shape(this.box,mat,x,y,z,sx,sy,sz);
    const drum=(mat:THREE.Material,x:number,y:number,z:number,r:number,h:number)=>shape(this.cylinder,mat,x,y,z,r,h,r);
    const hoop=(mat:THREE.Material,x:number,y:number,z:number,r:number,flat=false)=>{const mesh=shape(ring,mat,x,y,z,r,r,r);if(flat)mesh.rotation.x=Math.PI/2;return mesh;};
    // Background assemblies stand across an unbridgeable gap. Nothing suggests a new playable ledge.
    if(this.round.id==="cargo-cyclone") {
      for(const side of [-1,1]) {
        const x=side*34;
        box(frame,x,-7,-48,15,3,150); // continuous freight dock, rather than detached props
        for(const z of [8,-34,-78,-120]) {
          for(const dx of [-5.8,5.8]) {box(deck,x+dx,2,z,1.6,18,2);box(cream,x+dx,3,z+.99,1.1,10,.08);}
          box(deck,x,10,z,14,2.2,3);box(ink,x,8.7,z,10,.5,1.5);
          box(cream,x+side*2,6.6,z,2.3,3.5,2.3);box(glow,x+side*2,4.6,z,3,.25,3);
          for(let level=0;level<2;level++)for(let row=0;row<2;row++) {
            const cx=x+(row-.5)*5.5,cz=z-8;
            box(level?cream:deck,cx,-3+level*3.2,cz,4.7,2.9,7);
            for(const offset of [-2,0,2])box(frame,cx,-3+level*3.2,cz+offset,4.78,2.95,.12);
            box(glow,cx,-2.7+level*3.2,cz+3.55,2,.12,.05);
          }
        }
        // Docked stub-wing tug, with a sealed cockpit and paired engine nacelles.
        shape(sphere,cream,x,1,-59,4,2.4,8);
        shape(sphere,ink,x,2,-64,2.6,1.8,3.2);
        box(deck,x,0,-57,14,.8,5);
        for(const dx of [-4.8,4.8]){const engine=drum(frame,x+dx,.2,-55,1.4,6);engine.rotation.x=Math.PI/2;const nozzle=drum(glow,x+dx,.2,-51.9,1.05,.18);nozzle.rotation.x=Math.PI/2;}
      }
    }else if(this.round.id==="solar-sweep") {
      for(let i=0;i<6;i++) {
        const a=i*Math.PI/3,x=Math.cos(a)*43,z=Math.sin(a)*43;
        drum(frame,x,-7,z,6,10);drum(cream,x,-1.2,z,5,1.2);
        const wheel=new THREE.Group();wheel.position.set(x,7,z);wheel.rotation.y=-a+Math.PI/2;facility.add(wheel);
        const core=new THREE.Mesh(this.cylinder,cream);core.rotation.x=Math.PI/2;core.scale.set(2,3,2);wheel.add(core);
        const rim=new THREE.Mesh(ring,glow);rim.scale.setScalar(10);wheel.add(rim);
        for(let petal=0;petal<8;petal++) {
          const angle=petal*Math.PI/4;
          const blade=new THREE.Mesh(this.box,deck);blade.position.set(Math.sin(angle)*6,Math.cos(angle)*6,0);blade.scale.set(3.5,5.7,.5);blade.rotation.z=-angle;wheel.add(blade);
          const cell=new THREE.Mesh(this.box,ink);cell.position.copy(blade.position);cell.position.z=.3;cell.scale.set(2.8,4.7,.12);cell.rotation.z=-angle;wheel.add(cell);
        }
        this.batchDecoration(wheel);
      }
    }else if(this.round.id==="meteor-garden"||this.round.id==="flux-gardens") {
      const flux=this.round.id==="flux-gardens";
      for(const side of [-1,1])for(let i=0;i<(flux?4:3);i++) {
        const x=side*(flux?34:40),z=flux?5-i*40:(i-1)*30;
        drum(frame,x,-7,z,10,8);drum(cream,x,-2.9,z,9.7,.7);drum(ink,x,-2.45,z,9,.25);
        // Authored clustered canopies grow from a common bed, with readable branch junctions.
        for(const [dx,dz,h] of [[-3,-2,8],[3,1,6],[0,4,9]]) {
          drum(cream,x+dx,h/2-2.4,z+dz,.65,h);
          for(const branch of [-1,1]) {
            const limb=drum(cream,x+dx+branch*.85,h-4,z+dz,.28,3.2);limb.rotation.z=branch*-.6;
            shape(sphere,leaf,x+dx+branch*1.8,h-1.6,z+dz,3.1,2.3,3);
          }
          shape(sphere,leafTip,x+dx,h+.3,z+dz,2.8,2.1,2.7);
        }
        if(flux) {
          hoop(cream,x,5,z,12);hoop(glow,x,5,z+.2,11.6);
          for(const sideOffset of [-1,1]) {const crystal=shape(sphere,glow,x+sideOffset*7,8,z,1,2.6,1);crystal.rotation.z=sideOffset*.4;}
          hoop(deck,x,-1.5,z,9.6,true);
        }else {
          // Curved rib canopy encloses the growing bed; repeated ribs belong to one conservatory.
          const archGeo=this.geometry(new THREE.TorusGeometry(11,.23,6,28,Math.PI));
          for(const dz of [-5,0,5])shape(archGeo,cream,x,-2,z+dz,1,1,1);
          box(frame,x,8.8,z,.5,.5,12);
        }
      }
    }else if(this.round.id==="capacitor-causeway") {
      for(const side of [-1,1]) {
        const x=side*33;box(frame,x,-7,-55,12,4,150);
        for(const z of [4,-26,-56,-86,-116]) {
          drum(frame,x,-1,z,4.5,8);drum(cream,x,4,z,4,2);
          for(const y of [-2,0,2]){drum(deck,x,y,z,4.6,.7);hoop(glow,x,y+.45,z,4.65,true);}
          drum(glow,x,5.4,z,2.5,.5);drum(cream,x,7,z,1.4,2.8);
          for(const dx of [-5.4,5.4])box(cream,x+dx,-.5,z,1.1,11,1.6);
          box(deck,x,5.5,z,12,1,2);
        }
        box(glow,x,-4.7,-55,.4,.2,146);
      }
    }
    this.batchDecoration(facility);
  }

  private batchDecoration(parent:THREE.Object3D):void {
    const groups=new Map<string,THREE.Mesh[]>();
    for(const child of parent.children) {
      if(!(child instanceof THREE.Mesh)||child instanceof THREE.InstancedMesh||child.name||Array.isArray(child.material))continue;
      const key=`${child.geometry.id}:${child.material.id}`;
      const list=groups.get(key)??[];list.push(child);groups.set(key,list);
    }
    for(const meshes of groups.values()) {
      if(meshes.length<2)continue;
      const batch=new THREE.InstancedMesh(meshes[0].geometry,meshes[0].material,meshes.length);
      for(let i=0;i<meshes.length;i++){meshes[i].updateMatrix();batch.setMatrixAt(i,meshes[i].matrix);parent.remove(meshes[i]);}
      batch.receiveShadow=true;batch.computeBoundingSphere();parent.add(batch);this.batches.push(batch);
    }
  }
  private material(color:number,emissiveIntensity=0):THREE.MeshStandardMaterial {
    const material=new THREE.MeshStandardMaterial({color,roughness:.62,metalness:.15,emissive:color,emissiveIntensity});
    this.materials.push(material);return material;
  }
}
