import {it,expect} from "vitest";
import {pgCreateGun,PG_WEAPONS} from "./weapons.js";
import {PG_CINDER_HEAT,pgCoolModeGun,pgHeatModeGun} from "./mode-combat.js";
it("Cinder overdrive actually increases cell cooling without changing the base arsenal",()=>{
 const a=pgCreateGun("nova"),b=pgCreateGun("nova");a.heat=b.heat=.8;a.heatUpdatedAt=b.heatUpdatedAt=0;
 pgCoolModeGun(a,PG_CINDER_HEAT,1000);pgCoolModeGun(b,{...PG_CINDER_HEAT,coolingMultiplier:1.35},1000);expect(a.heat).toBeCloseTo(.5);expect(b.heat).toBeCloseTo(.395);expect(PG_WEAPONS.nova.heatPerShot).toBeUndefined();
 for(let i=0;i<30;i++)pgHeatModeGun(a,PG_CINDER_HEAT,1000);expect(a.heat).toBe(1);expect(a.overheatedUntil).toBe(1900);
});
