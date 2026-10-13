# Human playtest recovery — October 10, 2026

This is an **unfinished working-tree pass**, not human acceptance of the entire
island. No commit, push or deployment has been performed. Earlier spatial
recovery, audits and performance limits are preserved.

## Starting state and provenance

- Host verified: DESKTOP-JL99F36; Windows; Node 22.23.3.
- Initial HEAD: `e10fafbb8c27463187f2a2623233a56dbc717c99` on main.
- Initial index/worktree: clean, no pre-existing untracked work; origin/main
  matched. Subsequent dirty files are this ongoing recovery pass and remain local.
- Followed existing AGENTS/.codex Sol/Astra ownership. Visual helpers were
  delegated; Sol owns integration, authority, physics and validation.
- Real headed Chrome, RTX 3060 through ANGLE/D3D11, 1440×900, DPR 1. Browser
  keyboard/mouse input drives the live client. An ignored local fixture places
  players/vehicles, selects initial inventories and freezes/re-enables bots for
  repeatable cases. These controlled cases are **not an uninterrupted natural
  human match**, and static review cameras do not move the player.

## Reproduced failures and changes

### Roads, physics and vehicles

Walking the southwest salvage access grade in both directions succeeded, but a
real skimmer stopped at approximately `(-226.38, 3.03, -407.54)`. Its support pier
was beneath the pavement, yet vehicle clearance used only a planar footprint.
The authority now checks the block's projected vertical extent against the
chassis/pilot height before rejecting movement. Pier and wall collision remains
active at overlapping heights. The new authoritative two-direction drive test
failed at the same location before the fix and passes afterward. Live keyboard
driving now reaches the upper street at approximately `(-175.37, 5.94, -424.55)`
(pilot feet are 0.62 m above vehicle origin).

Automatic glide against Zero Point's west wall falsely switched to grounded at
about y=14.44. Millimetres of shortened downward wall sliding triggered the old
ground-contact fallback. Prediction and authority now require a walkable contact
normal for that fallback. The real Rapier regression failed before the change;
the live repeat stays airborne to y=0.035 and then lands. See the before/after
wall-contact JSON and test logs.

Road construction had excessive repeated polygon work. Disjoint AABBs now skip
irrelevant clipping; canonical surfaces/markings are cached with caller-isolated
copies. **Exact serialized geometry equality** was verified: 4,883 surfaces and
5,223 markings unchanged. This is a construction optimization, not evidence that
every road looks or drives correctly. Civic bends, Zero–Coolant, central civic
and southwest grade screenshots were reviewed; whole-island live road acceptance
is still open.

The east Freight–Engine grade `(375,8,-285)` → `(405,0,-207)` now has actual
forward/reverse player and skimmer traversal. Walking remains grounded throughout;
the skimmer reaches the lower street and returns above the upper endpoint without
support-pier blockage. Initial placement is controlled; traversal uses browser
keyboard input. See `east-freight-grade-{walk,drive}-live.json` and screenshots.

### Glide, camera and combat

- Glide horizontal target 32→38 m/s; descent 8.5→8 m/s. Acceleration, steering
  and braking retain carry with bounded heading changes rather than snapping
  velocity to the new target. Freefall values remain unchanged.
- Fresh E2E reproduced unattended glide accelerating to full speed and leaving
  the island. Released movement now preserves existing bounded speed rather
  than adding acceleration. A new 0/6/24/38 m/s release regression failed before
  the fix and passes afterward; steered route values above remain unchanged.
- Controlled west-island start `(-400,190,0)`, actual W input: early wings travel
  **864.07 m / 23.50 s**; automatic deployment **385.19 m / 13.31 s** after the
  wall fix. The automatic route meets Zero Point's wall, so this is practical
  reachable distance for that route, not an unobstructed glide-ratio benchmark.
  Input/orbit setup consumes some height before timed samples begin.
- Forward wings pose reviewed behind, side, front and diagonal. Arms/legs support
  the aerodynamic silhouette. View direction remains player controlled.
- A local flight trail extending behind the following camera created a huge
  near-plane wedge. Local BR trail length is bounded relative to camera boom;
  remote trails keep their full length. Live before/after screenshots reproduce
  and verify this particular streak fix.
- Vehicle entry seeds route-facing yaw once; a longer, higher camera boom clears
  the skimmer hull while retaining subsequent free look. Actual drive screenshots
  verify the new view.
- Standing combat body width 0.43→0.50 (about 16%); continuous torso coverage;
  head radius 0.30 and movement collision unchanged. Edge-shot tests retain
  obvious misses and distinct headshots.
- Rail 36° scope and Pulse 52° reflex checked with actual RMB, weapon switching,
  fire, reload and inventory. Center reticle and optic labels improved. Live
  Pulse fire registered 100 damage and an elimination. This is not a complete
  moving-target/combat-balance or all-scope-lifecycle acceptance test.

The latest live Pulse test tracks an actively moving bot using native mouse input:
122 damage and one elimination, with the recorded target path moving approximately
2 m during fire. This verifies moving-target registration in that encounter;
it is not human acceptance of combat balance or multiplayer latency. Actual ammo
spending/reload, inventory and elimination hide the optic as expected. Inventory
and elimination release pointer lock; vehicle entry hides the scope, while held
RMB resumes the scope after exit. See `scope-lifecycle-live.json`.

### UI and previews

- Authoritative leave protocol clears routing/membership before returning home;
  both lobby experiences have a leave control, host transfer and lifecycle tests.
  Late room/snapshot/results events are guarded during/after leaving.
- Pointer capture is restricted to actual gameplay. UI capture explicitly
  releases pointer lock and scope state; lobby background cannot recapture it.
- BR lobby panel reviewed at laptop, ultrawide and narrow sizes.
- Preparing an inactive BR instance incorrectly stopped the shared renderer's
  active Classic overview loop. Inactive `deactivate()` now leaves the current
  mode's renderer and cursor ownership alone. A real lobby E2E compares two
  successive background captures after BR preparation; the overview keeps moving.
- A traced two-client lobby leave/rejoin took 52.1 s with continuous scenery
  rendering. Lobby/results scenery now updates at twenty Hz; input/navigation
  still samples every RAF, and countdown/ship/combat are unrestricted. Fresh
  before/after traces and full E2E validation are retained separately.
- SHOP home label simplified. Responsive home island overview uses canonical
  map solids, landmarks, vegetation and facade detail; gameplay scale unchanged.
  Reviewed at 1440×900, 1366×768, 2560×1080 and 420×820.
- Heavy construction could make the first RAF timestamp precede activation,
  producing negative delta and an invalid lobby camera/FOV. Both game frame
  loops now clamp finite delta to [0,0.05]. Fresh lobby camera starts valid.
- Shop and Pass share one offscreen renderer with visible-card 2D copies,
  bounded animation and disposal. Canonical astronaut suits/poses, actual Verity
  geometry and canonical flight trails replace placeholder representations.
  Trail ribbon/particle identity differentiates Ion Blue, Warp, sparks, bubbles
  and stardust. Verity rotates within a readable face-facing arc. Card sizing
  keeps names separate from previews. Latest screenshots reviewed.

### Environment and random lines

- Connective micro-pockets retain their placement/clearance contracts but replace
  orphan stakes, empty cradles and plates with planted soil beds, low irrigation
  rails and clustered vegetation. No new visual-only opaque cover.
- Two fixed authored landforms: east grove `(454,-110)`, 28×56 m, 4.5 m high;
  south garden `(259,-368)`, 48×48 m, 6.5 m high. Identical collision/render
  triangles, floor/loot support, navigation, vehicle support and camera collision.
  No random noise. Added full-size collision-backed trees; sloped soil colors;
  omitted coplanar zero-height triangles. Actual walking crosses both hills.
- Distant backdrop streaks now remain outside the playable island; storm streaks
  are finite short elevated segments rather than ground-to-sky sticks. Finite
  coordinate/determinism/bounds tests preserved. The separate local-trail wedge
  was reproduced and fixed as described above; THREE.Line is not blanket hidden.
- Whole-island player-height composition/filler review remains open.
- A production-camera raycast identified the bright Nova diagonal as the literal
  `nova-studio-roof-ramp`, not an invalid Line. It reused the bright interior-slab
  finish. Exterior roof ramps now use a bounded, district-tinted dark metal finish
  and distinct geometry batch keys; their solids/collision/interior slabs remain
  unchanged. Matched live before/after images verify this specific presentation
  repair. `filler-review.md` distinguishes historical removed kits from current
  low planted beds and records a separate unidentified orange-topped prop.

### Audio

- Starliner loop: gain ceiling 0.22→0.065, slower 0.72–0.80 playback, 680 Hz
  filtering and restrained low/mid body; fade/stop timer cancellation avoids pops.
- Separate BR music scene uses original project-composed `orbital-drift.ogg`,
  192 s, quiet target 0.085 versus Classic 0.18, smooth scene transitions.
- Remote weapons/footsteps, impacts and finite confirmed-shot flybys use distance
  attenuation, yaw-relative stereo, distance filtering and a 16-voice cap.
  Pickup/crate feedback supplements existing wings, landing, Void and combat cues.
- No new third-party audio imported. Existing Kenney/GboxMikeFozzy CC0 sources
  remain documented; the original music generator/provenance is recorded in
  `docs/AUDIO_SOURCES.md`. Browser playback/routing and tests cannot substitute
  for subjective speaker/headphone listening acceptance, which remains open.
- Live spectating exposed remote audio positioned relative to the eliminated
  player's body. Remote shots, footsteps, impacts and flybys now use the followed
  camera as listener while dead; living players retain predicted position.
  Stale glide/vehicle loops also stop after elimination. Focused lifecycle tests
  exercise the actual BR event handlers.
- Final review reproduced the first loop ramp starting at Web Audio's default
  gain 1. Continuous media routes now initialize at gain 0 before playback;
  music/sample routes retain their own levels. The failing-before regression
  passes after correction, and live Starliner playback records gain `[0]` at
  its first `play()` (`audio-envelope-results-live.json`). BR results now retain
  the same Orbital Drift scene instead of switching to menu; live lobby → ship
  → controlled results plays the BR track once without a second menu start.

## Client performance evidence and limits

Raw `baseline.json` and `after-metrics.json` include High/Medium/Low and subsequent
Auto measurements of aerial, dense exterior, interior, connective street, storm,
plaza and nine-bot combat. Frame samples and renderer/world counts are retained.
Median frame time generally **16.7 ms**, p95 **16.8 ms**, on this 60 Hz RTX 3060
machine. This does **not** demonstrate an FPS increase on integrated hardware.
Some review-view counts include different ship/bot animation timing; do not
claim every count difference is caused by optimization.

Matched nine-bot combat camera at `(-175,5.035,-112)`, yaw≈-1.9394:

| Preset | Calls before→after | Triangles before→after |
| --- | --- | --- |
| High | 1170→1003 | 475821→469165 |
| Medium | 544→423 | 408867→331319 |
| Low | 402→333 | 285879→282541 |
| Auto (resolved Medium) | no prior Auto | 423 / 331319 |

Auto's measured canvas is 1296×810 at this viewport (0.9 scale); Low uses 0.72,
High 1.0 with separate DPR caps. Existing presets additionally scale world detail,
player microdetail, shadows and effects. Static matrices freeze; camera obstruction
uses authoritative Rapier ray queries; empty/heal/airborne/seated states skip
unnecessary weapon traces. Armed aim precision remains continuous.

Construction probes: previous full Low world 8,655 ms (5,701 ms roads); new cold
full world 1,797 ms, warm full world 756 ms; home overview 230 ms with 433 objects /
47 materials versus full world 2,174 / 298. The earlier probe ran alongside E2E,
so exact timing ratios include CPU-load differences; geometry equivalence and
reduced overview work are independently verified.

Auto starts conservatively from renderer capabilities and uses sustained frame
sampling, a warmup and long cooldown, one headroom promotion, no subsequent
up/down oscillation. Manual overrides persist and win. Sustained 200 ms frames
now count as pressure; long suspension gaps and inactive screens do not.

Additional Chrome **8× CPU throttling**, not integrated-GPU emulation:
High median 116.7 ms / p95 133.4 ms; Medium 100 / 116.7 ms; Low 83.4 / 100.8 ms.
The player/camera remains fixed, but bot AI/ship timing can vary between windows,
so this is a quality-scaling pressure check, not a matched optimization benchmark.
Auto starts at 1296×810 (Medium), then moves to 1036×648 (Low) after sustained
slow frames; visible detail drops from 20,462 instances/13 sectors to 17,212/9.
Manual High overrides Auto and persists in `planetfall:settings:v1`. No claim
that this extreme throttling case runs smoothly: it remains substantially slow.
Raw evidence: `client-cpu8-pressure.json`, `auto-pressure-live.json`.

## Evidence exclusions

- `baseline-cpu-profile.json` measured home, not BR; use
  `baseline-br-cpu-profile.json` for BR. Raw profiler counts have different
  sample totals; do not equate them to normalized CPU time.
- Old combat placement at y=0.035 was below Nova's deck. Use the corrected
  y=5.035 and matched-camera combat measurements.
- `east-grove-walk-crest.jpg` was a falling pose; later live ascent/descent/gradient
  screenshots and walk JSON are the valid grounded traversal evidence.
- `glide-live-auto-before-wall-contact-fix.json` intentionally retains the false
  elevated landing; the after file is the successful repeat.
- `southwest-vehicle-live-after.json` and continuation retain the blocked-pier
  reproduction; `southwest-vehicle-live-fixed.json` is the successful repeat.
- Earlier malformed fixture inventory errors were test-data mistakes, not
  reproduced production loot failures. Latest live sessions had no page errors.
- `scope-lifecycle-invalid-fixture.json` used invalid camel-case weapon IDs and
  stopped its render loop. The subsequent attempted corrected-inventory session
  retained that stalled loop (`scope-lifecycle-stalled-after-invalid-fixture.json`).
  Both are excluded. `scope-lifecycle-live.json` comes from a fresh session with
  canonical IDs and zero page errors. `moving-bot-combat-invalid-input-direction.json`
  used the wrong automation pitch sign; the corrected live file is the valid case.

## Validation status

