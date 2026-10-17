import * as THREE from "three";
import type { BrWeaponId } from "@planetfall/shared";

export function buildBrWeaponModel(group: THREE.Group, id: BrWeaponId, rarityAccent: number): void {
  const body = new THREE.MeshStandardMaterial({ color: 0x19263b, metalness: .68, roughness: .24 });
  const frame = new THREE.MeshStandardMaterial({ color: 0xc5d1d6, metalness: .48, roughness: .32 });
  const weaponColor = weaponAccent(id);
  const energy = new THREE.MeshStandardMaterial({ color: weaponColor, emissive: weaponColor, emissiveIntensity: .42, metalness: .3, roughness: .25 });
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
  const named = (name: string, mesh: THREE.Mesh) => { mesh.name = name; return mesh; };

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
    // Open reflex window: structural silhouette first, one tiny emitter inset.
    named("pulse-optic-left",box([.035,.15,.07],[-.085,.34,-.55],frame));
    named("pulse-optic-right",box([.035,.15,.07],[.085,.34,-.55],frame));
    named("pulse-optic-bridge",box([.205,.035,.07],[0,.425,-.55],frame));
    named("pulse-optic-emitter",box([.035,.025,.035],[0,.287,-.54],energy));
    for(const z of [-1.36,-1.2,-1.04])named("pulse-handguard-seam",box([.228,.045,.025],[0,.02,z],body));
    cell([.16, -.04, -.48]);
    cylinder(.075, .42, [0, .02, -1.66], energy, 10);
    group.userData.muzzle.set(0, .02, -1.9);
  } else if (id === "nova-smg") {
    box([.38, .3, .66], [0, 0, -.4]);
    box([.46, .18, .36], [0, .1, -.66], frame);
    box([.17, .42, .19], [-.04, -.28, -.24]);
    named("smg-stock-strut",box([.08,.11,.38],[.16,.01,.08],frame));
    named("smg-stock-pad",box([.22,.24,.06],[.09,.01,.3],body));
    named("smg-front-sight",box([.045,.095,.055],[0,.238,-.72],body));
    for(const x of [-.055,.055])named("smg-rear-sight",box([.03,.095,.06],[x,.238,-.24],frame));
    cell([.2, .02, -.3], 1.2);
    for (const x of [-.11, .11]) cylinder(.055, .42, [x, .03, -.96], energy, 8);
    group.userData.muzzle.set(0, .03, -1.2);
  } else if (id === "photon-shotgun") {
    box([.46, .34, .82], [0, 0, -.5]);
    box([.38, .2, .54], [0, .02, .18], frame);
    box([.18, .43, .2], [0, -.3, -.26]);
    for (const x of [-.14, .14]) { cylinder(.105, .74, [x, .03, -1.2], body, 10); cell([x, .18, -.58], .82); }
    box([.52, .12, .22], [0, -.09, -.78], energy);
    named("shotgun-pump",box([.42,.16,.38],[0,-.13,-1.12],frame));
    for(const z of [-1.25,-1.12,-.99])named("shotgun-pump-rib",box([.43,.025,.035],[0,-.213,z],body));
    named("shotgun-front-bead",box([.055,.07,.07],[0,.165,-1.43],frame));
    group.userData.muzzle.set(0, .03, -1.6);
  } else if (id === "rail-laser") {
    box([.22, .24, 1.32], [0, 0, -.68]);
    box([.28, .18, .72], [0, .01, .47], frame);
    box([.15, .4, .2], [0, -.26, -.34]);
    for (const x of [-.14, .14]) box([.055, .075, 1.7], [x, .08, -.82], energy);
    box([.2, .16, .32], [0, .25, -.45], body);
    named("rail-scope-body",cylinder(.095,.58,[0,.37,-.52],body,10));
    named("rail-scope-front",cylinder(.115,.07,[0,.37,-.845],frame,10));
    named("rail-scope-rear",cylinder(.105,.07,[0,.37,-.195],frame,10));
    named("rail-scope-lens",cylinder(.084,.008,[0,.37,-.884],energy,10));
    named("rail-cheek-rest",box([.24,.08,.34],[0,.14,.45],body));
    cell([0, -.04, -.72], 1.32);
    cylinder(.07, .4, [0, .08, -1.82], energy, 10);
    group.userData.muzzle.set(0, .08, -2.08);
  } else if (id === "plasma-launcher") {
    box([.44, .4, .82], [0, 0, -.4], body);
    box([.38, .22, .46], [0, .02, .26], frame);
    box([.18, .44, .21], [0, -.3, -.22]);
    // A dark pressure chamber with small energy windows reads as equipment,
    // rather than a fully emissive pink ball at held-weapon distance.
    const chamber = new THREE.Mesh(new THREE.SphereGeometry(.31, 13, 9), body); chamber.name="plasma-pressure-chamber";chamber.position.set(0, .03, -.6); chamber.castShadow = true; group.add(chamber);
    for(const x of [-.3,.3])named("plasma-chamber-window",box([.025,.12,.18],[x,.03,-.6],energy));
    const chamberRing = new THREE.Mesh(new THREE.TorusGeometry(.35, .055, 7, 18), frame); chamberRing.position.copy(chamber.position); chamberRing.rotation.x = Math.PI / 2; group.add(chamberRing);
    cylinder(.2, .7, [0, .02, -1.13], body, 12);
    cylinder(.17, .14, [0, .02, -1.52], energy, 12);
    group.userData.muzzle.set(0, .02, -1.65);
  } else if (id === "helix-burst-rifle") {
    box([.25,.24,.8],[0,0,-.38]);
    box([.23,.2,.42],[0,.02,.2],frame);
    named("helix-grip",box([.14,.38,.2],[0,-.26,-.28]));
    for (const x of [-.12,.12]) {
      named("helix-split-rail",box([.07,.09,.95],[x,.03,-1.08],frame));
      for (let i=0;i<3;i++) { const channel=box([.08,.045,.22],[x,.11,-.76-i*.26],energy); channel.rotation.z=x>0?.45:-.45; named("helix-channel",channel); }
    }
    named("helix-reflex-left",box([.025,.12,.07],[-.07,.22,-.4],frame));
    named("helix-reflex-right",box([.025,.12,.07],[.07,.22,-.4],frame));
    box([.165,.025,.07],[0,.29,-.4],frame);
    group.userData.muzzle.set(0,.03,-1.62);
  } else if (id === "comet-hand-cannon") {
    named("comet-slide",box([.32,.28,.67],[0,.04,-.34],frame));
    named("comet-grip",box([.21,.43,.24],[0,-.29,-.12]));
    named("comet-cylinder",cylinder(.17,.3,[0,-.02,-.32],body,8));
    cylinder(.105,.25,[0,.05,-.78],body,8);
    named("comet-muzzle",cylinder(.078,.035,[0,.05,-.925],energy,8));
    box([.055,.07,.07],[0,.215,-.58],body);
    for (const x of [-.166,.166])box([.025,.045,.27],[x,.07,-.35],energy);
    group.userData.muzzle.set(0,.05,-.95);
  } else if (id === "quasar-carbine") {
    box([.24,.24,.9],[0,0,-.45]);
    named("quasar-skeleton-stock",box([.055,.08,.52],[.09,.02,.27],frame));
    box([.24,.23,.08],[0,.02,.57],frame);
    named("quasar-grip",box([.15,.38,.2],[0,-.26,-.25]));
    box([.19,.27,.22],[0,-.22,-.6],frame);
    named("quasar-handguard",box([.24,.16,.55],[0,.01,-1.08],frame));
    cylinder(.055,.42,[0,.03,-1.53]);
    box([.12,.12,.2],[0,.18,-.4]);
    named("quasar-optic",cylinder(.1,.34,[0,.3,-.43],frame));
    named("quasar-lens",cylinder(.077,.012,[0,.3,-.607],energy));
    for(const x of [-.125,.125])box([.018,.035,.42],[x,.04,-1.08],energy);
    group.userData.muzzle.set(0,.03,-1.77);
  } else if (id === "prism-beam") {
    named("prism-receiver",box([.35,.3,.65],[0,0,-.3],frame));
    named("prism-grip",box([.17,.4,.2],[0,-.27,-.15]));
    box([.28,.16,.3],[0,.01,.18]);
    named("prism-crystal",cylinder(.15,.45,[0,.03,-.9],energy,3));
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3;
      named("prism-emitter-prong",box([.085,.085,.65],[Math.cos(a)*.24,.03+Math.sin(a)*.24,-1.02],body));
      named("prism-focus-tip",box([.09,.09,.045],[Math.cos(a)*.24,.03+Math.sin(a)*.24,-1.365],energy));
    }
    for(const x of [-.18,.18])box([.045,.22,.36],[x,0,-.3],body);
    group.userData.muzzle.set(0,.03,-1.4);
  } else if (id === "vortex-cannon") {
    named("vortex-receiver",box([.42,.32,.68],[0,0,-.28],frame));
    named("vortex-grip",box([.18,.4,.22],[0,-.28,-.1]));
    box([.3,.22,.36],[0,.02,.22],body);
    named("vortex-core",cylinder(.18,.34,[0,.02,-.74],body,8));
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      named("vortex-containment-vane",box([.12,.12,.82],[Math.cos(a)*.28,.02+Math.sin(a)*.28,-.97],frame));
      named("vortex-field-inset",box([.075,.075,.38],[Math.cos(a)*.285,.02+Math.sin(a)*.285,-1.05],energy));
    }
    named("vortex-aperture",cylinder(.16,.045,[0,.02,-1.42],energy,8));
    group.userData.muzzle.set(0,.02,-1.46);
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
  if (id === "helix-burst-rifle") return 0x8be7c4;
  if (id === "comet-hand-cannon") return 0xffab73;
  if (id === "quasar-carbine") return 0x9dbaff;
  if (id === "prism-beam") return 0x72fff0;
  if (id === "vortex-cannon") return 0xd4b3ff;
  if (id === "nova-smg") return 0xff6fbd;
  if (id === "photon-shotgun") return 0xffbd58;
  if (id === "rail-laser") return 0x78baff;
  if (id === "plasma-launcher") return 0xe865ff;
  if (id === "arc-blaster") return 0x66efff;
  if (id === "energy-saber") return 0x75ffb2;
  return 0x7cecff;
}
