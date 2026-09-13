# Battle Royale polish checkpoint

Base: `92c9e82` (`Polish Battle Royale world and presentation`), on `main`.
This is a progress record, not a declaration that the full visual/gameplay acceptance standard has been met. No push or deployment was performed.

Thruster Works checkpoint: `npm test` **188/188 passed across 29 files in 59.20s**. Typecheck and build passed; BR chunk **119.15 KB / 36.96 KB gzip**. Full E2E rerun: **9/9 passed in 3.7 minutes**, including BR room/drop/landing isolation and Classic raid, Chaos, six participants and solo bots. Collision, weapon balance and server simulation were not changed by this visual follow-up. Browser exterior/interior/roof views were reviewed, not a hands-on combat playtest. Temporary review tabs and the agent's preview server were closed/stopped.

Latest checkpoint (Dockyard / Crash Site continuation): `npm test` **186/186 passed across 28 files in 100.95s**, including the existing Classic/Chaos soaks, BR network tests, 10/20/40-participant performance checks and Solo/Duo/Squad lifecycle tests. Earlier wall-time failures below are historical and were not reproduced in this run; thresholds are unchanged. Typecheck/build/diff checks pass. Latest production BR chunk: 117.52 KB / 36.43 KB gzip; the existing shared Three/Rapier bundle-size warning remains. Full browser E2E rerun: **9/9 passed in 4.1 minutes**. The follow-up facade/industrial/wreck run alongside E2E timed out on one 15s facade assertion; rerun without E2E load passed **13/13 in 2.24s**, with no relaxed limits. These results predate the subsequent Thruster Works continuation.

## Implemented

### Environment and presentation

- Replaced facade elements buried inside the authoritative walls with exterior-mounted panels, framed glazing, sills, structural fins and selective lit windows. Tested the entire structure catalog for wall clearance and open entrances.
- Added a cheaper distant glazing tier. Roof crowns and silhouette masses no longer disappear with interior detail.
- Mounted building signs on the correct face; cached generated sign materials/textures.
- Reworked road paint/curbs to follow road widths, avoid entrances and junction conflicts, and stay close to the authoritative ground. Replaced continuous glowing road edges with short markers.
- Fixed aerial surface depth fighting with explicit ordered surface layers; removed raised district pads that hid roads.
- Reduced Nova's oversized neon sculpture to a smaller metal plaza landmark. Removed Mall landmark geometry intersecting playable floors.
- Moved Helios containment hardware above its 42m playable building; a tilted conduit had visibly cut through the interior.
- Fixed machinery rotation: horizontal reactor rings retain their mounting orientation, and turbine blades spin in the same plane as their housings.
- Added floor-aligned interior fixtures/service panels and lighter slab undersides. Adjusted cool ambient bounce rather than adding lights to every room.
- Removed solid decorative annexes and glass boxes embedded inside office/lab, mall, industrial and greenhouse rooms. Their replacement service ribs are thin exterior-mounted pieces with catalog-wide placement coverage.
- Added tall-room structural bays, ventilation grilles and wall-mounted instrument panels, including reactor rooms whose height previously left huge blank walls. Improved the Nova rooftop review framing and visually rechecked the reactor rings.
- Added loot model LOD: full item models within 80/60/40m (High/Medium/Low), with 10m exit hysteresis; farther items retain a depth-tested rarity marker rather than disappearing. An 18-mesh fixture reduces to one rendered mesh in the regression test. Interaction and server state are unchanged; rotation now uses elapsed time rather than a fixed per-frame increment.
- Replaced expensive transmissive glass with shared transparent standard materials; added restrained procedural glazing variation.
- Replaced the storm's wire lattice layer with a scrolling procedural energy curtain.
- Added an opt-in development-only `?brView=...` art-review surface with camera selection, quality selection, HUD hiding and render counters. No authoritative teleport or gameplay commands.

### Gameplay and correctness

