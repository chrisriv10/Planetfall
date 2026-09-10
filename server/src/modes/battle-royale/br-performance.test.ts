import { describe, expect, it } from "vitest";
import { BR_WEAPONS, type ClientToServerEvents, type ServerToClientEvents } from "@planetfall/shared";
import type { Server, Socket } from "socket.io";
import { BattleRoyaleRoom } from "./br-room.js";

type Metric = { participants: number; averageTickMs: number; p95TickMs: number; worstTickMs: number; averageSnapshotBytes: number; p95SnapshotBytes: number; maximumSnapshotBytes: number; heapDeltaMb: number };

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))];
}

function profile(participants: 10 | 20 | 40): Metric {
  const snapshotBytes: number[] = [];
  const io = {
    to: () => ({
      emit: (event: string, payload: unknown) => {
        if (event === "br:match:snapshot") snapshotBytes.push(Buffer.byteLength(JSON.stringify(payload)));
      }
    })
  } as unknown as Server<ClientToServerEvents, ServerToClientEvents>;
  const socket = { id: "perf-host", data: {}, join: () => undefined } as unknown as Socket<ClientToServerEvents, ServerToClientEvents>;
  const room = new BattleRoyaleRoom(`PERF-${participants}`, io, 901_337 + participants);
  const joined = room.join(socket, "Performance Pilot"); if (!joined.ok) throw new Error(joined.error);
  room.configure(joined.playerId, { teamMode: "solo", targetPlayers: participants, fillBots: true, botDifficulty: "hard" }); room.setReady(joined.playerId, true);
  const start = 1_000; expect(room.start(joined.playerId, start)).toBe(true);
  room.phase = "combat";
  let index = 0;
  for (const player of room.players.values()) {
    player.socketId = `perf-socket-${index}`;
    player.deployment = "grounded"; player.grounded = true;
    player.position = { x: index % 8 * 7 - 24, y: 0, z: Math.floor(index / 8) * 7 - 14 };
    player.inventory[0] = { instanceId: `perf-weapon-${index}`, itemId: "pulse-rifle", rarity: "common", count: 1, magazine: BR_WEAPONS["pulse-rifle"].magazine };
    index++;
  }
  const heapBefore = process.memoryUsage().heapUsed;
  const ticks: number[] = [];
  let now = start;
  // Thirty production-rate seconds. This preserves the real 30 Hz simulation to
  // 15 Hz snapshot cadence instead of forcing serialization on every test tick.
  for (let tick = 0; tick < 900 && room.phase !== "results"; tick++) {
    now += 1000 / 30;
    const began = performance.now(); room.update(1 / 30, now); ticks.push(performance.now() - began);
  }
  const metric: Metric = {
    participants,
    averageTickMs: ticks.reduce((sum, value) => sum + value, 0) / ticks.length,
    p95TickMs: percentile(ticks, .95),
    worstTickMs: Math.max(...ticks),
    averageSnapshotBytes: snapshotBytes.reduce((sum, value) => sum + value, 0) / Math.max(1, snapshotBytes.length),
    p95SnapshotBytes: percentile(snapshotBytes, .95),
    maximumSnapshotBytes: Math.max(0, ...snapshotBytes),
    heapDeltaMb: (process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024
  };
  room.dispose();
  return metric;
}

describe("Battle Royale server performance", () => {
  for (const participants of [10, 20, 40] as const) {
    it(`keeps ${participants}-participant combat ticks and relevance snapshots bounded`, () => {
      const metric = profile(participants);
      console.info(`BR_PERF ${JSON.stringify(metric)}`);
      expect(metric.averageTickMs).toBeLessThan(16);
      expect(metric.p95TickMs).toBeLessThan(45);
      expect(metric.worstTickMs).toBeLessThan(150);
      expect(metric.maximumSnapshotBytes).toBeLessThan(160_000);
    }, 30_000);
  }
});
