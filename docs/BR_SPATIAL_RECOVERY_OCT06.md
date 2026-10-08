# Orbital Isle spatial recovery — October 6 local work

This is a progress checkpoint, not final acceptance. The current filesystem is
authoritative; the changes described here are uncommitted. No deployment or push
was performed for this continuation. Historical base: `096edcb`.

## Structural changes

- Added broad, real walkable district elevations: Nova commercial deck (+5m,
  174×170m), Astra campus (+8m, 180×134m), Helios power deck (+6m, 170×140m),
  Farms production deck (+4m, 190×148m), and Transit Court service basin (−3m,
  85×105m). Eight existing connective decks retain their own heights. Roads,
  structures, loot, cover, rendering, camera floor checks, and both Rapier
  implementations use the corresponding geometry.
- Cut the lowered court out of the actual base floor. The polygon-clipped floor
  mesh shares its outline and cell seams with collision/raycast geometry; it
  no longer extends outside the island or seals the basin with a hidden floor.
- Added road-first Transit Court and South Exchange with four enterable
  buildings each. South Exchange fronts a continuous north–south street at
  x=−76, z=−310…−390 and a service court at z=−357. It connects the existing
  Hotel avenue and southern ring instead of scattering buildings across the gap.
  Production Transfer now adds a third road-first block between Helios and
  Farms. Current catalog: 164 structures, 82 enterable, 33 secondary locations.
- Road surface construction subtracts coplanar overlap and creates junction
  mouths rather than stacking complete asphalt rectangles. Differently graded
  surfaces are not accidentally erased when their endpoints meet.
- Road markings use whole authored routes, not restarted stations on each grade
  piece. Curbs, dashes and lamps follow actual pavement height and clear full
  doorway approaches and junctions.
- Removed old per-segment non-colliding utility cabinets. Their hard-coded Y
  position caused floating cabinets in the lowered court, and grade subdivision
  duplicated them around intersections. Real collision-backed cover remains.
- Replaced broad green district carpets with smaller framed planting areas.
  Astra presentation helpers add restrained street/entry treatment to the two
  new authored neighborhoods without placing opaque false cover in lanes.

## Camera and HUD

- Camera, movement and aim use the same forward basis. The canonical shared
  astronaut factory's model-forward correction is applied at the visual child,
  not by changing gameplay yaw.
- Starliner view initializes behind its longitudinal axis once, then preserves
  deliberate player yaw/pitch. Drop continues from that look direction.
- The altitude ruler is slimmer and anchored below the minimap in the right HUD
  zone. Its underlying altitude and deployment calculations are unchanged.

## Experience evidence and remaining work

Reviewed aerial, Transit Court, South Exchange before/after cabinet removal,
Starliner framing, freefall, Ion Wings, landing and the right-side altitude HUD.
South Exchange now has street-facing enclosure; the lowered court has an actual
retaining edge and graded access. These localized improvements do not prove the
whole-island visual acceptance standard.

The corrected density diagnostic excludes roads, floors and named location
centers from enclosure. After South Exchange, 17.1% of interior samples remain
over 30m from a building/cover footprint and 2.0% remain over 50m; the largest
sampled gap is 69.6m. Remaining open corridors need intentional framing and
ground-level review. The aerial still has repetitive masses and weak apparent
height variation at some viewing angles.

Manual 360° free-look and movement-feel acceptance is not complete. Most in-app
review was hidden/backgrounded; its observed FPS is not a hardware benchmark.
Unit forward-basis/orbit tests are not substituted for human control review.

## Validation record

- Typecheck and production build passed after the geometry, neighborhood and
  road-helper integration. Existing shared Three/Rapier bundle warning remains.
- Initial full suite: 646 passed / 5 failed, 113 files. All five failures were in
  the generic secondary-dressing fixture, which included the new dedicated South
  Exchange despite having no generic pocket. The fixture now explicitly separates
  both dedicated neighborhoods while retaining 30 legacy sites, 34 pocket groups,
  272 parts and the same clearance/budget assertions. Focused rerun: 7/7 passed.
- Frozen rerun: **651/651 passed across 113 files in 139.15s**. Full Playwright
  E2E then ran sequentially without source/build changes: **10/10 passed in
  6.2 minutes**, including both BR flows, Classic raid/rematch and Chaos.
- Previous E2E attempt: 8/10 passed. The two BR failures captured a reloaded home
  document rather than an active match while source/build changes were occurring.
  This is not reported as a passing E2E result; a frozen sequential rerun is needed.
- Prior standalone server profiles passed unchanged average/p95/worst/snapshot
  budgets across 10/20/40 participants and three deterministic 40-player identity
  cases. An earlier random-identity run produced a 263.5ms worst tick; that spike
  has not been diagnosed or claimed fixed. New neighborhood cost needs fresh
  recorded metrics. No server authority or performance budget was relaxed.

### Fresh standalone server profile

Recorded after South Exchange integration, with no active review match. Same
16ms average / 45ms p95 / 150ms worst / 160,000-byte snapshot limits:

| Participants / identity case | Average / p95 / worst tick (ms) | Maximum snapshot (bytes) |
| --- | --- | --- |
| 10 / 0 | 0.650 / 1.412 / 13.281 | 10,689 |
| 20 / 0 | 1.044 / 2.308 / 5.710 | 18,536 |
| 40 / 0 | 4.011 / 8.916 / 15.249 | 33,969 |
| 40 / 1000 | 4.178 / 11.171 / 22.565 | 33,731 |
| 40 / 5000 | 4.598 / 11.699 / 20.661 | 33,891 |

All five cases passed. These are host measurements, not hardware-independent
guarantees and not proof the earlier random-identity GC/tick spike is fixed.

### Retaining-edge review follow-up

New deterministic Academy/Helios ground-level comparison views pass the existing
camera collision/finite tests. Live screenshots exposed broad surface skins
overhanging raised retaining edges because each patch was assigned one height
from its center. Astra's surface partition helper is now integrated: it clips
patches at actual deck boundaries, preserves continuous source UVs, and combines
the fragments into one buffer per patch. Reviewed both retaining edges again;
the unsupported decorative lip is gone. Plain retaining-wall presentation still
needs work. The frozen follow-up passed **657/657 tests across 114 files in
147.09s**, production build, and **10/10 E2E in 6.4 minutes**. This record
predates the following camera-input and Production Transfer changes.

### Horizontal look-input correction

The canonical forward vector is `(sin(yaw), 0, -cos(yaw))`. Its positive yaw
derivative is screen-right, but BR subtracted positive mouse/right-stick X input.
Extracted `brLookAngles` and reproduced the sign error with failing mouse and
controller tests before fixing it to add X input. Vertical inversion, clamps,
existing camera presets, Classic input and physics are unchanged. Focused camera,
review, feedback and terrain validation passed **52/52** before the new block.
Manual 360-degree control acceptance remains incomplete: the in-app browser did
not acquire pointer lock during the attempted native canvas interactions. This
is not described as a successful manual free-look test.

