# Human feedback recovery, October 26–28, 2026

Work continues from **16db708fa2d51b0193d15c959bbd95951a13dbf8** on DESKTOP-JL99F36. The initial tracked tree was clean; existing untracked recordings and evidence were preserved. Full initial status is saved locally in `initial-status*.txt`. No reset, restore, stash, pull or rebase was used. Audio is accepted for this pass and **has not been changed**.

This requested feedback pass is complete. Final automated validation, native playthrough findings and measurements follow.

## UI foundation and lobbies

Restored the common navy/indigo, cyan, white and yellow-to-orange Planetfall foundation. PR/PG selected cards no longer use mint fills. All four rooms use a centered main card with room identity, hub navigation, configuration, roster, ready/start, back and status. PR/PG promotional side panels and the PR lobby's six-motif animation were removed. Room protocols and membership behavior remain intact.

Shared compact roster rows display names and separate YOU, HOST, BOT, team and readiness badges. Classic retains separate accessible Session Crowns and Session Level badges, connection/badge details and host removal controls. The full raid/rematch audit caught and led to repair of the missing progress badge title. PG's lobby shows its selected kit with real equipment/module names and a separate editor action. Stale desktop grid-row positioning was removed from that action; the selector/Edit row and Ready/Start/Back/status now fit at 720p. The browser check requires each lobby's Back button to be fully in the viewport.

The PG HUD uses native layout sizes: desktop score numbers 38px, HP 42px and magazine 56px; vitals are 232px wide. Health/Ion tracks and ammo state have stronger hierarchy. Narrow layouts remain separate; the reticle is not scaled with the HUD.

## Visual Combat Kits

The existing five-slot store, ID-only server validation, compatible category limits, actual stat profiles, persistence and next-spawn application remain. The editor now contains a live canonical 3D weapon, five class cards with cached weapon thumbnails, category sockets, secondary equipment and accurate numerical deltas. Module choices replace hardware in the same category and immediately alter the preview and held first-person weapon.

One lazy preview renderer serves the live weapon and cached thumbnails. Drag/keyboard rotation, zoom, reset and reduced-motion demand rendering are supported. Models, buffers, materials, listeners and observers have ownership/disposal checks. Desktop layout keeps the weapon and footer visible at 720p, with independent kit/stat scrolling. Camera framing fits the current rotation's visible mesh bounds rather than reserving a long barrel's entire length vertically.

## PlanetRun

The home preview is one authored solar-sweeper hero diorama with a grounded pilot action, restrained motion and orbital context. Reduced motion freezes the scene. A single strong composition replaces six weak rotating miniatures.

Capacitor Causeway now has two banks of three lane shutters, three timed capacitor arcs, a substantial optional launch coil and landing apron, two laterally moving energy barriers, and a final shutter/arc/boost sequence. Each shutter bank always leaves a broad safe lane. Arcs warn before discharge and use bounded recoverable impulses. The normal route remains continuous; launch routes trade speed for timing and landing risk. Player collision, bots and art share deterministic timing and moving centers.

Launch feedback recognizes both new 700ms carries and legacy pads while keeping normal dives and hazard staggers distinct. The camera now tests hidden hazard proxies against shared active state: open shutters and warning-only arcs cannot obstruct it; closed shutters/discharges still do. Bot targets account for open lanes, projected arc timing, moving barriers, crowd occupancy and continuous personality offsets. Boost preference varies by difficulty and risk personality. Focused ordinary-physics crowd checks cover 10/20/30 pilots at four seeds. No bots receive forced movement or qualification.

## PlanetGun movement and teammates

Development telemetry records input-to-simulation latency, snapshot age, RTT, pending inputs, correction distances/frequency, vertical and mode corrections, camera displacement and movement modes.

Native baseline: approximately 0.9ms measured RTT; 5–13ms input-to-simulation samples; snapshot-age p95 about 5.8ms; maximum observed correction 8cm. Median renderer CPU was about 3.1ms in this four-pilot sample. These are LAN/native observations, not hosted or low-end hardware guarantees.

The browser WebSocket delay probe also exposed multi-second queue/stall ages under its software-rendering/proxy workload. Those recordings are retained as stressed diagnostics and must not be described as clean literal 0/40/80/120ms measurements.

