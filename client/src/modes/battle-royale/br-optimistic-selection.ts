export interface BrPendingSelection<T> {
  value: T;
  expiresAt: number;
}

/**
 * Keeps a responsive local selection visible until the server acknowledges it.
 * A bounded timeout ensures authority still wins when a request is rejected.
 */
export function resolveBrOptimisticSelection<T>(
  authoritative: T,
  pending: BrPendingSelection<T> | null,
  now: number
): { value: T; pending: BrPendingSelection<T> | null } {
  if (!pending) return { value: authoritative, pending: null };
  if (authoritative === pending.value || now >= pending.expiresAt) {
    return { value: authoritative, pending: null };
  }
  return { value: pending.value, pending };
}
