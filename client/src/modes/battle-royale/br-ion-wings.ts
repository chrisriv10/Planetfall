import * as THREE from "three";

/** Presentation-only Ion Wings rig. The authoritative deployment state and
 * descent forces remain in the BR simulation; this group only follows them. */
export function createBrIonWings(color: THREE.ColorRepresentation): THREE.Group {
  const wings=new THREE.Group();
  wings.name="ion-wings";
  wings.position.set(0,.16,-.12);
  const energy=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.68,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  const energyInner=energy.clone();energyInner.opacity=.28;
  const metal=new THREE.MeshStandardMaterial({color:0x263b5b,emissive:0x145a78,emissiveIntensity:.45,metalness:.7,roughness:.25});
  const white=new THREE.MeshBasicMaterial({color:0xe9fdff,transparent:true,opacity:.86,depthWrite:false,toneMapped:false});
  const pack=new THREE.Mesh(new THREE.BoxGeometry(.58,.68,.24),metal);pack.name="ion-pack";pack.position.z=.04;wings.add(pack);
  const cap=new THREE.Mesh(new THREE.BoxGeometry(.4,.16,.3),metal);cap.position.set(0,.38,.01);wings.add(cap);
  const packCore=new THREE.Mesh(new THREE.OctahedronGeometry(.19,1),new THREE.MeshBasicMaterial({color,toneMapped:false}));packCore.name="ion-core";packCore.position.set(0,.08,-.16);wings.add(packCore);
  const hingeGeometry=new THREE.CylinderGeometry(.1,.1,.18,8);
  const nozzleGeometry=new THREE.ConeGeometry(.095,.38,8,1,true);
  for(const side of [-1,1]){
    const hinge=new THREE.Mesh(hingeGeometry,metal);hinge.rotation.z=Math.PI/2;hinge.position.set(side*.38,.1,-.02);wings.add(hinge);
    const nozzle=new THREE.Mesh(nozzleGeometry,energy);nozzle.name="ion-trail-nozzle";nozzle.rotation.x=-Math.PI/2;nozzle.position.set(side*.19,-.27,-.35);wings.add(nozzle);
    for(const upper of [0,1]){
      const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(side*(upper?1.35:1.05),upper?.72:-.62);shape.lineTo(side*(upper?1.7:1.48),upper?.2:-.28);shape.closePath();
      const wingGeometry=new THREE.ShapeGeometry(shape);
      const wing=new THREE.Mesh(wingGeometry,energy);wing.name=upper?"ion-wing-upper":"ion-wing-lower";wing.position.set(side*.26,upper?.15:-.12,-.08);wings.add(wing);
      // A smaller inset panel creates a layered energy surface instead of one
      // flat triangle while sharing the same silhouette.
      const inset=new THREE.Mesh(wingGeometry,energyInner);inset.scale.set(.72,.72,1);inset.position.copy(wing.position);inset.position.z-=.012;wings.add(inset);
      const outline=new THREE.LineSegments(new THREE.EdgesGeometry(wingGeometry),white);outline.position.copy(wing.position);wings.add(outline);
      const arm=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,upper?1.35:1.18,7),metal);
      arm.name="ion-emitter-arm";arm.position.set(side*(upper?.7:.61),upper?.4:-.34,-.035);arm.rotation.z=side*(upper?-.93:-1.02);wings.add(arm);
      const emitter=new THREE.Mesh(new THREE.SphereGeometry(.14,8,6),white);
      emitter.name="ion-emitter";emitter.position.set(side*(upper?1.42:1.23),upper?.45:-.37,-.03);wings.add(emitter);
    }
  }
  wings.visible=false;
  return wings;
}
