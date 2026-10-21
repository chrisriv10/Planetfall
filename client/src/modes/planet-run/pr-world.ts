import {createPrMeteorArt} from "./pr-meteor-art";
import * as THREE from "three";
import { PR_BALANCE, prObstacleTransform, prPlatformCenter, prTileState, type PrRoundDefinition, type PrRoundId } from "@planetfall/shared";

const PALETTES: Record<PrRoundId, readonly [number, number, number]> = {
  "cargo-cyclone": [0xff765e, 0x173f58, 0x83fff2],
  "solar-sweep": [0xffcb50, 0x493d69, 0xfff4b0],
  "meteor-garden": [0x4ed6b8, 0x184d56, 0xb5ff91],
  "flux-gardens": [0xc59aff, 0x49336b, 0x98fff0],
  "capacitor-causeway": [0x65baff, 0x203d78, 0xd6faff],
  shatterdeck: [0x75ead7, 0x423f79, 0xffbf77],
};

/** Presentation follows shared support/hazard transforms; decoration never extends the course. */
export class PrWorldRenderer {
  readonly root = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly box = this.geometry(new THREE.BoxGeometry(1, 1, 1));
  private readonly cylinder = this.geometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  private readonly platforms: THREE.Group[] = [];
  private readonly obstacles: { body: THREE.Group; warning: THREE.Mesh | null; meteor?:ReturnType<typeof createPrMeteorArt>; openMark?:THREE.Group }[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly tileStates: string[] = [];
  private readonly batches: THREE.InstancedMesh[] = [];
  private tiles: THREE.InstancedMesh | null = null;
  private disposed = false;

  constructor(private readonly round: PrRoundDefinition) {
    this.root.name = `planet-run-${round.id}`;
    const [primary, dark, light] = PALETTES[round.id];
    const deck = this.material(primary), frame = this.material(dark);
    const cream = this.material(0xf0edf1), ink = this.material(0x17273c);
    const glow = this.material(light, .65), hazard = this.material(0xff5d74, .18);
    const emitter = this.material(0xffdba0, .8), passage = this.material(0x83fff2, .65);
    const solid = (parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const mesh = new THREE.Mesh(this.box, material);
      mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz); mesh.receiveShadow = true;
      parent.add(mesh); return mesh;
    };
    for (const p of round.platforms) {
      const group = new THREE.Group(); group.name = p.id; this.root.add(group); this.platforms.push(group);
      const surface = solid(group, deck, 0,0,0,p.half.x*2,p.half.y*2,p.half.z*2);
      surface.name = "authoritative-platform";
      // All structural dressing sits below the playable top or inset as a thin painted marking.
      solid(group, frame,0,-p.half.y-.38,0,p.half.x*1.9,.76,p.half.z*1.9);
      for (const side of [-1,1]) {
        solid(group,cream,side*(p.half.x-.2),p.half.y+.006,0,.18,.012,p.half.z*2-.4);
        solid(group,glow,side*(p.half.x-.12),-.15,0,.06,.12,p.half.z*1.85);
        for (let z=-p.half.z+2;z<p.half.z;z+=4) solid(group,frame,side*(p.half.x-.6),-1,z,1,1.3,.6);
      }
      if (round.category === "race") {
        for (let z=-p.half.z+3;z<p.half.z-1;z+=5) {
          for (const side of [-1,1]) {
            const stroke=solid(group,cream,side*.42,p.half.y+.015,z,.16,.018,1.2);
            stroke.rotation.y=side*Math.PI/4;
          }
        }
        if(p.conveyor) for(let z=-p.half.z+1;z<p.half.z;z+=2) {
          solid(group,frame,0,p.half.y+.009,z,p.half.x*1.6,.014,.12);
        }
      }
      const thruster = new THREE.Mesh(this.cylinder,frame); thruster.position.y=-2; thruster.scale.set(2,2,2); group.add(thruster);
      const nozzle = new THREE.Mesh(this.cylinder,glow); nozzle.position.y=-3.05; nozzle.scale.set(1.35,.12,1.35); group.add(nozzle);
    }
    for(const o of round.obstacles) {
      const body=new THREE.Group();body.name=o.id;body.position.copy(o.center);this.root.add(body);
      let warning: THREE.Mesh|null=null;let meteor:ReturnType<typeof createPrMeteorArt>|undefined;
      let openMark:THREE.Group|undefined;
      if(o.kind==="boost") {
        // Boost field is a flat painted pad; it must not resemble a solid obstacle.
        solid(body,glow,0,.025,0,o.half.x*2,.05,o.half.z*2);
        for(const x of [-.65,.65]) {const stripe=solid(body,cream,x,.06,0,.2,.02,1.8);stripe.rotation.y=x>0?-.5:.5;}
      }else if(o.kind==="meteor"){meteor=createPrMeteorArt(o.half);body.add(meteor.root);
      }else {
        const volume=solid(body,hazard,0,0,0,o.half.x*2,o.half.y*2,o.half.z*2);
        volume.name="authoritative-hazard";
        // Thin face overlays read as inset machinery, while the coral shell retains
        // the complete shared hit volume. No silhouette or timing interpolation.
        const hx=o.half.x,hy=o.half.y,hz=o.half.z;
        solid(body,ink,0,hy+.001,0,hx*2-.7,.002,hz*1.35);
        for(const face of [-1,1]) {
          solid(body,ink,0,0,face*(hz+.001),hx*2-.75,hy*.82,.002);
          // Repeated inset emitters give even the long solar arms a visible scale.
          for(let x=-hx+1.1;x<hx-.7;x+=2.2)
            solid(body,emitter,x,0,face*(hz+.003),.55,hy*.28,.002);
        }
        for(const side of [-1,1]) {
          solid(body,cream,side*(hx-.18),0,0,.3,hy*2+.004,hz*2+.004);
          for(const face of [-1,1]) {
            solid(body,ink,side*(hx-.18),0,face*(hz+.003),.12,hy*1.3,.002);
          }
        }
        if(o.kind==="rotator") {
          // A flush central drive plate rotates with the arm, entirely within its footprint.
          const hub=new THREE.Mesh(this.cylinder,cream);
          hub.position.y=hy+.002;hub.scale.set(Math.min(hz*.8,.5),.004,Math.min(hz*.8,.5));body.add(hub);
        }else if(o.kind==="door") {
          openMark=new THREE.Group();openMark.name=`${o.id}-open-passage`;
          openMark.position.copy(o.center);this.root.add(openMark);
          // Painted on the supporting deck, not a persistent solid gate frame.
          const support=round.platforms.find(p=>Math.abs(p.center.z-o.center.z)<p.half.z&&Math.abs(p.center.x-o.center.x)<p.half.x);
          const paintY=(support? support.center.y+support.half.y:o.center.y-o.half.y)-o.center.y+.018;
          for(const x of [-hx+.55,hx-.55]) {
            solid(openMark,passage,x,paintY,0,.5,.014,hz*2);
          }
          for(const side of [-1,1]) {
            const arrow=solid(openMark,passage,side*.3,paintY,0,.15,.014,.9);
            arrow.rotation.y=side*Math.PI/4;
          }
          this.batchDecoration(openMark);
        }
        this.batchDecoration(body);
      }
      this.obstacles.push({body,warning,meteor,openMark});
    }
    this.buildFacility(deck,frame,cream,ink,glow);
    this.buildSky();
    // Gate uprights are outside the deck; finish paint sits on its actual support surface.
    if(round.finish) {
      for(const [z,finish] of [[16,false],[round.finish.center.z,true]] as const) {
        for(const side of [-1,1]) {solid(this.root,frame,side*10,3,z,1,7,1);solid(this.root,glow,side*9.45,3,z,.1,5,.6);}
        solid(this.root,finish?glow:deck,0,6.5,z,21,1,1);
        if(finish)for(let x=-8;x<9;x++)for(let iz=0;iz<2;iz++)solid(this.root,(x+iz)%2?ink:cream,x,.615,z+iz-.5,1,.02,1);
      }
    }
    if(round.tiles.length) {
      const hex=this.geometry(new THREE.CylinderGeometry(PR_BALANCE.tileRadius,PR_BALANCE.tileRadius,.38,6));
      const material=this.material(0xffffff,.12);
      this.tiles=new THREE.InstancedMesh(hex,material,round.tiles.length);
      this.tiles.name="shatterdeck-cells";this.tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.tiles.frustumCulled=false;this.tiles.receiveShadow=true;this.root.add(this.tiles);
    }
    for(const platform of this.platforms)this.batchDecoration(platform);
    this.batchDecoration(this.root);
    this.update(0,0,new Map());
  }

