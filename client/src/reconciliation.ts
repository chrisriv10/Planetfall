export interface ReconciliationMetrics {
  averageCorrection: number;
  p95Correction: number;
  maximumCorrection: number;
  snapCount: number;
  correctionCount: number;
  correctionsPerMinute: number;
}

export function shouldAcceptSnapshot(lastServerTime: number, nextServerTime: number): boolean {
  return Number.isFinite(nextServerTime) && nextServerTime > lastServerTime;
}

export function interpolationAlpha(dt: number, responseRate: number): number {
  if (!Number.isFinite(dt) || !Number.isFinite(responseRate) || dt <= 0 || responseRate <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - Math.exp(-dt * responseRate)));
}

export class ReconciliationTracker {
  private samples: { error: number; at: number; snapped: boolean }[] = [];

  reset(): void { this.samples.length = 0; }

  record(error: number, snapped: boolean, now: number): void {
    if (!Number.isFinite(error) || error < 0 || !Number.isFinite(now)) return;
    this.samples.push({ error, at: now, snapped });
    if (this.samples.length > 2048) this.samples.splice(0, 512);
  }

  summary(now: number, windowMs = 60_000): ReconciliationMetrics {
    const start = now - Math.max(1, windowMs);
    const active = this.samples.filter((sample) => sample.at >= start && sample.at <= now);
    if (active.length === 0) {
      return {
        averageCorrection: 0, p95Correction: 0, maximumCorrection: 0,
        snapCount: 0, correctionCount: 0, correctionsPerMinute: 0
      };
    }
    const ordered = active.map((sample) => sample.error).sort((a, b) => a - b);
    const elapsed = Math.max(1000, Math.min(windowMs, now - active[0].at));
    return {
      averageCorrection: ordered.reduce((sum, value) => sum + value, 0) / ordered.length,
      p95Correction: ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * .95) - 1)],
      maximumCorrection: ordered[ordered.length - 1],
      snapCount: active.reduce((count, sample) => count + Number(sample.snapped), 0),
      correctionCount: active.length,
      correctionsPerMinute: active.length * 60_000 / elapsed
    };
  }
}