| Symptom | Root cause and fix | Coverage |
| --- | --- | --- |
| Healing/ammo pickups silently lose excess | The server clamped the amount but deleted the whole world pickup. It now preserves the remainder and refuses a zero-capacity pickup. | Authoritative room regression, delayed-action tests |
| Full inventory cannot pick up a replacement | Client never supplied the existing replacement-slot argument. A clear swap prompt now sends the held slot; ordinary stack/empty-slot pickups do not replace anything. | Shared capacity rules, server replacement regression |
| Replacement item inherits a pending action | Heal/reload completion tracked a slot without cancellation on replacement/drop. These operations now cancel associated timed actions. | Authoritative room regression |
| Bots chase loot they cannot carry | Loot goal selection ignored inventory capacity. It now uses the shared capacity decision. | Shared rules and existing bot lifecycle soaks |
| Pickup prompt flicker | Proximity used animated hover position. It now uses authoritative loot position; existing visuals update their replicated remainder count. | Code review; manual full pickup flow still pending |
| Heal/reload progress disagrees with server | Client-only timers did not follow authoritative cancellation/deadlines. Private action deadlines now accompany the local snapshot and are converted to the local monotonic clock. | Clock/cancellation unit tests and room snapshot test |
| Damage direction points away from attacker | Impulse direction was used without reversal. HUD bearing now points back toward the attacker. | Directional math tests |
| Recoil differs with frame rate | Fixed per-frame decay replaced with time-based exponential decay. | 30/60/144 Hz equivalence |
| Remote body spins across yaw wrap | Facing now follows the shortest angular arc. | Wraparound regression |
| Running animation changes phase abruptly | Gait phase now integrates movement over time rather than multiplying absolute time by instantaneous speed. | Browser inspection; subjective animation review remains |
| Spectator cannot freely look | Look processing occurred after the dead-player early return. It now runs before that branch. | Code review; extended spectator playtest remains |
| Tracers visually pass through map walls | Cosmetic hitscan lines now stop at the nearest rendered gameplay obstruction. Server hit authority is unchanged. | Existing authoritative obstruction tests; extended visual combat review remains |

Also fixed expired ping resource disposal and prevented held-weapon animation from overwriting airborne/downed poses.

### Validation hardening and collision-query cost

- The "seeded" BR lifecycle soak still generated random participant IDs, which feed bot drop timing/destinations and decisions. The test now uses deterministic IDs locally and verifies repeated drop/movement samples; production UUID/token generation is unchanged.
- Each lifecycle soak now disposes its Rapier world in `finally`, including on assertion failure.
- Small `brBlocksNear` clearance/mantle queries now use bounded, ordered static-map candidate caches. Queries above 8m and outside the bounded island cells retain the complete-map path. Regression coverage compares exact ordered results against the original scan across 12,005 point/radius combinations. No geometry, collision thresholds or physics rules changed.
- Local diagnostic microbenchmark, 100,000 half-metre-scale queries: original scan 421.47ms; cached path 40.59ms, identical total result count (27,632). This is a query benchmark, not a whole-game FPS claim.

No movement, weapon, economy, storm, HP/shield, or match-duration balance constants changed. No shared astronaut reconstruction, camera-rig replacement, physics rewrite, or new major mechanic.

## World scope

The existing ~1000m island, nine primary POIs, 30 secondary locations, 152 structures and 70 enterable structures remain. This checkpoint improves the existing visual shells; it does not claim new authored compounds or increased gameplay cover.

Screenshots were inspected at aerial altitude, Nova street/rooftop, Mall interior, Helios exterior/interior, Zero Point, Farms, Astra, Crash Site, Dockyard, Thruster Works, Horizon Homes and East Freight. Earlier in the pass, browser interaction exercised ship jump and automatic Ion Wings deployment.

Remaining visual weaknesses are real: several interiors remain sparse, some long road/deck views remain empty, and district massing still repeats too much. This is not yet a screenshot-certified final art pass.

## Performance

Isolated headless profile: 900 ticks / 30 simulated seconds per participant count, 30 Hz simulation and 15 Hz recipient snapshots, hard bots in dense combat. JSON sizes are uncompressed, per recipient.

| Participants | Mean tick ms | p95 ms | Worst ms | Mean snapshot bytes | p95 bytes | Max bytes | Heap delta MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 0.384 | 0.983 | 14.732 | 8,137 | 8,583 | 8,731 | +4.06 |
| 20 | 0.895 | 2.233 | 5.462 | 14,887 | 15,780 | 16,074 | +12.25 |
| 40 | 2.433 | 7.332 | 14.458 | 29,975 | 30,531 | 31,249 | +1.48 |

