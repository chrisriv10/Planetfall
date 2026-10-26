/** Normalized authoritative reload time drives these presentation-only tracks. */
export type PgPresentationWeapon = "pulse"|"nova"|"photon"|"quasar"|"rail"|"comet"|"helix"|"arc"|"prism"|"orbit";
export type PgReloadPhase = "idle"|"start"|"remove"|"insert"|"lock"|"settle";
export interface PgReloadProfile { cellX:number;cellY:number;cellZ:number;width:number;height:number;depth:number;travelX:number;travelY:number;travelZ:number;roll:number;weight:number;open:number;accent:number }
export const PG_RELOAD_PROFILES:Record<PgPresentationWeapon,PgReloadProfile>={
 pulse:{cellX:-.17,cellY:-.17,cellZ:-.57,width:.16,height:.26,depth:.29,travelX:-.24,travelY:-.50,travelZ:.12,roll:.13,weight:1,open:.25,accent:0x67e9ef},
 nova:{cellX:-.20,cellY:-.15,cellZ:-.36,width:.15,height:.23,depth:.22,travelX:-.34,travelY:-.31,travelZ:.08,roll:.22,weight:.72,open:.20,accent:0x8bf3c4},
 photon:{cellX:-.25,cellY:-.10,cellZ:-.64,width:.22,height:.24,depth:.40,travelX:-.42,travelY:-.27,travelZ:.20,roll:.08,weight:1.35,open:.70,accent:0xffb66a},
 quasar:{cellX:-.13,cellY:-.21,cellZ:-.60,width:.18,height:.26,depth:.23,travelX:-.16,travelY:-.48,travelZ:.06,roll:.10,weight:1.05,open:.28,accent:0xb8a5ff},
 rail:{cellX:-.16,cellY:-.19,cellZ:-.72,width:.20,height:.30,depth:.48,travelX:-.29,travelY:-.44,travelZ:.19,roll:.07,weight:1.5,open:.48,accent:0x7bcfff},
 comet:{cellX:-.10,cellY:-.35,cellZ:-.12,width:.15,height:.25,depth:.18,travelX:-.20,travelY:-.42,travelZ:.04,roll:.26,weight:.9,open:.22,accent:0xffb982},
 helix:{cellX:-.15,cellY:-.19,cellZ:-.48,width:.17,height:.29,depth:.24,travelX:-.22,travelY:-.43,travelZ:.10,roll:.12,weight:1.1,open:.35,accent:0x8be7c4},
 arc:{cellX:-.21,cellY:-.13,cellZ:-.50,width:.20,height:.26,depth:.28,travelX:-.35,travelY:-.30,travelZ:.16,roll:.19,weight:1.1,open:.60,accent:0x66efff},
 prism:{cellX:-.20,cellY:-.14,cellZ:-.34,width:.19,height:.25,depth:.30,travelX:-.32,travelY:-.26,travelZ:.12,roll:.12,weight:1.2,open:.55,accent:0x72fff0},
 orbit:{cellX:-.08,cellY:-.28,cellZ:-.10,width:.12,height:.20,depth:.15,travelX:-.14,travelY:-.34,travelZ:.04,roll:.20,weight:.65,open:.18,accent:0x96dfff}
};
export interface PgReloadSample {phase:PgReloadPhase;cellX:number;cellY:number;cellZ:number;cellRoll:number;handX:number;handY:number;handZ:number;open:number;latch:number;present:number}
export function createPgReloadSample():PgReloadSample{return{phase:"idle",cellX:0,cellY:0,cellZ:0,cellRoll:0,handX:0,handY:0,handZ:0,open:0,latch:0,present:0};}
const smooth=(a:number,b:number,t:number)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};
/** Writes into a reusable sample; hand and cell share one trajectory during extraction/insertion. */
export function samplePgReload(weapon:PgPresentationWeapon,progress:number,restX:number,restY:number,restZ:number,out:PgReloadSample):void{
 const p=PG_RELOAD_PROFILES[weapon],t=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
 const active=t>0&&t<1,reach=active?smooth(.025,.19,t)*(1-smooth(.88,1,t)):0;
 const outwards=active?smooth(.22,.43,t)*(1-smooth(.53,.76,t)):0;
 out.phase=!active?"idle":t<.22?"start":t<.53?"remove":t<.78?"insert":t<.90?"lock":"settle";
 out.cellX=p.cellX+p.travelX*outwards;out.cellY=p.cellY+p.travelY*outwards;out.cellZ=p.cellZ+p.travelZ*outwards;out.cellRoll=p.roll*outwards;
 out.open=active?smooth(.14,.23,t)*(1-smooth(.78,.86,t)):0;
 out.latch=active?smooth(.77,.81,t)*(1-smooth(.85,.89,t)):0;
 out.present=active?smooth(0,.18,t)*(1-smooth(.86,1,t)):0;
 // Reach the left face of the cell; a small late lock press never teleports the hand.
 out.handX=restX+(out.cellX-p.width*.5-.07-restX)*reach;
 out.handY=restY+(out.cellY-restY)*reach+out.latch*.055;
 out.handZ=restZ+(out.cellZ-restZ)*reach+out.latch*.10;
}
