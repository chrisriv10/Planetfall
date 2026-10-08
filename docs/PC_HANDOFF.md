# Planetfall PC handoff — October 8, 2026

This is a development checkpoint, **not completion of the Orbital Isle pass**.
The repository snapshot is the source of truth. Preserve any newer PC-local
changes before syncing. Do not reset, restore, stash, pull/rebase over dirty
work, or replace working files from a historical commit.

## Setup on the PC

Install Git, Node.js **22.x**, and npm 10 or newer. Use a normal local folder
outside OneDrive when practical. Clone a new checkout rather than overwriting
an existing dirty one:

```powershell
git clone https://github.com/chrisriv10/Planetfall.git
cd Planetfall
npm ci
npx playwright install chromium
npm run dev
```

The normal client is http://localhost:5173 and server port is 3000. The E2E
configuration starts its own servers on 15173/13000 with reuse disabled.
No production credentials are needed for local gameplay. Do not copy laptop
node_modules, build outputs, browser caches, Git credentials or Codex auth.
If custom environment variables are needed, recreate them locally from
`.env.example`; never commit secrets.

Open this cloned folder as the local project in Codex. A GitHub remote is a
transfer source, not an execution host: builds, browsers and tests must run
on the PC checkout. The laptop's localhost, processes, local browser tab,
attachments and conversation runtime do not transfer through Git.

## Restore the project-local routing

The laptop's root `AGENTS.md` and `.codex/` were deliberately local-only via
`.git/info/exclude`. Portable copies of the three non-secret instruction files
are included under `docs/pc-handoff/`. They preserve Sol High parent ownership,
Sol Medium engineering delegation and Astra Medium `visuals` ownership.

On a **fresh checkout only**, after confirming these destinations do not already
contain a PC configuration you need to preserve:

```powershell
Copy-Item -LiteralPath docs/pc-handoff/AGENTS.md -Destination AGENTS.md
New-Item -ItemType Directory -Path .codex/agents -Force
Copy-Item -LiteralPath docs/pc-handoff/config.toml -Destination .codex/config.toml
Copy-Item -LiteralPath docs/pc-handoff/visuals.toml -Destination .codex/agents/visuals.toml
```

Keep these restored copies local (add `/AGENTS.md` and `/.codex/` to this
checkout's `.git/info/exclude`). Do not overwrite account/global settings or
assume a model is available until the PC app confirms it. The templates are
instructions/configuration only, not authentication or session files.

## Current task and preserved work

Continue the **screenshot-driven spatial-foundation recovery**, not a generic
decoration pass. User references showed a flat slab, isolated buildings,
undefined 30–60m deck gaps, roads stopping at POIs, overlapping road wedges,
giant green POI carpets, wrong camera/input basis and an inward altitude HUD.
Keep the ~1000m island, canonical astronaut, server authority and Classic/Chaos
isolation. Do not introduce unrelated major systems.

Current totals: **174 structures, 92 enterable, 36 secondary sites, nine POIs**.
The working snapshot contains real raised districts/secondary decks and a
sunken service court; clipped base-deck surfaces with matching physics;
graded-road endpoint fixes; continuous road-surface union and clean markings;
road-first frontage revisions; supported loot/crates; camera/input/Starliner
basis corrections; right-column altitude HUD; active-mode renderer ownership;
stable tactical-map DOM; and bounded covered-world drawing.

Latest block: **West Junction**. Three ground-level shop/office/utility parcels
serve an actual local street. The existing eight-metre collector remains level
through the frontage, then rises five metres toward Nova over 38m (<8 degrees).
Exact road/parcels and all earlier changes are documented in
`docs/BR_SPATIAL_RECOVERY_OCT06.md`. Isolated Astra paving contributes 15
non-overlapping flat pieces in two cached-material batches, integrated by Sol.
This later paving has NOT had final integrated screenshot acceptance.

## Validation — do not relabel failures as passes

- Latest full root typecheck and production build passed before migration.
- Full unit/integration suite: **806/806 in 139 files**, 288.07s, before the
  last test-only contact assertion addition.
- Subsequent West Junction tests: **13/13**, 4.45s. Existing movement parity
  and doorway assertions remain; continuous roads/grades also require real
  floor contact every frame, plus a suspended-capsule negative case.
- Standalone density-tool tests: **3/3**.
- Fresh full E2E: **9/11**, 8.5m. BR room/drop and lazy lobby, shop/settings,
  Classic room lifecycle, Chaos, rendering budget and quick-play passed.
- Failures: BR Solo responsive-map flow exceeded its unchanged 90s deadline
  at the second viewport resize; Classic raid failed its >.6m shove
  displacement poll despite accepted shove and 9.46m/s visible knockback.
- Quiet isolated rerun: **0/2**. BR Solo instead missed HUD visibility within
  the existing 15s wait; Classic completed the raid and reached results/shop,
  but exceeded its unchanged 220s overall deadline on the Solar Gold BUY click.
  These remain unresolved, not proven unrelated. Do not increase deadlines,
  reduce requirements, or call the E2E suite green.
- Human/screenshot review ended when Windows Computer Use could not establish
  the browser URL safely. Final manual acceptance is still pending.

Previous review screenshots are in `artifacts/br-review-oct07/`, including
West Transit before/blockout and Solar matte-body revisions. They are historical
camera-matched evidence, not screenshots of every latest integration. The
original full-screen user reference attachments remain in the old chat and
may need reattaching; personal browser/account screenshots were not uploaded.

## Resume order

1. Inspect `git status`, actual files, routing and the detailed recovery log.
2. Run typecheck/build and focused traversal/camera/map tests on the PC.
3. Reproduce both outstanding E2E failures with no competing heavy jobs.
   Investigate quick-start/socket/HUD timing and Classic poll/action stalls;
   do not assume laptop load is the entire root cause.
4. Run the game with hardware acceleration and re-review the same ground
   cameras: `?brView=west-transit-avenue`, `solar-rim-service`, `aerial`,
   Nova/Academy/Hotel frontages and the actual screenshot-four junction.
   See `br-review-cameras.ts` for all supported exact review names.
5. Continue the largest genuinely undefined corridors, not random dressing.
   The density diagnostic reports 13.2% of interior samples >30m from real
   enclosure, 0.9% >50m; notable gaps remain around (110,-370), (-170,170),
   (-70,-460) and (-170,-20). Floors/roads/POI metadata do not count as enclosure.
6. Re-review aerial high/low readability, oversized POI base surfaces, repeated
   architecture, door/interior alignment, full 360° camera and drop transition.
   Sol owns geometry/collision/mixed integration; Astra only isolated visuals.
7. Run full regressions, E2E and performance **serially**. Report actual counts,
   timing and screenshots; do not claim whole-pass completion from green tests.

Suggested first message to the PC agent:

> Continue Planetfall from this local checkout. Read docs/PC_HANDOFF.md and
> docs/BR_SPATIAL_RECOVERY_OCT06.md first. Preserve local work, follow the
> Sol/Astra routing, investigate the unresolved E2E failures, then continue
> the screenshot-driven Orbital Isle spatial redesign. Do not deploy or push
> further changes unless I explicitly ask.
