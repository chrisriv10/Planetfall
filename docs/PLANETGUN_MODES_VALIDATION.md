# PlanetGun modes: implementation and validation

Initial HEAD: `d647317bdf5c369481e50627b8ecc633055f40ac` on `main`, running on `DESKTOP-JL99F36`. The tracked tree was clean; 5,805 existing untracked artifact files were preserved. No reset, restore, stash or pull/rebase was used. No deployment is part of this checkpoint.

## Delivered rules and architecture

[PLANETGUN_MODES.md](PLANETGUN_MODES.md) lists the four rule sets, six heroes, twelve operators, controls and storage boundaries. Team Deathmatch remains the default for configurations without a submode. All modes use Nova Block and its existing ten weapons; no weapon or audio asset was added.

Shared catalogs own trusted character/loadout/ability/movement definitions and typed mode actions/snapshots. `pg-room.ts` integrates focused Strike, Watch, Siege and Zombies runtimes. Movement, prediction, replay, bullets, visibility, scouts and navigation share room-local collision. Panel health revisions are separate from topology revisions; ordinary panel damage does not invalidate movement replay. Rewound shots check historical and current blockers.

Strike has temporary credits, bounded utility, supported weapon/charge drops, planting/defusing, one-life rounds, role switches and capped paired overtime. Watch has six functional heroes, all passives/two abilities/ultimates, private recon, barriers, healing/shields, respawn waves and first-to-two Control Relay rounds. Siege has twelve side-specific operators, actual preparation/breaching/reinforcement/repair, bounded gadgets, private sensors/scouts/cameras and capture/contest. Zombies has three typed enemy archetypes, finite wave queues, 32 active enemies, run purchases/access/power/upgrades/perks, crawling/downed/revive/bleedout, solo recovery and defeat/restart.

Objectives use actual ground-floor compounds: Strike A `(-28,0,-9)`, B `(28,0,15)`; Relay rotates center/west/east; Siege uplinks use the compounds. Power is `(-16,0,8)` and upgrades `(-18,0,10)`. Existing west/east/maintenance sockets carry real panels. Authored quarantine infill stages the west court and gallery; supported roof/crossover entries avoid a ground-only spawn deadlock. Routes validate capsule clearance, support, stairs and physical connections, not only graph adjacency.

Humans reserve characters before bots; unique team choices, selected legal primaries, reconnect grace and private action acknowledgements are covered. Mode preferences have separate versioned local-storage keys. Deathmatch kits survive repeated special-mode/Deathmatch cycles, including a newly edited kit between matches. Credits, points and cooldowns stay temporary server state. Rewards require participation, are bounded and settle once. Hidden Siege equipment and identifying maximum/current health are redacted along with hidden character selections. Hidden living enemies export neutral 100/100 health; death remains visible, and trusted/self/team/revealed health is unchanged.

## Problems reproduced and corrected during integration