### Production Transfer geometry and review

Live ground-level review at `(180, 199)` reproduced the empty Helios–Farms
underpass: flat deck foreground, a road above eye level, thin supports and distant
buildings. Replaced it with a **101×44m, +4m** deck spanning x=144…245,
z=176…220, meeting the Farms plateau. Four enterable buildings front its streets:
logistics `(170,184)`, canteen `(170,203)`, control `(228,184)` and maintenance
`(149,205)`. The local main street is x=189, z=184…220; arrival runs to `(201,184)`
and the cross street joins the boulevard at `(208,196)`. The boulevard now goes
`(190,166) → (194,178) → (201,184) → (215,208) → (225,224)`.

Initial placement failed the unchanged road-clearance tests and was corrected.
Continuous movement then exposed a wide incline intersecting the level arrival
street: finished that incline ahead of the junction. The remaining seam bug was
the shared grade query extending an endpoint plane beyond its real ribbon. It
now preserves lateral capsule reach without extending the endpoint; no physics
foundation rewrite or test-budget relaxation. Four new forward/reverse traversal
tests compare prediction and authority every step, require grounded contact,
check independent ray support, and verify each destination. Together with the
existing physics and elevation tests, **37/37 passed**.

Live corridor and district-overview screenshots show closer street-facing
architecture instead of the empty underpass. They also expose unfinished
road-edge transitions and repeated building silhouettes. Bespoke Astra street
dressing remains pending (Astra usage is currently unavailable); this block uses
the existing structure shells. Density diagnostic after the block: **16.2%** of
samples over 30m from enclosure, **1.7%** over 50m, **0.0%** over 75m; largest
remaining gap **69.6m**. These are geometric diagnostics, not visual acceptance.
Latest typecheck and production build passed. Frozen full validation after the
look-input/transfer/grade-endpoint changes: **667/667 tests, 115 files, 148.69s**;
**10/10 E2E, 6.3 minutes**. Includes the seeded 40-player Solo/Duo/Squad lifecycle,
existing latency cases, BR room/drop/landing, Classic raid/rematch, Chaos and the
existing visual-budget test. Automated E2E is not a complete human playability
review or proof that the whole-island art acceptance standard has been met.

Fresh standalone profile (after E2E, review server stopped):

| Participants / identity case | Average / p95 / worst tick (ms) | Maximum snapshot (bytes) |
| --- | --- | --- |
| 10 / 0 | 0.616 / 1.439 / 16.796 | 10,700 |
| 20 / 0 | 0.992 / 2.227 / 5.610 | 18,380 |
| 40 / 0 | 4.632 / 10.836 / 21.352 | 35,469 |
| 40 / 1000 | 5.041 / 12.994 / 20.793 | 34,376 |
| 40 / 5000 | 4.706 / 10.876 / 17.312 | 33,797 |

All five cases passed the unchanged budgets. The new layout has higher cost in
these 40-player samples than the earlier recorded map. These host measurements
do not resolve the earlier random-identity spike or establish rendering FPS.
Observed review counters: corridor about 266 calls / 281,610 triangles;
district overview 873 calls / 365,508 triangles / 42 textures / 250 world
materials. The review browser's 1 FPS is not a valid mid-range-PC performance
measurement, and its precise cause has not been established. The overall pass
remains unfinished and uncommitted.

A second live check after full validation reproduced the correct behind-axis
Starliner framing. Presenting the browser changed its actual viewport from the
hidden 1280×720 render to a 477×632 side panel. Retried native canvas capture at
coordinates inside that actual viewport; `document.pointerLockElement` remained
null and no console error was emitted. Restored the browser's previous hidden
state and transfer-corridor review selection afterward. This attempt is not
reported as successful mouse-orbit or movement-feel acceptance. The review server
is available again on localhost:5173; source remains at the tested checkpoint.

### Street-frontage and crate recovery (next continuation)

The road-junction audit exposed a real Horizon Homes defect: independently
graded main/cross streets differed by **2.048m** at their common origin. The
main street itself was **2.368m above** its ground-level entrances. Live
`deck-transition` review showed a pale slab spanning the neighborhood at head
height, supported by thin posts. Two focused frontage tests failed before the
fix. Four literal road profiles now keep the neighborhood and west avenue at
base level: `horizon-homes-main`, `horizon-homes-cross`, `service-3`, and
`west-neighborhood-link-a`. The cross street stays at +5m from z=-57 to -50,
grades to base at z=-36, then continues to z=-3. The feeder follows the same
grade and meets Nova's north arterial at (-255,-56). The north arterial moved
from z=-48 to z=-56, keeping its whole width on the raised deck; its west and
northeast links follow that junction. The ramp rises 5m over 14m (35.7%),
retaining the existing less-than-40% grade budget. This is fixed level design,
not another global apron algorithm or an island-size change.

Continuous traversal caught an upper-ring end-cap collision during the first
ramp draft. The ramp now finishes outside the **whole** upper-ring width,
rather than only meeting its centerline. The next failure exposed a separate
collider construction bug: rotating the slab moves its upper face horizontally
by `-halfThickness * sin(slope)`. The old Y-only center offset left its real
top endpoints displaced from the authoritative ribbon/floor query. Added the
opposite longitudinal center offset in `roadGradeBlocks`. A new exact top-edge
transform test failed before that correction and now passes for every road
collider. Prediction and authority use the same corrected map blocks; movement
settings and the controller were not changed.

The first full run rejected a steep interim ramp and a one-meter bent feeder:
673/675 tests passed, with the grade-budget and streetscape-edge tests correctly
failing. Neither assertion was relaxed. Lengthening the grade and moving the
upper ring exposed another independent defect: the fast path extended a
platform's support plane beyond its physical edge by the capsule radius. At
z=-49.64 it claimed grounded y=5.035 while a real downward ray measured a
16.4cm gap. Exact platform footprints now select the fast floor; partial edge
contact is handed back to Rapier. A focused regression protects that boundary.
Continuous Horizon traversal passes both directions with prediction parity and
less than 8cm actual support distance on every frame.

Star Crate placement also predated road-first districts: eight secondary crates
occupied road centerlines, while several other centers were below nearby raised
road planes. Replaced the center/index placement rule with eleven fixed yard and
forecourt sockets, preserving supply count and order. Footprint/door/structure
clearance and nine support samples per crate protect against intersecting a
neighboring building or embedding in its floor. Independent server rays and
prediction support queries verify actual base, raised terrace and sunken deck
support. Transit Court's crate is now (122,-2.38,99.5), next to the service-store
forecourt instead of the street junction. A bad first West Park candidate inside
Academy Dorms was rejected by support checks; the Overlook forecourt explicitly
uses the Checkpoint terrace's +4.5m floor rather than its POI center's y=0.

