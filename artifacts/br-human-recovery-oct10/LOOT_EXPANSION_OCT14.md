# Local loot expansion — validation in progress

Initial HEAD: `c296cbca51a2b9889dd0ea8505aaf1ff583ba3e4`.
Existing jump acknowledgement, forward glide, damage-number, squad HUD and mouse
icon changes were preserved. No reset, stash, commit, push or deployment.
Physical map geometry and authored loot sockets are unchanged.

Seven canonical tiers: Common, Uncommon, Rare, Epic, Legendary, Prototype,
Singularity. Ordinary damage refinement is 1/1.025/1.05/1.075/1.10, paired with
reload, spread and projectile-speed refinement. Special equipment has authored
base stats instead of an ordinary damage multiplier.

Ground weapon weights total 100: Pulse 22, Nova 19, Photon 14, Arc 9, Rail 6,
Plasma 5, Saber 3, Helix 10, Comet 6, Quasar 6. Ordinary ground rarity weights:
46/32/17/4.5/0.5. Non-weapon floor rolls select utilities 15% of the time;
remaining rolls select Med Patch/Shield Cell/Med Kit/Battery at 38/38/12/12.
Their fixed rarities are Common/Uncommon/Rare/Rare. Each building retains its
primary weapon and compatible-ammo guarantee.

Crates guarantee a weapon. Slot two is compatible ammo (70%, when applicable)
or utility; slot three is utility (35%) or healing. Ordinary crate rarity weights
are 30 Uncommon/45 Rare/20 Epic/5 Legendary. Prism is 1.2% in ordinary crates.
Existing crates within 80m of Helios Reactor or Zero Point instead roll 0.5%
Vortex and 3.5% Prism. No Singularity floor or ordinary-crate rolls.

Weapons: Helix 23 damage, three rounds 90ms apart, 620ms burst cadence, light
ammo; Comet 48 damage, 620ms semi-auto, heavy; Quasar 34 damage, 380ms semi-auto,
heavy, existing medium optic at 44 FOV; Prism 5 damage per 100ms authoritative
tracking tick, plasma, heat 100/50 per second/28 cooling per second; Vortex
42 maximum splash damage, 800ms charge, 25m/s projectile, 5m radius, 300ms pull
warning and field expiry at 1.5s. Gravity movement is collision-resolved and
bounded to 0.12m per update. New weapon stats remain provisional playtest tuning.

Utilities: Grav Coil launches at 14m/s, 2.5s reduced falling gravity and improved
air control; Void Filter grants 40% storm resistance for 18s; Scanner samples
enemies within 65m onto a 6m grid for 4s; Nano Mist heals living team members
within 5m at 8HP/s for 6s. Healing fields combine by maximum, never sum. Each
utility stacks to two; server consumes items. Fields, beams and scan overlays
are pooled and bounded. Source audio uses existing cleared assets and original
procedural layers, documented in AUDIO_SOURCES.

Live fixture-input evidence: `loot-native-oct14.json` and nine screenshots.
Real mouse/keyboard: Helix consumed three rounds, held Comet and Quasar consumed
one each, Prism consumed ten during a 950ms hold, Vortex consumed one after
charge. All four utilities consumed on authority; Nano Mist healed and Grav Coil
lifted the player. Zero page errors. These are controlled-loadout diagnostics,
not naturally looted matches or human gameplay acceptance.

Failures retained: initial low-angle diagnostic did not fire; aiming upward
allowed the route to proceed. Semi-auto live input then reproduced a packet
ordering issue; special fire now requires held authoritative input and server
timing initiates pending actions. Reordered-trigger room regression passes.
The first full-suite run occurred during edits and failed the obsolete 18%
rarity expectation and a stale compiled heat value. Current focused tests pass;
fresh frozen suite/E2E are running. Do not cite that first run as green.

Still required: finish frozen validation; unchanged 10/20/40 performance;
fresh client rendering measurements with special effects; multiple naturally
looted seeded matches; ground/held/ADS/reload visual inspection for all new gear;
scanner enemy cue and markers; meaningful loadout/economy/bot swap review;
charge and high-tier feedback review; complete earlier spatial/human acceptance.
The overall pass is unfinished.

Follow-up validation: all 14 E2E passed (6.4m). The concurrent broad suite had
1211 passes and four failures: three unchanged timing limits under concurrent
browser load, and a real inactive-settings DOM write. The DOM write was removed;
all six renderer ownership tests then passed. Running lifecycle, interior stair
and 10/20/40 performance cases alone passed all 12 tests with unchanged limits.
A fresh serial full suite is now running after subsequent integration.

Prism heat/overheat now travels with dropped equipment and survives pickup;
the authority regression proves pickup cannot clear it. Inactive carried beams
cool normally. Timing state no longer accumulates one cache entry per discarded
inventory instance. Bots now consider upgrades and complementary weapon roles
when deciding pickups, as well as range/ammo when selecting a weapon.

Cached ground/held weapon models share geometry/materials while keeping object
transforms and Vector3 muzzle anchors independent. Deterministic 120-model audit:
1460 -> 146 unique geometries, 490 -> 49 unique materials, same 1460 meshes.
This is a resource-identity measurement, not a draw-call reduction claim.

