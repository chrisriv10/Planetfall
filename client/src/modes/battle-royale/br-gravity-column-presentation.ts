export const BR_GRAVITY_COLUMN_BASE_OPACITY = .14;
export const BR_GRAVITY_COLUMN_PULSE_AMPLITUDE = .035;
export const BR_GRAVITY_COLUMN_PULSE_RATE = 2;

/** Seconds (convert world.update's milliseconds with now * .001).
 * Restrained additive-column pulse only;
 * callers sharing a material should write it once. No bloom/ring changes. */
export function brGravityColumnOpacity(timeSeconds:number):number {
  if(!Number.isFinite(timeSeconds))return BR_GRAVITY_COLUMN_BASE_OPACITY;
  // Reduce before multiplying so even finite extreme inputs stay finite.
  const phase=(timeSeconds % (Math.PI*2/BR_GRAVITY_COLUMN_PULSE_RATE))*BR_GRAVITY_COLUMN_PULSE_RATE;
  return BR_GRAVITY_COLUMN_BASE_OPACITY+Math.sin(phase)*BR_GRAVITY_COLUMN_PULSE_AMPLITUDE;
}
