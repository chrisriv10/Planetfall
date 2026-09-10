import { randomBytes } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { BALANCE, type BrJoinResult, type ClientToServerEvents, type JoinResult, type ServerToClientEvents } from "@planetfall/shared";
import { GameRoom } from "./game-room.js";
import { BattleRoyaleRoom } from "./modes/battle-royale/br-room.js";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class RoomManager {
  rooms = new Map<string, GameRoom | BattleRoyaleRoom>();
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
      if (room instanceof BattleRoyaleRoom) return this.reply(ack, { ok: false, error: "That code belongs to a Battle Royale room." });
      this.reply(ack, room.join(socket, payload?.name, payload?.sessionToken));
    });
    socket.on("room:ready", (payload) => { const c = this.currentClassic(socket); if (c) c.room.setReady(c.playerId, payload?.ready); });
    socket.on("room:bot:add", () => { const c = this.currentClassic(socket); if (c) c.room.addBot(c.playerId); });
    socket.on("room:bot:remove", (payload) => { const c = this.currentClassic(socket); if (c) c.room.removeBot(c.playerId, String(payload?.botId ?? "")); });
    socket.on("room:mode", (payload) => { const c = this.currentClassic(socket); if (c) c.room.setMode(c.playerId, payload?.mode); });
    socket.on("room:bot:difficulty", (payload) => { const c = this.currentClassic(socket); if (c) c.room.setBotDifficulty(c.playerId, payload?.difficulty); });
    socket.on("match:start", () => { const c = this.currentClassic(socket); if (c) c.room.start(c.playerId); });
    socket.on("player:input", (input) => { const c = this.currentClassic(socket); if (c) c.room.setInput(c.playerId, input); });
    socket.on("player:interact", (payload) => { const c = this.currentClassic(socket); if (c) c.room.interact(c.playerId, payload); });
    socket.on("cannon:fire", (payload) => { const c = this.currentClassic(socket); if (c) c.room.fire(c.playerId, payload?.weapon, payload?.direction); });
    socket.on("repair:buy", () => { const c = this.currentClassic(socket); if (c) c.room.repair(c.playerId); });
    socket.on("player:emote", (payload) => { const c = this.currentClassic(socket); if (c) c.room.playEmote(c.playerId, payload?.emote, payload?.direction); });
    socket.on("shop:buy", (payload, ack) => {
      const c = this.currentClassic(socket);
      if (typeof ack === "function") ack(c ? c.room.buyShopItem(c.playerId, payload?.itemId) : { ok: false, error: "Not in a room." });
    });
    socket.on("shop:equip", (payload, ack) => {
      const c = this.currentClassic(socket);
      if (typeof ack === "function") ack(c ? c.room.equipShopItem(c.playerId, payload?.itemId) : { ok: false, error: "Not in a room." });
    });
    socket.on("match:rematch", () => { const c = this.currentClassic(socket); if (c) c.room.voteRematch(c.playerId); });

    socket.on("br:room:create", (payload, ack) => {
      if (this.current(socket)) return this.replyBr(ack, { ok: false, error: "Already in a room." });
      const code = this.makeCode(); const room = new BattleRoyaleRoom(code, this.io); this.rooms.set(code, room);
      const result = room.join(socket, payload?.name, payload?.sessionToken);
      if (!result.ok) { room.dispose(); this.rooms.delete(code); }
      this.replyBr(ack, result);
    });
    socket.on("br:room:join", (payload, ack) => {
      if (this.current(socket)) return this.replyBr(ack, { ok: false, error: "Already in a room." });
      const code = String(payload?.code ?? "").trim().toUpperCase(); const room = this.rooms.get(code);
      if (!room) return this.replyBr(ack, { ok: false, error: "Room not found. It may have expired." });
      if (!(room instanceof BattleRoyaleRoom)) return this.replyBr(ack, { ok: false, error: "That code belongs to Planetfall Classic." });
      this.replyBr(ack, room.join(socket, payload?.name, payload?.sessionToken));
    });
    socket.on("br:room:ready", (payload) => { const c = this.currentBr(socket); if (c) c.room.setReady(c.playerId, payload?.ready); });
    socket.on("br:room:configure", (payload) => { const c = this.currentBr(socket); if (c) c.room.configure(c.playerId, payload ?? {}); });
    socket.on("br:match:start", () => { const c = this.currentBr(socket); if (c) c.room.start(c.playerId); });
    socket.on("br:player:input", (payload) => { const c = this.currentBr(socket); if (c) c.room.setInput(c.playerId, payload); });
    socket.on("br:player:jump", () => { const c = this.currentBr(socket); if (c) c.room.jumpFromShip(c.playerId); });
    socket.on("br:player:deploy", () => { const c = this.currentBr(socket); if (c) c.room.deployChute(c.playerId); });
    socket.on("br:inventory:select", (payload) => { const c = this.currentBr(socket); if (c) c.room.selectSlot(c.playerId, payload?.slot); });
    socket.on("br:inventory:pickup", (payload) => { const c = this.currentBr(socket); if (c) c.room.pickup(c.playerId, String(payload?.lootId ?? ""), payload?.replaceSlot); });
    socket.on("br:inventory:drop", (payload) => { const c = this.currentBr(socket); if (c) c.room.drop(c.playerId, payload?.slot); });
    socket.on("br:crate:open", (payload) => { const c = this.currentBr(socket); if (c) c.room.openCrate(c.playerId, String(payload?.crateId ?? "")); });
    socket.on("br:weapon:fire", (payload) => { const c = this.currentBr(socket); if (c) c.room.fire(c.playerId, payload?.origin, payload?.direction, payload?.clientTime); });
    socket.on("br:weapon:reload", () => { const c = this.currentBr(socket); if (c) c.room.reload(c.playerId); });
    socket.on("br:item:use", () => { const c = this.currentBr(socket); if (c) c.room.useItem(c.playerId); });
    socket.on("br:revive", (payload) => { const c = this.currentBr(socket); if (c) c.room.setRevive(c.playerId, String(payload?.targetId ?? ""), Boolean(payload?.active)); });
    socket.on("br:spectate:cycle", (payload) => { const c = this.currentBr(socket); if (c) c.room.cycleSpectator(c.playerId, payload?.direction); });
    socket.on("br:ping", (payload) => { const c = this.currentBr(socket); if (c) c.room.ping(c.playerId, payload?.type, payload?.position, payload?.itemId); });
    socket.on("br:emote", (payload) => { const c = this.currentBr(socket); if (c) c.room.playEmote(c.playerId, payload?.emote, payload?.direction); });
    socket.on("br:match:return", () => { const c = this.currentBr(socket); if (c) c.room.returnToLobby(c.playerId); });
    socket.on("br:shop:buy", (payload, ack) => { const c = this.currentBr(socket); if (typeof ack === "function") ack(c ? c.room.buyShopItem(c.playerId, String(payload?.itemId ?? "")) : { ok: false, error: "Not in a Battle Royale room." }); });
    socket.on("br:shop:equip", (payload, ack) => { const c = this.currentBr(socket); if (typeof ack === "function") ack(c ? c.room.equipShopItem(c.playerId, String(payload?.itemId ?? "")) : { ok: false, error: "Not in a Battle Royale room." }); });
    socket.on("disconnect", () => { const c = this.current(socket); if (c) c.room.disconnect(c.playerId); });
  }

  private current(socket: GameSocket): { room: GameRoom | BattleRoyaleRoom; playerId: string } | null {
    const code = socket.data.roomCode as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    const room = code ? this.rooms.get(code) : undefined;
    return room && playerId ? { room, playerId } : null;
  }

  private currentClassic(socket: GameSocket): { room: GameRoom; playerId: string } | null {
    const current = this.current(socket); return current?.room instanceof GameRoom ? { room: current.room, playerId: current.playerId } : null;
  }

  private currentBr(socket: GameSocket): { room: BattleRoyaleRoom; playerId: string } | null {
    const current = this.current(socket); return current?.room instanceof BattleRoyaleRoom ? { room: current.room, playerId: current.playerId } : null;
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

  private replyBr(ack: unknown, result: BrJoinResult): void {
    if (typeof ack === "function") (ack as (value: BrJoinResult) => void)(result);
  }
}