These are the latest isolated samples after the query-cache change. Unlike the lifecycle fixture, this existing dense-combat profiler still uses random participant IDs, so its samples are not strict paired before/after comparisons. An earlier 40-player sample was 1.972ms mean / 5.032ms p95 / 27.211ms worst. No claim of improved whole-server average follows from the local query microbenchmark alone.

Heap deltas include garbage collection and are not proof of leak-free operation. Dense 40-player snapshots imply substantial bandwidth (~450 KB/s per recipient at 15 Hz before transport overhead); CPU results alone do not certify hosting capacity.

Browser render samples at 1280×720 included an aerial view at 442 calls / 148,639 triangles and Mall interior at 291 calls / 220,906 triangles. World material counts were about 217. These are development samples from the visual iteration, not a controlled final hardware benchmark. FPS varied with foreground/background and other test load; later background inspection was throttled to ~1 FPS. No 1080p/60 FPS claim is made. The loot LOD's 18-to-1 mesh reduction is test-verified, not a claim of a measured whole-scene frame-rate improvement.

High/Medium/Low retain identical colliders and island-wide silhouettes. Near district detail ranges remain 340/250/170m with 36m hysteresis. Distant glazing preserves readable floor bands without interior props. Existing pixel-ratio caps are 1.8/1.35/1.0; shadow and particle presets remain in place.

## Validation

- Baseline: typecheck/build passed; 144 tests passed. Initial E2E run was 8/9: the Classic raid retry loop could legitimately shove twice, but its later assertion demanded exactly once. That assertion now checks at least one; sabotage still checks exactly once.
- Prior completed full run including BR network, loot LOD, placement and query-cache coverage: 170/170 tests across 23 files, 92.39 seconds.
- Historical Farms/Nova/Astra run: typecheck/build passed; full suite was **170 passed, 3 failed / 173 tests across 24 files**, 144.26 seconds. All three failures were the unchanged 15-second BR lifecycle wall-time assertion: Solo 25,152.62ms, Duo 25,439.21ms, Squad 24,324.06ms. Their earlier finite-state, match-results and participant assertions passed. No renderer code is imported by that headless lifecycle fixture; the visual changes are not evidence of a simulation cause. The newer checkpoint at the top supersedes this historical result.
- Isolated BR scale/performance rerun: **6/7 passed**, 53.96s. Solo and Squad lifecycle tests passed; Duo still failed the same 15-second wall-time gate at 16,811.17ms. All three tick-performance tests passed. This reduces but does not resolve the timing failure; no threshold was changed.
- Latest standalone 30-second, 30Hz tick profiles (3/3 passing): 10 participants average/p95/max **0.4650/1.2415/15.2970ms**; 20 **1.1883/3.1817/7.1567ms**; 40 **2.4121/5.7296/9.2773ms**. Mean/p95/max per-recipient snapshot bytes: 10 **7,873/8,543/8,741**; 20 **14,952/15,712/15,957**; 40 **30,080/30,969/31,494**. Heap deltas -0.64/+4.66/+5.50MiB are GC-sensitive, not leak measurements. This is not a paired benchmark because the profiler still uses normal random player IDs.
- Added four passing BR delayed-action scenarios: 20±2, 60±20, 120±40 and 200±60ms; 0/0/3/6% input-sample loss. Reliable action order is preserved. They cover pickup/reload/heal/fire retries, inventory totals, private deadline cleanup, stale sequence rejection and reconnect. They do not measure visual reconciliation, aim feel, drop synchronization or revive latency.
- Existing Classic latency/reconciliation harness covers 20–200ms conditions separately.
- Existing Classic 2/4/6-participant ten-minute simulations, five four-participant Chaos ten-minute simulations and three solo rematch rounds remain in the full suite.
- Existing BR Solo/Duo/Squad lifecycle tests use 40 participants (39 bots plus one test host), simulate until results with a 20-minute simulated limit, and retain their original correctness/performance assertions. They are not 40-human tests.
- Latest typecheck and build passed, including the Mall interior follow-up. BR chunk is 114.36 KB / 35.42 KB gzip; the existing shared Three/Rapier-related 3.10 MB chunk warning remains.
- Final E2E rerun after placement/LOD/query-cache changes: 9/9 passed in 3.7 minutes, including BR room/drop/landing isolation, settings, shop preview, Classic raid, Chaos, six participants and solo bots. It actually ran; no spawn restriction blocked it.
- E2E rerun after Farms/Nova/Astra visuals: **9/9 passed in 4.2 minutes**. The longer Classic raid test completed successfully in 1.9 minutes. No E2E environment blocker.
- After Mall interior follow-up, focused BR room/Starliner/drop/landing E2E smoke: **1/1 passed in 1.4 minutes** (test body 1.2 minutes). The other eight E2E cases were not rerun after that follow-up.

