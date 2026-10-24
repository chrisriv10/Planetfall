# PlanetRun presentation recovery — October 24, 2026

Initial HEAD: `87138ab8c190bdb2bd94bac1743b3ab097a4a3e0` — Rebuild Nova Block as an orbital neighborhood.

Initial tracked working tree and index were clean. Approximately 4,039 pre-existing untracked evidence files were retained. Work continued on this checkout on DESKTOP-JL99F36; no reset, restore, stash, pull, or deployment command was performed during implementation and validation. The user subsequently authorized a checkpoint commit and push. Existing project-local routing was read and preserved. Sol owned shared timing extraction, world/game integration, renderer lifecycle, audio integration and validation; the visuals agent owned isolated presentation helpers and their focused tests.

## Scope and mechanical invariants

This is the six-course PlanetRun presentation pass. Existing round selection, geometry, collision, support volumes, moving-platform paths, obstacle hit volumes/timing, gravity values, boost strength, checkpoints, spawns, qualification, bot navigation and balance remain unchanged. Shatterdeck retains its 419 cells and four authored footprints. The only shared implementation change extracts the existing meteor phase calculation into a read-only helper used by both authority and art. Regression coverage compares its original formula across all authored meteors, multiple seeds and exact warning/impact boundaries.

## Round-by-round changes

### Cargo Cyclone

The playable decks are freight sorting lanes with pale structural edges, dark inset belts, rollers, freight manifests and scanner/dispatch frames. Belt diagrams and rollers follow the actual sideways conveyor direction; moving-deck detailing remains parented to the authoritative platform group. The large Cyclone Sorter, suspended loader and parallel tug/freight traffic provide independent motion and a memorable silhouette. Existing surrounding freight docks and cranes are preserved.

Review correction: initial belt striping suggested forward travel although gameplay conveyors move sideways. The presentation was corrected and covered by a support/paint regression.

High measured world batches: 90 before → 77 after. Low: 68 after.

### Solar Sweep

A radial collector pattern crosses the nine real support boxes, clipped at each support boundary. An underside radial structure and perimeter petals create the collector silhouette without covering the real gaps. Low and high sweepers retain exact hit extents but have distinct amber and violet collector treatments. A suspended central turbine, tracking sail, energy pulse and warm solar sky give the arena a coherent machine identity.

Review correction: the initial floor was too noisy and the low arm blended into it. Floor line density/contrast was reduced; the low arm received a clearer amber top. The center turbine stays above reach and introduces no false center support.

High world batches: 93 → 73. Low: 67.

### Meteor Garden

Sage paving, pale cross paths, leaf inlays, perimeter planting, sculpted trees and the large Orbital Arboretum give the arena a park identity. Planting stays outside collision-critical lanes and meteor footprints. Swaying canopies, pollinator drones and pollen provide ambient motion. Incoming cores/trails descend using the canonical warning progress; impact flashes and pooled fragments follow the unchanged impact phase. Rust-orange warning rings and brackets remain legible against the park paving; there are no opaque warning boxes.

Review corrections: pale warning paint washed out on the floor, so its normal-blended warning color was changed to saturated rust. The landmark camera was corrected to frame the arboretum, rather than a foreground canopy.

High world batches: 92 → 99; Low: 95. The count changes with concurrently visible warning/impact fields.

### Flux Gardens

Terraced conservatory shells, flush floor diagrams, processional route inlays, gravity rings, drifting petals and tapered seed crystals articulate the raised route. The external Flux Bloom provides a large alien-flower landmark. Rings/petals respond to the actual authored gravity zones; local airborne poses and canonical cosmetic trails become stronger in those zones. Collector faces make the rotating hazards readable without enlarging their collision envelopes.

Review correction: early playable floors were still too blank and the rotating arms looked plain. The floors and bounded arm faces were refined. The raised-terrace jump was also checked with ordinary native input.

High world batches: 90 → 98. Low: 88.

### Capacitor Causeway

