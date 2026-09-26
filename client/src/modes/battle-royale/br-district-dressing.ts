import type { BrDistrictPlan, Vec3 } from "@planetfall/shared";
import type { GraphicsQuality } from "../../settings";
import type { BrMaterialKey } from "./br-materials";

/** Pure presentation descriptors. Unit cylinders use radius=1, height=1;
 * octahedra radius=1; boxes use unit side lengths. Batch these using the world's
 * material/geometry cache, with cameraCollision=false and no physics body. */
export interface BrDistrictDressingPart {
  geometry: "box" | "chamferedBox" | "cylinder" | "octahedron";
  finish: BrMaterialKey;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
}
export interface BrDistrictDressingCluster {
  id: string;
  center: Vec3;
  radius: number;
  motif: "seating" | "research" | "cafe" | "maintenance" | "cultivation" | "salvage" | "wayfinding";
  parts: BrDistrictDressingPart[];
}
export interface BrDistrictDressingOptions {
  quality: GraphicsQuality;
  /** Must test the complete cluster circle against roads, doors, ramps, loot,
   * structures and island edge. Rejected groups are omitted as a whole. */
  isClear: (center: Vec3, radius: number) => boolean;
}

const MOTIFS: Record<BrDistrictPlan["kind"], BrDistrictDressingCluster["motif"]> = {
  neighborhood: "seating", campus: "research", commercial: "cafe",
  workyard: "maintenance", agricultural: "cultivation", salvage: "salvage", civic: "wayfinding"
};
const RADIUS = 2.25;

/** Four composed corners frame a deliberately empty pedestrian axis. Decorations
 * never occupy the plaza center; low quality keeps two opposed focal groups.
 * No random search, per-frame work, textures or new material instances. */