- A defused charge retained stale site/deadline presentation; round resolution now clears it.
- Generated weapon drops lacked models; a bounded instanced pool now uses the canonical weapon geometry and supported anchors, with authoritative ammunition-conserving pickup.
- Repeated HP-only panel changes rebuilt collision and discarded prediction; topology revisions now change only with physical obstacles.
- Zombie navigation oscillated around a previous waypoint, and friendly survivors hopped against invalid stairs. Physically checked forward steering now reaches real openings, power, upgrades and downed teammates. Flat-floor capsule sweeps retain stair/edge fallback and reduce simulation cost.
- Reshaped identity helmets clipped the existing eyes. The original front facets, normals, visor and eyes are retained; identity hardware changes crown/sides/backpack/arms instead.
- Hero selection while firing near spawn could refill ammunition. Recent firing now prevents the swap.
- Client ADS/recoil now consumes the same authoritative character modifiers. Life changes clear held input. Captured menus reject controller interactions as well as keyboard/mouse gameplay.
- Keyboard ownership distinguishes cancelling Space's browser scroll from consuming gameplay input. The default-mode jump test exposed this regression; the correction retains the existing physics and assertions. Startup clock samples rejected during rendering stalls now retry lightly until calibration, retaining the original RTT acceptance, firing and rewind limits.
- Saved-kit restoration could reuse an older match's kit, and enemy reserved kits exposed hidden Siege choices. Both lifecycle/privacy projections were corrected with regressions.
- Solace healing now shows a pooled torso-height link between current caster/recipient endpoints; other healing fields retain their own presentation.
- Quick E taps now dispatch the initial interaction on keydown; keyup cancels held interactions. Pickups no longer depend on a 200 ms held-key sampling window. Plant, defuse, power and revive still require uninterrupted server-validated holds.
- Objective markers retain ground rings and overhead labels without solid posts through the capture position. Siege shows the common F action, remaining charges and reinforcements; consuming a common breach updates its public remaining count.
- Hidden Siege operator health could identify a reserved character before reveal. Public/enemy projections now use neutral living health and maximum health, preserving real health on the server and for eligible viewers. Wounded/dead and visibility regressions cover both room and snapshot payloads.
- Final screenshot review exposed an attacker being offered defuse on their own planted charge. Client targeting now respects side/phase and stops completed hold refreshes while result snapshots arrive. Strike cancellation is idempotent across phase changes/death. Focused regressions and the stronger real plant/defuse browser case passed without false completion toasts; the complete 1,954-test and 62-case suites passed afterward.
- Development character inspection isolates the selected snapshot-driven rig so tightly packed spawn neighbours cannot obscure it. Performance sampling restores the normal player view and verifies all eleven remote rigs are active first.

## Automated gameplay evidence

Evidence is local under `artifacts/pg-modes-oct28/` and the current Playwright output. Large recordings remain local rather than being added wholesale to Git.

- Ordinary four-pilot competitive bot matches reach full results without forced damage, positions, resources or deadlines. Separate full-roster scenarios require a Strike plant, Watch capture/contest/round win, Siege preparation/breach/capture, and friendly survivors clearing three waves.
- Two browser clients walk to A, plant through held input, defuse through held input and award the defenders a round. The next round exercises paid equipment, supported drop/recovery and ammunition conservation. The same flow checks that a controller interaction cannot pick up equipment behind the B menu.
- Browser ability cases exercise a real Cairn collision barrier, enemy damage to it, expiry and Brace Pulse; Siege drives preparation, delayed breach, ordinary walking through the opening and uninterrupted uplink capture while the opponent remains alive.
- The final complete-suite co-op case passed. The squad restores power; the controlled survivor takes real infected damage, receives a teammate revive, purchases Pulse, upgrades it and reaches wave 5, recording 674.0 weapon damage. The driver uses normal walking around friendly bullet blockers and follows physically supported routes. Positive player damage is asserted; the original 280-second loop/360-second test bound is intact. Compact outcome: `co-op-gameplay-final.json`; full video/JSON/screenshots: `verified-suite-final-evidence/`.
- Four real WebSocket-loopback browser tests add 0/40/80/120 ms RTT and modest bounded jitter, checking immediate local movement, bounded pending inputs and camera correction. These emulate latency, not a remote WAN or packet loss.
- All six heroes and twelve operators are inspected as actual snapshot-driven in-world rigs, with separate full-roster quality samples. Those rendering samples use two browser players plus ten idle Socket.IO players: the observed browser renders eleven remote rigs in normal player view. This measures full-roster presentation, not twelve rendered clients or simultaneous ability spam. The development review camera does not alter authoritative actors. A separate clearly labeled synthetic 32-enemy fixture measures rendering resources; it does not establish survival to wave 25.

## Final validation status

