import type { BrDistrictStyle, BrSecondaryLocation, Vec3 } from "@planetfall/shared";

export type BrSecondaryDeckFinish =
  | "sidewalk"
  | "concrete"
  | "road"
  | "grass"
  | "soil"
  | "energyCyan"
  | "energyPurple"
  | "industrialOrange"
  | "warningRed";

export type BrSecondaryDeckPart = {
  finish: BrSecondaryDeckFinish;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
};

export const secondaryDeckBaseFinish = (style: BrDistrictStyle): BrSecondaryDeckFinish =>
  style === "farm" || style === "academy"
    ? "grass"
    : style === "city" || style === "mall" || style === "nexus"
      ? "sidewalk"
      : "road";

const transform = (
  location: BrSecondaryLocation,
  angle: number,
  localX: number,
  localZ: number
): Vec3 => ({
  x: location.position.x + localX * Math.cos(angle) - localZ * Math.sin(angle),
  y: .04,
  z: location.position.z + localX * Math.sin(angle) + localZ * Math.cos(angle)
});

/**
 * Broad visual-only neighborhood paving. Four separated quadrants preserve a
 * clear cross through each settlement for its service road and authored
 * structure approaches while making the clusters legible from drop altitude.
 */
export function buildSecondaryDeckParts(location: BrSecondaryLocation, destination: Vec3): BrSecondaryDeckPart[] {
  const angle = Math.atan2(destination.z - location.position.z, destination.x - location.position.x);
  const green = location.style === "farm" || location.style === "academy";
  const base = secondaryDeckBaseFinish(location.style);
  const accent: BrSecondaryDeckFinish = location.style === "wreck"
    ? "warningRed"
    : location.style === "dock" || location.style === "industrial" || location.style === "reactor"
      ? "industrialOrange"
      : location.style === "city" || location.style === "mall" || location.style === "academy"
        ? "energyPurple"
        : "energyCyan";

  const parts: BrSecondaryDeckPart[] = [];
  for (const localX of [-16, 16]) for (const localZ of [-15, 15]) parts.push({
    finish: base,
    position: transform(location, angle, localX, localZ),
    scale: { x: 21.5, y: .012, z: 19.5 },
    rotationY: -angle
  });

  // Thin perimeter inlays provide district identity without recolouring the
  // entire ground plane or creating apparent gameplay cover.
  for (const localZ of [-26.1, 26.1]) parts.push({
    finish: accent,
    position: { ...transform(location, angle, 0, localZ), y: .052 },
    scale: { x: 52, y: .014, z: .42 },
    rotationY: -angle
  });
  for (const localX of [-27.1, 27.1]) parts.push({
    finish: accent,
    position: { ...transform(location, angle, localX, 0), y: .052 },
    scale: { x: .42, y: .014, z: 51.5 },
    rotationY: -angle
  });

  if (green) {
    // Small soil beds break up green campuses and farm compounds while keeping
    // the central road and entrances open.
    for (const localX of [-16, 16]) parts.push({
      finish: "soil",
      position: { ...transform(location, angle, localX, 15), y: .052 },
      scale: { x: 12, y: .014, z: 3.2 },
      rotationY: -angle
    });
  }
  return parts;
}
