import * as THREE from "three";
import { seededRandom, type BrRoomView } from "@planetfall/shared";
import { brStormBandPositions, brStormCurtainRepeats, brStormDetail, brStormLayerSpacing, BR_STORM_BAND_SEGMENTS, BR_STORM_HEIGHT } from "./br-storm-shape";
import { createStarlinerHull, createStarlinerWing } from "./br-starliner-hull";

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
  const glass = new THREE.MeshStandardMaterial({ color: 0x163e63, emissive:0x14384b, emissiveIntensity:.32, roughness: .18, metalness: .5 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x70f5ff, transparent: true, opacity: .74, blending: THREE.AdditiveBlending, depthWrite: false });
  const hull = new THREE.Mesh(createStarlinerHull(), [white,dark,blue]); hull.position.y = -7; ship.add(hull);
  const undercarriage = new THREE.Mesh(new THREE.BoxGeometry(17, 7, 33), dark); undercarriage.position.set(0, -10, 3); ship.add(undercarriage);
  const dropBay = new THREE.Mesh(new THREE.BoxGeometry(20, 2, 22), blue); dropBay.position.set(0, -13.2, 2); ship.add(dropBay);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(9,2.2,7.5), glass); cockpit.rotation.x=.1;cockpit.position.set(0,1.5,-18.5); ship.add(cockpit);
  const sweptWing=createStarlinerWing();
  for (const x of [-14, 14]) {
    const wing = new THREE.Mesh(sweptWing, blue); wing.position.y=-7;wing.scale.x=Math.sign(x); ship.add(wing);
    const enginePod = new THREE.Mesh(new THREE.CapsuleGeometry(3.3, 10, 7, 12), dark); enginePod.rotation.x = Math.PI / 2; enginePod.position.set(x, -8.5, 12); ship.add(enginePod);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 5, 12), white); nozzle.rotation.x = Math.PI / 2; nozzle.position.set(x, -8.5, 20); ship.add(nozzle);
    const trailMaterial=glow.clone();trailMaterial.opacity=.28;
    const trail = new THREE.Mesh(new THREE.ConeGeometry(3, 38, 12, 1, true), trailMaterial); trail.rotation.x = Math.PI / 2; trail.position.set(x, -8.5, 41); trail.userData.engineTrail = true; ship.add(trail);
  }
  for (const side of [-1, 1]) {
    const stabilizer = new THREE.Mesh(new THREE.BoxGeometry(2, 12, 15), blue); stabilizer.position.set(side * 8, -2, 13); stabilizer.rotation.z = side * -.2; ship.add(stabilizer);
    const sideRail = new THREE.Mesh(new THREE.BoxGeometry(.5, 2.4, 37), glow); sideRail.position.set(side * 8.2, -5.5, 0); ship.add(sideRail);
  }
  const roofFrame=new THREE.BoxGeometry(12.4,.26,.55);
  for (const z of [-12,-4,4,12]) {const frame=new THREE.Mesh(roofFrame,dark);frame.position.set(0,1.1,z);ship.add(frame);}
  const topBridge = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 14), white); topBridge.position.set(0, 1, -7); ship.add(topBridge);
  const bridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(10.2, 1.5, 5), glass); bridgeGlass.position.set(0, 2.1, -12); ship.add(bridgeGlass);
  const centerEngine = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4, 6, 14), dark); centerEngine.rotation.x = Math.PI / 2; centerEngine.position.set(0, -7, 28.5); ship.add(centerEngine);
  const nozzleRim=new THREE.Mesh(new THREE.TorusGeometry(3.35,.24,6,18),glow);nozzleRim.position.set(0,-7,31.6);ship.add(nozzleRim);
  const centerTrailMaterial=glow.clone();centerTrailMaterial.opacity=.32;
  const centerTrail = new THREE.Mesh(new THREE.ConeGeometry(3.2, 28, 14, 1, true), centerTrailMaterial); centerTrail.rotation.x = Math.PI / 2; centerTrail.position.set(0, -7, 45.7); centerTrail.userData.engineTrail = true; ship.add(centerTrail);
  for (const side of [-1, 1]) {
    const cargoPod = new THREE.Mesh(new THREE.CapsuleGeometry(2.15, 15, 6, 10), dark); cargoPod.rotation.x = Math.PI / 2; cargoPod.position.set(side * 7.2, -12.4, 1); ship.add(cargoPod);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 9, 13), blue); fin.position.set(side * 12.4, -2.6, 13.5); fin.rotation.z = side * -.38; ship.add(fin);
    for (let panel = 0; panel < 5; panel++) {
      const hullPanel = new THREE.Mesh(new THREE.BoxGeometry(.34, 4.2, 5), panel % 2 ? blue : dark);
      hullPanel.position.set(side * 9.62, -6.4, -12 + panel * 6.2); ship.add(hullPanel);
    }
  }
  for (let deck = 0; deck < 4; deck++) {
    const bayLight = new THREE.Mesh(new THREE.BoxGeometry(3.2, .16, .34), glow); bayLight.position.set(0, -14.28, -6 + deck * 5); ship.add(bayLight);
  }
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
  const curtain=createStormCurtain();
  const curtainGeometry=createStormFadeGeometry(BR_STORM_HEIGHT,false);
  for (let index = 0; index < 3; index++) {
    const material = new THREE.MeshBasicMaterial({
      color: index % 2 ? 0x739fff : 0xb995ff,
      transparent: true, opacity: .3, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending, map: curtain,
      vertexColors: true, toneMapped: false, forceSinglePass: true
    });
    const layer = new THREE.Mesh(curtainGeometry, material); layer.position.y = BR_STORM_HEIGHT/2; layer.userData.stormLayer = true; layer.userData.index = index; root.add(layer);
  }
  // A low, continuous cyan-violet edge supplies depth at eye level, even when
  // the floor annulus is nearly edge-on. It fades fully out above the player.
  const boundaryGlow=new THREE.Mesh(createStormFadeGeometry(5,true),new THREE.MeshBasicMaterial({
    color:0xb2bcff,transparent:true,opacity:.5,side:THREE.DoubleSide,
    depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,toneMapped:false,forceSinglePass:true
  }));
  boundaryGlow.position.y=2.5;boundaryGlow.userData.stormBoundaryGlow=true;root.add(boundaryGlow);
  const bandGeometry=new THREE.BufferGeometry();
  bandGeometry.setAttribute("position",new THREE.BufferAttribute(brStormBandPositions(1),3).setUsage(THREE.DynamicDrawUsage));
  const indices:number[]=[];
  for(let i=0;i<BR_STORM_BAND_SEGMENTS;i++){const next=i+BR_STORM_BAND_SEGMENTS+1;indices.push(i,next,i+1,i+1,next,next+1);}
  bandGeometry.setIndex(indices);
  const ground = new THREE.Mesh(bandGeometry, new THREE.MeshBasicMaterial({ color: 0xe0d6ff, transparent: true, opacity: .9, side:THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped:false, forceSinglePass:true }));
  ground.userData.stormGround = true; root.add(ground);
  const sparkGeometry = new THREE.BufferGeometry();
  const sparkPositions = new Float32Array(360 * 3);
  const random = seededRandom(7302);
  for (let index = 0; index < 360; index++) { const angle = random() * Math.PI * 2; sparkPositions[index * 3] = Math.cos(angle); sparkPositions[index * 3 + 1] = random() * 170; sparkPositions[index * 3 + 2] = Math.sin(angle); }
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  const sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({ color: 0xd5c3ff, size: .24, transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false })); sparks.userData.stormSparks = true; root.add(sparks);
  for (let arcIndex = 0; arcIndex < 12; arcIndex++) {
    const start = random() * Math.PI * 2, span = .1 + random() * .34, height = 6 + random() * 158;
    const points: THREE.Vector3[] = [];
    for (let pointIndex = 0; pointIndex < 7; pointIndex++) {
      const t = pointIndex / 6, angle = start + span * t;
      const jitter = pointIndex === 0 || pointIndex === 6 ? 0 : (random() - .5) * .026;
      points.push(new THREE.Vector3(Math.cos(angle) * (1.012 + jitter), height + Math.sin(t * Math.PI) * (4 + random() * 7), Math.sin(angle) * (1.012 + jitter)));
    }
    const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: arcIndex % 3 ? 0xa993ff : 0xe4f8ff, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false }));
    arc.userData.stormArc = true; arc.userData.index = arcIndex; root.add(arc);
  }
  return root;
}