Current-cache real-input run `loot-native-v2-oct14.json` passed all five weapons
and four utilities with zero page errors; firing screenshots include the actual
authoritative Prism beam. Heat/cell text fits the hotbar. Comet now uses the
new one-handed motion branch. Scanner markers use server samples unchanged.

Client measurement `loot-client-metrics-oct14.json`: headed 1440x900 DPR1,
same ground view with firing Prism and active Nano Mist, no concurrent tests.
High/Medium/Low/Auto each median16.7ms/p9516.8ms. Peak calls673/330/445/363;
peak triangles491079/309713/284847/315221; actual canvas1440x900/1296x810/
1036x648/1296x810. Beam present117/117/119/118 measured frames. This is one
repeatable view on the current machine; it does not establish weak-GPU acceptance
or a before/after frame-rate gain. Multiple naturally looted matches still remain.

Vehicle follow-up: solid original-skimmer collision passes 12 native approaches
across three rotations plus entry/drive/exit (`vehicle-solid-native-v2-oct14.json`).
The initial diagnostic incorrectly classified sliding around a rotated hull as
passing through it; the corrected diagnostic samples actual hull penetration.
Five authority/prediction collision regressions pass, including crouching,
landing, moving hulls and removal. Visual skimmer polygons use shared outlines.

User then requested multiplayer and flying vehicles. Four-seat Relay Rover and
two-seat Ion Shuttle definitions, explicit seat membership/offsets, distinct
bounded models, passenger rendering, server flight lift/descent and conservative
swept wing/cabin probes are local. Team vehicle spawn list remains separate and
disabled pending live occupied-model, hull, flight, safe-exit and multiplayer
checks. Aircraft currently requires landing before voluntary exit. Shared flight
height boundary is 165m. Stale driver packets expire under the existing 500ms
input limit. A faster-than-real-time grade test now timestamps simulated packet
receipt and keeps sequence numbers increasing across both route legs; its route
and collision assertions remain unchanged.

Latest focused run: 46 room/flight/model tests pass, typecheck passes. This does
not replace fresh full-suite/E2E/performance after vehicle changes. Earlier serial
loot run passed 1220 tests across233files, before these later vehicle changes.
Natural match seed3523859782 reached a normal drop/landing but its scripted loot
route failed to collect loot and drifted away from the intended building. Retain
that failure as diagnostic evidence; do not count it as natural-match acceptance.

Team-vehicle integration follow-up: live single-client run
`team-vehicle-native-v2-oct14.json` passes rover driving and shuttle ascent,
descent, landing and exit. Two independent clients also pass shared boarding,
separate seat positions, movement/flight and independent landing/exit in
`team-multiplayer-oct14.json` with zero page errors. Initial aircraft run failed
descent because simulated vehicle inputs were not acknowledged: the pending-jump
latch persisted. Vehicle stepping now acknowledges its input sequence, and the
passing rerun validates release/descent. Kind-change diagnostic rendering now
rebuilds its visual; production vehicle kinds are stable.

Team bays enabled: one Nova Relay Rover, Dock and Farms Ion Shuttles. Bay floors
resolve against authored support; clearance regression passes. Original eight
skimmer bays remain unchanged. All three hull types pass four-direction collision
at three rotations, plus crouch/landing/movement/removal checks. Stale input
expiry retained; disconnected driver can transfer authority to a living seated
passenger, otherwise empty aircraft descend under server control. Forced release
aloft enters freefall rather than teleporting to ground. Voluntary aircraft exit
requires landing, explained by the HUD. Space lifts; Control descends.

Typecheck and build pass. Fresh serial suite after enabling these bays passes
1246 tests in 238 files. Dedicated unchanged server performance passes all five
cases, including 10/20/40 players. Fresh E2E passes 13 of 14: the Classic raid
flow offered SHOVE NOVA while aiming at a repair station, blocking JAM REPAIR.
The failure is preserved in team-vehicle-final-e2e-oct14.txt; an isolated rerun
is in progress. Do not count the browser suite as green or the overall pass as
finished. Current enabled-bay rendering and natural-match acceptance remain.

The unchanged Classic raid test passes in isolation (3.1 minutes), including
repair sabotage. Preserve both results; the full-run interaction failure is
intermittent and has not been justified as a production regression.
Fresh enabled-bay client metrics (team-enabled-client-metrics-oct14.json) pass
without page errors: High/Medium/Low/Auto median 16.7ms, p95 16.8ms in the same
controlled ground view with active beam/mist. Peak draw calls 660/323/399/390;
triangles 491387/309605/283039/316429. Resolution 1440x900/1296x810/1036x648/
1296x810. Materials 930. These are capped-PC measurements, not evidence of an
FPS gain or integrated-GPU acceptance. Natural run two has reached generated
Quasar/Comet loot and entered the skimmer; final combat/results still pending.

Natural run two actually boarded the newly enabled Nova Relay Rover. It looted
Quasar/Comet, drove the Nova grade and connected streets, then encountered bots.
It was eliminated during aiming; the harness incorrectly treated the expected
pointer-lock release as an exception. No player damage registered, so this run
is not a combat pass. The subsequent investigation found that scheduled fire
modes used raw camera yaw/pitch instead of the muzzle-to-crosshair convergence
used by fire events. BrInput now carries an optional shotDirection, normalized
and checked against the same authoritative facing bound; invalid/backward
vectors are discarded. Scheduled shots use this validated direction. Timing,
ammo, collision and damage remain server-owned. A room regression demonstrates
the corrected semi-auto torso hit and rejects invalid correction vectors.
Focused room plus rover tests pass (45). Full validation must be repeated after
this fix. Natural run three is underway on the corrected source.

