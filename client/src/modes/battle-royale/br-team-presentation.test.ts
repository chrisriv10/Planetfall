import { describe, expect, it } from "vitest";
import type { BrPlayerState } from "@planetfall/shared";
import { brPresentedTeammates, brTeammateStatus } from "./br-team-presentation";

const player = (id: string, teamId: string, overrides: Partial<BrPlayerState> = {}) => ({
  id, teamId, connected: true, alive: true, downed: false,
  ...overrides,
}) as BrPlayerState;

describe("BR teammate presentation", () => {
  it("always hides squad presentation in Solo even if ids are malformed", () => {
    const local = player("local", "team-a");
    expect(brPresentedTeammates("solo", local, [local, player("other", "team-a")])).toEqual([]);
  });

  it("includes only actual teammates in Duo and Squad", () => {
    const local = player("local", "team-a");
    const teammate = player("mate", "team-a");
    const enemy = player("enemy", "team-b");
    expect(brPresentedTeammates("duo", local, [local, teammate, enemy])).toEqual([teammate]);
    expect(brPresentedTeammates("squad", local, [local, teammate, enemy])).toEqual([teammate]);
  });

  it("distinguishes downed, eliminated and disconnected states", () => {
    expect(brTeammateStatus(player("a", "t"))).toBe("active");
    expect(brTeammateStatus(player("a", "t", { downed: true }))).toBe("downed");
    expect(brTeammateStatus(player("a", "t", { alive: false }))).toBe("eliminated");
    expect(brTeammateStatus(player("a", "t", { connected: false }))).toBe("disconnected");
  });
});
