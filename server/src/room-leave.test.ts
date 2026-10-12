import { afterEach, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import type { BrJoinResult, ClientToServerEvents, JoinResult, LeaveRoomResult, ServerToClientEvents } from "@planetfall/shared";
import { createPlanetfallServer } from "./app.js";
import { GameRoom } from "./game-room.js";
import { BattleRoyaleRoom } from "./modes/battle-royale/br-room.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type Family = "classic" | "br";
type Joined = Extract<JoinResult | BrJoinResult, { ok: true }>;
const clients: Client[] = [];
const servers: Awaited<ReturnType<typeof createPlanetfallServer>>[] = [];
afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect();
  for (const server of servers.splice(0)) await server.close();
});
async function setup() {
  const server = await createPlanetfallServer({ port: 0, host: "127.0.0.1", nodeEnv: "test", clientOrigins: ["http://test.local"] });
  servers.push(server);
  return { server, ...(await server.listen()) };
}
async function connect(url: string) {
  const socket: Client = io(url, { transports: ["websocket"], extraHeaders: { Origin: "http://test.local" }, forceNew: true, reconnection: false });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); });
  return socket;
}
async function enter(socket: Client, family: Family, name: string, code?: string, sessionToken?: string): Promise<Joined> {
  const result = await new Promise<JoinResult | BrJoinResult>((resolve) => {
    if (family === "classic") {
      if (code) socket.emit("room:join", { code, name, sessionToken }, resolve);
      else socket.emit("room:create", { name }, resolve);
    } else if (code) socket.emit("br:room:join", { code, name, sessionToken }, resolve);
    else socket.emit("br:room:create", { name }, resolve);
  });
  if (!result.ok) throw new Error(result.error);
  return result;
}
function leave(socket: Client, code: string): Promise<LeaveRoomResult> { return new Promise((resolve) => socket.emit("room:leave", { code }, resolve)); }

