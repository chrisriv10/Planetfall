# PlanetGun implementation and acceptance record

The requested first-map/first-mode implementation and validation are complete.
PlanetGun retains its requested **1/5 Prototype** maturity label. This records
what was implemented, played and measured, including the practical limits.

## Initial state and preservation

- Initial PlanetGun HEAD: `ceb9cac612014107131d71a4554c5ff5171acf5a`,
  `Add PlanetRun tournaments and six orbital obstacle rounds`.
- The tracked tree was clean at the start of this request. Existing untracked
  BR/PlanetRun evidence (3,853 existing untracked entries) was retained. The October 22 continuation preserved the
  already-dirty WIP/PlanetGun implementation.
- No reset, restore, stash or blind pull was used. The user authorized a commit
  and push after acceptance; deployment remains unauthorized.
- Classic, Chaos, the large Orbital Isle map and the canonical astronaut remain
  the same systems. The only shared character changes here are consumption of
  its existing rig from new PlanetGun presentation helpers.

## WIP mode selection

`client/src/mode-development.ts` holds the manually maintained development status:
BR 4/5 Late Alpha, PlanetRun 3/5 Alpha, PlanetGun 1/5 Prototype. This describes
maturity, not engineering completion percentages. Classic bypasses the warning.

Intentional experimental family-card clicks open one shared dialog before family
selection or renderer imports. Continue confirms, Cancel/Escape restores focus
and the old selection. Tab/Shift+Tab are trapped. Internal room restoration and
returning home do not reopen the warning. An existing Shift+Tab/burst conflict
was fixed without changing gamepad Back. The selector uses a responsive 2x2 grid and a single column on narrow windows.
Short/narrow windows use a bounded, internally scrolling home card; native
615x615 checks confirmed both the logo and bottom Create/Join/Shop actions.

## Architecture and authority

- `shared/src/planet-gun/`: types, balance, deterministic movement, Nova Block
  collision/navigation data, rays/hit regions and independent weapon definitions.
- `server/src/modes/planet-gun/`: rooms, fixed-step simulation, match resolution,
  bots, spawn scoring, combat and bounded authoritative history.
- `client/src/modes/planet-gun/`: FPS client/prediction, arena and weapon art,
  canonical remote pilot presentation, pooled effects, HUD and home preview.
- Family `planet-gun`; isolated `pg:` protocol. RoomManager uses the existing
  generic leave flow, session reconnect, host migration and PlayerProfiles store.
- Lobby supports 4/8/12 slots, bots, difficulty, ready state, score limit and
  primary loadout. Default is 12 players, balanced Solar/Void 6v6, bots enabled.
- Match: 75 eliminations or 8 minutes by default, 25/50 available for shorter
  matches; a regulation tie enters sudden death. Friendly bodies occlude shots
  without receiving damage. HP is 100; respawn delay is 2.5 seconds; new lives
  have one second of protection, canceled by firing. Regeneration begins after
  4.5 seconds without damage, at 18 HP/sec.
- Server validates sequence, timestamp, weapon, ammunition, cooldown, reload,
  sprint/mantle state, aim direction and obstruction. No client origin, target or
  damage is trusted. Rewind is limited to 200ms, bounded in memory, interpolated,
  and cannot cross death/respawn. Fire and movement sequences stay independent.
- Existing Fallbucks/XP/owned/equipped cosmetics/Planet Pass are shared, with no
  second wallet or account. Eligible completed matches award 5 participation
  Fallbucks, up to 15 for eliminations and 10 for a win, plus XP. Matches under
  60 seconds or fewer than six participants do not pay; bots never receive awards.

## Movement and prediction

60Hz shared movement is accumulated inside the existing manager tick; snapshots
are sent at 20Hz. Ground acceleration is 45, run/sprint are 7.2/10.2m/s, and total
planar speed is capped at 12.6m/s. Jump is 8.2m/s with 90ms coyote time and a 100ms
buffer. Brief keyboard jump/fire presses are retained across slow render frames.

