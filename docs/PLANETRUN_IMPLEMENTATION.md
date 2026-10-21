# PlanetRun implementation and validation

Initial HEAD: `96bc923909b11d09746b8a1d4121661aa3657d2e` on main.
The initial tracked tree was clean; thousands of pre-existing untracked BR
recovery artifacts were preserved. Initial status is retained locally in
`.local-runtime/planetrun-initial-status.txt`. No reset, restore, stash or pull
was used. Execution was verified on DESKTOP-JL99F36.

The user authorizes commit and push after this pass. Deployment is not part of
the task. The implementation and local acceptance pass is complete within the hardware
limits stated below. Final results are recorded below.

## Architecture

- `shared/src/planet-run/`: protocol, balance, authored rounds, deterministic
  obstacle transforms, shared fixed-step movement, qualification and tile state.
- `server/src/modes/planet-run/`: authoritative room lifecycle, input processing,
  tournament progression, bot controllers, profile rewards and tests.
- `client/src/modes/planet-run/`: renderer owner, prediction/replay, camera input,
  canonical pilot presentation, instanced world, home miniature and UI.
- GameFamily moved into `shared/src/game-family.ts`, with a BR compatibility
  re-export. Families are planetfall, battle-royale and planet-run.
- RoomManager integrates PlanetRun with the existing generic room:leave path,
  profile persistence, shop ownership and six-character room-code namespace.
  Cross-family joins reject with useful messages.
- pr: events cover create/join/configure/ready, start/quick-start/return,
  player input, snapshots, tile deltas/resync, cosmetic emotes and shop actions.
  Session tokens are excluded from room views and snapshots.
- Shared renderer ownership is exclusive. Leaving cancels pending activation,
  releases cursor/input and disposes the mode's world/pilots without reloading.

## Tournament

Default 20 participants; host selects 10, 20 or 30 and Easy/Normal/Hard bots.
Quick Solo fills bots. Connected humans ready before host starts. Host migration,
leave and reconnect grace use authoritative membership.

First and third ordinary rounds are races, the second is survival; a final is
selected at round index 3 or with five or fewer pilots. Seeded selection respects
population and avoids immediate duplicates. Races qualify the first ceil(67%)
(or ceil(58%) in later races) across the finish, bounded below population.
Race timeout never qualifies a pilot who has not finished. Survival ends when
the target remain or its timer expires; ALL living pilots qualify at expiry.
Final ties use progress, survival time and immutable ID, restricted to current
finalists. The winner is resolved once.

## Movement and camera

Run speed 9, ground acceleration 36, air acceleration 16, braking 28, gravity 25,
jump impulse 10.5, coyote time 100ms and jump buffer 110ms. Dive gives a 13-unit
forward impulse, 350ms action and 1050ms cooldown. Small bounded player bumps
prevent ghost starts without combat shoves. Server tick 30Hz; snapshots 15Hz.
Clients send directions/actions, predict fixed steps and replay unacknowledged
input against authoritative snapshots. No weapons, inventory or BR health.

Authored checkpoints restore race falls after 700ms. Survival/final falls
eliminate. Shared support matches platform tops, sides, undersides, moving
platforms and conveyor carry. Circular boot support prevents falling through
small module seams. Gravity zones remain active above raised decks after takeoff.

Centered 65-degree third-person camera, brief overview, camera-relative input,
authoritative-surface camera obstruction, Q/E active-pilot spectating. Mouse
capture is gameplay-only; denied embedded-browser capture is caught and left/
right drag provides look fallback. Menus, pause and elimination release capture.
Controller LS/RS/A/X map to move/look/jump/dive. Controller look uses fixed-step
time and shared sensitivity/invert; regression tests cover rate independence.

## Rounds

| Round | Category and objective | Signature / bot strategy | Visual identity |
| --- | --- | --- | --- |
| Cargo Cyclone | Race; first N finish | Alternating conveyors, translating decks, rotating loading arms. Bots follow individual lane waypoints, jump near machinery/seams and recover from checkpoints. | Coral freight decks, cargo cranes and orbital loaders. |
| Solar Sweep | Survival; stay above the fall boundary | Low and high rotating sweepers. Bots choose local safe positions and time jumps. | Gold solar terraces and turbine fins. |
| Meteor Garden | Survival; avoid telegraphed impacts | Seeded warning, impact and recovery fields with knockback. Bots evaluate predicted danger. | Teal landscaped station, warning rings/brackets and bounded impact fragments. |
| Flux Gardens | Race; first N finish | Alternating raised low-gravity decks and rotators. Bots share jump/support/gravity rules. | Lilac conservatories, alien trees and orbital arches. |
| Capacitor Causeway | Race; first N finish | Timed gates and directional boost pads. Bots navigate gates through ordinary input. | Blue research pier, capacitor towers and cyan open-passage markings. |
| Shatterdeck | Final; last pilot standing | Contact-triggered collapsing hexes. Bots route a neighbor graph, score intact local clusters and adapt reaction/planning to difficulty. | Four differently shaped energy decks inside an orbital conservatory. |

Flux Gardens and Capacitor Causeway were the two original additional concepts:
they exploit gravity and energy-routing technology while reusing reliable,
readable shared primitives, ordinary bot movement and bounded rendering costs.
No copied level layouts or third-party character assets are used.

