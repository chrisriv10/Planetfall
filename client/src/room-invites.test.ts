import { describe, expect, it } from "vitest";
import type { GameFamily } from "@planetfall/shared";
import { buildRoomInvite, parseRoomInvite, readRoomInvite } from "./room-invites";

describe("private room invites", () => {
  it.each(["planetfall", "battle-royale", "planet-run", "planet-gun"] as const)("round-trips the canonical %s family", family => {
    const url = buildRoomInvite("https://planetfall.example", family, "ABC234");
    expect(url).toBe(`https://planetfall.example/?family=${family}&room=ABC234`);
    expect(parseRoomInvite(url)).toEqual({ family, code: "ABC234" });
    expect(readRoomInvite(url)).toEqual({ ok: true, invite: { family, code: "ABC234" } });
  });

  it("normalizes room codes without accepting ambiguous or unsupported characters", () => {
    expect(parseRoomInvite("https://planetfall.example/?family=planetfall&room=%20abc234%20")).toEqual({ family: "planetfall", code: "ABC234" });
    expect(buildRoomInvite("http://localhost:5173", "planetfall", " abc234 ")).toBe("http://localhost:5173/?family=planetfall&room=ABC234");
    for (const code of ["ABC23", "ABC2345", "ABC120", "ABCIO2", "ＡBC234", "ABC2-4", "ABC\n24", " ".repeat(100) + "ABC234"]) {
      expect(parseRoomInvite(`https://planetfall.example/?family=planetfall&room=${encodeURIComponent(code)}`)).toBeNull();
      expect(() => buildRoomInvite("https://planetfall.example", "planetfall", code)).toThrow();
    }
  });

  it("strips userinfo, path, fragments, credentials and OAuth state from copied links", () => {
    const url = buildRoomInvite("https://pilot:password@planetfall.example:8443/account/callback?code=oauth-secret&state=private&token=profile-token#account", "planet-run", "ABC234");
    expect(url).toBe("https://planetfall.example:8443/?family=planet-run&room=ABC234");
    expect(new URL(url).username).toBe("");
    expect(new URL(url).password).toBe("");
    expect([...new URL(url).searchParams.keys()]).toEqual(["family", "room"]);
  });

  it("ignores unrelated OAuth parameters without treating their code as a room code", () => {
    expect(readRoomInvite("https://planetfall.example/?code=oauth-code&state=account-return")).toBeNull();
    expect(parseRoomInvite("https://planetfall.example/?family=planet-gun&room=ABC234&code=oauth-code&state=account-return&accountReturn=1")).toEqual({ family: "planet-gun", code: "ABC234" });
    expect(readRoomInvite("https://planetfall.example/#family=planetfall&room=ABC234")).toBeNull();
  });

  it("distinguishes absent invites from malformed and partial invite parameters", () => {
    expect(readRoomInvite("https://planetfall.example/")).toBeNull();
    for (const query of ["family=planetfall", "room=ABC234", "family=&room=ABC234", "family=planetfall&room=", "family=royale&room=ABC234", "family=Planetfall&room=ABC234", "family=planetfall%20&room=ABC234"]) {
      expect(readRoomInvite(`https://planetfall.example/?${query}`)).toMatchObject({ ok: false, error: expect.any(String) });
      expect(parseRoomInvite(`https://planetfall.example/?${query}`)).toBeNull();
    }
  });

  it("rejects duplicate parameters including identical values and encoded names", () => {
    for (const query of ["family=planetfall&family=planetfall&room=ABC234", "family=planetfall&room=ABC234&room=ABC234", "family=planetfall&%66amily=planet-gun&room=ABC234", "family=planetfall&room=ABC234&%72oom=XYZ789"]) {
      expect(readRoomInvite(`https://planetfall.example/?${query}`)).toMatchObject({ ok: false });
    }
  });

  it("rejects query injection, invalid URLs and non-web protocols", () => {
    for (const query of ["family=planetfall%26room%3DABC234&room=XYZ789", "family=planetfall&room=ABC234%26token%3Dsecret", "family=planetfall&room=%3Cscript%3E", "family=planetfall&room=%FFABC234"]) {
      expect(parseRoomInvite(`https://planetfall.example/?${query}`)).toBeNull();
    }
    for (const url of ["invalid", "javascript:alert(1)", "file:///game?room=ABC234&family=planetfall", "data:text/plain,room=ABC234&family=planetfall"]) {
      expect(readRoomInvite(url)).toMatchObject({ ok: false });
      expect(() => buildRoomInvite(url, "planetfall", "ABC234")).toThrow();
    }
    expect(() => buildRoomInvite("https://planetfall.example", "unknown" as GameFamily, "ABC234")).toThrow();
  });

  it("parses the same invite after reload without local identity or storage", () => {
    const url = buildRoomInvite("https://planetfall.example/?sessionToken=private", "battle-royale", "XYZ789");
    expect(parseRoomInvite(url)).toEqual(parseRoomInvite(new URL(url).href));
    // Parsing is only prefill: an expired/nonexistent but well-formed code stays a
    // locator until the existing authoritative join request validates the room.
    expect(parseRoomInvite(url)).toEqual({ family: "battle-royale", code: "XYZ789" });
  });
});
