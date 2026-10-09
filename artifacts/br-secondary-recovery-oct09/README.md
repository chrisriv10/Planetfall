# Secondary/connective review and Dock–Engine occupied frontage

Transfer checkpoint evidence, October 9, 2026. See
`../../docs/BR_DESKTOP_HANDOFF_OCT09.md` for current scope, validation and next work.

## Baseline

`before.json` checks 43 secondary/transition groups; `connective-before.json`
checks four connective groups. `review/` contains six ground/interior static
views using `tools/br-secondary-review-views.json`, before the two new buildings.
The reviewed Industrial South view is reproduced at exactly the same camera
in `engine-gate-after/industrial-south-gap.jpg`.

## Integrated result

`engine-gate-after/` contains five fixed-camera production-world views and
draw-call/triangle/resource metadata. All five images were visually reviewed.
The helper adds short flush approach graphics and wall plaques; the actual
buildings, doors, floors, roofs and loot come from shared authoritative map data.

`primary-after.json`, `secondary-after.json`, `connective-after.json` check final
production prop groups against all 185 building envelopes. `facade-after.json`
checks independent building envelopes and facade composition. No hits were
flagged within the documented scopes. `secondary-after-map.json` is an interim
audit before the frontage helper was integrated, not the final result.

## Reproduce

Build shared, start client Vite at localhost:5173, then run serially:

```sh
node tools/br-prop-audit.mjs artifacts/br-secondary-recovery-oct09/primary-after.json
node tools/br-prop-audit.mjs artifacts/br-secondary-recovery-oct09/secondary-after.json --secondary
node tools/br-prop-audit.mjs artifacts/br-secondary-recovery-oct09/connective-after.json --connective
node --import tsx tools/br-overlap-audit.mjs artifacts/br-secondary-recovery-oct09/facade-after.json
node tools/br-prop-review.mjs artifacts/br-secondary-recovery-oct09/engine-gate-after --cameras=tools/br-engine-gate-review-views.json
```

`review/` is historical baseline: rerunning its camera file against the latest
map will not reconstruct the old map. No reset/restore was used to capture it.

## Limits

Static world-only renders exclude live players/loot, gameplay/HUD, sky, shadows
and bloom. They are not human gameplay, FPS, camera/input, road-wide collision
or whole-island visual acceptance. Prop tests exclude unrelated mesh groups and
do not prove prop-to-prop or prop-to-road separation. New route/door/court
authority/prediction tests and loot-clearance tests provide separate evidence.
The whole pass remains unfinished; no deployment was performed.
