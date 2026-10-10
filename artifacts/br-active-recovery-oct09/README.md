# Active Dock–Engine review and Coolant frontage recovery

Continued on DESKTOP-JL99F36 from a clean local checkout. The checkout was two
commits behind the remote and was updated by fast-forward only to `d64d771`.
No reset, restore or stash was used. Local ignored routing and runtimes remain.
This continuation is local; the user has not authorized a new push/deployment.

## Dock–Engine active review

`engine-gate-recheck/playthrough.json` records eleven actual input routes and
two collected weapons in the production client with player, camera, HUD, loot,
networking and authoritative simulation active. Routes include both doors,
both directions on the road, and the court between buildings. The player stays
alive and grounded; trusted mouse/keyboard events and pointer lock are used.
The screenshots show the live room, rather than a static world-only renderer.

The harness owns an isolated local test server and a second connected pilot.
It places the first pilot at the approach once after normal room/start/loot
generation. All later travel and pickup actions use browser input. This
targets local circulation; it does not prove a normal ship-drop route to this
site or represent human control-feel acceptance. The retained first attempt in
`engine-gate/` picked up nearer ammo before its chosen weapon and stopped at its
weapon-only expectation. The successful retry handles ordinary consecutive
pickup prompts without changing game logic or deadlines.

## Ground-view selection and physical layout

The prior North Civic and Coolant East views both show sparse foreground.
Coolant East was selected because the level Zero–Coolant avenue supplies a
clear street connection. North Civic's graded circulation needs separate
elevation review; the largest density samples at the rim are not automatically
errors or requests for more buildings.

Two appended real structures face a new six-metre street at x37: an east-facing
two-floor control office `(18,0,98)`, 20×24m and 11m high; and a west-facing
maintenance building `(56,0,98)`, 18×20m and 6m high. Both have authoritative
enclosure, open 4.8m doors and interior loot. The office has an actual internal
incline and upper landing; neither adds an exterior roof ramp. The local street
joins Zero's north perimeter at z58 and reconnects to the existing avenue via
an exact-height connector at z121. Doors have clear pedestrian shoulders.

The draft connector at z135 cleared trunks but caused the deterministic canopy
reservation filter to remove two old trees. It was moved south; the final
`preservation.json` verifies every established structure, loot/crate socket,
road, terrace, collision block, tree and bridge pier exactly. All 66 trees and
the -3m Transit basin remain. Existing collision geometry and player movement
rules are preserved.

Astra's isolated helper adds 16 cached-box parts: two narrow flush aprons and
small plaques on measured solid wall intervals. Sol reviewed and integrated it
into the existing Zero Point prop/LOD group. It adds no lights, resources,
freestanding opaque cover or collision exceptions. Office cyan and maintenance
copper accents distinguish the entrances without turning the site into scatter.

## Evidence scopes

`coolant-final/` contains six final static production-world views at deliberately
clear street/door/interior positions. The historical Coolant camera at `(50,2.7,100)`
lies inside the new maintenance shell, so it is not a valid after camera or a
matched before/after comparison. `coolant-blockout/` retains that rejected
legacy camera experiment; it is not accepted visual evidence. Other blockout
captures are intermediate, before the final street/plaques were integrated.

`facades-final.json` and primary/secondary/connective reports retain their
documented envelope/triangle scopes. They exclude unrelated player/prop-to-prop
contacts and do not certify the entire map. The final facade check covers
187 envelopes, 17,391 pairs and 27,430 facade parts, with no flagged hits.
Primary checks nine prop groups, secondary 43 groups, connective four groups.
Scopes overlap and must not be added together. `density-after.txt` is geometric
context only; visual composition and usable circulation determine acceptance.

Physics tests walk both new streets, both doors, the ground corridor and the
internal incline in both directions with grounded state, measured support,
arrival and five-decimal client/authority parity. At the upper incline/landing
edge, support is measured inside the unchanged .45m capsule footprint; a
centre-only downward ray misses landing contact behind the centre during
descent. The .08m support limit remains. Only the established narrow .36m door
lip retains its existing transition allowance.

Final live walkthrough and regression results are recorded separately in
`validation.json`. Static screenshots and automated input are not human
gameplay acceptance. Whole-island recovery remains unfinished.

## Loot support correction

