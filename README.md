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
npm install
npm run dev
```

The development server prints the client address when it starts.

## Controls

| Input | Action |
| --- | --- |
| `WASD` | Move around your planet |
| Mouse | Aim and look |
| `Space` | Jump |
| `Shift` | Burst |
| `Left click` | Fire your cannon |
| `Right click` | Grapple |
| `Q` | Switch weapon |
| `R` | Repair your planet |

## Stack

Vite, TypeScript, Three.js, Rapier, Socket.IO, Express, and an in-memory authoritative server.

## Credits

Music: “Bot City” from [My Little Bots](https://davidkbd.itch.io/my-little-bots-crazy-music-for-robots-asset-pack) by David KBD, used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party notices.