  update(elapsedMs: number, seed: number, tileState: ReadonlyMap<number,number>): void {
    if(this.disposed)return;
    for(let i=0;i<this.platforms.length;i++)this.platforms[i].position.copy(prPlatformCenter(this.round.platforms[i],elapsedMs));
    for(let i=0;i<this.obstacles.length;i++) {
      const o=this.round.obstacles[i], view=this.obstacles[i], state=prObstacleTransform(o,elapsedMs,seed);
      view.body.visible=o.kind==="boost"||state.active||o.kind==="meteor"&&state.warning;
      if(view.openMark)view.openMark.visible=!state.active;
      view.meteor?.update(state.active,state.warning,elapsedMs);
      // Shared obstacle collision uses planar +yaw toward +Z; Three's Y rotation has the opposite sign.
      view.body.rotation.y=o.kind==="rotator"?-state.yaw:0;
      if(view.warning)view.warning.visible=state.warning||state.active;
    }
    if(this.tiles) {
      let changed=false;
      for(let i=0;i<this.round.tiles.length;i++) {
        const tile=this.round.tiles[i], state=prTileState(tileState.get(tile.id),elapsedMs);
        if(state===this.tileStates[i])continue;
        this.tileStates[i]=state;changed=true;
        this.dummy.position.set(tile.center.x,tile.center.y-.19,tile.center.z);
        this.dummy.scale.setScalar(state==="gone"?0:1);this.dummy.updateMatrix();this.tiles.setMatrixAt(i,this.dummy.matrix);
        this.color.setHex(state==="breaking"?0xff596e:state==="triggered"?0xffd276:[0x73ead7,0x8aafff,0xc79bff,0x6bd4ed][tile.deck%4]);
        if(state==="solid")this.color.offsetHSL(0,0,((tile.column-tile.row)%3)*.035);
        this.tiles.setColorAt(i,this.color);
      }
      if(changed){this.tiles.instanceMatrix.needsUpdate=true;if(this.tiles.instanceColor)this.tiles.instanceColor.needsUpdate=true;}
    }
  }