Blue-gray decks, inset circuit panels, cyan branches and a clear central lane lead through the research machine. Shutters retain their exact hit volumes, with charge/open indicators derived from the canonical phase. Connected headers, paired housings, boost coils, tall capacitor vessels and an external regulator give the course structure. Charge-band motion, regulator rotation and timed lamps communicate the energy flow.

Review correction: initial pale floors remained too blank. Dark circuit panels and branches were added while preserving the clear middle lane. Boost arrows were darkened for contrast.

High world batches: 85 → 81. Low: 77.

### Shatterdeck

The original six thick cage towers and opaque-looking collars were replaced by one open containment structure: thin segmented arcs, slender spires, external displays, spectator drones and conduit motion. The reactor sits well below the kill plane, leaving playable gaps visually honest. Four cell batches provide chassis, rim, inset energy field and circuits, with four distinct layer colors. A single bounded shard pool handles fresh collapses. Every surface/trim batch becomes zero-scaled when a cell is gone; there is no surviving decorative floor.

Review correction: combining old and new containment initially produced a doubled white cage that hid the cells. The old cage was removed, and the new torus cross section reduced by roughly tenfold. Fresh side/oblique images now show the layers and void clearly. Live collapse frames accompany exact solid/triggered/breaking/gone tests.

High world batches: 10 → 42. Low: 35. This is a deliberate presentation cost within the unchanged <200 budget.

## Global presentation

- Six parameterized skies use round-specific colors, planets, station traffic and bounded detail. Solar has a warm sun; Shatterdeck has a darker final-stage void. Lighting uses the existing hemisphere/directional pair, with round colors; no per-obstacle lights were added.
- Low/Medium/High use the existing quality system. Low retains landmarks/hazard readability while reducing stars, traffic, secondary detail and effects. Auto retains the existing hardware/performance selection and resolved to Medium on this PC.
- The home miniature cycles six lightweight course motifs with the canonical astronaut, shared resources and no full world renderer. The lobby has a lightweight six-motif showcase. A real screenshot exposed overlapping motifs caused by an invalid animation-delay expression; corrected CSS now presents exactly one motif at a time. Reduced motion keeps one static motif; hidden screens pause animation.
- The HUD keeps its original structure and actions with round accents and category medallions. Synchronized world lights/displays and HUD pulses show 3/2/1/GO. The race countdown was moved ahead of the chase camera after checking its original placement.
- Qualification/elimination have brief UI sweeps and one scene-wide bounded effect pool. Local qualification holds the celebrating astronaut/camera for 900 ms before the spectating handoff, so the finish burst remains visible. The roster uses canonical cosmetic identity chips and readable departed states.
- Results show the actual winner's canonical astronaut, suit and victory pose on an orbital podium. It renders through the existing WebGL renderer with a reserved viewport/scissor area; no renderer/context is created per card. Desktop and short laptop layouts were checked.
- Pilot reactions/trails cover dive, boost, airborne stretch, gravity zones, landing/stagger and qualification. The existing eight-instance cosmetic trail pool remains bounded; distant pilots skip trail uploads. Standing/walking does not emit trails. A final read-only integration review caught ordinary dives being misclassified as boosts because both travel at speed 13. Feedback now uses the existing distinct cooldown tails; three regressions exercise real dive/pad motion and a hazard stagger without changing authority.
- Existing music/sample ownership remains intact. New procedural cues cover nearby meteor warnings, gravity-zone entry, boosts and landings, alongside existing machinery/tile/countdown/result cues. No third-party asset was added, so no new external license entry is needed.

## Performance

See [METRICS.md](METRICS.md) for all 24 before/after records, including full-frame calls, instances, materials, medians and p95. Raw 180-frame samples are retained in before/ and after/.

At 1280×720 on the RTX 3060/D3D11 test PC, all six rounds and four requested presets remained near 16.7 ms median / 16.8 ms p95. These are refresh-capped observations, not an uncapped speedup claim. Thirty roster pilots, seed, difficulty and center camera were matched; dynamic hazard phases, survival and visible pilots vary. World batches measured 35–102 after the rebuild, within the unchanged <200 limit. Existing renderer tests count hidden meshes as well. Global renderer calls include avatars and must not be confused with world batches.

