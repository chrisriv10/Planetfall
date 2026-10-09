# Orbital Isle spatial checkpoint — October 8, 2026

Validation platform: **DESKTOP-JL99F36**, Windows, Node 22.23.3/npm 10.9.9.
Baseline `2b9f80552a68dff7cc807fefcc0fea265f6a5429`. This document retains
implementation and test evidence; transfer-only setup and agent-routing
templates were removed from the repository at the user's request. Existing
local configuration and runtimes are unaffected. No deployment was requested.

Sections below record successive validation checkpoints, rather than implying
that earlier runs validate later changes. Whole-island recovery remains open.

## Spatial implementation and preservation

The density audit's largest confirmed gap, around `(110,-370)`, now contains
**Transfer Yard**: three enterable parcels, a supported ground street connected
to the ring, and a short court ending north of the raised Terminal–Shipworks
bridge. The shop, office and utility building provide real authoritative
enclosure and loot; the site also has one appended crate socket. The isolated
three narrow entry walks use existing materials, geometry and LOD. Shared
geometry, traversal tests and renderer integration are validated together.

The approximately 1000m island, nine primary POIs, canonical astronaut, raised
bridge and its 3.5m/4m Terminal/Shipworks decks remain intact. No camera/input,
physics rules, server authority or Classic/Chaos behavior was changed.
An exact baseline-prefix comparison confirmed all **174 established structures,
246 loot sockets and 21 crate sockets** remain unchanged and in their original
order; new structures and sockets append.

After Transfer Yard, totals were **177 structures, 95 enterable structures and 37 secondary sites**.
Interior density samples farther than 30m from real enclosure fell from 13.2%
to **12.3%**, and samples farther than 50m fell from 0.9% to **0.6%**. The target
sample now has enclosure 8m away. Roads, floors and metadata do not count as
enclosure in this diagnostic.

## Screenshot review

Fresh integrated screenshots are in `artifacts/br-review-pc-oct08/`; the README
records exact camera identities and limitations. Capture used headed Chromium,
1280×720, normal High quality and ANGLE/NVIDIA GeForce RTX 3060/D3D11.

The actual south-facing West Junction doorway has continuous aligned paving.
The generic `west-junction` camera views its rear/corner, so the new
`west-junction-frontage` camera was used for doorway inspection. No West paving
correction was needed. The previous `solar-rim-service` review name is unsupported;
use `solar-service-street`. The mislabeled capture from that unsupported request
was removed and was not used as evidence.

`south-transfer-approach-before.jpg` and `south-transfer-approach.jpg` show the
same camera before/after authoritative parcels and entry walks.
`transfer-yard-street-blockout.jpg` and `transfer-yard-street.jpg` show the matched
street before/after the isolated presentation integration. Aerial, Nova, Academy
and Hotel references were also reviewed. Broad gray gaps, repeated shells and
oversized POI surfaces remain visible; this is not final art acceptance.

## Actual validation

The two historical laptop E2E failures were rerun unchanged, serially without
competing heavy jobs, on the untouched PC baseline: **2/2 passed in 3.7 minutes**.
BR Solo HUD appeared in 9.7s and its final responsive-map check completed in 36.6s;
Classic completed its existing raid, shove, shop and rematch requirements.
This demonstrates local success, not a proven repair or root cause for the
laptop's differing timeout/poll failures. No deadline or assertion was weakened.

After the first integrated Transfer Yard change (before Civic Frontage):

- Root typecheck and production build passed; the existing large bundle warning
  remains.
- **825/825 tests in 142 files passed in 128.13s**. These include four new spatial
  contract checks, ten real Rapier traversal cases, three presentation checks and
  a camera check. Traversal verifies bidirectional ring/street/court/door routes,
  grounded state, actual support, exact arrival and prediction/authority parity.
  Continuous surfaces require contact within .08m; only the narrow intentional
  .36m indoor autostep transition uses the documented transition allowance.
- **11/11 full Playwright E2E tests passed in 5.4 minutes**, unchanged requirements
  and budgets. BR Solo HUD took 7.5s and the final responsive-map check 32.4s.
  Classic and Chaos regression flows passed.
