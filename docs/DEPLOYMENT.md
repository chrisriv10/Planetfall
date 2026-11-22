# Deployment

Production uses one Render web service at `https://planetfall-server.onrender.com` and the canonical Cloudflare Pages project at `https://planetfall.pages.dev`. Keep this Pages origin stable to preserve browser guest access and first-party account cookies. The Windows desktop shell loads that same HTTPS client; it does not host another game server. See [desktop setup and security](../desktop/README.md).

## 1. Render server

Connect this repository to Render and use the free Node web service defined by `render.yaml`, or enter these settings manually:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Root directory | Leave blank (repository root) |
| Runtime / plan | Node / Free |
| Build command | `npm ci --include=dev && npm run build -w @planetfall/shared && npm run build -w @planetfall/server` |
| Start command | `npm run start -w @planetfall/server` |
| Health check | `/health` |
| `NODE_VERSION` | `22.22.0` |
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | Final Pages origin, such as `https://YOUR-PAGES-SITE.pages.dev` |

If Pages does not exist yet, use the intended Pages origin temporarily. Replace it with the actual origin in step 3. An unmatched origin is denied; do not use `*`.

Render supplies `PORT`. The server binds to `0.0.0.0` and serves HTTP health checks and Socket.IO WebSockets on the same port. Keep a single server instance because rooms are held in that process's memory.

The build explicitly includes dev dependencies because TypeScript is needed to compile the workspaces even with `NODE_ENV=production`.

For saved progression, set the server-only `DATABASE_URL` to the writable
Neon connection for the restricted runtime role. The Free service's local
files are ephemeral. Prepare the separate database migration before starting
the service.

After the authorized cutover below, verify `/health` reports both `ok: true`
and `profileStorage: "postgresql"`.

### Database migration and first transactional release

Follow the [operator cutover and rollback runbook](RELEASE_CUTOVER.md) for the
first transactional release. It includes database fencing, backup recovery,
matching artifacts and maintenance acceptance.

