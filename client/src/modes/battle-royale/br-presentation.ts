import * as THREE from "three";
import { seededRandom, type BrRoomView } from "@planetfall/shared";

export function createBrBackdrop(): THREE.Group {
  const root = new THREE.Group();
  root.name = "br-space-backdrop";
  const random = seededRandom(4821);
  for (const [count, minRadius, maxRadius, size, color] of [
    [1500, 680, 920, 1.35, 0xa9c8ff],
    [820, 940, 1320, 2.1, 0xf0f7ff],
    [260, 720, 1200, 3.1, 0x9d8cff]
  ] as const) {
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      const radius = minRadius + random() * (maxRadius - minRadius);
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      values[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      values[index * 3 + 1] = Math.cos(phi) * radius;
      values[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(values, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: .88 }));
    root.add(points);
  }

  const nebulaTexture = createNebulaTexture();
  for (const [x, y, z, scale, opacity, tint] of [
    [-660, 210, -780, 520, .2, 0x875cff],
    [710, -90, -740, 440, .15, 0x2b9fde],
    [180, 380, 920, 560, .13, 0xef5b9d]
  ] as const) {
    const material = new THREE.SpriteMaterial({ map: nebulaTexture, color: tint, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(material); sprite.position.set(x, y, z); sprite.scale.set(scale, scale * .58, 1); root.add(sprite);
  }

  const celestials: Array<[number, number, number, number, number, number?]> = [
    [-710, 260, -690, 92, 0x4e3478, 0x9f78db],
    [760, 80, -620, 62, 0x174b78, 0x62c8ed],
    [590, -130, 800, 118, 0x5b2944, 0xd4759c]
  ];
  for (let index = 0; index < celestials.length; index++) {
    const [x, y, z, radius, color, rim] = celestials[index];
    const group = new THREE.Group(); group.position.set(x, y, z);
    const planet = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 3), new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: .04, emissive: new THREE.Color(color).multiplyScalar(.08) }));
    group.add(planet);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.045, 24, 16), new THREE.MeshBasicMaterial({ color: rim, transparent: true, opacity: .12, side: THREE.BackSide, depthWrite: false })); group.add(atmosphere);
    if (index === 1) { const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.28, radius * 1.65, 48), new THREE.MeshBasicMaterial({ color: 0x7ecdea, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = 1.12; group.add(ring); }
    root.add(group);
  }

  const trafficGeometry = new THREE.BufferGeometry();
  const trafficPoints: THREE.Vector3[] = [];
  for (let index = 0; index < 18; index++) {
    const x = -850 + random() * 1700, y = 110 + random() * 390, z = -760 + random() * 1550;
    trafficPoints.push(new THREE.Vector3(x, y, z), new THREE.Vector3(x + 18 + random() * 28, y + 1, z + 3));
  }
  trafficGeometry.setFromPoints(trafficPoints);
  root.add(new THREE.LineSegments(trafficGeometry, new THREE.LineBasicMaterial({ color: 0x80eaff, transparent: true, opacity: .34 })));
  return root;
}

export function createStarliner(): THREE.Group {
  const ship = new THREE.Group(); ship.name = "starliner";
  const white = new THREE.MeshStandardMaterial({ color: 0xe5edf0, metalness: .58, roughness: .25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111c31, metalness: .76, roughness: .28 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x3d61bf, emissive: 0x142b65, emissiveIntensity: .32, metalness: .54, roughness: .3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x5bd5ff, roughness: .08, metalness: .08, transparent: true, opacity: .66, transmission: .14, depthWrite: false });
  const glow = new THREE.MeshBasicMaterial({ color: 0x70f5ff, transparent: true, opacity: .74, blending: THREE.AdditiveBlending, depthWrite: false });
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(9.5, 46, 10, 20), white); hull.rotation.x = Math.PI / 2; hull.position.y = -7; ship.add(hull);
  const undercarriage = new THREE.Mesh(new THREE.BoxGeometry(17, 7, 33), dark); undercarriage.position.set(0, -10, 3); ship.add(undercarriage);
  const dropBay = new THREE.Mesh(new THREE.BoxGeometry(20, 2, 22), blue); dropBay.position.set(0, -13.2, 2); ship.add(dropBay);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(7.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass); cockpit.rotation.x = Math.PI / 2; cockpit.position.set(0, -1.2, -18); ship.add(cockpit);
  for (const x of [-14, 14]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 1.1, 20), blue); wing.position.set(x, -7, 3); wing.rotation.z = x < 0 ? -.05 : .05; ship.add(wing);
    const enginePod = new THREE.Mesh(new THREE.CapsuleGeometry(3.3, 10, 7, 12), dark); enginePod.rotation.x = Math.PI / 2; enginePod.position.set(x, -8.5, 12); ship.add(enginePod);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 5, 12), white); nozzle.rotation.x = Math.PI / 2; nozzle.position.set(x, -8.5, 20); ship.add(nozzle);
    const trail = new THREE.Mesh(new THREE.ConeGeometry(3, 38, 12, 1, true), glow.clone()); trail.rotation.x = -Math.PI / 2; trail.position.set(x, -8.5, 41); trail.userData.engineTrail = true; ship.add(trail);
  }
  for (const side of [-1, 1]) {
    const stabilizer = new THREE.Mesh(new THREE.BoxGeometry(2, 12, 15), blue); stabilizer.position.set(side * 8, -2, 13); stabilizer.rotation.z = side * -.2; ship.add(stabilizer);
    const sideRail = new THREE.Mesh(new THREE.BoxGeometry(.5, 2.4, 37), glow); sideRail.position.set(side * 8.2, -5.5, 0); ship.add(sideRail);
  }
  for (const z of [-13, -5, 3, 11]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(9.6, .48, 7, 22), z === 3 ? blue : dark); band.rotation.x = Math.PI / 2; band.position.set(0, -7, z); ship.add(band);
  }
  const topBridge = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 14), white); topBridge.position.set(0, 1, -7); ship.add(topBridge);
  const bridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(10.2, 1.5, 5), glass); bridgeGlass.position.set(0, 2.1, -12); ship.add(bridgeGlass);
  for (const x of [-3.5, 3.5]) { const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.16, .22, 6, 7), dark); antenna.position.set(x, 6, -4); ship.add(antenna); }
  ship.scale.setScalar(1.08);
  ship.visible = false;
  return ship;
}