`npm run typecheck` and `npm run build` passed after the final screenshot-driven interaction fix. `npm test` passed: **1,954 tests in 361 files**, 459.20 seconds (`tests-verified-final.txt`). This includes unchanged BR 10/20/40-player performance, existing PlanetGun 4/8/12 budgets, all four new modes, ordinary full-series bot matches, persistence and other families.

The complete browser suite passed afterward: **62/62 cases**, 38.3m, exit code zero (`e2e-verified-final.txt`). All fifteen new-mode cases and the existing family, weapon, arena, course, traversal, scope and lifecycle checks ran. No old assertions, budgets or timeouts were relaxed. Actual screenshots of all eighteen characters were reviewed. Final raw video, screenshots and JSON remain local in `artifacts/pg-modes-oct28/verified-suite-final-evidence/`; the parent README indexes compact evidence included in Git.

The first complete attempt passed 61 cases and exposed a co-op driver route failure. The driver now steps away from legal rounded cover corners through normal input and follows physically validated survivor paths rather than unchecked graph links. A later screenshot review caught an attacker being offered defuse on their own charge. Side/phase targeting, completed-hold refresh and idempotent cancellation were corrected; the browser case now explicitly rejects false completion toasts. The complete checks above passed after those corrections. Earlier failure evidence is retained locally.

Earlier failures are retained in local logs. Space input was genuinely lost and corrected. One SwiftShader sprint-tap attempt timed out, then passed a diagnostic rerun without changing its assertions; calibration retries are not claimed as proof of its cause. A later complete-run attempt stopped on the existing BR grounded-jump case after tactical-map closure. The driver now resumes mouse-look via an actual canvas gesture and asserts that no button retains focus before the unchanged jump check; failure diagnostics retain player/input/focus/renderer state. Its focused case and three repeated runs passed. Button focus alone is not established as the original cause, and no BR gameplay code was changed. The Classic raid fixture could correctly offer SHOVE when its defender remained aligned beside the repair station. The fixture now walks that defender to their cannon and asserts actual separation before the unchanged sabotage checks; its focused run passed in 3.1 minutes. Gameplay priority and old timeouts/ranges remain unchanged.

The first post-input full unit run exposed an uncontrolled latency-fixture death: its pilot was killed by combat bots before acknowledging 550 inputs. The delivery-only fixture now starts in a real authored protected spawn and uses normal walking inputs around that lane. It adds alive/maximum-distance assertions and retains all existing sequence, displacement and timing assertions. Full-roster combat benchmarks remain unchanged and separate. All nine focused performance cases and the subsequent complete unit suite passed.

Fresh server measurements from the full run (`artifacts/pg-modes-oct28/server-performance-final.json`):

| Scenario | Average / p50 / p95 tick ms | Maximum tick ms | Maximum snapshot bytes |
| --- | --- | ---: | ---: |
| Strike, 12 pilots | 3.386 / 2.680 / 8.990 | 13.146 | 20,255 |
| Watch, 12 pilots | 2.910 / 2.643 / 5.501 | 13.102 | 23,501 |
| Siege, 12 pilots | 2.614 / 2.027 / 7.775 | 16.455 | 24,428 |
| Zombies, four survivors | 2.287 / 1.616 / 3.138 | 93.369 | 11,932 |
| Synthetic 32-active wave-25 director | 0.631 / 0.601 / 0.926 | 1.790 | 9,265 |

Ordinary scenarios simulate 60 seconds with five seconds warmup, using 1/30-second room updates and bounded internal 60 Hz movement steps. The synthetic fixture keeps four stationary survivors invulnerable and queues 114 replacements; it measures real enemy navigation/simulation at the cap, not ordinary late-wave survival. The isolated co-op topology/navigation rebuild spike remains visible in the maximum column. The measured average/p95 meet the unchanged 8/16 ms limits; there is no claim that every tick is below 16 ms.

## Client rendering samples

Final complete-run native rendering cases passed. Samples use normal player view at 960x540 on native RTX 3060. CPU numbers cover the bounded 240-frame window after leaving character inspection.