Rover-only visual refinement adds supported chassis, segmented armor/vents and
stepped hood within the existing hull. Seats and shuttle unchanged, two shared
geometries/five materials and <=24 visible meshes retained. Three focused visual
tests pass. Fresh native v3 rover drive and shuttle up/down/land/exit pass with
zero page errors; occupied rover screenshot reviewed.

Further live recovery: natural run three reached results/home but never
registered combat damage. Off-road navigation selected a waypoint through
Zero Gallery's solid north wall (stall x=-39.726,z=45.31). Road entry now chooses
a structure-clear approach and reaches that entry before following the graph;
physical layout/collision remain unchanged. Navigation/gameplay checks pass
(99 tests), unchanged dedicated performance passes five cases (23.19s), and
zero-gallery-native-oct14.json reproduces the starting stall then reaches
x=-70,z=-58 using native movement with no intervening placement.

Natural run four PASSES the full route, including generated Uncommon Rail Laser
and Shield Cell, shield use, Nova rover/grade/street traversal, scoped headshot
elimination, results, home/cursor restoration and zero server rooms. Zero page
errors and no untrusted input. This remains an agent-scripted native playthrough,
not a substitute for the user's subjective gameplay acceptance. Its side-view
capture confirms the rover's coplanar gold/dark flickering faces were separated.

Aircraft review found stationary turns skipped obstruction probes. Each wing/
cabin probe now sweeps from old to new orientation, including hovering turns;
seated headroom probes protect ascent. Focused flight/seats/room/visual checks
pass (56). The fresh post-fix validation passes typecheck, build, 1252 tests in
238 files (227.92s), and unchanged five-case 10/20/40 performance (23.20s).
Fresh complete E2E is running. Additional seeded match and all-new-item native
presentation/utility/crate checks remain before final acceptance.

October 15 continuation: execution verified on DESKTOP-JL99F36; working changes
and HEAD c296cbc preserved. The October 14 final E2E log ended after ten tests
without completion and is not counted. Fresh unchanged full E2E passes all
14 tests in 6.5 minutes (recovery-e2e-oct15.txt), including Classic raid/repair
sabotage. Native all-new-item ADS/reload/sprint/crouch/jump, utilities/scanner
and authored-crate checks subsequently passed (`loot-native-v4-oct15.json`).
Two normal seeded match playthroughs also passed (`loot-natural-oct14-four-live.json`
and `loot-natural-oct14-five-live.json`), including real loot, combat, results and
exit cleanup. These are agent-driven native-input checks, not human feel acceptance.

# October 15 — guest wallet recovery validation

The hosted-playtest report exposed room-only wallet lifetime. Local changes now
add server-owned guest profiles, opaque browser identity, file persistence for
development and a PostgreSQL backend for durable hosting. Existing local work
was preserved; no commit, push, hosting change or deployment was performed.

- Production build passed (`profile-build-oct15.txt`).
- Full suite passed: 1,260 tests / 241 files (`profile-full-test-oct15.txt`).
- Focused database/profile/lifecycle tests passed: 20 tests / 4 files.
- Native browser: actual BR timeout reward of 150 remained 150 after leaving,
  refreshing and joining another room (`profile-native-v2-oct15.json`). The local
  diagnostic control triggered the existing timeout path; it did not inject money.
- Hosted PostgreSQL configuration is unverified. The current Free Render local
  filesystem is ephemeral; deploying code without durable storage is insufficient.
- Fresh E2E passed: 14/14 (`profile-e2e-oct15.txt`). Dedicated unchanged server
  performance passed: 5/5 including 10/20/40 participants (`profile-performance-oct15.txt`).
- A subsequent bounded drop-placement fan separates five repeated weapon drops
  while retaining collision/support placement. Ten placement tests and native
  drop/pickup passed; rendered evidence is `drop-spacing-oct15-diagnostic.png`.
  Subsequent typecheck and focused room integration/performance validation passed:
  57 tests / 3 files (`drop-spacing-integration-oct15.txt`).
  Production build also passed (`drop-spacing-build-oct15.txt`).
- Four independent native browser clients passed actual four-seat rover boarding,
  shared movement and exits, then two-seat shuttle lift/landing/exits and rejection
  of the other two passengers (`team-four-native-v2-oct15.json`). Real authored
  vehicle IDs/kinds were used; only starting positions were controlled. The first
  attempt failed because a fixture passenger started outside entry range; its
  failed result is retained and no production boarding limits were changed.
- New arm IK feasibility helpers are experimental and are not integrated into
  character rendering. The known support-hand presentation gap remains open.

## October 16 continuation

Execution reverified on DESKTOP-JL99F36, HEAD still c296cbc, dirty tree preserved.
The previously demonstrated rarity-field depth issue is now fixed in the source:
only ring/aura use depth layer -6, above the road finish's layer -4. Depth testing,
support heights and authoritative pickup state are unchanged. The eight field
tests pass; production build and 28 focused presentation tests pass
(`presentation-build-oct16.txt`, `presentation-focused-oct16.txt`).