Ion has capacity 100, ground regeneration 45/sec, thrust drain 70/sec and wall-run
drain 35/sec. Holding jump adds 22m/s² against 24m/s² gravity after a brief grace
period; useful lift is bounded relative to launch support. Slides decay over
650ms, retain momentum into jumps and have a 900ms cooldown. Wall runs use only
explicit authored faces, expire after 1.4s and require energy; wall jumps add
outward/upward velocity and a reattachment lock. A native playtest exposed
excessive upward carry during wall runs: ascending pilots now retain normal
gravity, while descending runs receive reduced gravity. This keeps traversal
lateral rather than launching the pilot onto the wall top. The FPS camera banks
smoothly toward the actual contacted side. Mantling uses flagged, broad,
head-clear ledges and a 240ms deterministic transition.

Prediction replays only commands newer than the authoritative acknowledgement.
Tests include delayed/jittered acknowledgements and dropped commands. A stable
server-clock estimate avoids treating render-thread stalls as clock changes.
Disconnected clients do not accumulate queued gameplay commands.

Standing/crouch movement heights are 1.95/1.7m, with eye heights 1.57/1.32m.
These account for the canonical astronaut's large helmet. Head regions are
centered at 1.49/1.28m with a 0.43m radius; visible-helmet alignment tests cover
standing/crouched center and edge rays and obvious misses. Movement and combat
volumes remain separate.

## Nova Block

An original 92x76m orbital habitat arena. Offset west habitation galleries and an
east observatory have different footprints/entrances. Transit plaza/crossover
occupies the center; hydroponics forms the northern wall-run flank; a smaller
southern maintenance room connects the service route. Machinery, counters,
partitions, roof terminals and supports provide actual movement/bullet cover.
There are no reused Nuketown assets, footprints, spawn composition or landmarks.

Vertical opportunities include two collision-backed stair flights, mantle cover,
rooftop galleries, a thrust-accessible crossover and explicitly tagged run walls.
Navigation includes physical stair chains and traversal links; fictitious direct
balcony shortcuts were removed. A regression test walks both flights without
jumping and checks capsule clearance. It caught/fixed zero-velocity-axis stair
pushes and floating-point step-height rejection.

Spawn scoring considers enemy distance/visibility, allied occupancy and recent
deaths, permits a side flip under pressure, and uses only collision-clear authored
anchors. Deck barriers make the play boundary readable. District paving, glazing,
lighting strips, machinery panels, signage, low planter foliage and a transit
hologram decorate the same collision-backed shapes. DEV review views cover the
full map, both teams, center, both flanks, upper route and wall-run route; these
move only the review camera, never an authoritative player. Both interiors also
have dedicated ground-height review views.

## Gunplay

PlanetGun owns separate stats for Pulse Rifle, Nova SMG, Photon Shotgun, Quasar
Carbine, Rail Laser and Comet Hand Cannon. Comet is the fixed secondary; no BR
loot, rarity, inventory or survival rules are imported. Canonical weapon art is
reused through the existing cached model library.

| Primary | Body damage | Interval | Magazine | ADS FOV |
| --- | ---: | ---: | ---: | ---: |
| Pulse | 25 | 115ms | 30 | 61 |
| Nova | 19 | 75ms | 36 | 67 |
| Photon | 15 x 8 | 720ms | 7 | 71 |
| Quasar | 38 | 260ms | 16 | 49 |
| Rail | 80 | 1100ms | 5 | 34 |
| Comet secondary | 34 | 310ms | 9 | 65 |

ADS tightens spread over each weapon's settle time and reduces sensitivity.
Movement/air increase spread. Fire raises the camera by weapon-specific recoil;
viewmodel kick is smoothed separately. Sprint-to-fire timing is authoritative;
pressing fire exits sprint and a semi-auto press waits for the acknowledged
authoritative firing window. A reproduced early-fire rejection was fixed by
checking both predicted and acknowledged stances/deadlines and the exact
input sequence that exits sprint. A prior ground snapshot can predate a
sprint entry still in flight; it must not permit an early shot. A queued click expires
after one second and is discarded during reload or with an empty magazine, so it
cannot become a delayed surprise shot.
Reloads transfer available reserve only when the server deadline is reached;
switching cancels the previous reload. Head multipliers and falloff are independent
of BR. Nominal close-range body TTK is approximately 345ms Pulse, 375ms Nova,
520ms Quasar and 620ms Comet; Rail needs two body shots/one headshot, Photon can
eliminate with a close pellet cluster. These are mathematical balance values,
not human TTK acceptance findings.

