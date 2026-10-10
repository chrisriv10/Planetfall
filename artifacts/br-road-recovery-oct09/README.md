# Supported road curves checkpoint — October 9

Continued on DESKTOP-JL99F36 from the current local working tree at `d64d771`.
All prior Coolant, North Civic and loot-floor work remains local and uncommitted.
No reset, restore, stash, commit, push or deployment was performed. Project-local
Sol/Astra configuration is preserved.

## Reviewed problem and change

The North Civic walkthrough and saved mall views showed rectangular oblique
elbows and disconnected curb strips. Isolated presentation work was delegated
to Astra; Sol reviewed the partial helper changes, completed collision-clearance
checks and tests, and integrated the renderer change.

`br-road-bends.ts` now builds tangential inner fillets and circular outer edges
at supported two-arm level joins, including oblique bends. Tangent reach is
bounded to 45% of the shorter leg. Original full-width road ribbons, centerlines,
widths, slopes, map blocks and navigation remain unchanged. Curbs and cyan edge
segments use existing borrowed geometry/material batches; no new lights,
colliders or per-frame construction work were introduced.

`br-road-detail.ts` permits continuous markings only around a supported local
elbow between the same two routes. Doorway masks, true branches, other crossings,
grade seams and width mismatches retain their clearance rules. The marking
helper trims inside curb strips to the corresponding tangency while preserving
whole-route station spacing.

Added pavement polygons are checked against complete structure and solid
footprints, other grade ribbons and sampled support interiors. An initial
partial patch exposed an existing decorative cap at `(340,-275)` inside the
raised freight platform: the region-height sampler alone reported ground under
that solid. The corrected full-footprint checks omit this cap. The existing road
and platform are preserved. The mall join at `(-5,184)` is also excluded because
its candidate curve overlaps the nearby grade ribbon. This checkpoint does not
make those graded or retaining-edge joins round.

Twenty-seven supported bend additions remain. Production construction caches
immutable-map results and returns independent copies, so repeated consumers do
not repeat the heavier checks or share mutable point arrays. Local construction
probes measured approximately 514ms cold and 0.1ms warm; these are construction
microtimings, not FPS, startup-budget or GPU-memory acceptance.

## Evidence and validation

`validation.json` records final full-suite/E2E results and verified source hashes.
`preservation.json` compares with the previous local North Civic source manifest:
334 of its 342 source files are byte-identical; eight intentional presentation,
test, integration and review-tool files changed, and two files were added.
All shared/server production files, Classic/Chaos code, loot placement and the
Coolant/North Civic frontage helpers remain unchanged. The map hash is identical.
`working-tree-before.patch` and `status-before.txt` preserve the starting diff.

- Fresh `npm run typecheck` and `npm run build` pass. The existing bundle-size
  warning remains; no threshold was changed.
- Focused road, marking, authoritative-support and North Civic traversal checks:
  49/49 tests across six files. `focused-final.log`.
- Fresh full suite: 980/980 tests across 176 files in 156.65s.
  `full-suite-final.log`. This includes all five unchanged 10/20/40-player server
  cases (40-player identity offsets 0, 1000 and 5000). Limits remain average tick
  <16ms, p95 <45ms, worst <150ms and maximum snapshot <160,000 bytes. These
  simulate authoritative ticks and snapshots, not forty browser clients.
- The new authoritative support test raycasts pavement vertices, fillet interiors
  and full curb footprints against actual Rapier geometry, with >1,000 samples.
- The active route review passes 12 route legs, Zero Point to the mall and back,
  with the production player/camera/network active: 17 trusted mouse events,
  218 trusted key events, no page errors, every captured client/server sample
  grounded. One initial authoritative fixture placement and fixed seed 901337
  are disclosed in `live/playthrough.json`; no later movement teleport is used.
  This road-only walkthrough has no pickup cycles. The prior 34-leg/three-cycle
  North Civic evidence retains its original scope.
- `cleanup.json` passes high/low production-world assembly disposal checks:
  198 geometries, 361 materials, 134 textures and 1,511 instance batches release
  exactly once; borrowed global Sprite geometry is retained. This does not measure
  WebGL memory or prove every unreachable library resource is freed.

Fresh browser E2E passes 11/11 in 5.7 minutes with `npx playwright test --workers=1`, isolated test servers
and no concurrent render/unit jobs. Its final result is recorded in
`validation.json` and `e2e-final.log`. Successful per-case console output is
suppressed by the default Vitest reporter; no fabricated performance metrics
are supplied.

## Screenshot review and remaining work

`before/` has five matching pre-change cameras; `draft/` retains intermediate
views; `final/` has six final static world cameras and their render inventory.
Static views have normal world materials/BR lighting but no player, HUD, sky,
bloom or shadows. Render inventory is not live FPS. `live/` contains the active
production camera captures.

The Zero entry, Civic link and Coolant right-angle views show smoother visible
level curbs. Mall arrival/grade-meeting views still show abrupt angular joins;
those need a deliberate geometry/grade design. The freight-boundary camera is
wall-dominated and is insufficient composition acceptance. No whole-map art or
human gameplay acceptance is claimed.

The archive still has dark massing, shell/interior language remains repetitive,
and the mall arrival remains broad and weakly composed. Continue architecture,
usable interiors, meaningful elevation, lighting and street-facing composition
from ground-view-confirmed gaps. Do not treat counts or green tests as completion.

Reproduce the active road review with an isolated Vite client on 15174 pointed
at server 13001, then:

```powershell
$env:SPATIAL_SITE='roads'
$env:SPATIAL_OUTPUT='artifacts/br-road-recovery-oct09/live'
node --import tsx tools/br-active-spatial-review.mjs
```

The harness owns/closes its browser and server. Save a new output directory for
subsequent iterations rather than overwriting these accepted-source captures.
The review JSON is `tools/br-road-recovery-review-views.json`. Local Node 22 is
required, as recorded in the existing desktop handoff.

