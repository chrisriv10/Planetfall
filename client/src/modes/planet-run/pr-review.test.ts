import {describe,it,expect} from "vitest";
import {prRound} from "@planetfall/shared";
import {prIntroCamera,prReviewCamera,PR_REVIEW_NAMES} from "./pr-review";
describe("authored PlanetRun camera reviews",()=>{
 it("frames Shatterdeck's real top/bottom and tracks translated deck heights",()=>{
  const round=prRound("shatterdeck"),heights=round.tiles.map(t=>t.center.y),top=Math.max(...heights),bottom=Math.min(...heights);
  expect(prReviewCamera(round,"start").target[1]).toBe(top);expect(prReviewCamera(round,"finish").target[1]).toBe(bottom);
  const raised={...round,tiles:round.tiles.map(t=>({...t,center:{...t.center,y:t.center.y+20}}))};
  for(const name of PR_REVIEW_NAMES){const before=prReviewCamera(round,name),after=prReviewCamera(raised,name);expect(after.target[1]-before.target[1]).toBeCloseTo(20);expect(after.position[1]-before.position[1]).toBeCloseTo(20);expect([...after.position,...after.target].every(Number.isFinite)).toBe(true);}
  for(const progress of [0,.5,1]){const a=prIntroCamera(round,progress),b=prIntroCamera(raised,progress);expect(b.target[1]-a.target[1]).toBeCloseTo(20);expect(b.position[1]-a.position[1]).toBeCloseTo(20);expect(a.position[1]).toBeGreaterThan(top);}
 });
});
