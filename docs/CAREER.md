# Career

Career records authoritative match completions and victories for the four matchmaking families: Classic (`planetfall`), Battle Royale, Planet Run, and Planet Gun. Zombies belongs to Planet Gun; its reliable waves metric is recorded there when available. Achievement recognition grants no XP, currency, items, or gameplay advantage.

## History and compatibility

`GuestProfile.career` is an optional version 1 JSON value. Existing profiles without it have zero tracked Career activity; their XP, crowns and balances are never converted into guessed match history. `trackedSince` is the time of the first recorded result, and each achievement stores its first unlock timestamp. The UI should label this as tracking since the feature was introduced/first result rather than lifetime activity.

Career uses the existing canonical profile key. Claiming a guest into an account keeps that row and its Career; it does not copy stats to a second identity. A Career-only profile counts as progress when deciding whether a guest has transferable progress. Deep copies isolate returned views and bound room representations. Existing captures, pass reconciliation, purchases, refreshes, and transactional updates preserve the optional field.

## Authoritative result contract

`PlayerProfiles.recordCareer(family, settlementId, entries)` accepts only server-side bound player objects. Each entry requires `won: boolean`; optional reliable nonnegative safe-integer metrics are `eliminations`, `qualifications`, `repairs`, `scrap`, and `waves`. It ignores unbound objects and settles each canonical profile at most once per batch. Client payloads, browser state, display names, and supplied profile keys are never inputs.

The room creates a fresh server UUID for each new match and reuses it for every attempt to settle that match. A completion is a participant reaching the authoritative match settlement, not merely joining or disconnecting. A victory must come from the server's match outcome, including ties only when the mode treats them as victories. Planet Run qualifications are counted only from reliable authoritative round outcomes; missing metrics remain zero. Eliminations are accepted for Battle Royale/Planet Gun; repairs/scrap for Classic; qualifications for Planet Run; waves for Planet Gun. Optional metrics unlock their corresponding gameplay achievements only when recorded by the authoritative result hook. Missing optional metrics remain zero.

Rooms exclude bots and short/abandoned sessions from Career credit. Classic requires at least 30 seconds of actual match time; the other families require at least 60 seconds. Planet Run additionally requires six participants, and PlanetGun Deathmatch requires six participants, matching their existing reward eligibility. These checks do not shorten production matches or change reward amounts. The optional waves field is supported by the persistence contract but is not currently supplied by a room hook.

The 13-entry catalog contains first completion, ten completions, first victory, ten victories, a completion in all four families, Scrap Collector (100 Classic scrap), World Defender (5 Classic repairs), Last Planet Standing (1 Classic win), Royale Explorer (1 Battle Royale completion), Orbital Champion (1 Battle Royale win), First Qualification (finish a Planet Run tournament with a qualification), Perfect Run (1 Planet Run win), and First Elimination (1 Planet Gun elimination recorded after an eligible completed match). Descriptions are exported alongside the requirements by `shared/src/career.ts`.

## Durability and retries

Each settlement/profile pair derives a deterministic namespaced UUID from a SHA-256 digest. Its bounded receipt fits the existing `planetfall_profile_operations.id` UUID column. The receipt and updated JSON commit in the same existing row-locked transaction. Concurrent captures, purchases, account operations, or other processes therefore read the latest committed JSON. A retry after a lost commit response finds the durable receipt and returns the latest row without applying the result again. Receipts must be retained for as long as a settlement can be retried; no in-memory-only receipt cache is used for PostgreSQL.

The profile database queue retains failed operations and retries them through the existing retry lifecycle. Each queued attempt closes over the same receipt ID and validated metrics. `onChange` (and therefore the existing `profile:state` notification) happens only after commit confirmation. The private `career:settled` notification identifies the confirmed server settlement without exposing profile keys. Rooms queue reward capture before Career; a confirmed Career receipt therefore follows the preceding reward write. Results show a pending message until that confirmation arrives. No extra economy grant is introduced. The optional local JSON store atomically writes its Career receipts alongside the profiles, retaining failed operations for retry and rolling back uncommitted Career projections.

There is no schema migration, new table, index, column, or expanded runtime privilege. Existing JSON progress and operation-receipt permissions documented in `PLAYER_PROFILES.md` remain sufficient. This feature does not rewrite the ledger or backfill production data. No production connection is required for local validation.

## Local validation

`server/src/career.test.ts` uses disposable local JSON files and an isolated PostgreSQL WASM engine. It verifies all achievement requirements are attainable, old profiles start at zero, alias deduplication, durable replay after restart, purchase/capture/refresh preservation, account-link identity, lost commit responses, another process's intervening update, receipt rollback/retry, and invalid/unbound result rejection. Run it with the existing player-profile and profile-database suites. Full room integration/browser checks belong to the owning integration pass.
