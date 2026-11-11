import type {PgPresentationWeapon} from "./pg-reload-art";

// Presentation distances/radians only; these never affect aim or weapon balance.
export const PG_WEAPON_RESPONSE_PROFILES:Record<PgPresentationWeapon,{rate:number;travel:number;rise:number;lateral:number}>={
  pulse:{rate:32,travel:.042,rise:.065,lateral:.003},
  nova:{rate:43,travel:.034,rise:.047,lateral:.0035},
  photon:{rate:24,travel:.043,rise:.10,lateral:.003},
  quasar:{rate:31,travel:.027,rise:.062,lateral:.0025},
  rail:{rate:21,travel:.044,rise:.095,lateral:.002},
  comet:{rate:26,travel:.036,rise:.12,lateral:.004},
  helix:{rate:35,travel:.032,rise:.058,lateral:.003},
  arc:{rate:28,travel:.032,rise:.074,lateral:.0035},
  prism:{rate:40,travel:.006,rise:.012,lateral:.0006},
  orbit:{rate:38,travel:.019,rise:.052,lateral:.003}
};
interface Spring {position:number;velocity:number}
const unit=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
/** Exact critically damped integration: no Euler instability or frame-sized substeps. */
function advance(s:Spring,rate:number,dt:number):void{
  const c=s.velocity+rate*s.position,e=Math.exp(-rate*dt);
  s.position=(s.position+c*dt)*e;s.velocity=(s.velocity-rate*c*dt)*e;
}
function impulse(s:Spring,rate:number,amount:number):void{
  // Bound repeated impulses as well as final output; no hidden energy accumulates.
  s.velocity=Math.min(Math.E*rate,s.velocity+amount*Math.E*rate);
}
/** Reuses one output object and two springs. recoil is the existing 12/s local envelope. */
export function createPgWeaponResponse(){
  const travel:Spring={position:0,velocity:0},rise:Spring={position:0,velocity:0};
  let current:PgPresentationWeapon|null=null,previous=0;
  const output={back:0,pitch:0,yaw:0,roll:0};
  const reset=(weapon:PgPresentationWeapon|null=null,recoil=0)=>{
    current=weapon;previous=unit(recoil);travel.position=travel.velocity=rise.position=rise.velocity=0;
    output.back=output.pitch=output.yaw=output.roll=0;
  };
  return{output,reset,update(weapon:PgPresentationWeapon,recoil:number,dt:number,ads:number){
    const input=unit(recoil);
    if(current!==weapon||!Number.isFinite(dt)||dt<0||dt>.25){reset(weapon,input);return output;}
    const p=PG_WEAPON_RESPONSE_PROFILES[weapon];
    // PgGame adds each kick before decaying the envelope for this frame. Undo that
    // decay and apply at frame start so low frame rates retain the same impulse.
    const addition=unit(input*Math.exp(12*dt)-previous);previous=input;
    if(addition>1e-6){impulse(travel,p.rate,addition);impulse(rise,p.rate*.72,addition);}
    advance(travel,p.rate,dt);advance(rise,p.rate*.72,dt);
    const compression=unit(travel.position),lift=unit(rise.position),aim=unit(ads);
    output.back=compression*p.travel*(1-aim*.35);
    output.pitch=lift*p.rise*(1-aim*.80);
    output.yaw=(compression-lift)*p.lateral*(1-aim*.85);
    output.roll=output.yaw*1.5;
    return output;
  }};
}
