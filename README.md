# PLANETFALL

[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-3D-000000?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-multiplayer-010101?logo=socketdotio&logoColor=white)](https://socket.io/)

Planetfall is a browser-based 3D party game about tiny planets, scrap, cannons, and chaotic last-pilot-standing matches.

Play solo with bots or bring 2–6 players into the same room. Run across spherical worlds, repair your planet, grapple through the arena, and blast rivals before your world breaks apart.

## Run it

Requires Node.js 22 and npm 10 or newer.

```bash
npm ci
npm run dev
```

The development server prints the client address when it starts.

Choose **Play Solo** for a match with three bots, or **Create Room** and share the room code. In multiplayer, everyone selects **Ready** before the host starts.

Hosts can keep the original **Classic** rules or choose **Chaos** for one randomly selected round modifier. Winners earn session Crowns that last through rematches while the room stays open.

## Controls

| Input | Action |
| --- | --- |
| `WASD` | Move across any planet |
| Mouse | Aim and look |
| Mouse wheel | Cycle launch targets while aiming |
| `Space` | Jump |
| `Shift` | Burst |
| `Left click` | Fire your cannon |
| `Right click` | Grapple |
| `E` | Launch, shove, or hold to jam enemy structures |
| `Esc` | Cancel launch aiming |
| `Q` | Switch weapon |
| `R` | Repair your planet |

## Stack

Vite, TypeScript, Three.js, Rapier, Socket.IO, Express, and an in-memory authoritative server.

## Deploy

1. Deploy the Render server using [render.yaml](render.yaml), then copy its public URL.
2. Create a Cloudflare Pages project from this repository. Use the repository root, build command `npm ci && npm run build -w @planetfall/shared && npm run build -w @planetfall/client`, and output `client/dist`.
3. Set Pages' `VITE_SERVER_URL` to the Render URL before building and deploying.
4. Set Render's `CLIENT_ORIGIN` to the resulting Pages origin and redeploy the server.

See [deployment settings and hosted checks](docs/DEPLOYMENT.md) for the exact values and release checklist. A live demo link can be added here after those checks pass.

Rooms exist only in memory and disappear on server restart. Render Free may take about a minute to wake up. Desktop keyboard and mouse are supported.

## Validate

```bash
npm run typecheck
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

CI runs install, typecheck, build, and unit/integration tests on pushes and pull requests to `main`. Browser tests run locally on dedicated ports 15173 and 13000.

The proposed first release is documented in [v0.1.0 release notes](docs/releases/v0.1.0.md).

## Credits

Music: “Bot City” from [My Little Bots](https://davidkbd.itch.io/my-little-bots-crazy-music-for-robots-asset-pack) by David KBD, used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party notices.
