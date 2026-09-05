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
    this.timer = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - this.lastTick) / 1000);
      this.lastTick = now;
      for (const [code, room] of this.rooms) {
        room.update(dt, now);
        if (room.isEmpty()) this.rooms.delete(code);
      }
    }, 1000 / BALANCE.serverRate);
  }

  stop(): void { if (this.timer) clearInterval(this.timer); }

  bind(socket: GameSocket): void {
    socket.on("room:create", (payload, ack) => {
      const code = this.makeCode();
      const room = new GameRoom(code, this.io);
      this.rooms.set(code, room);
      const result = room.join(socket, payload?.name, payload?.sessionToken);
      if (!result.ok) this.rooms.delete(code);
      ack(result);
    });
    socket.on("room:solo", (payload, ack) => {
      const code = this.makeCode();
      const room = new GameRoom(code, this.io);
      this.rooms.set(code, room);
      const result = room.join(socket, payload?.name);
      if (!result.ok) {
        this.rooms.delete(code);
        return ack(result);
      }
      room.prepareSolo(result.playerId, 3);
      ack({ ...result, room: room.view() });
    });
    socket.on("room:join", (payload, ack) => {
      const code = String(payload?.code ?? "").trim().toUpperCase();
      const room = this.rooms.get(code);
      if (!room) return ack({ ok: false, error: "Room not found. It may have expired." });
      ack(room.join(socket, payload?.name, payload?.sessionToken));
    });
    socket.on("room:ready", ({ ready }) => this.current(socket)?.room.setReady(this.current(socket)!.playerId, ready));
    socket.on("room:bot:add", () => { const c = this.current(socket); if (c) c.room.addBot(c.playerId); });
    socket.on("room:bot:remove", ({ botId }) => { const c = this.current(socket); if (c) c.room.removeBot(c.playerId, String(botId)); });
    socket.on("match:start", () => { const c = this.current(socket); if (c) c.room.start(c.playerId); });
    socket.on("player:input", (input) => { const c = this.current(socket); if (c) c.room.setInput(c.playerId, input); });
    socket.on("player:interact", () => undefined);
    socket.on("cannon:fire", ({ weapon, direction }) => { const c = this.current(socket); if (c) c.room.fire(c.playerId, weapon, direction); });
    socket.on("repair:buy", () => { const c = this.current(socket); if (c) c.room.repair(c.playerId); });
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
}
