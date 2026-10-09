import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const origin = process.env.PLANETFALL_AUDIT_URL ?? "http://127.0.0.1:5173";
const output = process.argv[2] ?? "artifacts/br-sign-audit/report.json";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/__sign_audit__", route => route.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }));
  await page.goto(new URL("/__sign_audit__", origin).href);
  const report = await page.evaluate(async () => {
    const source = await (await fetch("/src/modes/battle-royale/br-world.ts")).text();
    const threePath = source.match(/import \* as THREE from "([^"]+)"/)?.[1];
    const sharedPath = source.match(/from "([^"]*shared[^"]*)"/)?.[1];
    if (!threePath || !sharedPath) throw new Error("Vite renderer imports could not be resolved");
    const THREE = await import(threePath), { BR_STRUCTURES } = await import(sharedPath);
    const { BrWorldRenderer } = await import("/src/modes/battle-royale/br-world.ts");
    const { buildBrFacadeSignCatalog } = await import("/src/modes/battle-royale/br-facade-signs.ts");
    const world = new BrWorldRenderer("high");
    try {
      world.root.updateMatrixWorld(true);
      const catalog = buildBrFacadeSignCatalog(), issues = [], labels = [], batchBounds = new Map();
      const local = new THREE.Matrix4(), matrix = new THREE.Matrix4(), bounds = new THREE.Box3();
      let matchedMounts = 0, labelObjects = 0;
      const close = (a, b) => Math.abs(a - b) < .002;
      const matching = (a, b) => ["x", "y", "z"].every(axis => close(a.min[axis], b.min[axis]) && close(a.max[axis], b.max[axis]));
      for (const entry of catalog) {
        const s = BR_STRUCTURES.find(s => s.id === entry.structureId), group = world.root.getObjectByName(`detail-${s.districtId}`);
        const label = world.root.getObjectByName(`facade-sign-${entry.structureId}`);
        if (!entry.sign) {
          if (label) issues.push(`${s.id}: omitted sign still rendered`);
          continue;
        }
        if (!label?.isMesh || label.isSprite) { issues.push(`${s.id}: missing fixed mounted label`); continue; }
        labelObjects++;
        const actual = new THREE.Vector3(); label.getWorldPosition(actual);
        const spec = entry.sign.label;
        if (!["x", "y", "z"].every(axis => close(actual[axis], spec.position[axis]))) issues.push(`${s.id}: world-space elevation/position mismatch`);
        const forward = new THREE.Vector3(0, 0, 1).transformDirection(label.matrixWorld);
        if (!close(forward.x, Math.sin(spec.rotationY)) || !close(forward.z, Math.cos(spec.rotationY))) issues.push(`${s.id}: wrong facing`);
        if (!close(label.scale.x, spec.width) || !close(label.scale.y, spec.height)) issues.push(`${s.id}: label scale mismatch`);
        if (!label.material.map || !label.material.depthTest || label.material.side !== THREE.FrontSide) issues.push(`${s.id}: label material visibility contract changed`);
        for (const part of entry.sign.parts) {
          const key = `${s.districtId}/${part.finish}`;
          if (!batchBounds.has(key)) {
            const all = [];
            group?.traverse(mesh => {
              if (!mesh.isInstancedMesh || mesh.geometry !== world.materials.unitBox || mesh.material !== world.materials.get(part.finish)) return;
              mesh.geometry.computeBoundingBox();
              for (let i = 0; i < mesh.count; i++) {
                mesh.getMatrixAt(i, local); matrix.multiplyMatrices(mesh.matrixWorld, local);
                all.push(new THREE.Box3().copy(mesh.geometry.boundingBox).applyMatrix4(matrix));
              }
            });
            batchBounds.set(key, all);
          }
          const expected = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(part.position.x, part.position.y, part.position.z), new THREE.Vector3(part.scale.x, part.scale.y, part.scale.z));
          if (batchBounds.get(key).some(actual => matching(actual, expected))) matchedMounts++;
          else issues.push(`${s.id}: missing or incorrectly elevated ${part.name}`);
        }
        bounds.setFromObject(label);
        for (const other of BR_STRUCTURES) {
          const box = new THREE.Box3(new THREE.Vector3(other.position.x - other.size.x / 2, other.position.y + .1, other.position.z - other.size.z / 2),
            new THREE.Vector3(other.position.x + other.size.x / 2, other.position.y + other.size.y, other.position.z + other.size.z / 2));
          if (bounds.intersectsBox(box)) issues.push(`${s.id}: label intersects ${other.id}`);
        }
        labels.push({ structureId: s.id, text: entry.text, position: actual.toArray(), facing: forward.toArray(), width: spec.width });
      }
      const legacySprites = [];
      world.root.children.filter(g => g.name.startsWith("props-")).forEach(g => g.traverse(o => { if (o.isSprite) legacySprites.push(g.name); }));
      if (legacySprites.length) issues.push(`Legacy context billboards remain in ${legacySprites.join(",")}`);
      return { scope: "Actual fixed building labels and all seven batch-assembled mount pieces, world elevation/facing/materials and building-envelope clearance. Legacy POI-relative context billboards must be absent.",
        limits: "Not pixel-level text visibility, gameplay, full rooftop/prop collision or human art acceptance. Fixed views and focused geometry tests complement this check.",
        checked: { namedCatalog: catalog.length, mountedLabels: labelObjects, matchedMounts, buildings: BR_STRUCTURES.length },
        omitted: catalog.filter(c => !c.sign).map(c => ({ structureId: c.structureId, text: c.text, reason: c.omission })), labels, issues };
    } finally { world.dispose(); }
  });
  const result = { generatedAt: new Date().toISOString(), ...report, errors, passed: report.issues.length === 0 && errors.length === 0 };
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ checked: result.checked, issues: result.issues, errors, passed: result.passed, output }));
  if (!result.passed) process.exitCode = 1;
} finally { await browser.close(); }
