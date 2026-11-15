# Deployment

Deploy one Render web service for the authoritative server and one Cloudflare Pages project for the static client. No live URLs are configured in the repository.

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

For saved Fallbucks, configure server-only `DATABASE_URL` with a durable
PostgreSQL database before hosted playtesting. The Free service's local files
are ephemeral; its file fallback cannot preserve wallets across sleep/restarts.
See [saved player profiles](PLAYER_PROFILES.md) for setup and acceptance checks.

Deploy and copy the public HTTPS service URL. Opening its `/health` path should return JSON with `ok: true`.

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

1. Back up the existing progression database. Enable **Managed Better Auth** on an isolated Neon branch that contains the progression schema. Use the branch's Auth base URL exactly as displayed. Auth data lives in the `neon_auth` schema. The application preserves `planetfall_guest_profiles` and adds `planetfall_account_links` at startup when accounts are enabled. [Neon Auth setup](https://neon.com/docs/auth/overview), [authentication flow](https://neon.com/docs/auth/authentication-flow).
2. Configure Google OAuth in that branch. For launch, use your own Google Cloud **Web application** OAuth client and configure the consent screen and any required test users or publishing steps. In Google Cloud, register the branch's exact authorized redirect URI, `{NEON_AUTH_BASE_URL}/callback/google`. Add the exact Pages origin to Neon Auth **Trusted Domains**. Planetfall's application callback is `<PAGES_ORIGIN>/api/account/complete`. Google redirects to Neon and Neon returns the browser to Planetfall. [Neon OAuth setup](https://neon.com/docs/auth/guides/setup-oauth), [Neon’s production checklist](https://neon.com/docs/auth/production-checklist).
3. Configure Render and Cloudflare Pages with the settings below. Use distinct random values of at least 32 characters for the two secrets. Scope both services to the same canonical HTTPS Pages origin. Keep the current public origin for the initial rollout so browsers can still read their existing guest credentials. Use separate Neon branches, secrets and origins for test and preview environments. Keep provider base URLs stable for a released branch because they namespace the account links.
4. After authorizing release, deploy the server and Pages from the same revision. Check `/health` for `profileStorage: "postgresql"`. Check the account endpoint through Pages. Confirm first-party `Secure`, `HttpOnly`, `SameSite=Lax` cookies and a clean address bar after the OAuth callback. Test guest play, Google consent, guest linking, a second device with a separate browser profile, existing-profile conflict, sign-out/switch, rewards and cosmetics after a restart, and blocked third-party cookies. Validate both cancellation and a temporarily unavailable provider.

| Where | Variable | Value |
| --- | --- | --- |
| Render secret | `DATABASE_URL` | Existing PostgreSQL connection string for the selected branch |
| Render | `NEON_AUTH_BASE_URL` | Managed Better Auth branch base URL |
| Render secret | `NEON_AUTH_COOKIE_SECRET` | Random secret for the Neon adapter |
| Render | `PLANETFALL_ACCOUNT_ORIGIN` | Exact Pages HTTPS origin, also listed in `CLIENT_ORIGIN` |
| Render and Pages runtime secrets | `PLANETFALL_ACCOUNT_GATEWAY_SECRET` | Same random value on both sides of the first-party proxy |
| Pages runtime | `ACCOUNT_SERVER_URL` | Public HTTPS base URL of your Render service |
| Pages build | `VITE_SERVER_URL` | Public HTTPS URL of the Render gameplay service |

Enter Google OAuth credentials in the Neon console and disable unused sign-in methods for the public branch. Keep database, cookie and gateway secrets out of Vite variables and source control. Planetfall pins `@neon/auth` and uses its framework-neutral server toolkit for the first-party proxy and callback exchange. The account proxy forwards only the allowed account routes and keeps credentials on the Pages origin. Turn off request URL or header logging for the OAuth callback and account routes if the host enables it. Limit changes to the canonical production origin and use fail-open static Pages behavior if account quota is exhausted. The game's private account endpoints still require session verification. [Neon adapter toolkit](https://github.com/neondatabase/neon-pkgs/blob/main/packages/auth/BUILDING-AN-ADAPTER.md).

### Local development and backups

- Run `npm run dev` for regular guest development. Run `npm run test:e2e -- --project accounts` for the local browser flow with a fixture provider and isolated PGlite. It needs no provider or database credentials. Build the shared workspace first if running the fixture directly.
- For real local OAuth, use an isolated Neon branch with Google enabled, add `http://localhost:5173` as a trusted domain, and set the local `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and `PLANETFALL_ACCOUNT_ORIGIN=http://localhost:5173` in the server process environment. Vite proxies the account routes locally. Browse that exact origin. If your browser declines secure cookies on localhost, use a trusted local HTTPS frontend and configure that exact origin instead.
- Keep one authoritative Render process. Take encrypted, access-restricted backups of the Planetfall ledger and links. Follow Neon's managed Auth backup procedures to preserve the related identity namespace. Validate restoration on an isolated branch and document the provider mapping before changing branch endpoints or restoring production. The Free point-in-time restore window is short, so keep offline logical backups for longer retention. [Neon restore documentation](https://neon.com/docs/introduction/branch-restore).

### Free-tier limits

- **Neon Free** costs $0 within the plan limits. The current plan includes Auth up to 60,000 monthly active users per project, 100 compute unit-hours per project, 1 GB PostgreSQL storage per project (20 GB account-wide), 5 GB public transfer per project, 10 branches per project and up to six hours of restore history. More capacity or longer managed retention can require an upgrade. [Neon plans](https://neon.com/docs/introduction/plans).
- **Cloudflare Pages + Workers Free** includes 100,000 daily dynamic requests shared with the account's Workers. The build's `_routes.json` keeps static assets out of that request pool. Additional dynamic quota requires a paid Workers plan. [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/).
- **Render Free** has 750 instance hours per workspace per month, spins down after 15 idle minutes and uses ephemeral files. Its bandwidth and build quotas can cause suspension or charges depending on billing setup, and external database/provider traffic is also subject to service limits. Use Neon PostgreSQL for durable profiles. [Render Free limits](https://render.com/docs/free).

## Hosted release gate

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
