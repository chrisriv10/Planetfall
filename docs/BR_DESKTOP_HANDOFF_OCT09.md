# Desktop continuation handoff — October 9, 2026

This is a tested transfer checkpoint, **not completion of the whole pass**.
The preceding laptop checkpoint is `68fda42` (prop placement, supported signs
and world teardown). The user authorized committing and pushing this next
checkpoint to continue on the desktop. No deployment was performed.

## Current task

Recover Orbital Isle's spatial foundation from the actual local working tree.
Do not return to random decoration or count-based density claims. Priorities:
connected streets through districts, occupied street-facing blocks, meaningful
elevation, usable entrances/interiors, fewer exterior ramps, geometry/collision
agreement and good ground-level composition. Preserve the approximately 1000m
island, working BR systems, shared astronaut and Classic/Chaos separation.

Read `AGENTS.md` first. Sol owns shared/server/physics/gameplay/mixed integration
and validation. Delegate isolated presentation to the configured `visuals`
Astra agent. Inspect local changes before fetching/updating anything; never
reset, restore, stash or overwrite unrelated work. Do not push or deploy again
unless explicitly instructed.

## Latest changes

- Extended `tools/br-prop-audit.mjs` with separate `--secondary` and
  `--connective` scopes. Baseline checks covered 43 secondary/transition groups
  and four connective groups against building envelopes. No conflicts were
  flagged within those scopes; this does not certify every visual mesh.
- Reviewed six static production-world ground/interior views. Central Heights,
  Transit Court and Comet Hotel were usable but still need art refinement.
  Coolant East `(50,100)`, North Civic `(-20,180)` and Industrial South
  `(320,-180)` showed large, flat foreground gaps.
- Added two real enterable Engine Gate approach structures: workshop
  `(318,0,-198)`, 16x18m footprint/6m high, and relay `(318,0,-162)`,
  16x16m footprint/8m high. Both face east with normal 4.8m doorways,
  authoritative walls/floors/roofs, interiors and two loot sockets each.
  Neither adds an exterior roof ramp. Existing structure ordering/positions
  are preserved; new structures append to `BR_STRUCTURES`. They belong to
  the southern Thruster Works approach, not the compact Engine Gate secondary
  plan 87m east. A broader test caught the draft's incorrect secondary-plan
  assignment; the existing Engine Gate origin, three parcels, streets and
  open yard remain unchanged. No parcel-distance limits were weakened.
- Added `engine-gate-approach-through`: the existing x340 road now continues
  from z-180 to the southern district ring at z-130 instead of stopping.
  The two buildings leave a 10m setback from the eight-metre roadway and
  an open shared court at z-180. The sampled former 55.6m enclosure gap now
  has a building footprint 9m away (the second is 10m away).
- Astra implemented `br-engine-gate-frontage.ts`: 29 borrowed-material box
  parts for short pedestrian aprons/markings and facade-supported plaques.
  Sol integrated this into the existing Engine Gate secondary detail/LOD
  group in `br-world.ts`. An initial apron clearance failure was fixed by
  shortening/repositioning the apron, not weakening the test.

Current data: **185 structures, 103 enterable, 271 loot sockets,
39 secondary locations, 320 road segments**. Counts are diagnostic, not
evidence of a finished world.

## Validation and evidence

- Root `npm run typecheck`: passed.
- Root `npm run build`: passed; existing large Three/Rapier bundle warning.
- Final integrated focused run: **121/121 tests across 18 files**, 17.53s. Includes
  new shared parcel/road tests, eight forward/reverse authoritative/prediction
  road/door/court traversal tests, three presentation tests, existing parcel
  overlaps, loot distribution/clearance, trees/supports, road/connective kits,
  shared gameplay/map contracts, crates and tactical-map presentation. Exact
  structure count expectations were updated for the two intentional additions;
  circulation, road overlap and parcel-distance assertions were kept intact.
- An earlier seven-file run passed 30 tests but timed out the greenway support
  test after an abnormal 2517.63s wall time. Its isolated rerun passed 1/1
  in 4.04s and the integrated 48-test rerun passed unchanged. Root cause of the
  abnormal delay is not established; do not label it a fixed gameplay bug.
- Building/facade audit: 185 envelopes, 17,020 pairs, 27,205 facade parts;
  zero flagged building or facade intersections. Final primary (9 groups),
  secondary/transition (43 groups) and connective (4 groups) prop audits passed.
