import * as THREE from "three";

export interface BrHoverSkimmerOptions {
  bodyColor?: THREE.ColorRepresentation;
  accentColor?: THREE.ColorRepresentation;
  identityColor?: THREE.ColorRepresentation;
}

export interface BrHoverSkimmerFrame {
  time: number;
  speed?: number;
  steering?: number;
  occupied?: boolean;
}

export interface BrHoverSkimmerVisual {
  group: THREE.Group;
  model: THREE.Group;
  driverAnchor: THREE.Object3D;
  seatAnchor: THREE.Object3D;
  hoverModules: readonly THREE.Group[];
  headLights: readonly THREE.Mesh[];
  tailLights: readonly THREE.Mesh[];
  resources: { geometries: readonly THREE.BufferGeometry[]; materials: readonly THREE.Material[] };
  disposed: boolean;
}

const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function polygonPrism(points: readonly (readonly [number, number])[], height: number): THREE.BufferGeometry {
  const vertices: number[] = [], indices: number[] = [];
  const count = points.length;
  for (const y of [-height / 2, height / 2]) for (const [x, z] of points) vertices.push(x, y, z);
  for (let index = 1; index < count - 1; index++) {
    // Points wind counter-clockwise in X/Z, whose normal is -Y.
    indices.push(0, index, index + 1);
    indices.push(count, count + index + 1, count + index);
  }
  for (let index = 0; index < count; index++) {
    const next = (index + 1) % count;
    indices.push(index, count + next, next, index, count + index, count + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  // Separate face normals keep the chamfered silhouette crisp under daylight.
  const faceted = geometry.toNonIndexed();
  geometry.dispose();
  faceted.computeVertexNormals();
  return faceted;
}

const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string) => {
  const value = new THREE.Mesh(geometry, material); value.name = name; return value;
};

/** Presentation-only one-seat Orbital Hover Skimmer. Root origin is the ground
 * centre and local +Z is forward. All geometries and materials are owned. */
export function createBrHoverSkimmer(options: Readonly<BrHoverSkimmerOptions> = {}): BrHoverSkimmerVisual {
  const group = new THREE.Group(); group.name = "br-hover-skimmer";
  const model = new THREE.Group(); model.name = "skimmer-hover-rig"; group.add(model);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const ownGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => (geometries.add(geometry), geometry);
  const ownMaterial = <T extends THREE.Material>(material: T): T => (materials.add(material), material);
  const body = ownMaterial(new THREE.MeshStandardMaterial({ color: options.bodyColor ?? 0xe8f1fb, roughness: .42, metalness: .18, flatShading: true }));
  const dark = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x18233a, roughness: .52, metalness: .42, flatShading: true }));
  const accent = ownMaterial(new THREE.MeshStandardMaterial({ color: options.accentColor ?? 0x3fd7e8, emissive: options.accentColor ?? 0x3fd7e8, emissiveIntensity: .32, roughness: .3, metalness: .25 }));
  const identity = ownMaterial(new THREE.MeshStandardMaterial({ color: options.identityColor ?? 0xffb34f, emissive: options.identityColor ?? 0xffb34f, emissiveIntensity: .5, roughness: .3, metalness: .2 }));
  const glass = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x173c61, emissive: 0x0d5170, emissiveIntensity: .38, metalness: .72, roughness: .14, transparent: true, opacity: .84, side: THREE.DoubleSide }));
  const head = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xbffaff, toneMapped: false }));
  const tail = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xff705d, toneMapped: false }));
  const hoverGlow = ownMaterial(new THREE.MeshBasicMaterial({ color: 0x63efff, transparent: true, opacity: .68, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));

  const hullGeometry = ownGeometry(polygonPrism([
    [-.7, -2.2], [.7, -2.2], [1.03, -1.55], [1.1, .85], [.62, 2.2], [-.62, 2.2], [-1.1, .85], [-1.03, -1.55]
  ], .48));
  const hull = mesh(hullGeometry, body, "skimmer-tapered-hull"); hull.position.y = .83; model.add(hull);
  const underbody = mesh(ownGeometry(polygonPrism([
    [-.7, -1.72], [.7, -1.72], [.88, -.9], [.76, 1.48], [-.76, 1.48], [-.88, -.9]
  ], .22)), dark, "skimmer-underbody"); underbody.position.y = .61; model.add(underbody);

  const deck = mesh(ownGeometry(polygonPrism([
    [-.72, -.92], [.72, -.92], [.8, .62], [.45, 1.45], [-.45, 1.45], [-.8, .62]
  ], .18)), dark, "skimmer-upper-deck"); deck.position.y = 1.08; model.add(deck);
  const nose = mesh(ownGeometry(new THREE.CapsuleGeometry(.25, .7, 3, 8)), body, "skimmer-nose-ridge");
  nose.rotation.x = Math.PI / 2; nose.scale.set(1, .72, 1); nose.position.set(0, 1.24, 1.48); model.add(nose);

  const seatBase = mesh(ownGeometry(new THREE.BoxGeometry(1.02, .18, .82)), dark, "skimmer-seat-base"); seatBase.position.set(0, 1.19, -.08); model.add(seatBase);
  const seatBack = mesh(ownGeometry(new THREE.BoxGeometry(.98, .7, .16)), dark, "skimmer-seat-back");
  seatBack.position.set(0, 1.48, -.66); seatBack.rotation.x = -.16; model.add(seatBack);
  const headrest = mesh(ownGeometry(new THREE.BoxGeometry(.44, .2, .18)), body, "skimmer-headrest"); headrest.position.set(0, 1.73, -.71); model.add(headrest);
  const console = mesh(ownGeometry(new THREE.BoxGeometry(.66, .24, .3)), dark, "skimmer-controls"); console.position.set(0, 1.64, .58); console.rotation.x = -.18; model.add(console);
  const consoleGlow = mesh(ownGeometry(new THREE.BoxGeometry(.42, .025, .16)), head, "skimmer-control-display"); consoleGlow.position.set(0, 1.765, .55); consoleGlow.rotation.x = -.18; model.add(consoleGlow);
  const windscreen = mesh(ownGeometry(new THREE.BoxGeometry(.88, .48, .055)), glass, "skimmer-windscreen");
  windscreen.position.set(0, 1.63, .9); windscreen.rotation.x = -.38; model.add(windscreen);

  const sideRailGeometry = ownGeometry(new THREE.BoxGeometry(.12, .14, 2.2));
  const accentRailGeometry = ownGeometry(new THREE.BoxGeometry(.035, .07, 1.6));
  const pedestal = mesh(sideRailGeometry, dark, "skimmer-console-pedestal");
  pedestal.position.set(0, 1.37, .63); pedestal.scale.set(2, 3.5, .13); model.add(pedestal);
  for (const x of [-.4, .4]) {
    const grip = mesh(sideRailGeometry, dark, "skimmer-control-grip");
    grip.position.set(x, 1.8, .5); grip.scale.set(1.7, .5, .13); model.add(grip);
  }
  for (const x of [-.93, .93]) {
    const rail = mesh(sideRailGeometry, dark, "skimmer-side-rail"); rail.position.set(x, 1.04, -.05); model.add(rail);
    const accentRail = mesh(accentRailGeometry, identity, "skimmer-side-accent");
    accentRail.position.set(x + Math.sign(x) * .065, 1.08, .05); model.add(accentRail);
  }

  const hoverModules: THREE.Group[] = [];
  const podGeometry = ownGeometry(new THREE.CylinderGeometry(.24, .28, .28, 10));
  const ringGeometry = ownGeometry(new THREE.TorusGeometry(.22, .045, 5, 10));
  const glowGeometry = ownGeometry(new THREE.CircleGeometry(.2, 12));
  for (const x of [-.86, .86]) for (const z of [-1.38, 1.35]) {
    const pod = new THREE.Group(); pod.name = "skimmer-hover-module"; pod.position.set(x, .56, z);
    const shell = mesh(podGeometry, dark, "hover-pod-shell");
    const ring = mesh(ringGeometry, accent, "hover-pod-ring"); ring.rotation.x = Math.PI / 2;
    const glow = mesh(glowGeometry, hoverGlow, "hover-pod-glow"); glow.rotation.x = Math.PI / 2; glow.position.y = -.151;
    pod.add(shell, ring, glow); model.add(pod); hoverModules.push(pod);
  }

  const headLights: THREE.Mesh[] = [], tailLights: THREE.Mesh[] = [];
  const lightGeometry = ownGeometry(new THREE.BoxGeometry(.28, .15, .045));
  for (const x of [-.42, .42]) {
    const light = mesh(lightGeometry, head, "skimmer-headlight"); light.position.set(x, .88, 2.205); model.add(light); headLights.push(light);
    const rear = mesh(lightGeometry, tail, "skimmer-tail-light"); rear.position.set(x, .84, -2.205); model.add(rear); tailLights.push(rear);
  }
  const thrusterGeometry = ownGeometry(new THREE.CylinderGeometry(.17, .24, .48, 10));
  const thrusterGlowGeometry = ownGeometry(new THREE.CircleGeometry(.16, 10));
  for (const x of [-.48, .48]) {
    const thruster = mesh(thrusterGeometry, dark, "skimmer-rear-thruster"); thruster.rotation.x = Math.PI / 2; thruster.position.set(x, .72, -1.96); model.add(thruster);
    const glow = mesh(thrusterGlowGeometry, identity, "skimmer-thruster-glow"); glow.rotation.y = Math.PI; glow.position.set(x, .72, -2.205); model.add(glow);
  }

  const seatAnchor = new THREE.Object3D(); seatAnchor.name = "skimmer-seat-anchor"; seatAnchor.position.set(0, 1.28, -.08);
  // Anchor is the player GROUP origin, not hip height: canonical BR rigs add
  // .26m internally and the capsule torso extends .02m below its rig origin.
  const driverAnchor = new THREE.Object3D(); driverAnchor.name = "skimmer-driver-anchor"; driverAnchor.position.set(0, 1.04, -.08);
  model.add(seatAnchor, driverAnchor);
  const resources = { geometries: [...geometries], materials: [...materials] };
  return { group, model, driverAnchor, seatAnchor, hoverModules, headLights, tailLights, resources, disposed: false };
}