describe.each<Family>(["classic", "br"])("%s explicit room departure", (family) => {
  it("removes lobby membership, migrates host and frees the same socket for the other family", async () => {
    const { server, url } = await setup();
    const host = await connect(url); const guest = await connect(url);
    const created = await enter(host, family, "Host");
    const joined = await enter(guest, family, "Guest", created.room.code);
    const room = server.manager.rooms.get(created.room.code)!;
    const serverSocket = server.io.sockets.sockets.get(host.id!)!;
    let oldRoomBroadcasts = 0;
    host.on(family === "classic" ? "room:state" : "br:room:state", () => oldRoomBroadcasts++);
    expect(await leave(host, room.code)).toEqual({ ok: true });
    expect(room.players.has(created.playerId)).toBe(false);
    expect(room.hostId).toBe(joined.playerId);
    expect(serverSocket.rooms.has(room.code)).toBe(false);
    expect(serverSocket.data.roomCode).toBeUndefined();
    expect(serverSocket.data.playerId).toBeUndefined();
    expect(serverSocket.data.gameFamily).toBeUndefined();
    expect(oldRoomBroadcasts).toBe(0);
    expect(await leave(host, room.code)).toEqual({ ok: true });
    const next = await enter(host, family === "classic" ? "br" : "classic", "Host");
    expect(await leave(host, room.code)).toEqual({ ok: false, error: "That is not your current room." });
    expect(serverSocket.data.roomCode).toBe(next.room.code);
    const replacement = await enter(await connect(url), family, "Host", room.code, created.sessionToken);
    expect(replacement.playerId).not.toBe(created.playerId);
  });

  it("immediately disposes the final human's room, including its bots", async () => {
    const { server, url } = await setup(); const socket = await connect(url);
    const joined = await enter(socket, family, "Solo"); const room = server.manager.rooms.get(joined.room.code)!;
    if (room instanceof GameRoom) room.addBot(joined.playerId);
    else { room.configure(joined.playerId, { fillBots: true, targetPlayers: 10 }); room.setReady(joined.playerId, true); room.start(joined.playerId); }
    expect(room.players.size).toBeGreaterThan(1);
    expect(await leave(socket, room.code)).toEqual({ ok: true });
    expect(server.manager.rooms.has(room.code)).toBe(false);
    expect(room.players.size).toBe(0);
  });

  it("forfeits active play immediately and permanently invalidates the old session", async () => {
    const { server, url } = await setup(); const host = await connect(url); const guest = await connect(url);
    const created = await enter(host, family, "Host"); const joined = await enter(guest, family, "Guest", created.room.code);
    const room = server.manager.rooms.get(created.room.code)!;
    if (room instanceof GameRoom) { room.setReady(created.playerId, true); room.setReady(joined.playerId, true); room.start(created.playerId); room.phase = "playing"; }
    else { room.configure(created.playerId, { fillBots: false }); room.setReady(created.playerId, true); room.setReady(joined.playerId, true); room.start(created.playerId); room.phase = "combat"; }
    expect(await leave(guest, room.code)).toEqual({ ok: true });
    expect(room.phase).toBe("results");
    if (room instanceof BattleRoyaleRoom) {
      const tombstone = room.players.get(joined.playerId)!;
      expect(tombstone.alive).toBe(false); expect(tombstone.connected).toBe(false);
      expect(tombstone.sessionToken).toBe(""); expect(tombstone.disconnectedAt).toBeNull();
      expect(room.matchResult?.players.some((player) => player.playerId === joined.playerId)).toBe(true);
    } else expect(room.planets.get(room.view().planets.find((planet) => planet.ownerId === joined.playerId)!.id)?.alive).toBe(false);
    const returning = await connect(url);
    const rejected = await new Promise<JoinResult | BrJoinResult>((resolve) => {
      if (family === "classic") returning.emit("room:join", { code: room.code, name: "Guest", sessionToken: joined.sessionToken }, resolve);
      else returning.emit("br:room:join", { code: room.code, name: "Guest", sessionToken: joined.sessionToken }, resolve);
    });
    expect(rejected.ok).toBe(false);
    if (room instanceof BattleRoyaleRoom) room.returnToLobby(created.playerId); else room.voteRematch(created.playerId);
    expect(room.phase).toBe("lobby"); expect(room.players.has(joined.playerId)).toBe(false);
    await enter(returning, family, "Guest", room.code);
  });

  it("keeps genuine disconnect reconnectable and restores host after all humans disconnect", async () => {
    const { server, url } = await setup(); const original = await connect(url);
    const joined = await enter(original, family, "Host"); const room = server.manager.rooms.get(joined.room.code)!;
    original.disconnect();
    await expect.poll(() => room.players.get(joined.playerId)?.connected).toBe(false);
    expect(room.hostId).toBe(""); expect(server.manager.rooms.has(room.code)).toBe(true);
    const resumed = await enter(await connect(url), family, "Host", room.code, joined.sessionToken);
    expect(resumed.playerId).toBe(joined.playerId); expect(resumed.room.hostId).toBe(joined.playerId);
  });

  it("forfeits during countdown without moving the remaining arena or teams", async () => {
    const { server, url } = await setup(); const host = await connect(url); const guest = await connect(url);
    const created = await enter(host, family, "Host"); const joined = await enter(guest, family, "Guest", created.room.code);
    const room = server.manager.rooms.get(created.room.code)!;
    if (room instanceof GameRoom) { room.setReady(created.playerId, true); room.setReady(joined.playerId, true); }
    else { room.configure(created.playerId, { fillBots: false }); room.setReady(created.playerId, true); room.setReady(joined.playerId, true); }
    room.start(created.playerId);
    expect(room.phase).toBe("countdown");
    const hostTeam = room instanceof BattleRoyaleRoom ? room.players.get(created.playerId)!.teamId : null;
    const planet = room instanceof GameRoom ? { ...room.planets.get(room.players.get(created.playerId)!.planetId)!.position } : null;
    expect(await leave(guest, room.code)).toEqual({ ok: true });
    if (room instanceof GameRoom) {
      expect(room.planets.get(room.players.get(created.playerId)!.planetId)!.position).toEqual(planet);
      expect(room.phase).toBe("results");
    } else {
      expect(room.players.get(created.playerId)!.teamId).toBe(hostTeam);
      expect(room.players.get(joined.playerId)!.alive).toBe(false);
      expect(room.phase).toBe("countdown");
    }
  });

  it("reconciles already-cast result votes when the last nonvoter leaves", async () => {
    const { server, url } = await setup(); const host = await connect(url); const guest = await connect(url);
    const created = await enter(host, family, "Host"); const joined = await enter(guest, family, "Guest", created.room.code);
    const room = server.manager.rooms.get(created.room.code)!;
    room.phase = "results";
    if (room instanceof GameRoom) room.voteRematch(created.playerId); else room.returnToLobby(created.playerId);
    expect(room.phase).toBe("results");
    expect(await leave(guest, room.code)).toEqual({ ok: true });
    expect(room.phase).toBe("lobby");
    expect(room.players.has(joined.playerId)).toBe(false);
  });
});