Post-fix screenshots at the same `deck-transition` camera show a real lower
street between the entrances with a separate ramp ahead, replacing the overhead
slab. The Transit Court screenshot shows its crate beside the shop and an empty
travel lane. Reviewed Production Transfer as well: road geometry is continuous,
but its facade variety and streetscape transitions still need presentation work.
The temporary 1280x720 responsive viewport was reset afterward. Screenshot
counters are not a reliable host-FPS benchmark: the in-app review still updates
at roughly 1 FPS between captures, and repeated menu transitions briefly timed
out. No new claim of human mouse/free-look acceptance is made.

Focused map/frontage/physics/placement validation: **66/66**. Typecheck and build
passed; the existing shared Three/Rapier chunk warning remains. Full fresh
regression/E2E/performance results follow below when those runs finish. The
junction diagnostic still reports 24 near-height crossings for inspection
(not all are necessarily erroneous bridges), including Central Security's
main/cross mismatch. This continuation does **not** claim the entire pass is
complete. All local changes remain uncommitted and unpushed.

### Follow-up: actual deck edges and bridge-side streets

Horizon support regression is now resolved without changing movement settings:
the fast floor path uses actual platform footprints, not radius-expanded floor
planes; partial capsule contacts return to Rapier. A subsequent frozen full run
passed 675/676 tests. Its sole failure was the old Nova waiting bay clipping the
relocated north road. Astra moved that fixed forecourt from (-145,-65) to
(-145,-68), retaining count, context and the unchanged 10.5m road clearance.

Central Security also inherited the Academy apron at ground-level buildings.
Its main/cross roads now meet at y=0. The first proposed diagonal access ramp
intersected those through-streets and was rejected by traversal tests. The
completed feeder instead follows (-145,85) -> (-108,85) -> (-108,42) -> (-80,42)
-> (-76,42) -> (-70,42). It stays at base level until the last short 36.3cm rise,
joining the existing Zero west arterial's real plane before its full-width edge.
Both local street axes and the entire feeder pass independent support rays,
client/server parity and continuous arrival checks.

This bent street exposed a presentation assumption: marking/clearance helpers
treated routes as endpoint chords. Astra now stations curb/paint/light details
along ordered actual road pieces and masks real footprints, retaining bounded
collinear-subdivision work. Focused L-shape tests guard against painting across
the vacant corner or hiding detail beside an imaginary diagonal road.

A broader attempt to flatten Zero's west/south civic roads revealed conflicts
with Central Heights' existing raised streets and Nova's east ring. That
uncompleted experiment was removed; it is NOT reported as a fix. The west civic
apron and Central Heights frontage remain explicit follow-up audit items.
Final fresh full-suite/E2E results for this checkpoint are recorded below.

### Oct 7: parcel separation and split-level civic streets

Before this continuation's changes, the frozen checkpoint passed **683 tests in
121 files**. Full E2E passed **8/10**: BR quick-start hit the 90s test deadline
during responsive map checks; Classic raid missed the transient local shove
motion observation. An unchanged focused retry passed BR quick-start but failed
Classic earlier, while observing the outbound launch feed. These are unresolved
browser-flow failures, not a claimed green Classic regression. No thresholds or
timeouts were relaxed.

The independent structure-volume audit found two actual primary-building
intersections that the older secondary-only parcel check missed: hotel/Tower B
(100m²) and market/studio (189m²). Nova Studio now sits at (-150,-103), retaining
34x22m and its interior/roof access; Market sits at (-114,-106), 22x20m, facing
east; Hotel sits at (-128,-197), 24x18m, with the west entrance retained. The
studio/market alley is 8m wide, and the hotel/tower alley is 3m. Independent
continuous prediction/authority traversal covers both entries and both alleys.
The 36cm indoor floor threshold is intentional; entry tests distinguish the
capsule's autostep transition from steady indoor/outdoor foot support. Astra
shifted the north garden to (-156.5,-75) and waiting bay to (-144,-68), preserving
the old clearance and count budgets after the studio moved.

Service-23's inner bend also exposed coplanar curb overlap. Astra trimmed actual
inside runs using signed corner angle and strip width, preserving collinear
subdivision invariance. This fixes the geometry, rather than masking flicker.

Central Heights still had its cross street 3.289m above ground-level entrances,
and Zero's west/south civic loop inherited the neighboring Nova apron. This
continuation replaces those specific profiles, not the elevation architecture:

- Central Heights main: (-105,+5,-82) -> (-84,+5,-82) -> (-69,0,-82) ->
  (-45,0,-82), floor heights shown. Its 5m/15m grade stays below the 40% budget.
- Cross street: x=-65, z=-109 to -33, ground level. The district origin is its
  ground junction (-65,-82), not an implicit midpoint on the access ramp.
- Service-0 and Radial-0 share that ramp. Radial-0 follows (-70,-58) ->
  (-65,-58) -> (-65,-82) -> (-69,-82) -> (-84,-82) -> (-92,-82); its width is
  8m to match a neighborhood feeder rather than encroach on the shop parcel.
- Zero west/south loops now remain ground-level. Security's bent feeder remains
  level through its connection at (-70,42), with no obsolete 36cm final rise.
- Central Heights apartment moved x=-51 to -48, shop x=-55 to -51, preserving
  footprints/entrances; the +5m utility building remains on Nova. The crate is
  now (-53,.62,-70), and the existing residents' pocket moved to (-43,-69).

Six new continuous physical traversal tests walk the ramp, apartment/shop
frontage and Zero circuit in both directions. Every frame requires grounded
support, a real downward-ray gap under 8cm, client/server parity and arrival.
Focused shared map/frontage/crate plus physical checks passed **70/70**.
The new dogleg revealed that grade dressing still projected lights/girders onto
route endpoint chords. With Astra unavailable due to its usage limit, Sol made
the small integration repair: edges use each piece's normal/yaw; light/support
stations use actual path arc length. An independent bent-grade/subdivision test
protects this, preserving six lights and at most nine supports per route.
Focused presentation/review checks passed **30/30**.

Reviewed/saved views in `artifacts/br-review-oct07/`: Nova east block, Nova roof,
Horizon access, Transit Court, Central Security and the pre-fix Central Heights
frontage. Screenshot counters fluctuate between background 1 FPS and foreground
~41 FPS; they do not establish 60-FPS readiness. The baseline Nova east view
showed 456 calls / 396,628 triangles / 48 textures / 250 world materials / 26,138
enabled instances. Counts remain **164 structures / 82 enterable / 33 secondary
locations**; no density is claimed merely from those numbers.