Earlier full runs failed BR soak wall-time assertions. The issue also recurred after stopping the preview: 15.13s Squad in one run, then 16.01/18.56/16.53s Solo/Duo/Squad in another against the unchanged 15s limit. After making the fixture deterministic, Solo/Duo still took 15.15/15.51s (Squad 14.06s). These were timing failures, not lifecycle/invariant failures. With the cached-query change, the focused run passed all three at 12.23/12.65/10.70s, plus the repeatability and exact-query-equivalence tests (19/19 tests in 38.95s). No threshold was relaxed. A deliberately failing pickup-conservation regression was also observed before its fix.

## Still required

### Latest visual continuation

- Thruster Works follow-up: screenshot/code review found POI-relative turbines embedded in the foundry's occupied walls and a chimney passing through both floors. Removed these landmark/context duplicates; the main foundry now has one instanced rooftop twin-engine test assembly with stepped casings, containment bands, nozzle faces, restrained cyan rims, orange paint, and thin support stands. Removed its generic tower crown/roof equipment and switched the main hall to high clerestory glazing with lower metal panels. Other industrial buildings and gameplay geometry remain unchanged.
- New pure engine-placement helper/tests enforce finite transforms, heavy machinery above the playable roof, central/perimeter clearance and roof-loot spacing. A support foot's proximity to the authored pickup was corrected during this check. Added dev-only interior and roof-access review views; browser screenshots confirm no landmark crossing the interior and a clear route between/around engine stands. Ground-level support legs remain thin visual detail, not new gameplay cover.
- Thruster screenshot samples after the change: exterior 496 calls / 281,124 triangles / 35 textures / 195 world materials; roof-access view 237 calls / 234,206 triangles / 42 loaded textures. Live samples varied around 54–60 FPS; changing snapshots/shadow updates/resource warm-up mean these are not controlled comparisons or target-hardware certification. Interior still has sparse wall composition and stark structural ramps, intentionally recorded for further work.

- Dockyard/Crash follow-up: removed duplicated landmark construction (both the context-prop pass and landmark pass created the same cranes/wreck). Dockyard now has one pair of instanced open-truss cranes with cabs, counterweights, trolley rails, cables and spreaders. Warehouse/hangar roofs use low ventilation pods rather than large blank roof masses; pods avoid roof loot. Facades now use one high clerestory band with lower metal cassettes rather than office-like repeated window rows. No collider or balance changes.
- Crash Site: removed the solid, rotated capsule and wing masses intersecting the occupied fuselage building. One broken six-segment hull-roof assembly now aligns with the actual structure, with exposed framing and missing plating. Small viewports and hull panels replace the building's office windows. Generic rooftop machinery no longer protrudes through the shell. The map's current fuselage has interior loot only; explicit fixture coverage exercises roof-loot exclusion for future sockets.
- Interior screenshot revealed the generic utility machinery occupying the fuselage's central aisle, near its loot socket. Replaced it with wall-mounted lockers, service ventilation, overhead braces and ceiling light rails. Added a dev-only fuselage interior review camera. The follow-up screenshot confirms an unobstructed central aisle and visible loot; room composition is still sparse and the wider Crash Site needs stronger wreck storytelling.
- Browser screenshot observations: Dockyard second iteration 379 calls / 304,491 triangles / 31 loaded textures / 196 registered world materials. Revised fuselage interior 118 calls / 138,312 triangles / 35 loaded textures / 195 world materials. These are live development samples, not controlled GPU benchmarks; observed foreground FPS was approximately 40–53 and does not establish the 60 FPS target.
- New industrial/wreck geometry tests cover finite/mirrored crane parts, mast footprint, low roof-machinery bounds, roof-loot clearance, rotated hull bounds, deliberate missing plating, and interior aisle/loot clearance. Facade tests additionally enforce high cargo glazing and lower cladding. Geometry/material instances reuse the existing world caches and cleanup lifecycle.

