# North Civic occupied street checkpoint — October 9

Continued on DESKTOP-JL99F36 from the current local working tree at `d64d771`.
The previously authored Coolant frontage and loot-floor correction are preserved.
No reset, restore, stash, commit, push or deployment was performed.

## Connected layout and preservation

The saved North Civic view at `(-20,2.7,180)` and density audit confirmed a
large empty approach between Zero Point and the mall. Two appended, enterable
buildings now face a six-metre through-street at x-15: a two-floor archive
`(-44,0,155)`, 22x24m and 9m high; and a one-floor exchange `(0,0,155)`,
18x20m and 6m high. Walls, raised floor slabs, roof, room partitions, the
archive's internal incline and five new loot sockets are authoritative.
Neither building adds an exterior roof ramp.

The street connects Zero's z58 perimeter along x-5 to z86, then bends to
`(-15,104)` and continues to z170, with a diagonal link ending at `(-5,184)`
and a short level arrival at the existing mall corner `(-5,190)`. The first
physical experiment joined diagonally straight to that corner and clipped the
edge of the existing graded west road. Its retained failed test log documents
the defect. The final tangent arrival passes the unchanged support threshold
in both directions; the old mall grade is unchanged. The archive's initial
reverse test route crossed a real interior partition. Its corrected route
uses the actual opening, without removing the partition or changing movement.

The draft x-25 route conflicted with the established exchange garden pocket.
The first x-19 revision cleared individual pieces but failed existing whole-pocket
clearance tests. Moving the frontage to x-15 and routing the southern entry
around cover-20 preserves both the garden and Zero's north service apron at
their unchanged required clearance. No existing clearance limit was weakened.
`preservation.json` compares against the **pre-North-Civic local map including
Coolant**, rather than only the older Git checkpoint: all 187 existing buildings,
276 loot sockets, 22 crate sockets, 322 road segments, 239 routes, 18 terraces,
1,705 collision blocks, 66 trees and 46 bridge piers are exactly preserved.
New totals are 189 buildings, 281 loot sockets, 327 roads and 1,729 blocks.
Counts describe the checkpoint; they do not establish composition quality.

Existing derived connective filters change some decorative placements when
new street reservations are present. `connective-placement-delta.json` records
one omitted roadside pocket at `(0,70)`, one omitted micro-cluster
at `(-30.2,104.5)`, and one omitted flush maintenance strip at `(-28,72.5)`.
The rendered connective count falls from 1,010 to 965 instances. All 325 grove
parts, all authoritative greenway trees and the literal garden pocket remain.
These are derived presentation changes, not silently deleted map collision.

## Presentation and visual evidence

Astra implemented the isolated `br-north-civic-frontage.ts` helper; Sol reviewed
and integrated it into the existing Void Mall detail/LOD group. Sixteen borrowed
box parts provide flush, narrow entry aprons and small cyan/purple plaques on
measured solid facade intervals. The helper adds no lights, resources, opaque
freestanding cover or collision exceptions. Its four tests check the actual
facade skin/door parts, roads, nearby shells, sockets and garden pocket.

`blockout/`, `final/` and `revised-final/` retain intermediate/rejected captures.
`accepted-layout/` contains seven static actual
production-world views after integration, with zero page errors. These omit
HUD, player, sky, bloom and shadows and are not FPS or gameplay acceptance.
Both agents reviewed the final set. No concrete doorway/plaque overlap was
found. The archive facade is still dark and broad, the buildings retain familiar
shell/roof language, and pavement joins remain visually angular. The exchange
plaque is cropped from its close view and the upper static camera is too cramped
for complete interior acceptance. Those limitations remain open.

`facades-final.json` checks 189 envelopes, 17,766 building pairs and 27,680 facade
parts, with no flagged intersections. `primary-final.json`, `secondary-final.json` and
`connective-final.json` check their documented separate prop-to-envelope scopes;
all pass. These scopes overlap, exclude unrelated prop-to-prop/player contacts,
and are not a certificate that every map mesh is clear. `density-final.txt`
remains a geometric diagnostic, not a decoration quota.

## Actual player/camera and loot review

The final `live-final/playthrough.json` passes 34 route legs through the production client,
HUD, camera, networking and authoritative simulation. It covers the garden
verge, both doors, ground circulation, the archive's real internal incline in
both directions, upper room circulation, mall continuation and return to Zero.
Three weapons are collected, dropped through the actual inventory UI and
recovered with E. Oblique upper-deck and exchange screenshots show the dropped
models and their rings above their supporting floors. No page errors occurred.
The run records 68 trusted mouse and 380 trusted key events with pointer lock.
The initial x-19 experiment remains in `live-first/` with its original 30-leg scope.

This automated native-input review uses one explicitly recorded initial
server-side pilot placement and seed 901337 in an isolated match. All later
travel, camera control and inventory actions use browser input. It is not human
control-feel/art acceptance, and does not prove the normal ship-drop route to
these buildings. Brief ungrounded samples are allowed only during the existing
.36m doorway descent, within .44m of the deck, with measured support and a
grounded final arrival; all other travel must remain grounded.

Repeat with a Vite client on 15174 and
`VITE_SERVER_URL=http://127.0.0.1:13001`, then run:

```powershell
$env:SPATIAL_SITE='civic'
$env:SPATIAL_OUTPUT='artifacts/br-north-civic-oct09/new-live-run'
node --import tsx tools/br-active-spatial-review.mjs
```

The tool owns and closes its isolated server/browser and does not alter a normal
local match. Default Dock–Engine and `SPATIAL_SITE=coolant` routes are preserved.

## Validation and remaining work

The intermediate integrated focused run passes 78 tests across five files;
the final rerouted layout passes 41 focused tests including the two existing
clearance files. Fresh typecheck and build pass; the existing bundle-size warning
remains. The final full suite passes **970/970 across 175 files in 151.76s**,
including all five unchanged 10/20/40-player authoritative performance cases.
Those budgets profile in-process production-rate simulation and snapshots with
hard bots, rather than forty connected browser clients. Full E2E passes
**11/11 in 5.6 minutes**, including BR Starliner/Solo, Classic raid/cannon play,
Chaos and the six-player visual budget. No source edits or concurrent render/unit
jobs occurred during E2E. No historical timeout reproduced; its underlying
cause remains unproven. `validation.json` records these results and limits.
`source-manifest.json` identifies the exact
source being validated.
The prior Coolant/loot evidence remains under `br-active-recovery-oct09/` with
its own earlier source hashes; it is not relabelled as the new source snapshot.

Whole-island recovery is unfinished. Continue distinct architectural massing,
usable interior identity, readable elevation, lighting and smoother-looking
joins; inspect new ground views before selecting more gaps. The remaining rim
and south density samples are not automatically errors. Preserve authoritative
collision/visual agreement, shared astronaut, Classic/Chaos isolation and all
existing test/performance limits. No human acceptance is claimed.

The first full regression passed 968/970 tests; two existing whole-pocket
clearance tests rejected the x-19 lane. The final routed x-15 layout passes
41/41 focused tests covering both unchanged pocket tests, parcel contracts,
presentation clearance and bidirectional authoritative/predicted traversal.
Earlier renders and live-first evidence are intermediate source snapshots.

Final source hashes were verified for all 342 manifest entries after E2E.
`git diff --check` passes. The ordinary local preview is restored on 5173/3000
after validation; isolated review/E2E servers and browsers are closed.
There is no new commit, push or deployment.
