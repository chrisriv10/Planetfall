import * as THREE from "three";
import type { BrWeaponId } from "@planetfall/shared";

export function buildBrWeaponModel(group: THREE.Group, id: BrWeaponId, rarityAccent: number): void {
  const body = new THREE.MeshStandardMaterial({ color: 0x19263b, metalness: .68, roughness: .24 });
  const frame = new THREE.MeshStandardMaterial({ color: 0xc5d1d6, metalness: .48, roughness: .32 });
  const weaponColor = weaponAccent(id);
  const energy = new THREE.MeshStandardMaterial({ color: weaponColor, emissive: weaponColor, emissiveIntensity: 1.05, metalness: .3, roughness: .13 });
  const rarity = new THREE.MeshBasicMaterial({ color: rarityAccent, transparent: true, opacity: .72 });
  const box = (size: [number, number, number], at: [number, number, number], material: THREE.Material = body) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material); mesh.position.set(...at); mesh.castShadow = true; group.add(mesh); return mesh;
  };
  const cylinder = (radius: number, length: number, at: [number, number, number], material: THREE.Material = body, sides = 10) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, length, sides), material); mesh.rotation.x = Math.PI / 2; mesh.position.set(...at); mesh.castShadow = true; group.add(mesh); return mesh;
  };
  const cell = (at: [number, number, number], scale = 1) => {
    const shell = cylinder(.1 * scale, .36 * scale, at, energy, 10);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.12 * scale, .025 * scale, 6, 12), rarity); ring.position.copy(shell.position); ring.rotation.x = Math.PI / 2; group.add(ring);
  };

  group.userData.muzzle = new THREE.Vector3(0, .02, -1);
  if (id === "energy-saber") {
    const grip = cylinder(.085, .48, [0, 0, -.04], body, 12);
    const emitter = cylinder(.14, .12, [0, 0, -.32], frame, 12);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(.15, .035, 7, 14), rarity); guard.rotation.x = Math.PI / 2; guard.position.z = -.36; group.add(guard);
    const bladeCore = new THREE.Mesh(new THREE.CapsuleGeometry(.034, 1.22, 5, 9), new THREE.MeshBasicMaterial({ color: 0xffffff })); bladeCore.rotation.x = Math.PI / 2; bladeCore.position.z = -1.04; group.add(bladeCore);
    const bladeGlow = new THREE.Mesh(new THREE.CapsuleGeometry(.082, 1.23, 5, 9), new THREE.MeshBasicMaterial({ color: weaponColor, transparent: true, opacity: .58, blending: THREE.AdditiveBlending, depthWrite: false })); bladeGlow.rotation.x = Math.PI / 2; bladeGlow.position.z = -1.04; group.add(bladeGlow);
    grip.rotation.z = .02; group.userData.muzzle.set(0, 0, -1.7); return;
  }

  if (id === "pulse-rifle") {
    box([.28, .28, .92], [0, 0, -.5]);
    box([.22, .2, .58], [0, .02, -1.18], frame);
    box([.25, .22, .42], [0, .02, .15], frame);
    box([.14, .42, .2], [-.02, -.28, -.32]);
    box([.12, .1, .32], [0, .22, -.55], body);
    cell([.16, -.04, -.48]);
    cylinder(.075, .42, [0, .02, -1.66], energy, 10);
    group.userData.muzzle.set(0, .02, -1.9);
  } else if (id === "nova-smg") {
    box([.38, .3, .66], [0, 0, -.4]);
    box([.46, .18, .36], [0, .1, -.66], frame);
    box([.17, .42, .19], [-.04, -.28, -.24]);
    cell([.2, .02, -.3], 1.2);
    for (const x of [-.11, .11]) cylinder(.055, .42, [x, .03, -.96], energy, 8);
    group.userData.muzzle.set(0, .03, -1.2);
  } else if (id === "photon-shotgun") {
    box([.46, .34, .82], [0, 0, -.5]);
    box([.38, .2, .54], [0, .02, .18], frame);
    box([.18, .43, .2], [0, -.3, -.26]);
    for (const x of [-.14, .14]) { cylinder(.105, .74, [x, .03, -1.2], body, 10); cell([x, .18, -.58], .82); }
    box([.52, .12, .22], [0, -.09, -.78], energy);
    group.userData.muzzle.set(0, .03, -1.6);
  } else if (id === "rail-laser") {
    box([.22, .24, 1.32], [0, 0, -.68]);
    box([.28, .18, .72], [0, .01, .47], frame);
    box([.15, .4, .2], [0, -.26, -.34]);
    for (const x of [-.14, .14]) box([.055, .075, 1.7], [x, .08, -.82], energy);
    box([.2, .16, .32], [0, .25, -.45], body);
    cell([0, -.04, -.72], 1.32);
    cylinder(.07, .4, [0, .08, -1.82], energy, 10);
    group.userData.muzzle.set(0, .08, -2.08);
  } else if (id === "plasma-launcher") {
    box([.44, .4, .82], [0, 0, -.4], body);
    box([.38, .22, .46], [0, .02, .26], frame);
    box([.18, .44, .21], [0, -.3, -.22]);
    const chamber = new THREE.Mesh(new THREE.SphereGeometry(.31, 13, 9), energy); chamber.position.set(0, .03, -.6); chamber.castShadow = true; group.add(chamber);
    const chamberRing = new THREE.Mesh(new THREE.TorusGeometry(.35, .055, 7, 18), frame); chamberRing.position.copy(chamber.position); chamberRing.rotation.x = Math.PI / 2; group.add(chamberRing);
    cylinder(.2, .7, [0, .02, -1.13], body, 12);
    cylinder(.17, .14, [0, .02, -1.52], energy, 12);
    group.userData.muzzle.set(0, .02, -1.65);
  } else {
    box([.3, .29, .82], [0, 0, -.45]);
    box([.24, .18, .38], [0, .03, .16], frame);
    box([.16, .4, .18], [0, -.28, -.23]);
    const chamber = new THREE.Mesh(new THREE.OctahedronGeometry(.2, 1), energy); chamber.position.set(0, .08, -.54); group.add(chamber);
    for (const x of [-.17, .17]) { const prong = box([.08, .1, .84], [x, .04, -1.12], energy); prong.rotation.y = x * .18; }
    group.userData.muzzle.set(0, .04, -1.56);
  }
  const rarityBand = new THREE.Mesh(new THREE.TorusGeometry(.16, .025, 6, 14), rarity); rarityBand.rotation.x = Math.PI / 2; rarityBand.position.set(0, 0, -.14); group.add(rarityBand);
}

export function brWeaponAccent(id: BrWeaponId): number { return weaponAccent(id); }

function weaponAccent(id: BrWeaponId): number {
  if (id === "nova-smg") return 0xff6fbd;
  if (id === "photon-shotgun") return 0xffbd58;
  if (id === "rail-laser") return 0x78baff;
  if (id === "plasma-launcher") return 0xe865ff;
  if (id === "arc-blaster") return 0x66efff;
  if (id === "energy-saber") return 0x75ffb2;
  return 0x7cecff;
}