- Follow-up Mall review replaced its POI-relative floating signs and cylindrical kiosks (one overlapped the interior loot location) with partition-mounted retail display bays. Display shelves, product silhouettes, compact shop signs and header lighting attach to real wall faces; the center aisle stays open. Removed generic retail blocks standing in movement lanes.
- Added ceiling battens, subtle floor inlays and expansion joints, and ramp-edge paint tied to actual split floor slabs/inclines. These do not span stair openings or alter collision. New pure placement helpers cover partition bounds, doorway gap, loot clearance, floor containment and ramp alignment.
- Follow-up screenshot: Mall interior 243 calls / 275,496 triangles / 29 loaded textures, around 197 world materials. The previous empty interior sample was 208 calls / 261,294 triangles; different live snapshots prevent treating this as a controlled GPU comparison. The aisle is visibly cleaner, with recognizable retail fixtures; upper wall composition and the stark ramp silhouette still need further art work.
- Found aerial-loot sockets on some greenhouse roofs without a ramp. Roof-light generation now omits any bay surrounding such a socket. Added regression coverage; no loot or collider was moved.
- Latest focused visual-placement validation after the interior follow-up: **14/14 tests across four files passed** (growhouse, facades, retail interiors, interior surfaces). Full-suite/E2E results above predate the Mall follow-up unless explicitly updated.

- Reviewed before/after browser screenshots of Orbital Farms and Nova street, plus Astra Academy and the Farms Low preset.
- Farms: removed the repeated decorative domes intersecting buildings; added shallow, framed sloped roof-light monitors derived from actual greenhouse footprints. Roof-access structures are excluded, roof perimeters remain clear, and colliders are unchanged. Green-tinted glazing differentiates agriculture from the office districts.
- Replaced the old widely spaced crop octahedra with planted soil beds, irrigation strips, paired low leaves and occasional orange buds. Placement checks the bed footprint against all districts' structures, roads, map bounds and cover. Secondary farm areas use the same planting rather than another ungrounded dome.
- Reduced the first crop iteration's excessive geometry: leaf meshes use eight-face octahedra, not the 32-face shared detail mesh; foliage uses a separate 153/112.5/76.5m High/Medium/Low detail range plus 36m hysteresis. Bed surfaces remain visible with their district.
- Nova: taller tower windows, neutral district-tinted architectural paint instead of large emissive pink panels, lighter/rougher dark metal, low planted facade sills, and removal of overlapping shop/office entrance canopies. Short-building signs now sit above the entrance rather than across it.
- Astra: moved the misplaced ground-level observatory dome out of the campus hall onto the authored observatory tower. Removed the generic tower crown that intersected the dome; added its mounting drum, frame ribs and instrument.
- Added roof-light bounds/access exclusion tests and planted-sill height/entrance coverage. No authoritative geometry or balance changes in this continuation.
- Representative development screenshot counters: revised Nova street 223 calls / 233,613 triangles; Academy 309 calls / 282,641 triangles; Farms Low 556 calls / 193,603 triangles. World material registry observed 191 materials (previous continuation around 217). Samples include changing bots and renderer resource warm-up, not controlled A/B benchmarks. FPS sometimes reached the high 50s but also throttled to 1 FPS in the background; no target-hardware performance claim.
- These changes improve district differentiation and remove visible intersections, but the overall visual pass is still incomplete: several broad facades remain repetitive, street composition is sparse, and the requested combat/interior/final-circle review remains outstanding.

- Finish the environmental composition/interior quality work; review final-circle storm and active gun/Saber combat presentation.
- Full hands-on movement → loot → fight → reload → heal → storm sequence, including controller use and extended spectator/revive checks. The screenshots and bot tests do not substitute for this.
- Controlled High/Medium/Low GPU/frame-time measurements and repeated live BR/Home/Classic switching with memory/audio observation.
- Broader BR network coverage for movement correction, drop and revive, beyond the new inventory/action harness.
- A final complete validation report once the requested overall acceptance standard is actually met.

## Git

`main` remains at `92c9e82`; a fresh fetch showed `HEAD...origin/main` = `0 0`. Changes are uncommitted in the working tree. No push or deployment.