Standalone deterministic-ID perf checks before the latest parcel/profile
changes passed all five budgets: 10 participants averaged .989ms / p95 2.236ms;
20 averaged 3.085ms / p95 6.553ms; 40 averaged 7.786–8.226ms / p95 16.992–17.411ms,
worst 27.428–48.164ms, max snapshot 33,789–34,378 bytes. Historical production-ID
spikes remain a separate unresolved measurement; deterministic passes do not
prove those spikes are gone. Fresh final validation for the current source is
recorded below. The full pass is still pending remaining density/composition
review, human 360-degree mouse/control acceptance and a clean E2E investigation.
All existing local work remains preserved, uncommitted and unpushed.

Current frozen source validation: **701/701 tests, 124 files, 254.55s**;
`npm run typecheck` and `npm run build` passed. Vite's existing large shared
Three/Rapier chunk warning remains. Full E2E with traces completed **5 passed /
5 failed (18.8m)**. BR isolation missed the attached/inside-island jump window;
BR quick play and the two-player flow reached their 90s deadlines; Classic raid
failed pointer-lock acquisition; Chaos missed its temporary modifier reveal.
Two trace teardowns also timed out and produced truncated ZIP diagnostics.
The valid BR trace records Start returning at 176.194s and the jump predicate
beginning at 222.148s: nearly 46s later, beyond the 36s ship phase. That explains
this missed transient condition, not the experience quality of the drop.
Host memory was approximately 603MiB free of 15.8GiB during that run. Resource
pressure is relevant evidence, not proof that every failure is environmental.
Assertions, timeouts, authority and ship timing were not weakened for a pass.

The expanded secondary-frontage diagnostic found additional **audit candidates**,
not yet screenshot-confirmed fixes: Comet Hotel nearby streets 0.87–5m above
building floors, Academy Dorms 4.33–7.67m, West Overlook 5.69m, Helios Relay
2.29m, Orbital Overlook support parcel 1.86m, Farm Service support parcel 1.02m,
West Park 2.67–7.67m. This compares each shell to its closest local-road plane,
not an actual doorway traversal; some neighboring bridges may be intentional.
Each requires ground-height inspection and an authored access decision before
changing its profile. Do not interpret the current green suite as proof that
all remaining district frontages are playable or that the spatial pass is done.

## October 7 continuation — Comet Hotel ground arrival

Ground-height browser inspection confirmed a concrete frontage failure:
`hotel-frontage-before.jpg` shows an elevated road slab crossing the hotel door
around torso height. This was the apron-driven road plane, not a decorative
facade problem. The existing enterable hotel remains (-94,0,-236), 24x22m,
with its original east entrance and interior. No collider/visual concealment
was used to hide the slab.

- Hotel local cross street moved x=-76 -> -65, z=-241 to -187, at floor 0.
- Nova access: (-106,5,-214) -> (-84,5,-214) -> (-69,0,-214) ->
  (-46,0,-214), matching the existing complete upper-ring edge clearance.
- Service-2 shares that same access ramp, joining at (-65,0,-214).
- Civic promenade stays at floor 0: (0,-80) -> (-65,-175) -> (-65,-214),
  then east to (-46,-214), rather than independently rising on Nova's apron.
- South avenue: (-65,-241) -> (-65,-270) -> (-76,-270) -> (-76,-340),
  all floor 0. Its short dogleg preserves the existing South Exchange parcels
  and Crash/Cargo junction (-76,-290). Initial straight-extension clearance
  tests caught a conflict with the office; the route was redesigned, not the
  clearance threshold relaxed. The grid test now also checks the real road
  piece through that junction, not only the endpoint chord.
- Hotel service shell moved x=-56 -> -50, keeping its 14x20m footprint. The
  nearest courtyard cover moved x=-62 -> -53, outside the new street; other
  cover, hotel lounge, garden presentation and supply counts remain unchanged.

Added 8 real Rapier traversal checks (ramp/frontage/civic route/door, each both
directions), 2 shared profile regressions and a player-height review fixture.
Continuous support, arrival and XYZ prediction/authority parity are required;
the hotel's existing 36cm floor autostep is explicitly tested. All **120/120**
focused map, physics, parcel, road-surface, marking and presentation checks pass.
The first expanded full-suite run found two presentation integration failures
(710 passed / 2 failed): South Exchange interpreted the hotel dogleg as a
diagonal chord, and the deck-transition helper's four fixed shoulder stations
no longer found its required third clear site. Neither failure was ignored.

The hotel south route now exposes three explicit contracts: entry
(-65,-241) -> (-65,-270), link (-65,-270) -> (-76,-270), and avenue
(-76,-270) -> (-76,-340). Its physical path is unchanged; parcel helpers now
receive the actual topology instead of an imaginary diagonal. Shared tests
assert every connection and level, plus the Crash/Cargo junction. Deck detail
tries a corridor midpoint only after its original four stations; all footprint,
road, terrain, structure, reservation and island exclusions remain unchanged.
The clear ring-se-south midpoint (193.5,-245.5) has a focused regression.
Focused integration recheck passed **105/105 in 9 files (22.39s)**.
Typecheck and build passed again. Final full-suite/E2E results follow below.

Frozen-source full suite: **713/713 tests, 125 files, 234.80s**. The independent
density-audit tool regressions passed **3/3**. Fresh 10m-grid analysis still
finds meaningful gaps: (180,420) 69.6m from building/cover, (-210,-340) 63.7m,
(-300,-140) 61.6m, (-250,-410) 61.6m, (110,-370) 61.2m and (-170,170) 60.8m.
16.1% of interior samples exceed 30m, 1.7% exceed 50m, none exceed 75m.
Floors/roads/POI labels do not count as enclosure. These are remaining review
targets, not evidence that composition is finished; sightlines, apparent scale
and ground-height screenshots remain decisive.

Normal-settings E2E (no trace, IAB parked) completed **9/10 passing in 8.5m**.
Both BR flows, settings, shop, two-player startup, Chaos, cannon guide, scene
budget and solo bots passed. Classic raid failed its local presentation-speed
poll, not shove acceptance: failure context contains `Chris shoved Nova`, and
the server stat/authoritative movement checks passed. The previous diagnostic
incorrectly called every downstream failure a rejected shove.

E2E now samples the defender's real debug speed on animation frames, gated on
an increment in its authoritative `timesShoved` counter. This cannot pass on
approach movement or merely receiving an event velocity. The >4m/s threshold,
3s deadline, server acceptance and >.6m authoritative movement checks are all
unchanged. Diagnostics now include acceptance count, frame count and peak.
Focused/full rerun results are recorded after completion; no Classic gameplay
or authority change was made based on a missed transient observation alone.

### Classic E2E driver investigation (not a gameplay fix)

