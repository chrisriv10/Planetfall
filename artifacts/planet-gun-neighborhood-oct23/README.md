# Nova Block neighborhood quality pass — October 23–24, 2026

Starting HEAD: `2dadb898adca21f110e8390a74af925c50f850ec` (`main`). The tracked working tree was clean. Existing local evidence was preserved. Work ran on `DESKTOP-JL99F36`; no reset, restore, stash or checkout replacement was used.

This pass responds to the map-specific follow-up after the first-person weapon/HUD checkpoint. The level now has collision-backed massing and elevation as well as new presentation. The FPS weapon balance, movement constants, hit registration and mode isolation remain unchanged.

## Layout and architecture

- Nova Habitat adds a setback upper observation suite, a real front doorway, a supported entry canopy and a furnished ground lounge. Its upper room uses the original gallery/stairs.
- Ion Service adds a narrower engineering wing, actual nine-step upper access, an open control room and an asymmetric ventilation tower. The lower west bulkhead remains a continuous authored wall-run surface. Its shutter, diagnostics and circular maintenance hatch differ in form.
- A raised 1.2m garden terrace has four real steps, planted islands and four substantial trees around the neighborhood. Trunks block movement and shots; foliage is deliberately permeable.
- The former ticket-bank slab is a planted retaining island with the same broad cover footprint. Center Relay grows from the real transit equipment foundation, with an overhead canopy, structural core and open holographic marker.
- Connected streets have a main spine, Habitat and engineering branches, crossings and a bypass around the transit pier. Paving is clipped around physical obstacles. Sidewalk bands and inlays remain flush; they do not pretend to be raised collision curbs.
- The orbital setting uses a procedural planet with continents, clouds and atmospheric limb, a habitation wheel, docking/service structures, freighters and bounded stars. It uses four materials and 4/5/6 draws on Low/Medium/High.

## Geometry and integration checks

New solids and traversal navigation are shared by authority, prediction, combat and rendering. Tests walk the garden and Ion stairs without jumping, verify full standing headroom, preserve spawn and entrance clearances, preserve the southern scoped firing corridor, and verify trunk collision. Existing stair, mantle, wall-run and server-performance assertions remain in place.

The first integration review caught a gallery slab over the new stair flight; its footprint was shortened to form an actual stair opening. The first screenshots also caught an Ion sign spanning the new doorway and duplicate soil/top overlays. The sign moved to a real roof header; replaced planter dressing was removed. Run-face detail remains under the unchanged 4cm clearance limit, measured on transformed rendered bounds.

The new real-input E2E scenario uses two actual clients with a passive observer, ordinary keys and live read-only diagnostics. It does not teleport the player, inject motion or alter collision. Focused simulation performance checks retain the original 4/8/12-player limits.

Live crouched climbing found a genuine solver defect that standing stair tests missed: horizontal risers used a wider footprint than vertical tread support. At slow speed a step-up was immediately undone by support from the previous tread. Stair support now uses the same footprint as its riser contact; ordinary ledge support is unchanged. Regression coverage climbs all four stair flights crouched and sideways, and checks the observatory's upper landing connection.

The route driver was also corrected to take a running approach to the lower Ion wall and to follow the observatory landing around its stair opening. Those are input/path corrections, not changes to movement speed, wall-run conditions, arrival assertions or prior deadlines. The new route retains a 240-second deadline and checks actual height as well as position, health and gameplay ownership.

Final navigation review found that the old bot link from the Habitat's last stair cut diagonally through the new suite wall. Its observatory counterpart also cut across the stair opening. Both links now follow supported landing waypoints before entering their upper room. The new shared regression failed against the diagonal Habitat link, then passed while walking the corrected graph. Separate tests exercise the actual bot input controller from both galleries and three nearby starting offsets; bots reach their room without dropping off the landing. No movement geometry, steering rule or arrival tolerance was relaxed.

The final native garden review caught coplanar retaining-cap and planter-rim faces. Trim now projects only 12mm beyond the supporting body faces and 30mm above them; soil and rim tops are separated. Rendered-bound tests preserve the 4cm limit, prevent overlapping trim corners and verify separation. The planet's first vertex bake visibly exposed triangles in cloud shapes; its final geography uses one filtered 512×256 texture baked once, with explicit texture disposal.