- Five integrated fixed-camera screenshots reviewed: matched Industrial South
  gap, paired frontage, both doors and workshop interior. Openings, short aprons
  and wall plaques appeared clear. The court now has physical enclosure rather
  than a mostly empty horizon, but silhouettes/interiors remain fairly basic.
- Static High renders: 183–438 draw calls, 247,602–306,236 triangles,
  17,762–21,833 visible instances, 288 world material references. These are
  one-shot world-only renders without players, sky, HUD, bloom or shadows:
  **not FPS or human-playability measurements**. Matched original gap view rose
  from 152 calls/194,861 triangles to 183/247,602; added enclosure has a cost.
- Fresh full-suite, E2E, 40-player performance and human gameplay were **not**
  run for this transfer checkpoint. Earlier full-suite worker-start failure is
  recorded honestly in `BR_SPATIAL_CHECKPOINT_OCT08.md`; it was not a green run.

Commands and screenshots: `artifacts/br-secondary-recovery-oct09/README.md`.
Preview/test processes are stopped after checkpoint validation.

## Continue next on desktop

1. Inspect current local status/diff and this checkpoint before making changes.
2. Re-run focused geometry/loot/navigation checks; use desktop resources for
   fresh full unit/integration, E2E and 10/20/40-player validation. Investigate
   any timeout without increasing limits simply to get green.
3. Actually play through the new road and doors with loot/player/camera active;
   static shots and physics tests do not replace this acceptance step.
4. Use `npm run audit:br-density` to choose the next **ground-view-confirmed**
   gap, not mass scatter. Remaining candidates: `(-70,-460)` 58.5m,
   `(460,-110)` 57.2m, `(-410,230)` 55.1m, `(-20,180)` 53.9m,
   `(10,-340)` 51.2m and `(50,100)` 51.1m from real building/cover footprints.
   North Civic/Coolant East have reviewed sparse ground views already.
5. Plan roads -> occupied parcels -> entrances -> pedestrian lanes. When
   cover/buildings are needed, author real authoritative solids and loot;
   Astra may dress those solids but must not invent noncolliding opaque cover.
6. Continue screenshot iteration on silhouettes, interior identity, lighting,
   elevation and district transitions. Current blue workshop boxes are a
   safer occupied checkpoint, not final art acceptance. Do not claim 100%.

## Relevant files

`shared/src/battle-royale/map.ts`, `engine-gate-approach.test.ts`;
`server/src/modes/battle-royale/br-engine-gate-approach.test.ts`;
`client/src/modes/battle-royale/br-engine-gate-frontage.ts` and colocated test;
mixed integration `br-world.ts`; `tools/br-prop-audit.mjs`,
`br-secondary-review-views.json`, `br-engine-gate-review-views.json`.

## October 9 local continuation — Coolant frontage and loot support

The local desktop checkout was clean and updated from `5503890` to `d64d771`
by fast-forward only. The continuation remains uncommitted and unpushed.
Existing local routing/runtime configuration is preserved.

Dock–Engine's road, doors and loot were exercised with the actual player,
camera, networking and trusted browser input. The next confirmed gap was
Coolant East: two opposing enterable buildings now enclose a connected street,
with an internal upper floor, real collision and loot. All established map
objects, 66 trees, bridge piers and the Transit basin are preserved exactly.
North Civic and the other ground-view-confirmed gaps remain open.

The reported floor-phasing defect is addressed in authoritative loot support
queries and geometry-derived presentation grounding. Generated items, inventory
drops and crate scatter now resolve real floor/slab/ramp heights. Far markers
stay above support as they scale. Inventory buttons remain attached across
movement snapshots so ordinary clicks can complete.

The final automated live checks pass 21 Coolant and 11 Dock–Engine route legs,
including stairs in both directions and five inventory drop/recovery cycles.
They use one initial fixture placement per site and are not human acceptance.
Fresh typecheck/build and 949/949 unit/integration tests across 172 files pass,
including the unchanged 10/20/40-player authoritative server budgets. E2E
results, logs, screenshots, preserved failures and precise evidence scopes are
recorded in `artifacts/br-active-recovery-oct09/README.md` and `validation.json`.

Continue architecture, usable interiors, meaningful elevation, lighting and
ground-level composition. Do not treat passing automated tests or additional
object counts as whole-island or human gameplay acceptance.
## October 9 local continuation — North Civic street and interiors

