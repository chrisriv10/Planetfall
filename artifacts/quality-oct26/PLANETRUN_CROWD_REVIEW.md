# PlanetRun live crowd evidence

All DEV review captures use seed42,20/30 total pilots including one local human. Videos record the actual canvas at20fps for15s; JSON records15 live states. Before/initial-after identities differ and lack explicit elapsed timestamps. Later recovery states include serverTime/roundElapsed. Always filter by requested round AND phase running; later running/countdown/intro can belong to the next round.

## Final survival correction

Initial spacing improvements caused excess Meteor deaths. Confirmed causes: walkable0.2m seams treated as gaps; meteor jumps reduced air control; inflated collider corners; stale destinations; dangerous travel corridors; crowd cost outranking safety; a1.75m soft halo treating the0.64m collision-clear channels as more dangerous than an actual impact box; full-speed arrival/steering overshoot; local separation pushing channel routes into danger.

The helper now uses shared support tolerance, grounded meteor dodges, collision-aware current/arrival corridor safety tiers, bounded authored face-exit candidates, survival-only settling and observed-velocity checks. Crowd preference stays secondary to authored danger. Physics, tile collapse, bumps and hazard timing remain authoritative and unchanged.

| Final capture | Last matching running elapsed ms | Active bots | Eliminated bots | Grounded active bots |
|---|---:|---:|---:|---:|
|meteor-garden /20|16516|19|0|19|
|meteor-garden /30|15915|29|0|29|
|solar-sweep /20|11396|14|5|12|
|solar-sweep /30|16395|21|8|15|

Solar outcomes are not a confirmed regression: latest20/30 reached6/8 deaths by qualification versus6/8 in the earlier after captures (before5/8). Scanning1750 stationary-target positions/phases did not reproduce the proposed distance-gated jump failure: threatened targets replan before that condition. Avoid perfect-survival tuning as a substitute for observed behavior.

## Diversity and spacing

Original five-lane race/25point survival choices were replaced with continuous seeded identity/personality, smooth steering, bounded spatial-grid occupancy, overtaking/following memory, and individual reaction/pass/risk/dive preferences. A grid visits at most24 pilots/25 cells per query; decisions run on a100ms epoch. Contextual dives require finish approach or a short supported airborne recovery, cooldown and personality; no random dive over continuous deck.

Initial before/after close-neighbor(<1.2m, same-height±3m) rates20/30: Cargo54/60%→7/7%; Flux56/62→9/5%; Capacitor64/68→3/7%; Solar46/48→21/17%; Meteor40/50→3/10%; Shatter16/18→12/12%. Those metrics predate the later survival corrections, so are historical evidence of spacing rather than final survival rates. All previous recordings are preserved.

Final Meteor recordings preserve every bot alive through~16s at both populations, matching the original survival window. Focused deterministic20/30 ordinary motion+bump fixtures also preserve the first stationary human and produce0 deaths in15s. Live recordings, not those fixtures alone, support acceptance.