- The density diagnostic's own tests passed **3/3** separately.
- **5/5 standalone server performance profiles passed in 19.12s**, run serially
  after the other suites, with the preview/browser stopped. Original limits remain
  average <16ms, p95 <45ms, worst <150ms and snapshot <160,000 bytes.

| Participants | ID offset | Average ms | p95 ms | Worst ms | Max snapshot bytes |
| --- | --- | --- | --- | --- | --- |
| 10 | 0 | 0.857 | 1.695 | 20.056 | 10,599 |
| 20 | 0 | 1.893 | 3.502 | 6.772 | 18,467 |
| 40 | 0 | 5.693 | 9.209 | 13.988 | 34,035 |
| 40 | 1000 | 6.025 | 9.780 | 15.900 | 34,538 |
| 40 | 5000 | 5.893 | 9.685 | 15.374 | 33,999 |

These first profile measurements are saved in `artifacts/br-review-pc-oct08/server-profile-transfer-yard.json`.
These are PC measurements, not hardware-independent guarantees or a resolution
of earlier laptop GC/timing behavior.

A separate headed browser smoke used trusted mouse/keyboard input and real
pointer lock: **362.4° ship orbit**, Space jump into freefall, Space deployment
of Ion Wings, a living grounded landing, then **363.0° ground orbit**. There were
no page errors. `playability.json` and quarter-turn/drop screenshots record this
automated evidence. The harness only observed debug state and input; it did not
set gameplay state. This is automated browser playability evidence, not native
human control-feel acceptance or a controlled FPS benchmark.

## Remaining recovery work

The overall recovery pass remains unfinished. After Transfer Yard the next gap
was around **(-170,170), 60.8m from enclosure**; the subsequent Civic Frontage
continuation below addresses it. Other noted gaps remain around (-70,-460) and
(-170,-20). Continue with supported routes and real enclosure,
preserving existing geometry/socket order and validating full-footprint clearance.
Review aerial high/low readability, oversized POI surfaces, repeated architecture
and interior/door alignment. Human camera/drop/control-feel acceptance remains
pending. Delegate only isolated presentation to Astra, retain Sol ownership of
mixed modules/shared/server/E2E, and run future full regressions and performance
serially. Do not call the pass complete from green tests alone.

## Subsequent Civic Frontage continuation

The confirmed `(-170,170)` ground gap now has a bookshop, clinic and utility
building, with three facing entrances, a lower street and a short courtyard
terminus. It extends `central-security-cross` and reuses the existing lower
Security feeder to Zero; no duplicated feeder or false junction onto the raised
Academy ring was added. The existing high radial grade passes over the southern
access. Real bidirectional traversal checks cover the entire established feeder,
the lower continuation, the court and all three doors: grounded state, actual
downward support, real standing-capsule overhead clearance, arrival and
prediction/authority parity. The authored standing capsule is 1.4m; the overhead
query adds .1m clearance. Existing movement rules and tests are unchanged.

Astra added only three narrow entry walks and their three focused tests; Sol
integrated them into the existing zero-translation secondary-site detail LOD.
The matched before/blockout/integrated `civic-frontage-street` screenshots show
near opposing enclosure and continuous paving to the two visible doorways. The
third utility entrance is outside that frame and is covered by geometry and
traversal tests, not claimed as visually accepted. The helper adds one surface
batch with three boxes. The last aerial capture includes both new sites.

Totals are **180 structures, 98 enterable structures, 38 secondary sites and nine
primary POIs**. Samples farther than 30m from enclosure are now **11.6%**, farther
than 50m **0.5%**, and farther than 75m **0%**. The targeted sample is within the
new bookshop footprint. The next largest diagnostic samples are `(-70,-460)`
(58.5m), `(-170,-20)` (58.0m) and `(460,-110)` (57.2m). These need ground/elevation
review before layout changes; a deliberate rim vista is not automatically an
error because the density diagnostic reports it.