Focused reruns exposed two additional driver failures before the shove:
the first returned from its approach before braking stopped, settling around
3m apart (outside the unchanged 2.2m range); the next tried to navigate within
.7m of the defender's centre, which player colliders do not reliably permit.
The driver now rechecks precision arrival after braking and uses the actual
same-surface, predicted AND authoritative shove-range precondition as its
face-to-face navigation goal. All action outcome assertions remain: server
acceptance, feed, >.6m authoritative movement and >4m/s observed local speed.
Ordinary cannon/pad navigation retains its original input-release cadence.
No match, assertion or interaction deadlines/ranges were increased.

The first valid-range rerun reached shove acceptance, presentation knockback
and repair sabotage, but exceeded the unchanged 220s test timeout on the
return-pad navigation. Therefore Classic raid E2E remains unresolved. A
successful intermediate action is not a complete raid-flow pass. Fresh final
results follow only after the next run.

## October 7 continuation — Academy lower frontage

Browser capture `academy-dorms-before.jpg` confirmed an elevated road beside
ground-floor dorm/park architecture. Campus-apron grading raised the dorm's
cross street to 7.67m despite the apartment floor remaining at zero. Keep the
large +8m Academy campus and its upper circulation; do not flatten the region.

- Dorm lower junction/origin: (-400,0,125), formerly (-370,0,125).
- Dorm lower loop: (-400,123) -> (-400,185) -> (-369,185) -> (-369,159),
  all floor zero. The actual east door remains at (-373,0,167).
- Dorm campus access: (-400,0,125) -> (-394,0,125) -> (-372,8,125) ->
  (-340,8,125); service-4 uses the same ramp to the upper road (-365,8,125).
- Park through access: (-430,0,150) -> (-394,0,150) -> (-372,8,150) ->
  (-365,8,150). The cross street x=-400 and service-21 stay at ground level.
- Park lab moved (-360,0,166) -> (-347,0,174), same 20x18m footprint,
  west-facing shell. This reserves an actual frontage corridor between it and
  the dorm instead of running a 7m road through a 3m gap.
- Ground dorm apartment and supporting building are unchanged. The existing
  campus shop (-350,8,81) remains on the raised deck. No inventory/loot counts
  or building sizes were altered; normal authored loot generation follows
  the corresponding structure contracts.

Added eight continuous Rapier walks (two access ramps, lower loop and actual
dorm door, each both directions), with actual support, final arrival and
prediction/authority parity. Added two profile regressions and a collision-
validated player-height review fixture. Focused integration passed
**119/119 tests in 9 files, 22.98s**. Typecheck/build passed after the layout
change. No test clearance was reduced: the first run caught a conservative
road-end overlap with the supporting building, so the start moved 121 -> 123;
another caught the shifted park-origin contract, which was explicitly restored
to its actual junction rather than changing the assertion.

`academy-dorms-frontage-after.jpg` shows the now-open ground entrance but also
exposes an unattractive bare retaining wall. It is NOT final visual acceptance.
Astra is assigned an isolated, shallow attached retaining-face treatment; Sol
retains map/collision ownership and mixed-renderer integration. Full regression
and final presentation review are still required.

Fresh standalone performance before the hotel repair passed all five budgets:
10 participants avg 1.941ms / p95 4.726ms / max 54.964ms;
20 avg 3.660ms / p95 9.079ms / max 15.154ms;
40 identity cases avg 7.520–9.030ms / p95 16.325–23.895ms /
max 29.787–57.664ms, max snapshots 33,998–34,273 bytes. These are server
measurements, not a browser FPS claim or proof of all production-ID cases.

### Academy retaining-face integration and fresh validation

Astra supplied `br-academy-lower-frontage.ts` and its focused tests. Sol reviewed
and integrated the helper into `BrWorldRenderer`: five shallow panel bays,
attached seams/plinths and two maintenance cassettes on the existing north
retaining face. It adds 38 instances in four borrowed-material batches, not
new collision, lights or generated textures. Existing detail-sector distance
culling applies. Instance cleanup is explicit and idempotent; shared geometry
and materials remain library-owned. The actual dorm approach stays clear.

Focused helper plus real Academy traversal checks passed **12/12 in two files**.
The integrated frozen-source validation passed typecheck and build, followed by
**728/728 unit/integration tests in 127 files (152.84s)**. Fresh full E2E is still
running at this checkpoint; both BR flows have passed, not the entire suite yet.
The integrated frontage still requires a fresh screenshot review. The previous
bare-wall screenshot must not be presented as the finished visual result.

Read-only door/nearby-road audit identifies West Overlook's ground-floor shop
at (-385,0,31): the nearby cross street x=-405 is 1.83m above its floor, while
the main road independently slopes from zero to 6.83m and meets that street at
a different height. This is the next browser reproduction target, not a fix
already implemented. Preserve the Academy's large +8m deck; repair the lower
street contract rather than flattening the campus.

The frozen checkpoint's full E2E subsequently completed **10/10 in 6.5m**,
including the complete Classic raid (3.1m), Chaos, both BR flows and the scene
budget. No Classic gameplay, deadlines or outcome thresholds were changed.
This result predates the West Overlook repair below and is not a final-pass
acceptance claim. `academy-dorms-frontage-integrated.jpg` confirms the retaining
skin is visible and the real door approach remains open. The treatment improves
wall scale but does not by itself make the whole campus a finished showcase.

## October 7 continuation — West Overlook ground-floor repair

Added a collider-validated ground-height review fixture, reproduced the problem
and saved `west-overlook-frontage-before.jpg`. The shot shows a hovering road
slab across the shop's lower facade. Correct the supporting road plane, not the
building shell or its loot height:

- west-overlook-main: (-435,0,15) -> (-375,0,15).
- west-overlook-cross: (-405,0,-12) -> (-405,0,42).
- service-5: (-405,0,15) -> (-430,0,15).

All three now meet the real floor at the junction (-405,0,15). The original
shop (-385,0,31), west-facing doorway, building dimensions, support parcels,
loot counts and +8m Academy region remain unchanged. Six real continuous walks
test the through street, cross street and actual shop door in both directions;
ground support, final arrival and XYZ prediction/authority parity are required.
One profile and one review-camera regression were added. Focused validation
passed **115/115 in 8 files (14.53s)**, including map/parcel, road geometry,
marking and presentation checks. `west-overlook-frontage-after.jpg` uses the
same framing and confirms the hovering slab is gone and the doorway is clear.
Fresh broad validation results are recorded only after completion.

### Fresh visual critique — not complete

Reviewed and saved the current aerial, Solar Rim and central civic junction.
The green district carpets are broken up and streets now have clearer local
frontage, but the aerial still contains broad gray gaps. Solar Rim has a large
undefined foreground before the Farms skyline; the central civic approach
still relies too heavily on distant structures. These are unresolved authored
composition targets, not solved by the ground-plane fixes. The 10m density
sample at (180,420) remains a priority. No random scatter or island shrink was
used to hide the problem.

