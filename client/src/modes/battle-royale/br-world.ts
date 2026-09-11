import * as THREE from "three";
import {
  BR_ISLAND_OUTLINE,
  BR_MAP_BLOCKS,
  BR_POIS,
  BR_ROADS,
  BR_SECONDARY_LOCATIONS,
  BR_STRUCTURES,
  BR_TERRAIN_PATCHES,
  BR_TRAVERSAL,
  seededRandom,
  type BrPoi,
  type BrStructure
} from "@planetfall/shared";
import type { GraphicsQuality } from "../../settings";
import { BrMaterialLibrary } from "./br-materials";

export type BrPoiLabel = { sprite: THREE.Sprite; position: THREE.Vector3 };

type DistrictDetail = {
  group: THREE.Group;
  center: THREE.Vector3;
  visible: boolean;
};

type MatrixSpec = {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  rotationY?: number;
  rotationX?: number;
  rotationZ?: number;
};

const position = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export class BrWorldRenderer {
  readonly root = new THREE.Group();
  readonly collidableMeshes: THREE.Mesh[] = [];
  readonly poiLabels: BrPoiLabel[] = [];
  readonly materials = new BrMaterialLibrary();

  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly districtDetails: DistrictDetail[] = [];
  private readonly animated: THREE.Object3D[] = [];
  private readonly energyMaterials: THREE.Material[] = [];
  private readonly secondaryLabels:THREE.Sprite[]=[];
  private quality: GraphicsQuality;
  private disposed = false;

  constructor(quality: GraphicsQuality) {
    this.quality = quality;
    this.root.name = "orbital-isle";
    this.buildSurface();
    this.buildRoads();
    this.buildGameplayGeometry();
    this.buildArchitecture();
    this.buildDistricts();
    this.buildSecondaryLocations();
    this.buildConnectiveDressing();
    this.buildTraversal();
    this.buildUnderside();
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.cameraCollision === true) this.collidableMeshes.push(object);
    });
  }

  setQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
        object.castShadow = quality === "high" && object.userData.cameraCollision === true;
      }
    });
  }

  debugStats(): { objects: number; meshes: number; instances: number; materials: number; visibleDistricts: number } {
    let objects = 0, meshes = 0, instances = 0; const materials = new Set<THREE.Material>();
    this.root.traverse((object) => {
      objects++;
      if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
        meshes++;
        if (object instanceof THREE.InstancedMesh) instances += object.count;
        const source = object.material; for (const material of Array.isArray(source) ? source : [source]) materials.add(material);
      }
    });
    return { objects, meshes, instances, materials: materials.size, visibleDistricts: this.districtDetails.filter((detail) => detail.group.visible).length };
  }

  update(camera: THREE.Camera, now: number): void {
    // Building silhouettes remain visible island-wide; only facade, signage and
    // interior dressing are sector-activated. Keeping aerial views out of the
    // near-detail tier prevents the Starliner sequence from rendering the whole
    // settlement's interiors at once.
    const maxDetailDistance = this.quality === "high" ? 340 : this.quality === "medium" ? 250 : 170;
    for (const detail of this.districtDetails) {
      const distance = camera.position.distanceTo(detail.center);
      const nextVisible = distance < maxDetailDistance + (detail.visible ? 36 : 0);
      if (nextVisible !== detail.visible) {
        detail.visible = nextVisible;
        detail.group.visible = nextVisible;
      }
    }
    for (let index = 0; index < this.animated.length; index++) {
      const object = this.animated[index];
      const speed = Number(object.userData.rotationSpeed ?? .0002);
      object.rotation.y = now * speed + Number(object.userData.rotationOffset ?? 0);
      if (object.userData.pulse) {
        const base = Number(object.userData.baseScale ?? 1);
        object.scale.setScalar(base + Math.sin(now * .0024 + index) * .035);
      }
    }
    for (let index = 0; index < this.energyMaterials.length; index++) {
      const material = this.energyMaterials[index] as THREE.MeshBasicMaterial;
      material.opacity = THREE.MathUtils.clamp(.45 + Math.sin(now * .002 + index * 1.7) * .16, .22, .76);
    }
    for(const label of this.secondaryLabels){label.visible=camera.position.y<110&&camera.position.distanceTo(label.position)<175;}
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const geometry of this.geometries) geometry.dispose();
    this.materials.dispose();
    this.geometries.clear();
    this.collidableMeshes.length = 0;
    this.poiLabels.length = 0;
    this.districtDetails.length = 0;
    this.animated.length = 0;
    this.energyMaterials.length = 0;
    this.secondaryLabels.length=0;
    this.root.clear();
  }

  private geometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.add(geometry);
    return geometry;
  }

  private buildSurface(): void {
    const shape = new THREE.Shape();
    BR_ISLAND_OUTLINE.forEach(([x, z], index) => index ? shape.lineTo(x, z) : shape.moveTo(x, z));
    shape.closePath();
    const shell = new THREE.Mesh(
      this.geometry(new THREE.ExtrudeGeometry(shape, { depth: 22, bevelEnabled: true, bevelSize: 4.6, bevelThickness: 3, bevelSegments: 3 })),
      this.materials.get("paintedMetal")
    );
    shell.rotation.x = Math.PI / 2;
    shell.position.y = -3;
    shell.receiveShadow = true;
    shell.userData.cameraCollision = true;
    this.root.add(shell);

    const panelTexture = this.materials.createPanelTexture();
    const panelMaterial = this.materials.own(new THREE.MeshStandardMaterial({ map: panelTexture, color: 0x56738a, roughness: .74, metalness: .25 }));
    const panelMatrices: MatrixSpec[] = [];
    for (let x = -438; x <= 438; x += 44) {
      for (let z = -430; z <= 430; z += 44) {
        if (!this.insideIsland(x, z, 22)) continue;
        panelMatrices.push({ position: position(x + ((Math.abs(Math.round(z / 44)) % 2) * 7), .04, z), scale: position(39, .08, 39), rotationY: ((x + z) / 44 % 2) * .035 });
      }
    }
    this.addInstances(this.root, this.materials.unitBox, panelMaterial, panelMatrices, false);

    for (const patch of BR_TERRAIN_PATCHES) {
      const key = patch.kind === "park" ? "grass" : patch.kind === "coolant" ? "glass" : patch.kind === "industrial" ? "concrete" : "sidewalk";
      const deck = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(patch.size.x, patch.size.y, patch.size.z)), this.materials.get(key));
      deck.position.set(patch.position.x, patch.position.y, patch.position.z);
      deck.rotation.y = patch.rotation;
      deck.receiveShadow = true;
      this.root.add(deck);
      const trim = new THREE.LineSegments(
        this.geometry(new THREE.EdgesGeometry(deck.geometry)),
        this.materials.own(new THREE.LineBasicMaterial({ color: patch.kind === "coolant" ? 0x70f5ff : 0x88a7b8, transparent: true, opacity: .7 }))
      );
      trim.position.copy(deck.position);
      trim.rotation.copy(deck.rotation);
      trim.userData.cameraCollision = false;
      this.root.add(trim);
    }

    const rimPoints = BR_ISLAND_OUTLINE.map(([x, z]) => new THREE.Vector3(x, .25, z));
    for (const [y, radius, color, opacity] of [[.2, 1.5, 0x70f5ff, .82], [-7, 1.2, 0x2b668b, .7], [-16, .85, 0xa86bff, .45]] as const) {
      const curve = new THREE.CatmullRomCurve3(rimPoints.map((point) => point.clone().setY(y)), true, "catmullrom", .08);
      const rim = new THREE.Mesh(this.geometry(new THREE.TubeGeometry(curve, 144, radius, 6, true)), this.materials.translucent(color, opacity, true));
      rim.userData.cameraCollision = false;
      this.root.add(rim);
    }

    const maintenance: MatrixSpec[] = [];
    const edgeArmor: MatrixSpec[] = [];
    const edgeRibs: MatrixSpec[] = [];
    const edgeBeacons: MatrixSpec[] = [];
    for (let index = 0; index < BR_ISLAND_OUTLINE.length; index++) {
      const [x, z] = BR_ISLAND_OUTLINE[index];
      const [nextX, nextZ] = BR_ISLAND_OUTLINE[(index + 1) % BR_ISLAND_OUTLINE.length];
      const length = Math.hypot(nextX - x, nextZ - z);
      const angle = -Math.atan2(nextZ - z, nextX - x);
      maintenance.push({ position: position((x + nextX) / 2, -10, (z + nextZ) / 2), scale: position(length - 4, 12, 2.4), rotationY: angle });
      const segmentCount = Math.max(2, Math.floor(length / 22));
      for (let segment = 0; segment < segmentCount; segment++) {
        const t = (segment + .5) / segmentCount;
        const px = THREE.MathUtils.lerp(x, nextX, t), pz = THREE.MathUtils.lerp(z, nextZ, t);
        edgeArmor.push({ position: position(px, -4.4, pz), scale: position(Math.max(6, length / segmentCount - .8), 6.6, 3.25), rotationY: angle });
        if (segment % 2 === 0) {
          edgeRibs.push({ position: position(px, -13, pz), scale: position(.72, 18, 4.8), rotationY: angle });
          edgeBeacons.push({ position: position(px, -3.1, pz), scale: position(1.05, .34, .34), rotationY: angle });
        }
      }
    }
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("structuralDark"), maintenance, false);
    this.addInstances(this.root, this.materials.unitChamferedBox, this.materials.get("brushedMetal"), edgeArmor, false);
    this.addInstances(this.root, this.materials.unitChamferedBox, this.materials.get("structuralDark"), edgeRibs, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("industrialOrange"), edgeBeacons, false);
  }

  private buildRoads(): void {
    const roads: MatrixSpec[] = [];
    const curbs: MatrixSpec[] = [];
    const edgeLights: MatrixSpec[] = [];
    const dashMatrices: MatrixSpec[] = [];
    const crossings: MatrixSpec[] = [];
    const medians: MatrixSpec[] = [];
    const lampPosts: MatrixSpec[] = [];
    const lampBulbs: MatrixSpec[] = [];
    for (const road of BR_ROADS) {
      const dx = road.to.x - road.from.x;
      const dz = road.to.z - road.from.z;
      const length = Math.hypot(dx, dz);
      const angle = -Math.atan2(dz, dx);
      const pavedWidth = road.width * 1.66;
      const centerX = (road.from.x + road.to.x) / 2;
      const centerZ = (road.from.z + road.to.z) / 2;
      roads.push({ position: position(centerX, .48, centerZ), scale: position(length, .24, pavedWidth), rotationY: angle });
      for (const side of [-1, 1]) {
        const curbOffset = side * pavedWidth * .49;
        const lightOffset = side * pavedWidth * .43;
        curbs.push({ position: position(centerX + Math.sin(angle) * curbOffset, .67, centerZ + Math.cos(angle) * curbOffset), scale: position(length, .3, 1.2), rotationY: angle });
        edgeLights.push({ position: position(centerX + Math.sin(angle) * lightOffset, .86, centerZ + Math.cos(angle) * lightOffset), scale: position(length, .07, .18), rotationY: angle });
      }
      const dashCount = Math.max(2, Math.floor(length / 12));
      for (let index = 0; index < dashCount; index++) {
        const t = (index + .5) / dashCount;
        dashMatrices.push({
          position: position(road.from.x + dx * t, .66, road.from.z + dz * t),
          scale: position(5.2, .035, .42), rotationY: angle
        });
      }
      if (length > 52) {
        for (const endT of [.11, .89]) {
          for (let stripe = -2; stripe <= 2; stripe++) {
            const t = THREE.MathUtils.clamp(endT + stripe * (2.25 / length), .04, .96);
            crossings.push({
              position: position(road.from.x + dx * t, .69, road.from.z + dz * t),
              scale: position(pavedWidth * .58, .025, .72), rotationY: angle + Math.PI / 2
            });
          }
        }
      }
      if (length > 96) {
        for (const t of [.32, .68]) medians.push({
          position: position(road.from.x + dx * t, .73, road.from.z + dz * t),
          scale: position(13, .18, 1.2), rotationY: angle
        });
      }
      const lampCount = Math.max(1, Math.floor(length / 58));
      const nx = -dz / length, nz = dx / length;
      for (let index = 1; index < lampCount; index++) {
        const t = index / lampCount;
        for (const side of [-1, 1]) {
          const x = road.from.x + dx * t + nx * road.width * .62 * side;
          const z = road.from.z + dz * t + nz * road.width * .62 * side;
          lampPosts.push({ position: position(x, 2.25, z), scale: position(.22, 4.5, .22) });
          lampBulbs.push({ position: position(x, 4.62, z), scale: position(.42, .18, .42) });
        }
      }
    }
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("road"), roads, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("sidewalk"), curbs, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("energyCyan"), edgeLights, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("sidewalk"), dashMatrices, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("structuralWhite"), crossings, false);
    this.addInstances(this.root, this.materials.unitChamferedBox, this.materials.get("industrialOrange"), medians, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("structuralDark"), lampPosts, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("energyCyan"), lampBulbs, false);
  }

  private buildGameplayGeometry(): void {
    const batches = new Map<string, typeof BR_MAP_BLOCKS[number][]>();
    for (const block of BR_MAP_BLOCKS) {
      const authoredVisible=block.kind==="platform"||block.kind==="ramp"||block.kind==="cover"||(block.kind==="wall"&&block.id.includes("-room-"));
      if(!authoredVisible)continue;
      const materialKey = block.kind === "platform" || block.kind === "ramp" ? "interiorFloor" : block.kind === "cover" ? "paintedMetal" : "structuralWhite";
      const key = `${block.kind}:${materialKey}`;
      const batch = batches.get(key) ?? [];
      batch.push(block);
      batches.set(key, batch);
    }
    for (const [key, blocks] of batches) {
      const material = this.materials.get(key.split(":")[1] as "interiorFloor" | "paintedMetal" | "structuralWhite");
      const matrices = blocks.map((block) => ({
        position: position(block.position.x, block.position.y, block.position.z),
        scale: position(block.size.x, block.size.y, block.size.z),
        rotationX: block.rotation?.x,
        rotationY: block.rotation?.y,
        rotationZ: block.rotation?.z
      }));
      this.addInstances(this.root, this.materials.unitBox, material, matrices, true);
    }
  }

  private buildArchitecture(): void {
    const allShells: MatrixSpec[] = [];
    for (const poi of [...BR_POIS,...BR_SECONDARY_LOCATIONS]) {
      const group = new THREE.Group();
      group.name = `detail-${poi.id}`;
      const structures = BR_STRUCTURES.filter((structure) => structure.districtId === poi.id);
      const columns: MatrixSpec[] = [];
      const trims: MatrixSpec[] = [];
      const windowsDark: MatrixSpec[] = [];
      const windowsLit: MatrixSpec[] = [];
      const roofUnits: MatrixSpec[] = [];
      const doorFrames: MatrixSpec[] = [];
      const interiorProps: MatrixSpec[] = [];
      const interiorDark: MatrixSpec[] = [];
      const interiorLights: MatrixSpec[] = [];
      const railings: MatrixSpec[] = [];
      const shells: MatrixSpec[] = [];
      const massing: MatrixSpec[] = [];
      const glassVolumes: MatrixSpec[] = [];
      const accentVolumes: MatrixSpec[] = [];
      const machinery: MatrixSpec[] = [];
      for (const structure of structures) {
        this.architectureMatrices(
          structure, shells, columns, trims, windowsDark, windowsLit, roofUnits, doorFrames,
          interiorProps, interiorDark, interiorLights, railings, massing, glassVolumes, accentVolumes, machinery
        );
        const signText = this.facadeSignText(structure);
        if (signText) {
          const sign = this.materials.createSign(signText, { border: poi.color });
          const y = Math.min(structure.size.y - 1.1, 6.4);
          const offset = .75;
          sign.position.set(
            structure.position.x + (structure.entrance === "east" ? structure.size.x / 2 + offset : structure.entrance === "west" ? -structure.size.x / 2 - offset : 0),
            y,
            structure.position.z + (structure.entrance === "north" ? structure.size.z / 2 + offset : structure.entrance === "south" ? -structure.size.z / 2 - offset : 0)
          );
          sign.scale.set(8.5, 2.15, 1); group.add(sign);
        }
      }
      allShells.push(...shells);
      this.addInstances(group, this.materials.unitChamferedBox, this.materials.get("structuralDark"), columns, false);
      this.addInstances(group, this.materials.unitBox, this.materials.accent(poi.color, .12), trims, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("windowDark"), windowsDark, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("windowLit"), windowsLit, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("brushedMetal"), roofUnits, false);
      this.addInstances(group, this.materials.unitBox, this.materials.accent(poi.color, .26), doorFrames, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("interiorWall"), interiorProps, false);
      this.addInstances(group, this.materials.unitChamferedBox, this.materials.get("structuralDark"), interiorDark, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("windowLit"), interiorLights, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("structuralDark"), railings, false);
      this.addInstances(group, this.materials.unitChamferedBox, this.materials.get("structuralWhite"), massing, false);
      this.addInstances(group, this.materials.unitChamferedBox, this.materials.get("glass"), glassVolumes, false);
      this.addInstances(group, this.materials.unitChamferedBox, this.materials.accent(poi.color, .2), accentVolumes, false);
      this.addInstances(group, this.materials.unitCylinder, this.materials.get("brushedMetal"), machinery, false);
      this.root.add(group);
      this.districtDetails.push({ group, center: position(poi.position.x, 0, poi.position.z), visible: true });
    }
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("structuralWhite"), allShells, true);
  }

  private architectureMatrices(
    structure: BrStructure,
    shells: MatrixSpec[],
    columns: MatrixSpec[], trims: MatrixSpec[], darkWindows: MatrixSpec[], litWindows: MatrixSpec[],
    roofUnits: MatrixSpec[], doorFrames: MatrixSpec[], interiorProps: MatrixSpec[], interiorDark: MatrixSpec[],
    interiorLights: MatrixSpec[], railings: MatrixSpec[], massing: MatrixSpec[], glassVolumes: MatrixSpec[],
    accentVolumes: MatrixSpec[], machinery: MatrixSpec[]
  ): void {
    const { x, z } = structure.position;
    const { x: width, y: height, z: depth } = structure.size;
    const wall=.65,door=4.8;
    const shellTrim = structure.style === "city" || structure.style === "mall"
      ? Math.min(5.4, Math.min(width, depth) * .16)
      : 2.2;
    const wallSpec=(px:number,pz:number,sx:number,sz:number)=>shells.push({
      position:position(px,height/2,pz),
      scale:position(sx>=width-.1?Math.max(1,sx-shellTrim):sx,height,sz>=depth-.1?Math.max(1,sz-shellTrim):sz)
    });
    if(!structure.enterable){wallSpec(x,z-depth/2,width,wall);wallSpec(x,z+depth/2,width,wall);wallSpec(x-width/2,z,wall,depth);wallSpec(x+width/2,z,wall,depth);}
    else if(structure.entrance==="north"||structure.entrance==="south"){
      wallSpec(x-width/2,z,wall,depth);wallSpec(x+width/2,z,wall,depth);
      const doorZ=structure.entrance==="north"?z+depth/2:z-depth/2,backZ=structure.entrance==="north"?z-depth/2:z+depth/2;
      wallSpec(x,backZ,width,wall);wallSpec(x-(width+door)/4,doorZ,(width-door)/2,wall);wallSpec(x+(width+door)/4,doorZ,(width-door)/2,wall);
    }else{
      wallSpec(x,z-depth/2,width,wall);wallSpec(x,z+depth/2,width,wall);
      const doorX=structure.entrance==="east"?x+width/2:x-width/2,backX=structure.entrance==="east"?x-width/2:x+width/2;
      wallSpec(backX,z,wall,depth);wallSpec(doorX,z-(depth+door)/4,wall,(depth-door)/2);wallSpec(doorX,z+(depth+door)/4,wall,(depth-door)/2);
    }
    const gameplayFloorHeight = height / structure.floors;
    const visualLevels = structure.style === "industrial" || structure.style === "dock" ? Math.max(structure.floors, Math.round(height / 6)) : Math.max(structure.floors, Math.round(height / 4.4));
    const floorHeight = height / visualLevels;
    columns.push({ position: position(x, .48, z - depth / 2 - .38), scale: position(width - 1.2, .88, .34) });
    columns.push({ position: position(x, .48, z + depth / 2 + .38), scale: position(width - 1.2, .88, .34) });
    columns.push({ position: position(x - width / 2 - .38, .48, z), scale: position(.34, .88, depth - 1.2) });
    columns.push({ position: position(x + width / 2 + .38, .48, z), scale: position(.34, .88, depth - 1.2) });
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      const corner = structure.style === "city" || structure.style === "mall" || structure.archetype === "tower" || structure.archetype === "hotel"
        ? THREE.MathUtils.clamp(Math.min(width, depth) * .11, 2.1, 4.2)
        : 1.55;
      columns.push({ position: position(x + sx * (width / 2 - corner * .42), height / 2, z + sz * (depth / 2 - corner * .42)), scale: position(corner, height + 1.1, corner) });
    }
    const panelHeight = Math.max(2.8, height * .72);
    columns.push({ position: position(x, height * .52, z - depth / 2 - .22), scale: position(width * .76, panelHeight, .16) });
    columns.push({ position: position(x, height * .52, z + depth / 2 + .22), scale: position(width * .76, panelHeight, .16) });
    columns.push({ position: position(x - width / 2 - .22, height * .52, z), scale: position(.16, panelHeight, depth * .7) });
    columns.push({ position: position(x + width / 2 + .22, height * .52, z), scale: position(.16, panelHeight, depth * .7) });
    for (let floor = 0; floor < visualLevels; floor++) {
      const y = floorHeight * (floor + 1);
      trims.push({ position: position(x, y, z - depth / 2 - .12), scale: position(width, .34, .3) });
      trims.push({ position: position(x, y, z + depth / 2 + .12), scale: position(width, .34, .3) });
      trims.push({ position: position(x - width / 2 - .12, y, z), scale: position(.3, .34, depth) });
      trims.push({ position: position(x + width / 2 + .12, y, z), scale: position(.3, .34, depth) });
      for (const offset of [-.2, .2]) trims.push({ position: position(x, Math.max(.65, y - .3), z + depth * offset), scale: position(width * .46, .07, .16) });
      const windowY = Math.max(1.65, floor * floorHeight + floorHeight * .54);
      const xCount = Math.max(2, Math.floor((width - 5) / 4));
      const zCount = Math.max(2, Math.floor((depth - 5) / 4));
      for (let index = 0; index < xCount; index++) {
        const wx = x - width / 2 + 3 + index * ((width - 6) / Math.max(1, xCount - 1));
        const target = (index + floor + structure.id.length) % 4 === 0 ? litWindows : darkWindows;
        target.push({ position: position(wx, windowY, z - depth / 2 - .36), scale: position(2.25, Math.min(1.2, floorHeight * .28), .16) });
        target.push({ position: position(wx, windowY, z + depth / 2 + .36), scale: position(2.25, Math.min(1.2, floorHeight * .28), .16) });
      }
      for (let index = 0; index < zCount; index++) {
        const wz = z - depth / 2 + 3 + index * ((depth - 6) / Math.max(1, zCount - 1));
        const target = (index + floor + structure.id.length) % 5 === 0 ? litWindows : darkWindows;
        target.push({ position: position(x - width / 2 - .36, windowY, wz), scale: position(.16, Math.min(1.2, floorHeight * .28), 2.25) });
        target.push({ position: position(x + width / 2 + .36, windowY, wz), scale: position(.16, Math.min(1.2, floorHeight * .28), 2.25) });
      }
    }
    const facadeHeight = Math.max(3, height * .62);
    const facadeY = Math.max(2.1, height * .54);
    const accentWidth = structure.style === "city" || structure.style === "mall" ? 1.25 : .72;
    for (const side of [-1, 1]) {
      trims.push({ position: position(x + side * width * .31, facadeY, z - depth / 2 - .43), scale: position(accentWidth, facadeHeight, .19) });
      trims.push({ position: position(x + side * width * .31, facadeY, z + depth / 2 + .43), scale: position(accentWidth, facadeHeight, .19) });
    }
    if (structure.style === "reactor" || structure.style === "industrial" || structure.style === "dock") {
      for (const side of [-1, 1]) trims.push({ position: position(x + side * (width / 2 + .44), facadeY, z), scale: position(.2, facadeHeight, Math.max(2.2, depth * .16)) });
    }
    roofUnits.push({ position: position(x - width * .2, height + .7, z + depth * .18), scale: position(Math.min(6, width * .22), 1.4, Math.min(4.5, depth * .2)) });
    roofUnits.push({ position: position(x + width * .22, height + .42, z - depth * .16), scale: position(Math.min(3.5, width * .16), .8, Math.min(5, depth * .24)) });
    roofUnits.push({ position: position(x, height + .32, z), scale: position(width * .58, .58, depth * .36) });
    trims.push({ position: position(x, height + .26, z), scale: position(width + 1.5, .48, depth + 1.5) });
    if (height > 15) {
      roofUnits.push({ position: position(x, height + 1.15, z), scale: position(width * .36, 1.65, depth * .42) });
      for (const side of [-1, 1]) columns.push({ position: position(x + side * (width / 2 + .52), height * .72, z), scale: position(.65, height * .42, depth * .22) });
      const crownWidth = structure.style === "city" ? width * .5 : width * .38;
      roofUnits.push({ position: position(x - width * .12, height + 2.25, z + depth * .06), scale: position(crownWidth, .58, depth * .28) });
      trims.push({ position: position(x + width * .19, height + 2.62, z - depth * .08), scale: position(width * .22, .2, depth * .2) });
      for (const side of [-1, 1]) {
        const finHeight = Math.min(8, height * .22);
        trims.push({ position: position(x + side * (width / 2 + .7), height - finHeight * .52, z + side * depth * .14), scale: position(.38, finHeight, depth * .26) });
      }
    }
    if (structure.style === "city" && height > 20) {
      for (const side of [-1, 1]) {
        roofUnits.push({ position: position(x + side * width * .34, height * .77, z - depth / 2 - .5), scale: position(width * .12, height * .18, .72) });
        roofUnits.push({ position: position(x + side * width * .34, height * .57, z + depth / 2 + .5), scale: position(width * .12, height * .15, .72) });
      }
    }

    const doorHalf = 2.7;
    const northSouth = structure.entrance === "north" || structure.entrance === "south";
    const doorX = northSouth ? x : x + (structure.entrance === "east" ? width / 2 + .48 : -width / 2 - .48);
    const doorZ = northSouth ? z + (structure.entrance === "north" ? depth / 2 + .48 : -depth / 2 - .48) : z;
    if (northSouth) {
      doorFrames.push({ position: position(doorX - doorHalf, 2.1, doorZ), scale: position(.42, 4.2, .5) });
      doorFrames.push({ position: position(doorX + doorHalf, 2.1, doorZ), scale: position(.42, 4.2, .5) });
      doorFrames.push({ position: position(doorX, 4.05, doorZ), scale: position(5.8, .38, .55) });
      doorFrames.push({ position: position(doorX, 4.45, doorZ + (structure.entrance === "north" ? .75 : -.75)), scale: position(7.4, .22, 1.8) });
    } else {
      doorFrames.push({ position: position(doorX, 2.1, doorZ - doorHalf), scale: position(.5, 4.2, .42) });
      doorFrames.push({ position: position(doorX, 2.1, doorZ + doorHalf), scale: position(.5, 4.2, .42) });
      doorFrames.push({ position: position(doorX, 4.05, doorZ), scale: position(.55, .38, 5.8) });
      doorFrames.push({ position: position(doorX + (structure.entrance === "east" ? .75 : -.75), 4.45, doorZ), scale: position(1.8, .22, 7.4) });
    }
    for (let index = 0; index < Math.min(4, 1 + structure.floors); index++) {
      interiorProps.push({ position: position(x - width * .22 + index * 2.8, .62, z + depth * .2), scale: position(2.1, 1.2, .75), rotationY: index % 2 ? Math.PI / 2 : 0 });
    }
    if (structure.roofAccess) {
      const segments = 5;
      for (let index = 0; index < segments; index++) {
        const t = (index + .5) / segments - .5;
        railings.push({ position: position(x + t * (width - 2), height + .7, z - depth / 2 + .4), scale: position(width / segments - .3, .12, .12) });
        railings.push({ position: position(x + t * (width - 2), height + .7, z + depth / 2 - .4), scale: position(width / segments - .3, .12, .12) });
      }
    }
    if ((structure.style === "city" || structure.style === "mall" || structure.style === "academy") && structure.floors > 1) {
      const balconyY = Math.min(height - 1.2, gameplayFloorHeight + .35);
      const frontZ = structure.entrance === "north" ? z + depth / 2 + .7 : z - depth / 2 - .7;
      roofUnits.push({ position: position(x, balconyY, frontZ), scale: position(width * .45, .22, 1.5) });
      railings.push({ position: position(x, balconyY + .72, frontZ + (structure.entrance === "north" ? .68 : -.68)), scale: position(width * .45, .12, .12) });
      for (const side of [-1, 1]) railings.push({ position: position(x + side * width * .225, balconyY + .72, frontZ), scale: position(.12, .12, 1.35) });
    }
    if(structure.archetype==="shop"||structure.archetype==="transit"){
      const northSouth=structure.entrance==="north"||structure.entrance==="south";
      roofUnits.push({position:position(x+(structure.entrance==="east"?width/2+.7:structure.entrance==="west"?-width/2-.7:0),4.7,z+(structure.entrance==="north"?depth/2+.7:structure.entrance==="south"?-depth/2-.7:0)),scale:position(northSouth?Math.min(10,width*.58):1.5,.28,northSouth?1.5:Math.min(10,depth*.58))});
    }else if(structure.archetype==="warehouse"||structure.archetype==="hangar"){
      for(const side of [-1,1])trims.push({position:position(x+side*width*.31,height+.95,z),scale:position(Math.max(2,width*.14),1.9,depth*.65)});
    }else if(structure.archetype==="utility"||structure.archetype==="lab"){
      roofUnits.push({position:position(x,height+3.2,z),scale:position(.35,5.2,.35)});
      trims.push({position:position(x,height+5.9,z),scale:position(3.5,.18,.18)});
    }else if(structure.archetype==="greenhouse"){
      trims.push({position:position(x,height+1.2,z),scale:position(width*.72,.28,depth*.72)});
    }else if(structure.archetype==="tower"||structure.archetype==="hotel"){
      roofUnits.push({position:position(x,height+3.1,z),scale:position(width*.42,3.8,depth*.4)});
    }
    this.addArchetypeMassing(structure, massing, glassVolumes, accentVolumes, machinery, roofUnits, railings);
    this.addInteriorKit(structure, interiorProps, interiorDark, interiorLights);
  }

  private addArchetypeMassing(
    structure: BrStructure,
    massing: MatrixSpec[], glass: MatrixSpec[], accents: MatrixSpec[], machinery: MatrixSpec[],
    roofUnits: MatrixSpec[], railings: MatrixSpec[]
  ): void {
    const { x, z } = structure.position;
    const { x: width, y: height, z: depth } = structure.size;
    const northSouth = structure.entrance === "north" || structure.entrance === "south";
    const frontSign = structure.entrance === "north" || structure.entrance === "east" ? 1 : -1;
    const frontX = northSouth ? x : x + frontSign * (width / 2 + .34);
    const frontZ = northSouth ? z + frontSign * (depth / 2 + .34) : z;
    const facadeScale = (wide: number, tall: number, thick: number): THREE.Vector3 => northSouth ? position(wide, tall, thick) : position(thick, tall, wide);

    // Shallow masses create readable silhouettes while staying visually tied to
    // the authoritative box collider beneath them.
    if (structure.archetype === "shop" || structure.archetype === "transit") {
      glass.push({ position: position(frontX, 2.35, frontZ), scale: facadeScale(Math.max(5.8, (northSouth ? width : depth) * .62), 3.25, .22) });
      accents.push({ position: position(frontX, 4.55, frontZ), scale: facadeScale(Math.max(7, (northSouth ? width : depth) * .72), .42, 1.45) });
      for (const side of [-1, 1]) {
        const offset = side * (northSouth ? width : depth) * .29;
        massing.push({ position: position(frontX + (northSouth ? offset : 0), 2.1, frontZ + (northSouth ? 0 : offset)), scale: facadeScale(.72, 4.2, .7) });
      }
    } else if (structure.archetype === "office" || structure.archetype === "lab" || structure.archetype === "academy") {
      glass.push({ position: position(frontX, Math.min(height * .52, 5.4), frontZ), scale: facadeScale(Math.max(5.5, (northSouth ? width : depth) * .48), Math.min(height * .58, 8), .3) });
      accents.push({ position: position(frontX, 4.75, frontZ), scale: facadeScale(Math.max(7, (northSouth ? width : depth) * .58), .28, 2) });
      const annexOffset = (northSouth ? width : depth) * .32;
      massing.push({ position: position(x + (northSouth ? annexOffset : 0), height * .34, z + (northSouth ? 0 : annexOffset)), scale: northSouth ? position(width * .22, height * .5, depth * .84) : position(width * .84, height * .5, depth * .22) });
    } else if (structure.archetype === "apartment" || structure.archetype === "hotel" || structure.archetype === "tower") {
      const tiers = structure.roofAccess ? 1 : 2;
      for (let tier = 0; tier < tiers; tier++) {
        const tierHeight = Math.min(4.6, height * .15);
        massing.push({ position: position(x + (tier ? width * .08 : -width * .05), height + tierHeight * (tier + .5), z + (tier ? -depth * .06 : depth * .05)), scale: position(width * (.66 - tier * .12), tierHeight, depth * (.68 - tier * .1)) });
      }
      for (const side of [-1, 1]) {
        const lateral = side * (northSouth ? width : depth) * .34;
        accents.push({ position: position(frontX + (northSouth ? lateral : 0), height * .62, frontZ + (northSouth ? 0 : lateral)), scale: facadeScale(Math.max(1.8, (northSouth ? width : depth) * .12), Math.min(7.5, height * .24), .55) });
      }
      machinery.push({ position: position(x, height + (structure.archetype === "tower" ? 5.1 : 3.8), z), scale: position(width * .28, structure.archetype === "tower" ? 5.8 : 3.2, depth * .28) });
      accents.push({ position: position(x, height + (structure.archetype === "tower" ? 8.15 : 5.55), z), scale: position(width * .35, .32, depth * .35) });
    } else if (structure.archetype === "warehouse" || structure.archetype === "hangar") {
      massing.push({ position: position(x, height + 1.15, z), scale: position(width * .86, 2.3, depth * .72) });
      accents.push({ position: position(frontX, height * .54, frontZ), scale: facadeScale(Math.max(8, (northSouth ? width : depth) * .72), Math.min(7.5, height * .72), .48) });
      for (const side of [-1, 1]) {
        const offset = side * (northSouth ? width : depth) * .39;
        massing.push({ position: position(frontX + (northSouth ? offset : 0), height * .52, frontZ + (northSouth ? 0 : offset)), scale: facadeScale(1.15, height * .92, 1.25) });
      }
    } else if (structure.archetype === "mall") {
      const facadeSpan = (northSouth ? width : depth) * .62;
      const facadeHeight = Math.min(9, height * .68);
      glass.push({ position: position(frontX, Math.min(6, height * .52), frontZ), scale: facadeScale(facadeSpan, facadeHeight, .46) });
      const backX = northSouth ? x : x - frontSign * (width / 2 + .34);
      const backZ = northSouth ? z - frontSign * (depth / 2 + .34) : z;
      glass.push({ position: position(backX, Math.min(5.2, height * .48), backZ), scale: facadeScale(facadeSpan * .72, facadeHeight * .7, .28) });
      for (const side of [-1, 1]) {
        const offset = side * (northSouth ? width : depth) * .38;
        massing.push({
          position: position(x + (northSouth ? offset : 0), height * .58, z + (northSouth ? 0 : offset)),
          scale: facadeScale(Math.max(3.6, facadeSpan * .16), height * .76, 1.4)
        });
        accents.push({
          position: position(frontX + (northSouth ? offset : 0), 4.8, frontZ + (northSouth ? 0 : offset)),
          scale: facadeScale(Math.max(3.2, facadeSpan * .14), .34, 2.25)
        });
      }
      massing.push({ position: position(x, height + 1.4, z), scale: position(width * .55, 2.8, depth * .5) });
      glass.push({ position: position(x, height + 2.65, z), scale: position(width * .34, 1.7, depth * .3) });
      accents.push({ position: position(x, height + 3.65, z), scale: position(width * .42, .35, depth * .38) });
    } else if (structure.archetype === "industrial" || structure.archetype === "utility") {
      for (const side of [-1, 1]) {
        machinery.push({ position: position(x + side * width * .28, height + 2.1, z), scale: position(1.35, 4.2, 1.35) });
        accents.push({ position: position(x + side * width * .28, height + 4.25, z), scale: position(1.7, .34, 1.7) });
      }
      massing.push({ position: position(x, height * .46, z + depth * .39), scale: position(width * .72, height * .44, depth * .18) });
    } else if (structure.archetype === "greenhouse") {
      glass.push({ position: position(x, height * .62, z), scale: position(width * .8, height * .72, depth * .82) });
      for (const side of [-1, 1]) accents.push({ position: position(x + side * width * .36, height * .62, z), scale: position(.28, height * .82, depth * .88) });
    }

    if (structure.roofAccess) {
      // Roof access remains open; details hug the perimeter instead of creating
      // misleading collision-free masses in the combat lane.
      for (const side of [-1, 1]) {
        roofUnits.push({ position: position(x + side * width * .34, height + .52, z + depth * .31), scale: position(width * .14, 1.04, depth * .18) });
        railings.push({ position: position(x + side * width * .42, height + .72, z), scale: position(.12, .14, depth * .72) });
      }
    }
  }

  private addInteriorKit(structure: BrStructure, light: MatrixSpec[], dark: MatrixSpec[], emissive: MatrixSpec[]): void {
    if (!structure.enterable) return;
    const { x, z } = structure.position;
    const width = structure.size.x, depth = structure.size.z;
    const archetype = structure.archetype;
    const addCeiling = () => emissive.push({ position: position(x, Math.min(structure.size.y - .45, 3.75), z), scale: position(Math.max(2.8, width * .42), .08, .24) });
    addCeiling();
    if (archetype === "shop" || archetype === "mall") {
      dark.push({ position: position(x, .72, z + depth * .27), scale: position(width * .55, 1.35, .7) });
      for (const side of [-1, 0, 1]) light.push({ position: position(x + side * width * .22, 1.05, z - depth * .22), scale: position(width * .13, 2.1, .52) });
      emissive.push({ position: position(x, 2.35, z + depth * .29), scale: position(width * .38, .13, .08) });
    } else if (archetype === "warehouse" || archetype === "hangar") {
      for (const side of [-1, 1]) for (const row of [-1, 0, 1]) dark.push({ position: position(x + side * width * .3, 1.25, z + row * depth * .22), scale: position(1.35, 2.5, depth * .13) });
      light.push({ position: position(x, .7, z + depth * .27), scale: position(width * .25, 1.4, 2.2) });
    } else if (archetype === "lab" || archetype === "academy" || archetype === "office") {
      for (const side of [-1, 1]) {
        light.push({ position: position(x + side * width * .23, .78, z + depth * .12), scale: position(width * .18, 1.45, 1.45) });
        dark.push({ position: position(x + side * width * .23, 1.18, z - depth * .2), scale: position(width * .2, 2.2, .24) });
      }
      emissive.push({ position: position(x, 1.75, z - depth * .31), scale: position(width * .42, .18, .08) });
    } else if (archetype === "industrial" || archetype === "utility") {
      for (const side of [-1, 1]) dark.push({ position: position(x + side * width * .25, 1.55, z), scale: position(1.25, 3.1, 1.25) });
      emissive.push({ position: position(x, .18, z), scale: position(width * .58, .08, .36) });
    } else {
      light.push({ position: position(x - width * .2, .62, z + depth * .2), scale: position(2.3, 1.2, 1.1) });
      dark.push({ position: position(x + width * .2, .45, z - depth * .2), scale: position(2.1, .8, 1.3) });
    }
  }

  private buildDistricts(): void {
    for (const poi of BR_POIS) {
      const radius = poi.style === "city" || poi.style === "mall" ? 75 : 62;
      const pad = new THREE.Mesh(
        this.geometry(new THREE.CylinderGeometry(radius, radius + 4, .36, 28)),
        this.materials.accent(poi.color, .035)
      );
      pad.position.set(poi.position.x, .17, poi.position.z);
      pad.receiveShadow = true;
      this.root.add(pad);
      const ring = new THREE.Mesh(this.geometry(new THREE.RingGeometry(radius - 3, radius - 1.5, 64)), this.materials.translucent(poi.color, .5, true));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(poi.position.x, .4, poi.position.z);
      ring.userData.cameraCollision = false;
      this.root.add(ring);
      const label = this.materials.createSign(poi.name, { border: poi.color, subtitle: this.poiSubtitle(poi) });
      label.position.set(poi.position.x, 38, poi.position.z);
      label.scale.set(31, 9, 1);
      label.userData.cameraCollision = false;
      this.root.add(label);
      this.poiLabels.push({ sprite: label, position: label.position.clone() });
      this.root.add(this.buildLandmark(poi));
      this.buildDistrictProps(poi);
    }
  }

  private buildSecondaryLocations():void {
    for(const location of BR_SECONDARY_LOCATIONS){
      const group=new THREE.Group();group.name=`secondary-${location.id}`;
      const pad=new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(38,40,.22,18)),this.materials.get(location.style==="farm"||location.style==="academy"?"grass":"sidewalk"));
      pad.position.set(location.position.x,.16,location.position.z);pad.receiveShadow=true;group.add(pad);
      const title=this.materials.createSign(location.name,{border:location.color,subtitle:this.poiSubtitle(location)});title.name="secondary-title";title.position.set(location.position.x,8.5,location.position.z);title.scale.set(13,3.8,1);group.add(title);this.secondaryLabels.push(title);
      const lamps:MatrixSpec[]=[],lampBulbs:MatrixSpec[]=[],props:MatrixSpec[]=[],trunks:MatrixSpec[]=[],foliage:MatrixSpec[]=[],groundAccents:MatrixSpec[]=[];
      for(let index=0;index<8;index++){
        const angle=index/8*Math.PI*2,radius=index%2?34:29,x=location.position.x+Math.cos(angle)*radius,z=location.position.z+Math.sin(angle)*radius;
        if(index%2===0){lamps.push({position:position(x,2.2,z),scale:position(.18,4.4,.18)});lampBulbs.push({position:position(x,4.55,z),scale:position(.5,.18,.5)});}
        if(location.style==="farm"||location.style==="academy"||location.style==="city"){
          trunks.push({position:position(x,1.1,z),scale:position(.38,2.2,.38)});
          foliage.push({position:position(x,3.05,z),scale:position(1.5,1.7,1.5),rotationY:angle});
        }
        else props.push({position:position(x,.85,z),scale:position(index%3===0?4.4:2.4,1.7,index%3===0?2.2:3.3),rotationY:angle});
        if(index%2===1)groundAccents.push({position:position(location.position.x+Math.cos(angle)*36,.36,location.position.z+Math.sin(angle)*36),scale:position(6,.08,.5),rotationY:angle+Math.PI/2});
      }
      this.addInstances(group,this.materials.unitBox,this.materials.get("structuralDark"),lamps,false);
      this.addInstances(group,this.materials.unitOctahedron,this.materials.get("energyCyan"),lampBulbs,false);
      this.addInstances(group,this.materials.unitBox,this.materials.get("cargoMetal"),props,false);
      this.addInstances(group,this.materials.unitCylinder,this.materials.get("soil"),trunks,false);
      this.addInstances(group,this.materials.unitOctahedron,this.materials.get("grass"),foliage,false);
      this.addInstances(group,this.materials.unitBox,this.materials.accent(location.color,.12),groundAccents,false);
      if(location.style==="industrial"||location.style==="dock")group.add(this.makeTurbine(location.position.x+10,location.position.z+8,location.color));
      else if(location.style==="farm")group.add(this.makeGreenhouse(location.position.x+10,location.position.z+7,location.color));
      else if(location.style==="city"){
        group.add(this.makeHoverVehicle(location.position.x+8,location.position.z+24,.12,location.color));
        group.add(this.makeTransitShelter(location.position.x-16,location.position.z+22,location.color));
      }else if(location.style==="academy")group.add(this.makeTransitShelter(location.position.x+18,location.position.z-20,location.color));
      this.root.add(group);this.districtDetails.push({group,center:position(location.position.x,0,location.position.z),visible:true});
    }
  }

  private buildDistrictProps(poi: BrPoi): void {
    const group = new THREE.Group();
    group.name = `props-${poi.id}`;
    const random = seededRandom(this.hash(poi.id));
    const boxes: MatrixSpec[] = [];
    const cylinders: MatrixSpec[] = [];
    const foliage: MatrixSpec[] = [];
    const treeTrunks: MatrixSpec[] = [];
    const shrubs: MatrixSpec[] = [];
    const lampBulbs: MatrixSpec[] = [];
    const lamps: MatrixSpec[] = [];
    const benches: MatrixSpec[] = [];
    const solar: MatrixSpec[] = [];
    const count = poi.style === "city" ? 54 : poi.style === "farm" ? 64 : 38;
    for (let index = 0; index < count; index++) {
      const angle = random() * Math.PI * 2;
      const radius = 24 + random() * 47;
      const x = poi.position.x + Math.cos(angle) * radius;
      const z = poi.position.z + Math.sin(angle) * radius;
      if (this.isReservedForGameplay(x, z, poi.id)) continue;
      if (poi.style === "farm" || poi.style === "academy") {
        const tree = index % 3 !== 0;
        if (tree) {
          treeTrunks.push({ position: position(x, 1.15, z), scale: position(.34 + random() * .22, 2.3, .34 + random() * .22) });
          foliage.push({ position: position(x, 3 + random() * .55, z), scale: position(1.25 + random(), 1.5 + random() * .8, 1.25 + random()) });
        } else shrubs.push({ position: position(x, .72, z), scale: position(.8 + random() * .65, .75 + random() * .5, .8 + random() * .65) });
      } else if (poi.style === "dock" || poi.style === "industrial") {
        boxes.push({ position: position(x, .8 + random(), z), scale: position(2.5 + random() * 4, 1.4 + random() * 2.2, 1.7 + random() * 3.2), rotationY: Math.round(random() * 3) * Math.PI / 2 });
      } else if (poi.style === "wreck") {
        boxes.push({ position: position(x, .45 + random() * .8, z), scale: position(1 + random() * 4, .6 + random() * 1.8, .8 + random() * 3), rotationY: angle });
      } else {
        if (index % 3 === 0) benches.push({ position: position(x, .6, z), scale: position(2.8, .25, .75), rotationY: angle });
        else { lamps.push({ position: position(x, 2.2, z), scale: position(.16, 4.4, .16) }); lampBulbs.push({ position: position(x, 4.55, z), scale: position(.48, .17, .48) }); }
      }
      if (poi.style === "farm" && index < 18) solar.push({ position: position(x, 1.7, z), scale: position(4.8, .18, 2.8), rotationY: angle, rotationX: -.22 });
      if (poi.style === "reactor" && index % 5 === 0) cylinders.push({ position: position(x, 1.6, z), scale: position(1.2, 3.2, 1.2) });
    }
    this.addInstances(group, this.materials.unitBox, poi.style === "wreck" ? this.materials.get("warningRed") : this.materials.get("cargoMetal"), boxes, false);
    this.addInstances(group, this.materials.unitCylinder, this.materials.get("paintedMetal"), cylinders, false);
    this.addInstances(group, this.materials.unitCylinder, this.materials.get("soil"), treeTrunks, false);
    this.addInstances(group, this.materials.unitOctahedron, this.materials.get("grass"), foliage, false);
    this.addInstances(group, this.materials.unitOctahedron, this.materials.get("energyPurple"), shrubs, false);
    this.addInstances(group, this.materials.unitBox, this.materials.get("structuralDark"), lamps, false);
    this.addInstances(group, this.materials.unitOctahedron, this.materials.get("energyCyan"), lampBulbs, false);
    this.addInstances(group, this.materials.unitBox, this.materials.get("brushedMetal"), benches, false);
    this.addInstances(group, this.materials.unitBox, this.materials.get("solarPanel"), solar, false);
    this.addContextProps(group, poi);
    this.root.add(group);
    this.districtDetails.push({ group, center: position(poi.position.x, 0, poi.position.z), visible: true });
  }

  private addContextProps(group: THREE.Group, poi: BrPoi): void {
    const x = poi.position.x, z = poi.position.z;
    if (poi.style === "city") {
      for (const [text, ox, oz, y] of [["ORBITAL CAFE", -30, 27, 6], ["ARCADE", 27, 22, 8], ["TRANSIT", 4, -34, 5], ["MARKET", 36, -12, 6]] as const) {
        const sign = this.materials.createSign(text, { border: poi.color }); sign.position.set(x + ox, y, z + oz); sign.scale.set(12, 3, 1); group.add(sign);
      }
      for (const offset of [-22, 22]) group.add(this.makeHoverVehicle(x + offset, z + 36, offset < 0 ? .12 : -.18, poi.color));
      group.add(this.makeEnergyFountain(x, z, poi.color));
    } else if (poi.style === "dock") {
      for (const offset of [-24, 24]) group.add(this.makeCrane(x + offset, z + 13, offset < 0 ? 1 : -1, poi.color));
      group.add(this.makeCargoMover(x - 31, z - 18, .18, poi.color));
      group.add(this.makeCargoMover(x + 33, z - 24, -.12, poi.color));
      const hangarSign = this.materials.createSign("DOCK 07", { border: poi.color, subtitle: "CARGO TRANSFER" }); hangarSign.position.set(x, 15, z - 32); hangarSign.scale.set(20, 6, 1); group.add(hangarSign);
    } else if (poi.style === "reactor") {
      for (const offset of [-22, 22]) {
        const conduit = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(12, 1.2, 8, 24, Math.PI)), this.materials.get("industrialOrange"));
        conduit.position.set(x + offset, 2, z); conduit.rotation.y = Math.PI / 2; group.add(conduit);
      }
    } else if (poi.style === "academy") {
      const academySign = this.materials.createSign("ASTRA ACADEMY", { border: poi.color, subtitle: "OBSERVE · DISCOVER" }); academySign.position.set(x, 10, z - 31); academySign.scale.set(20, 6, 1); group.add(academySign);
      group.add(this.makeEnergyFountain(x, z + 20, poi.color));
    } else if (poi.style === "mall") {
      for (const [text, ox] of [["VOID MARKET", -28], ["FOOD COURT", 0], ["STAR STYLE", 28]] as const) {
        const sign = this.materials.createSign(text, { border: poi.color }); sign.position.set(x + ox, 7, z - 18); sign.scale.set(13, 3.3, 1); group.add(sign);
      }
      for (const offset of [-18, 0, 18]) group.add(this.makeKiosk(x + offset, z + 8, poi.color));
    } else if (poi.style === "farm") {
      for (const offset of [-28, 0, 28]) group.add(this.makeGreenhouse(x + offset, z + 7, poi.color));
      this.addCropRows(group, x, z);
    } else if (poi.style === "wreck") {
      group.add(this.makeWreck(x, z));
    } else if (poi.style === "industrial") {
      for (const offset of [-22, 22]) group.add(this.makeTurbine(x + offset, z + 10, poi.color));
      group.add(this.makeCargoMover(x - 28, z - 22, .42, poi.color));
      group.add(this.makeMaintenanceRover(x + 30, z - 16, -.34, poi.color));
    }
  }

  private buildLandmark(poi: BrPoi): THREE.Group {
    const group = new THREE.Group();
    group.position.set(poi.position.x, .45, poi.position.z);
    const accent = this.materials.accent(poi.color, .62);
    const dark = this.materials.get("structuralDark");
    if (poi.style === "nexus") {
      const tower = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(5, 9, 62, 10)), dark); tower.position.y = 31; group.add(tower);
      for (const [radius, y, tilt] of [[18, 35, .25], [14, 48, -.45], [9, 61, .7]] as const) {
        const ring = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(radius, .72, 9, 42)), accent); ring.position.y = y; ring.rotation.x = Math.PI / 2 + tilt; ring.userData.rotationSpeed = .00014 + y * .000004; group.add(ring); this.animated.push(ring);
      }
      const core = new THREE.Mesh(this.geometry(new THREE.OctahedronGeometry(7, 2)), this.materials.get("energyCyan")); core.name = "zero-energy-core"; core.position.y = 48; core.userData.rotationSpeed = .00048; core.userData.pulse = true; core.userData.baseScale = 1; group.add(core); this.animated.push(core);
      const light = new THREE.PointLight(0x70f5ff, 6.5, 105, 1.6); light.position.y = 48; group.add(light);
      for (let index = 0; index < 4; index++) {
        const angle=index*Math.PI/2;const bridge = this.makeBridge(angle, 24, accent); bridge.position.y = 29; group.add(bridge);
        const pylon=new THREE.Mesh(this.materials.unitChamferedBox,dark);pylon.position.set(Math.cos(angle)*28,18,Math.sin(angle)*28);pylon.scale.set(5.4,36,5.4);group.add(pylon);
        const cap=new THREE.Mesh(this.geometry(new THREE.OctahedronGeometry(3.6,1)),accent);cap.position.set(Math.cos(angle)*28,38,Math.sin(angle)*28);cap.userData.rotationSpeed=.0002*(index%2?1:-1);group.add(cap);this.animated.push(cap);
        const stream=new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(.34,.34,38,8)),this.materials.translucent(0x70f5ff,.5,true));stream.position.set(Math.cos(angle)*21,30,Math.sin(angle)*21);stream.rotation.z=Math.PI/2;stream.rotation.y=-angle;stream.userData.pulse=true;stream.userData.baseScale=1;group.add(stream);this.animated.push(stream);
      }
    } else if (poi.style === "reactor") {
      const core = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(5.5, 8, 52, 16)), this.materials.get("energyCyan")); core.position.y = 45; group.add(core);
      const light = new THREE.PointLight(0xffd84d, 7, 115, 1.7); light.position.y = 48; group.add(light);
      for (const [radius, y] of [[13, 31], [16, 45], [12, 58]] as const) {
        const ring = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(radius, 1, 9, 36)), dark); ring.position.y = y; ring.rotation.x = Math.PI / 2; ring.userData.rotationSpeed = y === 45 ? -.00022 : .00017; group.add(ring); this.animated.push(ring);
      }
      for(let index=0;index<4;index++){const angle=index/4*Math.PI*2;const conduit=new THREE.Mesh(this.geometry(new THREE.TorusGeometry(22,.72,7,30,Math.PI*.7)),this.materials.get(index%2?"industrialOrange":"energyCyan"));conduit.position.set(Math.cos(angle)*6,18,Math.sin(angle)*6);conduit.rotation.set(Math.PI/2,angle,0);group.add(conduit);}
      for (let index = 0; index < 6; index++) { const angle = index / 6 * Math.PI * 2; const turbine = this.makeTurbine(Math.cos(angle) * 21, Math.sin(angle) * 21, poi.color); turbine.position.y = 37; group.add(turbine); }
    } else if (poi.style === "dock") {
      for (const offset of [-25, 25]) group.add(this.makeCrane(offset, 8, offset < 0 ? 1 : -1, poi.color));
    } else if (poi.style === "academy") {
      const dome = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), this.materials.get("glass")); dome.position.y = .2; group.add(dome);
      const orbit = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(10, .42, 8, 36)), accent); orbit.position.y = 8; orbit.rotation.x = .9; orbit.userData.rotationSpeed = .00018; group.add(orbit); this.animated.push(orbit);
    } else if (poi.style === "mall") {
      const arch = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(18, 1.7, 10, 36, Math.PI)), accent); arch.position.y = .8; group.add(arch);
      const skylight = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(14, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2)), this.materials.get("glass")); skylight.position.set(0, 4, 12); group.add(skylight);
    } else if (poi.style === "farm") {
      for (const offset of [-20, 0, 20]) group.add(this.makeGreenhouse(offset, 0, poi.color));
    } else if (poi.style === "wreck") {
      group.add(this.makeWreck(0, 0));
    } else if (poi.style === "industrial") {
      for (const offset of [-15, 15]) group.add(this.makeTurbine(offset, 0, poi.color));
      const chimney = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(3, 5, 32, 10)), dark); chimney.position.y = 16; group.add(chimney);
    } else {
      const sculpture = new THREE.Mesh(this.geometry(new THREE.TorusKnotGeometry(6, 1.2, 72, 8)), accent); sculpture.position.y = 8; sculpture.userData.rotationSpeed = .00012; group.add(sculpture); this.animated.push(sculpture);
    }
    group.userData.cameraCollision = false;
    return group;
  }

  private buildTraversal(): void {
    for (const traversal of BR_TRAVERSAL) {
      const color = traversal.kind === "grav-lift" ? 0x70f5ff : 0xffd84d;
      const group = new THREE.Group(); group.position.set(traversal.position.x, traversal.position.y, traversal.position.z);
      const pad = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(3.4, 4, .65, 18)), this.materials.get("paintedMetal")); group.add(pad);
      const ring = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(2.9, .18, 7, 24)), this.materials.translucent(color, .85, true)); ring.rotation.x = Math.PI / 2; ring.position.y = .52; ring.userData.rotationSpeed = .0006; group.add(ring); this.animated.push(ring);
      if (traversal.kind === "grav-lift") {
        const height = traversal.target.y - traversal.position.y;
        const column = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(2.3, 2.3, height, 20, 1, true)), this.materials.translucent(color, .14, true));
        column.name = `grav-column-${traversal.id}`; column.position.y = height / 2; group.add(column); this.energyMaterials.push(column.material as THREE.Material);
      } else {
        const arrow = new THREE.Mesh(this.geometry(new THREE.ConeGeometry(.9, 2.6, 5)), this.materials.get("energyCyan")); arrow.rotation.x = Math.PI / 2; arrow.position.y = .9; group.add(arrow);
      }
      group.userData.cameraCollision = false;
      this.root.add(group);
    }
  }

  private buildConnectiveDressing(): void {
    const hatches: MatrixSpec[] = [];
    const utilityBoxes: MatrixSpec[] = [];
    const hazardCaps: MatrixSpec[] = [];
    for (let index = 0; index < BR_ROADS.length; index++) {
      const road = BR_ROADS[index];
      const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z;
      const length = Math.hypot(dx, dz), nx = -dz / length, nz = dx / length;
      for (const t of [.22, .5, .78]) {
        const x = road.from.x + dx * t, z = road.from.z + dz * t;
        hatches.push({ position: position(x + nx * road.width * 1.08, .57, z + nz * road.width * 1.08), scale: position(3.2, .1, 2.2), rotationY: -Math.atan2(dz, dx) });
      }
      const signX = road.from.x + dx * .58 + nx * road.width * .74;
      const signZ = road.from.z + dz * .58 + nz * road.width * .74;
      utilityBoxes.push({ position: position(signX, .8, signZ), scale: position(1.1, 1.6, .72), rotationY: -Math.atan2(dz, dx) });
    }
    for (const block of BR_MAP_BLOCKS) if (block.kind === "cover") hazardCaps.push({
      position: position(block.position.x, block.position.y + block.size.y / 2 + .06, block.position.z),
      scale: position(block.size.x * .92, .1, block.size.z * .92), rotationY: block.rotation?.y
    });
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("brushedMetal"), hatches, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("paintedMetal"), utilityBoxes, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("industrialOrange"), hazardCaps, false);
    for (const [x, z, number] of [[-35, -305, "07"], [25, -298, "12"], [85, -290, "21"]] as const) {
      const marker = this.materials.createSign(`PAD ${number}`, { border: "#ffd84d", subtitle: "AUTHORIZED LANDING" }); marker.position.set(x, 1.2, z); marker.scale.set(12, 3.7, 1); this.root.add(marker);
      const ring = new THREE.Mesh(this.geometry(new THREE.RingGeometry(9, 9.7, 32)), this.materials.translucent(0xffd84d, .56, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(x, .62, z); ring.userData.cameraCollision = false; this.root.add(ring);
    }
    const wayfinding = [
      [0, -72, "NOVA  ←   ZERO  ↑   HELIOS  →"],
      [-78, 88, "ASTRA  ←   VOID MALL  →"],
      [92, 78, "HELIOS  →   FARMS  ↑"]
    ] as const;
    for (const [x, z, text] of wayfinding) { const sign = this.materials.createSign(text, { border: "#70f5ff" }); sign.position.set(x, 5.2, z); sign.scale.set(17, 4.2, 1); this.root.add(sign); }
  }

  private buildUnderside(): void {
    const dark = this.materials.get("structuralDark");
    const metal = this.materials.get("brushedMetal");
    const cyan = this.materials.translucent(0x65efff, .7, true);
    const spine = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(32, 49, 142, 18)), dark); spine.position.y = -115; this.root.add(spine);
    for (const [radius, y] of [[48, -48], [43, -92], [37, -136]] as const) {
      const band = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(radius, 2.6, 8, 32)), y === -92 ? this.materials.get("energyPurple") : metal);
      band.rotation.x = Math.PI / 2; band.position.y = y; this.root.add(band);
    }
    for (let index = 0; index < 12; index++) {
      const angle = index / 12 * Math.PI * 2;
      const outer = position(Math.cos(angle) * 340, -21, Math.sin(angle) * 340);
      const inner = position(Math.cos(angle) * 48, -74, Math.sin(angle) * 48);
      this.root.add(this.makeBeam(outer, inner, 4.2, metal));
    }
    const engineFins: MatrixSpec[] = [];
    const maintenanceDecks: MatrixSpec[] = [];
    for (let index = 0; index < 8; index++) {
      const angle = index / 8 * Math.PI * 2;
      const radius = 78;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      const mount = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(15, 61, 15)), metal); mount.position.set(x, -105, z); mount.rotation.y = -angle; this.root.add(mount);
      const engine = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(14, 21, 42, 14)), dark); engine.position.set(x, -162, z); this.root.add(engine);
      const nozzle = new THREE.Mesh(this.geometry(new THREE.ConeGeometry(18, 32, 14, 1, true)), metal); nozzle.position.set(x, -197, z); nozzle.rotation.x = Math.PI; this.root.add(nozzle);
      const flame = new THREE.Mesh(this.geometry(new THREE.ConeGeometry(11, 76, 14, 1, true)), cyan); flame.position.set(x, -249, z); flame.rotation.x = Math.PI; flame.userData.pulse = true; flame.userData.baseScale = 1; this.root.add(flame); this.animated.push(flame);
      for (const offset of [-1, 1]) engineFins.push({ position: position(x + Math.cos(angle + Math.PI / 2) * offset * 13, -146, z + Math.sin(angle + Math.PI / 2) * offset * 13), scale: position(5.2, 32, 1.4), rotationY: -angle });
      maintenanceDecks.push({ position: position(x, -77, z), scale: position(27, .9, 13), rotationY: -angle });
    }
    const pipes: MatrixSpec[] = [];
    const lights: MatrixSpec[] = [];
    const radialConduits: MatrixSpec[] = [];
    const hangingMachinery: MatrixSpec[] = [];
    for (let ring = 0; ring < 4; ring++) {
      const radius = 135 + ring * 57;
      const count = 12 + ring * 4;
      for (let index = 0; index < count; index++) {
        const angle = index / count * Math.PI * 2;
        pipes.push({ position: position(Math.cos(angle) * radius, -27 - ring * 3, Math.sin(angle) * radius), scale: position(9, 2.2, 2.2), rotationY: -angle });
        if (index % 2 === 0) lights.push({ position: position(Math.cos(angle) * radius, -29.2 - ring * 3, Math.sin(angle) * radius), scale: position(2.6, .35, .35), rotationY: -angle });
      }
    }
    for (let index = 0; index < 16; index++) {
      const angle = index / 16 * Math.PI * 2;
      radialConduits.push({ position: position(Math.cos(angle) * 210, -35, Math.sin(angle) * 210), scale: position(245, .72, .72), rotationY: -angle });
      if (index % 2 === 0) hangingMachinery.push({ position: position(Math.cos(angle) * 245, -54, Math.sin(angle) * 245), scale: position(11, 31, 8), rotationY: -angle });
    }
    this.addInstances(this.root, this.materials.unitBox, dark, pipes, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("energyCyan"), lights, false);
    this.addInstances(this.root, this.materials.unitChamferedBox, metal, engineFins, false);
    this.addInstances(this.root, this.materials.unitChamferedBox, metal, maintenanceDecks, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("energyPurple"), radialConduits, false);
    this.addInstances(this.root, this.materials.unitChamferedBox, dark, hangingMachinery, false);
  }

  private makeEnergyFountain(x: number, z: number, color: string): THREE.Group {
    const group = new THREE.Group(); group.position.set(x, .4, z);
    const basin = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(7, 8, .7, 18)), this.materials.get("structuralWhite")); group.add(basin);
    const core = new THREE.Mesh(this.geometry(new THREE.OctahedronGeometry(2.1, 1)), this.materials.accent(color, .7)); core.position.y = 4; core.userData.rotationSpeed = .00035; core.userData.pulse = true; core.userData.baseScale = 1; group.add(core); this.animated.push(core);
    return group;
  }

  private makeCrane(x: number, z: number, direction: number, color: string): THREE.Group {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    const mast = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(2.3, 24, 2.3)), this.materials.get("structuralDark")); mast.position.y = 12; group.add(mast);
    const arm = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(19, 1.8, 1.8)), this.materials.accent(color, .18)); arm.position.set(direction * 8, 23, 0); group.add(arm);
    const cable = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(.12, .12, 10, 6)), this.materials.get("structuralDark")); cable.position.set(direction * 15, 17.5, 0); group.add(cable);
    return group;
  }

  private makeGreenhouse(x: number, z: number, color: string): THREE.Group {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    const dome = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(8, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)), this.materials.get("glass")); dome.position.y = .25; dome.scale.z = .72; group.add(dome);
    for (const offset of [-4, 0, 4]) { const bed = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(2.2, .5, 9)), this.materials.get("soil")); bed.position.set(offset, .42, 0); group.add(bed); }
    const frame = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(7.7, .18, 6, 28, Math.PI)), this.materials.accent(color, .08)); frame.rotation.y = Math.PI / 2; group.add(frame);
    return group;
  }

  private addCropRows(group: THREE.Group, x: number, z: number): void {
    const crops: MatrixSpec[] = [];
    for (let row = 0; row < 5; row++) for (let column = 0; column < 10; column++) crops.push({
      position: position(x - 33 + column * 7.2, 1.1 + (column % 3) * .15, z - 31 + row * 7),
      scale: position(.55 + (column % 2) * .2, 1.4 + (column % 3) * .35, .55 + (row % 2) * .2)
    });
    this.addInstances(group, this.geometry(new THREE.OctahedronGeometry(1, 0)), this.materials.get("grass"), crops, false);
  }

  private makeWreck(x: number, z: number): THREE.Group {
    const group = new THREE.Group(); group.position.set(x, 1, z); group.rotation.y = -.48;
    const scorch = new THREE.Mesh(this.geometry(new THREE.RingGeometry(9, 30, 32)), this.materials.translucent(0x27131d, .52)); scorch.rotation.x = -Math.PI / 2; scorch.position.y = -.92; scorch.scale.z = .48; group.add(scorch);
    const hull = new THREE.Mesh(this.geometry(new THREE.CapsuleGeometry(6, 34, 8, 15)), this.materials.get("paintedMetal")); hull.rotation.z = Math.PI / 2; hull.position.y = 6; group.add(hull);
    const torn = new THREE.Mesh(this.geometry(new THREE.ConeGeometry(7.2, 15, 9, 1, true)), this.materials.get("structuralDark")); torn.rotation.z = -Math.PI / 2; torn.position.set(24, 6, 0); group.add(torn);
    const wing = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(22, 1.2, 10)), this.materials.get("warningRed")); wing.position.set(-4, 4, -8); wing.rotation.y = -.3; group.add(wing);
    const brokenWing = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(15, .85, 7)), this.materials.get("warningRed")); brokenWing.position.set(10, 2.6, 12); brokenWing.rotation.set(.14,.62,-.18); group.add(brokenWing);
    const exposedFrame = new THREE.Mesh(this.geometry(new THREE.ConeGeometry(5.4, 13, 8, 1, true)), this.materials.get("brushedMetal")); exposedFrame.rotation.z = Math.PI / 2; exposedFrame.position.set(-23, 5, 1); group.add(exposedFrame);
    for (const offset of [-7, 7]) { const rib = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(6.1, .65, 7, 14, Math.PI)), this.materials.get("brushedMetal")); rib.position.set(offset, 6, 0); rib.rotation.y = Math.PI / 2; group.add(rib); }
    const ember = new THREE.Mesh(this.geometry(new THREE.IcosahedronGeometry(2.2, 1)), this.materials.get("warningRed")); ember.position.set(25, 5.5, 0); ember.userData.pulse = true; ember.userData.baseScale = 1; group.add(ember); this.animated.push(ember);
    const debris:MatrixSpec[]=[];for(let index=0;index<12;index++){const angle=index/12*Math.PI*2;debris.push({position:position(Math.cos(angle)*(22+index%4*4),.2+index%3*.18,Math.sin(angle)*(10+index%5*2)),scale:position(1.2+index%3*1.1,.35+index%2*.25,2+index%4),rotationY:angle+.35});}
    this.addInstances(group,this.materials.unitChamferedBox,this.materials.get("structuralDark"),debris,false);
    return group;
  }

  private makeTurbine(x: number, z: number, color: string): THREE.Group {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    const casing = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(6, 1.5, 9, 24)), this.materials.get("brushedMetal")); casing.position.y = 6; casing.rotation.y = Math.PI / 2; group.add(casing);
    const rotor = new THREE.Group(); rotor.position.y = 6; rotor.rotation.z = .2;
    for (let index = 0; index < 6; index++) { const blade = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(5.2, .7, .24)), this.materials.accent(color, .2)); blade.rotation.z = index / 6 * Math.PI * 2; blade.position.x = Math.cos(blade.rotation.z) * 2.3; blade.position.y = Math.sin(blade.rotation.z) * 2.3; rotor.add(blade); }
    rotor.userData.rotationSpeed = .00042; group.add(rotor); this.animated.push(rotor);
    return group;
  }

  private makeKiosk(x: number, z: number, color: string): THREE.Group {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    const body = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(2.7, 3, 2.2, 8)), this.materials.get("structuralWhite")); body.position.y = 1.1; group.add(body);
    const canopy = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(3.7, 3.1, .5, 8)), this.materials.accent(color, .16)); canopy.position.y = 3.1; group.add(canopy);
    return group;
  }

  private makeHoverVehicle(x: number, z: number, rotationY: number, color: string): THREE.Group {
    const group = new THREE.Group(); group.position.set(x, 1.15, z); group.rotation.y = rotationY;
    const body = new THREE.Mesh(this.geometry(new THREE.CapsuleGeometry(1.25, 3.8, 5, 9)), this.materials.get("structuralWhite")); body.rotation.z = Math.PI / 2; group.add(body);
    const canopy = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(1.15, 10, 6)), this.materials.get("glass")); canopy.scale.set(1.3, .65, .9); canopy.position.set(.25, .75, 0); group.add(canopy);
    for (const side of [-1, 1]) { const hover = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(2.4, .25, .45)), this.materials.accent(color, .5)); hover.position.set(0, -.55, side * 1.25); group.add(hover); }
    return group;
  }

  private makeCargoMover(x: number, z: number, rotationY: number, color: string): THREE.Group {
    const group = new THREE.Group(); group.position.set(x, .75, z); group.rotation.y = rotationY;
    const chassis = new THREE.Mesh(this.materials.unitChamferedBox, this.materials.get("structuralDark")); chassis.scale.set(5.8, .72, 2.8); group.add(chassis);
    const cabin = new THREE.Mesh(this.materials.unitChamferedBox, this.materials.get("structuralWhite")); cabin.position.set(-1.65, 1.05, 0); cabin.scale.set(2.1, 1.7, 2.45); group.add(cabin);
    const glass = new THREE.Mesh(this.materials.unitChamferedBox, this.materials.get("windowDark")); glass.position.set(-2.72, 1.15, 0); glass.scale.set(.12, .82, 1.75); group.add(glass);
    const cargo = new THREE.Mesh(this.materials.unitChamferedBox, this.materials.get("cargoMetal")); cargo.position.set(1.2, 1.15, 0); cargo.scale.set(2.6, 2.05, 2.35); group.add(cargo);
    for (const side of [-1, 1]) { const lift = new THREE.Mesh(this.materials.unitBox, this.materials.accent(color, .42)); lift.position.set(0, -.47, side * 1.56); lift.scale.set(4.6, .16, .3); group.add(lift); }
    return group;
  }

  private makeMaintenanceRover(x: number, z: number, rotationY: number, color: string): THREE.Group {
    const group = new THREE.Group(); group.position.set(x, .72, z); group.rotation.y = rotationY;
    const body = new THREE.Mesh(this.materials.unitChamferedBox, this.materials.get("paintedMetal")); body.scale.set(4.4, 1.2, 2.5); group.add(body);
    const canopy = new THREE.Mesh(this.materials.unitChamferedBox, this.materials.get("glass")); canopy.position.set(-.65, 1.05, 0); canopy.scale.set(1.85, 1.15, 2); group.add(canopy);
    const tool = new THREE.Mesh(this.materials.unitCylinder, this.materials.get("brushedMetal")); tool.position.set(1.45, 1.15, 0); tool.scale.set(.34, 1.6, .34); group.add(tool);
    const beacon = new THREE.Mesh(this.materials.unitOctahedron, this.materials.accent(color, .8)); beacon.position.set(1.45, 2.08, 0); beacon.scale.setScalar(.26); group.add(beacon);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const skid = new THREE.Mesh(this.materials.unitChamferedBox, this.materials.get("structuralDark")); skid.position.set(sx * 1.45, -.55, sz * 1.42); skid.scale.set(1.25, .22, .36); group.add(skid); }
    return group;
  }

  private makeTransitShelter(x: number, z: number, color: string): THREE.Group {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    const dark = this.materials.get("structuralDark");
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(this.materials.unitChamferedBox, dark); post.position.set(side * 3.8, 2.1, 0); post.scale.set(.34, 4.2, .34); group.add(post);
    }
    const canopy = new THREE.Mesh(this.materials.unitChamferedBox, this.materials.accent(color, .24)); canopy.position.set(0, 4.35, 0); canopy.scale.set(8.6, .42, 3.2); group.add(canopy);
    const back = new THREE.Mesh(this.materials.unitBox, this.materials.get("glass")); back.position.set(0, 2.05, 1.25); back.scale.set(7.4, 3.6, .12); group.add(back);
    const bench = new THREE.Mesh(this.materials.unitChamferedBox, this.materials.get("brushedMetal")); bench.position.set(0, .68, .45); bench.scale.set(4.8, .32, 1); group.add(bench);
    const route = new THREE.Mesh(this.materials.unitBox, this.materials.get("energyCyan")); route.position.set(0, 3.88, -1.58); route.scale.set(5.6, .11, .08); group.add(route);
    return group;
  }

  private makeBridge(angle: number, length: number, material: THREE.Material): THREE.Group {
    const group = new THREE.Group(); group.rotation.y = angle;
    const deck = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(6, .55, length)), this.materials.get("brushedMetal")); deck.position.set(0, 6, -length / 2 - 8); group.add(deck);
    for (const side of [-1, 1]) { const rail = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(.18, 1.2, length)), material); rail.position.set(side * 2.8, 6.8, -length / 2 - 8); group.add(rail); }
    return group;
  }

  private makeBeam(from: THREE.Vector3, to: THREE.Vector3, width: number, material: THREE.Material): THREE.Mesh {
    const center = from.clone().add(to).multiplyScalar(.5);
    const direction = to.clone().sub(from);
    const beam = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(width, width, direction.length())), material);
    beam.position.copy(center);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize());
    beam.userData.cameraCollision = false;
    return beam;
  }

  private addInstances(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, specs: MatrixSpec[], cameraCollision: boolean): void {
    if (!specs.length) return;
    const instances = new THREE.InstancedMesh(geometry, material, specs.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    for (let index = 0; index < specs.length; index++) {
      const spec = specs[index];
      euler.set(spec.rotationX ?? 0, spec.rotationY ?? 0, spec.rotationZ ?? 0);
      quaternion.setFromEuler(euler);
      matrix.compose(spec.position, quaternion, spec.scale);
      instances.setMatrixAt(index, matrix);
    }
    instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = this.quality === "high" && cameraCollision;
    instances.receiveShadow = cameraCollision;
    instances.userData.cameraCollision = cameraCollision;
    parent.add(instances);
  }

  private poiSubtitle(poi: Pick<BrPoi,"style">): string {
    const subtitles: Record<BrPoi["style"], string> = {
      nexus: "ORBITAL ENERGY NEXUS", city: "CITY CORE", dock: "CARGO & TRANSIT", reactor: "SOLAR CONTAINMENT",
      academy: "RESEARCH CAMPUS", mall: "RETAIL CONCOURSE", farm: "LIFE SUPPORT", wreck: "IMPACT ZONE", industrial: "PROPULSION SYSTEMS"
    };
    return subtitles[poi.style];
  }

  private facadeSignText(structure: BrStructure): string | null {
    const signs: Record<string, string> = {
      "zero-spire": "ZERO POINT", "nova-cafe": "ORBITAL CAFE", "nova-arcade": "ARCADE", "nova-market": "MARKET",
      "dock-hangar": "DOCK 07", "helios-core": "HELIOS", "astra-hall": "ASTRA", "void-anchor": "VOID MALL",
      "void-food-court": "FOOD COURT", "farm-processing": "GROW LAB", "crash-medbay": "MED BAY", "thruster-foundry": "THRUSTER WORKS"
    };
    const secondary=BR_SECONDARY_LOCATIONS.find((location)=>location.id===structure.districtId&&structure.id===`${location.id}-1`);
    return signs[structure.id] ?? secondary?.name ?? null;
  }

  private isReservedForGameplay(x: number, z: number, districtId: string): boolean {
    for (const structure of BR_STRUCTURES) {
      if (structure.districtId !== districtId) continue;
      if (Math.abs(x - structure.position.x) < structure.size.x / 2 + 3.5 && Math.abs(z - structure.position.z) < structure.size.z / 2 + 3.5) return true;
    }
    for (const road of BR_ROADS) {
      const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z;
      const lengthSquared = dx * dx + dz * dz;
      const t = lengthSquared > 0 ? THREE.MathUtils.clamp(((x - road.from.x) * dx + (z - road.from.z) * dz) / lengthSquared, 0, 1) : 0;
      const rx = road.from.x + dx * t, rz = road.from.z + dz * t;
      if (Math.hypot(x - rx, z - rz) < road.width * .8) return true;
    }
    return false;
  }

  private insideIsland(x: number, z: number, margin = 0): boolean {
    let inside = false;
    for (let current = 0, previous = BR_ISLAND_OUTLINE.length - 1; current < BR_ISLAND_OUTLINE.length; previous = current++) {
      const [xi, zi] = BR_ISLAND_OUTLINE[current];
      const [xj, zj] = BR_ISLAND_OUTLINE[previous];
      const intersects = zi > z !== zj > z && x < (xj - xi) * (z - zi) / (zj - zi) + xi;
      if (intersects) inside = !inside;
    }
    if (!inside || margin <= 0) return inside;
    return Math.hypot(x, z) < 500 - margin;
  }

  private hash(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index++) hash = (Math.imul(hash, 31) + value.charCodeAt(index)) | 0;
    return Math.abs(hash);
  }
}
