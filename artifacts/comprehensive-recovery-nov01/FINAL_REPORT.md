# Comprehensive gameplay recovery

This report covers the comprehensive local recovery and subsequent playtest corrections. The final local checks passed on November 10, 2026.

## Initial state and preservation

- Initial HEAD: 3fc72e86cd59055c05239a967b02a805cc77dcf7; initial tracked tree and index were clean. Existing untracked evidence and local runtime/configuration were preserved.
- Execution was verified on DESKTOP-JL99F36. The local filesystem remained the source of truth; no reset, restore, stash, blind pull or rebase was used.
- Earlier Orbital Isle spatial recovery, supported loot, shared astronaut, Classic/Chaos separation and existing mode checkpoints were retained.
- The obsolete desktop-transfer note was removed from Git tracking while retaining its local file. Useful gameplay audits, asset attribution and historical evidence remain.

## Critical playability and networking

The hosted baseline showed irregular Watch snapshot delivery even while RAF was display-capped: observed snapshot age median147ms/p95606ms/max1071ms, timestamp gaps median68ms/p95198ms/max499ms. These measurements identify a delivery/simulation issue beyond local FPS; they do not isolate a hosting quota as the cause.

Locally, spectator framing was reproduced at exactly a teammate's eye. Explicit camera ownership now keeps remote spectator orbit separate from local aim and returns to the local camera on a new life. Actual mouse movement is not smoothed through the spectator interpolation. A static controller-stick offset no longer takes camera ownership away from captured mouse input. Pointer lock belongs to actual gameplay and releases for interactive UI. A later natural trace reproduced RMB arriving after capture was granted but before the delayed acquisition notification; the old handler cleared the new ADS hold. Acquisition now preserves fresh controls, while loss still cancels fire/ADS. The native capture/loss flow and a replayed late notification have passed focused browser checks. The player's local feedback was that controls felt better; it also exposed the fence/bot issues addressed below.

Navigation retains safe physical corners, invalidates removed topology nodes before access and preserves stationary objective interactions. Strike bots now plant through normal authority; Siege attackers commit to an open entry instead of seeking another exterior panel after arriving. Friendly bodies block bot shots; bots conserve those shots and can take a validated sideways step of at most2m on their existing reaction cadence. Target observation, reaction time, aim noise, damage and movement authority remain separate from this positioning aid.

The ray hot-path retained slab-intersection semantics and passed12,000 deterministic parity samples. An earlier paired240,000-ray microbenchmark measured51.64→13.13ms. This is a CPU kernel result, not a hosted FPS claim.

## Shared home, lobbies and controls

- PlanetRoyale is the public BR name; internal IDs, persisted keys, socket protocols and actual island scale remain stable.
- The WIP warning is a compact opaque card within the home panel. Continue/Cancel/Escape and focus use the existing entry flow.
- All four ready rooms share the canonical astronaut preview, cohesive roster/actions, collapsed host configuration and accessible Leave/Ready/Start controls. Existing handlers and room lifecycle remain authoritative.
- Home previews frame actual visual bounds against the usable panel region at responsive sizes. The PlanetRun miniature now reads as an orbital competition scene. No additional per-card WebGL renderer was introduced.
- Shared150ms menu/results/notification motion preserves synchronous hidden/activity flags and immediate input release. Closing surfaces become inert; rapid reopening restores focus, and reduced motion suppresses menu/progress/press animation. Native exit support is progressively enhanced with immediate-hide fallback.
- Persistent contextual keyboard/mouse/wheel bindings drive actual input and HUD prompts across families. Conflict, unbind/reset, context and refresh behavior have focused and real-input coverage. Fixed Escape remains available for native UI escape.

## PlanetGun submodes

### Deathmatch

Patrol and visible-pursuit routes retain collision-backed connectors rather than cutting blocked corners. Stalled routes recover. Canonical weapon models, modules and finishes are shared by first person, remote pilots and previews. The progressive low-HP border strengthens toward critical health while preserving a clear aiming center. Recoil presentation uses bounded mechanical take-up and muzzle rise without changing authoritative aim, spread or weapon damage.

### PlanetStrike

Starting side is an authoritative lobby preference with balanced capacity, bot-fill, reconnect and halftime handling. The armory separates inspection from a confirmed purchase and uses real credits/loadout restrictions. Bots retain plant/defuse holds and physically traverse sites. Ordinary autonomous12-player tests require a real plant, not only elimination wins.

### PlanetWatch

Hero selection confirms an authoritative draft and approved equipment. Supported/reachable role goals replace offsets that placed several heroes in stairs. Existing hero identities, abilities, ultimate and control rules are retained. Ordinary full-roster tests cover every hero on each side and capture/contest/round resolution.

### PlanetSiege

Operators retain approved loadouts, meaningful gadgets, physical lean and room-local collision/intel. Defense uses distinct core, crossfire/door and patrol posts; two retakers respond to public capture without reading hidden enemies. Attacker utility is placed toward useful visible threats/routes instead of being wasted at spawn. Safe cover does not block friendly approach corridors.

At the user's explicit request, elimination and15-second capture both remain valid win rules. The contested6v6 test requires real preparation, a physical breach, living attacker objective entry and a valid round resolution. A separate fixed-step server playthrough and two-client normal mouse/WASD browser playthrough require the entire timed capture with both teams alive. Both separate capture checks passed before the final broad rerun.

### PlanetZombies

The survival loop uses three accepted hits to down by default, five with the vitality upgrade, hit grace/recovery, co-op revives and a limited solo recovery. Finite waves retain the32-active-enemy cap and distinct drifter/skitter/bulwark identities. Escort slots are supported and separated so teammates do not obscure the same console.

