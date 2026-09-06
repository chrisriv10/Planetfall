import { afterEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { BALANCE, cannonPosition, repairPosition, type ClientToServerEvents, type JoinResult, type RoomView, type ServerToClientEvents } from "@planetfall/shared";
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
function joinRoom(socket: TestSocket, code: string, name: string, sessionToken?: string): Promise<JoinResult> {
  return new Promise((resolve) => socket.emit("room:join", { code, name, sessionToken }, resolve));
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
    expect(result.room.matchStats).toHaveLength(4);
    expect(result.room.matchStats.every((stats) => stats.damageDealt === 0 && stats.scrapCollected === 0)).toBe(true);
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

  it("moves and repairs bots through the live room simulation", async () => {
    const { url, server } = await setup();
    const human = await client(url);
    const created = await createSolo(human, "Chris");
    if (!created.ok) throw new Error(created.error);
    const room = server.manager.rooms.get(created.room.code)!;
    room.phase = "playing";
    const bots = [...room.players.values()].filter((player) => player.isBot);
    const initialPositions = new Map(bots.map((bot) => [bot.id, { ...bot.position }]));
    const start = Date.now();
    for (let index = 0; index < 180; index++) room.update(1 / BALANCE.serverRate, start + index * (1000 / BALANCE.serverRate));
    expect(bots.some((bot) => Math.hypot(bot.position.x - initialPositions.get(bot.id)!.x, bot.position.y - initialPositions.get(bot.id)!.y, bot.position.z - initialPositions.get(bot.id)!.z) > 0.25)).toBe(true);

    const repairingBot = bots[0];
    const planet = room.planets.get(repairingBot.planetId)!;
    planet.integrity = 1;
    repairingBot.scrap = BALANCE.startingScrap;
    const station = repairPosition(planet);
    repairingBot.position = { ...station };
    repairingBot.velocity = { x: 0, y: 0, z: 0 };
    repairingBot.body.setTranslation(station, true);
    for (let index = 0; index < 120 && planet.integrity === 1; index++) {
      repairingBot.position = { ...station };
      repairingBot.velocity = { x: 0, y: 0, z: 0 };
      repairingBot.body.setTranslation(station, true);
      room.update(1 / BALANCE.serverRate, start + 10_000 + index * 100);
    }
    expect(planet.integrity).toBeGreaterThan(1);
    expect(repairingBot.scrap).toBeLessThan(BALANCE.startingScrap);
  });

  it("collects scrap and repairs through authoritative human actions", async () => {
    const { url, server } = await setup();
    const human = await client(url);
    const created = await createRoom(human, "Chris");
    if (!created.ok) throw new Error(created.error);
    const room = server.manager.rooms.get(created.room.code)!;
    room.addBot(created.playerId);
    room.phase = "playing";
    const player = room.players.get(created.playerId)!;
    room.scraps.set("human-scrap", { id: "human-scrap", planetId: player.planetId, position: { ...player.position } });
    room.update(1 / BALANCE.serverRate, Date.now());
    expect(player.scrap).toBe(BALANCE.startingScrap + BALANCE.scrapValue);
    expect(room.view().matchStats.find((stats) => stats.playerId === player.id)).toMatchObject({ scrapCollected: BALANCE.scrapValue, stolenScrap: 0 });

    const planet = room.planets.get(player.planetId)!;
    planet.integrity = 50;
    const station = repairPosition(planet);
    player.position = { ...station };
    player.body.setTranslation(station, true);
    const repaired = new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("repair timeout")), 2000);
      human.once("planet:repaired", ({ integrity }) => { clearTimeout(timeout); resolve(integrity); });
    });
    human.emit("repair:buy");
    expect(await repaired).toBe(65);
    expect(player.scrap).toBe(BALANCE.startingScrap + BALANCE.scrapValue - BALANCE.repair.cost);
    expect(room.view().matchStats.find((stats) => stats.playerId === player.id)).toMatchObject({ repairsPerformed: 1, integrityRepaired: 15 });
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
    const overtimeState = await overtime;
    expect(overtimeState.matchEndsAt).not.toBeNull();
    const overtimeEndsAt = overtimeState.matchEndsAt!;

    const shooter = room.players.get(result.playerId)!;
    const origin = cannonPosition(room.planets.get(shooter.planetId)!);
    shooter.position = { ...origin };
    shooter.body.setTranslation(origin, true);
    const target = [...room.planets.values()].find((planet) => planet.ownerId !== result.playerId)!;
    const delta = { x: target.position.x - origin.x, y: target.position.y - origin.y, z: target.position.z - origin.z };
    const magnitude = Math.hypot(delta.x, delta.y, delta.z);
    const doubledDamage = new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("overtime damage timeout")), 4000);
      const handler = (payload: { planetId: string; amount: number }) => {
        if (payload.planetId !== target.id) return;
        clearTimeout(timeout); human.off("planet:damaged", handler); resolve(payload.amount);
      };
      human.on("planet:damaged", handler);
    });
    room.fire(result.playerId, "rocket", { x: delta.x / magnitude, y: delta.y / magnitude, z: delta.z / magnitude });
    expect(await doubledDamage).toBe(BALANCE.weapons.rocket.damage * 2);

    for (const planet of room.planets.values()) planet.integrity = 50;
    room.update(1 / BALANCE.serverRate, overtimeEndsAt + 1);
    expect(room.phase).toBe("results");
    expect(room.matchResult).toMatchObject({ winnerId: null, reason: "timer" });

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
    const { url, server } = await setup();
    const first = await client(url); const second = await client(url);
    const created = await createRoom(first, "Nova");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.room.code).toMatch(/^[A-Z2-9]{6}$/);
    const botId = server.manager.rooms.get(created.room.code)!.addBot(created.playerId)!;
    const joined = await joinRoom(second, created.room.code, "Friend");
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    const hostChanged = waitForRoom(second, (room) => room.hostId === joined.playerId);
    first.disconnect();
    const migrated = await hostChanged;
    expect(migrated.hostId).toBe(joined.playerId);
    expect(migrated.hostId).not.toBe(botId);
  });

  it("restores the same player within the reconnect grace period", async () => {
    const { url, server } = await setup();
    const host = await client(url); const guest = await client(url);
    const created = await createRoom(host, "Nova");
    if (!created.ok) throw new Error(created.error);
    const joined = await joinRoom(guest, created.room.code, "Orbit");
    if (!joined.ok) throw new Error(joined.error);
    const room = server.manager.rooms.get(created.room.code)!;
    room.phase = "playing";
    const record = room.players.get(joined.playerId)!;
    record.position = { x: 7, y: 8, z: 9 };
    guest.disconnect();
    await waitForRoom(host, (next) => next.players.find((player) => player.id === joined.playerId)?.connected === false);

    const returning = await client(url);
    const resumed = await joinRoom(returning, created.room.code, "Orbit", joined.sessionToken);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.playerId).toBe(joined.playerId);
    const restored = resumed.room.players.find((player) => player.id === joined.playerId)!;
    expect(restored.connected).toBe(true);
    expect(Math.hypot(restored.position.x - 7, restored.position.y - 8, restored.position.z - 9)).toBeLessThan(0.1);
  });

  it("eliminates an expired disconnect and rejects the expired session", async () => {
    const { url, server } = await setup();
    const host = await client(url); const guest = await client(url);
    const created = await createRoom(host, "Nova");
    if (!created.ok) throw new Error(created.error);
    const joined = await joinRoom(guest, created.room.code, "Orbit");
    if (!joined.ok) throw new Error(joined.error);
    const room = server.manager.rooms.get(created.room.code)!;
    room.phase = "playing";
    guest.disconnect();
    await waitForRoom(host, (next) => next.players.find((player) => player.id === joined.playerId)?.connected === false);
    room.players.get(joined.playerId)!.disconnectedAt = Date.now() - BALANCE.reconnectGraceMs - 1;
    const ended = waitForRoom(host, (next) => next.phase === "results");
    room.update(1 / BALANCE.serverRate, Date.now());
    const result = await ended;
    expect(result.winnerId).toBe(created.playerId);
    expect(result.players.some((player) => player.id === joined.playerId)).toBe(false);
    expect(result.planets.find((planet) => planet.ownerId === joined.playerId)?.alive).toBe(false);

    const lateSocket = await client(url);
    const lateJoin = await joinRoom(lateSocket, created.room.code, "Orbit", joined.sessionToken);
    expect(lateJoin.ok).toBe(false);
  });

  it("deletes bot-only rooms after the final human grace period", async () => {
    const { url, server } = await setup();
    const human = await client(url);
    const created = await createSolo(human, "Chris");
    if (!created.ok) throw new Error(created.error);
    const room = server.manager.rooms.get(created.room.code)!;
    human.disconnect();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("disconnect timeout")), 1000);
      const poll = setInterval(() => {
        if (room.players.get(created.playerId)?.connected !== false) return;
        clearTimeout(timeout); clearInterval(poll); resolve();
      }, 10);
    });
    room.players.get(created.playerId)!.disconnectedAt = Date.now() - BALANCE.reconnectGraceMs - 1;
    room.update(1 / BALANCE.serverRate, Date.now());
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("room cleanup timeout")), 2000);
      const poll = setInterval(() => {
        if (server.manager.rooms.has(created.room.code)) return;
        clearTimeout(timeout); clearInterval(poll); resolve();
      }, 20);
    });
    expect(server.manager.rooms.has(created.room.code)).toBe(false);
  });

  it("supports six participants and rejects a seventh", async () => {
    const { url } = await setup();
    const sockets = await Promise.all(Array.from({ length: 7 }, () => client(url)));
    const created = await createRoom(sockets[0], "Pilot 1");
    if (!created.ok) throw new Error(created.error);
    const members: Array<{ socket: TestSocket; result: Extract<JoinResult, { ok: true }> }> = [{ socket: sockets[0], result: created }];
    for (let index = 1; index < 6; index++) {
      const result = await joinRoom(sockets[index], created.room.code, `Pilot ${index + 1}`);
      if (!result.ok) throw new Error(result.error);
      members.push({ socket: sockets[index], result });
    }
    const overflow = await joinRoom(sockets[6], created.room.code, "Pilot 7");
    expect(overflow.ok).toBe(false);
    expect(members.at(-1)!.result.room.players).toHaveLength(6);
    expect(new Set(members.at(-1)!.result.room.planets.map((planet) => `${planet.position.x.toFixed(3)}:${planet.position.z.toFixed(3)}`)).size).toBe(6);

    for (const member of members) member.socket.emit("room:ready", { ready: true });
    await waitForRoom(sockets[0], (next) => next.players.every((player) => player.ready));
    const playing = waitForRoom(sockets[0], (next) => next.phase === "playing");
    sockets[0].emit("match:start");
    const active = await playing;
    const snapshot = await new Promise<RoomView["players"]>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("six-player snapshot timeout")), 2000);
      sockets[0].once("match:snapshot", (next) => { clearTimeout(timeout); resolve(next.players); });
    });
    expect(snapshot).toHaveLength(6);

    const shooter = active.players.find((player) => player.id === created.playerId)!;
    const origin = cannonPosition(active.planets.find((planet) => planet.id === shooter.planetId)!);
    const target = active.planets.find((planet) => planet.ownerId === members[1].result.playerId)!;
    const delta = { x: target.position.x - origin.x, y: target.position.y - origin.y, z: target.position.z - origin.z };
    const magnitude = Math.hypot(delta.x, delta.y, delta.z);
    const damaged = new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("six-player projectile timeout")), 4000);
      const handler = (payload: { planetId: string; amount: number }) => {
        if (payload.planetId !== target.id) return;
        clearTimeout(timeout); sockets[0].off("planet:damaged", handler); resolve(payload.amount);
      };
      sockets[0].on("planet:damaged", handler);
    });
    sockets[0].emit("cannon:fire", { weapon: "rocket", direction: { x: delta.x / magnitude, y: delta.y / magnitude, z: delta.z / magnitude } });
    expect(await damaged).toBe(BALANCE.weapons.rocket.damage);
  }, 12000);

  it("resets repeated rematches without duplicating room state or listeners", async () => {
    const { url, server } = await setup();
    const human = await client(url);
    const created = await createSolo(human, "Chris");
    if (!created.ok) throw new Error(created.error);
    const room = server.manager.rooms.get(created.room.code)!;
    const listenerCount = human.listeners("room:state").length;
    for (let index = 0; index < 3; index++) {
      room.phase = "results";
      room.winnerId = created.playerId;
      const lobby = waitForRoom(human, (next) => next.phase === "lobby");
      human.emit("match:rematch");
      const reset = await lobby;
      expect(reset.players).toHaveLength(4);
      expect(reset.planets).toHaveLength(4);
      expect(reset.scraps).toHaveLength(0);
      expect(server.manager.rooms.size).toBe(1);
    }
    expect(human.listeners("room:state").length).toBe(listenerCount);
  });

  it("ignores malformed commands and prevents one socket from leaking rooms", async () => {
    const { url, server } = await setup();
    const socket = await client(url);
    const created = await createRoom(socket, "Nova");
    if (!created.ok) throw new Error(created.error);
    (socket as unknown as { emit: (event: string, payload?: unknown) => void }).emit("room:ready", null);
    (socket as unknown as { emit: (event: string, payload?: unknown) => void }).emit("player:input", null);
    (socket as unknown as { emit: (event: string, payload?: unknown) => void }).emit("cannon:fire", null);
    (socket as unknown as { emit: (event: string, payload?: unknown) => void }).emit("room:create", { name: "Duplicate" });
    const duplicate = await createRoom(socket, "Duplicate");
    expect(duplicate).toMatchObject({ ok: false, error: "Already in a room." });
    expect(server.manager.rooms.size).toBe(1);
    expect((await fetch(`${url}/health`)).status).toBe(200);
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
