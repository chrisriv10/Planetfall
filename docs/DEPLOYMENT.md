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

Assets and music use paths from the site root, so serve the client at `/`. This is a single-page Vite app with no server routes; Pages' normal static/SPA behavior is sufficient. The Pages origin does not run the multiplayer server. Without `VITE_SERVER_URL`, the production client falls back to its own origin and cannot connect to the separate Render service.

Deploy and copy the resulting Pages URL.

## 3. Connect the origins

Set Render's `CLIENT_ORIGIN` to that Pages origin, with no trailing slash or path, then redeploy/restart the service. Include an exact custom domain or preview origin only when needed; multiple origins can be comma-separated. Production does not automatically permit localhost origins.

Deployments and restarts erase active rooms. Publish updates between play sessions.

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
