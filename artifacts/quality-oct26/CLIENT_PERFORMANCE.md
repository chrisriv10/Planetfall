# PlanetGun client performance evidence

Native Chromium ANGLE RTX3060/D3D11,1280x720. Frame cadence remains near the60Hz display limit. CPU submission time is not GPU time. No heavy test/encoding ran concurrently with these captures. Auto resolved to Medium.

## Same-room close-player A/B

One build, twelve ordinary protocol clients, eleven remote pilots parked using authoritative movement, exactly six within15m of the actual player camera. Original and batched rendering use the same canonical geometry, materials, animation, camera, quality and room. Batching was switched through a DEV-only presentation toggle. The workload is controlled, not competitive botcombat; finite ammo and fixture metadata are retained.

| Preset | Rendering | Frame mean/median/p95/p99 ms | Frame CPU mean/median/p95/p99 ms | Submit median ms | Calls | Triangles | Instances | Materials | Programs |
|---|---|---|---|---:|---:|---:|---:|---:|---:|
|low|original-six|16.67 / 16.70 / 16.80 / 16.90|4.95 / 4.80 / 6.00 / 6.50|4.40|581|77578|3565|173|50|
|low|batched-six|16.67 / 16.70 / 16.80 / 17.20|3.23 / 3.10 / 4.30 / 4.90|2.00|182|77578|3981|104|50|
|medium|original-six|16.67 / 16.70 / 16.80 / 16.90|5.33 / 5.20 / 6.50 / 7.60|4.80|656|88158|4178|186|50|
|medium|batched-six|16.67 / 16.70 / 16.80 / 16.90|3.27 / 3.10 / 4.20 / 5.20|2.00|190|88158|4662|105|50|
|high|original-six|16.67 / 16.70 / 16.80 / 16.90|8.42 / 7.90 / 13.40 / 15.30|7.20|693|94056|4178|187|41|
|high|batched-six|16.67 / 16.70 / 16.80 / 16.90|5.66 / 5.40 / 8.60 / 9.60|3.80|202|94032|4662|105|41|
|auto|original-six|16.67 / 16.70 / 16.80 / 16.80|4.83 / 4.70 / 6.10 / 7.10|4.30|639|87496|4178|183|50|
|auto|batched-six|16.67 / 16.70 / 16.80 / 16.80|3.20 / 2.90 / 5.20 / 7.60|2.00|190|87496|4645|105|50|

Near/mid animation remains canonical; opaque pieces share instanced draws. Transparent pieces retain separate sorted proxies. The matching screenshot pair is batch-ab/high-render-parity.png, with additional close-up pairs. Minor triangle/call differences from live pooled impacts can occur between individual observations. The helper regression uses eleven armed canonical pilots:523 original Mesh draws versus66 pool objects,~1.38MiB owned geometry/instance buffers. Source resources remain independent of clones; leaving-pilot/disposal tests pass.

## Moving bot-match and controlled baseline evidence

pg-client-metrics.json holds51 before observations (some preliminary duplicates), pg-client-after-metrics.json holds36 first-optimization observations. Select latest by requestedQuality/label; quality alone mixes Auto and manual Medium. Those matches use real12-pilot botcombat, with active firing/ADS and static ground/interior/aerial cameras. They establish actual gameplay/render load, not exact matching nearby counts.

Controlled before/after metric JSON and companion fixture JSON verify3/6 populations and real hydro-run-north wall-running. The first target-six review sample contained5 and is superseded by the actual player-camera6 samples. The label wall-run-view is a static camera; only wall-run with local.mode=wall-run and wallId=hydro-run-north proves the action. Later baseline actors exhausted their finite actual ammo; those rows are quiet crowd measurements, not active fire. A/B and botcombat evidence must not be conflated.

All CPU windows are bounded240 samples (~4s at60Hz). Short wall-run or fire actions occupy only part of that CPU window. Snapshot/HUD/input/viewmodel/pilots/world/submit categories and raw frame arrays remain in the JSON; do not interpret a mixed CPU window as action-exclusive.

No uncapped FPS improvement, GPU duration, integrated-GPU frame rate or general hardware guarantee is claimed. The measured improvement is reduced CPU/render submission/draw workload while preserving close-pilot fidelity. Broader hardware testing remains valuable.


Nine-view original→first-distance-LOD tables are in CLIENT_SCENE_TABLES.md. client-observations.csv exports all130 retained observations, frame mean/median/p95/p99/FPS and every CPU category. This includes preliminary duplicates and intentionally distinguishes moving-bot, controlled and same-room A/B stages.
