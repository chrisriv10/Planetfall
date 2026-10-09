# Orbital Isle landmark recovery — October 8

Execution and native screenshot review: DESKTOP-JL99F36 / RTX 3060.
Baseline: `8adb2e7fc4988b61be4b86e9cdbe0fe78a9b13ee` on `main`.

The before scan found 22 mesh/building intersections: 19 at Zero Point and
three at Crash Site. It checked actual production landmark triangle surfaces
against 101 enterable structures over 25 animation times from 0–90 seconds.
`before/zero-interior.jpg` and `before/zero-control.jpg` show the decorative mast
and pylon occupying playable rooms.

Zero Point's energy hardware now sits above the actual Zero Spire roof. The
mast, four pylons and connecting braces replace the ground-level assembly and
false bridge arms. Three animated orbit rings and the existing single point
light remain. Generic roof equipment is omitted on this authored crown so it
does not cross the mast or core. Crash Site's engine rings clear its end wall
and each other; the tilted tail's lowest corner clears the roof.

`final/` contains ten close production-world views and the final 101-enterable
scan. `draft/` preserves the intermediate roof arrangement before its brace
endpoints were joined into the tapered mast. `integrated/` contains five views
in the actual running game. Both final screenshot reviews record zero page
errors. Screenshots assess appearance; they are not a player-collision proof.

`landmark-audit.json` expands the final scan to all **183 building envelopes**,
including the 101 enterable structures: nine landmark groups, 141 mesh objects,
25 animation samples, zero broad-phase candidates and zero flagged hits. Since
all bounds clear the inset envelopes, the final scan needs zero narrow-phase
triangle checks. The before scan required 52,132 triangle checks to identify
its 22 pairs. Mesh object counts do not represent individual instances.

To repeat against the local Vite development server:

```powershell
npm run dev
# In another terminal, after the server is ready:
npm run audit:br-landmarks -- artifacts/br-landmark-audit/report.json
```

`PLANETFALL_AUDIT_URL` can select another Vite development origin. The audit
uses a blank browser page and the production renderer, exits nonzero on hits
or page errors, and leaves gameplay/server state untouched. It retains 0.4m
wall/floor and 0.3m roof-contact margins to exclude intended surface contact.
These are sampled surface checks, not continuous animation or closed-volume
proof. Players, independent prop groups, landmark-to-landmark contacts and
every other map mesh remain outside its scope.

The existing facade audit (`facade-audit.json`) separately passes 26,900
facade/attachment boxes and 16,653 building pairs. These scopes overlap and
their counts must not be added together. Canonical astronaut, island size,
authority, physics, networking and Classic/Chaos contracts are unchanged.

Final regression results and any observed intermittent failures are recorded
in `validation.json`. Broader player/prop overlap review and art acceptance
remain open. Nothing in this checkpoint deploys the game.

The first full test run passed 892/893, with a `mixed match end timeout`. The
unchanged server file then passed 16/16. Twelve diagnostic live matches
reproduced one survival: the bot repaired from 14 to 29 integrity 92ms before
the rocket hit, leaving 15 integrity rather than ending the match. The event
sequence is retained in `regression-rematch-race.json`. This explains that
fixture's intermittent failure; it is not a diagnosis of every historical
E2E failure. No bot behavior, test condition, assertion or deadline was
changed. The subsequent full run passed 893/893 across 161 files in 143.12s,
but the fixture's reliability remains open.
