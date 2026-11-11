import {PG_BALANCE,pgGunProfile,type BotDifficulty,type PgGunState,type PgPlayer,type Vec3} from "@planetfall/shared";

export interface PgBotAimMemory {
 at:number;yaw:number;pitch:number;basePitch:number;targetId:string|null;
 nextSample:number;pending:{at:number;position:Vec3}[];sample:Vec3|null;
 gun?:PgGunState;shots:number;recoil:number;noisePhase?:number;
}
const SETTINGS={
 easy:{yaw:3,pitch:2,period:220,delay:180,error:.06},
 normal:{yaw:5,pitch:3.5,period:140,delay:110,error:.03},
 hard:{yaw:7,pitch:5,period:90,delay:70,error:.013},
} as const;
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const clamp=(a:number,max:number)=>Math.max(-max,Math.min(max,a));

/** Perception is sampled only while visible; accepted gun shots drive physical kick. */
export function pgBotAim(p:PgPlayer,target:PgPlayer|undefined,now:number,difficulty:BotDifficulty,navigationYaw:number,memory?:PgBotAimMemory){
 const settings=SETTINGS[difficulty];
 const m:PgBotAimMemory=memory??{at:now-1000/60,yaw:p.yaw,pitch:p.pitch,basePitch:p.pitch,targetId:null,nextSample:0,pending:[],sample:null,shots:0,recoil:0};
 const dt=Math.min(.35,Math.max(0,(now-m.at)/1000));m.at=now;
 if(m.targetId!==(target?.id??null)){m.targetId=target?.id??null;m.pending=[];m.sample=null;m.nextSample=now;}
 if(target&&now>=m.nextSample){m.pending.push({at:now+settings.delay,position:{...target.position,y:target.position.y+(target.crouched?.76:1.05)}});m.nextSample=now+settings.period;}
 while(m.pending.length&&m.pending[0].at<=now)m.sample=m.pending.shift()!.position;
 const gun=p.guns?.[p.slot];
 m.recoil*=Math.exp(-dt*5);
 if(gun){
  if(m.gun===gun&&gun.shots>m.shots)m.recoil+=Math.min(8,gun.shots-m.shots)*pgGunProfile(gun).recoil;
  m.gun=gun;m.shots=gun.shots;
 }
 const eye={...p.position,y:p.position.y+(p.crouched?PG_BALANCE.crouchEye:PG_BALANCE.eye)},sample=target?m.sample:null;
 const phase=now*.0017+(m.noisePhase??=(Array.from(p.id).reduce((sum,c)=>sum+c.charCodeAt(0),0)*.31));
 const aimYaw=sample?Math.atan2(p.position.x-sample.x,p.position.z-sample.z):target?m.yaw:navigationYaw;
 const aimPitch=sample?Math.atan2(sample.y-eye.y,Math.max(1,Math.hypot(sample.x-eye.x,sample.z-eye.z))):target?m.basePitch:0;
 const desiredYaw=aimYaw+(sample?Math.sin(phase)*settings.error:0);
 const desiredPitch=aimPitch+(sample?Math.sin(phase*.71+1.3)*settings.error*.7:0);
 m.yaw=wrap(m.yaw+clamp(wrap(desiredYaw-m.yaw),settings.yaw*dt));
 m.basePitch+=clamp(desiredPitch-m.basePitch,settings.pitch*dt);
 m.pitch=clamp(m.basePitch+m.recoil,1.4);
 const facing=!!sample&&Math.abs(wrap(aimYaw-m.yaw))<.12&&Math.abs(aimPitch-m.pitch)<.1;
 return {yaw:m.yaw,pitch:m.pitch,facing,memory:m};
}
