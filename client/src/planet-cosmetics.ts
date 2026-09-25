import * as THREE from "three";

export type VerityPlanetVisual = {
  group: THREE.Group;
  shell: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  face: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
};

const cameraPosition = new THREE.Vector3();
const cameraOrientation = new THREE.Quaternion();

/** A purely decorative shell at the existing gameplay radius. */
export function createVerityPlanetVisual(radius: number): VerityPlanetVisual {
  const group = new THREE.Group();
  group.name = "verity-planet";
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 40),
    new THREE.MeshStandardMaterial({
      color: 0xffd52e,
      emissive: 0xffbe16,
      emissiveIntensity: .22,
      roughness: .62,
      metalness: 0,
    }),
  );
  shell.name = "verity-yellow-shell";

  // Project densely subdivided ink onto the sphere, so the smile follows the
  // surface instead of sitting on a flat billboard in front of the planet.
  const positions: number[] = [];
  const indices: number[] = [];
  const inkRadius = radius * 1.0005;
  const vertex = (x: number, y: number): number => {
    const index = positions.length / 3;
    positions.push(x * inkRadius, y * inkRadius, Math.sqrt(1 - x * x - y * y) * inkRadius);
    return index;
  };
  const ellipse = (x: number, y: number, rx: number, ry: number): void => {
    const center = vertex(x, y);
    const segments = 40;
    const rings = 8;
    let previousRing = 0;
    for (let ring = 1; ring <= rings; ring++) {
      const start = positions.length / 3;
      for (let segment = 0; segment <= segments; segment++) {
        const angle = segment / segments * Math.PI * 2;
        vertex(x + Math.cos(angle) * rx * ring / rings, y + Math.sin(angle) * ry * ring / rings);
        if (segment === 0) continue;
        const current = start + segment;
        if (ring === 1) indices.push(center, current - 1, current);
        else {
          const previous = previousRing + segment;
          indices.push(previous - 1, current - 1, current, previous - 1, current, previous);
        }
      }
      previousRing = start;
    }
  };
  ellipse(-.28, .22, .06, .105);
  ellipse(.28, .22, .06, .105);

  const smileStart = positions.length / 3;
  const arcSegments = 64;
  const widthSegments = 4;
  const halfWidth = .037;
  for (let segment = 0; segment <= arcSegments; segment++) {
    const angle = -1.08 + segment / arcSegments * 2.16;
    for (let width = 0; width <= widthSegments; width++) {
      const arcRadius = .4 - halfWidth + width / widthSegments * halfWidth * 2;
      vertex(Math.sin(angle) * arcRadius, .03 - Math.cos(angle) * arcRadius);
      if (segment === 0 || width === 0) continue;
      const current = smileStart + segment * (widthSegments + 1) + width;
      const previous = current - widthSegments - 1;
      indices.push(previous - 1, current, current - 1, previous - 1, previous, current);
    }
  }
  for (const angle of [-1.08, 1.08]) {
    ellipse(Math.sin(angle) * .4, .03 - Math.cos(angle) * .4, halfWidth, halfWidth);
  }

  const faceGeometry = new THREE.BufferGeometry();
  faceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  faceGeometry.setIndex(indices);
  faceGeometry.computeVertexNormals();
  const face = new THREE.Mesh(faceGeometry, new THREE.MeshBasicMaterial({ color: 0x32230e }));
  face.name = "verity-happy-face";
  group.add(shell, face);
  return { group, shell, face };
}

/** Keep the expression upright and facing the view without rotating gameplay objects. */
export function updateVerityPlanetVisual(visual: VerityPlanetVisual, camera: THREE.Camera): void {
  camera.getWorldPosition(cameraPosition);
  camera.getWorldQuaternion(cameraOrientation);
  visual.group.up.set(0, 1, 0).applyQuaternion(cameraOrientation);
  visual.group.lookAt(cameraPosition);
}

export function disposeVerityPlanetVisual(visual: VerityPlanetVisual): void {
  visual.group.removeFromParent();
  visual.shell.geometry.dispose();
  visual.shell.material.dispose();
  visual.face.geometry.dispose();
  visual.face.material.dispose();
}