Exact baseline preservation now also covers all **228 established road routes,
311 graded road segments, 18 terraces and 1,462 collision blocks**. Each established
ID retains exactly the same geometry. `preservation.json` records those checks
alongside the original structure/loot/crate prefix checks.

The whole-pass art and human acceptance caveats above still apply: repeated facade
language, oversized pale POI rectangles, broad tiled interdistrict openings and
weak distant elevation framing remain visible. Neither local enclosure nor green
automated suites establishes final art/control-feel acceptance.

### Validation after both sites

Fresh root typecheck and production build passed. **841/841 tests in 145 files
passed in 132.19s**. The subsequent full E2E run completed **10/11 in 8.7 minutes**,
not a pass: Classic exhausted its unchanged 220s deadline while scrolling the
visible, enabled Rematch button into view. Raid, theft, shove, sabotage, cannon
play, results, Solar Gold purchase and equip had already succeeded. BR Solo
passed in 35.5s (HUD 7.7s, final map layout read 35.2s), as did the other nine
flows. `final-e2e-failure.log` preserves the complete output. This reproduces a
late-action timing failure locally; the earlier green run cannot replace this
full-suite result. No timeout, assertion or game rule was changed.

An isolated traced diagnostic first failed before any test ran because the
original 60s web-server startup limit expired. That is a setup failure, not a
gameplay pass/fail; `classic-trace-startup-failure.log` preserves it separately.
The next traced retry started its servers normally in five seconds.

That isolated traced retry passed **1/1 in 3.4 minutes** (test 3.3 minutes), with
the same 220s limit. Its two Rematch clicks took 223.7ms and 323.4ms; Solar Gold
BUY/EQUIP took 451.2ms and 483.4ms. The long waits in that passing trace were
the expected match-clock/results waits, 54.9s and 45.0s. The trace confirms that
the late buttons work in the isolated run, not why the full-run budget expired.
`classic-action-timings.json` and `classic-trace-pass.log` record the retry;
the complete 92MB trace is preserved locally at `.local-runtime/classic-trace-final.zip`.
No Classic/E2E source or timeout was changed in response to either outcome.

The following complete run, with tracing retained on failure, passed **11/11 in
7.1 minutes** (Classic test 3.2 minutes). BR Solo passed in 48.6s, HUD 13.2s and
final responsive-map read 47.4s; the two-player lifecycle took 10.9s versus 46.6s
in the previous run. These timings vary considerably, so tracing/load is not a
proven cause. `full-trace-e2e-pass.log` records the final full run. This is actual
full-suite success on the final source, but it does not erase the earlier timeout
or prove that intermittent Classic timing is repaired. Keep both results visible
in future continuation and diagnosis. There were no intervening gameplay/test
source changes or weakened deadlines.

Standalone server profiles were rerun with the preview/browser stopped, and all
**5/5 passed in 19.52s**, with unchanged limits. Latest raw metrics are in
`server-profile-two-sites.json`:

| Participants | ID offset | Average ms | p95 ms | Worst ms | Max snapshot bytes |
| --- | --- | --- | --- | --- | --- |
| 10 | 0 | 0.884 | 1.754 | 18.828 | 10,672 |
| 20 | 0 | 1.983 | 3.451 | 6.807 | 18,394 |
| 40 | 0 | 5.990 | 9.525 | 15.996 | 34,960 |
| 40 | 1000 | 5.853 | 10.212 | 15.769 | 33,849 |
| 40 | 5000 | 6.072 | 10.260 | 15.603 | 34,564 |

The trusted-input smoke was repeated on this final two-site layout: pointer lock
and trusted events passed, ship orbit **362.4206°**, ground orbit **363.0261°**,
freefall/Ion Wings transitions and a living grounded landing at
`(-168.285, .035, -356.169)`, with no page errors. The latest `playability.json`
and ship/ground/drop screenshots came from that repeat. `validation-two-sites.json` records
the final successful suites and the preceding full-suite failure separately.