export function updateVoidStorm(storm: THREE.Group, room: Pick<BrRoomView,"storm"> | null, now: number, quality: "low"|"medium"|"high" = "high"): void {
  if (!room || !Number.isFinite(room.storm.radius) || room.storm.radius <= 0) { storm.visible = false; return; }
  storm.visible = true;
  storm.position.set(room.storm.center.x, 0, room.storm.center.z);
  const radius=room.storm.radius;
  const detail=brStormDetail(quality,radius);
  const layerSpacing=brStormLayerSpacing(radius);
  const curtainRepeats=brStormCurtainRepeats(radius);
  const closing = room.storm.stage === "closing";
  for (const child of storm.children) {
    if (child.userData.stormLayer) {
      const index = Number(child.userData.index);
      child.visible=index<detail.layers;
      child.scale.set(radius+index*layerSpacing,1,radius+index*layerSpacing);
      child.rotation.y = (index % 2 ? 1 : -1) * now * (.000025 + index * .000012);
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = (closing ? .48 : .36) - index * .07 + Math.sin(now * .002 + index) * .025;
      if(material.map){material.map.offset.y=now*.000025;material.map.repeat.x=curtainRepeats;}
    } else if (child.userData.stormBoundaryGlow) {
      child.scale.set(radius,1,radius);
      const material=(child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity=(closing ? .52 : .42)+Math.sin(now*.002)*.025;
    } else if (child.userData.stormGround) {
      const geometry=(child as THREE.Mesh).geometry;
      if(child.userData.radius!==radius){
        const position=geometry.getAttribute("position") as THREE.BufferAttribute;
        brStormBandPositions(radius,position.array as Float32Array);position.needsUpdate=true;
        geometry.computeBoundingSphere();child.userData.radius=radius;
      }
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = .85 + Math.sin(now * .006) * .1;
    } else if (child.userData.stormSparks) {
      child.scale.set(radius,1,radius);
      (child as THREE.Points).geometry.setDrawRange(0,detail.sparks);
      child.rotation.y = -now * .00013;
    } else if (child.userData.stormArc) {
      const index = Number(child.userData.index);
      child.visible=index<detail.arcs;
      child.scale.set(radius,1,radius);
      child.rotation.y = now * (index % 2 ? .000055 : -.000043) + index;
      const material = (child as THREE.Line).material as THREE.LineBasicMaterial;
      material.opacity = .12 + Math.max(0, Math.sin(now * .004 + index * 1.7)) * .42;
    }
  }
}

function createStormFadeGeometry(height:number,boundary:boolean):THREE.CylinderGeometry {
  const geometry=new THREE.CylinderGeometry(1,1,height,BR_STORM_BAND_SEGMENTS,8,true);
  const positions=geometry.getAttribute("position");
  const colors=new Float32Array(positions.count*3);
  for(let i=0;i<positions.count;i++) {
    const y=positions.getY(i)+height/2;
    // Additive black contributes no light, so the low boundary disappears
    // smoothly at its top while the tall veil retains a quiet upper haze.
    const intensity=boundary?Math.pow(1-y/height,2):.12+.88*Math.exp(-y/28);
    colors[i*3]=colors[i*3+1]=colors[i*3+2]=intensity;
  }
  geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));
  return geometry;
}

