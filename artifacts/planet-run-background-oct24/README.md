# PlanetRun orbital surroundings - October 24, 2026

This pass targets the non-playable surroundings of all six rounds. The previous course work remains intact. Initial HEAD was `9178571ba8cc3ad44f5d4af0485ac3e542d71f4d`; tracked files and index were clean. Thousands of pre-existing untracked recovery artifacts were preserved. No reset, restore, stash, pull or deployment was performed. The completed pass was initially left uncommitted; the user subsequently requested this checkpoint be committed and pushed on October 25.

## Result

- Cargo Cyclone: continuous freight terminals, warehouses, container stacks, cranes, lower freighter docks, transit viaduct and distant terminal skyline. A tug traverses its lane; the transfer head moves along its suspension cable.
- Solar Sweep: large collector arrays, stepped outer solar fields, a deep station collar, power-control towers, mirror horizon and inspection shuttle. The existing event machinery stays visually dominant.
- Meteor Garden: planted habitat terraces, conservatory ribs, arboretum annexes, service spines and distant inhabited greenhouse halls.
- Flux Gardens: suspended botanical districts, gravity conservatories, crystal forms, transit infrastructure and a distant conservatory skyline.
- Capacitor Causeway: connected research quays, laboratory blocks, framed reactors, capacitor banks, distant concourse and quiet architectural window ribbons.
- Shatterdeck: segmented spectator terraces, broadcast boards with orbital graphics, hospitality wings, tall event pylons, far terminals, deep service arms and shuttles. The central void remains open.
- Every sky: richer baked nebula wisps and clustered stars, intentionally framed larger planets, a diffuse orbital dust belt and a small moon. No new external assets, textures, dynamic lights or renderer were introduced.

The districts are world-space geometry at multiple distances. Actual camera movement supplies parallax. Repeated structures are instanced; ambient motion changes a handful of group transforms. Low retains the major silhouettes while hiding secondary detail and reducing sky traffic. Medium/High/Auto use the existing quality path.

## Screenshot review and iteration

Fresh baseline and final High galleries cover start, hazard, center, landmark, finish and oblique cameras for all six rounds. All six were reviewed, alongside player-camera before/after views using actual W and Space input. The resulting authoritative positions are recorded in `player-checks.json`. Native browser errors: none recorded.

Two refinements followed screenshot review: the initial distant garden balls/masts became ribbed conservatory halls with windows and service galleries; blank Shatterdeck displays gained orbital broadcast graphics. Cargo's moving crane head was aligned to its cable. New background geometry does not enter protected course envelopes or become gameplay/camera collision.

The six-round contact sheets use full screenshots resized without cropping, with a second center view inset. Full native 1280x720 originals remain in `before/` and `after/`.

- [Before](before-six-round-contact.png)
- [After](after-six-round-contact.png)
- [Side-by-side comparison](before-after-comparison.png)
- [Rendering measurements and limitations](METRICS.md)
- [Raw final samples](client-render-samples.json)
- [Actual movement records](player-checks.json)

Some Shatterdeck gallery frames include the normal temporary elimination card because the authoritative match continued during review. Complementary oblique and player views expose the surroundings. The existing close containment spire intersects the fixed center review camera; it predates this background pass. It was not moved or hidden to improve the evidence. This is targeted background acceptance, not a claim that the whole mode has completed human gameplay acceptance.

## Validation

Final typecheck and production build passed on October 25. The existing large-chunk build warning remains. Sixty focused PlanetRun tests passed after integration. The final full unit run passed **1,528 tests across 306 files** in 344.61 seconds. All nine PlanetRun E2E checks have passing results: eight from the October 24 run, plus the thirty-pilot course/winner-stage check rerun by itself on October 25 (1 passed, 1.8 minutes). Original thresholds, assertions and timeouts remain unchanged. Final logs are in `validation/`.

The first combined validation attempt is retained in `validation/`: three unrelated astronaut articulation tests timed out under concurrent software-rendered E2E load, so the partial unit run was stopped and restarted sequentially. The initial thirty-pilot E2E failed while the page reloaded to Home during intro, coinciding with a final whitespace cleanup. The first rerun was then interrupted by the user; it is not counted as passing. The stable-tree October 25 rerun passed. No source edits were made during that rerun or the final unit run.

The rendering report contains 12 fresh before samples (High/Low) and 24 final samples (High/Medium/Low/Auto), each with 30 pilots. Median frame time stayed approximately 16.7ms and p95 approximately 16.8ms on the RTX 3060 at 1280x720. These refresh-capped results demonstrate maintained cadence on this PC; they do not establish uncapped headroom on older hardware. All-world mesh/point counts, including hidden detail, remain below the unchanged 200 limit; the largest is Meteor Garden at 190 in Node, plus two small browser labels.

No server/shared authority or performance-test limits changed. Server load benchmarks were not repeated for this presentation-only task; the relevant coverage is actual client sampling, background clearance/resource tests and existing PlanetRun gameplay E2E.
