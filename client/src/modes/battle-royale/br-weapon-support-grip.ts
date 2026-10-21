import * as THREE from "three";
import { brHeldWeaponTransform } from "./br-item-presentation";

export type BrSupportWeaponId = "helix-burst-rifle" | "quasar-carbine" | "prism-beam" | "vortex-cannon";
const CONTRACT = {
  "helix-burst-rifle": { scale: .46, y: -.26, z: -.28 },
  "quasar-carbine": { scale: .43, y: -.26, z: -.25 },
  "prism-beam": { scale: .48, y: -.27, z: -.15 },
  "vortex-cannon": { scale: .48, y: -.28, z: -.1 },
} as const;

export interface BrSupportGripPrototype {
  /** Exact canonical parts hidden by the experimental retracted-stock variant. */
  readonly retractedParts: readonly THREE.Object3D[];
  readonly addedParts: readonly THREE.Mesh[];
  /** Restore stock visibility, remove parts and dispose only the optional owned cylinder. */
  restore(): void;
}

/** Experimental only. Canonical receivers/barrels are untouched. Rear stock
 * boxes retract into the receiver by hiding their exterior representation.
 * Four thin round parts form two grips and converging folding braces.
 * Construction coordinates are metres relative to the wrist midpoint,
 * converted once to the canonical weapon frame. Pass the actual model child
 * returned by the model library, not its held-item wrapper; stock parts must
 * be direct children. Anchor the wrapper separately with anchorBrSupportedWeapon. */
export function addBrWeaponSupportGrip(
  group: THREE.Group, id: BrSupportWeaponId,
  _box: THREE.BoxGeometry, material: THREE.Material,
  options: { cylinder?: THREE.CylinderGeometry } = {},
): BrSupportGripPrototype {
  const p = CONTRACT[id];
  const retracted = group.children.filter(part => part instanceof THREE.Mesh
    && part.geometry instanceof THREE.BoxGeometry && part.position.z > 0);
  const visibility = retracted.map(part => part.visible);
  for (const part of retracted) part.visible = false;
  const added: THREE.Mesh[] = [];
  const anchors: THREE.Group[] = [];
  const cylinder = options.cylinder ?? new THREE.CylinderGeometry(1, 1, 1, 8);
  const originY = -p.y * p.scale - .08;
  const originZ = p.z * p.scale + .28;
  const local = (x: number, y: number, z: number) => new THREE.Vector3(-x / p.scale, (y - originY) / p.scale, (originZ - z) / p.scale);
  const add = (name: string, a: THREE.Vector3, b: THREE.Vector3, radius: number, parent: THREE.Object3D = group) => {
    const mesh = new THREE.Mesh(cylinder, material);
    mesh.name = name;
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.scale.set(radius / p.scale, a.distanceTo(b), radius / p.scale);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    parent.add(mesh);
    added.push(mesh);
  };
  for (const x of [-.19, .19]) {
    const anchor = new THREE.Group();
    anchor.name = x > 0 ? "weapon-primary-grip" : "weapon-support-grip";
    anchor.position.copy(local(x, 0, 0));
    group.add(anchor);
    anchors.push(anchor);
    add("weapon-grasped-handle", local(x, 0, -.06).sub(anchor.position), local(x, 0, .22).sub(anchor.position), .0225, anchor);
    add("weapon-folding-brace", local(x, 0, .22), local(0, originY, .30), .0175);
  }
  let restored = false;
  return {
    retractedParts: retracted,
    addedParts: added,
    restore() {
      if (restored) return;
      restored = true;
      retracted.forEach((part, i) => { part.visible = visibility[i]; });
      for (const part of added) part.removeFromParent();
      for (const anchor of anchors) anchor.removeFromParent();
      if (!options.cylinder) cylinder.dispose();
    },
  };
}

/** Both wrist and weapon use upperBody coordinates. Receiver is centered,
 * .28m farther forward and .08m lower than the original grip-only prototype.
 * No authoritative aim, muzzle or projectile state is written. */