Browser review here uses fixed dev cameras and DOM actions. It is not a native
mouse/keyboard 360-degree playtest. Background-tab 1 FPS readings are throttling,
not evidence of production performance; view-transition stats can be stale and
must not be quoted as settled scene benchmarks. West Overlook's displayed
steady local view was 444 calls / about 302k triangles / 250 world materials;
these are observations, not a mid-range-PC guarantee.

The West Overlook frozen-source run passed typecheck, build and **736/736
tests in 128 files (162.78s)**. Its new full E2E run is still in progress;
both BR flows have passed at this checkpoint. Keep this distinct from the
earlier 728-test / 10-E2E Academy checkpoint above.

### Next authored layout target (not implemented at this checkpoint)

Solar Rim's sampled (180,420) gap has no nearby building/cover footprints.
The island outline tapers strongly here: a rectangular four-corner block
would put its southeast building outside the island. A viable road-first
service block uses a north/south street at x=180, with two west-frontage
parcels and one east-frontage control building. Its northern arrival must
connect to the ring at (225,372) on the actual 3.5556m road plane, hold beyond
the complete road shoulder, and descend before the ground-level junction.
Do not reuse the nearby Farms apron to raise its storefront road.

Read-only parcel checks found clear footprints at (155,418), (152,437) and
(205,413), avoiding existing roads and structures. They are candidate level
design, not accepted implementation or screenshot evidence. Keep the raised
Farms/Solar Field decks and the island outline unchanged. The new block must
be tested for full-footprint island containment, road/door clearance,
prediction/authority parity, loot access and actual rendered composition.

The West Overlook checkpoint subsequently completed **10/10 E2E in 7.5m**,
including the Classic raid (3.3m), Chaos and both BR flows. This is a complete
automated checkpoint, not the final spatial-composition acceptance result.

### Solar Rim service block — implementation and local review

Added Solar Service at (180,0,416), with three fixed ground-floor parcels:
shop (155,0,418), 22x18x7m, east entrance; control office (205,0,414),
22x16x9m, west entrance; maintenance (153,0,437), 20x14x6m, east entrance.
Their actual interiors, floors, loot sockets and single-street approaches
come from the existing authoritative architecture. No exterior roof ramps.
The island remains 1000m and the existing Farms/Solar Field raised decks
are unchanged. Totals are now **167 structures, 85 enterable, 34 secondary
locations**. The structures are appended to preserve all prior loot ordering
and alternating socket positions. A new yard crate sits at (191,.62,433).

Authored routes:

- Solar Service access: (225,3.5556,372) -> (225,3.5556,380) ->
  (225,0,397) -> (225,0,400). It joins the ring's actual plane, holds beyond
  the full northern shoulder, then descends before the lower arrival.
- Arrival/cross: (225,0,400) -> (180,0,400).
- Local street: (180,0,400) -> (180,0,436), with an intentional loading-yard
  terminus, not a new road pretending to continue across the rim.
- service-33: (180,0,416) -> (180,0,400).

The first clearance run caught the control building touching the full arrival
road shoulder. Its parcel was revised to retain a real gap; the strict global
road-clearance assertion remains unchanged. Five layout regressions and eight
continuous bidirectional Rapier walks cover the ring descent and all three
actual entrances, requiring support, arrival and XYZ prediction/authority
parity. A new collider-checked street-height review fixture is included.
Focused validation passed **101/101 tests in seven files (34.68s)**.

The density sample at (180,420) now has an actual building footprint 14m away,
instead of about 69.6m. All three buildings are within 20m. Whole-map samples
over 30m from enclosure fell from 16.1% to 15.3%; over 50m from 1.7% to 1.5%.
Those are geometric diagnostics, not a claim that all empty space is solved.

Saved and inspected `solar-rim-service-after.jpg` from the exact prior camera,
and `solar-service-street.jpg` at player height. The new street has clear nearby
facing storefronts and a readable raised Farms backdrop. The old comparison
camera now hugs the maintenance corner: it shows stronger enclosure but the
plain close corner remains artistically blunt. No dedicated Astra decorative
helper was fabricated by Sol while Astra was usage-limited. This is an authored
spatial block using established visual factories, not finished presentation.

The live ten-player review displayed roughly 943 calls / 315k triangles and
13-20 FPS, including active combat effects. This is not controlled hardware
profiling or a 60 FPS claim; it warrants later performance review. The preview
was parked on about:blank before the new frozen-source broad regression run.
The central civic gap and several wider island gaps remain unresolved.

The Solar Service frozen-source validation passed typecheck and build,
then **750/750 unit/integration tests in 130 files (218.09s)**. Full E2E
is running against this exact layout; its result is not assumed from the
earlier West Overlook checkpoint.

### Next gap: the southern ring, not random scatter

After Solar Service, the density audit's largest sampled gap is (-210,-340):
the existing 17m-wide ring street runs directly through it, but the nearest
building footprint is Crash Salvage about 63.7m away. This is a street without
frontage, not a shortage of tiny props. A future authored block must relate
to the ring, Salvage Row and the raised Emergency Depot, reserve both north
and south pedestrian shoulders, and provide real entrances/loot. Its shape
must be reviewed from road height; four repeated isolated boxes would simply
reproduce the current planning problem. No implementation of this next block
is claimed at this checkpoint.

### Newest full E2E result — not green

The Solar Service full run completed **7/10 E2E (10.2m)**. Both BR tests
reached gameplay: the first exceeded its unchanged 180s total deadline on
the final jump-input debug read; the Solo test exceeded its unchanged 90s
deadline reading tactical-map layout. The Classic raid failed its unchanged
5s first cannon-hit feed expectation (empty feed). Earlier same-turn full
checkpoints were 10/10, but they do not substitute for this newest result.

The machine showed about 1.1GB free RAM during this run and about 748MB in
another observation. Sol stopped only the owned local preview process to
reduce competing load; unrelated user applications were not touched. A
focused unchanged-source rerun of all three failing tests is in progress.
Do not assume load is the complete root cause, weaken deadlines or describe
this full E2E run as passed. No commit/push/deploy was performed.

### Continued failure investigation and lobby-load regression

The unchanged-source three-test recheck failed 3/3, at different stages:
BR create exposed an empty room code/roster after 15 seconds; BR Solo reached
the map but exhausted its unchanged 90s deadline on a teammate-count read;
Classic completed gameplay/results but exhausted its unchanged 220s deadline
on host rematch. This does not prove all failures share one cause.