At that two-site checkpoint, `git diff --check` and exact preservation checks
passed. Changes were local and uncommitted; nothing had been pushed or deployed. The development preview
was restarted at `http://localhost:5173/` after serial validation and left
available for continued local review. Human control-feel and whole-island art
acceptance remain pending.

## Nova Landing and facade checkpoint

The preserved `nova-street-b-north` ended at `(-175,4.836842105263158,-48)`,
about 4.74m above ground. An appended 12m-wide descent now reaches the lower
landing at `(-175,.1,-12)`; it joins a ground street and two short entrance
courts. Three enterable shells add real enclosure around the measured
`(-170,-20)` gap: an east-facing single-floor shop, north-facing two-floor
office and north-facing utility. Their full footprints clear all established
roads, shells and raised decks. Every former road, deck and shell is preserved.

The office entrance initially exposed a Rapier autostep dip below the base
floor. A visible, collision-backed threshold now rises .36m over 1.5m to meet
the exact floor edge. It uses the existing road-grade collider/support contract
without becoming a navigation street. New tests raycast its actual top face
at 21 samples and walk all six street/court/door routes in both directions.
They retain grounded state, measured support, actual arrival and five-decimal
client/authority parity. Only the narrow established shop/service floor lip
uses the documented autostep transition allowance; the new office threshold
also measures support within the real capsule footprint at that lip.

The facade helper now follows authored floor counts for storefront, office,
academy/lab and utility buildings. Single-floor shops have one display tier;
offices have narrower vertical panes; clinics have horizontal ribbons;
utilities have high clerestories above solid lower walls. Residential, cargo
and fuselage treatment remains intact. On the pre-Nova 180-shell catalog,
near facade parts fell from 27,306 to 24,267 and distant bands from 1,572 to
1,333. The helper tests retain door clearance and part-envelope checks.

Totals are now **183 structures, 101 enterable structures, 39 secondary sites
and nine primary POIs**. The Nova gap has real enclosure 10m away. Interior
density samples farther than 30m/50m/75m are **11.0% / 0.4% / 0.0%**. These
numbers exclude roads and large floors and do not substitute for art review.

Matching final captures are under
`artifacts/br-review-pc-oct08/nova-facade-checkpoint/`. West paving remains
continuous and the differentiated storefront/office/clinic/utility treatments
are visible. Nova Landing now reads as a real graded street instead of a blank
retaining-wall approach. The added `nova-office-threshold` view shows the final
aligned entry grade and the interior floor; the broader north-landing camera
does not independently show that threshold.
The southern rim reads as an intentional skyline vista. The east outer edge
has a clear industrial landmark and crossing. Neither view justifies more
buildings solely to improve the density statistic.

Remaining art weaknesses include flat beige lit displays, some existing trim
bars ending mid-display, dominant pale plaza surfaces, repeated white shells
and rooftop cylinders, and broad aerial POI rectangles. Human control-feel and
whole-island art acceptance remain open. This is a working checkpoint, not
completion of the recovery pass.

`classic-ui-diagnostic.json` records two real headless Chromium pages at
1280×720. Both used SwiftShader, with maximum sampled frame gaps near 900ms.
All six ordinary Shop open/close sequences passed, with and without explicit
page activation (open 299–905ms, close 238–627ms), and no page errors. This does
not establish focus as the cause of the earlier late Rematch timeout or prove
that intermittent E2E timing is repaired. Classic/E2E source, deadlines and
assertions remain unchanged.

Repository cleanup removes only the committed transfer document and three
agent-routing templates. The spatial evidence is retained here; normal build,
CI, environment examples and deployment documentation remain necessary.
Local configuration, tools and runtime are untouched.

The first full Nova/facade validation completed **861/864**, with three real
presentation failures. The new office overlapped Horizon Homes' existing garden;
it was moved 11m east, with its court and threshold, preserving that old pocket.
Solar Service's attached shop/utility belts crossed the newly positioned glazing;
their helper now derives a clear spandrel from actual glazing intervals. Existing
clearance and part-budget assertions were retained. Focused checks passed after
each correction; those failures are not counted as a successful full suite.