Canonical ordinary-rarity recoil refinement now reaches anticipated and confirmed
weapon kick. This is visual kick only; aim/muzzle/hit logic is unchanged. Typecheck
and 23 feedback/rarity/experimental-IK tests pass (`recoil-typecheck-v2-oct16.txt`,
`recoil-focused-oct16.txt`). An initial typecheck caught an attempted remote
inventory access; it was corrected to use the public held-item snapshot.

Front/side arm prototype images expose an unacceptable hidden-receiver silhouette.
No articulation is integrated into gameplay. Receiver/yoke changes are still being
evaluated in unimported helpers. Native carry rerun is pending after a development
reload interrupted the first attempt; that failed evidence is retained.
The stable carry rerun passed all 60 front/side action captures
(`recoil-carry-review-v2-oct16.json`). Source-only loot-field native drop/pickup
also passed; `loot-field-production-oct16-diagnostic.png` visibly confirms the
rarity arcs over the actual road with no diagnostic material mutation. Server
positions, support heights and original models remain unchanged by that fix.

Native fire verified common kick1 and legendary kick.92 on actual shot
confirmation (`recoil-native-v3-oct16.json`). Earlier downward-aim diagnostics
exposed a client/server agreement gap: camera convergence could target behind
the muzzle, while the reticle remained valid and authority rejected the shot.
The unchanged .72 aim cone is now shared by client reticle/shot anticipation
and both authoritative fire paths. Backward/malformed directions remain rejected.
Typecheck and 59 focused tests pass (`convergence-focused-oct16.txt`).
Native mouse input confirmed the backwards target has both `shot.blocked=true`
and the blocked reticle, then forward common/legendary shots still confirmed
with correct kick (`convergence-native-oct16.json`). Production build passed.
Twelve additional shared/persistence/database/unchanged server-performance
regressions passed (`integration-regressions-oct16.txt`). Fresh E2E passed all
14 tests in 5.7 minutes for these subsequent shared/client changes
(`convergence-e2e-oct16.txt`).

The second Helix arm prototype exposes the receiver and passes clearance tests,
but its rectangular lower support looks like a rack. It remains unintegrated;
front/side evidence is `arm-prototype-v2-oct16-helix-burst-rifle-idle-*.png`.
The rounded-brace revision is cleaner. All four new two-handed weapons now
have front/side static captures with actual cached-model stock retraction asserted
(`arm-prototype-review-all-v4-oct16.json`). Parent reviewed the distinct weapon
silhouettes and body/hand clearance. Previous wrapper-level captures did not
retract the nested cached-model stock and are not counted as full contact proof.
The experimental helpers still are NOT integrated into gameplay. Transition
clearance, runtime integration, reload/LOD behavior and muzzle presentation remain.
Parent transition audit (`arm-transition-audit.json`) measured the old carry's
existing chest penetration (~5.7cm at sampled vertices). The experimental path
clears it by approximately 70 ms and remains clear at the completed pose; initial
samples can be about 1 mm deeper than the existing baseline, so this is not claimed
as a wholly intersection-free transition. The helper remains unintegrated.
Before integration, compare the shifted weapon barrel with authoritative muzzle,
hitscan/beam/projectile presentation; do not move authoritative shot origins merely
to accommodate the model. The first full run is retained in `recovery-full-test-oct16.txt`.
That initial full run caught three experimental transition-test failures at the
early reach phase (cuff/chest overlap, up to 1.64 cm in sprint). A transient 4 cm
forward shoulder clearance before the inward fold fixes the geometry without
changing the final pose, arm lengths or assertions. All 12 existing transition,
articulation and support-grip tests now pass (`arm-transition-fixed-oct16.txt`).
The unintegrated prototype has a separate measured muzzle-agreement blocker:
`weapon-muzzle-audit.json` shows original visible-to-authoritative muzzle offsets
of about .65–.68 m, rising to 1.04–1.07 m in the proposed pose. Do not integrate it
without resolving actual hitscan/beam/projectile presentation agreement. No
authoritative muzzle or hit-volume changes were made for this experiment.
Fresh frozen validation after the transition fix passes typecheck, production
build and all 1,280 tests across 246 files (`recovery-full-test-v2-oct16.txt`,
241.36 seconds). The previous three-failure run is retained as failed evidence.
Fresh six-scene client-render measurements are running independently of tests
(`recovery-client-oct16-client-metrics.json`). Samples require an unchanged scene,
a living pilot and actual authoritative weapon events in the active-combat scene.
Those 24 measurements subsequently passed with zero errors. All presets/scenes
measured median ~16.7 ms on this RTX 3060 PC; no FPS improvement is claimed at
the refresh-rate ceiling. Representative High/Low draw snapshots: Nova street
416/218, mall interior337/231, connective approach204/102, storm443/290,
armed combat842/630. Resolution is1440×900 High,1296×810 Medium/Auto,
1036×648 Low. Raw report retains triangles, visible instances, district counts,
world-material count and JS heap; draw counters are snapshots, not average shadow
cost. These measurements do not certify physical weak-hardware performance.
High active combat p95 was 33.3 ms; Medium/Low/Auto were about 16.8 ms. Do not
hide the High bad-frame tail behind its 16.7 ms median. All four combat samples
retained a living pilot and recorded 68–79 authoritative shots per sample; the
controlled pilot took no damage during these particular measurements.
Three subsequent matched-camera High combat profiles each passed with a living
pilot, 74–79 real shots, median ~16.7 ms and p95 ~16.8 ms
(`high-combat-profile-oct16.json`). Shadow-refresh synchronous render submission
median was9.4–9.7 ms versus6.5–6.7 ms without refresh; this includes possible driver
stalls and is not a GPU timer. The earlier33.3 ms tail was not reproduced
consistently, so no additional blind quality reduction was applied.

