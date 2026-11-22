import { afterEach, describe, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { BALANCE, type ClientToServerEvents, type JoinResult, type ServerToClientEvents } from "@planetfall/shared";
import { createPlanetfallServer } from "./app.js";
import { GameRoom } from "./game-room.js";
import { PUBLIC_BOT_WAIT_MS, PUBLIC_SEARCH_LIMIT_MS } from "./public-matchmaking.js";

type PilotSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const cleanups: Array<() => unknown> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

async function service() {
  // nodeEnv=test explicitly selects the isolated in-memory profile store.
  const app = await createPlanetfallServer({ port: 0, host: "127.0.0.1", nodeEnv: "test" });
  const { url } = await app.listen();
  cleanups.push(() => app.close());
  return { app, url };
}
async function connect(url: string, token?: string, profile = true) {
  const socket: PilotSocket = io(url, { autoConnect: false, reconnection: false, forceNew: true,
    transports: ["websocket"], auth: { profile, profileToken: token } });
  cleanups.push(() => socket.disconnect());
  const ready = new Promise<{ token?: string }>((resolve, reject) => {
    socket.once("connect_error", reject);
    if (profile) socket.once("profile:ready", resolve);
    else socket.once("connect", () => resolve({}));
  });
  socket.connect();
  return { socket, token: (await ready).token };
}
const search = (socket: PilotSocket, name: string) => socket.timeout(2000).emitWithAck("quick:join", { name });
function joined(result: JoinResult): asserts result is Extract<JoinResult, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
}
function roomAt(app: Awaited<ReturnType<typeof createPlanetfallServer>>, code: string): GameRoom {
  const room = app.manager.rooms.get(code);
  expect(room).toBeInstanceOf(GameRoom);
  if (!(room instanceof GameRoom)) throw new Error("Missing Classic room");
  return room;
}
const barrier = (socket: PilotSocket) => socket.timeout(2000).emitWithAck("leaderboard:read");

