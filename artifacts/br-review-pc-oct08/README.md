# PC spatial review — October 8, 2026

Captured locally on **DESKTOP-JL99F36**, using headed Playwright Chromium at
1280×720, normal High quality, and ANGLE/NVIDIA GeForce RTX 3060/D3D11.
No page errors occurred in these captures. Screenshots are repeatable development
camera evidence, not a human-input acceptance test or controlled FPS benchmark.

- `west-transit-avenue.jpg`: same ground camera as the historical West blockout,
  including the latest forecourt integration.
- `west-junction-frontage.jpg`: the actual south-facing shop doorway; the pale
  paving aligns continuously with the opening. `west-junction.jpg` is the
  site's generic overview from the rear/corner, not doorway validation.
- `solar-service-street.jpg`: actual Solar Service ground street. An initial
  unsupported `solar-rim-service` camera request retained the prior aerial;
  that mislabeled capture was removed and is not used as evidence.
- `south-transfer-approach-before.jpg`: confirmed empty ground approach north
  of the unchanged raised bridge, before Transfer Yard implementation.
- `south-transfer-approach.jpg`: identical camera after the three parcels,
  supported street/court, and isolated entry-walk integration.
- `transfer-yard-street-blockout.jpg` / `transfer-yard-street.jpg`: matched
  normal-height street view before/after the three narrow entry walks.
- `transfer-yard.jpg`: blockout overview. The upper bridge and its Terminal/
  Shipworks decks remain raised; the new street has ground-level entrances.
- `aerial.jpg`: latest integrated whole-island overview. Broad gray gaps,
  repetitive architecture and some large POI surfaces remain visible.
- Nova, Academy and Hotel frontage images preserve current reference views.

The review menu selection matches the latest captures. The first broad capture
used the direct debug function, so its menu caption remained at West Transit
even as the camera changed; those images' camera identities come from the
capture script, not that old caption. Later doorway/street captures select the
actual named menu option. `review.json` contains only the latest two-view
capture's debug states and renderer identity, not all earlier screenshots.

`playability.json` records a separate trusted mouse/keyboard browser smoke using
real pointer lock: 362.4° ship orbit, Space jump/freefall, Ion Wings deployment,
living grounded landing and 363.0° ground orbit. Quarter-turn ship/ground images
and freefall/Ion Wings/landing images come from that run. No page errors occurred.
This is automated browser input evidence; human control-feel acceptance remains
pending. Debug state was observed, not used to set gameplay state.

`server-profile-two-sites.json` contains the earlier five standalone PC profiles with the
original budgets. All passed; largest worst tick was 18.828ms and largest snapshot
was 34,960 bytes. These ran separately with the preview/browser stopped.
`server-profile-transfer-yard.json` preserves the earlier profiles. Final source
validation passed 841/841 tests, typecheck and build; a full E2E run was
10/11 (Classic 220s timeout at Rematch). `final-e2e-failure.log` preserves it, and
`classic-trace-startup-failure.log` records a separate diagnostic startup failure.
Earlier success does not erase the recorded full-suite failure. See
`docs/BR_SPATIAL_CHECKPOINT_OCT08.md` for scope, timings and remaining recovery work.

The subsequent `civic-frontage-street-before.jpg`,
`civic-frontage-street-blockout.jpg` and `civic-frontage-street.jpg` are matched
views of the second ground-gap continuation. Integrated paving visibly connects
the two doorways in frame; the third service doorway is outside that frame and
has geometry/traversal validation only. The latest `aerial.jpg` includes both
Transfer Yard and Civic Frontage, and `review.json` now records just those last
civic/aerial captures. `preservation.json` proves exact preservation of established
structures, loot/crates, road routes/segments, terraces and collision blocks.

The isolated Classic trace retry passed with the original 220s deadline.
`classic-trace-pass.log` and `classic-action-timings.json` record that separate
diagnostic; they do not turn the earlier 10/11 full run into a pass. The raw trace
is preserved in ignored `.local-runtime/classic-trace-final.zip` (92MB).

`full-trace-e2e-pass.log` records the following complete final-source run:
**11/11 passed in 7.1m**, with original timeouts/assertions and failure tracing
enabled. It demonstrates full-suite success, but the earlier 10/11 result remains
evidence of intermittent timing, not a proven repair. No gameplay/test source
changes were made between these runs.

The final-layout trusted-input smoke passed again: ship orbit 362.4206°, ground
orbit 363.0261°, living grounded landing at (-168.285,.035,-356.169), no page
errors. `playability.json` and ship/ground/drop images now show this final repeat.
`validation-two-sites.json` records those pass counts alongside the earlier full-suite
failure, and leaves human control-feel/whole-island art acceptance pending.

The later `nova-facade-checkpoint/` folder contains fifteen matched final-source
views with the Nova descent/frontage and authored-floor facade changes. Its own
`review.json` records the exact camera/debug state, RTX 3060 renderer and no page
errors. Earlier parent-folder images remain available for before/after review;
`nova-north-landing-before.jpg` precedes the new geometry but already includes
the contemporary facade edit, so it isolates layout rather than facade styling.
West doorway paving remains aligned. Southrim/east-edge views document open
vista/industrial landmark decisions; neither was filled just for density.
The separate `nova-office-threshold` image shows its aligned final entry grade;
the broad Nova landing camera does not independently show that threshold.

`classic-ui-diagnostic.json` is a separate six-cycle two-page headless Shop
diagnostic. It verifies SwiftShader and successful ordinary trusted locator
actions with/without page activation; it does not reproduce the late Rematch
timeout or establish its cause. Transfer-only setup templates were removed;
these images and measurements are gameplay validation evidence.

`road-curve-audit.json` records 27,039 full-width/endpoint pavement samples on
319 real road pieces with no missing pavement, plus the 136 directed bends.
Roads are authored straight segments, so some turns remain sharp doglegs.
The actual-network regression test in `br-road-surfaces.test.ts` and existing
quarter-turn/curb tests are repeatable source validation. `civic-feeder-bend.jpg`
in the later folder documents the lower road elbow below the upper route.

Named `.log` files and the large raw trace are local diagnostic files excluded
from Git; their relevant results are retained in the committed JSON and spatial
checkpoint document. They are not required project setup files.

The current `validation.json` records the corrected three-site/facade checkpoint:
865/865 tests (148 files), typecheck/build, 11/11 full E2E in 7.0m and five
standalone profiles in 18.24s. The new `server-profile.json` contains the final
raw metrics, with original budgets. Initial draft failures (Horizon garden
overlap and two Solar belts across glazing) were corrected before this run.
The earlier intermittent Classic timeout remains in the historical record and
is not declared repaired. Human feel and whole-island art acceptance stay open.