The authored station includes collision-backed wall buys, tonic dispensers, power, timed/exclusive Arsenal reveal and claim, and a timed Overcharge Forge with exactly-once completion. The inserted primary cannot fire or be replaced while processing; the sidearm remains usable. Front-console sightlines and spawn/door clearances were checked, including relocating a rack that intersected a survivor spawn.

Three real barricade entries have nine independent30HPboards and fixed posts. Infected windups physically breach boards before entering; held1500ms repairs reject occupied volumes and cancel on invalid movement/damage. Normal-input browser evidence demonstrates board30→0→30 and topology changes. Survival evidence covers ordinary combat/down/revive, purchase, power, Forge processing and Arsenal reservation/claim.

## Nova Block, weapons and cosmetic content

Perimeter rail bodies/caps now partition their original collision envelope instead of overlapping coplanar faces. Actual close/grazing images were reviewed. Plant crowns and maintenance/intake/frontage details improve identity without changing gameplay geometry. Cream/coral Habitat, green/teal Hydro, steel/brass Ion and warm/navy Transit now use existing surfaces rather than extra clutter. Twelve overhead branch supports attach lateral whorls while retaining canopy transforms and draw-batch limits.

Ten weapon actions retain their muzzle, grip, optic and reload transforms while using shaped receivers, differentiated rear assemblies, seated optics and shaped sleeves. Fresh hip/ADS/recoil/reload/sprint checks cover all ten; the final Pulse/Nova/Photon/Prism refinement batch passed. Live Kit previews now forward the equipped finish and passed all60weapon/finish combinations, including thumbnail generation and restoration.

The catalog has52items, including33additions and47purchasable entries across eight categories: six weapon finishes, three suits, three trails, three planet variants, three emotes, three victories, six calling cards and six emblems. Shared canonical preview art avoids one renderer per card. Calling cards/emblems appear in profile/roster/scoreboard/results surfaces; compatible suits and planet appearances use the original astronaut/planet geometry and gameplay contracts. Dropped weapon snapshots retain the owner's finish at drop time.

The Planet Pass now has50tiers across five readable chapters. The first10reward IDs, amounts and XP thresholds are preserved. Later level costs are125/150/175/200; tier50requires7400totalXP, which remains uncapped. Canonical reconciliation repairs earned entitlements without repaying an existing reward ID, merges concurrent room deltas and preserves persistence. Buying is global catalog ownership; equipping remains owned and family-compatible. Local persistence tests do not prove the hosted service's database configuration.

## PlanetRun

The dive blends the canonical root and skeleton into a forward aerodynamic pose; the original13m/s,350ms and1050ms movement values remain. Target filtering reduces correction/impact jitter. Orbit interpolation preserves camera radius instead of cutting through the astronaut on a quick180° turn. Large deck drops remain visible rather than leaving the camera above the old floor.

Shatterdeck has693tiles,30buffered spawns and physical deck heights26/18.5/11/3.5 with killY−6.5. Navigation/review/art derive from the actual layout; bot descent windows use real spacing and jump reach. Full tournaments and unchanged tick budgets are covered. Actual-input dive captures cover three angles; a separate live drop records a grounded lower-deck landing followed by results and clean exit.

Catalog trails use bounded8-segment instanced identities, including braided plasma, solar petals and void wake. Distant/idle pilots avoid unnecessary uploads.

## Performance and verification

Canonical remote-weapon batching reduced a focused11-armed-pilot fixture from523draws to66, with approximately1.45–1.91MiB buffers under the unchanged8MiB limit. This is a controlled rendering fixture, not a whole-game FPS claim.

A repeated complete unit run exposed ordinary Zombies p9516.0566ms against the unchanged16ms limit. CPU profiling identified repeated corridor searches and full collision-snapshot cloning. Bots now avoid rack route queries when combat/funds/equipment make a purchase impossible, retaining ammo-first and nearest-reachable choices. Board lookups copy only requested detached panels and immediately reflect health changes. A67-panel fixture reduced copied panel objects8160→120for120lookups. Separate ordinary60s profiles measured average4.06→3.25ms and p958.39→7.71ms with identical144shots/902snapshots; random identities and different execution times mean these are not deterministic paired full-match benchmarks.

The final hardware-labelled normal-match matrix covers all five submodes × Low/Medium/High/Auto, overhead/interior/crowd views and a same-camera batching-off comparison. Separate synthetic component stress covers active signature art and32infected. Synthetic Auto is explicitly fixed Medium; normal-match Auto uses the real system. Synthetic rendering is never presented as gameplay or late-wave survival acceptance. Raw samples record the actual GPU/renderer, frame intervals, calls, triangles, instances, material count and practical memory metrics.

The full run passed typecheck, production build, 2,644 unit and system tests across 451 files, and all 152 Playwright cases. Ordinary Zombies measured 15.79 ms p95 against its 16 ms budget. The 20 ordinary rendering cases produced 80 samples on an RTX 3060 with p95 frame intervals of 16.8–16.9 ms. The production build reported its existing large-chunk warning. [Rendering measurements](client-render-summary-release-nov10.md) · [Reviewed gameplay captures](reviewed-nov10/README.md)

The subsequent live Shop review exposed an edge-on Void Wake ribbon. Both crossed planes now carry the dark body and violet edge in the shared trail renderer. The corrected trail was visible in the live Shop. Typecheck, production build, 16 targeted unit tests and all six Shop and Pass browser cases passed after that change.

The live in-app browser review covered room entry, movement and jump, pause, station proximity feedback, clean match exit and cosmetic previews. The in-app browser did not acquire gameplay pointer lock during this check. The separate Chromium suite acquired and released pointer lock and covered delayed capture and unexpected loss. Hosted rollout and subjective audio and feel remain outside the local validation evidence.