Normal local development runs at http://localhost:5173/ with server3000. Temporary
diagnostic ports13001/13002/15174 were stopped after validation. No commit, push
or deployment. Hosted wallet storage is still unverified and has not been configured.


### Oct16 continuation — muzzle flash attachment

- Preserved the dirty working tree at c296cbca51a2b9889dd0ea8505aaf1ff583ba3e4; no commit, push or deployment.
- Added optional presentation-only flash origin to the existing bounded shot-effects pool. Existing tracer endpoints are unchanged. Invalid optional coordinates do not consume/mutate a pool slot.
- Mixed-file integration obtains the actual animated held-model muzzle world transform, with canonical fallback for hidden, mismatched or invalid models. It affects flash attachment only, not beam origins, projectile spawning, raycasts or hit registration.
- Typecheck and build pass (muzzle-typecheck-oct16.txt, muzzle-build-oct16.txt). Fifteen focused tests across shot effects, beam effects, model cache and convergence pass (muzzle-focused-oct16.txt).
- Native mouse fire with controlled start/loadouts passes Pulse (3 shots), Helix (3), Quasar (1), Prism (4), Vortex (1), no browser errors. Exact model-muzzle attachment checked; hitscan tracer starts retain authoritative origins. Evidence: muzzle-native-v3-oct16.json and per-weapon screenshots. Camera orientation is a controlled fixture in v3; shooting uses actual mouse input. These captures are not full human gameplay acceptance.
- First two native attempts retained: v1 timed out after Pulse; v2 exposed camera-facing-obstruction setup. The blocked-shot assertion remained intact. v3 fixes only fixture camera direction.
- Two-handed articulation remains UNIMPORTED. Read-only review found static level-idle proof does not cover pitched aim or weapon/body clearance during action motion; flash attachment alone does not resolve Prism/Vortex visual-origin separation. Isolated presentation follow-up is investigating coordinated pitched targets without changing authority or weakening clearance tests.
- Extended native check to all eleven ranged weapons (muzzle-native-v5-oct16.json), no browser errors. Pulse/Rail/Quasar checked while RMB scopes were active; their intentionally hidden held models use canonical fallback. Eight visible models retain exact barrel attachment. Tracer authoritative-origin checks remain unchanged. v4's failed assertion is retained: it incorrectly expected the hidden ADS barrel; v5 corrects that fixture expectation and explicitly records model visibility. Screenshots are captured just after releasing ADS and are not scope-appearance acceptance captures.
- Fresh frozen-source full suite: 1,286 tests across 247 files PASS, 258.81 seconds (muzzle-full-test-v2-oct16.txt). Typecheck/build with pitched prototype also pass (muzzle-pitch-typecheck/build-oct16.txt).
- Astra added coordinated pitch only to UNIMPORTED articulation/support helpers and a new focused actual-geometry pitch test. 27 angles from -.5 to +.8, four settled poses, four weapons. Sixteen focused prototype tests passed; settled weapon vertices and triangle edges clear body volumes. This is not runtime pose acceptance.
- Separate scratch transition audit found rear-handle/chest overlap at initial weight (idle/up ~59.9mm, level idle ~56.5mm). It intentionally retained the failure. Production still uses the existing weapon attachment. Next work measures safe receiver/stock/handle handoff intervals rather than enabling a clipping transition.

### October17 — continued after pushed checkpoint76796b0