describe("public Classic matchmaking over real Socket.IO and native Rapier", () => {
  it("creates one honest public lobby and matches a second verified guest into it", async () => {
    const { app, url } = await service(), a = await connect(url), b = await connect(url);
    const before = Date.now(), first = await search(a.socket, "Pilot One"); joined(first);
    expect(first.room.phase).toBe("lobby");
    expect(first.room.gameMode).toBe("classic");
    expect(first.room.matchmaking).toMatchObject({ humans: 1 });
    expect(first.room.matchmaking!.botsAvailableAt).toBeGreaterThanOrEqual(before + PUBLIC_BOT_WAIT_MS);
    expect(first.room.matchmaking!.expiresAt).toBeGreaterThanOrEqual(before + PUBLIC_SEARCH_LIMIT_MS);
    expect(first.room.players).toHaveLength(1);
    expect(first.room.players[0].isBot).toBe(false);
    const second = await search(b.socket, "Pilot Two"); joined(second);
    expect(second.room.code).toBe(first.room.code);
    expect(second.room.matchmaking?.humans).toBe(2);
    expect(second.room.players.every(player => !player.isBot)).toBe(true);
    expect(app.manager.rooms.size).toBe(1);
    a.socket.emit("room:mode", { mode: "chaos" }); await barrier(a.socket);
    expect(roomAt(app, first.room.code).gameMode).toBe("classic");
  });

  it("reserves simultaneous joins without overfilling the six-pilot public lobby", async () => {
    const { app, url } = await service();
    expect(BALANCE.maxPlayers).toBe(6);
    const pilots = await Promise.all(Array.from({ length: 7 }, () => connect(url)));
    const results = await Promise.all(pilots.map((pilot, index) => search(pilot.socket, `Pilot ${index}`)));
    for (const result of results) joined(result);
    const counts = [...app.manager.rooms.values()].map(room => room.players.size).sort((a, b) => a - b);
    expect(counts).toEqual([1, 6]);
    expect(new Set(results.flatMap(result => result.ok ? [result.playerId] : [] )).size).toBe(7);
    for (const room of app.manager.rooms.values()) expect(room.players.size).toBeLessThanOrEqual(BALANCE.maxPlayers);
  });

  it("never selects a private room or a public room that has already started", async () => {
    const { app, url } = await service(), host = await connect(url), a = await connect(url), b = await connect(url);
    const privateRoom = await host.socket.timeout(2000).emitWithAck("room:create", { name: "Private Host" }); joined(privateRoom);
    const publicRoom = await search(a.socket, "Public Host"); joined(publicRoom);
    expect(publicRoom.room.code).not.toBe(privateRoom.room.code);
    expect(privateRoom.room.matchmaking).toBeUndefined();
    const room = roomAt(app, publicRoom.room.code);
    room.matchmaking!.botsAvailableAt = 0; // Isolated deadline fixture, not elapsed browser time.
    expect(await a.socket.timeout(2000).emitWithAck("quick:bots")).toEqual({ ok: true });
    expect(room.phase).toBe("countdown");
    const next = await search(b.socket, "Next Pilot"); joined(next);
    expect(next.room.code).not.toBe(privateRoom.room.code);
    expect(next.room.code).not.toBe(publicRoom.room.code);
    expect(roomAt(app, privateRoom.room.code).players.size).toBe(1);
  });

  it("makes repeated requests idempotent and denies a second tab for the same verified identity", async () => {
    const { app, url } = await service(), a = await connect(url);
    const first = await search(a.socket, "Pilot One"); joined(first);
    const repeated = await Promise.all([search(a.socket, "Renamed"), search(a.socket, "Again")]);
    for (const result of repeated) {
      joined(result); expect(result.playerId).toBe(first.playerId); expect(result.sessionToken).toBe(first.sessionToken);
      expect(result.room.code).toBe(first.room.code);
    }
    const tab = await connect(url, a.token);
    expect(await search(tab.socket, "Other Tab")).toMatchObject({ ok: false, error: expect.stringContaining("another tab") });
    expect(app.manager.rooms.size).toBe(1);
    expect(roomAt(app, first.room.code).players.size).toBe(1);
  });

  it("denies searching while already in a private room, including from another identity tab", async () => {
    const { app, url } = await service(), a = await connect(url);
    const privateRoom = await a.socket.timeout(2000).emitWithAck("room:create", { name: "Private Host" }); joined(privateRoom);
    expect(await search(a.socket, "Same Socket")).toMatchObject({ ok: false });
    const tab = await connect(url, a.token);
    expect(await search(tab.socket, "Second Tab")).toMatchObject({ ok: false });
    expect(app.manager.rooms.size).toBe(1);
    expect(roomAt(app, privateRoom.room.code).players.size).toBe(1);
  });

  it("blocks ordinary public-code joins from duplicate tabs and other identities while preserving private invites", async () => {
    const { app, url } = await service(), a = await connect(url);
    const first = await search(a.socket, "Public Pilot"); joined(first);
    const duplicate = await connect(url, a.token), outsider = await connect(url);
    const withoutToken = await duplicate.socket.timeout(2000).emitWithAck("room:join", { code: first.room.code, name: "Duplicate Pilot" });
    expect(withoutToken).toMatchObject({ ok: false, error: expect.stringContaining("Quick Match") });
    const withConnectedToken = await duplicate.socket.timeout(2000).emitWithAck("room:join", { code: first.room.code, name: "Copied Session", sessionToken: first.sessionToken });
    expect(withConnectedToken).toMatchObject({ ok: false, error: expect.stringContaining("Quick Match") });
    const otherIdentity = await outsider.socket.timeout(2000).emitWithAck("room:join", { code: first.room.code, name: "Outside Pilot" });
    expect(otherIdentity).toMatchObject({ ok: false, error: expect.stringContaining("Quick Match") });
    expect(app.manager.rooms.size).toBe(1);
    expect(roomAt(app, first.room.code).players.size).toBe(1);
    const privateHost = await connect(url);
    const privateRoom = await privateHost.socket.timeout(2000).emitWithAck("room:create", { name: "Private Host" }); joined(privateRoom);
    const invited = await outsider.socket.timeout(2000).emitWithAck("room:join", { code: privateRoom.room.code, name: "Invited Pilot" }); joined(invited);
    expect(invited.room.code).toBe(privateRoom.room.code);
    expect(invited.room.matchmaking).toBeUndefined();
    expect(roomAt(app, privateRoom.room.code).players.size).toBe(2);
    expect(roomAt(app, first.room.code).players.size).toBe(1);
  });

  it("resumes a disconnected pilot in a full started public match only for the original profile and session", async () => {
    const { app, url } = await service();
    const pilots = await Promise.all(Array.from({ length: BALANCE.maxPlayers }, () => connect(url)));
    // Establish a known host, then fill its actual public lobby through queue requests.
    const first = await search(pilots[0].socket, "Pilot 0"); joined(first);
    for (let index = 1; index < pilots.length; index++) {
      const result = await search(pilots[index].socket, `Pilot ${index}`); joined(result);
      expect(result.room.code).toBe(first.room.code);
    }
    const room = roomAt(app, first.room.code);
    for (const pilot of pilots) pilot.socket.emit("room:ready", { ready: true });
    await Promise.all(pilots.map(pilot => barrier(pilot.socket)));
    pilots[0].socket.emit("match:start"); await barrier(pilots[0].socket);
    expect(room.phase).toBe("countdown");
    // Advance the real room lifecycle at its scheduled start; no outcome or result is injected.
    room.update(0, room.countdownStartsAt! + 1);
    expect(room.phase).toBe("playing");
    pilots[0].socket.disconnect();
    await vi.waitFor(() => expect(room.players.get(first.playerId)?.connected).toBe(false));
    expect(room.players.size).toBe(BALANCE.maxPlayers);
    const outsider = await connect(url);
    expect(await outsider.socket.timeout(2000).emitWithAck("room:join", { code: room.code, name: "Stolen Session", sessionToken: first.sessionToken })).toMatchObject({ ok: false, error: expect.stringContaining("original pilot") });
    const returning = await connect(url, pilots[0].token);
    const resumed = await returning.socket.timeout(2000).emitWithAck("room:join", { code: room.code, name: "Pilot 0", sessionToken: first.sessionToken }); joined(resumed);
    expect(resumed.playerId).toBe(first.playerId);
    expect(resumed.sessionToken).toBe(first.sessionToken);
    expect(resumed.room.phase).toBe("playing");
    expect(room.players.size).toBe(BALANCE.maxPlayers);
    expect(room.players.get(first.playerId)?.connected).toBe(true);
    expect(app.manager.rooms.size).toBe(1);
    // Simulate the post-match waiting phase to verify the new transport owns
    // its queue reservation, rather than retaining the disconnected socket ID.
    room.phase="lobby";returning.socket.disconnect();
    await vi.waitFor(()=>expect(room.players.has(first.playerId)).toBe(false));
  });

  it("cancels membership, removes empty rooms and permits the same pilot to search after reconnecting", async () => {
    const { app, url } = await service(), a = await connect(url);
    const first = await search(a.socket, "Pilot One"); joined(first);
    expect(await a.socket.timeout(2000).emitWithAck("quick:cancel")).toEqual({ ok: true });
    expect(app.manager.rooms.has(first.room.code)).toBe(false);
    expect(await a.socket.timeout(2000).emitWithAck("quick:cancel")).toMatchObject({ ok: false });
    a.socket.disconnect();
    const reconnected = await connect(url, a.token), again = await search(reconnected.socket, "Pilot One"); joined(again);
    expect(again.room.matchmaking?.humans).toBe(1);
    expect(app.manager.rooms.size).toBe(1);
  });

  it("removes disconnected lobby pilots immediately and leaves no occupied queue slot", async () => {
    const { app, url } = await service(), a = await connect(url), b = await connect(url);
    const first = await search(a.socket, "Pilot One"); joined(first);
    const second = await search(b.socket, "Pilot Two"); joined(second);
    a.socket.disconnect();
    await vi.waitFor(() => expect(roomAt(app, first.room.code).players.size).toBe(1));
    const reconnected = await connect(url, a.token), again = await search(reconnected.socket, "Pilot One"); joined(again);
    expect(again.room.code).toBe(second.room.code);
    expect(again.room.matchmaking?.humans).toBe(2);
    b.socket.disconnect(); reconnected.socket.disconnect();
    await vi.waitFor(() => expect(app.manager.rooms.size).toBe(0));
  });

  it("expires waiting searches, clears every membership and emits a useful end notification", async () => {
    const { app, url } = await service(), a = await connect(url), b = await connect(url);
    const first = await search(a.socket, "Pilot One"); joined(first);
    joined(await search(b.socket, "Pilot Two"));
    const messages = [a.socket, b.socket].map(socket => new Promise<string>(resolve => socket.once("quick:ended", resolve)));
    roomAt(app, first.room.code).matchmaking!.expiresAt = 0; // Exercise the real manager timer without a five-minute sleep.
    expect(await Promise.all(messages)).toEqual([expect.stringContaining("Search ended"), expect.stringContaining("Search ended")]);
    expect(app.manager.rooms.has(first.room.code)).toBe(false);
    // Profile identity survives expiry; a fresh transport has no per-socket retry cooldown.
    a.socket.disconnect();
    const reconnected = await connect(url, a.token), next = await search(reconnected.socket, "Pilot One"); joined(next);
    expect(app.manager.rooms.size).toBe(1);
    expect(next.room.players).toHaveLength(1);
  });

  it("offers bots only after the deadline, labels them honestly, and starts once", async () => {
    const { app, url } = await service(), a = await connect(url);
    const first = await search(a.socket, "Pilot One"); joined(first);
    const countdown = vi.fn(); a.socket.on("match:countdown", countdown);
    expect(await a.socket.timeout(2000).emitWithAck("quick:bots")).toMatchObject({ ok: false, error: expect.stringContaining("moment") });
    const room = roomAt(app, first.room.code);
    expect(room.players.size).toBe(1);
    room.matchmaking!.botsAvailableAt = 0; // Deadline injection tests server behavior, not real waiting UX.
    expect(await a.socket.timeout(2000).emitWithAck("quick:bots")).toEqual({ ok: true });
    expect(room.phase).toBe("countdown");
    expect(room.view().matchmaking?.humans).toBe(1);
    expect(room.view().players.filter(player => player.isBot)).toHaveLength(3);
    expect(room.view().players.filter(player => !player.isBot)).toHaveLength(1);
    const startsAt = room.countdownStartsAt;
    a.socket.emit("match:start"); a.socket.emit("match:start");
    expect(await a.socket.timeout(2000).emitWithAck("quick:bots")).toMatchObject({ ok: false });
    expect(countdown).toHaveBeenCalledTimes(1);
    expect(room.countdownStartsAt).toBe(startsAt);
    expect(await a.socket.timeout(2000).emitWithAck("quick:cancel")).toMatchObject({ ok: false });
  });

  it("requires the other human to be ready before bot fallback and denies a non-host start", async () => {
    const { app, url } = await service(), a = await connect(url), b = await connect(url);
    const first = await search(a.socket, "Pilot One"); joined(first);
    joined(await search(b.socket, "Pilot Two"));
    const room = roomAt(app, first.room.code); room.matchmaking!.botsAvailableAt = 0;
    expect(await b.socket.timeout(2000).emitWithAck("quick:bots")).toMatchObject({ ok: false, error: expect.stringContaining("host") });
    expect(await a.socket.timeout(2000).emitWithAck("quick:bots")).toMatchObject({ ok: false, error: expect.stringContaining("ready") });
    b.socket.emit("room:ready", { ready: true }); await barrier(b.socket);
    expect(await a.socket.timeout(2000).emitWithAck("quick:bots")).toEqual({ ok: true });
    expect(room.phase).toBe("countdown");
    expect(room.view().matchmaking?.humans).toBe(2);
    expect(room.view().players.filter(player => player.isBot)).toHaveLength(2);
  });

  it("uses the normal authoritative ready/start rules and ignores duplicate start messages", async () => {
    const { app, url } = await service(), a = await connect(url), b = await connect(url);
    const first = await search(a.socket, "Pilot One"); joined(first);
    joined(await search(b.socket, "Pilot Two"));
    const room = roomAt(app, first.room.code), countdown = vi.fn();
    a.socket.on("match:countdown", countdown);
    a.socket.emit("match:start"); await barrier(a.socket);
    expect(room.phase).toBe("lobby");
    a.socket.emit("room:ready", { ready: true }); b.socket.emit("room:ready", { ready: true });
    await Promise.all([barrier(a.socket), barrier(b.socket)]);
    a.socket.emit("match:start"); a.socket.emit("match:start"); await barrier(a.socket);
    expect(room.phase).toBe("countdown");
    expect(countdown).toHaveBeenCalledTimes(1);
    expect([...room.players.values()].every(player => !player.isBot)).toBe(true);
  });

  it("requires a prepared profile and rejects invalid names without creating phantom rooms", async () => {
    const { app, url } = await service(), unverified = await connect(url, undefined, false);
    expect(await search(unverified.socket, "No Profile")).toMatchObject({ ok: false, error: expect.stringContaining("saved pilot") });
    const a = await connect(url);
    expect(a.token).toEqual(expect.any(String));
    for (const payload of [null, {}, { name: 12 }, { name: "   " }, { name: "<>☄" }]) {
      expect(await a.socket.timeout(2000).emitWithAck("quick:join", payload as { name: string })).toMatchObject({ ok: false });
      expect(app.manager.rooms.size).toBe(0);
    }
    joined(await search(a.socket, "Ready Guest"));
    expect(app.manager.rooms.size).toBe(1);
  });
});