The road-curve audit checks all **319 authored road pieces** at their actual
visible height, with full-width lateral samples and endpoints. **27,039 samples
had no missing pavement**. The network contains 136 directed non-collinear joins;
roads remain authored straight pieces with some sharp doglegs, not smooth spline
arcs. A new actual-network surface regression test retains this coverage, and
the unchanged corner/curb/marking suite covers quarter-turns, subdivision
invariance and both service-23 bends. The `civic-feeder-bend` ground screenshot
shows the real lower elbow below the existing raised route. This is pavement
and bend inspection, not a claim that every curved route was manually driven.

On the corrected final source, root typecheck and production build passed
(the existing large-chunk warning remains). The full unit/system suite passed
**865/865 across 148 files in 138.19s**. Exact baseline preservation passed again:
174 original structures, 246 loot and 21 crate sockets are exact prefixes;
228 original road routes, 311 road pieces, 18 terraces and 1,462 collision blocks
are identical by ID. Current totals are 183 structures, 267 loot sockets,
22 crates, 236 road routes, 319 pieces and 1,557 blocks.

The final-source trusted-input smoke passed pointer lock, trusted mouse events,
ship orbit **362.3528°**, ground orbit **363.0261°**, freefall/Ion Wings transitions
and a living grounded landing at `(139.5703,1.4515,-349.7102)`, with no page errors.
Those are automated control/mechanical checks; human feel acceptance remains open.

Full final-source E2E passed **11/11 in 7.0 minutes**, including BR isolation,
Solo confirmation/responsive map, Classic raid/shop/rematch, Chaos and the
six-participant rendering budget. BR Solo HUD appeared at 9.228s, final map
layout read completed at 48.975s, and Classic completed in 3.2 minutes. No
Classic/E2E source, assertion, deadline or performance budget was changed.
Earlier intermittent failures remain documented; this successful run does not
establish their root cause or a timing repair.

Standalone server profiles passed **5/5 in 18.24s** with verbose metric capture,
after the preview and E2E processes stopped. The initial quiet-reporter profile
also passed 5/5 in 18.44s; it did not retain the raw console metrics and was
repeated for an auditable record. `server-profile.json` contains the latest
five profiles; `server-profile-two-sites.json` retains the earlier checkpoint.
All unchanged limits remain average <16ms, p95 <45ms, worst <150ms and
maximum snapshot <160,000 bytes.

| Participants | ID offset | Average ms | p95 ms | Worst ms | Max snapshot bytes |
| --- | --- | --- | --- | --- | --- |
| 10 | 0 | 0.865 | 1.692 | 23.236 | 10,673 |
| 20 | 0 | 1.895 | 3.414 | 6.454 | 18,752 |
| 40 | 0 | 5.765 | 9.359 | 16.461 | 34,829 |
| 40 | 1000 | 5.869 | 9.402 | 12.816 | 34,121 |
| 40 | 5000 | 5.716 | 9.110 | 13.324 | 34,547 |

`validation.json` records this final checkpoint and its corrected draft failures;
`validation-two-sites.json` retains the previous two-site success/failure record.
The user authorized committing and pushing this working checkpoint to `main`.
No deployment was requested or invoked. The full spatial/art recovery is still
open despite this checkpoint's passing automated validation.

## Facade and plaza continuation after `7ee0ef3`

This subsequent local presentation step replaces the two thick storefront
massing bars with shallow uprights aligned to the actual outer display-pane
edges. It uses the existing massing batch and leaves door openings clear.
Lit facade glazing now has shaded edges and reflected detail in one shared
64×64 texture/material; the existing lamp/interior-light material is unchanged.

The terrain renderer previously discarded the five authored plaza colors and
stretched normalized surface-detail UVs across each whole plaza. These plazas
now use restrained district tints and eight-metre texture repeats (1.5m joints
in the existing pavement grid). Five cached material clones reuse the existing
sidewalk detail textures. Height partitions, patch footprints, roads and all
authoritative geometry are unchanged. No lights, props, pattern meshes or draw
batches were added. Material and texture disposal is checked by focused tests.

