import * as THREE from "three";

export const PG_PILOT_LOD_CAPACITY = 12;
type Vector = Readonly<{ x: number; y: number; z: number }>;
/** rootPosition is the interpolated canonical rig origin, INCLUDING its floor offset.
 * yaw is the authoritative player yaw, not the rig's yaw + PI. */
export type PgPilotLodPose = Readonly<{
  rootPosition: Vector;
  yaw: number;
  velocity: Vector;
  grounded: boolean;
  crouched: boolean;
  team: string;
  suitColor: THREE.ColorRepresentation;
  weapon?: string;
  timeSeconds?: number;
}>;

/** Six bounded draw calls for distant pilots. Scheduling, visibility and LOD
 * selection belong to the caller; this pool never changes gameplay state. */
export function createPgPilotLodArt() {
  const group = new THREE.Group();
  group.name = "planet-gun-far-pilots";
  const white = new THREE.MeshStandardMaterial({ color: 0xf0f6ff, roughness: .55, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x202747, roughness: .72 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x102344, roughness: .2, metalness: .55 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .58 });
  const torsoGeometry = new THREE.CapsuleGeometry(.48, .52, 3, 8);
  const sphereGeometry = new THREE.SphereGeometry(1, 8, 6);
  const limbGeometry = new THREE.CapsuleGeometry(.13, .4, 2, 6);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const geometries = [torsoGeometry, sphereGeometry, limbGeometry, boxGeometry];
  const materials = [white, dark, visor, accent];
  const perPilot = [1, 5, 4, 1, 4, 3] as const;
  function batch(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, parts: number) {
    const mesh = new THREE.InstancedMesh(geometry, material, PG_PILOT_LOD_CAPACITY * parts);
    mesh.name = `planet-gun-far-${name}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    // The pool spans the entire arena. Per-pilot selection is owned by the caller.
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  }
  const batches = [
    batch("torso", torsoGeometry, white, 1),
    batch("shells", sphereGeometry, white, 5),
    batch("limbs", limbGeometry, dark, 4),
    batch("visor", sphereGeometry, visor, 1),
    batch("identity", boxGeometry, accent, 4),
    batch("equipment", boxGeometry, dark, 3),
  ];
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  let disposed = false;
  let px = 0, py = 0, pz = 0, yaw = 0, sine = 0, cosine = 1;
  const scale = .85;
  function part(batchIndex: number, index: number, slot: number, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, pitch = 0, roll = 0) {
    transform.position.set(px + scale * (x * cosine + z * sine), py + scale * y, pz + scale * (z * cosine - x * sine));
    transform.rotation.set(pitch, yaw, roll, "YXZ");
    transform.scale.set(sx * scale, sy * scale, sz * scale);
    transform.updateMatrix();
    batches[batchIndex]!.setMatrixAt(index * perPilot[batchIndex]! + slot, transform.matrix);
  }
  function hide(index: number) {
    transform.scale.set(0, 0, 0);
    transform.position.set(0, 0, 0);
    transform.rotation.set(0, 0, 0);
    transform.updateMatrix();
    for (let b = 0; b < batches.length; b++) {
      for (let j = 0; j < perPilot[b]!; j++) batches[b]!.setMatrixAt(index * perPilot[b]! + j, transform.matrix);
    }
  }
  // Allocate instance colors once, before entering the frame loop.
  for (let i = 0; i < PG_PILOT_LOD_CAPACITY; i++) {
    hide(i);
    for (let j = 0; j < 4; j++) batches[4]!.setColorAt(i * 4 + j, color);
  }
  batches[4]!.instanceColor!.setUsage(THREE.DynamicDrawUsage);

  function update(index: number, pose: PgPilotLodPose): boolean {
    if (disposed || !Number.isInteger(index) || index < 0 || index >= PG_PILOT_LOD_CAPACITY) return false;
    px = pose.rootPosition.x; py = pose.rootPosition.y; pz = pose.rootPosition.z;
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz) || !Number.isFinite(pose.yaw)
      || Math.abs(px) > 100000 || Math.abs(py) > 100000 || Math.abs(pz) > 100000) {
      hide(index); return false;
    }
    yaw = pose.yaw + Math.PI; sine = Math.sin(yaw); cosine = Math.cos(yaw);
    const speed = Math.min(12, Math.hypot(pose.velocity.x, pose.velocity.z));
    const time = Number.isFinite(pose.timeSeconds) ? pose.timeSeconds! : 0;
    const swing = pose.grounded && !pose.crouched && Number.isFinite(speed) ? Math.sin(time * 9) * Math.min(.48, speed * .06) : 0;
    const crouch = pose.crouched ? .28 : 0;
    part(0, index, 0, 0, .72 - crouch * .5, 0, 1.06, pose.crouched ? .74 : 1, .92);
    part(1, index, 0, 0, 1.46 - crouch, 0, .56 * 1.02, .56 * .98, .56 * .98);
    part(3, index, 0, 0, 1.48 - crouch, .39, .42, .3, .17);
    part(4, index, 0, 0, .82 - crouch, .43, .62, .36, .12);
    part(4, index, 1, 0, .86 - crouch, .505, .3, .07, .025);
    part(5, index, 0, 0, .86 - crouch, -.45, .66, .74, .36);
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const legPitch = pose.crouched ? -.65 : !pose.grounded ? .38 + side * .15 : swing * sign;
      // Canonical crouched roots have only .04 world floor offset. Bend the
      // legs beneath the compressed torso without pushing the boots below it.
      const legY = pose.crouched ? .59 : .48;
      part(2, index, side, sign * .26, legY - Math.cos(legPitch) * .25, -Math.sin(legPitch) * .25, 1, 1, 1, legPitch);
      part(1, index, side + 1, sign * .26, legY - Math.cos(legPitch) * .58, .13 - Math.sin(legPitch) * .58, .252, .173, .36);
      // Forward-held two-handed silhouette, keeping the canonical shoulder width.
      const armPitch = pose.weapon ? -1.0 : -swing * sign;
      part(2, index, side + 2, sign * .57, 1.02 - crouch - Math.cos(armPitch) * .27, -Math.sin(armPitch) * .27, 1, 1, 1, armPitch);
      part(1, index, side + 3, sign * .48, 1.02 - crouch - Math.cos(armPitch) * .61, -Math.sin(armPitch) * .61, .18, .18, .18);
      part(4, index, side + 2, sign * .57, 1.02 - crouch, 0, .31, .19, .27);
    }
    const weaponLength = pose.weapon === "rail" || pose.weapon === "prism" ? .95 : pose.weapon === "nova" ? .5 : .7;
    const weaponScale = pose.weapon ? 1 : 0;
    part(5, index, 1, .32, .76 - crouch, .67, .16 * weaponScale, .18 * weaponScale, weaponLength * weaponScale);
    part(5, index, 2, .32, .65 - crouch, .47, .1 * weaponScale, .24 * weaponScale, .15 * weaponScale);
    color.set(pose.suitColor);
    batches[4]!.setColorAt(index * 4, color);
    batches[4]!.setColorAt(index * 4 + 2, color);
    batches[4]!.setColorAt(index * 4 + 3, color);
    color.set(pose.team === "solar" ? 0xffb45c : 0x5ae1f0);
    batches[4]!.setColorAt(index * 4 + 1, color);
    return true;
  }
  function flush(count: number) {
    if (disposed) return;
    const bounded = Number.isFinite(count) ? Math.max(0, Math.min(PG_PILOT_LOD_CAPACITY, Math.floor(count))) : 0;
    for (let b = 0; b < batches.length; b++) {
      batches[b]!.count = bounded * perPilot[b]!;
      batches[b]!.instanceMatrix.needsUpdate = true;
    }
    batches[4]!.instanceColor!.needsUpdate = true;
  }
  function clear() {
    if (disposed) return;
    for (let i = 0; i < PG_PILOT_LOD_CAPACITY; i++) hide(i);
    flush(0);
  }
  function dispose() {
    if (disposed) return;
    clear(); disposed = true;
    for (const mesh of batches) mesh.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    group.clear();
  }
  return { group, update, flush, clear, dispose };
}