The previous integrated snapshot passes **1,064 tests / 196 files** and
**14/14 E2E**; subsequent targeted lobby animation/lifecycle E2E passes **3/3**.
Fresh typecheck/build and High/Low production-world cleanup pass after the latest
audio-listener and roof-ramp changes. Cleanup releases 214 geometries, 370 material
references, 135 textures and 1,529 instance batches exactly once in each assembly,
preserving borrowed Sprite geometry. The first latest full-suite run was explicitly
interrupted before completion to repair the newly reviewed loop onset/music scene;
it is not a validation result. Fresh `*-audio-final.txt` integration runs now cover
those corrections; five audio lifecycle tests already pass.
The corrected snapshot now passes **1,070 tests / 197 files in 185.80 s**,
typecheck and build. `full-e2e-audio-final.txt` passes **14/14 in 6.4 minutes**.
The subsequent road-slab and utility-cover presentation changes pass nine focused
tests; their full integration rerun is pending. Cleanup after those changes passes
with 215 geometries, 370 material references, 135 textures and 1,532 instance
batches released exactly once. The connective prop audit also passes unchanged.
Build retains the existing large-chunk warning; no limit was increased.
Earlier complete run: 1,053 tests / 193 files passed before refinements. A later
suite had **1,060 passes / one failure** in the unchanged Classic mixed-match
one-shot-ending test. Five unchanged isolated repeats passed. An 80-case
diagnostic found six legitimate bot repairs immediately before projectile impact
(approximately 1.93–2.30 s vs a 2.30 s impact), invalidating that test's assumed
one-hit elimination. No Classic bot behavior, timeout or assertion was changed.
`classic-mixed-diagnostic.json` records repair→damage event order.

An earlier E2E had **12 passes / two failures**: BR leave/rejoin exceeded its total
deadline under concurrent rendering, and unattended glide flew off-island.
The subsequent full 14/14 run includes the cadence and no-input glide fixes.
Unchanged 10/20/40-player performance cases pass (5/5): mean/p95 ticks in ms are
10: 0.909/1.955; 20: 2.154/4.109; 40: 5.622/9.230, 5.621/9.144 and 5.752/9.066
for the three identity-length cases. Relevant circulation, junction, facade,
connective/primary/secondary prop, landmark and cleanup audits pass within their
recorded scopes. Logs retain earlier failures; green reruns do not fix the Classic
repair race or erase the earlier failed attempts.

`natural-round-resumed.json` records a normal ten-player round with no fixture
mutation: home/lobby → Starliner → freefall/early wings → grounded landing →
Nova Arcade entrance/interior → two loot pickups → through-street → elimination
and spectating → actual results → clean home exit, zero room membership afterward.
Its attempted combat shot was occluded and caused no damage. It did not exercise
vehicle use or rotation through multiple POIs; controlled cases above provide
separate evidence and do not fill those gaps in the uninterrupted round.

Remaining acceptance includes broader road/vehicle locations, subjective audio
listening, remaining filler views, client performance on
weaker hardware, and a natural round including successful combat, vehicle use
and multi-POI rotation. This document and automated green output do not declare
the full pass done.

## Latest live road, utility and remote audio checks

`nova-roadside-production-ray.json` identifies the bright exposed slab in the
actual roadside review camera as `ring-nova-east-surface`, separate from the Nova
Studio roof ramp. Literal canonical road slabs now receive a shared dark side
and underside finish; top geometry, roads and collision remain intact. Before
and after live roadside screenshots are retained. Native walking and skimmer
driving traverse the service grade in both directions (`nova-service-grade-*`).
Uphill walking stays grounded; downhill has short airborne samples, which are
recorded rather than hidden. No blocking occurred at that connection. That live
downhill finding exposed a cadence bug: a 30 Hz walking step descends farther
than the flat path's .08 m contact allowance. A new authority/prediction regression
fails at 30 and 20 Hz before the fix. The fast path now uses its existing .18 m
controller snap range only for a supported road start and an actual nearby next
floor, including the base-deck join. Jumps and unsupported falls retain their old
path. Thirteen focused tests pass, including Zero Point wall contact. The native
repeat (`nova-service-grade-descent-fixed-live.json`) reaches x=-63.46/y=.035
from x=-96/y=5.035 with **39/39 grounded samples and zero browser errors**.
The first attempt did not align native yaw and is excluded as
`nova-service-grade-descent-invalid-input.*`.

Orange utility-cover caps were replaced with sealed service panels, vents and
small status indicators using three existing material batches. The draft counted
only 54 primary covers; the actual catalog contains 123 including secondary and
civic/service covers. The catalog assertion was corrected after its first failure;
all 123 unchanged solids now receive eight shallow supported finish parts (984
instances), with no new collision volume. Live cover-25 views show the result.

`remote-gunfire-two-client-live.json` records actual server-confirmed native-mouse
shots received by a second client. At 20 m the sample graph has gain 0.0924,
cutoff 4,886 Hz and pan +0.90/right or -0.90/left. At 120 m gain is 0.0130 and
cutoff 1,289 Hz; at 220 m no remote voice is created. This verifies routing and
falloff, not subjective headphone/speaker quality. The earlier invalid fixture
used the wrong inventory schema and stopped its render loop; it is explicitly
excluded in `remote-audio-invalid-fixture.json`. The valid fresh clients have no
page errors.

`natural-vehicle-round-*.jpg` records another normal round with no fixture writes:
early wings, grounded Nova landing, west tower entrance, Rail/Pulse loot, real
Nova Transit skimmer, grade descent, Comet through-street, Void entry and escape,
and Zero Point approach. A diagonal route hit Comet Hotel's corner; backing out
and following the street succeeded. A subsequent browser automation timeout
closed the client before Dockyard/results, so this attempt does not certify the
remaining continuous round or successful natural combat. Its in-memory action
log was lost on automation reset; these screenshots and recorded observations
are partial evidence only.

Client debug player entries now include `relevant`: out-of-interest players retain
their last known position/deployment but are hidden by rendering. Previously the
debug output could make old distant airborne bots look stalled. No authoritative
bot movement changed for that observation.

The first road/cover full-suite rerun was interrupted explicitly when the live
descent root cause was found. Its typecheck/build passed, but the incomplete
suite is not a validation result. Fresh full validation is required after the
shared contact fix.

## Late live findings: reticle, helmet, nameplates and near foliage

The road-contact checkpoint subsequently passed fresh typecheck/build,
**1,078 tests / 199 files in 188.86s**, and **14/14 E2E in 6.3 minutes**.
`contact-final-server-performance.txt` separately reruns all five unchanged
10/20/40-player cases. Mean/p95 ticks: 10: .853/1.718ms; 20: 2.045/3.900ms;
40: 5.625/9.181, 5.770/9.671 and 5.735/9.083ms. Worst was 26.168ms;
largest snapshot 34,529 bytes. These results precede the following late fixes;
another complete validation is pending.

Native-mouse close-range testing reproduced a separate combat defect:
`close-optic-before-live.json` has Rail and Pulse shots at four metres with
the reticle on the visible torso, no obstruction, and **zero damage**. The
camera ray aimed at background geometry, so the muzzle ray passed beside the
actual target. Weapon aim now converges onto the nearest living, relevant,
visible enemy hit volume already under the camera reticle and before world
obstruction. Off-reticle targets, teammates and stale entries do not redirect
aim. Pings retain world targeting; muzzle obstruction/server damage checks stay
active. This does not add target snapping.

Actual canonical helmet centers were also outside the old head hit region:
standing 1.46m + .26m rig lift = **1.72m**, crouched 1.46m + .05m = **1.51m**.
`close-optic-helmet-before-live.json` records four native shots at those visible
helmet centers with zero damage. Head centers now match the model; head radius
remains .30m. The lower torso retains .50m width and its existing height. A
narrower .45m-radius upper chest connects it to the corrected head. Downed
coverage and the movement capsule are unchanged. Existing head/miss assertions
were reanchored to the actual helmet height, not removed. New factory-geometry
and muzzle-parallax regressions fail before the fixes (`reticle-alignment-before-tests.txt`).

Live repeats produce distinct body/head results at identical controlled starts:
Rail at 4/12m: **72 body / 108 head**; Pulse at 4/40m: **22 body / 33 head**.
`close-optic-{torso,helmet}-after-live.json` records native input, actual outgoing
shot vectors and authoritative damage. No new damage values or head multipliers
were introduced. These stationary cases are not human balance/latency acceptance.
The six-file focused integration passes **105 tests** in 10.00s.

The user's low bot-name report is visible in the original scope screenshot.
Nameplate placement now caches the actual helmet/visor/antenna bounds and keeps
the full billboard lower edge above their projected top with a .14m gap.
Eight cached corners are transformed per visible label after the current camera
and astronaut pose; no per-frame geometry traversal. Tests cover real canonical
vertices, standing/crouched/glide/freefall/downed poses and close/side/diagonal/
downward views. The after scope screenshot shows the name above the helmet.
Visibility, relevance, team and depth-test rules are preserved.

The Dockyard approach's apparent speckled green ground was instead an extremely
close roadside canopy rendered with alpha hashing. Its upper crown is about
1.26m from the saved camera. Near foliage now clears fully through 2.35m, with
a short smooth fade to 2.5m; the previous maximum-envelope test remains intact.
Tree geometry, placement, scale, trunk collision and foliage beyond 2.5m are
unchanged. `dock-canopy-{before,after}-fov72-live.jpg` and local camera sweeps
reproduce and remove the green fragments over pavement in the actual running
BR renderer. Earlier `dock-canopy-before-*` at 60 FOV crops most of the defect;
the matched 72 FOV pair is the relevant comparison. No blanket line hiding or
terrain edits were used.

`natural-quality-round-no-loot-live.json` preserves the interrupted-acceptance
normal round: early glide/landing, tower doorway, skimmer, Nova grade, Comet and
Dockyard approach. Its old loot search skipped the actual Arc Blaster, leaving
the inventory empty. It has no successful combat; Void eventually eliminates
the pilot and the script closes while spectating, before results. Labels named
`loot` or `round-end` in that file do not prove pickup or completion. The updated
durable runner collects the actual tower loot, follows authored street waypoints
and waits for normal results. Its new evidence remains separate from controlled
fixtures. The broader pass remains open.

The subsequent `natural-quality-round-live.json` completes a normal ten-player
round without fixture writes. Native input deploys early wings, lands at Nova,
enters the west tower, picks up an Energy Saber and Pulse Rifle, enters the real
skimmer, descends the Nova service grade, and reaches all eleven street-route
waypoints through the Comet/Dockyard approaches. The pilot is eliminated while
walking toward distant bots before firing; `combat` is empty. This is traversal
and lifecycle evidence, **not successful live combat acceptance**. Spectating
continues to actual `results`, then the real leave button returns home with
pointer lock false and the server reporting zero rooms. There are no page errors;
recorded input has 1,467 trusted key events, 855 trusted mouse events and zero
untrusted input events. Controlled scoped body/head damage remains separate.

The initial final-metrics runner used the home settings button during gameplay,
where that button is correctly hidden. Its timeout and empty report are retained
as `contact-final-client-metrics-invalid-settings-path.*` and excluded from
performance claims. The corrected runner opens the real pause menu, Settings,
Done and Resume for each existing quality selection.

Fresh validation with the reticle, helmet-hit-region, nameplate and canopy
changes passes typecheck, production build and **1,087 tests / 201 files in
187.41s** (`reticle-final-{typecheck,build,test}.txt`). The fresh browser run passes
**14/14 E2E in 6.0 minutes**. The separate unchanged server-performance run passes
all five cases: mean/p95 ticks 10: .833/1.605ms; 20: 2.141/4.347ms;
40: 5.608/9.524, 5.485/9.210 and 5.776/9.408ms. Worst tick is 23.517ms and largest
snapshot 34,319 bytes. Existing mean16/p9545/worst150ms and 160,000-byte budgets
are unchanged. Resource cleanup passes High and Low (215 geometries, 370 materials,
135 textures, 1,532 instance batches released exactly once); the connective audit
passes four groups / 28 meshes / 1,134 instances with zero hits. Exact source hashes
for 398 source/asset files are in `reticle-final-source-manifest.json`.

Reticle-checkpoint client measurements are in `contact-final-client-metrics.json`,
`reticle-final-combat-client-metrics.json` (armed/active),
`reticle-final-unarmed-combat-client-metrics.json` (matched unarmed) and the
compact `reticle-final-client-summary.json`. All measured medians are about
16.7ms, p95 about 16.8ms, on the same RTX 3060 at 1440×900 DPR1. This is a VSync
ceiling, not a demonstrated frame-rate improvement on weaker hardware. World
material count is 298. High renders 1440×900, Medium/Auto 1296×810, Low 1036×648.

| Final scene | High calls | Medium calls | Low calls | Auto calls |
| --- | ---: | ---: | ---: | ---: |
| Fixed aerial | 1112 | 1046 | 993 | 1046 |
| Nova exterior | 443 | 328 | 258 | 321 |
| Mall interior | 405 | 313 | 248 | 294 |
| Nova roadside | 360 | 265 | 189 | 227 |
| Storm boundary | 475 | 411 | 319 | 399 |
| Zero plaza | 524 | 410 | 320 | 358 |
| Aligned unarmed nine-bot combat | 1029 | 427 | 329 | 427 |

The six world cameras match the historical cameras exactly, but the historical
local-player position differs by 565.26m and bot states are not identical.
Their whole-frame deltas therefore do **not** isolate a world optimization.
Within each final preset sweep, placements remain fixed. All raw increases as
well as decreases are retained. In particular, Low's fixed aerial cost remains
high and is an open optimization target.

The separately aligned combat case matches local position, unarmed inventory
and camera within 1cm. Original High/Medium/Low calls 1170/544/402 become
1029/427/329, reductions of approximately **12% / 22% / 18%**. Final triangles
are 479949/341177/292285 versus 475821/408867/285879; triangles did not decrease
on every preset. Native pause-menu selection and mouse realignment are used.
The first final runner's combat camera was wrong after Settings; its misleading
`combat-matched-camera-nine-bots` label is explicitly excluded in the summary.
The moving Starliner samples are not a fixed-view before/after comparison.

`aerial-draw-attribution.json` measures temporary category render masks in the
actual final client. The masks are restored immediately after each draw and
do not change gameplay or production source. Low's 993 calls become 689 without
eight skimmers (**304 calls**), 839 without 22 crates (**154**), 926 without the
transport (**67**) and 957 without six rotors (**36**). High's 1112 becomes
808/957/1045/1076 respectively. Initial `*-invalid-hook.*` output failed to
intercept Vite's timestamped module URL; its missing hook counters are excluded.
The corrected runner asserts hook execution and records masked object counts.
These measured costs justify the next isolated skimmer batching change; they
are not themselves an optimization.