Continued from the current local Coolant/loot working tree on DESKTOP-JL99F36.
All existing map data and prior improvements remain; no reset, restore or stash
was used. North Civic now has opposing enterable archive/exchange buildings,
a collision-backed upper floor and internal incline, five appended loot sockets,
and a connected lower street between Zero Point and the mall's level corner.
The route bends around existing solid cover and preserves the literal garden
and service pockets at unchanged required clearance. All 66 authoritative trees,
old roads/grades, existing sockets, collision blocks and bridge piers remain.

The initial full regression passed 968/970; two existing pocket-clearance tests
rejected a straight lane. The geometry was rerouted, without weakening tests.
The revised focused run passes 41/41 including those tests and both-direction
traversal/parity. Fresh validation evidence and source hashes are recorded in
`artifacts/br-north-civic-oct09/README.md` and `validation.json`. Earlier x-19
renders/live-first evidence are intermediate and retain their original scope.

Whole-island art/playability acceptance remains open. New static and active
views still show generic shell language, dark archive massing and angular mall
pavement/stripe joins. Continue architectural/interior identity and ground-level
composition; use confirmed views rather than filling all density samples.
Automated native input and tests are not human control-feel acceptance. This
continuation remains local and uncommitted; no push or deployment is authorized.

Final North Civic validation: fresh typecheck/build pass; 970/970 tests across
175 files pass in 151.76s, including all five unchanged 10/20/40-player server
performance cases. Full E2E passes 11/11 in 5.6 minutes. Final native-input
walkthrough passes 34 route legs and three pickup/drop/recovery cycles, with
68 trusted mouse and 380 trusted key events and zero page errors. One initial
fixture placement is recorded; this is not human acceptance. All 342 source
manifest hashes were verified after E2E. The ordinary 5173/3000 preview is
restored; review/E2E servers are closed. No new commit, push or deployment.

## October 9 local continuation — supported road curves

Continued on DESKTOP-JL99F36 from the current North Civic/loot working tree.
All shared/server production source, map geometry, Classic/Chaos code and prior
loot/frontage helpers are unchanged from that local checkpoint. Isolated
presentation work was delegated to Astra; Sol reviewed/completed the helper
changes, authoritative support checks and mixed renderer integration.

Supported level two-arm bends now have tangential inside fillets and circular
outer curb edges, including oblique turns. Road widths, centerlines, slopes,
collision and navigation remain unchanged. Doorway and real-junction marking
clearances remain enforced. Full polygon checks exclude unsupported additions,
grade ribbons and raised solids. The freight deck edge at `(340,-275)` and
mall's grade-adjacent join at `(-5,184)` are intentionally not rounded by this
presentation pass; they still require deliberate geometry/composition work.

Fresh typecheck/build and 49 focused checks pass. Full unit/integration validation
passes 980/980 tests across 176 files in 156.65s, including all five unchanged
10/20/40-player authoritative performance cases. The active production player,
camera and network walkthrough passes 12 road legs, Zero Point to mall and back,
with 17 trusted mouse events, 218 trusted key events and no page errors. Every
captured client/server sample is grounded. One initial fixture placement is
recorded; this is automated input evidence, not human gameplay acceptance.

Resource cleanup checks pass for high/low world assemblies. Before/after static
views and the active camera captures are in `artifacts/br-road-recovery-oct09/`.
`README.md` and `validation.json` record exact scopes and final browser results.
Construction caching does not establish live FPS acceptance. Archive massing,
repeated shells/interiors, mall grade joins and whole-island recovery remain
unfinished. No commit, push or deployment was performed.

Final road-checkpoint browser validation passes 11/11 E2E in 5.7 minutes, with
no source edits or concurrent render/unit jobs during the run. All 344 source
manifest hashes were verified afterward. The ordinary 5173/3000 preview is
restored; isolated review and E2E servers are closed. This is a validated local
checkpoint, not completion of the spatial recovery pass or human acceptance.

## October 9 local continuation — North Civic interior identity

Continued on DESKTOP-JL99F36 from the validated road checkpoint's current local
working tree. Shared/server production source, the map, loot support, road
implementations, Classic/Chaos and existing Coolant/North Civic frontage helpers
remain unchanged. Local Sol/Astra configuration is preserved. Astra owned the
isolated identity helper and facade-name extension; Sol reviewed and integrated
these in the mixed renderer and owns final validation.

