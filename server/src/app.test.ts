import { afterEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { BALANCE, cannonPosition, type ClientToServerEvents, type JoinResult, type RoomView, type ServerToClientEvents } from "@planetfall/shared";
import { createPlanetfallServer } from "./app.js";

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const clients: TestSocket[] = [];
const servers: Awaited<ReturnType<typeof createPlanetfallServer>>[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  for (const server of servers.splice(0)) await server.close();
});

async function setup() {
  const server = await createPlanetfallServer({ port: 0, host: "127.0.0.1", nodeEnv: "test", clientOrigins: ["http://test.local"] });
  servers.push(server);
  const address = await server.listen();
  return { server, ...address };
}

async function client(url: string): Promise<TestSocket> {
  const socket = connect(url, { transports: ["websocket"], extraHeaders: { Origin: "http://test.local" }, forceNew: true });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("connect timeout")), 3000);
    socket.once("connect", () => { clearTimeout(timeout); resolve(); });
    socket.once("connect_error", reject);
  });
  return socket;
}

function createRoom(socket: TestSocket, name: string): Promise<JoinResult> {
  return new Promise((resolve) => socket.emit("room:create", { name }, resolve));
}
function createSolo(socket: TestSocket, name: string): Promise<JoinResult> {
  return new Promise((resolve) => socket.emit("room:solo", { name }, resolve));
}
function joinRoom(socket: TestSocket, code: string, name: string): Promise<JoinResult> {
  return new Promise((resolve) => socket.emit("room:join", { code, name }, resolve));
}
function waitForRoom(socket: TestSocket, predicate: (room: RoomView) => boolean, timeoutMs = 6000): Promise<RoomView> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off("room:state", handler); reject(new Error("room state timeout")); }, timeoutMs);
    const handler = (room: RoomView) => {
      if (!predicate(room)) return;
      clearTimeout(timeout); socket.off("room:state", handler); resolve(room);
    };
    socket.on("room:state", handler);
  });
}

