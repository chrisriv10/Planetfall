import * as THREE from "three";
import type {PgPresentationWeapon} from "./pg-reload-art";
import type {PgWeaponArtResources} from "./pg-weapon-presentation";

// Center of each original rigid action or moving slide, in canonical weapon space.
const ACTION:Record<PgPresentationWeapon,{z:number;color:number}>={
  pulse:{z:-.50,color:0x8399aa},nova:{z:-.40,color:0x83939c},
  photon:{z:-.50,color:0x9c9690},quasar:{z:-.45,color:0x80909e},
  rail:{z:-.68,color:0x8197aa},helix:{z:-.38,color:0x859890},
  arc:{z:-.45,color:0x798f9e},prism:{z:-.30,color:0x81979b},
  comet:{z:-.34,color:0xb1a294},orbit:{z:-.32,color:0x8c9ca7},
};

/** Called after converting the borrowed body boxes to unit housings. Position,
 * dimensions, animation parents, finish sockets and all optics stay in place. */
export function fitPgReceiverCasting(model:THREE.Group,weapon:PgPresentationWeapon,geometry:THREE.BufferGeometry,
  ownMaterial:<T extends THREE.Material>(m:T)=>T){
  const recipe=ACTION[weapon];
  const action=model.children.find(o=>o instanceof THREE.Mesh && o.position.x===0 &&
    Math.abs(o.position.z-recipe.z)<1e-6 && o.position.y>=0 && o.position.y<.1 && o.scale.x>=.18);
  if(!(action instanceof THREE.Mesh))return;
  action.geometry=geometry;
  action.material=ownMaterial(new THREE.MeshStandardMaterial({color:recipe.color,vertexColors:true,roughness:.55,metalness:.23}));
}

/** Resolve the camera-facing end of each mechanism in its existing footprint. */
export function finishPgRearAssembly(model:THREE.Group,weapon:PgPresentationWeapon,r:PgWeaponArtResources){
  if(!r.bevel || !r.sculpted)return;
  function insert(name:string,material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number){
    const mesh=new THREE.Mesh(r.bevel,material);mesh.name=name;mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
    model.add(mesh);return mesh;
  }
  if(weapon==="nova" || weapon==="quasar"){
    // The narrow heel follows its actual off-center folding rail. Moving the
    // broad pad inward at full extension would obscure the entire receiver.
    const pad=model.getObjectByName(`pg-${weapon}-shaped-pad`);
    if(pad instanceof THREE.Mesh){
      const offset=weapon==="nova"?.16:.09;
      pad.position.x=offset;pad.position.y-=.018;pad.scale.x*=.35;pad.scale.y*=.75;
      const heel=insert("stock-folding-heel",r.metal,offset,pad.position.y-pad.scale.y*.38,
        pad.position.z,pad.scale.x*1.6,pad.scale.y*.24,pad.scale.z*.92);
      heel.geometry=r.sculpted;
    }
  }
  if(weapon==="photon"){
    // The two high cells are jacketed on their eye-facing ends, leaving the
    // original emissive bands visible further forward between their barrels.
    const cells=model.children.filter(o=>o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry &&
      o.position.y===.18 && o.position.z===-.58);
    for(const cell of cells){
      const mesh=cell as THREE.Mesh;
      const jacket=new THREE.Mesh(mesh.geometry,r.composite);jacket.name="photon-cell-jacket";
      jacket.position.copy(mesh.position);jacket.position.z+=.041;
      jacket.rotation.copy(mesh.rotation);jacket.scale.set(1.06,.77,1.06);model.add(jacket);
    }
  }
  if(weapon==="rail"){
    const mount=model.getObjectByName("rail-local-low-mount");
    if(mount instanceof THREE.Mesh && mount.geometry instanceof THREE.BoxGeometry){
      const p=mount.geometry.parameters;
      mount.geometry=r.sculpted;mount.scale.multiply(new THREE.Vector3(p.width,p.height,p.depth));mount.material=r.composite;
    }
    for(const side of [-1,1])
      insert("rail-feed-terminal",r.composite,side*.14,.08,.012,.059,.081,.085);
  }
  if(weapon==="arc" || weapon==="prism"){
    // Sight plane and bore stay open. The two existing arms of the reflex
    // need physical feet on the receiver, also visible in kit and world art.
    if(!model.getObjectByName("local-energy-reflex-post")){
      for(const side of [-1,1])insert("local-energy-reflex-post",r.metal,side*.075,.35,-.25,.025,.13,.055).geometry=r.box;
      insert("local-energy-reflex-bridge",r.metal,0,.425,-.25,.175,.025,.055).geometry=r.box;
    }
    for(const side of [-1,1])
      insert("optic-mount-foot",r.composite,side*.075,.213,-.25,.040,.16,.083);
    if(weapon==="arc"){
      const coil=model.children.find(o=>o instanceof THREE.Mesh && o.geometry instanceof THREE.OctahedronGeometry);
      coil?.scale.set(.82,.72,.90);
      for(const side of [-1,1])
        insert("arc-coil-insulator",r.metal,side*.132,.105,-.54,.061,.14,.25);
    }
  }
  if(weapon==="comet" || weapon==="orbit"){
    const inset=model.getObjectByName(weapon==="comet"?"comet-striker-inset":"orbit-rear-striker-inset");
    if(inset instanceof THREE.Mesh){inset.material=r.metal;inset.geometry=r.bevel;}
    const grip=model.getObjectByName(weapon==="comet"?"comet-grip":"orbit-angled-grip");
    if(grip instanceof THREE.Mesh)grip.material=r.grip;
    if(weapon==="orbit"){
      // The polymer frame previously extended past the striker and completely
      // hid its rear face. Taper the frame back into the existing grip socket.
      const frame=model.getObjectByName("orbit-composite-frame") as THREE.Mesh;
      frame.geometry=r.sculpted;frame.scale.z*=.83;frame.position.z-=.027;
      insert("orbit-rear-sight-seat",r.composite,0,.118,-.10,.143,.028,.056);
    }
  }
  const core=model.getObjectByName(`pg-${weapon}-stock-core`);
  if(core instanceof THREE.Mesh){
    const cheek=model.getObjectByName("stock-cheek-inlay") as THREE.Mesh;
    if(weapon==="helix"){
      // Two load-bearing spars span the same shoulder and recoil pad.
      const width=core.scale.x;core.scale.x=width*.36;core.position.x=-width*.23;
      const second=core.clone();second.position.x=width*.23;model.add(second);
      cheek.scale.x*=.58;
    }else{
      core.scale.x*=weapon==="photon"?.84:.76;
      core.scale.y*=weapon==="prism"?.76:.88;
      cheek.material=weapon==="photon"?r.grip:r.metal;
      cheek.scale.x*=.76;
    }
  }
}