The archive's four partition bays now have shallow organized data-cartridge
rows and indexed cyan/amber level cues. The exchange's two display bays have
purple guides. Six warm underside LED strips follow actual ceiling slabs. The
complete 96/22-part replacement omits conflicting generic interior/retail kits;
missing/obstructed geometry retains their existing fallback. No freestanding
noncolliding opaque cover, new gameplay solids or dynamic lights were added.
Two supported roof-cap crests identify CIVIC ARCHIVE and ORBIT EXCHANGE; the
prior 43 names/omission decisions are preserved.

The integrated focused run passes 65/65 checks across nine files, including
1,062 actual Rapier mount-support samples and bidirectional North Civic routes.
Production assembly matches all 118 identity parts exactly once and excludes
the prior helper's 48 archive/50 exchange parts. All 45 names, 25 mounted labels
and 175 mount boxes pass the production sign audit. High/low cleanup checks pass;
two sign material/texture resources and one populated amber batch are the
recorded resource increase, with no new geometry. Static metrics are not FPS.

The first native-input review passed 24 legs and all three drop/recovery cycles,
then failed its unchanged progress assertion while still moving on open ground.
An isolated trusted cursor probe reproduced stale review-harness mouse-coordinate
bookkeeping after inventory/pointer-lock recenter. Synchronization and extra yaw
observations were added without changing game input, assertions or deadlines.
The complete rerun passes 34 route legs, three pickup/drop/recovery cycles,
64 trusted mouse and 383 trusted key events, and zero page errors. This does not
diagnose earlier unrelated E2E timing failures or establish human acceptance.

Eight final static cameras and live captures, original failed evidence, exact
preservation, source hashes and final regression results are recorded in
`artifacts/br-civic-identity-oct09/README.md` and `validation.json`. The archive's
overall dark rectangular massing, repeated exterior shells, white partitions,
large openings and mall grade joins remain unfinished. Continue actual
architecture/composition rather than scatter or part-count goals. No commit,
push or deployment was performed.

Final North Civic identity regression results: typecheck/build pass, 991 tests
across 178 files pass in 156.73 seconds, and all 11 E2E checks pass in 5.6
minutes. The original five 10/20/40-player performance cases and limits are
unchanged and pass. All 349 captured source hashes and both local routing
hashes were verified against these results. Ordinary development preview is
restored at localhost:5173 with healthy server 3000; isolated review ports
13000/13001/15173/15174 are closed. The Git index remains empty and the diff
whitespace check passes. No commit, push or deployment was performed.

## October 10 whole-island spatial contracts and final validation

Continued on DESKTOP-JL99F36 from the preserved current dirty working tree.
The large island, shared astronaut, authoritative systems and Classic/Chaos
isolation remain intact. Coolant/North Civic and the Dock–Engine improvements
are preserved. All 185 checkpoint structures and 271 checkpoint loot positions
remain unchanged; four structures and ten sockets append. No reset, restore,
stash, commit, push or deployment was performed.

Recovered full-width district road grades, supported joins and crossing heights;
all ten usable roof accesses; real doorway collision headers; interior partition
clearance and landings; exact rotated support queries; supported loot generation,
drops and presentation; and long-tick stair contact on authority and prediction.
Presentation now has measured doorway/interior finishes, district neon, corrected
neighboring awnings/Comet skins and specimen trees scaled against the actual rig.

The authoritative audits cover 912 road/entrance routes, 945 intersection routes,
20 roof-access traversals, all 107 interiors/271 non-roof loot routes in both
directions and 780 production walking/sprinting stair traversals. Actual native
input covers all nine primary POIs plus final Coolant 23-leg and Civic 34-leg
walkthroughs, each with three drop/recovery cycles and zero browser errors.
Primary, entrance, secondary, roof, gap, tree-scale and final alley screenshots
were reviewed. Scope and limited camera views remain explicit.

Frozen final validation passes typecheck/build, 1,009 tests across 184 files,
11 E2E checks and all five unchanged 10/20/40-player server performance cases.
Six production prop/landmark/sign/cleanup audits pass. All 372 source hashes and
both ignored local routing hashes match afterward. The index remains empty.
Ordinary preview is healthy at localhost:5173/server3000; isolated ports closed.

Full evidence, source manifests, native input, preserved failures, performance
numbers and limits: artifacts/br-pass-completion-oct09/README.md and
validation-final-v4.json. The existing Classic rematch fixture had another
intermittent timeout before an unchanged isolated and whole-suite rerun passed;
no deadline, assertion, budget or gameplay condition was weakened. A green rerun
does not repair its reliability. Human final art/control-feel acceptance remains
open; automated evidence cannot guarantee every possible view/contact. Do not
reset this local work or push/deploy without a new explicit instruction.