Nine integrated fixed-camera screenshots were reviewed at normal High quality
in headed Chromium on the RTX 3060, with no page errors. West Junction no longer
has trim ending inside its display panes; Solar frontage belts remain clear of
glazing; Nova, Academy, Hotel, aerial, Civic feeder and Nova threshold views
retain their established layout. Evidence and matched-reference locations are
in `artifacts/br-presentation-oct08/README.md`.

Root typecheck and production build passed, retaining the existing large-chunk
warning. The full unit/system suite passed **871/871 across 150 files in
132.04s**. Shared map, server and E2E source have no diff from `7ee0ef3`.

The first E2E attempt was interrupted after a comment-only cleanup landed in a
watched presentation module. It had three passing tests and a BR room-start
failure: the HUD stayed hidden for the unchanged 15s deadline. Its retained
trace shows an unexpected home navigation/Vite reconnection during Start,
coinciding with the edit. This is a contaminated run, not a successful full
suite or evidence that the historical timing issue was repaired. The log,
error context and trace are preserved locally as
`.local-runtime/presentation-e2e-interrupted.log`,
`.local-runtime/presentation-interrupted-context.md` and
`.local-runtime/presentation-interrupted-trace.zip`.

With source edits stopped, the subsequent complete E2E run passed **11/11 in
6.9 minutes**. BR room/drop passed in 1.6 minutes, Solo completed all three
responsive-map views in 53.3s (HUD visible at 16.296s, after quick-start at
8.732s), and Classic raid/shop/equip/rematch passed in 3.2 minutes. Chaos,
multiplayer lifecycle and the six-participant rendering budget also passed.
No test source, timeout, assertion or gameplay/performance budget was weakened.
These successes do not establish the root cause of earlier intermittent
Classic/BR timing failures. The previous standalone server profile remains the
baseline; no new standalone profile is claimed for this presentation step.

Fresh headed trusted-input smoke also passed pointer lock, a **362.4162°** ship
orbit, **363.0261°** ground orbit, freefall/Ion Wings and a living grounded
landing at `(272.2182,.0350,242.5702)`, with zero page errors. Its screenshots
and full state are in `artifacts/br-presentation-oct08/playability/`. This
checks actual input and mechanical transitions; it does not establish human
camera/control-feel acceptance around every wall, route or district.

Large plaza footprints, repeated architectural shells and broad interdistrict
openings remain visible. This step is not completion of island recovery or
human control-feel/art acceptance. Changes remain local after the previously
pushed checkpoint; no new push or deployment was performed.

## Bridge, greenway, neon and overlap continuation

Execution remains on DESKTOP-JL99F36. The map appends 46 paired 1.25m bridge
piers and 66 trees in 15 interdistrict planting bands. Each tree has a real
0.7m trunk collider at every graphics quality. The map now has 1,669 solids;
183 structures, 267 loot sockets and 22 crate sockets retain their identities
and placement. Supports exclude lower streets, structures, sockets and
retaining transitions; canopies reserve clearance around travel and buildings.

Bridge girders follow the actual exposed grade planes and join real piers;
the old narrow decorative support sticks are removed. Supported level elbows
gain round outer caps and tangent inside fillets without shortening their
original road corridors or extending beyond the island. Grades and the large
island silhouette are preserved.

Eight cached dark exterior paint families, district plaza tints and circuit
detail extend color across the colony. Interior finishes remain readable.
Exterior LEDs are placed above measured glazing with door, sign and corner
gaps. High quality uses HDR bloom with native-resolution scene rendering;
Low/Medium retain bright LED cores. Repeated High/Medium/Low transitions release
the render targets; three High samples at the same view each used 55 textures.
Every postprocessing draw is included in renderer statistics.