Prediction now anchors replay times after the authoritative snapshot and preserves that horizon for the next local step. Timed mantle/wall-run movement no longer steps backward because of an old RAF timestamp or one-way snapshot offset. Local simulation still corrects immediately. A separate camera offset decays over roughly 105ms for 95% recovery; errors of 0.75m or vertical errors over 0.4m snap. Respawns and stale queues reset it. Mouse look and newly predicted motion are not interpolated or delayed.

Twenty-eight deterministic delay/jitter scenarios cover walk, sprint, slide, jump, thrust, wall run and mantle at 0/40/80/120ms RTT, plus a backward-time regression. Existing movement rules and colliders are unchanged.

Living friendly pilots receive at most five pooled canvas-textured labels. Enemies, local/dead pilots, offscreen targets, reticle-overlapping labels and fully occluded names are hidden. Names fade from 15–30m and disappear at 30m. Occlusion uses authoritative opaque solids, checked at 10Hz; sprites also depth-test. Leave/death/respawn lifecycle coverage prevents stale labels.

## Weapons and Nova Block

All ten weapons gain individually chosen 12–18% model presence, additional structural/material detail and real module hardware. Rail ADS is framed farther forward to retain both sleeves and its clear optic. Sight, hand and muzzle invariants remain tested. Firing uses distinct bounded pooled emitter signatures, immediate predicted local muzzle response, acknowledgement deduplication and current muzzle position/orientation. No per-shot geometry/material allocation or new dynamic lights.

Nova keeps authoritative massing, collision, spawns and movement routes. Authored facade skins replace duplicate generic facade decoration on selected existing walls. Cool ivory/navy structural materials, cyan/amber/violet lighting, ceiling treatments, drainage/access details, planter crops and shaded orbital hull/planet context improve its visual shell. New art stays within existing clearance and quality budgets.

## Native review findings

- Inspected the live gunsmith at 1280×720. The weapon, sockets and save actions remain visible. Module selection, keyboard rotation and zoom changed the real preview.
- Recorded all ten weapons with native sprint, fire, ADS, reload and switch actions. Reviewed hip/ADS/reload contact sheets and a frame strip of the Pulse firing sequence. Arm placement leaves the center clear; scoped sights remain centered. Raw 15-second WebM files remain local.
- Friendly name visible above a living ally at roughly 10m; hidden when the ally's head is behind opaque cover. Native inspection caught the label-anchor LOS error; head-level LOS and a dedicated regression test now cover it.
- Captured Nova Solar/Void, center, Hydro, Ion, two interiors, upper and wall-run compositions. The first Solar capture in a stationary-client fixture was obscured by a colocated ally, so that image is excluded from visual acceptance.
- Verified native walk, sprint, slide, jump, held thrust and wall run. The browser mantle route uses ordinary simultaneous forward/jump input and lands on the collision-backed 1.5m plinth.
- The final open/next overhead lane markers clear the normal following camera; a fresh October 28 native capture verifies the foreground bar is gone without changing the lane footprint or collision.
- Recorded Capacitor Causeway with 10, 20 and 30 pilots. A normal-client player route crossed the first shutters/arcs/boost, then both moving barriers and the final shutter/arc sequence, reaching **qualified** at 75.3 seconds. A fresh rendered replay after the camera integration fix qualified again at 36.6 seconds. Nine ordinary idle clients kept the review open; no position, velocity, timer, collision or qualification state was injected. Failed edge/routing attempts and checkpoint respawns were retained in the raw record.

## Validation status

- Expanded focused stage: **334 tests across 60 files passed**.
- All four centered lobby flows and cursor checks: passed in the focused browser run.
- Combat Kit persistence, server equipment and queued edits: passed in the focused browser run.
- Final focused browser rerun: **3/3 passed**, including kit persistence, one-context visual editing and live rejoin followed by a real-input mantle onto the center plinth. The new editor test initially omitted a required pilot name; the new mantle test initially used a key inconsistent with the Solar spawn orientation. Those test setup errors were corrected without relaxing an assertion or timeout.
- Additional current focused movement, emitter, preview and lifecycle checks pass; final counts belong to the final suite.
- Final typecheck: **passed**.
- Final production build: **passed**, with the existing large-chunk advisory.
- Final full unit/system run: **1,766 tests across 338 files passed** (361.65 seconds). Includes unchanged BR 10/20/40-player performance cases and PG 4/8/12-player movement/combat performance budgets.
- Traced repair verification: **2/2 passed** — the complete Classic raid/rematch audit and PlanetRun 30-player course/winner-stage audit. The former required restoring accessible progress metadata; the latter had one obsolete assertion for the explicitly removed lobby showcase. No gameplay assertion, timeout or budget was relaxed.
- Fresh final full serial E2E: **47/47 passed in one clean serial run** (29.9 minutes). Includes the repaired raid/rematch and 30-player/winner-stage scenarios, all preset/round render checks, two-client scoped combat, the full collision-backed neighborhood route and live rejoin/mantle.
- Native input playthroughs, rendered review, screenshots and client performance/correction measurements: completed as detailed below.