export function updateStarliner(ship: THREE.Group, room: BrRoomView | null, now: number): void {
  ship.visible = Boolean(room?.ship);
  if (!room?.ship) return;
  ship.position.set(room.ship.position.x, room.ship.position.y, room.ship.position.z);
  ship.lookAt(room.ship.end.x, room.ship.end.y, room.ship.end.z);
  ship.rotateY(Math.PI);
  ship.traverse((object) => {
    if (!object.userData.engineTrail) return;
    const pulse = .94 + Math.sin(now * .012 + object.id) * .08;
    object.scale.set(pulse, 1, pulse);
  });
}

export function createVoidStorm(): THREE.Group {
  const root = new THREE.Group(); root.name = "void-storm"; root.visible = false;
  for (let index = 0; index < 5; index++) {
    const geometry = new THREE.CylinderGeometry(1 + index * .008, 1 + index * .008, 180 - index * 9, 96, 8, true);
    const material = new THREE.MeshBasicMaterial({
      color: index % 2 ? 0x487eff : 0xa95cff,
      transparent: true, opacity: .06 + index * .016, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending, wireframe: index === 4
    });
    const layer = new THREE.Mesh(geometry, material); layer.position.y = index * 2; layer.userData.stormLayer = true; layer.userData.index = index; root.add(layer);
  }
  const ground = new THREE.Mesh(new THREE.TorusGeometry(1, .012, 6, 128), new THREE.MeshBasicMaterial({ color: 0xb878ff, transparent: true, opacity: .82, blending: THREE.AdditiveBlending, depthWrite: false }));
  ground.rotation.x = Math.PI / 2; ground.position.y = .65; ground.userData.stormGround = true; root.add(ground);
  const sparkGeometry = new THREE.BufferGeometry();
  const sparkPositions = new Float32Array(360 * 3);
  const random = seededRandom(7302);
  for (let index = 0; index < 360; index++) { const angle = random() * Math.PI * 2; sparkPositions[index * 3] = Math.cos(angle); sparkPositions[index * 3 + 1] = random() * 170; sparkPositions[index * 3 + 2] = Math.sin(angle); }
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  const sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({ color: 0xd5c3ff, size: .022, transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthWrite: false })); sparks.userData.stormSparks = true; root.add(sparks);
  return root;
}

export function updateVoidStorm(storm: THREE.Group, room: BrRoomView | null, now: number): void {
  if (!room) { storm.visible = false; return; }
  storm.visible = true;
  storm.position.set(room.storm.center.x, 0, room.storm.center.z);
  storm.scale.set(room.storm.radius, 1, room.storm.radius);
  const closing = room.storm.stage === "closing";
  for (const child of storm.children) {
    if (child.userData.stormLayer) {
      const index = Number(child.userData.index);
      child.rotation.y = (index % 2 ? 1 : -1) * now * (.000025 + index * .000012);
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = (closing ? .1 : .055) + index * .012 + Math.sin(now * .003 + index) * .018;
    } else if (child.userData.stormGround) {
      child.rotation.z = now * .00018;
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = .65 + Math.sin(now * .006) * .2;
    } else if (child.userData.stormSparks) {
      child.rotation.y = -now * .00013;
    }
  }
}

function createNebulaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 126);
  gradient.addColorStop(0, "rgba(255,255,255,.9)"); gradient.addColorStop(.3, "rgba(180,140,255,.45)"); gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient; context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