- Preserved the clean tracked checkpoint and all untracked evidence. No further commit/push/deployment requested during this continuation.
- Added safe `/health.profileStorage` backend identification (postgresql/file/memory), with no paths, URLs or profile data. Local server reports file; this is not proof of hosted durable storage. Seven focused profile-health/lifecycle/PostgreSQL tests pass (profile-health-oct17.txt).
- Fixed a mixed-file firing-pose clock bug: all confirmed shots (including remote pilots/new firing modes) now refresh per-player lastShotAt; valid local firing requests also refresh it. Legacy flash anticipation/deduplication clock remains separate. No authoritative aim, network or movement change.
- Native D-strafe + mouse fire confirms Helix/Quasar/Prism turn from1.569rad travel-facing to .180/.212/.212rad toward camera yaw0 within200ms; confirmed shot events observed, zero browser errors. Evidence firing-pose-native-oct17.json/screenshots. Focused feedback/shot/convergence tests and typecheck pass.
- Unimported entry helper now rejects reverse weight and invalid wrists. New transformed-geometry entry tests require penetration to decrease monotonically from measured existing baseline, zero by weight .25 onward, grip error converging to zero and exact final hand contacts. Existing geometry assertions retained. 23 focused prototype tests pass.
- Forty native sampled entry frames (four weapons × five weights × front/side) pass without browser errors; Quasar0/.25/1 front and final posed silhouette reviewed. arm-entry-native-oct17.json. These are diagnostic sampled frames, not production integration or natural gameplay acceptance.
- Remaining integration issue: local pitch range and residual upper-body yaw from roll/twist must be handled coherently. Scratch extended local pitch through-1.15 passes, but turning sprint needs about -1.181 local pitch and.364residualyaw. Current fixed shoulders only prove about±.05yaw. Do not clamp away the aim error or enable the prototype as if this were solved. Isolated presentation investigation continues.
- Continuation validation: full suite PASS1,292tests/249files,292.59s (continued-full-test-oct17.txt), fresh typecheck passes. E2E rerun underway against unchanged production source.
- Read-only scratch alternative for unresolved residual yaw: shoulder X moves from±.52 to±.43 while Z moves.24→.34 over |yaw|0→.4, retaining .305m bones and coordinated forward wrist midpoint. This restores measured reach and pad/torso intersection at extremes instead of floating the pad atZ.39. Four sampled actual distal-arm/weapon vertex+edge tests pass across5yaw×5pitch×4states (arm-yaw-inward-oct17* under.local-runtime). Pad contact audit shows both pads retain actual torso-intersecting vertices/edges atyaw±.4. This is not silhouette acceptance, does not prove arbitrary body-facing lag/action transitions, and remains scratch-only. No production/helper promotion.
- Fresh typecheck passes (continued-typecheck-oct17.txt). Full suite remains1,292/249PASS; E2E raid round and Chaos modifier pass in the new rerun, final visual-budget/solo checks pending at this note.
- No post-checkpoint commit/push/deployment. Normal dev server restarted on5173/3000 and local health reports profileStorage:file. Temporary13001/13002/15174 capture servers stopped after reviewed native evidence.
- E2E rerun COMPLETE:14/14PASS,6.0minutes (continued-e2e-oct17.txt). No assertions,timeouts or budgets weakened.

### October17 continued — native yaw and remote firing verification

- Preserved dirty tree and checkpoint76796b0; no new commit/push/deployment.
- Native static scratch yaw capture:48frames (fourweapons×threepitches×twoyaws×front/side), no browser errors. arm-yaw-native-review-oct17.json. Parent reviewedHelixup+.4front/side,Vortexdown-.4front. Astra reviewedadditionalQuasarlevel-.4side,Prismlevel+.4side. Overallidentities/jointattachmentreadclearly;uppermuzzlecroppedinupview,sleevepinchandpadhelmetseamneedcorrection. Notproductionintegration.
- New whole-shoulder audit found up to30.5mm pad/helmet penetration missed by distal-only checks. Scratch pad lowering.05m clears actual helmet vertices+edges over9yaws×5pitches×4states while maintaining torso/proximal sleeve contact; nativecomparison and sleeve correction pending. No actual helper promotion.
- Two independent browser clients, actual strafe/mousefire: Helix andPrism confirmations update observer lastShotAt and camera-facing pose (remote-fire-pose-v2-oct17.json). No browsererrors. Firstattempt retained:fixed200msfromrequest measuredremote bodyyaw.4137rad against.4limit;v2 waits foractualremote shotreceipt then180msposeobservation, sameassertions. No runtime thresholds/timeoutschanged.
- Added UNINTEGRATED Sol-owned local-aim conversion helper `br-held-aim.ts`: transforms an existing world shot direction through inverse animated upper-body matrix, including rotation/nonuniform squash; rejects invalid/singular/overflow inputs and never clamps unsupported local angles. Parent and direction remain immutable; cached scratch objects avoid per-resolve allocation. Three root-cause tests plus15existingcamera tests pass; fresh typecheck passes (held-aim-camera-oct17.txt,held-aim-typecheck-oct17.txt). Not yet imported by gameplay because presentation pose still lacks full acceptance.
- Scratch sleeve candidate subdivides original triangles at elbow support planes,98→238triangles/sleeve, unchanged2bones/resources; corrected finite neutral proof measures1.07288e-8m maximumsurface distance. Original proof serializedNaN asnull and was rejected;degenerate triangles skipped and finitevalidationrequired in correctedproof. Scratch only.
- Forty-eight new fullframed native scratch captures pass/noerrors (arm-yaw-sleeve-native-review-oct17.json). ParentreviewQuasarlevel-.4side stillshowsangularforearmbulge;subdivisionnotacceptedasanadequatevisualfix. Helixupwholemuzzleframingnowavailable. Furtherisolatedsleevecomparisonpending;noactualyaw/sleevepromotion.

### October18 continuation

