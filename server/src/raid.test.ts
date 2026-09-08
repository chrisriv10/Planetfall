import { afterEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import {
  BALANCE,
  SHOP_CATALOG,
  add,
  cannonPosition,
  createMatchRules,
  distance,
  launchPadNormal,
  launchPadPosition,
  normalize,
  repairPosition,
  scale,
  sub,
  type ClientToServerEvents,
  type JoinResult,
  type ServerToClientEvents,
  type Vec3
} from "@planetfall/shared";
import { createPlanetfallServer } from "./app.js";

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const clients: TestSocket[] = [];
const servers: Awaited<ReturnType<typeof createPlanetfallServer>>[] = [];

afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect();
  for (const server of servers.splice(0)) await server.close();
});

async function openClient(url: string): Promise<TestSocket> {
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

function joinRoom(socket: TestSocket, code: string, name: string, sessionToken?: string): Promise<JoinResult> {
  return new Promise((resolve) => socket.emit("room:join", { code, name, sessionToken }, resolve));
}

async function duel() {
  const server = await createPlanetfallServer({ port: 0, host: "127.0.0.1", nodeEnv: "test", clientOrigins: ["http://test.local"] });
  servers.push(server);
  const { url } = await server.listen();
  const hostSocket = await openClient(url);
  const guestSocket = await openClient(url);
  const created = await createRoom(hostSocket, "Chris");
  if (!created.ok) throw new Error(created.error);
  const joined = await joinRoom(guestSocket, created.room.code, "Nova");
  if (!joined.ok) throw new Error(joined.error);
  const room = server.manager.rooms.get(created.room.code)!;
  room.phase = "playing";
  return {
    server, room, hostSocket, guestSocket, url,
    code: created.room.code, hostSessionToken: created.sessionToken,
    host: room.players.get(created.playerId)!, guest: room.players.get(joined.playerId)!,
    hostPlanet: room.planets.get(room.players.get(created.playerId)!.planetId)!,
    guestPlanet: room.planets.get(room.players.get(joined.playerId)!.planetId)!
  };
}

function place(player: Awaited<ReturnType<typeof duel>>["host"], position: Vec3, surfacePlanetId: string | null): void {
  player.position = { ...position };
  player.velocity = { x: 0, y: 0, z: 0 };
  player.surfacePlanetId = surfacePlanetId;
  player.body.setTranslation(position, true);
  player.body.setNextKinematicTranslation(position);
}

function padStandingPosition(planet: Awaited<ReturnType<typeof duel>>["hostPlanet"]): Vec3 {
  return add(planet.position, scale(launchPadNormal(planet), BALANCE.planetRadius + 0.95));
}

describe("planet raids", () => {
  it("validates launch-pad distance and enforces an authoritative per-player cooldown", async () => {
    const { room, host, hostPlanet, guestPlanet } = await duel();
    const now = Date.now();
    place(host, repairPosition(hostPlanet), hostPlanet.id);
    expect(room.launch(host.id, guestPlanet.id, now)).toBe(false);
    place(host, padStandingPosition(hostPlanet), hostPlanet.id);
    expect(distance(host.position, launchPadPosition(hostPlanet))).toBeLessThan(BALANCE.launch.range);
    expect(room.launch(host.id, guestPlanet.id, now)).toBe(true);
    expect(host.velocity).not.toEqual({ x: 0, y: 0, z: 0 });
    expect(host.launchCooldownUntil).toBe(now + BALANCE.launch.cooldownMs);
    place(host, padStandingPosition(hostPlanet), hostPlanet.id);
    expect(room.launch(host.id, guestPlanet.id, now + 1)).toBe(false);
  });

  it("flies through the normal movement loop and lands near the selected rival planet", async () => {
    const { room, host, hostPlanet, guestPlanet } = await duel();
    const now = Date.now();
    place(host, padStandingPosition(hostPlanet), hostPlanet.id);
    expect(room.launch(host.id, guestPlanet.id, now)).toBe(true);
    for (let step = 1; step <= 180 && host.surfacePlanetId !== guestPlanet.id; step++) {
      room.update(1 / BALANCE.serverRate, now + step * (1000 / BALANCE.serverRate));
    }
    expect(host.surfacePlanetId).toBe(guestPlanet.id);
    expect(distance(host.position, guestPlanet.position)).toBeLessThanOrEqual(BALANCE.planetRadius + 1.21);
    expect(room.view().matchStats.find((entry) => entry.playerId === host.id)?.planetsVisited).toBe(1);
  });

  it("keeps assisted launch and landing reliable under Low Gravity", async () => {
    const { room, host, hostPlanet, guestPlanet } = await duel();
    const now = Date.now();
    room.activeModifier = "low-gravity";
    room.rules = createMatchRules("low-gravity");
    place(host, padStandingPosition(hostPlanet), hostPlanet.id);
    expect(room.launch(host.id, guestPlanet.id, now)).toBe(true);
    for (let step = 1; step <= 210 && host.surfacePlanetId !== guestPlanet.id; step++) {
      room.update(1 / BALANCE.serverRate, now + step * (1000 / BALANCE.serverRate));
    }
    expect(host.surfacePlanetId).toBe(guestPlanet.id);
    expect(distance(host.position, guestPlanet.position)).toBeLessThanOrEqual(BALANCE.planetRadius + BALANCE.ground.exitAltitude);
  });

  it("rejects invalid shoves and applies funny but bounded knockback on cooldown", async () => {
    const { room, host, guest, hostPlanet } = await duel();
    const now = Date.now();
    const surface = add(hostPlanet.position, { x: 0, y: BALANCE.planetRadius + 0.95, z: 0 });
    place(host, surface, hostPlanet.id);
    place(guest, add(surface, { x: BALANCE.shove.range + 0.2, y: 0, z: 0 }), hostPlanet.id);
    expect(room.shove(host.id, guest.id, now)).toBe(false);
    place(guest, add(surface, { x: 1.5, y: 0, z: 0 }), hostPlanet.id);
    room.setInput(host.id, { sequence: 1, dt: .05, moveX: 0, moveY: 0, cameraForward: { x: -1, y: 0, z: 0 }, jump: false, burst: false, grapple: false }, now);
    expect(room.shove(host.id, guest.id, now)).toBe(false);
    host.lastInputAt = 0;
    room.setInput(host.id, { sequence: 2, dt: .05, moveX: 0, moveY: 0, cameraForward: { x: 1, y: 0, z: 0 }, jump: false, burst: false, grapple: false }, now + 30);
    expect(room.shove(host.id, guest.id, now + 31)).toBe(true);
    const speed = Math.hypot(guest.velocity.x, guest.velocity.y, guest.velocity.z);
    expect(speed).toBeGreaterThan(BALANCE.shove.force * 0.9);
    expect(speed).toBeLessThan(BALANCE.shove.force + BALANCE.shove.lift + 1);
    expect(guest.velocity.y).toBeGreaterThan(0);
    expect(room.view().matchStats.find((entry) => entry.playerId === host.id)?.successfulShoves).toBe(1);
    expect(room.view().matchStats.find((entry) => entry.playerId === guest.id)?.timesShoved).toBe(1);
    expect(room.shove(host.id, guest.id, now + 10)).toBe(false);
    host.shoveCooldownUntil = 0;
    guest.alive = false;
    expect(room.shove(host.id, guest.id, now + BALANCE.shove.cooldownMs + 1)).toBe(false);
  });

  it("allows only nearby invaders to channel sabotage and cancels when they move away", async () => {
    const { room, guest, hostPlanet, guestPlanet } = await duel();
    const now = Date.now();
    place(guest, repairPosition(guestPlanet), guestPlanet.id);
    expect(room.sabotage(guest.id, guestPlanet.id, "repair", true, now)).toBe(false);
    expect(room.sabotage(guest.id, hostPlanet.id, "repair", true, now)).toBe(false);
    place(guest, repairPosition(hostPlanet), hostPlanet.id);
    expect(room.sabotage(guest.id, hostPlanet.id, "repair", true, now)).toBe(true);
    place(guest, add(hostPlanet.position, { x: 0, y: BALANCE.planetRadius + 0.95, z: 0 }), hostPlanet.id);
    room.update(1 / BALANCE.serverRate, now + BALANCE.sabotage.channelMs + 1);
    expect(hostPlanet.repairDisabledUntil).toBe(0);
  });

  it("tolerates small movement during sabotage but still requires the activation range", async () => {
    const { room, guest, hostPlanet } = await duel();
    const now = Date.now();
    const station = repairPosition(hostPlanet);
    place(guest, station, hostPlanet.id);
    expect(room.sabotage(guest.id, hostPlanet.id, "repair", true, now)).toBe(true);
    place(guest, add(station, { x: BALANCE.sabotage.range + .15, y: 0, z: 0 }), hostPlanet.id);
    room.update(1 / BALANCE.serverRate, now + BALANCE.sabotage.channelMs + 1);
    expect(hostPlanet.repairDisabledUntil).toBeGreaterThan(now);
  });

  it("authoritatively honors coyote time and a jump queued before landing", async () => {
    const { room, host, hostPlanet } = await duel();
    const now = Date.now();
    const outward = { x: 0, y: 1, z: 0 };
    place(host, add(hostPlanet.position, scale(outward, BALANCE.planetRadius + 1.55)), hostPlanet.id);
    host.gravityPlanetId = hostPlanet.id;
    host.grounded = false;
    host.lastGroundedAt = now - 70;
    room.setInput(host.id, { sequence: 1, dt: .05, moveX: 0, moveY: 0, cameraForward: { x: 0, y: 0, z: 1 }, jump: true, burst: false, grapple: false }, now);
    room.update(1 / BALANCE.serverRate, now + 1);
    expect(host.velocity.y).toBeGreaterThan(5);

    const second = Date.now();
    place(host, add(hostPlanet.position, scale(outward, BALANCE.planetRadius + 3)), null);
    host.gravityPlanetId = hostPlanet.id;
    host.grounded = false;
    host.lastGroundedAt = 0;
    host.lastInputAt = 0;
    room.setInput(host.id, { sequence: 2, dt: .05, moveX: 0, moveY: 0, cameraForward: { x: 0, y: 0, z: 1 }, jump: false, burst: false, grapple: false }, second);
    host.lastInputAt = 0;
    room.setInput(host.id, { sequence: 3, dt: .05, moveX: 0, moveY: 0, cameraForward: { x: 0, y: 0, z: 1 }, jump: true, burst: false, grapple: false }, second + 30);
    const bufferedUntil = host.jumpQueuedUntil;
    room.update(1 / BALANCE.serverRate, second + 1);
    expect(bufferedUntil).toBeGreaterThan(second);
    expect(host.jumpQueuedUntil).toBe(bufferedUntil);
    place(host, add(hostPlanet.position, scale(outward, BALANCE.planetRadius + 1.1)), hostPlanet.id);
    host.gravityPlanetId = hostPlanet.id;
    host.grounded = false;
    room.update(1 / BALANCE.serverRate, second + 80);
    expect(host.velocity.y).toBeGreaterThan(5);
    expect(host.jumpQueuedUntil).toBe(0);
  });

  it("uses swept collision for a projectile that crosses a planet within one tick", async () => {
    const { room, host, guestPlanet } = await duel();
    const now = Date.now();
    const start = add(guestPlanet.position, { x: 0, y: BALANCE.planetRadius + 3, z: 0 });
    room.projectiles.set("swept", {
      id: "swept", ownerId: host.id, weapon: "rocket", position: start,
      velocity: { x: 0, y: -120, z: 0 }, spawnedAt: now - 1_000
    });
    const before = guestPlanet.integrity;
    room.update(.2, now);
    expect(room.projectiles.has("swept")).toBe(false);
    expect(guestPlanet.integrity).toBe(before - BALANCE.weapons.rocket.damage);
  });

  it("jams enemy infrastructure, blocks use, expires, and applies recovery immunity", async () => {
    const { room, host, guest, hostPlanet, guestPlanet } = await duel();
    const now = Date.now();
    place(guest, cannonPosition(hostPlanet), hostPlanet.id);
    expect(room.sabotage(guest.id, hostPlanet.id, "cannon", true, now)).toBe(true);
    room.update(1 / BALANCE.serverRate, now + BALANCE.sabotage.channelMs + 1);
    const cannonDisabledUntil = hostPlanet.cannonDisabledUntil;
    expect(cannonDisabledUntil).toBe(now + BALANCE.sabotage.channelMs + 1 + BALANCE.sabotage.durationMs);
    expect(hostPlanet.cannonSabotageImmuneUntil).toBe(cannonDisabledUntil + BALANCE.sabotage.immunityMs);
    expect(room.view().matchStats.find((entry) => entry.playerId === guest.id)?.sabotagesCompleted).toBe(1);
    place(host, cannonPosition(hostPlanet), hostPlanet.id);
    const shotDirection = normalize(sub(guestPlanet.position, cannonPosition(hostPlanet)));
    room.fire(host.id, "rocket", shotDirection, cannonDisabledUntil - 1);
    expect(room.projectiles.size).toBe(0);
    room.fire(host.id, "rocket", shotDirection, cannonDisabledUntil + 1);
    expect(room.projectiles.size).toBe(1);
    expect(room.view().matchStats.find((entry) => entry.playerId === host.id)?.rocketsFired).toBe(1);
    place(guest, cannonPosition(hostPlanet), hostPlanet.id);
    expect(room.sabotage(guest.id, hostPlanet.id, "cannon", true, cannonDisabledUntil + 1)).toBe(false);
    expect(room.sabotage(guest.id, hostPlanet.id, "cannon", true, cannonDisabledUntil + BALANCE.sabotage.immunityMs + 1)).toBe(true);
    room.sabotage(guest.id, hostPlanet.id, "cannon", false, cannonDisabledUntil + BALANCE.sabotage.immunityMs + 2);

    const repairStart = cannonDisabledUntil + BALANCE.sabotage.immunityMs + 10;
    place(guest, repairPosition(hostPlanet), hostPlanet.id);
    expect(room.sabotage(guest.id, hostPlanet.id, "repair", true, repairStart)).toBe(true);
    room.update(1 / BALANCE.serverRate, repairStart + BALANCE.sabotage.channelMs + 1);
    const repairDisabledUntil = hostPlanet.repairDisabledUntil;
    hostPlanet.integrity = 50;
    place(host, repairPosition(hostPlanet), hostPlanet.id);
    const scrapBefore = host.scrap;
    room.repair(host.id, repairDisabledUntil - 1);
    expect(hostPlanet.integrity).toBe(50);
    expect(host.scrap).toBe(scrapBefore);
    room.repair(host.id, repairDisabledUntil + 1);
    expect(hostPlanet.integrity).toBe(50 + BALANCE.repair.heal);
    expect(room.view().matchStats.find((entry) => entry.playerId === host.id)).toMatchObject({ repairsPerformed: 1, integrityRepaired: BALANCE.repair.heal });
  });

  it("marks enemy-world pickup collection as stolen without debiting the owner", async () => {
    const { room, hostSocket, host, guest, hostPlanet } = await duel();
    const pickup = add(hostPlanet.position, { x: 0, y: BALANCE.planetRadius + 0.95, z: 0 });
    place(host, repairPosition(hostPlanet), hostPlanet.id);
    place(guest, pickup, hostPlanet.id);
    const ownerScrap = host.scrap;
    const event = new Promise<Parameters<ServerToClientEvents["scrap:collected"]>[0]>((resolve) => hostSocket.once("scrap:collected", resolve));
    room.scraps.set("raid-scrap", { id: "raid-scrap", planetId: hostPlanet.id, position: pickup });
    room.update(1 / BALANCE.serverRate, Date.now());
    expect(await event).toMatchObject({ playerId: guest.id, planetId: hostPlanet.id, ownerId: host.id, stolen: true, value: BALANCE.scrapValue });
    expect(guest.scrap).toBe(BALANCE.startingScrap + BALANCE.scrapValue);
    expect(host.scrap).toBe(ownerScrap);
    expect(room.view().matchStats.find((entry) => entry.playerId === guest.id)).toMatchObject({
      scrapCollected: BALANCE.scrapValue, stolenScrap: BALANCE.scrapValue
    });
  });

  it("clears raid cooldowns and sabotage state on rematch", async () => {
    const { room, host, guest, hostPlanet } = await duel();
    host.launchCooldownUntil = Date.now() + 99_000;
    host.shoveCooldownUntil = Date.now() + 99_000;
    hostPlanet.cannonDisabledUntil = Date.now() + 99_000;
    place(guest, repairPosition(hostPlanet), hostPlanet.id);
    room.sabotage(guest.id, hostPlanet.id, "repair", true);
    room.phase = "results";
    room.voteRematch(host.id);
    room.voteRematch(guest.id);
    const resetPlanet = room.planets.get(host.planetId)!;
    expect(room.phase).toBe("lobby");
    expect(host.launchCooldownUntil).toBe(0);
    expect(host.shoveCooldownUntil).toBe(0);
    expect(resetPlanet.cannonDisabledUntil).toBe(0);
    expect(resetPlanet.repairDisabledUntil).toBe(0);
    expect(resetPlanet.cannonSabotageImmuneUntil).toBe(0);
    expect(room.view().matchStats.every((entry) => entry.damageDealt === 0 && entry.successfulShoves === 0)).toBe(true);
    expect(room.view().matchResult).toBeNull();
  });

  it("cancels an invader channel on disconnect", async () => {
    const { room, guest, hostPlanet } = await duel();
    const now = Date.now();
    place(guest, cannonPosition(hostPlanet), hostPlanet.id);
    expect(room.sabotage(guest.id, hostPlanet.id, "cannon", true, now)).toBe(true);
    room.disconnect(guest.id);
    room.update(1 / BALANCE.serverRate, now + BALANCE.sabotage.channelMs + 1);
    expect(hostPlanet.cannonDisabledUntil).toBe(0);
  });

  it("routes bots through the same launch, shove, and sabotage validation", async () => {
    const { room, host, hostPlanet } = await duel();
    room.phase = "lobby";
    const botId = room.addBot(host.id)!;
    room.phase = "playing";
    const bot = room.players.get(botId)!;
    const botPlanet = room.planets.get(bot.planetId)!;
    expect(room.launch(bot.id, hostPlanet.id)).toBe(false);
    expect(room.shove(bot.id, host.id)).toBe(false);
    expect(room.sabotage(bot.id, botPlanet.id, "cannon", true)).toBe(false);
    place(bot, padStandingPosition(botPlanet), botPlanet.id);
    expect(room.launch(bot.id, hostPlanet.id)).toBe(true);
  });

  it("tracks authoritative shots, damage, kills, events, placements, and results", async () => {
    const { room, hostSocket, host, guest, hostPlanet, guestPlanet } = await duel();
    const start = Date.now();
    room.phase = "countdown";
    room.countdownStartsAt = start;
    room.update(1 / BALANCE.serverRate, start);
    host.scrap = 100;
    place(host, cannonPosition(hostPlanet), hostPlanet.id);
    const direction = normalize(sub(guestPlanet.position, cannonPosition(hostPlanet)));
    const events: string[] = [];
    const destroyedEvent = new Promise<void>((resolve) => hostSocket.on("match:event", (event) => {
      events.push(event.type);
      if (event.type === "destroyed") resolve();
    }));
    for (let shot = 0; shot < 4 && guestPlanet.alive; shot++) {
      const firedAt = start + 1000 + shot * 5000;
      place(host, cannonPosition(hostPlanet), hostPlanet.id);
      room.fire(host.id, "asteroid", direction, firedAt);
      for (let step = 1; step <= 140 && room.projectiles.size; step++) {
        room.update(1 / BALANCE.serverRate, firedAt + step * (1000 / BALANCE.serverRate));
      }
    }
    expect(guestPlanet.alive).toBe(false);
    expect(room.phase).toBe("results");
    const result = room.view().matchResult;
    expect(result).not.toBeNull();
    expect(result?.winnerId).toBe(host.id);
    expect(result?.placements[0]).toMatchObject({ playerId: host.id, place: 1 });
    expect(result?.placements[1]).toMatchObject({ playerId: guest.id, place: 2, integrity: 0 });
    expect(result?.stats.find((entry) => entry.playerId === host.id)).toMatchObject({
      damageDealt: 100, asteroidsFired: 4, shotsHit: 4, planetKills: 1
    });
    expect(result?.stats.find((entry) => entry.playerId === guest.id)?.damageReceived).toBe(100);
    await destroyedEvent;
    expect(events).toContain("damage");
    expect(events).toContain("destroyed");
  });

  it("keeps Classic as the default and lets only the lobby host select Chaos", async () => {
    const { room, host, guest } = await duel();
    room.phase = "lobby";
    expect(room.view()).toMatchObject({ gameMode: "classic", activeModifier: null, rules: createMatchRules() });
    room.setMode(guest.id, "chaos");
    expect(room.gameMode).toBe("classic");
    room.setMode(host.id, "chaos");
    expect(room.gameMode).toBe("chaos");
    host.ready = true; guest.ready = true;
    room.start(host.id);
    const selected = room.activeModifier;
    expect(selected).not.toBeNull();
    expect(room.rules).toEqual(createMatchRules(selected));
    room.setMode(host.id, "classic");
    expect(room.gameMode).toBe("chaos");
    expect(room.activeModifier).toBe(selected);
  });

  it("caps Fragile Worlds repairs at the effective round integrity", async () => {
    const { room, host, hostPlanet } = await duel();
    room.rules = createMatchRules("fragile-worlds");
    hostPlanet.integrity = 64;
    host.scrap = 100;
    place(host, repairPosition(hostPlanet), hostPlanet.id);
    room.repair(host.id);
    expect(hostPlanet.integrity).toBe(70);
    const scrapAfterRepair = host.scrap;
    room.repair(host.id, Date.now() + 500);
    expect(hostPlanet.integrity).toBe(70);
    expect(host.scrap).toBe(scrapAfterRepair);
  });

  it("awards session Crowns, preserves them through reconnects/rematches, and tracks streaks", async () => {
    const { room, host, guest, url, code, hostSessionToken } = await duel();
    const finish = room as unknown as { end: (winnerId: string | null, reason: "last-standing" | "timer", now?: number) => void };
    finish.end(host.id, "last-standing");
    expect(host.crowns).toBe(1);
    expect(room.matchResult?.crowns).toContainEqual({ playerId: host.id, crowns: 1 });
    expect(room.winStreak).toEqual({ playerId: host.id, count: 1 });

    room.disconnect(host.id);
    const reconnectSocket = await openClient(url);
    const rejoined = await joinRoom(reconnectSocket, code, "Chris", hostSessionToken);
    expect(rejoined.ok).toBe(true);
    if (!rejoined.ok) return;
    expect(rejoined.playerId).toBe(host.id);
    expect(rejoined.room.players.find((player) => player.id === host.id)?.crowns).toBe(1);

    room.voteRematch(host.id); room.voteRematch(guest.id);
    expect(room.phase).toBe("lobby");
    expect(host.crowns).toBe(1);
    expect(host.ready).toBe(true);
    expect(guest.ready).toBe(true);
    room.start(host.id);
    finish.end(host.id, "timer");
    expect(host.crowns).toBe(2);
    expect(room.winStreak).toEqual({ playerId: host.id, count: 2 });
    room.voteRematch(host.id); room.voteRematch(guest.id);
    room.start(host.id);
    finish.end(guest.id, "timer");
    expect(guest.crowns).toBe(1);
    expect(room.winStreak).toEqual({ playerId: guest.id, count: 1 });
  });

  it("chooses a different Chaos modifier on the next same-room match", async () => {
    const { room, host, guest } = await duel();
    const finish = room as unknown as { end: (winnerId: string | null, reason: "last-standing" | "timer") => void };
    room.phase = "lobby"; room.setMode(host.id, "chaos"); host.ready = true; guest.ready = true;
    room.start(host.id);
    const first = room.activeModifier;
    expect(first).not.toBeNull();
    finish.end(host.id, "timer");
    room.voteRematch(host.id); room.voteRematch(guest.id);
    room.start(host.id);
    expect(room.activeModifier).not.toBeNull();
    expect(room.activeModifier).not.toBe(first);
  });

  it("keeps players outside the collision shell and does not let adhesion cancel a jump", async () => {
    const { room, host, hostPlanet } = await duel();
    const now = Date.now();
    place(host, { ...hostPlanet.position }, hostPlanet.id);
    host.gravityPlanetId = hostPlanet.id;
    host.grounded = true;
    host.velocity = { x: 0, y: -20, z: 0 };
    room.update(1 / BALANCE.serverRate, now);
    expect(distance(host.position, hostPlanet.position)).toBeGreaterThanOrEqual(BALANCE.planetRadius + .95 - 1e-8);

    place(host, add(hostPlanet.position, { x: 0, y: BALANCE.planetRadius + .95, z: 0 }), hostPlanet.id);
    host.gravityPlanetId = hostPlanet.id;
    host.grounded = true;
    host.lastInputAt = 0;
    room.setInput(host.id, { sequence: 1, dt: .05, moveX: 0, moveY: 0, cameraForward: { x: 0, y: 0, z: 1 }, jump: true, burst: false, grapple: false });
    room.update(1 / BALANCE.serverRate, now + 40);
    expect(host.velocity.y).toBeGreaterThan(5);
    expect(host.grounded).toBe(false);
    expect(host.jumpQueuedUntil).toBe(0);
  });

  it("consumes jump and burst pulses once and clears expired bookkeeping", async () => {
    const { room, host, hostPlanet } = await duel();
    const start = Date.now() + 3000;
    place(host, add(hostPlanet.position, { x: 0, y: BALANCE.planetRadius + 3, z: 0 }), null);
    host.gravityPlanetId = hostPlanet.id;
    host.grounded = false;
    host.lastGroundedAt = 0;
    host.lastInputAt = 0;
    room.setInput(host.id, { sequence: 1, dt: .05, moveX: 0, moveY: 0, cameraForward: { x: 0, y: 0, z: 1 }, jump: true, burst: false, grapple: false });
    expect(host.jumpQueuedUntil).toBeGreaterThan(0);
    room.update(1 / BALANCE.serverRate, start + BALANCE.ground.jumpBufferMs + 1);
    expect(host.jumpQueuedUntil).toBe(0);

    place(host, add(hostPlanet.position, { x: 0, y: BALANCE.planetRadius + .95, z: 0 }), hostPlanet.id);
    host.gravityPlanetId = hostPlanet.id;
    host.grounded = true;
    host.lastInputAt = 0;
    room.setInput(host.id, { sequence: 2, dt: .05, moveX: 0, moveY: 1, cameraForward: { x: 0, y: 0, z: 1 }, jump: false, burst: true, grapple: false });
    const burstAt = start + BALANCE.ground.jumpBufferMs + 50;
    room.update(1 / BALANCE.serverRate, burstAt);
    expect(host.lastBurstAt).toBe(burstAt);
    for (let step = 1; step <= Math.ceil((BALANCE.burstCooldownMs + 500) / (1000 / BALANCE.serverRate)); step++) {
      room.update(1 / BALANCE.serverRate, burstAt + step * (1000 / BALANCE.serverRate));
    }
    expect(host.lastBurstAt).toBe(burstAt);
  });

  it("ignores delayed input sequences without rolling authoritative intent backward", async () => {
    const { room, host } = await duel();
    const now = Date.now();
    room.setInput(host.id, { sequence: 20, dt: .05, moveX: .5, moveY: 1, cameraForward: { x: 0, y: 0, z: 1 }, jump: false, burst: false, grapple: false }, now);
    const accepted = host.input;
    room.setInput(host.id, { sequence: 19, dt: .05, moveX: -1, moveY: -1, cameraForward: { x: 0, y: 0, z: -1 }, jump: true, burst: true, grapple: false }, now + 100);
    expect(host.lastInputSequence).toBe(20);
    expect(host.input).toBe(accepted);
  });

  it("rejects invalid grapple anchors and releases anchors on destroyed planets", async () => {
    const { room, host, hostPlanet } = await duel();
    const now = Date.now();
    place(host, add(hostPlanet.position, { x: 0, y: BALANCE.planetRadius + .95, z: 0 }), hostPlanet.id);
    host.gravityPlanetId = hostPlanet.id;
    host.lastInputAt = 0;
    room.setInput(host.id, { sequence: 1, dt: .05, moveX: 0, moveY: 0, cameraForward: { x: 0, y: 0, z: 1 }, jump: false, burst: false, grapple: true, grapplePoint: hostPlanet.position });
    room.update(1 / BALANCE.serverRate, now);
    expect(host.grappleAnchor).toBeNull();

    const validAnchor = add(hostPlanet.position, { x: 0, y: BALANCE.planetRadius, z: 0 });
    host.lastInputAt = 0;
    room.setInput(host.id, { sequence: 2, dt: .05, moveX: 0, moveY: 0, cameraForward: { x: 0, y: 0, z: 1 }, jump: false, burst: false, grapple: true, grapplePoint: validAnchor });
    room.update(1 / BALANCE.serverRate, now + 40);
    expect(host.grappleAnchor).toEqual(validAnchor);
    hostPlanet.alive = false;
    room.update(1 / BALANCE.serverRate, now + 80);
    expect(host.grappleAnchor).toBeNull();
    expect(host.grappleRestLength).toBe(0);
  });

  it("expires launch assistance and restores ordinary gravity ownership", async () => {
    const { room, host, hostPlanet, guestPlanet } = await duel();
    const now = Date.now();
    place(host, padStandingPosition(hostPlanet), hostPlanet.id);
    expect(room.launch(host.id, guestPlanet.id, now)).toBe(true);
    host.launchAssistUntil = now + 10;
    room.update(1 / BALANCE.serverRate, now + 11);
    expect(host.launchAssistUntil).toBe(0);
    expect(host.launchSourcePlanetId).toBeNull();
    expect(host.launchTargetPlanetId).toBeNull();
    expect(host.gravityPlanetId).not.toBeNull();
  });

  it("damages a planet once per projectile and expires old projectiles", async () => {
    const { room, host, guestPlanet } = await duel();
    const now = Date.now();
    const before = guestPlanet.integrity;
    room.projectiles.set("crossing", {
      id: "crossing", ownerId: host.id, weapon: "rocket",
      position: add(guestPlanet.position, { x: -20, y: 0, z: 0 }),
      velocity: { x: 200, y: 0, z: 0 }, spawnedAt: now - 1000
    });
    room.update(.2, now);
    expect(guestPlanet.integrity).toBe(before - BALANCE.weapons.rocket.damage);
    expect(room.projectiles.has("crossing")).toBe(false);
    room.update(.2, now + 200);
    expect(guestPlanet.integrity).toBe(before - BALANCE.weapons.rocket.damage);

    room.projectiles.set("expired", {
      id: "expired", ownerId: host.id, weapon: "rocket",
      position: { x: 0, y: 80, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, spawnedAt: now - 12_001
    });
    room.update(1 / BALANCE.serverRate, now + 250);
    expect(room.projectiles.has("expired")).toBe(false);
  });

  it("lets humans and bot invaders leave an enemy planet through its launch pad", async () => {
    const { room, host, guest, hostPlanet, guestPlanet } = await duel();
    const start = Date.now();
    place(host, padStandingPosition(hostPlanet), hostPlanet.id);
    expect(room.launch(host.id, guestPlanet.id, start)).toBe(true);
    for (let step = 1; step <= 210 && host.surfacePlanetId !== guestPlanet.id; step++) {
      room.update(1 / BALANCE.serverRate, start + step * (1000 / BALANCE.serverRate));
    }
    expect(host.surfacePlanetId).toBe(guestPlanet.id);
    place(host, padStandingPosition(guestPlanet), guestPlanet.id);
    host.grappleAnchor = add(guestPlanet.position, scale(launchPadNormal(guestPlanet), BALANCE.planetRadius));
    host.velocity = { x: 1, y: 2, z: 0 };
    const escapeAt = start + BALANCE.launch.cooldownMs + 2_000;
    expect(room.launch(host.id, hostPlanet.id, escapeAt)).toBe(true);
    expect(host.launchSourcePlanetId).toBe(guestPlanet.id);
    expect(host.launchTargetPlanetId).toBe(hostPlanet.id);
    expect(host.grappleAnchor).toBeNull();

    guest.isBot = true;
    guest.launchCooldownUntil = 0;
    place(guest, padStandingPosition(hostPlanet), hostPlanet.id);
    expect(room.launch(guest.id, guestPlanet.id, escapeAt + 1)).toBe(true);
    expect(guest.launchSourcePlanetId).toBe(hostPlanet.id);
  });

  it("keeps an enemy launch pad usable after stealing, sabotage, and a shove", async () => {
    const { room, host, guest, hostPlanet, guestPlanet } = await duel();
    const now = Date.now();
    const enemyPad = padStandingPosition(guestPlanet);

    place(host, enemyPad, guestPlanet.id);
    room.scraps.set("escape-scrap", { id: "escape-scrap", planetId: guestPlanet.id, position: { ...enemyPad } });
    room.update(1 / BALANCE.serverRate, now + 1);
    expect(room.scraps.has("escape-scrap")).toBe(false);

    place(host, repairPosition(guestPlanet), guestPlanet.id);
    expect(room.sabotage(host.id, guestPlanet.id, "repair", true, now + 100)).toBe(true);
    room.update(1 / BALANCE.serverRate, now + 100 + BALANCE.sabotage.channelMs + 1);
    expect(guestPlanet.repairDisabledUntil).toBeGreaterThan(now);

    const surface = add(guestPlanet.position, { x: 0, y: BALANCE.planetRadius + .95, z: 0 });
    place(host, surface, guestPlanet.id);
    place(guest, add(surface, { x: 1.5, y: 0, z: 0 }), guestPlanet.id);
    host.lastInputAt = 0;
    room.setInput(host.id, { sequence: 1, dt: .05, moveX: 0, moveY: 0, cameraForward: { x: 1, y: 0, z: 0 }, jump: false, burst: false, grapple: false }, now + 2_000);
    expect(room.shove(host.id, guest.id, now + 2_001)).toBe(true);

    place(host, enemyPad, guestPlanet.id);
    expect(room.launch(host.id, hostPlanet.id, now + 2_100)).toBe(true);
    expect(host.launchSourcePlanetId).toBe(guestPlanet.id);
    expect(host.launchTargetPlanetId).toBe(hostPlanet.id);
  });

  it("applies shield reduction and enforces utility cost, duration, cooldown, and no stacking", async () => {
    const { room, host, guest, hostPlanet } = await duel();
    const now = Date.now();
    host.scrap = 100;
    place(host, repairPosition(hostPlanet), hostPlanet.id);
    expect(room.purchaseUtility(host.id, hostPlanet.id, "shield", now)).toBe(true);
    expect(host.scrap).toBe(100 - BALANCE.utilities.shield.cost);
    expect(room.purchaseUtility(host.id, hostPlanet.id, "shield", now + 1)).toBe(false);
    const before = hostPlanet.integrity;
    room.projectiles.set("shield-hit", {
      id: "shield-hit", ownerId: guest.id, weapon: "rocket", position: add(hostPlanet.position, { x: 0, y: BALANCE.planetRadius + 3, z: 0 }),
      velocity: { x: 0, y: -120, z: 0 }, spawnedAt: now - 1000
    });
    room.update(.2, now + 10);
    expect(before - hostPlanet.integrity).toBeCloseTo(BALANCE.weapons.rocket.damage * (1 - BALANCE.utilities.shield.damageReduction), 6);
    place(host, repairPosition(hostPlanet), hostPlanet.id);
    expect(room.purchaseUtility(host.id, hostPlanet.id, "shield", hostPlanet.shieldUntil + 1)).toBe(false);
    expect(room.purchaseUtility(host.id, hostPlanet.id, "shield", hostPlanet.shieldCooldownUntil + 1)).toBe(true);
  });

  it("consumes overcharge on the next shot and launch boost on the next valid launch", async () => {
    const { room, host, hostPlanet, guestPlanet } = await duel();
    const now = Date.now();
    host.scrap = 100;
    place(host, cannonPosition(hostPlanet), hostPlanet.id);
    expect(room.purchaseUtility(host.id, hostPlanet.id, "overcharge", now)).toBe(true);
    expect(room.purchaseUtility(host.id, hostPlanet.id, "overcharge", now + 1)).toBe(false);
    const direction = normalize(sub(guestPlanet.position, cannonPosition(hostPlanet)));
    room.fire(host.id, "rocket", direction, now + 2);
    const shot = [...room.projectiles.values()][0];
    expect(Math.hypot(shot.velocity.x, shot.velocity.y, shot.velocity.z)).toBeCloseTo(BALANCE.weapons.rocket.speed * BALANCE.utilities.overcharge.speedMultiplier, 5);
    expect(host.overchargeUntil).toBe(0);

    room.projectiles.clear(); host.launchCooldownUntil = 0;
    place(host, padStandingPosition(guestPlanet), guestPlanet.id);
    expect(room.purchaseUtility(host.id, guestPlanet.id, "launch-boost", now + 10)).toBe(true);
    expect(room.purchaseUtility(host.id, guestPlanet.id, "launch-boost", now + 10)).toBe(false);
    expect(room.launch(host.id, hostPlanet.id, now + 11)).toBe(true);
    expect(Math.hypot(host.velocity.x, host.velocity.y, host.velocity.z)).toBeCloseTo(BALANCE.launch.speed * BALANCE.utilities.launchBoost.speedMultiplier, 5);
    expect(host.launchAssistUntil).toBe(now + 11 + BALANCE.launch.assistMs + BALANCE.utilities.launchBoost.assistBonusMs);
    expect(host.launchBoostUntil).toBe(0);
  });

  it("bursts a Cluster Bomb into a bounded authoritative fragment set", async () => {
    const { room, host, hostPlanet, guestPlanet } = await duel();
    const now = Date.now();
    host.scrap = 100;
    place(host, cannonPosition(hostPlanet), hostPlanet.id);
    room.fire(host.id, "cluster", normalize(sub(guestPlanet.position, cannonPosition(hostPlanet))), now);
    expect(host.scrap).toBe(100 - BALANCE.weapons.cluster.cost);
    expect(room.projectiles.size).toBe(1);
    room.update(1 / BALANCE.serverRate, now + 400);
    expect([...room.projectiles.values()][0]).toMatchObject({ weapon: "cluster" });
    expect([...room.projectiles.values()][0].fragment).toBeUndefined();
    room.update(1 / BALANCE.serverRate, now + BALANCE.weapons.cluster.burstMs + 1);
    const fragments = [...room.projectiles.values()];
    expect(fragments).toHaveLength(BALANCE.weapons.cluster.fragmentCount);
    expect(fragments.every((projectile) => projectile.weapon === "cluster" && projectile.fragment && projectile.shotId)).toBe(true);
    const fragment = fragments[0];
    fragment.position = add(guestPlanet.position, { x: 0, y: BALANCE.planetRadius + 3, z: 0 });
    fragment.velocity = { x: 0, y: -120, z: 0 };
    fragment.spawnedAt = now - 1_000;
    const integrityBefore = guestPlanet.integrity;
    room.update(.2, now + BALANCE.weapons.cluster.burstMs + 2);
    expect(integrityBefore - guestPlanet.integrity).toBe(BALANCE.weapons.cluster.damage);
    expect(room.view().matchStats.find((stats) => stats.playerId === host.id)).toMatchObject({
      clusterBombsFired: 1, clusterFragmentsHit: 1, shotsHit: 1
    });

    const expiring = [...room.projectiles.values()][0];
    expiring.position = { x: 0, y: 80, z: 0 };
    expiring.velocity = { x: 0, y: 0, z: 0 };
    expiring.spawnedAt = now - 4_000;
    room.update(1 / BALANCE.serverRate, now + BALANCE.weapons.cluster.burstMs + 3);
    expect(room.projectiles.has(expiring.id)).toBe(false);
  });

  it("keeps Gravity Bomb displacement finite, bounded, and low damage", async () => {
    const { room, host, guest, hostPlanet, guestPlanet } = await duel();
    const now = Date.now();
    host.scrap = 100;
    place(host, cannonPosition(hostPlanet), hostPlanet.id);
    room.fire(host.id, "gravity-bomb", normalize(sub(guestPlanet.position, cannonPosition(hostPlanet))), now);
    expect(host.scrap).toBe(100 - BALANCE.weapons["gravity-bomb"].cost);
    room.projectiles.clear();
    const impactStart = add(guestPlanet.position, { x: 0, y: BALANCE.planetRadius + 3, z: 0 });
    place(guest, add(guestPlanet.position, { x: 0, y: BALANCE.planetRadius + .95, z: 0 }), guestPlanet.id);
    room.projectiles.set("gravity", { id: "gravity", ownerId: host.id, weapon: "gravity-bomb", position: impactStart, velocity: { x: 0, y: -120, z: 0 }, spawnedAt: now - 1000 });
    const before = guestPlanet.integrity;
    room.update(.2, now);
    const speed = Math.hypot(guest.velocity.x, guest.velocity.y, guest.velocity.z);
    expect(before - guestPlanet.integrity).toBe(BALANCE.weapons["gravity-bomb"].damage);
    expect(Number.isFinite(speed)).toBe(true);
    expect(speed).toBeLessThanOrEqual(BALANCE.maxPlayerSpeed);
    expect(room.view().matchStats.find((stats) => stats.playerId === host.id)?.gravityBombPlayersDisplaced).toBeGreaterThan(0);
  });

  it("keeps Fallbucks and owned cosmetics through rematches and reconnects", async () => {
    const { room, host, guest, hostPlanet, guestPlanet, hostSessionToken } = await duel();
    const now = Date.now();
    guestPlanet.integrity = 1;
    room.projectiles.set("winner", {
      id: "winner", ownerId: host.id, weapon: "rocket", position: add(guestPlanet.position, { x: 0, y: BALANCE.planetRadius + 3, z: 0 }),
      velocity: { x: 0, y: -120, z: 0 }, spawnedAt: now - 1000
    });
    room.update(.2, now);
    expect(room.phase).toBe("results");
    expect(host.fallbucks).toBe(100);
    expect(guest.fallbucks).toBe(50);
    const item = SHOP_CATALOG.find((entry) => entry.id === "solar-gold")!;
    const scrapBefore = host.scrap;
    expect(room.buyShopItem(host.id, item.id)).toEqual({ ok: true });
    expect(host.fallbucks).toBe(0);
    expect(host.scrap).toBe(scrapBefore);
    expect(room.buyShopItem(host.id, item.id)).toMatchObject({ ok: false });
    expect(room.equipShopItem(host.id, "stardust")).toMatchObject({ ok: false });
    expect(room.equipShopItem(host.id, item.id)).toEqual({ ok: true });
    expect(host.equippedCosmetics.suit).toBe(item.id);

    room.disconnect(host.id);
    const rejoined = room.join({ id: "returning-host", data: {}, join: () => undefined } as never, "Chris", hostSessionToken);
    expect(rejoined.ok).toBe(true);
    if (!rejoined.ok) return;
    expect(rejoined.playerId).toBe(host.id);
    expect(room.players.get(host.id)).toMatchObject({ fallbucks: 0, equippedCosmetics: { suit: item.id } });

    room.phase = "results";
    room.voteRematch(host.id); room.voteRematch(guest.id);
    expect(room.players.get(host.id)).toMatchObject({ fallbucks: 0, equippedCosmetics: { suit: item.id } });
  });

  it("keeps bot difficulty host-controlled and rate-limits cosmetic emotes", async () => {
    const { room, host, guest } = await duel();
    room.phase = "lobby";
    room.setBotDifficulty(guest.id, "hard");
    expect(room.botDifficulty).toBe("normal");
    room.setBotDifficulty(host.id, "hard");
    expect(room.botDifficulty).toBe("hard");
    room.phase = "playing";
    const now = Date.now();
    expect(room.playEmote(host.id, "wave", { x: 1, y: 0, z: 0 }, now)).toBe(true);
    expect(room.playEmote(host.id, "point", { x: 1, y: 0, z: 0 }, now + 1)).toBe(false);
    expect(room.playEmote(host.id, "laugh", { x: 1, y: 0, z: 0 }, now + BALANCE.emoteCooldownMs + 1)).toBe(false);
    host.ownedCosmetics.push("laugh");
    expect(room.playEmote(host.id, "laugh", { x: 1, y: 0, z: 0 }, now + BALANCE.emoteCooldownMs + 1)).toBe(true);
  });
});