  dispose(): void {
    if(this.disposed)return;this.disposed=true;
    for(const obstacle of this.obstacles)obstacle.meteor?.dispose();
    this.tiles?.dispose();
    for(const batch of this.batches)batch.dispose();
    for(const geometry of this.geometries)geometry.dispose();
    for(const material of this.materials)material.dispose();
    this.root.clear();this.root.removeFromParent();
  }

  private geometry<T extends THREE.BufferGeometry>(geometry:T):T {this.geometries.push(geometry);return geometry;}
  private buildFacility(deck:THREE.Material,frame:THREE.Material,cream:THREE.Material,ink:THREE.Material,glow:THREE.Material):void {
    const facility=new THREE.Group();facility.name=`signature-${this.round.id}`;this.root.add(facility);
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
    }else {
      for(let i=0;i<6;i++) {
        const a=i*Math.PI/3,x=Math.cos(a)*39,z=Math.sin(a)*39;
        drum(frame,x,7,z,3.5,34);drum(cream,x,24,z,4,1.5);
        for(const y of [3,8,13,18]){drum(deck,x,y,z,4.3,.7);hoop(glow,x,y+.6,z,4.4,true);}
        const energy=shape(sphere,glow,x,27,z,2,3.3,2);energy.rotation.y=a;
      }
      // An external containment cage frames the stack; no visual disc under the disappearing floor.
      for(const y of [-3,23])hoop(cream,0,y,0,39,true);
      for(const y of [3,8,13,18])hoop(glow,0,y,0,38,true);
    }
    this.batchDecoration(facility);
  }

  private buildSky():void {
    const dome=this.geometry(new THREE.SphereGeometry(650,32,16));
    const positions=dome.getAttribute("position"),colors=new Float32Array(positions.count*3);
    const horizon=new THREE.Color(0x547d9b),zenith=new THREE.Color(0x17234c),under=new THREE.Color(0x152c46),color=new THREE.Color();
    for(let i=0;i<positions.count;i++) {
      const y=positions.getY(i)/650;
      color.copy(horizon).lerp(y>0?zenith:under,Math.min(1,Math.abs(y)*1.7));
      const band=Math.max(0,1-Math.abs(y-.3-Math.sin(positions.getX(i)*.006)*.1)*9)*.13;
      color.r+=band*.55;color.g+=band*.2;color.b+=band;
      colors.set([color.r,color.g,color.b],i*3);
    }
    dome.setAttribute("color",new THREE.BufferAttribute(colors,3));
    const skyMaterial=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,depthWrite:false,fog:false});this.materials.push(skyMaterial);
    const sky=new THREE.Mesh(dome,skyMaterial);sky.name="orbital-sky";sky.position.z=-50;sky.renderOrder=-10;sky.frustumCulled=false;this.root.add(sky);
    const planetMaterial=new THREE.MeshBasicMaterial({vertexColors:true,fog:false});this.materials.push(planetMaterial);
    const planetGeometry=this.geometry(new THREE.SphereGeometry(1,40,24));
    const pp=planetGeometry.getAttribute("position"),pc=new Float32Array(pp.count*3);
    for(let i=0;i<pp.count;i++) {
      const x=pp.getX(i),y=pp.getY(i),z=pp.getZ(i);
      const bands=Math.sin(y*21+Math.sin(x*6+z*3)*.8);
      color.setHex(bands>.35?0x8bbbc3:bands<-.5?0x45618d:0x637da0);
      color.multiplyScalar(.35+.65*Math.max(0,x*.4+y*.6+z*.6));pc.set([color.r,color.g,color.b],i*3);
    }
    planetGeometry.setAttribute("color",new THREE.BufferAttribute(pc,3));
    const planet=new THREE.Mesh(planetGeometry,planetMaterial);planet.name="distant-band-planet";planet.position.set(-150,95,-270);planet.scale.setScalar(65);this.root.add(planet);
    const stars=new Float32Array(160*3);
    for(let i=0;i<160;i++) {const a=i*2.399963,up=.15+((i*73)%151)/180,r=Math.sqrt(1-up*up);stars.set([Math.cos(a)*r*480,up*480,Math.sin(a)*r*480-50],i*3);}
    const starGeometry=this.geometry(new THREE.BufferGeometry());starGeometry.setAttribute("position",new THREE.BufferAttribute(stars,3));
    const starMaterial=new THREE.PointsMaterial({color:0xc7ddf2,size:1.15,sizeAttenuation:true,fog:false,depthWrite:false});this.materials.push(starMaterial);
    const points=new THREE.Points(starGeometry,starMaterial);points.name="orbital-starfield";this.root.add(points);
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