The subsequent isolated skimmer change instances compatible opaque static parts
within their existing animated root. Box dimensions become exact instance
transforms; other shapes only batch when they share geometry. Material, shadow,
layer, render-order and attribute policies remain separate. Glass, glowing
transparency, moving pods, light references and driver/seat anchors stay intact.
Named source meshes remain hidden descriptors for existing inspection/raycast
APIs. Batches borrow existing resources; their instance buffers release once
before the original owned geometry/material disposal. No authoritative files or
vehicle dimensions changed.

Eight focused tests pass, including real-model transformed vertex/normal/UV/index
parity through animated poses and exact lifetime checks. Client typecheck passes.
`skimmer-batch-{before,after}-live.json` and screenshots use identical controlled
placements and aerial/side/front/rear views. Before disables only the new helper
through a test-only browser route; it does not overwrite the local working tree.
Actual aerial calls drop **1112→1032 High / 993→913 Low**, exactly **80 fewer**
for eight visible vehicles. Triangle counts stay **273297 High / 219663 Low**.
Close-view triangle counts also match; reviewed side/front screenshots preserve
the model, with expected time-varying pod bob. Native E entry succeeds in both
runs; W driving reaches z=-211.86/-211.91 from -196 at the same y=6.06 without
page errors. These are controlled traversal checks, not human driving feel.

The exact validated reticle/nameplate checkpoint is preserved separately in
`reticle-checkpoint-validation.json`. Full validation is being rerun for the
skimmer integration under `skimmer-final-*`; do not attribute the preceding
1,087-test run to this later source change. The subsequent source passes fresh
typecheck/build and **1,090 tests / 202 files in 185.96s**; browser E2E is still
running at this entry.

## October 11 continuation

Execution is still on DESKTOP-JL99F36, with HEAD unchanged at e10fafb and the
complete dirty working tree preserved. The overnight local-process shutdown
interrupted `skimmer-final-test-e2e.txt` after its eleventh reported pass; that
partial log is retained and is not counted as a complete E2E run. Fresh browser,
unchanged server-performance and cleanup/connective audit results are written to
`skimmer-final-oct11-*`. The completed typecheck/build and 1,090-test / 202-file
run precede the interruption. A new 400-file source manifest captures the exact
skimmer integration and will be checked again after validation.

The rear skimmer screenshots were also reviewed alongside the prior side/front
views; opaque construction is preserved, with expected animated pod differences.
A separate read-only crate review confirms seven main-pass calls per closed
crate, including a four-corner instance batch. Combining the static lock base
with that existing batch could save one call per crate. Global opaque batching
could save more but requires preserving individual frustum/shadow culling and
the 190ms opening transient. No crate change has been made in this checkpoint.

The resumed skimmer checkpoint passes all **14 E2E in 6.8 minutes**, all five
unchanged server-performance cases and both cleanup/connective audits. Mean/p95
ticks:10 1.021/2.101ms;20 2.264/4.773ms;40 5.760/9.922,6.164/11.862,
5.828/9.353ms. Worst24.582ms,max snapshot34319bytes, budgets unchanged.
`skimmer-checkpoint-validation.json` binds these results to400source hashes.

The separate eightfold CPU-pressure runs do **not** show a frame-time improvement:
High median116.8→133.3ms,p95150.1→166.6ms;Low median100→116.6ms,p95133.3→133.3ms.
High calls1112→1032 with273297triangles unchanged. Low calls993→906 and triangles
219663→219271 include extra dynamic-scene differences beyond the80-call skimmer
reduction; they must not all be attributed to batching. Player position and review
camera match exactly, but complete dynamic scene parity and thermal/order effects
were not established. Preserve the negative results. Draw-call savings are proven
by the separate exact model and visual-pair checks; a client frame-time benefit
and weak-hardware acceptance remain unproven.

## Larger BR HUD — October11

User feedback requested a larger hotbar, HP/shield and minimap. BR-only CSS now
uses128×78desktop slots,12px two-line names,13px ammo,300px vitals with13px text
and12px bars, and a200px minimap. Compact slots are82px tall and responsive in
width. The health/map-button/loot/context lanes adapt below1320px. The minimap
uses160px on narrow screens and144px at short heights. Altitude, kill feed and
map-button placement follow the resized map.

Actual headed gameplay UI checks found and fixed1280px vitals/hotbar overlap,
short-view map-button/altitude overlap,narrow connection/status overlap,desktop
item-name truncation,and narrow two-line name/ammo overlap. Initial reports and
screenshots are retained. Final `hud-size-oct11-v3-live.json` checks28ground,
loot and descent views across12sizes (3440×1440 through390×390), zero tested
rectangle overlaps/out-of-bounds and zero page errors. Desktop,narrow loot and
short descent screenshots were visually reviewed. Fixture placement/inventory
controls make these UI checks; they are not natural combat or world-overlap QA.

Typecheck, final production build and the existing BR Solo/map responsive E2E
pass (1test,39.8s). The preceding full1,090-test/14-E2E checkpoint remains the
code validation; onlystyle.css changed afterward, verified against all400hashes.
`hud-checkpoint-validation.json` and `hud-final-source-manifest.json` preserve
that distinction. No commit,push or deploy. The subsequent user attachment asks
for coordinated astronaut locomotion and held-item animation without redesign
or authoritative movement changes; this new presentation work is starting next.

## Coordinated astronaut motion — October 11

The existing canonical astronaut has an identity upper-body parent, retaining
the bind mesh transforms, geometry, materials and dimensions. The arms and
legs retain their existing meshes; no elbow/knee redesign or IK was introduced.
Identity ankle parents keep the original boot/sole bind transforms while
allowing level feet. Scalar crouch support compensation removes the observed
boot penetration without changing the collider or authoritative foot point.
`astronaut-motion.ts` blends a velocity-driven step phase, opposite arm/leg
rhythm, acceleration/braking/turn lean, belt-height upper-body motion, helmet
counter-rotation, restrained breathing/weight shift and airborne/landing
response. BR and Classic integrate the same presentation helper. Authoritative
movement, collision, networking and aim code are unchanged by this animation
work. Existing landing feedback suppresses an additional impact dip.

Weapon/heal models share the upper-body parent. Final glove anchoring runs
after reload/heal arm posing. Rifle/heavy, melee and utility carry differ;
ADS strongly reduces upper-body motion while retaining lower-body steps.
Freefall, Ion Wings, downed, vehicle and emote poses retain priority. Teleports
reset velocity derivatives, angular deltas wrap, and near/far/skip motion
follows existing quality-dependent LOD. Impostors skip held-item refinement.
Forty-actor controller-only CPU measurements are recorded separately from
rendering performance; no client FPS improvement is inferred from them.

Initial before/after clips and reports are retained. Their reload/heal labels
were not actual action acceptance: the first script used Q rather than E for
healing and had full HP. The v2 native action run verified real actions but
four-angle review found its rifle carry embedded inside the chest. Gloves
were brought forward and a focused clearance regression added. The v3 run
was interrupted by a deliberate source edit triggering Vite reload, not a
diagnosed gameplay failure. The complete v4 run captures model-relative front,
back, side and diagonal views for idle, crouch walk, run, sprint, four item
categories, emote, vehicle, freefall and Ion Wings, with native reversal,
turn/strafe, jump/landing, moving ADS fire, reload and healing. Actual authority
confirms ammunition spent, reload refill and med-kit HP restoration. Screenshots
and WebM captures are under `astronaut-motion-actions-v4-*`; source instrumentation
only exposes state and review cameras in the ignored review runner.

Review cameras and controlled starting inventory/position/damage make this
animation evidence, not human natural-match acceptance. The existing rigid
arms limit precise two-hand foregrip articulation. Whole-island art,
natural combat/control feel and weaker-hardware rendering acceptance remain
open. No commit, push or deployment. The first full regression passes typecheck,
build and 1,100 tests across 203 files, but its E2E run finishes 13/14 after
the BR lobby leave/rejoin flow exhausts the original 90-second deadline.
The unchanged isolated test passes in 53.1s with a retained trace. Individual
create/leave actions cost roughly 4.7–6.8s and screenshots 2.8–3.2s in that
diagnostic; this does not establish the initial timeout's cause or repair it.
The later crouch/ankle correction requires a new frozen-source regression.
Final results will be recorded in `astronaut-checkpoint-validation.json`.

Final `astronaut-motion-actions-v6-live.json` adds actual boot bounds through
crouch, controlled downed/crawl review, and fresh action/flight/vehicle checks
after the ankle correction. The original feet-forward crouch put soles below
the surface; level ankle transforms and scalar support compensation keep
the crouching boots above the actual floor. Focused tests measure all original
boot/sole vertices across the crouch gait instead of checking only a centerline.
`astronaut-bind-preservation.json` separately compares every world vertex,
index and material finish of all31neutral canonical meshes against HEAD,
matching within1e-9. No design assets, dimensions or movement rules changed.

The final motion changes are confined to the shared client astronaut builder,
the presentation helper/tests and BR/Classic integration. Relative to the
preceding HUD checkpoint, no shared/server source was changed and all prior
spatial, loot, combat, audio, UI and performance recovery work is preserved.
The v6 run records81pose/action checks with zero page errors; all four
crouch views have actual minimum boot/sole heights at or above0.01m.
The final frozen-source unit run passes1,101tests across203files in187.85s.

Final checkpoint: typecheck/build pass, all14E2E checks pass in5.8minutes,
all five unchanged10/20/40-player server performance cases pass, and production
High/Low world cleanup passes. All402source/config/media hashes match the
validation record; the three changed preceding-checkpoint sources are
`astronaut.ts`, `game.ts` and `br-game.ts`, with the motion helper/tests added.
`astronaut-checkpoint-validation.json` preserves complete results, initial
failed E2E evidence and the unchanged isolated trace. Passing final E2E does
not establish repair of the earlier timing failure.

Quiet controller-only40-actor CPU medians: near0.0656ms, far0.0597ms,
skip0.0164ms over3,600frames after warm-up. This excludes rendering, matrix
traversal and gameplay; it is not an FPS improvement claim. Existing canonical
aim/reticle and deployment tests pass alongside actual moving ADS ammunition
spend, reload refill, healing, vehicle and flight review. Whole BR recovery
and human art/control-feel acceptance remain unfinished.

## Client profiling and Nova navigation recovery — October 11

This continuation started on DESKTOP-JL99F36 at HEAD
`e10fafbb8c27463187f2a2623233a56dbc717c99`, with 88 Git status entries,
51 modified tracked files and an empty index. The dirty recovery work was
preserved. No reset, restore, stash, commit, push or deployment was performed.

An actual headed ten-player round used native keyboard/mouse input and no
server state mutation. It covered home/lobby, Starliner, early wings, Nova
landing, a workshop entrance and real loot, vehicle entry and four road/grade
legs, scoped combat, storm elimination, results and clean return home. A
Rail shot against a live bot at approximately 28.6m registered an authoritative
100-damage headshot and elimination. The run records 1,417 trusted keyboard
and 863 trusted mouse events, no untrusted events or page errors. This is
automated native-input evidence, not human control-feel acceptance.
`natural-quality-round-oct11-live.json`, its JPGs and WebM directory retain
the complete run, including the failed onward rotation described below.

Continuous route replanning at Nova's northeast bend oscillated between the
incoming road and a nearby parallel road. Selecting a globally nearest node
mid-bend changed the route's source and reversed progress. The shared waypoint
helper now selects source nodes on the road underfoot and reaches the joining
endpoint before changing streets. Exact centerline ties prefer the wider road;
off-road and unreachable-route fallbacks remain. No road, collision, movement
or navigation-node geometry changed. A first focused test exposed the numerical
tie case before correction. Shared regressions and actual Rapier authority/
prediction traversal at 30/60 Hz cover the reproduced route. The separate
native client traversal reaches within 0.287m of the bend and continues onto
the outgoing grade while grounded (`native-navigation-progress-oct11.json`).
This validates this confirmed route, not every bot route on the island.

Client CPU profiles identified repeated matrix traversal through fixed island
objects and hidden interiors. The completed gameplay island now updates only
moving machinery/label roots; home preview retains normal movable transforms.
World-matrix and raycast parity tests compare every matrix element with normal
Three traversal across 120 moving/visibility frames. The repeated ABBA client
comparison (`static-world-ab-profile-oct11.json`, 60 samples) records zero
matrix mismatches or page errors. Under 4x CPU pressure, island matrix work
falls from roughly 1.2–1.6ms to 0.2–0.3ms. Most frame medians remain unchanged.
Unthrottled RTX 3060 measurements remain limited by 60Hz display timing and
do not establish an FPS gain or weaker-GPU acceptance.

The isolated Astra presentation helper borrows ten canonical skimmer
silhouette/light meshes for distant vehicles, without duplicating geometry,
materials or authoritative state. Sol integrates distance selection into the
existing presets: High 260m, Medium 180m, Low 100m, with 25m hysteresis and
full detail for the locally driven vehicle. Wrapper cleanup precedes canonical
resource disposal. Actual renderer side/front/rear and 110m preset screenshots
are retained in `skimmer-lod-visual-oct11-v2-*`; close forced-far views are
deliberate silhouette review rather than natural distance-policy evidence.

The complete skimmer ABBA comparison (`skimmer-lod-ab-profile-oct11-v2.json`)
contains 60 samples across five scenes and three presets, with zero page
errors. Aerial draw calls drop by 136 in every preset. High aerial frame
medians under 4x CPU pressure improve from approximately 66.6ms to 50ms;
Medium/Low aerial medians remain 50ms. Ground views show smaller call savings
and generally unchanged frame medians. `quality-oct11-performance-comparison.json`
records each view. All eight vehicles remain present, and native entry,
approximately 16m driving and exit pass after measurement. CPU throttling
does not reproduce an integrated GPU or prove universal performance gains.

Excluded attempts are retained: the initial client profile had invalid review
view IDs; the first skimmer AB run was interrupted by a source-edit Vite
reload; the first silhouette runner used an incorrect vehicle ID. Complete
corrected reports use the v2 filenames above. No budgets or tests were relaxed.
Frozen-source full validation is recorded in `quality-oct11-*` logs and the
source manifest/verification. Whole-island composition, broader natural
combat/glide/audio feel and weaker-hardware acceptance remain unfinished.

The frozen-source regression passes typecheck/build, 1,112 tests in 207 files
(202.94s), all 14 E2E checks (6.5 minutes), all five unchanged server performance
cases (19.65s), and both High/Low world cleanup cycles. The 40-player mean ticks
are approximately 5.99–6.14ms with p95 10.00–10.06ms. All 387 source/config/media
hashes in the current validation scope match afterward. A separate actual-file
comparison against the preceding 402-file checkpoint confirms no missing files
and only the five intended existing-source changes: `br-game.ts`,
`br-static-transforms.ts`, its test, `settings.ts` and shared `map.ts`.
The six new helper/test files are included in the current manifest.
`quality-oct11-checkpoint-validation.json` consolidates results and limitations.

