# PlanetGun first playable slice — October 22 acceptance evidence

See [implementation/acceptance report](../../../docs/PLANETGUN_IMPLEMENTATION.md)
for initial HEAD, preservation, contracts, defects found, validation and limits.

## Native browser evidence

- `live-combat-confirmed.png`: actual close combat elimination/headshot feedback.
- `human-match-results.png`: completed ordinary 8-minute two-client match.
- `results-final.png`: ordinary 12-player results; footer remains accessible.
- `earned-wallet.png`: shared Shop shows earned participation Fallbucks.
- `active-*-interior.png`: actual player in west/east/maintenance rooms.
- `wall-run-active.png`, `wall-jump.png`: corrected north wall run/jump.
- `east-wall-run-active.png`: actual east service-wall run, with Ion use.
- `crossover-active.png`: actual supported player at y=4.25m on the upper route.
- `mantle-complete.png`: player supported on authored mantle cover.
- `scoreboard-active.png`: native Tab opens the ordinary match scoreboard.
- `home-final.png`, `lobby-final.png`: final desktop composition.
- `home-narrow-top.png`, `home-narrow-bottom.png`: 615x615 internal scrolling,
  with logo and bottom Create/Join/Shop controls reachable.

These use real keyboard/mouse input. No player teleports or authority injection.
The embedded browser denies pointer lock; held-drag is the intended fallback.
Settled held ADS + firing is covered separately by the two-client E2E capture.

## Rendering and simulation data

`client-render-samples.json` contains 20 RTX 3060 hardware samples: five fixed
camera definitions each at High/Medium/Low/Auto, 12 active participants, 90 frame
times per sample, 1280x720 CSS viewport. Auto resolved to Medium. High/Low PNGs
show the same camera definitions, with moving bots. Scene counters are not GPU
occlusion counts. Short VSync-limited samples do not establish an iGPU guarantee.

`server-{4,8,12}.json` record the final full unit-suite run: 60 simulated seconds
with ordinary bots, movement and firing. Existing budgets remain unchanged.
`manual-events.json` preserves earlier observations, including failed attempts;
those entries are reproductions, not a declaration that every attempt passed.

## Final validation

- `pg-full-tests-accepted.txt`: 1425 tests / 275 files passed on the final code.
- `pg-typecheck-authority-final.txt`, `pg-build-authority-final.txt`: final source
  typecheck/build passed; the existing large-chunk build warning remains.
- `pg-full-e2e-final.txt`: 29/29 cross-mode browser tests passed.
- `pg-e2e-authority-repeat.txt`: three consecutive lifecycle regressions passed
  after the final input acknowledgement correction.
- `pg-e2e-accepted.txt`: all six PlanetGun tests passed again on that correction.
- `rail-held-ads.png`, `opposing-client-combat.png`, `combat-debug.json`: held
  Rail zoom and actual opposing-client headshot/death (0 HP, one death).
- `headless-render-samples.json`: 40 final software-rendered camera samples,
  kept separate from the real RTX 3060 measurements.
- `native-shortcut-check.png`: Ctrl-strafe leaves the native HUD unselected;
  Ctrl+R was observed reloading without refreshing the page.

Earlier `*-final.txt` logs retain preceding checkpoints; the accepted/authority
logs above identify the final corrected tree.
Older untracked BR/PlanetRun evidence and development captures remain untouched.