## Validation and evidence

Final source: typecheck and build PASS; all 1,517 tests across 302 files PASS (328.66 seconds). All 39 E2E checks PASS (25.1 minutes), covering Classic, BR, PlanetGun and PlanetRun. The presentation pass is implemented and locally validated; it is ready for the user's playtest.

Completed validation:

- Final `npm run typecheck` and `npm run build` pass. The build retains the existing large-chunk advisory.
- Final `npm test`: 302 files / 1,517 tests pass. This includes unchanged PlanetRun tournament, movement, obstacle, 419-cell Shatterdeck and 10/20/30-pilot normal-tournament/active-breaking tick-budget coverage.
- Focused integration: 68 tests passed, including unchanged world geometry/draw checks, meteor schedule parity, cells, cosmetics and renderer ownership.
- A complete preliminary run had 1,513 passing tests and one new effects-pool fixture failure. The fixture now supplies the new presentation dependency; inactive quality application is guarded. No assertion, budget or timeout was weakened. A subsequent full run passed all 1,514 tests. The final frozen-source rerun passes all 1,517, including the three newly added dive/pad feedback regressions. An early E2E run was deliberately interrupted before PlanetRun cases while the final feedback refinements landed; its log is retained separately.
- Final `npm run test:e2e -- --workers=1 --output=artifacts/planet-run-party-oct24/e2e`: 39 / 39 pass, with original assertions and timeouts. New coverage verifies all six thirty-pilot course starts, one visible lobby motif, and a real final through desktop/laptop winner layouts. Existing ordinary-tournament, Shatterdeck contact/fall/results, all four quality runs, meteor rendering and cross-family lifecycle tests also pass.
- At validation completion, `git diff --check` passed and HEAD was still the initial commit. The user subsequently authorized this checkpoint commit and push.
- Logs: [typecheck](validation/typecheck-final.txt), [build](validation/build-final.txt), [full tests](validation/tests-final.txt), [full E2E](validation/e2e-final.txt).
- Before/after High galleries contain six views per course. Landmark views were corrected where needed; center performance cameras remain unchanged. Contact sheets are [before](before-six-round-contact.png) and [after](after-six-round-contact.png).
- Native keyboard play used movement, jump and dive in every round, including hazard interactions, natural falls/eliminations and spectating. Longer Cargo traversal crossed the first gaps and hazard decks into the moving conveyor section; Flux checks reached the raised low-gravity terrace. A normal launch verified intro/countdown/GO in player view. A natural final verified the winner stage and return flow.
- A direct held-jump capture confirms native jump input; early short-input records have diagnostic DOM sampling latency and should not be interpreted as failed jump registration. Failed timing attempts and falls are retained alongside successful traversal evidence.
- Eight native live Shatterdeck collapse frames and their state/revision records are in after/shatter-live-collapse-*.png/json. Exact state-removal/pool behavior is covered by the focused cell tests.
- Final read-only integration review found no remaining material renderer ownership, timing, scissor/viewport or resource-lifetime issue after the dive/pad feedback correction. Final presentation reviews accepted all six round identities, open Shatterdeck containment, lobby cycle and both podium layouts. Some actual live views retain the brief elimination banner or a foreground pylon; unobscured oblique/landmark/finish and collapse views provide the complementary evidence.
- Native console inspection found no errors during the reviewed run; E2E also checks page errors.

This is agent-driven play and visual review, not a claim that the user or friends have accepted the new presentation. Future human feedback should remain actionable; green tests alone are not visual acceptance.

The user authorized committing and pushing this validated checkpoint after the pass. Source, tests, native before/after evidence and validation logs are included; the full generated cross-mode E2E output remains local. Final podium captures are preserved as [desktop](after/final-winner-desktop.png) and [laptop](after/final-winner-laptop.png). No deployment command was run.
