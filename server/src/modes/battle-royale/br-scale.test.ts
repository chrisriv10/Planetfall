import { describe, expect, it } from "vitest";
import { BR_BALANCE, type BrTeamMode, type ClientToServerEvents, type ServerToClientEvents } from "@planetfall/shared";
import type { Server, Socket } from "socket.io";
import { BattleRoyaleRoom } from "./br-room.js";

function makeRoom(teamMode: BrTeamMode): BattleRoyaleRoom {
  const io = { to: () => ({ emit: () => undefined }) } as unknown as Server<ClientToServerEvents, ServerToClientEvents>;
  const socket = { id: "scale-host", data: {}, join: () => undefined } as unknown as Socket<ClientToServerEvents, ServerToClientEvents>;
  const room = new BattleRoyaleRoom(`SCALE-${teamMode}`, io, 827_331);
  const joined = room.join(socket, "Scale Host"); if (!joined.ok) throw new Error(joined.error);
  room.configure(joined.playerId, { teamMode, targetPlayers: 40, fillBots: true, botDifficulty: "normal" }); room.setReady(joined.playerId, true);
  expect(room.start(joined.playerId, 1_000)).toBe(true); return room;
}

function assertFiniteRoom(room: BattleRoyaleRoom): void {
  const lootIds = new Set<string>();
  for (const loot of room.loot.values()) { expect(lootIds.has(loot.id)).toBe(false); lootIds.add(loot.id); expect(Number.isFinite(loot.position.x + loot.position.y + loot.position.z)).toBe(true); }
  for (const player of room.players.values()) {
    expect([player.position.x, player.position.y, player.position.z, player.velocity.x, player.velocity.y, player.velocity.z, player.hp, player.shield].every(Number.isFinite)).toBe(true);
    expect(player.hp).toBeGreaterThanOrEqual(0); expect(player.hp).toBeLessThanOrEqual(BR_BALANCE.hp); expect(player.shield).toBeGreaterThanOrEqual(0); expect(player.shield).toBeLessThanOrEqual(BR_BALANCE.shield);
    expect(Object.values(player.ammo).every((amount) => amount >= 0)).toBe(true);
  }
}

describe("Battle Royale 40-player lifecycle", () => {
  for (const teamMode of ["solo", "duo", "squad"] as const) {
    it(`completes a seeded 40-player ${teamMode} simulation without invalid state`, () => {
      const room = makeRoom(teamMode); const began = performance.now(); let now = 1_000;
      for (let tick = 0; tick < 12_000 && room.phase !== "results"; tick++) { now += 100; room.update(.1, now); if (tick % 300 === 0) assertFiniteRoom(room); }
      assertFiniteRoom(room); expect(room.players.size).toBe(40); expect(room.phase).toBe("results"); expect(room.matchResult).not.toBeNull(); expect(performance.now() - began).toBeLessThan(15_000);
    }, 20_000);
  }
});