export function anchorBrSupportedWeapon(weapon: THREE.Object3D, id: BrSupportWeaponId, rightWrist: THREE.Vector3, pitch=0): void {
  if(!Number.isFinite(pitch)||pitch< -1.15||pitch>.8)return;
  const p = CONTRACT[id];
  weapon.rotation.set(pitch, Math.PI, 0);
  weapon.scale.setScalar(p.scale);
  const y=-p.y*p.scale-.08,z=p.z*p.scale+.28;
  weapon.position.set(rightWrist.x-.19,rightWrist.y+y*Math.cos(pitch)-z*Math.sin(pitch),rightWrist.z+y*Math.sin(pitch)+z*Math.cos(pitch));
}

/** Experimental entry recovery only. The canonical pistol grip becomes the
 * rear primary handle, following the real wrist; no visible reverse path is
 * supported. Restore only after the held model is hidden or removed. */
export function createBrSupportedWeaponEntry(model:THREE.Group,id:BrSupportWeaponId,box:THREE.BoxGeometry,material:THREE.Material,options:{cylinder?:THREE.CylinderGeometry}={}){
  const grip=model.getObjectByName(`${id.split("-")[0]}-grip`);
  if(!grip)throw new Error(`Missing authored grip for ${id}`);
  const gripPosition=grip.position.clone();
  const prototype=addBrWeaponSupportGrip(model,id,box,material,options);
  const stocks=prototype.retractedParts.map(part=>({part,position:part.position.clone(),scale:part.scale.clone(),depth:(part as THREE.Mesh<THREE.BoxGeometry>).geometry.parameters.depth*part.scale.z}));
  const pieces=prototype.addedParts.map(part=>({part,scale:part.scale.clone()}));
  const old=brHeldWeaponTransform(id),p=CONTRACT[id];
  const inverse=new THREE.Quaternion(),start=new THREE.Vector3(),error=new THREE.Vector3(old.position[0],old.position[1]+p.y*p.scale,old.position[2]-p.z*p.scale);
  let restored=false,previousWeight=0;
  return {
    update(wrapper:THREE.Object3D,rightWrist:THREE.Vector3,weight:number,pitch=0){
      if(restored||!Number.isFinite(weight)||weight<previousWeight||weight>1||!Number.isFinite(pitch)||pitch< -1.15||pitch>.8)return false;
      if(!Number.isFinite(rightWrist.x)||!Number.isFinite(rightWrist.y)||!Number.isFinite(rightWrist.z))return false;
      previousWeight=weight;
      const phase=THREE.MathUtils.clamp(weight/.25,0,1),t=phase*phase*(3-2*phase);
      const deploy=THREE.MathUtils.clamp((weight-.25)/.25,0,1),d=deploy*deploy*(3-2*deploy);
      anchorBrSupportedWeapon(wrapper,id,rightWrist,pitch*t);
      start.set(rightWrist.x+old.position[0],rightWrist.y+old.position[1],rightWrist.z+old.position[2]);
      wrapper.position.lerpVectors(start,wrapper.position,t);
      for(const stock of stocks){
        stock.part.visible=t<1;
        stock.part.scale.copy(stock.scale);stock.part.scale.z*=1-t;
        stock.part.position.copy(stock.position);stock.part.position.z-=stock.depth*t/2;
      }
      inverse.copy(wrapper.quaternion).invert();
      grip.position.copy(rightWrist).addScaledVector(error,1-t).sub(wrapper.position).applyQuaternion(inverse).divideScalar(p.scale);
      for(const piece of pieces){
        const primary=piece.part.parent?.name==="weapon-primary-grip";
        piece.part.visible=!primary&&d>0;
        piece.part.scale.copy(piece.scale).multiplyScalar(d);
      }
      return true;
    },
    restore(){
      if(restored)return;restored=true;
      grip.position.copy(gripPosition);
      for(const stock of stocks){stock.part.position.copy(stock.position);stock.part.scale.copy(stock.scale);}
      prototype.restore();
    },
  };
}
