/**
 * Render-rate button edges must survive until the next fixed-rate network
 * packet. A quick key tap can begin and end between two 20 Hz sends; keeping
 * the edge here prevents authority from missing actions the local client has
 * already predicted.
 */
export class BrInputEdgeLatch {
  private pending = false;

  observe(pressed: boolean): void {
    this.pending ||= pressed;
  }

  consume(held: boolean): boolean {
    const value = held || this.pending;
    this.pending = false;
    return value;
  }

  reset(): void {
    this.pending = false;
  }
}