function createStormCurtain():THREE.CanvasTexture {
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
  const context=canvas.getContext("2d")!;const random=seededRandom(48321);
  context.clearRect(0,0,256,256);
  // A quiet haze joins the streaks into a readable wall, without an opaque
  // overlay. The repeating texture remains continuous at both vertical edges.
  context.fillStyle="rgba(120,160,255,.22)";context.fillRect(0,0,256,256);
  for(let i=0;i<44;i++) {
    const x=random()*256,y=random()*256,width=1+random()*7,height=22+random()*150;
    const alpha=.18+random()*.55;
    for(let copy=0;copy<(y+height>256?2:1);copy++) {
      const top=y-copy*256;
      // A wrapped rectangle needs a wrapped gradient too. Reusing the original
      // gradient made its copied pixels transparent and left a repeating seam.
      const gradient=context.createLinearGradient(x,top,x,top+height);
      gradient.addColorStop(0,"rgba(160,200,255,0)");gradient.addColorStop(.4,`rgba(185,215,255,${alpha})`);gradient.addColorStop(1,"rgba(160,200,255,0)");
      context.fillStyle=gradient;context.fillRect(x,top,width,height);
    }
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(10,2);return texture;
}

function createNebulaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 126);
  gradient.addColorStop(0, "rgba(255,255,255,.9)"); gradient.addColorStop(.3, "rgba(180,140,255,.45)"); gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient; context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
