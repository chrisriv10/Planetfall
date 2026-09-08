import { randomBytes } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { BALANCE, type ClientToServerEvents, type JoinResult, type ServerToClientEvents } from "@planetfall/shared";
import { GameRoom } from "./game-room.js";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class RoomManager {
  rooms = new Map<string, GameRoom>();
  private timer: NodeJS.Timeout | null = null;
  private lastTick = Date.now();

  constructor(private io: GameServer) {}

  start(): void {
    if (this.timer) return;
    this.lastTick = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - this.lastTick) / 1000);
      this.lastTick = now;
      for (const [code, room] of this.rooms) {
        room.update(dt, now);
        if (room.isEmpty()) {
          room.dispose();
          this.rooms.delete(code);
        }
      }
    }, 1000 / BALANCE.serverRate);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const room of this.rooms.values()) room.dispose();
    this.rooms.clear();
  }

  bind(socket: GameSocket): void {
    socket.on("room:create", (payload, ack) => {
      if (this.current(socket)) return this.reply(ack, { ok: false, error: "Already in a room." });
      const code = this.makeCode();
      const room = new GameRoom(code, this.io);
      this.rooms.set(code, room);
      const result = room.join(socket, payload?.name, payload?.sessionToken);
      if (!result.ok) {
        room.dispose();
        this.rooms.delete(code);
      }
      this.reply(ack, result);
    });
    socket.on("room:solo", (payload, ack) => {
      if (this.current(socket)) return this.reply(ack, { ok: false, error: "Already in a room." });
      const code = this.makeCode();
      const room = new GameRoom(code, this.io);
      this.rooms.set(code, room);
      const result = room.join(socket, payload?.name);
      if (!result.ok) {
        room.dispose();
        this.rooms.delete(code);
        return this.reply(ack, result);
      }
      room.prepareSolo(result.playerId, 3);
      this.reply(ack, { ...result, room: room.view() });
    });
    socket.on("room:join", (payload, ack) => {
      if (this.current(socket)) return this.reply(ack, { ok: false, error: "Already in a room." });
      const code = String(payload?.code ?? "").trim().toUpperCase();
      const room = this.rooms.get(code);
      if (!room) return this.reply(ack, { ok: false, error: "Room not found. It may have expired." });
      this.reply(ack, room.join(socket, payload?.name, payload?.sessionToken));
    });
    socket.on("room:ready", (payload) => { const c = this.current(socket); if (c) c.room.setReady(c.playerId, payload?.ready); });
    socket.on("room:bot:add", () => { const c = this.current(socket); if (c) c.room.addBot(c.playerId); });
    socket.on("room:bot:remove", (payload) => { const c = this.current(socket); if (c) c.room.removeBot(c.playerId, String(payload?.botId ?? "")); });
    socket.on("room:mode", (payload) => { const c = this.current(socket); if (c) c.room.setMode(c.playerId, payload?.mode); });
    socket.on("room:bot:difficulty", (payload) => { const c = this.current(socket); if (c) c.room.setBotDifficulty(c.playerId, payload?.difficulty); });
    socket.on("match:start", () => { const c = this.current(socket); if (c) c.room.start(c.playerId); });
    socket.on("player:input", (input) => { const c = this.current(socket); if (c) c.room.setInput(c.playerId, input); });
    socket.on("player:interact", (payload) => { const c = this.current(socket); if (c) c.room.interact(c.playerId, payload); });
    socket.on("cannon:fire", (payload) => { const c = this.current(socket); if (c) c.room.fire(c.playerId, payload?.weapon, payload?.direction); });
    socket.on("repair:buy", () => { const c = this.current(socket); if (c) c.room.repair(c.playerId); });
    socket.on("player:emote", (payload) => { const c = this.current(socket); if (c) c.room.playEmote(c.playerId, payload?.emote, payload?.direction); });
    socket.on("shop:buy", (payload, ack) => {
      const c = this.current(socket);
      if (typeof ack === "function") ack(c ? c.room.buyShopItem(c.playerId, payload?.itemId) : { ok: false, error: "Not in a room." });
    });
    socket.on("shop:equip", (payload, ack) => {
      const c = this.current(socket);
      if (typeof ack === "function") ack(c ? c.room.equipShopItem(c.playerId, payload?.itemId) : { ok: false, error: "Not in a room." });
    });
    socket.on("match:rematch", () => { const c = this.current(socket); if (c) c.room.voteRematch(c.playerId); });
    socket.on("disconnect", () => { const c = this.current(socket); if (c) c.room.disconnect(c.playerId); });
  }

  private current(socket: GameSocket): { room: GameRoom; playerId: string } | null {
    const code = socket.data.roomCode as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    const room = code ? this.rooms.get(code) : undefined;
    return room && playerId ? { room, playerId } : null;
  }

  private makeCode(): string {
    for (;;) {
      const bytes = randomBytes(6);
      let code = "";
      for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
      if (!this.rooms.has(code)) return code;
    }
  }

  private reply(ack: unknown, result: JoinResult): void {
    if (typeof ack === "function") (ack as (value: JoinResult) => void)(result);
  }
}