## Shatterdeck

419 hexes across four authored layers: 61/116/105/137 cells. Small crown, broken
annulus, linked wings and fragmented broad base; layers are five units apart.
Contact starts a 620ms irreversible warning, including a 160ms breaking phase.
The server owns contact/removal. IDs, trigger timestamps and revisions replicate
as deltas; full state is sent for initial state/recovery, not every snapshot.
Renderer uses instancing and shared materials. Neighbors form a hex graph for
local bot routing; difficulty changes reaction and cluster preference, not physics.

## Persistence and presentation

The same existing persistent guest profile owns Fallbucks, crowns, XP, pass
progress and cosmetics in all three families. No new wallet/database. Rewards
require at least six participants and 60 seconds, resolve once, exclude bots and
use existing pass unlock rules. Participation gives 5 Fallbucks/20 XP; each
qualification adds 3/15; winner adds 20/60 and one crown. Cross-family profile
regression coverage passes.

Canonical astronaut, existing locomotion, suits, trails, emotes and victory poses
are reused. Dive/stumble/qualification are presentation additions. World hazards
retain exact authored hit surfaces with compact rails, end housings and emitter
trim; gates display shared open-state passage paint. No dynamic-light scatter.
Home uses a lightweight miniature, not a full match. Shop/pass/settings reuse
existing systems. Three-family home and lobby adapt to narrow viewports.

Dedicated PlanetRun music scene uses the original 64-second Orbital Sprint loop.
Project-authored procedural cues cover countdown/go, qualification/elimination,
checkpoint/result, jump/dive, impact, nearby machinery and tile warning/break.
No external sound assets were added; provenance is in AUDIO_SOURCES.md.

## Bugs reproduced and corrected

- Slow walking could lose point support at small module seams: bounded circular
  boot contact now bridges those seams, with focused coverage.
- Airborne pilots lost low-gravity strength immediately after takeoff: zones
  extend above their authored platforms.
- Seeded Meteor starts could begin active: first impacts now have warning time.
- Outer-lane bots could wait forever because waypoint completion measured the
  centerline: completion now measures the same lane target used for steering.
- Survival expiry could arbitrarily cut living pilots to the target: all living
  pilots now advance, with an explicit regression.
- Controller camera integrated RAF time inside a fixed-step loop and ignored
  sensitivity/invert: fixed-step integration and shared settings are now used.
- Embedded Chromium denied pointer lock: catch the rejection and provide bounded
  gameplay-only drag look. Native input verified yaw/pitch change and pause exit.

## Actual play and rendering evidence

Native browser input was used, without injected positions, clocks or finishes.
Cargo, Flux and Capacitor each have successful ordinary keyboard qualification
screenshots. Cargo/Flux continuous route checks used Easy bots; normal tournament
progression is separately covered by real-time E2E and server simulations.
Solar knockback/recovery, Meteor warning avoidance, Shatterdeck collapse/lower
landing/elimination, spectator cycling, tournament results, pause/leave and shop/
pass/settings were exercised. Failed attempts are retained, not relabeled wins.
Narrow 390x844 and desktop 1440x900 home/lobby screenshots were reviewed.

Artifacts are in `artifacts/planet-run-oct21/`. Native RTX 3060 ANGLE Direct3D11
samples at 1280x720 cover six rounds in Low/Medium/High/Auto, with 30-pilot starting
rosters. Survival samples may follow elimination. Median 16.7ms and P95 16.8ms
across these short vsync-capped samples. Auto chose Medium. The final hazard
follow-up samples cover Cargo/Flux/Solar: High 64-392 calls, Low 51-257 calls,
with the same frame-time result. Inventory counts are scene renderables, not
precise GPU-visible counts. Earlier SwiftShader samples are software-renderer
baselines and are not hardware results or a measured optimization gain.

Physical controller hardware was not available. Controller mapping/settings have
code and regression validation; no physical-device certification is claimed.
RTX 3060 results do not certify older/integrated hardware. Further player feedback
can still motivate balance/art iteration; it is not a claim that every possible
route/device has been exhaustively tested.

## Final validation

- npm run typecheck: PASS.
- npm run build: PASS; pre-existing chunk-size warning retained.
- npm test: PASS, 1,355 tests / 262 files / 333.08 seconds.
- npm run test:e2e -- --workers=1: PASS, all 22 paths / 12.0 minutes.
  This includes all 14 unchanged Classic/Chaos/BR paths, PlanetRun lifecycle and
  drag look, ordinary tournament progression, Shatterdeck, 24 round/quality
  samples and Meteor warning/impact presentation.
- PlanetRun 10/20/30 normal tournament and all-triggered-tile stress checks pass;
  normal update max remains below the existing test's 50ms cap and tile-stress
  P95 below one 30Hz tick. BR 10/20/40 performance tests pass unchanged.
- World/support/draw tests pass with the unchanged <200 world draw threshold.
- Native keyboard/mouse, UI and renderer checks are described above; successful
  race qualification screenshots and raw hardware samples are retained.
- git diff --check: PASS.

Budgets, timeouts and existing assertions were not weakened. Source and evidence
are committed together; older untracked BR artifacts remain preserved locally.
No deployment command was run.