The comparison review also caught the Habitat nameplate facing the wrong way. It now faces the positive-Z street frontage; an orientation/backing test prevents the mirrored lettering seen in the intermediate capture. The final native gallery was recaptured after this correction.

### Render-stall firing recovery

The broad browser run exposed rejected semi-automatic triggers in the Photon pose case and Comet sprint-exit case. A focused real-input reproduction stalled one animation callback for 350ms: the client sent a 355ms-old shot timestamp, authority correctly rejected it under the unchanged 200ms rewind limit, and the local trigger was already consumed. See [before](after/fire-hitch-before.json).

Firing readiness, local firing cadence and request timestamps now use the live processing clock, independently of the fixed-step movement clock. Press expiry also uses that live clock. A second deterministic reproduction delayed actual gameplay snapshots by 300ms: the snapshot-derived clock still aged a fresh trigger, leaving ammo at seven and shots at zero ([before](after/delayed-snapshot-clock-before.json)).

A read-only clock acknowledgment now provides midpoint timing samples from home/lobby onward. One sampler per socket retains its lowest-latency sample, rejects callbacks delayed more than 100ms, probes only three times on connection and once per 30 seconds thereafter, and resets on disconnect. It does not assume synchronized client wall clocks. Delayed match snapshots no longer set the firing clock; movement prediction retains its existing clock.

Both controlled cases then accepted exactly one Photon round with ammo at six, including while the trigger stayed held. The final full run recorded about 3ms from request timestamp to actual server acceptance for the 350ms stall, and 12ms with delayed snapshots. Evidence: [stall after](after/fire-hitch-after.json), [snapshot-delay after](after/delayed-snapshot-clock-after.json). Acceptance time comes from the authoritative gun cooldown, because delivery of a DevTools WebSocket notification can itself lag. No shot/state injection, server-window increase, cadence change or authority bypass is used. Deliberately stalled frames are excluded from rendering performance measurements.

## Visual review and performance

The before evidence is the previous pushed checkpoint, including its Rail ADS composition and native 12-player measurements. Review-camera anchors change where the layout changes, and bots remain active, so draw counters are descriptive rather than a strict same-transform speedup claim.

Native measurements used the RTX 3060/D3D11 renderer at 1280×720 with 12 participants. Each composition settled for at least 3.4 seconds before collecting 180 frame times; no test/build workload ran alongside these measurements. Scenes: Solar exterior, Center Relay, Habitat interior, Ion exterior/combat and player-controlled Rail ADS. Raw data: [before](before/client-render-samples.json), [after](after/client-render-samples.json). Auto resolved to Medium; both the requested and resolved presets are recorded.

| Preset | Before median FPS | After median FPS / p95 frame time | Before → after draw range | Before → after triangle range | After visible instances | After materials |
| --- | --- | --- | --- | --- | --- | --- |
| High | 59.9 | 59.9 / 16.8ms | 191–449 → 139–478 | 79,526–96,184 → 69,008–91,462 | 4,101–4,109 | 101–122 |
| Medium | 59.9 | 59.9 / 16.8ms | 169–365 → 84–320 | 75,972–89,258 → 62,000–79,866 | 4,089–4,105 | 77–98 |
| Low | 59.9 | 59.9 / 16.8ms | 156–363 → 72–327 | 64,532–81,594 → 52,964–71,474 | 3,394–3,402 | 85–97 |
| Auto (Medium) | 59.9 | 59.9 / 16.8ms | 138–428 → 81–398 | 74,034–92,606 → 62,000–84,398 | 4,097–4,109 | 83–111 |

All samples are refresh-limited on this PC; these results demonstrate preserved native frame pacing, not an uncapped FPS speedup or acceptance on every hardware tier. Low remains substantially lighter in triangles/instances. Static neighborhood architecture shares geometry/material batches; distant orbital context costs only 4/5/6 draws. No extra dynamic fixture lights, downloaded assets or dependencies were added.

