# Planetfall Codex Instructions

Planetfall is a TypeScript browser game using Three.js, Rapier, Socket.IO, Vite, and an authoritative server.

The primary agent owns the complete task and uses GPT-6.1 Sol High. The custom `visuals` agent uses GPT-6 Astra Medium. Generic engineering subagents use GPT-6.1 Sol Medium. The parent determines when delegation is useful; do not delegate simply because subagents exist.

## Sol ownership

Sol owns overall architecture, gameplay mechanics, game state, balance, authoritative server behavior, shared types/constants/contracts, networking, Socket.IO, Rapier physics and collision, prediction, reconciliation, input, matchmaking, economy, persistence, integration, build/deployment configuration, Playwright E2E, multiplayer/system tests, server performance tests, and interpretation of unrelated validation failures. Everything under `server/` and `shared/` is Sol-owned.

## Visual delegation

Delegate isolated presentation implementation to the `visuals` Astra agent. Examples include CSS/UI appearance, Three.js decorative geometry, materials, environment art, building/interior dressing, VFX, visual weapon models, astronaut appearance, storm appearance, and visual LOD. Astra may own a presentation helper and focused colocated tests for that helper. Using authoritative state or geometry as input is allowed; changing authoritative state or geometry for visual convenience is not.

## Mixed files

Do not treat the entire `client/` directory as visual. These remain Sol-owned because they mix presentation with gameplay, state, integration, prediction, or other system responsibilities:

- `client/src/game.ts`
- `client/src/main.ts`
- `client/src/modes/battle-royale/br-game.ts`
- `client/src/modes/battle-royale/br-world.ts`
- `client/src/modes/battle-royale/br-camera.ts`
- `client/src/modes/battle-royale/br-feedback.ts`
- `client/src/modes/battle-royale/br-physics.ts`

Astra may read these files but should not directly modify them. Everything under `server/`, `shared/`, and `e2e/` remains Sol-owned.

## Mixed-task workflow

1. Sol analyzes the entire task and determines the gameplay/system contract.
2. Sol implements gameplay, server, state, networking, physics, or shared changes.
3. Sol delegates the isolated presentation portion to `visuals`.
4. Astra implements presentation-only helpers and focused visual tests.
5. Sol performs integration changes in mixed files and reviews Astra's diff.
6. Sol owns final validation and integration.

When visual code is embedded in a large mixed module, prefer having Sol extract a small presentation-only module before future work is delegated.

## Validation ownership

Astra may create or update focused tests for presentation-only modules. Sol owns Playwright E2E, multiplayer flow validation, gameplay tests, network tests, authoritative physics tests, server performance tests, and full-suite failure diagnosis. Never weaken an unrelated timeout, budget, threshold, assertion, gameplay condition, or network/server behavior merely to obtain a green run.

## Final ownership

Sol is the final reviewer and integrator, including for visual-heavy tasks.