### Landing rollout discovered by the fresh round

The post-integration v2 natural round opened Shop/trails, Planet Pass and High
settings, and confirmed a lobby-background click did not capture the cursor.
Its drop then exposed an actual landing-control problem. Approximately 32m/s
of remaining Ion Wings speed became ground movement, carrying the pilot off
Nova's raised street before the first walking route. Subsequent `loot`,
`vehicle-enter` and route labels were attempted stages, not successful actions:
inventory stayed empty and no vehicle was entered. The raw v2 runner's
`passed` field checks results/home lifecycle only. The consolidated checkpoint
explicitly records failed gameplay acceptance; do not cite that field as a
successful playthrough. No page errors occurred, and clean results/home exit
still passed. Screenshots/video retain the failure.

Actual authority/prediction reproduction at `(-98.5,5.24,-158)` with 38m/s
flight and released controls coasts 15.17m at 30Hz or 16.12m at 60Hz and falls
to the lower deck (`glide-landing-contact-oct11-before-v2.json`). A preceding
safer starting point, `-103`, is retained in the original before report; it
coasts approximately 14m but stops just within the edge. The new regression
first fails with the unmodified 38m/s touchdown speed (`glide-landing-oct11-red.txt`).

Only actual landing from freefall/Ion Wings now dissipates excess speed to
the existing 11.2m/s sprint bound, retaining the planar direction and smaller
incoming speeds. Airborne acceleration, glide ratio, steering, collision and
normal jumps are unchanged. At the reproduced closer edge, rollout is now
1.07m/1.16m and remains grounded on the raised street at 30/60Hz, with zero
authority/prediction disagreement (`glide-landing-contact-oct11-after.json`).
Focused landing, flight, hit-region and vertical-wall regressions pass 12 tests.
The earlier frozen-source full suite predates this additional change; fresh
validation is recorded separately with the `quality-oct11-landing-final-*`
prefix. The v3 natural runner checks actual loot, vehicle entry and combat
in addition to lifecycle, rather than trusting stage labels.

`natural-quality-round-oct11-v3-live.json` records the complete fresh match
after the landing fix: actual workshop loot (plasma launcher/med patch), native
skimmer entry, all four intended Nova/grade/main-deck road legs, native exit,
23 plasma firing bursts, storm elimination in second place, results and home
with pointer lock released and zero remaining server rooms. It records 972
trusted keyboard and 479 trusted mouse events with no untrusted events/page
errors. Shop trails, Planet Pass and High settings screenshots were reviewed.
The vehicle approach toward a bot stopped at an actual building; the combat
screenshot shows the aim directed into that wall toward bots behind it.
Authority correctly registered zero damage. This is obstruction/action/lifecycle
evidence, not successful exposed-target combat or whole-match human acceptance.
The earlier natural Rail headshot remains separate direct hitscan evidence.

Read-only Astra review of the new Nova ground screenshot identified weak
architectural hierarchy: repeated dark window grids and tiny roof accents
provide little entrance emphasis. A proposed next isolated treatment would
replace existing accent parts with measured doorway markers and district-painted
frontage frames, retaining part/material budgets and all authoritative openings.
No additional facade code was changed during this checkpoint. This remaining
art concern is explicit rather than hidden behind green automated validation.

### October 11 — route-billboard camera clearance

The landing-fix checkpoint passed fresh typecheck/build, 1,115 tests in 208
files (202.85s), all 14 E2E checks (6.2 minutes), the five unchanged server
performance cases (20.60s), and High/Low cleanup. All 388 frozen source hashes
matched afterward (`quality-oct11-landing-final-source-verification.json`).
Those logs predate the additional route-label fix below.

Review of the natural v3 Zero Point road view reproduced a huge white flare.
A read-only renderer diagnosis retained it with bloom disabled and isolated
it to the island: the 17m-wide route Sprite at `(0,5.2,-72)` was only 0.68m
from the camera. This was an oversized navigation billboard, not storm,
tracer or road geometry. The other two route billboards shared the risk.

The three route annotations now hide inside 18m, ease into visibility by 32m,
remain visible through 160m, then fade out by 200m. Each has its own owned
material so fading cannot modify a cached facade sign. No authoritative
geometry, collision, roads, lights, general Sprite visibility or gameplay
state changes. The isolated Astra helper is integrated/reviewed by Sol.

`zero-point-flare-fixed-oct11-normal.jpg` reproduces the exact failing camera
with the obstruction removed. Its five diagnostic variants have zero page
errors. `wayfinding-assembly-oct11.json` passes 99 actual assembly checks
covering all three signs, three quality presets and 11 camera distances;
unrelated sign opacity and separate material ownership remain intact.
`wayfinding-native-oct11.json` passes live camera walking checks at all three
sites (nearest camera distances 7.58m / 16.31m / 7.31m), with zero page errors.
Each site uses one controlled initial placement and frozen bots/storm;
screenshots/video are automated input evidence, not human feel acceptance or
certification of all adjacent road/elevation geometry.

The first rerender attempt failed because the isolated server was stopped;
its report remains as `zero-point-flare-fixed-oct11-connection-failed.json`.
The first regression script used legacy Windows PowerShell, which treated
Vite's existing chunk warning on stderr as a terminating shell error after
typecheck/build succeeded. Its logs use `quality-oct11-wayfinding-windowsps-*`.
The corrected PowerShell runtime runs unchanged validation commands with
`quality-oct11-wayfinding-final-*` logs. No test assertion/deadline/budget was
changed. The whole recovery pass remains unfinished and uncommitted/unpushed.

The first corrected-runtime full suite passed 1,118 tests and failed the one
world-lifetime fixture: it creates a renderer via `Object.create` and did not
initialize the newly introduced `wayfindingLabels` field. The fixture now
includes a retained Sprite in that collection and asserts the collection is
cleared, preserving and extending all existing disposal checks. Focused
lifetime/presentation tests pass 5/5. The failed full-suite log is retained;
replacement frozen-source validation uses `quality-oct11-wayfinding-final-v2-*`.

The first native sign walk used the floor-height helper with an incorrect
JavaScript argument shape, which fell back to the base deck rather than the
intended supported initial surface. Its reports/video remain diagnostic,
not accepted elevation/traversal evidence. The corrected fixture uses the
canonical Vec3/previous-height signature; its results use the separate
`wayfinding-native-oct11-v2` prefix. The renderer-only exact failing camera
and 99 production assembly checks are independent of this fixture mistake.

The corrected-height v2 walk reached the first two signs but failed the third:
its native mouse harness reused absolute coordinates between sites and turned
away from the intended approach. That report remains failed. The v3 harness
tracks cumulative native pointer coordinates between sites; it passes all three
supported-surface approaches with nearest camera distances 7.13m / 7.84m /
7.93m and zero page errors (`wayfinding-native-oct11-v3.json`). No production
input or movement rules were changed for these fixture corrections.

Final route-label regression passes typecheck/build, 1,119 tests across 209
files (202.03s), 14 E2E checks (6.4 minutes), all five unchanged server
performance cases (19.63s), and High/Low cleanup. All 390 frozen source hashes
match (`quality-oct11-wayfinding-final-v2-source-verification.json`). The
40-player mean ticks are 5.86–6.05ms, p95 9.86–10.59ms. All budgets remain
unchanged. The preservation comparison lists only world integration and its
teardown fixture changed relative to the landing checkpoint, plus the two new
presentation helper/test files. HEAD and empty staging index are unchanged.

A subsequent ignored-only facade prototype can find 214 geometrically clear
replacement slots across 107 buildings, but Nova cafe puts them ±8.585m from
the entrance center. That fails entry-recognition intent despite clearance.
It is not integrated or accepted. The next candidate instead investigates
small LED surfaces mounted on the existing doorway posts, with no new props.

### October 11 — doorpost LED entrance identity

The first generic facade-marker prototype was rejected: its safe slots were
near building corners rather than entrances. The revised treatment derives
small 0.08 x 1.4 x 0.02m LED surfaces from the actual doorway posts, leaving a
0.002m mounting gap. It replaces existing accents and retains the complete
4.8m authoritative aperture. Readonly authoritative wall footprints, glazing,
headers, signs and other attachments constrain every selected replacement.
The existing cornice LED helper is unchanged. Storefront uprights retain their
exact transforms and chamfered geometry, but reuse existing architectural paint.

Astra owns the isolated selector/composition/tests; Sol owns mixed renderer
routing, elevation, review and validation. Canonical facade skin composition
is shared with the existing overlap audit, so the audit sees the actual new
marker positions rather than a separate idealized representation.

`facade-identity-assembly-oct11.json` compares complete production assemblies
against compiled dirty-working-tree modules saved before this change. All
64,411 mesh/instance signatures remain accounted for: exactly 214 old accent
transforms are replaced by 214 supported post surfaces, all other geometry,
normals, indices and world matrices remain unchanged, and all 1,276 existing
cornice LED signatures remain. Total instances stay 64,058 and material
references stay 298; five obsolete empty instance batches disappear.
These are scoped assembly comparisons, not universal visual correctness.

Six matched before/after static views were reviewed. `facade-identity-static-
comparison-oct11.json` records 0–3 fewer draw calls and unchanged/slightly lower
triangle counts. These one-shot world-only renders exclude live gameplay,
shadows and bloom and do not establish an FPS improvement. The existing
performance comparisons retain their original pre-identity source scope.

`facade-identity-native-oct11.json` passes actual High client/server/camera
walking through and back out of Nova cafe (south), Nova market (east), Zero
relay (west) and Dock customs (north). Each uses one controlled initial
placement, frozen bots/storm and native keyboard/mouse input. Reviewed live
screenshots include actual bloom and show readable entry LEDs. There are
zero page errors. This is scoped automated traversal/visual evidence, not a
natural round or human art/control-feel acceptance.

The existing facade/building audit checks 189 structures, 17,766 envelope
pairs and 28,138 facade/attachment boxes with zero flagged intersections.
Focused post/skin/facade/cornice/intersection/lifetime tests pass 25/25 in the
parent run; Astra's additional existing Solar/attachment checks also pass.
Typecheck passes. Frozen-source full validation uses the new
`quality-oct11-facade-final-*` prefix; previous validated checkpoint logs remain.
No collision, roads, loot, map size, authority, networking, astronaut design
or Classic/Chaos behavior was changed. Broader silhouettes, interior character,
connective composition and human/weak-hardware acceptance remain unfinished.

Final facade checkpoint validation passes typecheck/build, 1,127 tests across
211 files (208.68s), 14 E2E checks (6.5 minutes), all five unchanged 10/20/40-player
performance cases (19.76s), and High/Low world teardown. All 393 frozen source
hashes match. The 40-player mean ticks are 6.03–6.19ms, p95 9.79–10.33ms.
`facade-prior-work-preservation-oct11.json` compares against the route-label
checkpoint: only facade skin and mixed world integration changed, plus three
new focused helper/test files. HEAD remains e10fafb and the staging index is
empty. No commit, push or deployment was performed.

### October 11 — gravity-column opacity recovery (in progress)

The actual High Zero Relay doorway view exposed an overly bright foreground
lift column. Source inspection found that the authored 0.14 additive opacity
was overwritten every frame with a 0.29–0.61 pulse. All three columns shared
one cached material, registered three times with conflicting phase writes.
The isolated presentation helper restores a restrained 0.105–0.175 pulse and
mixed integration registers the shared material once. Rings, bloom settings,
geometry, collision and traversal authority are unchanged.

`gravity-column-before-oct11.json` and three matching High gameplay screenshots
capture the original defect at controlled world times and a fixed camera.
The after runner also exercises native movement into the lift. These use
controlled initial placement/frozen bots/storm, and do not establish human
control-feel or whole-island art acceptance. Results and validation follow.

The first fixed-camera screenshots missed the world and are retained as failed
visual evidence. The v2 pair uses the working native doorway camera; its before
variant replays the exact old opacity formula in an ignored browser observer.
The shaft is visibly more transparent with unchanged rings and bloom. No FPS
claim is made from these single-frame render counters.

Native movement then exposed a separate authoritative defect: the 15m/s impulse
rose only about 4.4m, far short of the authored 21–25m lift destinations. New
30/60Hz authority/prediction regressions failed all six cases before correction.
Launch velocity now derives from gravity and remaining authored rise, with a
1.25m crest allowance for discrete integration. Nova's existing device was
inside Tower B beneath its upper floors; it moves to the clear north court
(-140,-150), with matching target, renderer and reserved placement data.
No building/floor collision is removed to let the lift pass through it.

All nine lift height/parity/corridor regressions and three opacity tests pass.
`gravity-lift-native-oct11.json` exercises all three lifts using actual native
input, authoritative server and High renderer: peaks 25.62/26.61/31.58m against
targets 25/26/31m, zero page errors. Six approach/crest images were reviewed.
These controlled placements are not a natural round or human feel acceptance.
Full validation is running under `quality-oct11-gravity-final-*`; the preceding
facade checkpoint remains separately validated and unchanged in its evidence.

`nova-panel-before-oct11.json` attributes the blank white interior boards to 18
actual Tower B instances, with reproduced loot-position screenshot. The visuals
agent reached its usage limit before implementing the proposed supported service
panel replacement. That architectural refinement remains open; no placeholder
candidate is integrated or claimed finished.

Correction: ignored Tower B helper/test files were saved before the agent's
usage-limit failure. Four candidate tests pass, but they are not production
validation or visual acceptance. Exact assembly attribution is 18 original
panels. A preliminary authored-wall/floor/ramp check accepts 14 replacements;
other dressing/loot support and actual rendering still require integration QA.

The first full gravity validation passes typecheck/build but fails 2/1,139
tests: the existing Classic mixed-match end timeout and a genuine new Nova
promenade clearance conflict. The first moved lift was only 5.83m from its
11.1m-required pocket clearance. A second candidate cleared the pocket but
the unchanged new full-height corridor check found nearby cover-3. Neither
failure was bypassed or weakened. Final Nova position is (-134,-140), with
matching target. Focused map/pocket/lift/opacity checks pass 69/69, and the
unchanged 16-test multiplayer app file passes on recheck. That rerun does not
establish the failed run's exact cause; the previously captured bot repair
race remains a known possibility.