The default Playwright headless-shell renderer ran much slower during route-driver investigation (~117–300ms frames). The new route and controlled clock fixtures use full Chromium's compositor (~16.7ms in the focused route run). The opposing-client scoped-hit scenario now lives in its own full-Chromium spec, retaining its arrival, line-of-sight, FOV and damage assertions. Four existing software-renderer quality reviews and all five weapon pose scenarios retain their original renderer. This is a browser/rendering-path distinction, not an optimization result.

### Screenshot review

The final native gallery is under `after/native-high-*.png`. These are actual rendered views of a live match. The overhead/oblique views show connected streets, asymmetric roof massing and the garden terrace; ground views show the smooth wall-run strips, clear doors, distinct service cassettes and tree scale. The orbital view shows separate arena, station and planet layers. The planet remains stylized and the arena remains a compact engineered platform; it is not an open-world terrain conversion.

| Required composition | Evidence |
| --- | --- |
| Matched Rail ADS / hipfire | [ADS](after/rail-held-ads.png), [hipfire](after/rail-matched-hip.png), [registered combat](after/opposing-client-combat.png) |
| Center plaza | [Center Relay](after/native-high-center.png) |
| Habitat lane | [Garden approach](after/native-high-left.png) |
| Ion Service lane | [Service frontage](after/native-high-right.png) |
| Habitat interior | [Ground lobby](after/native-high-westInterior.png), [upper suite](after/native-high-habitatSuite.png) |
| Ion interior | [Upper control room](after/native-high-serviceInterior.png) |
| Wall-run route | [Hydro strip](after/native-high-wallRun.png), actual-key route captures |
| Elevated movement | [Crossover](after/native-high-upper.png), actual upper-room route captures |
| Solar / Void spawns | [Solar](after/native-high-solar.png), [Void](after/native-high-void.png) |
| Overhead / high oblique | [Overhead](after/native-high-overhead.png), [Oblique](after/native-high-oblique.png) |
| Orbital backdrop | [Orbital setting](after/native-high-orbit.png) |

Static review exposed and corrected geometry/presentation problems; ordinary mouse/keyboard play exercised movement, combat, damage/respawn and clean exit. Automated two-client input covers the full authored loop with read-only diagnostics. Neither screenshots nor automated play are represented as human multiplayer acceptance.

## Validation

The full-suite run produced the following unchanged active-simulation checks (1,800 updates each):

| Pilots | Average update | p95 update | Maximum snapshot | Shots / kills |
| --- | --- | --- | --- | --- |
| 4 | 0.392ms | 0.775ms | 6,240 bytes | 118 / 17 |
| 8 | 0.677ms | 1.140ms | 11,152 bytes | 282 / 44 |
| 12 | 1.178ms | 2.137ms | 16,165 bytes | 426 / 57 |

Original limits remain average <8ms, p95 <16ms and snapshot <40,000 bytes, plus movement, shots and kills assertions. These server results are separate from client rendering measurements above.

- `npm run typecheck`: passed.
- `npm run build`: passed; the existing large bundle-size warning remains.
- `npm test`: 1,473 tests passed across 287 files, including clock estimator/reconnect coverage and a real socket clock acknowledgment test.
- After the final sign-orientation correction, all 28 focused map/presentation tests passed again.
- `npm run test:e2e -- --workers=1`: all 38 cases passed in 23.8 minutes. This includes all five weapon pose cases, four arena quality reviews, both timing regressions, the complete neighborhood route, the opposing-client scoped hit and existing Classic/BR/PlanetRun compatibility checks. [Full log](validation/e2e.txt).
- `npm run test:e2e -- --config playwright.production.config.js --workers=1`: passed (39 seconds). The built game remains playable with review UI and diagnostic outputs absent. [Production log](validation/production.txt).

The final route records all 15 authored checkpoints, including all three wall-run surfaces, Habitat's suite, Ion control, the maintenance interior, the observatory gallery and both spawn-side approaches. Final matched hipfire/ADS captures were reviewed directly after the successful opposing-client hit. Known nonblocking limitations are the stylized orbital treatment, occasional High shadow-map aliasing and the existing bundle-size warning. Rendering samples are from this PC and do not establish performance on every device.

This report covers local validation. No hosted deployment was performed.
