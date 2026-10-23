import {describe,it,expect} from "vitest";
import {PG_BALANCE as B} from "@planetfall/shared";
import {PgMatch} from "./pg-match.js";
describe("PlanetGun authoritative match resolution",()=>{
  it("starts once, blocks countdown scoring and preserves the regulation deadline",()=>{
    const m=new PgMatch();expect(m.start(100)).toBe(true);expect(m.start(100)).toBe(false);
    expect(m.elimination("v",1,"solar","void")).toBe(false);
    m.update(100+B.countdownMs+20);expect(m.phase).toBe("playing");expect(m.phaseEndsAt).toBe(100+B.countdownMs+B.matchMs);
  });
  it("counts each victim life once and never rewards friendly kills",()=>{
    const m=new PgMatch();m.start(0);m.update(B.countdownMs);
    expect(m.elimination("v",1,"solar","void")).toBe(true);
    expect(m.elimination("v",1,"solar","void")).toBe(false);
    m.elimination("v",2,"void","void");expect(m.scores).toEqual({solar:1,void:0});
  });
  it("resolves at the score limit and rejects subsequent scoring",()=>{
    const m=new PgMatch(25);m.start(0);m.update(B.countdownMs);
    for(let i=0;i<25;i++)m.elimination("v",i,"solar","void");
    expect(m.phase).toBe("results");expect(m.winner).toBe("solar");
    expect(m.elimination("other",1,"void","solar")).toBe(false);
  });
  it("enters sudden death on a regulation tie and ends on the next enemy elimination",()=>{
    const m=new PgMatch();m.start(0);m.update(B.countdownMs+B.matchMs);
    expect(m.phase).toBe("overtime");m.elimination("v",1,null,"void");expect(m.phase).toBe("overtime");
    m.elimination("v",2,"solar","void");expect(m.winner).toBe("solar");
  });
  it("awards the leading team when regulation expires",()=>{
    const m=new PgMatch();m.start(0);m.update(B.countdownMs);m.elimination("v",1,"void","solar");
    m.update(B.countdownMs+B.matchMs);expect(m.winner).toBe("void");
  });
});