## Presentation, audio and bots

The camera is first person, with sleeves/gloves, canonical weapon models, centered
ADS, weapon-specific FOV, recoil, sway, reload, switch and movement presentation.
Remote players use the existing astronaut/motion system plus an isolated posture
layer for held weapons, slide, wall run, thrust, ADS, recoil and a brief controlled
death collapse. Equipped suit accents apply to remote suits and local sleeves.
Local ADS models have open sight apertures instead of opaque scope caps or
centerline-blocking beads; all six weapons have ray-clearance regressions,
including near-center Rail/Quasar aperture rays. Remote canonical models retain
their existing art. Hydro glazing/panel seams and machine caps were separated
into small surface layers after native review caught coplanar streaks.

HUD includes score/time, HP, Ion, ammo, hit/headshot feedback, damage bearing,
elimination notice, kill feed, respawn notice and scoreboard. UI capture releases
pointer lock; results/menus cannot recapture it. Keyboard/mouse and controller
mappings share the same gameplay inputs. Home preview renders a lightweight
miniature of the actual map, not a running match.

Effects use 32 reusable tracer/impact/muzzle slots, no per-shot geometry or dynamic
lights, finite transform checks and short expiration. Existing quality presets
control resolution and detail, with distant astronaut detail reductions; Auto
uses the existing global controller. Inactive mode settings cannot overwrite the
active renderer, and activation reapplies the owning mode's current settings.

Weapon/footstep sounds are spatial and bounded. Reload, slide, mantle, thrust,
landing, hits/headshots, death, respawn, countdown and result cues reuse cleared
project audio. `planet-gun` has a quiet original 48-second score, Nova Afterlight.
See `AUDIO_SOURCES.md`; no new third-party samples were introduced.

Bots use ordinary movement/fire/reload, visible target acquisition, a bounded
cadence of graph routing, reaction delay and difficulty-dependent aim error.
Normal/Hard can choose upper/traversal goals and slide; Easy stays on the ground.
Native matches confirmed encounters, eliminations, respawns and match resolution.
Normal/Hard advanced navigation is exercised in authority/performance tests; this
is a prototype bot opponent, with no claim of ranked-level tactical intelligence.

## Validation status

- Cross-mode renderer ownership: 8 passed, including new PlanetGun/PlanetRun cases.
- Typecheck/build: passed in the validation run; build retains the pre-existing
  large Rapier/reconciliation chunk warning.
- Full unit/integration suite: **1425 tests passed in 275 files** (345.17s),
  including unchanged BR 10/20/40-player performance tests and profile regressions.
- Full E2E: **29/29 passed** (16.6 minutes), including Classic/Chaos, BR,
  PlanetRun and PlanetGun lifecycle, graphics and opposing-client combat.
- Final input/acknowledgement regressions: 4 focused readiness tests and three
  consecutive ordinary lifecycle E2Es passed. The full unit suite passed on the
  corrected tree; all six PlanetGun acceptance E2Es passed again (4.5 minutes).
- Native complete FPS match/route and hardware measurements: recorded below.
- Earlier stable browser run passed the WIP/lifecycle tests and all eight review
  viewpoints on Low, Medium, High and Auto. A separate two-client run passed
  ordinary networked traversal and scoped hit registration after routing around
  the actual wall-run corner. These are development evidence, not the final run.

The user has authorized commit and push **after completion and validation**.
Deployment remains unauthorized. The implementation, native route/match review
and automated validation for this first playable slice are complete.


### Server performance (production movement/combat, 60 simulated seconds)

| Players | Average tick ms | p95 tick ms | Max snapshot bytes | Shots | Kills |
| --- | ---: | ---: | ---: | ---: | ---: |
| 4 | 0.334 | 0.703 | 6062 | 81 | 17 |
| 8 | 0.719 | 1.468 | 11099 | 221 | 40 |
| 12 | 1.172 | 2.196 | 16105 | 450 | 60 |

Existing average <8ms, p95 <16ms and snapshot <40KB assertions remain unchanged.
These server results do not establish client rendering performance.