- Confirmed execution on DESKTOP-JL99F36; preserved current dirty tree at76796b0 and all untracked source/evidence. No commit/push/deployment.
- October17 held-aim full run did not have a completion result; retained as incomplete. Fresh October18 full suite PASS:1,295tests/250files,296.61s (held-aim-full-test-oct18.txt). Latest completed E2E remains14/14PASS from continued-e2e-oct17.txt; gameplay imports unchanged since that run.
- Isolated scratch sleeve investigation found triangle folding under the original two-bone blend. A midpoint blend bone preserves finite neutral surface within1.07e-8m and removes measured opposed/collapsed faces in12extreme samples. It remains scratch-only; unchanged denser clearance tests exposed an upper-sleeve/chest patch previously missed by coarse vertex sampling.
- Separate pole-lift candidate keeps shoulders, wrists and .305m segment lengths unchanged and improves native Quasar side elbow contour. Matched diagnostic capture (arm-yaw-elbow-lift-native-oct18-*.png/json) reviewed by parent. Four vertex-based state checks pass, but stronger full-triangle clipping still fails atyaw-.4/pitch+.45. Do not promote based on the vertex checks or screenshot alone. Assertions unchanged; quantify/fix true intersecting patch first.
- Midpoint bone's matched native Quasar elbow is visibly less pointed. Stronger clipping confirms the remaining patch is real chest-module penetration (centroid4.89mm inside), not permitted shoulder attachment. Higher/forward elbow-pole variants remain rejected. A measured shoulder-path correction is being investigated separately; no source promotion or assertion changes.
- Measured shoulder-path candidate fixes the earlier chest patch while maintaining reach and pad contact, but full-triangle testing then exposes a level-yaw baseline upper-sleeve/torso intersection at down pitch. Candidate remains rejected; original proximal cutoff and zero-penetration assertions unchanged. One forward-baseline correction is being tested separately, not promoted.
- Fresh build passes (held-aim-build-oct18.txt). Normal dev server health reports file storage. No staged changes, commit, push or deployment.
- Ran full-triangle scratch entry recovery (arm-margin-entry-oct18.txt):1passed/3failed. Idle/ADS/crouch upward Prism atpitch-1.2,weight.075 increases penetration .0532073→.0584784m; sprint passes. Diagnostic witness: rear telescoping BoxGeometry position(0,.01,.1476),triangle9 into chestmodule(0,.82,.43). Unchanged monotonic/zero-clearance assertions deliberately fail. Logs arm-margin-entry-diagnostic-oct18.txt retained. Static candidate still not promoted; stock/receiver/angle sequencing is next root-cause work. No new game source edits in this validation step.

### October18 held-fire input ownership

- Reproduced Helix body-facing oscillation during actual 1.5s held LMB plus strafe (firing-hold-native-before-oct18). Recent-shot timer expires between bursts.
- Local eligible held-fire now owns camera-facing pose; confirmed shot timestamp remains the remote/release fallback. Clears before input early returns, on UI capture, deactivation and reset. Authority, weapon cadence and ammo unchanged.
- Identical native after check passed 72 settled samples (max yaw error about .04rad), real confirmed shots, no browser errors. Separate lifecycle check passed release back to travel facing at1.55rad, held-state clearing and pointer-lock release during UI capture.
- Typecheck/build and18 focused tests pass. Fresh E2E in progress. No commit/push/deployment.

- Fresh E2E after held-fire correction PASS14/14,6.1min (firing-hold-e2e-oct18.txt). Added3 permanent public-event regression cases for burst/beam/charge local/remote facing timestamps and independent flash deduplication; all pass, fresh typecheck passes.
- Scratch entry now passes corrected full arm+weapon triangle recovery across4states plus reset/disposal/finite guards. Initial sleeve-baseline omission was an audit defect; corrected test includes original CapsuleGeometry and identical proximal cutoff. Passing candidate sequences stock retraction before rotation and uses .06m temporary reach fading to unchanged final pose. Native transition review pending; no source promotion or dynamic acceptance.

October18 native follow-up: sustained strafe/held LMB passes Helix, Prism and
Vortex, including charge wind-up (9/13/1 confirmed shots during sampled holds;
no browser errors). Evidence firing-modes-hold-native-oct18.json. Native scratch
Prism entry24frames passes sleeve uniqueness and exact hidden-unequip restoration;
parent reviewed .25 side and .1 front samples. Settled moving aim/locomotion
sweeps pass in scratch, but recoil/actions and abrupt unsupported local aim
remain unaccepted. The articulation is still not imported by gameplay.

October 18 latest validation: full suite passed 1,298 tests / 251 files in
322.01 seconds (`firing-pose-full-test-oct18.txt`). E2E remains 14/14 passed
after the held-fire correction; build and typecheck pass. No commit/push/deploy.
Scratch moving aim, aim-changing entry and coordinated 20mm recoil pulses pass
within the bounded domain. Near-vertical expansion remains rejected: Quasar
optic/helmet, Helix endpoint/helmet and alternate sleeve/body witnesses exist.
Reload at arbitrary aimed orientation can exceed left-arm reach; deliberate
receiver lowering plus asymmetric hand path is still under investigation.
The new articulation remains outside gameplay.

Additional diagnostic status: the two live-transform facing probes are invalid
because quaternion restoration can choose an equivalent Euler decomposition
that contaminates subsequent component-only edits. Retained as failed probes.
The pure-matrix probe performs no live transform writes: planar body alignment
reduces local yaw to approximately zero, but sampled pitch[-1.23,.99] still
exceeds the bounded helper. This is mathematical diagnostic evidence, not native
acceptance of a visible body-following transition. No production pose integration.

Development log recovery: an encoding failure during append truncated the log.
Recovered HEAD text plus 13 exact session append blocks and the two original
prose corrections; backup retained under ignored .local-runtime. Subsequent
writes explicitly use UTF-8. Gameplay source and raw evidence were unaffected.

### Further isolated pose gates

- Settled modest-domain grid passes fourstates/fourweapons/5yaws at pitch[-1.25,1.05]. Fixed entry initially finds .134mm sprint sleeve overlap atweight.9; original failed evidence retained. A separate temporary <=10mm forward correction only above pitch.85, zero at both endpoints, passes four entry states. Moving entry/recoil are being rerun against the exact corrected adapter.
- Reload service correction makes the target reachable but Quasar sleeve triangles192/212 enter torso about2.15mm; pole-lift variant worsens it and is rejected. Production articulation remains unimported.

