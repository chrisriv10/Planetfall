import type { GameFamily } from "@planetfall/shared";

export interface RoomInvite { family: GameFamily; code: string }
export type RoomInviteResult = { ok: true; invite: RoomInvite } | { ok: false; error: string };
const families: readonly GameFamily[] = ["planetfall", "battle-royale", "planet-run", "planet-gun"];
// Matches the authoritative RoomManager alphabet, including omission of I and O.
const codePattern = /^[A-HJ-NP-Z2-9]{6}$/;
const invalid = (): RoomInviteResult => ({ ok: false, error: "This room invite is invalid. Ask the host for a new invite link." });

function normalizedCode(code: string): string | null {
  if (typeof code !== "string" || code.length > 32) return null;
  const value = code.trim().toUpperCase();
  return codePattern.test(value) ? value : null;
}
function webUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch { return null; }
}

/** A public room locator only. Never carries identity, OAuth parameters or page state. */
export function buildRoomInvite(origin: string, family: GameFamily, code: string): string {
  const source = webUrl(origin), normalized = normalizedCode(code);
  if (!source || !families.includes(family) || !normalized) throw new Error("Cannot create an invite for an invalid room or origin.");
  const invite = new URL("/", source.origin);
  invite.searchParams.set("family", family);
  invite.searchParams.set("room", normalized);
  return invite.href;
}

/** Distinguishes absent invites from malformed ones so callers can show an error.
 * Existence, expiry and membership are checked later by the authoritative join flow. */
export function readRoomInvite(url: string): RoomInviteResult | null {
  const source = webUrl(url);
  if (!source) return invalid();
  const familyValues = source.searchParams.getAll("family"), codeValues = source.searchParams.getAll("room");
  if (!familyValues.length && !codeValues.length) return null;
  if (familyValues.length !== 1 || codeValues.length !== 1) return invalid();
  const family = familyValues[0], code = normalizedCode(codeValues[0]);
  if (!families.includes(family as GameFamily) || !code) return invalid();
  return { ok: true, invite: { family: family as GameFamily, code } };
}

/** Convenience form for callers that do not need to distinguish absent/invalid links. */
export function parseRoomInvite(url: string): RoomInvite | null {
  const result = readRoomInvite(url);
  return result?.ok ? result.invite : null;
}
