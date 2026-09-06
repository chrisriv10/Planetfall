import { afterEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import {
  BALANCE,
  add,
  cannonPosition,
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

function joinRoom(socket: TestSocket, code: string, name: string): Promise<JoinResult> {
  return new Promise((resolve) => socket.emit("room:join", { code, name }, resolve));
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
    server, room, hostSocket, guestSocket,
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
  });

  it("rejects invalid shoves and applies funny but bounded knockback on cooldown", async () => {
    const { room, host, guest, hostPlanet } = await duel();
    const now = Date.now();
    const surface = add(hostPlanet.position, { x: 0, y: BALANCE.planetRadius + 0.95, z: 0 });
    place(host, surface, hostPlanet.id);
    place(guest, add(surface, { x: BALANCE.shove.range + 0.2, y: 0, z: 0 }), hostPlanet.id);
    expect(room.shove(host.id, guest.id, now)).toBe(false);
    place(guest, add(surface, { x: 1.5, y: 0, z: 0 }), hostPlanet.id);
    expect(room.shove(host.id, guest.id, now)).toBe(true);
    const speed = Math.hypot(guest.velocity.x, guest.velocity.y, guest.velocity.z);
    expect(speed).toBeGreaterThan(BALANCE.shove.force * 0.9);
    expect(speed).toBeLessThan(BALANCE.shove.force + BALANCE.shove.lift + 1);
    expect(guest.velocity.y).toBeGreaterThan(0);
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

  it("jams enemy infrastructure, blocks use, expires, and applies recovery immunity", async () => {
    const { room, host, guest, hostPlanet, guestPlanet } = await duel();
    const now = Date.now();
    place(guest, cannonPosition(hostPlanet), hostPlanet.id);
    expect(room.sabotage(guest.id, hostPlanet.id, "cannon", true, now)).toBe(true);
    room.update(1 / BALANCE.serverRate, now + BALANCE.sabotage.channelMs + 1);
    const cannonDisabledUntil = hostPlanet.cannonDisabledUntil;
    expect(cannonDisabledUntil).toBe(now + BALANCE.sabotage.channelMs + 1 + BALANCE.sabotage.durationMs);
    place(host, cannonPosition(hostPlanet), hostPlanet.id);
    const shotDirection = normalize(sub(guestPlanet.position, cannonPosition(hostPlanet)));
    room.fire(host.id, "rocket", shotDirection, cannonDisabledUntil - 1);
    expect(room.projectiles.size).toBe(0);
    room.fire(host.id, "rocket", shotDirection, cannonDisabledUntil + 1);
    expect(room.projectiles.size).toBe(1);
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
});
