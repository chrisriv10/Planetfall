import {describe,expect,it} from "vitest";
import {BrDamageFeedback,BR_DAMAGE_FEEDBACK_STYLES,brDamageFeedbackFade,classifyBrDamageFeedback} from "./br-damage-feedback";

describe("BR damage presentation",()=>{
  it("separates shield, break and HP hits from post-hit totals",()=>{
    expect(classifyBrDamageFeedback({hp:100,shield:40,shieldBroken:false})).toBe("shield-hit");
    expect(classifyBrDamageFeedback({hp:70,shield:0,shieldBroken:false})).toBe("hp-hit");
    expect(classifyBrDamageFeedback({hp:70,shield:0,shieldBroken:true},{hp:100,shield:20})).toBe("shield-break");
    expect(classifyBrDamageFeedback({hp:0,shield:0,shieldBroken:false})).toBe("hp-hit");
  });
  it("recognizes shield-bypassing HP damage when pre-hit vitals are supplied",()=>{
    expect(classifyBrDamageFeedback({hp:80,shield:40,shieldBroken:false},{hp:90,shield:40})).toBe("hp-hit");
    // Existing HP loss does not make a subsequent shield hit orange.
    expect(classifyBrDamageFeedback({hp:80,shield:30,shieldBroken:false},{hp:80,shield:40})).toBe("shield-hit");
    expect(BR_DAMAGE_FEEDBACK_STYLES["hp-hit"].rippleOpacity).toBe(0);
    expect(BR_DAMAGE_FEEDBACK_STYLES["shield-hit"].color).not.toBe(BR_DAMAGE_FEEDBACK_STYLES["hp-hit"].color);
  });
  it("extends rapid hits without an earlier expiration clearing newer feedback",()=>{
    const feedback=new BrDamageFeedback();
    const first=feedback.hit({hp:100,shield:30,shieldBroken:false},100)!;
    const next=feedback.hit({hp:100,shield:20,shieldBroken:false},180)!;
    expect(next.flashUntil).toBeGreaterThan(first.flashUntil);
    expect(feedback.read(first.expiresAt)).toBe(next);
    expect(feedback.read(next.expiresAt)).toBeNull();
  });
  it("replaces break styling with a later HP impact and removes the shield shell",()=>{
    const feedback=new BrDamageFeedback();
    const broken=feedback.hit({hp:95,shield:0,shieldBroken:true},100)!;
    const hp=feedback.hit({hp:85,shield:0,shieldBroken:false},110)!;
    expect(hp.kind).toBe("hp-hit");expect(hp.rippleUntil).toBe(hp.startedAt);
    expect(hp.flashUntil).toBeGreaterThanOrEqual(broken.flashUntil);
    expect(hp.hitMarkerUntil).toBeGreaterThanOrEqual(broken.hitMarkerUntil);
    expect(hp.style.rippleOpacity).toBe(0);
  });
  it("ignores invalid clocks, clamps backward timestamps, and cannot revive expired hits",()=>{
    const feedback=new BrDamageFeedback(),payload={hp:100,shield:30,shieldBroken:false};
    const first=feedback.hit(payload,200)!;
    expect(feedback.hit(payload,NaN)).toBe(first);
    expect(feedback.read(Infinity)).toBe(first);
    const second=feedback.hit(payload,150)!;
    expect(second.startedAt).toBe(200);expect(second.expiresAt).toBe(first.expiresAt);
    expect(feedback.read(1000)).toBeNull();expect(feedback.read(0)).toBeNull();
    feedback.hit(payload,1100);feedback.clear();expect(feedback.read(1101)).toBeNull();
  });
  it("provides bounded deterministic fades without starting timers",()=>{
    expect(brDamageFeedbackFade(100,200,50)).toBe(1);
    expect(brDamageFeedbackFade(100,200,150)).toBe(.5);
    expect(brDamageFeedbackFade(100,200,250)).toBe(0);
    expect(brDamageFeedbackFade(100,100,100)).toBe(0);
    expect(brDamageFeedbackFade(100,200,NaN)).toBe(0);
  });
});
