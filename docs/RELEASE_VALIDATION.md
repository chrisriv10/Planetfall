# v0.1.0 release validation

Date: September 5, 2026. Platform: Windows, Node 22.22.0, npm 10.9.4.

Status: **READY AFTER MANUAL HOSTED TEST**.

The starting branch was clean `main` at `21e3470`, matching GitHub. This includes the README update after the previously expected `c64fefe`.

## Results

| Check | Result |
| --- | --- |
| `npm ci` | Passed in the working repository and a separate clean checkout. 180 packages installed, 184 audited. |
| `npm run typecheck` | Passed after adding shared-package compilation before workspace checks. |
| `npm run build` | Shared, server, and client passed. |
| Hosting build commands | Render build passed with `NODE_ENV=production` and `npm ci --include=dev`; Pages shared/client build passed with an explicit HTTPS `VITE_SERVER_URL`, which was verified in the output. |
| `npm test` | 23 tests passed across 3 files. |
| `npm run test:e2e` | 2 Chromium browser tests passed after the fixes below. No `spawn EPERM` restriction in this environment. |
| `npm audit` | 0 vulnerabilities. |
| Version consistency | Root, client, server, shared, and lockfile workspace versions are all `0.1.0`. |
| Repository hygiene | No tracked build output, secrets, traces, or temporary debug artifacts found. The largest asset is the used, attributed 1.50 MB music file. |

## Fixes prompted by validation

- A clean checkout initially failed typecheck with `TS2307: Cannot find module '@planetfall/shared'`, followed by missing-type errors. Local compiled output had hidden the missing prerequisite. Root `pretypecheck` now builds shared first; the clean checkout passed afterward.
- With Render's `NODE_ENV=production`, the original `npm ci` installed only 98 packages and the shared build failed because `tsc` was unavailable. Render now uses `npm ci --include=dev` so its build includes TypeScript. The exact corrected command passed in the clean checkout.
- The original Playwright configuration reused an unrelated app listening on port 5173. Both tests timed out against that app. Tests now start their own server and client on ports 13000 and 15173, wait for both, and refuse to reuse occupied ports.
- The actual browser flow exposed a name-input race during the dynamic game import. Startup now restores a saved name early and preserves existing input. The human test checks the entered name after the create button becomes enabled. Both browser tests passed afterward.

## Production-style local smoke

The compiled server ran through `server/dist/index.js` with `PORT=4317`, `NODE_ENV=production`, and explicit origins `http://127.0.0.1:4173,https://planetfall-release.example`. The static production client was built with `VITE_SERVER_URL=http://127.0.0.1:4317` and served on port 4173. The `.example` origin was a test value, not a deployed service.

Verified:

- The client bundle contained the injected server URL, and the server logged binding to `0.0.0.0:4317`.
- `/health` returned 200 and `ok: true`. The allowed origin received its exact CORS header; an unlisted origin and an implicit localhost development origin both received 403 without an allow-origin header.
- An allowed-origin Socket.IO WebSocket connected; an unlisted-origin WebSocket was rejected.
- Two human socket clients created and joined a room, added four bots, readied, started, and received running snapshots containing all six participants. A rocket dealt the expected 14 authoritative damage.
- A disconnected client rejoined inside the grace period with the same session token and player ID.
- Two separate Chromium contexts used the production UI to create, join, and start a six-participant match. The arena rendered at a 1920 by 1080 viewport without JavaScript page errors.
- With the backend initially offline, the UI showed its waking status and connected when the process started.
- A browser network interruption recovered. Restarting the backend returned both browsers home with the room-closed message, after which Play Solo started a new match with three bots.

The unit/integration suite also covers bot movement, collection, repair and firing; human collection and repair; overtime; damage and elimination; results and rematch; reconnect expiry; host migration excluding bots; six-participant capacity; malformed commands; and room cleanup. Several tests deliberately set server state or advance timers to isolate these cases. They are not evidence of a full hosted match.

## Warnings and remaining gate

- Vite still warns about the game chunk exceeding 1600 kB. The initial JavaScript entry is about 52.04 kB minified / 17.24 kB gzip; the dynamically imported engine is about 3415.99 kB / 1237.90 kB gzip. This is a loading consideration, not a build failure.
- Playwright prints a `NO_COLOR`/`FORCE_COLOR` conflict. Screenshot capture also produced Chromium GPU `ReadPixels` stall warnings. Neither produced test failures or JavaScript page errors.
- Git reports its normal LF-to-CRLF conversion warning on edited files.
- GitHub Actions passed on the hosted Ubuntu runner for release candidate `afc8bf9`: [CI run 34012628001](https://github.com/chrisriv10/Planetfall/actions/runs/34012628001). Node 22 setup, `npm ci`, typecheck, build, and tests all succeeded. Browser tests remain local/manual for v0.1.0.
- No live URLs were supplied or found in repository configuration, GitHub homepage metadata, or GitHub deployment records. No hosting resources, GitHub release, or tag were created during this pass.
- Actual Render cold-start timing, TLS/proxy behavior, full cross-device human/solo matches and rematches, and sustained desktop frame rate remain unverified on hosting.

Complete the [hosted release gate](DEPLOYMENT.md#hosted-release-gate) before creating the public `v0.1.0` release. Render Free and in-memory room limitations are described there and in the release notes.
