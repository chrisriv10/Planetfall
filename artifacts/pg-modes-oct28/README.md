# PlanetGun four-mode evidence

Initial HEAD: `d647317bdf5c369481e50627b8ecc633055f40ac`, main, DESKTOP-JL99F36. The tracked tree was initially clean; existing local artifacts were retained. No reset, restore, stash or pull/rebase was used. No deployment was performed.

- [Rules, roster, controls and architecture](../../docs/PLANETGUN_MODES.md)
- [Validation, fixes, measurements and limitations](../../docs/PLANETGUN_MODES_VALIDATION.md)

## Final checks, November 1 2026

- [Typecheck](typecheck-verified-final.txt): passed.
- [Production build](build-verified-final.txt): passed; existing large-chunk warning remains.
- [Complete unit suite](tests-verified-final.txt): 1,954 tests, 361 files, passed (459.20s). Includes unchanged BR 10/20/40 and PlanetGun 4/8/12 budgets.
- [Complete browser suite](e2e-verified-final.txt): 62/62 cases passed (38.3m), exit code zero, after final interaction polish.

No existing performance limit, assertion or timeout was relaxed. Test drivers use ordinary input and respect interaction priority, friendly bullet occlusion, rounded cover corners and physically supported routes.

## Compact evidence included in Git

- [Six actual hero rigs](heroes-final.png) and [twelve actual operator rigs](operators-final.png). Labeled composites of in-world developer-camera screenshots, not selection portraits or traversal views.
- [Server timings, payloads, delivery models and ordinary series](server-performance-final.json).
- [Client quality, synthetic cap and delayed WebSockets](client-performance-final.json).
- [Co-op outcome](co-op-gameplay-final.json).
- Actual gameplay: [plant](gameplay/strike-charge-planted.png), [barrier damage](gameplay/watch-enemy-shot-damages-rampart.png), [breach traversal](gameplay/siege-player-walks-through-real-breach.png), [revive](gameplay/survivor-revived-by-teammate.png), [upgrade](gameplay/survivor-upgraded-weapon.png).

## Raw local evidence and limits

`verified-suite-final-evidence/` contains the final complete-suite videos, screenshots and JSON. Earlier runs, including failures, remain locally in `complete-suite-first-evidence/`, `br-jump-focus-failure-evidence/`, `complete-suite-final-evidence/`, `interaction-polish-evidence/` and focused capture folders. Large recordings are not added wholesale to Git.

Native samples use RTX 3060 and 60 Hz cadence. CPU submission time is not GPU duration. Synthetic 32-enemy rendering is distinct from ordinary survival. Brief resource stability does not establish a long memory soak, integrated-GPU performance or WAN reliability. Browser input automation and visual inspection are not human multiplayer balance acceptance.

New cues reuse accepted audio. No new external art, sound or music assets were introduced.
