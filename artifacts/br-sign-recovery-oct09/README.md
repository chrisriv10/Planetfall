# October 9 — building-mounted signs and instance teardown

The incorrect Nova context billboards were attached to POI-relative offsets,
not their named buildings. The ARCADE sprite penetrated the studio facade and
displayed only part of its text. Six duplicate context sprites have been removed.
The existing district titles remain.

Named low-rise buildings now receive a supported fixed-plane roof-cap crest on
the solid frontage wing, clear of entrances, roof-access ramps and roof loot.
The sign catalog preserves 43 names: 23 mounted labels and 20 explicit omissions
(18 high roofs and two narrow frontages). Omitted buildings retain their existing
district-level wayfinding. The seven support pieces per sign reuse existing
unit-box/material instance batches, rather than individual meshes or lights.
Authoritative geometry, loot positions, roads and gameplay were not changed.

Six matching before/after production-world renders were inspected: Nova studio,
cafe, arcade and market, Dock hangar and Solar Service. The wrong studio billboard
is absent; actual named storefronts have readable, outward-facing supported signs.
The hangar crest is partly outside the chosen close camera frame, not clipped
into a building; its production position/normal/mounts are separately audited.
These are static views without gameplay, HUD, sky, bloom or shadows. They are not
a human playthrough or certification of the whole island's art quality.

Across those same fixed views, draw calls change from 211–533 to 211–529, with
229,365–462,917 triangles after the change. Distinct mesh materials reported by
the world fall from 307 to 288; instance count rises by exactly 161 support parts.
The renderer's texture counter is cumulative across the six camera renders;
do not interpret it as a per-view visible texture count. No FPS claim is made.

Production audit scope:

- `signs.json`: 43 named entries, 23 real labels, all 161 support pieces at their
  expected absolute elevation, correct outward normals and depth-tested materials;
  no label/building intersections or leftover context sprites.
- `facades.json`: 183 buildings, 16,653 envelope pairs, 27,061 facade parts;
  zero flagged building or glazing intersections.
- `props-regression.json`: preserves the preceding six-vehicle parking fix;
  nine prop groups, 100 mesh objects and 2,368 instances clear building envelopes.

A separate teardown reproduction found 1,462 of 1,466 production instance batches
never dispatched their required disposal event. Disposing geometries/materials
does not release Three.js's per-object instance buffers. World teardown now
disposes helper-owned batches first, then remaining root batches, and clears its
detail-group references. `cleanup-before.json` retains the failure;
`cleanup-after.json` verifies two fresh High/Low assemblies release all reachable
1,466 batches, 198 owned mesh geometries, 360 materials and 134 mapped textures
exactly once, even when disposal is called twice. Three's global sprite quad is
borrowed and deliberately retained for other scenes. This event-contract audit
does not measure GPU heap usage or exercise audio/socket/player teardown.

Repeat with only the client Vite preview running:

```powershell
npm run audit:br-signs -- artifacts/br-sign-recovery-oct09/signs.json
npm run audit:br-props -- artifacts/br-sign-recovery-oct09/props-regression.json
npm run audit:br-cleanup -- artifacts/br-sign-recovery-oct09/cleanup-after.json
node tools/br-prop-review.mjs artifacts/br-sign-recovery-oct09/after --cameras=tools/br-sign-review-views.json
```

The baseline screenshots cannot be regenerated from final source without
reconstructing the previous sign assembly; the working tree was never reset.
The facade audit requires no preview: `npm run audit:br-overlaps`.

Focused validation: 35/35 frontage tests across seven files and 1/1 world-lifetime
test. No assertion, geometry budget, performance threshold or timeout was weakened.
Root typecheck and build pass with the existing chunk-size warning. The full
unit/integration command is **not green**: 897 tests in 163 files passed, but
Vitest timed out starting its worker for the unchanged server Solar Service
file (4,142.96s reported duration). That file passes 8/8 alone in 1.90s. This
accounts for 905 tests across two runs, not one successful full-suite run. The
worker-start failure's underlying cause remains unconfirmed; it is not an
assertion failure in a running Solar Service test. E2E was not run for this
checkpoint. The client preview and full-suite process are stopped.
Independent/secondary prop clearance, decorative vehicle cover semantics,
interiors, integrated camera/control feel and broader screenshot acceptance
remain open. This checkpoint is not completion of the overall requested pass.
