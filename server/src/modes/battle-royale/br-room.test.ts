import { afterEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { BR_BALANCE, BR_WEAPONS, type BrJoinResult, type BrRoomView, type ClientToServerEvents, type ServerToClientEvents } from "@planetfall/shared";
import { createPlanetfallServer } from "../../app.js";
import { BattleRoyaleRoom } from "./br-room.js";

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const clients: TestSocket[] = [];
const servers: Awaited<ReturnType<typeof createPlanetfallServer>>[] = [];

afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect();
  for (const server of servers.splice(0)) await server.close();
});

async function setup() {
  const server = await createPlanetfallServer({ port: 0, host: "127.0.0.1", nodeEnv: "test", clientOrigins: ["http://test.local"] });
  servers.push(server); const address = await server.listen(); return { server, ...address };
}

async function client(url: string): Promise<TestSocket> {
  const socket = connect(url, { transports: ["websocket"], extraHeaders: { Origin: "http://test.local" }, forceNew: true }); clients.push(socket);
  await new Promise<void>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error("connect timeout")), 3000); socket.once("connect", () => { clearTimeout(timeout); resolve(); }); socket.once("connect_error", reject); }); return socket;
}

function createRoom(socket: TestSocket, name: string): Promise<BrJoinResult> { return new Promise((resolve) => socket.emit("br:room:create", { name }, resolve)); }
function joinRoom(socket: TestSocket, code: string, name: string, sessionToken?: string): Promise<BrJoinResult> { return new Promise((resolve) => socket.emit("br:room:join", { code, name, sessionToken }, resolve)); }
function waitForRoom(socket: TestSocket, predicate: (room: BrRoomView) => boolean, timeoutMs = 4000): Promise<BrRoomView> {
  return new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error("room timeout")), timeoutMs); const handler = (room: BrRoomView) => { if (!predicate(room)) return; clearTimeout(timeout); socket.off("br:room:state", handler); resolve(room); }; socket.on("br:room:state", handler); });
}