/** Unit action casting, muzzle at -Z. A recessed longitudinal channel splits
 * the two shoulders. Their rear bevel drops below the sight and catches the key
 * light from the player's side. All shading is non-emissive and tintable. */
export function createPgReceiverCastingGeometry(){
  const section=[
    [-.31,-.5],[.31,-.5],[.5,-.30],[.5,.20],[.36,.47],[.19,.50],
    [.11,.33],[-.11,.33],[-.19,.50],[-.36,.47],[-.5,.20],[-.5,-.30],
  ] as const;
  const shoulderShade=[.48,.58,.65,.85,1,.66,.37,.66,1,.85,.65,.58];
  const rings=[
    [-.50,.84,.80,0],[-.40,1,1,0],[.12,1,1,0],[.34,.90,.90,-.025],[.50,.69,.69,-.075],
  ] as const;
  const points=rings.map(([z,width,height,drop])=>section.map(([x,y])=>new THREE.Vector3(x*width,y*height+drop,z)));
  const positions:number[]=[],colors:number[]=[],uv:number[]=[];
  const edge=new THREE.Vector3(),normal=new THREE.Vector3();
  function triangle(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,shade:number,end=false){
    normal.subVectors(b,a).cross(edge.subVectors(c,a));
    const side=Math.abs(normal.x)>Math.abs(normal.y);
    for(const v of [a,b,c]){
      positions.push(v.x,v.y,v.z);
      colors.push(shade,shade,shade);
      // Longitudinal unwrap along the casting. End plates read across XY.
      uv.push(end?v.x+.5:v.z+.5,end||side?v.y+.5:v.x+.5);
    }
  }
  for(let r=0;r<rings.length-1;r++){
    for(let s=0;s<section.length;s++){
      const n=(s+1)%section.length,a=points[r][s],b=points[r][n],c=points[r+1][n],d=points[r+1][s];
      triangle(a,b,d,shoulderShade[s]);triangle(b,c,d,shoulderShade[s]);
    }
  }
  for(const r of [0,rings.length-1]){
    const center=new THREE.Vector3(0,-.10,rings[r][0]);
    for(let s=0;s<section.length;s++){
      const a=points[r][s],b=points[r][(s+1)%section.length];
      triangle(center,r? a:b,r? b:a,r?.65:.48,true);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();g.computeBoundingBox();return g;
}