The new `npm run audit:br-overlaps` checks all 16,653 pairs of building
envelopes and 25,804 generated facade, storefront-upright and LED boxes. It
found and repaired two Void Market accent panels penetrating upper glazing.
The subsequent audit has zero flagged building/facade intersections. Close
production-world renders additionally revealed a generic balcony/railing kit
crossing the south upper facade. That kit had no authoritative playable slab
and is removed across the map. The saved north/south renders show the repair.
The audit excludes intentional backing panels and narrow mullions; it does
not certify every decorative triangle or animated figure. Screenshot review
remains necessary, as the balcony finding demonstrates.

New physics checks traverse into every new pier/trunk and enforce authority /
prediction parity and grounded floor contact. They exposed Rapier autostep
returning small base-floor penetrations at some wall contacts. Both peers now
share a base-deck contact constraint, preserving the -3m service basin and
unconstrained falling outside the island.

Planetfall's home astronaut is parented beside the rotating preview cannon.
Its authoritative match spawn now starts 2.8m beside the polar cannon at the
same radial surface height and within the unchanged interaction range. The
desktop and compact countdown captures show separate silhouettes. Classic /
Chaos isolation and the canonical shared astronaut remain intact.

Final root typecheck and production build pass with the existing large-chunk
warning. The full unit/system suite passes **886/886 across 158 files in
141.06s**, including all five unchanged 10/20/40-participant server performance
cases. The full E2E run passes **11/11 in 7.3 minutes**, including BR room/drop,
Solo's three responsive-map views, Classic raid/shop/equip/rematch, Chaos and
the six-participant visual budget. That E2E run preceded the final visual-only
balcony removal. Typecheck/build, the full unit suite, direct renders and
trusted-input smoke were repeated afterward; no subsequent authoritative,
state, networking or input changes were made. No test assertion, deadline,
gameplay condition or performance budget was weakened. Earlier intermittent
timing failures are not declared conclusively diagnosed by these green runs.

The final headed RTX 3060 smoke passes pointer lock, trusted mouse events,
**362.3453°** ship orbit, **363.0261°** ground orbit, freefall / Ion Wings and a
living grounded landing at `(-179.5423,1.1084,330.4792)`, with zero page errors.
Nine integrated island views, repeated quality changes, final mall/Nova views,
the countdown and the repaired Void Market faces are retained in
`artifacts/br-bridge-color-oct08/`; `validation.json` records scope and limits.

The broader island recovery and human art/control-feel acceptance remain open.
At the validation snapshot this checkpoint was local. It is now prepared for
the user's requested commit and push; deployment remains outside this pass.

### October 8 continuation — broader facade attachment review

The preceding bridge/color/neon checkpoint was committed and pushed to `main`
as `281d013e97f0b086c85f0058ac482ea5de713e7a`. Execution remains on
DESKTOP-JL99F36. Transfer-only setup and agent configuration remain outside Git;
ignored local routing/runtime/review files were preserved.

A read-only scan of actual production architecture assembly found 858 candidate
pane/decoration intersections beyond the earlier helper audit. Close renders
confirmed broad tower ornaments across Nova Tower's glass. Redundant generic
body fins and mall shelves are removed; measured facade fins, belt courses and
roof silhouettes remain. Service ribs now fit measured solid wall gaps.
Doorway frames preserve the full 4.8m opening below head height. Awnings start
beyond glazing and meet brackets connected to their jambs. Freight braces end
0.15m below their actual clerestory. Non-enterable shells receive no false doors.

Pure facade composition and doorway/freight helpers are shared by production
rendering and `npm run audit:br-overlaps`. The expanded command checks 26,900
facade/attachment boxes and 16,653 building-envelope pairs with zero flags.
The final production-assembly browser scan independently checks 20,119 opaque
boxes against authored glazing across 183 structures, with zero candidates.
These are overlapping scopes, not additive object counts. Six close scenes and
four actual integrated-game views have zero page errors. The tower before/after
and intermediate 323-candidate scan are retained for review in
`artifacts/br-overlap-continuation-oct08/`.