describe("Battle Royale room", () => {
  it("creates an isolated room, assigns authoritative teams, and fills to the target", async () => {
    const { server, url } = await setup(); const host = await client(url); const joined = await createRoom(host, "Chris");
    expect(joined.ok).toBe(true); if (!joined.ok) return;
    const room = server.manager.rooms.get(joined.room.code);
    expect(room).toBeInstanceOf(BattleRoyaleRoom);
    const configured = waitForRoom(host, (view) => view.teamMode === "squad" && view.targetPlayers === 10);
    host.emit("br:room:configure", { teamMode: "squad", targetPlayers: 10, fillBots: true }); await configured;
    host.emit("br:room:ready", { ready: true });
    const countdown = waitForRoom(host, (view) => view.phase === "countdown"); host.emit("br:match:start"); const view = await countdown;
    expect(view.players).toHaveLength(10); expect(view.teams).toHaveLength(3); expect(view.players.filter((player) => player.isBot)).toHaveLength(9);
  });

  it("runs the ship, jump, descent, loot, and reconnect flow authoritatively", async () => {
    const { server, url } = await setup(); const host = await client(url); const joined = await createRoom(host, "Chris"); if (!joined.ok) throw new Error(joined.error);
    const room = server.manager.rooms.get(joined.room.code) as BattleRoyaleRoom;
    room.configure(joined.playerId, { targetPlayers: 10, fillBots: true }); room.setReady(joined.playerId, true); const start = Date.now(); expect(room.start(joined.playerId, start)).toBe(true);
    room.update(1 / 30, start + BR_BALANCE.countdownMs + 1); expect(room.phase).toBe("ship"); expect(room.ship).not.toBeNull();
    expect(room.jumpFromShip(joined.playerId, start + BR_BALANCE.countdownMs + 10)).toBe(true);
    const player = room.players.get(joined.playerId)!; expect(player.deployment).toBe("freefall");
    player.position = { x: 0, y: .1, z: 0 }; player.velocity = { x: 0, y: -5, z: 0 }; room.update(1 / 30, start + BR_BALANCE.countdownMs + 100); expect(player.deployment).toBe("grounded");
    const loot = [...room.loot.values()][0]; loot.position = { ...player.position }; expect(room.pickup(player.id, loot.id)).toBe(true); expect(room.pickup(player.id, loot.id)).toBe(false); expect(room.loot.has(loot.id)).toBe(false);
    if (loot.itemId) expect(player.inventory.some((item) => item?.itemId === loot.itemId)).toBe(true);
    const inventoryBeforeReconnect = JSON.stringify(player.inventory); const ammoBeforeReconnect = { ...player.ammo };
    host.disconnect(); player.disconnectedAt = Date.now();
    const returning = await client(url); const resumed = await joinRoom(returning, room.code, "Chris", joined.sessionToken); expect(resumed.ok).toBe(true); if (resumed.ok) { expect(resumed.playerId).toBe(joined.playerId); const restored = resumed.room.players.find((entry) => entry.id === resumed.playerId)!; expect(JSON.stringify(restored.inventory)).toBe(inventoryBeforeReconnect); expect(restored.ammo).toEqual(ammoBeforeReconnect); }
  });

  it("keeps Classic room codes out of BR joins", async () => {
    const { url } = await setup(); const classic = await client(url); const br = await client(url);
    const created = await new Promise<import("@planetfall/shared").JoinResult>((resolve) => classic.emit("room:create", { name: "Classic" }, resolve)); if (!created.ok) throw new Error(created.error);
    const rejected = await joinRoom(br, created.room.code, "BR"); expect(rejected).toEqual({ ok: false, error: "That code belongs to Planetfall Classic." });
  });

  it("opens a nearby Star Crate once and rejects remote or duplicate opens", async () => {
    const { server, url } = await setup(); const host = await client(url); const joined = await createRoom(host, "Crater"); if (!joined.ok) throw new Error(joined.error);
    const room = server.manager.rooms.get(joined.room.code) as BattleRoyaleRoom; room.configure(joined.playerId, { targetPlayers: 10, fillBots: true }); room.setReady(joined.playerId, true);
    const start = Date.now(); room.start(joined.playerId, start); room.update(1 / 30, start + BR_BALANCE.countdownMs + 1);
    const player = room.players.get(joined.playerId)!; const crate = [...room.crates.values()][0]; player.deployment = "grounded"; player.position = { ...crate.position };
    expect(room.openCrate(player.id, crate.id)).toBe(true); expect(crate.opened).toBe(true); expect(room.loot.size).toBeGreaterThan(90);
    expect(room.openCrate(player.id, crate.id)).toBe(false); const other = [...room.crates.values()].find((entry) => !entry.opened)!; player.position = { x: 400, y: 0, z: 0 }; expect(room.openCrate(player.id, other.id)).toBe(false);
  });

  it("authoritatively consumes ammo, damages Shield first, and revives a teammate", async () => {
    const { server, url } = await setup(); const host = await client(url); const joined = await createRoom(host, "Rail"); if (!joined.ok) throw new Error(joined.error);
    const room = server.manager.rooms.get(joined.room.code) as BattleRoyaleRoom; room.configure(joined.playerId, { teamMode: "duo", targetPlayers: 10, fillBots: true }); room.setReady(joined.playerId, true);
    const start = Date.now(); room.start(joined.playerId, start); room.phase = "combat";
    const target = room.players.get(joined.playerId)!; const teammate = [...room.players.values()].find((player) => player.id !== target.id && player.teamId === target.teamId)!; const shooter = [...room.players.values()].find((player) => player.teamId !== target.teamId)!;
    shooter.deployment = "grounded"; shooter.position = { x: 100, y: 0, z: 12 }; shooter.inventory[0] = { instanceId: "pulse", itemId: "pulse-rifle", rarity: "common", count: 1, magazine: BR_WEAPONS["pulse-rifle"].magazine };
    target.deployment = "grounded"; target.position = { x: 100, y: 0, z: 0 }; target.shield = 10;
    expect(room.fire(shooter.id, { x: 100, y: .7, z: 12 }, { x: 0, y: 0, z: -1 }, start, start + 1000)).toBe(true);
    expect(shooter.inventory[0]!.magazine).toBe(BR_WEAPONS["pulse-rifle"].magazine - 1); expect(target.shield).toBe(0); expect(target.hp).toBe(88);
    shooter.inventory[0] = { instanceId: "rail", itemId: "rail-laser", rarity: "common", count: 1, magazine: 3 }; target.hp = 40; target.shield = 0;
    expect(room.fire(shooter.id, { x: 100, y: .7, z: 12 }, { x: 0, y: 0, z: -1 }, start, start + 2400)).toBe(true); expect(target.downed).toBe(true);
    teammate.deployment = "grounded"; teammate.position = { ...target.position }; room.setRevive(teammate.id, target.id, true, start + 2500); room.update(1 / 30, start + 2500 + BR_BALANCE.reviveMs + 1);
    expect(target.downed).toBe(false); expect(target.hp).toBe(BR_BALANCE.reviveHp); expect(teammate.revives).toBe(1);
  });

  it("keeps friendly fire disabled and completes timed healing without exceeding caps", async () => {
    const { server, url } = await setup(); const host = await client(url); const joined = await createRoom(host, "Medic"); if (!joined.ok) throw new Error(joined.error);
    const room = server.manager.rooms.get(joined.room.code) as BattleRoyaleRoom; room.configure(joined.playerId, { teamMode: "duo", targetPlayers: 10, fillBots: true }); room.setReady(joined.playerId, true);
    const start = Date.now(); room.start(joined.playerId, start); room.phase = "combat";
    const player = room.players.get(joined.playerId)!; const teammate = [...room.players.values()].find((entry) => entry.id !== player.id && entry.teamId === player.teamId)!;
    player.deployment = "grounded"; player.position = { x: 100, y: 0, z: 12 }; player.inventory[0] = { instanceId: "pulse", itemId: "pulse-rifle", rarity: "common", count: 1, magazine: 30 };
    teammate.deployment = "grounded"; teammate.position = { x: 100, y: 0, z: 0 }; teammate.shield = 20;
    expect(room.fire(player.id, { x: 100, y: .7, z: 12 }, { x: 0, y: 0, z: -1 }, start, start + 1000)).toBe(true); expect(teammate.hp).toBe(100); expect(teammate.shield).toBe(20);
    player.inventory[1] = { instanceId: "med", itemId: "med-patch", rarity: "common", count: 2, magazine: 0 }; player.selectedSlot = 1; player.hp = 90;
    expect(room.useItem(player.id, start + 1100)).toBe(true); room.update(1 / 30, start + 2500); expect(player.hp).toBe(90);
    room.update(1 / 30, start + 3201); expect(player.hp).toBe(100); expect(player.inventory[1]?.count).toBe(1);
  });

  it("rejects malformed or out-of-phase gameplay commands", async () => {
    const { server, url } = await setup(); const host = await client(url); const joined = await createRoom(host, "Validator"); if (!joined.ok) throw new Error(joined.error);
    const room = server.manager.rooms.get(joined.room.code) as BattleRoyaleRoom; const player = room.players.get(joined.playerId)!;
    player.deployment = "grounded"; player.inventory[0] = { instanceId: "pulse", itemId: "pulse-rifle", rarity: "common", count: 1, magazine: 30 };
    expect(room.fire(player.id, player.position, { x: 0, y: 0, z: -1 }, Date.now())).toBe(false);
    room.phase = "combat";
    expect(room.fire(player.id, undefined as never, undefined as never, Date.now())).toBe(false);
    expect(room.fire(player.id, player.position, { x: 0, y: 0, z: 0 }, Date.now())).toBe(false);
    expect(() => room.ping(player.id, "move", undefined as never)).not.toThrow();
    expect(() => room.playEmote(player.id, "wave", undefined as never)).not.toThrow();
  });

  it("keeps eliminated spectators relevant and cycles living targets", async () => {
    const { server, url } = await setup(); const host = await client(url); const joined = await createRoom(host, "Watcher"); if (!joined.ok) throw new Error(joined.error);
    const room = server.manager.rooms.get(joined.room.code) as BattleRoyaleRoom; room.configure(joined.playerId, { targetPlayers: 10, fillBots: true }); room.setReady(joined.playerId, true);
    const start = Date.now(); room.start(joined.playerId, start); const player = room.players.get(joined.playerId)!; player.alive = false; player.deployment = "eliminated"; player.spectatorTargetId = [...room.players.values()].find((entry) => entry.alive)?.id ?? null;
    const previous = player.spectatorTargetId; room.cycleSpectator(player.id, 1); expect(player.spectatorTargetId).not.toBe(previous); expect(room.players.get(player.spectatorTargetId!)?.alive).toBe(true);
  });

  it("rejects stale input and sweeps fast projectiles through player hitboxes", async () => {
    const { server, url } = await setup(); const host = await client(url); const joined = await createRoom(host, "Pulse"); if (!joined.ok) throw new Error(joined.error);
    const room = server.manager.rooms.get(joined.room.code) as BattleRoyaleRoom; room.configure(joined.playerId, { targetPlayers: 10, fillBots: true }); room.setReady(joined.playerId, true);
    const start = Date.now(); room.start(joined.playerId, start); room.phase = "combat";
    const shooter = room.players.get(joined.playerId)!; const target = [...room.players.values()].find((player) => player.teamId !== shooter.teamId)!;
    shooter.deployment = "grounded"; shooter.position = { x: 100, y: 0, z: 12 }; shooter.inventory[0] = { instanceId: "arc", itemId: "arc-blaster", rarity: "common", count: 1, magazine: 18 };
    target.deployment = "grounded"; target.position = { x: 100, y: 0, z: 8 }; target.nextBotDecisionAt = Number.MAX_SAFE_INTEGER;
    room.setInput(shooter.id, { sequence: 2, dt: .05, moveX: 0, moveY: 0, yaw: 0, pitch: 0, jump: false, sprint: false, crouch: false, fire: false, aim: false, reload: false });
    room.setInput(shooter.id, { sequence: 1, dt: .05, moveX: 1, moveY: 1, yaw: 2, pitch: 0, jump: true, sprint: true, crouch: false, fire: true, aim: false, reload: false });
    expect(shooter.lastInputSequence).toBe(2); expect(shooter.input?.moveX).toBe(0);
    room.update(.001, start + 10); expect(room.fire(shooter.id, { x: 100, y: .7, z: 12 }, { x: 0, y: 0, z: -1 }, start, start + 20)).toBe(true);
    const durabilityBefore = target.hp + target.shield;
    room.update(.1, start + 120); expect(target.hp + target.shield).toBeLessThan(durabilityBefore); expect(room.projectiles.size).toBe(0);
  });

  it("awards session progression and preserves it when the room returns to lobby", async () => {
    const { server, url } = await setup(); const host = await client(url); const joined = await createRoom(host, "Champion"); if (!joined.ok) throw new Error(joined.error);
    const room = server.manager.rooms.get(joined.room.code) as BattleRoyaleRoom; room.configure(joined.playerId, { targetPlayers: 10, fillBots: true }); room.setReady(joined.playerId, true);
    const start = Date.now(); room.start(joined.playerId, start); room.phase = "combat"; room.update(1 / 30, start + BR_BALANCE.matchTimeoutMs + 1);
    const player = room.players.get(joined.playerId)!; expect(room.phase).toBe("results"); expect(room.matchResult?.winningTeamId).toBe(player.teamId); expect(player.crowns).toBe(1); expect(player.fallbucks).toBeGreaterThanOrEqual(100); expect(player.sessionTotalXp).toBeGreaterThanOrEqual(100);
    room.returnToLobby(player.id); expect(room.phase).toBe("lobby"); expect(room.players.size).toBe(1); expect(player.crowns).toBe(1); expect(player.fallbucks).toBeGreaterThanOrEqual(100); expect(player.sessionTotalXp).toBeGreaterThanOrEqual(100);
  });

  it("requires two crews when bot fill is disabled", async () => {
    const { server, url } = await setup(); const host = await client(url); const joined = await createRoom(host, "Private"); if (!joined.ok) throw new Error(joined.error);
    const room = server.manager.rooms.get(joined.room.code) as BattleRoyaleRoom; const guestSocket = await client(url); const guest = await joinRoom(guestSocket, room.code, "Guest"); if (!guest.ok) throw new Error(guest.error);
    room.configure(joined.playerId, { teamMode: "squad", targetPlayers: 10, fillBots: false }); room.setReady(joined.playerId, true); room.setReady(guest.playerId, true);
    expect(room.start(joined.playerId, Date.now())).toBe(false); expect(room.phase).toBe("lobby");
  });

  it("requires every connected human return vote and clears match bots without clearing session rewards", async () => {
    const { server, url } = await setup(); const hostSocket = await client(url); const joined = await createRoom(hostSocket, "Host"); if (!joined.ok) throw new Error(joined.error);
    const room = server.manager.rooms.get(joined.room.code) as BattleRoyaleRoom; const guestSocket = await client(url); const guest = await joinRoom(guestSocket, room.code, "Guest"); if (!guest.ok) throw new Error(guest.error);
    room.configure(joined.playerId, { teamMode: "solo", targetPlayers: 10, fillBots: true }); room.setReady(joined.playerId, true); room.setReady(guest.playerId, true);
    const start = Date.now(); expect(room.start(joined.playerId, start)).toBe(true); room.phase = "combat"; room.update(1 / 30, start + BR_BALANCE.matchTimeoutMs + 1); expect(room.phase).toBe("results");
    const host = room.players.get(joined.playerId)!; const guestPlayer = room.players.get(guest.playerId)!; const hostSession = { crowns: host.crowns, fallbucks: host.fallbucks, xp: host.sessionTotalXp };
    room.returnToLobby(host.id); expect(room.phase).toBe("results"); expect(room.returnVotes.has(host.id)).toBe(true);
    room.returnToLobby(guestPlayer.id); expect(room.phase).toBe("lobby"); expect([...room.players.values()].every((player) => !player.isBot)).toBe(true); expect(room.players.size).toBe(2); expect({ crowns: host.crowns, fallbucks: host.fallbucks, xp: host.sessionTotalXp }).toEqual(hostSession);
  });
});
