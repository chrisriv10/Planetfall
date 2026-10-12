/** A renderer can start inside an existing RAF after expensive construction.
 * That RAF timestamp predates activation; it is not negative simulation time. */
export function frameDeltaSeconds(now: number, previous: number): number {
  return Number.isFinite(now) && Number.isFinite(previous) ? Math.max(0, Math.min(.05, (now - previous) / 1000)) : 0;
}