export function updateBrHoverSkimmer(visual: BrHoverSkimmerVisual, frame: Readonly<BrHoverSkimmerFrame>): void {
  if (visual.disposed) return;
  const time = finite(frame.time), speed = clamp(Math.abs(finite(frame.speed ?? 0)) / 14, 0, 1);
  const steering = clamp(finite(frame.steering ?? 0), -1, 1);
  visual.model.position.y = Math.sin(time * 2.35) * (.025 + speed * .018);
  visual.model.rotation.z = -steering * (.035 + speed * .025);
  visual.model.rotation.x = -speed * .018;
  visual.hoverModules.forEach((pod, index) => {
    pod.rotation.z = steering * (index < 2 ? -.12 : .12);
    pod.position.y = .56 + Math.sin(time * 3.1 + index * 1.7) * .018;
  });
  const occupied = frame.occupied !== false;
  for (const light of visual.headLights) light.scale.setScalar(occupied ? 1 + speed * .18 : .72);
  for (const light of visual.tailLights) light.scale.setScalar(1 + Math.abs(steering) * .12);
}

export function disposeBrHoverSkimmer(visual: BrHoverSkimmerVisual): void {
  if (visual.disposed) return;
  visual.disposed = true;
  visual.group.removeFromParent();
  for (const geometry of visual.resources.geometries) geometry.dispose();
  for (const material of visual.resources.materials) material.dispose();
  visual.model.clear();
  visual.group.clear();
}
