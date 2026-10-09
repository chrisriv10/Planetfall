import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// Inspect actual POI prop assembly, not a separately reconstructed art model.
// No WebGL render loop or match is needed; this runs one static pose on a blank
// Vite page and disposes the world/browser afterward.
const origin = process.env.PLANETFALL_AUDIT_URL ?? "http://127.0.0.1:5173";
const output = process.argv[2] ?? "artifacts/br-prop-audit/report.json";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/__prop_audit__", route => route.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }));
  await page.goto(new URL("/__prop_audit__", origin).href);
  const report = await page.evaluate(async () => {
    const source = await (await fetch("/src/modes/battle-royale/br-world.ts")).text();
    const threePath = source.match(/import \* as THREE from "([^"]+)"/)?.[1];
    const sharedPath = source.match(/from "([^"]*shared[^"]*)"/)?.[1];
    if (!threePath || !sharedPath) throw new Error("Vite renderer imports could not be resolved");
    const THREE = await import(threePath), { BR_POIS, BR_STRUCTURES } = await import(sharedPath);
    const { BrWorldRenderer } = await import("/src/modes/battle-royale/br-world.ts");
    const { buildBrContextVehiclePlacements, brContextVehicleFootprint, BR_CONTEXT_VEHICLE_BOUNDS } = await import("/src/modes/battle-royale/br-context-placements.ts");
    const world = new BrWorldRenderer("high");
    try {
      world.root.updateMatrixWorld(true);
      const groups = BR_POIS.map(poi => ({ poi, group: world.root.children.find(g => g.name === `props-${poi.id}`) }));
      if (groups.some(g => !g.group)) throw new Error("Expected district prop assembly is missing");
      const targets = BR_STRUCTURES.map(s => ({ s, box: new THREE.Box3(
        new THREE.Vector3(s.position.x - s.size.x / 2 + .4, s.position.y + .4, s.position.z - s.size.z / 2 + .4),
        new THREE.Vector3(s.position.x + s.size.x / 2 - .4, s.position.y + s.size.y - .3, s.position.z + s.size.z / 2 - .4)) }));
      const triangle = new THREE.Triangle(), bounds = new THREE.Box3(), local = new THREE.Matrix4(), matrix = new THREE.Matrix4();
      const hits = [], vehicles = [], vehicleErrors = []; let meshObjects = 0, instances = 0, broadPhaseCandidates = 0, triangleChecks = 0;
      for (const placement of buildBrContextVehiclePlacements()) {
        const parent = groups.find(g => g.poi.id === placement.districtId)?.group;
        const vehicle = parent?.children.find(g => g.name === placement.id);
        if (!vehicle) { vehicleErrors.push(`${placement.id}: missing production vehicle`); continue; }
        const actual = new THREE.Box3().setFromObject(vehicle);
        const envelope = brContextVehicleFootprint(placement), spec = BR_CONTEXT_VEHICLE_BOUNDS[placement.kind];
        const tolerance = .001;
        if (actual.min.x < envelope.minX - tolerance || actual.max.x > envelope.maxX + tolerance ||
            actual.min.z < envelope.minZ - tolerance || actual.max.z > envelope.maxZ + tolerance ||
            actual.min.y < placement.position.y + spec.minY - tolerance || actual.max.y > placement.position.y + spec.maxY + tolerance) {
          vehicleErrors.push(`${placement.id}: factory exceeds tested full-model envelope`);
        }
        const gap = actual.min.y - placement.groundHeight;
        if (Math.abs(gap - spec.groundGap) > tolerance) vehicleErrors.push(`${placement.id}: actual ground gap ${gap} != ${spec.groundGap}`);
        vehicles.push({ id: placement.id, kind: placement.kind, groundGap: gap, min: actual.min.toArray(), max: actual.max.toArray() });
      }
      for (const { poi, group } of groups) {
        let meshIndex = 0;
        group.traverse(mesh => {
          if (!mesh.isMesh) return;
          const n = meshIndex++; meshObjects++;
          const geometry = mesh.geometry, attr = geometry.attributes.position, index = geometry.index;
          geometry.computeBoundingBox();
          for (let instance = 0; instance < (mesh.isInstancedMesh ? mesh.count : 1); instance++) {
            instances++;
            if (mesh.isInstancedMesh) { mesh.getMatrixAt(instance, local); matrix.multiplyMatrices(mesh.matrixWorld, local); }
            else matrix.copy(mesh.matrixWorld);
            bounds.copy(geometry.boundingBox).applyMatrix4(matrix);
            for (const { s, box } of targets) {
              if (!bounds.intersectsBox(box)) continue;
              broadPhaseCandidates++; let cut = 0;
              for (let i = 0; i < (index ? index.count : attr.count); i += 3) {
                triangle.a.fromBufferAttribute(attr, index ? index.getX(i) : i).applyMatrix4(matrix);
                triangle.b.fromBufferAttribute(attr, index ? index.getX(i + 1) : i + 1).applyMatrix4(matrix);
                triangle.c.fromBufferAttribute(attr, index ? index.getX(i + 2) : i + 2).applyMatrix4(matrix);
                triangleChecks++; if (box.intersectsTriangle(triangle)) cut++;
              }
              if (cut) hits.push({ poi: poi.id, mesh: n, instance, name: mesh.name, type: geometry.type,
                structure: s.id, cutTriangles: cut, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } });
            }
          }
        });
      }
      return {
        scope: "Actual primary district props (including context vehicles, reactor conduits, fountain and crops) against all authored building envelopes; 0.4m wall/floor and 0.3m roof-contact margins.",
        limits: "One static pose and triangle surfaces, not a closed-volume or collision proof. Excludes sprites, secondary/roadside props, interiors, players and landmark groups. Does not prove prop-to-prop or prop-to-road clearance.",
        checked: { groups: groups.length, meshObjects, instances, structures: targets.length, broadPhaseCandidates, triangleChecks }, hits, vehicles, vehicleErrors
      };
    } finally { world.dispose(); }
  });
  const result = { generatedAt: new Date().toISOString(), ...report, errors, passed: report.hits.length === 0 && report.vehicleErrors.length === 0 && errors.length === 0 };
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ checked: result.checked, hits: result.hits.length, vehicleErrors: result.vehicleErrors, errors, passed: result.passed, output }));
  if (!result.passed) process.exitCode = 1;
} finally { await browser.close(); }
