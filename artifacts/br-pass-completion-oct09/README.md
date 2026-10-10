# Orbital Isle spatial recovery — October 10, 2026

Work continued on DESKTOP-JL99F36 from the existing dirty checkout at
`d64d771`. The index and all prior local work were preserved. No reset,
restore, stash, commit, push or deployment was performed. Local Sol/Astra
routing remains outside Git.

## Recovered spatial contracts

The Dock–Engine workshops and through-road remain intact. Coolant East and
North Civic now have opposing enterable frontage, real floors/walls/stairs,
loot and connected streets. The existing island outline, all nine primary
POIs, all 185 checkpoint structures and all 271 checkpoint loot sockets retain
their positions. Four structures and ten sockets append to them. Only five
existing roof-access sides change, to route their ramps into usable space.
`preservation-final.json` records the comparison and its dependency limitation.

Road grades now meet the full width of their district decks, and crossing
grades agree at joins. Road bends use tangential fillets and supported curbs.
Every enterable doorway has a real collision header instead of an opening to
the roof. Interior partitions end beside stair columns, and upper stairwell
openings have landings at both ends. Floor queries intersect actual rotated
cuboids rather than their broadphase boxes.

The production stair fix refines contact queries on supported interior stairs,
including landing-to-incline sweeps during long ticks. Descending short queries
request contact only where actual support is within the existing .18m snap
range. Uphill input, gravity, jumping and controller contact limits retain
their original behavior. Server and prediction apply the same rule.

Presentation includes district slab/partition finishes, doorway headers, neon
facade LEDs and mounted signage. Secondary specimen trees are about 8m and
Academy columnar trees about 7.9m against the measured 2.425m canonical rig.
Shrubs stay small. The Overlook pocket is relocated to clear the recovered
road. Facing Crash/Salvage and Void awnings clear the neighboring facade skin;
Comet's facing decorations fit its existing service passage.

## Geometry and traversal evidence

- `circulation-final.json`: 912 bidirectional road/entrance routes.
- `junction-final.json`: 634 joins and 945 continuous intersection routes.
- `roof-circulation-draft.json`: all ten roof accesses, twenty bidirectional
  continuous deck/ramp/roof-loot traversals. The filename retains its original
  draft label; its recorded result passes.
- `interior-final-candidate-3.json`: all 107 enterable structures and 271
  non-roof loot routes, each traversed continuously outward and back with
  authoritative collision and prediction parity.
- `production-stairs-descending-probe.log`: all 65 stair flights in both
  directions, walking and sprinting at 30Hz, 60Hz and the maximum .1s tick
  (780 production-movement traversals), plus direct-controller/geometry checks.
- `stair-query-final-proof.json`: same geometry and movement inputs, isolated
  old/current controller-query comparison. At .1s the old single query reaches
  .407m support gap and 11 unsupported frames; the current query reaches
  .06964m and no unsupported frames. Separate ignored modules reconstruct the
  prior query; the checkout is never replaced.
- `facade-complete-final.json`: 189 envelopes, 17,766 building pairs and 28,138
  facade boxes; no building overlap, outward-glass cuts, attachment/envelope
  overlap or attachment overlap across neighboring buildings within this scope.

These checks retain arrival, support, parity and collision assertions. They do
not certify every decorative triangle, animated figure or possible trajectory.

## Active and visual review

All nine primary POI entry/interior/exit runs passed using trusted browser
keyboard/mouse with the production player/camera. Their `active-<poi>` folders
contain the captures and exact per-run scope. Each has one initial fixture
placement followed by actual input; they are not teleport-only screenshots.

`active-civic-stable-final` passes 34 route legs and three authoritative
pickup/drop/recovery cycles, including both floors and the stair descent,
with 68 trusted mouse events, 375 key events and zero page errors. Dropped
items on both floors were inspected in oblique active-camera views.

The frozen final source was replayed in `active-coolant-final-v4` and
`active-civic-final-v4`: 23/34 route legs and three pickup/drop/recovery cycles
per site pass, with zero page errors. Coolant records 63 trusted mouse and
274 key events; Civic records 65/377. Sol inspected both sites' upper-floor
drop, ground-floor drop and stair-descent originals. The final Coolant route
uses the real workbay doorway in both directions.

