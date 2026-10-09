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