### Native playthrough and defects found

Actual keyboard/mouse input was used in the normal local browser, without player
teleports or authoritative state injection. Complete 12-participant bot matches
reached the ordinary 75-point result (including 75-65 and 75-74); another match
was used for quality sampling. A separate pair of ordinary clients completed an
8-minute human match, Solar 1-0 Void. Native close combat produced an elimination,
headshot feedback, kill feed and victim respawn state. The eligible 12-player
match awarded 5 Fallbucks, visible in the shared Shop afterward; the two-player
match correctly did not qualify for rewards.

Movement routes covered west habitat entrance/interior/stairs/gallery, the north
hydro flank and wall run/jump, east perimeter entrance/interior/stairs/gallery,
south maintenance entrance/interior, the center mantle cover, the 4.25m crossover
(thrust approach, supported landing and traversal), both authored wall-run lanes, and sprint/slide/jump/thrust
combinations. Actual wall-run debug samples showed lateral movement
at y=1.24m with Ion consumption, followed by an outward/upward wall jump.
Hipfire, RMB aim, reload, weapon switching, death, respawn and results were used.
The scoreboard was opened with native Tab. Shop, Planet Pass, Settings and lobby
exit were opened through their real UI.

Native review found and fixed wall-run upward carry, coplanar facade streaks,
blocked local optic apertures, the clipped 12-player results footer, compact
lobby overflow and short/narrow home overflow. A firing trace reproduced a quick
sprint-click arriving about 12ms before the server deadline; the acknowledgement
fix then passed three consecutive focused E2E lifecycle runs. Final held-ADS
screenshot review also caught Ctrl-strafe selecting HUD text. Active gameplay
now cancels browser defaults for mapped keys, including Ctrl+R crouch/reload,
without capturing shortcuts in menus or text fields. Native Ctrl-strafe left the
HUD unselected and Ctrl+R reloaded ammunition without refreshing the page. The
new crouch-reload E2E passed but exposed the old-ground-snapshot firing race; a
focused regression now requires the exit input acknowledgement before firing.

The embedded browser denies pointer lock and serializes timed mouse actions.
Native checks therefore exercised the intentional held-drag fallback and RMB
state; simultaneous held ADS plus fire and settled zoom are asserted by the
actual two-client Playwright run. Released-RMB native screenshots are not labeled
as settled ADS proof. Audio events and licensed integration were verified; this
record does not claim a subjective listening-panel review.

### Real client rendering measurements

NVIDIA RTX 3060 through ANGLE/D3D11, 1280x720 CSS viewport, 12 active participants.
Five identical camera definitions per setting: team spawn, center, west interior,
east interior and wall-run route. Each sample contains 90 frame times after a
2.1-second settling interval. Bots continue moving/shooting, so draw-call ranges
can overlap between presets. All requested presets sustained approximately
59.9 FPS: median 16.7ms, p95 about 16.8ms in these short VSync-limited windows.
Auto selected Medium.

| Setting | Internal framebuffer | Draw calls | Triangles | Scene instances | Materials |
| --- | --- | --- | --- | --- | --- |
| High | 1280x720 | 256-421 | 64190-73764 | 2705-2709 | 99-109 |
| Medium | 1152x648 | 211-290 | 62412-66980 | 2693-2709 | 69-97 |
| Low | 921x518 | 214-336 | 56862-62768 | 2292-2304 | 76-101 |
| Auto (Medium) | 1152x648 | 147-297 | 58528-67378 | 2701-2709 | 88-106 |

Low submits about 48% fewer framebuffer pixels and roughly 15% fewer decorative
instances than High, while retaining all structural collision/cover geometry.
Instance/material counters describe the visible scene graph, not GPU occlusion
queries. These measurements establish this machine's behavior, not an integrated
GPU guarantee or an invented before/after FPS gain. Headless software-rendered
E2E samples are stored separately and must not replace these hardware results.

Evidence is curated in `artifacts/planet-gun-oct22/checkpoint/`. Development
captures, failed reproductions and the older BR/PlanetRun evidence remain locally
preserved. PlanetGun remains labeled **1/5 Prototype**: acceptance
of this first map/mode slice is not a claim of a finished commercial FPS.