`frontage-review.md` records the entrance/secondary review and limitations.
Primary aerial/frontage views, all representative interior views and density
gap views were inspected. Unsupported camera positions inside elevated decks
were replaced with independent ray-supported views. `recapture-review` and
`awning-clearance-review` together show all ten entire roof-access ramps.
The eleven final alley/roof originals were inspected; narrow alleys necessarily
limit full frontal shots. `tree-scale-review` includes the actual unscaled
astronaut beside the revised trees and relocated Overlook pocket.

The density diagnostic excludes floors, road proximity and POI markers from
enclosure. It reports 9.4% of interior samples more than 30m from a building or
cover, .2% more than 50m, and none more than 75m. Remaining largest gaps are
peripheral approaches/overlooks and require composition judgment; these
percentages are not an object-count completion criterion.

## Final validation

Final typecheck and build pass (`typecheck-final-v4.log`, `build-final-v4.log`);
the existing large-chunk warning remains. The frozen-source full suite passes
**1,009 tests across 184 files in 174.69s**
(`full-suite-final-v4-recheck.log`). Full E2E passes **11/11 in 5.8 minutes**
(`e2e-final-v4.log`), including BR room/drop, responsive Solo map, Classic
raid/rematch, Chaos and the six-participant visual budget. Sources were not
edited and other validation jobs were not run during E2E or live walkthroughs.

All six final production assembly audits pass: nine primary prop groups,
43 secondary/transition groups, four connective groups, all nine animated
landmarks at 25 sampled poses, 25 labels/175 mounts and repeated High/Low
world teardown. The `*-final-v4.json` reports state their independent scopes.
They are not a single universal overlap proof.

The isolated five-case 10/20/40-participant performance run passes all original
budgets (`performance-final-v4.log`). The three 40-participant cases average
5.650/5.674/5.764ms, p95 9.153/9.517/9.142ms, worst 14.735/14.754/15.729ms;
maximum snapshots are 33,867/33,983/34,089 bytes. This is authoritative server
simulation/snapshot profiling, not forty browser clients or a live FPS claim.
Budgets remain average <16ms, p95 <45ms, worst <150ms and snapshot <160,000 bytes.

`source-freeze-final-v4.json` and `source-verification-final-v4.json` record all
372 source/configuration hashes and both local routing hashes unchanged after
validation. Git's index remains empty at `d64d771`; the diff whitespace check
passes. The healthy ordinary preview remains at localhost:5173/server3000.
Isolated review/E2E ports are closed. `validation-final-v4.json` indexes results.

The recovered spatial contracts now have implementation, traversal, live-input
and visual-review evidence across the island. Human art/control-feel acceptance
remains open; the evidence does not guarantee that every POI looks correct from
every possible camera position. No commit, push or deployment was performed.

## Preserved failed evidence and limits

Earlier draft geometry and review failures remain in their original files.
`active-civic-final` reproduced unsupported stair descent. The next Civic
attempt was interrupted by shared-source reload; it is not a passing run.
`active-coolant-stable-final` reached and recovered upper loot but its direct
return waypoint hit the actual workbay partition. The review route now uses
the real central doorway; no collision, timeout or progress assertion was
weakened. Short-tick baseline probes did not reproduce the stair failure; the
maximum production tick did. An earlier downward-gravity experiment was
removed: the final fix is local contact refinement.

`full-suite-final.log` retains the stale roadside-camera parent-ID failure;
the camera and exact lookup now follow the actual subdivided pocket, with its
framing assertions unchanged. `full-suite-final-v4.log` retains the existing
Classic mixed-match end timeout (1,008/1,009 passed). The unchanged server file
then passes 16/16, followed by the successful fresh whole-suite run. A historical
trace in `../br-landmark-recovery-oct08/regression-rematch-race.json` reproduced
a bot repair during this fixture's rocket flight. This green rerun does not
resolve that fixture's intermittent reliability or prove the event sequence
of this particular timeout. No test condition, assertion or deadline changed.

Static captures omit the live match's full rendering effects and do not measure
FPS. Trusted automated gameplay is not human gameplay or final art acceptance.
Performance validation must use the original budgets. Whole-world overlap
claims remain limited to each audit's recorded geometry scope.

Checkpoint publication: after the validation snapshot above, the user explicitly
authorized committing and pushing this working state. The earlier no-push
statements describe the recorded validation runs. This checkpoint preserves
remaining human visual/control-feel acceptance and the Classic fixture's
intermittency; it does not claim universal visual correctness or deployment.