`gravity-lift-native-v2-oct11.json` supersedes the first moved-location walk:
all three final-location lifts pass, peaks 25.57/26.54/31.62m, targets
25/26/31m; three trusted key and 22 trusted mouse events, zero untrusted events
or page errors. The final Nova approach/crest images were reviewed. Frozen
source validation now uses `quality-oct11-gravity-final-v2-*`. No reset,
restore, stash, commit, push or deployment occurred.

The v2 full unit run passes 1,139/1,139 tests across 213 files (197.44s).
E2E was intentionally interrupted during startup to inspect the isolated
interior candidate; that interrupted command is not a passed E2E run. Source
remained unchanged. E2E restarts under `*-test-e2e-resumed.txt`, then runs the
unchanged performance and cleanup checks and verifies the original source
manifest rather than recapturing a different source state.

The Tower B candidate is rejected: complete production kit descriptors, actual
wall/floor/ramp bounds, existing dressing and loot volumes reject every proposed
replacement (`nova-panel-candidate-contract-oct11.json`). A separate browser-only
removal of the 18 white boards leaves a bare dark wall in the reviewed actual
High view (`nova-panel-candidate-oct11.jpg`), so that removal is also rejected.
No candidate/interior source change was integrated. A useful supported interior
design remains unfinished; this evidence must not be labelled a finished fix.

Final gravity checkpoint: typecheck/build pass; full unit/integration passes
1,139/1,139 across 213 files (197.44s). The fresh resumed E2E run passes 14/14
in 6.4 minutes. All five unchanged 10/20/40-player performance cases pass
(29.51s); 40-player mean ticks 5.63–5.88ms, p95 9.06–9.96ms. High and Low
teardown release 215 geometries, 370 materials, 135 textures and 1,527 instance
batches exactly once, retaining borrowed Sprite geometry. All 396 frozen source
hashes match; the only production changes relative to the facade checkpoint
are world integration, shared map and shared movement, plus three helper/test
files (`gravity-prior-work-preservation-oct11.json`). Earlier failures and
interrupted E2E logs remain intact and are not relabelled as passes.

Final facade audit checks 189 structures, 17,766 building pairs and 28,138
attachment boxes with zero flags. Actual renderer prop audits pass primary
(9 groups), secondary/transition (43 groups), and connective (4 groups) scopes.
These bounded scopes do not prove every world mesh or player-height composition.
No tests, budgets, deadlines or clearance requirements were weakened.

The narrower ignored interior prototype avoids the retained dado and passes
five focused checks; authored support permits 14/18 panels. It still needs an
actual render comparison and integration review, and is not a shipped fix.
Current production interior remains intact. Whole pass, human control/audio/art
acceptance and representative weak-GPU performance acceptance remain open.
HEAD is unchanged, staging remains empty, and no commit/push/deploy occurred.

## Tower B service-panel refinement — October 11

The narrower prototype is now integrated for `nova-tower-b` only. Fourteen of
18 broad white boards become dark maintenance cassettes with three cartridge
faces and separate narrow status cores. Four upper boards remain because actual
slab/stair clearance rejects their replacements. The backing is 2.15m high,
above the preserved lower dado, and begins 2mm inward from the actual shell wall.
All non-board interior dressing, loot and authoritative geometry remain intact.
The change adds 84 instances to existing batches, with no new geometry,
materials, textures or point lights. This is not a demonstrated FPS improvement.

The actual High comparison (`nova-panel-after-v2-oct11.jpg/.json`) passes with
four retained originals and no page errors. Reviewed ground-floor views show
the cassette appearance; upper traversal captures expose very close astronaut
framing near walls, which remains an open camera issue. Screenshots alone do
not establish human gameplay/art acceptance.

The active-player walkthrough (`nova-tower-walk-v2-oct11.json`, 19 JPGs and video)
enters from outside, collects a shield battery, climbs both ramps across their
real top landings, visits all three floors, descends and exits. All 19 route legs
pass with 258 trusted keyboard and 271 trusted mouse events, zero untrusted
events and zero page errors. One initial placement and frozen bots/storm scope
this as controlled browser traversal, not an unassisted natural match or human
feel acceptance. The first route cut diagonally off the top landing and failed;
its report/video remain intact. The corrected route changes no stair geometry.

Focused production tests pass 14 checks across four files. The initial integration
typecheck failure (plain coordinates instead of Three.js vectors) and first
renderer assertion failure (expecting zero instead of four retained boards) are
preserved, alongside corrected passing checks. Final checkpoint typecheck/build
pass, 1,145 tests across 215 files pass (210.26s), and all 14 E2E cases pass (5.9m).
All five unchanged server performance cases pass (18.61s): 10-player mean/p95
0.907/1.955ms; 20-player 2.134/4.334ms; 40-player mean 5.73–5.87ms and p95
9.29–9.84ms. These are server ticks, not client FPS. High/Low teardown each
release 215 geometries, 370 materials, 135 textures and 1,527 instance batches
exactly once, retaining borrowed Sprite geometry. All 399 frozen source hashes
match. See `quality-oct11-nova-panel-final-*` logs and source verification.

`nova-panel-prior-work-preservation-oct11.json` compares the 396-file validated
gravity checkpoint: only `br-world.ts` changes, plus the three new panel helper/
test files. HEAD remains e10fafbb8c27463187f2a2623233a56dbc717c99 and staging is
empty. The broader pass, four retained boards, close-wall camera presentation,
human art/audio/control acceptance and weak-GPU acceptance remain unfinished.

The follow-up browser orbit (`nova-camera-browser-oct11.json`, three JPGs)
confirms the upper-floor camera obstruction problem without modifying camera
behavior: along-wall boom 1.810m, rig visible, helmet projected bounding height
70.25% of the viewport. The open-room view has 5.955m boom and 16.07% projected
height. With the wall directly behind, the boom falls to 0.55m and existing logic
hides the rig. The current 1.2m visibility cutoff misses the reproduced 1.8m
case. This is diagnostic evidence, not a camera fix; no camera source change is
included in this validated checkpoint. The hidden-rig view's projected bounds
are mathematical bounds of hidden geometry and must not be treated as visible
screen coverage. The static Rapier probe is separately scoped in
`nova-camera-static-probe-oct11.json`.

Refreshed facade audit: 189 structures, 17,766 building pairs and 28,138 facade
attachment boxes, zero flags. Actual-renderer prop audits also pass their primary
(9 groups), secondary/transition (43 groups) and connective (4 groups) scopes.
These tools do not include all interior meshes; the new cassettes are checked by
the production integration/support tests and reviewed interior captures instead.
Final preservation recheck finds zero changed hashes among all 399 frozen source
files, unchanged HEAD and empty staging. Local preview and server health respond
HTTP 200. No commit, push or deployment occurred.

## Close-wall camera correction — October 11

The reproduced upper-floor view is corrected by extending existing local-rig
visibility handling: hide at a collision boom of 2.4m or less, return above 2.8m.
The prior cutoff was 1.2m and left the helmet obstructing the 1.81m view. Separate
thresholds retain visibility state through the transition band; `updatePlayers`
resets LOD visibility each frame, so camera visibility has its own state and resets
on game teardown. Scoped ADS remains hidden. Camera collision, aiming, movement,
remote avatars and authoritative geometry are unchanged.

`nova-camera-browser-after-oct11.json` and three reviewed captures test the same
upper-floor pose with native mouse orbit: along-wall 1.776m hides the local rig,
open-room 5.955m restores it, wall-behind 0.55m keeps it hidden. Zero browser errors.
Hidden helmet bounds remain in the diagnostic JSON; they are not visible coverage.
The after along-wall screenshot shows the actual loot/room instead of the helmet.
This controlled case freezes bots/storm and is not whole-match human acceptance.
Focused camera tests pass 15/15 including threshold hysteresis, normal room view,
scope behavior and invalid input. Final typecheck/build pass; 1,146 tests across
215 files pass (197.78s), all 14 E2E cases pass (6.1m), and all five unchanged
10/20/40-player server performance cases pass (18.19s). Forty-player mean ticks
are 5.56–5.71ms, p95 9.47–9.58ms; these are not client FPS measurements. High/Low
teardown release the same 215 geometries, 370 materials, 135 textures and 1,527
instance batches exactly once, retaining borrowed Sprite geometry. All 399 frozen
source hashes match, HEAD remains unchanged and staging is empty. See
`quality-oct11-camera-final-*` logs and source verification.

`camera-prior-work-preservation-oct11.json` records only three modified source
files since the validated panel checkpoint: camera helper/tests and mixed game
integration. All preceding recovery remains local and intact; no staging, commit,
push or deployment occurred. The overall quality pass remains unfinished.

The corrected-camera movement run (`nova-tower-camera-walk-oct11.json`, 19 JPGs
and video) passes all 19 entrance/loot/three-floor/return/exit legs, picks up a
shield cell, and records 259 trusted keyboard/272 trusted mouse events, zero
untrusted events and zero browser errors. Its 277 sampled camera states include
34 hidden and 243 visible rig states. Reviewed floor-three and outside captures
show the expected hiding/restoration. A floor-two capture at the short 160ms stop
has a foreground wall edge partly blocking the view; settled-camera follow-up
is required before claiming complete camera presentation. Native traversal is
controlled by one initial placement with bots/storm frozen, not human acceptance.

The 750ms settled follow-up (`nova-tower-camera-settled-walk-oct11.json`) passes
19 traversal legs but still exposes an oversized helmet at a different second-floor
angle. That distance-only candidate is therefore not final visual acceptance.
The final camera change additionally projects the cached local helmet bounds:
hide if projected height reaches 30% of the viewport, return below 24%, retaining
the 2.4/2.8m boom guards and scope behavior. Bounds are computed once per avatar;
the eight-corner projection reuses one vector without per-frame arrays/materials.
Near-plane crossings/non-finite projections hide the local rig safely.

The final framed walkthrough (`nova-tower-camera-framed-walk-oct11.json`, 19 JPGs
and video) passes every route leg, collects an actual plasma launcher and records
228 trusted keyboard/241 trusted mouse events, zero untrusted events and zero
browser errors. Reviewed settled floor-two/floor-three captures now hide the
oversized rig at 2.564m/2.416m boom; the outside view restores it at 5.983m. Camera
state is recorded after each stop. This is bounded controlled traversal and
visual review, not combat acceptance or proof every camera angle on the map is
correct. Final framed-source validation is running in
`quality-oct11-camera-framed-final-*`; the preceding distance-only validation does
not certify this newer source. No commit, push or deployment occurred.

First framed-source validation: typecheck/build pass; full suite has 1,145 passes
and one unchanged Classic mixed-match end timeout (200.87s), retained verbatim.
The script stops before E2E/performance, so those stages were not run in that
attempt. The unchanged app test file then passes all 16 checks in 18.60s
(`camera-framed-app-recheck-oct11.txt`). A fresh 80-case production simulation
diagnostic reproduces eight unfinished one-shot cases, each with bot repair
events (`classic-mixed-camera-framed-diagnostic-oct11.json/.txt`). It demonstrates
the known repair race; the original failed suite was not instrumented and its
exact cause remains unproven. No Classic bot behavior, fixture, timeout or
assertion is changed. Fresh complete validation of the same source is running
under `quality-oct11-camera-framed-final-v2-*`; earlier failure remains a failure.

The fresh framed-source full suite passes all 1,146 checks in 197.58s. Its full
E2E then has 12 passes/two failures: BR lobby leave exceeds the original 90s
deadline; Classic raid reaches the repair station but its prompt stays `SHOVE
NOVA` instead of `JAM REPAIR` at the unchanged 15s assertion. Logs and original
Playwright error contexts are preserved in `camera-framed-e2e-v2-failures/` before
further runs. A worker restart was mistakenly described as a retry in commentary;
this configuration has no retries, and these results are failures. No timeout,
assertion, gameplay condition or worker configuration is changed in source.
An isolated run of the two unchanged tests, with traces and one worker, is
diagnostic only; it cannot replace the full E2E result. Performance/cleanup/source
verification did not run in this stopped attempt and remain pending for the
final framed source.

Both unchanged E2E cases pass in the one-worker traced diagnostic (2/2, 4.4m):
lobby leave/rejoin 50.1s, Classic raid 3.3m. Complete traces are preserved in
`camera-framed-e2e-isolated-traces/`; no deadlines or assertions change. The lobby
trace contains several multi-second click/evaluate/screenshot operations
(`camera-framed-lobby-trace-timings-oct11.json`), so responsiveness under concurrent
rendering remains a performance investigation, not a proven protocol failure or
a measured FPS result. A fresh full E2E with the original two-worker configuration
is running in `quality-oct11-camera-framed-resumed-e2e.txt`. Remaining unchanged
server performance and teardown checks will run independently afterward, and
source hashes will be compared against the frozen final framed source. The failed
full run is not replaced by the isolated result.

Final framed-source checkpoint: typecheck/build pass; full unit/integration rerun
passes 1,146/1,146 across 215 files (197.58s). The fresh original-configuration
E2E run passes 14/14 in 6.4m. All five unchanged server performance cases pass
in 18.06s: 10-player mean/p95 0.891/1.905ms; 20-player 2.113/4.178ms; 40-player
means 5.53–5.69ms, p95 8.94–9.42ms. High/Low teardown each releases the same
215 geometries, 370 materials, 135 textures and 1,527 instance batches exactly
once; borrowed Sprite geometry is retained. All 399 hashes match the frozen final
source (`quality-oct11-camera-framed-resumed-source-verification.json`). No client
FPS improvement is claimed for this camera change. Earlier failures, diagnostics
and isolated traces remain intact; the passing rerun does not resolve known
Classic test nondeterminism or prove lobby responsiveness on all hardware.

This continuation began from the existing dirty working tree (53 tracked modified
files and empty index), preserving all earlier recovery. Final preservation
comparison changes only the BR camera helper/test and mixed game integration
relative to the validated panel checkpoint. HEAD remains
e10fafbb8c27463187f2a2623233a56dbc717c99; nothing is staged, committed, pushed or
deployed. Reproduced oversized-helmet views now pass controlled live review and
19-leg traversal. The overall pass remains unfinished: broader POI/composition
review, four retained Tower B boards, client performance/lobby responsiveness,
weak-hardware scaling and human art/audio/control/combat acceptance remain open.

## October 11 — client preparation and current world review

