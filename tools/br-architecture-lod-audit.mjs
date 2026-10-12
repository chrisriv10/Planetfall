import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// Exercise the production world assembly and real LOD transitions in Vite.
// This checks visibility and ownership, not visual or gameplay acceptance.
const origin = process.env.PLANETFALL_AUDIT_URL ?? "http://127.0.0.1:5173";
const output = process.argv[2] ?? "artifacts/br-architecture-lod/report.json";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/__architecture_audit__", route => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await page.goto(new URL("/__architecture_audit__", origin).href);
  const checks = await page.evaluate(async () => {
    const source = await (await fetch("/src/modes/battle-royale/br-world.ts")).text();
    const threePath = source.match(/import \* as THREE from "([^"]+)"/)?.[1];
    const sharedPath = source.match(/from "([^"]*shared[^"]*)"/)?.[1];
    if (!threePath || !sharedPath) throw new Error("Cannot resolve renderer imports");
    const THREE = await import(threePath);
    const { BR_POIS, BR_SECONDARY_LOCATIONS, BR_STRUCTURES } = await import(sharedPath);
    const { BrWorldRenderer } = await import("/src/modes/battle-royale/br-world.ts");
    const world = new BrWorldRenderer("high"), camera = new THREE.PerspectiveCamera(), results = [];
    try {
      for (const quality of ["high", "medium", "low"]) {
        world.setQuality(quality);
        for (const poi of [...BR_POIS, ...BR_SECONDARY_LOCATIONS]) {
          if (!BR_STRUCTURES.some(s => s.districtId === poi.id)) continue;
          const shell = world.root.getObjectByName(`architecture-silhouette-${poi.id}`);
          const detail = world.root.getObjectByName(`detail-${poi.id}`);
          const distant = world.root.getObjectByName(`distant-facade-${poi.id}`);
          if (!shell || !detail || !distant) throw new Error(`Missing assembly: ${poi.id}`);
          const batches = shell.children.filter(o => o.isInstancedMesh);
          const buffers = batches.map(o => o.instanceMatrix);
          for (const near of [true, false, true]) {
            camera.position.set(poi.position.x, poi.position.y + 2, poi.position.z + (near ? 1 : 2000));
            world.update(camera, 1000);
            let visibleInstances = 0;
            world.root.traverseVisible(o => { if (batches.includes(o)) visibleInstances += o.count; });
            const shadowsCorrect = batches.every(o => o.castShadow === (quality === "high" && near && o.userData.cameraCollision === true));
            results.push({ quality, district: poi.id, near, visibleInstances,
              passed: visibleInstances > 0 && shell.parent === world.root && shell.visible &&
                detail.visible === near && distant.visible === !near && shadowsCorrect &&
                batches.every((o, i) => o.instanceMatrix === buffers[i]) });
          }
        }
      }
    } finally { world.dispose(); }
    return results;
  });
  const passed = !errors.length && checks.length > 0 && checks.every(c => c.passed);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ scope: "Production structural envelopes survive near/far/near transitions at every quality; no rebuilt instance buffers; near-only shadows and mutually exclusive facade tiers.", checks, errors, passed }, null, 2) + "\n");
  console.log(JSON.stringify({ passed, checks: checks.length, failures: checks.filter(c => !c.passed), errors }));
  if (!passed) process.exitCode = 1;
} finally { await browser.close(); }