The empty BR lobby has a concrete client dependency error: `applyBrRoom`
revealed the lobby before awaiting `ensureBrGame`, but did not render its
authoritative room code, roster or controls until after that heavy import and
world construction. Those DOM controls now render before that await. A late
continuation only sets its room when it is still the current room view.

A new real-browser regression deliberately holds the BR game-module request
unresolved, then checks the roster, six-character room code, authoritative
10-player configuration, Ready state and enabled host Start control. It passed
**1/1 E2E (52.0s total, 19.5s test)** with the module still gated during the
assertions. No timeout or assertion was relaxed. A fresh two-BR lifecycle
recheck is pending; this isolated regression is not a full E2E pass.

Astra produced an isolated Solar Service frontage builder plus nine focused
tests. It partitions the existing corner envelopes, adds restrained attached
belts and reuses existing materials. Parent integration and same-camera
screenshot review remain pending; code generation alone is not visual
acceptance. All other local spatial work remains preserved and uncommitted.

### Solar facade integration and tactical-map workload

Sol integrated the isolated Solar helper in `br-world.ts`: four borrowed
material/unit-box batches join the existing per-structure base translation;
only the three Solar buildings omit the four generic corner columns. The
60 replacement/attached parts own no geometry, textures or materials. The
45 Solar/frontage/camera/traversal tests passed; a wider 51-test focused run
and typecheck passed after integration and the map-node change below.

The BR create/drop lifecycle recheck passed in 2.6m. Solo still exhausted
its unchanged 90s deadline at the tactical-map layout read. Source inspection
found that `renderBrMap` replaced the static SVG image, every label, storm
circle and player marker every 120ms. The new `br-tactical-map.ts` retains
static layers and updates only live marker properties, with keyed teammate
removal and no enemy-policy change. Three focused tests verify unchanged
node identity/allocation count across 100 updates, teammate cleanup, and
external-clear recovery. Real E2E now checks image identity across its
existing viewport/layout checks.

This removes proven DOM churn but did not make Solo's 90s total run green.
The game also drew the covered 3D world every RAF; `br-render-cadence.ts`
now bounds only tactical-map background WebGL draws to 8Hz. Input,
simulation, authority, camera and HUD continue on every frame; closing the
map resumes uncapped drawing immediately. Two focused cadence tests pass.
The subsequent Solo run still exceeded its deadline at the layout read.
Stage-timing diagnostics were added without changing assertions, quality
settings or deadlines. The precise wider slowdown remains under investigation;
neither optimization is presented as a complete fix for this E2E failure.

Parent matching-camera Solar screenshots and refreshed broad validation are
still required. No commit, push or deployment was performed.

### October 7 continuation — renderer ownership and south-ring block

The timed Solo failure reached its first two map layouts but spent 84.7s before
setting the final viewport, then hit the unchanged 90s deadline. Inspection
found both game modes independently resizing the shared WebGL renderer while
inactive. Classic and BR now keep their camera aspect current but only the
active mode writes framebuffer size/pixel ratio. Activation restores current
dimensions; repeated BR room updates do not trigger reallocations. Inactive BR
settings no longer change Classic shadows. Five tests exercise the actual
mode lifecycle methods with a shared renderer spy. This is a confirmed
ownership correction, not proof that it explains every earlier timeout.

Typecheck, production build and **769/769 tests in 134 files** passed at this
checkpoint (184.21s). The Solo E2E then passed in **48.9s / 57.3s total**, with
all three existing map-layout assertions and persistent map-image identity
intact. No timeout, graphics quality or gameplay assertion was relaxed.

Matching Solar close-up screenshots exposed a false premise in the initial
frontage treatment: the visible white surfaces were the wall shell and facade
backing panels, not the original dark corner columns. Astra revised only its
presentation helper/tests; Sol replaced the utility's exact shell/panel
envelopes in the mixed renderer and restored chamfered corner geometry. These
replacement shells retain camera collision. No physics, doorway, roof or
resource ownership changed. The dark industrial material is visibly different
in `solar-rim-service-wall-revised.jpg`, but still-simple massing remains a
visual weakness; this is not presented as showcase architecture.

A fresh south-ring ground view reproduced the 63.7m enclosure gap at
(-210,-340). **Salvage Crossing** now has four enterable parcels: shop
(-232,-315), office (-188,-315), warehouse (-232,-365), utility (-188,-365).
Entrances face each other across the new 8m street at x=-210, from the existing
Crash–Hotel avenue z=-290 through the unchanged 17m ring z=-340 to an intentional
loading court z=-386 (x=-242..-178). There are no exterior roof ramps. New
structures append after established structures, preserving existing loot
indices/sockets. Floor loot follows the same accessible-building contract.

Four map tests and ten real bidirectional Rapier walks check footprints,
road/neighbour clearance, loot, grounded support and prediction/authority
parity. The corresponding 48-test focus passed after integration. The old
roadside-pocket review camera was moved to its actual remaining clear bay
(-138.3,-300.5), since its former site is now occupied by the authored block;
the existing review assertion remained unchanged.

Saved same-camera evidence in `artifacts/br-review-oct07/`:
`south-ring-frontage-before.jpg` and `south-ring-frontage-after.jpg`. The latter
has nearby opposing entrances and a continuous intersection instead of gray
deck foreground. World totals are now **171 structures / 89 enterable / 35
secondary locations / 9 primary POIs**, with the 1000m island unchanged.
Density samples >30m from real enclosure improved **15.3% -> 14.1%**, >50m
**1.5% -> 1.1%**. Nearby buildings at the target are now 19.2m away. Other
60m-class gaps remain; normal-height review is still needed for each.

Representative review counters before/after: **652 -> 671 draw calls**,
**336,532 -> 358,874 triangles**, **256 -> 261 world materials**. Enabled
instances/sectors vary with review activation (20,490/17 -> 21,572/19), so
these are scene observations, not an isolated per-building cost benchmark.
Background browser RAF throttling made its 1 FPS output unsuitable as a
hardware performance claim. No new performance budget was relaxed.

Fresh typecheck/build passed after this block. Full unit/integration and E2E
are running again; results below will supersede the intermediate checkpoint.
No human-input manual acceptance or full-pass completion is claimed. No commit,
push or deployment was performed.

### October 7 continuation — south-ring integration and navigation

The first full south-ring run exposed seven failures in two test files:
exact world totals still described 34 sites / 167 structures / 85 enterable;
the complete-district contract assumed every district required a separate
indexed feeder; and the legacy dressing test incorrectly classified the new
ring block as one of its 30 authored furniture pockets. Totals now assert
35 / 171 / 89, the ring block's direct arterial intersection is checked,
and the new block is explicitly excluded from legacy dressing coverage.
All existing road/building/loot clearance requirements remain intact.
Typecheck, build and **785/785 tests in 136 files** passed (181.10s).

