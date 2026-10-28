/** Presentation-only, seamless eight-second solar-arena action. */
export interface PrShowcasePose {
  motif:number; local:number; opacity:number;
  x:number; y:number; z:number; yaw:number; speed:number; verticalSpeed:number;
  sweeperYaw:number;
}
export const PR_SHOWCASE_DURATION=8;
export function createPrShowcasePose():PrShowcasePose {
  return {motif:0,local:0,opacity:1,x:2.35,y:0,z:0,yaw:.5,speed:0,verticalSpeed:0,sweeperYaw:-Math.PI};
}
/** One planted jump, no translation or hidden scene reset; caller-owned storage. */
export function samplePrShowcasePose(timeSeconds:number,reducedMotion:boolean,out:PrShowcasePose):PrShowcasePose {
  const time=Number.isFinite(timeSeconds)?Math.max(0,timeSeconds):0;
  const t=reducedMotion?1:time%PR_SHOWCASE_DURATION;
  const u=Math.max(0,Math.min(1,(t-3.4)/1.2));
  out.motif=0;out.local=t;out.opacity=1;
  out.x=2.35;out.z=0;out.yaw=.5;out.speed=0;
  out.y=t>3.4&&t<4.6?Math.sin(u*Math.PI)*.95:0;
  out.verticalSpeed=t>3.4&&t<4.6?Math.cos(u*Math.PI)*.95*Math.PI/1.2:0;
  out.sweeperYaw=(t-4)*Math.PI/4;
  return out;
}
