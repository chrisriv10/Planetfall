/** Keep the BR menu's real island animated without submitting a costly draw
 * on every RAF. Input, room events and simulation remain outside this budget.
 * The RAF after a draw includes GPU/compositor backpressure that measuring
 * renderer.render's synchronous duration alone would miss. */
export class BackgroundDrawBudget {
  private lastFrameAt = Number.NEGATIVE_INFINITY;
  private nextDrawAt = Number.NEGATIVE_INFINITY;
  private drewLastFrame = false;
  private drawFrameMs = 1000 / 60;

  drawDue(now: number, overview: boolean): boolean {
    if (!overview) {
      this.nextDrawAt = Number.NEGATIVE_INFINITY;
      this.drewLastFrame = false;
      this.drawFrameMs = 1000 / 60;
      this.lastFrameAt = now;
      return true;
    }
    if (this.drewLastFrame) {
      this.drawFrameMs = Math.max(1000 / 60, now - this.lastFrameAt);
      this.drewLastFrame = false;
    }
    this.lastFrameAt = now;
    if (now < this.nextDrawAt) return false;
    this.drewLastFrame = true;
    // Fast hardware draws at 20Hz. Slow hardware gets an idle window between
    // submissions; the bounded interval still keeps the overview moving.
    this.nextDrawAt = now + Math.max(50, Math.min(600, this.drawFrameMs * 2));
    return true;
  }
}
