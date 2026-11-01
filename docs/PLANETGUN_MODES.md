# PlanetGun modes

PlanetGun keeps Team Deathmatch and adds four submodes on Nova Block. All use the existing eight primary weapons and two sidearms. Deathmatch Combat Kits, profiles, cosmetics and permanent progression retain their existing storage boundaries.

## Rules

| Mode | Objective | Life and equipment |
| --- | --- | --- |
| PlanetStrike | Plant the shared charge at A or B, or defend and defuse it. First seven wins, six-round halves; at 6–6, up to three overtime pairs. A split final pair draws. | One life each round. 20-second spawn buy phase, 105-second action phase, four-second plant, six-second defuse, 35-second charge. Match credits buy existing weapons, armor and three utilities. Survivors keep equipment; ammunition refills each round. |
| PlanetWatch | Capture the rotating Control Relay and hold it uncontested to 100%. First two rounds wins. | Team respawn waves, six unique heroes per side, character weapons and abilities. Protected players cannot attack or capture. |
| PlanetSiege | Prepare the active compound, breach its defenses and hold the uplink uncontested for 15 seconds. First four wins, three-round halves, bounded paired overtime. | One life, 35-second preparation and 150-second action phases. Six attackers and six defenders, finite gadgets, authored panels, drones and team cameras. No shopping economy. |
| PlanetZombies | One to four survivors fight finite waves until nobody can continue. | Sidearm start, separate run points, three infected archetypes, 32 active enemies plus a finite queue. Buy access, weapons, ammo, three weapon upgrades and perks. Restore power to enable upgrades. Downed allies can crawl and be revived; eliminated allies return after a completed wave. Solo gets one self-recovery. |

Strike and Siege disable Ion thrust, wall-running and sliding. They retain normal jumping and reachable mantles. Zombies use the same grounded policy, with slower downed crawling. Watch retains PlanetGun's advanced movement.

## Characters

Watch permits mirrors across opposing teams, but no duplicates within one team.

| Hero | Role | Weapon pair | Abilities and ultimate |
| --- | --- | --- | --- |
| Cairn | Tank | Photon / Comet | Rampart cover, Brace Pulse knockback, Stone Circle team shields; reduced knockback passive. |
| Kepler | Tank | Arc / Orbit | Gravity Well, Personal Guard, Orbital Well with one bounded pull; shield damage reduction passive. |
| Cinder | Damage | Nova / Comet | Burn Dash, telegraphed Heat Cell, Overdrive cadence/cooling; earned elimination reload benefit. |
| Parallax | Damage | Quasar / Orbit | Directional recon, collision-checked blink, precision/handling ultimate; stationary ADS passive. |
| Solace | Support | Pulse / Orbit | Resource-limited healing beam, destructible beacon, recovery field; delayed self-healing. |
| Spindle | Support | Helix / Comet | Ally shield, destructible movement/reload relay, relay amplification; bounded assist resource. |

| Siege side | Operator | Signature |
| --- | --- | --- |
| Attack | Rivet | Delayed reinforced-panel breach pucks. |
| Attack | Lumen | Directional survey dart with expiring, line-of-sight intel. |
| Attack | Null | Local EMP disables hostile electronics temporarily. |
| Attack | Strut | Finite-health collision-backed approach cover. |
| Attack | Thread | Swept trip line with destructible endpoints and a bounded slow. |
| Attack | Patch | Finite healing charges for living allies. |
| Defend | Brace | Reinforced cycling shutter at an authored opening. |
| Defend | Hush | Local drone/sensor jammer. |
| Defend | Glint | Directional movement sensor. |
| Defend | Coil | Capped damage and slow strip. |
| Defend | Mend | Destructible healing equipment with a finite pool and throughput. |
| Defend | Shroud | Vision-blocking smoke. |

The shared character catalog owns legal primary choices, modules, HP, targeting, durations, costs and resources. Selection previews and in-world identity hardware use the same presentation helper. Team markings and canonical animation anchors remain intact. Low quality preserves character identity and essential smoke/telegraphs.

## Controls and local preferences

Q/F use abilities or signature/common equipment; G uses a Watch ultimate or Strike's third utility. Hold E for plant, defuse, revive or power; E also resolves nearby panel or drop interactions. T reinforces, V controls a scout and X selects authorized cameras in Siege. B opens mode equipment/character selection. Existing reload, weapon, ADS, scoreboard and pause bindings remain. Controller shoulder buttons and directional inputs provide corresponding actions.

Only the host changes submode/capacity. Over-capacity co-op switches are refused without kicking players. Humans reserve characters atomically and have priority over auto-filled bots. Reservations, life, purchases and equipment survive the existing reconnect grace period; expired/explicitly departed players release them. Action sequence acknowledgements permit refresh without replaying purchases.

Character preferences use the separate versioned browser key `planetfall:pg-characters:v1`; the preferred mode uses `planetfall:pg-mode:v1`. These preferences are local to that browser. Match credits, run points, cooldowns and upgrades are server-owned temporary state for the active room, not cross-device permanent inventory. Eligible match rewards are bounded and settled once through the existing profile path.

## Map and authority

A and B use the west and east compounds. Control Relay rotates between the center and compounds. Siege uplinks rotate between compounds. Existing west/east/maintenance openings contain authored panel sockets. Zombie access gates stage the west habitat and neighboring spaces; power and upgrade stations are reached through actual unlocked circulation.

`shared/src/planet-gun/modes.ts`, `characters.ts`, `movement-rules.ts` and `mode-collision.ts` define contracts. `server/src/modes/planet-gun/pg-room.ts` integrates focused Strike, Watch, Siege and Zombies runtimes. Movement, client replay, visibility, bullets, drones and routes consume the same room-local collision topology. Base `PG_MAP` and weapon profiles are never mutated.

Snapshot revision orders all panel state. Topology revision changes only when physical obstacles change, so panel damage/repair does not repeatedly discard prediction. Rewound shots must pass both historical and current blockers within the existing rewind window. Newly placed cover cannot be shot through using an earlier timestamp, and destroyed cover still blocks shots fired before destruction.

Zombies are separate typed entities rather than player slots. They share reverse routes, physically checked walking corridors, staggered perception/recovery and bounded caches. Invalid/stuck enemies are recovered off-screen or explicitly replaced while preserving wave bookkeeping. Graphics quality never changes authoritative enemy counts.

Strike bots buy equipment, route between charge/sites, plant, retake and defuse. Watch bots occupy different positions around the relay; support heroes approach injured allies, while ability use validates visible opponents, allies, resources and real placement. Siege defenders prepare and reinforce openings, attackers steer scouts during preparation, then use signatures/common breaches and route toward the active uplink. Survivor bots follow physical walking corridors to access, power, racks, upgrades and safe revives; their ammunition and points are their own.

New actions route to existing accepted audio samples. No soundtrack or external asset replacement is part of this expansion.

## Validation boundaries

Focused authority tests cover selections, resource conservation, life states, abilities, round ordering, reconnect, collision, hidden intel and rewards. Ordinary autonomous scenarios require real plants, captures, breaches and multi-wave combat. Browser tests use keyboard/mouse input and authoritative observations; character camera inspections and synthetic 32-enemy renderer stress are labeled separately from actual match play.

Test commands remain `npm run typecheck`, `npm run build`, `npm test` and `npm run test:e2e`. Existing BR/PlanetGun performance limits remain unchanged. Detailed current-run results and raw local evidence belong in the validation report; automated browser review is not human playtest acceptance.