Final typecheck/build pass with the existing chunk warning. The full suite
passes **889/889 tests across 159 files in 142.82s**, including all five unchanged
performance cases. Full E2E passes **11/11 in 5.5 minutes on this exact source
state**, including BR drop/Solo map views, Classic raid/shop/rematch, Chaos and
six-player budgets. No source edits or concurrent render/unit loads occurred
during E2E. No assertions, deadlines, gameplay conditions or budgets were
weakened. Prior intermittent failures' root cause remains unproven.

This continuation changes presentation only. Authority, networking, island
dimensions, colliders, sockets and Classic/Chaos contracts are preserved.
The box checks do not certify every landmark, roof helper, interior, cylindrical
mesh, decorative triangle or animated figure. Whole-island art and human
acceptance remain open. This validated continuation is prepared for the user's
requested checkpoint commit/push; deployment is outside this pass.

### October 8 continuation — landmark and animated machinery clearance

The facade checkpoint was committed and pushed as
`8adb2e7fc4988b61be4b86e9cdbe0fe78a9b13ee`. Execution remains on
DESKTOP-JL99F36. The presentation agent remained unavailable under its usage
limit; Sol performed the production geometry inspection and mixed-file
integration, preserving ignored local configuration.

A production-renderer triangle scan found 22 landmark/building intersection
pairs across 25 animation samples: 19 at Zero Point and three at Crash Site.
Zero Point's decorative mast occupied the playable spire, its west pylon
occupied the control room, and its arms/streams crossed building envelopes.
The energy assembly is now mounted above the actual roof, with four rooftop
pylons and braces joined into the tapered mast. Three tilted animated rings,
the pulsing core and the existing single point light remain. Redundant generic
roof equipment is omitted on this authored crown. Actual roads are unchanged.
Crash Site's engine rings now clear the full end wall and each other, and its
tilted tail accounts for rotated corner height rather than unrotated height.

`npm run audit:br-landmarks` imports the actual renderer from a running Vite
development server. It checks all nine landmark groups (141 mesh objects)
against all 183 authored building envelopes, including 101 enterable structures,
at 25 times spanning 90 seconds. Final bounds produce zero candidates and zero
flagged intersections/page errors, so zero narrow-phase triangle checks are
needed. The before scan used 52,132 triangle checks to find its 22 pairs.
The audit retains 0.4m wall/floor and 0.3m roof-contact margins. It samples
triangle surfaces; it is not a continuous animation or closed-volume proof.
Players, independent prop groups and landmark-to-landmark contacts remain
outside its scope. The separate facade audit still passes 26,900 boxes and
16,653 building pairs. These overlapping scopes are not additive counts.

Ten close production renders and five integrated-game views have zero page
errors. Before/draft/final images and scoped reports are retained in
`artifacts/br-landmark-recovery-oct08/`. The final close-view report retains its
101-enterable scope; the repeatable command's report covers all 183 buildings.
Focused tests verify rotated crown roof clearance, physical brace joins,
borrowed resource ownership and wreck wall/tube separation. Shared canonical
astronaut, authority, networking, physics, island size and Classic/Chaos
contracts are unchanged. Broader player/prop review and art acceptance remain
open; no deployment is performed.

Typecheck and production build pass with the existing chunk-size warning.
The first full suite passed 892/893, with a mixed-match end timeout. The unchanged
server file passed 16/16 on recheck. A read-only 12-match trace reproduced one
failure: a bot repaired from 14 to 29 integrity 92ms before the 14-damage rocket
arrived, survived on 15 integrity, and legitimately kept the match running.
The fixture's assumption that the weakened planet stays unrepaired is
intermittent. `regression-rematch-race.json` retains the event sequence.
No bot behavior, test condition, assertion, deadline or budget was weakened.
The subsequent unchanged full suite passes **893/893 across 161 files in
143.12s**. This green rerun does not resolve that fixture's reliability or
explain every historical E2E failure.

Full E2E passes **11/11 in 5.6 minutes on this exact source state**, including
BR room/drop and Solo map views, Classic raid/shop/rematch, Chaos and the
six-participant visual budget. No source edits or concurrent render/test loads
occurred during E2E. The validated landmark checkpoint is prepared for the
user-authorized commit and push; `validation.json` records scope and limits.
