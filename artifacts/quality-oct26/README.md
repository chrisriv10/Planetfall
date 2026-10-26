# Planetfall quality recovery — October 26, 2026

This records the implementation and actual validation for the current working-tree recovery. **Audio listening is still unreviewed.** The user has not listened to the new effects/music; automated playback, hashes and levels do not establish artistic mix or loop-seam acceptance.

## Preserved source and scope

Initial HEAD was9178571ba8cc3ad44f5d4af0485ac3e542d71f4d. The existing PlanetRun background changes (three modified/eight new source files plus evidence) were preserved and, after the user's explicit request, committed/pushed as ea179c12e34bb4c742dbd150c743880fd2ccd4a2. This later quality work continues from that checkpoint. All useful local work and prior evidence were preserved; no reset, restore, stash, pull or rebase.

Execution verified on DESKTOP-JL99F36. Project-local Sol/Astra routing is retained. Sol owned authority, integration, E2E and final validation; Astra implemented isolated presentation helpers. Existing local setup/configuration was not overwritten.

## Implemented recovery

- **PlanetRun bots:** replaced five-lane/25-point formation choices with continuous seeded personalities, overtaking/follow memory, smooth steering and support-aware jumps/contextual dives. A100ms crowd grid visits at most24 pilots/25 cells. Live20/30-pilot recordings across all six rounds exposed seam, warning-corridor and arrival-overshoot problems; these were corrected without changing hazards/physics/bumps. Final Meteor recordings kept19/29 bots alive through~16seconds. Solar outcomes were reviewed without demanding perfect survival. See PLANETRUN_CROWD_REVIEW.md.
- **Lobbies/home:** four lobbies share opt-in Classic/BR foundations with distinct accents. PlanetGun/PlanetRun controls fit1280×720 with44px actions;390/900 responsive views were reviewed. PG's preview is fixed upright; PR performs six distinct5-second actions with grounded feet and a static reduced-motion hero.
- **Client rendering:** profiled real12-pilot bot gameplay over nine views at Low/Medium/High/Auto, then controlled3/6-nearby crowds and actual wall runs. Distance LOD, lower-frequency distant animation, reused frame temporaries and exact near/mid canonical pilot batching reduce CPU/draw workload. Transparent parts retain sorting; owned buffers/resources have disposal tests. Native same-room six-nearby stage A/B reduced calls High693→202,Medium656→190,Low581→182,Auto639→190; median CPU High7.9→5.4ms. These measurements predate the last local arm/housing refinement; they are display-capped observations, not uncapped FPS/GPU timing or an integrated-GPU guarantee. See CLIENT_PERFORMANCE.md, CLIENT_SCENE_TABLES.md and client-observations.csv.
- **Weapons/animation:** existing six base stat records are unchanged. Helix adds an accepted-snapshot three-round burst, Arc a mobile energy role, Prism sustained beam/authoritative heat, Orbit a light semi-auto secondary. All ten have phase-driven component/hand reloads, weighted lower/raise switches, movement/recoil feedback and cancellation lifecycle checks. New local sculpted/tapered housings replace large camera-facing stock slabs. Rounded sleeves, distinct support/trigger arm angles and fitted cuffs correct the rejected rod-like ADS pose without moving hand/sight/muzzle anchors. All ten were actually fired/reloaded/aimed/switched with native input in fresh15s clips; all ended100HP. Final Helix consumed3 rounds, Prism30. Native frames were reviewed;49 focused arm/model/reload/optic tests passed.
- **Combat Kits:** five named versioned saved slots; compatible module categories, primary≤3/secondary≤1, ID-only server validation and shared effective profiles/tradeoffs. Alive changes queue for next spawn. Economy/cosmetic ownership is untouched. Save-focus/Escape was corrected after a real browser failure. Reflex gives a visible holographic reticle and honestly advertises unchanged handling.
- **Nova Block:** controlled facade rhythms, frontage/drainage and distant habitat/docking context, preserving authoritative layout, collision and circulation. Ground/interior/terrace approaches and actual hydro wall-run were reviewed.
- **Audio:**116 selected CC0 files (113 SFX/loops+3 replacement tracks),9,430,915bytes. Original David KBD Low Battery/Bot City files and gains are preserved unchanged. Playback is recorded-sample-only with16 one-shots+4loops, three concurrent decodes, spatial reports, event-driven contacts, fades/ducking and quieter BR/PG music. Starliner uses lower gain/900Hz filtering. New source/license/download/hash/level evidence is in docs/AUDIO_SOURCES.md, docs/audio-license-evidence/ and the asset manifest. Raw web-page snapshots and two unused replacement-theme candidates remain local and are not shipped. No normal synthesized fallback. Perceptual listening remains pending.

## Validation

- Typecheck: passed on final source.
- Production build: passed; existing large-chunk advisory retained.
- Full unit/system suite: **1682 tests/325 files passed**,377.76seconds.
- Focused Shatterdeck E2E: passed, including tile contact, lower-deck fall, results and lobby exit. The original >17 spawn assertion is observed during deployment before a normal620ms contact-tile collapse; tile/fall/results assertions and original timeouts remain unchanged.
- Full serial E2E: **40/40 passed**, 28.8 minutes, on the frozen final source.
- Final whitespace cleanup: normalized imported license text and removed one trailing blank line; **15 focused audio/loadout tests passed** afterward. No runtime logic changed. Fingerprints include this final normalization.
- Unchanged BR10/20/40 and PG4/8/12 server performance checks passed in the full run. See SERVER_PERFORMANCE.md; these are separate from client rendering evidence.
- Repository-configured git diff --check: passed.
- Final source/asset fingerprints are in validation/source-manifest.json.

Earlier interrupted/parallel browser runs and rejected visual iterations are retained locally. Parallel input/render failures are not treated as passing acceptance; the final suite uses one worker and frozen source. No timeout, performance budget, gameplay assertion, clearance or network condition was relaxed.

## Evidence

The final ten-weapon native recordings, seven action frames/states each, and two contact sheets are under weapon-motion/ locally. Selected contact sheets and metadata accompany this report; large raw videos/earlier iterations stay local. Current arm views are under arms/. Earlier six-round20/30 recordings, lobby responsiveness, home cycles and performance raw JSON remain under artifacts/quality-oct25/ locally.

A passing suite does not certify every future human-playtest observation. This report explicitly leaves new-audio listening and broader friend playtest acceptance unclaimed. No deployment has been invoked.
