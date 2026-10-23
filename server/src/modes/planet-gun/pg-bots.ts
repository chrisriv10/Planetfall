import {PG_MAP,pgRayBox,type BotDifficulty,type PgInput,type PgPlayer,type Vec3} from "@planetfall/shared";
export interface PgBotMemory {sequence:number;nextDecision:number;targetId:string|null;goal:number;path:number[];fireAt:number;stuckAt:number;last:Vec3;}
export const pgBotMemory=():PgBotMemory=>({sequence:0,nextDecision:0,targetId:null,goal:0,path:[],fireAt:0,stuckAt:0,last:{x:0,y:0,z:0}});
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
function visible(a:Vec3,b:Vec3):boolean {const n=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);if(n<.001)return true;const direction={x:(b.x-a.x)/n,y:(b.y-a.y)/n,z:(b.z-a.z)/n};return !PG_MAP.solids.some(box=>{const t=pgRayBox(a,direction,box);return t!==null&&t<n;});}
function route(from:number,to:number):number[]{const queue=[from],previous=new Map<number,number>([[from,-1]]);for(let i=0;i<queue.length;i++){const id=queue[i];if(id===to)break;for(const link of PG_MAP.navigation[id].links)if(!previous.has(link.to)){previous.set(link.to,id);queue.push(link.to);}}if(!previous.has(to))return [];const path:number[]=[];for(let id=to;id!==from;id=previous.get(id)!)path.unshift(id);return path;}
export function pgBotInput(p:PgPlayer,players:Iterable<PgPlayer>,now:number,difficulty:BotDifficulty,m:PgBotMemory):{input:PgInput;fire:boolean} {
  const reaction=difficulty==="easy"?500:difficulty==="hard"?170:300;
  const eye={...p.position,y:p.position.y+1.4};
  const enemies=[...players].filter(e=>e.hp>0&&e.team!==p.team&&visible(eye,{...e.position,y:e.position.y+1})).sort((a,b)=>distance(a.position,p.position)-distance(b.position,p.position));
  const target=enemies[0];
  if(target?.id!==m.targetId){m.targetId=target?.id??null;m.fireAt=now+reaction;}
  if(now>=m.nextDecision){m.nextDecision=now+reaction;
    const nodes=PG_MAP.navigation.filter(n=>difficulty!=="easy"||n.position.y===0);
    const metric=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
    const nearest=nodes.reduce((a,b)=>metric(a.position,p.position)<metric(b.position,p.position)?a:b);
    const upper=nodes.filter(n=>n.position.y>=2&&n.links.length>0),identity=p.id.charCodeAt(p.id.length-1);
    const goal=target?nodes.reduce((a,b)=>metric(a.position,target.position)<metric(b.position,target.position)?a:b):difficulty!=="easy"&&Math.floor(now/6000)%3===identity%3?upper[(identity+Math.floor(now/6000))%upper.length]:nodes[(Math.floor(now/3500)+identity*7)%nodes.length];
    m.path=route(nearest.id,goal.id);m.goal=goal.id;
  }
  while(m.path.length&&distance(PG_MAP.navigation[m.path[0]].position,p.position)<.85&&Math.abs(PG_MAP.navigation[m.path[0]].position.y-p.position.y)<.6)m.path.shift();
  const destination=m.path.length?PG_MAP.navigation[m.path[0]].position:PG_MAP.navigation[m.goal].position;
  const dx=destination.x-p.position.x,dz=destination.z-p.position.z,n=Math.max(1,Math.hypot(dx,dz));
  let yaw=target?Math.atan2(p.position.x-target.position.x,p.position.z-target.position.z):Math.atan2(-dx,-dz);
  const error=difficulty==="easy"?.05:difficulty==="hard"?.007:.022;
  yaw+=target?Math.sin(now*.003+p.id.length)*error:0;
  const pitch=target?Math.atan2(target.position.y+1.05-eye.y,Math.max(1,distance(target.position,p.position))):0;
  const c=Math.cos(yaw),s=Math.sin(yaw),forwardX=dx/n,forwardZ=dz/n;
  let jump=difficulty!=="easy"&&destination.y>p.position.y+.55;if(now-m.stuckAt>700){jump||=distance(m.last,p.position)<.5;m.last={...p.position};m.stuckAt=now;}
  if(p.mode==="wall-run"&&now>p.wallUntil-350)jump=!p.jumpHeld;
  const close=target&&distance(target.position,p.position)<12;
  const slide=!target&&difficulty!=="easy"&&p.grounded&&Math.hypot(p.velocity.x,p.velocity.z)>8&&Math.floor((now+p.id.charCodeAt(p.id.length-1)*71)/650)%11===0;
  return {input:{sequence:++m.sequence,moveX:close?Math.sin(now*.001)*.65:forwardX*c-forwardZ*s,moveZ:close?0:forwardX*s+forwardZ*c,yaw,pitch,jump,sprint:!target,crouch:slide,ads:!!target},fire:!!target&&now>=m.fireAt};
}