Latest native modest-domain check: 96 captures (Prism/Quasar, pitch-1.25/+1.05,
yaw +/-.4, six entry weights, front/side) completed without browser errors.
One visible sleeve per arm and exact hidden-unequip restoration asserted for
every sample. Parent reviewed Quasar-up final side and Prism-down final front.
`arm-modest-entry-native-oct18.json` retains the report. Scratch only: body
following, visible action/reload/LOD transitions and full vertical convergence
remain unaccepted. No new commit, push or deployment.

October19 continuation: execution verified on DESKTOP-JL99F36, local dirty
work preserved. Two independent clients pass sustained Helix fire/strafe
observer check:72 settled samples, maximum facing error .04012rad, no browser
errors (`remote-held-pose-before-oct18.json`). Despite the filename, this was a
read-only regression check and passed: authority already includes held fire in
the remote aiming hint. No new networking change is needed. Reload remains
isolated scratch work; no commit/push/deploy.

October19 moving preview: scratch-only live adapter performs reset before
locomotion, true-shot planar body following, torso stabilization, inverse-parent
local aim and supported entry. Actual mouse turning/strafe/heldfire produced
140 frames, all in-domain;134 settled samples match visible barrel direction
to shot direction within4.02e-16. No browser errors. Evidence
`supported-moving-preview-oct19.json` and screenshot. This omits recoil/actions
and unrestricted convergence, and does not establish gameplay acceptance.
Production source is unchanged by this preview.

Scratch torso/arm split preview passed166 real-input frames,158settled visible
barrel direction checks (max3.73e-16 error). Rawpitch[-1.23,.93] is shared between
torso[-.13,.03] and arms[-1.1,.9], preserving true shot direction. Extra front/side
views were corrected to follow character yaw; first world-fixed front labels
were invalid as front appearance evidence. Parent reviewed corrected up-front
and down-side; camera pitch labels do not assert actual close-range shot pitch.
Full-body clearance, full vertical convergence, actions/recoil and lifecycle
remain pending. This is an isolated browser adapter, not production changes.

October19 reload validation: direct installed Vitest invocation passes the saved
centered-service contract4/4 in30.70s (`reload-centered-contract-parent-oct19.txt`).
The earlier npx attempt stalled before test startup and was interrupted; it is
not counted. Native sampled reload72frames across4weapons/9progress/front-side
passes zero errors, sleeve uniqueness and exact hidden teardown; reviewed Quasar
service-front/Vortex brace-fold-side. Actual R-key reload while strafing in an
isolated adapter passes194frames,127reloadframes, no errors, restored exact
barrel/shot alignment (`supported-live-reload-oct19.json`). This uses the older
bounded reload arm adapter and is NOT integrated with modest-domain torso/recoil
or unrestricted action/LOD lifecycle. Those combined gates still remain.
Visuals agent reached usage limit; new presentation implementation is unavailable
for now, while saved candidate validation was completed by Sol. No production
promotion, commit, push or deployment.

Moving-aim reload regression: actualR while strafing, mouse turns during reload,
then settles before completion. Cached-start adapter fails at progress.9942
with barrel/shot direction error.18887 (`moving-aim-reload-before-oct19.json`).
Current-aim/current-wrist each-frame combined adapter passes the SAME check at
progress.9944 with error.000598 (`moving-aim-reload-after-oct19.json`). The
assertion remains.05; no test weakening. This is scratch browser integration,
not yet gameplay source. New combined helper production preparation is delegated
to visuals after its remaining focused gates.

### October 20 integrated supported-pose checkpoint

Production now imports the supported arms/weapon/reload controller for Helix,
Quasar, Prism and Vortex. True shot direction is preserved through planar body
facing and a belt-pivot torso split. Current-aim reload return, coordinated recoil,
optimistic slot swaps and hidden-state disposal are integrated. Earlier scratch
failures remain recorded; see docs/BR_SUPPORTED_POSE_OCT20.md for exact scope.

Fresh typecheck/build pass, full suite 1,314/257 passes (317.19s), E2E14/14 passes
(5.9min), and three post-readability E2E checks pass (54.9s). No thresholds,
assertions, timeouts or performance budgets were weakened. Source native checks
cover four weapons, actual firing/reload/aim, lifecycle and repeated remote LOD.

Twenty-four matched six-scene client samples complete around16.7ms median.
Fresh supported-crowd samples retain16.7ms medians; High/Medium have33.4ms p95,
Low/Auto16.8ms. Settled High all-player update p95 is1.1ms. This is RTX3060
validation, not physical weak-hardware certification or proof of every tail cause.

Fresh normal native round passes natural loot, skimmer boarding/four drive legs,
nine outgoing damage events, results/home exit, zero rooms, released pointer lock,
zero page errors and zero untrusted input. Independent natural Helix pickup and
exit pass; that simpler route did not board its selected vehicle. Initial naive
wall-directed loot route failed and remains evidence, not gameplay acceptance.

Pass text now describes browser-profile persistence, captions are larger/brighter,
and desktop Helix name fits three lines. Desktop/390px Pass bounds/cursor checks
pass. The live public client has profile handshake, but hosted health omits the
new storage-mode field; database backend/restart durability are not established.
No hosting configuration change or deployment was performed.