| Scene / quality | Frame p50 / p95 ms | CPU p50 / p95 / p99 ms | Draw calls | Triangles | Instances / materials |
| --- | --- | --- | ---: | ---: | ---: |
| planetwatch / high | 16.7 / 16.8 | 9.9 / 13.8 / 14.9 | 344 | 93,876 | 3,945 / 218 |
| planetwatch / medium | 16.7 / 16.8 | 8.6 / 12.0 / 13.0 | 323 | 87,340 | 3,928 / 218 |
| planetwatch / low | 16.7 / 16.8 | 8.5 / 10.6 / 12.8 | 312 | 78,352 | 3,307 / 217 |
| planetwatch / auto | 16.7 / 16.8 | 8.6 / 12.7 / 14.8 | 323 | 87,340 | 3,928 / 218 |
| planetsiege / high | 16.7 / 16.8 | 9.5 / 13.8 / 14.7 | 334 | 98,528 | 4,063 / 194 |
| planetsiege / medium | 16.7 / 16.8 | 8.2 / 11.2 / 13.6 | 313 | 91,992 | 4,046 / 194 |
| planetsiege / low | 16.7 / 16.8 | 8.2 / 10.7 / 11.9 | 294 | 79,694 | 3,340 / 193 |
| planetsiege / auto | 16.7 / 16.8 | 8.2 / 12.2 / 13.1 | 305 | 88,682 | 3,961 / 194 |

All samples restore eleven remote rigs first. Siege phase/visibility changes between quality samples can change draw counts; this is not a matched-frame quality A/B. Auto resolves to Medium. Full records include geometry/texture counts and subsystem timings. The separate 32-infected fixture retained 23 geometries and three textures across qualities during its short window; its longest observed frame interval was 100.1 ms. It excludes the full multiplayer/DOM/update workload and is not ordinary wave-25 survival.

| Emulated RTT ms | Pending inputs after settle | Immediate 50 ms displacement m | Camera correction m |
| ---: | ---: | ---: | ---: |
| 0 | 1 | 0.125 | 0.000 |
| 40 | 8 | 0.075 | 0.000 |
| 80 | 10 | 0.075 | 0.000 |
| 120 | 10 | 0.125 | 0.000 |

These are ordered real loopback WebSocket delays with +/-7 ms jitter, not WAN/loss tests. At 120 ms RTT the clock retains the existing 100 ms safe-calibration threshold and snapshot-offset fallback. These cases establish movement/reconciliation, not high-latency hit-registration acceptance.

## Measurement boundaries

Browser review uses Chromium with actual keyboard/mouse input. It is automated gameplay and visual inspection, not a human multiplayer playtest. Developer camera inspection, ordinary bot matches, normal-input playthroughs and synthetic stress are distinct evidence classes.

The new rendering and delayed-WebSocket cases use native ANGLE on an RTX 3060 with a 60 Hz frame cadence. Pre-existing default-browser movement tests ran on software rendering and recorded transport-saturated samples; their passing status is not clean network-latency evidence. Strict new-mode latency claims use the four separate native-browser loopback cases. CPU submission timing is not GPU duration. Results do not establish integrated-GPU performance, uncapped FPS gains or WAN behavior. Auto currently resolves to Medium in PlanetGun, matching the existing family behavior; this expansion does not claim a new adaptive controller.

The original client batching baseline is preserved in `artifacts/quality-oct26/CLIENT_PERFORMANCE.md`. Its controlled same-room six-nearby-pilot A/B is a different scene from the new full-roster character review; it must not be presented as a matched before/after speedup for new abilities. Server performance keeps the existing 8 ms average/16 ms p95 limits. A transient maximum is reported separately rather than hidden by the percentiles.

No new third-party art, samples or music were introduced. Existing accepted audio is reused for mode cues. No deployment has been performed.
