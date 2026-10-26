import * as THREE from "three";

const MAX_PILOTS = 12, MAX_BATCHES = 256, PARTS_PER_BATCH = MAX_PILOTS * 32, MAX_PARTS = 512;
type Batch = { mesh: THREE.InstancedMesh; used: number; refs: number };
type Part = { source: THREE.Mesh; ancestors: THREE.Object3D[]; batch?: Batch; proxy?: THREE.Mesh; instances: number; stamp: number };
type Pilot = { parts: Part[]; stamp: number };

/** Exact opaque canonical geometry batching. Transparent/multi-material pieces
 * retain individual draw calls so their sorting is unchanged. The pool group
 * must remain at identity: submitted matrices are world-space matrices.
 * Register again ONLY when a rig gains new meshes (e.g. first weapon switch).
 * Hide original roots externally; submit ignores root.visible, not child flags.
 * Caller updates source world matrices after animation, before submit(). */
export function createPgPilotBatches() {
  const group = new THREE.Group(); group.name = "planet-gun-canonical-pilot-batches";
  const pilots = new Map<THREE.Object3D, Pilot>();
  const batches = new Map<string, Batch>();
  const geometryKeys = new WeakMap<THREE.BufferGeometry, string>();
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  let frame = 1, disposed = false;
  function geometryKey(g: THREE.BufferGeometry): string {
    let key = geometryKeys.get(g); if (key) return key;
    const attrs = Object.keys(g.attributes).sort().map(name => {
      const a = g.getAttribute(name);
      if (a instanceof THREE.InterleavedBufferAttribute) return `${name}:interleaved:${g.uuid}`;
      return `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}:${Array.from(a.array).join(",")}`;
    });
    key = `${attrs.join("|")}|index:${g.index ? Array.from(g.index.array).join(",") : "none"}|groups:${JSON.stringify(g.groups)}|range:${g.drawRange.start},${g.drawRange.count}`;
    geometryKeys.set(g, key); return key;
  }
  function materialKey(m: THREE.Material): string {
    const json = m.toJSON();
    delete (json as { uuid?: string }).uuid; delete (json as { name?: string }).name;
    // Material.toJSON omits some render-state flags (e.g. clipping). Include
    // every primitive property as well, excluding only identity/version fields.
    const state: Record<string, unknown> = {};
    for (const key of Object.keys(m).sort()) {
      if (key === "id" || key === "uuid" || key === "name" || key === "version") continue;
      const value = (m as unknown as Record<string, unknown>)[key];
      if (value === null || typeof value === "number" || typeof value === "string" || typeof value === "boolean") state[key] = value;
    }
    state.clippingPlanes = m.clippingPlanes?.map(p => [p.normal.x, p.normal.y, p.normal.z, p.constant]);
    return JSON.stringify(json) + JSON.stringify(state) + "|" + m.customProgramCacheKey() + "|" + m.onBeforeCompile.toString();
  }
  function cloneMaterial(m: THREE.Material): THREE.Material {
    const clone = m.clone();
    // Three Material.copy deliberately omits shader hooks. Preserve visor mask.
    clone.onBeforeCompile = m.onBeforeCompile;
    clone.customProgramCacheKey = m.customProgramCacheKey;
    return clone;
  }
  function releaseMesh(mesh: THREE.Mesh) {
    mesh.removeFromParent(); mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) for (const m of mesh.material) m.dispose();
    else mesh.material.dispose();
    if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
  }
  function unregister(root: THREE.Object3D) {
    const pilot = pilots.get(root); if (!pilot) return;
    for (const part of pilot.parts) {
      if (part.proxy) releaseMesh(part.proxy);
      if (part.batch) part.batch.refs -= part.instances;
    }
    pilots.delete(root);
    for (const [key, batch] of batches) if (batch.refs === 0) { releaseMesh(batch.mesh); batches.delete(key); }
  }
  function register(root: THREE.Object3D): { accepted: boolean; batched: number; individual: number; reason?: string } {
    if (disposed || (!pilots.has(root) && pilots.size >= MAX_PILOTS)) return { accepted: false, batched: 0, individual: 0, reason: "pilot capacity" };
    const sources: THREE.Mesh[] = []; let reason = "";
    root.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      if (o instanceof THREE.SkinnedMesh || Object.keys(o.geometry.morphAttributes).length || o.morphTargetInfluences) reason = "skinned/morph geometry requires original rendering";
      sources.push(o);
    });
    if (reason || sources.length > MAX_PARTS) return { accepted: false, batched: 0, individual: 0, reason: reason || "part capacity" };
    unregister(root);
    const parts: Part[] = []; let batched = 0, individual = 0;
    for (const source of sources) {
      const ancestors: THREE.Object3D[] = [];
      for (let o: THREE.Object3D | null = source; o && o !== root; o = o.parent) ancestors.push(o);
      const m = source.material;
      const instances = source instanceof THREE.InstancedMesh ? source.instanceMatrix.count : 1;
      const part: Part = { source, ancestors, instances, stamp: 0 };
      const opaque = !Array.isArray(m) && !m.transparent && !(m instanceof THREE.ShaderMaterial) && instances <= 32
        && source.onBeforeRender === THREE.Object3D.prototype.onBeforeRender
        && !(source.geometry instanceof THREE.InstancedBufferGeometry);
      const key = opaque ? geometryKey(source.geometry) + "|material:" + materialKey(m as THREE.Material) + `|shadow:${source.castShadow},${source.receiveShadow}|order:${source.renderOrder}|layers:${source.layers.mask}` : "";
      let batch = key ? batches.get(key) : undefined;
      if (key && !batch && batches.size < MAX_BATCHES) {
        const mesh = new THREE.InstancedMesh(source.geometry.clone(), cloneMaterial(m as THREE.Material), PARTS_PER_BATCH);
        mesh.name = `planet-gun-canonical-batch-${batches.size}`;
        mesh.count = 0; mesh.frustumCulled = false;
        mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
        mesh.renderOrder = source.renderOrder; mesh.layers.mask = source.layers.mask;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // Allocate once; white preserves normal material color for regular meshes.
        for (let i = 0; i < PARTS_PER_BATCH; i++) mesh.setColorAt(i, color.set(0xffffff));
        mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
        group.add(mesh); batch = { mesh, used: 0, refs: 0 }; batches.set(key, batch);
      }
      // Bound admission by registered parts, so submit never silently drops one.
      if (batch && batch.refs + instances <= PARTS_PER_BATCH) {
        batch.refs += instances; part.batch = batch; batched += instances;
        // refs count submitted primitives, including the two canonical eyes.
      } else {
        const materials = Array.isArray(m) ? m.map(cloneMaterial) : cloneMaterial(m);
        const proxy = source instanceof THREE.InstancedMesh
          ? new THREE.InstancedMesh(source.geometry.clone(), materials, instances)
          : new THREE.Mesh(source.geometry.clone(), materials);
        proxy.name = `planet-gun-canonical-individual-${source.name || source.id}`;
        proxy.matrixAutoUpdate = false; proxy.frustumCulled = source.frustumCulled;
        proxy.castShadow = source.castShadow; proxy.receiveShadow = source.receiveShadow;
        proxy.renderOrder = source.renderOrder; proxy.layers.mask = source.layers.mask; proxy.visible = false;
        proxy.onBeforeRender = source.onBeforeRender; proxy.onAfterRender = source.onAfterRender;
        if (source instanceof THREE.InstancedMesh && proxy instanceof THREE.InstancedMesh && source.instanceColor) proxy.instanceColor = source.instanceColor.clone() as THREE.InstancedBufferAttribute;
        group.add(proxy); part.proxy = proxy; individual++;
      }
      parts.push(part);
    }
    pilots.set(root, { parts, stamp: 0 }); return { accepted: true, batched, individual };
  }
  function submit(root: THREE.Object3D) {
    if (disposed) return;
    const pilot = pilots.get(root); if (!pilot || pilot.stamp === frame) return;
    pilot.stamp = frame;
    for (const part of pilot.parts) {
      let visible = true;
      for (const ancestor of part.ancestors) if (!ancestor.visible) { visible = false; break; }
      if (!visible) continue;
      const source = part.source;
      if (part.proxy) {
        part.proxy.matrix.copy(source.matrixWorld); part.proxy.matrixWorldNeedsUpdate = true;
        if (source instanceof THREE.InstancedMesh && part.proxy instanceof THREE.InstancedMesh) {
          part.proxy.count = Math.min(source.count, part.instances);
          part.proxy.instanceMatrix.array.set(source.instanceMatrix.array); part.proxy.instanceMatrix.needsUpdate = true;
          if (source.instanceColor && part.proxy.instanceColor) { part.proxy.instanceColor.array.set(source.instanceColor.array); part.proxy.instanceColor.needsUpdate = true; }
        }
        part.stamp = frame; continue;
      }
      const batch = part.batch!;
      const count = source instanceof THREE.InstancedMesh ? Math.min(source.count, part.instances) : 1;
      for (let i = 0; i < count; i++) {
        if (source instanceof THREE.InstancedMesh) { source.getMatrixAt(i, matrix); matrix.premultiply(source.matrixWorld); }
        else matrix.copy(source.matrixWorld);
        batch.mesh.setMatrixAt(batch.used, matrix);
        if (source instanceof THREE.InstancedMesh && source.instanceColor) source.getColorAt(i, color);
        else color.set(0xffffff);
        batch.mesh.setColorAt(batch.used, color); batch.used++;
      }
    }
  }
  function flush() {
    if (disposed) return;
    for (const batch of batches.values()) {
      batch.mesh.count = batch.used; batch.used = 0;
      batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.instanceColor!.needsUpdate = true;
    }
    for (const pilot of pilots.values()) for (const part of pilot.parts) if (part.proxy) part.proxy.visible = part.stamp === frame;
    frame++;
  }
  function dispose() {
    if (disposed) return;
    for (const root of pilots.keys()) unregister(root);
    disposed = true; group.clear();
  }
  return { group, register, unregister, submit, flush, dispose };
}