Rehearse the [migration and grants](PLAYER_PROFILES.md#explicit-migration-and-database-roles)
on an isolated Neon branch and verify a recoverable backup. The first
production migration and deployment require explicit operator authorization.
The older whole-ledger writer can overwrite newer progression, even with the
new schema present. Stop new matches, drain active rooms, disable automatic
replacement for this cutover, and verify the old writers have stopped and
cannot reconnect. Then take or verify the final recovery point.

Run `npm run db:migrate -w @planetfall/server` from the built release in an
authorized environment with the direct owner URL in
`PLANETFALL_MIGRATION_DATABASE_URL`. Run it again to verify it reports the
schema is current. Apply the specific runtime role grants and verify the
restricted connection. Render's build and start commands use neither the
migration command nor its credentials.

Start the corrected Render service with the restricted `DATABASE_URL`, verify
database startup, then release the matching Pages revision. Confirm saves,
reconnect and restart behavior, leaderboard opt-in and opt-out, account
linking when enabled, and Players Online before reopening matches. Monitor
database startup and save errors. For rollback, use a vetted version with
transactional persistence and restricted startup. Retain the additive
schema, operation receipts and newer committed progression. See the
[first release and rollback procedure](PLAYER_PROFILES.md#first-release-and-rollback).

## 2. Cloudflare Pages client

Create a **Pages** project using this Git repository and set:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` (repository root) |
| Build command | `npm ci && npm run build -w @planetfall/shared && npm run build -w @planetfall/client` |
| Build output directory | `client/dist` |
| `NODE_VERSION` | `22.22.0` |
| `VITE_SERVER_URL` | The Render HTTPS service URL from step 1 |

Set `VITE_SERVER_URL` in each Pages environment you intend to use, including preview if enabled. It is a public build-time value, not a secret. Changing it requires a new client build. Do not append `/health` or `/socket.io`.

Assets and music use paths from the site root, so serve the client at `/`. Pages serves the Vite app statically and invokes its account proxy only under `/api/account/*`. Multiplayer connects directly to Render. Without `VITE_SERVER_URL`, the production client falls back to its own origin and cannot connect to the separate Render service.

Deploy and copy the resulting Pages URL.

## 3. Connect the origins

Set Render's `CLIENT_ORIGIN` to that Pages origin, with no trailing slash or path, then redeploy/restart the service. Include an exact custom domain or preview origin only when needed; multiple origins can be comma-separated. Production does not automatically permit localhost origins.

Deployments and restarts erase active rooms. Publish updates between play sessions.

## Optional Google accounts

Guest profiles work independently of this configuration. Account sign-in is opt-in. Complete these steps for an isolated test branch first, and use production credentials only for an authorized release.

1. Back up the existing progression database. Enable **Managed Better Auth** on an isolated Neon branch that contains the progression schema. Use the branch's Auth base URL exactly as displayed. Auth data lives in the `neon_auth` schema. The explicit profile migration verifies or creates the separate Planetfall account-link table before startup. [Neon Auth setup](https://neon.com/docs/auth/overview) · [Authentication flow](https://neon.com/docs/auth/authentication-flow)
2. Configure Google OAuth in that branch. For launch, use your own Google Cloud **Web application** OAuth client and configure the consent screen and any required test users or publishing steps. In Google Cloud, register the branch's exact authorized redirect URI, `{NEON_AUTH_BASE_URL}/callback/google`. Add the exact Pages origin to Neon Auth **Trusted Domains**. Planetfall's application callback is `<PAGES_ORIGIN>/api/account/complete`. Google redirects to Neon and Neon returns the browser to Planetfall. [Neon OAuth setup](https://neon.com/docs/auth/guides/setup-oauth), [Neon’s production checklist](https://neon.com/docs/auth/production-checklist).
3. Configure Render and Cloudflare Pages with the settings below. Use distinct random values of at least 32 characters for the two secrets. Scope both services to the same canonical HTTPS Pages origin. Keep the current public origin for the initial rollout so browsers can still read their existing guest credentials. Use separate Neon branches, secrets and origins for test and preview environments. Keep provider base URLs stable for a released branch because they namespace the account links.
4. After authorizing release, deploy the server and Pages from the same revision. Check `/health` for `profileStorage: "postgresql"`. Check the account endpoint through Pages. Confirm first-party `Secure`, `HttpOnly`, `SameSite=Lax` cookies and a clean address bar after the OAuth callback. Test guest play, Google consent, guest linking, a second device with a separate browser profile, existing-profile conflict, sign-out/switch, rewards and cosmetics after a restart, and blocked third-party cookies. Validate both cancellation and a temporarily unavailable provider.

| Where | Variable | Value |
| --- | --- | --- |
| Render secret | `DATABASE_URL` | Writable PostgreSQL connection string for the selected branch and restricted runtime role |
| Render | `NEON_AUTH_BASE_URL` | Managed Better Auth branch base URL |
| Render secret | `NEON_AUTH_COOKIE_SECRET` | Random secret for the Neon adapter |
| Render | `PLANETFALL_ACCOUNT_ORIGIN` | Exact Pages HTTPS origin, also listed in `CLIENT_ORIGIN` |
| Render and Pages runtime secrets | `PLANETFALL_ACCOUNT_GATEWAY_SECRET` | Same random value on both sides of the first-party proxy |
| Pages runtime | `ACCOUNT_SERVER_URL` | Public HTTPS base URL of your Render service |
| Pages build | `VITE_SERVER_URL` | Public HTTPS URL of the Render gameplay service |

Enter Google OAuth credentials in the Neon console and disable unused sign-in methods for the public branch. Keep database, cookie and gateway secrets out of Vite variables and source control. Planetfall pins `@neon/auth` and uses its framework-neutral server toolkit for the first-party proxy and callback exchange. The account proxy forwards only the allowed account routes and keeps credentials on the Pages origin. Turn off request URL or header logging for the OAuth callback and account routes if the host enables it. Limit changes to the canonical production origin and use fail-open static Pages behavior if account quota is exhausted. The game's private account endpoints still require session verification. [Neon adapter toolkit](https://github.com/neondatabase/neon-pkgs/blob/main/packages/auth/BUILDING-AN-ADAPTER.md).

### Local development and backups

- Run `npm run dev` for regular guest development. Run `npm run test:e2e -- --project accounts` for the local browser flow with a fixture provider and isolated PGlite. It needs no provider or database credentials. Build the shared workspace first if running the fixture directly.
- For real local OAuth, migrate an isolated Neon branch, enable Google there, and add `http://localhost:5173` as a trusted domain. Set the branch's runtime `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and `PLANETFALL_ACCOUNT_ORIGIN=http://localhost:5173` in the server process environment. Vite proxies the account routes locally. Browse that exact origin. If your browser declines secure cookies on localhost, use a trusted local HTTPS frontend and configure that exact origin instead.
- Keep one authoritative Render process. Take encrypted, access-restricted backups of the Planetfall ledger and links. Follow Neon's managed Auth backup procedures to preserve the related identity namespace. Validate restoration on an isolated branch and document the provider mapping before changing branch endpoints or restoring production. The Free point-in-time restore window is short, so keep offline logical backups for longer retention. [Neon restore documentation](https://neon.com/docs/introduction/branch-restore).

### Free-tier limits

- **Neon Free** costs $0 within the plan limits. The current plan includes Auth up to 60,000 monthly active users per project, 100 compute unit-hours per project, 1 GB PostgreSQL storage per project (20 GB account-wide), 5 GB public transfer per project, 10 branches per project and up to six hours of restore history. More capacity or longer managed retention can require an upgrade. [Neon plans](https://neon.com/docs/introduction/plans).
- **Cloudflare Pages + Workers Free** includes 100,000 daily dynamic requests shared with the account's Workers. The build's `_routes.json` keeps static assets out of that request pool. Additional dynamic quota requires a paid Workers plan. [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/).
- **Render Free** has 750 instance hours per workspace per month, spins down after 15 idle minutes and uses ephemeral files. Its bandwidth and build quotas can cause suspension or charges depending on billing setup, and external database/provider traffic is also subject to service limits. Use Neon PostgreSQL for durable profiles. [Render Free limits](https://render.com/docs/free).

## Local release verification

Use Node 22, the current working tree, and a quiet machine representative of
the intended server CPU. Keep browser runs, builds, and performance checks
separate when measuring CPU budgets. The browser suite starts isolated test
services and a local account provider.

```sh
npm ci
npm exec -- playwright install chromium
npm run typecheck
npm run build
npm test
npm run test:e2e -- --workers=1
npm run test:e2e:production
git diff --check
```

The full browser command includes the gameplay and account projects. It uses
full Chromium in headless mode so WebGL can use the host GPU where available.
Record the actual renderer when interpreting timing failures. The production
smoke builds the same checkout, then serves the bundled client
through Vite preview and connects it to the compiled local server. Its account
and profile state is isolated. It uses port 15175 and fails if the intended test
is missing, the build or service fails, or a gameplay assertion fails.
The production smoke uses the same full Chromium selection as the gameplay
suite. The default headless shell uses SwiftShader on the Windows rehearsal
host and exceeded the existing smoke deadline during UI interaction.

Run the native PostgreSQL check with `PLANETFALL_TEST_PG_URL` set to a
disposable loopback PostgreSQL database with permission to create temporary
schemas and roles. Keep hosted credentials out of this verification.

```sh
npm exec -- vitest run --configLoader native --no-file-parallelism server/src/profile-migrations.test.ts server/src/profile-postgres.test.ts
```

Run the following command three times consecutively on the representative
server CPU. Each run must meet the existing 8 ms mean and 16 ms p95 budgets.
Archive `.local-runtime/pg-metrics/modes-server-planetzombies.json` after each
run before the next overwrites it. Retain p50, p95, p99, maximum and workload
counts, including failed runs. The budget covers synchronous wall-clock
server update time, including snapshot construction and size measurement.

```sh
npm exec -- vitest run --configLoader native --no-file-parallelism server/src/modes/planet-gun/pg-modes-performance.test.ts -t "planetzombies full roster"
```

GitHub CI currently runs dependency install, typecheck, build and the
unit/system command. Browser E2E, the compiled smoke, native PostgreSQL
verification and the three-run hardware confirmation are separate release
checks. The native cases are conditional in the unit suite, so require them
to execute on the isolated database before release.

## Hosted release gate

For the first transactional-persistence release, complete the
[final production preflight](RELEASE_PREFLIGHT.md) and its read-only database
checks before the separately authorized [maintenance cutover](RELEASE_CUTOVER.md).

Record the tested commit, Pages URL, Render URL, browsers, and results before publishing the GitHub release:

- Cold start: open Pages after Render has been idle. Confirm the waking/reconnecting status appears and connection recovers. If bounded retries are exhausted, reload after the service is awake.
- Two separate browser/device sessions: create, join, ready, start, move, collect scrap, fire both weapons, observe matching damage, eliminate a planet, see results, vote for rematch, and start again.
- Solo: Play Solo creates one human and three bots. Observe bot movement, collection, attacks, repairs, match completion, and rematch.
- Reconnect: interrupt a human's network during a match, restore it within 30 seconds, and confirm the same slot and state return.
- Capacity: play with six participants, using humans and/or bots, and check movement, snapshots, projectiles, and responsiveness.
- Restart: restart Render with a room open. Confirm the client reports that the room closed, returns home, and can create another room.
- Transport: `/health` returns `ok: true`, the Pages origin connects over WebSocket, and an unlisted browser origin is rejected.

The local automated tests cover server behavior and browser launch flows. They do not replace a hosted match across real networks or establish a desktop performance target.

## Reference

- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Render web services](https://render.com/docs/web-services)
- [Render WebSockets](https://render.com/docs/websocket)
- [Render Free limitations](https://render.com/docs/free)
