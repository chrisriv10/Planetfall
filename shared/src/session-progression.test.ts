import {describe,expect,it} from "vitest";
import {SESSION_PROGRESSION,sessionLevelForXp,sessionXpForLevel,sessionXpInLevel,sessionXpRequired} from "./index.js";
describe("50-tier progression",()=>{
 it("preserves the first ten earned level thresholds and reaches 50 through progressively longer chapters",()=>{
  for(let level=1;level<=10;level++)expect(sessionXpForLevel(level)).toBe((level-1)*100);
  expect([10,20,30,40,50].map(sessionXpForLevel)).toEqual([900,2150,3650,5400,7400]);
  for(let level=1;level<=50;level++){
   const threshold=sessionXpForLevel(level);expect(sessionLevelForXp(threshold)).toBe(level);
   if(level>1)expect(sessionLevelForXp(threshold-1)).toBe(level-1);
   expect(sessionXpInLevel(threshold)).toBe(level===50?200:0);
   if(level<50){expect(sessionLevelForXp(threshold+sessionXpRequired(level)-1)).toBe(level);expect(sessionXpInLevel(threshold+sessionXpRequired(level)-1)).toBe(sessionXpRequired(level)-1);}
  }
 });
 it("bounds derived level/progress without mutating or truncating earned XP",()=>{
  for(const xp of [7400,99999,Number.MAX_SAFE_INTEGER,Infinity]){expect(sessionLevelForXp(xp)).toBe(SESSION_PROGRESSION.maxLevel);expect(sessionXpInLevel(xp)).toBe(200);}
  for(const xp of [-1,NaN,-Infinity]){expect(sessionLevelForXp(xp)).toBe(1);expect(sessionXpInLevel(xp)).toBe(0);}
 });
});