The floor-phasing report exposed authoritative and presentation defects:
generated ground-floor loot used the building origin rather than the raised
slab top; roof loot used the slab centre; forward inventory drops and crate
scatter copied the source height instead of querying the destination.
Production placement now queries the static authoritative Rapier world, keeps
forward drops on the player's side of walls, accounts for the rarity field's
footprint on inclines, and retracts offset items from deep stairwell openings.
Pickup origins remain static and server-owned. Contents, rarity, inventory
counts and magazines are preserved.

Distant marker scaling previously put an ammo marker about .208m below its
support at 150m. Markers now use their rotated geometry bounds and the exact
support offset. Detailed models reserve the full downward bob amplitude.
The live inventory check also exposed buttons being replaced on every motion
snapshot; its DOM now changes only when displayed inventory data changes.

`br-loot-placement.test.ts` covers actual roof/ground/upper-deck collision,
all generated pickups at three seeds, an uphill forward drop, a real room
wall-adjacent drop and recovery with magazine conservation, and real room crate
scatter/recovery on an incline. `br-loot-grounding.test.ts` checks actual weapon,
heal and ammunition geometry through bob/spin, marker scaling and quality
changes. The final focused run passes 16 tests in those two files plus the
existing loot-generation tests.

Earlier live-attempt folders retain failures. Some failed at DOM replacement;
others used an invalid diagonal stair approach or required constant grounded
contact even while stepping down the real .36m doorway lip. The final harness
retains every failed route's client and authority samples. Its doorway check
allows only a descending step at the four reviewed Coolant/Dock-Engine doors,
within .44m of the deck, with collision support below .45m and a grounded final
arrival. No existing production test, timeout or performance budget changed.

## Final live validation

`coolant-live-final/playthrough.json` passes 21 route legs, including both
directions on the internal incline, the upper landing, both doors, the new
street and connector, and return along the existing avenue. All three collected
items were dropped through the actual inventory UI and recovered through E.
The run records 57 trusted mouse and 271 trusted key events, with zero page
errors. The two brief ungrounded samples are downward .36m doorway steps; both
arrivals are grounded. No airborne sample elsewhere was accepted.

`engine-live-validated/playthrough.json` passes 11 route legs and two pickup,
drop and recovery cycles after the loot fixes. Its inventory click holds for
180ms across multiple state snapshots, exercising stable buttons. It records
31 trusted mouse and 192 trusted key events, with zero page errors.

The unobscured workshop oblique view visibly separates a Rail Laser and adjacent
shield cell from their floor rings at the captured phase. Earlier Coolant
frames show the supported rings and a partly visible weapon; the avatar hides
the upper heal model, so those stills alone cannot certify its complete bounds.
Animation/model tests supply separate numerical evidence. No single screenshot
or automated run is human art, camera or control-feel acceptance.

Repeat the live fixture with `tools/br-active-spatial-review.mjs`. In one
terminal run the Vite client on port 15174 with
`VITE_SERVER_URL=http://127.0.0.1:13001`; in another run
`node --import tsx tools/br-active-spatial-review.mjs`. Set `SPATIAL_SITE=coolant`
for the Coolant route (the default is Dock-Engine), and `SPATIAL_OUTPUT` to a
new evidence directory. The tool owns and closes its isolated server/browser;
it never uses the user's normal local match. Its initial pilot placement and
fixed seed are explicit fixtures, not gameplay acceptance shortcuts.

The first full regression run passes 948/949 tests. Its sole failure was in the
new preservation test: the expected central-garden list accidentally omitted
tree 6. Direct imports of the `d64d771` baseline and current source both show
all seven original central-garden IDs. The expectation now retains all seven;
no map tree was added/removed to satisfy it. The corrected full rerun and E2E
results are recorded in `validation.json`.

The corrected full run passes **949/949 tests across 172 files in 148.52s**.
This includes all five unchanged 10/20/40-player authoritative performance
cases. These profile in-process production-rate simulation and snapshots with
hard bots; they do not represent forty connected browser clients.

Full E2E passes **11/11 in 5.7 minutes**, including BR Starliner/Solo, Classic
raid/cannon play, Chaos and six-player visual budgets. No source edits or
concurrent render/unit workloads occurred during E2E. Historical timeout root
causes remain unproven; no historical timeout reproduced in this run.
Fresh `npm run typecheck`, `npm run build` and `git diff --check` pass. The build
retains the existing chunk-size warning. Logs and exact source hashes are saved
beside `validation.json`. There is no new commit, push or deployment.
