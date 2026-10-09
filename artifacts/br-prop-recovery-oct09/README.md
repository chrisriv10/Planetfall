# Primary district prop clearance — October 9

Continuation from desktop checkpoint `5503890fdaa390dc4bb4569a0263018e961ad1a0`.
The laptop checkout was clean and fast-forwarded; no prior implementation was
reset, restored, stashed or overwritten. No new commit/push/deployment.

The prior landmark audit excluded independent district prop groups. The new
`npm run audit:br-props` imports the actual production world on a blank Vite
page, inspects all nine primary prop groups, and disposes the world/browser.
It runs without a gameplay server or continuous WebGL render loop.

`before.json` is the original production assembly scan: 100 mesh objects,
2,368 individual instances, 183 buildings, eight triangle-surface intersections
and zero page errors. Seven hits are pieces of Nova's two hover taxis occupying
the kiosk/studio envelopes; the eighth is a Thruster rover crossing Pump B.
These are mesh/building pairs, not eight separate vehicles. This supplements
the desktop landmark audit; it does not invalidate its explicitly narrower scope.

The six existing context vehicles now use authored, world-space parking
transforms, full model footprints and explicit deck/hover offsets rather than
POI-center offsets. Four vehicles were relocated and two kept their centers;
orientations were aligned with their aprons. Taxi hulls no longer extend .1m
below the raised Nova deck. Cargo movers retain their .2m hover clearance and
rover skids meet the deck. Physics, sockets, map, gameplay, model construction,
materials, existing instance/object counts and LOD contracts are unchanged.

The first proposed studio placement crossed the existing foreground tree in
the actual screenshot; a proposed cargo position crossed a test-instrument
pocket. Those drafts were rejected. The final tests additionally reserve the
existing district/Nova prop pockets, full tree canopies and other vehicles.

`after.json` verifies every final production model fits its tested envelope,
all six measured ground gaps match, and all primary prop/building pairs clear:
zero broad-phase candidates, zero flagged intersections, zero page errors.
The audit excludes sprites, interiors, secondary/roadside props, players and
landmarks; it is a static surface check, not a full collision/volume proof.
Prop-pocket/road/socket tests complement it, but do not certify every world mesh.

## Screenshot review

Four matched views were captured and inspected: Nova kiosk apron, Nova studio
apron, Thruster pump apron and Dock service apron. The final vehicles are outside
the buildings, away from their approaches and clear of the foreground tree.
`before/` reconstructs only the six documented old parking transforms on the
current production world, as explicitly recorded in its JSON. It does not reset
source or gameplay state. `after/` renders the final production transforms.

These are static 960×540 production-world renders with BR lighting and normal
materials, without the gameplay HUD, sky, shadows or bloom. No game simulation
or animation loop runs. They are geometry/composition evidence, not final High
quality screenshots, a human playtest or measured FPS. `review.json` retains
draw calls, triangles, textures and visible instance counts for each view.
Those numbers are not directly comparable to full gameplay/bloom statistics.

Repeat with the local Vite client running:

```powershell
npm run audit:br-props -- artifacts/br-prop-audit/report.json
node tools/br-prop-review.mjs artifacts/br-prop-audit/views
```

## Validation and remaining work

Root typecheck passed. Focused tests passed **28/28 across six files**, including
six new placement checks and existing district props, Nova streetscape, facade,
Nexus crown and wreck engine contracts. Root production build passed with the
existing chunk warning. `git diff --check` passed. The full unit suite, E2E,
40-player performance profiles and human gameplay acceptance were not repeated
for this presentation-only step; desktop results are historical, not new passes.

The whole-island pass remains open. These existing vehicles remain decorative
and noncollidable, so they must not be treated as reliable combat cover. Their
cover/collision language needs a separate authoritative decision and validation.
The reviewed Nova ARCADE billboard is still partly occluded by the facade:
POI-relative context signs need their own mounting/visibility review. Secondary
props, interiors, broad plaza composition and human control feel also remain
outside this checkpoint. Nothing here certifies final art/gameplay acceptance.
