import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// Actual assembly lifetime, without WebGL or a running match. Dispose events
// are the renderer's resource-release contract, not a measured GPU heap size.
const origin = process.env.PLANETFALL_AUDIT_URL ?? "http://127.0.0.1:5173";
const output = process.argv[2] ?? "artifacts/br-world-cleanup/report.json";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/__cleanup_audit__", route => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await page.goto(new URL("/__cleanup_audit__", origin).href);
  const cycles = await page.evaluate(async () => {
    const { BrWorldRenderer } = await import("/src/modes/battle-royale/br-world.ts");
    const results = [];
    for (const quality of ["high", "low"]) {
      const world = new BrWorldRenderer(quality), resources = new Map();
      const track = (resource, kind) => {
        if (!resource || resources.has(resource)) return;
        const entry = { kind, count: 0 }; resources.set(resource, entry);
        resource.addEventListener("dispose", () => entry.count++);
      };
      world.root.traverse(object => {
        if (object.isInstancedMesh) track(object, "instance-batch");
        // Three's default Sprite quad is global and borrowed by both modes.
        // Unlike world meshes, it must survive an individual BR disposal.
        if (object.geometry && !object.isSprite) track(object.geometry, "geometry");
        for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
          track(material, "material");
          for (const value of Object.values(material)) if (value?.isTexture) track(value, "texture");
        }
      });
      const sprite = world.root.getObjectByProperty("isSprite", true), borrowed = sprite?.geometry;
      let borrowedDisposals = 0;
      const onBorrowedDispose = () => borrowedDisposals++;
      borrowed?.addEventListener("dispose", onBorrowedDispose);
      world.dispose(); world.dispose();
      borrowed?.removeEventListener("dispose", onBorrowedDispose);
      const counts = {}, missing = {}, repeated = {};
      for (const { kind, count } of resources.values()) {
        counts[kind] = (counts[kind] ?? 0) + 1;
        if (count === 0) missing[kind] = (missing[kind] ?? 0) + 1;
        if (count > 1) repeated[kind] = (repeated[kind] ?? 0) + 1;
      }
      results.push({ quality, counts, missing, repeated, rootChildren: world.root.children.length,
        collidableMeshes: world.collidableMeshes.length, poiLabels: world.poiLabels.length, borrowedDisposals });
    }
    return results;
  });
  const passed = !errors.length && cycles.every(c => !Object.keys(c.missing).length && !Object.keys(c.repeated).length && !c.rootChildren && !c.collidableMeshes && !c.poiLabels && !c.borrowedDisposals);
  const report = { scope: "Two complete production world assemblies; each reachable instance batch, geometry, material and mapped texture releases exactly once despite repeated dispose calls.",
    limits: "No WebGL allocation/memory measurement, live match, audio, sockets, players or Classic scene. Global borrowed Sprite geometry is retained. Does not prove every unreachable library resource is freed.", cycles, errors, passed };
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report)); if (!passed) process.exitCode = 1;
} finally { await browser.close(); }
