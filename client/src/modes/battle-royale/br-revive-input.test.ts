import { describe, expect, it } from "vitest";
import { BR_REVIVE_RETRY_MS, brReviveInput, brReviveRetryDue } from "./br-revive-input";

describe("BR revive input edge handling", () => {
  it("starts once and does not resend while the same button remains held", () => {
    const start = brReviveInput(null, "ally-a", true);
    expect(start).toEqual({ activeTargetId: "ally-a", commands: [{ targetId: "ally-a", active: true }] });
    expect(brReviveInput(start.activeTargetId, "ally-a", true).commands).toEqual([]);
  });

  it("cancels once when released or when the target leaves range", () => {
    expect(brReviveInput("ally-a", "ally-a", false)).toEqual({
      activeTargetId: null,
      commands: [{ targetId: "ally-a", active: false }]
    });
    expect(brReviveInput("ally-a", null, true).commands).toEqual([{ targetId: "ally-a", active: false }]);
  });

  it("cancels the old target before starting a newly selected teammate", () => {
    expect(brReviveInput("ally-a", "ally-b", true).commands).toEqual([
      { targetId: "ally-a", active: false },
      { targetId: "ally-b", active: true }
    ]);
  });

  it("retries a rejected predicted start at a bounded rate and stops after confirmation", () => {
    expect(brReviveRetryDue("ally-a",null,1_000,1_000+BR_REVIVE_RETRY_MS-1)).toBe(false);
    expect(brReviveRetryDue("ally-a",null,1_000,1_000+BR_REVIVE_RETRY_MS)).toBe(true);
    expect(brReviveRetryDue("ally-a","ally-a",1_000,2_000)).toBe(false);
    expect(brReviveRetryDue("ally-a",null,1_000,2_000,true)).toBe(false);
    expect(brReviveRetryDue(null,null,1_000,2_000)).toBe(false);
  });
});