The latest current-source headed profile (1440×900, five fixed views, three
manual presets, 180 RAF intervals each) is recorded in
`client-frame-profile-oct11-current-camera-framed.json`. All fifteen medians
were 16.7ms on this PC; this is refresh-limited RTX-class evidence, not a
weak-GPU claim. High/Medium/Low Nova draw calls were 709/414/334, interior
369/218/191, connective approach 206/132/95. Aerial remained expensive at
933/861/741 calls. CPU instrumentation and fixed review cameras make this
profiling evidence, not natural match or human feel acceptance.

The headed prepared-lobby probe is `lobby-client-profile-oct11-v2.json`:
create 38ms, ready 38ms, leave 36ms, ready-off 250ms. Both home and prepared
lobby RAF medians were 16.7ms. The first harness used a case-sensitive label
that did not match the actual button and timed out; its failed JSON is retained.
The corrected harness used the actual BR leave-button ID. The first BR
selection took 1358ms and gameplay preparation produced a 2008ms long task.
This does not reproduce the prior traced multisecond prepared actions or
prove those earlier failures fixed.

Per-builder construction profiling identified road assembly as the dominant
cold-world cost. Road-detail clearance now uses 32m spatial cells for building
and road candidates, and precomputed local elbow pair lookup; exact building,
doorway, footprint and elbow checks are retained. No rendered geometry,
authoritative state, clearance thresholds or gameplay behavior was changed.
Three focused road files pass 29 tests, including negative/positive cell
boundaries, strict building edges and doorway extension.

Independent cold headed browser contexts in ABBA order compare the exact
pre-change road-detail source (this file matched HEAD before the edit) with the
indexed implementation. `road-index-ab-profile-oct11.json` records before
road assembly 1038.4/1050.4ms, after 208.9/218.7ms; total world construction
2034.4/2038.5ms versus 1196.6/1203.4ms. All four canonical pavement and marking
JSON SHA256 values are identical:
08d2133408a3eb12cecdc9466ce8dcb6f8845d41653cde626a72c7ac9868fe87.
All assemblies retain 2178 objects, 1880 meshes, 64142 instances, 298 materials.
This is preparation-time improvement, not gameplay FPS improvement. Early
comparison harness import/transpilation attempts failed before measurement;
no production assertions or geometry were changed to make the harness run.

`current-world-review-oct11.json` captures 24 current High ground/interior
views with a controlled initial position and frozen bots/storm. This is static
visual evidence, not player traversal. Review confirms occupied Civic/Coolant
frontage and existing neon illumination, but broad connective pavement and
repeated generic interior wall boards remain composition findings. The density
report (`current-density-oct11.txt`) excludes floors, trees and POI centers as
enclosure; it must not be treated as human art acceptance or solved by scatter.

Frozen-source full validation is underway under `quality-oct11-road-index-final`:
typecheck/build passed, 1147 tests in 215 files passed (206.17s). E2E, server
performance, cleanup and final source verification are still pending at this
entry. Nothing is staged, committed, pushed or deployed. The entire pass is
still in progress; this entry is evidence, not a completion declaration.

The road-index run subsequently completed: all 14 E2E tests passed with the
original workers and deadlines, all five unchanged 10/20/40-player performance
cases passed, cleanup passed, and all 399 frozen source hashes matched.

The western overlook gap was then given a fixed 26m by 44m, 4m high planted
landform at (-460, 70). Conservative clearance rejected the west-arrival and
north-arc candidates; those locations were not changed. The western slope uses
the same canonical triangle surface for rendering, collision, support, loot
and navigation, with four correctly supported full-scale trees. Native walking
and driving recordings (`western-grove-native-after-oct11.json` and
`western-grove-native-after-vehicle-oct11.json`) cross the crest and descend to
the flat deck, without movement teleporting after initial placement. Walking
reaches y=3.964 near the crest; the moving vehicle driver reaches y=5.057 near
z=70.047. The vehicle's screenshot named crest is farther down the slope after
coasting; route samples provide the actual crest evidence.

The hill's frozen validation passes typecheck/build and 1147 tests in 215 files,
but E2E is 13/14: the BR lobby leave flow exceeded its unchanged deadline while
home remained hidden. This failure is retained and unresolved. Independent
unchanged server performance and complete resource cleanup checks pass; all
399 source hashes still match. No failed run is relabeled as a full pass.

Two-client headless menu profiling identifies SwiftShader software rendering
at roughly 2.3 FPS. A test-only 20Hz draw cap changes neither draw count nor UI
update rate at that speed. A separate adaptive draw-budget experiment leaves
input/update on every RAF and yields between expensive background draws;
initial results improve input service and leave-action latency. This is being
repeated before integration. It is not a hardware gameplay FPS result.

The fixed production comparison is `menu-budget-production-abba-oct11.json`:
four independent two-client runs, budget bypassed only in the baseline, in ABBA
order. All cursor, animation, leave, host-transfer and rejoin checks pass with
zero page errors. Baseline leave actions take 2610/4377/4876ms and
2109/4426/4873ms; budgeted leave actions take 72/117/161ms and 39/282/310ms.
Input-to-draw counts move from 24:24 to 97:9, 104:9, 116:9 and 133:8.
The observation includes screenshot time, so these raw counts are not a
normalized FPS benchmark. The renderer is SwiftShader, not the desktop GPU.
The original exploratory ABBA run is retained but excluded: production source
changed before it completed, and its final baseline host-transfer wait failed.

Production `BackgroundDrawBudget` bounds only the BR home/lobby overview to
20Hz on fast hardware and supplies a bounded idle window under GPU/compositor
backpressure. Input, UI, room events, scenery updates and physics remain on
every RAF. Gameplay and Classic drawing are unrestricted. Menu diagnostics now
count rendered frames rather than labeling faster UI callbacks as visual FPS.
The actual frame-loop regression checks input and physics during skipped draws.

`quality-oct11-menu-budget-final` passes typecheck/build, 1151 tests in 216 files
(201.76s), 14/14 E2E (5.4m), all five unchanged server performance cases, exact
resource cleanup and all 401 frozen source hashes. HEAD and index remain
unchanged. This fresh successful run does not erase retained earlier failures
or establish subjective playtesting acceptance.


### Oct12 resumed human-recovery checks (in progress)

HEAD remains e10fafbb8c27463187f2a2623233a56dbc717c99; index empty and all pre-existing local work preserved. The 401-file Oct11 validation manifest matched before the new Crash/Helios presentation edits. No commit/push/deploy.

Crash maintenance panels were integrated and traversed through the entrance/aisle with trusted native keyboard/mouse; all four stops grounded, no browser errors. These are scripted checks, not human acceptance. Ten faces now use narrower drawers inside the original fitting envelope, same part count/material ownership. Actual pickup verification remains pending.

Armed combat measurements now deliberately equip the nine fixture bots with Pulse Rifles and observe actual authoritative weapon events and remote audio dispatch. High/Medium/Low/Auto recorded 46/56/51/55 remote shots respectively; all median frame times approximately16.7ms on RTX3060. Auto sample actually reduced local shield to56. Dynamic AI changes presentation load between samples; do not interpret the differing final draw counts as a perfectly matched static comparison. Earlier unarmed active-bot samples were not evidence of real gunfire.

The first arterial fixture mistakenly omitted the required previousY floor-query argument and buried the vehicle beneath Nova's deck. That run also stopped when concurrent presentation editing triggered Vite reload. Retained arterial-native-oct12 files are excluded from road acceptance; arterial-native-supported-oct12 uses the authored deck probe and source freeze.

Generic addInteriorKit decorations vs authoritative rotated stairs:8591 oriented-box comparisons,0 intersections. Separate original Helios display helper:2 actual stair intersections across8683 comparisons including that helper; captured from untouched HEAD helper after candidate editing had already begun. The first attempted before capture accidentally loaded the current helper and returned0; it is not baseline proof. This audit does not cover every decorative helper/intentional mounting overlap.

Helios old custom displays assumed a nonexistent partition and floated ~10.5m ahead of the actual back wall. New candidate uses real back-wall support, preserves authoritative stairs, excludes actual stair and existing dressing bounds, retains23parts of48budget. Native before/after verification pending.

The initial local-interest Oct12 static set corrected Nova/Mall/South placement, but its storm placement was mistakenly x480 while camera was x-184. Its storm samples are excluded from nearby-interest claims. Corrected repeat planned.


### Oct12 eyes, grove scale and arterial traversal

User requested eye-only astronaut treatment. Fresh before/after images:astronaut-eyes-{before,after,instanced-final}-oct12-idle-front/diagonal/side/back and-gameplay-distance. Original has one stretched pale glint, no actual eye meshes. Replaced glint with two dark static ovals in one InstancedMesh, original sphere geometry resource count and existingdark material, no per-frame eye work; staticeyes retainedatdistance. Shell/visor transforms/materials unchanged. Eye-only neutralbind comparison proves all30non-eye meshes geometry/index/material signatures unchanged at1e-9worldprecision. Focusedeye+motion12tests pass. Modelvisualreview front45side12m shows readableovals; existingvisoredgesremainbecauseuserrequiredexactvisorgeometry. No blink added.

Visuals agent hit usage limit after leaving candidateeyeedit. Sol reviewed/completedinstancingandfocusedtests; priorlocomotion/helditemworkpreserved.

Arterial-native-supported-oct12 completedall18nodes withnativevehicleinput afteroneinitialsupportedplacement, zeroerrors; retainedcontinuousvideo andJPGstops. HeightsincludeNova6.06driver,Helios7.06,Academy9.06andground1.06. Thisprovesroutecontinuity, nothumanfeel/allsidereadsacceptance.

Connective-scale-native-v2-oct12 actualplayercamera revealed narrowcorridorcanopies besidebroadlandformtrees. Expandedprimaryradius1.05..1.41to1.9..2.34, secondary.6to1.05; heightsmoderatelybroadened. Existingtrunks/lowbeds unchanged, sameparts/materials, whole-footprintclearancerejectionunchanged,4tests pass. Generatedgrovescanrelocate/omitbecausefullcrownclearanceisre-evaluated; sourcecontract remainsvisual-only, noaddedcombatcover. Expandednativeimagesreviewed. The copiedharnessnearestfield measuresdistancefromworldroot andisNOTtreeproximity, ignorethatfield; screenshotsareactualnativecamera.

Heliosnative-after-oct11 traversed4stopsgroundedwith0errors. Actualnewleftcontrolbaymountedonbackwall, stairsandlootclearinreviewedroomshot. Oldhelper2exactOBBstairintersections, new0; generickit0.

Academy-grade-native-before-oct11 reproducedvisuallyhard~20degreefoot/crest atservice4/academy-dorms grade. Nativewalkersascendfrom.035to8.035withoutcatching, butgradeeasingremainspending; donotmarkroadblendingcomplete.

Freshquality-oct12-eyes-interiors-finalvalidationrunning withsourcefreeze; typecheck/buildpassed atstart.


Crash actualpickup follow-up: firstattemptpressedEfromthestandardcargostopbutdidnotremove nearestitem; retainedfailedreportloot-final-oct12. Secondattemptloot-v2-final-oct12 walkedusingnativeinputtoauthoritativenearestrealitembeforepressingE, thenconfirmeditemremovedfromserverloot. Passed0errors. Do notcallfirstattemptinteractionbugwithoutcheckingdistance.


### Oct12 validation correction and Academy grade easing

Firsteyes/interiorsfullrun:typecheck/buildpass,1158tests pass,2eyeappearancefailures becauseAstra'sseparatemeshnameassertionswerenotupdatedafterSolinstancing. Retainedalllogs. Updatedtestadapterdecomposesactualinstance matrices; preservesalloriginalshell/visor/material/depth/raycast/silhouette assertions. Eyesstayvisibleatdistance(asrequested)insteadoldglintLOD. Focused4eyeappearancechecks pass. Thiswasatestintegrationerror,notpermissiontoweakenocclusion.

Academyservice4,dormsmain,westparkmain:replacedhard~20degreefoot/crest withtwoshorttransitionpiecesoneachend. Literalsharedpointsatx-394/.1,-393.25/.2,-392.5/.4,-373.5/7.8,-372.75/8,-372/8.1; origin/endlandingsunchanged. Maxslope7.4/19=.389474belowexisting.4limit,first/lastincline.133333(7.595degrees),intermediate.266667;maximumadjacentslope-anglechange<.14rad. Mapdecimetregridpreserved. Authority/prediction/renderinguseidenticalpieces; nofakevisualonlyfillet. Existing44relevantroad/marking/physics/frontagetests passed beforeaddedfocusedtransitionregression. Nativeafterwalkgroundedall4stops,base.035crest8.035,noerrors. Vehiclesandfullvalidationpending.

Freshquality-oct12-eyes-grades-finalpipeline startedafterallthesechanges; indexstillunstaged,HEADunchanged, nopush/deploy.

### October 12 — final eye review, vehicle crossing and validation status

Reviewed the final instanced-eye front and third-person-distance screenshots. The two dark vertical ovals remain readable. The older exposed visor edge marks remain because helmet and visor geometry were explicitly preserved. No procedural blinking was added. The saved bind comparison verifies all 30 non-eye meshes, their vertices, indices and materials are unchanged.

The Academy vehicle pass crosses the eased incline using actual native input after one initial supported placement. All four stops remain in the vehicle, with zero page errors. The first stop overshot the intended foot because the vehicle coasted; use the continuous video for traversal evidence, not an exact stopping-distance comparison.

Fresh typecheck and build passed. The full suite passed 1,160 tests and failed the existing Classic mixed-match ending test (5-second timeout). The unchanged server app file then passed all 16 tests. A fresh read-only 12-match trace passed 12/12 and did not reproduce repair. Historical October 8 evidence already reproduced a bot repairing just before the rocket landed; that explains a known fixture race but does not establish the exact cause of today's uninstrumented failure. No bot behavior, assertions, deadlines or performance budgets changed. Logs and the new trace are retained. E2E is running separately; this is not yet a successful complete final validation.

Fresh unchanged follow-up validation passed all 1,161 tests across 219 files (196.95s), all 14 E2E cases (5.4m), and the five unchanged 10/20/40-player server-performance cases. Typecheck/build had already passed on the same 405 source-file manifest, now verified unchanged. The earlier Classic timeout is retained and not silently counted as a pass.

Dedicated server means/p95 in milliseconds: 10 players 0.963/2.052; 20 players 2.130/4.123; 40 players 6.064/9.895, 5.839/9.566 and 5.775/9.510. Existing budgets unchanged. High and Low cleanup cycles each disposed all 216 geometries, 370 materials, 135 textures and 1,527 instance batches exactly once, with no missing/repeated disposal or page error. This is scoped resource-lifetime evidence, not GPU-memory or human gameplay acceptance.