export function buildBrDistrictDressing(plan: BrDistrictPlan, options: BrDistrictDressingOptions): BrDistrictDressingCluster[] {
  const zone = plan.openZone;
  const length = Math.hypot(plan.approach.x, plan.approach.z);
  if (!Number.isFinite(length) || length < .001 || !Number.isFinite(zone.radius) || zone.radius < 8 ||
      ![zone.position.x, zone.position.z, plan.elevation].every(Number.isFinite)) return [];
  const forward = { x: plan.approach.x / length, z: plan.approach.z / length };
  const right = { x: -forward.z, z: forward.x };
  const yaw = Math.atan2(-right.z, right.x);
  const extent = Math.min(zone.radius, 15);
  const lateral = Math.max(5, extent * .48);
  const along = extent * .32;
  const corners = options.quality === "low" ? [[-1, -1], [1, 1]] : [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const clusters: BrDistrictDressingCluster[] = [];
  for (const [sx, sz] of corners) {
    const center = {
      x: zone.position.x + right.x * lateral * sx + forward.x * along * sz,
      y: plan.elevation,
      z: zone.position.z + right.z * lateral * sx + forward.z * along * sz
    };
    if (Math.hypot(lateral, along) + RADIUS > zone.radius || !options.isClear(center, RADIUS)) continue;
    const motif = MOTIFS[plan.kind];
    const rotationY = yaw + (sx > 0 ? Math.PI : 0);
    clusters.push({ id: `${plan.id}-court-${sx}-${sz}`, center, radius: RADIUS, motif,
      parts: buildCluster(center, rotationY, motif, options.quality, sz > 0) });
  }
  return clusters;
}

function buildCluster(center: Vec3, yaw: number, motif: BrDistrictDressingCluster["motif"], quality: GraphicsQuality, alternate: boolean): BrDistrictDressingPart[] {
  const parts: BrDistrictDressingPart[] = [];
  const add = (geometry: BrDistrictDressingPart["geometry"], finish: BrMaterialKey,
    x: number, y: number, z: number, sx: number, sy: number, sz: number, rotationY = 0) => {
    parts.push({ geometry, finish, position: { x: center.x + x * Math.cos(yaw) + z * Math.sin(yaw),
      y: center.y + y, z: center.z - x * Math.sin(yaw) + z * Math.cos(yaw) },
      scale: { x: sx, y: sy, z: sz }, rotationY: yaw + rotationY });
  };
  // A thin service plinth visually anchors the group without suggesting a step.
  add("chamferedBox", "concrete", 0, .045, 0, 2.7, .05, 2.3);
  const planter = (x: number, z: number, tall: boolean) => {
    add("chamferedBox", "structuralWhite", x, .28, z, .95, .48, .9);
    add("box", "soil", x, .528, z, .76, .025, .72);
    add("octahedron", "grass", x, tall ? 1.1 : .77, z, .47, tall ? .6 : .3, .46);
    if (quality === "high") add("octahedron", "grass", x + .2, .79, z + .15, .28, .35, .28);
  };
  const bench = () => {
    add("chamferedBox", "windowLit", 0, .49, -.68, 2.0, .16, .55);
    add("box", "structuralDark", -.73, .255, -.68, .13, .35, .43);
    add("box", "structuralDark", .73, .255, -.68, .13, .35, .43);
    add("chamferedBox", "structuralWhite", 0, .77, -.92, 2.0, .46, .13);
  };
  const terminal = (finish: BrMaterialKey) => {
    add("chamferedBox", "structuralDark", -.6, .75, .48, .6, 1.4, .45);
    add("box", finish, -.6, 1.13, .238, .43, .45, .026);
    if (quality !== "low") {
      add("box", "structuralWhite", -.6, .47, .235, .35, .065, .03);
      add("box", "structuralWhite", -.6, .64, .235, .35, .065, .03);
    }
  };
  switch (motif) {
    case "seating":
      bench(); planter(-.65, .58, alternate); planter(.65, .58, !alternate); break;
    case "research":
      terminal("energyPurple"); planter(.72, .6, true);
      add("cylinder", "brushedMetal", .55, .34, -.7, .5, .57, .5);
      add("octahedron", "hologram", .55, 1.14, -.7, .48, .62, .48);
      break;
    case "cafe":
      add("cylinder", "structuralDark", 0, .5, 0, .1, .84, .1);
      add("cylinder", "structuralWhite", 0, .96, 0, .72, .1, .72);
      for (const x of [-1, 1]) {
        add("chamferedBox", "industrialOrange", x, .5, 0, .48, .18, .57);
        add("box", "structuralDark", x, .27, 0, .26, .3, .26);
        add("box", "industrialOrange", x * 1.22, .76, 0, .11, .46, .57);
      }
      if (quality === "high") add("cylinder", "paintedMetal", 0, 1.09, 0, .11, .16, .11);
      break;
    case "maintenance":
      terminal("industrialOrange");
      add("chamferedBox", "paintedMetal", .65, .59, .34, .8, 1.05, .9);
      add("box", "brushedMetal", .65, 1.15, .34, .7, .07, .76);
      for (const x of [-.7, 0, .7]) {
        add("cylinder", "structuralDark", x, .26, -.72, .22, .38, .22);
        add("cylinder", "industrialOrange", x, .48, -.72, .25, .09, .25);
      }
      break;
    case "cultivation":
      for (const x of [-.65, .65]) for (const z of [-.58, .58]) planter(x, z, alternate);
      if (quality !== "low") add("box", "brushedMetal", 0, .1, 0, .08, .08, 1.8);
      break;
    case "salvage":
      add("chamferedBox", "cargoMetal", -.55, .36, 0, .9, .57, 1.5);
      add("chamferedBox", "brushedMetal", .48, .29, .4, .68, .43, .72, .26);
      add("cylinder", "structuralDark", .6, .26, -.57, .36, .36, .36);
      add("cylinder", "industrialOrange", .6, .46, -.57, .4, .07, .4);
      if (quality === "high") add("box", "structuralWhite", -.55, .66, .06, .65, .03, .09);
      break;
    case "wayfinding":
      terminal("energyCyan"); planter(.7, .55, true);
      add("cylinder", "brushedMetal", 0, .2, -.65, .5, .27, .5);
      add("octahedron", "structuralWhite", 0, 1.05, -.65, .55, .74, .38);
      add("octahedron", "energyCyan", 0, 1.93, -.65, .18, .2, .15);
      break;
  }
  return parts;
}
