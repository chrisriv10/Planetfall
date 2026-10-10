# North Civic interior identity checkpoint — October 9

Continued on DESKTOP-JL99F36 from the current local road/North Civic/loot
working tree at `d64d771`. No reset, restore, stash, commit, push or deployment.
Ignored project-local Sol/Astra configuration is preserved.

## Scope and result

The saved archive ground/upper views showed repeated generic instrument panels
and little distinction between the new office and nearby buildings. This step
refines the already usable collision-backed spaces; it adds no new parcels,
roads, walls, stairs, floors, furniture collision or loot positions.

Astra implemented `br-north-civic-identity.ts` and its focused tests; Sol reviewed
the helper, integrated the complete replacement in `br-world.ts`, and owns
all authoritative support, live-input and regression validation. The archive
has four partition-mounted indexed archive bays across its two storeys; the
exchange has two partition-mounted display bays. Cyan lower-level and amber
upper-level archive cues, purple exchange guides, and six warm underside LED
strips use existing materials and box geometry. They are bright surface cores,
not additional physical light sources.

The first draft still looked like blank office rails. The final archive adds
organized cartridge rows and small index cores within the same shallow skin:
96 archive parts and 22 exchange parts, maximum wall projection <0.13m.
These counts describe implementation, not spatial/art quality. There is no
freestanding noncolliding opaque cover. Every part references its actual wall,
floor or ceiling slab. Incomplete/obstructed support returns an unsupported
result; the renderer retains generic dressing for that fallback. Supported
replacements omit the old generic interior kit and duplicate exchange retail
kit while preserving the established floor/ramp surfaces and other buildings.

`CIVIC ARCHIVE` and `ORBIT EXCHANGE` use the established outward-facing supported
roof-cap sign path. The prior 43 sign names and omission decisions are unchanged:
the new catalog has 45 entries, 25 mounted labels and 175 matched mounting boxes.
No new sign system or label-facing rule was added.

## Validation and preservation

Exact final results are in `validation.json` with source hashes. Source comparison
against the validated road checkpoint preserves all shared/server production
source, map data, loot helpers, road implementations, Coolant/North Civic frontage
helpers and Classic/Chaos code. Seven prior source files change: mixed integration,
facade names/test, three road test files and the native-input review harness. Four additional road regressions
were appended during visuals' resumption; all earlier assertions remain.
Five source/tool files are added. `preservation.json` records the comparison;
`working-tree-before.patch` and `status-before.txt` retain the initial local diff.

- The integrated focused run passes 65/65 tests across nine files, including
  wall/floor/ceiling footprints, missing/obstructed-support fallback, elevation,
  cartridge/rail separation, all prior facade mounts, additional road checks and
  both-direction North Civic collision/prediction traversal. `focused-final.log`.
- The new authoritative support test raycasts nine points on every identity
  footprint against actual Rapier walls/slabs: 1,062 support queries. This
  checks mounted geometry, not player acceptance or every world object.
- `assembly-final.json` imports the actual production renderer. Every one of
  the 118 identity parts is present exactly once with the correct borrowed
  geometry, material and world transform. The prior helper-generated 48 archive
  parts and 50 exchange parts are absent. This does not enumerate every generic
  kit part or certify every scene intersection.
- `signs-final.json` verifies all 45 names, all 25 labels and all 175 mounts in
  actual assembly, including elevation, facing, material and building clearance.
- `cleanup-final.json` passes high/low world teardown: 198 geometries,
  363 materials, 136 textures and 1,512 instance batches release exactly once.
  Compared with the road checkpoint, the two mounted sign labels add two
  material/texture resources, and the newly populated amber batch adds one
  instance batch. No new geometry or dynamic lights. This is resource ownership
  evidence, not measured GPU memory or live FPS.

Fresh typecheck/build, full unit/integration (including unchanged 10/20/40-player
server budgets), full E2E and final source-hash checks are recorded in
`validation.json` and their corresponding logs. Prior green checkpoints retain
their historical source scope and do not substitute for this validation.

## Retained first-run input failure

The first active run (`live/playthrough.json`, `live.log`) passed 24 route legs
and all three drop/recovery cycles, then failed the unchanged 4.5s progress
assertion on the northbound street. Samples show the player remained grounded
and moving while heading away from the target, rather than stationary against
a collision obstacle. `pointer-return-probe.json` reproduces a review-harness
coordinate mismatch: after a native inventory/canvas recenter to x640, moving
to x2100 generates a trusted 1460-pixel look delta while the retained x2000
coordinate would assume 100 pixels. The harness now synchronizes its coordinate
after reacquiring pointer lock and records yaw/input evidence on failures.
No game input, movement, geometry, assertion or deadline changed. The complete
rerun passes. This correction does not diagnose earlier unrelated E2E failures.

## Screenshots and active input

`before/` retains seven earlier North Civic cameras. `before-identity/` has six
matched pre-change identity cameras; `draft/` retains the initial six helper
views. `final/` has the same six final cameras plus two wider full-frontage
cameras needed to show the roof names. The wider cameras have no matching
pre-change image. Static world views exclude player/HUD/sky/bloom/shadows and
are not frame-rate or human-control evidence. All eight final views were reviewed.

`live-final/playthrough.json` and its screenshots record the production player,
camera and network walkthrough with trusted browser input, one disclosed initial
fixture placement and fixed seed 901337. The route exercises both entrances,
archive stairs and upper floor, street/mall connections, and inventory
pickup/drop/recovery. The final result and event counts are in `validation.json`.
This remains automated acceptance evidence, not a human playtest. The final run passes 34 route legs and three pickup/drop/recovery cycles, using 64 trusted mouse events and 383 trusted key events, with no page errors.

The archive is easier to identify and its interior differs from the exchange,
but its overall dark rectangular massing remains. The white collision-backed
partitions, large plaza openings and the mall grade joins still need deliberate
architectural/composition work. The whole-island spatial recovery remains
unfinished; green tests and additional parts do not establish completion.

Reproduce with Node 22 and a running Vite client:

```powershell
node tools/br-civic-identity-audit.mjs artifacts/br-civic-identity-oct09/assembly-final.json
node tools/br-prop-review.mjs artifacts/br-civic-identity-oct09/final --cameras=tools/br-civic-identity-review-views.json
node tools/br-sign-audit.mjs artifacts/br-civic-identity-oct09/signs-final.json
node tools/br-world-cleanup-audit.mjs artifacts/br-civic-identity-oct09/cleanup-final.json
```

Use new output paths when reviewing subsequent source changes. For the live
walkthrough, start isolated Vite on 15174 against server 13001, then run the
existing `tools/br-active-spatial-review.mjs` with `SPATIAL_SITE=civic` and a new
`SPATIAL_OUTPUT`. The harness owns/closes its browser and review server.

Final regression validation passes typecheck/build, 991 tests across 178 files
in 156.73 seconds, and all 11 Playwright E2E checks in 5.6 minutes. The five
existing 10/20/40-player performance cases passed with their original limits.
All 349 source hashes and both local routing hashes match the validated source.
The development preview is restored on 5173 with a healthy server on 3000;
isolated review ports 13000/13001/15173/15174 are closed. The index is empty
and `git diff --check` passes. Work remains local and uncommitted.