### October 12 — corrected client-interest measurements

The corrected 16-view run completed with zero page errors. Each camera now has a nearby authoritative local player, including the storm view (the earlier storm sample used a mismatched local-player location and is excluded). Headed Chromium on RTX 3060, 1440x900 DPR1, 240 RAF intervals per sample, no concurrent validation/render load. All medians were approximately 16.7ms; this capable machine is refresh-limited, not evidence of a weak-GPU FPS improvement.

| View | High calls/triangles | Medium calls/triangles | Low calls/triangles | Auto calls/triangles |
| --- | --- | --- | --- | --- |
| Nova street | 1265 / 416897 | 503 / 320105 | 422 / 265951 | 502 / 320275 |
| Mall interior | 579 / 348237 | 348 / 285761 | 235 / 237531 | 313 / 277977 |
| South connective approach | 214 / 220785 | 141 / 200327 | 113 / 170999 | 141 / 200327 |
| Storm boundary | 638 / 485563 | 389 / 459125 | 298 / 290759 | 377 / 388253 |

High internal canvas 1440x900; Medium/Auto 1296x810; Low 1036x648. Full metadata, visible-instance counts, active sectors and screenshots are retained in local-interest-client-corrected-oct12 files. Static review cameras and frozen bots make these rendering diagnostics, not human gameplay acceptance or a new matched before/after optimization benchmark. Auto may settle progressively, so its counts can differ from manual Medium.

### October 12 — Horizon live grade recovery

The live baseline confirmed a hard ~19.65-degree flat/ramp join at Horizon Homes x-255, z-36 and z-50. Native walking crossed without catching; the reproduced problem was visual grade blending. Both service-3 and horizon-homes-cross now share exact points z-36/.1, -37/.3, -49/4.9, -50/5.1. Landing positions and heights, the symmetric middle height and road widths are preserved. The one-metre end transitions use .2 slope, the middle 4.6/12=.383333, all below .4. New tests retain the previous frontage checks and verify both overlapping surfaces agree at seven samples.

36 focused shared-frontage, authoritative/prediction traversal, actual pavement and marking tests passed. Native revised walking remained grounded at all four stops; the vehicle also crossed and remained occupied at all four stops, zero errors in either run. Vehicle coasting overshot intended foot/crest stops; the continuous traversal is evidence, not exact-stop measurement. Ground-level before/after foot images reviewed. Curbs remain engineered segmented strips; these changes are not a claim that every road now looks finished.

This shared geometry change follows the last complete validation; that prior 1,161-test/E2E/source manifest does not cover the new Horizon points. A fresh final validation is still required. No commit, push or deployment.

Natural round v4 was stopped after its native glide landed on the lower ground east of Nova. Its fixed direct walk then correctly stopped at the deck retaining wall. This is a harness route failure; it does not establish a collider bug or successful whole-round acceptance. Partial JSON/video retained. v5 adds an actual native walking route through the existing Comet road grade when landing below Nova, without changing any production geometry or fixture state.

Natural v5 completed lobby/shop/pass/settings, early Ion Wings, normal touchdown, real Nova doorway/loot (epic Pulse Rifle and med kit), skimmer entry, four road legs, Void/results and exit with zero page errors. It FAILED its strict overall acceptance because it recorded no local outgoing damage. The chase repeatedly approached obstructed targets through coarse road-network waypoints and never established a useful firing position before elimination. This is not successful natural combat acceptance; separate controlled native Pulse/Rail combat evidence remains scoped separately. Full JSON/video retained. The scripted chase is not a human playtest, and no combat assertion was relaxed.

### October 12 — Helios hologram revision and structural LOD

Human feedback rejected the opaque diamond/cage replacement. It has been replaced with two static additive transparent plane batches: faint hexagonal containment faces (opacity .009) and broken scan bands (.38), 144 instances / 288 triangles. Four short emitter posts and a low square projector replace the tall cage. The projector is aligned to the existing upper roof tier at x264.72/z75.96, base underside world57.2; no authoritative building, collision or interior changed. Reviewed actual close/front/side/distant render captures under helios-hologram-airy-final-oct12. This is visual review, not human acceptance.

Distant captures also reproduced missing structural walls: facade LOD hid the shell along with interiors. Structural shells, roof masses and Solar service shells now live in persistent silhouette groups; distant shadows remain disabled. The production assembly audit checks 432 near/far/near transitions across all three qualities and every occupied district, with unchanged buffers, visible shells and exclusive facade tiers. Four focused crown/lifecycle tests and client typecheck pass. Landmark audit has zero overlaps across 25 poses; cleanup verifies every reachable owned resource released once at High/Low, including the two new transparent materials. Full validation of these latest changes remains pending. No commit, push or deployment.

Latest frozen build validation completed: typecheck/build pass, 1,165 tests across 220 files pass (207.86s), all 14 E2E pass (5.6min), all five unchanged server performance cases pass. 10-player mean .970ms/p95 2.007ms; 20-player 2.231/4.717ms; 40-player means 6.000/5.828/5.901ms, p95 9.816/9.656/9.864ms. Worst 84.442ms and maximum snapshot34,540 bytes remain within existing unchanged budgets. High/Low complete resource cleanup passes; source manifest verification has zero mismatches. This validates the latest Horizon, hologram and structural-LOD integration, not whole-pass human acceptance. Client rendering remeasurement and natural-round combat remain separate.

Post-silhouette rendering remeasurement completed (same RTX3060/1440x900/DPR1 static scenes, no concurrent load, 240 RAF samples each, zero page errors). All 16 medians ~16.7ms, refresh limited. High/Medium/Low/Auto calls/triangles: Nova1263/415897,531/322655,436/268227,514/322327; Mall640/352937,383/290081,264/241863,331/281437; South259/223313,186/202807,158/173479,186/202807; Storm640/487231,412/462217,324/295219,401/392065. Correct persistent walls add draw calls versus previously missing walls; no FPS gain claimed. Low remains substantially lighter than High. Auto settling and network interest make this scoped repeated diagnostic rather than deterministic isolated A/B benchmark. Full samples local-interest-client-shells-oct12-client-metrics.json.

Natural round v6 passed its unchanged strict flow checks. Normal ten-player match, native trusted input, observer control GET only: lobby background did not lock cursor; trail shop/pass/settings; ship/earlywings; lower-deck touchdown; actual Comet grade ascent; Nova loot; skimmer; four road legs; Zero perimeter approach; registered outgoing local damage; Void/results; clean home exit, released pointerlock, zero server rooms, zero page errors/untrusted events. Previous v4/v5 failures remain retained. This is scripted integration evidence, not human art/audio/combat-feel acceptance. Full JSON/video natural-quality-round-oct12-v6.

Central/Comet live grade recovery: Central baseline x-69/z-82 reproduced a visually hard18.435degree ramp join; player remained grounded. Both z-82 and z-214 approaches now share symmetric transition points x-84/5.1,-83/4.9,-70/.3,-69/.1 across main/service/radial routes. Original landings,widths and midpoint(-76.5,2.5support) preserved. End slopes.2; middle4.6/13=.353846 below.4. All37 pre-existing focused road/frontage/marking/server traversal tests passed; new identical-profile/angle regression passes (13frontage total). Native Central walk, Central skimmer and Comet walk pass grounded/occupied with0pageerrors andtrustedinput. Vehiclecoasting overshoots plannedstops; notexactcomparison. Reviewed actual before/afterCentral foot andCometfoot screenshots. Previous complete1165testmanifest predates this change; fresh finalvalidation required.

Final Central/Comet frozen validation: typecheck/build pass,1,166tests/220files pass (204.11s),14E2E pass(5.5min),5unchanged10/20/40performancecases pass(18.99s),High/Lowresourcecleanup pass,407sourcehashes verified0mismatches.40playermeans6.140/5.744/5.807ms,p9511.206/9.528/9.592ms,maxsnapshot34,941bytes;limits unchanged. Current overlapaudit189structures/28,138facadeboxes has0building/facade/neighborattachments intersections. Connective1134instances andsecondary481instances prop audits pass0hits/vehicleerrors.432productionarchitectureLOD transitionspass. Nocommit/push/deployment. Latestroad edits postdate client-shellmetrics/naturalv6; exact-roadnativewalk/vehicle tests cover them separately. Overall human art/audio/control andweakhardwareacceptance remain open; testsandautomatedinput arenot a declarationtheentirepassisfinished.

### October 12 — continued client evidence and hill shoulder recovery

Current Starliner High/Medium/Low/Auto medians~16.7ms; calls/triangles486/224137,449/209403,417/178559,453/209487. Current active9bot combat52/53/45/59realweapon events andmatching remoteaudio dispatch counts; medians16.7ms, p95High33.4ms,others16.8ms. Highfollowupprofiling baselinep9516.8ms; shadowsoff16.9ms,bloomoff33.2ms,mediumworlddetail33.1ms. Temporalbotactivityvaries; cannotattribute earlierbadframesorclaimoptimization. Shadowsoff cuts~465calls butnotprovenFPSfix. KeepHighquality.

Westerngrove live screenshot confirmed hardpolygon skirt. Color-onlycandidatefailedvisualacceptance(stillgrey skirt), retainedshoulder-after images. Finalcandidateadds smooth shoulder alphaattribute to existinghill shader,near-zero perimetercomposites actualdeck texture; opaqueupper slope preservesdepthwrites. Geometrypositions,indices,normals,UVs,collision,trees unchanged; no newdraw/texture/material. Nativewestern walkacrosscrest/descent passes0errors. ActualGPU occlusion check body-sizedmagenta box:160visiblepixels without hill,0withhill,160afterhidinghill. Firstocclusionrunrecorded unrelated404 andfailed overall; blankpagev2 passes0console/pageerrors.16focusedterrain/physics/helpertests pass. New fullvalidation pending.

All three hill routes now reviewed in the running High renderer: western/eastern/southern approaches and native crest/descent/exit checks, grounded at every stop, zero errors/untrusted input. Upper hills remain opaque and clearly green; low shoulders expose real deck texture instead of hard polygon skirts. Focused5helper+2lifecycle tests andclienttypecheck pass. Eastern/southern images under east-grove-native/south-grove-native-shoulder-alpha-oct11 (copiedharnesssuffix; actualOct12).

EastFreight service25 baseline nativewalk reproduced hard19.502degree flat/ramp join. First3piececandidate failed new .15rad adjacent-angle check; not accepted. Final5inclinedpieces use .194/.339/.375/.339/.194 slopes, all belowexisting.4budget andadjacent-anglechange<.15. Literalupper/lower landings and originalmidpoint294.75/-261/support4 preserved.39focusedroad/frontage/marking/server tests pass. Nativewalk andskimmer passallstops grounded/occupied0errors. Vehicle coastingovershot some intendedstops; continuous route only. Before/afterfoot imagesreviewed. Noassertion/performancebudget weakened; fullvalidationpendingforcurrenthillshader/freightgeometry.

Hills/Freight full validation first run: typecheck/build pass,1171 tests pass and1 road-detail test fails. Root cause was test segment selection by heading alone: the light at286.738/-254.753 matched the upper parallel segment instead of its actual lower station. Corrected lookup requires projection inside segment; same >width/2 clearance assertion retained. All4 focused grade-detail tests pass. Original failed log retained; fresh v2 full validation pending.

Hills/Freight v2 full frozen validation passes: typecheck/build,1172tests/221files(209.82s),14E2E(5.6min),5unchanged10/20/40performancecases(18.57s),High/Lowcleanup165geometries371materials135textures1529batches exactlyonce.40playermeans5.808/5.675/5.648ms,p959.979/9.375/9.269ms,maxsnapshot34941bytes. Source verification0mismatches. Prior failed run retained. No commit/push/deploy; automated evidence does not establish whole-pass human acceptance.

Helios Relay x375/z144-162 live baseline reproduces hard18.435degree grade join, nativewalk remains grounded. Profile now144/6.1,145/5.9,161/.3,162/.1: end.2/middle.35 slopes, original landings/midpoint retained,adjacentangle<.15rad.44focusedroad/frontage/marking/presentation/server tests pass. Nativewalk/skimmer both pass all5stops0errors/untrustedinput; skimmercoastingovershoots targets. Actualbefore/afterfoot images reviewed. New edit postdates v2fullmanifest, needsfreshvalidation. East tree comb artifact persists in renderer-shadow-disabled screenshot; cause unresolved,no production workaround applied.

HeliosRelay final frozen validation: typecheck/build,1173tests/221files(208.22s),14E2E(5.5min),5unchangedserverperformancecases(18.53s),High/Lowcleanup pass.40player means5.755/5.651/5.701ms,p959.637/9.361/9.306ms,maxsnapshot34941.409sourcehashes0mismatches. No production changes duringvalidation,no commit/push/deploy. The initial shadow-disabled screenshot retained cast shadows; it cannot exclude cached shadow sampling. Next stricter read-only hill receiveShadow/material-recompile/opaque-attribute comparison prepared.

Strict east contact diagnostic passes0pageerrors: receiveShadow=false plus material recompilation removes hill cast shadow; fullyopaque blend diagnostic restores hard skirt but tinytrunkfootcomb persists. Thus initial shadowoff was inconclusive; new comparison excludes hillshadow andshoulderfade as directcause. Trunkflatbottom intersects realslopedterrain abovefadeband; no duplicatefootprops. No production workaround applied. Preserve good shoulderblend; minorcontactaliasingnot wholeworldacceptance.

North service18 candidate nativewalk passes all5stops grounded0errors/untrustedinput. Ground-levelfoot image reviewed: shortupperstreet accessramp, no reproducedgap/catch. Numerical15.239degreecandidate alone is not a defect; geometry unchanged. All postvalidationdiagnostics are ignoredharness/runtimeonly; production remains covered by409hash HeliosRelaymanifest.

October12continued CPUprofiling: ninebotcombat headedRTX3060samecamera240frames HighrenderCPUmedian10.3ms,Medium6.1,Low5;camera/world~.1ms. Trial30Hzshadowrefresh median8.2vs10.3/10.1butproductionpaired moremodest: meanrender11.317/11.428everyframevs10.37230Hz(~9percent),meanframe13.638/13.593vs12.717;FPSstill60andp95no consistentgain. Integrated boundedHighshadowrefreshpreservesresolution/casters,colorpass/gameplayeveryRAF,explicitinvalidation,sharedautoUpdate restoredfinally.11focusedcadence/ownershiptestsandtypecheckpass. Naturalroundv7passeslobby/shop/pass/settings/ship/glide/landing/loot/skimmer/routes/resultswith0pageerrorsbutFAILSstrictoutgoingdamage;retainJSON/video,nohumancombatacceptanceclaim. Userreportsfour eyes: actualsavedfrontcapture confirms2newovalsplus2oldvisorfacetdiamondslits. Isolatedvisualfixinprogress; fullvalidationpendingbothnewchanges.

