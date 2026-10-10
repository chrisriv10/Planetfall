import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// One-shot production-world views, without server/match/continuous render loop.
const origin = process.env.PLANETFALL_AUDIT_URL ?? "http://127.0.0.1:5173";
const output = process.argv[2] ?? "artifacts/br-prop-audit/views";
const legacy = process.argv[3] === "--legacy-parking";
const cameraFile = process.argv.find(arg => arg.startsWith("--cameras="))?.slice("--cameras=".length);
const views = cameraFile ? JSON.parse(await readFile(cameraFile, "utf8")) : [
  { id: "nova-kiosk-apron", position: [-205, 7.7, -134], focus: [-192, 6.4, -103] },
  { id: "nova-studio-apron", position: [-150, 7.7, -135], focus: [-135, 6.4, -109] },
  { id: "thruster-pump-apron", position: [415, 2.7, -119], focus: [379, 1.5, -88] },
  { id: "dock-service-apron", position: [235, 3.4, -152], focus: [221, 1.7, -172] }
];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } }), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/__prop_review__", route => route.fulfill({ contentType: "text/html", body: "<html><body style='margin:0'></body></html>" }));
  await page.goto(new URL("/__prop_review__", origin).href);
  const measurements = await page.evaluate(async ({ views, legacy }) => {
    const source = await (await fetch("/src/modes/battle-royale/br-world.ts")).text();
    const threePath = source.match(/import \* as THREE from "([^"]+)"/)?.[1];
    if (!threePath) throw new Error("Vite Three import could not be resolved");
    const THREE = await import(threePath);
    const { BrWorldRenderer } = await import("/src/modes/battle-royale/br-world.ts");
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(960, 540); renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    document.body.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x020612);
    scene.fog = new THREE.FogExp2(0x0a1930, .00046);
    scene.add(new THREE.HemisphereLight(0xbadfff, 0x43556a, 1.72));
    const sun = new THREE.DirectionalLight(0xffe4bd, 3.15); sun.position.set(-230, 330, 155); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9dafff, .65); rim.position.set(310, 100, -260); scene.add(rim);
    const world = new BrWorldRenderer("high"); scene.add(world.root);
    // Reconstruct only the six documented old parking transforms for matching
    // before views. Never edit/reset the working tree or gameplay state.
    if (legacy) {
      for (const [id, x, y, z, yaw] of [
        ["nova-cafe-taxi", -197, 1.15, -99, .12], ["nova-studio-taxi", -153, 1.15, -99, -.18],
        ["dock-west-cargo", 127, .75, -164, .18], ["dock-east-cargo", 191, .75, -170, -.12],
        ["thruster-cargo", 314, .75, -92, .42], ["thruster-rover", 372, .72, -86, -.34]
      ]) {
        const vehicle = world.root.getObjectByName(id);
        if (!vehicle) throw new Error(`Missing context vehicle ${id}`);
        vehicle.position.set(x, y, z); vehicle.rotation.y = yaw;
      }
    }
    const { createAstronautVisual } = await import('/src/astronaut.ts');
    const comparisonAstronaut = createAstronautVisual({identityColor:'#70f5ff',suitAccent:'#eeeeee',isBot:false});
    const astronautBounds = new THREE.Box3().setFromObject(comparisonAstronaut.group);
    const astronautGroundOffset = -astronautBounds.min.y;
    scene.add(comparisonAstronaut.group);
    const camera = new THREE.PerspectiveCamera(65, 960 / 540, .1, 2000);
    // Test-only canvas export lets the harness retain each fixed view without
    // adding production debug hooks. Each camera is rendered exactly once.
    const results = [];
    try {
      for (const view of views) {
        comparisonAstronaut.group.position.set(view.astronautPosition[0],view.astronautPosition[1]+astronautGroundOffset,view.astronautPosition[2]);
        camera.position.fromArray(view.position); camera.lookAt(new THREE.Vector3().fromArray(view.focus));
        world.update(camera, 1000); renderer.render(scene, camera);
        results.push({ ...view, image: renderer.domElement.toDataURL("image/jpeg", .9), calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, world: world.debugStats() });
      }
    } finally { const geometries=new Set(),materials=new Set(); comparisonAstronaut.group.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();world.dispose(); renderer.dispose(); }
    return results;
  }, { views, legacy });
  await mkdir(output, { recursive: true });
  for (const result of measurements) {
    await writeFile(`${output}/${result.id}.jpg`, Buffer.from(result.image.split(",")[1], "base64"));
    delete result.image;
  }
  await writeFile(`${output}/review.json`, JSON.stringify({ scope: "Static actual-world assembly, normal materials and BR lighting, no gameplay/HUD/sky/bloom/shadows. Not FPS or human-control validation.", legacyParkingReconstructed: legacy, views: measurements, errors }, null, 2) + "\n");
  console.log(JSON.stringify({ views: measurements.length, errors, output }));
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
