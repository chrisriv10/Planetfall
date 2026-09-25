import * as THREE from "three";
import {
  BR_ISLAND_OUTLINE,
  BR_LOOT_SOCKETS,
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
import { buildFacadeParts, buildDistantFacadeParts, buildExteriorServiceParts } from "./br-facades";
import { buildNovaStorefrontParts } from "./br-storefronts";
import { buildNovaEntrancePaving } from "./br-entrance-paving";
import { buildBrRooftopDetails, type BrRoofPart } from "./br-rooftop-details";
import { buildReactorInterior } from "./br-reactor-interior";
import { buildReactorFloorChannels } from "./br-reactor-floor";
import { buildNexusPlaza } from "./br-nexus-plaza";
import { brRoadDetailClear } from "./br-road-detail";
import { spinBrMachinery } from "./br-machinery";
import { buildGrowhouseRoof } from "./br-growhouse";
import { buildRetailInterior } from "./br-retail-interiors";
import { buildInteriorSurfaces } from "./br-interior-surfaces";
import { buildResidentialInterior, buildResidentialCeiling, buildResidentialLandingMarkers, buildResidentialServiceWall, buildResidentialEntranceWall, buildResidentialRampSkins } from "./br-residential-interiors";
import { buildCargoCrane, buildIndustrialRoof } from "./br-industrial";
import { buildWreckRoof, buildWreckInterior } from "./br-wreck";
import { buildWreckExterior } from "./br-wreck-exterior";
import { buildFoundryEngines } from "./br-foundry";
import { buildSecondaryDeckParts, secondaryDeckBaseFinish, type BrSecondaryDeckFinish } from "./br-secondary-decks";
import { buildRoadsideInfrastructure, type RoadsideFinish } from "./br-roadside-infrastructure";
import { buildBrVisibleRoadSpans } from "./br-road-surfaces";
import { buildMaintenanceStrips } from "./br-maintenance-strips";
import { buildMallDirectories } from "./br-mall-directories";
import { buildMallWallBays } from "./br-mall-wall-bays";
import { buildMallRampSkins } from "./br-mall-ramp-skins";
import { buildMallCeilingEdges } from "./br-mall-ceiling-edges";
import { buildPerimeterArmor } from "./br-perimeter-armor";
import { buildDeckTransitions, type DeckTransitionPart } from "./br-deck-transitions";
import { buildBrParkDressing, buildBrParkPaths, type BrParkFinish, type BrParkPart } from "./br-park-dressing";
import { buildBrSectorFields, type BrSectorFieldPart } from "./br-sector-fields";
import { buildBrLandingZoneMarkings, type BrLandingMarkingFinish } from "./br-landing-zone-markings";
import { buildMallAtriumWalls } from "./br-mall-atrium-walls";
import { buildConnectiveClusters, type ConnectiveClusterPart } from "./br-connective-clusters";
import { buildBrCorridorGroves, type BrCorridorGrovePart } from "./br-corridor-groves";

export type BrPoiLabel = { sprite: THREE.Sprite; position: THREE.Vector3 };

type DistrictDetail = {
  group: THREE.Group;
  distant?: THREE.Group;
  center: THREE.Vector3;
  visible: boolean;
  distanceScale?: number;
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
  private readonly roadsideSites = buildRoadsideInfrastructure();
  private connectiveClusterDetail: THREE.Group | null = null;
  private maintenanceDetail: THREE.Group | null = null;
  private deckTransitionDetail: THREE.Group | null = null;
  private sectorFieldDetail: THREE.Group | null = null;
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
    this.buildSecondaryDecks();
    this.buildSecondaryLocations();
    this.buildConnectiveDressing();
    this.buildConnectiveClusters();
    this.buildSectorFields();
    this.buildRoadsideInfrastructure();
    this.buildMaintenanceStrips();
    this.buildTraversal();
    this.buildUnderside();
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.cameraCollision === true) this.collidableMeshes.push(object);
    });
  }

  setQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    if (this.maintenanceDetail) this.maintenanceDetail.visible = quality !== "low";
    if (this.deckTransitionDetail) this.deckTransitionDetail.visible = quality !== "low";
    if (this.sectorFieldDetail) this.sectorFieldDetail.visible = quality !== "low";
    if (this.connectiveClusterDetail) this.connectiveClusterDetail.visible = quality !== "low";
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
        object.castShadow = quality === "high" && object.userData.cameraCollision === true;
      }
    });
  }

  debugStats(): { objects: number; meshes: number; instances: number; visibleInstances:number; materials: number; visibleDistricts: number } {
    let objects = 0, meshes = 0, instances = 0, visibleInstances=0; const materials = new Set<THREE.Material>();
    this.root.traverseVisible(object=>{if(object instanceof THREE.InstancedMesh)visibleInstances+=object.count;});
    this.root.traverse((object) => {
      objects++;
      if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
        meshes++;
        if (object instanceof THREE.InstancedMesh) instances += object.count;
        const source = object.material; for (const material of Array.isArray(source) ? source : [source]) materials.add(material);
      }
    });
    return { objects, meshes, instances, visibleInstances, materials: materials.size, visibleDistricts: this.districtDetails.filter((detail) => detail.group.visible).length };
  }

  update(camera: THREE.Camera, now: number): void {
    // Building silhouettes remain visible island-wide; only facade, signage and
    // interior dressing are sector-activated. Keeping aerial views out of the
    // near-detail tier prevents the Starliner sequence from rendering the whole
    // settlement's interiors at once.
    // High keeps a full nearby neighborhood rather than activating most of the
    // 1 km island at once. Distant shells still preserve skyline and landmark
    // silhouettes; only facade/interior/prop layers use this tighter budget.
    const maxDetailDistance = this.quality === "high" ? 240 : this.quality === "medium" ? 185 : 125;
    for (const detail of this.districtDetails) {
      const distance = camera.position.distanceTo(detail.center);
      const nextVisible = distance < maxDetailDistance * (detail.distanceScale ?? 1) + (detail.visible ? 36 : 0);
      if (nextVisible !== detail.visible) {
        detail.visible = nextVisible;
        detail.group.visible = nextVisible;
        if (detail.distant) detail.distant.visible = !nextVisible;
      }
    }
    for (let index = 0; index < this.animated.length; index++) {
      const object = this.animated[index];
      const speed = Number(object.userData.rotationSpeed ?? .0002);
      spinBrMachinery(object, now * speed + Number(object.userData.rotationOffset ?? 0), object.userData.rotationAxis ?? "y");
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
    const panelMaterial = this.materials.own(new THREE.MeshStandardMaterial({ map: panelTexture, color: 0x56738a, roughness: .74, metalness: .25, polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1 }));
    const panelMatrices: MatrixSpec[] = [];
    for (let x = -438; x <= 438; x += 44) {
      for (let z = -430; z <= 430; z += 44) {
        if (!this.insideIsland(x, z, 22)) continue;
        // Nearly close the tile seams. The old .4 m gaps read as long blue
        // collision cracks from normal player height even though the physics
        // deck underneath was continuous.
        panelMatrices.push({ position: position(x, .004, z), scale: position(43.96, .004, 43.96) });
      }
    }
    this.addInstances(this.root, this.materials.unitBox, panelMaterial, panelMatrices, false);

    for (const patch of BR_TERRAIN_PATCHES) {
      const key = patch.kind === "park" ? "grass" : patch.kind === "coolant" ? "glass" : patch.kind === "industrial" ? "concrete" : patch.kind === "landing" ? "paintedMetal" : "sidewalk";
      const deck = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(patch.size.x, .018, patch.size.z)), this.materials.surface(key,2));
      deck.position.set(patch.position.x, .006, patch.position.z);
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

    const landingBatches = new Map<BrLandingMarkingFinish, MatrixSpec[]>();
    for (const part of buildBrLandingZoneMarkings()) {
      const batch = landingBatches.get(part.finish) ?? [];
      batch.push({
        position: position(part.position.x, part.position.y, part.position.z),
        scale: position(part.scale.x, part.scale.y, part.scale.z),
        rotationY: part.rotationY
      });
      landingBatches.set(part.finish, batch);
    }
    for (const [finish, parts] of landingBatches) this.addInstances(
      this.root,
      this.materials.unitBox,
      this.materials.surface(finish, 3),
      parts,
      false
    );

    const rimPoints = BR_ISLAND_OUTLINE.map(([x, z]) => new THREE.Vector3(x, .25, z));
    // Thin guide-light bands clarify the silhouette without turning the whole
    // island edge into a blown-out neon tube; the armor modules carry the mass.
    for (const [y, radius, color, opacity] of [[.2, .48, 0x70f5ff, .68], [-7, .56, 0x2b668b, .5], [-16, .4, 0xa86bff, .32]] as const) {
      const curve = new THREE.CatmullRomCurve3(rimPoints.map((point) => point.clone().setY(y)), true, "catmullrom", .08);
      const rim = new THREE.Mesh(this.geometry(new THREE.TubeGeometry(curve, 144, radius, 6, true)), this.materials.translucent(color, opacity, true));
      rim.userData.cameraCollision = false;
      this.root.add(rim);
    }

    for (const batch of buildPerimeterArmor()) this.addInstances(
      this.root,
      batch.shape === "chamferedBox" ? this.materials.unitChamferedBox : this.materials.unitBox,
      this.materials.get(batch.finish),
      batch.parts.map((part) => ({
        position: position(part.position.x, part.position.y, part.position.z),
        scale: position(part.scale.x, part.scale.y, part.scale.z),
        rotationY: part.rotationY
      })),
      false
    );
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
      const pavedWidth = road.width;
      for (const span of buildBrVisibleRoadSpans(road)) {
        const spanLength=Math.hypot(span.to.x-span.from.x,span.to.z-span.from.z);
        roads.push({
          position:position((span.from.x+span.to.x)/2,.035,(span.from.z+span.to.z)/2),
          scale:position(spanLength,.012,pavedWidth),
          rotationY:angle
        });
      }
      for (const side of [-1, 1]) {
        const curbOffset = side * pavedWidth * .49;
        const lightOffset = side * pavedWidth * .43;
        const sections=Math.ceil(length/6);
        for(let index=0;index<sections;index++) {
          const t=(index+.5)/sections;
          const px=road.from.x+dx*t+Math.sin(angle)*curbOffset,pz=road.from.z+dz*t+Math.cos(angle)*curbOffset;
          if(!brRoadDetailClear(road,px,pz))continue;
          curbs.push({position:position(px,.074,pz),scale:position(length/sections-.15,.07,.38),rotationY:angle});
          if(index%4===0)edgeLights.push({position:position(road.from.x+dx*t+Math.sin(angle)*lightOffset,.072,road.from.z+dz*t+Math.cos(angle)*lightOffset),scale:position(1.7,.016,.065),rotationY:angle});
        }
      }
      const dashCount = Math.max(2, Math.floor(length / 12));
      for (let index = 0; index < dashCount; index++) {
        const t = (index + .5) / dashCount;
        if(!brRoadDetailClear(road,road.from.x+dx*t,road.from.z+dz*t))continue;
        dashMatrices.push({
          position: position(road.from.x + dx * t, .048, road.from.z + dz * t),
          scale: position(3.2, .012, .18), rotationY: angle
        });
      }
      if (length > 100 && road.id.startsWith("ring-")) {
        for (const endT of [.11, .89]) {
          for (let stripe = -2; stripe <= 2; stripe++) {
            const t = THREE.MathUtils.clamp(endT + stripe * (2.25 / length), .04, .96);
            if(!brRoadDetailClear(road,road.from.x+dx*t,road.from.z+dz*t))continue;
            crossings.push({
              position: position(road.from.x + dx * t, .052, road.from.z + dz * t),
              scale: position(pavedWidth * .58, .025, .72), rotationY: angle + Math.PI / 2
            });
          }
        }
      }
      const lampCount = Math.max(1, Math.floor(length / 58));
      const nx = -dz / length, nz = dx / length;
      for (let index = 1; index < lampCount; index++) {
        const t = index / lampCount;
        for (const side of [-1, 1]) {
          const x = road.from.x + dx * t + nx * road.width * .62 * side;
          const z = road.from.z + dz * t + nz * road.width * .62 * side;
          if(!brRoadDetailClear(road,x,z))continue;
          lampPosts.push({ position: position(x, 2.25, z), scale: position(.22, 4.5, .22) });
          lampBulbs.push({ position: position(x, 4.62, z), scale: position(.42, .18, .42) });
        }
      }
    }
    this.addInstances(this.root, this.materials.unitBox, this.materials.surface("road",4), roads, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("sidewalk"), curbs, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("energyCyan"), edgeLights, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.surface("sidewalk",5), dashMatrices, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.surface("structuralWhite",5), crossings, false);
    this.addInstances(this.root, this.materials.unitChamferedBox, this.materials.get("industrialOrange"), medians, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("structuralDark"), lampPosts, false);
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("energyCyan"), lampBulbs, false);
  }

  private buildGameplayGeometry(): void {
    // One vertex-colored slab batch: navy walkable tops, pale composite
    // soffits/edges. This keeps interiors readable without extra light or
    // draw calls, and uses the exact authoritative platform dimensions.
    const slabGeometry = this.geometry(this.materials.unitBox.clone());
    const normals = slabGeometry.getAttribute("normal");
    const colors = new Float32Array(normals.count * 3);
    const top = new THREE.Color(0x263548), underside = new THREE.Color(0xb7c6cb);
    for (let index = 0; index < normals.count; index++) {
      const color = normals.getY(index) > .5 ? top : underside;
      colors.set([color.r,color.g,color.b], index * 3);
    }
    slabGeometry.setAttribute("color",new THREE.BufferAttribute(colors,3));
    const slabMaterial = this.materials.own((this.materials.get("interiorFloor") as THREE.MeshStandardMaterial).clone());
    slabMaterial.color.set(0xffffff);slabMaterial.vertexColors = true;
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
      const slab = key.startsWith("platform:") || key.startsWith("ramp:");
      this.addInstances(this.root, slab ? slabGeometry : this.materials.unitBox, slab ? slabMaterial : material, matrices, true);
    }
  }

  private buildArchitecture(): void {
    const allShells: MatrixSpec[] = [];
    for (const poi of [...BR_POIS,...BR_SECONDARY_LOCATIONS]) {
      const group = new THREE.Group();
      group.name = `detail-${poi.id}`;
      const distant = new THREE.Group();
      distant.name = `distant-facade-${poi.id}`;
      distant.visible = false;
      const distantWindows: MatrixSpec[] = [];
      const structures = BR_STRUCTURES.filter((structure) => structure.districtId === poi.id);
      const columns: MatrixSpec[] = [];
      const trims: MatrixSpec[] = [];
      const windowsDark: MatrixSpec[] = [];
      const windowsLit: MatrixSpec[] = [];
      const facadePlants: MatrixSpec[] = [];
      const roofUnits: MatrixSpec[] = [];
      const roofEdges: MatrixSpec[] = [], roofAccents: MatrixSpec[] = [], roofSolar: MatrixSpec[] = [], roofVents: MatrixSpec[] = [];
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
      const displayGlass: MatrixSpec[] = [];
      const mallEnergyPurple: MatrixSpec[] = [], mallEnergyCyan: MatrixSpec[] = [];
      const floorSeams: MatrixSpec[] = [], floorTrim: MatrixSpec[] = [];
      const entrancePavers: MatrixSpec[] = [], entranceInsets: MatrixSpec[] = [], entranceDrains: MatrixSpec[] = [];
      const reactorFrames: MatrixSpec[] = [], reactorPanels: MatrixSpec[] = [], reactorEnergy: MatrixSpec[] = [], reactorWarnings: MatrixSpec[] = [];
      const growFrames: MatrixSpec[] = [], growGlass: MatrixSpec[] = [], growBases: MatrixSpec[] = [];
      const industrial = { frame: [] as MatrixSpec[], paint: [] as MatrixSpec[], metal: [] as MatrixSpec[], glass: [] as MatrixSpec[] };
      for (const structure of structures) {
        const roofLoot=BR_LOOT_SOCKETS.find(socket=>socket.structureId===structure.id&&socket.kind==="roof");
        const roofTargets:Record<BrRoofPart["finish"],MatrixSpec[]>={edge:roofEdges,accent:roofAccents,solar:roofSolar,vent:roofVents};
        for(const part of buildBrRooftopDetails(structure,roofLoot))roofTargets[part.finish].push({
          position:position(part.position.x,part.position.y,part.position.z),scale:position(part.scale.x,part.scale.y,part.scale.z),
          rotationX:part.rotationX,rotationY:part.rotationY
        });
        for (const part of buildReactorInterior(structure)) {
          (part.finish === "frame" ? reactorFrames : part.finish === "panel" ? reactorPanels : part.finish === "energy" ? reactorEnergy : reactorWarnings).push({
            position: position(part.position.x, part.position.y, part.position.z),
            scale: position(part.scale.x, part.scale.y, part.scale.z)
          });
        }
        for(const part of buildReactorFloorChannels(structure)){
          (part.finish==="channel"?reactorFrames:part.finish==="energy"?reactorEnergy:reactorWarnings).push({
            position:position(part.position.x,part.position.y,part.position.z),scale:position(part.scale.x,part.scale.y,part.scale.z)
          });
        }
        for (const part of buildNovaEntrancePaving(structure)) {
          (part.finish === "paver" ? entrancePavers : part.finish === "inset" ? entranceInsets : entranceDrains).push({
            position: position(part.position.x, part.position.y, part.position.z),
            scale: position(part.scale.x, part.scale.y, part.scale.z)
          });
        }
        for (const part of buildIndustrialRoof(structure)) industrial[part.finish].push({
          position: position(part.position.x, part.position.y, part.position.z),
          scale: position(part.scale.x, part.scale.y, part.scale.z)
        });
        for(const part of buildInteriorSurfaces(structure)) (part.finish==="seam"?floorSeams:floorTrim).push({
          position:position(part.position.x,part.position.y,part.position.z),scale:position(part.scale.x,part.scale.y,part.scale.z),rotationX:part.rotationX
        });
        const retail=buildRetailInterior(structure);
        const retailTargets={frame:interiorDark,panel:interiorProps,glass:displayGlass,light:interiorLights,accent:accentVolumes};
        for(const part of retail.parts) retailTargets[part.finish].push({position:position(part.position.x,part.position.y,part.position.z),scale:position(part.scale.x,part.scale.y,part.scale.z)});
        for(const label of retail.signs) {
          const sign=this.materials.createMountedSign(label.text,{border:poi.color});
          sign.position.set(label.position.x,label.position.y,label.position.z); sign.rotation.y=Math.PI;
          sign.scale.set(label.width,.58,1);group.add(sign);
        }
        for (const directory of buildMallDirectories(structure)) {
          for (const part of directory.parts) retailTargets[part.finish].push({
            position: position(part.position.x, part.position.y, part.position.z),
            scale: position(part.scale.x, part.scale.y, part.scale.z)
          });
          for (const label of directory.signs) {
            const sign = this.materials.createMountedSign(label.text, { border: poi.color });
            sign.position.set(label.position.x, label.position.y, label.position.z);
            sign.rotation.y = label.rotationY;
            sign.scale.set(label.width, label.height, 1);
            group.add(sign);
          }
        }
        for (const bay of buildMallWallBays(structure)) {
          for (const part of bay.parts) {
            const spec = {
              position: position(part.position.x, part.position.y, part.position.z),
              scale: position(part.scale.x, part.scale.y, part.scale.z)
            };
            if (part.finish === "energyPurple") mallEnergyPurple.push(spec);
            else if (part.finish === "energyCyan") mallEnergyCyan.push(spec);
            else retailTargets[part.finish].push(spec);
          }
        }
        for (const part of buildMallAtriumWalls(structure)) {
          const spec = {
            position: position(part.position.x, part.position.y, part.position.z),
            scale: position(part.scale.x, part.scale.y, part.scale.z)
          };
          if (part.finish === "energyPurple") mallEnergyPurple.push(spec);
          else if (part.finish === "energyCyan") mallEnergyCyan.push(spec);
          else retailTargets[part.finish].push(spec);
        }
        for (const skin of buildMallRampSkins(structure)) {
          for (const part of skin.parts) {
            const spec = {
              position: position(part.position.x, part.position.y, part.position.z),
              scale: position(part.scale.x, part.scale.y, part.scale.z),
              rotationX: part.rotationX
            };
            if (part.finish === "energyPurple") mallEnergyPurple.push(spec);
            else if (part.finish === "energyCyan") mallEnergyCyan.push(spec);
            else if (part.finish === "brushedMetal") roofUnits.push(spec);
            else railings.push(spec);
          }
        }
        for (const ceiling of buildMallCeilingEdges(structure)) {
          for (const part of ceiling.parts) {
            const spec = {
              position: position(part.position.x, part.position.y, part.position.z),
              scale: position(part.scale.x, part.scale.y, part.scale.z)
            };
            if (part.finish === "energyPurple") mallEnergyPurple.push(spec);
            else if (part.finish === "energyCyan") mallEnergyCyan.push(spec);
            else if (part.finish === "brushedMetal") roofUnits.push(spec);
            else railings.push(spec);
          }
        }
        const residential=buildResidentialInterior(structure);
        const landingMarkers=buildResidentialLandingMarkers(structure);
        for(const part of landingMarkers.parts) retailTargets[part.finish].push({position:position(part.position.x,part.position.y,part.position.z),scale:position(part.scale.x,part.scale.y,part.scale.z)});
        for(const label of landingMarkers.signs) {
          const sign=this.materials.createMountedSign(label.text,{border:"#8ca6b8"});
          sign.position.set(label.position.x,label.position.y,label.position.z);
          sign.scale.set(label.width,.55,1);group.add(sign);
        }
        for(const part of [...buildResidentialCeiling(structure),...buildResidentialServiceWall(structure),...buildResidentialEntranceWall(structure),...buildResidentialRampSkins(structure),...residential.parts])
          retailTargets[part.finish].push({position:position(part.position.x,part.position.y,part.position.z),scale:position(part.scale.x,part.scale.y,part.scale.z),rotationX:part.rotationX});
        for(const label of residential.signs) {
          const sign=this.materials.createMountedSign(label.text,{border:"#8ca6b8"});
          sign.position.set(label.position.x,label.position.y,label.position.z);sign.rotation.y=Math.PI/2;
          sign.scale.set(label.width,.45,1);group.add(sign);
        }
        for (const part of buildGrowhouseRoof(structure)) {
          (part.finish === "frame" ? growFrames : part.finish === "glass" ? growGlass : growBases).push({
            position: position(part.position.x, part.position.y, part.position.z),
            scale: position(part.scale.x, part.scale.y, part.scale.z), rotationZ: part.rotationZ
          });
        }
        for (const part of buildDistantFacadeParts(structure)) {
          distantWindows.push({ position: position(part.position.x,part.position.y,part.position.z), scale: position(part.scale.x,part.scale.y,part.scale.z) });
        }
        this.architectureMatrices(
          structure, shells, columns, trims, windowsDark, windowsLit, roofUnits, doorFrames,
          interiorProps, interiorDark, interiorLights, railings, massing, glassVolumes, accentVolumes, machinery, facadePlants
        );
        const signText = this.facadeSignText(structure);
        if (signText) {
          const sign = this.materials.createMountedSign(signText, { border: poi.color });
          // Short kiosks previously mounted a full sign across the open door.
          const y = Math.max(5.65, Math.min(structure.size.y - 1.1, 6.4));
          const offset = .95;
          sign.position.set(
            structure.position.x + (structure.entrance === "east" ? structure.size.x / 2 + offset : structure.entrance === "west" ? -structure.size.x / 2 - offset : 0),
            y,
            structure.position.z + (structure.entrance === "north" ? structure.size.z / 2 + offset : structure.entrance === "south" ? -structure.size.z / 2 - offset : 0)
          );
          sign.rotation.y = structure.entrance === "north" ? 0 : structure.entrance === "south" ? Math.PI : structure.entrance === "east" ? Math.PI / 2 : -Math.PI / 2;
          sign.scale.set(8.5, 2.15, 1); group.add(sign);
        }
      }
      allShells.push(...shells);
      this.addInstances(group, this.materials.unitChamferedBox, this.materials.get("structuralDark"), columns, false);
      this.addInstances(group, this.materials.unitBox, this.materials.accent(poi.color, .12), trims, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get(poi.style === "farm" ? "growGlass" : "windowDark"), windowsDark, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get(poi.style === "farm" ? "growGlass" : "windowLit"), windowsLit, false);
      this.addInstances(group, this.materials.unitOctahedron, this.materials.get("grass"), facadePlants, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("brushedMetal"), roofUnits, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("structuralDark"), roofEdges, false);
      this.addInstances(group, this.materials.unitBox, this.materials.accent(poi.color,.06), roofAccents, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("solarPanel"), roofSolar, false);
      this.addInstances(group, this.materials.unitCylinder, this.materials.get("brushedMetal"), roofVents, false);
      this.addInstances(group, this.materials.unitBox, this.materials.architecturalPaint(poi.color), doorFrames, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("interiorWall"), interiorProps, false);
      this.addInstances(group, this.materials.unitChamferedBox, this.materials.get("structuralDark"), interiorDark, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("windowLit"), interiorLights, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("windowDark"), displayGlass, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("energyPurple"), mallEnergyPurple, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("energyCyan"), mallEnergyCyan, false);
      this.addInstances(group, this.materials.unitBox, this.materials.surface("paintedMetal",2), floorSeams, false);
      this.addInstances(group, this.materials.unitBox, this.materials.surface("sidewalk",2), floorTrim, false);
      this.addInstances(group, this.materials.unitBox, this.materials.surface("sidewalk",6), entrancePavers, false);
      this.addInstances(group, this.materials.unitBox, this.materials.surface("concrete",6), entranceInsets, false);
      this.addInstances(group, this.materials.unitBox, this.materials.surface("paintedMetal",7), entranceDrains, false);
      this.addInstances(group, this.materials.unitChamferedBox, this.materials.get("structuralDark"), reactorFrames, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("brushedMetal"), reactorPanels, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("energyCyan"), reactorEnergy, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("industrialOrange"), reactorWarnings, false);
      this.addInstances(group, this.materials.unitBox, this.materials.get("structuralDark"), railings, false);
      // Roof crowns and major silhouette masses must not disappear at the
      // same threshold as tiny interior props and facade signs.
      this.addInstances(this.root, this.materials.unitChamferedBox, this.materials.get("structuralWhite"), massing, false);
      this.addInstances(this.root, this.materials.unitChamferedBox, this.materials.get("glass"), glassVolumes, false);
      this.addInstances(group, this.materials.unitChamferedBox, this.materials.architecturalPaint(poi.color), accentVolumes, false);
      this.addInstances(group, this.materials.unitCylinder, this.materials.get("brushedMetal"), machinery, false);
      this.addInstances(distant, this.materials.unitBox, this.materials.get("windowDark"), distantWindows, false);
      this.addInstances(this.root, this.materials.unitBox, this.materials.get("structuralWhite"), growFrames, false);
      this.addInstances(this.root, this.materials.unitBox, this.materials.get("growGlass"), growGlass, false);
      this.addInstances(this.root, this.materials.unitBox, this.materials.get("structuralDark"), growBases, false);
      this.addInstances(this.root, this.materials.unitBox, this.materials.get("structuralDark"), industrial.frame, false);
      this.addInstances(this.root, this.materials.unitBox, this.materials.get("industrialOrange"), industrial.paint, false);
      this.addInstances(this.root, this.materials.unitBox, this.materials.get("brushedMetal"), industrial.metal, false);
      this.root.add(group, distant);
      this.districtDetails.push({ group, distant, center: position(poi.position.x, 0, poi.position.z), visible: true });
    }
    this.addInstances(this.root, this.materials.unitBox, this.materials.get("structuralWhite"), allShells, true);
  }

  private architectureMatrices(
    structure: BrStructure,
    shells: MatrixSpec[],
    columns: MatrixSpec[], trims: MatrixSpec[], darkWindows: MatrixSpec[], litWindows: MatrixSpec[],
    roofUnits: MatrixSpec[], doorFrames: MatrixSpec[], interiorProps: MatrixSpec[], interiorDark: MatrixSpec[],
    interiorLights: MatrixSpec[], railings: MatrixSpec[], massing: MatrixSpec[], glassVolumes: MatrixSpec[],
    accentVolumes: MatrixSpec[], machinery: MatrixSpec[], facadePlants: MatrixSpec[]
  ): void {
    const { x, z } = structure.position;
    const { x: width, y: height, z: depth } = structure.size;
    const wall=.65,door=4.8;
    const wallSpec=(px:number,pz:number,sx:number,sz:number)=>shells.push({
      position:position(px,height/2,pz),
      scale:position(sx,height,sz)
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
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      const corner = structure.style === "city" || structure.style === "mall" || structure.archetype === "tower" || structure.archetype === "hotel"
        ? THREE.MathUtils.clamp(Math.min(width, depth) * .11, 2.1, 4.2)
        : 1.55;
      columns.push({ position: position(x + sx * (width / 2 - corner * .42), height / 2, z + sz * (depth / 2 - corner * .42)), scale: position(corner, height + 1.1, corner) });
    }
    const facadeTargets = { panel: interiorProps, frame: columns, glass: darkWindows, lit: litWindows, accent: trims, foliage: facadePlants, metal: roofUnits };
    for (const part of [...buildFacadeParts(structure), ...buildExteriorServiceParts(structure), ...buildNovaStorefrontParts(structure)]) {
      facadeTargets[part.finish].push({position: position(part.position.x, part.position.y, part.position.z), scale: position(part.scale.x, part.scale.y, part.scale.z)});
    }
    const facadeHeight = Math.max(3, height * .62);
    const facadeY = Math.max(2.1, height * .54);
    const accentWidth = structure.style === "city" || structure.style === "mall" ? .38 : .3;
    for (const side of [-1, 1]) {
      trims.push({ position: position(x + side * width * .31, facadeY, z - depth / 2 - .43), scale: position(accentWidth, facadeHeight, .19) });
      trims.push({ position: position(x + side * width * .31, facadeY, z + depth / 2 + .43), scale: position(accentWidth, facadeHeight, .19) });
    }
    if (structure.style === "reactor" || structure.style === "industrial" || structure.style === "dock") {
      for (const side of [-1, 1]) trims.push({ position: position(x + side * (width / 2 + .44), facadeY, z), scale: position(.2, facadeHeight, Math.max(2.2, depth * .16)) });
    }
    if (!["crash-fuselage", "thruster-foundry"].includes(structure.id) && (structure.archetype !== "greenhouse" || structure.roofAccess) && !["warehouse", "hangar"].includes(structure.archetype)) {
    roofUnits.push({ position: position(x - width * .2, height + .7, z + depth * .18), scale: position(Math.min(6, width * .22), 1.4, Math.min(4.5, depth * .2)) });
    roofUnits.push({ position: position(x + width * .22, height + .42, z - depth * .16), scale: position(Math.min(3.5, width * .16), .8, Math.min(5, depth * .24)) });
    roofUnits.push({ position: position(x, height + .32, z), scale: position(width * .58, .58, depth * .36) });
    }
    // Keep the authored roof exposed instead of covering it with a bright slab.
    for (const side of [-1, 1]) {
      columns.push({position:position(x, height + .25, z + side * depth / 2),scale:position(width,.28,.6)});
      columns.push({position:position(x + side * width / 2, height + .25,z),scale:position(.6,.28,depth)});
    }
    if (height > 15 && structure.id !== "thruster-foundry") {
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
    const shopCanopy = structure.archetype === "shop" || structure.archetype === "transit";
    const northSouth = structure.entrance === "north" || structure.entrance === "south";
    const doorX = northSouth ? x : x + (structure.entrance === "east" ? width / 2 + .48 : -width / 2 - .48);
    const doorZ = northSouth ? z + (structure.entrance === "north" ? depth / 2 + .48 : -depth / 2 - .48) : z;
    if (northSouth) {
      doorFrames.push({ position: position(doorX - doorHalf, 2.1, doorZ), scale: position(.42, 4.2, .5) });
      doorFrames.push({ position: position(doorX + doorHalf, 2.1, doorZ), scale: position(.42, 4.2, .5) });
      doorFrames.push({ position: position(doorX, 4.05, doorZ), scale: position(5.8, .38, .55) });
      doorFrames.push({ position: position(doorX, 4.45, doorZ + (structure.entrance === "north" ? .75 : -.75)), scale: position(shopCanopy ? Math.max(7.4,width*.72) : 7.4, .22, shopCanopy ? 2.4 : 1.8) });
    } else {
      doorFrames.push({ position: position(doorX, 2.1, doorZ - doorHalf), scale: position(.5, 4.2, .42) });
      doorFrames.push({ position: position(doorX, 2.1, doorZ + doorHalf), scale: position(.5, 4.2, .42) });
      doorFrames.push({ position: position(doorX, 4.05, doorZ), scale: position(.55, .38, 5.8) });
      doorFrames.push({ position: position(doorX + (structure.entrance === "east" ? .75 : -.75), 4.45, doorZ), scale: position(shopCanopy ? 2.4 : 1.8, .22, shopCanopy ? Math.max(7.4,depth*.72) : 7.4) });
    }
    for (let index = 0; structure.id !== "crash-fuselage" && !["apartment","hotel"].includes(structure.archetype) && index < Math.min(4, 1 + structure.floors); index++) {
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
    if(structure.id!=="crash-fuselage"&&(structure.archetype==="utility"||structure.archetype==="lab")){
      roofUnits.push({position:position(x,height+3.2,z),scale:position(.35,5.2,.35)});
      trims.push({position:position(x,height+5.9,z),scale:position(3.5,.18,.18)});
    }else if(structure.archetype==="greenhouse"){
      trims.push({position:position(x,height+1.2,z),scale:position(width*.72,.28,depth*.72)});
    }else if(structure.id!=="thruster-foundry"&&(structure.archetype==="tower"||structure.archetype==="hotel")){
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
    // The observatory has an authored dome. Generic tower crowns used to
    // protrude through its glass and obscure the instrument chamber.
    if (["astra-observatory", "crash-fuselage", "thruster-foundry"].includes(structure.id)) return;
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
      // Storefront windows are split around the door by buildFacadeParts.
      // A single canopy is emitted with the doorway; three nearly coplanar
      // versions used to stack into a large fluorescent slab here.
      for (const side of [-1, 1]) {
        const offset = side * (northSouth ? width : depth) * .29;
        massing.push({ position: position(frontX + (northSouth ? offset : 0), 2.1, frontZ + (northSouth ? 0 : offset)), scale: facadeScale(.72, 4.2, .7) });
      }
    } else if (structure.archetype === "office" || structure.archetype === "lab" || structure.archetype === "academy") {
      // The doorway assembly already owns the entrance canopy.
      // Service ribs are mounted outside the back wall by buildExteriorServiceParts.
      // The old solid annex occupied an entire strip of the playable interior.
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
      for (const side of [-1, 1]) {
        const offset = side * (northSouth ? width : depth) * .39;
        massing.push({ position: position(frontX + (northSouth ? offset : 0), height * .52, frontZ + (northSouth ? 0 : offset)), scale: facadeScale(1.15, height * .92, 1.25) });
      }
    } else if (structure.archetype === "mall") {
      const facadeSpan = (northSouth ? width : depth) * .62;
      const facadeHeight = Math.min(9, height * .68);
      const backX = northSouth ? x : x - frontSign * (width / 2 + .34);
      const backZ = northSouth ? z - frontSign * (depth / 2 + .34) : z;
      glass.push({ position: position(backX, Math.min(5.2, height * .48), backZ), scale: facadeScale(facadeSpan * .72, facadeHeight * .7, .28) });
      for (const side of [-1, 1]) {
        const offset = side * (northSouth ? width : depth) * .38;
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
    }

    if (structure.roofAccess) {
      // Roof access remains open; details hug the perimeter instead of creating
      // misleading collision-free masses in the combat lane.
      for (const side of [-1, 1]) {
        if (!["warehouse", "hangar"].includes(structure.archetype)) roofUnits.push({ position: position(x + side * width * .34, height + .52, z + depth * .31), scale: position(width * .14, 1.04, depth * .18) });
        railings.push({ position: position(x + side * width * .42, height + .72, z), scale: position(.12, .14, depth * .72) });
      }
    }
  }

  private addInteriorKit(structure: BrStructure, light: MatrixSpec[], dark: MatrixSpec[], emissive: MatrixSpec[]): void {
    if (!structure.enterable) return;
    if (structure.id === "crash-fuselage") {
      const targets={panel:light,frame:dark,light:emissive};
      for(const part of buildWreckInterior(structure)) targets[part.finish].push({
        position:position(part.position.x,part.position.y,part.position.z),scale:position(part.scale.x,part.scale.y,part.scale.z)
      });
      return;
    }
    const { x, z } = structure.position;
    const width = structure.size.x, depth = structure.size.z;
    const archetype = structure.archetype;
    const serviceRoom = ["industrial", "reactor", "dock"].includes(structure.style) || ["lab", "office", "academy"].includes(archetype);
    const floorHeight=structure.size.y/structure.floors;
    for(let floor=0;floor<structure.floors;floor++) {
      const base=floor*floorHeight,ceiling=base+floorHeight-.35;
      // Ceiling luminaires sit against the actual floor above, not suspended
      // at a fixed 3.75m through the middle of tall rooms and stairwells.
      for(const side of ["apartment","hotel"].includes(archetype)?[]:[-1,1]) {
        dark.push({position:position(x-width*.18,ceiling,z+side*depth*.28),scale:position(width*.48,.18,.65)});
        emissive.push({position:position(x-width*.18,ceiling-.11,z+side*depth*.28),scale:position(width*.4,.035,.19)});
      }
      for(const side of [-1,1]) {
        const face=side<0?"south":"north";
        if(structure.entrance===face)continue;
        const wallZ=z+side*(depth/2-.45);
        // Durable wall dado, inset service panels and console clusters.
        dark.push({position:position(x,base+.52,wallZ),scale:position(width-1.8,.9,.13)});
        // Structural wall bays give tall rooms scale without introducing false
        // cover into the floor plan. All detail stays within .9m of the wall.
        dark.push({position:position(x,ceiling-.65,wallZ),scale:position(width-1.8,.28,.21)});
        for(const offset of [-.45,-.15,.15,.45]) {
          dark.push({position:position(x+width*offset,base+floorHeight/2,wallZ),scale:position(.19,floorHeight-.9,.26)});
        }
        for(const offset of [-.3,0,.3]) {
          light.push({position:position(x+width*offset,base+2.1,wallZ-side*.1),scale:position(width*.23,Math.min(2.5,floorHeight-1.5),.12)});
          if(serviceRoom){
            const panelX=x+width*offset;
            dark.push({position:position(panelX,base+1.72,wallZ-side*.22),scale:position(2.5,1.4,.22)});
            emissive.push({position:position(panelX,base+1.86,wallZ-side*.345),scale:position(2.08,.87,.025)});
            // Graphic bars break the screen into a readable instrument panel,
            // instead of a uniform glowing rectangle.
            for(let bar=0;bar<3;bar++) dark.push({position:position(panelX-.58+bar*.55,base+1.72+bar*.1,wallZ-side*.365),scale:position(.33,.32+bar*.12,.018)});
            dark.push({position:position(panelX,base+1.12,wallZ-side*.32),scale:position(2.6,.13,.45)});
            light.push({position:position(panelX,base+.98,wallZ-side*.29),scale:position(2.05,.15,.32)});
            if(floorHeight>6) {
              // High-level ventilation arrays keep the reactor's fourteen-metre
              // storeys from reading as blank warehouse walls.
              dark.push({position:position(panelX,ceiling-1.9,wallZ-side*.1),scale:position(width*.21,1.25,.18)});
              for(let slat=0;slat<4;slat++)light.push({position:position(panelX,ceiling-2.3+slat*.25,wallZ-side*.21),scale:position(width*.19,.09,.12)});
            }
          }
        }
      }
    }
    if (archetype === "shop" || archetype === "mall") {
      // The partition-mounted display kit replaces blocks and counters placed
      // in the aisle (including the former exact overlap with interior loot).
      for(let floor=0;floor<structure.floors;floor++) {
        const ceiling=(floor+1)*floorHeight-.3;
        // Suspended detail hugs the ceiling and stops before the stair slot.
        for(let strip=0;strip<5;strip++) dark.push({position:position(x-width*.16,ceiling,z-depth*.36+strip*depth*.18),scale:position(width*.55,.08,.23)});
        for(const side of [-1,1]) light.push({position:position(x-width*.16+side*width*.255,ceiling,z),scale:position(.16,.09,depth*.82)});
      }
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
    } else if(archetype!=="apartment"&&archetype!=="hotel") {
      light.push({ position: position(x - width * .2, .62, z + depth * .2), scale: position(2.3, 1.2, 1.1) });
      dark.push({ position: position(x + width * .2, .45, z - depth * .2), scale: position(2.1, .8, 1.3) });
    }
  }

  private buildDistricts(): void {
    for (const poi of BR_POIS) {
      const radius = poi.style === "city" || poi.style === "mall" ? 75 : 62;
      const pad = new THREE.Mesh(
        this.geometry(new THREE.CylinderGeometry(radius, radius + 4, .01, 28)),
        this.materials.surface(poi.style === "farm" || poi.style === "academy" ? "grass" : "concrete",3)
      );
      pad.position.set(poi.position.x, .016, poi.position.z);
      pad.receiveShadow = true;
      this.root.add(pad);
      const ring = new THREE.Mesh(this.geometry(new THREE.RingGeometry(radius - 3, radius - 1.5, 64)), this.materials.translucent(poi.color, .5, true));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(poi.position.x, .027, poi.position.z);
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
    const parkCrown=this.geometry(new THREE.IcosahedronGeometry(1,1));
    for(const location of BR_SECONDARY_LOCATIONS){
      const group=new THREE.Group();group.name=`secondary-${location.id}`;
      const pad=new THREE.Mesh(
        this.geometry(new THREE.CylinderGeometry(38,40,.026,18)),
        this.secondaryDeckMaterial(secondaryDeckBaseFinish(location.style))
      );
      // Neighborhood pads live below the continuous paved road layer. Their
      // old top face was only 1 mm above the road, causing obvious z-fighting.
      pad.position.set(location.position.x,.011,location.position.z);pad.receiveShadow=true;group.add(pad);
      const title=this.materials.createSign(location.name,{border:location.color,subtitle:this.poiSubtitle(location)});title.name="secondary-title";title.position.set(location.position.x,8.5,location.position.z);title.scale.set(13,3.8,1);group.add(title);this.secondaryLabels.push(title);
      const greenLocation=location.style==="farm"||location.style==="academy"||location.style==="city";
      if(greenLocation){
        const destination=BR_POIS.find(poi=>poi.id===location.connectTo)?.position??location.position;
        const pathBatches=new Map<"sidewalk"|"accent",MatrixSpec[]>();
        for(const path of buildBrParkPaths(location,destination)){
          const batch=pathBatches.get(path.finish)??[];
          batch.push({position:position(path.position.x,path.position.y,path.position.z),scale:position(path.scale.x,path.scale.y,path.scale.z),rotationY:path.rotationY});
          pathBatches.set(path.finish,batch);
        }
        for(const [finish,batch] of pathBatches)this.addInstances(group,this.materials.unitBox,finish==="sidewalk"?this.materials.get("sidewalk"):this.materials.accent(location.color,.03),batch,false);
        const parts=buildBrParkDressing(location,destination).flatMap(cluster=>cluster.parts);
        const batches=new Map<string,BrParkPart[]>();
        for(const part of parts){const key=`${part.geometry}:${part.finish}`;const batch=batches.get(key)??[];batch.push(part);batches.set(key,batch);}
        for(const [key,batch] of batches){
          const [geometryKey,finish]=key.split(":") as [BrParkPart["geometry"],BrParkFinish];
          const geometry=geometryKey==="box"?this.materials.unitBox:geometryKey==="cylinder"?this.materials.unitCylinder:geometryKey==="octahedron"?this.materials.unitOctahedron:parkCrown;
          const material=finish==="canopy"?this.materials.canopy():finish==="flowers"
            ?this.materials.accent(location.style==="farm"?"#dfb56f":"#b889ca",.03)
            :this.materials.get(finish);
          this.addInstances(group,geometry,material,batch.map(part=>({position:position(part.position.x,part.position.y,part.position.z),scale:position(part.scale.x,part.scale.y,part.scale.z),rotationY:part.rotationY,rotationZ:part.rotationZ})),false);
        }
      }else{
        const lamps:MatrixSpec[]=[],lampBulbs:MatrixSpec[]=[],props:MatrixSpec[]=[],groundAccents:MatrixSpec[]=[];
        for(let index=0;index<8;index++){
          const angle=index/8*Math.PI*2,radius=index%2?34:29,x=location.position.x+Math.cos(angle)*radius,z=location.position.z+Math.sin(angle)*radius;
          if(this.isReservedForGameplay(x,z,3))continue;
          if(index%2===0){lamps.push({position:position(x,2.2,z),scale:position(.18,4.4,.18)});lampBulbs.push({position:position(x,4.55,z),scale:position(.5,.18,.5)});}
          props.push({position:position(x,.85,z),scale:position(index%3===0?4.4:2.4,1.7,index%3===0?2.2:3.3),rotationY:angle});
          if(index%2===1)groundAccents.push({position:position(location.position.x+Math.cos(angle)*36,.36,location.position.z+Math.sin(angle)*36),scale:position(6,.08,.5),rotationY:angle+Math.PI/2});
        }
        this.addInstances(group,this.materials.unitBox,this.materials.get("structuralDark"),lamps,false);
        this.addInstances(group,this.materials.unitOctahedron,this.materials.get("energyCyan"),lampBulbs,false);
        this.addInstances(group,this.materials.unitBox,this.materials.get("cargoMetal"),props,false);
        this.addInstances(group,this.materials.unitBox,this.materials.accent(location.color,.12),groundAccents,false);
      }
      if((location.style==="industrial"||location.style==="dock")&&!this.isReservedForGameplay(location.position.x+10,location.position.z+8,5))group.add(this.makeTurbine(location.position.x+10,location.position.z+8,location.color));
      else if(location.style==="farm")this.addCropRows(group,location.position.x,location.position.z);
      else if(location.style==="city"){
        if(!this.isReservedForGameplay(location.position.x+8,location.position.z+24,5))group.add(this.makeHoverVehicle(location.position.x+8,location.position.z+24,.12,location.color));
        if(!this.isReservedForGameplay(location.position.x-16,location.position.z+22,5))group.add(this.makeTransitShelter(location.position.x-16,location.position.z+22,location.color));
      }else if(location.style==="academy"&&!this.isReservedForGameplay(location.position.x+18,location.position.z-20,5))group.add(this.makeTransitShelter(location.position.x+18,location.position.z-20,location.color));
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
    const nexusInsets:MatrixSpec[]=[],nexusEnergy:MatrixSpec[]=[],nexusWarnings:MatrixSpec[]=[];
    const count = poi.style === "city" ? 54 : poi.style === "farm" ? 64 : 38;
    for (let index = 0; index < count; index++) {
      const angle = random() * Math.PI * 2;
      const radius = 24 + random() * 47;
      const x = poi.position.x + Math.cos(angle) * radius;
      const z = poi.position.z + Math.sin(angle) * radius;
      if (this.isReservedForGameplay(x,z,3.5)) continue;
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
    this.addInstances(group, this.materials.unitOctahedron, this.materials.canopy(), foliage, false);
    this.addInstances(group, this.materials.unitOctahedron, this.materials.get("energyPurple"), shrubs, false);
    this.addInstances(group, this.materials.unitBox, this.materials.get("structuralDark"), lamps, false);
    this.addInstances(group, this.materials.unitOctahedron, this.materials.get("energyCyan"), lampBulbs, false);
    this.addInstances(group, this.materials.unitBox, this.materials.get("brushedMetal"), benches, false);
    this.addInstances(group, this.materials.unitBox, this.materials.get("solarPanel"), solar, false);
    for(const part of buildNexusPlaza(poi)){
      const target=part.finish==="inset"?nexusInsets:part.finish==="energy"?nexusEnergy:nexusWarnings;
      target.push({position:position(part.position.x,part.position.y,part.position.z),scale:position(part.scale.x,part.scale.y,part.scale.z),rotationY:part.rotationY});
    }
    this.addInstances(group,this.materials.unitBox,this.materials.get("structuralDark"),nexusInsets,false);
    this.addInstances(group,this.materials.unitBox,this.materials.get("energyCyan"),nexusEnergy,false);
    this.addInstances(group,this.materials.unitBox,this.materials.get("industrialOrange"),nexusWarnings,false);
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
      // Keep the plaza center clear; the smaller metal sculpture supplies the landmark.
    } else if (poi.style === "dock") {
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
      // Interior signs/displays belong to the real partition walls. Floating
      // POI-relative signs and kiosks overlapped ceilings, aisles and loot.
    } else if (poi.style === "farm") {
      this.addCropRows(group, x, z);
    } else if (poi.style === "wreck") {
      // The landmark owns the sole wreck shell, aligned to its playable room.
    } else if (poi.style === "industrial") {
      // Large turbine housings used to intersect the foundry's occupied rooms.
      // Its rooftop engine-test assembly now owns the machinery landmark.
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
      // A shaded emissive core retains its faceted shape in bright views; the
      // former additive/basic material clipped to a flat white silhouette.
      const core = new THREE.Mesh(this.geometry(new THREE.OctahedronGeometry(7, 2)), accent); core.name = "zero-energy-core"; core.position.y = 48; core.userData.rotationSpeed = .00048; core.userData.pulse = true; core.userData.baseScale = 1; group.add(core); this.animated.push(core);
      const light = new THREE.PointLight(0x70f5ff, 6.5, 105, 1.6); light.position.y = 48; group.add(light);
      for (let index = 0; index < 4; index++) {
        const angle=index*Math.PI/2;const bridge = this.makeBridge(angle, 24, accent); bridge.position.y = 29; group.add(bridge);
        const pylon=new THREE.Mesh(this.materials.unitChamferedBox,dark);pylon.position.set(Math.cos(angle)*28,18,Math.sin(angle)*28);pylon.scale.set(5.4,36,5.4);group.add(pylon);
        const cap=new THREE.Mesh(this.geometry(new THREE.OctahedronGeometry(3.6,1)),accent);cap.position.set(Math.cos(angle)*28,38,Math.sin(angle)*28);cap.userData.rotationSpeed=.0002*(index%2?1:-1);group.add(cap);this.animated.push(cap);
        const stream=new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(.34,.34,38,8)),this.materials.translucent(0x70f5ff,.5,true));stream.position.set(Math.cos(angle)*21,30,Math.sin(angle)*21);stream.rotation.z=Math.PI/2;stream.rotation.y=-angle;stream.userData.pulse=true;stream.userData.baseScale=1;group.add(stream);this.animated.push(stream);
      }
    } else if (poi.style === "reactor") {
      // Containment hardware sits above the 42m playable core building. The
      // previous tilted conduits pierced its floors and looked like solid
      // obstacles despite having no authoritative collision.
      const core = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(5.5, 8, 32, 16)), this.materials.get("energyCyan")); core.position.y = 59; group.add(core);
      const light = new THREE.PointLight(0xffd84d, 7, 115, 1.7); light.position.y = 48; group.add(light);
      for (const [radius, y] of [[13, 46], [16, 59], [12, 72]] as const) {
        const ring = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(radius, 1, 9, 36)), dark); ring.position.y = y; ring.rotation.x = Math.PI / 2; ring.userData.rotationSpeed = y === 59 ? -.00022 : .00017; group.add(ring); this.animated.push(ring);
      }
      // A containment cage ties the suspended rings back into the playable
      // reactor roof. Without these load paths the landmark read as effects
      // hovering over an otherwise ordinary office tower.
      const cageBeam=this.materials.unitChamferedBox;
      for(const [sx,sz] of [[-1,-1],[-1,1],[1,-1],[1,1]] as const){
        const pylon=new THREE.Mesh(cageBeam,dark);pylon.name="helios-containment-pylon";
        pylon.position.set(sx*10.5,58.5,sz*10.5);pylon.scale.set(1.45,29,1.45);group.add(pylon);
        const bus=new THREE.Mesh(cageBeam,this.materials.get("industrialOrange"));bus.position.set(sx*10.5,49,sz*10.5);bus.scale.set(1.8,.7,1.8);group.add(bus);
        const energy=new THREE.Mesh(cageBeam,this.materials.get("energyCyan"));energy.position.set(sx*10.5,61,sz*10.5);energy.scale.set(.28,20,.28);group.add(energy);
      }
      for(const y of [48.5,70.5])for(const axis of ["x","z"] as const)for(const side of [-1,1]){
        const brace=new THREE.Mesh(cageBeam,this.materials.get(y>60?"brushedMetal":"structuralDark"));brace.name="helios-containment-brace";
        brace.position.set(axis==="x"?0:side*10.5,y,axis==="z"?0:side*10.5);
        brace.scale.set(axis==="x"?22.5:.75,.75,axis==="z"?22.5:.75);group.add(brace);
      }
      const crown=new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(4.4,7.2,3.2,10)),this.materials.get("brushedMetal"));crown.name="helios-reactor-crown";crown.position.y=76;group.add(crown);
      const crownPulse=new THREE.Mesh(this.geometry(new THREE.TorusGeometry(5.8,.34,7,28)),this.materials.get("energyCyan"));crownPulse.position.y=77.7;crownPulse.rotation.x=Math.PI/2;crownPulse.userData.rotationSpeed=-.00034;group.add(crownPulse);this.animated.push(crownPulse);
      for(let index=0;index<4;index++){const angle=index/4*Math.PI*2;const conduit=new THREE.Mesh(this.geometry(new THREE.TorusGeometry(22,.72,7,30,Math.PI*.7)),this.materials.get(index%2?"industrialOrange":"energyCyan"));conduit.position.set(Math.cos(angle)*6,46+index*.9,Math.sin(angle)*6);conduit.rotation.set(Math.PI/2,0,angle);group.add(conduit);}
      for (let index = 0; index < 6; index++) { const angle = index / 6 * Math.PI * 2; const turbine = this.makeTurbine(Math.cos(angle) * 21, Math.sin(angle) * 21, poi.color); turbine.position.y = 44; group.add(turbine); }
    } else if (poi.style === "dock") {
      for (const offset of [-25, 25]) group.add(this.makeCrane(offset, 8, offset < 0 ? 1 : -1));
    } else if (poi.style === "academy") {
      // The observatory is the northern tower, not the occupied campus hall.
      const observatory = BR_STRUCTURES.find(s => s.id === "astra-observatory")!;
      const mount = new THREE.Group(); mount.position.set(observatory.position.x - poi.position.x, observatory.size.y + 3, observatory.position.z - poi.position.z); group.add(mount);
      const dome = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), this.materials.get("glass")); mount.add(dome);
      const base = new THREE.Mesh(this.materials.unitCylinder, dark); base.scale.set(8.4,.7,8.4); mount.add(base);
      const drum = new THREE.Mesh(this.materials.unitCylinder, this.materials.get("structuralWhite")); drum.position.y=-1.5; drum.scale.set(8.1,3,8.1); mount.add(drum);
      const instrument = new THREE.Mesh(this.materials.unitCylinder,this.materials.get("brushedMetal")); instrument.position.set(0,3.2,0); instrument.scale.set(.9,5,.9); instrument.rotation.z=-.65; mount.add(instrument);
      const ribGeometry = this.geometry(new THREE.TorusGeometry(8.1,.16,6,28,Math.PI));
      for (let rib = 0; rib < 4; rib++) { const frame = new THREE.Mesh(ribGeometry,this.materials.get("structuralWhite")); frame.rotation.y = rib*Math.PI/4; mount.add(frame); }
      const orbit = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(10, .25, 8, 36)), accent); orbit.position.y = 10; orbit.rotation.x = .9; orbit.userData.rotationSpeed = .00018; mount.add(orbit); this.animated.push(orbit);
    } else if (poi.style === "mall") {
      // The old 36m arch and dome cut through the mall's playable floors.
      const arch = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(4, .28, 8, 28, Math.PI)), dark); arch.position.set(0,4,-18); group.add(arch);
      const skylight = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(8, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2)), this.materials.get("glass")); skylight.position.set(0,18.3,4); group.add(skylight);
    } else if (poi.style === "farm") {
      // Growing houses are authored roof assemblies, not overlapping domes.
    } else if (poi.style === "wreck") {
      group.add(this.makeWreck(0, 0));
    } else if (poi.style === "industrial") {
      const foundry=BR_STRUCTURES.find(s=>s.id==="thruster-foundry")!;
      const geometries={box:this.materials.unitBox,barrel:this.materials.unitCylinder,
        bell:this.geometry(new THREE.CylinderGeometry(1,.8,1,16,1,true)),
        ring:this.geometry(new THREE.TorusGeometry(1,.06,6,24))};
      const finishes={frame:"structuralDark",shell:"paintedMetal",metal:"brushedMetal",paint:"industrialOrange",energy:"energyCyan"} as const;
      const batches=new Map<string,{shape:keyof typeof geometries;finish:keyof typeof finishes;parts:MatrixSpec[]}>();
      for(const part of buildFoundryEngines(foundry)) {
        const key=`${part.shape}:${part.finish}`;
        let batch=batches.get(key);
        if(!batch){batch={shape:part.shape,finish:part.finish,parts:[]};batches.set(key,batch);}
        batch.parts.push({position:position(part.position.x-poi.position.x,part.position.y-.45,part.position.z-poi.position.z),
          scale:position(part.scale.x,part.scale.y,part.scale.z),rotationX:part.rotationX,rotationZ:part.rotationZ});
      }
      for(const batch of batches.values()) this.addInstances(group,geometries[batch.shape],this.materials.get(finishes[batch.finish]),batch.parts,false);
    } else {
      // Nova's plaza marker is open filigree, not a large solid-looking knot
      // blocking the main street view despite having no gameplay collider.
      const marker=new THREE.Group();marker.position.set(-9,0,14);group.add(marker);
      const plinth=new THREE.Mesh(this.materials.unitCylinder,dark);plinth.position.y=.22;plinth.scale.set(1.85,.44,1.85);marker.add(plinth);
      const rim=new THREE.Mesh(this.geometry(new THREE.TorusGeometry(1.6,.08,6,28)),this.materials.get("brushedMetal"));rim.rotation.x=Math.PI/2;rim.position.y=.47;marker.add(rim);
      const core=new THREE.Mesh(this.geometry(new THREE.OctahedronGeometry(.65,1)),this.materials.get("energyCyan"));core.position.y=2.15;core.userData.rotationSpeed=.00023;marker.add(core);this.animated.push(core);
      const orbitGeometry=this.geometry(new THREE.TorusGeometry(1.35,.075,6,32));
      for(const angle of [-.55,.55]){const orbit=new THREE.Mesh(orbitGeometry,angle<0?this.materials.get("brushedMetal"):accent);orbit.position.y=2.15;orbit.rotation.set(.3,angle,.18);orbit.userData.rotationSpeed=angle<0?.0001:-.0001;marker.add(orbit);this.animated.push(orbit);}
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
    const utilityBoxes: MatrixSpec[] = [];
    const hazardCaps: MatrixSpec[] = [];
    for (let index = 0; index < BR_ROADS.length; index++) {
      const road = BR_ROADS[index];
      const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z;
      const length = Math.hypot(dx, dz), nx = -dz / length, nz = dx / length;
      const signX = road.from.x + dx * .58 + nx * road.width * .74;
      const signZ = road.from.z + dz * .58 + nz * road.width * .74;
      utilityBoxes.push({ position: position(signX, .8, signZ), scale: position(1.1, 1.6, .72), rotationY: -Math.atan2(dz, dx) });
    }
    for (const block of BR_MAP_BLOCKS) if (block.kind === "cover") hazardCaps.push({
      position: position(block.position.x, block.position.y + block.size.y / 2 + .06, block.position.z),
      scale: position(block.size.x * .92, .1, block.size.z * .92), rotationY: block.rotation?.y
    });
    const transitionGroup = new THREE.Group();
    transitionGroup.name = "deck-transition-fields";
    transitionGroup.visible = this.quality !== "low";
    const transitionBatches = new Map<string, MatrixSpec[]>();
    for (const site of buildDeckTransitions()) for (const part of site.parts) {
      const key = `${part.finish}:${part.layer}`;
      const batch = transitionBatches.get(key) ?? [];
      batch.push({
        position: position(part.position.x, part.position.y, part.position.z),
        scale: position(part.scale.x, part.scale.y, part.scale.z),
        rotationY: part.rotationY
      });
      transitionBatches.set(key, batch);
    }
    for (const [key, parts] of transitionBatches) {
      const [finish, layer] = key.split(":") as [DeckTransitionPart["finish"], string];
      this.addInstances(transitionGroup, this.materials.unitBox, this.materials.surface(finish, Number(layer)), parts, false);
    }
    this.root.add(transitionGroup);
    this.deckTransitionDetail = transitionGroup;
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
    const grove = new THREE.Group(); grove.name = "corridor-space-tree-groves";
    const groveBatches = new Map<string, BrCorridorGrovePart[]>();
    for (const part of buildBrCorridorGroves()) {
      const key = `${part.geometry}:${part.finish}`;
      const batch = groveBatches.get(key) ?? []; batch.push(part); groveBatches.set(key, batch);
    }
    for (const [key, parts] of groveBatches) {
      const [geometryKey, finish] = key.split(":") as [BrCorridorGrovePart["geometry"], BrCorridorGrovePart["finish"]];
      const geometry = geometryKey === "cylinder" ? this.materials.unitCylinder : geometryKey === "octahedron" ? this.materials.unitOctahedron : this.materials.unitBox;
      const material = finish === "canopy" ? this.materials.canopy() : finish === "sidewalk" ? this.materials.surface("sidewalk", 4) : this.materials.get(finish);
      this.addInstances(grove, geometry, material, parts.map(part => ({ position: position(part.position.x, part.position.y, part.position.z), scale: position(part.scale.x, part.scale.y, part.scale.z), rotationY: part.rotationY })), false);
    }
    this.root.add(grove);
  }

  private buildSectorFields(): void {
    const group = new THREE.Group();
    group.name = "orbital-sector-fields";
    group.visible = this.quality !== "low";
    const batches = new Map<string, MatrixSpec[]>();
    for (const field of buildBrSectorFields()) for (const part of field.parts) {
      const key = `${part.finish}:${part.layer}`;
      const batch = batches.get(key) ?? [];
      batch.push({
        position: position(part.position.x, part.position.y, part.position.z),
        scale: position(part.scale.x, part.scale.y, part.scale.z),
        rotationY: part.rotationY
      });
      batches.set(key, batch);
    }
    for (const [key, parts] of batches) {
      const [finish, layer] = key.split(":") as [BrSectorFieldPart["finish"], string];
      this.addInstances(group, this.materials.unitChamferedBox, this.materials.surface(finish, Number(layer)), parts, false);
    }
    this.root.add(group);
    this.sectorFieldDetail = group;
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

  private makeCrane(x: number, z: number, direction: -1 | 1): THREE.Group {
    // Cancel the landmark's display offset so the mast actually meets the deck.
    const group = new THREE.Group(); group.position.set(x, -.45, z);
    const batches = { frame: [] as MatrixSpec[], paint: [] as MatrixSpec[], metal: [] as MatrixSpec[], glass: [] as MatrixSpec[] };
    for (const part of buildCargoCrane(direction)) batches[part.finish].push({
      position: position(part.position.x, part.position.y, part.position.z),
      scale: position(part.scale.x, part.scale.y, part.scale.z), rotationZ: part.rotationZ
    });
    this.addInstances(group, this.materials.unitBox, this.materials.get("structuralDark"), batches.frame, false);
    this.addInstances(group, this.materials.unitBox, this.materials.get("industrialOrange"), batches.paint, false);
    this.addInstances(group, this.materials.unitBox, this.materials.get("brushedMetal"), batches.metal, false);
    this.addInstances(group, this.materials.unitBox, this.materials.get("windowDark"), batches.glass, false);
    return group;
  }

  private addCropRows(group: THREE.Group, x: number, z: number): void {
    const leaves: MatrixSpec[] = [], buds: MatrixSpec[] = [], beds: MatrixSpec[] = [], irrigation: MatrixSpec[] = [];
    for (let row = -6; row <= 6; row++) for (let column = -7; column <= 7; column++) {
      const bx = x + column * 6, bz = z + row * 8;
      // Test the whole bed footprint against roads/buildings/cover, not just
      // its center. These low plants are decoration, never apparent cover.
      if ([-1.4,0,1.4].some(dx => [-3.2,0,3.2].some(dz =>
        !this.insideIsland(bx+dx,bz+dz,8) || this.isReservedForGameplay(bx+dx,bz+dz) ||
        BR_MAP_BLOCKS.some(b => b.kind === "cover" && Math.abs(bx+dx-b.position.x)<b.size.x/2+2 && Math.abs(bz+dz-b.position.z)<b.size.z/2+2)))) continue;
      beds.push({position:position(bx,.12,bz),scale:position(2.8,.12,6.4)});
      irrigation.push({position:position(bx,.25,bz),scale:position(.09,.09,6.4)});
      for (let plant=0;plant<5;plant++) for (const side of [-1,1]) {
        const px=bx+side*.72,pz=bz-2.5+plant*1.2;
        leaves.push({position:position(px,.48,pz),scale:position(.45,.34,.25),rotationZ:side*.55,rotationY:plant*.7});
        leaves.push({position:position(px,.65,pz),scale:position(.24,.4,.22),rotationZ:-side*.35});
        if ((row+column)%3===0) buds.push({position:position(px,.92,pz),scale:position(.17,.18,.17)});
      }
    }
    this.addInstances(group,this.materials.unitBox,this.materials.get("soil"),beds,false);
    this.addInstances(group,this.materials.unitBox,this.materials.get("brushedMetal"),irrigation,false);
    const planting = new THREE.Group(); planting.name="near-crop-foliage"; group.add(planting);
    // Eight faces are enough for sub-metre leaves. The shared detailed
    // octahedron quadrupled the triangle cost without a visible benefit.
    const leafGeometry=this.geometry(new THREE.OctahedronGeometry(1,0));
    this.addInstances(planting,leafGeometry,this.materials.get("grass"),leaves,false);
    this.addInstances(planting,leafGeometry,this.materials.get("industrialOrange"),buds,false);
    this.districtDetails.push({group:planting,center:position(x,0,z),visible:true,distanceScale:.45});
  }

  private makeWreck(x: number, z: number): THREE.Group {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    const fuselage = BR_STRUCTURES.find(s => s.id === "crash-fuselage")!;
    const batches = { hull: [] as MatrixSpec[], frame: [] as MatrixSpec[], paint: [] as MatrixSpec[] };
    for (const part of buildWreckRoof(fuselage)) batches[part.finish].push({
      position:position(part.position.x-fuselage.position.x,part.position.y-.45,part.position.z-fuselage.position.z),
      scale:position(part.scale.x,part.scale.y,part.scale.z),rotationX:part.rotationX
    });
    // The POI landmark parent has a .45m display offset. Undo it here so the
    // tested shell bounds remain aligned with the actual authoritative roof.
    this.addInstances(group,this.materials.unitBox,this.materials.get("paintedMetal"),batches.hull,false);
    this.addInstances(group,this.materials.unitBox,this.materials.get("brushedMetal"),batches.frame,false);
    this.addInstances(group,this.materials.unitBox,this.materials.get("warningRed"),batches.paint,false);
    const exterior={hull:[] as MatrixSpec[],frame:[] as MatrixSpec[],paint:[] as MatrixSpec[],scorch:[] as MatrixSpec[],rib:[] as MatrixSpec[],breach:[] as MatrixSpec[],stripe:[] as MatrixSpec[]};
    for(const part of buildWreckExterior(fuselage))exterior[part.finish].push({position:position(part.position.x,part.position.y-.45,part.position.z),scale:position(part.scale.x,part.scale.y,part.scale.z),rotationY:part.rotationY,rotationZ:part.rotationZ});
    this.addInstances(group,this.materials.unitChamferedBox,this.materials.get("paintedMetal"),exterior.hull,false);
    this.addInstances(group,this.materials.unitBox,this.materials.get("structuralDark"),exterior.frame,false);
    this.addInstances(group,this.materials.unitBox,this.materials.get("warningRed"),exterior.paint,false);
    this.addInstances(group,this.materials.unitBox,this.materials.surface("structuralDark",13),exterior.scorch,false);
    this.addInstances(group,this.materials.unitBox,this.materials.get("brushedMetal"),exterior.rib,false);
    this.addInstances(group,this.materials.unitBox,this.materials.get("structuralDark"),exterior.breach,false);
    this.addInstances(group,this.materials.unitBox,this.materials.get("warningRed"),exterior.stripe,false);
    const engineRingGeometry=this.geometry(new THREE.TorusGeometry(3.7,.72,9,28));
    for(const zOffset of [-4.2,4.2]){const engineRing=new THREE.Mesh(engineRingGeometry,this.materials.get("brushedMetal"));engineRing.name="crash-engine-ring";engineRing.position.set(-fuselage.size.x/2+.8,4.6,zOffset);engineRing.rotation.y=Math.PI/2;group.add(engineRing);const ember=new THREE.Mesh(this.geometry(new THREE.CircleGeometry(2.75,20)),this.materials.get("warningRed"));ember.position.set(-fuselage.size.x/2-.02,4.6,zOffset);ember.rotation.y=-Math.PI/2;group.add(ember);}
    return group;
  }

  private buildRoadsideInfrastructure(): void {
    const batches = new Map<string, MatrixSpec[]>();
    for (const site of this.roadsideSites) {
      for (const part of site.parts) {
        const key = `${part.geometry}:${part.finish}:${part.surface}`;
        const batch = batches.get(key) ?? [];
        batch.push({
          position: position(part.position.x, part.position.y, part.position.z),
          scale: position(part.scale.x, part.scale.y, part.scale.z),
          rotationY: part.rotationY
        });
        batches.set(key, batch);
      }
    }
    for (const [key, parts] of batches) {
      const [geometryKey, finish, surface] = key.split(":") as ["box" | "cylinder" | "octahedron", RoadsideFinish, string];
      const geometry = geometryKey === "cylinder" ? this.materials.unitCylinder
        : geometryKey === "octahedron" ? this.materials.unitOctahedron : this.materials.unitBox;
      const material = finish === "canopy" ? this.materials.canopy()
        : geometryKey === "octahedron" && finish === "energyCyan" ? this.materials.accent(0x72dfe8, .18)
        : surface === "true" ? this.materials.surface(finish, 6) : this.materials.get(finish);
      this.addInstances(this.root, geometry, material, parts, false);
    }
  }

  private buildConnectiveClusters(): void {
    const group = new THREE.Group();
    group.name = "connective-micro-clusters";
    group.visible = this.quality !== "low";
    const batches = new Map<string, MatrixSpec[]>();
    for (const cluster of buildConnectiveClusters()) {
      for (const part of cluster.parts) {
        const key = `${part.geometry}:${part.finish}:${part.surface}`;
        const batch = batches.get(key) ?? [];
        batch.push({
          position: position(part.position.x, part.position.y, part.position.z),
          scale: position(part.scale.x, part.scale.y, part.scale.z),
          rotationY: part.rotationY
        });
        batches.set(key, batch);
      }
    }
    for (const [key, parts] of batches) {
      const [geometryKey, finish, surface] = key.split(":") as [ConnectiveClusterPart["geometry"], ConnectiveClusterPart["finish"], string];
      const geometry = geometryKey === "cylinder" ? this.materials.unitCylinder
        : geometryKey === "octahedron" ? this.materials.unitOctahedron : this.materials.unitBox;
      const material = surface === "true" ? this.materials.surface(finish, 6) : this.materials.get(finish);
      this.addInstances(group, geometry, material, parts, false);
    }
    this.root.add(group);
    this.connectiveClusterDetail = group;
  }

  private buildMaintenanceStrips(): void {
    const group = new THREE.Group();
    group.name = "roadside-maintenance-strips";
    group.visible = this.quality !== "low";
    const exclusions = this.roadsideSites.map((site) => ({ position: site.center }));
    const batches = new Map<string, MatrixSpec[]>();
    for (const strip of buildMaintenanceStrips({ traversal: [...BR_TRAVERSAL, ...exclusions] })) {
      for (const part of strip.parts) {
        const key = `${part.finish}:${part.layer}`;
        const batch = batches.get(key) ?? [];
        batch.push({
          position: position(part.position.x, part.position.y, part.position.z),
          scale: position(part.scale.x, part.scale.y, part.scale.z),
          rotationY: part.rotationY
        });
        batches.set(key, batch);
      }
    }
    for (const [key, parts] of batches) {
      const [finish, layer] = key.split(":") as ["structuralDark" | "brushedMetal" | "energyCyan", string];
      this.addInstances(group, this.materials.unitBox, this.materials.surface(finish, Number(layer)), parts, false);
    }
    this.root.add(group);
    this.maintenanceDetail = group;
  }

  private buildSecondaryDecks(): void {
    const batches = new Map<BrSecondaryDeckFinish, MatrixSpec[]>();
    const add = (finish: BrSecondaryDeckFinish, part: MatrixSpec) => {
      const batch = batches.get(finish) ?? [];
      batch.push(part);
      batches.set(finish, batch);
    };
    for (const location of BR_SECONDARY_LOCATIONS) {
      const destination = BR_POIS.find((poi) => poi.id === location.connectTo)?.position;
      if (!destination) continue;
      for (const part of buildSecondaryDeckParts(location, destination)) add(part.finish, {
        position: position(part.position.x, part.position.y, part.position.z),
        scale: position(part.scale.x, part.scale.y, part.scale.z),
        rotationY: part.rotationY
      });
    }
    for (const [finish, parts] of batches) this.addInstances(
      this.root,
      this.materials.unitChamferedBox,
      this.secondaryDeckMaterial(finish),
      parts,
      false
    );
  }

  private secondaryDeckMaterial(finish: BrSecondaryDeckFinish): THREE.Material {
    if (finish === "sidewalk" || finish === "concrete" || finish === "road" || finish === "grass" || finish === "soil") {
      return this.materials.surface(finish, 2);
    }
    return this.materials.get(finish);
  }

  private makeTurbine(x: number, z: number, color: string): THREE.Group {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    const casing = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(6, 1.5, 9, 24)), this.materials.get("brushedMetal")); casing.position.y = 6; group.add(casing);
    const rotor = new THREE.Group(); rotor.position.y = 6; rotor.rotation.z = .2;
    for (let index = 0; index < 6; index++) { const blade = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(5.2, .7, .24)), this.materials.accent(color, .2)); blade.rotation.z = index / 6 * Math.PI * 2; blade.position.x = Math.cos(blade.rotation.z) * 2.3; blade.position.y = Math.sin(blade.rotation.z) * 2.3; rotor.add(blade); }
    rotor.userData.rotationSpeed = .00042; rotor.userData.rotationAxis = "z"; group.add(rotor); this.animated.push(rotor);
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

  private isReservedForGameplay(x:number,z:number,margin=0):boolean {
    for (const structure of BR_STRUCTURES) {
      // Neighbouring district structures can overlap the dressing radius too.
      if(Math.abs(x-structure.position.x)<structure.size.x/2+3.5+margin&&Math.abs(z-structure.position.z)<structure.size.z/2+3.5+margin)return true;
    }
    for (const road of BR_ROADS) {
      const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z;
      const lengthSquared = dx * dx + dz * dz;
      const t = lengthSquared > 0 ? THREE.MathUtils.clamp(((x - road.from.x) * dx + (z - road.from.z) * dz) / lengthSquared, 0, 1) : 0;
      const rx = road.from.x + dx * t, rz = road.from.z + dz * t;
      if(Math.hypot(x-rx,z-rz)<road.width*.8+margin)return true;
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