Raw earlier attempts remain local. No performance limit, unrelated timeout, gameplay assertion, clearance requirement or room condition has been relaxed. The user authorized delivery as a main-branch Git checkpoint after validation. No deployment command was run.

## Final native client measurements

RTX 3060, 1280×720 native Chromium compositor, 12 normal simulated participants (easy bots), four fixed cameras: Solar, center plaza, west interior and Hydro wall-run lane. Each sample follows a 4.8-second settling window. These fixed review cameras measure rendering; they do not count as player traversal. Native input routes are recorded separately. Dynamic bot positions differ between samples, and these measurements do not establish low-end or hosted hardware performance.

| Requested | Resolved | Frame median / p95 | CPU median range | Draw calls | Triangles | Visible instances | Materials |
|---|---|---|---|---|---|---|---|
| High | High | 16.7 / 16.8ms | 2.6–2.8ms | 143–171 | 79,126–84,348 | 3,787–3,913 | 83–92 |
| Medium | Medium | 16.7 / 16.8ms | 2.7–3.1ms | 120–155 | 71,026–78,354 | 3,775–3,833 | 72–84 |
| Low | Low | 16.7 / 16.8ms | 2.7–3.2ms | 107–134 | 60,102–66,750 | 3,095–3,180 | 72–78 |
| Auto | Medium | 16.7 / 16.8ms | 2.3–2.5ms | 113–156 | 68,770–77,050 | 3,736–3,818 | 74–81 |

All four presets remained near the 60Hz display limit. Low reduces geometry/instances and draw submission versus High; a higher capped FPS is not claimed. The initial four-pilot native input baseline had 5–13ms input-to-simulation latency and up to 8cm instantaneous camera correction. The later native movement records have input p95 about 13–14ms and typically near-zero presentation jumps at snapshot correction, with a retained 13.7cm ceiling/stale-queue sample. Newly predicted motion and mouse orientation remain immediate. The strict deterministic RTT/jitter scenarios isolate timing behavior from renderer stalls; the software WebSocket-proxy records are separately labeled saturated when appropriate.

The older October 25 client records are retained locally as historical context, not used to claim a controlled before/after FPS improvement in this feedback pass.

## Selected review evidence

- [All four final lobby layouts](review/lobbies.jpg)
- [Visual Combat Kits](review/gunsmith.png) and [installed module / rotated preview](review/module-preview.png)
- [PlanetRun home hero](review/planet-run-home.png) and canonical winner stage at [desktop](review/planetrun-winner-desktop.png) / [laptop](review/planetrun-winner-laptop.png)
- [Living friendly name](review/friendly-visible.png) and [same ally occluded](review/friendly-occluded.png)
- [Nova Solar](review/nova-solar.png), [center](review/nova-center.png), [interior](review/nova-interior.png), [Hydro](review/nova-hydro.png)
- [Open Causeway lane and clear camera](review/causeway-open-lane.png), [qualified route](review/causeway-qualified.png)
- [All ten ADS presentations](review/weapons-ads.jpg)

Detailed native rendering samples are in `client-performance-summary.json`; deterministic motion samples are in `movement-simulation/simulation-network.json`. Large raw recordings, idle-client helpers, dependency runtimes and interrupted-run logs remain local.

## Server performance

The full suite retains all original tick/network limits. Battle Royale 10/20/40-player cases and two additional 40-player identity cases pass. PlanetGun hard-bot 4/8/12-player simulations move, fire, eliminate and respawn within their original budgets. Current PG measurements are recorded with the BR budget summary in `server-performance-summary.json`.