describe("Planetfall multiplayer server", () => {
  it("starts solo quick play through the normal room flow", async () => {
    const { url } = await setup();
    const human = await client(url);
    const result = await createSolo(human, "Chris");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.phase).toBe("countdown");
    expect(result.room.players).toHaveLength(4);
    expect(result.room.players.filter((player) => player.isBot)).toHaveLength(3);
    expect(result.room.players.every((player) => player.ready)).toBe(true);
    expect(result.room.planets).toHaveLength(4);
  });

  it("lets the host add and remove bots without changing human multiplayer", async () => {
    const { url } = await setup();
    const host = await client(url); const guest = await client(url);
    const created = await createRoom(host, "Chris");
    if (!created.ok) throw new Error(created.error);
    const added = waitForRoom(host, (next) => next.players.some((player) => player.isBot));
    host.emit("room:bot:add");
    const withBot = await added;
    const bot = withBot.players.find((player) => player.isBot)!;
    const joined = await joinRoom(guest, created.room.code, "Friend");
    expect(joined.ok).toBe(true);
    const removed = waitForRoom(host, (next) => !next.players.some((player) => player.id === bot.id));
    host.emit("room:bot:remove", { botId: bot.id });
    const humansOnly = await removed;
    expect(humansOnly.players).toHaveLength(2);
    expect(humansOnly.players.every((player) => !player.isBot)).toBe(true);
  });

  it("lets bots collect scrap and fire through authoritative actions", async () => {
    const { url, server } = await setup();
    const human = await client(url);
    const result = await createSolo(human, "Chris");
    if (!result.ok) throw new Error(result.error);
    const room = server.manager.rooms.get(result.room.code)!;
    const bot = [...room.players.values()].find((player) => player.isBot)!;
    const initialScrap = bot.scrap;
    room.scraps.set("test-scrap", { id: "test-scrap", planetId: bot.planetId, position: { ...bot.position } });
    room.phase = "playing";
    room.update(1 / BALANCE.serverRate, Date.now());
    expect(bot.scrap).toBe(initialScrap + BALANCE.scrapValue);
    room.scraps.clear();

    const fired = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("bot fire timeout")), 2000);
      human.on("projectile:spawned", (projectile) => {
        if (!room.players.get(projectile.ownerId)?.isBot) return;
        clearTimeout(timeout); resolve();
      });
    });
    const ownPlanet = room.planets.get(bot.planetId)!;
    const targetPlanet = [...room.planets.values()].find((planet) => planet.ownerId !== bot.id)!;
    const cannon = cannonPosition(ownPlanet);
    bot.position = { ...cannon };
    bot.body.setTranslation(cannon, true);
    const delta = {
      x: targetPlanet.position.x - cannon.x,
      y: targetPlanet.position.y - cannon.y,
      z: targetPlanet.position.z - cannon.z
    };
    const magnitude = Math.hypot(delta.x, delta.y, delta.z);
    room.fire(bot.id, "rocket", { x: delta.x / magnitude, y: delta.y / magnitude, z: delta.z / magnitude });
    await fired;
    expect([...room.players.values()].filter((player) => player.isBot).some((player) => player.scrap < BALANCE.startingScrap + BALANCE.scrapValue)).toBe(true);
  });

  it("runs bot overtime and rematches without rebuilding the room", async () => {
    const { url, server } = await setup();
    const human = await client(url);
    const result = await createSolo(human, "Chris");
    if (!result.ok) throw new Error(result.error);
    const room = server.manager.rooms.get(result.room.code)!;
    const overtime = waitForRoom(human, (next) => next.phase === "overtime");
    room.phase = "playing";
    room.matchEndsAt = Date.now() - 1;
    room.update(1 / BALANCE.serverRate, Date.now());
    expect((await overtime).matchEndsAt).not.toBeNull();

    room.phase = "results";
    room.winnerId = result.playerId;
    const lobby = waitForRoom(human, (next) => next.phase === "lobby");
    human.emit("match:rematch");
    const reset = await lobby;
    expect(reset.code).toBe(result.room.code);
    expect(reset.players.filter((player) => player.isBot)).toHaveLength(3);
    expect(reset.players.find((player) => player.id === result.playerId)?.ready).toBe(false);
  });

  it("completes a mixed match by destruction and keeps the room for a rematch", async () => {
    const { url, server } = await setup();
    const human = await client(url);
    const created = await createRoom(human, "Chris");
    if (!created.ok) throw new Error(created.error);
    const room = server.manager.rooms.get(created.room.code)!;
    const botId = room.addBot(created.playerId)!;
    human.emit("room:ready", { ready: true });
    await waitForRoom(human, (next) => next.players.every((player) => player.ready));
    const playing = waitForRoom(human, (next) => next.phase === "playing");
    human.emit("match:start");
    await playing;
    const target = room.planets.get(room.players.get(botId)!.planetId)!;
    target.integrity = BALANCE.weapons.rocket.damage;
    const origin = cannonPosition(room.planets.get(room.players.get(created.playerId)!.planetId)!);
    const delta = { x: target.position.x - origin.x, y: target.position.y - origin.y, z: target.position.z - origin.z };
    const magnitude = Math.hypot(delta.x, delta.y, delta.z);
    const ended = new Promise<string | null>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("mixed match end timeout")), 5000);
      human.once("match:ended", ({ winnerId }) => { clearTimeout(timeout); resolve(winnerId); });
    });
    human.emit("cannon:fire", { weapon: "rocket", direction: { x: delta.x / magnitude, y: delta.y / magnitude, z: delta.z / magnitude } });
    expect(await ended).toBe(created.playerId);
    const lobby = waitForRoom(human, (next) => next.phase === "lobby");
    human.emit("match:rematch");
    expect((await lobby).players).toHaveLength(2);
  }, 14000);

  it("creates rooms, joins players, and migrates the host", async () => {
    const { url } = await setup();
    const first = await client(url); const second = await client(url);
    const created = await createRoom(first, "Nova");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.room.code).toMatch(/^[A-Z2-9]{6}$/);
    const joined = await joinRoom(second, created.room.code, "Orbit");
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    const hostChanged = waitForRoom(second, (room) => room.hostId === joined.playerId);
    first.disconnect();
    expect((await hostChanged).hostId).toBe(joined.playerId);
  });

  it("runs an authoritative match and applies projectile damage", async () => {
    const { url } = await setup();
    const first = await client(url); const second = await client(url);
    const created = await createRoom(first, "Nova");
    if (!created.ok) throw new Error(created.error);
    const joined = await joinRoom(second, created.room.code, "Orbit");
    if (!joined.ok) throw new Error(joined.error);
    const playing = waitForRoom(first, (room) => room.phase === "playing");
    first.emit("room:ready", { ready: true }); second.emit("room:ready", { ready: true });
    await waitForRoom(first, (room) => room.players.every((p) => p.ready));
    first.emit("match:start");
    const active = await playing;
    const shooter = active.players.find((p) => p.id === created.playerId)!;
    const target = active.planets.find((p) => p.ownerId === joined.playerId)!;
    const cannon = { x: active.planets.find((p) => p.ownerId === shooter.id)!.position.x, y: 9.15, z: active.planets.find((p) => p.ownerId === shooter.id)!.position.z };
    const delta = { x: target.position.x - cannon.x, y: target.position.y - cannon.y, z: target.position.z - cannon.z };
    const mag = Math.hypot(delta.x, delta.y, delta.z);
    const damaged = new Promise<{ planetId: string; integrity: number; amount: number }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("projectile damage timeout")), 5000);
      second.once("planet:damaged", (payload) => { clearTimeout(timeout); resolve(payload); });
    });
    first.emit("cannon:fire", { weapon: "rocket", direction: { x: delta.x / mag, y: delta.y / mag, z: delta.z / mag } });
    const hit = await damaged;
    expect(hit.planetId).toBe(target.id);
    expect(hit.amount).toBe(14);
    expect(hit.integrity).toBe(86);
  }, 12000);

  it("exposes health and denies unlisted production origins", async () => {
    const { url } = await setup();
    const health = await fetch(`${url}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, rooms: 0 });
    const denied = await fetch(`${url}/health`, { headers: { Origin: "https://not-allowed.example" } });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
    const deniedSocket = connect(url, {
      transports: ["websocket"], extraHeaders: { Origin: "https://not-allowed.example" }, forceNew: true, reconnection: false, timeout: 1200
    });
    clients.push(deniedSocket);
    const rejected = await new Promise<boolean>((resolve) => {
      deniedSocket.once("connect", () => resolve(false));
      deniedSocket.once("connect_error", () => resolve(true));
    });
    expect(rejected).toBe(true);
  });
});
