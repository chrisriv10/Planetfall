import type { Vec3 } from "@planetfall/shared";

export interface BrPoiVisualBounds {
  readonly min: Readonly<Vec3>;
  readonly max: Readonly<Vec3>;
}

export interface BrPoiLabelLayout {
  position: Vec3;
  scale: Vec3;
}

export interface BrPoiLabelLayoutOptions {
  landmarkBounds?: BrPoiVisualBounds;
  /** Highest nearby authored structure surface in world coordinates. */
  nearbyStructureTop?: number;
}

const LABEL_WIDTH = 31;
const LABEL_HEIGHT = 9;
const DEFAULT_HEIGHT = 38;
const SILHOUETTE_MARGIN = 3;
const MAX_REASONABLE_RISE = 160;

const finiteVec = (value: Readonly<Vec3>) => Object.values(value).every(Number.isFinite);

/**
 * Positions the existing Planetfall POI label above measured world geometry.
 * The helper is deliberately presentation-only: callers derive a Box3 from the
 * actual landmark after construction and pass that immutable snapshot here.
 * Invalid/empty/implausible bounds fail back to the established 31×9 label at
 * 38m above the district deck rather than propagating Infinity into Three.js.
 */
export function layoutBrPoiLabel(
  poiPosition: Readonly<Vec3>,
  options: Readonly<BrPoiLabelLayoutOptions> = {}
): BrPoiLabelLayout {
  const origin = finiteVec(poiPosition) ? poiPosition : { x: 0, y: 0, z: 0 };
  const baseline = origin.y + DEFAULT_HEIGHT;
  const candidates: number[] = [];
  const bounds = options.landmarkBounds;
  if (bounds && finiteVec(bounds.min) && finiteVec(bounds.max)
    && bounds.max.x >= bounds.min.x && bounds.max.y >= bounds.min.y && bounds.max.z >= bounds.min.z
    && bounds.max.y >= origin.y - 10 && bounds.max.y <= origin.y + MAX_REASONABLE_RISE) candidates.push(bounds.max.y);
  const structureTop = options.nearbyStructureTop;
  if (Number.isFinite(structureTop) && structureTop! >= origin.y - 10
    && structureTop! <= origin.y + MAX_REASONABLE_RISE) candidates.push(structureTop!);
  const silhouetteTop = candidates.length ? Math.max(...candidates) : Number.NEGATIVE_INFINITY;
  const y = Math.max(baseline, silhouetteTop + SILHOUETTE_MARGIN + LABEL_HEIGHT / 2);
  return {
    position: { x: origin.x, y, z: origin.z },
    scale: { x: LABEL_WIDTH, y: LABEL_HEIGHT, z: 1 }
  };
}

