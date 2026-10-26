/** Presentation-only trajectories. Coordinates belong to the home maquettes. */
export interface PrShowcasePose {
  motif:number; local:number; opacity:number;
  x:number; y:number; z:number; yaw:number; speed:number; verticalSpeed:number;
  cargoX:number; sweeperYaw:number; meteorY:number; warningScale:number;
  meteorVisible:boolean; warningVisible:boolean; gateOpen:number; collapse:number;
}
export const PR_SHOWCASE_DURATION=5;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
const progress=(t:number,start:number,end:number)=>smooth((t-start)/(end-start));
const velocity=(t:number,start:number,end:number,distance:number)=>{const p=(t-start)/(end-start);return p>0&&p<1?distance*6*p*(1-p)/(end-start):0;};
export function createPrShowcasePose():PrShowcasePose {
  return {motif:0,local:0,opacity:1,x:0,y:0,z:0,yaw:0,speed:0,verticalSpeed:0,cargoX:0,sweeperYaw:0,meteorY:0,warningScale:1,meteorVisible:false,warningVisible:false,gateOpen:0,collapse:0};
}
/** Writes into caller-owned storage: no allocations in the preview update. */
export function samplePrShowcasePose(timeSeconds:number,reducedMotion:boolean,out:PrShowcasePose):PrShowcasePose {
  const time=Number.isFinite(timeSeconds)?Math.max(0,timeSeconds):0;
  const t=reducedMotion?2:time%PR_SHOWCASE_DURATION;
  out.motif=reducedMotion?0:Math.floor(time/PR_SHOWCASE_DURATION)%6;
  out.local=t;out.opacity=reducedMotion?1:Math.min(smooth(t/.24),smooth((5-t)/.3));
  out.x=0;out.y=0;out.z=.65;out.yaw=Math.PI/2;out.speed=0;out.verticalSpeed=0;
  out.cargoX=-2.2+4.4*progress(t,.8,3.7);out.sweeperYaw=(t-2.2)*.75;
  out.meteorVisible=t<2.65;out.meteorY=3.4*(1-progress(t,1.9,2.65));
  out.warningVisible=t<3.15;out.warningScale=t<2.65?1:1+progress(t,2.65,3.15)*.6;
  out.gateOpen=progress(t,.65,1.6);out.collapse=progress(t,2.5,3.6);
  switch(out.motif){
    case 0: out.x=-2.9+5.8*progress(t,.65,3.9);out.speed=velocity(t,.65,3.9,5.8);break;
    case 1: {
      out.x=2.3;out.z=0;out.yaw=0;
      const u=clamp((t-1.65)/1.1);out.y=Math.sin(u*Math.PI)*.85;
      out.verticalSpeed=u>0&&u<1?Math.cos(u*Math.PI)*.85*Math.PI/1.1:0;
      break;
    }
    case 2: out.x=1.4-2.2*progress(t,1.5,2.3);out.z=-.8;out.yaw=-Math.PI/2;out.speed=velocity(t,1.5,2.3,2.2);break;
    case 3: {
      const u=clamp((t-.8)/2.9);out.x=-2.65+5.3*u;out.y=Math.sin(u*Math.PI)*1.8;out.z=0;
      out.speed=u>0&&u<1?5.3/2.9:0;out.verticalSpeed=u>0&&u<1?Math.cos(u*Math.PI)*1.8*Math.PI/2.9:0;
      break;
    }
    case 4: out.x=0;out.z=1.8-4*progress(t,1.75,3.65);out.yaw=Math.PI;out.speed=velocity(t,1.75,3.65,4);break;
    case 5: out.x=-Math.sqrt(3)*.85+Math.sqrt(3)*1.7*progress(t,.8,3.5);out.z=0;out.speed=velocity(t,.8,3.5,Math.sqrt(3)*1.7);break;
  }
  if(reducedMotion){out.speed=0;out.verticalSpeed=0;}
  return out;
}
