# Planetfall

Planetfall is a browser-based 3D party game for 2-6 pilots. Run around tiny worlds, collect scrap, and blast rival planets. Play with friends, mix people and bots, or jump straight into a solo match.

The MVP is intentionally self-contained: no accounts, database, persistence, Docker, or paid multiplayer service.

## Play locally

Requirements: Node.js 22 and npm 10 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The server runs at [http://localhost:3000](http://localhost:3000). Choose Play Solo for a quick match against three bots, or open a second browser window to test multiplayer.

### Controls

| Input | Action |
| --- | --- |
| `WASD` | Run around the current planet |
| Mouse | Aim and control the camera |
| `Space` | Jump |
| `Shift` | Short burst/dive |
| Left click | Fire while beside your cannon |
| Right click | Grapple a planet surface |
| `Q` | Switch rocket/asteroid |
| `R` | Repair while beside your repair core |
| `←` / `→` | Cycle planets while spectating |

Click the 3D arena once to capture the mouse. Press `Esc` to release it.

## Game rules

- Rooms support 2-6 humans and bots. The host can add or remove bots before launch.
- Play Solo creates a normal server room with one human and three bots. It does not use a separate game mode or simulation.
- Every player begins with 20 scrap and 100 planet integrity. Scrap crystals respawn around intact planets.
- Rockets cost 8 scrap and deal 14 damage. Heavy asteroids cost 16 and deal 26 damage with stronger knockback.
- Repairs cost 10 scrap and restore 15 integrity. Repairs are disabled in overtime.
- Matches last seven minutes. A timer tie begins a 30-second overtime with double damage.
- Destroyed pilots enter spectator mode. A unanimous rematch vote returns everyone to the same lobby.

## Architecture

This repository uses npm workspaces:

```text
client/   Vite + TypeScript + Three.js + Rapier + Socket.IO client
server/   Node.js + Express + Socket.IO + Rapier authoritative simulation
shared/   Event contracts, snapshots, game types, vector math, and balance constants
```

The server owns room membership, readiness, match phase, player simulation, scrap, projectile collision, planet integrity, elimination, and the winner. Clients send sequenced input at 20 Hz, predict their own movement, interpolate other players, and render visual-only particles and debris. The server simulates at 30 Hz and sends snapshots at 15 Hz. Projectile spawn/explosion events avoid replicating every visual rigid body.

Room state exists only in server memory. A room disappears when all human players leave, when a free host restarts, or when a new deploy replaces the process. Session tokens in `sessionStorage` allow a player to reclaim their slot for 30 seconds after an ordinary connection interruption.

## Commands

```bash
npm run dev       # shared watch + server + Vite client
npm run build     # production builds for all workspaces
npm test          # unit and Socket.IO integration tests
npm run test:e2e  # human multiplayer and solo bot browser tests
npm start         # run the compiled multiplayer server
```

The first Playwright run on a new machine also needs `npx playwright install chromium`.

## Music credit

"Bot City" from [My Little Bots](https://davidkbd.itch.io/my-little-bots-crazy-music-for-robots-asset-pack) by David KBD is used under the [Creative Commons Attribution 4.0 license](https://creativecommons.org/licenses/by/4.0/). The loop is stored at `client/public/audio/bot-city.ogg` and starts after the first player interaction.

## Environment variables

Copy the example files when custom local values are needed. Development defaults work without a `.env` file.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `VITE_SERVER_URL` | Client build | Socket.IO server URL; defaults to `http://localhost:3000` in development and must be set to the Render URL for Pages |
| `CLIENT_ORIGIN` | Server | Allowed browser origin; use the final Pages URL in production |
| `PORT` | Server | HTTP and WebSocket port; defaults to `3000` locally |
| `NODE_ENV` | Server | Set to `production` on Render to disable implicit localhost CORS |

Multiple comma-separated values are accepted in `CLIENT_ORIGIN`, which is useful for a production domain plus a temporary Pages preview URL.

## Deploy the backend to Render

`render.yaml` contains a ready-to-use free Web Service definition. To configure it manually:

1. In Render, choose **New → Web Service**, connect this GitHub repository, and select the Free plan.
2. Keep the repository root as the service root.
3. Set the build command to:

   ```bash
   npm ci && npm run build -w @planetfall/shared && npm run build -w @planetfall/server
   ```

4. Set the start command to:

   ```bash
   npm run start -w @planetfall/server
   ```

5. Set `NODE_VERSION=22.22.0`, `NODE_ENV=production`, and `CLIENT_ORIGIN=https://YOUR-PAGES-SITE.pages.dev`.
6. Set the health check path to `/health` and deploy. Render supplies `PORT`; the server binds it on `0.0.0.0`.

Copy the resulting `https://YOUR-SERVICE.onrender.com` URL. Free Render services can take roughly a minute to wake after being idle, and any rooms in memory are lost when the process restarts.

## Deploy the frontend to Cloudflare Pages

Deploy the Render service first so its public URL can be injected into the static client build.

1. In Cloudflare, open **Workers & Pages → Create → Pages → Import an existing Git repository** and select this repository.
2. Use `/` as the root directory.
3. Set the build command to:

   ```bash
   npm ci && npm run build -w @planetfall/shared && npm run build -w @planetfall/client
   ```

4. Set the build output directory to `client/dist`.
5. Add `VITE_SERVER_URL=https://YOUR-SERVICE.onrender.com` to both production and preview environment variables. This value is required because the static Pages origin does not host the multiplayer server.
6. Deploy, then copy the Pages URL back into Render's `CLIENT_ORIGIN` and redeploy the server.

No production URL is hardcoded. Cloudflare rebuilds the static client on repository pushes, while Render rebuilds the authoritative server independently.

## Verification checklist

- Start Play Solo and confirm three bots move, collect scrap, fire, and repair.
- Create and join a human-only room from at least two separate browser contexts.
- Add a bot to a human lobby, remove it, then run a mixed match.
- Walk across the top, side, and underside of a planet; jump near poles and recover with the grapple.
- Fire both weapons and confirm both clients show the same damage and elimination.
- Spend scrap on repairs and confirm integrity updates for every client.
- Disconnect and reconnect within 30 seconds; then test host migration.
- Complete a match, spectate, vote for a rematch, and launch again.
- Run `npm run build`, `npm test`, and `npm run test:e2e` before deployment.
- After deployment, visit `/health`, create a real WebSocket room, and verify the Pages origin is accepted while other origins are rejected.