Further navigation inspection found no waypoint at the internal/internal
ring crossing (-210,-340). The graph was globally connected through the
northern avenue, but did not describe the immediate four-way junction. A
new regression failed on that missing node before the fix. The existing
avenue is now subdivided at the crossing, retaining its exact width, footprint
and topological endpoints. The crossing links both local legs and both ring
directions; **59/59 focused shared tests** passed. This focused correction
followed the 785-test checkpoint and requires a fresh final broad run.

The full 11-test E2E run uses the pre-waypoint compiled map snapshot; its BR
create/drop flow passed in 1.4m. Final results are pending. This is not claimed
as validation of the subsequent waypoint subdivision.

Astra's read-only review confirmed better south-ring enclosure but identified
repeated glass/grid/canopy presentation and ambiguous distant street framing.
The corrected Solar utility removes white glare but merges into an overly
dark foreground mass. These remain visual weaknesses, not completed polish.

### October 7 continuation — western ground frontage

The preceding full E2E completed **11/11 in 6.7 minutes**, including both BR
flows, real Classic raid input, Chaos, shop/settings and rendering budgets.
That compiled snapshot predates the ring-waypoint and following western changes;
it is not relabeled as validation of this later state.

Solar's shared brushed-metal body remained nearly black in the matching shadow
view. Astra switched the exact utility corner/shell/backing envelopes to the
existing low-metalness concrete finish. Sol integrated separate facade batches
without changing collision ownership: shells remain camera blockers; facade
backing remains non-blocking. Client typecheck and **11/11 focused tests** passed.
`solar-rim-service-matte-body.jpg` shows readable matte panels against dark trim.
The silhouette still needs work; this is a contrast correction, not final art.

The unchanged West Transit ground camera exposed the large undefined foreground
and independently graded avenue. **West Junction** now adds three ground-floor
parcels: shop (-312,-103), office (-294,-163), utility (-352,-152). The collector
remains eight metres wide with the same endpoints (-375,-125) / (-254,-135).
It is level through the new junction (-330,-128.71900826446281) and until
(-300,-131.19834710743802), then climbs five metres to
(-262,-134.3388429752066) before joining Nova. Its 38m grade is under eight
degrees. The local street x=-330, z=-118..-180 has two short entrance branches
and an intentional service court. Doorways are on supported ground, not below
an overhead street. No exterior roof ramps were added.

Three new map regressions were observed failing before this change. They now
check exact grade pieces, all road/neighbour footprint clearance, floor support,
accessible loot and the actual four-way navigation junction. Twelve additional
real bidirectional controller walks cover collector, grade, local street and
all three entrances with prediction/authority parity. **100/100 tests in five
focused files** passed including review cameras and legacy dressing clearance.
World totals: **174 structures, 92 enterable, 36 secondary sites, nine POIs**;
the 1000m island and established loot-socket ordering are preserved.

Same-camera `west-transit-avenue-blockout.jpg` now frames a nearby shop and
ground junction instead of the long unsupported street. Authored walks and
forecourts are being reviewed separately. Geometric density >30m from real
enclosure improved 14.1% -> **13.2%**, >50m 1.1% -> **0.9%**. The former largest
western gap is no longer among the top twelve; other 60m-class gaps still remain.
These metrics are diagnostics, not a claim of visual acceptance or completion.
Fresh broad validation of this later state is still required. All work remains
local; no commit, push or deployment was performed.

### October 8 continuation — West Junction presentation integration

Astra's isolated `br-west-junction.ts` helper now adds 15 flat paving pieces in
two shared-material batches. Each entrance has a continuous 4.8m-wide walk,
concrete side forecourts and street-edge walks. The partitions do not overlap
coplanarly and stay .15m from their adjacent road surfaces. Their tops are
.028m over the actual ground. There are no new colliders, opaque props, lights,
generated textures, animations or independently owned GPU resources. Sol
integrated the helper into the existing secondary-site detail group/LOD.
The Nova-only entrance-paving helper produces no pieces for these three
buildings; no existing paving was removed or hidden.

All **four presentation tests** and client typecheck passed. Tests check full
surface footprints against all roads/shells/loot/crates, partition overlap,
exact doorway alignment, real supporting height, determinism and invalid-input
handling. Fresh root typecheck and production build also passed after
integration. The existing large Rapier bundle warning remains unchanged.

Live browser inspection could not continue: the Windows computer-use service
stopped input because it could not determine the current browser URL with
enough confidence. No authentication UI was operated. Therefore the prior
`west-transit-avenue-blockout.jpg` is evidence of the new road/parcels only;
it does NOT show this later forecourt integration. Final integrated screenshot
and human-input acceptance remain pending. Automated E2E is recorded separately
from manual/browser playability acceptance. No claim of full-pass completion,
commit, push or deployment is made.

Fresh integrated validation on October 8: root typecheck and production build
passed; **806/806 tests in 139 files** passed in 288.07s. This run includes the
ring-junction subdivision, matte Solar facade integration, authoritative West
Junction block and its isolated paving helper. Density-audit tool tests passed
**3/3** separately. The subsequent West Junction traversal-test strengthening
passed **13/13** in 4.45s, including a negative case rejecting a capsule .5m
above its proper street position. Continuous road/grade routes require downward
surface contact within .08m on every frame. This check is intentionally not
applied at doorway autosteps: Rapier raises the capsule before its center
reaches the .36m floor lip, so even hemisphere sampling wrongly reports a gap
during an intentional transition. Door walks retain grounded state, exact
arrival, endpoint height and five-decimal prediction parity. No physics
tolerances or existing assertions were changed to satisfy the added measurement.

Fresh full E2E completed **9/11**, not a pass (8.5m). BR room/drop, lobby lazy
loading, shop/settings, two-human room lifecycle, Chaos, six-player rendering
budgets and Classic quick-play passed. BR Solo's responsive-map check exceeded
its unchanged 90-second test deadline while setting the second viewport. The
Classic raid's shove was accepted and the defender's presentation reached
9.46m/s, but the concurrent authoritative-displacement poll did not establish
its >.6m requirement inside its unchanged deadline. Both failures are being
rerun in isolation without concurrent unit validation; they are not dismissed
as unrelated or counted as passed. No assertions, timeouts or budgets were
weakened.

The isolated rerun completed **0/2**, not a pass. BR Solo missed HUD visibility
inside its unchanged 15s wait (rather than the full-run viewport timeout).
Classic reached the results/shop after completing the raid, then exceeded the
unchanged 220s overall deadline at Solar Gold's BUY click. Different failure
locations suggest timing/load sensitivity but do not prove an unrelated cause.
These remain explicit PC-reproduction items. The user requested a commit/push
checkpoint to move work off the laptop; `docs/PC_HANDOFF.md` records setup,
local routing templates, source/screenshot locations and unfinished acceptance.