Four-eye rootcause confirmed freshnativefront:2ovaleyes+2exposedbluevisorcaps. Newvisor-onlyfragmentmask localabsx>.32andy>-.11 removeslateralcaps;geometry/transforms/materialvalues/centralvisor/lowerband unchanged. Parentreviewedactualfront/45after,oneclear pair;visualsreviewedside/distance.16focusedeyes/appearance/motiontestsclienttscpass. Noextradraw/resource/framework. Fullvalidationpendingwithshadowcadence.

Two-eyes/shadow fullvalidation interrupted intentionally aftertypecheck/buildpass whenuser requestedlargerblackeyeswithwhitedots; not completedvalidationor testfailure. Newpresentationsteer supersedes previousstaticdarkovalstyle; preservetwo-eyemasks/helmetgeometry. Freshvalidationrequiredafteredit.

Latestusereye refinement: centers±.16,ovalscale.6804/1.1664,blackbasicmaterialandcontainedwhitedots.17focusedeyes/appearance/motiontestspassandactualfront/diagonal/distance reviewed. Previousfullvalidationinterruptedforusersteer; freshlarge-eyes-shadowvalidationstarted. No commit/push/deploy.

Large-eyes/shadow finalfullvalidationpasses:typecheck/build1177tests221files202.10s,14E2E5.5min,5unchangedserverperformance18.61s,High/Lowcleanupallreachableworldresourcesexactonce.40playermeans5.826/5.723/5.750ms,p959.743/9.479/9.449ms,maxsnapshot34941. No changedassertions/timeouts/budgets. Sourcehashverification0mismatches; no commit/push/deploy. Nativev8willcorrectv7harnessclearLOSapproachwhilekeepingstrictoutgoingdamagecondition.

Naturalv8currentlarge-eyes/shadowbuildpassesstrictnormaltenplayerround:lobbybackgroundcursor/shoptrails/pass/settingsHigh/Starliner/earlywings/naturallowerlanding/Cometgradeup/Novaloot/skimmer4roadlegs/registeredoutgoingdamage/results/homeexit.0pageerrors0untrustedinput,pointerlockreleasedserverrooms0. CorrectedharnessusesdirectwalkingwhenactualLOSisc lear; otherwiseexistingnavigation, no productionstate/physicschanged. Previousv7failure retained. This is scriptednativeintegrationevidence nothumanart/audio/feelacceptance.

Currentfrozenbuildclientrefresh24samples6scenesall4qualitiesRTX30601440x900DPR1:Starliner,Novaexterior,Mallinterior,Southopen,storm,9armedbotcombat. Allmedians~16.7ms,combatp95~16.8ms,0pageerrors. Starlinercalls/trisH516/229705,M475/214267,L432/182531,A476/214323;combatH1331/495497,M621/356615,L417/301989,A713/361183. Highcountersarelastframesnapshotsdependentonshadowrefresh,notaverage drawreduction. Fourstaticviewsinlocal-interest-client-shadow-oct12-client-metrics.json;shipquality-starliner-shadow-oct12-client-metrics.json;combatarmed-combat-shadow-oct12.json. WeakGPU/humanfeel/audioacceptancenotestablished;allproductionstillfrozenandfullvalidated.

Post-pushb933cd5roadreview:Solarnativewalkpassesall5groundedstops0errors. OrbitalOverlookx340/z180-201nativewalkandskimmerpassall5stops0errors/untrustedinput;vehiclecoastingovershootsstations. Freshjunctionaudit722joins1033routespasses0mismatch/separation/traversalfailures. Actualfront/side/reverseOverlookfoot/crestreview:lowertransversestripbelongsgroundcrossingroadbeneathinclinededge;cresttriangularseamisramp/deckmaterialtransition,notexposedhole. Curbsremainsegmented/engineered;nohumanvisualcompletionclaim. Productiongeometryunchanged;newcapturesandpost-push-junction-oct12.jsonlocal. Noadditionalcommit/push/deploy.

October 12 post-push contact recovery: same-camera tree diagnostic confirms inherited hill decal bias (-8/-8) caused trunk-foot comb; resetting only polygon offset removes it while preserving hill shoulder alpha, shadows and real geometry. Presentation helper resets offset and regression seeds inherited bias. Independently11 helper/terrain tests pass. Fresh nine-primary review found farm ground streaks. Controlled same-camera diagnostic: hiding only pale terrain trim does NOT remove streaks; changing only three park materials from layer2 to layer3 DOES. Root cause is coplanar farm-terrace plaza and crop lawns sharing identical depth bias. Production park layer3 also orders authored Astra lawns above their plaza without raising geometry or changing collision. Baseline/no-trim/layer3 captures and failed server-unavailable attempt retained. Clear nova-plaza development camera added after generic POI camera was inside recovered architecture;26 existing camera checks pass. Full validation of these new edits pending; no new commit/push/deploy.

Terrain-contact frozen validation completed: typecheck/build pass,1177tests/221files pass(206.78s),14E2E pass(5.7min),5unchanged10/20/40performancecases pass(18.61s),High/Lowresourcecleanup pass,410sourcehashes0mismatches.40playermeans5.920/5.688/5.730ms,p9510.210/9.358/9.420ms,maxsnapshot34941bytes. ActualproductionFarms/Astra/Nova/aerial captures reviewed0pageerrors. Source remained frozen for validation; no push/deploy. This complete result predates the following new western garden.

Freshdensityaudit:9.4percent interior samples >30m frombuilding/cover,.2percent>50m,none>75m. Nature and sightlines are deliberately excluded from that geometric enclosure metric. Livewestern gap x-410/z225 confirmed emptydeck besidecollectorroad. Added fixed west-collector-garden at-413/222,22x34m,3.2m high,4collision-backed8-10m trees using existing shared terrain/greenway pipeline. Firstcandidatez218 FAILED existingroadclearance6.596vsrequired7m; shiftedcenterz222, sameoriginalthreshold retained. Updated exactcanonicalhillcount3to4 to reflect newauthoredfeature; no slope/clearance/physicslimitschanged.7focusedterrain/finish tests pass authority/prediction/camera-ray/loot/road/edge parity. Actualnativewalk approach/crest/descent/exit grounded0errors/untrustedinput. Existing3hills untouched. Latestfullvalidationpredatesnewsharedgeometry; freshvalidationrequired.

Western garden native skimmer route passes continuous crossing andremainsoccupied atall4captures0errors/untrustedinput. Coastingovershoots intendedstationlabels; crestcapture isalreadyonthedescent,so not anexactcrest-heightcomparison. Actualwalkingcrest y3.164 andnormalexit y.035 reviewed. Freshwest-garden fullvalidation started onfrozenproductiontree.

West-garden fullfrozenvalidationpasses:typecheck/build,1177tests221files205.62s,14E2E5.4min,5unchangedserverperformance18.84s,High/Lowcleanup166geometries371materials135textures1529batchesreleasedexactlyonce.40playermeans5.919/5.741/5.762ms,p9510.038/9.553/9.344ms,maxsnapshot34941bytes. Sourceverification0mismatches. Noassertion/timeout/performancebudgetweakening;no newcommit/push/deploy. Auto software-renderer stress prepared next; this is separate from physical weak-GPU certification orhumanqualityacceptance.

ActualforcedSwiftShaderstress (rendererIDverified) reproducedAutoMediumstuck:median749.9ms/p951966.5ms,automaticselectionpersistedAuto butresolvedMedium. Repeatprofilemedian766.7/p951333.2ms; actualsynchronousneonrenderCPUmedian9.6/p9514.1ms confirmsGPUwaitratherthanCPUsubmission. ManualHigh1066.6/3149.9ms,Medium766.6/966.6ms,Low533.3/1066.7ms; softwarestressnotphysicalweakGPUcertification. Frozen9armedbotmodelsandnativeSettingscontrols;notactualcombatacceptance. Originalweapon/audioassertionsandarmed-combatharnessunchanged;newstressscopeusesfrozenmodels.

RootAutoissue:>=1secondintervalsresetwarmup/window indefinitely evenundersustainedGPUpressure. Newboundedthree-sample veryslowforegroundevidence permitsrepeated1-5secondintervals intotheexisting8bucket/6slowbucketwindow;isolatedstalls,pauses,invalidintervalsand>=5secondsuspensionsstillreset. Explicitvisibilitychange resetscontinuitywhenRAFstopsinthebackground. Existingbudgets/manualselection/cooldown/promotionrulesunchanged.14focusedAuto/settings tests pass; firstnewtestneededcorrectsamplinglengthtocompleteunchangedeightbuckets,notrelaxwindow. ActualafterrunAuto resolvesLowwith1036x648canvas whilelocalStorageselectionremainsAuto;20stransitionmedian783.3msmixestiers,notsteadystateFPSclaim. Newfullvalidationandsettledstresspending.

Softwarestresscorrection:armBotsfixtureoverrodeexploration's1hAIdeferralwith20s,soearlierstresssamplescouldincludecombat/elimination. Thoseearlierrunsdonotestablishstablebefore/afterFPSorAutoacceptance;preservedrawresults. SeparateexplorationcommandafterarmingnowtrulyfreezesAI;benchmarkassertscombatphase,alive,HP100/shield100andzero weapon events. Historicalb933Auto codeisread-onlycopiedtoignoredruntimeandservedonlyincomparisonbrowser;productionworkingtreeisneverrestored/replaced. Correctlegacybaseline verifiedSwiftShader median766.6/p952199.9ms,Auto persists/resolvesMedium,alive100HPcombat. Firstcorrectedproductioncandidate resolvesLowandsettledmedian516.7/p95550ms;manualHigh1050/2016.7,Medium733.3/1433.3,Low533.3/600ms,eachnativeSettingsselectionpersistedexactlyandplayerremainsalive100HP.

Actualsamplertraceincludesfast16.7mscompositorcallbacksamong750-1966msGPUintervals. Addedinterleaved-cadenceregressionthatFAILSconsecutive-samplecandidate. Refinedboundedpressureevidencetothreevery-slowintervalsintheprevious8callbacks(bitmask,noallocations),whilekeeping8completedbuckets/6slowbuckets,cooldown,manualoverrideand>=5ssuspensionresetunchanged.15focusedAuto/settingstestspass. Finalstablebrowserrepeatandfreshfullvalidationpending;notclaimingwhole-passhumanacceptance.

Final bounded-pressure software repeat: true frozen armed models, player alive HP100/shield100, zero weapon events and combat phase throughout. Auto settled median516.6ms/p95983.3ms resolvesLow while saved selection remainsAuto; manualHigh1049.9/2099.9ms,Medium733.3/1433.3ms,Low533.3/1033.3ms each persists its manual tier. Software renderer is stress evidence, not physical weak-GPU acceptance; temporal p95 variation is substantial. Native pause resets sampling correctly. Browser-tab v5 still never observed document.hidden or trusted visibility events, even after disabling Playwright focus emulation; timeout preserved and background/resume acceptance remains unverified. Fresh full validation of latest source is running; no new commit/push/deploy.

Latest Auto-pressure full frozen validation passes: typecheck/build,1180tests221files215.75s,14E2E5.8min,5unchangedserverperformance18.49s,High/Lowcleanup166geometries371materials135textures1529batchesexactonce.40playermeans5.798/5.725/5.733ms,p959.670/9.642/9.270ms,maxsnapshot34941bytes. Source manifest verification follows; no new commit/push/deploy. Fresh native/render checks still pending.

Current-tree headed RTX3060 repeat completes24samples(sixscenes x High/Medium/Low/Auto),0pageerrors. Allmedian16.7ms(refreshlimited);active nine-botcombat p95~16.8ms alltiers. NativeSettings/manualsavedtiersverified. Captures/reports use auto-pressure-final-oct12 prefixes, preserve earlier comparisons. High last-frame drawcalls depend on30Hzshadow cadence and are not averages. Physical weakhardware and subjective feel remain unaccepted. Source410hashverification0mismatches at22:17:34CDT. Minimized-windowv6 diagnostic also never observed hidden/trusted visibilitytransition; preserved timeout, no fabricated event acceptance.

Fresh native normal-round v9 FAILS gameplay acceptance: landing at(-87.52,.035,-198.66), east of Comet retaining edge, falls outside scripted lower-landing detour's x>-85 branch. Script repeatedly aims through retaining edge; loot inventory remains empty, vehicleId null and outgoingdamage0. Progress labels are actions attempted, not success; earlier commentary corrected after inspecting state. Failed video/screenshots/raw route retained. v10 widens diagnostic detour to x>-111 and follows existing south/east road, no production geometry/testbudget change. Freshjunction audit722joins1033paths0failures;overlap audit189structures17766pairs28138facadeboxes46piers66greenwaytrees0intersections passes.

### October 12 stopping checkpoint

The current source passed typecheck, build, all 1,180 tests in 221 files, all 14 E2E cases, the five unchanged 10/20/40-player performance cases, resource cleanup, road junction and overlap audits. All 410 source hashes remained unchanged through validation. Fresh headed RTX 3060 measurements cover six scenes across High, Medium, Low and Auto; median frame time remains approximately 16.7 ms, with active-combat p95 approximately 16.8 ms. These refresh-limited results do not certify weaker physical hardware.

The corrected native normal-round v10 passed early glide, landing, supported loot, skimmer entry and driving, registered outgoing damage, results and exit to home. Pointer lock released, authoritative room count returned to zero, and no page errors or untrusted input were recorded. The failed v9 route is retained: its direct path attempted to cross the Comet retaining edge after an unhandled lower landing. Only the local diagnostic route was corrected to use the existing access road; production geometry and acceptance assertions were not changed.

This checkpoint fixes hill/trunk depth-bias artifacts, overlapping lawn depth ordering and extreme GPU-pressure Auto fallback. It also adds the collision-backed western collector garden and repairs the development Nova review framing. Existing local work and raw evidence remain preserved.

The overall quality pass is still unfinished. Next work should verify genuine browser background/resume behavior (the tab and minimized-window diagnostics did not observe visibility changes), continue ground-level visual QA where new human reports identify defects, and obtain human acceptance of glide feel, audio and overall composition. Software-renderer stress is not physical weak-GPU certification. No deployment was performed. The user requested this stopping checkpoint and authorized its commit and push.
